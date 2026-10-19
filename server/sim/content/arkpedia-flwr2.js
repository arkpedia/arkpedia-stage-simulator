// SPDX-License-Identifier: GPL-3.0-or-later
// Perfumer the Distilled (char_1022_flwr2), Abjurer Supporter.
// Source: data/arkpedia-native-operators/char_1022_flwr2.json.
//
// From data: Abjurer trait (Arts attacks; while a skill is active she heals
// allies for heal_scale x ATK instead); ordinary hit at the Attack clip event;
// talent Sanctuary damage_resistance for allies in range (not herself) whose
// HP ratio is at or below hers; S1 (auto, two charges) an immediate heal of
// heal_scale x ATK and DEF +def for `duration` s (non-stacking); S2 (passive)
// ASPD +attack_speed, talent Sanctuary x talent_scale, and each heal gives
// ATK +attack@atk for attack@buff_duration s with attack@hp_ratio max HP lost
// per second (non-stacking, cannot kill).
// Declared local mappings:
// - Heal targets are the injured ally in range with the lowest HP ratio.
// - S2 is passive, so she heals for the whole battle when S2 is selected.
import evidence from '../../../data/arkpedia-native-operators/char_1022_flwr2.json' with {type: 'json'};
import review from '../../../data/arkpedia-flwr2-runtime-review.json' with {type: 'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {normalizeChess, normSpType} from '../simdata.js';
import {STATUS} from '../buffs.js';
export const FLWR2_ID = 'char_1022_flwr2';
export const FLWR2_SKILLS = Object.freeze(['skchr_flwr2_1', 'skchr_flwr2_2']);
export const selectedFlwr2Build = build => selectedCNSourceBuild(evidence, FLWR2_ID, build);
const ID = FLWR2_ID, live = u => !!u?.alive && u.deployed && !u.hidden;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function reviewed(b) {
  const approved = same(review.enabledOperators, [ID]) && review.verification.browser.status === 'passed';
  const candidate = b.regularReviewCandidates?.includes(ID) && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !candidate) || review.frameParity !== false || review.moduleSupport !== false
    || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-flwr2-abjurer-sanctuary-v1')
    throw Error('Missing Perfumer the Distilled runtime review or explicit held browser candidate');
}
export function selectedFlwr2Inputs(unit) {
  const skill = unit.def.skill, build = unit.def.raw.arkpedia;
  if (!skill) throw Error('Incomplete original selected Perfumer the Distilled inputs');
  const s = selectedFlwr2Build({...build, skillId: skill.id});
  if (unit.def.charId !== ID || !same(unit.def.stats, normalizeChess({stats: s.stats}).stats) || !same(unit.rangeGrid, s.rangeGrid)
    || !same(unit.def.talents.map(t => t.bb), s.talentBb) || !same(skill.bb, s.bb) || skill.spCost !== s.source.spData.spCost)
    throw Error('Incomplete original selected Perfumer the Distilled inputs');
  return s;
}
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => u.base.bat / u.s.interval;
class Flwr2Owner {
  constructor(b, u) { Object.assign(this, {b, u, record: selectedFlwr2Inputs(u), seq: null, handles: [], covered: new Set()}); }
  valid() { return live(this.u) && this.u.deploySeq === this.seq && this.u.mem.flwr2Owner === this; }
  allies() { if (this.b.rangeChanged(this.u)) this.b._refreshRange(this.u); return this.b.alliesInGrid(this.u).filter(live); }
  lowest() { return this.allies().filter(a => a.hp < a.s.maxHp && !a.s.flags.healFree).sort((a, c) => a.hpRatio - c.hpRatio)[0] ?? null; }
  // Talent: Sanctuary for allies in range (not herself) at or below her HP ratio.
  syncSanctuary() {
    const {b, u} = this, t = u.def.talents.find(x => x.bb.damage_resistance != null)?.bb, key = `flwr2:sanctuary:${u.id}`;
    const scale = u.skill?.id === FLWR2_SKILLS[1] ? u.skill.bb.talent_scale : 1;
    const inside = new Set(this.valid() && t ? this.allies() : []);
    for (const a of b.allyUnits) {
      const ok = inside.has(a) && a !== u && a.hpRatio <= u.hpRatio + 1e-9;
      if (!ok) { if (a.findBuff(key)) b.removeBuff(a, key); this.covered.delete(a); continue; }
      const mods = STATUS.sanctuary.mods(t.damage_resistance * scale), old = a.findBuff(key);
      if (!old || old.mods.physTakenMul !== mods.physTakenMul) { b.addBuff(a, {key, source: u, status: 'sanctuary', mods}); this.covered.add(a); }
    }
  }
  healEffect(target) {
    const {b, u} = this, bb = u.skill?.bb ?? {};
    if (u.skill?.id !== FLWR2_SKILLS[1] || !live(target)) return;
    const key = `flwr2:s2:${u.id}`, d = bb['attack@buff_duration'];
    b.addBuff(target, {key, source: u, duration: d, timeLeft: d, refresh: 'replace', interval: 1, mods: {atkPct: bb['attack@atk']},
      onTick: ({unit}) => { if (live(unit) && unit.hp > 1) unit.hp = Math.max(1, unit.hp - unit.s.maxHp * bb['attack@hp_ratio']); }});
  }
  install() {
    const {b, u} = this;
    u.mem.flwr2Owner = this;
    this.handles = [
      b.on('deploy', ({unit, move}) => { if (unit === u && !move) this.seq = u.deploySeq; }, {owner: u}),
      b.on('tick', () => this.syncSanctuary(), {owner: u}),
      b.on('heal', ({source, target}) => { if (source === u && this.valid()) this.healEffect(target); }, {owner: u}),
      b.on('death', ({unit}) => { if (unit === u) this.stop(); }, {owner: u}),
      b.on('battleEnd', () => this.stop(), {owner: u}),
    ];
  }
  stop() { const key = `flwr2:sanctuary:${this.u.id}`; for (const a of this.covered) if (a.findBuff(key)) this.b.removeBuff(a, key); this.covered.clear(); }
}
export function customizeFlwr2Kit({battle: b, id, unit: u, kit}) {
  if (id !== ID) return;
  reviewed(b);
  if (!FLWR2_SKILLS.includes(u.def.skill?.id)) throw Error('Missing original selected Perfumer the Distilled skill');
  const owner = new Flwr2Owner(b, u), s = u.def.skill, n = FLWR2_SKILLS.indexOf(s.id) + 1;
  const healScale = u.def.trait?.bb?.heal_scale ?? .75;
  u.mem.flwr2Prepared = owner;
  kit.talents = [];
  const timing = {windup: (_b, a) => model(a).hits.Attack[0] / rate(a), attackVisual: () => 'Attack', canAttack: (bb, a) => !bb.isUnitInBornState(a)};
  kit.trait = {...kit.trait, ...timing, dmgType: 'arts', attack: 'ranged', projectile: kit.trait?.projectile ?? 'orb'};
  // Abjurer: healing replaces attacking while a skill is active.
  const heal = {dmgType: 'heal', heal: {mode: 'single'}, atkScale: healScale, windup: (_b, a) => model(a).hits[n === 2 ? 'Skill_2' : 'Attack'][0] / rate(a)};
  if (n === 1) kit.skill = {id: s.id, name: s.name, kind: 'instant', trigger: 'SP_FULL',
    canActivate: () => !!owner.lowest(),
    onStart: () => {
      const bb = u.skill.bb, t = owner.lowest();
      u.mem.regularFormVisual = {clip: 'Skill_1', playId: `flwr2:s1:${b.time}`};
      if (!t) return;
      b.heal(u, t, u.s.atk * bb.heal_scale);
      b.addBuff(t, {key: `flwr2:s1:${u.id}`, source: u, duration: bb.duration, timeLeft: bb.duration, refresh: 'replace', mods: {defPct: bb.def}});
    }};
  else kit.skill = {id: s.id, name: s.name, kind: 'passive', mods: {aspd: s.bb.attack_speed}, attack: heal};
}
export function installFlwr2({battle: b, unit: u, def}) {
  if (def.charId !== ID) return;
  reviewed(b);
  const owner = u.mem.flwr2Prepared;
  if (!owner) throw Error('Missing selected Perfumer the Distilled owner');
  delete u.mem.flwr2Prepared; owner.install();
}
