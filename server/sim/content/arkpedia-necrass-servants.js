// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-necrass-prefabs.json' with { type: 'json' };
import { necrassSourceComponent as component } from './arkpedia-necrass-source.js';
import { NECRASS_CORE_CONTRACT, NecrassAttackClock, necrassPresent as present,
  necrassAttackProfile, prepareNecrassCore } from './arkpedia-necrass.js';
import { bodyInKeys } from '../body.js';
import { canTargetEnemy } from '../targeting.js';
import { flattenBlackboard as flat } from '../simdata.js';

export const NECRASS_SERVANT_CONTRACT = Object.freeze({
  scope: 'Necrass S1/S2 ordinary servant death-triggered factory, single upgrades, source-max-HP healing and normal Arts attacks; diagnostic only',
  mapping: 'Any enemy killed inside the current host range queues one attempt after the source 0.1-second interval. Prefer its legal captured tile, otherwise choose a random unoccupied low melee tile in range. Servants inherit promotion and level, not trust/potential stats, face like their owner, and cost zero DP and deployment slots. At the promotion cap or after a failed spawn, prefer an unupgraded in-range servant; a unique percentage-stat/block upgrade also heals by source max HP. When all are upgraded, heal one instead. Normal form remains Start_2/Idle_2/Attack_2. S1 creation and successful upgrades emit the source-radius Arts burst. Owner finish retires all generations.',
  limits: 'Numeric tile queues/post-filter 16, category-four fallback ordering, corpse visibility, final death versus revival, one-attempt timer phase, stat rounding, shared-engine HP-ratio preservation, healing accounting and original FSM/animation event ordering are explicit simulator mappings, not compiled Unity parity. S1 resummoning, S2 Sleep beams/extra servants, all S3 special-servant/automatic-skill behavior, delivered artwork and public review remain held. Missing Back Stun clips are not filled. Modules and native shaders/particles/audio remain unsupported.',
  frameParity: false,
});
const TOKEN = 'token_10043_necras_skeltn', UPGRADE = 'necras_t_1[upgrade]';
const live = u => present(u) && !u.hidden;
const due = (b, t) => b.time + 1e-9 >= t;
const grid = id => evidence.tables.ranges[id].grids.map(g => [g.row, g.col]);
function tokenRecord(core) {
  const source = core.record.tokenRecords[TOKEN], frames = source.phase.attributesKeyFrames;
  const lo = frames[0], hi = frames.at(-1), scale = (core.record.build.level - lo.level) / (hi.level - lo.level);
  const stats = Object.fromEntries(Object.entries(lo.data).filter(([, v]) => typeof v === 'number')
    .map(([k, v]) => [k, v + (hi.data[k] - v) * scale]));
  for (const k of ['maxHp', 'atk', 'def']) stats[k] = Math.round(stats[k]);
  return { id: TOKEN, name: source.source.name, stats, rangeGrid: grid(source.phase.rangeId),
    position: source.source.position, profession: source.source.profession, subProfessionId: source.source.subProfessionId,
    dmgType: 'arts', talents: [], arkpedia: { ...core.record.build },
    skill: { ...source.skill, ...source.skill.spData, skillId: source.skillId,
      rangeGrid: grid(source.skill.rangeId ?? source.phase.rangeId), trigger: { rule: 'NEVER' } } };
}
function validate(core, contract) {
  if (contract !== NECRASS_SERVANT_CONTRACT) throw Error('Necrass requires the reviewed servant contract');
  if (core.record.index === 2) throw Error('Necrass S3 special servant remains held');
  const factory = component('-1618797215220287396'), token = component('-8493436737972975817');
  const attack = component('-4645928882645809353'), selector = component('8993032889789003868');
  if (factory._tokenId !== TOKEN || factory._forceSpawn !== 0 || factory._useOwnerDirection !== 1
    || token._occupiedRemainingCharacterCnt !== 0 || token._buildCondition.buildableType !== 1
    || token._buildCondition.needSpecifyDirection !== 0 || token._useRealBornTimeFromAnim !== 0
    || selector._verifyQueueTile !== 1 || selector._verifyInRange !== 1
    || selector._selectorAbilityName !== 'NecrasTokenSelector'
    || attack._damageType !== 2 || attack._animKey !== 'Attack_2' || attack._waitForAttackEvent !== 1
    || component('63537588628637495')._attack.m_PathID !== '-4645928882645809353'
    || core.record.tokenRecords[TOKEN].skill.skillType !== 'PASSIVE') throw Error('Unreviewed Necrass servant source');
  const spawn = component('6634445406786238556'), fallback = component('8141215438931966044');
  if (spawn._category !== 4 || fallback._category !== 4
    || spawn._abilities.map(p => p.m_PathID).join(',') !== '-1618797215220287396,8141215438931966044'
    || fallback._abilities.map(p => p.m_PathID).join(',') !== '685377851315992668,8512717952794966108')
    throw Error('Unreviewed Necrass factory fallback');
  const upgrade = evidence.templates[UPGRADE].eventToActions.ON_BUFF_START;
  const heal = evidence.templates.necras_token_heal.eventToActions.ON_BUFF_START[0];
  if (upgrade[0]._buffKeys[0] !== 'necras_t_4[dragon]' || upgrade[2]._buff.maxStackCnt !== 1
    || upgrade[2]._buff.overrideType !== 'UNIQUE' || upgrade[3]._getMaxHpFromTarget !== false
    || upgrade[3]._ignoreHealFree !== true || upgrade[3]._skipModifierEvent !== true
    || heal._getMaxHpFromTarget !== false || heal._ignoreHealFree !== true || heal._skipModifierEvent !== true)
    throw Error('Unreviewed Necrass servant upgrade');
}

export class NecrassServants {
  constructor(core) {
    this.core = core; this.b = core.b; this.u = core.u; this.def = tokenRecord(core);
    this.t1 = flat(core.record.talents.find(t => t.prefabKey === '1').blackboard);
    this.units = new Map(); this.pending = []; this.deaths = new WeakMap(); this.handles = []; this.stopped = false;
    const branch = evidence.templates.necras_t_1.eventToActions.ON_OWNER_KILLED[1];
    this.delay = branch._succeedNodes[1]._buff.blackboard.find(v => v.key === 'interval').value;
  }
  valid() { return !this.stopped && this.core.valid(); }
  owns(t) { const s = this.units.get(t); return !!s && present(t) && t.deploySeq === s.seq && t.ownerUnit === this.u; }
  all() { return [...this.units.keys()].filter(t => this.owns(t)); }
  blocksInHostRange(e, keys) { return this.owns(e.blockedBy) && live(e.blockedBy) && bodyInKeys(e.blockedBy, keys); }
  tileEligible(row, col) {
    const b = this.b;
    return Number.isInteger(row) && Number.isInteger(col) && b.grid.inRect(row, col)
      && this.core.clock.keys().has(row * 21 + col)
      && ['MELEE', 'ALL'].includes(b.grid.tile(row, col).build) && b.grid.tile(row, col).height === 'LOW'
      && !b.unitAt(row, col) && !b.tileReservation(row, col) && !b.downOn(row, col);
  }
  chooseTile(preferred) {
    if (preferred && this.tileEligible(...preferred)) return preferred;
    const choices = [...this.core.clock.keys()].map(k => [Math.floor(k / 21), k % 21])
      .filter(([r, c]) => this.tileEligible(r, c));
    return choices.length ? choices[Math.floor(this.b.rng() * choices.length)] : null;
  }
  enqueue(count = 1, tile = null) {
    if (!this.valid() || !Number.isInteger(count) || count < 0 || count > 100) return;
    for (let i = 0; i < count; i++) this.pending.push({ due: this.b.time + this.delay, tile });
  }
  create(row, col) {
    if (!this.valid() || this.all().length >= this.t1.max_token_cnt || !this.tileEligible(row, col)) return null;
    let clock;
    const t = this.b.spawnToken(this.u, TOKEN, row, col, { dir: this.u.dir, def: this.def,
      kit: { trait: { ...necrassAttackProfile({ release: (t, info) => clock.release(t, info) }, true) },
        talents: [], skill: { kind: 'passive', trigger: { rule: 'NEVER' }, canActivate: () => false },
        install: (b, token) => {
          clock = new NecrassAttackClock(this.core, token, { token: true });
          token.deploymentSlotCost = 0;
          token.mem.necrassServantClock = clock;
          b.on('deploy', ({ unit, move }) => { if (unit === token && !move) clock.born(); }, { owner: token });
        } } });
    if (!t) return null;
    if (!this.valid() || !present(t)) {
      clock.stop();
      if (present(t)) this.b.retreat(t, { permanent: true, reason: 'necrass-owner-finished' });
      return null;
    }
    this.units.set(t, { seq: t.deploySeq, clock, upgraded: false });
    this.burst(t);
    return t;
  }
  heal(t) {
    if (!this.valid() || !this.owns(t)) return 0;
    // Original HealViaMaxHpRatio ignores HealFree and modifier events.
    const amount = Math.max(0, Math.min(this.u.s.maxHp, t.s.maxHp - t.hp));
    t.hp += amount; this.u.stats.heal += amount;
    const player = this.b._pp(this.u.ownerId); if (player) player.healingDone += amount;
    if (amount >= .5) this.b._ev(['heal', t.id, Math.round(amount)]);
    return amount;
  }
  upgradeOrHeal() {
    if (!this.valid()) return null;
    const keys = this.core.clock.keys(), choices = this.all().filter(t => live(t) && bodyInKeys(t, keys));
    // Post-filter 16 ordering is not recovered. Stable local ID order is
    // explicit diagnostic policy; it does not certify the native selector.
    choices.sort((a, z) => a.id - z.id);
    const t = choices.find(t => !this.units.get(t).upgraded) ?? choices[0];
    if (!t) return null;
    const s = this.units.get(t);
    if (!s.upgraded) {
      s.upgraded = true;
      this.b.addBuff(t, { key: UPGRADE, source: this.u, mods: { hpPct: this.t1.max_hp,
        atkPct: this.t1.atk, defPct: this.t1.def, blockCnt: this.t1.block_cnt ?? 0 } });
      this.heal(t); this.burst(t);
    } else this.heal(t);
    return t;
  }
  burst(t) {
    if (!this.valid() || this.core.record.index !== 0 || !this.owns(t)) return;
    const bb = this.core.record.bb;
    for (const e of this.b.enemiesInRadius(t.x, t.y, bb.range_radius, true)) {
      if (!this.valid() || !this.owns(t)) break;
      if (!live(e) || !canTargetEnemy(this.u, e, { canHitFly: true })) continue;
      this.b.dealDamage(this.u, e, { amount: this.u.s.atk * bb.atk_scale, type: 'arts',
        canDodge: false, isSkill: true, isSplash: true, applyWay: 'none', tags: ['necrass:s1-passive'] });
    }
  }
  install() {
    if (this.stopped || this.handles.length) throw Error('Necrass servant factory cannot install twice or after retirement');
    this.handles = [this.b.on('death', ({ unit, reason }) => {
      const s = this.units.get(unit);
      if (s) { s.clock.stop(); this.units.delete(unit); return; }
      if (reason !== 'killed' || unit.side !== 'enemy' || !this.valid() || !live(this.u)
        || !bodyInKeys(unit, this.core.clock.keys()) || this.deaths.get(unit) === unit.deploySeq) return;
      this.deaths.set(unit, unit.deploySeq);
      this.enqueue(1, [Math.round(unit.y), Math.round(unit.x)]);
    }, { owner: this.u })];
  }
  tick() {
    if (!this.valid()) return;
    while (this.pending.length && due(this.b, this.pending[0].due)) {
      const next = this.pending.shift();
      if (!this.valid() || !live(this.u)) { this.pending.length = 0; break; }
      if (this.all().length < this.t1.max_token_cnt) {
        const tile = this.chooseTile(next.tile);
        if (!tile || !this.create(...tile)) this.upgradeOrHeal();
      } else this.upgradeOrHeal();
    }
    for (const [t, s] of this.units) if (this.owns(t)) s.clock.tick();
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.pending.length = 0;
    for (const [t, s] of [...this.units]) {
      s.clock.stop();
      if (present(t)) this.b.retreat(t, { permanent: true, reason: 'necrass-owner-finished' });
    }
    this.units.clear(); for (const h of this.handles) this.b.off(h); this.handles = [];
  }
}
export function prepareNecrassServants(b, u, { contract } = {}) {
  // Check the servant gate before installing any owner state.
  if (contract !== NECRASS_SERVANT_CONTRACT) throw Error('Necrass requires the reviewed servant contract');
  if (u.def.skill?.id === 'skchr_necras_3') throw Error('Necrass S3 special servant remains held');
  const result = prepareNecrassCore(b, u, { contract: NECRASS_CORE_CONTRACT });
  validate(result.controller, contract);
  result.controller.servants = new NecrassServants(result.controller);
  return { ...result, servants: result.controller.servants };
}
