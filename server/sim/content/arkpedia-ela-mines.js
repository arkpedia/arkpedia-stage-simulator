// SPDX-License-Identifier: GPL-3.0-or-later
// Source-fed mine/deck adapter; native compiled event dispatch is unverified.
import evidence from '../../../data/arkpedia-ela-prefabs.json' with { type: 'json' };
import { sourceCandidate } from '../../../shared/arkpedia/summons.js';
import { summonPlacementError } from './arkpedia-summons.js';
import { bodyInRadius } from '../body.js';
import { canTargetEnemy } from '../targeting.js';

export const ELA_ID = 'char_4123_ela', ELA_MINE = 'token_10033_ela_grzmot';
export const ELA_INFLUENCE = 'ela_token_influence';
const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const flat = rows => Object.fromEntries(rows.map(r => [r.key, r.value]));
const components = Object.values(evidence.skills).flatMap(rows => rows.flatMap(r => r.components));
const component = id => {
  const value = components.find(c => c.pathId === id)?.data;
  if (!value) throw Error(`Missing original Ela mine component ${id}`);
  return value;
};
const triggerRadius = component('-3427533867086758589').m_Radius;
const effectRadius = component('6352912699480227139').m_Radius;
const animation = evidence.tokenModels[ELA_MINE].front;
const hitTime = animation.eventPayloads.Attack.find(e => e.name === 'OnAttack')?.time;
const bornTime = animation.eventPayloads.Start.find(e => e.name === 'OnStart')?.time;
if (!(triggerRadius > 0 && effectRadius > triggerRadius && hitTime >= 0 && bornTime >= 0))
  throw Error('Unreviewed Ela mine geometry or event');

/** Original token keyframes, paired skill blackboard and promotion/potential
 * stock. Ready card + native stacked cards = total held capacity. The native
 * fields are retained separately; no module, trust or owner ATK transfers. */
export function selectedElaMine(build) {
  if (!build || !Number.isInteger(build.elite) || build.elite < 0 || build.elite > 2
    || !Number.isInteger(build.level) || build.level < 1
    || build.level > evidence.tables.character.phases[build.elite].maxLevel
    || !Number.isInteger(build.potential) || build.potential < 1 || build.potential > 6
    || build.module && build.module !== 'none')
    throw Error('Invalid Ela mine build');
  const index = ['skchr_ela_1', 'skchr_ela_2', 'skchr_ela_3'].indexOf(build.skillId);
  if (index < 0 || index > build.elite || !Number.isInteger(build.skillRank)
    || build.skillRank < 1 || build.skillRank > [4, 7, 10][build.elite])
    throw Error('Unsupported Ela mine skill or rank');
  const id = `sktok_ela_${index + 1}`, skill = evidence.tables.tokenSkills[id].levels[build.skillRank - 1];
  const ownerSkill = evidence.tables.skills[build.skillId].levels[build.skillRank - 1];
  const bb = flat(skill.blackboard);
  if (JSON.stringify(skill.blackboard) !== JSON.stringify(ownerSkill.blackboard))
    throw Error('Ela mine blackboard does not match its owner');
  const token = evidence.tables.token, phase = token.phases[build.elite];
  const lo = phase.attributesKeyFrames[0], hi = phase.attributesKeyFrames.at(-1);
  const ratio = hi.level === lo.level ? 0 : (build.level - lo.level) / (hi.level - lo.level);
  const sourceStats = Object.fromEntries(Object.entries(lo.data).filter(([, v]) => typeof v === 'number')
    .map(([k, v]) => [k, v + ((hi.data[k] ?? v) - v) * ratio]));
  for (const k of ['maxHp', 'atk', 'def']) sourceStats[k] = Math.round(sourceStats[k]);
  const talent = sourceCandidate(evidence.tables.character.talents[0].candidates, build);
  const initialStock = flat(talent.blackboard).cnt;
  const capacity = sourceStats.maxDeckStackCnt + 1;
  if (capacity !== sourceStats.maxDeployCount || capacity !== [2, 3, 4][build.elite]
    || !Number.isInteger(initialStock) || initialStock < 1 || initialStock > capacity
    || sourceStats.cost !== 5 || sourceStats.respawnTime !== 5 || bb.projectile_range !== 1.7)
    throw Error('Unreviewed Ela mine stock or placement source');
  return { id: ELA_MINE, name: token.name, profession: token.profession,
    subProfessionId: token.subProfessionId, position: token.position,
    stats: { ...sourceStats, maxDeckStackCnt: capacity }, sourceStats,
    rangeGrid: evidence.tables.ranges[phase.rangeId].grids.map(g => [g.row, g.col]),
    talents: [], initialStock, index, skill: { skillId: id, name: skill.name, bb },
    arkpedia: { elite: build.elite, level: build.level, potential: build.potential },
    build: { ...build }, spine: ELA_MINE, avatar: ELA_MINE };
}

const eligible = (source, e, ignoreCamou = false) => live(e) && e.motion !== 'FLY'
  && canTargetEnemy(source, e, { canHitFly: false })
  && (ignoreCamou || !e.s.flags.camou || !!e.blockedBy);

/** One shared influence marker. DEFAULT/non-independent ownership is mapped
 * to one non-additive instance with max remaining lifetime and incoming mods.
 * Native mixed-skill overlap priority is not frame certified. */
export function applyElaMineEffects(b, source, record, x, y) {
  const bb = record.skill.bb, index = record.index;
  const victims = b.enemies.filter(e => eligible(source, e, true) && bodyInRadius(e, x, y, bb.projectile_range));
  for (const e of victims) {
    const duration = index === 0 ? bb.duration : index === 1 ? bb.stun : bb.sluggish;
    // Independently apply each native buff. Resisted/immune Stun does not
    // erase the separate influence marker used by Bullseye/target priority.
    b.applyStatus(e, index === 1 ? 'stun' : 'sluggish', { source,
      duration: index === 1 ? bb.stun : bb.sluggish });
    b.addBuff(e, { key: ELA_INFLUENCE, source, duration, refresh: 'extend',
      mods: index === 0 ? { hitRatePhys: bb.damage_hitrate_physical, hitRateArts: bb.damage_hitrate_magical } : {} });
    if (index === 2) b.applyStatus(e, 'fragile', { source,
      duration: bb['weak[limit]'], value: bb.damage_scale - 1 });
  }
  return victims;
}

/** Placement/deck and one-use trigger. No skill casts, owner death/retreat
 * burst, critical rolls or attack SP are fabricated by this helper. */
export class ElaMineDeck {
  constructor(battle, unit, build = unit.def.raw.arkpedia) {
    if (unit.def.charId !== ELA_ID) throw Error('Ela mines require the Ela owner');
    this.b = battle; this.u = unit; this.record = selectedElaMine(build);
    this.seq = null; this.mines = new Set(); this.closed = false;
    this.key = `summon:${ELA_ID}`;
    this.state = { key: this.key, ownerId: ELA_ID, owner: unit, tokenId: ELA_MINE,
      record: this.record, stock: 0, readyAt: battle.time,
      config: { deploymentSlotCost: 0, chooseFacing: false, fixedRotation: true,
        excludeWalkingEnemy: true, noAttack: true, healFree: true, refundRatio: 0 },
      syncSkill: () => this.syncStock() };
    battle.regularSummons ??= new Map(); battle.regularSummons.set(this.key, this.state);
    this.handles = [
      battle.on('deploy', ({ unit: u }) => { if (u === unit) this.begin(); }, { owner: unit }),
      battle.on('death', ({ unit: u }) => { if (u === unit) this.clear(); }, { owner: unit }),
      battle.on('battleEnd', () => this.close(), { owner: unit }),
    ];
    if (live(unit)) this.begin();
  }
  valid() { return !this.closed && live(this.u) && this.u.deploySeq === this.seq
    && this.b.regularSummons.get(this.key) === this.state && !this.b.finished; }
  begin() {
    this.clear(); this.seq = this.u.deploySeq;
    this.state.stock = this.record.initialStock; this.state.readyAt = this.b.time; this.syncStock();
  }
  syncStock() {
    const key = 'ela:stock-full';
    if (this.valid() && this.record.index === 0 && this.state.stock >= this.record.stats.maxDeckStackCnt) {
      if (!this.u.findBuff(key)) this.b.addBuff(this.u, { key, flags: { noSp: true } });
    } else this.b.removeBuff(this.u, key);
  }
  recharge(count = 1) {
    if (!Number.isInteger(count) || count < 1) throw Error('Invalid Ela mine recharge count');
    if (!this.valid()) return false;
    this.state.stock = Math.min(this.record.stats.maxDeckStackCnt, this.state.stock + count);
    this.syncStock(); return true;
  }
  place(row, col) {
    if (!this.valid()) throw Error('Deploy the current Ela owner first.');
    const error = summonPlacementError(this.b, this.key, row, col);
    if (error) throw Error(error);
    const token = this._create(row, col);
    if (!token) throw Error('Ela mine placement failed.');
    this.b.getPlayer(this.u.ownerId).dp -= this.record.stats.cost;
    this.state.stock--; this.state.readyAt = this.b.time + this.record.stats.respawnTime;
    this.syncStock(); return token;
  }
  _create(row, col) {
    const b = this.b, u = this.u, seq = this.seq, record = this.record;
    const kit = { skill: null, trait: { noAttack: true, canAttack: () => false },
      install: (battle, t) => {
        t.kind = 'device'; t.deploymentSlotCost = 0; t.mem.regularSummonCard = this.key;
        battle.addBuff(t, { key: 'ela:device', persist: true, allowDead: true,
          flags: { invulnerable: true, untargetable: true, healFree: true, noSp: true } });
        let armedAt = Infinity, idleAt = Infinity, triggered = false;
        const valid = () => this.valid() && u.deploySeq === seq && live(t);
        battle.on('deploy', ({ unit }) => {
          if (unit !== t) return;
          // Native useRealBornTimeFromAnim and the original OnStart event.
          // Logical placement is accepted now; ability arming follows that
          // event. Compiled Unity start/ability dispatch remains unverified.
          armedAt = battle.time + bornTime; idleAt = battle.time + animation.durations.Start;
          t.mem.regularFormVisual = { clip: 'Start', loop: false, die: null };
        }, { owner: t });
        const watcher = battle.every(battle.dt, () => {
          if (!valid()) { watcher.cancel(); return; }
          if (triggered || battle.time + 1e-9 < armedAt) return;
          if (battle.time + 1e-9 >= idleAt) t.mem.regularFormVisual = { clip: 'Idle', loop: true, die: null };
          if (!battle.enemies.some(e => eligible(t, e) && bodyInRadius(e, t.x, t.y, triggerRadius))) return;
          triggered = true; watcher.cancel();
          t.mem.regularFormVisual = { clip: 'Attack', loop: false, die: null };
          battle.after(hitTime, () => {
            if (!valid()) return;
            const victims = applyElaMineEffects(battle, t, record, t.x, t.y);
            t.stats.attacks++;
            battle.emit('elaMine', { source: t, targets: victims, owner: u, skillId: record.skill.skillId });
          }, { owner: t });
          battle.after(animation.durations.Attack, () => {
            if (live(t)) battle.retreat(t, { permanent: true, reason: 'ela-triggered' });
          }, { owner: t });
        }, { owner: t });
        battle.on('death', ({ unit }) => { if (unit === t) { watcher.cancel(); this.mines.delete(t); } }, { owner: t });
      } };
    const t = b.spawnToken(u, ELA_MINE, row, col, { dir: 'RIGHT', def: record, kit });
    if (t) this.mines.add(t);
    return t;
  }
  clear() {
    for (const t of this.mines) if (t.alive && t.deployed)
      this.b.retreat(t, { permanent: true, reason: 'owner-removed' });
    this.mines.clear(); this.b.removeBuff(this.u, 'ela:stock-full'); this.seq = null;
  }
  close() { this.clear(); this.closed = true; for (const h of this.handles) this.b.off(h); }
}
