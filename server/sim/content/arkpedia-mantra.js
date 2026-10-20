// SPDX-License-Identifier: GPL-3.0-or-later
// Mantra (char_4204_mantra), Primal Caster.
// Source: data/arkpedia-native-operators/char_4204_mantra.json.
//
// From data: Primal Caster trait (Arts attacks that may carry elements);
// ordinary hit at the Attack clip event. Talent 1 (mantra_t_1,
// palsy_prob_retain): whenever an enemy's palsy triggers it takes atk_scale x
// ATK elemental damage (元素伤害) from her, and with `prob` the triggered layer
// is kept. Talent 2 (mantra_t_2[cast]/[make_palsy], TileListener): enemies
// appearing at the spawn point nearest to her get one palsy layer. S1 (auto,
// next attack): atk_scale Arts with ep_damage_ratio of the damage as neural
// injury, plus element_atk_scale x ATK elemental damage on a target in a
// neural burst. S2: base attack time, attack@atk_scale Arts then chain_times
// jumps of attack@chain.atk_scale a short interval apart, each with
// attack@ep_damage_ratio neural injury and attack@element_atk_scale elemental
// damage in a burst. S3 (mantra_s_3[self]/[ally]/[enemy]/[enemy_trigger]):
// skill range, ATK, attack@max_target targets; enemies in range lose stealth
// and their palsy cap drops to 2; a skill started by an operator in her range
// (herself included) gives enemies in range per_active palsy, at most
// max_trigger_cnt times; every layer over the cap launches an element hit of
// atk_scale x ATK through the enemy and chain_times others, one launch every
// interval_projectile_trigger s.
// Declared local mappings:
// - External palsy grants are clamped to the general cap of 3 before the
//   S3 cap of 2 is applied, so they can overflow by at most one layer.
// - Chain and overflow jumps go to the nearest other enemy within 1.7, 0.15 s
//   apart (the template's "short interval").
import evidence from '../../../data/arkpedia-native-operators/char_4204_mantra.json' with {type: 'json'};
import review from '../../../data/arkpedia-mantra-runtime-review.json' with {type: 'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {normalizeChess} from '../simdata.js';
import {canTargetEnemy} from '../targeting.js';
import {COLS} from '../constants.js';
export const MANTRA_ID = 'char_4204_mantra';
export const MANTRA_SKILLS = Object.freeze(['skchr_mantra_1', 'skchr_mantra_2', 'skchr_mantra_3']);
export const selectedMantraBuild = build => selectedCNSourceBuild(evidence, MANTRA_ID, build);
const ID = MANTRA_ID, live = u => !!u?.alive && u.deployed && !u.hidden;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const JUMP = Object.freeze({radius: 1.7, delay: .15}), S3_CAP = 2;
function reviewed(b) {
  const approved = same(review.enabledOperators, [ID]) && review.verification.browser.status === 'passed';
  const candidate = b.regularReviewCandidates?.includes(ID) && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !candidate) || review.frameParity !== false || review.moduleSupport !== false
    || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-mantra-palsy-neural-v1')
    throw Error('Missing Mantra runtime review or explicit held browser candidate');
}
export function selectedMantraInputs(unit) {
  const skill = unit.def.skill, build = unit.def.raw.arkpedia;
  if (!skill) throw Error('Incomplete original selected Mantra inputs');
  const s = selectedMantraBuild({...build, skillId: skill.id});
  if (unit.def.charId !== ID || !same(unit.def.stats, normalizeChess({stats: s.stats}).stats) || !same(unit.rangeGrid, s.rangeGrid)
    || !same(unit.def.talents.map(t => t.bb), s.talentBb) || !same(skill.bb, s.bb) || skill.spCost !== s.source.spData.spCost)
    throw Error('Incomplete original selected Mantra inputs');
  return s;
}
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => u.base.bat / u.s.interval;
const talent = (u, key) => u.def.talents.find(t => t.bb[key] != null)?.bb;
class MantraOwner {
  constructor(b, u) { Object.assign(this, {b, u, record: selectedMantraInputs(u), seq: null, handles: [], spawn: null, triggers: 0, queue: [], nextLaunch: 0, covered: new Set()}); }
  valid() { return live(this.u) && this.u.deploySeq === this.seq && this.u.mem.mantraOwner === this; }
  n() { return this.u.skill?.active ? MANTRA_SKILLS.indexOf(this.u.skill.id) + 1 : 0; }
  legal(e) { return live(e) && e.side === 'enemy' && canTargetEnemy(this.u, e, {...this.u.profile, canHitFly: true}); }
  inRange() { if (this.b.rangeChanged(this.u)) this.b._refreshRange(this.u); return this.b.enemies.filter(e => live(e) && this.u.rangeKeySet.has(Math.round(e.y) * COLS + Math.round(e.x))); }
  elemental(e, scale, tag) { if (live(e)) this.b.dealDamage(this.u, e, {amount: this.u.s.atk * scale, type: 'elemental', element: 'neural', tags: ['mantra', `mantra:${tag}`]}); }
  injury(e, dealt, ratio) { if (live(e) && dealt > 0) this.b.dealDamage(this.u, e, {amount: dealt * ratio, type: 'element', element: 'neural', tags: ['mantra', 'mantra:injury']}); }
  arts(e, scale, tag) { return live(e) ? this.b.dealDamage(this.u, e, {amount: this.u.s.atk * scale, type: 'arts', applyWay: 'ranged', isSkill: true, tags: ['mantra', `mantra:${tag}`]}) : 0; }
  burst(e) { return !!e?.findBuff?.('neuralBurst'); }
  // Neural skill hit: Arts, injury and the burst bonus.
  neural(e, scale, ratio, extra, tag, dealt = null) {
    const d = dealt ?? this.arts(e, scale, tag);
    if (this.burst(e)) this.elemental(e, extra, `${tag}-burst`);
    this.injury(e, d, ratio);
  }
  next(from, hit) { return this.b.enemiesInRadius(from.x, from.y, JUMP.radius, true).filter(e => this.legal(e) && !hit.has(e)).sort((p, q) => Math.hypot(p.x - from.x, p.y - from.y) - Math.hypot(q.x - from.x, q.y - from.y) || p.spawnSeq - q.spawnSeq)[0] ?? null; }
  chain(first, jumps, each) {
    const hit = new Set([first]);
    let at = first;
    for (let i = 1; i <= jumps; i++) this.b.after(JUMP.delay * i, () => {
      if (!this.valid() || !at) return;
      const e = this.next(at, hit);
      if (!e) { at = null; return; }
      hit.add(e); each(e); at = e;
    }, {owner: this.u});
  }
  // Talent 2: the spawn point nearest to her.
  nearestSpawn() {
    const {b, u} = this;
    let best = null, bd = Infinity;
    b.grid.tiles.forEach((t, k) => {
      if (t?.key !== 'tile_start') return;
      const r = Math.floor(k / COLS), c = k % COLS, d = Math.hypot(r - u.tileR, c - u.tileC);
      if (d < bd - 1e-9) { bd = d; best = [r, c]; }
    });
    return best;
  }
  // S3 overflow: layers over the cap queue element launches.
  overflow() {
    const {b} = this;
    if (this.n() !== 3) return;
    const inside = new Set(this.inRange());
    for (const e of inside) {
      const p = e.findBuff('palsy');
      if (p && p.stacks > S3_CAP) { const over = p.stacks - S3_CAP; p.stacks = S3_CAP; e.markDirty(); for (let i = 0; i < over; i++) this.queue.push(e); }
      if (!e.findBuff('mantra:s3-reveal')) { b.addBuff(e, {key: 'mantra:s3-reveal', source: this.u, flags: {stealthOff: true}}); this.covered.add(e); }
    }
    for (const e of [...this.covered]) if (!inside.has(e)) { if (e.findBuff?.('mantra:s3-reveal')) b.removeBuff(e, 'mantra:s3-reveal'); this.covered.delete(e); }
    if (this.queue.length && b.time + 1e-9 >= this.nextLaunch) {
      const bb = this.u.skill.bb, e = this.queue.shift();
      this.nextLaunch = b.time + bb.interval_projectile_trigger;
      if (live(e)) { this.elemental(e, bb.atk_scale, 's3-overflow'); this.chain(e, bb.chain_times, x => this.elemental(x, bb.atk_scale, 's3-overflow')); }
    }
  }
  grant(e, layers) {
    const {b} = this, p = e.findBuff('palsy'), now = p?.stacks ?? 0, over = Math.max(0, now + layers - S3_CAP);
    const add = Math.min(S3_CAP, now + layers) - now;
    if (add > 0) b.applyStatus(e, 'palsy', {source: this.u, value: add, duration: Infinity});
    for (let i = 0; i < over; i++) this.queue.push(e);
  }
  endS3() {
    for (const e of this.covered) if (e.findBuff?.('mantra:s3-reveal')) this.b.removeBuff(e, 'mantra:s3-reveal');
    this.covered.clear(); this.queue = []; this.triggers = 0;
  }
  install() {
    const {b, u} = this;
    u.mem.mantraOwner = this;
    this.handles = [
      b.on('deploy', ({unit, move}) => { if (unit === u && !move) { this.seq = u.deploySeq; this.spawn = this.nearestSpawn(); } }, {owner: u}),
      b.on('tick', () => { if (this.valid()) this.overflow(); }, {owner: u}),
      // Talent 1.
      b.on('palsyTriggered', ({unit}) => {
        const t = talent(u, 'prob');
        if (!t || !this.valid() || !live(unit)) return;
        this.elemental(unit, t.atk_scale, 't1');
        if (b.rng() < t.prob) b.applyStatus(unit, 'palsy', {source: u, value: 1, duration: Infinity});
      }, {owner: u}),
      // Talent 2.
      b.on('enemySpawn', ({enemy}) => {
        // Talent 2 has an empty blackboard: it is present when a second talent is unlocked.
        if (!this.valid() || !this.spawn || !u.def.talents.some(t => t.bb.prob == null) || Math.round(enemy.y) !== this.spawn[0] || Math.round(enemy.x) !== this.spawn[1]) return;
        b.applyStatus(enemy, 'palsy', {source: u, value: 1, duration: Infinity});
      }, {owner: u}),
      // S3: skill starts by operators in her range.
      b.on('skillStart', ({unit}) => {
        if (this.n() !== 3 || !this.valid() || this.triggers >= u.skill.bb.max_trigger_cnt) return;
        const inRange = unit === u || (unit.side === 'ally' && u.rangeKeySet.has(unit.tileR * COLS + unit.tileC));
        const enemies = this.inRange();
        if (!inRange || !enemies.length) return;
        this.triggers++;
        for (const e of enemies) this.grant(e, u.skill.bb.per_active);
      }, {owner: u}),
      b.on('death', ({unit}) => { if (unit === u) this.endS3(); }, {owner: u}),
    ];
  }
}
export function customizeMantraKit({battle: b, id, unit: u, kit}) {
  if (id !== ID) return;
  reviewed(b);
  if (!MANTRA_SKILLS.includes(u.def.skill?.id)) throw Error('Missing original selected Mantra skill');
  const owner = new MantraOwner(b, u), s = u.def.skill, n = MANTRA_SKILLS.indexOf(s.id) + 1;
  u.mem.mantraPrepared = owner;
  kit.talents = [];
  const clip = a => a.skill?.pending && n === 1 ? 'Skill_1' : a.skill?.active && n === 3 ? 'Skill_3_Loop' : 'Attack';
  kit.trait = {...kit.trait, dmgType: 'arts', windup: (_b, a) => model(a).hits[clip(a)][0] / rate(a), attackVisual: (_b, a) => clip(a),
    canAttack: (bb, a) => !bb.isUnitInBornState(a)};
  if (n === 1) kit.skill = {id: s.id, name: s.name, kind: 'instant', trigger: 'SP_FULL',
    attack: {atkScale: s.bb.atk_scale, onEachHit: ({target, kind, dealt}) => { if (kind === 'main') owner.neural(target, s.bb.atk_scale, s.bb.ep_damage_ratio, s.bb.element_atk_scale, 's1', dealt); }}};
  else if (n === 2) kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration, mods: {batFlat: s.bb.base_attack_time},
    attack: {atkScale: s.bb['attack@atk_scale'], onEachHit: ({target, kind, dealt}) => {
      if (kind !== 'main') return;
      const bb = u.skill.bb;
      owner.neural(target, bb['attack@atk_scale'], bb['attack@ep_damage_ratio'], bb['attack@element_atk_scale'], 's2', dealt);
      owner.chain(target, bb.chain_times, e => owner.neural(e, bb['attack@chain.atk_scale'], bb['attack@ep_damage_ratio'], bb['attack@element_atk_scale'], 's2-chain'));
    }}};
  else kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration, mods: {atkPct: s.bb.atk},
    targeting: {maxTargets: s.bb['attack@max_target'], rangeGrid: owner.record.skillRangeGrid},
    onStart: () => { u.mem.regularFormVisual = {clip: 'Skill_3_Idle', loop: true, attack: 'Skill_3_Loop'}; },
    onEnd: () => { u.mem.regularFormVisual = null; owner.endS3(); }};
}
export function installMantra({battle: b, unit: u, def}) {
  if (def.charId !== ID) return;
  reviewed(b);
  const owner = u.mem.mantraPrepared;
  if (!owner) throw Error('Missing selected Mantra owner');
  delete u.mem.mantraPrepared; owner.install();
}
