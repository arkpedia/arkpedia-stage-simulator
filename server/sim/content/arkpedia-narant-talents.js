// SPDX-License-Identifier: GPL-3.0-or-later
// Unregistered talent review. Native flags/ranges are pinned in the prefab
// evidence; final-addition and strongest-victim semantics in gameplay notes.
// `hit` is a pre-mitigation bridge, not certified Unity callback ordering.
import evidence from '../../../data/arkpedia-narant-prefabs.json' with { type: 'json' };
import { sourceCandidate } from '../../../shared/arkpedia/summons.js';
import { bodyInKeys } from '../body.js';
import { absoluteRangeKeys, canTargetEnemy } from '../targeting.js';
import { NARANT_ID } from './arkpedia-narant-projectiles.js';

const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const auraKey = 'narant_t_1[hitrate]';
const components = evidence.characters[NARANT_ID].flatMap(o => o.components);
const component = id => {
  const record = components.find(c => c.pathId === id)?.data;
  if (!record) throw Error(`Missing Narantuya talent component ${id}`);
  return record;
};
const stealSources = ['6320898112776202862', '8295920505985985134'].map(component);
if (stealSources.some(s => s._formulaType !== 2 || s._finishTargetBuffWhenInvalid !== 1
  || s._finishOwnerBuffWhenTargetInvalid !== 0)) throw Error('Unreviewed Narantuya steal flags');
const aura = component('8823808515991890542');
if (aura._removeBuffWhenTargetLeave !== 1 || aura._removeBuffWhenAbilityDetached !== 1
  || aura._buffs[0].maxStackCnt !== 1 || aura._buffs[0].independentCharacterSource !== 0)
  throw Error('Unreviewed Narantuya aura ownership');
const rangeId = component('-9119054547283842450')._rangeId;
const auraRange = evidence.tables.ranges[rangeId].grids.map(p => [p.row, p.col]);

export function selectedNarantTalents(build) {
  if (!build || !Number.isInteger(build.elite) || build.elite < 0 || build.elite > 2
    || !Number.isInteger(build.potential) || build.potential < 1 || build.potential > 6
    || !Number.isInteger(build.level) || build.level < 1
    || build.level > evidence.tables.character.phases[build.elite].maxLevel)
    throw Error('Invalid Narantuya talent build');
  return evidence.tables.character.talents.map(t => sourceCandidate(t.candidates, build))
    .map(t => t ? Object.freeze(Object.fromEntries(t.blackboard.map(p => [p.key, p.value]))) : null);
}

// The native hit-rate buff has one shared stack, not one additive penalty per
// Narantuya. Retain every provider for ownership/fallback; one departing owner
// must not remove another owner's still-valid area.
function auraState(b) {
  return b.narantTalentAuras ??= { providers: new Map(), affected: new Set() };
}
function syncAuras(b) {
  const state = auraState(b), providers = [...state.providers.values()].filter(p =>
    !b.finished && live(p.u) && p.u.deploySeq === p.seq);
  for (const e of new Set([...b.enemies, ...state.affected])) {
    const p = live(e) && providers.find(p => canTargetEnemy(p.u, e, { canHitFly: true, ignoreCamou: true })
      && bodyInKeys(e, absoluteRangeKeys(auraRange, p.u.tileR, p.u.tileC, p.u.dir)));
    if (!p) { b.removeBuff(e, auraKey); state.affected.delete(e); continue; }
    state.affected.add(e);
    if (e.findBuff(auraKey)?.source !== p.u) b.addBuff(e, { key: auraKey, source: p.u,
      mods: { hitRatePhys: p.bb.damage_hitrate_physical, hitRateArts: p.bb.damage_hitrate_magical } });
  }
}

export class NarantuyaTalents {
  constructor(battle, unit) {
    if (unit.def.charId !== NARANT_ID) throw Error('Narantuya talents require Narantuya source data');
    this.b = battle; this.u = unit;
    [this.steal, this.evade] = selectedNarantTalents(unit.def.raw.arkpedia);
    this.victimKey = `narant:stolen:${unit.id}`;
    this.ownerKey = `narant:gain:${unit.id}`;
    this.evadeKey = `narant:evade:${unit.id}`;
    this.victims = new Map(); this.gains = { atk: 0, def: 0 }; this.seq = null;
    this.handles = [
      battle.on('hit', ctx => this.hit(ctx), { owner: unit }),
      battle.on('tick', () => { this.cleanupVictims(); syncAuras(battle); }, { owner: unit }),
      battle.on('deploy', ({ unit: u }) => { if (u === unit) this.begin(); }, { owner: unit }),
      battle.on('death', ({ unit: u }) => {
        if (u === unit) this.clear(); else { this.cleanupVictims(); syncAuras(battle); }
      }, { owner: unit }),
      battle.on('battleEnd', () => this.clear(), { owner: unit }),
    ];
    if (live(unit)) this.begin();
  }
  begin() {
    this.clear(); this.seq = this.u.deploySeq;
    if (this.evade) {
      this.b.addBuff(this.u, { key: this.evadeKey, source: this.u,
        mods: { dodgePhys: this.evade.prob, dodgeArts: this.evade.prob } });
      auraState(this.b).providers.set(this.u, { u: this.u, seq: this.seq, bb: this.evade });
      syncAuras(this.b);
    }
  }
  hit({ source, target, dmg }) {
    if (!this.steal || source !== this.u || !live(this.u) || this.seq !== this.u.deploySeq
      || !live(target) || target.side !== 'enemy' || dmg.cancel || dmg.type === 'element'
      || dmg.narantDeployment != null && dmg.narantDeployment !== this.seq) return;
    let record = this.victims.get(target);
    if (!record || record.seq !== target.deploySeq) {
      record = { seq: target.deploySeq, atk: 0, def: 0 };
      this.victims.set(target, record);
    }
    // The victim's available ATK/DEF is not a transfer budget. Own gain and
    // each victim's penalty have independent caps; gains survive victim loss.
    for (const s of stealSources) {
      const stat = s._attributeType === 1 ? 'atk' : 'def';
      const amount = this.steal[`attack@${s._stealOnceBBKey}`];
      const cap = this.steal[`attack@${s._stealMaxBBKey}`];
      record[stat] = Math.min(cap, record[stat] + amount);
      this.gains[stat] = Math.min(cap, this.gains[stat] + amount);
    }
    this.b.addBuff(target, { key: this.victimKey, source: this.u, tags: ['steal-victim'],
      mods: { atkFinalFlat: -record.atk, defFinalFlat: -record.def } });
    this.b.addBuff(this.u, { key: this.ownerKey, source: this.u,
      mods: { atkFinalFlat: this.gains.atk, defFinalFlat: this.gains.def } });
  }
  cleanupVictims() {
    for (const [e, record] of this.victims) if (!live(e) || e.s.flags.untargetable || e.deploySeq !== record.seq) {
      this.b.removeBuff(e, this.victimKey); this.victims.delete(e);
    }
  }
  clear() {
    for (const e of this.victims.keys()) this.b.removeBuff(e, this.victimKey);
    this.victims.clear(); this.gains = { atk: 0, def: 0 }; this.seq = null;
    this.b.removeBuff(this.u, this.ownerKey); this.b.removeBuff(this.u, this.evadeKey);
    auraState(this.b).providers.delete(this.u); syncAuras(this.b);
  }
  dispose() { this.clear(); for (const h of this.handles) this.b.off(h); this.handles = []; }
}
