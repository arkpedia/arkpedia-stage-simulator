// SPDX-License-Identifier: GPL-3.0-or-later
// Private selected-source bridge. Public approval additionally requires original artwork.
import { flattenBlackboard } from '../simdata.js';
import { absoluteRangeKeys, areaSelectable } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { makeDamageInfo } from '../damage.js';
import { enforceBlockCapacity } from '../ai.js';
import { prepareLingCore, LING_CORE_CONTRACT, lingSourceComponent as comp } from './arkpedia-ling.js';

export const LING_SKILL_CONTRACT = Object.freeze({
  scope: 'All selected Ling S1/S2/S3 ranks, independent dragon casts, delayed recycling, ground aura and two-way higher-form fusion; public selection remains held for artwork review',
  mapping: 'S1 gains stock at start and changes melee damage to Arts. S2 uses original hit events and arrival Bind, casts without targets and recycles strictly below half HP after the serialized delay. S3 adds owner/token percentages, uses Ling ATK for ground-only cross pulses, gains stock at finish, transfers both deployment slots on fusion and resets survivor HP. Higher-mode changes briefly remove the passive block modifier; original Born is excluded from higher animation aliases.',
  limits: 'Compiled selector ordering, animation/FSM/cast dispatch, callback heal context, card recharge cooldown and frame clocks are bounded local mappings, not certified Unity frame parity. S2 cast/SP hold is rounded up to the first simulation tick at the native delay. Modules, native artwork, particles/audio and public approval remain held.',
  frameParity: false,
});
const present = u => u?.alive && u.deployed && !u._removing;
const due = (b, t) => b.time + 1e-9 >= t;
const S2_DELAY = 1.2000000476837158;
const FUSION_INTERVAL = .10000000149011612;
const MODE_FINISH_DELAY = .029999999329447746;

function verifySkills() {
  for (const id of ['-1505268533115901153', '3656741716272001420', '8765559471770714735']) {
    const s = comp(id);
    if (s?._canSilenced !== 0 || s._allowSpRecoveryWhenAffecting !== 0 || s._playSkillBeginAnim !== 0
      || s._canUseInAbnormalState !== 0 || s._checkHasTargetBeforeDoCast !== 0 || s._recoverSpIfNoTarget !== 0)
      throw Error('Unreviewed Ling skill holder');
  }
  const recycle = comp('2679009538321527180'), trigger = comp('942880343694350012')._buffs[0];
  if (recycle._preDelay !== S2_DELAY || !recycle._actions.SerializedState.includes('FilterByTargetHpRatio')
    || trigger.triggerInterval !== FUSION_INTERVAL || trigger.triggerCnt !== 2 || trigger.waitFirstTriggerInterval !== 1)
    throw Error('Unreviewed Ling lifecycle timing');
  for (const [id, cap] of [['-4741658570178449012', -1], ['4772571023981460419', 1], ['-6462079656279566660', 1]]) {
    const a = comp(id);
    if (a._waitForAttackEvent !== 1 || a._maxAnimScale !== cap) throw Error('Unreviewed Ling skill attack');
  }
}

export class LingSkills {
  constructor(core) {
    this.core = core; this.b = core.b; this.u = core.u; this.record = core.record;
    this.tokenBB = flattenBlackboard(core.record.token.skill.blackboard);
    this.key = `ling:active:${this.u.id}`; this.higherKey = `ling:higher:${this.u.id}`;
    this.tokens = new Map(); this.recycleAt = Infinity;
  }
  get active() { return this.core.valid() && !!this.u.skill.active; }
  get casting() { return this.recycleAt !== Infinity; }
  get mods() { return this.record.index === 0 ? { atkPct: this.record.bb.atk, aspd: this.record.bb.attack_speed }
    : this.record.index === 2 ? { atkPct: this.record.bb.atk, defPct: this.record.bb.def } : null; }
  canCast() { return this.core.valid() && !this.u.hidden && this.u.canAct && !this.u.s.flags.disarm && !this.casting; }
  recharge(count = this.record.bb.cnt, recycle = false) {
    if (!this.core.valid()) return;
    const d = this.core.deck;
    d.stock = Math.min(d.record.stats.maxDeckStackCnt, d.stock + count);
    // NORMAL recycling follows the existing summon-card cooldown mapping;
    // direct skill stock awards do not start a new placement cooldown.
    if (recycle) d.readyAt = this.b.time + d.record.stats.respawnTime;
  }
  higherMods() {
    const bb = this.tokenBB;
    return { hpPct: bb['2.max_hp'], atkPct: bb['2.atk'], defPct: bb['2.def'], resPct: bb['2.magic_resistance'],
      batFlat: bb['2.base_attack_time'], blockCnt: bb['2.block_cnt'] };
  }
  cycleHigher(t) {
    if (!this.tokens.get(t)?.higher || !present(t)) return;
    // Native higher passive detaches on a mode switch; release only capacity
    // overflow (weighted, latest blocked first), then restore the modifier.
    this.b.removeBuff(t, this.higherKey); void t.s;
    enforceBlockCapacity(this.b, t);
    this.b.addBuff(t, { key: this.higherKey, source: this.u, mods: this.higherMods() });
  }
  syncToken(t) {
    const state = this.tokens.get(t); if (!state || !present(t)) return;
    if (this.active && this.mods) {
      if (!t.findBuff(this.key)) this.b.addBuff(t, { key: this.key, source: this.u, mods: this.mods });
    } else this.b.removeBuff(t, this.key);
    if (this.record.index === 2 && this.active && !state.activeMode) {
      state.activeMode = true; state.finishModeAt = Infinity;
      state.nextPulse = this.b.time + this.record.bb.interval; this.cycleHigher(t);
    }
  }
  placed(t) {
    this.tokens.set(t, { higher: false, activeMode: false, finishModeAt: Infinity, nextPulse: Infinity,
      fusionAt: this.record.index === 2 ? this.b.time + FUSION_INTERVAL : Infinity, fusionChecks: 2 });
    this.syncToken(t);
  }
  removed(t) { this.tokens.delete(t); }
  start() {
    if (this.record.index === 0) this.recharge();
    else if (this.record.index === 1) {
      this.recycleAt = this.b.time + S2_DELAY;
      this.core.attack.cast({ scale: this.record.bb.atk_scale, bind: this.record.bb['ling_s2_unmovable.duration'] });
      for (const attack of this.core.deck.attacks.values())
        attack.cast({ scale: this.tokenBB['2.atk_scale'], bind: this.tokenBB['2.duration'] });
    } else this.core.attack.resetMode();
    for (const t of this.core.deck.own()) this.syncToken(t);
  }
  recycle() {
    if (!this.core.valid()) return;
    for (const t of this.core.deck.own()) {
      if (!this.core.valid()) break;
      if (!present(t) || t.ownerUnit !== this.u || t.hp >= t.s.maxHp * this.record.bb.hp_ratio) continue;
      this.b.retreat(t, { permanent: true, reason: 'ling-skill-recycle' });
      if (!present(t)) this.recharge(this.record.bb.cnt, true);
    }
  }
  end(reason) {
    if (this.record.index === 1) {
      // An early external finish does not run the serialized recycle action.
      if (due(this.b, this.recycleAt) && this.core.valid() && !['death', 'withdrawn'].includes(reason)) this.recycle();
      this.recycleAt = Infinity;
    }
    for (const t of this.core.deck.own()) {
      this.b.removeBuff(t, this.key);
      const s = this.tokens.get(t);
      if (this.record.index === 2 && s?.activeMode) {
        s.nextPulse = Infinity; s.finishModeAt = this.b.time + MODE_FINISH_DELAY;
      }
    }
    if (this.record.index === 2) {
      this.core.attack.resetMode();
      if (this.core.valid() && !['death', 'withdrawn'].includes(reason)) this.recharge();
    }
  }
  reaches(from, to) {
    return bodyInKeys(to, new Set(absoluteRangeKeys(from.rangeGrid, from.tileR, from.tileC, from.dir, from.s.rangeExtend)));
  }
  fusion(t) {
    const state = this.tokens.get(t);
    if (!present(t) || !state || state.higher || t.ownerUnit !== this.u) return;
    const lower = this.core.deck.own().filter(v => v !== t && v.ownerUnit === this.u && !this.tokens.get(v)?.higher);
    // The first native ability upgrades a dragon in the new dragon's range.
    // Only if it finds none does the second consume the latest dragon facing it.
    let survivor = lower.find(v => this.reaches(t, v)), consumed = t;
    if (!survivor) {
      consumed = lower.filter(v => this.reaches(v, t)).sort((a, z) => z.id - a.id)[0];
      survivor = t;
    }
    if (!consumed) return;
    const s = this.tokens.get(survivor);
    survivor.deploymentSlotCost += consumed.deploymentSlotCost; consumed.deploymentSlotCost = 0;
    s.higher = true; s.fusionAt = Infinity;
    this.b.addBuff(survivor, { key: this.higherKey, source: this.u, mods: this.higherMods() });
    this.b.heal(this.u, survivor, survivor.s.maxHp, { ignoreHealFree: true, skipModifierEvent: true });
    this.core.deck.attacks.get(survivor)?.resetMode();
    this.b.retreat(consumed, { permanent: true, reason: 'ling-fused' });
    this.b.emit('lingFusion', { owner: this.u, survivor, consumed });
  }
  pulse(t) {
    const keys = new Set(absoluteRangeKeys([[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]], t.tileR, t.tileC, 'RIGHT'));
    for (const enemy of this.b.enemies) {
      if (!this.core.valid() || !present(t)) break;
      if (enemy.motion === 'FLY' || !areaSelectable(this.u, enemy) || !bodyInKeys(enemy, keys)) continue;
      this.b.dealDamage(this.u, enemy, makeDamageInfo({ amount: this.u.s.atk * this.record.bb.atk_scale,
        type: 'arts', isAttack: false, isSkill: true, isSplash: true, applyWay: 'none', tags: ['ling:s3:aura'] }));
    }
    this.b.emit('lingAuraPulse', { owner: this.u, unit: t });
  }
  tick() {
    if (!this.core.valid()) return;
    if (this.casting && due(this.b, this.recycleAt)) this.u.skill.end('ling-cast-finished');
    for (const t of this.core.deck.own()) {
      const s = this.tokens.get(t); if (!s) continue;
      this.syncToken(t);
      if (this.record.index !== 2) continue;
      if (s.fusionChecks > 0 && due(this.b, s.fusionAt)) {
        s.fusionChecks--; s.fusionAt += FUSION_INTERVAL; this.fusion(t);
        if (!present(t)) continue;
      }
      if (due(this.b, s.finishModeAt)) { s.activeMode = false; s.finishModeAt = Infinity; this.cycleHigher(t); }
      if (this.active && due(this.b, s.nextPulse)) { s.nextPulse = this.b.time + this.record.bb.interval; this.pulse(t); }
    }
  }
  stop() {
    this.recycleAt = Infinity;
    for (const t of this.core.deck.own()) this.b.removeBuff(t, this.key);
    this.tokens.clear();
  }
}

export function prepareLingSkills(b, u, { contract } = {}) {
  if (contract !== LING_SKILL_CONTRACT) throw Error('Ling requires the reviewed skill contract');
  verifySkills();
  const prepared = prepareLingCore(b, u, { contract: LING_CORE_CONTRACT });
  const bridge = new LingSkills(prepared.controller); prepared.controller.skills = bridge;
  return { ...prepared, skills: bridge, kit: { ...prepared.kit, skill: {
    // Prevent the generic duration tick from ending S2 before its native delay.
    kind: 'duration', duration: prepared.record.index === 1 ? S2_DELAY + b.dt : prepared.record.source.duration,
    trigger: { rule: 'NEVER' }, silenceable: false, mods: bridge.mods,
    canActivate: () => bridge.canCast(), onStart: () => bridge.start(), onEnd: ({ reason }) => bridge.end(reason),
  } } };
}
