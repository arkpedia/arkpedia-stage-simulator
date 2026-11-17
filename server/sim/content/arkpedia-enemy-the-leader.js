// SPDX-License-Identifier: GPL-3.0-or-later
// "The Leader" (enemy_1536_ncrmcr). Every number arrives in `p` from the
// reviewed contract (shared/arkpedia/enemy-the-leader-features.js). Her Rebirth
// aura is the separate, already reviewed deathConversionAura (talent:Aura).
import { rebornAbility } from './arkpedia-enemy-forms.js';
import { boundByExhaustedFlame } from './arkpedia-enemy-exhausted-flame.js';
import { areaSelectable, sortAllyTargets } from '../targeting.js';
import { ALLY_COLLIDER_RADIUS } from '../constants.js';

const CAST_BUFF = 'ab:ncrmcrCast';
export const SHIELD_BUFF = 'enemy_ncrmcr_shield';

export function theLeader(p) {
  validate(p);
  let form = 1;
  const f = () => form === 2 ? p.form2 : p.form1;

  // --- Ordinary attacks: Combat on the blocker (two 0.8x hits in the second form), a projectile otherwise ---
  const arts = (b, e, u, scale, tags, applyWay, attackId) => b.dealDamage(e, u, { amount: e.s.atk * scale, type: 'arts',
    isAttack: true, attackId, applyWay, tags });
  const shoot = (b, e, u, attackId) => b.addProjectile({ from: e, target: u, speed: p.shotSpeed, visual: 'enemy', source: e,
    onHit: c => { if (c.target?.alive) arts(b, e, c.target, 1, ['ncrmcrAttack'], 'ranged', attackId); } });

  // --- Skills ---
  const finishCast = (b, e, a) => {
    if (!a.cast) return;
    a.cast = null; e.profile.noAttack = false; e.skillAnimUntil = b.time; b.removeBuff(e, CAST_BUFF);
  };
  const startCast = (b, e, a, cast) => {
    a.cast = { elapsed: 0, released: false, ...cast };
    e.profile.noAttack = true; e.skillAnimUntil = b.time + cast.duration;
    b.addBuff(e, { key: CAST_BUFF, persist: true, flags: { noMove: true } });
  };
  const chainTargets = (b, e) => sortAllyTargets(e, b.alliesInRadius(e.x, e.y, p.chain.radius + ALLY_COLLIDER_RADIUS)
    .filter(u => areaSelectable(e, u) && u.kind !== 'device' && !boundByExhaustedFlame(u)));
  const soldiers = (b, key) => b.enemies.filter(u => u.alive && u.deployed !== false && u.defId === key && u.form !== 'husk')
    .sort((x, y) => (x.spawnSeq ?? 0) - (y.spawnSeq ?? 0));
  const releaseChain = (b, e, cast) => {
    for (const { row, col } of cast.picks) {
      b.addProjectile({ from: e, to: { x: col, y: row }, speed: p.chain.speed, visual: 'enemy', source: e, onHit: () => {
        // The flame is born on the tile captured at selection; with nobody there it goes out on its own.
        b.spawnEnemy(f().chain.key, { pos: [row, col], route: 0, countInTotal: false });
      } });
    }
  };
  const releaseSacrifice = (b, e, cast) => {
    const s = f().sacrifice;
    for (const u of soldiers(b, s.key).slice(0, s.max)) {
      const from = { x: u.x, y: u.y };
      // InstantKill without skipping rebirth: each soldier's own Ember rebirth follows.
      b.kill(u, e);
      b.addProjectile({ from, target: e, speed: p.sacrifice.speed, visual: 'enemy', source: e, onHit: () => {
        if (!e.alive) return;
        b.addBuff(e, { key: SHIELD_BUFF, source: e, refresh: 'independent', maxStacks: Number.MAX_SAFE_INTEGER,
          duration: s.duration, visible: true, shield: e.s.maxHp * s.scale, shieldTypes: ['phys', 'arts'] });
      } });
    }
  };
  const tickCast = (b, e, a, dt) => {
    const cast = a.cast;
    cast.elapsed += dt * e.s.slowDownRate;
    if (!cast.released && cast.elapsed + 1e-9 >= cast.release) {
      cast.released = true;
      if (cast.kind === 'chain') releaseChain(b, e, cast);
      else if (cast.kind === 'sacrifice') releaseSacrifice(b, e, cast);
      else if (cast.kind === 'arson') b.stageReeds?.igniteAll();
    }
    e.skillAnimUntil = b.time + Math.max(0, cast.duration - cast.elapsed) / Math.max(.001, e.s.slowDownRate);
    if (cast.elapsed + 1e-9 >= cast.duration) finishCast(b, e, a);
  };
  const resetSkills = (a, s) => { a.chainLeft = s.chain.initial; a.sacrificeLeft = s.sacrifice.initial; };

  const rebirth = rebornAbility({
    dur: p.rebirth, hpRatio: p.rebornHp, invincible: p.invincible,
    onKo(b, e, a) {
      finishCast(b, e, a);
      // FinishCurrentWave runs on the Reborn sequence itself: the waves go on at the knock-out.
      b.stageWaveScheduler?.releaseCurrentWave(e, { trackSourceAtNextWave: true });
    },
    onReborn(b, e, a) {
      form = 2;
      b.addBuff(e, { key: 'enemy_ncmcr_atk_up', persist: true, visible: true, mods: { atkPct: p.form2.atk } });
      e.def = { ...e.def, attackAnim: p.form2.attackAnim };
      e.profile.maxTargets = p.form2.rangedTargets;
      e.profile.noAttack = false;
      resetSkills(a, p.form2);
      // Arson: cast once on entering the second form, with or without Reeds on the field.
      startCast(b, e, a, { kind: 'arson', duration: p.arson.duration, release: p.arson.release });
    },
  });

  return {
    ...rebirth,
    iv: 0,
    spawn(b, e, a) {
      a.cast = null; resetSkills(a, p.form1);
      e.profile.shot = 'none'; e.profile.deferHit = true; e.profile.melee = false;
      e.profile.maxTargets = p.form1.rangedTargets;
      e.profile.canTarget = u => !u.isFlying;
      e.def = { ...e.def, attackAnim: p.form1.attackAnim };
    },
    attack(c, b, e) {
      const attackId = b._attackSeq;
      // Blocked, she uses her Combat ability on the blocker alone.
      const targets = e.blockedBy && c.targets.includes(e.blockedBy) ? [e.blockedBy] : c.targets;
      for (const u of targets) {
        if (!u.alive) continue;
        if (e.blockedBy !== u) { shoot(b, e, u, attackId); continue; }
        const melee = f().melee;
        arts(b, e, u, melee.scale, ['ncrmcrCombat'], 'melee', attackId);
        // Later strikes at the Combat clip's further OnAttack events, while the same blocker remains.
        for (const delay of melee.followUps) b.after(delay, () => {
          if (e.alive && u.alive && e.blockedBy === u) arts(b, e, u, melee.scale, ['ncrmcrCombat'], 'melee', attackId);
        }, { owner: e });
      }
    },
    tick(b, e, a, dt) {
      if (a.state === 'reborn') return;
      if (a.cast) { if (!e.canAct) finishCast(b, e, a); else tickCast(b, e, a, dt); return; }
      a.chainLeft -= dt; a.sacrificeLeft -= dt;
      if (!e.canAct) return;
      const s = f();
      // Priority: Sacrifice (1) before Chain (0).
      if (a.sacrificeLeft <= 1e-9 && soldiers(b, s.sacrifice.key).length) {
        a.sacrificeLeft = s.sacrifice.cooldown;
        startCast(b, e, a, { kind: 'sacrifice', duration: s.sacrifice.anim.duration, release: s.sacrifice.anim.release });
        return;
      }
      if (a.chainLeft <= 1e-9) {
        const picks = chainTargets(b, e).slice(0, s.chain.maxTargets);
        if (!picks.length) return;
        a.chainLeft = s.chain.cooldown;
        startCast(b, e, a, { kind: 'chain', duration: s.chain.anim.duration, release: s.chain.anim.release,
          picks: picks.map(u => ({ target: u, row: Math.round(u.y), col: Math.round(u.x) })) });
      }
    },
    killed(c, b, e, a) { return form === 2 ? false : rebirth.killed(c, b, e, a); },
    death(_c, b, e, a) { finishCast(b, e, a); },
  };
}

function validate(p) {
  const pos = v => Number.isFinite(v) && v > 0, nn = v => Number.isFinite(v) && v >= 0;
  const anim = a => a && pos(a.duration) && nn(a.release) && a.release <= a.duration;
  const clip = a => a && pos(a.dur) && nn(a.hit);
  const form = s => s && clip(s.attackAnim) && Number.isSafeInteger(s.rangedTargets) && s.rangedTargets >= 1
    && s.melee && pos(s.melee.scale) && Array.isArray(s.melee.followUps) && s.melee.followUps.every(pos)
    && s.chain && typeof s.chain.key === 'string' && pos(s.chain.cooldown) && nn(s.chain.initial) && Number.isSafeInteger(s.chain.maxTargets) && anim(s.chain.anim)
    && s.sacrifice && typeof s.sacrifice.key === 'string' && pos(s.sacrifice.cooldown) && nn(s.sacrifice.initial)
    && Number.isSafeInteger(s.sacrifice.max) && s.sacrifice.max >= 1 && pos(s.sacrifice.scale) && pos(s.sacrifice.duration) && anim(s.sacrifice.anim);
  if (!p || !form(p.form1) || !form(p.form2) || !nn(p.form2.atk) || !pos(p.shotSpeed) || !p.chain || !pos(p.chain.radius) || !pos(p.chain.speed)
    || !p.sacrifice || !pos(p.sacrifice.speed) || !anim(p.arson) || !pos(p.rebirth) || !(p.rebornHp > 0 && p.rebornHp <= 1) || !nn(p.invincible))
    throw Error('Invalid The Leader');
}
theLeader.validate = validate;
