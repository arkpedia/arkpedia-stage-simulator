// SPDX-License-Identifier: GPL-3.0-or-later
// Private S3 adapter. Public installation and visual review are still held.
import evidence from '../../../data/arkpedia-swire-alter-prefabs.json' with { type: 'json' };
import { SWIRE_ALTER_ID, selectedSwireEconomy } from './arkpedia-swire-alter-economy.js';
import { SwirePassiveController } from './arkpedia-swire-alter-passives.js';
import { absoluteRangeKeys, canTargetEnemy } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { resolveHit } from '../ai.js';

export const SWIRE_S3_CONTRACT = Object.freeze({
  doubleAttack: 'one PRECAST input and attack identity, two original scaled animation markers',
  ending: 'capture coins and frontal/blockee marks once; unscaled End clip and independent CAST selections',
  projectile: 'speed 8 homing, current owner ATK at impact, radial push; born shots survive owner removal',
  marks: 'shared native key without source filtering; remove only this ending claim',
  interruptions: 'control epochs cancel unborn receipts; silence alone does not interrupt nonsilenceable outputs',
  limits: 'local FSM, marking/callback ordering and root geometry; native particles and compiled frame parity unverified',
  frameParity: false,
});
const MARK = 'swire2_s_3[mark_to_enemy]', HOLD = 'swire2:s3-ending-no-sp';
const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const same = (a, z) => JSON.stringify(a) === JSON.stringify(z);
const grid = id => evidence.tables.ranges[id].grids.map(g => [g.row, g.col]);
const component = (group, id) => Object.values(evidence[group]).flatMap(rs => rs.flatMap(r => r.components))
  .find(c => c.pathId === id)?.data;
const double = component('characters', '-1637502540339863512');
const ending = component('characters', '-5646276737994121176');
const gold = component('characters', '-6662058350676271064');
const selector = component('characters', '-3665835510809550808');
const projectile = component('projectiles', '3589369933457247521');
const mover = component('projectiles', '-1910994869075981023');
const model = u => evidence.models[SWIRE_ALTER_ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const events = (u, clip) => model(u).eventPayloads[clip].filter(e => e.name === 'OnAttack').map(e => e.time);

function selectedS3(u, contract) {
  if (contract !== SWIRE_S3_CONTRACT) throw Error('Swire S3 requires the reviewed local contract');
  if (u.def.charId !== SWIRE_ALTER_ID || u.mem.swireCoinEconomy)
    throw Error('Swire S3 requires a fresh original owner');
  const build = u.def.raw.arkpedia, r = selectedSwireEconomy(build), s = u.def.skill;
  const source = evidence.tables.skills[r.skillId].levels[build.skillRank - 1];
  if (r.index !== 2 || s?.id !== build.skillId || s.skillType !== 'AUTO' || s.spType !== 'time'
    || s.spCost !== source.spData.spCost || s.initSp !== source.spData.initSp
    || s.maxCharges !== source.spData.maxChargeTime || s.duration !== source.duration
    || !same(s.bb, r.bb) || !same(s.rangeGrid, grid(source.rangeId))
    || !same(u.rangeGrid, grid(evidence.tables.character.phases[build.elite].rangeId)))
    throw Error('Incomplete Swire S3 selected skill or range');
  if (double._additionalTimes !== 1 || double._waitAttackEventForAllAttacks !== 1
    || double._refreshInputTargetOnCheckSpell !== 0 || double._maxAnimScale !== -1
    || double._atkScale !== 1 || double._timeMode !== 0 || double._selectTargetTiming !== 0
    || ending._allowNoTarget !== 1 || ending._timeMode !== 1
    || gold._timeMode !== 1 || gold._selectTargetTiming !== 1 || gold._refreshTimesOnCastStart !== 1
    || gold._limitToOneTargetAfterFirstRound !== 0 || gold._useCachedAtkOnly !== 0
    || selector._buffKey !== MARK || selector._filterBuffSource !== 0 || selector._postFilter !== 14
    || selector._targetMotion !== 1 || selector._maxNum !== 1
    || projectile._managedBySource !== 0 || projectile._stopWhenSourceInvalid !== 0
    || projectile._maxHitNum !== 1 || projectile._lifeTime !== 10 || mover._speed !== 8
    || mover._forceReachedWhenTimeup !== 1 || events(u, 'Skill_3_Loop').length !== 2
    || events(u, 'Skill_3_End').length !== 1)
    throw Error('Unreviewed Swire S3 native source');
  return { ...r, build };
}

export class SwireS3Controller extends SwirePassiveController {
  constructor(b, u, record) {
    super(b, u, record);
    this.mode = 0; this.marked = new Set(); this.outputs = new Set(); this.finishHook = null;
  }
  install() {
    super.install();
    if (!this.finishHook && !this.stopped) this.finishHook = this.b.on('battleEnd', () => this.cancelOutputs());
  }
  canCast() {
    const u = this.u;
    return this.valid() && u.canAct && !u.s.flags.disarm && !u.s.flags.silence && !u.s.flags.noSp
      && !u.skill.active && this.mode === 0 && this.phase?.kind !== 'entrance';
  }
  canCancel() {
    return this.valid() && this.mode === 3 && this.u.canAct && !this.u.s.flags.disarm && !this.u.s.flags.silence;
  }
  startSkill() {
    this.mode = 3; this.u.atkCd = 0; this.epoch = this.u.attackControlEpoch;
    this.visual('Skill_3_Begin');
    this.phase = { kind: 'begin', readyAt: this.b.time + model(this.u).durations.Skill_3_Begin };
  }
  endSkill() {
    // onEnd precedes skillEnd: capture once before the economy's event hook clears it.
    const coins = this.wallet.finishSkill();
    this.clearMarks(); this.phase = null; this.mode = 0;
    if (!this.valid() || !this.u.canAct || this.u.s.flags.disarm) return;
    const { b, u } = this;
    this.mode = 4; this.epoch = u.attackControlEpoch; u.atkCd = 0;
    const hold = b.addBuff(u, { key: HOLD, source: u, flags: { noSp: true } });
    if (!hold || !this.valid() || this.mode !== 4) { this.finishEnding(); return; }
    const keys = new Set(absoluteRangeKeys(grid('2-4'), u.tileR, u.tileC, u.dir));
    for (const e of b.enemies) if (live(e)
      && canTargetEnemy(u, e, { canHitFly: e.blockedBy === u })
      && (e.blockedBy === u || !e.isFlying && bodyInKeys(e, keys))) this.mark(e);
    if (!this.valid() || this.mode !== 4) { this.finishEnding(); return; }
    this.visual('Skill_3_End');
    this.phase = { kind: 'ending', seq: u.deploySeq, epoch: u.attackControlEpoch, coins, next: 0,
      releaseAt: b.time + events(u, 'Skill_3_End')[0],
      readyAt: b.time + model(u).durations.Skill_3_End, attackId: null, aborted: false };
    b.emit('swireEnding', { owner: u, coins, targets: [...this.marked] });
  }
  mark(e) {
    // Native source filtering is disabled. Claims prevent one ending from
    // deleting another ending's shared mark, including a pre-existing mark.
    let state = e.mem.swireEndingMarks;
    if (!state) {
      const existing = e.buffs.find(x => x.key === MARK);
      const created = existing ? null : this.b.addBuff(e, { key: MARK, source: this.u });
      if (!existing && !created) return;
      if (!this.valid()) { if (created) this.b.removeBuff(e, created); return; }
      state = e.mem.swireEndingMarks = { claims: new Set(), created };
    }
    state.claims.add(this); this.marked.add(e);
  }
  clearMarks() {
    for (const e of this.marked) {
      const state = e.mem.swireEndingMarks;
      if (!state) continue;
      state.claims.delete(this);
      if (!state.claims.size) {
        if (state.created) this.b.removeBuff(e, state.created);
        delete e.mem.swireEndingMarks;
      }
    }
    this.marked.clear();
  }
  recipients() {
    return this.b.enemies.filter(e => live(e) && !e.isFlying
      && canTargetEnemy(this.u, e, { canHitFly: false })
      && (!e.s.flags.camou || !!e.blockedBy) && e.buffs.some(x => x.key === MARK));
  }
  fire(target, info) {
    if (this.mode !== 3) return super.fire(target, info);
    const p = this.phase, u = this.u;
    if (!this.valid() || !u.canAct || u.s.flags.disarm || p?.kind !== 'double' || p.accepted
      || p.seq !== u.deploySeq || p.epoch !== u.attackControlEpoch || this.b.time + 1e-9 < p.releaseAt
      || p.target !== target || target.deploySeq !== p.targetSeq || !this.enemies().includes(target)) return false;
    p.accepted = true; p.attackId = info.attackId;
    this.doubleHit(p, 0); return true;
  }
  doubleHit(p, index) {
    const u = this.u, t = p.target;
    if (!this.valid() || this.mode !== 3 || !u.canAct || u.s.flags.disarm || !p.accepted
      || p.seq !== u.deploySeq || p.epoch !== u.attackControlEpoch || t.deploySeq !== p.targetSeq
      || !this.enemies().includes(t)) return;
    resolveHit(this.b, u, { dmgType: 'phys', atkScale: 1, hits: 1, applyWay: 'melee' }, t,
      { attackId: p.attackId, isSkill: true }, t.x, t.y);
    this.b.emit('swireDoubleHit', { owner: u, target: t, index, attackId: p.attackId });
  }
  born(p, target) {
    const { b, u } = this;
    if (p.attackId === null) p.attackId = ++b._attackSeq;
    const output = { target, targetSeq: target.deploySeq, attackId: p.attackId,
      index: p.next, coef: this.record.bb.atk_scale, force: this.record.bb.force, projectile: null };
    this.outputs.add(output);
    output.projectile = b.addProjectile({ from: u, source: u, target, speed: mover._speed,
      maxAge: projectile._lifeTime, hitDead: true, visual: 'bullet',
      data: { arkpediaTrackedVisual: true, swireEnding: true }, onHit: ctx => {
        if (!b.finished && this.outputs.has(output) && ctx.target === target && live(target)
          && target.deploySeq === output.targetSeq) {
          resolveHit(b, u, { dmgType: 'phys', atkScale: output.coef, hits: 1, applyWay: 'ranged',
            // The nonsilenceable active push is not damage-missable: it still
            // applies after a dodged/shielded receipt if the victim survives.
            afterHit: () => { if (live(target)) b.push(target, output.force, { from: u }); } }, target,
          { attackId: output.attackId, isSkill: true, isProjectile: true }, ctx.x, ctx.y);
          b.emit('swireGoldHit', { owner: u, target, index: output.index, attackId: output.attackId });
        }
        this.outputs.delete(output); this.releaseFinishHook();
      } });
    b.emit('swireGoldBirth', { owner: u, target, index: output.index,
      attackId: output.attackId, projectile: output.projectile });
  }
  finishEnding() {
    this.clearMarks(); this.b.removeBuff(this.u, HOLD);
    this.u.skill.sp = 0; this.u.skill.charges = 0;
    this.mode = 0; this.phase = null; this.u.atkCd = 0;
    if (this.valid()) this.visual('Idle', 1, true);
  }
  tick() {
    const { b, u } = this;
    if (!this.valid() || this.mode === 0) { super.tick(); return; }
    if (!u.canAct || u.s.flags.disarm || this.epoch !== u.attackControlEpoch) {
      if (this.mode === 4) this.finishEnding();
      else { this.phase = null; this.visual('Skill_3_Idle', 1, true); }
      this.epoch = u.attackControlEpoch; return;
    }
    let p = this.phase;
    if (p?.kind === 'begin') {
      if (b.time + 1e-9 < p.readyAt) return;
      this.phase = null; p = null;
    }
    if (p?.kind === 'ending') {
      // Independent CAST selection per coin. No new marks are added after end.
      while (!p.aborted && p.next < p.coins
        && b.time + 1e-9 >= p.releaseAt + p.next * gold._triggerDelta) {
        const rows = this.recipients();
        if (!rows.length) { p.aborted = true; break; }
        this.born(p, rows[Math.floor(b.rng() * rows.length)]); p.next++;
        if (!this.valid() || this.phase !== p) return;
      }
      if (b.time + 1e-9 >= p.readyAt) this.finishEnding();
      return;
    }
    if (p?.kind === 'double') {
      while (p.next < p.events.length && b.time + 1e-9 >= p.events[p.next]) {
        const index = p.next++;
        if (index === 0) {
          if (p.target.deploySeq === p.targetSeq) b.forceAttack(u, [p.target]);
        } else this.doubleHit(p, index);
        if (!this.valid() || this.phase !== p) return;
      }
      if (b.time + 1e-9 < p.readyAt) return;
      this.phase = null;
    }
    if (u.atkCd > 1e-9) return;
    const target = this.enemies()[0];
    if (!target) { this.visual('Skill_3_Idle', 1, true); return; }
    const speed = u.base.bat / u.s.interval, times = events(u, 'Skill_3_Loop').map(t => b.time + t / speed);
    this.visual('Skill_3_Loop', speed);
    this.phase = { kind: 'double', target, targetSeq: target.deploySeq, seq: u.deploySeq,
      epoch: u.attackControlEpoch, releaseAt: times[0], events: times, next: 0, accepted: false,
      readyAt: Math.max(b.time + u.s.interval, times.at(-1)), attackId: null };
    u.atkCd = u.s.interval;
  }
  cancelOutputs() {
    this.b.projectiles.remove(p => [...this.outputs].some(o => o.projectile === p));
    this.outputs.clear(); this.releaseFinishHook();
  }
  releaseFinishHook() {
    if ((this.stopped || this.b.finished) && !this.outputs.size && this.finishHook) {
      this.b.off(this.finishHook); this.finishHook = null;
    }
  }
  stop() {
    if (this.stopped) return;
    this.finishEnding(); super.stop();
    if (this.b.finished) this.cancelOutputs();
    this.releaseFinishHook();
  }
}

export function prepareSwireS3(b, u, { contract } = {}) {
  const record = selectedS3(u, contract), controller = new SwireS3Controller(b, u, record);
  const kit = { trait: { noAttack: true, attackDrivenSkill: true, attack: 'melee', projectile: 'none',
    dmgType: 'phys', hits: 1, requiresAcceptedLaunch: true, attackVisual: 'none',
    launchAttack: (_b, _u, _p, t, info) => controller.fire(t, info) },
    skill: { id: record.skillId, name: u.def.skill.name, kind: 'toggle', attack: {}, trigger: { rule: 'SP_FULL' },
      manualCancel: true, canManualCancel: () => controller.canCancel(), canActivate: () => controller.canCast(),
      onStart: () => controller.startSkill(), onEnd: () => controller.endSkill() } };
  return { record, controller, kit };
}
