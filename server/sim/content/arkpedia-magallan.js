// SPDX-License-Identifier: GPL-3.0-or-later
import { canSpendDp } from './arkpedia-dp-budget.js';
// Selected-source diagnostic. Complete skills/art/public approval stay separate.
import evidence from '../../../data/arkpedia-magallan-prefabs.json' with { type: 'json' };
import { sourceCandidate, summonCardId } from '../../../shared/arkpedia/summons.js';
import { canDeployInViewport } from '../../../shared/arkpedia/squad.js';
import { normalizeChess, flattenBlackboard } from '../simdata.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys, bodyInRadius } from '../body.js';
import { makeDamageInfo } from '../damage.js';

export const MAGALLAN_ID = 'char_248_mgllan';
export const MAGALLAN_CORE_CONTRACT = Object.freeze({
  scope: 'Selected-source ordinary owner/drone attacks, three drone decks, invisibility and stock/recycle lifecycle; owner skills and public enablement remain held',
  mapping: 'Owner/drone stats from independent selected-source keyframes; additive token stock/deployment talent; source terrain/facing/DP/slot rules. Deployment starts the card cooldown; surviving recycled drones return one card each and refresh the cooldown on finish, without DP refund. Original Born and Attack clips, capped owner/combat-drone visual clocks, uncapped mining clock, current ATK at arrival; combat-drone collision only when target reached. Native INVISIBLE maps to stealth and flag7 to healFree.',
  limits: 'Compiled deck/recharge/selector/collision/FaceSwitcher callbacks and frame clocks are not certified; S1 pulses and all active skill modes, modules, native textures/shaders/particles/audio and public integration require separate review',
  frameParity: false,
});

const ID = MAGALLAN_ID, flat = flattenBlackboard;
const tokens = [1, 2, 3].map(n => `token_10005_mgllan_drone${n}`);
const skillIds = [1, 2, 3].map(n => `skchr_mgllan_${n}`);
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
const component = id => components.find(c => c.pathId === id)?.data;
export { component as magallanSourceComponent };
const interpolate = (frames, level) => {
  const lo = frames[0], hi = frames.at(-1), t = hi.level === lo.level ? 0 : (level - lo.level) / (hi.level - lo.level);
  return Object.fromEntries(Object.entries(lo.data).filter(([, v]) => typeof v === 'number')
    .map(([k, v]) => [k, v + (hi.data[k] - v) * t]));
};

export function selectedMagallanBuild(build) {
  const c = character;
  if (!build || !Number.isInteger(build.elite) || !c.phases[build.elite]
    || !Number.isInteger(build.level) || build.level < 1 || build.level > c.phases[build.elite].maxLevel
    || !Number.isInteger(build.potential) || build.potential < 1 || build.potential > 6
    || !Number.isInteger(build.trust ?? 0) || (build.trust ?? 0) < 0 || (build.trust ?? 0) > 200
    || !Number.isInteger(build.skillRank) || build.skillRank < 1 || build.skillRank > [4, 7, 10][build.elite]
    || build.module && build.module !== 'none') throw Error('Invalid Magallan source build');
  const index = skillIds.indexOf(build.skillId);
  if (index < 0 || index > build.elite) throw Error('Locked Magallan source skill');
  const phase = c.phases[build.elite], source = evidence.tables.skills[build.skillId].levels[build.skillRank - 1];
  const stats = interpolate(phase.attributesKeyFrames, build.level);
  const favor = interpolate(c.favorKeyFrames, Math.min(100, build.trust ?? 0) / 2);
  for (const key of ['maxHp', 'atk', 'def']) stats[key] = Math.round(stats[key] + favor[key]);
  const attrs = { COST: 'cost', ATK: 'atk', RESPAWN_TIME: 'respawnTime' };
  for (const p of c.potentialRanks.slice(0, build.potential - 1)) for (const m of p.buff?.attributes.attributeModifiers ?? []) {
    if (!attrs[m.attributeType] || m.formulaItem !== 'ADDITION') throw Error('Unreviewed Magallan potential');
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
  const tokenSkill = evidence.tables.tokenSkills[`sktok_mgllan_drone${index + 1}`].levels[build.skillRank - 1];
  const token = { id: tokenId, name: tokenSource.name, position: tokenSource.position, stats: tokenStats,
    rangeGrid: grid(tokenPhase.rangeId), talents: tokenTalents,
    skill: { ...tokenSkill, ...tokenSkill.spData, skillId: tokenSkill.prefabId, trigger: { rule: 'NEVER' } } };
  return { build: { ...build }, index, source, bb: flat(source.blackboard), stats, talents,
    tags: [...tags], rangeGrid: grid(phase.rangeId), token,
    hiddenDuration: flat(tokenTalents.find(t => t.prefabKey === '2')?.blackboard).hidden_duration ?? 0 };
}

function validate(u, contract) {
  if (contract !== MAGALLAN_CORE_CONTRACT) throw Error('Magallan requires the reviewed core contract');
  if (u.def.charId !== ID || u.deploySeq !== 0 || u.mem.magallanController) throw Error('Magallan requires a fresh original owner');
  const build = { ...u.def.raw.arkpedia, skillId: u.def.skill?.id }, r = selectedMagallanBuild(build), s = u.def.skill;
  if (u.def.raw.arkpedia.skillId != null && u.def.raw.arkpedia.skillId !== build.skillId
    || s.skillType !== r.source.skillType || s.durationType !== r.source.durationType || s.spType !== 'time'
    || s.spCost !== r.source.spData.spCost || s.initSp !== r.source.spData.initSp
    || s.maxCharges !== r.source.spData.maxChargeTime || s.duration !== r.source.duration
    || !same(s.bb, r.bb) || !same(s.rangeGrid ?? [], grid(r.source.rangeId))
    || !same(u.rangeGrid, r.rangeGrid) || !same(u.def.tags, tags)
    || !same(u.def.stats, normalizeChess({ stats: r.stats }).stats)
    || !same(u.def.talents.map(t => t.bb), r.talents.map(t => flat(t.blackboard))))
    throw Error('Incomplete Magallan selected source');
  if (component('8036716727285702695')._waitForAttackEvent !== 1
    || component('8036716727285702695')._useCachedAtkOnly !== 0
    || component('8036716727285702695')._maxAnimScale !== 1
    || component('8775737600394172606')._speed !== 10
    || component('3786224098451148986')._maxAnimScale !== -1
    || component('-5737959017697408612')._maxAnimScale !== 1
    || r.token.stats.maxDeployCount !== 3 || r.token.stats.maxDeckStackCnt !== [3, 4, 5][build.elite])
    throw Error('Unreviewed Magallan native core');
  for (const id of ['-2511385534807378945', '1424472900917737087'])
    if (component(id)._onlyCheckHitWhenReachTarget !== 1 || component(id)._onlyCheckHitWhenStop !== 0)
      throw Error('Unreviewed Magallan projectile arrival collision');
  return r;
}

class MagallanAttack {
  constructor(core, unit, index = -1) {
    this.core = core; this.b = core.b; this.u = unit; this.index = index;
    this.seq = null; this.phase = null; this.accepting = false;
  }
  valid() { return !this.core.stopped && !this.b.finished && live(this.u) && this.u.deploySeq === this.seq; }
  model() { return this.index < 0 ? evidence.models[ID][['UP', 'LEFT'].includes(this.u.dir) ? 'Back' : 'Front']
    : evidence.tokenModels[this.u.defId]; }
  visual(clip, speed = 1, loop = false) {
    if (this.index < 0) this.u.mem.regularVisualDirection = ['UP', 'LEFT'].includes(this.u.dir) ? 'UP' : 'RIGHT';
    this.u.mem.regularFormVisual = { clip, speed, loop };
  }
  born() {
    this.seq = this.u.deploySeq;
    this.phase = { kind: 'born', startedAt: this.b.time, readyAt: this.b.time + this.model().durations.Start };
    this.visual('Start');
  }
  eligible(t, splash = false) {
    return live(t) && canTargetEnemy(this.u, t, { canHitFly: true }) &&
      (splash || !t.s.flags.camou || !!t.blockedBy);
  }
  targets(area = false) {
    const u = this.u, keys = u.rangeKeySet ?? new Set(absoluteRangeKeys(u.rangeGrid, u.tileR, u.tileC, u.dir, u.s.rangeExtend));
    const out = this.b.enemies.filter(t => this.eligible(t, area) && (bodyInKeys(t, keys) || t.blockedBy === u));
    sortEnemyTargets(this.b, u, out); return out;
  }
  release(t, info) {
    const { b, u, index, phase: p } = this;
    const active = !!this.core.skills?.active, area = index === 1 && active;
    if (!this.accepting || !this.valid() || !u.canAct || u.s.flags.disarm || p?.kind !== 'attack'
      || p.accepted || p.target !== t || p.targetSeq !== t.deploySeq || p.epoch !== u.attackControlEpoch
      || !this.eligible(t, area) || !due(b, p.releaseAt)) return false;
    p.accepted = true;
    const seq = t.deploySeq, type = index === 2 ? 'phys' : 'arts';
    const tag = index < 0 ? `mgllan:${active ? 'active' : 'ordinary'}`
      : `mgllan:drone${index + 1}:${active ? 'active' : 'ordinary'}`;
    const damage = (v, splash) => b.dealDamage(u, v, makeDamageInfo({ amount: u.s.atk * u.s.atkScaleMul,
      type, isAttack: true, isSkill: active || !!info.isSkill, isSplash: splash, applyWay: 'ranged',
      attackId: info.attackId ?? 0, tags: [tag] }));
    if (area) {
      const victims = this.targets(true);
      for (const v of victims) if (this.valid()) damage(v, true);
      b.emit('magallanAreaAttack', { owner: this.core.u, unit: u, victims, attackId: info.attackId });
      return true;
    }
    const radius = active ? 1.25 : .75;
    const projectile = b.addProjectile({ from: u, target: t, source: u, speed: index < 0 ? 10 : index === 1 ? 15 : 12,
      maxAge: 10, visual: 'bolt',
      data: { arkpediaTrackedVisual: true, magallanCore: this.core, magallanKind: index < 0 ? 'owner' : `drone${index + 1}`,
        magallanActive: active, sourceKey: index < 0 ? `projectile_mgllan${active ? '_s' : ''}`
          : index === 1 ? 'projectile_mgllan2_drone_2' : `projectile_mgllan3_drone_3${active ? 'S' : ''}` },
      onHit: ({ target, x, y }) => {
        if (b.finished || target !== t || t.deploySeq !== seq || !this.eligible(t, index === 2)) return;
        // Native combat-drone collider is gated by target arrival, not flight.
        const victims = index === 2 ? b.enemies.filter(v => this.eligible(v, true)
          && (v === t || bodyInRadius(v, x, y, radius))) : [t];
        for (const v of victims) damage(v, index === 2);
      } });
    b.emit('magallanProjectileBirth', { owner: this.core.u, unit: u, target: t, projectile });
    return true;
  }
  tick() {
    const { b, u } = this;
    if (!this.valid()) { this.phase = null; return; }
    let p = this.phase;
    if (p?.kind === 'born') { if (!due(b, p.readyAt)) return; this.phase = null; p = null; }
    if (this.index === 0) { this.visual('Idle', 1, true); return; }
    if (!u.canAct || u.s.flags.disarm || p && p.epoch !== u.attackControlEpoch) {
      this.phase = null; this.visual('Idle', 1, true); return;
    }
    if (p) {
      if (!p.released && due(b, p.releaseAt)) {
        p.released = true;
        const area = this.index === 1 && this.core.skills?.active;
        if (area) { p.target = this.targets(true)[0]; p.targetSeq = p.target?.deploySeq; }
        if (this.eligible(p.target, area) && p.targetSeq === p.target.deploySeq) {
          this.accepting = true;
          try { b.forceAttack(u, [p.target]); } finally { this.accepting = false; }
        }
      }
      if (!this.valid() || this.phase !== p || !due(b, p.readyAt)) return;
      this.phase = null;
    }
    if (u.atkCd > 1e-9) return;
    const area = this.index === 1 && this.core.skills?.active, target = this.targets(area)[0];
    if (!target) { this.visual('Idle', 1, true); return; }
    const m = this.model(), speed = this.index === 1 ? u.base.bat / u.s.interval : Math.min(1, u.base.bat / u.s.interval);
    if (this.index >= 1) u.mem.regularVisualDirection = area ? 'RIGHT' : target.x < u.x ? 'LEFT' : 'RIGHT';
    this.phase = { kind: 'attack', startedAt: b.time, target, targetSeq: target.deploySeq, epoch: u.attackControlEpoch,
      releaseAt: b.time + m.eventPayloads.Attack.find(e => e.name === 'OnAttack').time / speed,
      readyAt: b.time + Math.max(u.s.interval, m.durations.Attack / speed), released: false, accepted: false };
    this.visual('Attack', speed); u.atkCd = u.s.interval;
  }
  stop() { this.phase = null; this.u.mem.regularFormVisual = null; delete this.u.mem.regularVisualDirection; }
}

export class MagallanDroneDeck {
  constructor(core) {
    this.core = core; this.b = core.b; this.u = core.u;
    this.record = core.record.token; this.stock = 0; this.readyAt = Infinity;
    this.attacks = new Map(); this.recycling = new Set();
    const index = core.record.index;
    this.state = { key: summonCardId(ID), ownerId: ID, owner: this.u, tokenId: this.record.id,
      record: this.record, deck: this, config: Object.freeze({ deploymentSlotCost: 1, chooseFacing: index === 2,
        noAttack: index === 0, healFree: true, refundRatio: .5 }), unit: null,
      get stock() { return core.deck.stock; }, get readyAt() { return core.deck.readyAt; } };
  }
  own() { return [...this.attacks.keys()].filter(present); }
  born() { this.stock = this.record.stats.maxDeckStackCnt; this.readyAt = this.b.time; }
  placementError(row, col) {
    const { b, core } = this;
    if (!canDeployInViewport(b.viewport)) return 'Open the fullscreen workspace to deploy.';
    if (b.finished) return 'Battle has ended.';
    if (!core.valid() || this.u.hidden) return 'Deploy Magallan first.';
    if (this.stock <= 0) return 'No drones remaining.';
    if (!due(b, this.readyAt)) return 'Drone is still redeploying.';
    if (this.own().length >= this.record.stats.maxDeployCount) return 'Drone deployment limit reached.';
    if (b.deployedSlots() + 1 > b.unitLimit) return 'Deployment limit reached.';
    if (!Number.isInteger(row) || !Number.isInteger(col) || !b.grid.inRect(row, col)) return 'Select a tile on the map.';
    const position = this.record.position, build = b.grid.tile(row, col).build;
    if (build !== 'ALL' && build !== position && !(position === 'ALL' && ['MELEE', 'RANGED'].includes(build)))
      return position === 'MELEE' ? 'Choose a melee tile.' : position === 'RANGED' ? 'Choose a high-ground tile.' : 'Choose a deployable tile.';
    if (b.allyUnits.some(t => present(t) && t.tileR === row && t.tileC === col)) return 'Tile is occupied.';
    if (b.tileReservation(row, col)) return 'Tile is reserved for an operator return.';
    if (!canSpendDp(b, this.u.ownerId, this.record.stats.cost)) return 'Not enough DP.';
    return null;
  }
  place(row, col, dir = 'RIGHT') {
    const error = this.placementError(row, col); if (error) throw Error(error);
    if (!['UP', 'DOWN', 'LEFT', 'RIGHT'].includes(dir)) throw Error('Choose a facing direction.');
    const { core, b } = this, index = core.record.index;
    let attack;
    const t = b.spawnToken(this.u, this.record.id, row, col, { def: this.record, dir: index === 2 ? dir : 'RIGHT',
      kit: { skill: { kind: 'passive' }, talents: [], trait: this.core.trait(() => attack, index), install: (_b, unit) => {
        unit.deploymentSlotCost = 1; unit.mem.regularSummonCard = summonCardId(ID);
        attack = new MagallanAttack(core, unit, index);
        b.addBuff(unit, { key: 'mgllan:heal-free', source: this.u, persist: true, allowDead: true, flags: { healFree: true } });
        if (index === 0) b.addBuff(unit, { key: 'mgllan:disarmed', source: this.u, persist: true, allowDead: true, flags: { disarm: true } });
        b.on('deploy', ({ unit: deployed }) => { if (deployed === unit) {
          attack.born();
          if (core.record.hiddenDuration > 0) b.addBuff(unit, { key: 'mgllan:invisible', source: this.u,
            duration: core.record.hiddenDuration, flags: { stealth: true } });
        } }, { owner: unit });
      } } });
    if (!t) throw Error('Drone placement failed.');
    // Deploy hooks can invalidate the owner. Never charge a detached deck/card.
    if (!core.valid() || !present(t)) {
      if (present(t)) b.retreat(t, { permanent: true, reason: 'mgllan-owner-removed' });
      throw Error('Drone owner became unavailable.');
    }
    this.attacks.set(t, attack); this.stock--;
    this.u.player.dp -= this.record.stats.cost;
    this.readyAt = b.time + this.record.stats.respawnTime;
    core.skills?.syncToken(t);
    return t;
  }
  recycleOwned() {
    if (!this.core.valid()) return 0;
    let count = 0;
    // Snapshot original lives: hooks cannot recycle a later placement twice.
    for (const t of this.own()) if (present(t) && t.ownerUnit === this.u) {
      this.recycling.add(t);
      this.b.retreat(t, { permanent: true, reason: 'mgllan-skill-recycle' });
      this.recycling.delete(t); count++;
    }
    return count;
  }
  removed(t) {
    const attack = this.attacks.get(t); if (!attack) return;
    attack.stop(); this.attacks.delete(t);
    if (this.recycling.has(t) && this.core.valid()) {
      this.stock = Math.min(this.record.stats.maxDeckStackCnt, this.stock + 1);
      this.readyAt = this.b.time + this.record.stats.respawnTime;
    }
  }
  tick() { for (const attack of this.attacks.values()) attack.tick(); }
  stop() {
    this.stock = 0; this.readyAt = Infinity;
    for (const t of this.own()) this.b.retreat(t, { permanent: true, reason: 'mgllan-owner-removed' });
    for (const attack of this.attacks.values()) attack.stop();
    this.attacks.clear(); this.recycling.clear();
  }
}

export class MagallanCoreController {
  constructor(b, u, record) {
    this.b = b; this.u = u; this.record = record; this.seq = null; this.stopped = false; this.handles = [];
    this.attack = new MagallanAttack(this, u); this.deck = new MagallanDroneDeck(this);
  }
  valid() { return !this.stopped && !this.b.finished && present(this.u) && this.seq === this.u.deploySeq; }
  trait(getAttack, index = -1) {
    return { noAttack: true, attackDrivenSkill: true, attack: 'ranged', projectile: 'none',
      dmgType: index === 2 ? 'phys' : 'arts', canHitFly: true, maxTargets: 1, hits: 1, hitsFn: null,
      chain: null, splashRadius: 0, heal: null, onHit: null, onEachHit: null, install: null,
      requiresAcceptedLaunch: true, attackVisual: 'none',
      launchAttack: (_b, _u, _p, t, info) => getAttack()?.release(t, info) ?? false };
  }
  install() {
    const { b, u } = this;
    if (!b.regularSummons) b.regularSummons = new Map();
    b.regularSummons.set(summonCardId(ID), this.deck.state);
    this.handles = [b.on('deploy', ({ unit, move }) => {
      if (unit === u && !move) { this.seq = u.deploySeq; this.attack.born(); this.deck.born(); this.skills?.born(); }
    }, { owner: u }), b.on('tick', () => {
      if (this.stopped || b.finished || this.seq !== null && !this.valid()) { this.stop(); return; }
      this.skills?.tick(); this.attack.tick(); this.deck.tick();
    }, { owner: u }), b.on('death', ({ unit }) => {
      if (unit === u) this.stop(); else this.deck.removed(unit);
    }, { owner: u }), b.on('battleEnd', () => this.stop())];
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.skills?.stop(); this.attack.stop(); this.deck.stop();
    if (this.b.finished) this.b.projectiles.remove(p => p.data?.magallanCore === this);
    for (const h of this.handles) this.b.off(h); this.handles = [];
  }
}

export function prepareMagallanCore(b, u, { contract } = {}) {
  const record = validate(u, contract), controller = new MagallanCoreController(b, u, record);
  u.mem.magallanController = controller;
  return { record, controller, kit: { trait: controller.trait(() => controller.attack), talents: [], install: null,
    skill: { kind: 'instant', trigger: { rule: 'NEVER' }, canActivate: () => false } } };
}
