// SPDX-License-Identifier: GPL-3.0-or-later
// Bellone (char_4037_demetr), Fighter Guard.
// Source: data/arkpedia-native-operators/char_4037_demetr.json.
//
// From data: Fighter trait (blocks one enemy); ordinary hits alternate the
// Attack_A/B clip events. Talent 1 (demetr_t1[def_dec], [dmg_inc]): each hit
// lowers the target's DEF by attack@def for attack@def_dec_duration s,
// stacking to attack@limited_stack_cnt (attack@s2_limited_stack_cnt in S2),
// and his damage rises linearly with the target's missing HP, from
// min_add_on_scale at min_hp_ratio to max_add_on_scale at max_hp_ratio
// (DamageScaleAccordingToHpRatio). Talent 2 (demetr_t2[evade]): Physical and
// Arts evasion starting at init_prob on deployment and falling by dec_prob a
// second for trig_cnt seconds. S1 (auto, next attack): two hits of atk_scale at
// the Skill_1 events. S2: skill range 3-13, ASPD, attack@max_target targets at
// attack@atk_scale; at full talent stacks the target is continuously
// sluggish. S3: ATK/ASPD, prob for an extra prob_atk_scale hit; at the start
// and whenever his last attacked elite or leader falls or he has dealt no
// damage for time_stack x interval s (demetr_s3[target_timer]/[timer]), he
// picks a ground enemy and moves (ba.addash) onto its tile when deployable;
// fatal damage makes his UNDEADABLE, untargetable and unblocking and ends the
// skill (demetr_s3[undeadable]); he then returns to his original tile.
// Declared local mappings:
// - S3 picks the nearest ground enemy within 3 tiles of his (the native
//   FlyToTargetSecond selector range carries no fields); "deployable" is a
//   melee/all build tile no other unit occupies.
// - The effect-only Bond token (token_10065_demetr_dmtpos) marking his
//   original tile is not drawn.
import evidence from '../../../data/arkpedia-native-operators/char_4037_demetr.json' with {type: 'json'};
import review from '../../../data/arkpedia-demetr-runtime-review.json' with {type: 'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {normalizeChess} from '../simdata.js';
import {canTargetEnemy} from '../targeting.js';
export const DEMETR_ID = 'char_4037_demetr';
export const DEMETR_SKILLS = Object.freeze(['skchr_demetr_1', 'skchr_demetr_2', 'skchr_demetr_3']);
export const selectedDemetrBuild = build => selectedCNSourceBuild(evidence, DEMETR_ID, build);
const ID = DEMETR_ID, live = u => !!u?.alive && u.deployed && !u.hidden;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const SEARCH = 3;
function reviewed(b) {
  const approved = same(review.enabledOperators, [ID]) && review.verification.browser.status === 'passed';
  const candidate = b.regularReviewCandidates?.includes(ID) && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !candidate) || review.frameParity !== false || review.moduleSupport !== false
    || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-demetr-pursuit-v1')
    throw Error('Missing Bellone runtime review or explicit held browser candidate');
}
export function selectedDemetrInputs(unit) {
  const skill = unit.def.skill, build = unit.def.raw.arkpedia;
  if (!skill) throw Error('Incomplete original selected Bellone inputs');
  const s = selectedDemetrBuild({...build, skillId: skill.id});
  if (unit.def.charId !== ID || !same(unit.def.stats, normalizeChess({stats: s.stats}).stats) || !same(unit.rangeGrid, s.rangeGrid)
    || !same(unit.def.talents.map(t => t.bb), s.talentBb) || !same(skill.bb, s.bb) || skill.spCost !== s.source.spData.spCost)
    throw Error('Incomplete original selected Bellone inputs');
  return s;
}
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => u.base.bat / u.s.interval;
const talent = (u, key) => u.def.talents.find(t => t.bb[key] != null)?.bb;
class DemetrOwner {
  constructor(b, u) { Object.assign(this, {b, u, record: selectedDemetrInputs(u), seq: null, handles: [], combo: 0, stacks: new Map(), deployedAt: 0, home: null, lastDamage: 0, mark: null}); }
  valid() { return live(this.u) && this.u.deploySeq === this.seq && this.u.mem.demetrOwner === this; }
  n() { return this.u.skill?.active ? DEMETR_SKILLS.indexOf(this.u.skill.id) + 1 : 0; }
  // Talent 1: DEF shred stacks; S2's higher cap and sluggish at full stacks.
  shred(e) {
    const {b, u} = this, t = talent(u, 'attack@def');
    if (!t || !live(e)) return;
    const cap = this.n() === 2 ? t['attack@s2_limited_stack_cnt'] : t['attack@limited_stack_cnt'];
    const n = Math.min(cap, (this.stacks.get(e) ?? 0) + 1), d = t['attack@def_dec_duration'];
    this.stacks.set(e, n);
    b.addBuff(e, {key: `demetr:shred:${u.id}`, source: u, duration: d, timeLeft: d, refresh: 'replace', mods: {defPct: t['attack@def'] * n},
      onRemove: () => this.stacks.delete(e)});
    if (this.n() === 2 && n >= cap) b.applyStatus(e, 'sluggish', {source: u, duration: d});
  }
  // Talent 1: damage by the target's missing HP.
  lowHp(e) {
    const t = talent(this.u, 'max_add_on_scale');
    if (!t) return 1;
    const f = Math.max(0, Math.min(1, (t.min_hp_ratio - e.hpRatio) / (t.min_hp_ratio - t.max_hp_ratio)));
    return 1 + t.min_add_on_scale + (t.max_add_on_scale - t.min_add_on_scale) * f;
  }
  // Talent 2: evasion falling from init_prob after deployment.
  evasion() {
    const t = talent(this.u, 'init_prob');
    if (!t) return 0;
    const steps = Math.min(t.trig_cnt, Math.floor(this.b.time - this.deployedAt + 1e-9));
    return t.init_prob - t.dec_prob * steps;
  }
  legal(e) { return live(e) && e.side === 'enemy' && !e.isFlying && canTargetEnemy(this.u, e, this.u.profile); }
  // S3 pursuit.
  pursue() {
    const {b, u} = this;
    const target = b.enemies.filter(e => this.legal(e) && Math.hypot(e.x - u.x, e.y - u.y) <= SEARCH)
      .sort((p, q) => Math.hypot(p.x - u.x, p.y - u.y) - Math.hypot(q.x - u.x, q.y - u.y) || p.spawnSeq - q.spawnSeq)[0];
    this.lastDamage = b.time; this.mark = target ?? null;
    if (!target) return;
    const r = Math.round(target.y), c = Math.round(target.x), tile = b.grid.tile(r, c);
    if (!['MELEE', 'ALL'].includes(tile?.build) || (r === u.tileR && c === u.tileC)) return;
    if (b.moveRedeploy(u, r, c)) this.seq = u.deploySeq;
  }
  goHome() {
    const {b, u} = this, h = this.home;
    this.home = null;
    b.removeBuff(u, 'demetr:s3-fatal');
    if (h && live(u) && (u.tileR !== h[0] || u.tileC !== h[1]) && b.moveRedeploy(u, h[0], h[1])) this.seq = u.deploySeq;
  }
  tick() {
    const {b, u} = this;
    if (this.n() !== 3 || !this.valid()) return;
    const bb = u.skill.bb, quiet = bb['attack@demetr_s3[target_timer].time_stack'] * bb['attack@demetr_s3[target_timer].interval'];
    if (b.time - this.lastDamage + 1e-9 >= quiet) this.pursue();
  }
  install() {
    const {b, u} = this;
    u.mem.demetrOwner = this;
    this.handles = [
      b.on('deploy', ({unit, move}) => { if (unit === u && !move) { this.seq = u.deploySeq; this.deployedAt = b.time; } }, {owner: u}),
      b.on('tick', () => this.tick(), {owner: u}),
      b.on('hit', ctx => {
        if (ctx.source === u && this.valid() && ['phys', 'arts'].includes(ctx.dmg.type)) ctx.dmg.mul = (ctx.dmg.mul ?? 1) * this.lowHp(ctx.target);
        if (ctx.target === u && this.valid() && ['phys', 'arts'].includes(ctx.dmg.type) && b.rng() < this.evasion()) ctx.cancel = true;
      }, {owner: u}),
      b.on('damaged', h => { if (h.source === u && h.amount > 0) this.lastDamage = b.time; }, {owner: u}),
      b.on('death', ({unit}) => {
        if (unit === u) { this.stacks.clear(); return; }
        // S3: his last attacked elite or leader fell.
        if (this.n() === 3 && unit === this.mark && ['ELITE', 'BOSS'].includes(unit.def?.rank)) this.pursue();
      }, {owner: u}),
      b.on('beforeHpZero', ctx => {
        if (ctx.unit !== u || this.n() !== 3 || !this.valid()) return;
        ctx.blocked = true;
        b.addBuff(u, {key: 'demetr:s3-fatal', source: u, flags: {undeadable: true, untargetable: true, noBlock: true, healFree: true}});
        b.after(0, () => { if (u.skill?.active) u.skill.end('fatal'); }, {owner: u});
      }, {owner: u}),
    ];
  }
}
export function customizeDemetrKit({battle: b, id, unit: u, kit}) {
  if (id !== ID) return;
  reviewed(b);
  if (!DEMETR_SKILLS.includes(u.def.skill?.id)) throw Error('Missing original selected Bellone skill');
  const owner = new DemetrOwner(b, u), s = u.def.skill, n = DEMETR_SKILLS.indexOf(s.id) + 1;
  u.mem.demetrPrepared = owner;
  kit.talents = [];
  const clip = a => a.skill?.pending && n === 1 ? 'Skill_1' : a.skill?.active && n === 2 ? 'Skill_2_Loop'
    : a.skill?.active && n === 3 ? `Skill_3_Loop_${owner.combo % 2 ? 'B' : 'A'}` : `Attack_${owner.combo % 2 ? 'B' : 'A'}`;
  kit.trait = {...kit.trait, windup: (_b, a) => model(a).hits[clip(a)][0] / rate(a), attackVisual: (_b, a) => clip(a),
    canAttack: (bb, a) => !bb.isUnitInBornState(a) && !a.findBuff('demetr:s3-fatal'),
    onEachHit: (_bb, _a, e) => owner.shred(e), afterAttack: () => { owner.combo++; }};
  if (n === 1) kit.skill = {id: s.id, name: s.name, kind: 'instant', trigger: 'SP_FULL',
    attack: {atkScale: s.bb.atk_scale, onEachHit: ({target, kind}) => {
      if (kind !== 'main') return;
      const ev = model(u).hits.Skill_1;
      b.after((ev[1] - ev[0]) / rate(u), () => { if (owner.valid() && live(target)) b.dealDamage(u, target, {amount: u.s.atk * s.bb.atk_scale, type: 'phys', applyWay: 'melee', isAttack: true, isSkill: true, tags: ['demetr', 'demetr:s1-second']}); }, {owner: u});
    }}};
  else if (n === 2) kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration, mods: {aspd: s.bb.attack_speed},
    targeting: {maxTargets: s.bb['attack@max_target'], rangeGrid: owner.record.skillRangeGrid}, attack: {atkScale: s.bb['attack@atk_scale']},
    onStart: () => { u.mem.regularFormVisual = {clip: 'Skill_2_Idle', loop: true, attack: 'Skill_2_Loop'}; }, onEnd: () => { u.mem.regularFormVisual = null; }};
  else {
    const bb = s.bb;
    kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration,
      mods: {atkPct: bb['attack@demetr_s3[bonus].atk'], aspd: bb['attack@demetr_s3[bonus].attack_speed']},
      attack: {onEachHit: ({target, kind}) => {
        if (kind === 'main' && live(target) && b.rng() < u.skill.bb['attack@demetr_s3[bonus].prob'])
          b.dealDamage(u, target, {amount: u.s.atk * u.skill.bb['attack@demetr_s3[bonus].prob_atk_scale'], type: 'phys', applyWay: 'melee', isSkill: true, tags: ['demetr', 'demetr:s3-extra']});
      }},
      onStart: () => { owner.home = [u.tileR, u.tileC]; u.mem.regularFormVisual = {clip: 'Skill_3_Idle', loop: true, attack: 'Skill_3_Loop_A'}; owner.pursue(); },
      onEnd: () => { u.mem.regularFormVisual = null; owner.goHome(); }};
  }
}
export function installDemetr({battle: b, unit: u, def}) {
  if (def.charId !== ID) return;
  reviewed(b);
  const owner = u.mem.demetrPrepared;
  if (!owner) throw Error('Missing selected Bellone owner');
  delete u.mem.demetrPrepared; owner.install();
}
