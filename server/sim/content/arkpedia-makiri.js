// SPDX-License-Identifier: GPL-3.0-or-later
// Matsukiri (char_4199_makiri), "counsellor" Vanguard.
// Source: data/arkpedia-native-operators/char_4199_makiri.json.
//
// From data: blocks two; ordinary Physical melee at the Attack clip event;
// talent `interval` s on the field, once: Defenders and Supporters on the
// field and in the deployment zone ATK +`atk`; S1 (auto) `cost` DP at once
// and the rightmost `cnt` deployment-zone card(s) cost `value`; S2 (manual,
// 15 s) `value` DP over the skill at `interval`, ATK/HP regen from
// makiri_s_2[passive], and on start Defender/Supporter cards cost
// `cost_decrease` plus +`max_hp` max HP (up to `max_stack_cnt` stacks, until
// their next retreat).
// Declared local mappings:
// - "Rightmost card" is the last undeployed operator card in this simulator's
//   shelf order. Card discounts last until that operator next deploys.
// - The talent ATK lasts for the rest of the battle; a card in the deployment
//   zone receives it when deployed.
// - S2's max HP stacks apply when those operators next deploy, and clear when
//   they retreat. A full-duration S2 delivers any DP left of `value` as it ends.
import evidence from '../../../data/arkpedia-native-operators/char_4199_makiri.json' with {type: 'json'};
import review from '../../../data/arkpedia-makiri-runtime-review.json' with {type: 'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {normalizeChess, normSpType} from '../simdata.js';
export const MAKIRI_ID = 'char_4199_makiri';
export const MAKIRI_SKILLS = Object.freeze(['skchr_makiri_1', 'skchr_makiri_2']);
export const selectedMakiriBuild = build => selectedCNSourceBuild(evidence, MAKIRI_ID, build);
const ID = MAKIRI_ID, live = u => !!u?.alive && u.deployed && !u.hidden;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ELIGIBLE = new Set(['TANK', 'SUPPORT']);
function reviewed(b) {
  const approved = same(review.enabledOperators, [ID]) && review.verification.browser.status === 'passed';
  const candidate = b.regularReviewCandidates?.includes(ID) && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !candidate) || review.frameParity !== false || review.moduleSupport !== false
    || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-makiri-dp-and-card-discounts-v1')
    throw Error('Missing Matsukiri runtime review or explicit held browser candidate');
}
export function selectedMakiriInputs(unit) {
  const skill = unit.def.skill, build = unit.def.raw.arkpedia;
  if (!skill) throw Error('Incomplete original selected Matsukiri inputs');
  const s = selectedMakiriBuild({...build, skillId: skill.id});
  if (unit.def.charId !== ID || !same(unit.def.stats, normalizeChess({stats: s.stats}).stats) || !same(unit.rangeGrid, s.rangeGrid)
    || !same(unit.def.talents.map(t => t.bb), s.talentBb) || !same(skill.bb, s.bb)
    || skill.spType !== normSpType(s.source.spData.spType) || skill.spCost !== s.source.spData.spCost || skill.initSp !== s.source.spData.initSp)
    throw Error('Incomplete original selected Matsukiri inputs');
  return s;
}
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => u.base.bat / u.s.interval;
const profession = (b, id) => b.data.getChess(id)?.profession;
class MakiriOwner {
  constructor(b, u) {
    Object.assign(this, {b, u, record: selectedMakiriInputs(u), seq: null, handles: [], talentGiven: false});
    b._makiriTalent ??= new Map(); b._makiriHp ??= new Map();
  }
  valid() { return live(this.u) && this.u.deploySeq === this.seq && this.u.mem.makiriOwner === this; }
  cards() { return Object.entries(this.b.bench).filter(([, e]) => !e.unit?.alive && e.kind !== 'token').map(([id]) => id); }
  discount(ids, delta) { for (const id of ids) { const e = this.b.bench[id]; if (e) e.costDelta = (e.costDelta ?? 0) + delta; } }
  applyTalent(a) {
    const atk = this.b._makiriTalent.get(a.defId);
    if (atk && live(a) && !a.findBuff('makiri:t1')) this.b.addBuff(a, {key: 'makiri:t1', source: this.u, persist: true, mods: {atkPct: atk}});
  }
  applyHp(a) {
    const stacks = this.b._makiriHp.get(a.defId);
    if (stacks && live(a)) this.b.addBuff(a, {key: 'makiri:s2-hp', source: this.u, mods: {hpPct: stacks.value * stacks.n}});
  }
  install() {
    const {b, u} = this;
    u.mem.makiriOwner = this;
    const t = u.def.talents.find(x => x.bb.interval != null)?.bb;
    this.handles = [
      b.on('deploy', ({unit, move}) => {
        if (move) return;
        if (unit === u) { this.seq = u.deploySeq; this.deployedAt = b.time; }
        if (unit !== u && unit?.kind === 'op') { this.applyTalent(unit); this.applyHp(unit); }
      }, {owner: u}),
      b.on('tick', () => {
        if (!this.valid() || this.talentGiven || !t || b.time + 1e-9 < this.deployedAt + t.interval) return;
        this.talentGiven = true;
        // Once: every Defender/Supporter on the field and in the deployment zone.
        for (const id of Object.keys(b.bench)) if (ELIGIBLE.has(profession(b, id))) b._makiriTalent.set(id, Math.max(t.atk, b._makiriTalent.get(id) ?? 0));
        for (const a of b.allyUnits) if (a.kind === 'op' && ELIGIBLE.has(a.def.profession)) this.applyTalent(a);
      }, {owner: u}),
      b.on('death', ({unit}) => { if (unit?.kind === 'op' && b._makiriHp.has(unit.defId)) b._makiriHp.delete(unit.defId); }, {owner: u}),
    ];
  }
}
export function customizeMakiriKit({battle: b, id, unit: u, kit}) {
  if (id !== ID) return;
  reviewed(b);
  if (!MAKIRI_SKILLS.includes(u.def.skill?.id)) throw Error('Missing original selected Matsukiri skill');
  const owner = new MakiriOwner(b, u), s = u.def.skill, n = MAKIRI_SKILLS.indexOf(s.id) + 1;
  u.mem.makiriPrepared = owner;
  kit.talents = [];
  kit.trait = {...kit.trait, windup: (_b, a) => model(a).hits.Attack[0] / rate(a), attackVisual: () => 'Attack',
    canAttack: (bb, a) => !bb.isUnitInBornState(a)};
  if (n === 1) kit.skill = {id: s.id, name: s.name, kind: 'instant', trigger: 'SP_FULL',
    onStart: () => {
      const bb = u.skill.bb;
      b.addDp('arkpedia', bb.cost);
      owner.discount(owner.cards().slice(-bb.cnt), bb.value);
    }};
  else kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration,
    mods: {atkPct: s.bb['makiri_s_2[passive].atk']},
    onStart: () => {
      const bb = u.skill.bb;
      owner.discount(owner.cards().filter(id => ELIGIBLE.has(profession(b, id))), bb.cost_decrease);
      for (const id of owner.cards().filter(id => ELIGIBLE.has(profession(b, id)))) {
        const st = b._makiriHp.get(id) ?? {value: bb.max_hp, n: 0};
        st.n = Math.min(bb.max_stack_cnt, st.n + 1); b._makiriHp.set(id, st);
      }
      u.mem.regularFormVisual = {clip: 'Skill_Loop', loop: true, replace: true};
      owner.given = 0;
      owner.dpTick?.cancel();
      owner.dpTick = b.every(bb.interval, () => {
        if (!owner.valid() || !u.skill.active || owner.given >= bb.value) { owner.dpTick?.cancel(); return; }
        b.addDp('arkpedia', 1); owner.given++;
        b.heal(u, u, u.s.maxHp * bb['makiri_s_2[passive].hp_recovery_per_sec_by_max_hp_ratio'] * bb.interval, {self: true});
      }, {owner: u});
    },
    onEnd: ({reason}) => {
      // A skill that runs its full duration delivers its whole `value` DP.
      if (reason === 'duration' && owner.valid()) b.addDp('arkpedia', Math.max(0, u.skill.bb.value - owner.given));
      owner.dpTick?.cancel(); owner.dpTick = null; u.mem.regularFormVisual = {clip: 'Skill_End', playId: `makiri:end:${b.time}`}; }};
}
export function installMakiri({battle: b, unit: u, def}) {
  if (def.charId !== ID) return;
  reviewed(b);
  const owner = u.mem.makiriPrepared;
  if (!owner) throw Error('Missing selected Matsukiri owner');
  delete u.mem.makiriPrepared; owner.install();
}
