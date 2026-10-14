// SPDX-License-Identifier: GPL-3.0-or-later
// Opted-in native-source diagnostic. Public registration is a separate gate.
import evidence from '../../../data/arkpedia-necrass-prefabs.json' with { type: 'json' };
import { NECRASS_ID as ID, selectedNecrassBuild, necrassSourceComponent as component }
  from './arkpedia-necrass-source.js';
import { normalizeChess, normSpType } from '../simdata.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';

export const NECRASS_CORE_CONTRACT = Object.freeze({
  scope: 'Selected Necrass ordinary Arts projectiles, owned-servant blocking inputs and E2 low-HP output scaling; diagnostic only',
  mapping: 'Original capped Front/Back Attack release launches one speed-ten homing projectile with a ten-second lifetime. The input retains its target life. Current same-life ATK is read at impact; a retired source uses its launch snapshot without consulting a later deployment. Owned servants inside the host range extend ordinary selection to their blocked enemies. The output talent checks current target HP strictly below its selected threshold and multiplies damage once.',
  limits: 'Retired-source snapshots, numeric selector aliases, target ordering, dominant-axis Front/Back facing, modifier/FSM/SP ordering and two-dimensional homing are explicit simulator policies, not compiled Unity or battle-frame parity. Servant factory/upgrade behavior has a separate contract. All active owner skills, S3 special servant, delivered artwork and public review remain held. Modules and native particles/shaders/audio remain unsupported.',
  frameParity: false,
});
export const necrassPresent = u => !!(u?.alive && u.deployed && !u._removing);
const live = u => necrassPresent(u) && !u.hidden;
const due = (b, t) => b.time + 1e-9 >= t;
const same = (a, z) => JSON.stringify(a) === JSON.stringify(z);
const plain = Object.freeze({ canHitFly: true, attack: 'ranged', dmgType: 'arts' });

function validate(u, contract) {
  if (contract !== NECRASS_CORE_CONTRACT) throw Error('Necrass requires the reviewed core contract');
  if (u.def.charId !== ID || u.deploySeq !== 0 || u.mem.necrassController)
    throw Error('Necrass requires a fresh original owner');
  const build = { ...u.def.raw.arkpedia, skillId: u.def.skill?.id }, r = selectedNecrassBuild(build), s = u.def.skill;
  if (u.def.raw.arkpedia.skillId != null && u.def.raw.arkpedia.skillId !== build.skillId
    || s.skillType !== r.source.skillType || s.durationType !== r.source.durationType
    || s.spType !== normSpType(r.source.spData.spType) || s.spCost !== r.source.spData.spCost
    || s.initSp !== r.source.spData.initSp || s.maxCharges !== r.source.spData.maxChargeTime
    || s.duration !== r.source.duration || !same(s.bb, r.bb)
    || !same(s.rangeGrid ?? [], r.skillRangeGrid) || !same(u.rangeGrid, r.rangeGrid)
    || !same(u.def.tags, r.tags) || !same(u.def.stats, normalizeChess({ stats: r.stats }).stats)
    || !same(u.def.talents.map(t => t.bb), r.talentBb)) throw Error('Incomplete Necrass selected source');
  const attack = component('-1344118519958587300'), p = component('-2597081926463096321');
  if (attack._waitForAttackEvent !== 1 || attack._animKey !== 'Attack' || attack._maxAnimScale !== 1
    || attack._damageType !== 2 || attack._projectileKey !== 'projectile_chr_necras'
    || attack._selectTargetSource !== 2 || attack._alwaysIncludeTarget !== 1 || attack._useCachedAtkOnly !== 0
    || attack._faceToTarget !== 1
    || p._maxHitNum !== 1 || p._stopAfterMaxHit !== 1 || p._stopWhenSourceInvalid !== 0
    || p._lifeTime !== 10 || component('1362580795943320063')._speed !== 10
    || component('7902666797136885852')._onlyForToken !== 1
    || component('7902666797136885852')._ignoreHitRange !== 0)
    throw Error('Unreviewed Necrass native ordinary controller');
  const output = evidence.templates.necras_t_2.eventToActions.ON_OUTPUT_DAMAGE;
  if (output[0]._condType !== 'LT' || output[0]._useSourceHpRatio !== false || output[1]._isStackable !== false)
    throw Error('Unreviewed Necrass native output talent');
  for (const face of ['Front', 'Back']) {
    const m = evidence.models[ID][face];
    if (m.eventPayloads.Attack.length !== 1 || m.eventPayloads.Attack[0].name !== 'OnAttack'
      || m.eventPayloads.Attack[0].time !== .5 || m.durations.Start !== 1)
      throw Error('Unreviewed Necrass ordinary animation');
  }
  return r;
}

// One original retained target per attack. Separate instances own servant clocks.
export class NecrassAttackClock {
  constructor(core, unit, { token = false } = {}) {
    this.core = core; this.b = core.b; this.u = unit; this.token = token;
    this.seq = null; this.phase = null; this.accepting = false; this.stopped = false;
  }
  valid() { return !this.stopped && this.core.valid() && necrassPresent(this.u) && this.u.deploySeq === this.seq; }
  model() {
    const models = this.token ? evidence.tokenModels.token_10043_necras_skeltn : evidence.models[ID];
    return models[['UP', 'LEFT'].includes(this.faceDirection ?? this.u.dir) ? 'Back' : 'Front'];
  }
  clip(type) { return this.token ? { born: 'Start_2', idle: 'Idle_2', attack: 'Attack_2', die: 'Die_2' }[type]
    : { born: 'Start', idle: 'Idle', attack: 'Attack', die: 'Die' }[type]; }
  visual(clip, speed = 1, loop = false) {
    const u = this.u, death = this.clip('die');
    u.mem.regularVisualDirection = ['UP', 'LEFT'].includes(this.faceDirection ?? u.dir) ? 'UP' : 'RIGHT';
    u.mem.regularFormVisual = { clip, speed, loop };
    // Missing optional Back death clips remain missing; do not replace facings.
    if (this.model().durations[death] != null)
      u.mem.regularDeathVisual = { clip: death, die: death, duration: this.model().durations[death] };
    else delete u.mem.regularDeathVisual;
  }
  born() {
    this.faceDirection = null;
    this.seq = this.u.deploySeq;
    this.phase = { kind: 'born', readyAt: this.b.time + this.model().durations[this.clip('born')] };
    this.visual(this.clip('born'));
  }
  keys() { return this.u.rangeKeySet ?? new Set(absoluteRangeKeys(this.u.rangeGrid,
    this.u.tileR, this.u.tileC, this.u.dir, this.u.s.rangeExtend)); }
  selectable(t, hitSleep = false) { return live(t) && canTargetEnemy(this.u, t,
    this.token ? { canHitFly: false } : hitSleep ? { ...plain, hitSleep: true } : plain)
    && (!t.s.flags.camou || !!t.blockedBy); }
  targets() {
    const keys = this.keys(), u = this.u;
    const out = this.b.enemies.filter(t => this.selectable(t) && (bodyInKeys(t, keys)
      || t.blockedBy === u || !this.token && this.core.servants?.blocksInHostRange(t, keys)));
    sortEnemyTargets(this.b, u, out); return out.slice(0, 1);
  }
  release(t, info) {
    if (!this.token && this.core.skills?.release) return this.core.skills.release(t, info);
    return this.ordinaryRelease(t, info);
  }
  ordinaryRelease(t, info) {
    const { u, b, phase: p } = this;
    if (!this.accepting || !this.valid() || !live(u) || !u.canAct || u.s.flags.disarm
      || p?.kind !== 'attack' || p.accepted || p.epoch !== u.attackControlEpoch
      || p.target !== t || p.targetSeq !== t.deploySeq || !this.selectable(t) || !due(b, p.releaseAt)) return false;
    p.accepted = true;
    if (this.token) b.dealDamage(u, t, { amount: u.s.atk * u.s.atkScaleMul, type: 'arts',
      isAttack: true, applyWay: 'melee', attackId: info.attackId, tags: ['necrass:servant-ordinary'] });
    else this.core.projectile(t, info);
    return true;
  }
  tick() {
    if (!this.token && this.core.skills?.controlsOwner) { this.core.skills.tick(); return; }
    const { b, u } = this;
    if (!this.valid()) { this.phase = null; return; }
    let p = this.phase;
    if (p?.kind === 'born') { if (!due(b, p.readyAt)) return; this.phase = null; p = null; }
    if (!live(u) || !u.canAct || u.s.flags.disarm || p && p.epoch !== u.attackControlEpoch) {
      this.phase = null; this.visual(this.clip('idle'), 1, true); return;
    }
    if (p) {
      if (!p.released && due(b, p.releaseAt)) {
        p.released = true;
        if (this.selectable(p.target) && p.target.deploySeq === p.targetSeq) {
          this.accepting = true;
          try { b.forceAttack(u, [p.target]); } finally { this.accepting = false; }
        }
      }
      if (!this.valid() || this.phase !== p || !due(b, p.readyAt)) return;
      this.phase = null;
    }
    if (u.atkCd > 1e-9) return;
    const target = this.targets()[0];
    if (!target) { this.visual(this.clip('idle'), 1, true); return; }
    const dx = target.x - u.x, dy = target.y - u.y;
    this.faceDirection = Math.abs(dx) >= Math.abs(dy) ? dx < 0 ? 'LEFT' : 'RIGHT' : dy > 0 ? 'UP' : 'DOWN';
    const clip = this.clip('attack'), model = this.model(), speed = Math.min(1, u.base.bat / u.s.interval);
    const release = model.eventPayloads[clip].find(v => v.name === 'OnAttack').time / speed;
    this.phase = { kind: 'attack', target, targetSeq: target.deploySeq, epoch: u.attackControlEpoch,
      startedAt: b.time, releaseAt: b.time + release, readyAt: b.time + Math.max(u.s.interval, release),
      accepted: false, released: false };
    this.visual(clip, speed); u.atkCd = u.s.interval;
  }
  stop() { this.stopped = true; this.phase = null; this.accepting = false;
    this.u.mem.regularFormVisual = null; delete this.u.mem.regularVisualDirection; }
}

export class NecrassCoreController {
  constructor(b, u, record) {
    this.b = b; this.u = u; this.record = record; this.seq = null; this.stopped = false;
    this.handles = []; this.flights = new Set(); this.clock = new NecrassAttackClock(this, u);
    this.t2 = record.talentBb[record.talents.findIndex(t => t.prefabKey === '2')];
  }
  valid() { return !this.stopped && !this.b.finished && necrassPresent(this.u) && this.u.deploySeq === this.seq; }
  output({ source, target, dmg }) {
    this.skills?.output({ source, target, dmg });
    if (!this.valid() || !this.t2 || (source !== this.u && !this.servants?.owns(source))
      || !live(target) || target.side !== 'enemy' || target.hpRatio >= this.t2.hp_ratio) return;
    dmg.mul *= this.t2.damage_scale;
  }
  projectile(t, info) {
    const { b, u } = this, targetSeq = t.deploySeq;
    // Detached source has frozen launch attributes but shares the original
    // accounting ledger. New deployments cannot donate modifiers to this shot.
    const snapshot = { ...u, def: u.def, base: { ...u.base }, profile: { hitSleep: u.profile.hitSleep },
      mem: {}, tags: new Set(u.tags), s: structuredClone(u.s), stats: u.stats };
    const flight = { sourceSeq: u.deploySeq, snapshot, retired: false };
    this.flights.add(flight);
    const expiry = b.after(10 + b.dt, () => this.flights.delete(flight));
    b.addProjectile({ from: u, source: u, target: t, speed: 10, maxAge: 10, visual: 'none',
      data: { arkpediaTrackedVisual: true, projectileKey: 'projectile_chr_necras' },
      onHit: ({ target }) => {
        expiry.cancel(); this.flights.delete(flight);
        if (b.finished || target !== t || t.deploySeq !== targetSeq
          || !this.clock.selectable(t, this.skills?.hitsSleep === true)) return;
        const source = !flight.retired && necrassPresent(u) && u.deploySeq === flight.sourceSeq ? u : snapshot;
        b.dealDamage(source, t, { amount: source.s.atk * source.s.atkScaleMul, type: 'arts',
          isAttack: true, isProjectile: true, applyWay: 'ranged', attackId: info.attackId,
          tags: ['necrass:ordinary'] });
      } });
  }
  install() {
    if (this.stopped || this.handles.length) throw Error('Necrass cannot install twice or after retirement');
    const { b, u } = this;
    this.servants?.install();
    this.skills?.install();
    this.handles = [b.on('deploy', ({ unit, move }) => {
      if (unit === u && !move) { this.seq = u.deploySeq; this.clock.born(); }
    }, { owner: u }), b.on('tick', () => {
      if (this.stopped || b.finished || this.seq !== null && !this.valid()) { this.stop(); return; }
      this.clock.tick(); this.servants?.tick();
    }, { owner: u }), b.on('outputDamage', ctx => this.output(ctx), { owner: u }),
    b.on('death', ({ unit }) => { if (unit === u) this.stop(); }, { owner: u }),
    b.on('battleEnd', () => this.stop())];
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.skills?.stop(); this.clock.stop();
    for (const f of this.flights) f.retired = true;
    this.flights.clear(); this.servants?.stop();
    for (const h of this.handles) this.b.off(h); this.handles = [];
  }
}

export function necrassAttackProfile(clock, token = false) {
  return { noAttack: true, attackDrivenSkill: true, attack: token ? 'melee' : 'ranged',
    projectile: 'none', dmgType: 'arts', canHitFly: !token, maxTargets: 1, maxTargetsByBlock: false,
    hitAllBlocked: false, allInRange: false, rangeAoe: false, hits: 1, hitsFn: null, chain: null,
    splashRadius: 0, heal: null, onHit: null, onEachHit: null, install: null,
    requiresAcceptedLaunch: true, attackVisual: 'none',
    launchAttack: (_b, _u, _p, t, info) => clock.release(t, info) };
}
export function prepareNecrassCore(b, u, { contract } = {}) {
  const record = validate(u, contract), controller = new NecrassCoreController(b, u, record);
  u.mem.necrassController = controller;
  return { record, controller, kit: { trait: necrassAttackProfile(controller.clock), talents: [], install: null,
    skill: { kind: 'instant', trigger: { rule: 'NEVER' }, canActivate: () => false } } };
}
