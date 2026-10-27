// SPDX-License-Identifier: GPL-3.0-or-later
// Unadmitted candidate. Native shell and lingering collider have separate lives.
import { areaSelectable, canTargetAlly, sortAllyTargets } from '../targeting.js';
import { sourceAbilityDelta } from './arkpedia-slow-down.js';
import { captureEnemySource } from './enemy-source-view.js';
import clocks from '../../../data/candidates/arkpedia-ch16-artillery-clock-contract.json' with { type: 'json' };
const live = u => u?.alive && u.deployed && !u.hidden;
const controlled = e => ['stun', 'freeze', 'sleep', 'levitate', 'fear', 'disarm'].some(k => e.s.flags[k])
  || e.s.flags.noCombat && !!e.blockedBy;
const bodyRadius = u => u.profile?.neutral ? (u.mem.ch16BodyRadius ?? .1) : .25;
const opponents = b => [...b.allyUnits, ...b.enemies.filter(u => u.profile?.neutral)];
const ground = u => !u.isFlying && !u.s.flags.liftoff;
const within = (u, x, y, radius) => Math.hypot(u.x - x, u.y - y) <= radius + bodyRadius(u) + 1e-9;

function burningFields(b) {
  if (b.chapter16Artillery) return b.chapter16Artillery;
  let seq = 0;
  let ended = false;
  const zones = new Set();
  const clear = zone => {
    zones.delete(zone);
    for (const [u, receipt] of zone.units) b.removeBuff(u, receipt.buff);
    zone.units.clear();
  };
  const update = zone => {
    const source = () => zone.owner.deploySeq === zone.life ? zone.owner : zone.fallback;
    const current = new Set(opponents(b).filter(u => live(u) && ground(u) && areaSelectable(source(), u)
      && within(u, zone.x, zone.y, 1.5)));
    for (const [u, receipt] of zone.units) if (!current.has(u) || u.deploySeq !== receipt.life
      || !u.buffs.includes(receipt.buff)) {
      zone.units.delete(u);
      b.removeBuff(u, receipt.buff);
    }
    for (const { unit: u, life } of [...current].map(unit => ({ unit, life: unit.deploySeq }))) {
      if (ended || !zones.has(zone)) return;
      if (!live(u) || u.deploySeq !== life) continue;
      if (!zone.units.has(u)) {
        const buff = b.addBuff(u, { key: zone.key, source: source(), persist: true });
        if (!buff || !live(u) || u.deploySeq !== life || ended || !zones.has(zone)) {
          if (buff) b.removeBuff(u, buff);
          continue;
        }
        zone.units.set(u, { buff, life, next: b.time + 1 });
      }
      const receipt = zone.units.get(u);
      while (!ended && zones.has(zone) && receipt.next <= Math.min(b.time, zone.end) + 1e-9 && live(u) && u.deploySeq === receipt.life) {
        receipt.next += 1;
        b.dealDamage(source(), u, { amount: zone.value, type: 'arts', canDodge: false,
          isAttack: false, tags: ['chapter16', 'dot'] });
      }
    }
    if (b.time >= zone.end - 1e-9) clear(zone);
  };
  const field = b.chapter16Artillery = {
    add(source, x, y, duration, value) {
      if (ended) return;
      const zone = { owner: source, life: source.deploySeq, fallback: captureEnemySource(source),
        x, y, end: b.time + duration, value, units: new Map(), key: `ch16:burn:${++seq}` };
      zones.add(zone); update(zone);
      b.fx('zone', { x, y, r: 1.5, dur: duration, kind: 'fire' });
    },
  };
  b.on('tick', () => { for (const zone of [...zones]) update(zone); });
  b.on('battleEnd', () => { ended = true; for (const zone of [...zones]) clear(zone); });
  return field;
}

export function lightArtillery(r) {
  const clock = clocks.enemies[r.key];
  if (!clock || r.prefabKey !== r.key) throw Error('Unreviewed artillery clock identity');
  const cast = JSON.parse(clock.originalJson);
  if (cast._animKey !== 'Attack' || cast._timeMode !== 0 || cast._maxAnimScale !== 1 || cast._affectedBySlowDown !== 1
    || cast._selectTargetSource !== 2 || cast._selectTargetTiming !== 0 || cast._waitForAttackEvent !== 1
    || cast._useCachedAtkOnly !== 0 || cast._projectileKey !== 'projectile_enemy_uacann') throw Error('Unreviewed artillery cast clock');
  const bb = r.talents.bb, prefix = 'ProjectileBoomRange.attack@';
  const radius = bb[prefix + 'projectile_range'], duration = bb[prefix + 'projectile_life_time'], value = bb[prefix + 'value'];
  if (![radius, duration, value].every(n => Number.isFinite(n) && n > 0)) throw Error('Invalid native artillery parameters');
  return {
    spawn(b, e, a) {
      a.scan = 0; a.fields = burningFields(b);
      e.profile.melee = false; e.profile.deferHit = true; e.profile.canTarget = ground;
      b.addBuff(e, { key: 'enemy_field_army_self_mark', persist: true });
      const life = e.deploySeq, port = { pending: null };
      a.active = true; a.ended = false;
      a.valid = () => a.active && !b.finished && !b._endReq && live(e) && e.deploySeq === life && e.profile.sourceAttack === port;
      port.finish = p => { if (port.pending !== p) return; port.pending = null; b.removeBuff(e, p.hold); };
      port.begin = targets => {
        if (!a.valid() || port.pending || controlled(e) || !targets.length || targets.some(t => !live(t))) return false;
        const p = { targets: targets.map(unit => ({ unit, life: unit.deploySeq })), epoch: e.attackControlEpoch,
          age: 0, lastAt: b.time, rate: Math.min(1, e.base.bat / e.s.interval), released: false, attackId: ++b._attackSeq };
        port.pending = p; e.lastAttackAt = b.time; e.atkCd = e.s.interval; e.stats.attacks++;
        p.hold = b.addBuff(e, { key: 'ch16:artillery-ordinary', persist: true, flags: { noMove: true } });
        return true;
      };
      port.advance = p => {
        const current = () => a.valid() && port.pending === p && !controlled(e) && e.attackControlEpoch === p.epoch;
        if (!current()) { port.finish(p); return; }
        p.age += sourceAbilityDelta(e, Math.max(0, b.time-p.lastAt), true) * p.rate; p.lastAt = b.time;
        if (!p.released && p.age + 1e-7 >= clock.hit) {
          p.released = true;
          const targets = p.targets.filter(t => live(t.unit) && t.unit.deploySeq === t.life).map(t => t.unit);
          for (const target of targets) b._ev(['atk', e.id, target.id, 'none']);
          if (current()) b.emit('attack', { attacker: e, targets, isSkill: false, profile: e.profile, attackId: p.attackId });
        }
        if (!current() || p.age + 1e-7 >= clock.duration) port.finish(p);
      };
      a.ordinary = port; e.profile.sourceAttack = port; e.profile.attackCooldownAffectedBySlowDown = true;
      a.detach = () => { a.active = false; if (port.pending) port.finish(port.pending); };
      b.on('removed', ({ unit }) => { if (unit === e) a.detach(); });
      b.on('battleEnd', () => { a.ended = true; a.detach(); });
    },
    tick(b, e, a, dt) {
      if (!a.valid()) { a.detach(); return; }
      if (a.ordinary.pending) a.ordinary.advance(a.ordinary.pending);
      a.scan += dt;
      while (a.scan >= .2 - 1e-9) {
        a.scan -= .2;
        if (e.findBuff('enemy_uacomd_extra_power')) {
          if (!e.findBuff('uacann_a[extra_effect_core]')) b.addBuff(e, { key: 'uacann_a[extra_effect_core]', persist: true });
        } else b.removeBuff(e, 'uacann_a[extra_effect_core]');
      }
    },
    before(c, b, e) {
      if (!e.findBuff('enemy_uacomd_extra_power')) return;
      const miners = b.enemies.filter(u => live(u) && u.profile?.neutral && u.findBuff('enemy_mcreep_self_mark')
        && ground(u) && canTargetAlly(e, u, true) && within(u, e.x, e.y, r.stats.rawRangeRadius));
      sortAllyTargets(e, miners);
      if (miners.length) c.targets = [miners[0]];
    },
    attack(c, b, e, a) {
      if (!a.valid()) return;
      const life = e.deploySeq, fallback = captureEnemySource(e), source = () => e.deploySeq === life ? e : fallback;
      for (const target of c.targets) b.addProjectile({ from: e, target, source: e, speed: 4, maxAge: 10,
        onHit: hit => {
          if (a.ended || b.finished || b._endReq || !hit.target) return;
          const { x, y } = hit.target;
          const victims = new Set(opponents(b).filter(u => live(u) && ground(u) && areaSelectable(source(), u) && within(u, x, y, radius)));
          victims.add(hit.target); // Native shell forcibly includes its trace target.
          const selected = [...victims].map(unit => ({ unit, life: unit.deploySeq }));
          for (const { unit: u, life: targetLife } of selected) {
            if (a.ended || b.finished || b._endReq) break;
            if (!live(u) || u.deploySeq !== targetLife) continue;
            const credit = source();
            b.dealDamage(credit, u, { amount: credit.s.atk, type: 'phys', isAttack: true, attackId: c.attackId,
              canDodge: true, applyWay: 'ranged', tags: ['chapter16'] });
          }
          // The physical shell survives source death, but CheckUnitAlive in
          // the impact action refuses to create a new burning field then.
          if (!a.ended && !b.finished && !b._endReq && live(e) && e.deploySeq === life) a.fields.add(e, x, y, duration, value);
        } });
    },
    death(c, b, e, a) { a.detach(); },
  };
}
