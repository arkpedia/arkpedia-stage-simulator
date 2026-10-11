// SPDX-License-Identifier: GPL-3.0-or-later
// Private selected-source core; complete skills and public enablement need separate reviews.
import evidence from '../../../data/arkpedia-exusiai-covenant-prefabs.json' with { type: 'json' };
import { sourceCandidate } from '../../../shared/arkpedia/summons.js';
import { normalizeChess, flattenBlackboard } from '../simdata.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys, bodyInRadius } from '../body.js';
import { applyHpLoss, makeDamageInfo } from '../damage.js';
import { EXUSIAI_COVENANT_S1_CONTRACT, ExusiaiCovenantS1 } from './arkpedia-exusiai-covenant-s1.js';
import { EXUSIAI_COVENANT_S2_CONTRACT, ExusiaiCovenantS2 } from './arkpedia-exusiai-covenant-s2.js';
import { EXUSIAI_COVENANT_S3_CONTRACT, ExusiaiCovenantS3 } from './arkpedia-exusiai-covenant-s3.js';
import { EXUSIAI_COVENANT_COORDINATES_CONTRACT, ExusiaiCovenantCoordinates } from './arkpedia-exusiai-covenant-coordinates.js';

export const EXUSIAI_COVENANT_ID = 'char_1041_angel2';
export const EXUSIAI_COVENANT_CORE_CONTRACT = Object.freeze({
  scope: 'Selected-source ordinary attack, one-percent nonlethal HP drain and both ammunition talents; all three skills and coordinates remain held',
  mapping: 'Original clip event and first-attack opening; current ATK on projectile arrival; one independently rolled bombardment per consumed bullet, event-captured ally range candidates and .1-second projectile births with .3-second arrivals; same-key derived aura refresh',
  limits: 'Compiled ammo listener dispatch, target-marker clearing and selector comparators, native callback/frame clocks, token delivery, modules, particles and audio are not certified',
  frameParity: false,
});
const ID = EXUSIAI_COVENANT_ID;
const flat = flattenBlackboard;
const present = u => u?.alive && u.deployed && !u._removing;
const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const air = { canHitFly: true };
const grid = id => id ? evidence.tables.ranges[id].grids.map(v => [v.row, v.col]) : [];
const same = (a, z) => JSON.stringify(a) === JSON.stringify(z);
const character = evidence.tables.character;
const factions = [...new Set([character, character.mainPower, ...(character.subPower ?? [])]
  .filter(Boolean).flatMap(power => ['nationId', 'groupId', 'teamId'].map(k => power[k]))
  .filter(v => typeof v === 'string' && v))];
const components = ['characters', 'tokens', 'skills', 'projectiles'].flatMap(k =>
  Object.values(evidence[k]).flat().flatMap(r => r.components));
const component = id => components.find(c => c.pathId === id)?.data;
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const interpolate = (frames, level) => {
  const lo = frames[0], hi = frames.at(-1), t = hi.level === lo.level ? 0 : (level - lo.level) / (hi.level - lo.level);
  return Object.fromEntries(Object.entries(lo.data).filter(([, v]) => typeof v === 'number')
    .map(([k, v]) => [k, v + (hi.data[k] - v) * t]));
};

export function selectedExusiaiCovenantBuild(build) {
  const c = evidence.tables.character;
  if (!build || !Number.isInteger(build.elite) || !c.phases[build.elite]
    || !Number.isInteger(build.level) || build.level < 1 || build.level > c.phases[build.elite].maxLevel
    || !Number.isInteger(build.potential) || build.potential < 1 || build.potential > 6
    || !Number.isInteger(build.trust ?? 0) || (build.trust ?? 0) < 0 || (build.trust ?? 0) > 200
    || !Number.isInteger(build.skillRank) || build.skillRank < 1 || build.skillRank > [4, 7, 10][build.elite]
    || build.module && build.module !== 'none') throw Error('Invalid Exusiai Covenant source build');
  const index = ['skchr_angel2_1', 'skchr_angel2_2', 'skchr_angel2_3'].indexOf(build.skillId);
  if (index < 0 || index > build.elite) throw Error('Locked Exusiai Covenant source skill');
  const phase = c.phases[build.elite], source = evidence.tables.skills[build.skillId].levels[build.skillRank - 1];
  const stats = interpolate(phase.attributesKeyFrames, build.level);
  const favor = interpolate(c.favorKeyFrames, Math.min(100, build.trust ?? 0) / 2);
  for (const k of ['maxHp', 'atk', 'def']) stats[k] = Math.round(stats[k] + favor[k]);
  const attrs = { COST: 'cost', ATK: 'atk' };
  for (const p of c.potentialRanks.slice(0, build.potential - 1)) for (const m of p.buff?.attributes.attributeModifiers ?? []) {
    if (!attrs[m.attributeType] || m.formulaItem !== 'ADDITION') throw Error('Unreviewed Exusiai Covenant potential');
    stats[attrs[m.attributeType]] += m.value;
  }
  const talents = c.talents.map(t => sourceCandidate(t.candidates, build)).filter(Boolean);
  return { build: { ...build }, index, source, bb: flat(source.blackboard), stats, tags: [...factions], rangeGrid: grid(phase.rangeId), talents,
    ammoTalent: flat(talents.find(t => t.prefabKey === '1')?.blackboard),
    auraTalent: flat(talents.find(t => t.prefabKey === '2')?.blackboard) };
}

function validate(u, contract) {
  if (contract !== EXUSIAI_COVENANT_CORE_CONTRACT) throw Error('Exusiai Covenant requires the reviewed core contract');
  if (u.def.charId !== ID || u.deploySeq !== 0 || u.mem.exusiaiCovenantController) throw Error('Exusiai Covenant requires a fresh original owner');
  const build = { ...u.def.raw.arkpedia, skillId: u.def.skill?.id }, r = selectedExusiaiCovenantBuild(build), s = u.def.skill;
  if (u.def.raw.arkpedia.skillId != null && u.def.raw.arkpedia.skillId !== build.skillId
    || s.skillType !== r.source.skillType || s.durationType !== 'AMMO' || s.spType !== 'time'
    || s.spCost !== r.source.spData.spCost || s.initSp !== r.source.spData.initSp
    || s.maxCharges !== r.source.spData.maxChargeTime || s.duration !== -1
    || !same(s.bb, r.bb) || !same(s.rangeGrid ?? [], grid(r.source.rangeId))
    || !same(u.rangeGrid, r.rangeGrid) || !same(u.def.tags, factions)
    || !same(u.def.stats, normalizeChess({ stats: r.stats }).stats)
    || !same(u.def.talents.map(t => t.bb), r.talents.map(t => flat(t.blackboard)))) throw Error('Incomplete Exusiai Covenant selected source');
  if (flat(evidence.tables.character.trait.candidates[0].blackboard).hp_ratio !== .01
    || component('3942859318297224431')._waitForAttackEvent !== 1
    || component('3942859318297224431')._useCachedAtkOnly !== 0
    || component('4736339665936758452')._speed !== 30
    || component('-6198213916863279048')._delayToStart !== .30000001192092896)
    throw Error('Unreviewed Exusiai Covenant native core');
  return r;
}

export class ExusiaiCovenantCoreController {
  constructor(b, u, record) {
    this.b = b; this.u = u; this.record = record; this.seq = null;
    this.stopped = false; this.phase = null; this.opened = false; this.handles = [];
    this.auraRecipients = new Set(); this.drainAt = Infinity;
  }
  valid() { return !this.stopped && !this.b.finished && live(this.u) && this.seq === this.u.deploySeq; }
  eligible(t) { return live(t) && canTargetEnemy(this.u, t, air) && (!t.s.flags.camou || !!t.blockedBy); }
  visual(clip, speed = 1, loop = false) {
    this.u.mem.regularVisualDirection = ['UP', 'LEFT'].includes(this.u.dir) ? 'UP' : 'RIGHT';
    this.u.mem.regularFormVisual = { clip, speed, loop };
  }
  targets(owner = this.u) {
    const keys = owner.rangeKeySet ?? new Set(absoluteRangeKeys(owner.rangeGrid, owner.tileR, owner.tileC, owner.dir, owner.s.rangeExtend));
    const out = this.b.enemies.filter(t => this.eligible(t) && (bodyInKeys(t, keys) || t.blockedBy === owner));
    sortEnemyTargets(this.b, this.u, out); return out;
  }
  syncAura() {
    const { b, u, record: r } = this;
    const wanted = new Set(this.valid() && r.auraTalent.atk ? b.allyUnits.filter(a =>
      live(a) && a.kind === 'op' && a.def.skill?.durationType === 'AMMO' && b.allySelectable(a, u)) : []);
    for (const a of this.auraRecipients) if (!wanted.has(a) && a.findBuff('angel2:covenant')?.source === u)
      b.removeBuff(a, 'angel2:covenant');
    for (const a of wanted) if (a.findBuff('angel2:covenant')?.source !== u)
      b.addBuff(a, { key: 'angel2:covenant', source: u,
        mods: { atkPct: r.auraTalent.atk * (a.def.tags.includes('laterano') ? r.auraTalent.mult : 1) } });
    this.auraRecipients = wanted;
  }
  consume({ unit: consumer, count = 1 }) {
    const { b, u, record: r } = this;
    if (!this.valid() || !live(consumer) || consumer.kind !== 'op' || consumer.side !== u.side
      || !b.allySelectable(consumer, u) || !Number.isInteger(count) || count < 1 || !r.ammoTalent.hp_ratio) return;
    for (let i = 0; i < count; i++) {
      if (!this.valid()) return;
      b.heal(u, u, u.s.maxHp * r.ammoTalent.hp_ratio, { self: true });
    }
    if (!this.valid()) return;
    let successes = 0;
    for (let i = 0; i < count; i++) if (b.rng() < r.ammoTalent.prob) successes++;
    // Original marker-clear and compiled dispatch bodies are unavailable.
    // Capture this consumption's marked-range candidates; each round reselects
    // among surviving original lives, never an unrelated future range entrant.
    const candidates = this.targets(consumer).map(t => ({ t, seq: t.deploySeq }));
    for (let i = 0; i < successes; i++) b.after(i * .10000000149011612, () => {
      if (!this.valid()) return;
      const out = candidates.filter(v => v.t.deploySeq === v.seq && this.eligible(v.t)).map(v => v.t);
      sortEnemyTargets(b, u, out);
      const target = out[0]; if (!target) return;
      const seq = target.deploySeq, point = { x: target.x, y: target.y };
      b.addProjectile({ from: point, to: point, source: u,
        flightTime: .30000001192092896, maxAge: .30000001192092896, visual: 'none',
        data: { arkpediaTrackedVisual: true, exusiaiCovenantOwner: this, exusiaiCovenantKind: 'talent' },
        onHit: () => {
          if (b.finished) return;
          for (const t of b.enemies) if (live(t) && canTargetEnemy(u, t, air) &&
            (t === target && t.deploySeq === seq || bodyInRadius(t, point.x, point.y, 1.2999999523162842)))
            b.dealDamage(u, t, makeDamageInfo({ amount: u.s.atk * r.ammoTalent.aoe_atk_scale, type: 'phys',
              isAttack: true, isSplash: true, tags: ['angel2:talent'] }));
        } });
      b.emit('exusiaiCovenantBombBirth', { owner: u, consumer, target, round: i });
    }, { owner: u });
  }
  release(t, info) {
    if (this.phase?.kind === 's3-attack') return this.s3?.release(t, info) ?? false;
    if (this.phase?.kind === 's2-attack') return this.s2?.release(t, info) ?? false;
    if (this.s1?.burst?.accepting) return this.s1.releaseBurst(t, info);
    if (this.phase?.kind === 's1-attack') return this.s1?.release(t, info) ?? false;
    const { u, b } = this, p = this.phase;
    if (!this.valid() || !u.canAct || u.s.flags.disarm || p?.kind !== 'attack' || p.accepted
      || p.target !== t || p.targetSeq !== t.deploySeq || p.epoch !== u.attackControlEpoch
      || !this.eligible(t) || b.time + 1e-9 < p.releaseAt) return false;
    p.accepted = true;
    const seq = t.deploySeq;
    const projectile = b.addProjectile({ from: u, target: t, source: u, speed: 30, maxAge: 10, visual: 'bolt',
      data: { arkpediaTrackedVisual: true, exusiaiCovenantOwner: this, exusiaiCovenantKind: 'ordinary' },
      onHit: ({ target }) => {
        if (b.finished || target !== t || t.deploySeq !== seq || !this.eligible(t)) return;
        b.dealDamage(u, t, makeDamageInfo({ amount: u.s.atk * u.s.atkScaleMul, type: 'phys',
          isAttack: true, isSkill: !!info.isSkill, attackId: info.attackId ?? 0,
          applyWay: 'ranged', tags: ['angel2:ordinary'] }));
      } });
    b.emit('exusiaiCovenantProjectileBirth', { owner: u, target: t, projectile }); return true;
  }
  tick() {
    if (this.stopped || this.b.finished || !present(this.u) || this.seq !== this.u.deploySeq) {
      this.syncAura(); if (this.seq !== null) this.stop(); return;
    }
    const { b, u } = this;
    this.syncAura();
    if (b.time + 1e-9 >= this.drainAt) {
      this.drainAt += 1;
      const amount = Math.max(0, Math.min(u.hp - Math.min(1, u.s.maxHp), u.s.maxHp * .01));
      applyHpLoss(b, u, u, amount,
        makeDamageInfo({ amount, type: 'true', noSp: true, isAttack: true, tags: ['angel2:drain'] }));
    }
    if (u.hidden) { this.phase = null; this.s1?.hidden(); this.s3?.hidden(); return; }
    if (this.s1?.tick()) return;
    if (this.s2?.tick()) return;
    if (this.s3?.tick()) return;
    let p = this.phase;
    if (p?.kind === 'entrance') { if (b.time + 1e-9 < p.readyAt) return; this.phase = null; p = null; }
    if (!u.canAct || u.s.flags.disarm || p && p.epoch !== u.attackControlEpoch) {
      this.phase = null; this.visual('Idle', 1, true); return;
    }
    if (p) {
      if (p.kind === 'opening' && b.time + 1e-9 >= p.loopAt) { p.kind = 'attack'; this.visual(p.clip, p.speed); }
      if (!p.released && b.time + 1e-9 >= p.releaseAt) {
        p.released = true;
        if (this.eligible(p.target) && p.targetSeq === p.target.deploySeq) b.forceAttack(u, [p.target]);
      }
      if (b.time + 1e-9 < p.readyAt) return;
      this.phase = null;
    }
    if (u.atkCd > 1e-9) return;
    const target = this.targets()[0]; if (!target) { this.visual('Idle', 1, true); return; }
    const m = model(u), down = u.dir === 'DOWN', clip = down ? 'Attack_Down_Loop' : 'Attack_Loop';
    const begin = down ? 'Attack_Down_Begin' : 'Attack_Begin', speed = u.base.bat / u.s.interval;
    const opening = this.opened ? 0 : m.durations[begin] / speed; this.opened = true;
    this.phase = { kind: opening ? 'opening' : 'attack', target, targetSeq: target.deploySeq, epoch: u.attackControlEpoch,
      clip, speed, loopAt: b.time + opening,
      releaseAt: b.time + opening + m.eventPayloads[clip].find(v => v.name === 'OnAttack').time / speed,
      readyAt: b.time + opening + Math.max(u.s.interval, m.durations[clip] / speed), accepted: false, released: false };
    this.visual(opening ? begin : clip, speed); u.atkCd = u.s.interval + opening;
  }
  install() {
    const { b, u } = this;
    this.handles = [b.on('deploy', ({ unit, move }) => {
      if (unit === u && !move) {
        this.seq = u.deploySeq; this.drainAt = b.time + 1; this.opened = false;
        this.phase = { kind: 'entrance', readyAt: b.time + model(u).durations.Start }; this.visual('Start');
      }
      this.syncAura();
    }, { owner: u }), b.on('tick', () => this.tick(), { owner: u }),
    b.on('ammoUsed', c => this.consume(c), { owner: u }),
    b.on('removed', ({ unit }) => { if (unit === u) this.stop(); else this.syncAura(); }, { owner: u }),
    b.on('death', ({ unit }) => { if (unit === u) this.stop(); else this.syncAura(); }, { owner: u }),
    b.on('battleEnd', () => this.stop())];
    this.coordinates?.install();
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.coordinates?.stop(); this.s1?.ownerStop(); this.s2?.ownerStop(); this.phase = null; this.syncAura();
    if (this.b.finished) this.b.projectiles.remove(p => p.data?.exusiaiCovenantOwner === this);
    this.u.mem.regularFormVisual = null; delete this.u.mem.regularVisualDirection;
    for (const h of this.handles) this.b.off(h); this.handles = [];
  }
}

export function prepareExusiaiCovenantCore(b, u, { contract } = {}) {
  const record = validate(u, contract), controller = new ExusiaiCovenantCoreController(b, u, record);
  u.mem.exusiaiCovenantController = controller;
  const kit = { trait: { noAttack: true, attackDrivenSkill: true, attack: 'ranged', dmgType: 'phys', projectile: 'none',
    maxTargets: 1, hits: 1, hitsFn: null, chain: null, splashRadius: 0, heal: null, ...air,
    install: null, onHit: null, onEachHit: null, requiresAcceptedLaunch: true, attackVisual: 'none',
    launchAttack: (_b, _u, _p, t, info) => controller.release(t, info) },
  skill: { kind: 'instant', trigger: { rule: 'NEVER' }, canActivate: () => false }, talents: [], install: null };
  return { record, controller, kit };
}

export function prepareExusiaiCovenantS1(b, u, { contract } = {}) {
  if (contract !== EXUSIAI_COVENANT_S1_CONTRACT) throw Error('Exusiai Covenant S1 requires the reviewed skill contract');
  const record = validate(u, EXUSIAI_COVENANT_CORE_CONTRACT);
  if (record.index !== 0) throw Error('Exusiai Covenant S1 requires the selected first skill');
  const attack = component('1907782741202953455'), burst = component('5571565256772543727');
  if (attack._waitForAttackEvent !== 1 || attack._maxAnimScale !== 1 || attack._useCachedAtkOnly !== 0
    || burst._animKey !== 'Skill_1_Close' || burst._triggerDelta !== .05000000074505806
    || burst._waitAttackEventForAllAttacks !== 0 || burst._limitToOneTargetAfterFirstRound !== 0
    || component('-4786399778558772475')._preDelay !== .30000001192092896
    || component('-1823870851832874235')._canDiscardRemainingCount !== 1
    || component('-6354835174965532718')._speed !== 30 || component('2077853693862095778')._speed !== 10)
    throw Error('Unreviewed Exusiai Covenant S1 native ability');
  const prepared = prepareExusiaiCovenantCore(b, u, { contract: EXUSIAI_COVENANT_CORE_CONTRACT });
  const { controller, kit } = prepared;
  controller.s1 = new ExusiaiCovenantS1(controller);
  kit.skill = { kind: 'ammo', ammo: record.bb['attack@trigger_time'], duration: 0,
    trigger: { rule: 'SP_FULL' }, manualCancel: true, attack: { priority: 'fly' },
    canActivate: () => controller.s1.canCast(), onStart: () => controller.s1.start(),
    onAttack: ctx => { if (controller.s1.burst) ctx.noAmmo = true; },
    onEnd: ctx => controller.s1.end(ctx.reason), onManualCancel: () => controller.s1.manualStop() };
  return prepared;
}

export function prepareExusiaiCovenantS2(b, u, { contract } = {}) {
  if (contract !== EXUSIAI_COVENANT_S2_CONTRACT) throw Error('Exusiai Covenant S2 requires the reviewed skill contract');
  const record = validate(u, EXUSIAI_COVENANT_CORE_CONTRACT);
  if (record.index !== 1) throw Error('Exusiai Covenant S2 requires the selected second skill');
  for (const id of ['3670591584193012975', '-5719382545127709457']) {
    const a = component(id);
    if (a._waitForAttackEvent !== 0 || a._useCachedAtkOnly !== 1 || a._transferSource !== 1 || a._maxAnimScale !== 1)
      throw Error('Unreviewed Exusiai Covenant S2 projectile dispatch');
  }
  const selector = component('-1471925624412839651'), steal = component('-848266832636746513');
  if (selector._excludeOwner !== 1 || selector._professionMask !== 639 || selector._postFilter !== 4
    || steal._attributeType !== 7 || steal._formulaType !== 2 || steal._finishTargetBuffWhenInvalid !== 1
    || steal._finishOwnerBuffWhenTargetInvalid !== 0 || component('3215183870520921349')._speed !== 30
    || evidence.templates['angel2_s_2[shield]'].eventToActions.ON_BUFF_START[0]._targetType !== 'BUFF_SOURCE'
    || evidence.templates['angel2_s_2[cleaner]'].eventToActions.ON_BUFF_START[0]._checkBuffSource !== true)
    throw Error('Unreviewed Exusiai Covenant S2 loan and shield');
  const prepared = prepareExusiaiCovenantCore(b, u, { contract: EXUSIAI_COVENANT_CORE_CONTRACT });
  const { controller, kit } = prepared;
  controller.s2 = new ExusiaiCovenantS2(controller);
  kit.skill = { kind: 'ammo', ammo: record.bb['attack@trigger_time'], duration: 0,
    trigger: { rule: 'NEVER' }, manualCancel: true, attack: {},
    canActivate: () => controller.s2.canCast(), onStart: () => controller.s2.start(),
    onEnd: ctx => controller.s2.end(ctx.reason) };
  return prepared;
}

export function prepareExusiaiCovenantS3(b, u, { contract } = {}) {
  if (contract !== EXUSIAI_COVENANT_S3_CONTRACT) throw Error('Exusiai Covenant S3 requires the reviewed skill contract');
  const record = validate(u, EXUSIAI_COVENANT_CORE_CONTRACT);
  if (record.index !== 2) throw Error('Exusiai Covenant S3 requires the selected third skill');
  for (const id of ['7303740197574534383', '-700871714258295569']) {
    const a = component(id);
    if (a._waitForAttackEvent !== 1 || a._useCachedAtkOnly !== 0 || a._maxAnimScale !== 1
      || a._additionalTimes !== 4 || a._triggerDelta !== .10000000149011612
      || a._waitAttackEventForAllAttacks !== 0 || a._limitToOneTargetAfterFirstRound !== 0
      || a._interruptAbilityOnDetach !== 1) throw Error('Unreviewed Exusiai Covenant S3 volley');
  }
  if (component('-3515024303529728785')._expendPerTrigger !== 5
    || component('-1444526159829080849')._expendPerTrigger !== 5
    || component('2275396499278483937')._speed !== 30
    || component('5276092084022503678')._canDiscardRemainingCount !== 1)
    throw Error('Unreviewed Exusiai Covenant S3 ammunition');
  const prepared = prepareExusiaiCovenantCore(b, u, { contract: EXUSIAI_COVENANT_CORE_CONTRACT });
  const { controller, kit } = prepared;
  controller.s3 = new ExusiaiCovenantS3(controller);
  kit.skill = { kind: 'ammo', ammo: record.bb['attack@trigger_time'], duration: 0,
    trigger: { rule: 'NEVER' }, manualCancel: true, attack: {}, mods: { atkPct: record.bb.atk },
    canActivate: () => controller.s3.canCast(), onStart: () => controller.s3.start(),
    onAttack: ctx => controller.s3.consume(ctx), onEnd: ctx => controller.s3.end(ctx.reason) };
  return prepared;
}

export function prepareExusiaiCovenantCoordinates(b, u, { contract } = {}) {
  if (contract !== EXUSIAI_COVENANT_COORDINATES_CONTRACT) throw Error('Exusiai Coordinates requires the reviewed delivery contract');
  const token = component('5469880532721077243'), cannon = component('1043593523196519663');
  const actions = JSON.parse(cannon._actions.SerializedState), sp = evidence.templates['angel2_s_3[sp]'].eventToActions.ON_BUFF_START[0];
  if (token._occupiedRemainingCharacterCnt !== 0 || token._buildCondition.buildableType !== 1
    || token._buildCondition.needSpecifyDirection !== 1 || token._buildCondition.limitByHostAttackRange !== 1
    || cannon._animKey !== 'Skill_3_Skill' || cannon._waitForAttackEvent !== 1 || cannon._maxAnimScale !== -1
    || component('7299706011241545312')._speed !== 10 || component('9077714383366848096')._stopWhenSourceInvalid !== 1
    || component('4112073188336795232').m_Radius !== 1.7999999523162842
    || component('-4694220270147994016')._onlyCheckHitWhenStop !== 1
    || actions.length !== 5 || actions[0]._blackboardKey !== 'direction' || actions[0]._isReverse !== false
    || actions[2]._withdrawSource !== false || actions[2]._force !== true
    || actions[3]._onlyRecordDoNotRefreshRespawnTime !== true || actions[3]._keyToStore !== 'card_id'
    || !actions[4].$type.endsWith('+Angel2DeployCharacterOnTileBySelector')
    || sp._forceFlag !== false || sp._spMask !== 'ALL' || sp._spString !== 'sp')
    throw Error('Unreviewed Exusiai coordinate and cannon source');
  const prepared = prepareExusiaiCovenantS3(b,u,{contract:EXUSIAI_COVENANT_S3_CONTRACT});
  prepared.controller.coordinates = new ExusiaiCovenantCoordinates(prepared.controller);
  return prepared;
}
