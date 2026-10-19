// SPDX-License-Identifier: GPL-3.0-or-later
// Zinogre S Catapult (char_1049_catap2), Mercenary Guard.
// Source: data/arkpedia-native-operators/char_1049_catap2.json.
//
// From data: Mercenary skills are paid in DP (`cost`) on a manual cast and
// store maxChargeTime charges; ordinary hit at the Attack clip event. Talent
// (catap2_s1/s2[trigger]): a cast consumes every stored charge, layers =
// floor(remaining SP / spCost) + 1, extends the skill by duration x
// extend_duration_ratio_each x layers, and stacks catap2_s[atk_equip] ATK per
// layer; skill attacks use the skill range. S1: base attack time +1.0, the
// attack alternates the five-hit Skill_1_Loop_A and ten-hit Skill_1_Loop_B on
// every blocked enemy, each hit adding atk_magic x ATK Arts (catap2_s1[mag_dmg]);
// the Skill_1_Begin morph slash lands five hits at its clip events. S2: ATK/DEF,
// a single-hit Skill_2_Begin morph slash with s2_damage_resistance during it,
// alternating single-hit A/B attacks, and while active a retrigger_cost DP
// Equipment Adaptation (Skill_2_Overload, three events): the first deals
// attack@extra_physic_atk_scale Physical and one attack@extra_magic_atk_scale
// Arts hit, the second adds Arts hits for layers >= 2 and >= 3, the third for
// layers >= 4 and >= 5 (catap2_s2[extra_dmg]); the skill then ends.
// Declared local mappings:
// - The prefab selector ranges carry no fields. Morph slashes and the
//   Physical adaptation hit strike blocked enemies and the tile ahead; the
//   k-th Arts adaptation hit strikes every enemy up to k tiles ahead.
// - Each multi-hit attack lands its later hits at their own clip events after
//   the first, on the enemies she blocks at that moment.
import evidence from '../../../data/arkpedia-native-operators/char_1049_catap2.json' with {type: 'json'};
import review from '../../../data/arkpedia-catap2-runtime-review.json' with {type: 'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {normalizeChess} from '../simdata.js';
import {canSpendDp, spendDp} from './arkpedia-dp-budget.js';
export const CATAP2_ID = 'char_1049_catap2';
export const CATAP2_SKILLS = Object.freeze(['skchr_catap2_1', 'skchr_catap2_2']);
export const selectedCatap2Build = build => selectedCNSourceBuild(evidence, CATAP2_ID, build);
const ID = CATAP2_ID, live = u => !!u?.alive && u.deployed && !u.hidden;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function reviewed(b) {
  const approved = same(review.enabledOperators, [ID]) && review.verification.browser.status === 'passed';
  const candidate = b.regularReviewCandidates?.includes(ID) && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !candidate) || review.frameParity !== false || review.moduleSupport !== false
    || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-catap2-mercenary-layers-v1')
    throw Error('Missing Zinogre S Catapult runtime review or explicit held browser candidate');
}
export function selectedCatap2Inputs(unit) {
  const skill = unit.def.skill, build = unit.def.raw.arkpedia;
  if (!skill) throw Error('Incomplete original selected Zinogre S Catapult inputs');
  const s = selectedCatap2Build({...build, skillId: skill.id});
  if (unit.def.charId !== ID || !same(unit.def.stats, normalizeChess({stats: s.stats}).stats) || !same(unit.rangeGrid, s.rangeGrid)
    || !same(unit.def.talents.map(t => t.bb), s.talentBb) || !same(skill.bb, s.bb) || skill.spCost !== s.source.spData.spCost)
    throw Error('Incomplete original selected Zinogre S Catapult inputs');
  return s;
}
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => u.base.bat / u.s.interval;
const talent = u => u.def.talents.find(t => t.bb.extend_duration_ratio_each != null)?.bb ?? {};
const front = u => ({UP: [1, 0], DOWN: [-1, 0], LEFT: [0, -1], RIGHT: [0, 1]})[u.dir];
class Catap2Owner {
  constructor(b, u) { Object.assign(this, {b, u, record: selectedCatap2Inputs(u), seq: null, handles: [], layers: 0, combo: 0, adapting: false, epoch: 0}); }
  valid() { return live(this.u) && this.u.deploySeq === this.seq && this.u.mem.catap2Owner === this; }
  n() { return CATAP2_SKILLS.indexOf(this.u.skill?.id) + 1; }
  blocked() { return this.b.enemies.filter(e => live(e) && e.blockedBy === this.u); }
  // Enemies on her tile and up to `depth` tiles ahead in her lane.
  ahead(depth) {
    const {u} = this, [dr, dc] = front(u);
    return this.b.enemies.filter(e => {
      if (!live(e) || e.s.flags.untargetable) return false;
      const along = (e.y - u.y) * dr + (e.x - u.x) * dc, across = Math.abs((e.y - u.y) * dc - (e.x - u.x) * dr);
      return across <= .5 && along >= -.5 && along <= depth + .5;
    });
  }
  hit(e, amount, type, tag) {
    if (live(e)) this.b.dealDamage(this.u, e, {amount, type, applyWay: type === 'phys' ? 'melee' : 'none', isSkill: true, tags: ['catap2', `catap2:${tag}`]});
  }
  // One physical skill hit with its S1 Arts rider.
  strike(targets, tag) {
    const {u} = this, bb = u.skill.bb;
    for (const e of targets) {
      this.hit(e, u.s.atk, 'phys', tag);
      if (this.n() === 1) this.hit(e, u.s.atk * bb.atk_magic, 'arts', 's1-magic');
    }
  }
  begin() {
    const {b, u} = this, bb = u.skill.bb, t = talent(u), n = this.n();
    this.epoch++;
    spendDp(b, u.ownerId, bb.cost);
    // Every stored charge is consumed.
    this.layers = Math.floor(u.skill.spTotal / u.skill.spCost + 1e-9) + 1;
    // (setSpTotal refuses while a timed skill runs.)
    u.skill.charges = 0; u.skill.sp = 0;
    u.skill.timeLeft += u.skill.duration * (t.extend_duration_ratio_each ?? 0) * this.layers;
    const atk = t['catap2_s[atk_equip].atk'] ?? 0;
    if (atk) b.addBuff(u, {key: `catap2:atk-equip:${u.id}`, source: u, mods: {atkPct: atk * this.layers}});
    // Morph slash at the Begin clip events; no ordinary attacks until it ends.
    const clip = `Skill_${n}_Begin`, events = model(u).hits[clip];
    b.addBuff(u, {key: 'catap2:begin', source: u, duration: model(u).durations[clip], timeLeft: model(u).durations[clip], flags: {disarm: true},
      ...(n === 2 ? {mods: {physTakenMul: 1 - t.s2_damage_resistance, artsTakenMul: 1 - t.s2_damage_resistance}} : {})});
    u.mem.regularFormVisual = {clip, playId: `catap2:${u.id}:${this.epoch}`};
    const epoch = this.epoch;
    for (const at of events) b.after(at, () => {
      if (this.valid() && this.epoch === epoch && u.skill?.active) this.strike([...new Set([...this.blocked(), ...this.ahead(1)])], 'morph');
    }, {owner: u});
    b.after(model(u).durations[clip], () => {
      if (this.valid() && this.epoch === epoch && u.skill?.active && !this.adapting)
        u.mem.regularFormVisual = {clip: `Skill_${n}_Idle`, loop: true};
    }, {owner: u});
  }
  end() {
    this.epoch++; this.adapting = false;
    this.b.removeBuff(this.u, `catap2:atk-equip:${this.u.id}`); this.b.removeBuff(this.u, 'catap2:begin');
    this.u.mem.regularFormVisual = null;
  }
  // S2 Equipment Adaptation.
  canAdapt() {
    const {b, u} = this;
    return this.valid() && this.n() === 2 && !!u.skill?.active && !this.adapting && !u.findBuff('catap2:begin')
      && u.canAct && canSpendDp(b, u.ownerId, u.skill.bb.retrigger_cost);
  }
  adapt() {
    if (!this.canAdapt()) return false;
    const {b, u} = this, bb = u.skill.bb, clip = 'Skill_2_Overload', events = model(u).hits[clip], epoch = this.epoch;
    spendDp(b, u.ownerId, bb.retrigger_cost);
    this.adapting = true;
    b.addBuff(u, {key: 'catap2:adapt', source: u, duration: model(u).durations[clip], timeLeft: model(u).durations[clip], flags: {disarm: true}});
    u.mem.regularFormVisual = {clip, playId: `catap2:adapt:${u.id}:${epoch}`};
    const magic = k => { for (const e of this.ahead(k)) this.hit(e, u.s.atk * bb['attack@extra_magic_atk_scale'], 'arts', 's2-adapt-magic'); };
    const waves = [[() => { for (const e of new Set([...this.blocked(), ...this.ahead(1)])) this.hit(e, u.s.atk * bb['attack@extra_physic_atk_scale'], 'phys', 's2-adapt-physic'); }, () => magic(1)],
      [() => this.layers >= 2 && magic(2), () => this.layers >= 3 && magic(3)], [() => this.layers >= 4 && magic(4), () => this.layers >= 5 && magic(5)]];
    events.forEach((at, i) => b.after(at, () => { if (this.valid() && this.epoch === epoch && this.adapting) for (const f of waves[i]) f(); }, {owner: u}));
    b.after(model(u).durations[clip], () => { if (this.valid() && this.epoch === epoch && u.skill?.active) u.skill.end('adaptation'); }, {owner: u});
    return true;
  }
  install() {
    const {b, u} = this;
    u.mem.catap2Owner = this;
    this.secondary = {id: 'catap2-adaptation', label: 'Equipment Adaptation', cost: () => u.skill?.bb.retrigger_cost, available: () => this.canAdapt(), run: () => this.adapt()};
    if (this.n() === 2) u.mem.regularSecondaryAction = this.secondary;
    this.handles = [
      b.on('deploy', ({unit, move}) => { if (unit === u && !move) this.seq = u.deploySeq; }, {owner: u}),
      b.on('death', ({unit}) => { if (unit === u) this.end(); }, {owner: u}),
    ];
  }
}
export function customizeCatap2Kit({battle: b, id, unit: u, kit}) {
  if (id !== ID) return;
  reviewed(b);
  if (!CATAP2_SKILLS.includes(u.def.skill?.id)) throw Error('Missing original selected Zinogre S Catapult skill');
  const owner = new Catap2Owner(b, u), s = u.def.skill, n = CATAP2_SKILLS.indexOf(s.id) + 1;
  u.mem.catap2Prepared = owner;
  kit.talents = [];
  kit.trait = {...kit.trait, windup: (_b, a) => model(a).hits.Attack[0] / rate(a), attackVisual: () => 'Attack',
    canAttack: (bb, a) => !bb.isUnitInBornState(a)};
  const loop = () => `Skill_${n}_Loop_${owner.combo % 2 ? 'B' : 'A'}`;
  kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration,
    mods: n === 1 ? {batFlat: s.bb.base_attack_time} : {atkPct: s.bb.atk, defPct: s.bb.def},
    canActivate: () => canSpendDp(b, u.ownerId, s.bb.cost),
    targeting: {rangeGrid: owner.record.skillRangeGrid},
    onStart: () => owner.begin(), onEnd: () => owner.end(),
    attack: {hitAllBlocked: true, attackVisual: () => loop(), windup: (_b, a) => model(a).hits[loop()][0] / rate(a),
      onEachHit: ({target, kind, attackId}) => {
        if (n === 1 && live(target)) owner.hit(target, u.s.atk * u.skill.bb.atk_magic, 'arts', 's1-magic');
        if (kind !== 'main' || owner.lastAttack === attackId) return;
        owner.lastAttack = attackId;
        const clip = loop(), events = model(u).hits[clip], epoch = owner.epoch;
        events.slice(1).forEach(t => b.after((t - events[0]) / rate(u), () => {
          if (owner.valid() && owner.epoch === epoch && u.skill?.active) owner.strike(owner.blocked(), 'combo');
        }, {owner: u}));
      },
      afterAttack: () => { owner.combo++; }}};
}
export function installCatap2({battle: b, unit: u, def}) {
  if (def.charId !== ID) return;
  reviewed(b);
  const owner = u.mem.catap2Prepared;
  if (!owner) throw Error('Missing selected Zinogre S Catapult owner');
  delete u.mem.catap2Prepared; owner.install();
}
