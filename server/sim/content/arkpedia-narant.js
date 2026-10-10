// SPDX-License-Identifier: GPL-3.0-or-later
// Source-fed controller. Original clips/events drive an explicit
// local phase policy; compiled Unity FSM and frame ordering are not recovered.
import evidence from '../../../data/arkpedia-narant-prefabs.json' with { type: 'json' };
import { acquireTargets, effectiveProfile } from '../ai.js';
import { NarantuyaProjectiles, NARANT_ID, selectedNarantBlackboard } from './arkpedia-narant-projectiles.js';
import { NarantuyaTalents, selectedNarantTalents } from './arkpedia-narant-talents.js';

const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const model = u => evidence.models[NARANT_ID][u.dir === 'UP' ? 'Back' : 'Front'];
const components = evidence.characters[NARANT_ID].flatMap(o => o.components);
const attacks = ['-1505720997345727890', '7862980603147741806',
  '7880466419594193518', '8641459181420964462'].map(id => components.find(c => c.pathId === id)?.data);
const finishKey = u => `narant:${u.id}:finish-sp`;
const validContract = c => c?.phasePolicy === 'source-clips-local-v1'
  && c.entrance === 'whole-source-start-clip'
  && c.attackPost === 'max-interval-clip-and-return'
  && c.skillTransitions === 'whole-source-begin-and-end-clips'
  && c.invalidInput === 'captured-position-for-s3-only'
  && typeof c.reviewNote === 'string' && !!c.reviewNote.trim();
const sameGrid = (a, z) => JSON.stringify(a ?? []) === JSON.stringify(z ?? []);

export class NarantuyaController {
  constructor(b, u, links, talents, contracts) {
    if (!validContract(contracts?.controller)) throw Error('Narantuya controller requires reviewed phase contracts');
    if (attacks.some(a => !a || a._waitForAttackEvent !== 1 || a._maxAnimScale !== 1
      || a._escapeTime !== 1 || a._selectTargetTiming !== 0 || a._preDelay !== 0)
      || attacks[3]._emitToInputPosWhenTargetIsInvalid !== 1
      || attacks[3]._additionalTimes !== 2 || attacks[3]._triggerDelta !== 0)
      throw Error('Unreviewed Narantuya attack phase source');
    this.b = b; this.u = u; this.links = links; this.talents = talents;
    this.skill = Number(u.def.skill.id.at(-1)); this.rank = u.def.raw.arkpedia.skillRank;
    this.baseRange = u.rangeGrid.map(p => [...p]); this.mode = 0; this.phase = null;
    this.stopped = false; this.handles = []; this.controlEpoch = u.attackControlEpoch;
  }
  visual(clip, { speed = 1, loop = false } = {}) {
    if (!Object.hasOwn(model(this.u).durations, clip)) throw Error(`Missing original Narantuya clip: ${clip}`);
    this.u.mem.regularFormVisual = { clip, speed, loop };
  }
  clip(mode, part = 'Loop') {
    const down = this.u.dir === 'DOWN';
    if (mode === 0) return down ? 'Attack_Down' : 'Attack';
    if (mode === 1) return down ? 'Skill_Down_1' : 'Skill_1';
    return `Skill_${down ? 'Down_' : ''}${mode}_${part}`;
  }
  idle() { this.visual(this.mode < 2 ? 'Idle' : this.clip(this.mode, 'Idle'), { loop: true }); }
  canCast() {
    const u = this.u;
    return !this.stopped && live(u) && u.canAct && !u.s.flags.silence && !u.s.flags.noSp
      && !u.skill?.active && !['entrance', 'skill-begin', 'skill-end'].includes(this.phase?.kind);
  }
  setRange(stance) {
    // Native -1 forward extension is a shortened base shape, not a negative
    // global range bonus. Preserve the rear column and independent extensions.
    const end = new Map();
    for (const [r, c] of this.baseRange) end.set(r, Math.max(end.get(r) ?? -Infinity, c));
    this.u.rangeGrid = stance ? this.baseRange.filter(([r, c]) => c < end.get(r))
      : this.baseRange.map(p => [...p]);
    this.b.refreshRange(this.u);
  }
  startSkill() {
    const { b, u } = this;
    this.phase = null; u.atkCd = 0;
    if (this.skill === 1) {
      this.mode = this.mode === 1 ? 0 : 1; this.setRange(this.mode === 1);
      u.profile.isSkill = this.mode === 1; this.idle(); return;
    }
    this.mode = this.skill;
    const clip = this.clip(this.mode, 'Begin'); this.visual(clip);
    this.phase = { kind: 'skill-begin', readyAt: b.time + model(u).durations[clip] };
  }
  endSkill() {
    // S1 is an instant manual mode switch. Its stance survives the instant
    // SkillRuntime end, while natural SP charges the next switch in either mode.
    if (this.skill === 1 || this.stopped || !live(this.u)) return;
    const { b, u } = this, oldMode = this.mode;
    this.mode = 0; u.atkCd = 0;
    b.addBuff(u, { key: finishKey(u), source: u, flags: { noSp: true } });
    const clip = this.clip(oldMode || this.skill, 'End'); this.visual(clip);
    this.phase = { kind: 'skill-end', readyAt: b.time + model(u).durations[clip] };
  }
  validInput(e) {
    const p = this.phase;
    return !this.stopped && live(this.u) && this.u.canAct && !this.u.s.flags.disarm
      && p?.kind === 'attack' && p.released && !p.born && p.target === e
      && p.seq === this.u.deploySeq && p.controlEpoch === this.u.attackControlEpoch
      && p.mode === this.mode
      && (p.mode === 3 || e.deploySeq === p.input.seq && this.links.legal(e, true));
  }
  fire(e, { attackId }) {
    if (!this.validInput(e)) return false;
    const p = this.phase;
    p.flight = this.links.launch(e, attackId, p.mode, { rank: this.rank, input: p.input });
    if (!p.flight) return false;
    p.born = true; return true;
  }
  startAttack() {
    const { b, u } = this;
    if (!this.links.canAttack()) return;
    const e = acquireTargets(b, u, effectiveProfile(u))[0];
    if (!e) return;
    const speed = Math.min(attacks[this.mode]._maxAnimScale, u.base.bat / u.s.interval);
    const clip = this.clip(this.mode), m = model(u), events = m.eventPayloads[clip];
    if (events?.length !== 1 || events[0].name !== 'OnAttack') throw Error('Unreviewed Narantuya attack event');
    this.visual(clip, { speed });
    this.phase = { kind: 'attack', target: e, input: { x: e.x, y: e.y, seq: e.deploySeq },
      mode: this.mode, seq: u.deploySeq, controlEpoch: u.attackControlEpoch,
      startedAt: b.time,
      releaseAt: b.time + events[0].time / speed,
      readyAt: b.time + Math.max(u.s.interval, m.durations[clip] * attacks[this.mode]._escapeTime / speed),
      released: false, born: false, flight: null };
    u.atkCd = u.s.interval;
  }
  tick() {
    const { b, u } = this;
    if (this.stopped) return;
    if (!live(u) || b.finished) { this.stop(); return; }
    const p = this.phase;
    if (['entrance', 'skill-begin', 'skill-end'].includes(p?.kind)) {
      if (b.time + 1e-9 >= p.readyAt) {
        if (p.kind === 'skill-end') b.removeBuff(u, finishKey(u));
        this.phase = null; this.idle();
      }
      this.controlEpoch = u.attackControlEpoch; return;
    }
    if (!u.canAct || u.s.flags.disarm || this.controlEpoch !== u.attackControlEpoch) {
      this.controlEpoch = u.attackControlEpoch;
      // An interruption discards an unfired command. Already born blades own
      // their return/lifetime independently; a new command still waits for them.
      this.phase = null; this.idle(); return;
    }
    if (p?.kind === 'attack') {
      if (!p.released && b.time + 1e-9 >= p.releaseAt) {
        p.released = true;
        if (this.validInput(p.target)) b.forceAttack(u, [p.target]);
      }
      if (b.time + 1e-9 < p.readyAt || p.flight && !p.flight.complete) return;
      this.phase = null; this.idle();
    }
    if (u.atkCd <= 1e-9) this.startAttack();
  }
  enter() {
    if (this.stopped) return;
    this.mode = 0; this.u.profile.isSkill = false; this.setRange(false);
    this.controlEpoch = this.u.attackControlEpoch; this.visual('Start');
    this.phase = { kind: 'entrance', readyAt: this.b.time + model(this.u).durations.Start };
  }
  install() {
    if (this.handles.length || this.stopped) return;
    const { b, u } = this;
    if (live(u)) this.enter(); else this.idle();
    // The tick hook runs after SkillRuntime expiration and projectile returns.
    // An expiry boundary cannot release an old skill's still-unfired command.
    this.handles = [b.on('tick', () => this.tick(), { owner: u }),
      b.on('deploy', ({ unit }) => { if (unit === u) this.enter(); }, { owner: u }),
      b.on('death', ({ unit }) => { if (unit === u) this.stop(); }, { owner: u }),
      b.on('battleEnd', () => this.stop(), { owner: u })];
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.phase = null; this.mode = 0;
    this.u.skill?.end('owner-finish'); this.b.removeBuff(this.u, finishKey(this.u));
    this.talents.dispose(); this.u.mem.regularFormVisual = null;
    this.u.profile.isSkill = false; this.setRange(false);
    for (const h of this.handles) this.b.off(h); this.handles = [];
  }
}

export function prepareNarantKit(b, u, { contracts } = {}) {
  if (u.def.charId !== NARANT_ID) throw Error('Narantuya controller requires Narantuya source data');
  const build = u.def.raw.arkpedia, s = u.def.skill, n = Number(s?.id?.at(-1));
  selectedNarantTalents(build); // Validate promotion, level and potential before installing hooks.
  const rank = build.skillRank, selected = Number.isInteger(rank) && rank >= 1 && rank <= 10
    ? evidence.tables.skills[s?.id]?.levels[rank - 1] : null;
  const phase = evidence.tables.character.phases[build.elite];
  const baseRange = evidence.tables.ranges[phase.rangeId].grids.map(p => [p.row, p.col]);
  if (!selected || ![1, 2, 3].includes(n) || s.id !== `skchr_narant_${n}`
    || build.skillId != null && build.skillId !== s.id
    || n > build.elite + 1 || rank > [4, 7, 10][build.elite]
    || build.module && build.module !== 'none'
    || s.spType !== (n === 2 ? 'attack' : 'time') || s.skillType !== selected.skillType
    || s.spCost !== selected.spData.spCost || s.initSp !== selected.spData.initSp
    || s.maxCharges !== selected.spData.maxChargeTime || s.duration !== selected.duration
    || Object.keys(s.bb).length !== selected.blackboard.length
    || Object.entries(selectedNarantBlackboard(n, rank)).some(([k, v]) => s.bb[k] !== v)
    || !sameGrid(s.rangeGrid, []) || !sameGrid(u.rangeGrid, baseRange))
    throw Error('Incomplete Narantuya selected source skill/build');
  if (!validContract(contracts?.controller)) throw Error('Narantuya controller requires reviewed phase contracts');
  const links = new NarantuyaProjectiles(b, u), talents = new NarantuyaTalents(b, u);
  let controller;
  try { controller = new NarantuyaController(b, u, links, talents, contracts); }
  catch (error) { talents.dispose(); throw error; }
  u.mem.narantController = controller;
  const kit = {
    trait: { noAttack: true, attackDrivenSkill: true, attack: 'ranged', dmgType: 'phys',
      canHitFly: true, projectile: 'arrow', maxTargets: 1, hits: 1, attackVisual: 'none',
      install: null, boomerang: false, canAttack: () => links.canAttack(),
      requiresAcceptedLaunch: true, acceptAttackInput: e => controller.validInput(e),
      launchAttack: (_b, _u, _p, e, info) => controller.fire(e, info) },
    skill: { id: s.id, name: s.name, kind: n === 1 ? 'instant' : 'duration', duration: s.duration,
      trigger: { rule: 'NEVER' }, manualCancel: false, canActivate: () => controller.canCast(),
      ...(n !== 1 ? { attack: {} } : {}),
      onStart: () => controller.startSkill(), onEnd: () => controller.endSkill() },
  };
  return { kit, controller, links, talents };
}

// Reviewed web phase choices, not recovered native FSM callback execution.
const regularContracts = Object.freeze({ controller: {
  phasePolicy: 'source-clips-local-v1', entrance: 'whole-source-start-clip',
  attackPost: 'max-interval-clip-and-return', skillTransitions: 'whole-source-begin-and-end-clips',
  invalidInput: 'captured-position-for-s3-only',
  reviewNote: 'Whole source clips and original events drive local clocks; expiry precedes release. Native numeric timeMode, FSM, same-frame ordering and curved projectile movement remain unverified.',
} });
export function customizeNarantKit({ battle, id, unit, kit }) {
  if (id !== NARANT_ID) return;
  if (!evidence.enabledOperators.includes(id) || evidence.runtimeMapping?.[id] !== 'narant')
    throw Error('Narantuya source record lacks a complete runtime review');
  const prepared = prepareNarantKit(battle, unit, { contracts: regularContracts });
  kit.install = null; Object.assign(kit, prepared.kit);
}
export function installNarant({ unit, def }) {
  if (def.charId !== NARANT_ID) return;
  const controller = unit.mem.narantController;
  if (!controller) throw Error('Missing selected Narantuya controller');
  controller.install();
}
