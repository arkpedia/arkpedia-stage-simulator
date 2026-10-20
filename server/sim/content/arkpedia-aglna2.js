// SPDX-License-Identifier: GPL-3.0-or-later
// Angelina the Mellow Wish (char_1015_aglna2), Skywalker Specialist.
// Source: data/arkpedia-native-operators/char_1015_aglna2.json.
//
// From data: Skywalker trait (generic: blocks flying enemies while lifted
// off). Talent 1 (aglna2_t_1[enemy]/[self]): her attacks add atk_scale_lo x ATK
// Arts, or atk_scale_hi on enemies of weight up to mass_level; while she is
// lifted off, enemies in her range are weightless (ba.weightless). Talent 2
// (aglna2_t_2): while she is deployed, lifted-off allies gain ATK `atk` and
// hp_recovery_per_sec_by_max_hp_ratio of max HP a second while blocking.
// S1 (passive): lifted off from deployment, range 3-6, ATK, attack@max_target
// targets. S2: range 3-10; she glides for chant_duration s, levitating the
// ground enemies in range for buff_duration_levitate s and ground-binding the
// flying ones for buff_duration_ground_bound s, then attacks with base attack
// time, ATK and attack@max_target Arts targets. S3 (ammo attack@trigger_time,
// stoppable): lifted off, ATK, damage_resistance against damage from flying
// enemies (ba.airprotect), range 3-9 plus the eight surrounding tiles;
// attacks hit attack@max_walk_target ground enemies for attack@atk_scale
// Physical plus one flying enemy; flying enemies in range are slowed by
// move_speed; with an unblocked flying enemy in the original range and none
// blocked, she moves (ba.addash) onto its tile.
// Declared local mappings:
// - Ground-bind (ba.groundbind "目标变为地面单位，无法移动", halved above weight 3)
//   makes a flier walk-moving and immobile for its duration.
// - S2's glide affects the enemies in her skill range at its start.
// - S3 hits up to attack@max_walk_target + 1 targets in total (the extra one
//   is not forced to be a flier).
// - The effect-only token_10071_aglna2_agairp is not drawn.
import evidence from '../../../data/arkpedia-native-operators/char_1015_aglna2.json' with {type: 'json'};
import review from '../../../data/arkpedia-aglna2-runtime-review.json' with {type: 'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {normalizeChess} from '../simdata.js';
import {COLS} from '../constants.js';
export const AGLNA2_ID = 'char_1015_aglna2';
export const AGLNA2_SKILLS = Object.freeze(['skchr_aglna2_1', 'skchr_aglna2_2', 'skchr_aglna2_3']);
export const selectedAglna2Build = build => selectedCNSourceBuild(evidence, AGLNA2_ID, build);
const ID = AGLNA2_ID, live = u => !!u?.alive && u.deployed && !u.hidden;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const AROUND = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
function reviewed(b) {
  const approved = same(review.enabledOperators, [ID]) && review.verification.browser.status === 'passed';
  const candidate = b.regularReviewCandidates?.includes(ID) && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !candidate) || review.frameParity !== false || review.moduleSupport !== false
    || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-aglna2-skywalker-v1')
    throw Error('Missing Angelina the Mellow Wish runtime review or explicit held browser candidate');
}
export function selectedAglna2Inputs(unit) {
  const skill = unit.def.skill, build = unit.def.raw.arkpedia;
  if (!skill) throw Error('Incomplete original selected Angelina the Mellow Wish inputs');
  const s = selectedAglna2Build({...build, skillId: skill.id});
  if (unit.def.charId !== ID || !same(unit.def.stats, normalizeChess({stats: s.stats}).stats) || !same(unit.rangeGrid, s.rangeGrid)
    || !same(unit.def.talents.map(t => t.bb), s.talentBb) || !same(skill.bb, s.bb) || skill.spCost !== s.source.spData.spCost)
    throw Error('Incomplete original selected Angelina the Mellow Wish inputs');
  return s;
}
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => u.base.bat / u.s.interval;
const talent = (u, key) => u.def.talents.find(t => t.bb[key] != null)?.bb;
class Aglna2Owner {
  constructor(b, u) { Object.assign(this, {b, u, record: selectedAglna2Inputs(u), seq: null, handles: [], weightless: new Set(), boosted: new Set(), bound: new Map(), slowed: new Set(), ammo: 0}); }
  valid() { return live(this.u) && this.u.deploySeq === this.seq && this.u.mem.aglna2Owner === this; }
  n() { return this.u.skill?.active ? AGLNA2_SKILLS.indexOf(this.u.skill.id) + 1 : 0; }
  aloft() { return !!this.u.s.flags.liftoff; }
  inRange() { if (this.b.rangeChanged(this.u)) this.b._refreshRange(this.u); return this.b.enemies.filter(e => live(e) && this.u.rangeKeySet.has(Math.round(e.y) * COLS + Math.round(e.x))); }
  lift(on) {
    const {b, u} = this;
    if (on && !u.findBuff('aglna2:liftoff')) b.addBuff(u, {key: 'aglna2:liftoff', source: u, flags: {liftoff: true}});
    else if (!on && u.findBuff('aglna2:liftoff')) b.removeBuff(u, 'aglna2:liftoff');
  }
  // Talent 1 weightless field and talent 2 lifted-off ally boost.
  sync() {
    const {b, u} = this, valid = this.valid();
    const inside = new Set(valid && this.aloft() ? this.inRange() : []);
    for (const e of [...this.weightless, ...inside]) {
      if (inside.has(e) && !this.weightless.has(e)) { b.applyStatus(e, 'weightless', {source: u, key: `aglna2:weightless:${u.id}`, value: 1}); this.weightless.add(e); }
      else if (!inside.has(e) && this.weightless.has(e)) { if (live(e)) b.removeBuff(e, `aglna2:weightless:${u.id}`); this.weightless.delete(e); }
    }
    const t2 = talent(u, 'hp_recovery_per_sec_by_max_hp_ratio');
    for (const a of b.allyUnits) {
      const ok = valid && t2 && live(a) && !!a.s.flags.liftoff, key = `aglna2:t2:${u.id}`;
      if (ok && !a.findBuff(key)) { b.addBuff(a, {key, source: u, mods: {atkPct: t2.atk}}); this.boosted.add(a); }
      else if (!ok && a.findBuff?.(key)) { b.removeBuff(a, key); this.boosted.delete(a); }
    }
  }
  regen(dt) {
    const {b, u} = this, t2 = talent(u, 'hp_recovery_per_sec_by_max_hp_ratio');
    if (!t2 || !this.valid()) return;
    for (const a of this.boosted) if (live(a) && b.enemies.some(e => live(e) && e.blockedBy === a)) b.heal(u, a, a.s.maxHp * t2.hp_recovery_per_sec_by_max_hp_ratio * dt, {regen: true});
  }
  groundBind(e, duration) {
    const {b} = this;
    if (!live(e) || e.motion !== 'FLY') return;
    const d = e.weight > 3 ? duration / 2 : duration, prev = this.bound.get(e);
    this.bound.set(e, {until: b.time + d, motion: prev?.motion ?? e.motion});
    e.motion = 'WALK';
    b.addBuff(e, {key: `aglna2:groundbind:${this.u.id}`, source: this.u, duration: d, timeLeft: d, refresh: 'replace', flags: {noMove: true}});
  }
  unbind() {
    for (const [e, s] of [...this.bound]) if (!live(e) || this.b.time >= s.until) { if (live(e)) e.motion = s.motion; this.bound.delete(e); }
  }
  s2Glide() {
    const {b, u} = this, bb = u.skill.bb;
    b._refreshRange(u);
    for (const e of this.inRange()) {
      if (e.motion === 'FLY') this.groundBind(e, bb.buff_duration_ground_bound);
      else b.applyStatus(e, 'levitate', {source: u, duration: bb.buff_duration_levitate});
    }
  }
  // S3: flying enemies in range are slowed; she moves onto an unblocked flier.
  s3Tick() {
    const {b, u} = this, bb = u.skill.bb;
    const inside = new Set(this.inRange().filter(e => e.motion === 'FLY')), key = `aglna2:s3-slow:${u.id}`;
    for (const e of [...this.slowed, ...inside]) {
      if (inside.has(e) && !e.findBuff(key)) { b.addBuff(e, {key, source: u, mods: {movePct: bb.move_speed}}); this.slowed.add(e); }
      else if (!inside.has(e) && e.findBuff?.(key)) { b.removeBuff(e, key); this.slowed.delete(e); }
    }
    if (b.enemies.some(e => live(e) && e.blockedBy === u)) return;
    const base = new Set(this.home);
    const flier = [...inside].find(e => !e.blockedBy && base.has(Math.round(e.y) * COLS + Math.round(e.x)));
    if (!flier) return;
    const r = Math.round(flier.y), c = Math.round(flier.x);
    if (['MELEE', 'ALL', 'RANGED'].includes(b.grid.tile(r, c)?.build) && b.moveRedeploy(u, r, c)) this.seq = u.deploySeq;
  }
  install() {
    const {b, u} = this;
    u.mem.aglna2Owner = this;
    this.handles = [
      b.on('deploy', ({unit, move}) => { if (unit === u && !move) { this.seq = u.deploySeq; if (u.def.skill.id === AGLNA2_SKILLS[0]) this.lift(true); } }, {owner: u}),
      b.on('tick', ({dt}) => { this.sync(); this.regen(dt ?? b.dt); this.unbind(); if (this.n() === 3 && this.valid()) this.s3Tick(); }, {owner: u}),
      // S3 air protection against damage from flying enemies.
      b.on('hit', ctx => {
        if (ctx.target === u && this.n() === 3 && ctx.source?.isFlying && ['phys', 'arts'].includes(ctx.dmg.type)) ctx.dmg.mul = (ctx.dmg.mul ?? 1) * (1 - u.skill.bb.damage_resistance);
      }, {owner: u}),
      b.on('death', ({unit}) => { if (unit === u) this.stop(); }, {owner: u}),
    ];
  }
  stop() {
    for (const e of this.weightless) if (e.findBuff?.(`aglna2:weightless:${this.u.id}`)) this.b.removeBuff(e, `aglna2:weightless:${this.u.id}`);
    for (const a of this.boosted) if (a.findBuff?.(`aglna2:t2:${this.u.id}`)) this.b.removeBuff(a, `aglna2:t2:${this.u.id}`);
    this.weightless.clear(); this.boosted.clear();
  }
}
export function customizeAglna2Kit({battle: b, id, unit: u, kit}) {
  if (id !== ID) return;
  reviewed(b);
  if (!AGLNA2_SKILLS.includes(u.def.skill?.id)) throw Error('Missing original selected Angelina the Mellow Wish skill');
  const owner = new Aglna2Owner(b, u), s = u.def.skill, n = AGLNA2_SKILLS.indexOf(s.id) + 1, t1 = talent(u, 'atk_scale_lo');
  u.mem.aglna2Prepared = owner;
  kit.talents = [];
  const clip = a => a.skill?.active || n === 1 ? (n === 3 ? 'Skill_3_Loop' : `Skill_${n}_Loop`) : 'Attack';
  kit.trait = {...kit.trait, windup: (_b, a) => model(a).hits[clip(a)][0] / rate(a), attackVisual: (_b, a) => clip(a),
    canAttack: (bb, a) => !bb.isUnitInBornState(a) && !(n === 2 && a.findBuff('aglna2:glide')),
    onEachHit: (bb, a, e) => {
      if (!t1 || !live(e)) return;
      bb.dealDamage(a, e, {amount: a.s.atk * (e.weight <= t1.mass_level ? t1.atk_scale_hi : t1.atk_scale_lo), type: 'arts', applyWay: 'ranged', tags: ['aglna2', 'aglna2:t1']});
    }};
  if (n === 1) kit.skill = {id: s.id, name: s.name, kind: 'passive', mods: {atkPct: s.bb.atk},
    targeting: {maxTargets: s.bb['attack@max_target'], rangeGrid: owner.record.skillRangeGrid}};
  else if (n === 2) kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration,
    mods: {atkPct: s.bb.atk, batFlat: s.bb.base_attack_time},
    targeting: {maxTargets: s.bb['attack@max_target'], rangeGrid: owner.record.skillRangeGrid}, attack: {dmgType: 'arts'},
    onStart: () => {
      owner.lift(true);
      b.addBuff(u, {key: 'aglna2:glide', source: u, duration: s.bb.chant_duration, timeLeft: s.bb.chant_duration});
      u.mem.regularFormVisual = {clip: 'Skill_2_Takeoff_Loop', loop: true};
      owner.s2Glide();
      b.after(s.bb.chant_duration, () => { if (u.skill?.active) u.mem.regularFormVisual = {clip: 'Skill_2_Idle', loop: true, attack: 'Skill_2_Loop'}; }, {owner: u});
    },
    onEnd: () => { owner.lift(false); u.mem.regularFormVisual = null; }};
  else kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: 1, manualCancel: true, mods: {atkPct: s.bb.atk},
    targeting: {maxTargets: s.bb['attack@max_walk_target'] + 1,
      get rangeGrid() { return [...owner.record.skillRangeGrid, ...AROUND.filter(([r, c]) => !owner.record.skillRangeGrid.some(([x, y]) => x === r && y === c))]; }},
    attack: {atkScale: s.bb['attack@atk_scale'], afterAttack: () => { if (--owner.ammo <= 0 && u.skill?.active) u.skill.end('ammo'); }},
    onStart: () => {
      owner.ammo = s.bb['attack@trigger_time']; u.skill.timeLeft = Infinity; owner.lift(true);
      b._refreshRange(u); owner.home = [...u.rangeKeySet];
      u.mem.regularFormVisual = {clip: 'Skill_3_Idle', loop: true, attack: 'Skill_3_Loop'};
    },
    onEnd: () => {
      owner.lift(false); u.mem.regularFormVisual = null;
      for (const e of owner.slowed) if (e.findBuff?.(`aglna2:s3-slow:${u.id}`)) b.removeBuff(e, `aglna2:s3-slow:${u.id}`);
      owner.slowed.clear();
    }};
}
export function installAglna2({battle: b, unit: u, def}) {
  if (def.charId !== ID) return;
  reviewed(b);
  const owner = u.mem.aglna2Prepared;
  if (!owner) throw Error('Missing selected Angelina the Mellow Wish owner');
  delete u.mem.aglna2Prepared; owner.install();
}
