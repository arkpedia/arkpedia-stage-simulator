// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-robin-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { canTargetEnemy } from '../targeting.js';
import { bodyInKeys } from '../body.js';
const ID = 'char_451_robin', TOKEN = 'token_10013_robin_mine';
const exists = u => u?.alive && u.deployed;
const live = u => exists(u) && !u.hidden;
const selectable = (u, e, profile) => canTargetEnemy(u, e, profile)
  && (!e.s.flags.camou || !!e.blockedBy);
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const stateFor = (b, u) => {
  const state = b.regularSummons?.get(`summon:${ID}`);
  return state?.owner === u ? state : null;
};
function syncStock(b, u) {
  const state = stateFor(b, u), key = 'robin:stock-full';
  if (live(u) && state && state.stock >= state.record.stats.maxDeckStackCnt) {
    if (!u.findBuff(key)) b.addBuff(u, { key, flags: { noSp: true } });
  } else b.removeBuff(u, key);
}
function ordinary(b, u, p, e, info) {
  if (!selectable(u, e, p)) return;
  return b.addProjectile({ source: u, from: u, target: e, speed: 10, maxAge: 10,
    visual: 'arrow', data: { arkpediaTrackedVisual: true }, onHit: ({ target }) => {
      if (target && selectable(u, target, p)) resolveHit(b, u, p, target,
        { ...info, isProjectile: true }, target.x, target.y);
    } });
}
export function customizeRobinKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null;
  kit.trait = { attack: 'ranged', dmgType: 'phys', projectile: 'none', canHitFly: true,
    maxTargets: 1, maxTargetsByBlock: false, hitAllBlocked: false, hits: 1,
    hitsFn: null, dmgMul: null, splashRadius: 0, chain: null, rangeAoe: false,
    allInRange: false, install: null, retargetOnRelease: true, launchAttack: ordinary,
    attackVisual: 'Attack', windup: (_b, a) => model(a).hits.Attack[0]
      / Math.min(1, a.base.bat / a.s.interval) };
  const s = def.skill;
  kit.skill = { id: s.id, name: s.name, kind: 'instant', trigger: 'SP_FULL',
    canActivate: () => { const state = stateFor(b, u);
      return !!(state && live(u) && state.stock < state.record.stats.maxDeckStackCnt); },
    onStart: () => { const state = stateFor(b, u);
      if (!state) return;
      state.stock = Math.min(state.record.stats.maxDeckStackCnt, state.stock + s.bb.cnt);
      syncStock(b, u);
    } };
  u.mem.summonSkillSync = () => syncStock(b, u);
}
export function installRobin({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  // RechargeToken refreshes initial stock on each new deployment; installSummoner
  // owns that source action. This adapter only gates SP while total stock is full.
  b.on('tick', () => syncStock(b, u), { owner: u });
  b.on('death', ({ unit }) => { if (unit === u) b.removeBuff(u, 'robin:stock-full'); }, { owner: u });
}

/** Fixed-direction, ground-only, one-use native trap. The exact native ATK
 * transfer phase is unavailable; current owner ATK is sampled at placement,
 * explicitly matching the documented W mine interpretation rather than ATK100. */
export function createRobinClip(b, state, row, col) {
  const u = state.owner, s = state.record.skill, bb = s?.bb;
  if (state.record.id !== TOKEN || !bb || Object.keys(bb).some(k => bb[k] !== u.def.skill.bb[k]))
    throw Error('Robin trap does not match its selected owner skill');
  const variant = s.skillId.endsWith('_1') ? '01' : '02';
  const anim = evidence.tokenArtwork.models[TOKEN];
  const record = { ...state.record, stats: { ...state.record.stats,
    atk: u.s.atk * u.s.atkScaleMul } };
  const kit = { skill: null, trait: { noAttack: true, canAttack: () => false,
    dmgType: 'phys', attack: 'ranged', canHitFly: false },
    install: (battle, t) => {
      t.kind = 'device'; t.deploymentSlotCost = 0;
      battle.addBuff(t, { key: 'robin:device', persist: true, allowDead: true,
        flags: { healFree: true, invulnerable: true, untargetable: true, noSp: true } });
      let born = Infinity, triggered = false;
      const visual = (clip, loop) => ({ clip: `${clip}_${variant}`, loop, die: `Retreat_${variant}` });
      battle.on('deploy', ({ unit }) => {
        if (unit !== t) return;
        born = battle.time + anim.durations[`Start_${variant}`];
        t.mem.regularFormVisual = visual('Start', false);
      }, { owner: t });
      const watcher = battle.every(battle.dt, () => {
        if (!exists(t)) { watcher.cancel(); return; }
        if (!exists(u)) { battle.retreat(t, { permanent: true, reason: 'owner-removed' }); return; }
        if (triggered || battle.time + 1e-9 < born) return;
        t.mem.regularFormVisual = visual('Idle', true);
        const targets = battle.enemies.filter(e => live(e)
          && selectable(t, e, { canHitFly: false }) && bodyInKeys(e, t.rangeKeySet));
        // First eligible contact; equal-frame collisions use nearest centre then
        // spawn order. Native equal-frame selector ordering is not recovered.
        targets.sort((a, z) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(z.x - t.x, z.y - t.y));
        const target = targets[0]; if (!target) return;
        triggered = true; t.mem.regularFormVisual = visual('Skill', false);
        const seq = t.deploySeq, epoch = t.attackControlEpoch;
        battle.after(anim.hits[`Skill_${variant}`][0], () => {
          if (!exists(t) || !exists(u) || t.deploySeq !== seq) return;
          if (t.canAct && t.attackControlEpoch === epoch
            && selectable(t, target, { canHitFly: false })) {
            const info = { isSkill: true, isProjectile: false, attackId: ++battle._attackSeq };
            // Native active control and physical damage share an impact. Their
            // intra-frame order is bounded as control then damage in this adapter.
            if (variant === '01') battle.applyStatus(target, 'root', { source: t, duration: bb.constraint });
            else battle.push(target, bb.force, { from: t, effect: true });
            battle.dealDamage(t, target, { amount: record.stats.atk * bb.atk_scale,
              type: 'phys', applyWay: 'ranged', isAttack: true, ...info });
            t.stats.attacks++; battle.emit('attack', { attacker: t, targets: [target], ...info });
          }
          // Native WithdrawAfterAffecting/ON_BUFF_FINISH consumes the trap.
          // Here consumption is at impact; target control outlives the device.
          battle.retreat(t, { permanent: true, reason: 'robin-triggered' });
        }, { owner: t });
      });
    } };
  return b.spawnToken(u, TOKEN, row, col, { dir: 'RIGHT', def: record, kit });
}
