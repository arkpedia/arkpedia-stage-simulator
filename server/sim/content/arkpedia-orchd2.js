// SPDX-License-Identifier: GPL-3.0-or-later
// Violet Mizutsune Orchid (char_1048_orchd2), Closerange Sniper.
// Source: data/arkpedia-native-operators/char_1048_orchd2.json.
//
// From data: ordinary attacks fire a salvo of three arrows (`_salvoCount` 3)
// at the Attack_1/Attack_2 clip events, each attack@damage_scale of the hit
// (hidden talent), alternating the two clips. Talent 1 (orchd2_t_2): the first
// skill cast after deployment powers the next power_attack_count ordinary
// attacks to power_attack_scale ATK. Talent 2 (orchd2_t_1, t_1_2): redeployment
// time respawn_time and no redeployment cost increase; deploying around her
// last position (projectile_chr_orchd2_t marker, range x-1) allows melee tiles and gives
// ATK `atk` for atk_duration s, replaying the Start_2 born clip. S1 (four
// charges, auto at full): four arrows of atk_scale_1; with another charge left
// it spends it on 刚连射, five arrows of atk_scale_2 each with stun_prob to stun
// `stun` s, at the Skill_1_End_2 events (orchd2_s_1[auto], [stun_creator]).
// S2 (three charges, cast once on deployment without SP, orchd2_s_2[auto_once]):
// she lifts off (fly mode) and fires Skill_2_Loop_1..3 at every enemy in the
// skill range with 3/4/5 arrows (`_additionalTimes`) of attack@atk_scale_loop,
// then lands with attack@atk_scale_end on enemies around the tile ahead.
// S3 (two charges): after Skill_3_Begin and wait_duration she fires a piercing
// arrow (projectile_chr_orchd2_s3: speed 10) along her facing up to max_dist;
// every dist_interval travelled it deals atk_scale Physical and atk_scale_magic
// Arts to enemies around it and pushes each it passes at `force`.
// Declared local mappings:
// - The S2 landing and S3 arrow strike enemies within 0.5 of their point; the
//   prefab selector ranges carry no fields.
// - An S1 cast whose target is gone when the arrows fire refunds its charges
//   (orchd2_s_1[recover_sp_checker] TARGET_DEAD).
import evidence from '../../../data/arkpedia-native-operators/char_1048_orchd2.json' with {type: 'json'};
import review from '../../../data/arkpedia-orchd2-runtime-review.json' with {type: 'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {normalizeChess} from '../simdata.js';
import {canTargetEnemy, sortEnemyTargets} from '../targeting.js';
import {COLS, ROWS} from '../constants.js';
export const ORCHD2_ID = 'char_1048_orchd2';
export const ORCHD2_SKILLS = Object.freeze(['skchr_orchd2_1', 'skchr_orchd2_2', 'skchr_orchd2_3']);
export const selectedOrchd2Build = build => selectedCNSourceBuild(evidence, ORCHD2_ID, build);
const ID = ORCHD2_ID, live = u => !!u?.alive && u.deployed && !u.hidden;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ARROW = Object.freeze({speed: 10, step: .25, reach: .5});
// Talent 2 return area: ignore_build_type_target_range x-1 around her last tile.
const RETURN_RANGE = 'x-1', RETURN_GRID = evidence.tables.ranges[RETURN_RANGE].grids.map(g => [g.row, g.col]);
function reviewed(b) {
  const approved = same(review.enabledOperators, [ID]) && review.verification.browser.status === 'passed';
  const candidate = b.regularReviewCandidates?.includes(ID) && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !candidate) || review.frameParity !== false || review.moduleSupport !== false
    || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-orchd2-salvo-charges-v1')
    throw Error('Missing Violet Mizutsune Orchid runtime review or explicit held browser candidate');
}
// Salvo counts and the S3 arrow clock are the original prefab values.
export function verifyOrchd2Source() {
  const rows = evidence.characters[ID].flatMap(r => r.components.map(c => c.data));
  const salvo = rows.find(d => d._projectileKey === 'projectile_chr_orchd2_attack')?._salvoCount;
  const extra = ['Skill_2_Loop_1', 'Skill_2_Loop_2', 'Skill_2_Loop_3'].map(k => rows.find(d => d._animKey === k)?._additionalTimes);
  const arrow = evidence.projectiles.projectile_chr_orchd2_s3.flatMap(r => r.components.map(c => c.data));
  const interval = arrow.find(d => d._distanceInterval)?._distanceInterval?._serializedValue;
  if (!same(salvo, [3]) || !same(extra, [2, 3, 4]) || arrow.find(d => '_speed' in d)?._speed !== ARROW.speed || interval / 2 ** 32 !== ARROW.step)
    throw Error('Changed original Violet Mizutsune Orchid salvo or arrow');
}
export function selectedOrchd2Inputs(unit) {
  const skill = unit.def.skill, build = unit.def.raw.arkpedia;
  if (!skill) throw Error('Incomplete original selected Violet Mizutsune Orchid inputs');
  const s = selectedOrchd2Build({...build, skillId: skill.id});
  // String blackboard values (a range id) are compared separately below.
  const numeric = (src, bb) => Object.fromEntries(Object.keys(src).filter(k => typeof src[k] === 'number').map(k => [k, bb[k]]));
  // The roster build already applies the hidden respawn_time talent to her redeploy time.
  const stats = normalizeChess({stats: s.stats}).stats, respawn = s.talentBb.find(bb => bb.respawn_time != null)?.respawn_time ?? 0;
  if (unit.def.charId !== ID || !same(unit.def.stats, {...stats, respawnTime: stats.respawnTime + respawn}) || !same(unit.rangeGrid, s.rangeGrid)
    || !same(unit.def.talents.map((t, i) => numeric(s.talentBb[i] ?? {}, t.bb)), s.talentBb.map(bb => numeric(bb, bb)))
    || (s.talentBb.find(bb => bb.atk_duration != null)?.ignore_build_type_target_range ?? RETURN_RANGE) !== RETURN_RANGE || !same(skill.bb, s.bb) || skill.spCost !== s.source.spData.spCost)
    throw Error('Incomplete original selected Violet Mizutsune Orchid inputs');
  return s;
}
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => u.base.bat / u.s.interval;
const talent = (u, key) => u.def.talents.find(t => t.bb[key] != null)?.bb;
const front = u => ({UP: [1, 0], DOWN: [-1, 0], LEFT: [0, -1], RIGHT: [0, 1]})[u.dir];
class Orchd2Owner {
  constructor(b, u) { Object.assign(this, {b, u, record: selectedOrchd2Inputs(u), seq: null, handles: [], power: 0, firstCast: false, combo: 0, epoch: 0, arrow: null}); }
  valid() { return live(this.u) && this.u.deploySeq === this.seq && this.u.mem.orchd2Owner === this; }
  legal(e) { return live(e) && e.side === 'enemy' && canTargetEnemy(this.u, e, this.u.profile); }
  inRange() { if (this.b.rangeChanged(this.u)) this.b._refreshRange(this.u); return this.b.enemiesInKeys(this.u.rangeKeys, this.u, this.u.profile).filter(e => this.legal(e)); }
  target() { return sortEnemyTargets(this.b, this.u, this.inRange())[0] ?? null; }
  // Her last tile outlives the deployment's unit object.
  get last() { return this.b.regularOrchd2Last ?? null; }
  set last(v) { this.b.regularOrchd2Last = v; }
  near(r, c) { return !!this.last && RETURN_GRID.some(([dr, dc]) => r === this.last[0] + dr && c === this.last[1] + dc); }
  shoot(e, scale, type, tag, extra = {}) {
    if (live(e)) this.b.dealDamage(this.u, e, {amount: this.u.s.atk * scale, type, applyWay: 'ranged', isSkill: true, tags: ['orchd2', `orchd2:${tag}`], ...extra});
  }
  // Clip events after `start`, while this cast lasts.
  at(seconds, fn) { const epoch = this.epoch; this.b.after(seconds, () => { if (this.valid() && this.epoch === epoch) fn(); }, {owner: this.u}); }
  hold(seconds) { this.b.addBuff(this.u, {key: 'orchd2:cast', source: this.u, duration: seconds, timeLeft: seconds, flags: {disarm: true}}); }
  // Talent 1 arms on the first cast of a deployment.
  cast() { if (!this.firstCast) { this.firstCast = true; this.power = talent(this.u, 'power_attack_count')?.power_attack_count ?? 0; } this.epoch++; }
  s1() {
    const {u} = this, bb = u.skill.bb, m = model(u), double = u.skill.charges >= 1;
    if (double) u.skill.charges--;
    const clip = `Skill_1_End_${double ? 2 : 1}`, begin = m.durations.Skill_1_Begin, events = m.hits[clip];
    this.cast(); this.hold(begin + m.durations[clip]);
    u.mem.regularFormVisual = {clip: 'Skill_1_Begin', playId: `orchd2:s1:${u.id}:${this.epoch}`};
    this.at(begin, () => { u.mem.regularFormVisual = {clip, playId: `orchd2:s1e:${u.id}:${this.epoch}`}; });
    const t = this.target();
    this.at(begin + events[0], () => {
      if (!live(t)) { u.skill.charges = Math.min(u.skill.maxCharges, u.skill.charges + (double ? 2 : 1)); return; }
      for (let i = 0; i < 4; i++) this.shoot(t, bb.atk_scale_1, 'phys', 's1');
    });
    if (double) this.at(begin + events[1], () => {
      for (let i = 0; i < 5; i++) {
        if (!live(t)) break;
        this.shoot(t, bb.atk_scale_2, 'phys', 's1-power');
        if (this.b.rng() < bb.stun_prob) this.b.applyStatus(t, 'stun', {source: u, duration: bb.stun});
      }
    });
    this.at(begin + m.durations[clip], () => { u.mem.regularFormVisual = null; });
  }
  s2() {
    const {b, u} = this, bb = u.skill.bb, m = model(u);
    this.cast();
    b.addBuff(u, {key: 'orchd2:fly', source: u, flags: {disarm: true, liftoff: true}});
    u.mem.regularFormVisual = {clip: 'Skill_2_Begin', playId: `orchd2:s2:${u.id}:${this.epoch}`};
    let t = m.durations.Skill_2_Begin;
    [3, 4, 5].forEach((arrows, i) => {
      const clip = `Skill_2_Loop_${i + 1}`, start = t;
      this.at(start, () => { u.mem.regularFormVisual = {clip, playId: `orchd2:${clip}:${u.id}:${this.epoch}`}; });
      this.at(start + m.hits[clip][0], () => { for (const e of this.inRange()) for (let k = 0; k < arrows; k++) this.shoot(e, bb['attack@atk_scale_loop'], 'phys', 's2-loop'); });
      t += m.durations[clip];
    });
    const land = t;
    this.at(land, () => { u.mem.regularFormVisual = {clip: 'Skill_2_End', playId: `orchd2:s2e:${u.id}:${this.epoch}`}; });
    this.at(land + m.hits.Skill_2_End[0], () => {
      const [dr, dc] = front(u), x = u.x + dc, y = u.y + dr;
      for (const e of b.enemiesInRadius(x, y, ARROW.reach + .5, true).filter(e => this.legal(e))) this.shoot(e, bb['attack@atk_scale_end'], 'phys', 's2-land');
      b.removeBuff(u, 'orchd2:fly');
    });
  }
  endS2() { this.b.removeBuff(this.u, 'orchd2:fly'); this.u.mem.regularFormVisual = null; }
  s3() {
    const {u} = this, bb = u.skill.bb, m = model(u), fire = m.durations.Skill_3_Begin + bb.wait_duration;
    this.cast(); this.hold(fire + m.durations.Skill_3_End);
    u.mem.regularFormVisual = {clip: 'Skill_3_Begin', playId: `orchd2:s3:${u.id}:${this.epoch}`};
    this.at(m.durations.Skill_3_Begin, () => { u.mem.regularFormVisual = {clip: 'Skill_3_Idle', loop: true}; });
    this.at(fire, () => { u.mem.regularFormVisual = {clip: 'Skill_3_End', playId: `orchd2:s3e:${u.id}:${this.epoch}`}; });
    this.at(fire + m.hits.Skill_3_End[0], () => {
      const [dr, dc] = front(u);
      this.arrow = {x: u.x, y: u.y, dx: dc, dy: dr, travelled: 0, next: ARROW.step, pushed: new Set(), color: 0xc49cff, bb};
      (this.b.regularVisualProjectiles ??= new Set()).add(this.arrow);
    });
    this.at(fire + m.durations.Skill_3_End, () => { u.mem.regularFormVisual = null; });
  }
  moveArrow(dt) {
    const {b} = this, a = this.arrow;
    if (!a) return;
    const move = ARROW.speed * dt;
    a.x += a.dx * move; a.y += a.dy * move; a.travelled += move;
    while (a.travelled + 1e-9 >= a.next) {
      a.next += ARROW.step;
      for (const e of b.enemiesInRadius(a.x, a.y, ARROW.reach, true).filter(e => this.legal(e))) {
        this.shoot(e, a.bb.atk_scale, 'phys', 's3');
        this.shoot(e, a.bb.atk_scale_magic, 'arts', 's3-magic');
        if (!a.pushed.has(e)) { a.pushed.add(e); b.displace(e, {x: a.dx, y: a.dy}, b.pushDistance(e, a.bb.force)); }
      }
    }
    if (a.travelled >= a.bb.max_dist || a.x < -1 || a.y < -1 || a.x > COLS || a.y > ROWS) this.endArrow();
  }
  endArrow() { if (this.arrow) this.b.regularVisualProjectiles?.delete(this.arrow); this.arrow = null; }
  deployed() {
    const {b, u} = this, t = talent(u, 'atk_duration');
    this.seq = u.deploySeq; this.firstCast = false; this.power = 0; this.epoch++;
    if (t && this.near(u.tileR, u.tileC)) {
      b.addBuff(u, {key: 'orchd2:return', source: u, duration: t.atk_duration, timeLeft: t.atk_duration, mods: {atkPct: t.atk}});
      u.mem.regularFormVisual = {clip: 'Start_2', playId: `orchd2:born:${u.id}:${u.deploySeq}`};
      b.after(model(u).durations.Start_2, () => { if (u.mem.regularFormVisual?.clip === 'Start_2') u.mem.regularFormVisual = null; }, {owner: u});
    }
    // S2 is cast once on deployment without SP.
    if (u.skill?.id === ORCHD2_SKILLS[1]) b.after(model(u).durations.Start_1, () => {
      if (this.valid() && !u.skill.active) { u.skill.charges++; u.skill.activate('auto'); }
    }, {owner: u});
  }
  install() {
    const {b, u} = this, t2 = talent(u, 'atk_duration'), entry = b.bench?.[u.defId];
    u.mem.orchd2Owner = this;
    if (t2 && entry) {
      if (t2.not_add_respawn_cost_cnt) entry.noCostIncrease = true;
      (b.regularPlacementAllow ??= {})[u.defId] = (r, c, tile) => tile.build === 'MELEE' && this.near(r, c);
    }
    this.handles = [
      b.on('deploy', ({unit, move}) => { if (unit === u && !move) this.deployed(); }, {owner: u}),
      b.on('tick', ({dt}) => {
        this.moveArrow(dt);
        // S1 releases itself at full charges.
        if (this.valid() && u.skill?.id === ORCHD2_SKILLS[0] && u.skill.charges >= u.skill.maxCharges && !u.findBuff('orchd2:cast') && this.target()) u.skill.activate('auto');
      }, {owner: u}),
      b.on('death', ({unit}) => {
        if (unit !== u) return;
        this.last = [u.tileR, u.tileC]; this.endArrow(); this.endS2();
      }, {owner: u}),
    ];
  }
}
export function customizeOrchd2Kit({battle: b, id, unit: u, kit}) {
  if (id !== ID) return;
  reviewed(b);
  verifyOrchd2Source();
  if (!ORCHD2_SKILLS.includes(u.def.skill?.id)) throw Error('Missing original selected Violet Mizutsune Orchid skill');
  const owner = new Orchd2Owner(b, u), s = u.def.skill, n = ORCHD2_SKILLS.indexOf(s.id) + 1;
  const salvo = talent(u, 'attack@damage_scale');
  u.mem.orchd2Prepared = owner;
  kit.talents = [];
  const clip = () => `Attack_${owner.combo % 2 + 1}`, power = talent(u, 'power_attack_scale');
  kit.trait = {...kit.trait, hits: 3, hitDamageScale: salvo?.['attack@damage_scale'] ?? 1 / 3,
    dmgMul: () => owner.power > 0 ? power.power_attack_scale : 1,
    windup: (_b, a) => model(a).hits[clip()][0] / rate(a), attackVisual: () => clip(),
    canAttack: (bb, a) => !bb.isUnitInBornState(a),
    afterAttack: () => { owner.combo++; if (owner.power > 0) owner.power--; }};
  const charged = {id: s.id, name: s.name, kind: 'instant', trigger: 'NEVER', canActivate: () => owner.valid() && !u.findBuff('orchd2:cast') && !owner.arrow};
  if (n === 1) kit.skill = {...charged, canActivate: () => charged.canActivate() && !!owner.target(), onStart: () => owner.s1()};
  else if (n === 2) kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration,
    targeting: {rangeGrid: owner.record.skillRangeGrid}, onStart: () => owner.s2(), onEnd: () => owner.endS2()};
  else kit.skill = {...charged, onStart: () => owner.s3()};
}
export function installOrchd2({battle: b, unit: u, def}) {
  if (def.charId !== ID) return;
  reviewed(b);
  const owner = u.mem.orchd2Prepared;
  if (!owner) throw Error('Missing selected Violet Mizutsune Orchid owner');
  delete u.mem.orchd2Prepared; owner.install();
}
