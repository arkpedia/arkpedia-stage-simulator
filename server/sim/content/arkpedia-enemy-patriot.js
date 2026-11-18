// SPDX-License-Identifier: GPL-3.0-or-later
// Patriot (enemy_1506_patrt). Every number arrives in `p` from the reviewed contract
// (shared/arkpedia/enemy-patriot-features.js). Native modes: Default (Marching Stance)
// and Rage (Ruination Stance).
import { rebornAbility } from './arkpedia-enemy-forms.js';
import { OwnedStageAura } from './arkpedia-stage-auras.js';
import { areaSelectable } from '../targeting.js';
import { ALLY_COLLIDER_RADIUS } from '../constants.js';

const MARKER = 'enemy_9D0_talent_strength', GRANT = 'enemy_9D0_talent_strength[patrt]';
const MARCH = 'patrt_t_state_1[shield]', TAUNT = 'patrt_t_state_1[taunt]', REVIVING = 'patrt_trigger_ore[reborning]', RUIN = 'patrt_trigger_ore[rage]';
const SPEAR = 'ab:patrtSpear';
const live = u => u?.alive && u.deployed !== false && !u.hidden;
const ground = (e, u) => live(u) && !u.isFlying && areaSelectable(e, u);

export function patriot(p) {
  validate(p);

  // --- Strength: every enemy on the field (selectability ignored), one non-stacking grant per key, plus the marker ---
  const updateAura = (b, e, a) => {
    const targets = e.alive && e.deployed ? b.enemies.filter(u => u.alive && u.deployed && !u.removed && u.side === e.side) : [];
    a.grant.update(targets); a.marker.update(targets);
  };
  // --- Sacrifice (Immo[Rage]): true splash to ground operators within 1.75, every 0.8 s from the knock-out on ---
  const sacrifice = (b, e) => {
    for (const u of b.alliesInRadius(e.x, e.y, p.immo.radius + ALLY_COLLIDER_RADIUS))
      if (ground(e, u)) b.dealDamage(e, u, { amount: e.s.atk * p.immo.scale, type: 'true', isSplash: true, isSkill: true,
        applyWay: 'none', noSp: true, tags: ['patrtSacrifice'] });
  };
  const spearTarget = (b, e) => b.allies().filter(u => ground(e, u) && b.grid.tile(Math.round(u.y), Math.round(u.x)).build === 'RANGED'
    && Math.hypot(u.x - e.x, u.y - e.y) <= p.spear.radius + 1e-9)
    .sort((x, y) => Math.hypot(y.x - e.x, y.y - e.y) - Math.hypot(x.x - e.x, x.y - e.y))[0] ?? null;

  const rebirth = rebornAbility({
    dur: p.revive.dur, hpRatio: p.revive.hp, invincible: p.revive.invincible,
    onKo(b, e, a) {
      // patrt_t_state_1[release_wave] finishes with the Marching Stance: the current wave is released.
      b.removeBuff(e, MARCH); b.removeBuff(e, TAUNT);
      b.stageWaveScheduler?.releaseCurrentWave(e);
      b.addBuff(e, { key: REVIVING, duration: p.revive.dur, persist: true, mods: { atkPct: p.revive.atkPct, defFlat: p.revive.defFlat } });
      a.sacrifice = b.every(p.revive.interval, () => { if (e.alive) sacrifice(b, e); }, { owner: e });
    },
    onReborn(b, e, a) {
      a.form = 2;
      b.removeBuff(e, REVIVING);
      e.def = { ...e.def, attackAnim: p.ruin.anim, immune: new Set([...e.def.immune, 'stun', 'frozen', 'levitate']) };
      b.addBuff(e, { key: RUIN, persist: true, visible: true,
        mods: { moveFlat: p.ruin.move, batFlat: p.ruin.bat, atkPct: p.ruin.atkPct, defFlat: p.ruin.defFlat } });
      e.base.rangeRadius = p.ruin.radius; e.markDirty?.();
      e.profile.canTarget = u => !u.isFlying;
      a.spearLeft = p.spear.initial;
    },
  });

  return {
    ...rebirth,
    spawn(b, e, a) {
      a.form = 1; a.cast = null;
      e.profile.pulseImmune = true; e.profile.shot = 'none'; e.profile.deferHit = true;
      e.def = { ...e.def, attackAnim: { dur: p.march.anim.dur, hit: p.march.anim.hits[0] } };
      // Marching Stance: blocked-only four-hit attack, shield multipliers, taunt +2.
      e.profile.canTarget = u => u === e.blockedBy;
      b.addBuff(e, { key: MARCH, persist: true, visible: true, mods: { atkPct: p.march.atkPct, defPct: p.march.defPct, resPct: p.march.resPct } });
      b.addBuff(e, { key: TAUNT, persist: true, mods: { taunt: p.march.taunt } });
      a.grant = new OwnedStageAura(b, e, { key: GRANT, strength: 1, mods: { atkPct: p.aura.atkPct, defFlat: p.aura.defFlat } });
      a.marker = new OwnedStageAura(b, e, { key: MARKER, strength: 1 });
      updateAura(b, e, a);
      b.on('enemySpawn', () => updateAura(b, e, a), { owner: e });
    },
    attack(c, b, e, a) {
      const target = c.targets.find(u => u?.alive);
      if (!target || a.state === 'reborn') return;
      const attackId = b._attackSeq;
      if (a.form === 2) {
        b.dealDamage(e, target, { amount: e.s.atk, type: 'phys', isAttack: true, attackId, applyWay: 'melee', tags: ['patrtRuin'] });
        return;
      }
      // _additionalTimes 3: four strikes on the Attack_1 events.
      const hit = () => { if (target.alive && e.alive && a.form === 1)
        b.dealDamage(e, target, { amount: e.s.atk, type: 'phys', isAttack: true, attackId, applyWay: 'melee', tags: ['patrtMarch'] }); };
      hit();
      for (const t of p.march.anim.hits.slice(1)) b.after(t - p.march.anim.hits[0], hit, { owner: e });
    },
    tick(b, e, a, dt) {
      updateAura(b, e, a);
      if (a.form !== 2 || a.state === 'reborn') return;
      // throwspear[Rage]: stand for the Skill clip; the spear leaves at 1.7 s and lands 0.5 s later. The cooldown runs from the cast start.
      a.spearLeft -= dt;
      if (a.cast) {
        a.cast.elapsed += dt;
        if (!a.cast.released && a.cast.elapsed + 1e-9 >= p.spear.anim.hit) {
          a.cast.released = true;
          const target = a.cast.target;
          b.after(p.spear.flight, () => { if (target.alive && e.alive)
            b.dealDamage(e, target, { amount: e.s.atk * p.spear.scale, type: 'phys', isSkill: true, applyWay: 'ranged', tags: ['patrtSpear'] }); }, { owner: e });
        }
        if (a.cast.elapsed + 1e-9 >= p.spear.anim.dur) { a.cast = null; e.profile.noAttack = false; b.removeBuff(e, SPEAR); }
        return;
      }
      if (a.spearLeft > 1e-9) return;
      const target = spearTarget(b, e);
      if (!target) return;
      a.spearLeft = p.spear.cooldown;
      a.cast = { elapsed: 0, released: false, target };
      e.profile.noAttack = true; e.skillAnimUntil = b.time + p.spear.anim.dur;
      b.addBuff(e, { key: SPEAR, persist: true, flags: { noMove: true } });
    },
    death(_c, b, e, a) { a.sacrifice?.cancel(); a.grant?.update([]); a.marker?.update([]); },
  };
}

function validate(p) {
  const pos = v => Number.isFinite(v) && v > 0, fin = Number.isFinite;
  const ok = fin(p?.aura?.atkPct) && fin(p.aura.defFlat) && fin(p.march?.atkPct) && fin(p.march.defPct) && fin(p.march.resPct) && fin(p.march.taunt)
    && pos(p.march.anim?.dur) && Array.isArray(p.march.anim.hits) && p.march.anim.hits.length === 4 && p.march.anim.hits.every(t => t > 0 && t <= p.march.anim.dur)
    && pos(p.revive?.dur) && p.revive.hp > 0 && p.revive.hp <= 1 && pos(p.revive.invincible) && pos(p.revive.interval) && fin(p.revive.atkPct) && fin(p.revive.defFlat)
    && pos(p.immo?.scale) && pos(p.immo.radius) && pos(p.ruin?.interval) && fin(p.ruin.move) && fin(p.ruin.bat) && fin(p.ruin.atkPct) && fin(p.ruin.defFlat)
    && pos(p.ruin.radius) && pos(p.ruin.anim?.dur) && pos(p.spear?.cooldown) && p.spear.initial >= 0 && pos(p.spear.scale) && pos(p.spear.radius)
    && pos(p.spear.anim?.dur) && pos(p.spear.anim.hit) && pos(p.spear.flight);
  if (!ok) throw Error('Invalid Patriot parameters');
}
