// SPDX-License-Identifier: GPL-3.0-or-later
// Leizi the Thunderbringer (char_1043_leizi2), Liberator Guard.
// Source: data/arkpedia-native-operators/char_1043_leizi2.json.
//
// From data: Liberator trait (generic: no attacks and no block while her skill
// is inactive, ATK ramping to `atk` over max_stack_cnt s, reset when a skill
// ends). Talent 1 (leizi2_t_1, [fly], [on_calcul]): while no skill runs she is
// lifted off; every `interval` s her range tiles call thunder for atk_scale_t
// x ATK Arts to every enemy on a struck tile; during a skill her damage uses
// atk_scale[skill_up] x ATK. Talent 2 (leizi2_t_2): a skill start strikes every
// ground tile in her range for atk_scale_t2 x ATK Arts with `not_combat` s of
// tremble. S1 (three charges, range 3-19: a forward line and a line to each
// side): one Physical strike of attack@atk_scale_s1 on a ground enemy in each
// direction (abilities s1_m/s1_l/s1_r); the trait ATK is kept until the
// charges are spent. S2: four targets at attack@atk_scale_s2 and every thunder
// strike stacks `thunder_atk` ATK up to thunder_max_stack_cnt
// (leizi2_s_2[try_add_atk]). S3: skill range, base attack time, Physical
// splash attack@atk_scale_s3 within attack@range_radius, and a current from
// the target flowing three tiles in each lane direction; enemies on current
// tiles take attack@atk_scale_current Arts every 0.6 s with `prob` to tremble
// for `not_combat` s (leizi2_s_3).
// Declared local mappings:
// - Talent 1's per-tile chance is the talent text's 10% per second; the
//   original native thunder action does not expose it.
// - S2's range growth "along ground tiles up to three" walks up to three steps
//   over ground tiles from her range; currents stop at high ground or her tile.
// - Talent 2's physical-damage marks (leizi2_t_2[scale]) are not modelled: the
//   scale they apply is not in her data.
import evidence from '../../../data/arkpedia-native-operators/char_1043_leizi2.json' with {type: 'json'};
import review from '../../../data/arkpedia-leizi2-runtime-review.json' with {type: 'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {normalizeChess} from '../simdata.js';
import {canTargetEnemy} from '../targeting.js';
import {COLS, ROWS} from '../constants.js';
import {rotateOffset, toLocal} from '../dir.js';
export const LEIZI2_ID = 'char_1043_leizi2';
export const LEIZI2_SKILLS = Object.freeze(['skchr_leizi2_1', 'skchr_leizi2_2', 'skchr_leizi2_3']);
export const selectedLeizi2Build = build => selectedCNSourceBuild(evidence, LEIZI2_ID, build);
const ID = LEIZI2_ID, live = u => !!u?.alive && u.deployed && !u.hidden;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const THUNDER_CHANCE = .1, CURRENT = Object.freeze({reach: 3, tick: .6});
function reviewed(b) {
  const approved = same(review.enabledOperators, [ID]) && review.verification.browser.status === 'passed';
  const candidate = b.regularReviewCandidates?.includes(ID) && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !candidate) || review.frameParity !== false || review.moduleSupport !== false
    || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-leizi2-thunder-v1')
    throw Error('Missing Leizi the Thunderbringer runtime review or explicit held browser candidate');
}
export function selectedLeizi2Inputs(unit) {
  const skill = unit.def.skill, build = unit.def.raw.arkpedia;
  if (!skill) throw Error('Incomplete original selected Leizi the Thunderbringer inputs');
  const s = selectedLeizi2Build({...build, skillId: skill.id});
  if (unit.def.charId !== ID || !same(unit.def.stats, normalizeChess({stats: s.stats}).stats) || !same(unit.rangeGrid, s.rangeGrid)
    || !same(unit.def.talents.map(t => t.bb), s.talentBb) || !same(skill.bb, s.bb) || skill.spCost !== s.source.spData.spCost)
    throw Error('Incomplete original selected Leizi the Thunderbringer inputs');
  return s;
}
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => u.base.bat / u.s.interval;
const talent = (u, key) => u.def.talents.find(t => t.bb[key] != null)?.bb;
class Leizi2Owner {
  constructor(b, u) { Object.assign(this, {b, u, record: selectedLeizi2Inputs(u), seq: null, handles: [], nextThunder: 0, currents: [], stacks: 0, keptRamp: null}); }
  valid() { return live(this.u) && this.u.deploySeq === this.seq && this.u.mem.leizi2Owner === this; }
  n() { return this.u.skill?.active ? LEIZI2_SKILLS.indexOf(this.u.skill.id) + 1 : 0; }
  legal(e) { return live(e) && e.side === 'enemy' && canTargetEnemy(this.u, e, {...this.u.profile, canHitFly: true}); }
  // Talent 1 [on_calcul]: her damage during a skill uses the raised ATK scale.
  scale() { return this.n() ? talent(this.u, 'atk_scale[skill_up]')['atk_scale[skill_up]'] : 1; }
  arts(e, amount, tag) { if (live(e)) this.b.dealDamage(this.u, e, {amount: amount * this.scale(), type: 'arts', applyWay: 'none', tags: ['leizi2', `leizi2:${tag}`]}); }
  tiles() { if (this.b.rangeChanged(this.u)) this.b._refreshRange(this.u); return [...this.u.rangeKeySet].map(k => [Math.floor(k / COLS), k % COLS]); }
  on(r, c) { return this.b.enemies.filter(e => this.legal(e) && Math.round(e.y) === r && Math.round(e.x) === c); }
  strike(r, c, scale, tag, tremble = 0) {
    for (const e of this.on(r, c)) {
      this.arts(e, this.u.s.atk * scale, tag);
      if (tremble && live(e)) this.b.applyStatus(e, 'tremble', {source: this.u, duration: tremble});
    }
    // S2: every thunder strike stacks ATK.
    if (this.n() === 2 && tag === 'thunder' && this.stacks < this.u.skill.bb.thunder_max_stack_cnt) {
      this.stacks++;
      this.b.addBuff(this.u, {key: 'leizi2:s2-thunder', source: this.u, mods: {atkPct: this.u.skill.bb.thunder_atk * this.stacks}});
    }
  }
  thunderTick() {
    const {b, u} = this, t = talent(u, 'atk_scale_t');
    if (!t || !this.valid() || b.time + 1e-9 < this.nextThunder) return;
    this.nextThunder = b.time + t.interval;
    for (const [r, c] of this.tiles()) if (b.rng() < THUNDER_CHANCE) this.strike(r, c, t.atk_scale_t, 'thunder');
  }
  // Lifted off while no skill runs.
  syncFly() {
    const {b, u} = this, up = this.valid() && !u.skill?.active;
    if (up && !u.findBuff('leizi2:fly')) b.addBuff(u, {key: 'leizi2:fly', source: u, flags: {liftoff: true}});
    else if (!up && u.findBuff('leizi2:fly')) b.removeBuff(u, 'leizi2:fly');
  }
  // Talent 2 at every skill start.
  opening() {
    const {b, u} = this, t = talent(u, 'atk_scale_t2');
    if (!t) return;
    for (const [r, c] of this.tiles()) if (b.grid.isLow(r, c)) this.strike(r, c, t.atk_scale_t2, 't2', t.not_combat);
  }
  // S1: one strike per direction of the 3-19 grid (forward, and each side).
  s1() {
    const {b, u} = this, bb = u.skill.bb, m = model(u);
    const lanes = {m: [], l: [], r: []};
    for (const [dr, dc] of this.record.skillRangeGrid) {
      if (!dr && !dc) continue;
      const [ar, ac] = rotateOffset(dr, dc, u.dir);
      (dc > 0 ? lanes.m : dr > 0 ? lanes.l : lanes.r).push([u.tileR + ar, u.tileC + ac]);
    }
    this.lanes = lanes;
    b.after(m.hits.Skill_1_Begin[0], () => {
      if (!this.valid()) return;
      for (const key of ['m', 'l', 'r']) {
        const t = lanes[key].flatMap(([r, c]) => this.on(r, c)).filter(e => !e.isFlying)
          .sort((p, q) => Math.hypot(p.x - u.x, p.y - u.y) - Math.hypot(q.x - u.x, q.y - u.y) || p.spawnSeq - q.spawnSeq)[0];
        if (t) b.dealDamage(u, t, {amount: u.s.atk * bb['attack@atk_scale_s1'] * this.scale(), type: 'phys', applyWay: 'melee', isSkill: true, tags: ['leizi2', 'leizi2:s1']});
      }
    }, {owner: u});
  }
  // S3 currents.
  current(e) {
    const {b} = this, r0 = Math.round(e.y), c0 = Math.round(e.x), tiles = new Set([`${r0},${c0}`]);
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let k = 1; k <= CURRENT.reach; k++) {
      const r = r0 + dr * k, c = c0 + dc * k;
      if (r < 0 || c < 0 || r >= ROWS || c >= COLS || !b.grid.isLow(r, c) || (r === this.u.tileR && c === this.u.tileC)) break;
      tiles.add(`${r},${c}`);
    }
    this.currents.push({tiles: [...tiles].map(k => k.split(',').map(Number)), next: b.time, until: b.time + 3});
  }
  currentTick() {
    const {b, u} = this;
    if (!this.currents.length) return;
    if (!this.valid() || this.n() !== 3) { this.currents = []; return; }
    const bb = u.skill.bb;
    for (const cur of this.currents) {
      if (b.time + 1e-9 < cur.next) continue;
      cur.next = b.time + CURRENT.tick;
      for (const [r, c] of cur.tiles) for (const e of this.on(r, c)) {
        this.arts(e, u.s.atk * bb['attack@atk_scale_current'], 's3-current');
        if (live(e) && b.rng() < bb.prob) b.applyStatus(e, 'tremble', {source: u, duration: bb.not_combat});
      }
    }
    this.currents = this.currents.filter(cur => b.time < cur.until);
  }
  install() {
    const {b, u} = this;
    u.mem.leizi2Owner = this;
    this.handles = [
      b.on('deploy', ({unit, move}) => {
        if (unit !== u || move) return;
        this.seq = u.deploySeq; this.nextThunder = b.time + (talent(u, 'atk_scale_t')?.interval ?? 1);
        this.s2Grid = groundReach(b, u, this.record.rangeGrid);
      }, {owner: u}),
      b.on('tick', () => { this.syncFly(); this.thunderTick(); this.currentTick(); }, {owner: u}),
      b.on('skillStart', ({unit}) => {
        if (unit !== u || !this.valid()) return;
        this.keptRamp = u.skill.id === LEIZI2_SKILLS[0] ? u.trait.ramp : null;
        this.syncFly(); this.opening();
      }, {owner: u}),
      // S1 keeps the trait ATK until its charges are spent.
      b.on('skillEnd', ({unit}) => {
        if (unit !== u) return;
        if (this.keptRamp != null && u.skill.charges >= 1) { u.trait.ramp = this.keptRamp; b.addBuff(u, {key: 'trait:libratorRamp', mods: {atkPct: u.trait.ramp}}); }
        this.keptRamp = null; this.stacks = 0; b.removeBuff(u, 'leizi2:s2-thunder');
      }, {owner: u, priority: -10}),
    ];
  }
}
export function customizeLeizi2Kit({battle: b, id, unit: u, kit}) {
  if (id !== ID) return;
  reviewed(b);
  if (!LEIZI2_SKILLS.includes(u.def.skill?.id)) throw Error('Missing original selected Leizi the Thunderbringer skill');
  const owner = new Leizi2Owner(b, u), s = u.def.skill, n = LEIZI2_SKILLS.indexOf(s.id) + 1;
  u.mem.leizi2Prepared = owner;
  kit.talents = [];
  if (n === 1) kit.skill = {id: s.id, name: s.name, kind: 'instant', trigger: 'NEVER', onStart: () => owner.s1()};
  else if (n === 2) kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration,
    onStart: () => { u.mem.regularFormVisual = {clip: 'Skill_2_Idle', loop: true, attack: 'Skill_2_Loop'}; },
    onEnd: () => { u.mem.regularFormVisual = null; },
    // Fixed once she is placed: the ground path from her deployed tile.
    targeting: {maxTargets: s.bb['attack@max_target_s2'], get rangeGrid() { return owner.s2Grid ?? owner.record.rangeGrid; }},
    attack: {atkScale: s.bb['attack@atk_scale_s2'] * talent(u, 'atk_scale[skill_up]')['atk_scale[skill_up]'], dmgType: 'phys', attack: 'ranged',
      attackVisual: () => 'Skill_2_Loop', windup: (_b, a) => model(a).hits.Skill_2_Loop[0] / rate(a)}};
  else kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration, mods: {batFlat: s.bb.base_attack_time},
    onStart: () => { u.mem.regularFormVisual = {clip: 'Skill_3_Idle', loop: true, attack: 'Skill_3_Loop'}; },
    onEnd: () => { u.mem.regularFormVisual = null; owner.currents = []; },
    targeting: {rangeGrid: owner.record.skillRangeGrid},
    attack: {atkScale: s.bb['attack@atk_scale_s3'] * talent(u, 'atk_scale[skill_up]')['atk_scale[skill_up]'], dmgType: 'phys', attack: 'ranged',
      splashRadius: s.bb['attack@range_radius'], attackVisual: () => 'Skill_3_Loop', windup: (_b, a) => model(a).hits.Skill_3_Loop[0] / rate(a),
      onEachHit: ({target, kind}) => { if (kind === 'main' && live(target)) owner.current(target); }}};
}
// S2 range: her grid plus the ground tiles reached within three steps along ground tiles.
function groundReach(b, u, grid) {
  const key = (r, c) => r * COLS + c, out = new Map();
  let frontier = [];
  for (const [dr, dc] of grid) {
    const [ar, ac] = rotateOffset(dr, dc, u.dir), r = u.tileR + ar, c = u.tileC + ac;
    out.set(key(r, c), [dr, dc]);
    if (r >= 0 && c >= 0 && r < ROWS && c < COLS && b.grid.isLow(r, c)) frontier.push([r, c]);
  }
  for (let step = 0; step < 3; step++) {
    const next = [];
    for (const [r, c] of frontier) for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= ROWS || nc >= COLS || !b.grid.isLow(nr, nc) || out.has(key(nr, nc))) continue;
      out.set(key(nr, nc), toLocal(nr - u.tileR, nc - u.tileC, u.dir)); next.push([nr, nc]);
    }
    frontier = next;
  }
  return [...out.values()];
}
export function installLeizi2({battle: b, unit: u, def}) {
  if (def.charId !== ID) return;
  reviewed(b);
  const owner = u.mem.leizi2Prepared;
  if (!owner) throw Error('Missing selected Leizi the Thunderbringer owner');
  delete u.mem.leizi2Prepared; owner.install();
}
