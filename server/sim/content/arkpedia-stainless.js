// SPDX-License-Identifier: GPL-3.0-or-later
// Selected owner diagnostic; active skills, device runtime and public approval remain separate.
import evidence from '../../../data/arkpedia-stainless-prefabs.json' with { type: 'json' };
import { sourceCandidate } from '../../../shared/arkpedia/summons.js';
import { normalizeChess, normSpType, flattenBlackboard as flat } from '../simdata.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { makeDamageInfo } from '../damage.js';

export const STAINLESS_ID = 'char_4072_ironmn';
export const STAINLESS_CORE_CONTRACT = Object.freeze({
  scope: 'Strict selected owner/device source builds and ordinary owner Physical attack diagnostic',
  mapping: 'One retained ground input or explicitly self-blocked flying input; original Front/Back hit event with native visual-speed cap, current ATK at release and owner-controlled interruption/retirement cleanup. Device stats, skill ranks, slot/build/side rules and deck-capacity records remain separate from owner talent recharge count.',
  limits: 'Active skills and all three device runtimes remain held. Compiled capacity loading, target policy, modifier/SP/FSM ordering, callback and Unity frame parity are not certified. Modules and native shaders/particles/audio remain unsupported; public and device-art approvals remain separate.',
  frameParity: false,
});
const ID = STAINLESS_ID, c = evidence.tables.character;
const skills = [1, 2, 3].map(n => `skchr_ironmn_${n}`);
const tokens = [1, 2, 3].map(n => `token_10027_ironmn_pile${n}`);
const present = u => u?.alive && u.deployed && !u._removing;
const live = u => present(u) && !u.hidden;
const due = (b, t) => b.time + 1e-9 >= t;
const same = (a, z) => JSON.stringify(a) === JSON.stringify(z);
const grid = id => id ? evidence.tables.ranges[id].grids.map(g => [g.row, g.col]) : [];
const tags = [...new Set([c, c.mainPower, ...(c.subPower ?? [])].filter(Boolean)
  .flatMap(p => ['nationId', 'groupId', 'teamId'].map(k => p[k])).filter(v => typeof v === 'string' && v))];
const components = ['characters', 'tokens', 'skills', 'projectiles'].flatMap(group =>
  Object.values(evidence[group]).flat().flatMap(r => r.components));
export const stainlessSourceComponent = id => components.find(v => v.pathId === id)?.data;
const interpolate = (frames, level) => {
  const lo = frames[0], hi = frames.at(-1), t = hi.level === lo.level ? 0 : (level - lo.level) / (hi.level - lo.level);
  return Object.fromEntries(Object.entries(lo.data).filter(([, v]) => typeof v === 'number')
    .map(([k, v]) => [k, v + (hi.data[k] - v) * t]));
};

export function selectedStainlessBuild(build) {
  if (!build || !Number.isInteger(build.elite) || !c.phases[build.elite]
    || !Number.isInteger(build.level) || build.level < 1 || build.level > c.phases[build.elite].maxLevel
    || !Number.isInteger(build.potential) || build.potential < 1 || build.potential > 6
    || !Number.isInteger(build.trust ?? 0) || (build.trust ?? 0) < 0 || (build.trust ?? 0) > 200
    || !Number.isInteger(build.skillRank) || build.skillRank < 1 || build.skillRank > [4, 7, 10][build.elite]
    || build.module && build.module !== 'none') throw Error('Invalid Stainless source build');
  const index = skills.indexOf(build.skillId);
  if (index < 0 || index > build.elite) throw Error('Locked Stainless source skill');
  const phase = c.phases[build.elite], source = evidence.tables.skills[build.skillId].levels[build.skillRank - 1];
  const stats = interpolate(phase.attributesKeyFrames, build.level);
  const favor = interpolate(c.favorKeyFrames, Math.min(100, build.trust ?? 0) / 2);
  for (const key of ['maxHp', 'atk', 'def']) stats[key] = Math.round(stats[key] + favor[key]);
  const attrs = { COST: 'cost', ATK: 'atk', RESPAWN_TIME: 'respawnTime' };
  for (const p of c.potentialRanks.slice(0, build.potential - 1)) for (const m of p.buff?.attributes.attributeModifiers ?? []) {
    if (!attrs[m.attributeType] || m.formulaItem !== 'ADDITION') throw Error('Unreviewed Stainless potential');
    stats[attrs[m.attributeType]] += m.value;
  }
  const talents = c.talents.map(t => sourceCandidate(t.candidates, build)).filter(Boolean);
  const tokenId = tokens[index], tc = evidence.tables.tokens[tokenId], tp = tc.phases[build.elite];
  const tokenStats = interpolate(tp.attributesKeyFrames, build.level);
  for (const key of ['maxHp', 'atk', 'def']) tokenStats[key] = Math.round(tokenStats[key]);
  const tokenTalents = tc.talents.map(t => sourceCandidate(t.candidates, build)).filter(Boolean);
  const capacity = flat(tokenTalents.find(t => t.prefabKey === '1')?.blackboard);
  // Preserve the literal additive attribute records; owner recharge count is
  // not a substitute for the separately selected device deck capacity.
  tokenStats.maxDeployCount += capacity.max_deploy_count ?? 0;
  tokenStats.maxDeckStackCnt += capacity.max_deck_stack_cnt ?? 0;
  const tokenSkill = evidence.tables.tokenSkills[`sktok_ironmn_pile${index + 1}`].levels[build.skillRank - 1];
  const ctrl = components.find(v => v.data._modes && v.data._animator?.m_PathID !== '0'
    && v.data.m_GameObject.m_PathID === evidence.tokens[tokenId].find(r => r.object === tokenId).pathId).data;
  const token = { id: tokenId, name: tc.name, position: tc.position, stats: tokenStats,
    profession: tc.profession, subProfessionId: tc.subProfessionId, arkpedia: { ...build },
    rangeGrid: grid(tp.rangeId), talents: tokenTalents, source: tc,
    skill: { ...tokenSkill, ...tokenSkill.spData, skillId: tokenSkill.prefabId,
      rangeGrid: grid(tokenSkill.rangeId), trigger: { rule: 'NEVER' } },
    native: { side: ctrl._sideType, category: ctrl._category,
      deploymentSlotCost: ctrl._occupiedRemainingCharacterCnt,
      buildableType: ctrl._buildCondition.buildableType,
      chooseFacing: ctrl._buildCondition.needSpecifyDirection === 1 },
    models: evidence.tokenModels[tokenId] };
  return { build: { ...build }, index, source, bb: flat(source.blackboard), stats,
    talents, tags: [...tags], rangeGrid: grid(phase.rangeId), token,
    recharge: flat(talents.find(t => t.prefabKey === '1')?.blackboard),
    recycle: flat(talents.find(t => t.prefabKey === '2')?.blackboard) };
}

function validate(u, contract) {
  if (contract !== STAINLESS_CORE_CONTRACT) throw Error('Stainless requires the reviewed core contract');
  if (u.def.charId !== ID || u.deploySeq !== 0 || u.mem.stainlessController)
    throw Error('Stainless requires a fresh original owner');
  const build = { ...u.def.raw.arkpedia, skillId: u.def.skill?.id }, r = selectedStainlessBuild(build), s = u.def.skill;
  if (u.def.raw.arkpedia.skillId != null && u.def.raw.arkpedia.skillId !== build.skillId
    || s.skillType !== r.source.skillType || s.durationType !== r.source.durationType
    || s.spType !== normSpType(r.source.spData.spType)
    || s.spCost !== r.source.spData.spCost || s.initSp !== r.source.spData.initSp
    || s.maxCharges !== r.source.spData.maxChargeTime || s.duration !== r.source.duration
    || !same(s.bb, r.bb) || !same(s.rangeGrid ?? [], grid(r.source.rangeId))
    || !same(u.rangeGrid, r.rangeGrid) || !same(u.def.tags, tags)
    || !same(u.def.stats, normalizeChess({ stats: r.stats }).stats)
    || !same(u.def.talents.map(t => t.bb), r.talents.map(t => flat(t.blackboard))))
    throw Error('Incomplete Stainless selected source');
  const attack = stainlessSourceComponent('-6565916055745470053');
  if (attack._waitForAttackEvent !== 1 || attack._animKey !== 'Attack'
    || attack._damageType !== 1 || attack._maxAnimScale !== 1
    || r.token.native.deploymentSlotCost !== 0
    || r.token.stats.maxDeployCount !== [1, 2, 2][build.elite]
    || r.token.stats.maxDeckStackCnt !== [2, 2, 3][build.elite])
    throw Error('Unreviewed Stainless native core');
  return r;
}

export class StainlessCoreController {
  constructor(b, u, record) {
    this.b = b; this.u = u; this.record = record; this.seq = null;
    this.stopped = false; this.handles = []; this.phase = null; this.accepting = false;
  }
  valid() { return !this.stopped && !this.b.finished && present(this.u) && this.seq === this.u.deploySeq; }
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
    const { b, u, phase: p } = this;
    if (p?.kind === 'ironmn:active') return this.skills?.release(t, info) ?? false;
    if (!this.accepting || !this.valid() || !live(u) || !u.canAct || u.s.flags.disarm
      || p?.kind !== 'attack' || p.epoch !== u.attackControlEpoch || p.accepted
      || p.target !== t || p.targetSeq !== t.deploySeq || !live(t)
      || !due(b, p.releaseAt) || !canTargetEnemy(u, t, { canHitFly: t.blockedBy === u })) return false;
    p.accepted = true;
    b.dealDamage(u, t, makeDamageInfo({ amount: u.s.atk * u.s.atkScaleMul,
      type: 'phys', isAttack: true, isSkill: false, isSplash: false,
      applyWay: 'melee', attackId: info.attackId ?? 0, tags: ['ironmn:ordinary'] }));
    return true;
  }
  tickAttack() {
    if (this.skills?.active) { this.skills.tickAttack(); return; }
    const { b, u } = this;
    if (!this.valid()) { this.phase = null; return; }
    let p = this.phase;
    if (p?.kind === 'born') { if (!due(b, p.readyAt)) return; this.phase = null; p = null; }
    if (!live(u) || !u.canAct || u.s.flags.disarm || p && p.epoch !== u.attackControlEpoch) {
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
    const speed = Math.min(1, u.base.bat / u.s.interval), m = this.model(), clip = 'Attack';
    this.phase = { kind: 'attack', startedAt: b.time, target, targetSeq: target.deploySeq, epoch: u.attackControlEpoch,
      accepted: false, released: false,
      releaseAt: b.time + m.eventPayloads[clip].find(v => v.name === 'OnAttack').time / speed,
      readyAt: b.time + Math.max(u.s.interval, m.durations[clip] / speed) };
    this.visual(clip, speed); u.atkCd = u.s.interval;
  }
  install() {
    const { b, u } = this;
    this.devices?.install();
    this.handles = [b.on('deploy', ({ unit, move }) => {
      if (unit === u && !move) {
        this.seq = u.deploySeq;
        this.phase = { kind: 'born', readyAt: b.time + this.model().durations.Start };
        this.visual('Start');
        this.devices?.born();
      }
    }, { owner: u }), b.on('tick', () => {
      if (this.stopped || b.finished || this.seq !== null && !this.valid()) { this.stop(); return; }
      this.tickAttack();
      this.devices?.tick();
    }, { owner: u }), b.on('death', ({ unit }) => {
      if (unit === u) this.stop(); else this.devices?.removed(unit);
    }, { owner: u }),
    b.on('battleEnd', () => this.stop())];
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.phase = null; this.accepting = false;
    this.skills?.stop();
    this.devices?.stop();
    this.u.mem.regularFormVisual = null; delete this.u.mem.regularVisualDirection;
    for (const h of this.handles) this.b.off(h); this.handles = [];
  }
}

export function prepareStainlessCore(b, u, { contract } = {}) {
  const record = validate(u, contract), controller = new StainlessCoreController(b, u, record);
  u.mem.stainlessController = controller;
  const trait = { noAttack: true, attackDrivenSkill: true, attack: 'melee', projectile: 'none', dmgType: 'phys',
    canHitFly: false, maxTargets: 1, maxTargetsByBlock: false, hitAllBlocked: false,
    allInRange: false, rangeAoe: false, hits: 1, hitsFn: null, chain: null, splashRadius: 0, heal: null,
    onHit: null, onEachHit: null, install: null, requiresAcceptedLaunch: true, attackVisual: 'none',
    launchAttack: (_b, _u, _p, target, info) => controller.release(target, info) };
  return { record, controller, kit: { trait, talents: [], install: null,
    skill: { kind: 'instant', trigger: { rule: 'NEVER' }, canActivate: () => false } } };
}
