// SPDX-License-Identifier: GPL-3.0-or-later
// Pramanix the Prerita (char_1046_sbell2), Phalanx Caster.
// Source: data/arkpedia-native-operators/char_1046_sbell2.json.
//
// From data: Phalanx trait (generic: no attacks and raised DEF/RES while no
// skill runs; area Arts attacks while a skill runs). Talent 1
// (sbell2_t1[snow_trigger]/[enemy_enter]/[enemy_leave]): every `interval` s
// each ground tile in her range gains a snow layer, up to max_cast_cnt; a
// ground enemy entering a snowy tile takes talent_magic_scale x ATK Arts at
// once and is slowed by move_speed per layer while on it; the first enemy to
// leave the tile clears it. Talent 2 (sbell2_t2[hit_cold], [escape_dead]):
// an enemy that damages her is cold for `cold` s; the first fatal damage
// instead restores her HP, freezes her for `freeze` s and every enemy in her
// range for c2e_freeze s. S1 (two charges): atk_scale Arts to every enemy in
// range with `cold` s cold and a `force` push along her facing, then snow
// spreads up to trig_cnt ground tiles ahead. S2 (auto, infinite, manual stop):
// attacks of attack@atk_scale_s2; snow past max_cast_cnt spreads one layer to
// a neighbouring ground tile (at most talent@max_cast_tile_count tiles); ground
// enemies on snow take talent@s2_magic_scale x ATK Arts a second and are cold
// for talent@cold s on leaving it; a tile reaching max_cast_cnt freezes the
// enemies on it. S3: skill range x-2, ATK, ASPD, magic_resist_penetrate_fixed,
// attacks of attack@atk_scale_s3, enemies in range attracted to her for
// attract_time s, and snow every `interval` s.
// Declared local mappings:
// - S1's spread and S2's overflow add one layer to each reached ground tile;
//   S2's "冻结 target point" is a freeze of the enemies on that tile (the
//   effect-only token_10058_sbell2_icetgt marking it is not drawn).
import evidence from '../../../data/arkpedia-native-operators/char_1046_sbell2.json' with {type: 'json'};
import review from '../../../data/arkpedia-sbell2-runtime-review.json' with {type: 'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {normalizeChess} from '../simdata.js';
import {COLS, ROWS} from '../constants.js';
export const SBELL2_ID = 'char_1046_sbell2';
export const SBELL2_SKILLS = Object.freeze(['skchr_sbell2_1', 'skchr_sbell2_2', 'skchr_sbell2_3']);
export const selectedSbell2Build = build => selectedCNSourceBuild(evidence, SBELL2_ID, build);
const ID = SBELL2_ID, live = u => !!u?.alive && u.deployed && !u.hidden;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function reviewed(b) {
  const approved = same(review.enabledOperators, [ID]) && review.verification.browser.status === 'passed';
  const candidate = b.regularReviewCandidates?.includes(ID) && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !candidate) || review.frameParity !== false || review.moduleSupport !== false
    || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-sbell2-snow-v1')
    throw Error('Missing Pramanix the Prerita runtime review or explicit held browser candidate');
}
export function selectedSbell2Inputs(unit) {
  const skill = unit.def.skill, build = unit.def.raw.arkpedia;
  if (!skill) throw Error('Incomplete original selected Pramanix the Prerita inputs');
  const s = selectedSbell2Build({...build, skillId: skill.id});
  if (unit.def.charId !== ID || !same(unit.def.stats, normalizeChess({stats: s.stats}).stats) || !same(unit.rangeGrid, s.rangeGrid)
    || !same(unit.def.talents.map(t => t.bb), s.talentBb) || !same(skill.bb, s.bb) || skill.spCost !== s.source.spData.spCost)
    throw Error('Incomplete original selected Pramanix the Prerita inputs');
  return s;
}
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => u.base.bat / u.s.interval;
const talent = (u, key) => u.def.talents.find(t => t.bb[key] != null)?.bb;
const front = u => ({UP: [1, 0], DOWN: [-1, 0], LEFT: [0, -1], RIGHT: [0, 1]})[u.dir];
const tileOf = e => [Math.round(e.y), Math.round(e.x)];
class Sbell2Owner {
  constructor(b, u) { Object.assign(this, {b, u, record: selectedSbell2Inputs(u), seq: null, handles: [], snow: new Map(), nextSnow: 0, on: new Map(), spread: 0, escaped: false, combo: 0}); }
  valid() { return live(this.u) && this.u.deploySeq === this.seq && this.u.mem.sbell2Owner === this; }
  n() { return this.u.skill?.active ? SBELL2_SKILLS.indexOf(this.u.skill.id) + 1 : 0; }
  t1() { return talent(this.u, 'max_cast_cnt'); }
  ground(r, c) { return r >= 0 && c >= 0 && r < ROWS && c < COLS && this.b.grid.isLow(r, c); }
  tiles() { if (this.b.rangeChanged(this.u)) this.b._refreshRange(this.u); return [...this.u.rangeKeySet].map(k => [Math.floor(k / COLS), k % COLS]).filter(([r, c]) => this.ground(r, c)); }
  layers(r, c) { return this.snow.get(r * COLS + c) ?? 0; }
  // One more layer; in S2 the excess spreads to a neighbouring ground tile.
  add(r, c) {
    const t = this.t1(), k = r * COLS + c, cur = this.layers(r, c);
    if (cur < t.max_cast_cnt) {
      this.snow.set(k, cur + 1);
      if (this.n() === 2 && cur + 1 >= t.max_cast_cnt) for (const e of this.enemiesAt(r, c)) this.b.applyStatus(e, 'freeze', {source: this.u, duration: this.u.skill.bb['talent@cold']});
      return;
    }
    if (this.n() !== 2 || this.spread >= this.u.skill.bb['talent@max_cast_tile_count']) return;
    const next = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dr, dc]) => [r + dr, c + dc]).filter(([nr, nc]) => this.ground(nr, nc) && this.layers(nr, nc) < t.max_cast_cnt)
      .sort((p, q) => this.layers(...p) - this.layers(...q))[0];
    if (next) { this.spread++; this.add(...next); }
  }
  enemiesAt(r, c) { return this.b.enemies.filter(e => live(e) && !e.isFlying && Math.round(e.y) === r && Math.round(e.x) === c); }
  arts(e, scale, tag, extra = {}) { if (live(e)) this.b.dealDamage(this.u, e, {amount: this.u.s.atk * scale, type: 'arts', applyWay: 'none', tags: ['sbell2', `sbell2:${tag}`], ...extra}); }
  tick() {
    const {b, u} = this, t = this.t1();
    if (!t || !this.valid()) return;
    const interval = this.n() === 3 ? u.skill.bb.interval : t.interval;
    if (b.time + 1e-9 >= this.nextSnow) { this.nextSnow = b.time + interval; for (const [r, c] of this.tiles()) this.add(r, c); }
    // Enemies entering, staying on and leaving snow.
    const s2 = this.n() === 2 ? u.skill.bb : null;
    for (const e of b.enemies) {
      if (!live(e) || e.isFlying) { this.on.delete(e); continue; }
      const [r, c] = tileOf(e), k = r * COLS + c, prev = this.on.get(e), layers = this.layers(r, c);
      if (prev && prev.k !== k) {
        // The first enemy to leave a tile clears its snow; S2 chills it.
        if (this.snow.has(prev.k)) { this.snow.delete(prev.k); if (s2) b.applyStatus(e, 'cold', {source: u, duration: s2['talent@cold']}); }
        b.removeBuff(e, `sbell2:snow:${u.id}`);
        this.on.delete(e);
      }
      if (!layers) continue;
      if (!this.on.has(e)) { this.on.set(e, {k, next: b.time + 1}); this.arts(e, t.talent_magic_scale, 't1-enter'); }
      const slow = t.move_speed * layers, old = e.findBuff(`sbell2:snow:${u.id}`);
      if (!old || old.mods.movePct !== slow) b.addBuff(e, {key: `sbell2:snow:${u.id}`, source: u, mods: {movePct: slow}});
      const d = this.on.get(e);
      if (s2 && b.time + 1e-9 >= d.next) { d.next = b.time + 1; this.arts(e, s2['talent@s2_magic_scale'], 's2-snow'); }
    }
  }
  s1() {
    const {b, u} = this, bb = u.skill.bb, [dr, dc] = front(u);
    for (const e of b.enemies.filter(e => live(e) && u.rangeKeySet.has(Math.round(e.y) * COLS + Math.round(e.x)))) {
      this.arts(e, bb.atk_scale, 's1', {isSkill: true});
      if (!live(e)) continue;
      b.applyStatus(e, 'cold', {source: u, duration: bb.cold});
      b.displace(e, {x: dc, y: dr}, b.pushDistance(e, bb.force));
    }
    // Snow spreads ahead along the ground.
    let r = u.tileR, c = u.tileC, n = 0;
    while (n < bb.trig_cnt) { r += dr; c += dc; if (!this.ground(r, c)) { if (r < 0 || c < 0 || r >= ROWS || c >= COLS) break; continue; } this.add(r, c); n++; }
  }
  install() {
    const {b, u} = this;
    u.mem.sbell2Owner = this;
    this.handles = [
      b.on('deploy', ({unit, move}) => { if (unit === u && !move) { this.seq = u.deploySeq; this.nextSnow = b.time + (this.t1()?.interval ?? 5.5); this.escaped = false; } }, {owner: u}),
      b.on('tick', () => this.tick(), {owner: u}),
      b.on('damaged', h => {
        const t = talent(u, 'freeze');
        if (h.target === u && this.valid() && t && h.source?.side === 'enemy' && live(h.source)) b.applyStatus(h.source, 'cold', {source: u, duration: t.cold});
      }, {owner: u}),
      b.on('beforeHpZero', ctx => {
        const t = talent(u, 'freeze');
        if (ctx.unit !== u || this.escaped || !t || !this.valid()) return;
        this.escaped = true; ctx.blocked = true;
        b.after(0, () => {
          if (!live(u)) return;
          u.hp = u.s.maxHp * t.hp_ratio;
          b.applyStatus(u, 'freeze', {source: u, duration: t.freeze});
          for (const e of b.enemies) if (live(e) && u.rangeKeySet.has(Math.round(e.y) * COLS + Math.round(e.x))) b.applyStatus(e, 'freeze', {source: u, duration: t.c2e_freeze});
        }, {owner: u});
      }, {owner: u}),
      b.on('death', ({unit}) => { if (unit === u) this.stop(); }, {owner: u}),
    ];
  }
  stop() { for (const e of this.on.keys()) if (e.findBuff?.(`sbell2:snow:${this.u.id}`)) this.b.removeBuff(e, `sbell2:snow:${this.u.id}`); this.on.clear(); this.snow.clear(); }
}
export function customizeSbell2Kit({battle: b, id, unit: u, kit}) {
  if (id !== ID) return;
  reviewed(b);
  if (!SBELL2_SKILLS.includes(u.def.skill?.id)) throw Error('Missing original selected Pramanix the Prerita skill');
  const owner = new Sbell2Owner(b, u), s = u.def.skill, n = SBELL2_SKILLS.indexOf(s.id) + 1;
  u.mem.sbell2Prepared = owner;
  kit.talents = [];
  const clip = () => n === 2 ? 'Skill_2_Attack' : `Skill_3_Attack_${'ABC'[owner.combo % 3]}`;
  if (n === 1) kit.skill = {id: s.id, name: s.name, kind: 'instant', trigger: 'NEVER', onStart: () => { u.mem.regularFormVisual = {clip: 'Skill', playId: `sbell2:s1:${b.time}`}; owner.s1(); }};
  else if (n === 2) kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'SP_FULL', duration: 1, manualCancel: true,
    onStart: () => { u.skill.timeLeft = Infinity; owner.spread = 0; u.mem.regularFormVisual = {clip: 'Skill_2_Idle', loop: true, attack: 'Skill_2_Attack'}; },
    onEnd: () => { u.mem.regularFormVisual = null; },
    attack: {atkScale: s.bb['attack@atk_scale_s2'], attackVisual: () => clip(), windup: (_b, a) => model(a).hits[clip()][0] / rate(a), afterAttack: () => { owner.combo++; }}};
  else kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration,
    mods: {atkPct: s.bb.atk, aspd: s.bb.attack_speed, resIgnoreFlat: s.bb.magic_resist_penetrate_fixed},
    targeting: {rangeGrid: owner.record.skillRangeGrid},
    onStart: () => {
      u.mem.regularFormVisual = {clip: 'Skill_3_Idle', loop: true, attack: 'Skill_3_Attack_A'};
      b._refreshRange(u); owner.nextSnow = Math.min(owner.nextSnow, b.time + s.bb.interval);
      for (const e of b.enemies) if (live(e) && u.rangeKeySet.has(Math.round(e.y) * COLS + Math.round(e.x))) b.applyStatus(e, 'attract', {source: u, duration: s.bb.attract_time});
    },
    onEnd: () => { u.mem.regularFormVisual = null; },
    attack: {atkScale: s.bb['attack@atk_scale_s3'], attackVisual: () => clip(), windup: (_b, a) => model(a).hits[clip()][0] / rate(a), afterAttack: () => { owner.combo++; }}};
}
export function installSbell2({battle: b, unit: u, def}) {
  if (def.charId !== ID) return;
  reviewed(b);
  const owner = u.mem.sbell2Prepared;
  if (!owner) throw Error('Missing selected Pramanix the Prerita owner');
  delete u.mem.sbell2Prepared; owner.install();
}
