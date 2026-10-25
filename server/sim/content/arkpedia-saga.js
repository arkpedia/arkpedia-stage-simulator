// SPDX-License-Identifier: GPL-3.0-or-later
// Original graphs, animation aliases and bounded dispatch choices are retained
// in data/arkpedia-saga-prefabs.json; this is not a native frame-parity claim.
import evidence from '../../../data/arkpedia-saga-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { isHpLoss } from '../damage.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import {executeEnemyInstantKill,verifyEnemyInstantKill} from '../enemy-instant-kill.js';
import {captureEnemySource as captureKillSource} from './enemy-source-view.js';

export function verifySagaInstantKillSource(source=evidence){
  try{
    const wound=source.templates.saga_t_1.eventToActions.ON_AFTER_OUTPUT_DAMAGE[3]._buff,original=[];
    const collect=value=>{if(!value||typeof value!=='object')return;if(value.buffKey==='cripple')original.push(value);for(const child of Object.values(value))collect(child);};
    for(const item of source.originalTemplates.saga_t_1.eventToActions._items)collect(JSON.parse(item.value.SerializedState));
    if(original.length!==1||wound.attributes.abnormalFlags.join()!=='HEAL_FREE,DISABLE_COMBAT'||JSON.stringify(wound.attributes)!==JSON.stringify(original[0].attributes))throw Error('Mismatch');
  }catch{throw Error('Changed original Saga InstantKill/wound inputs');}
  const specs=[['saga_s_2','ON_BUFF_FINISH',1,3,false],['cripple','ON_BUFF_TRIGGER',2,2,true],['cripple','ON_BEFORE_APPEAR',43,0,true]];
  return specs.map(([key,event,code,index,noSource])=>{
    try{
      const action=verifyEnemyInstantKill(source.templates[key].eventToActions[event][index]),
        raw=verifyEnemyInstantKill(JSON.parse(source.originalTemplates[key].eventToActions._items.find(e=>e.key===code).value.SerializedState)[index]);
      if(action._skipReborn||action._killSource||action._targetType!=='TARGET'||action._noSource!==noSource
        ||Object.keys(action).some(k=>k==='$type'?action[k].split(',')[0]!==raw[k].split(',')[0]:action[k]!==raw[k]))throw Error('Mismatch');
      return action;
    }catch{throw Error('Changed original Saga InstantKill inputs');}
  });
}
const [secondKill,woundKill,appearKill]=verifySagaInstantKillSource();

const ID = 'char_362_saga', SECOND = 'skchr_saga_2', THIRD = 'skchr_saga_3';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const third = u => u.skill?.active && u.skill.id === THIRD;
const rate = u => third(u) ? Math.min(1, u.s.aspd / 100) : u.s.aspd / 100;
const plain = { attack: 'melee', projectile: 'none', dmgType: 'phys',
  canHitFly: false, groundOnly: true, hits: 1, hitsFn: null, maxTargets: 1,
  splashRadius: 0, chain: null, dmgMul: null, applyWay: 'melee' };

function clearCast(b, u, state = u.mem.sagaCast) {
  if (!state || u.mem.sagaCast !== state) return;
  state.watch?.cancel(); u.mem.sagaCast = null;
  b.removeBuff(u, 'saga:cast'); u.mem.regularFormVisual = null;
}
function valid(u, state) {
  return live(u) && u.mem.sagaCast === state && u.deploySeq === state.seq
    && u.canAct && u.attackControlEpoch === state.epoch;
}
function castSecond(b, u) {
  const bb = u.def.skill.bb, m = model(u), playback = u.s.aspd / 100;
  const state = { seq: u.deploySeq, activation: u.skill.activations };
  u.mem.sagaCast = state; u.mem.sagaNormalBegun = false;
  b.addBuff(u, { key: 'saga:cast', flags: { disarm: true, noSp: true } });
  state.epoch = u.attackControlEpoch;
  // The native Skill_2 alias binds the actual Skill clip on both facings.
  u.mem.regularFormVisual = { clip: 'Skill', loop: false, speed: playback };
  u.skill.timeLeft = m.durations.Skill / playback;
  // Native controller event2 is bridged to committed activation, including an
  // empty cast; interruption later does not undo the already-granted DP.
  b.addDp(u.ownerId, bb.cost);
  state.watch = b.every(b.dt, () => {
    if (!valid(u, state)) {
      if (u.skill.active && u.skill.activations === state.activation) u.skill.end('interrupt');
      clearCast(b, u, state);
    }
  }, { owner: u });
  const info = { isSkill: true, attackId: ++b._attackSeq };
  b.after(m.hits.Skill[0] / playback, () => {
    if (!valid(u, state) || !u.skill.active) return;
    const keys = absoluteRangeKeys(u.def.skill.rangeGrid, u.tileR, u.tileC, u.dir);
    const victims = b.enemiesInKeys(keys, u, plain);
    sortEnemyTargets(b, u, victims, null);
    const sourceLife=u.deploySeq,sourceView=captureKillSource(u);
    for (const e of victims.slice(0, 6)) {
      const targetLife=e.deploySeq;
      resolveHit(b, u, { ...plain, atkScale: bb.atk_scale }, e, info, e.x, e.y);
      if (!e.alive||e.deploySeq!==targetLife) continue;
      // The target-owned native active buff finishes .7s after the hit. It
      // survives source retirement and only eliminates a still-wounded target.
      b.after(.7, () => {
        if (e.alive && e.deploySeq===targetLife && e.findBuff('cripple')) {
          executeEnemyInstantKill(b,{source:u.alive&&u.deployed&&u.deploySeq===sourceLife?u:sourceView,target:e,action:secondKill});
          if(e.deploySeq===targetLife)b.removeBuff(e, 'cripple');
        }
      }, { owner: e });
    }
  }, { owner: u });
}

function wound(b, u, e, bb) {
  if (!e.alive || e.findBuff('cripple')) return;
  const targetLife=e.deploySeq;
  let killHook, appearHook, timer;
  const mark = b.addBuff(e, { key: 'cripple', status: 'cripple', source: u,
    flags: { noCombat: true, healFree: true, noHpRecovery: true },
    mods: { moveMul: 1 + bb.move_speed, blockCntMul: 0, hpRegenMul: 0 },
    onRemove: () => { b.off(killHook); b.off(appearHook); timer?.cancel(); } });
  if(!mark||!e.alive||!e.deployed||e.deploySeq!==targetLife||e.findBuff('cripple')!==mark){b.removeBuff(e,mark);return;}
  b._unblock(e);
  killHook = b.on('kill', ({ killer, victim }) => {
    if (victim !== e || e.deploySeq!==targetLife || e.findBuff('cripple') !== mark) return;
    if (live(killer)) killer.skill?.gainSp(bb.sp, 'gift');
    b.removeBuff(e, mark);
  }, { owner: e });
  appearHook = b.on('enemyBeforeAppear', ({ enemy }) => {
    if (enemy === e && e.findBuff('cripple') === mark){
      if(e.deploySeq===targetLife)executeEnemyInstantKill(b,{source:u,target:e,action:appearKill});
      else b.removeBuff(e,mark);
    }
  }, { owner: e });
  timer = b.after(bb.interval, () => {
    if (!e.alive || e.findBuff('cripple') !== mark) return;
    if(e.deploySeq!==targetLife){b.removeBuff(e,mark);return;}
    // Original cripple trigger skips InstantKill in DISAPPEAR, then finishes
    // the buff. ON_BEFORE_APPEAR kills only while the buff is still present.
    if (!e.hidden) executeEnemyInstantKill(b,{source:u,target:e,action:woundKill});
    b.removeBuff(e, mark);
  }, { owner: e });
}

function windup(b, u) {
  const m = model(u), playback = rate(u);
  if (third(u)) {
    u.mem.sagaAttackVisual = 'Skill_2_Loop';
    return m.hits.Skill_2_Loop[0] / playback;
  }
  const first = !u.mem.sagaNormalBegun;
  u.mem.sagaNormalBegun = true;
  u.mem.sagaAttackVisual = first ? { begin: 'Attack_Begin', loop: 'Attack_Loop',
    beginDuration: m.durations.Attack_Begin / playback } : 'Attack_Loop';
  return (m.hits.Attack_Loop[0] + (first ? m.durations.Attack_Begin : 0)) / playback;
}
function launch(b, u, p, e, info) {
  if (!canTargetEnemy(u, e, p)) return;
  // saga_s_3[hit] tests the target's HP before its NORMAL extra output. Keep
  // that output independently mitigated and do not turn it into an ADDITION.
  if (third(u) && e.hp / e.s.maxHp < u.def.skill.bb['attack@hp_ratio'])
    resolveHit(b, u, p, e, info, e.x, e.y);
  resolveHit(b, u, p, e, info, e.x, e.y);
}

export function customizeSagaKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  kit.trait = { ...plain, install: null, hitAllBlocked: false, allInRange: false,
    maxTargetsByBlock: false, retargetOnRelease: false, interruptOnSkillChange: true,
    attackDrivenSkill: true, canTarget: (_a, e) => !e.findBuff('cripple'),
    canAttack: () => !u.mem.sagaCast && b.time >= (u.mem.sagaBeginUntil ?? -Infinity),
    windup, attackVisual: () => u.mem.sagaAttackVisual, launchAttack: launch };
  const s = def.skill, bb = s.bb;
  if (s.id === SECOND) kit.skill = { kind: 'toggle', charges: s.maxCharges,
    canActivate: () => !u.mem.sagaCast, attack: { noAttack: true },
    onStart: () => castSecond(b, u),
    onTick: ({ dt, skill }) => {
      skill.timeLeft -= dt;
      if (skill.timeLeft <= 1e-9) skill.end('cast');
    }, onEnd: () => clearCast(b, u) };
  else if (s.id === THIRD) kit.skill = { kind: 'duration',
    mods: { atkPct: bb.atk, batFlat: bb.base_attack_time, rangeExtend: bb.ability_range_forward_extend },
    attack: { maxTargetsByBlock: true, retargetOnRelease: true },
    onStart: () => {
      u.mem.sagaNormalBegun = false;
      const playback = rate(u), visual = { clip: 'Skill_2_Begin', loop: false, speed: playback };
      u.mem.regularFormVisual = visual;
      u.mem.sagaBeginUntil = b.time + model(u).durations.Skill_2_Begin / playback;
      const activation = u.skill.activations;
      b.after(u.mem.sagaBeginUntil - b.time, () => {
        if (live(u) && third(u) && u.skill.activations === activation)
          u.mem.regularFormVisual = { clip: 'Skill_2_Idle', attack: 'Skill_2_Loop', loop: true };
      }, { owner: u });
      // First native periodic_cost pulse waits one selected interval.
      b.addBuff(u, { key: 'saga:dp', interval: bb.interval,
        onTick: () => { if (live(u) && third(u)) b.addDp(u.ownerId, bb.cost); } });
    }, onEnd: () => {
      b.removeBuff(u, 'saga:dp'); u.mem.sagaNormalBegun = false;
      u.mem.regularFormVisual = null;
    } };
  else kit.skill = { kind: 'instant', onStart: () => b.addDp(u.ownerId, bb.cost) };
  kit.skill.id = s.id; kit.skill.name = s.name;
}

export function installSaga({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  const preach = def.talents.find(t => t.bb.sp != null)?.bb;
  const mind = def.talents.find(t => t.bb.hp_ratio != null)?.bb;
  b.on('hit', ctx => {
    if (ctx.source === u && live(u) && ctx.target.side === 'enemy'
      && ctx.dmg.type !== 'element' && !isHpLoss(ctx.dmg))
      ctx.dmg.hpFloor = Math.max(ctx.dmg.hpFloor ?? 0, 1);
  }, { owner: u });
  b.on('damaged', ({ source, target, dmg }) => {
    if (source === u && live(u) && preach && target.side === 'enemy'
      && target.alive && target.hp <= 1 && dmg?.type !== 'element'
      && !isHpLoss(dmg)) wound(b, u, target, preach);
    if (target === u) clearMind();
  }, { owner: u });
  function clearMind() {
    if (!mind || !live(u) || u.mem.sagaMindUsed || u.hp / u.s.maxHp > mind.hp_ratio) return;
    u.mem.sagaMindUsed = true;
    b.addBuff(u, { key: 'saga:mind', duration: mind.duration,
      mods: { dodgePhys: mind.prob, hpRegenRatio: mind.hp_recovery_per_sec_by_max_hp_ratio } });
  }
  b.on('tick', () => {
    clearMind();
    if (!third(u) && !u.trait.hadTarget && !u.mem.sagaCast) u.mem.sagaNormalBegun = false;
  }, { owner: u });
  b.on('death', ({ unit }) => {
    if (unit !== u) return;
    clearCast(b, u); b.removeBuff(u, 'saga:dp'); u.mem.regularFormVisual = null;
    // Target-owned cripple timers and gifts survive their source's departure.
  }, { owner: u });
}
