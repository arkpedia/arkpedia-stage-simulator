// SPDX-License-Identifier: GPL-3.0-or-later
// Yūtenji Nyamu (char_4185_amoris), Earthshaker Guard of Ave Mujica.
// Source: data/arkpedia-native-operators/char_4185_amoris.json (tables, clip
// events, splash collider radii) and data/arkpedia-fever-source.json.
//
// From data: stats/skills/talents; ordinary hit at the Attack clip's single
// OnAttack event; S1/S2 hits at every OnAttack event of Skill_1 (3) and
// Skill_2 (8); splash radius 1.0, 1.5 on S1's heavy first hit; trait splash
// 50% of the hit's ATK multiplier; talent 1 fragile chance/value/duration;
// talent 2 Fever per second and the Ave Mujica ATK aura; S2 range x-4.
// Declared local mappings (PRTS notes, not recovered native behaviour):
// - Continuous attack: with no legal target she strikes the tile in front of
//   her (S2: a random tile in range) and only the splash lands.
// - S1 shrinks her range to the single tile in front.
// - Talent 1 rolls once per damage instance she deals, before that damage.
import evidence from '../../../data/arkpedia-native-operators/char_4185_amoris.json' with {type: 'json'};
import review from '../../../data/arkpedia-amoris-runtime-review.json' with {type: 'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {normalizeChess, normSpType} from '../simdata.js';
import {canTargetEnemy, sortEnemyTargets} from '../targeting.js';
import {COLS} from '../constants.js';
import {feverOf, FEVER_MEMBERS} from './arkpedia-fever.js';
export const AMORIS_ID = 'char_4185_amoris';
export const AMORIS_SKILLS = Object.freeze(['skchr_amoris_1', 'skchr_amoris_2']);
export const selectedAmorisBuild = build => selectedCNSourceBuild(evidence, AMORIS_ID, build);
const ID = AMORIS_ID, live = u => !!u?.alive && u.deployed && !u.hidden;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const plain = {groundOnly: true, canHitFly: false};
const COLLIDERS = Object.freeze({projectile_chr_amoris: 1, projectile_chr_amoris_s1_1: 1.5, projectile_chr_amoris_s1_2: 1,
  projectile_chr_amoris_s2_1: 1, projectile_chr_amoris_s2_2: 1});
// Each hit's collider radius, read from the projectile prefab's CircleCollider2D.
export function amorisSplashRadii() {
  return Object.fromEntries(Object.keys(COLLIDERS).map(k => {
    const r = evidence.projectiles[k].flatMap(row => row.components).filter(c => c.type === 'CircleCollider2D');
    if (r.length !== 1) throw Error('Missing original Nyamu hit collider');
    return [k, r[0].data.m_Radius];
  }));
}
export function verifyAmorisSource() {
  if (!same(amorisSplashRadii(), COLLIDERS)) throw Error('Changed original Nyamu hit colliders');
  for (const face of ['Front', 'Back']) {
    const h = evidence.models[ID][face].hits;
    if (h.Attack.length !== 1 || h.Skill_1.length !== 3 || h.Skill_2.length !== 8) throw Error('Changed original Nyamu attack events');
  }
}
function reviewed(b) {
  const approved = same(review.enabledOperators, [ID]) && review.verification.browser.status === 'passed';
  const candidate = b.regularReviewCandidates?.includes(ID) && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !candidate) || review.frameParity !== false || review.moduleSupport !== false
    || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-amoris-continuous-splash-fever-v1')
    throw Error('Missing Nyamu runtime review or explicit held browser candidate');
}
export function selectedAmorisInputs(unit) {
  const skill = unit.def.skill, build = unit.def.raw.arkpedia;
  if (!skill) throw Error('Incomplete original selected Nyamu inputs');
  const s = selectedAmorisBuild({...build, skillId: skill.id});
  if (unit.def.charId !== ID || !same(unit.def.stats, normalizeChess({stats: s.stats}).stats) || !same(unit.rangeGrid, s.rangeGrid)
    || !same(unit.def.talents.map(t => t.bb), s.talentBb) || !same(skill.bb, s.bb) || !same(skill.rangeGrid ?? [], s.skillRangeGrid)
    || skill.spType !== normSpType(s.source.spData.spType) || skill.spCost !== s.source.spData.spCost
    || skill.initSp !== s.source.spData.initSp || skill.duration !== s.source.duration)
    throw Error('Incomplete original selected Nyamu inputs');
  return s;
}
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => u.base.bat / u.s.interval;
const index = u => u.skill?.active ? AMORIS_SKILLS.indexOf(u.skill.id) + 1 : 0;
const front = u => ({UP: [1, 0], DOWN: [-1, 0], LEFT: [0, -1], RIGHT: [0, 1]})[u.dir];
function legal(u, e) { return live(e) && e.side === 'enemy' && canTargetEnemy(u, e, plain); }
function choose(b, u) {
  if (b.rangeChanged(u)) b._refreshRange(u);
  if (index(u) === 1) {
    const [dr, dc] = front(u), r = u.tileR + dr, c = u.tileC + dc;
    const ts = b.enemies.filter(e => legal(u, e) && Math.round(e.y) === r && Math.round(e.x) === c);
    return sortEnemyTargets(b, u, ts);
  }
  const ts = b.enemiesInKeys(u.rangeKeys, u, plain).filter(e => legal(u, e));
  for (const e of b.blockedTargets(u, plain)) if (legal(u, e) && !ts.includes(e)) ts.push(e);
  return sortEnemyTargets(b, u, ts);
}
// One strike of an attack: the main target (if any) and the splash around it.
function strike(b, u, at, main, scale, radius, info) {
  const roll = e => {
    const t = u.def.talents.find(t => t.bb.prob != null)?.bb;
    if (t && live(e) && b.rng() < t.prob) b.applyStatus(e, 'fragile', {source: u, value: t.damage_scale - 1, duration: t['weak[limit]']});
  };
  const hit = (e, amount, kind) => {
    roll(e);
    if (live(e)) b.dealDamage(u, e, {amount, type: 'phys', isAttack: true, isSkill: info.isSkill, attackId: info.attackId,
      applyWay: 'melee', tags: ['amoris', `amoris:${kind}`, ...(info.isSkill ? [`amoris:s${index(u)}`] : [])]});
  };
  const atk = u.s.atk * u.s.atkScaleMul;
  if (main && legal(u, main)) hit(main, atk * scale, 'main');
  const splash = u.def.trait?.bb?.['attack@atk_scale_2'] ?? .5;
  for (const e of b.foesInRadius(at.x, at.y, radius, true)) if (e !== main && legal(u, e)) hit(e, atk * scale * splash, 'splash');
}
function plan(b, u, n) {
  // [hit time in clip, ATK multiplier, splash radius] for every event of the clip.
  const m = model(u), bb = u.skill.bb;
  if (n === 1) return m.hits.Skill_1.map((t, i) => [t, i ? bb['attack@atk_scale_light'] : bb['attack@atk_scale_heavy'], i ? COLLIDERS.projectile_chr_amoris_s1_2 : COLLIDERS.projectile_chr_amoris_s1_1]);
  if (n === 2) return m.hits.Skill_2.map((t, i) => [t, i === 0 || i === 4 ? bb['attack@atk_scale_heavy'] : bb['attack@atk_scale_light'], COLLIDERS.projectile_chr_amoris_s2_1]);
  return [[m.hits.Attack[0], 1, COLLIDERS.projectile_chr_amoris]];
}
function aim(b, u, n, targets) {
  if (n === 2) {
    if (targets.length) return {main: targets[Math.floor(b.rng() * targets.length)]};
    const keys = [...u.rangeKeys]; const k = keys[Math.floor(b.rng() * keys.length)];
    return k == null ? null : {tile: {y: Math.floor(k / COLS), x: k % COLS}};
  }
  if (targets.length) return {main: targets[0]};
  const [dr, dc] = front(u), r = u.tileR + dr, c = u.tileC + dc;
  // Outside the map there is no tile to strike (PRTS: she does not attack).
  return r >= 0 && c >= 0 && c < COLS && b.grid.tiles[r * COLS + c] ? {tile: {y: r, x: c}} : null;
}
class AmorisOwner {
  constructor(b, u) {
    verifyAmorisSource();
    Object.assign(this, {b, u, record: selectedAmorisInputs(u), seq: null, attack: null, handles: [], aura: new Set()});
  }
  valid() { return live(this.u) && this.u.deploySeq === this.seq && this.u.mem.amorisOwner === this; }
  tick() {
    const {b, u} = this;
    if (!this.valid()) return;
    this.auraTick();
    if (this.attack) return this.step();
    if (u.atkCd > 0 || !u.canAct || u.s.flags.disarm || u.mem.regularBornUntil > b.time) return;
    const n = index(u), targets = choose(b, u), first = aim(b, u, n, targets);
    if (!first) return;
    const clip = n ? `Skill_${n}` : 'Attack', r = rate(u);
    this.attack = {n, clip, hits: plan(b, u, n), next: 0, start: b.time, rate: r, epoch: u.attackControlEpoch,
      activation: u.skill.activations, attackId: ++b._attackSeq, first, hit: 0};
    u.mem.regularFormVisual = {clip, speed: r, playId: `amoris:${this.seq}:${this.attack.attackId}`};
    u.atkCd = Math.max(u.s.interval, model(u).durations[clip] / r);
    u.lastAttackAt = b.time; u.stats.attacks++;
    this.step();
  }
  step() {
    const {b, u} = this, a = this.attack;
    if (!this.valid() || !u.canAct || u.s.flags.disarm || a.epoch !== u.attackControlEpoch
      || (a.n && (!u.skill.active || u.skill.activations !== a.activation))) { this.attack = null; return; }
    while (a.next < a.hits.length && b.time - a.start + 1e-9 >= a.hits[a.next][0] / a.rate) {
      const [, scale, radius] = a.hits[a.next];
      const target = a.next === 0 ? a.first : aim(b, u, a.n, choose(b, u));
      a.next++;
      if (!target) continue;
      const at = target.main ? {x: target.main.x, y: target.main.y} : target.tile;
      strike(b, u, at, target.main ?? null, scale, radius, {isSkill: a.n > 0, attackId: a.attackId});
      a.hit++;
      if (a.next === 1) {
        if (b._hooks.attack) b.emit('attack', {attacker: u, targets: target.main ? [target.main] : [], isSkill: a.n > 0});
        u.skill?.onAttackPerformed(target.main ? [target.main] : [], a.n > 0);
      }
    }
    if (a.next >= a.hits.length) this.attack = null;
  }
  auraTick() {
    const {b, u} = this, atk = u.def.talents.find(t => t.bb.cnt != null)?.bb.atk, key = `amoris:aura:${u.id}`;
    for (const m of b.allyUnits) {
      const ok = atk && live(m) && m.kind === 'op' && FEVER_MEMBERS.includes(m.defId);
      if (ok && !m.findBuff(key)) { b.addBuff(m, {key, source: u, mods: {atkPct: atk}}); this.aura.add(m); }
      else if (!ok && m.findBuff(key)) { b.removeBuff(m, key); this.aura.delete(m); }
    }
  }
  install() {
    const {b, u} = this;
    u.mem.amorisOwner = this;
    const fever = feverOf(b), gain = u.def.talents.find(t => t.bb.cnt != null)?.bb;
    this.handles = [
      b.on('deploy', ({unit, move}) => {
        if (unit !== u || move) return;
        this.seq = u.deploySeq; this.attack = null;
        u.mem.regularBornUntil = b.time + model(u).durations.Start;
      }, {owner: u}),
      b.on('tick', () => this.tick(), {owner: u}),
      b.on('death', ({unit}) => { if (unit === u) this.stop(); }, {owner: u}),
      b.on('battleEnd', () => this.stop(), {owner: u}),
    ];
    if (gain) this.handles.push(b.every(gain.interval, () => { if (this.valid()) fever.add(u, gain.cnt); }, {owner: u}));
  }
  stop() {
    this.attack = null;
    for (const m of this.aura) if (m.findBuff(`amoris:aura:${this.u.id}`)) this.b.removeBuff(m, `amoris:aura:${this.u.id}`);
    this.aura.clear();
  }
}
export function customizeAmorisKit({battle: b, id, unit: u, kit}) {
  if (id !== ID) return;
  reviewed(b);
  if (!AMORIS_SKILLS.includes(u.def.skill?.id)) throw Error('Missing original selected Nyamu skill');
  const owner = new AmorisOwner(b, u), s = u.def.skill, n = AMORIS_SKILLS.indexOf(s.id) + 1;
  u.mem.amorisPrepared = owner;
  kit.install = null; kit.talents = [];
  kit.trait = {noAttack: true};
  kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration,
    targeting: n === 2 ? {rangeGrid: owner.record.skillRangeGrid} : null,
    onStart: () => { owner.attack = null; u.atkCd = 0; },
    onEnd: () => { owner.attack = null; }};
}
export function installAmoris({battle: b, unit: u, def}) {
  if (def.charId !== ID) return;
  reviewed(b);
  const owner = u.mem.amorisPrepared;
  if (!owner) throw Error('Missing selected Nyamu owner');
  delete u.mem.amorisPrepared; owner.install();
}
