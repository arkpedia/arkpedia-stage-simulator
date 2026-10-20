// SPDX-License-Identifier: GPL-3.0-or-later
// Haruka (char_4202_haruka), Abjurer Supporter.
// Source: data/arkpedia-native-operators/char_4202_haruka.json.
//
// From data: Abjurer trait (Arts attacks; while a skill is active she heals
// attack@max_target_heal allies for heal_scale x ATK instead). Talent 1
// (haruka_t_1, _delay): every attack interval one ally in range without a
// bubble (max_target_shield) gets a bubble of damage_resistance Sanctuary;
// `interval` s after it first takes enemy damage the bubble bursts. Talent 2:
// a burst heals that unit heal_scale x her ATK. S1: ASPD, and a burst gives a
// bubble to another ally without one in the eight surrounding tiles. S2: heal
// targets +attack@max_target_heal_add and bubble targets +max_target_shield_add;
// every heal of hers deals atk_scale_extra x the healed amount as Arts to up to
// max_target_extra enemies within ability_range_radius of that ally
// (haruka_s_2, [damage]); from the second use ATK `atk` and an infinite
// duration. S3: skill range, base attack time, ATK, bubble Sanctuary x
// damage_resistance_scale (haruka_s_3_scale), and an enemy attacking a bubbled
// ally levitates for levitate_duration s taking atk_scale x ATK Arts every
// `interval` s while levitated (haruka_s_3_debuff_delay, _debuff).
// Declared local mappings:
// - A new bubble goes to the ally in range without one with the lowest HP
//   ratio; heals pick the injured allies in range with the lowest HP ratio.
import evidence from '../../../data/arkpedia-native-operators/char_4202_haruka.json' with {type: 'json'};
import review from '../../../data/arkpedia-haruka-runtime-review.json' with {type: 'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {normalizeChess} from '../simdata.js';
import {STATUS} from '../buffs.js';
export const HARUKA_ID = 'char_4202_haruka';
export const HARUKA_SKILLS = Object.freeze(['skchr_haruka_1', 'skchr_haruka_2', 'skchr_haruka_3']);
export const selectedHarukaBuild = build => selectedCNSourceBuild(evidence, HARUKA_ID, build);
const ID = HARUKA_ID, live = u => !!u?.alive && u.deployed && !u.hidden;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function reviewed(b) {
  const approved = same(review.enabledOperators, [ID]) && review.verification.browser.status === 'passed';
  const candidate = b.regularReviewCandidates?.includes(ID) && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !candidate) || review.frameParity !== false || review.moduleSupport !== false
    || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-haruka-bubbles-v1')
    throw Error('Missing Haruka runtime review or explicit held browser candidate');
}
export function selectedHarukaInputs(unit) {
  const skill = unit.def.skill, build = unit.def.raw.arkpedia;
  if (!skill) throw Error('Incomplete original selected Haruka inputs');
  const s = selectedHarukaBuild({...build, skillId: skill.id});
  if (unit.def.charId !== ID || !same(unit.def.stats, normalizeChess({stats: s.stats}).stats) || !same(unit.rangeGrid, s.rangeGrid)
    || !same(unit.def.talents.map(t => t.bb), s.talentBb) || !same(skill.bb, s.bb) || skill.spCost !== s.source.spData.spCost)
    throw Error('Incomplete original selected Haruka inputs');
  return s;
}
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => u.base.bat / u.s.interval;
const talent = (u, key) => u.def.talents.find(t => t.bb[key] != null)?.bb;
class HarukaOwner {
  constructor(b, u) { Object.assign(this, {b, u, record: selectedHarukaInputs(u), seq: null, handles: [], bubbles: new Map(), nextBubble: 0, uses: 0, floats: new Map()}); }
  valid() { return live(this.u) && this.u.deploySeq === this.seq && this.u.mem.harukaOwner === this; }
  n() { return this.u.skill?.active ? HARUKA_SKILLS.indexOf(this.u.skill.id) + 1 : 0; }
  allies() { if (this.b.rangeChanged(this.u)) this.b._refreshRange(this.u); return this.b.alliesInGrid(this.u).filter(live); }
  resist() {
    const t = talent(this.u, 'damage_resistance'), bb = this.u.skill?.bb;
    return t.damage_resistance * (this.n() === 3 ? bb.damage_resistance_scale : 1);
  }
  give(a) {
    const {b, u} = this;
    if (!live(a) || this.bubbles.has(a)) return false;
    this.bubbles.set(a, {burstAt: null});
    b.addBuff(a, {key: `haruka:bubble:${u.id}`, source: u, status: 'sanctuary', mods: STATUS.sanctuary.mods(this.resist())});
    return true;
  }
  // Talent 1: one bubble (two in S2) every attack interval.
  bubbleTick() {
    const {b, u} = this, t = talent(u, 'damage_resistance');
    if (!t || !this.valid() || b.time + 1e-9 < this.nextBubble) return;
    this.nextBubble = b.time + u.s.interval;
    const count = t.max_target_shield + (this.n() === 2 ? u.skill.bb.max_target_shield_add : 0);
    const pick = this.allies().filter(a => !this.bubbles.has(a)).sort((p, q) => p.hpRatio - q.hpRatio || p.deploySeq - q.deploySeq);
    for (const a of pick.slice(0, count)) this.give(a);
  }
  // Keep the Sanctuary value with S3's scale.
  syncBubbles() {
    const {b, u} = this, key = `haruka:bubble:${u.id}`, mods = STATUS.sanctuary.mods(this.resist());
    for (const [a, s] of [...this.bubbles]) {
      if (!live(a)) { this.bubbles.delete(a); continue; }
      const old = a.findBuff(key);
      if (old && old.mods.physTakenMul !== mods.physTakenMul) b.addBuff(a, {key, source: u, status: 'sanctuary', mods});
      if (s.burstAt != null && b.time + 1e-9 >= s.burstAt) this.burst(a);
    }
  }
  // Talent 2 burst heal; S1 passes the bubble on.
  burst(a) {
    const {b, u} = this, t2 = talent(u, 'heal_scale');
    this.bubbles.delete(a); b.removeBuff(a, `haruka:bubble:${u.id}`);
    if (t2 && live(a)) b.heal(u, a, u.s.atk * t2.heal_scale, {tags: ['haruka:t2']});
    if (this.n() === 1) {
      const next = b.allyUnits.filter(x => live(x) && x !== a && !this.bubbles.has(x) && x.kind !== 'device'
        && Math.max(Math.abs(x.tileR - a.tileR), Math.abs(x.tileC - a.tileC)) === 1).sort((p, q) => p.hpRatio - q.hpRatio)[0];
      if (next) this.give(next);
    }
  }
  // S3: an enemy hitting a bubbled ally levitates and takes Arts while it floats.
  floatTick() {
    const {b, u} = this;
    for (const [e, f] of [...this.floats]) {
      if (!live(e) || b.time >= f.until) { this.floats.delete(e); continue; }
      if (b.time + 1e-9 < f.next) continue;
      f.next = b.time + f.interval;
      // Once she is gone the tick is sourceless (haruka_s_3_debuff fail branch).
      if (e.s.flags.levitate) b.dealDamage(this.valid() ? u : null, e, {amount: f.amount, type: 'arts', applyWay: 'none', sourceless: !this.valid(), tags: ['haruka', 'haruka:s3-float']});
    }
  }
  install() {
    const {b, u} = this;
    u.mem.harukaOwner = this;
    this.handles = [
      b.on('deploy', ({unit, move}) => { if (unit === u && !move) { this.seq = u.deploySeq; this.nextBubble = b.time; } }, {owner: u}),
      b.on('tick', () => { this.bubbleTick(); this.syncBubbles(); this.floatTick(); }, {owner: u}),
      b.on('damaged', h => {
        const s = this.bubbles.get(h.target), t = talent(u, 'damage_resistance');
        if (!s || h.source?.side !== 'enemy') return;
        if (s.burstAt == null) s.burstAt = b.time + t.interval;
        if (this.n() === 3 && live(h.source) && !this.floats.has(h.source)) {
          const bb = u.skill.bb;
          if (b.applyStatus(h.source, 'levitate', {source: u, duration: bb.levitate_duration}) !== false)
            this.floats.set(h.source, {until: b.time + bb.levitate_duration, next: b.time + bb.interval, interval: bb.interval, amount: u.s.atk * bb.atk_scale});
        }
      }, {owner: u}),
      // S2: her heals strike enemies around the healed ally.
      b.on('heal', ctx => {
        if (ctx.source !== u || this.n() !== 2 || !this.valid()) return;
        const amount = ctx.amount ?? 0, bb = u.skill.bb, a = ctx.target;
        if (!(amount > 0) || !live(a)) return;
        const near = b.enemiesInRadius(a.x, a.y, bb.ability_range_radius, true).filter(live)
          .sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y)).slice(0, bb.max_target_extra);
        for (const e of near) b.dealDamage(u, e, {amount: amount * bb.atk_scale_extra, type: 'arts', applyWay: 'none', tags: ['haruka', 'haruka:s2-extra']});
      }, {owner: u}),
      b.on('death', ({unit}) => { if (unit === u) this.stop(); }, {owner: u}),
      b.on('battleEnd', () => this.stop(), {owner: u}),
    ];
  }
  stop() { for (const a of this.bubbles.keys()) if (a.findBuff?.(`haruka:bubble:${this.u.id}`)) this.b.removeBuff(a, `haruka:bubble:${this.u.id}`); this.bubbles.clear(); }
}
export function customizeHarukaKit({battle: b, id, unit: u, kit}) {
  if (id !== ID) return;
  reviewed(b);
  if (!HARUKA_SKILLS.includes(u.def.skill?.id)) throw Error('Missing original selected Haruka skill');
  const owner = new HarukaOwner(b, u), s = u.def.skill, n = HARUKA_SKILLS.indexOf(s.id) + 1, trait = u.def.trait?.bb ?? {};
  u.mem.harukaPrepared = owner;
  kit.talents = [];
  kit.trait = {...kit.trait, dmgType: 'arts', windup: (_b, a) => model(a).hits.Attack[0] / rate(a), attackVisual: () => 'Attack', canAttack: (bb, a) => !bb.isUnitInBornState(a)};
  const loop = ['Skill_Loop', 'Skill_2_loop', 'Skill_3_Loop_A'][n - 1], idle = ['Skill_Idle', 'Skill_2_Idle', 'Skill_3_Idle'][n - 1];
  const heal = {dmgType: 'heal', heal: {mode: 'single'}, atkScale: trait.heal_scale ?? .75, attackVisual: () => loop, windup: (_b, a) => model(a).hits[loop][0] / rate(a)};
  const pose = {onStart: () => { u.mem.regularFormVisual = {clip: idle, loop: true, attack: loop}; }, onEnd: () => { u.mem.regularFormVisual = null; }};
  if (n === 1) kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration, mods: {aspd: s.bb.attack_speed}, ...pose, attack: heal};
  else if (n === 2) kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration, attack: heal,
    targeting: {maxTargets: (trait['attack@max_target_heal'] ?? 1) + s.bb['attack@max_target_heal_add']},
    onStart: () => {
      pose.onStart();
      // From the second use: ATK and no end.
      if (++owner.uses >= 2) { b.addBuff(u, {key: 'haruka:s2-second', source: u, mods: {atkPct: s.bb.atk}}); u.skill.timeLeft = Infinity; }
    },
    onEnd: () => { pose.onEnd(); b.removeBuff(u, 'haruka:s2-second'); }};
  else kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration, mods: {batFlat: s.bb.base_attack_time, atkPct: s.bb.atk}, ...pose,
    targeting: {rangeGrid: owner.record.skillRangeGrid}, attack: heal};
}
export function installHaruka({battle: b, unit: u, def}) {
  if (def.charId !== ID) return;
  reviewed(b);
  const owner = u.mem.harukaPrepared;
  if (!owner) throw Error('Missing selected Haruka owner');
  delete u.mem.harukaPrepared; owner.install();
}
