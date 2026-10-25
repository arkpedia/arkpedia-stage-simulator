// SPDX-License-Identifier: GPL-3.0-or-later
// Unadmitted candidate. Native shell and lingering collider have separate lives.
import { areaSelectable, canTargetAlly, sortAllyTargets } from '../targeting.js';
const live = u => u?.alive && u.deployed && !u.hidden;
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
    for (const [u, receipt] of zone.units) if (u.deploySeq === receipt.life) b.removeBuff(u, receipt.buff);
    zone.units.clear();
  };
  const update = zone => {
    const current = new Set(opponents(b).filter(u => live(u) && ground(u) && areaSelectable(zone.source, u)
      && within(u, zone.x, zone.y, 1.5)));
    for (const [u, receipt] of zone.units) if (!current.has(u) || u.deploySeq !== receipt.life
      || !u.buffs.includes(receipt.buff)) {
      zone.units.delete(u);
      if (u.deploySeq === receipt.life) b.removeBuff(u, receipt.buff);
    }
    for (const u of current) {
      if (ended || !zones.has(zone)) return;
      if (!zone.units.has(u)) {
        const buff = b.addBuff(u, { key: zone.key, source: zone.source, persist: true });
        if (!buff || !live(u)) continue;
        zone.units.set(u, { buff, life: u.deploySeq, next: b.time + 1 });
      }
      const receipt = zone.units.get(u);
      while (!ended && zones.has(zone) && receipt.next <= Math.min(b.time, zone.end) + 1e-9 && live(u) && u.deploySeq === receipt.life) {
        receipt.next += 1;
        b.dealDamage(zone.source, u, { amount: zone.value, type: 'arts', canDodge: false,
          isAttack: false, tags: ['chapter16', 'dot'] });
      }
    }
    if (b.time >= zone.end - 1e-9) clear(zone);
  };
  const field = b.chapter16Artillery = {
    add(source, x, y, duration, value) {
      if (ended) return;
      const zone = { source, x, y, end: b.time + duration, value, units: new Map(), key: `ch16:burn:${++seq}` };
      zones.add(zone); update(zone);
      b.fx('zone', { x, y, r: 1.5, dur: duration, kind: 'fire' });
    },
  };
  b.on('tick', () => { for (const zone of [...zones]) update(zone); });
  b.on('battleEnd', () => { ended = true; for (const zone of [...zones]) clear(zone); });
  return field;
}

export function lightArtillery(r) {
  const bb = r.talents.bb, prefix = 'ProjectileBoomRange.attack@';
  const radius = bb[prefix + 'projectile_range'], duration = bb[prefix + 'projectile_life_time'], value = bb[prefix + 'value'];
  if (![radius, duration, value].every(n => Number.isFinite(n) && n > 0)) throw Error('Invalid native artillery parameters');
  return {
    spawn(b, e, a) {
      a.scan = 0; a.fields = burningFields(b);
      e.profile.melee = false; e.profile.deferHit = true; e.profile.canTarget = ground;
      b.addBuff(e, { key: 'enemy_field_army_self_mark', persist: true });
    },
    tick(b, e, a, dt) {
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
      const life = e.deploySeq;
      for (const target of c.targets) b.addProjectile({ from: e, target, source: e, speed: 4, maxAge: 10,
        onHit: hit => {
          if (!hit.target) return;
          const { x, y } = hit.target;
          const victims = new Set(opponents(b).filter(u => live(u) && ground(u) && areaSelectable(e, u) && within(u, x, y, radius)));
          victims.add(hit.target); // Native shell forcibly includes its trace target.
          for (const u of victims) b.dealDamage(e, u, { amount: e.s.atk, type: 'phys', isAttack: true,
            canDodge: true, applyWay: 'ranged', tags: ['chapter16'] });
          // The physical shell survives source death, but CheckUnitAlive in
          // the impact action refuses to create a new burning field then.
          if (live(e) && e.deploySeq === life) a.fields.add(e, x, y, duration, value);
        } });
    },
  };
}
