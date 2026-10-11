// SPDX-License-Identifier: GPL-3.0-or-later
// Source-selected diagnostic; public enablement requires complete skills/art review.
import evidence from '../../../data/arkpedia-ling-prefabs.json' with { type: 'json' };
import { sourceCandidate, summonCardId } from '../../../shared/arkpedia/summons.js';
import { canDeployInViewport } from '../../../shared/arkpedia/squad.js';
import { normalizeChess, flattenBlackboard } from '../simdata.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { makeDamageInfo } from '../damage.js';

export const LING_ID = 'char_2023_ling';
export const LING_CORE_CONTRACT = Object.freeze({
  scope: 'Source-selected owner and three ordinary dragon attack/deck variants, summon departure talent',
  mapping: 'Independent owner/token keyframes, selected promotion/potential/trust, additive token stock/deploy limits; native terrain/facing/DP/cooldown/slot rules, capped Born/Attack clocks and current ATK at projectile arrival. Departed dragons grant one delayed SP award and stacking owner ATK.',
  limits: 'Three active skills, S3 fusion, native artwork/VFX and public selection remain held. Compiled animation, selector, withdrawal/death trigger and SP dispatch are bounded local mappings, not certified Unity frame parity. Modules are unsupported.',
  frameParity: false,
});
const ID = LING_ID, flat = flattenBlackboard;
const tokens = [1, 2, 3].map(n => `token_10020_ling_soul${n}`);
const skillIds = [1, 2, 3].map(n => `skchr_ling_${n}`);
const present = u => u?.alive && u.deployed && !u._removing;
const live = u => present(u) && !u.hidden;
const due = (b, time) => b.time + 1e-9 >= time;
const same = (a, z) => JSON.stringify(a) === JSON.stringify(z);
const grid = id => id ? evidence.tables.ranges[id].grids.map(g => [g.row, g.col]) : [];
const character = evidence.tables.character;
const tags = [...new Set([character, character.mainPower, ...(character.subPower ?? [])].filter(Boolean)
  .flatMap(p => ['nationId', 'groupId', 'teamId'].map(k => p[k])).filter(v => typeof v === 'string' && v))];
const components = ['characters', 'tokens', 'skills', 'projectiles'].flatMap(g =>
  Object.values(evidence[g]).flat().flatMap(row => row.components));
export const lingSourceComponent = id => components.find(c => c.pathId === id)?.data;
const interpolate = (frames, level) => {
  const lo = frames[0], hi = frames.at(-1), t = hi.level === lo.level ? 0 : (level - lo.level) / (hi.level - lo.level);
  return Object.fromEntries(Object.entries(lo.data).filter(([, v]) => typeof v === 'number')
    .map(([k, v]) => [k, v + (hi.data[k] - v) * t]));
};

export function selectedLingBuild(build) {
  const c = character;
  if (!build || !Number.isInteger(build.elite) || !c.phases[build.elite]
    || !Number.isInteger(build.level) || build.level < 1 || build.level > c.phases[build.elite].maxLevel
    || !Number.isInteger(build.potential) || build.potential < 1 || build.potential > 6
    || !Number.isInteger(build.trust ?? 0) || (build.trust ?? 0) < 0 || (build.trust ?? 0) > 200
    || !Number.isInteger(build.skillRank) || build.skillRank < 1 || build.skillRank > [4, 7, 10][build.elite]
    || build.module && build.module !== 'none') throw Error('Invalid Ling source build');
  const index = skillIds.indexOf(build.skillId);
  if (index < 0 || index > build.elite) throw Error('Locked Ling source skill');
  const phase = c.phases[build.elite], source = evidence.tables.skills[build.skillId].levels[build.skillRank - 1];
  const stats = interpolate(phase.attributesKeyFrames, build.level);
  const favor = interpolate(c.favorKeyFrames, Math.min(100, build.trust ?? 0) / 2);
  for (const key of ['maxHp', 'atk', 'def']) stats[key] = Math.round(stats[key] + favor[key]);
  const attrs = { COST: 'cost', ATK: 'atk', RESPAWN_TIME: 'respawnTime' };
  for (const p of c.potentialRanks.slice(0, build.potential - 1)) for (const m of p.buff?.attributes.attributeModifiers ?? []) {
    if (!attrs[m.attributeType] || m.formulaItem !== 'ADDITION') throw Error('Unreviewed Ling potential');
    stats[attrs[m.attributeType]] += m.value;
  }
  const talents = c.talents.map(t => sourceCandidate(t.candidates, build)).filter(Boolean);
  const tokenId = tokens[index], tokenSource = evidence.tables.tokens[tokenId], tokenPhase = tokenSource.phases[build.elite];
  const tokenStats = interpolate(tokenPhase.attributesKeyFrames, build.level);
  for (const key of ['maxHp', 'atk', 'def']) tokenStats[key] = Math.round(tokenStats[key]);
  const tokenTalents = tokenSource.talents.map(t => sourceCandidate(t.candidates, build)).filter(Boolean);
  const stock = flat(tokenTalents.find(t => t.prefabKey === '1')?.blackboard);
  tokenStats.maxDeployCount += stock.max_deploy_count ?? 0;
  tokenStats.maxDeckStackCnt += stock.max_deck_stack_cnt ?? 0;
  const tokenSkill = evidence.tables.tokenSkills[`sktok_ling_soul${index + 1}`].levels[build.skillRank - 1];
  return { build: { ...build }, index, source, bb: flat(source.blackboard), stats, talents,
    tags: [...tags], rangeGrid: grid(phase.rangeId), departure: flat(talents.find(t => t.prefabKey === '2')?.blackboard),
    token: { id: tokenId, name: tokenSource.name, position: tokenSource.position, stats: tokenStats,
      rangeGrid: grid(tokenPhase.rangeId), talents: tokenTalents,
      skill: { ...tokenSkill, ...tokenSkill.spData, skillId: tokenSkill.prefabId, trigger: { rule: 'NEVER' } } } };
}

function validate(u, contract) {
  if (contract !== LING_CORE_CONTRACT) throw Error('Ling requires the reviewed core contract');
  if (u.def.charId !== ID || u.deploySeq !== 0 || u.mem.lingController) throw Error('Ling requires a fresh original owner');
  const build = { ...u.def.raw.arkpedia, skillId: u.def.skill?.id }, r = selectedLingBuild(build), s = u.def.skill;
  if (u.def.raw.arkpedia.skillId != null && u.def.raw.arkpedia.skillId !== build.skillId
    || s.skillType !== r.source.skillType || s.durationType !== r.source.durationType || s.spType !== 'time'
    || s.spCost !== r.source.spData.spCost || s.initSp !== r.source.spData.initSp
    || s.maxCharges !== r.source.spData.maxChargeTime || s.duration !== r.source.duration
    || !same(s.bb, r.bb) || !same(s.rangeGrid ?? [], grid(r.source.rangeId))
    || !same(u.rangeGrid, r.rangeGrid) || !same(u.def.tags, tags)
    || !same(u.def.stats, normalizeChess({ stats: r.stats }).stats)
    || !same(u.def.talents.map(t => t.bb), r.talents.map(t => flat(t.blackboard))))
    throw Error('Incomplete Ling selected source');
  for (const id of ['-9029399359386129407', '-902628336768059904', '-514317278218306621', '3623709448654591676']) {
    const a = lingSourceComponent(id);
    if (a._waitForAttackEvent !== 1 || (a._projectileKey && a._useCachedAtkOnly !== 0) || a._maxAnimScale !== 1)
      throw Error('Unreviewed Ling attack clock');
  }
  if (r.token.stats.maxDeployCount !== 3 || r.token.stats.maxDeckStackCnt !== [3, 4, 5][build.elite])
    throw Error('Unreviewed Ling stock');
  return r;
}

class LingAttack {
  constructor(core, unit, index = -1) {
    this.core = core; this.b = core.b; this.u = unit; this.index = index;
    this.seq = null; this.phase = null; this.accepting = false;
  }
  valid() { return !this.core.stopped && !this.b.finished && live(this.u) && this.u.deploySeq === this.seq; }
  model() { return this.index < 0 ? evidence.models[ID][['UP', 'LEFT'].includes(this.u.dir) ? 'Back' : 'Front']
    : evidence.tokenModels[this.u.defId]; }
  visual(clip, speed = 1, loop = false) {
    if (this.index < 0) this.u.mem.regularVisualDirection = ['UP', 'LEFT'].includes(this.u.dir) ? 'UP' : 'RIGHT';
    const die = this.higher() ? 'Die_02' : 'Die';
    this.u.mem.regularFormVisual = { clip, speed, loop, die, idle: this.idle() };
    // Keep the final native form after its controller/token state is removed.
    this.u.mem.regularDeathVisual = { clip: die, die, duration: this.model().durations[die] };
  }
  born() {
    this.seq = this.u.deploySeq;
    this.phase = { kind: 'born', readyAt: this.b.time + this.model().durations.Start };
    this.visual('Start');
  }
  higher() { return !!this.core.skills?.tokens.get(this.u)?.higher; }
  clip() { return this.index < 0 && this.core.record.index === 2 && this.core.skills?.active
    ? 'Skill_03_Loop' : this.higher() ? 'Attack_02' : 'Attack'; }
  idle() { return this.index < 0 && this.core.record.index === 2 && this.core.skills?.active
    ? 'Skill_03_Idle' : this.higher() ? 'Idle_02' : 'Idle'; }
  resetMode() { this.phase = null; this.u.atkCd = 0; this.visual(this.idle(), 1, true); }
  cast({ scale, bind }) {
    if (!this.valid()) return;
    const { b, u } = this, clip = this.index < 0 ? 'Skill_02' : 'Skill';
    const targets = this.targets(2);
    this.phase = { kind: 'skill', targets: new Map(targets.map(t => [t, t.deploySeq])), epoch: u.attackControlEpoch,
      releaseAt: b.time + this.model().eventPayloads[clip].find(e => e.name === 'OnAttack').time,
      readyAt: b.time + (this.index < 0 ? 1.2000000476837158 : this.model().durations[clip]),
      released: false, scale, bind };
    u.atkCd = u.s.interval;
    this.visual(clip);
  }
  eligible(t) { return live(t) && canTargetEnemy(this.u, t, { canHitFly: this.index < 0 || this.index === 1 })
    && (!t.s.flags.camou || !!t.blockedBy); }
  targets(limit = this.index === 2 ? Math.max(0, Math.floor(this.u.s.blockCnt)) : 1) {
    const u = this.u, keys = u.rangeKeySet ?? new Set(absoluteRangeKeys(u.rangeGrid, u.tileR, u.tileC, u.dir, u.s.rangeExtend));
    const out = this.b.enemies.filter(t => this.eligible(t) && (bodyInKeys(t, keys) || t.blockedBy === u));
    sortEnemyTargets(this.b, u, out);
    return out.slice(0, limit);
  }
  skillHit(t, p) {
    const { b, u, index } = this, seq = t.deploySeq;
    if (!this.valid() || !u.canAct || u.s.flags.disarm || p.epoch !== u.attackControlEpoch || !this.eligible(t)) return;
    const projectile = b.addProjectile({ from: u, target: t, source: u, speed: 10, maxAge: 10, visual: 'bolt',
      data: { arkpediaTrackedVisual: true, lingCore: this.core,
        sourceKey: index < 0 ? 'projectile_chr_ling_s2' : 'projectile_chr_ling_soul2_2' },
      onHit: ({ target }) => {
        if (b.finished || target !== t || t.deploySeq !== seq || !this.eligible(t)) return;
        b.dealDamage(u, t, makeDamageInfo({ amount: u.s.atk * u.s.atkScaleMul * p.scale,
          type: 'arts', isAttack: true, isSkill: true, isSplash: false, applyWay: 'ranged', tags: ['ling:s2'] }));
        if (live(t)) b.applyStatus(t, 'bind', { source: u, duration: p.bind });
      } });
    b.emit('lingProjectileBirth', { owner: this.core.u, unit: u, target: t, projectile, skill: true });
  }
  release(t, info) {
    const { b, u, index, phase: p } = this;
    if (!this.accepting || !this.valid() || !u.canAct || u.s.flags.disarm || p?.kind !== 'attack'
      || p.accepted.has(t) || !p.targets.has(t) || p.targets.get(t) !== t.deploySeq || p.epoch !== u.attackControlEpoch
      || !this.eligible(t) || !due(b, p.releaseAt)) return false;
    p.accepted.add(t);
    const seq = t.deploySeq, ranged = index < 0 || index === 1;
    const type = ranged || this.higher() || index === 0 && this.core.skills?.active ? 'arts' : 'phys';
    const damage = () => b.dealDamage(u, t, makeDamageInfo({ amount: u.s.atk * u.s.atkScaleMul,
      type, isAttack: true, isSkill: !!info.isSkill, isSplash: false, applyWay: ranged ? 'ranged' : 'melee',
      attackId: info.attackId ?? 0, tags: [`ling:${index < 0 ? 'owner' : `dragon${index + 1}`}:ordinary`] }));
    if (!ranged) { damage(); return true; }
    const projectile = b.addProjectile({ from: u, target: t, source: u, speed: 10, maxAge: 10, visual: 'bolt',
      data: { arkpediaTrackedVisual: true, lingCore: this.core,
        sourceKey: index < 0 ? this.core.record.index === 2 && this.core.skills?.active
          ? 'projectile_chr_ling_s3' : 'projectile_chr_ling' : 'projectile_chr_ling_soul2' },
      onHit: ({ target }) => { if (!b.finished && target === t && t.deploySeq === seq && this.eligible(t)) damage(); } });
    b.emit('lingProjectileBirth', { owner: this.core.u, unit: u, target: t, projectile });
    return true;
  }
  tick() {
    const { b, u } = this;
    if (!this.valid()) { this.phase = null; return; }
    let p = this.phase;
    if (p?.kind === 'born') { if (!due(b, p.readyAt)) return; this.phase = null; p = null; }
    if (!u.canAct || u.s.flags.disarm || p && p.epoch !== u.attackControlEpoch) {
      this.phase = null; this.visual(this.idle(), 1, true); return;
    }
    if (p) {
      if (!p.released && due(b, p.releaseAt)) {
        p.released = true;
        const targets = [...p.targets].filter(([t, seq]) => this.eligible(t) && t.deploySeq === seq).map(([t]) => t);
        if (p.kind === 'skill') for (const t of targets) this.skillHit(t, p);
        else {
          this.accepting = true;
          try { b.forceAttack(u, targets); } finally { this.accepting = false; }
        }
      }
      if (!this.valid() || this.phase !== p || !due(b, p.readyAt)) return;
      this.phase = null;
    }
    if (this.core.record.index === 1 && this.core.skills?.casting) { this.visual(this.idle(), 1, true); return; }
    if (u.atkCd > 1e-9) return;
    const targets = this.targets();
    if (!targets.length) { this.visual(this.idle(), 1, true); return; }
    const m = this.model(), clip = this.clip();
    const baseline = u.base.bat + (this.higher() ? this.core.skills.tokenBB['2.base_attack_time'] : 0);
    const speed = Math.min(1, baseline / u.s.interval);
    if (this.index >= 0) u.mem.regularVisualDirection = targets[0].x < u.x ? 'LEFT' : 'RIGHT';
    this.phase = { kind: 'attack', targets: new Map(targets.map(t => [t, t.deploySeq])), epoch: u.attackControlEpoch,
      releaseAt: b.time + m.eventPayloads[clip].find(e => e.name === 'OnAttack').time / speed,
      readyAt: b.time + Math.max(u.s.interval, m.durations[clip] / speed), released: false, accepted: new Set() };
    this.visual(clip, speed); u.atkCd = u.s.interval;
  }
  stop() { this.phase = null; this.u.mem.regularFormVisual = null; delete this.u.mem.regularVisualDirection; }
}

export class LingDragonDeck {
  constructor(core) {
    this.core = core; this.b = core.b; this.u = core.u; this.record = core.record.token;
    this.stock = 0; this.readyAt = Infinity; this.attacks = new Map();
    this.state = { key: summonCardId(ID), ownerId: ID, owner: this.u, tokenId: this.record.id,
      record: this.record, deck: this, config: Object.freeze({ deploymentSlotCost: 1, chooseFacing: true,
        noAttack: false, healFree: true, refundRatio: .5 }), unit: null,
      get stock() { return core.deck.stock; }, get readyAt() { return core.deck.readyAt; } };
  }
  own() { return [...this.attacks.keys()].filter(present); }
  born() { this.stock = this.record.stats.maxDeckStackCnt; this.readyAt = this.b.time; }
  placementError(row, col) {
    const { b, core } = this;
    if (!canDeployInViewport(b.viewport)) return 'Open the fullscreen workspace to deploy.';
    if (b.finished) return 'Battle has ended.';
    if (!core.valid() || this.u.hidden) return 'Deploy Ling first.';
    if (this.stock <= 0) return 'No dragons remaining.';
    if (!due(b, this.readyAt)) return 'Dragon is still redeploying.';
    if (this.own().length >= this.record.stats.maxDeployCount) return 'Dragon deployment limit reached.';
    if (b.deployedSlots() + 1 > b.unitLimit) return 'Deployment limit reached.';
    if (!Number.isInteger(row) || !Number.isInteger(col) || !b.grid.inRect(row, col)) return 'Select a tile on the map.';
    const position = this.record.position, build = b.grid.tile(row, col).build;
    if (build !== 'ALL' && build !== position) return position === 'MELEE' ? 'Choose a melee tile.' : 'Choose a high-ground tile.';
    if (b.allyUnits.some(t => present(t) && t.tileR === row && t.tileC === col)) return 'Tile is occupied.';
    if (b.tileReservation(row, col)) return 'Tile is reserved for an operator return.';
    if (b.dp < this.record.stats.cost) return 'Not enough DP.';
    return null;
  }
  place(row, col, dir = 'RIGHT') {
    const error = this.placementError(row, col); if (error) throw Error(error);
    if (!['UP', 'DOWN', 'LEFT', 'RIGHT'].includes(dir)) throw Error('Choose a facing direction.');
    const { core, b } = this;
    let attack;
    const t = b.spawnToken(this.u, this.record.id, row, col, { def: this.record, dir,
      kit: { skill: { kind: 'passive' }, talents: [], trait: core.trait(() => attack, core.record.index), install: (_b, unit) => {
        unit.deploymentSlotCost = 1; unit.mem.regularSummonCard = summonCardId(ID);
        attack = new LingAttack(core, unit, core.record.index);
        b.addBuff(unit, { key: 'ling:heal-free', source: this.u, persist: true, allowDead: true, flags: { healFree: true } });
        b.on('deploy', ({ unit: deployed }) => { if (deployed === unit) attack.born(); }, { owner: unit });
      } } });
    if (!t) throw Error('Dragon placement failed.');
    if (!core.valid() || !present(t)) {
      if (present(t)) b.retreat(t, { permanent: true, reason: 'ling-owner-removed' });
      throw Error('Dragon owner became unavailable.');
    }
    this.attacks.set(t, attack); this.stock--;
    this.u.player.dp -= this.record.stats.cost;
    this.readyAt = b.time + this.record.stats.respawnTime;
    core.skills?.placed(t);
    return t;
  }
  removed(t) {
    const attack = this.attacks.get(t); if (!attack) return;
    attack.stop(); this.attacks.delete(t);
    this.core.skills?.removed(t);
    if (this.core.valid()) this.core.departed(t);
  }
  tick() { for (const attack of this.attacks.values()) attack.tick(); }
  stop() {
    this.stock = 0; this.readyAt = Infinity;
    for (const t of this.own()) this.b.retreat(t, { permanent: true, reason: 'ling-owner-removed' });
    for (const attack of this.attacks.values()) attack.stop();
    this.attacks.clear();
  }
}

export class LingCoreController {
  constructor(b, u, record) {
    this.b = b; this.u = u; this.record = record; this.seq = null; this.stopped = false; this.handles = [];
    this.attack = new LingAttack(this, u); this.deck = new LingDragonDeck(this); this.departures = 0;
    this.spAwards = new Set();
  }
  valid() { return !this.stopped && !this.b.finished && present(this.u) && this.seq === this.u.deploySeq; }
  trait(getAttack, index = -1) {
    const ranged = index < 0 || index === 1;
    return { noAttack: true, attackDrivenSkill: true, attack: ranged ? 'ranged' : 'melee', projectile: 'none',
      dmgType: ranged ? 'arts' : 'phys', canHitFly: ranged, maxTargets: index === 2 ? 4 : 1, hits: 1, hitsFn: null,
      chain: null, splashRadius: 0, heal: null, onHit: null, onEachHit: null, install: null,
      requiresAcceptedLaunch: true, attackVisual: 'none',
      launchAttack: (_b, _u, _p, t, info) => getAttack()?.release(t, info) ?? false };
  }
  departed(t) {
    const bb = this.record.departure;
    if (!bb.max_stack_cnt) return;
    this.departures = Math.min(bb.max_stack_cnt, this.departures + 1);
    this.b.removeBuff(this.u, 'ling:departures');
    this.b.addBuff(this.u, { key: 'ling:departures', source: this.u, mods: { atkPct: bb.atk * this.departures } });
    const seq = this.seq;
    // Original modify_sp[trigger]: delayed once, does not force recovery during a skill.
    const award = this.b.after(.10000000149011612, () => {
      this.spAwards.delete(award);
      if (this.valid() && this.seq === seq) this.u.skill.gainSp(bb.sp, 'ling-token-departure');
    }, { owner: this.u });
    this.spAwards.add(award);
    this.b.emit('lingDragonDeparture', { owner: this.u, unit: t, stacks: this.departures });
  }
  install() {
    const { b, u } = this;
    if (!b.regularSummons) b.regularSummons = new Map();
    b.regularSummons.set(summonCardId(ID), this.deck.state);
    this.handles = [b.on('deploy', ({ unit, move }) => {
      if (unit === u && !move) { this.seq = u.deploySeq; this.attack.born(); this.deck.born(); }
    }, { owner: u }), b.on('tick', () => {
      if (this.stopped || b.finished || this.seq !== null && !this.valid()) { this.stop(); return; }
      this.skills?.tick(); this.attack.tick(); this.deck.tick();
    }, { owner: u }), b.on('death', ({ unit }) => {
      if (unit === u) this.stop(); else this.deck.removed(unit);
    }, { owner: u }), b.on('battleEnd', () => this.stop())];
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.skills?.stop(); this.attack.stop(); this.deck.stop(); this.b.removeBuff(this.u, 'ling:departures');
    for (const award of this.spAwards) award.cancel(); this.spAwards.clear();
    if (this.b.finished) this.b.projectiles.remove(p => p.data?.lingCore === this);
    for (const h of this.handles) this.b.off(h); this.handles = [];
  }
}

export function prepareLingCore(b, u, { contract } = {}) {
  const record = validate(u, contract), controller = new LingCoreController(b, u, record);
  u.mem.lingController = controller;
  return { record, controller, kit: { trait: controller.trait(() => controller.attack), talents: [], install: null,
    skill: { kind: 'instant', trigger: { rule: 'NEVER' }, canActivate: () => false } } };
}
