// SPDX-License-Identifier: GPL-3.0-or-later
// Source-fed resource adapter, shared by all three Swire skill controllers.
import evidence from '../../../data/arkpedia-swire-alter-prefabs.json' with { type: 'json' };
import { sourceCandidate } from '../../../shared/arkpedia/summons.js';

export const SWIRE_ALTER_ID = 'char_1033_swire2';
export const SWIRE_ECONOMY_CONTRACT = Object.freeze({
  coins: 'isolated from the ordinary SP runtime',
  atk: 'one additive native MULTIPLIER stack group until owner finish',
  fatalProtectionSeconds: .01,
  fatalTimingSource: 'https://prts.wiki/w/Swire_the_Elegant_Wit#天赋',
  fatalTimingEvidence: 'authored gameplay note; not recovered compiled Unity timing',
  scheduler: 'protection expires at the first simulation tick at or after its deadline',
  frameParity: false,
});
const flat = rows => Object.fromEntries(rows.map(r => [r.key, r.value]));
const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const STACK = 'swire2:coin-atk', PROTECTION = 'swire2:fatal-protection';

export function selectedSwireEconomy(build) {
  const c = evidence.tables.character;
  if (!build || !Number.isInteger(build.elite) || build.elite < 0 || build.elite > 2
    || !Number.isInteger(build.level) || build.level < 1 || build.level > c.phases[build.elite].maxLevel
    || !Number.isInteger(build.potential) || build.potential < 1 || build.potential > 6
    || build.module && build.module !== 'none') throw Error('Invalid Swire economy build');
  const index = ['skchr_swire2_1', 'skchr_swire2_2', 'skchr_swire2_3'].indexOf(build.skillId);
  if (index < 0 || index > build.elite || !Number.isInteger(build.skillRank)
    || build.skillRank < 1 || build.skillRank > [4, 7, 10][build.elite])
    throw Error('Unsupported Swire skill or rank');
  const skill = evidence.tables.skills[build.skillId].levels[build.skillRank - 1];
  const talent = flat(sourceCandidate(c.talents[0].candidates, build).blackboard);
  const fatal = sourceCandidate(c.talents[1].candidates, build);
  const trait = flat(sourceCandidate(c.trait.candidates, build).blackboard);
  const bb = flat(skill.blackboard);
  if (!Number.isInteger(bb.sp) || bb.sp < 1 || trait.interval !== 3 || trait.cost !== -3
    || talent.trait_sp !== 1 || !Number.isInteger(talent.max_stack_cnt)
    || index === 2 && (skill.skillType !== 'AUTO' || skill.spData.spCost !== 5
      || skill.spData.spType !== 'INCREASE_WITH_TIME')
    || index < 2 && (skill.skillType !== 'PASSIVE' || skill.spData.spType !== 8))
    throw Error('Unreviewed Swire economy source');
  return { index, skillId: build.skillId, bb, talent, trait,
    fatal: fatal ? flat(fatal.blackboard) : null, capacity: bb.sp };
}

/** Coin ownership is deliberately separate from SkillRuntime SP. S1/S2 are
 * active on deployment; S3 starts only on the actual successful AUTO cast.
 * Attack controllers must call spend() at an accepted native ability birth,
 * and capture finishSkill() before starting the S3 ending attack. Neither
 * attack selection, bomb spawning nor that finishing attack lives here. */
export class SwireCoinEconomy {
  constructor(battle, unit, build = unit.def.raw.arkpedia, contract) {
    if (contract !== SWIRE_ECONOMY_CONTRACT) throw Error('Swire economy requires its reviewed local contract');
    if (unit.def.charId !== SWIRE_ALTER_ID) throw Error('Swire economy requires its original owner');
    this.record = selectedSwireEconomy(build);
    if (JSON.stringify(unit.def.skill.bb) !== JSON.stringify(this.record.bb))
      throw Error('Swire economy does not match the installed skill');
    if (unit.mem.swireCoinEconomy) throw Error('Swire economy is already installed');
    this.b = battle; this.u = unit; this.seq = null; this.closed = false;
    this.coins = 0; this.stacks = 0; this.active = false;
    this.fatalCost = 0; this.upkeep = null; this.repair = null;
    unit.mem.swireCoinEconomy = this;
    this.handles = [
      battle.on('deploy', ({ unit: u }) => { if (u === unit) this.begin(); }, { owner: unit }),
      battle.on('skillStart', ({ unit: u }) => {
        if (u === unit && this.record.index === 2) this.beginSkill();
      }, { owner: unit }),
      battle.on('skillEnd', ({ unit: u }) => { if (u === unit) this.finishSkill(); }, { owner: unit }),
      battle.on('kill', ({ killer, victim }) => {
        if (killer === unit && victim.side === 'enemy' && this.record.index === 2) this.gain(1);
      }, { owner: unit }),
      battle.on('fatal', ctx => this.preventFatal(ctx), { owner: unit }),
      battle.on('death', ({ unit: u }) => { if (u === unit) this.clear(); }, { owner: unit }),
      battle.on('battleEnd', () => this.close(), { owner: unit }),
    ];
    if (live(unit)) this.begin();
  }
  valid() { return !this.closed && live(this.u) && this.u.deploySeq === this.seq && !this.b.finished; }
  begin() {
    this.clear(); if (this.closed || !live(this.u) || this.b.finished) return;
    this.seq = this.u.deploySeq;
    this.fatalCost = this.record.fatal ? -this.record.fatal.cost : 0;
    if (this.record.index < 2 || this.u.skill.active) this.beginSkill();
    const seq = this.seq;
    this.upkeep = this.b.every(this.record.trait.interval, () => {
      if (!this.valid() || this.seq !== seq) return;
      const p = this.b.getPlayer(this.u.ownerId), cost = -this.record.trait.cost;
      if (p.dp < cost) { this.b.retreat(this.u, { reason: 'merchant', permanent: true }); return; }
      p.dp -= cost;
      if (this.active) {
        this.gain(this.record.talent.trait_sp);
        this.stacks = Math.min(this.record.talent.max_stack_cnt, this.stacks + 1);
        // Native ATK MULTIPLIER sums with other ordinary ATK percentages;
        // the stacks in this group are additive, never compounded.
        if (this.stacks) this.b.addBuff(this.u, { key: STACK, source: this.u,
          mods: { atkPct: this.record.talent.atk * this.stacks } });
      }
      this.b.emit('swirePayment', { unit: this.u, cost, coins: this.coins, stacks: this.stacks });
    }, { owner: this.u });
  }
  beginSkill() {
    if (!this.valid() || !this.u.skill.active || this.active) return false;
    this.active = true; this.coins = Math.min(this.record.capacity, this.record.talent.sp);
    this.u.skill.sp = 0; this.u.skill.charges = 0;
    return true;
  }
  finishSkill() {
    const coins = this.valid() && this.active ? this.coins : 0;
    if (this.active) { this.u.skill.sp = 0; this.u.skill.charges = 0; }
    this.active = false; this.coins = 0;
    return coins;
  }
  gain(count) {
    if (!Number.isInteger(count) || count < 1) throw Error('Invalid Swire coin gain');
    if (!this.valid() || !this.active) return 0;
    const before = this.coins;
    this.coins = Math.min(this.record.capacity, before + count);
    return this.coins - before;
  }
  spend(count = 1) {
    if (!Number.isInteger(count) || count < 1) throw Error('Invalid Swire coin expenditure');
    if (!this.valid() || !this.active || this.coins < count) return false;
    this.coins -= count; return true;
  }
  preventFatal(ctx) {
    if (ctx.unit !== this.u || !this.valid() || !this.record.fatal || ctx.prevented
      || this.u.s.flags.undeadable || this.repair) return;
    const p = this.b.getPlayer(this.u.ownerId);
    if (p.dp < this.fatalCost) return;
    const cost = this.fatalCost;
    p.dp -= cost; this.fatalCost *= this.record.fatal.cost_multi;
    ctx.prevented = true; this.u.hp = Math.min(1, this.u.s.maxHp);
    // Serialized native actions separate fatal consumption and buff-finish
    // healing. The short protection interval is an authored-note mapping,
    // quantized by this engine; compiled equal-frame ordering is unverified.
    const protection = this.b.addBuff(this.u, { key: PROTECTION, source: this.u,
      flags: { undeadable: true } });
    const seq = this.seq;
    const repair = this.b.after(SWIRE_ECONOMY_CONTRACT.fatalProtectionSeconds, () => {
      if (!this.valid() || this.seq !== seq || this.repair !== repair) return;
      this.repair = null;
      this.b.removeBuff(this.u, protection);
      const healed = this.b.heal(this.u, this.u, this.u.s.maxHp * this.record.fatal.hp_ratio,
        { ignoreHealFree: true });
      this.b.emit('swireFatalRepair', { unit: this.u, cost, healed });
    }, { owner: this.u });
    this.repair = repair;
  }
  clear() {
    this.upkeep?.cancel(); this.repair?.cancel(); this.upkeep = this.repair = null;
    this.b.removeBuff(this.u, STACK); this.b.removeBuff(this.u, PROTECTION);
    this.coins = this.stacks = this.fatalCost = 0; this.active = false; this.seq = null;
  }
  close() {
    this.clear(); this.closed = true;
    for (const h of this.handles) this.b.off(h);
    if (this.u.mem.swireCoinEconomy === this) delete this.u.mem.swireCoinEconomy;
  }
}
