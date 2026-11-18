// SPDX-License-Identifier: GPL-3.0-or-later
// 'The Big Ugly Thing' (enemy_1512_mcmstr). Every number arrives in `p` from the
// reviewed contract (shared/arkpedia/enemy-big-ugly-thing-features.js). He has two
// native modes: the machine (Default) and, after the first knock-out, the High
// Priest (Bird).
import { rebornAbility } from './arkpedia-enemy-forms.js';
import { areaSelectable } from '../targeting.js';
import { ALLY_COLLIDER_RADIUS } from '../constants.js';

const CAST_BUFF = 'ab:mcmstrCut', PRIEST_BUFF = 'mcmstr_state_2_run';
const live = u => u?.alive && u.deployed !== false && !u.hidden;
const tileOf = u => [Math.round(u.y), Math.round(u.x)];

export function bigUglyThing(p) {
  validate(p);
  let form = 1;

  // --- Attack: a ranged shot with a 3x3 splash, or the heavy melee strike while blocked ---
  const shoot = (b, e, target, attackId) => {
    b.addProjectile({ from: e, target, speed: p.attack.speed, visual: 'enemy', source: e, onHit: c => {
      const main = c.target;
      if (!main?.alive) return;
      const [row, col] = tileOf(main);
      b.dealDamage(e, main, { amount: e.s.atk, type: 'phys', isAttack: true, attackId, applyWay: 'ranged', tags: ['mcmstrShot'] });
      // The projectile's 3x3 box catches every operator on the eight surrounding tiles, flying ones included.
      for (const u of b.allies(null, { includeTargetableDevices: true })) {
        if (u === main || !live(u) || !areaSelectable(e, u)) continue;
        const [r, c2] = tileOf(u);
        if (Math.abs(r - row) > p.attack.splashTiles || Math.abs(c2 - col) > p.attack.splashTiles) continue;
        b.dealDamage(e, u, { amount: e.s.atk, type: 'phys', isAttack: true, isSplash: true, attackId, applyWay: 'ranged', tags: ['mcmstrSplash'] });
      }
    } });
  };

  // --- Cut: fells a Giant Mushroom (first) or Stump within reach; the tile becomes a broken stump ---
  const finishCast = (b, e, a) => {
    if (!a.cast) return;
    a.cast = null; e.profile.noAttack = form === 2; e.skillAnimUntil = b.time; b.removeBuff(e, CAST_BUFF);
  };
  const mushroomAt = (b, row, col) => [...(b.stageScenery?.entries.values() ?? [])]
    .some(x => x.row === row && x.col === col && x.unit?.alive);
  const pickStump = (b, e) => {
    const all = b.stageScenery?.destructibleStumps(e, p.cut.radius) ?? [];
    const mushrooms = all.filter(t => mushroomAt(b, t.row, t.col));
    return b.rng.pick(mushrooms.length ? mushrooms : all) ?? null;
  };

  // --- First knock-out: a full-HP revive; the bomb goes off during it; then the High Priest ---
  const rebirth = rebornAbility({
    dur: p.rebirth, hpRatio: p.rebornHp,
    onKo(b, e, a) {
      finishCast(b, e, a);
      b.fx?.('telegraph', { x: e.x, y: e.y, r: p.bomb.radius, dur: p.bomb.delay, kind: 'mechBomb', id: e.id });
      b.after(p.bomb.delay, () => {
        if (!e.alive) return;
        b.fx?.('explode', { x: e.x, y: e.y, r: p.bomb.radius, kind: 'mechBomb', id: e.id });
        const amount = e.s.atk * p.bomb.scale;
        for (const u of b.alliesInRadius(e.x, e.y, p.bomb.radius + ALLY_COLLIDER_RADIUS)) {
          if (!live(u) || u.isFlying || !areaSelectable(e, u)) continue;
          b.dealDamage(e, u, { amount, type: 'phys', isSplash: true, isSkill: true, applyWay: 'none', noSp: true, tags: ['mcmstrBomb'] });
          if (u.alive) b.applyStatus(u, 'stun', { duration: p.bomb.stun, source: e });
        }
      }, { owner: e });
    },
    onReborn(b, e, a) {
      form = 2;
      e.profile.noAttack = true;
      b.addBuff(e, { key: PRIEST_BUFF, persist: true, visible: true, flags: { unblockable: true },
        mods: { defFlat: p.priest.def, resFlat: p.priest.res, moveFlat: p.priest.move } });
      // periodic_damage_without_modify_no_fx: sourceless pure damage every interval, first after one interval.
      a.burn = b.every(p.priest.interval, () => {
        if (e.alive) b.dealDamage(null, e, { amount: p.priest.damage, type: 'true', sourceless: true, canDodge: false, tags: ['mcmstrPriestBurn'] });
      }, { owner: e });
    },
  });

  return {
    ...rebirth,
    spawn(b, e, a) {
      a.cutLeft = p.cut.initial; a.cast = null;
      e.profile.shot = 'none'; e.profile.deferHit = true; e.profile.melee = false;
      e.base.rangeRadius = p.attack.radius; e.markDirty?.();
      e.profile.canTarget = u => !u.isFlying;
      e.def = { ...e.def, attackAnim: p.attack.ranged };
    },
    attack(c, b, e) {
      if (form === 2) return;
      const attackId = b._attackSeq, blocker = e.blockedBy;
      if (blocker?.alive) {
        b.dealDamage(e, blocker, { amount: e.s.atk * p.attack.meleeScale, type: 'phys', isAttack: true, attackId,
          applyWay: 'melee', tags: ['mcmstrMelee'] });
        return;
      }
      const target = c.targets.find(u => u?.alive);
      if (target) shoot(b, e, target, attackId);
    },
    tick(b, e, a, dt) {
      if (form === 2 || a.state === 'reborn') return;
      e.def.attackAnim = e.blockedBy ? p.attack.melee : p.attack.ranged;
      a.cutLeft -= dt; // the cooldown runs from the start of each cast
      const cast = a.cast;
      if (cast) {
        if (!e.canAct) { finishCast(b, e, a); return; }
        cast.elapsed += dt * e.s.slowDownRate;
        if (!cast.released && cast.elapsed + 1e-9 >= p.cut.anim.hit) {
          cast.released = true;
          b.stageScenery?.destroyStump(cast.row, cast.col, e);
        }
        e.skillAnimUntil = b.time + Math.max(0, p.cut.anim.dur - cast.elapsed) / Math.max(.001, e.s.slowDownRate);
        if (cast.elapsed + 1e-9 >= p.cut.anim.dur) finishCast(b, e, a);
        return;
      }
      if (a.cutLeft > 1e-9 || !e.canAct) return;
      const tile = pickStump(b, e);
      if (!tile) return;
      a.cutLeft = p.cut.cooldown;
      a.cast = { elapsed: 0, released: false, row: tile.row, col: tile.col };
      e.profile.noAttack = true; e.skillAnimUntil = b.time + p.cut.anim.dur;
      b.addBuff(e, { key: CAST_BUFF, persist: true, flags: { noMove: true } });
    },
    killed(c, b, e, a) {
      if (form === 2) return false;
      return rebirth.killed(c, b, e, a);
    },
    death(_c, b, e, a) { finishCast(b, e, a); a.burn?.cancel(); },
  };
}

function validate(p) {
  const pos = v => Number.isFinite(v) && v > 0, anim = x => x && pos(x.dur) && x.hit >= 0 && x.hit <= x.dur;
  if (!p || !p.attack || !pos(p.attack.radius) || !pos(p.attack.speed) || !Number.isInteger(p.attack.splashTiles) || !pos(p.attack.meleeScale)
    || !anim(p.attack.ranged) || !anim(p.attack.melee) || !p.cut || !pos(p.cut.cooldown) || !(p.cut.initial >= 0) || !pos(p.cut.radius)
    || !anim(p.cut.anim) || !pos(p.rebirth) || !(p.rebornHp > 0 && p.rebornHp <= 1) || !p.bomb || !(p.bomb.delay >= 0 && p.bomb.delay <= p.rebirth)
    || !pos(p.bomb.radius) || !pos(p.bomb.scale) || !pos(p.bomb.stun) || !p.priest || !Number.isFinite(p.priest.def)
    || !Number.isFinite(p.priest.res) || !Number.isFinite(p.priest.move) || !pos(p.priest.damage) || !pos(p.priest.interval))
    throw Error("Invalid 'The Big Ugly Thing'");
}
bigUglyThing.validate = validate;
