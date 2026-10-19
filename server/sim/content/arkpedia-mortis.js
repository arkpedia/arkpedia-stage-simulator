// SPDX-License-Identifier: GPL-3.0-or-later
// Wakaba Mutsumi (char_4183_mortis), Dollkeeper Specialist of Ave Mujica.
// Source: data/arkpedia-native-operators/char_4183_mortis.json and
// data/arkpedia-fever-source.json. Built on the generic Dollkeeper stand-in.
//
// From data: Dollkeeper trait (20 s stand-in); ordinary Physical melee at the
// Attack clip's OnAttack event; talent 1 damage_resistance 0.3 converted at
// dark_damage_mul_factor 0.5 into Apoptosis, stand-in DEF, and the members'
// prob/delta_time stand-in shortening; talent 2 Fever cnt per damage taken and
// the members' max_hp aura; S1 def/block_cnt/taunt_level; S2 2-1 range,
// base_attack_time, three Arts shots of attack@atk_scale at random targets in
// range, and `value` Arts self-damage per successful hit.
// Declared local mappings (PRTS notes, not recovered native behaviour):
// - The stand-in does not attack. Talent 1 applies to her and the stand-in:
//   Physical/Arts taken x(1 - 0.3), then 0.3 x 0.5 of the pre-reduction amount
//   as her own Apoptosis.
// - Talent 2 counts every damage or element instance aimed at her, dodged too.
// - S1 entering the stand-in keeps its effects until the stand-in leaves; its
//   stand-in blocks with (skill block - 2) instead of 0.
// - S2 shots are ground-only; blocked enemies count as in range.
import evidence from '../../../data/arkpedia-native-operators/char_4183_mortis.json' with {type: 'json'};
import review from '../../../data/arkpedia-mortis-runtime-review.json' with {type: 'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {normalizeChess, normSpType} from '../simdata.js';
import {canTargetEnemy} from '../targeting.js';
import {feverOf, FEVER_MEMBERS} from './arkpedia-fever.js';
export const MORTIS_ID = 'char_4183_mortis';
export const MORTIS_SKILLS = Object.freeze(['skchr_mortis_1', 'skchr_mortis_2']);
export const selectedMortisBuild = build => selectedCNSourceBuild(evidence, MORTIS_ID, build);
const ID = MORTIS_ID, live = u => !!u?.alive && u.deployed && !u.hidden;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function reviewed(b) {
  const approved = same(review.enabledOperators, [ID]) && review.verification.browser.status === 'passed';
  const candidate = b.regularReviewCandidates?.includes(ID) && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !candidate) || review.frameParity !== false || review.moduleSupport !== false
    || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-mortis-dollkeeper-apoptosis-fever-v1')
    throw Error('Missing Mutsumi runtime review or explicit held browser candidate');
}
export function selectedMortisInputs(unit) {
  const skill = unit.def.skill, build = unit.def.raw.arkpedia;
  if (!skill) throw Error('Incomplete original selected Mutsumi inputs');
  const s = selectedMortisBuild({...build, skillId: skill.id});
  if (unit.def.charId !== ID || !same(unit.def.stats, normalizeChess({stats: s.stats}).stats) || !same(unit.rangeGrid, s.rangeGrid)
    || !same(unit.def.talents.map(t => t.bb), s.talentBb) || !same(skill.bb, s.bb) || !same(skill.rangeGrid ?? [], s.skillRangeGrid)
    || skill.spType !== normSpType(s.source.spData.spType) || skill.spCost !== s.source.spData.spCost
    || skill.initSp !== s.source.spData.initSp || skill.duration !== s.source.duration)
    throw Error('Incomplete original selected Mutsumi inputs');
  return s;
}
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => u.base.bat / u.s.interval;
const talent = (u, key) => u.def.talents.find(t => t.bb[key] != null)?.bb;
class MortisOwner {
  constructor(b, u) {
    for (const f of ['Front', 'Back']) if (evidence.models[ID][f].hits.Skill_2?.length !== 1) throw Error('Changed original Mutsumi clips');
    Object.assign(this, {b, u, record: selectedMortisInputs(u), seq: null, handles: [], aura: new Set()});
  }
  valid() { return live(this.u) && this.u.deploySeq === this.seq && this.u.mem.mortisOwner === this; }
  s2Targets() {
    const {b, u} = this;
    if (b.rangeChanged(u)) b._refreshRange(u);
    const ts = b.enemiesInKeys(u.rangeKeys, u, {groundOnly: true, canHitFly: false}).filter(e => live(e) && canTargetEnemy(u, e, {canHitFly: false}));
    for (const e of u.blocking) if (live(e) && !ts.includes(e)) ts.push(e);
    return ts;
  }
  auraTick() {
    const {b, u} = this, hp = talent(u, 'cnt')?.max_hp, key = `mortis:aura:${u.id}`;
    for (const m of b.allyUnits) {
      const ok = hp > 0 && this.valid() && live(m) && m.kind === 'op' && FEVER_MEMBERS.includes(m.defId);
      if (ok && !m.findBuff(key)) { b.addBuff(m, {key, source: u, mods: {hpPct: hp}}); this.aura.add(m); }
      else if (!ok && m.findBuff(key)) { b.removeBuff(m, key); this.aura.delete(m); }
    }
  }
  install() {
    const {b, u} = this;
    u.mem.mortisOwner = this;
    const fever = feverOf(b), t1 = talent(u, 'damage_resistance'), t2 = talent(u, 'cnt');
    const resistKey = `mortis:t1:${u.id}`;
    this.handles = [
      b.on('deploy', ({unit, move}) => {
        if (unit !== u || move) return;
        this.seq = u.deploySeq;
        if (t1) b.addBuff(u, {key: resistKey, source: u, persist: true, mods: {physTakenMul: 1 - t1.damage_resistance, artsTakenMul: 1 - t1.damage_resistance}});
      }, {owner: u}),
      b.on('tick', () => this.auraTick(), {owner: u}),
      // Talent 1: the converted share returns as her own Apoptosis.
      b.on('damaged', ({source, target, amount, dmg}) => {
        if (!this.valid()) return;
        if (target === u && t1 && amount > 0 && (dmg?.type === 'phys' || dmg?.type === 'arts')) {
          const raw = amount / (1 - t1.damage_resistance);
          b.dealDamage(u, u, {amount: raw * t1.damage_resistance * t1.dark_damage_mul_factor, type: 'element', element: 'apoptosis', tags: ['mortis:apoptosis']});
        }
        // Members' attacks may shorten the stand-in, rolled per damage instance.
        if (u.trait.doll && t1?.prob > 0 && dmg?.isAttack && source !== u && source?.kind === 'op'
          && FEVER_MEMBERS.includes(source.defId) && b.rng() < t1.prob) {
          const doll = u.findBuff('trait:substitute');
          if (doll) doll.timeLeft = Math.max(0, doll.timeLeft - t1.delta_time);
        }
      }, {owner: u}),
      b.on('hit', ({target}) => { if (target === u && t2 && this.valid()) fever.add(u, t2.cnt); }, {owner: u}),
      b.on('elementHit', ({target}) => { if (target === u && t2 && this.valid()) fever.add(u, t2.cnt); }, {owner: u}),
      b.on('dollSwap', ({unit, form}) => {
        if (unit !== u) return;
        const key = `mortis:doll-def:${u.id}`;
        if (form === 'doll' && t1?.def) b.addBuff(u, {key, source: u, mods: {defPct: t1.def}});
        else b.removeBuff(u, key);
        const s1 = u.findBuff(`mortis:s1:${u.id}`);
        if (s1 && form === 'doll') { s1.duration = s1.timeLeft = Infinity; s1.mods = {...s1.mods, blockCnt: s1.mods.blockCnt + 99 - 2}; u.markDirty(); }
        else if (s1 && form === null) b.removeBuff(u, s1);
      }, {owner: u}),
      b.on('death', ({unit}) => { if (unit === u) this.stop(); }, {owner: u}),
      b.on('battleEnd', () => this.stop(), {owner: u}),
    ];
  }
  stop() {
    for (const m of this.aura) if (m.findBuff(`mortis:aura:${this.u.id}`)) this.b.removeBuff(m, `mortis:aura:${this.u.id}`);
    this.aura.clear();
  }
}
export function customizeMortisKit({battle: b, id, unit: u, kit}) {
  if (id !== ID) return;
  reviewed(b);
  if (!MORTIS_SKILLS.includes(u.def.skill?.id)) throw Error('Missing original selected Mutsumi skill');
  const owner = new MortisOwner(b, u), s = u.def.skill, n = MORTIS_SKILLS.indexOf(s.id) + 1;
  u.mem.mortisPrepared = owner;
  kit.talents = [];
  const ordinary = {windup: (_b, a) => model(a).hits.Attack[0] / rate(a), attackVisual: () => 'Attack',
    canAttack: (bb, a) => !bb.isUnitInBornState(a)};
  kit.trait = {...kit.trait, ...ordinary, dollNoAttack: true};
  if (n === 1) {
    kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration,
      onStart: () => {
        const bb = u.skill.bb;
        b.addBuff(u, {key: `mortis:s1:${u.id}`, source: u, duration: s.duration, timeLeft: s.duration,
          mods: {defPct: bb.def, blockCnt: bb.block_cnt, taunt: bb.taunt_level}});
      },
      onEnd: ({reason}) => { if (reason !== 'substitute') b.removeBuff(u, `mortis:s1:${u.id}`); }};
  } else {
    // S2: three Arts shots per attack at random targets, each successful hit costs her `value` Arts HP.
    kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration,
      targeting: {rangeGrid: owner.record.skillRangeGrid},
      mods: {batFlat: u.def.skill.bb.base_attack_time},
      attack: {
        dmgType: 'arts', windup: (_b, a) => model(a).hits.Skill_2[0] / rate(a), attackVisual: () => 'Skill_2',
        acquireTargets: () => { const ts = owner.s2Targets(); return ts.length ? [ts[0]] : []; },
        launchAttack: (_b, a, _p, _t, info) => {
          const bb = a.skill.bb;
          for (let i = 0; i < 3; i++) {
            const ts = owner.s2Targets(), e = ts[Math.floor(b.rng() * ts.length)];
            if (!e) continue;
            const dealt = b.dealDamage(a, e, {amount: a.s.atk * a.s.atkScaleMul * bb['attack@atk_scale'], type: 'arts', isAttack: true, isSkill: true,
              attackId: info.attackId, applyWay: 'ranged', tags: ['mortis', 'mortis:s2']});
            if (dealt > 0 && live(a)) b.dealDamage(a, a, {amount: bb.value, type: 'arts', tags: ['mortis:self']});
          }
          return true;
        },
      }};
  }
}
export function installMortis({battle: b, unit: u, def}) {
  if (def.charId !== ID) return;
  reviewed(b);
  const owner = u.mem.mortisPrepared;
  if (!owner) throw Error('Missing selected Mutsumi owner');
  delete u.mem.mortisPrepared; owner.install();
}
