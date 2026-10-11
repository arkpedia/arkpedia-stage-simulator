// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-blaze-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { applyHpLoss, makeDamageInfo } from '../damage.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';

const ID = 'char_017_huang';
const live = u => u?.alive && u.deployed && !u.hidden;
const present = u => u?.alive && u.deployed;
const third = u => u.skill.active && u.skill.id === 'skchr_huang_3';
const second = u => u.skill.active && u.skill.id === 'skchr_huang_2';
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const down = (u, clip) => u.dir === 'DOWN' && model(u).durations[clip + '_Down'] != null ? clip + '_Down' : clip;
const grid = id => evidence.tables.ranges[id].grids.map(p => [p.row, p.col]);
function choose(b, u, p) {
  const targets = b.enemiesInKeys(u.rangeKeys, u, p);
  for (const e of u.blocking) if (!targets.includes(e) && canTargetEnemy(u, e, p)) targets.push(e);
  sortEnemyTargets(b, u, targets);
  const input = u.mem.blazeInput?.[0];
  if (targets.includes(input)) { targets.splice(targets.indexOf(input), 1); targets.unshift(input); }
  return targets.slice(0, Math.max(0, Math.floor(u.s.blockCnt)));
}
function visual(b, u, clip, idle, speed = 1) {
  const token = {}, seq = u.deploySeq;
  u.mem.blazeVisual = token; u.mem.regularFormVisual = { clip, loop: false, speed };
  b.after(model(u).durations[clip] / speed, () => {
    if (live(u) && u.deploySeq === seq && u.mem.blazeVisual === token)
      u.mem.regularFormVisual = idle ? { clip: idle, loop: true } : null;
  }, { owner: u });
}
function ramp(b, u, fraction) {
  b.addBuff(u, { key: 'blaze:ramp', source: u,
    mods: { atkPct: u.skill.bb.atk * fraction, defPct: u.skill.bb.def * fraction } });
}
function slice(b, u) {
  // ContinuousAttack has a real-time clock and an unlimited ground selector;
  // it does not inherit the ordinary block-count target cap or attack ASPD.
  const p = { dmgType: 'phys', attack: 'melee', applyWay: 'melee', projectile: 'none',
    canHitFly: false, hits: 1, atkScale: 1, splashRadius: 0 };
  const targets = b.enemiesInKeys(u.baseRangeKeys, u, p);
  for (const e of targets) resolveHit(b, u, p, e, { isSkill: true, attackId: `blaze:${u.id}:${u.skill.activations}:${b.time}` }, e.x, e.y);
}
function burst(b, u) {
  // ON_SKILL_FINISH: direct PURE self damage first, then Physical AOEDamage.
  // isUndeadable protects only this self receipt, including fractional HP.
  const selfLoss = Math.min(u.s.maxHp * u.skill.bb.hp_ratio, Math.max(0, u.hp - Math.min(1, u.s.maxHp)));
  applyHpLoss(b, u, u, selfLoss, makeDamageInfo({ amount: selfLoss, type: 'true', isAttack: true,
    isSkill: true, tags: ['blaze:cost'] }));
  if (!present(u)) return;
  const p = { dmgType: 'phys', attack: 'melee', applyWay: 'melee', projectile: 'none',
    canHitFly: true, hits: 1, atkScale: u.skill.bb.damage_by_atk_scale, splashRadius: 0 };
  const targets = b.enemiesInKeys(absoluteRangeKeys(grid('3-6'), u.tileR, u.tileC, u.dir), u, p);
  for (const e of targets) resolveHit(b, u, p, e,
    { isSkill: true, attackId: `blaze:${u.id}:${u.skill.activations}:burst` }, e.x, e.y);
}
function startThird(b, u) {
  const token = {}, seq = u.deploySeq, epoch = u.attackControlEpoch;
  u.mem.blazeThird = token; ramp(b, u, 0);
  const begin = u.dir === 'DOWN' ? 'Skill_2_Down_Begin' : 'Skill_2_Begin';
  const loop = u.dir === 'DOWN' ? 'Skill_2_Loop_Down' : 'Skill_2_Loop';
  visual(b, u, begin, loop, 1.75);
  const valid = () => live(u) && third(u) && u.deploySeq === seq && u.mem.blazeThird === token;
  const run = fn => {
    if (!valid()) return;
    if (u.attackControlEpoch !== epoch || !u.canAct || u.s.flags.disarm) { u.skill.end('interrupted'); return; }
    fn();
  };
  // PRTS's measured mechanics resolve eight one-second slices and the ninth-
  // second burst. Native preDelay/postDelay/animation event overlap remains
  // retained in evidence; this schedule is not claimed as native frame parity.
  const endTime = evidence.templates.huang_s_3.eventToActions.ON_BUFF_TRIGGER[0]._endTime;
  for (let n = 1; n <= 8; n++) b.after(n, () => run(() => {
    ramp(b, u, Math.min(1, n / (u.skill.duration - endTime))); slice(b, u);
  }), { owner: u });
  b.after(7, () => run(() => {
    const clip = u.dir === 'UP' ? 'Skill_2_End' : u.dir === 'DOWN' ? 'Skill_2_Loop_Down_End' : 'Skill_2_Loop_End';
    visual(b, u, clip, null);
  }), { owner: u });
  b.after(9, () => run(() => { ramp(b, u, 1); burst(b, u); }), { owner: u });
  // A short accepted control must invalidate the remaining sequence even if
  // it expired before the next damage pulse.
  u.mem.blazeMonitor = b.every(b.dt, () => run(() => {}), { owner: u });
}
function clearThird(b, u) {
  u.mem.blazeThird = null; u.mem.blazeMonitor?.cancel(); u.mem.blazeMonitor = null;
  u.mem.blazeVisual = null; u.mem.regularFormVisual = null;
  b.removeBuff(u, 'blaze:ramp'); u.atkCd = 0;
}
export function customizeBlazeKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null;
  kit.trait = { attack: 'melee', applyWay: 'melee', dmgType: 'phys', projectile: 'none',
    hits: 1, hitsFn: null, chain: null, splashRadius: 0, maxTargets: 1, maxTargetsByBlock: false,
    hitAllBlocked: false, allInRange: false, rangeAoe: false, canHitFly: false, dmgMul: null, install: null,
    acquireTargets: choose, retargetOnRelease: true, interruptOnSkillChange: true,
    windup: (_b, a, targets) => {
      a.mem.blazeInput = targets;
      a.mem.blazeClip = down(a, second(a) ? 'Skill_1' : 'Attack');
      const cap = a.skill.pending ? 1 : 2;
      return model(a).hits[a.mem.blazeClip][0] / Math.min(cap, a.base.bat / a.s.interval);
    }, attackVisual: (_b, a) => a.mem.blazeClip,
    launchAttack: (_b, a, p, e, info) => { if (canTargetEnemy(a, e, p)) {
      resolveHit(b, a, p, e, info, e.x, e.y); a.mem.blazeEmitted = info.attackId;
    } },
    afterAttack: (_b, a) => { a.mem.blazeInput = null; } };
  const s = def.skill, bb = s.bb;
  if (s.id.endsWith('_1')) kit.skill = { kind: 'instant', attack: { atkScale: bb.atk_scale,
    afterAttack: (_b, a, targets, context) => {
      a.mem.blazeInput = null;
      if (a.mem.blazeEmitted !== context.attackId && !targets.some(e => e.alive)
        && context.inputTargets.length && context.inputTargets.every(e => !e.alive)) a.skill.addCharge(1);
    } } };
  else if (s.id.endsWith('_2')) kit.skill = { kind: 'toggle', trigger: 'SP_FULL', manualCancel: false,
    mods: { atkPct: bb.atk, defPct: bb.def }, targeting: { rangeGrid: s.rangeGrid },
    onStart: () => {
      visual(b, u, 'Skill_1_Begin', 'Skill_1_Idle');
      b.addBuff(u, { key: 'blaze:begin', source: u, duration: model(u).durations.Skill_1_Begin, flags: { disarm: true } });
    }, onEnd: () => { u.mem.blazeVisual = null; u.mem.regularFormVisual = null; b.removeBuff(u, 'blaze:begin'); } };
  else kit.skill = { kind: 'duration', trigger: 'NEVER', duration: s.duration,
    attack: { noAttack: true, animation: 'none' },
    targeting: { rangeGrid: grid('3-6'), showOwnRange: false },
    onStart: () => startThird(b, u), onEnd: () => clearThird(b, u) };
  kit.skill.id = s.id; kit.skill.name = s.name;
}
export function installBlaze({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  const heal = def.talents.find(t => t.bb.hp_ratio != null)?.bb;
  const resist = def.talents.find(t => t.bb.interval != null)?.bb;
  function recover() {
    if (!heal || u.mem.blazeUsed || !present(u) || u.hpRatio > heal.hp_ratio) return;
    u.mem.blazeUsed = true;
    b.heal(u, u, u.s.maxHp * heal['huang_t_1[heal].hp_ratio'], { self: true });
    b.removeBuff(u, 'blaze:undead');
    b.addBuff(u, { key: 'blaze:floor', source: u, duration: heal['huang_t_1[lock].duration'],
      mods: { damageHpFloorRatio: heal['huang_t_1[lock].min_hp_ratio'] } });
  }
  b.on('deploy', ({ unit }) => { if (unit === u) {
    u.mem.blazeUsed = false;
    if (heal) b.addBuff(u, { key: 'blaze:undead', source: u, flags: { undeadable: true } });
    if (resist) {
      const seq = u.deploySeq;
      b.after(resist.interval, () => {
        if (present(u) && u.deploySeq === seq) b.addBuff(u, { key: 'blaze:resist', source: u,
          status: 'resist', data: { value: -resist.one_minus_status_resistance } });
      }, { owner: u });
    }
  } }, { owner: u });
  b.on('damaged', ({ target }) => { if (target === u) recover(); }, { owner: u });
  b.on('tick', recover, { owner: u });
  for (const event of ['death', 'retreat']) b.on(event, ({ unit }) => { if (unit === u) {
    clearThird(b, u); for (const key of ['blaze:undead', 'blaze:floor', 'blaze:resist', 'blaze:begin']) b.removeBuff(u, key);
  } }, { owner: u });
}
