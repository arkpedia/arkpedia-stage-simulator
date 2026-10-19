// SPDX-License-Identifier: GPL-3.0-or-later
// Misumi Uika (char_4184_dolris), Bard Supporter of Ave Mujica.
// Source: data/arkpedia-native-operators/char_4184_dolris.json and
// data/arkpedia-fever-source.json.
//
// From data: Bard trait (no attack; heals every ally in range for
// atk_to_hp_recovery_ratio of ATK per second; not inspired herself); talent 1
// heal_cd/heal_scale; talent 2 Fever normal_cnt per heal of a member and the
// atk_scale Arts add-on to members' attacks in her range; S1 x-2 range, ATK/DEF
// inspiration and heal_value_s1 per hit taken; S2 interval Arts hit and heal,
// ATK inspiration for the other allies, and no trait healing.
// Declared local mappings:
// - "Lowest HP" means lowest HP ratio among injured allies in range; during a
//   skill the heal prefers Togawa Sakiko when she is injured and in range.
// - S1 inspiration is ATK = attack@atk x her ATK and DEF = attack@def x her DEF.
// - The talent 2 add-on hits each target of a member's attack once, credited to her.
import evidence from '../../../data/arkpedia-native-operators/char_4184_dolris.json' with {type: 'json'};
import review from '../../../data/arkpedia-dolris-runtime-review.json' with {type: 'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {normalizeChess, normSpType} from '../simdata.js';
import {feverOf, FEVER_MEMBERS} from './arkpedia-fever.js';
export const DOLRIS_ID = 'char_4184_dolris';
export const DOLRIS_SKILLS = Object.freeze(['skchr_dolris_1', 'skchr_dolris_2']);
export const selectedDolrisBuild = build => selectedCNSourceBuild(evidence, DOLRIS_ID, build);
const ID = DOLRIS_ID, SAKIKO = 'char_4182_oblvns', live = u => !!u?.alive && u.deployed && !u.hidden;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function reviewed(b) {
  const approved = same(review.enabledOperators, [ID]) && review.verification.browser.status === 'passed';
  const candidate = b.regularReviewCandidates?.includes(ID) && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !candidate) || review.frameParity !== false || review.moduleSupport !== false
    || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-dolris-bard-inspire-fever-v1')
    throw Error('Missing Uika runtime review or explicit held browser candidate');
}
export function selectedDolrisInputs(unit) {
  const skill = unit.def.skill, build = unit.def.raw.arkpedia;
  if (!skill) throw Error('Incomplete original selected Uika inputs');
  const s = selectedDolrisBuild({...build, skillId: skill.id});
  if (unit.def.charId !== ID || !same(unit.def.stats, normalizeChess({stats: s.stats}).stats) || !same(unit.rangeGrid, s.rangeGrid)
    || !same(unit.def.talents.map(t => t.bb), s.talentBb) || !same(skill.bb, s.bb) || !same(skill.rangeGrid ?? [], s.skillRangeGrid)
    || skill.spType !== normSpType(s.source.spData.spType) || skill.spCost !== s.source.spData.spCost
    || skill.initSp !== s.source.spData.initSp || skill.duration !== s.source.duration)
    throw Error('Incomplete original selected Uika inputs');
  return s;
}
const talent = (u, key) => u.def.talents.find(t => t.bb[key] != null)?.bb;
const model = () => evidence.models[ID].Single;
class DolrisOwner {
  constructor(b, u) {
    if (!model()?.durations.Skill_1_Loop || !model().durations.Skill_2_Loop) throw Error('Changed original Uika clips');
    Object.assign(this, {b, u, record: selectedDolrisInputs(u), seq: null, handles: [], inspired: new Set(), nextHeal: 0});
  }
  valid() { return live(this.u) && this.u.deploySeq === this.seq && this.u.mem.dolrisOwner === this; }
  mode() { return this.u.skill?.active ? DOLRIS_SKILLS.indexOf(this.u.skill.id) + 1 : 0; }
  allies() { if (this.b.rangeChanged(this.u)) this.b._refreshRange(this.u); return this.b.alliesInGrid(this.u).filter(live); }
  enemies() { return this.b.enemiesInKeys(this.u.rangeKeys, this.u, {canHitFly: true}).filter(e => live(e) && e.side === 'enemy'); }
  lowest() {
    const hurt = this.allies().filter(a => a.hp < a.s.maxHp);
    const sakiko = this.mode() ? hurt.find(a => a.defId === SAKIKO) : null;
    return sakiko ?? hurt.sort((x, y) => x.hp / x.s.maxHp - y.hp / y.s.maxHp)[0] ?? null;
  }
  heal(t, amount) { if (live(t) && amount > 0) this.b.heal(this.u, t, amount, {tags: ['dolris']}); }
  // Bard trait (not during S2) and talent 1, once per second / heal_cd.
  tick() {
    if (!this.valid() || !this.u.canAct) return;
    const n = this.mode(), {b, u} = this;
    if (n !== 2 && b.time + 1e-9 >= (this.traitAt ?? 0)) {
      this.traitAt = b.time + 1;
      const ratio = u.def.trait?.bb?.atk_to_hp_recovery_ratio ?? .1;
      for (const a of this.allies()) if (a.hp < a.s.maxHp) b.heal(u, a, u.s.atk * ratio, {aura: true});
    }
    const t1 = talent(u, 'attack@heal_cd');
    if (t1 && n === 0 && b.time + 1e-9 >= this.nextHeal) {
      const t = this.lowest();
      if (t) { this.heal(t, u.s.atk * t1['attack@heal_scale']); this.nextHeal = b.time + t1['attack@heal_cd']; }
    }
    this.syncInspire();
  }
  syncInspire() {
    const {b, u} = this, n = this.mode(), bb = u.skill?.bb ?? {}, key = `dolris:inspire:${u.id}`;
    const inside = new Set(n ? this.allies() : []);
    for (const a of b.allyUnits) {
      const ok = n && inside.has(a) && a !== u && a.def.subProf !== 'bard' && !a.findBuff('immune_to_encourage');
      if (!ok) { if (a.findBuff(key)) b.removeBuff(a, key); this.inspired.delete(a); continue; }
      const mods = n === 1 ? {atkFinalFlat: u.s.atk * bb['attack@atk'], defFinalFlat: u.s.def * bb['attack@def']} : {atkFinalFlat: u.s.atk * bb['attack@atk']};
      const old = a.findBuff(key);
      if (!old || Object.keys(mods).some(k => old.mods[k] !== mods[k])) {
        b.addBuff(a, {key, source: u, tags: ['inspire'], mods, data: {inspirePriority: n === 1 ? {atkFinalFlat: bb['attack@atk'], defFinalFlat: bb['attack@def']} : {atkFinalFlat: bb['attack@atk']}}});
        this.inspired.add(a);
      }
    }
  }
  pulse() {
    const {b, u} = this, bb = u.skill.bb;
    const es = this.enemies(), e = es[Math.floor(b.rng() * es.length)];
    if (e) b.dealDamage(u, e, {amount: u.s.atk * u.s.atkScaleMul * bb['attack@atk_scale'], type: 'arts', isSkill: true, applyWay: 'ranged', tags: ['dolris', 'dolris:s2']});
    const t = this.lowest();
    if (t) this.heal(t, u.s.atk * bb['attack@heal_scale']);
  }
  install() {
    const {b, u} = this;
    u.mem.dolrisOwner = this;
    const fever = feverOf(b), t2 = talent(u, 'normal_cnt');
    this.handles = [
      b.on('deploy', ({unit, move}) => { if (unit === u && !move) { this.seq = u.deploySeq; this.traitAt = b.time + 1; this.nextHeal = b.time; } }, {owner: u}),
      b.on('tick', () => this.tick(), {owner: u}),
      b.on('heal', ({source, target, amount}) => {
        if (source === u && t2 && amount > 0 && target?.kind === 'op' && FEVER_MEMBERS.includes(target.defId) && this.valid()) fever.add(u, t2.normal_cnt);
      }, {owner: u}),
      b.on('attack', ({attacker, targets}) => {
        if (!t2?.atk_scale || !this.valid() || attacker === u || !FEVER_MEMBERS.includes(attacker?.defId) || attacker.side !== 'ally') return;
        if (!this.allies().includes(attacker)) return;
        for (const t of targets) if (live(t) && t.side === 'enemy') b.dealDamage(u, t, {amount: u.s.atk * t2.atk_scale, type: 'arts', applyWay: 'ranged', tags: ['dolris', 'dolris:talent']});
      }, {owner: u}),
      b.on('damaged', ({target, amount}) => {
        if (this.mode() === 1 && amount > 0 && this.inspired.has(target) && this.valid()) this.heal(target, u.skill.bb['attack@heal_value_s1']);
      }, {owner: u}),
      b.on('death', ({unit}) => { if (unit === u) this.stop(); }, {owner: u}),
      b.on('battleEnd', () => this.stop(), {owner: u}),
    ];
  }
  stop() {
    this.pulseHandle?.cancel(); this.pulseHandle = null;
    const key = `dolris:inspire:${this.u.id}`;
    for (const a of this.inspired) if (a.findBuff(key)) this.b.removeBuff(a, key);
    this.inspired.clear();
  }
}
export function customizeDolrisKit({battle: b, id, unit: u, kit}) {
  if (id !== ID) return;
  reviewed(b);
  if (!DOLRIS_SKILLS.includes(u.def.skill?.id)) throw Error('Missing original selected Uika skill');
  const owner = new DolrisOwner(b, u), s = u.def.skill, n = DOLRIS_SKILLS.indexOf(s.id) + 1;
  u.mem.dolrisPrepared = owner;
  kit.talents = [];
  // The owner replaces the generic Bard heal so S2 can switch it off.
  kit.trait = {...kit.trait, install: null};
  kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration,
    targeting: n === 1 ? {rangeGrid: owner.record.skillRangeGrid} : null,
    onStart: () => {
      u.mem.regularFormVisual = {clip: `Skill_${n}_Loop`, loop: true, replace: true};
      if (n === 2) {
        owner.pulseHandle?.cancel();
        owner.pulseHandle = b.every(u.skill.bb.interval, () => { if (owner.valid() && u.skill.active) owner.pulse(); }, {owner: u});
      }
      owner.syncInspire();
    },
    onEnd: () => {
      owner.pulseHandle?.cancel(); owner.pulseHandle = null; owner.nextHeal = b.time;
      u.mem.regularFormVisual = {clip: `Skill_${n}_End`, playId: `dolris:end:${b.time}`};
      owner.syncInspire();
    }};
}
export function installDolris({battle: b, unit: u, def}) {
  if (def.charId !== ID) return;
  reviewed(b);
  const owner = u.mem.dolrisPrepared;
  if (!owner) throw Error('Missing selected Uika owner');
  delete u.mem.dolrisPrepared; owner.install();
}
