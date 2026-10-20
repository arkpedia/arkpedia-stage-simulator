// SPDX-License-Identifier: GPL-3.0-or-later
// Wang (char_2027_wang), Trapmaster Specialist, and his stones
// (token_10064_wang_stone1). Source: data/arkpedia-native-operators/char_2027_wang.json.
//
// From data: Trapmaster trait (deploys traps, never onto a tile with an
// enemy); ordinary hit at the Attack_1_A/B clip events. Talent 1: `cnt` stones
// to place (token deck, cost and redeploy time from the token record); a
// manual placement adds one more stone on an adjacent tile, at most
// attack@max_spawn_cnt per deployment, preferring an undeployable tile with an
// enemy. Talent 2: a triggered stone gains attack@per_atk_scale damage and
// attack@per_magic_resist_penetrate_fixed RES penetration for every stone on
// its continuous straight line, at most attack@max_trigger_cnt times
// (wang_t_2[penetrate]). Stones use Wang's ATK (CreateBuffUseHostAsSource).
// S1/S2 (auto): gain `cnt` stones; passively a trigger applies sktok_wang_1
// (sluggish and atk_scale x ATK Arts each second for `sluggish` s) or
// sktok_wang_2 (atk_scale x ATK Arts and move_speed for `duration` s to
// enemies within tile_count tiles along the stone line, half on each side).
// S3 (manual): he stops attacking, his range grows (4-12), gains `cnt` stones
// and places those over his limit on enemies in range; stones trigger and
// strike in x-6 for sktok_wang_3 atk_scale; during S3 a stone may be placed on
// an enemy's tile in his range; the skill ends when stopped or stones run out.
// Declared local mappings (the native stone link system exposes no data):
// - A stone is active while an orthogonally adjacent tile holds another stone;
//   an active stone triggers when a ground enemy stands on its tile (S3: in its
//   x-6 area); a triggered stone is consumed and its piece returns to the deck.
// - The line count is the longer of its horizontal and vertical runs; the
//   S2 strip follows that run's axis.
// - He can hold `cnt` + 1 stones (talent text "最多拥有8枚" at cnt 7).
import evidence from '../../../data/arkpedia-native-operators/char_2027_wang.json' with {type: 'json'};
import review from '../../../data/arkpedia-wang-runtime-review.json' with {type: 'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {normalizeChess} from '../simdata.js';
import {COLS} from '../constants.js';
export const WANG_ID = 'char_2027_wang', WANG_STONE = 'token_10064_wang_stone1';
export const WANG_SKILLS = Object.freeze(['skchr_wang_1', 'skchr_wang_2', 'skchr_wang_3']);
export const selectedWangBuild = build => selectedCNSourceBuild(evidence, WANG_ID, build);
const ID = WANG_ID, live = u => !!u?.alive && u.deployed && !u.hidden;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const AREA = evidence.tables.ranges['x-6'].grids.map(g => [g.row, g.col]);
const tokenSkill = n => Object.fromEntries(evidence.tables.tokenSkills[`sktok_wang_${n}`].levels.at(-1).blackboard.map(r => [r.key, r.value]));
function reviewed(b) {
  const approved = same(review.enabledOperators, [ID]) && review.verification.browser.status === 'passed';
  const candidate = b.regularReviewCandidates?.includes(ID) && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !candidate) || review.frameParity !== false || review.moduleSupport !== false
    || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-wang-stones-v1')
    throw Error('Missing Wang runtime review or explicit held browser candidate');
}
export function selectedWangInputs(unit) {
  const skill = unit.def.skill, build = unit.def.raw.arkpedia;
  if (!skill) throw Error('Incomplete original selected Wang inputs');
  const s = selectedWangBuild({...build, skillId: skill.id});
  if (unit.def.charId !== ID || !same(unit.def.stats, normalizeChess({stats: s.stats}).stats) || !same(unit.rangeGrid, s.rangeGrid)
    || !same(unit.def.talents.map(t => t.bb), s.talentBb) || !same(skill.bb, s.bb) || skill.spCost !== s.source.spData.spCost)
    throw Error('Incomplete original selected Wang inputs');
  return s;
}
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const stoneModel = evidence.models[WANG_STONE].Single;
const rate = u => u.base.bat / u.s.interval;
const talent = (u, key) => u.def.talents.find(t => t.bb[key] != null)?.bb;
const key = t => t.tileR * COLS + t.tileC;
export class WangOwner {
  constructor(b, u) { Object.assign(this, {b, u, record: selectedWangInputs(u), seq: null, handles: [], combo: 0, extras: 0, dots: new Map(), placing: false}); }
  valid() { return live(this.u) && this.u.deploySeq === this.seq && this.u.mem.wangOwner === this; }
  n() { return WANG_SKILLS.indexOf(this.u.def.skill.id) + 1; }
  state() { return this.b.regularSummons?.get(`summon:${ID}`); }
  stones() { return this.b.allyUnits.filter(t => live(t) && t.defId === WANG_STONE && t.ownerUnit === this.u); }
  cap() { return (talent(this.u, 'attack@max_spawn_cnt')?.cnt ?? 0) + 1; }
  gain(k) { const s = this.state(); if (s) s.stock = Math.max(s.stock, Math.min(this.cap() - this.stones().filter(t => !t.mem.wangSpent).length, s.stock + k)); }
  run(stone, at) {
    const run = (dr, dc) => { let n = 0, r = stone.tileR + dr, c = stone.tileC + dc; while (at.has(r * COLS + c)) { n++; r += dr; c += dc; } return n; };
    const h = 1 + run(0, 1) + run(0, -1), v = 1 + run(1, 0) + run(-1, 0);
    return h >= v ? {count: h, axis: [0, 1]} : {count: v, axis: [1, 0]};
  }
  ground(r, c) { return this.b.enemies.filter(e => live(e) && !e.isFlying && Math.round(e.y) === r && Math.round(e.x) === c); }
  area(stone) {
    if (this.n() !== 3) return [[stone.tileR, stone.tileC]];
    return AREA.map(([dr, dc]) => [stone.tileR + dr, stone.tileC + dc]);
  }
  arts(e, scale, mul, pen, tag) {
    if (live(e)) this.b.dealDamage(this.u, e, {amount: this.u.s.atk * scale * mul, type: 'arts', applyWay: 'none', resIgnoreFlat: pen, tags: ['wang', `wang:${tag}`]});
  }
  // Talent 2 and the selected skill's stone effect.
  trigger(stone, at) {
    const {b, u} = this, t2 = talent(u, 'attack@per_atk_scale'), line = this.run(stone, at);
    const stacks = t2 ? Math.min(t2['attack@max_trigger_cnt'], line.count) : 0;
    const mul = 1 + (t2?.['attack@per_atk_scale'] ?? 0) * stacks, pen = (t2?.['attack@per_magic_resist_penetrate_fixed'] ?? 0) * stacks;
    const n = this.n(), bb = tokenSkill(n);
    if (n === 1) for (const e of this.ground(stone.tileR, stone.tileC)) {
      b.applyStatus(e, 'sluggish', {source: u, duration: bb.sluggish});
      this.dots.set(e, {until: b.time + bb.sluggish, next: b.time + 1, mul, pen, scale: bb.atk_scale});
    }
    else if (n === 2) {
      const half = bb.tile_count / 2, tiles = [];
      for (let k = -half; k <= half; k++) if (k) tiles.push([stone.tileR + line.axis[0] * k, stone.tileC + line.axis[1] * k]);
      tiles.push([stone.tileR, stone.tileC]);
      for (const [r, c] of tiles) for (const e of this.ground(r, c)) {
        this.arts(e, bb.atk_scale, mul, pen, 's2');
        if (live(e)) b.addBuff(e, {key: `wang:slow:${u.id}`, source: u, duration: bb.duration, timeLeft: bb.duration, refresh: 'replace', mods: {movePct: bb.move_speed}});
      }
    } else for (const [r, c] of this.area(stone)) for (const e of this.ground(r, c)) this.arts(e, bb.atk_scale, mul, pen, 's3');
    stone.mem.regularFormVisual = {clip: 'Attack', playId: `wang:hit:${stone.id}`};
    stone.mem.wangSpent = true;
    b.after(stoneModel.durations.Attack, () => { if (live(stone)) b.retreat(stone, {permanent: true, reason: 'wang-triggered'}); }, {owner: stone});
    this.gain(1);
  }
  tick() {
    const {b, u} = this;
    for (const [e, d] of [...this.dots]) {
      if (!live(e) || b.time >= d.until) { this.dots.delete(e); continue; }
      if (b.time + 1e-9 >= d.next) { d.next = b.time + 1; this.arts(e, d.scale, d.mul, d.pen, 's1-dot'); }
    }
    if (!this.valid()) return;
    const stones = this.stones().filter(t => !t.mem.wangSpent && b.time >= (t.mem.wangReadyAt ?? 0)), at = new Set(stones.map(key));
    for (const stone of stones) {
      const linked = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dr, dc]) => at.has((stone.tileR + dr) * COLS + stone.tileC + dc));
      stone.mem.wangActive = linked;
      if (linked && this.area(stone).some(([r, c]) => this.ground(r, c).length)) this.trigger(stone, at);
    }
    // S3 ends when no stone is left to place.
    if (this.n() === 3 && u.skill.active && (this.state()?.stock ?? 0) <= 0 && !this.stones().length) u.skill.end('stones');
  }
  // Talent 1: an extra stone beside a manual placement.
  extra(stone) {
    const {b, u} = this, t = talent(u, 'attack@max_spawn_cnt');
    if (!t || this.extras >= t['attack@max_spawn_cnt'] || this.placing) return;
    const free = (r, c) => b.grid.inRect(r, c) && !b.allyUnits.some(a => live(a) && a.tileR === r && a.tileC === c);
    const options = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dr, dc]) => [stone.tileR + dr, stone.tileC + dc]).filter(([r, c]) => free(r, c));
    const pick = options.find(([r, c]) => this.ground(r, c).length) ?? options.find(([r, c]) => ['MELEE', 'ALL'].includes(b.grid.tile(r, c).build) && !this.ground(r, c).length);
    if (!pick) return;
    this.extras++; this.placing = true;
    try { createWangStone(b, this.state(), pick[0], pick[1], {free: true}); } finally { this.placing = false; }
  }
  // S3: overflow stones go onto enemies in range.
  s3Start() {
    const {b, u} = this, s = this.state();
    if (!s) return;
    s.stock += u.skill.bb.cnt;
    const room = this.cap() - this.stones().length;
    if (s.stock <= room) return;
    let over = s.stock - room;
    s.stock = room;
    const tiles = new Set();
    for (const e of b.enemies) if (live(e) && !e.isFlying && u.rangeKeySet.has(Math.round(e.y) * COLS + Math.round(e.x))) tiles.add(`${Math.round(e.y)},${Math.round(e.x)}`);
    for (const t of tiles) {
      if (over <= 0) break;
      const [r, c] = t.split(',').map(Number);
      if (b.allyUnits.some(a => live(a) && a.tileR === r && a.tileC === c)) continue;
      this.placing = true;
      try { if (createWangStone(b, s, r, c, {free: true})) over--; } finally { this.placing = false; }
    }
  }
  install() {
    const {b, u} = this;
    u.mem.wangOwner = this;
    this.handles = [
      b.on('deploy', ({unit, move}) => {
        if (unit === u && !move) { this.seq = u.deploySeq; this.extras = 0; }
        else if (unit.defId === WANG_STONE && unit.ownerUnit === u && !unit.mem.wangFree) this.extra(unit);
      }, {owner: u}),
      b.on('tick', () => this.tick(), {owner: u}),
      b.on('death', ({unit}) => {
        if (unit !== u) return;
        for (const t of this.stones()) b.retreat(t, {permanent: true, reason: 'owner-removed'});
      }, {owner: u}),
    ];
  }
}
// A stone: a trap that cannot be targeted and never attacks by itself.
export function createWangStone(b, state, row, col, {free = false} = {}) {
  const u = state.owner, record = {...state.record, stats: {...state.record.stats, atk: u.s.atk}};
  const kit = {skill: null, trait: {noAttack: true, canAttack: () => false},
    install: (battle, t) => {
      t.kind = 'device'; t.deploymentSlotCost = 0; t.mem.wangFree = free;
      battle.addBuff(t, {key: 'wang:stone', persist: true, allowDead: true, flags: {healFree: true, invulnerable: true, untargetable: true, noSp: true, noBlock: true}});
      t.mem.wangReadyAt = battle.time + stoneModel.durations.Start;
      t.mem.regularFormVisual = {clip: 'Start', playId: `wang:start:${t.id}`};
      battle.after(stoneModel.durations.Start, () => { if (live(t) && !t.mem.wangSpent) t.mem.regularFormVisual = {clip: 'Idle', loop: true}; }, {owner: t});
    }};
  const t = b.spawnToken(u, WANG_STONE, row, col, {dir: 'RIGHT', def: record, kit});
  if (t && free) { t.mem.regularSummonCard = state.key; t.deploymentSlotCost = 0; }
  return t;
}
// During S3 a stone may be placed on an enemy's tile inside his range.
export function wangPlacementAllowsEnemy(battle, owner, row, col) {
  const w = owner?.mem.wangOwner;
  return !!w && w.n() === 3 && owner.skill?.active && owner.rangeKeySet.has(row * COLS + col);
}
export function customizeWangKit({battle: b, id, unit: u, kit}) {
  if (id !== ID) return;
  reviewed(b);
  if (!WANG_SKILLS.includes(u.def.skill?.id)) throw Error('Missing original selected Wang skill');
  const owner = new WangOwner(b, u), s = u.def.skill, n = WANG_SKILLS.indexOf(s.id) + 1;
  u.mem.wangPrepared = owner;
  kit.talents = [];
  const clip = () => `Attack_1_${owner.combo % 2 ? 'B' : 'A'}`;
  kit.trait = {...kit.trait, dmgType: 'arts', windup: (_b, a) => model(a).hits[clip()][0] / rate(a), attackVisual: () => clip(),
    canAttack: (bb, a) => !bb.isUnitInBornState(a) && !(n === 3 && a.skill?.active), afterAttack: () => { owner.combo++; }};
  if (n < 3) kit.skill = {id: s.id, name: s.name, kind: 'instant', trigger: 'SP_FULL', onStart: () => owner.gain(s.bb.cnt)};
  else kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: 1, manualCancel: true,
    targeting: {rangeGrid: owner.record.skillRangeGrid},
    onStart: () => { u.skill.timeLeft = Infinity; u.mem.regularFormVisual = {clip: 'Skill_3_Idle', loop: true}; b._refreshRange(u); owner.s3Start(); },
    onEnd: () => { u.mem.regularFormVisual = null; }};
}
export function installWang({battle: b, unit: u, def}) {
  if (def.charId !== ID) return;
  reviewed(b);
  const owner = u.mem.wangPrepared;
  if (!owner) throw Error('Missing selected Wang owner');
  delete u.mem.wangPrepared; owner.install();
}
