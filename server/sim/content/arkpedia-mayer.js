// SPDX-License-Identifier: GPL-3.0-or-later
// Original graphs and the unrecovered native contracts are retained in evidence.
import evidence from '../../../data/arkpedia-mayer-prefabs.json' with { type: 'json' };
import { bodyInKeys } from '../body.js';
import { absoluteRangeKeys, canTargetEnemy } from '../targeting.js';
import { resolveHit } from '../ai.js';
const ID = 'char_242_otter', TOKEN = 'token_10004_otter_motter';
const present = u => u?.alive && u.deployed;
const live = u => present(u) && !u.hidden;
const owned = (b, u) => b.allyUnits.filter(t => present(t) && t.ownerUnit === u && t.defId === TOKEN);
const rate = u => Math.min(1, u.base.bat / u.s.interval);
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const tokenModel = evidence.models[TOKEN].Original;
const stateFor = (b, u) => {
  const s = b.regularSummons?.get(`summon:${ID}`);
  return s?.owner === u ? s : null;
};
const range = (t, grid) => new Set(absoluteRangeKeys(grid, t.tileR, t.tileC, 'RIGHT'));
const legalEnemy = (u, e, p) => canTargetEnemy(u, e, p) && (!e.s.flags.camou || e.blockedBy || p.area);
function ordinary(b, u, p, e, info) {
  if (!legalEnemy(u, e, p)) return;
  return b.addProjectile({ source: u, from: u, target: e, speed: 10, maxAge: 10,
    visual: 'bolt', data: { arkpediaTrackedVisual: true }, onHit: ({ target }) => {
      if (target && legalEnemy(u, target, p)) resolveHit(b, u, p, target,
        { ...info, isProjectile: true }, target.x, target.y);
    } });
}
function syncAuras(b, u) {
  const tokens = live(u) ? owned(b, u).filter(live) : [];
  const first = u.def.skill.id === 'skchr_otter_1', key = `mayer:dodge:${u.id}`;
  // The native evade buff is one shared key, overrideType0/maxStackCnt1 and
  // independentCharacterSource0. Overlapping Robotters must not multiply rolls.
  for (const a of b.allyUnits) {
    const winner = first && live(a) && a.kind !== 'device' && !a.s.flags.untargetable
      && tokens.find(t => b.allySelectable(a, t) && bodyInKeys(a, range(t, t.def.skill.rangeGrid)));
    const old = a.findBuff(key);
    if (!winner) b.removeBuff(a, key);
    else if (!old || old.source !== winner) b.addBuff(a, { key, source: winner,
      mods: { dodgePhys: winner.def.skill.bb.prob, dodgeArts: winner.def.skill.bb.prob } });
  }
  for (const e of b.enemies) {
    const t = tokens.find(t => t.blocking.includes(e) && e.blockedBy === t);
    const k = `mayer:block:${u.id}`, old = e.findBuff(k);
    if (!t || !live(e)) b.removeBuff(e, k);
    else if (!old || old.source !== t) b.addBuff(e, { key: k, source: t,
      mods: { aspd: t.def.talents[0].bb.attack_speed } });
  }
}
function clearCommand(b, u, cast) {
  if (u.mem.mayerCommand !== cast) return;
  u.mem.mayerCommand = null; u.mem.regularFormVisual = null;
  b.removeBuff(u, 'mayer:command');
}
function command(b, u) {
  u.attackControlEpoch++; u.atkCd = u.s.interval;
  const cast = { seq: u.deploySeq, epoch: u.attackControlEpoch, tokens: owned(b, u) };
  u.mem.mayerCommand = cast;
  // Back has no Skill clip. Use an explicit Front command clock while keeping
  // the original Back artwork idle; do not manufacture a Back hit event.
  const m = evidence.models[ID].Front, speed = rate(u);
  u.mem.regularFormVisual = { clip: model(u).durations.Skill ? 'Skill' : 'Idle', loop: false, speed };
  b.addBuff(u, { key: 'mayer:command', flags: { noSp: true } });
  b.after(m.hits.Skill[0] / speed, () => {
    if (u.mem.mayerCommand !== cast) return;
    if (!live(u) || u.deploySeq !== cast.seq || u.attackControlEpoch !== cast.epoch || !u.canAct) {
      clearCommand(b, u, cast); return;
    }
    for (const t of cast.tokens) if (live(t)) detonate(b, u, t);
  }, { owner: u });
  b.after(m.durations.Skill / speed, () => clearCommand(b, u, cast), { owner: u });
}
function detonate(b, u, t) {
  if (t.mem.mayerBlast) return;
  t.attackControlEpoch++; t.atkCd = t.s.interval;
  const speed = t.base.bat / t.s.interval;
  const p = { canHitFly: true, area: true };
  const keys = range(t, t.def.skill.rangeGrid);
  const cast = { seq: t.deploySeq, epoch: t.attackControlEpoch,
    targets: b.enemies.filter(e => legalEnemy(t, e, p) && bodyInKeys(e, keys)) };
  t.mem.mayerBlast = cast;
  t.mem.regularFormVisual = { clip: 'Blast', loop: false, speed };
  const valid = () => live(t) && present(u) && t.mem.mayerBlast === cast
    && t.deploySeq === cast.seq && t.attackControlEpoch === cast.epoch;
  const cancel = () => { if (t.mem.mayerBlast === cast) { t.mem.mayerBlast = null; t.mem.regularFormVisual = null; } };
  b.after(tokenModel.hits.Blast[0] / speed, () => {
    if (!valid()) { cancel(); return; }
    const bb = t.def.skill.bb, targets = cast.targets.filter(e => legalEnemy(t, e, p));
    const info = { isSkill: true, isProjectile: false, attackId: ++b._attackSeq };
    // The official skill names Mayer's ATK. Its unrecovered native transfer and
    // sampling phase are bounded here to live owner ATK at the Blast hit.
    const amount = u.s.atk * u.s.atkScaleMul * bb.atk_scale;
    for (const e of targets) {
      b.applyStatus(e, 'stun', { source: t, duration: bb.stun });
      b.dealDamage(t, e, { amount, type: 'arts', applyWay: 'ranged', isAttack: true, ...info });
    }
    t.stats.attacks++; b.emit('attack', { attacker: t, targets, ...info });
  }, { owner: t });
  b.after(tokenModel.durations.Blast / speed, () => {
    if (!valid()) { cancel(); return; }
    const state = stateFor(b, u);
    if (state) {
      // One return per successful original Robotter. The native missing cnt
      // default is not recovered; preserve the serialized recharge-before-
      // withdraw order atomically and conserve the source born supply budget.
      state.stock = Math.min(state.stock + 1, Math.max(0, state.stockBudget - owned(b, u).length + 1));
    }
    cancel(); b.retreat(t, { permanent: true, reason: 'mayer-recycle' });
    syncAuras(b, u);
  }, { owner: t });
}
export function customizeMayerKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null;
  kit.trait = { attack: 'ranged', dmgType: 'arts', projectile: 'none', canHitFly: true,
    maxTargets: 1, hits: 1, hitAllBlocked: false, maxTargetsByBlock: false, install: null,
    canAttack: () => !u.mem.mayerCommand, attackVisual: 'Attack', launchAttack: ordinary,
    windup: () => model(u).hits.Attack[0] / rate(u) };
  const s = def.skill;
  kit.skill = { id: s.id, name: s.name, kind: s.id.endsWith('_1') ? 'passive' : 'instant',
    canActivate: () => !u.mem.mayerCommand,
    onStart: () => {
      if (s.id.endsWith('_2')) command(b, u);
      else { u.skillAnimUntil = -Infinity; u.mem.regularFormVisual = { clip: 'Idle', loop: true }; }
    } };
}
export function installMayer({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  const sync = () => syncAuras(b, u);
  b.every(b.dt, sync, { owner: u });
  b.on('deploy', sync, { owner: u });
  b.on('death', ({ unit }) => {
    if (unit === u) clearCommand(b, u, u.mem.mayerCommand);
    if (unit === u || unit.ownerUnit === u) sync();
  }, { owner: u });
}
export function createMayerRobotter(b, state, row, col) {
  const r = state.record, s = r.skill, host = state.owner.def.skill;
  if (r.id !== TOKEN || !s?.rangeGrid?.length || Object.keys(s.bb).some(k => s.bb[k] !== host.bb[k]))
    throw Error('Mayer Robotter does not match its selected owner skill');
  return b.spawnToken(state.owner, TOKEN, row, col, { dir: 'RIGHT', def: r,
    kit: { skill: null, trait: { attack: 'melee', dmgType: 'phys', projectile: 'none',
      canHitFly: false, maxTargets: 1, hits: 1, hitAllBlocked: false, install: null,
      canAttack: (_b, t) => !t.mem.mayerBlast, attackVisual: 'Attack',
      windup: (_b, t) => tokenModel.hits.Attack[0] / rate(t) },
      install: (battle, t) => {
        battle.addBuff(t, { key: 'mayer:heal-free', persist: true, allowDead: true, flags: { healFree: true } });
      } } });
}
