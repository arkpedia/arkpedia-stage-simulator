// SPDX-License-Identifier: GPL-3.0-or-later
// Native receipt stays held; public selection and all active skills need review.
import evidence from '../../../data/arkpedia-yu-prefabs.json' with { type: 'json' };
import { sourceCandidate } from '../../../shared/arkpedia/summons.js';
import { normalizeChess, normSpType, flattenBlackboard as flat } from '../simdata.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { makeDamageInfo } from '../damage.js';

export const YU_ID = 'char_2026_yu';
export const YU_CORE_CONTRACT = Object.freeze({
  scope: 'Selected source build, ordinary Physical attack, blocked-target Burn/Arts, Sanctuary, passive S1 taunt and HP/elemental recovery',
  mapping: 'One original ground input or explicitly self-blocked flying input, uncapped native hit clock, per-blocked-life half-second first pulse then selected interval, independent HP and EP attributes. Selected table count includes friendly operators and the owner; serialized checker five remains an unresolved compiled boundary.',
  limits: 'Active skills and public enablement remain held. Compiled checker count loading, selector/FSM/action dispatch, source-on-calculate filtering, block/control/talent callback order and frame parity are not certified. Modules and native particles/shaders/audio are unsupported.',
  frameParity: false,
});
const ID = YU_ID, character = evidence.tables.character;
const skills = [1, 2, 3].map(n => `skchr_yu_${n}`);
const present = u => u?.alive && u.deployed && !u._removing;
const live = u => present(u) && !u.hidden;
const due = (b, t) => b.time + 1e-9 >= t;
const same = (a, z) => JSON.stringify(a) === JSON.stringify(z);
const grid = id => id ? evidence.tables.ranges[id].grids.map(g => [g.row, g.col]) : [];
const tags = [...new Set([character, character.mainPower, ...(character.subPower ?? [])].filter(Boolean)
  .flatMap(p => ['nationId', 'groupId', 'teamId'].map(k => p[k])).filter(v => typeof v === 'string' && v))];
const components = Object.values(evidence.characters).flat().flatMap(r => r.components);
export const yuSourceComponent = id => components.find(c => c.pathId === id)?.data;
const interpolate = (frames, level) => {
  const lo = frames[0], hi = frames.at(-1), t = hi.level === lo.level ? 0 : (level - lo.level) / (hi.level - lo.level);
  return Object.fromEntries(Object.entries(lo.data).filter(([, v]) => typeof v === 'number')
    .map(([k, v]) => [k, v + (hi.data[k] - v) * t]));
};

export function selectedYuBuild(build) {
  const c = character;
  if (!build || !Number.isInteger(build.elite) || !c.phases[build.elite]
    || !Number.isInteger(build.level) || build.level < 1 || build.level > c.phases[build.elite].maxLevel
    || !Number.isInteger(build.potential) || build.potential < 1 || build.potential > 6
    || !Number.isInteger(build.trust ?? 0) || (build.trust ?? 0) < 0 || (build.trust ?? 0) > 200
    || !Number.isInteger(build.skillRank) || build.skillRank < 1 || build.skillRank > [4, 7, 10][build.elite]
    || build.module && build.module !== 'none') throw Error('Invalid Yu source build');
  const index = skills.indexOf(build.skillId);
  if (index < 0 || index > build.elite) throw Error('Locked Yu source skill');
  const phase = c.phases[build.elite], source = evidence.tables.skills[build.skillId].levels[build.skillRank - 1];
  const stats = interpolate(phase.attributesKeyFrames, build.level);
  const favor = interpolate(c.favorKeyFrames, Math.min(100, build.trust ?? 0) / 2);
  for (const key of ['maxHp', 'atk', 'def']) stats[key] = Math.round(stats[key] + favor[key]);
  const attrs = { COST: 'cost', MAX_HP: 'maxHp' };
  for (const p of c.potentialRanks.slice(0, build.potential - 1)) for (const m of p.buff?.attributes.attributeModifiers ?? []) {
    if (!attrs[m.attributeType] || m.formulaItem !== 'ADDITION') throw Error('Unreviewed Yu potential');
    stats[attrs[m.attributeType]] += m.value;
  }
  const talents = c.talents.map(t => sourceCandidate(t.candidates, build)).filter(Boolean);
  return { build: { ...build }, index, source, bb: flat(source.blackboard), stats, talents,
    tags: [...tags], rangeGrid: grid(phase.rangeId),
    block: flat(talents.find(t => t.prefabKey === '1')?.blackboard),
    market: flat(talents.find(t => t.prefabKey === '2')?.blackboard) };
}

function validate(u, contract) {
  if (contract !== YU_CORE_CONTRACT) throw Error('Yu requires the reviewed core contract');
  if (u.def.charId !== ID || u.deploySeq !== 0 || u.mem.yuController) throw Error('Yu requires a fresh original owner');
  const build = { ...u.def.raw.arkpedia, skillId: u.def.skill?.id }, r = selectedYuBuild(build), s = u.def.skill;
  if (u.def.raw.arkpedia.skillId != null && u.def.raw.arkpedia.skillId !== build.skillId
    || s.skillType !== r.source.skillType || s.durationType !== r.source.durationType || s.spType !== normSpType(r.source.spData.spType)
    || s.spCost !== r.source.spData.spCost || s.initSp !== r.source.spData.initSp
    || s.maxCharges !== r.source.spData.maxChargeTime || s.duration !== r.source.duration
    || !same(s.bb, r.bb) || !same(s.rangeGrid ?? [], grid(r.source.rangeId))
    || !same(u.rangeGrid, r.rangeGrid) || !same(u.def.tags, tags)
    || !same(u.def.stats, normalizeChess({ stats: r.stats }).stats)
    || !same(u.def.talents.map(t => t.bb), r.talents.map(t => flat(t.blackboard))))
    throw Error('Incomplete Yu selected source');
  const attack = yuSourceComponent('1925973106970963498');
  if (attack._waitForAttackEvent !== 1 || attack._animKey !== 'Attack' || attack._damageType !== 1
    || attack._maxAnimScale !== -1) throw Error('Unreviewed Yu attack clock');
  return r;
}

function mods(b, a, key, value, source) {
  const old = a.findBuff(key);
  if (!value) { if (old) { void a.s; b.removeBuff(a, key); void a.s; } }
  else if (!old || old.source !== source || !same(old.mods, value)) {
    void a.s; b.addBuff(a, { key, source, mods: value }); void a.s;
  }
}

export class YuCoreController {
  constructor(b, u, record) {
    this.b = b; this.u = u; this.record = record; this.seq = null; this.stopped = false;
    this.handles = []; this.blocked = new Map(); this.phase = null; this.accepting = false;
    this.recovery = new Map();
  }
  valid() { return !this.stopped && !this.b.finished && live(this.u) && this.seq === this.u.deploySeq; }
  model() { return evidence.models[ID][['UP', 'LEFT'].includes(this.u.dir) ? 'Back' : 'Front']; }
  visual(clip, speed = 1, loop = false) {
    this.u.mem.regularVisualDirection = ['UP', 'LEFT'].includes(this.u.dir) ? 'UP' : 'RIGHT';
    this.u.mem.regularFormVisual = { clip, speed, loop };
    if (this.model().durations.Die != null)
      this.u.mem.regularDeathVisual = { clip: 'Die', die: 'Die', duration: this.model().durations.Die };
    else delete this.u.mem.regularDeathVisual;
  }
  targets(limit = 1) {
    const { b, u } = this;
    const keys = u.rangeKeySet ?? new Set(absoluteRangeKeys(u.rangeGrid, u.tileR, u.tileC, u.dir, u.s.rangeExtend));
    const out = b.enemies.filter(t => live(t) && canTargetEnemy(u, t, { canHitFly: t.blockedBy === u })
      && (!t.s.flags.camou || !!t.blockedBy) && (bodyInKeys(t, keys) || t.blockedBy === u));
    sortEnemyTargets(b, u, out); return out.slice(0, limit);
  }
  release(t, info) {
    if (this.skills?.handlesRelease()) return this.skills.releaseAttack(t, info);
    const { b, u, phase: p } = this;
    if (!this.accepting || !this.valid() || !u.canAct || u.s.flags.disarm || !p || p.kind !== 'attack'
      || p.epoch !== u.attackControlEpoch || p.target !== t || p.targetSeq !== t.deploySeq || p.accepted
      || !live(t) || !due(b, p.releaseAt) || !canTargetEnemy(u, t, { canHitFly: t.blockedBy === u })) return false;
    p.accepted = true;
    b.dealDamage(u, t, makeDamageInfo({ amount: u.s.atk * u.s.atkScaleMul, type: 'phys', isAttack: true,
      isSkill: false, isSplash: false, applyWay: 'melee', attackId: info.attackId ?? 0, tags: ['yu:ordinary'] }));
    return true;
  }
  tickAttack() {
    if (this.skills?.tickAttack()) return;
    const { b, u } = this;
    if (!this.valid()) { this.phase = null; return; }
    let p = this.phase;
    if (p?.kind === 'born') { if (!due(b, p.readyAt)) return; this.phase = null; p = null; }
    if (!u.canAct || u.s.flags.disarm || p && p.epoch !== u.attackControlEpoch) {
      this.phase = null; this.visual('Idle', 1, true); return;
    }
    if (p) {
      if (!p.released && due(b, p.releaseAt)) {
        p.released = true;
        if (live(p.target) && p.target.deploySeq === p.targetSeq) {
          this.accepting = true;
          try { b.forceAttack(u, [p.target]); } finally { this.accepting = false; }
        }
      }
      if (!this.valid() || this.phase !== p || !due(b, p.readyAt)) return;
      this.phase = null;
    }
    if (u.atkCd > 1e-9) return;
    const target = this.targets()[0];
    if (!target) { this.visual('Idle', 1, true); return; }
    const speed = u.base.bat / u.s.interval, m = this.model(), clip = 'Attack';
    this.phase = { kind: 'attack', target, targetSeq: target.deploySeq, epoch: u.attackControlEpoch, accepted: false,
      releaseAt: b.time + m.eventPayloads[clip].find(e => e.name === 'OnAttack').time / speed,
      readyAt: b.time + Math.max(u.s.interval, m.durations[clip] / speed), released: false };
    this.visual(clip, speed); u.atkCd = u.s.interval;
  }
  blockEligible(t) { return this.valid() && live(t) && t.blockedBy === this.u && this.u.blocking.includes(t); }
  syncBlocks() {
    const { b, u, record } = this, sanctuary = `yu:block:sanctuary:${u.id}`, key = `yu:block:damage:${u.id}`;
    const eligible = new Set(record.block.damage_resistance ? u.blocking.filter(t => this.blockEligible(t)) : []);
    if (!eligible.size) b.removeBuff(u, sanctuary);
    else if (u.findBuff(sanctuary)?.data?.value !== record.block.damage_resistance)
      b.applyStatus(u, 'sanctuary', { key: sanctuary, source: u, value: record.block.damage_resistance });
    for (const [t, state] of this.blocked) if (!eligible.has(t) || t.deploySeq !== state.seq || t.findBuff(key) !== state.buff) {
      b.removeBuff(t, key); this.blocked.delete(t);
    }
    const buff = yuSourceComponent('-5466566168720789974')._buffsToBlockee[0];
    for (const t of eligible) if (!this.blocked.has(t)) {
      const owned = b.addBuff(t, { key, source: u });
      if (owned) this.blocked.set(t, { seq: t.deploySeq, next: b.time + buff.firstTriggerInterval, buff: owned });
    }
  }
  tickBlocked() {
    const { b, u, record: r } = this, ratio = r.block['yu_t_1[enemy].ep_damage_ratio'];
    const scale = r.block['yu_t_1[enemy].atk_scale'], interval = r.block['yu_t_1[enemy].interval'];
    if (!this.valid() || !(interval > 0)) return;
    for (const [t, state] of [...this.blocked]) {
      while (due(b, state.next) && this.blockEligible(t) && t.deploySeq === state.seq
        && this.blocked.get(t) === state && t.findBuff(state.buff.key) === state.buff) {
        state.next += interval;
        const attackId = `yu:blocked:${u.id}:${t.id}:${state.next}`;
        // Original action sequence applies FIRE injury before MAGICAL damage;
        // both fetch current source ATK rather than the ordinary attack scale.
        b.dealDamage(u, t, makeDamageInfo({ amount: u.s.atk * ratio, type: 'element', element: 'burn',
          isAttack: false, isSkill: false, canDodge: false, attackId, tags: ['yu:blocked:burn'] }));
        if (!this.blockEligible(t) || t.deploySeq !== state.seq) break;
        b.dealDamage(u, t, makeDamageInfo({ amount: u.s.atk * scale, type: 'arts', applyWay: 'melee',
          isAttack: false, isSkill: false, canDodge: false, attackId, tags: ['yu:blocked:arts'] }));
      }
    }
  }
  syncRecovery() {
    const { b, u, record: r } = this, key = `yu:market:hp:${u.id}`, ep = `yu:market:ep:${u.id}`;
    const operators = b.allyUnits.filter(a => live(a) && a.kind === 'op');
    // Explicit table-bound interpretation: friendly operator count includes Yu.
    // The original prefab checker five is preserved, not silently rewritten.
    const enabled = this.valid() && r.market.cnt > 0 && operators.length >= r.market.cnt;
    const recipients = new Set(enabled ? (this.skills?.recoveryRecipients(operators) ?? [u]) : []);
    const interval = yuSourceComponent('-1850537544557547990')._buffs[0].triggerInterval;
    for (const a of new Set([...this.recovery.keys(), ...recipients])) {
      if (!recipients.has(a)) {
        mods(b, a, key, null, u); mods(b, a, ep, null, u); this.recovery.delete(a); continue;
      }
      mods(b, a, key, { hpRegenRatio: r.market.hp_recovery_per_sec_by_max_hp_ratio }, u);
      let state = this.recovery.get(a);
      if (!state || state.seq !== a.deploySeq) {
        state = { seq: a.deploySeq, next: b.time }; this.recovery.set(a, state);
      }
      if (due(b, state.next)) {
        mods(b, a, ep, { epRegen: a.s.maxHp * r.market.ep_heal_ratio }, u);
        do { state.next += interval; } while (due(b, state.next));
      }
    }
  }
  install() {
    const { b, u } = this;
    this.handles = [b.on('deploy', ({ unit, move }) => {
      if (unit === u && !move) {
        this.seq = u.deploySeq; this.phase = { kind: 'born', readyAt: b.time + this.model().durations.Start };
        this.visual('Start');
        if (this.record.index === 0) mods(b, u, `yu:passive:taunt:${u.id}`, { taunt: this.record.bb.taunt_level }, u);
      }
      this.syncBlocks(); this.syncRecovery();
    }, { owner: u }), b.on('blocked', () => this.syncBlocks(), { owner: u }),
    b.on('unblocked', () => this.syncBlocks(), { owner: u }), b.on('tick', () => {
      if (this.stopped || b.finished) { this.stop(); return; }
      this.skills?.tick(); this.syncBlocks(); this.syncRecovery(); this.tickBlocked(); this.tickAttack();
    }, { owner: u }), b.on('death', ({ unit }) => {
      if (unit === u) this.stop(); else { this.syncBlocks(); this.syncRecovery(); }
    }, { owner: u }), b.on('battleEnd', () => this.stop())];
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.phase = null;
    this.skills?.stop();
    this.syncBlocks(); this.syncRecovery(); this.blocked.clear(); this.recovery.clear();
    mods(this.b, this.u, `yu:passive:taunt:${this.u.id}`, null, this.u);
    this.u.mem.regularFormVisual = null; delete this.u.mem.regularVisualDirection;
    for (const h of this.handles) this.b.off(h); this.handles = [];
  }
}

export function prepareYuCore(b, u, { contract } = {}) {
  const record = validate(u, contract), controller = new YuCoreController(b, u, record);
  u.mem.yuController = controller;
  const trait = { noAttack: true, attackDrivenSkill: true, attack: 'melee', projectile: 'none', dmgType: 'phys',
    canHitFly: false, maxTargets: 1, maxTargetsByBlock: false, hitAllBlocked: false,
    allInRange: false, rangeAoe: false, hits: 1, hitsFn: null, chain: null, splashRadius: 0, heal: null,
    onHit: null, onEachHit: null, install: null, requiresAcceptedLaunch: true, attackVisual: 'none',
    launchAttack: (_b, _u, _p, target, info) => controller.release(target, info) };
  return { record, controller, kit: { trait, talents: [], install: null,
    skill: { kind: 'instant', trigger: { rule: 'NEVER' }, canActivate: () => false } } };
}
