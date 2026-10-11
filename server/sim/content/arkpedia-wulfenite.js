// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-wulfenite-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { canTargetEnemy } from '../targeting.js';
import { bodyInKeys } from '../body.js';
const ID = 'char_4171_wulfen', TOKEN = 'token_10044_wulfen_mine';
const present = u => u?.alive && u.deployed;
const live = u => present(u) && !u.hidden;
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const stateFor = (b, u) => {
  const s = b.regularSummons?.get(`summon:${ID}`);
  return s?.owner === u ? s : null;
};
const ordinaryTarget = (u, e, p) => canTargetEnemy(u, e, p) && (!e.s.flags.camou || e.blockedBy);
function syncStock(b, u) {
  const s = stateFor(b, u), key = 'wulfenite:stock-full';
  if (live(u) && s && s.stock >= s.record.stats.maxDeckStackCnt) {
    if (!u.findBuff(key)) b.addBuff(u, { key, flags: { noSp: true } });
  } else b.removeBuff(u, key);
}
function ordinary(b, u, p, e, info) {
  if (!ordinaryTarget(u, e, p)) return;
  return b.addProjectile({ source: u, from: u, target: e, speed: 15, maxAge: 10,
    visual: 'arrow', data: { arkpediaTrackedVisual: true }, onHit: ({ target }) => {
      if (target && ordinaryTarget(u, target, p)) resolveHit(b, u, p, target,
        { ...info, isProjectile: true }, target.x, target.y);
    } });
}
export function customizeWulfeniteKit({ battle: b, id, def, unit: u, kit }) {
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
    onStart: () => {
      const state = stateFor(b, u); if (!state) return;
      state.stock = Math.min(state.record.stats.maxDeckStackCnt, state.stock + s.bb.cnt);
      syncStock(b, u);
    } };
  u.mem.summonSkillSync = () => syncStock(b, u);
}
export function installWulfenite({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  b.on('tick', () => syncStock(b, u), { owner: u });
  b.on('death', ({ unit }) => { if (unit === u) b.removeBuff(u, 'wulfenite:stock-full'); }, { owner: u });
}

const blastTargets = (b, t) => b.enemies.filter(e => live(e)
  && canTargetEnemy(t, e, { canHitFly: false }) && bodyInKeys(e, t.rangeKeySet));
function detonate(b, t, linked = false) {
  const u = t.ownerUnit;
  if (!live(t) || !live(u) || t.mem.wulfeniteDetonating) return;
  t.mem.wulfeniteDetonating = true;
  t.mem.regularFormVisual = { clip: 'Die', loop: false, die: null };
  b.addBuff(t, { key: 'wulfenite:detonating', flags: { noSp: true }, persist: true });
  const second = t.def.skill.id.endsWith('_2'), bb = t.def.skill.bb;
  if (second && !linked) {
    // Snapshot the armed siblings once. Mark each before dispatch so a chain
    // cannot recursively trigger itself or a sibling twice.
    const others = b.allyUnits.filter(a => a !== t && live(a) && a.ownerUnit === u
      && a.defId === TOKEN && !a.mem.wulfeniteDetonating && a.skill.ready);
    for (const a of others) {
      a.mem.wulfeniteLinked = true;
      a.skill.activate('linked-detonation');
      a.mem.wulfeniteLinked = false;
    }
  }
  const seq = t.deploySeq, epoch = t.attackControlEpoch;
  const delay = evidence.models[TOKEN].Front.hits.Die[0] / (t.base.bat / t.s.interval);
  b.after(delay, () => {
    if (!present(t) || !present(u) || t.deploySeq !== seq) return;
    if (t.canAct && t.attackControlEpoch === epoch) {
      const targets = blastTargets(b, t), info = { isSkill: true, isProjectile: false, attackId: ++b._attackSeq };
      // ATK inheritance is bounded as an owner snapshot at placement. Native
      // active buffs precede the first of S2's two zero-delta damage instances.
      for (const e of targets) {
        if (second) b.addBuff(e, { key: 'wulfenite:def', source: t,
          duration: bb.duration, mods: { defPct: bb.def } });
        else b.applyStatus(e, 'stun', { source: t, duration: bb.stun });
        for (let hit = 0; hit < (second ? 2 : 1); hit++) if (live(e))
          b.dealDamage(t, e, { amount: t.base.atk * bb.atk_scale,
            type: 'phys', applyWay: 'ranged', isAttack: true, ...info });
      }
      t.stats.attacks++; b.emit('attack', { attacker: t, targets, ...info });
    }
    b.retreat(t, { permanent: true, reason: 'wulfenite-detonated' });
  }, { owner: t });
}

export function createWulfeniteMine(b, state, row, col) {
  const u = state.owner, s = state.record.skill;
  if (state.record.id !== TOKEN || !s || Object.keys(s.bb).some(k => s.bb[k] !== u.def.skill.bb[k]))
    throw Error('Wulfenite trap does not match its selected owner skill');
  const record = { ...state.record, stats: { ...state.record.stats, atk: u.s.atk * u.s.atkScaleMul },
    rangeGrid: s.rangeGrid ?? state.record.rangeGrid };
  const kit = { trait: { noAttack: true, canAttack: () => false, canHitFly: false,
    attack: 'ranged', dmgType: 'phys' },
    skill: { id: s.skillId, name: s.name, kind: 'instant', trigger: 'NEVER',
      canActivate: () => !!(live(u) && live(token) && !token.mem.wulfeniteDetonating
        && (token.mem.wulfeniteLinked || blastTargets(b, token).length)),
      onStart: () => detonate(b, token, !!token.mem.wulfeniteLinked) },
    install: (battle, t) => {
      t.kind = 'device'; t.deploymentSlotCost = 0; t.mem.regularHideHp = true;
      battle.addBuff(t, { key: 'wulfenite:device', persist: true, allowDead: true,
        flags: { healFree: true, invulnerable: true, untargetable: true } });
      battle.on('deploy', ({ unit }) => {
        if (unit !== t) return;
        t.mem.regularFormVisual = { clip: 'Start', loop: false, die: null };
        battle.after(evidence.models[TOKEN].Front.durations.Start, () => {
          if (present(t) && !t.mem.wulfeniteDetonating)
            t.mem.regularFormVisual = { clip: 'Idle', loop: true, die: null };
        }, { owner: t });
      }, { owner: t });
    } };
  const token = b.spawnToken(u, TOKEN, row, col, { dir: 'RIGHT', def: record, kit });
  return token;
}
