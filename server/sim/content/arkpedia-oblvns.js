// SPDX-License-Identifier: GPL-3.0-or-later
// Togawa Sakiko (char_4182_oblvns), Lord Guard of Ave Mujica.
// Source: data/arkpedia-native-operators/char_4182_oblvns.json (tables, clip
// events, ability damage types and note projectile parameters) and
// data/arkpedia-fever-source.json.
//
// From data: Lord trait (80% ATK on enemies she does not block); continuous
// attack firing a tracking note at the Attack/Combat event; talent 1 per-note
// DEF/RES penetration for members (max_cnt) and note expiry `delay` outside
// her range; talent 2 Fever cnt per damage dealt, member range sharing and the
// ASPD aura in her range; S1 two charges, eight Arts notes atk_scale..atk_scale_8
// in a fan; S2 piano (ATK, fast Physical piercing notes) / organ (ASPD, slow Arts
// notes) switch with Fever double notes; S3 3-21 range, 2 Physical + 2 Arts
// notes at attack@atk_scale; note speeds and free-flight times from the
// projectile prefabs.
// Declared local mappings (PRTS notes and simplifications):
// - Notes fly straight at their free speed for their switch-to-tracing time,
//   then home in on their target (or the nearest enemy within the tracking
//   radius) at their tracking speed; turn-rate curves and sine-wave free
//   motion are not modelled. A note hits within 0.2 tiles of its target.
// - S1 is cast over its 1.3 s clip; a full-charge auto release does not start Fever.
// - S2 switches instrument instantly; piano is the initial instrument. While
//   Fever can start, the cast only starts Fever (no switch). During Fever S2
//   cannot be cast and each attack fires two notes.
// - S3 piano notes track the highest-RES enemy, organ notes the highest-DEF.
//   During Fever with S3 active, members are held at 1 HP on fatal damage and
//   retreat when Fever ends.
import evidence from '../../../data/arkpedia-native-operators/char_4182_oblvns.json' with {type: 'json'};
import review from '../../../data/arkpedia-oblvns-runtime-review.json' with {type: 'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {normalizeChess, normSpType} from '../simdata.js';
import {absoluteRangeKeys, canTargetEnemy} from '../targeting.js';
import {feverOf, FEVER_MEMBERS} from './arkpedia-fever.js';
export const OBLVNS_ID = 'char_4182_oblvns';
export const OBLVNS_SKILLS = Object.freeze(['skchr_oblvns_1', 'skchr_oblvns_2', 'skchr_oblvns_3']);
export const selectedOblvnsBuild = build => selectedCNSourceBuild(evidence, OBLVNS_ID, build);
const ID = OBLVNS_ID, live = u => !!u?.alive && u.deployed && !u.hidden;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// [free speed, tracking speed, switch-to-tracing time, tracking radius]
export const NOTE_KINDS = Object.freeze({
  ordinary: Object.freeze({projectile: 'projectile_chr_oblvns', free: 2, track: 2, switchAt: .1, radius: 1}),
  s1: Object.freeze({projectile: 'projectile_chr_oblvns_s1_1', free: 1.7, track: 2.2, switchAt: .6, radius: 1}),
  piano: Object.freeze({projectile: 'projectile_chr_oblvns_s2', free: 1.9, track: 3.5, switchAt: .4, radius: .8}),
  organ: Object.freeze({projectile: 'projectile_chr_oblvns_s2_slow', free: .7, track: 1, switchAt: .4, radius: 1}),
  s3: Object.freeze({projectile: 'projectile_chr_oblvns_s3_phy', free: .8, track: 1.3, switchAt: .8, radius: 1}),
});
// Each kind's speeds and tracing time are read back from its prefab components.
export function verifyOblvnsSource() {
  for (const k of Object.values(NOTE_KINDS)) {
    const cs = evidence.projectiles[k.projectile].flatMap(r => r.components).map(c => c.data ?? {});
    const speeds = new Set(cs.filter(d => '_speed' in d && d._speed > .2).map(d => +d._speed.toFixed(2)));
    const tracing = cs.find(d => '_switchToTracingTime' in d)?._switchToTracingTime;
    if (!speeds.has(k.free) || !speeds.has(k.track) || Math.abs(tracing - k.switchAt) > 1e-6) throw Error('Changed original Sakiko note: ' + k.projectile);
  }
  for (const f of ['Front', 'Back']) if (evidence.models[ID][f].hits.Skill_3_Loop?.length !== 2) throw Error('Changed original Sakiko clips');
}
function reviewed(b) {
  const approved = same(review.enabledOperators, [ID]) && review.verification.browser.status === 'passed';
  const candidate = b.regularReviewCandidates?.includes(ID) && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !candidate) || review.frameParity !== false || review.moduleSupport !== false
    || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-oblvns-notes-instruments-fever-v1')
    throw Error('Missing Sakiko runtime review or explicit held browser candidate');
}
export function selectedOblvnsInputs(unit) {
  const skill = unit.def.skill, build = unit.def.raw.arkpedia;
  if (!skill) throw Error('Incomplete original selected Sakiko inputs');
  const s = selectedOblvnsBuild({...build, skillId: skill.id});
  if (unit.def.charId !== ID || !same(unit.def.stats, normalizeChess({stats: s.stats}).stats) || !same(unit.rangeGrid, s.rangeGrid)
    || !same(unit.def.talents.map(t => t.bb), s.talentBb) || !same(skill.bb, s.bb) || !same(skill.rangeGrid ?? [], s.skillRangeGrid)
    || skill.spType !== normSpType(s.source.spData.spType) || skill.spCost !== s.source.spData.spCost || skill.initSp !== s.source.spData.initSp)
    throw Error('Incomplete original selected Sakiko inputs');
  return s;
}
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => u.base.bat / u.s.interval;
const talent = (u, key) => u.def.talents.find(t => t.bb[key] != null)?.bb;
const HIT = .2, LIFE = 10;
// Notes are drawn as the renderer's simple tracked-projectile dots (no native note art).
const COLORS = {ordinary: 0xf2b8dd, s1: 0xfbd29a, piano: 0xffffff, organ: 0xb48cf0, s3: 0x8cc8f0};
class OblvnsOwner {
  constructor(b, u) {
    verifyOblvnsSource();
    Object.assign(this, {b, u, record: selectedOblvnsInputs(u), seq: null, handles: [], notes: [], instrument: 'piano',
      aura: new Set(), shared: new Set(), undying: new Set(), nextAttack: 0});
  }
  valid() { return live(this.u) && this.u.deploySeq === this.seq && this.u.mem.oblvnsOwner === this; }
  n() { return this.u.skill?.active ? OBLVNS_SKILLS.indexOf(this.u.skill.id) + 1 : 0; }
  enemies(ground = false) {
    const {b, u} = this;
    if (b.rangeChanged(u)) b._refreshRange(u);
    const es = b.enemiesInKeys(u.rangeKeys, u, {canHitFly: !ground}).filter(e => live(e) && canTargetEnemy(u, e, {canHitFly: true}));
    for (const e of u.blocking) if (live(e) && !es.includes(e)) es.push(e);
    return es;
  }
  inRange(x, y) { return this.u.rangeKeySet?.has(Math.round(y) * 21 + Math.round(x)); }
  // A note: straight free flight, then homing; damage on arrival.
  fire(kind, {angle = 0, target = null, scale = 1, type = 'phys', pierce = false} = {}) {
    const {u} = this, k = NOTE_KINDS[kind], [fr, fc] = ({UP: [1, 0], DOWN: [-1, 0], LEFT: [0, -1], RIGHT: [0, 1]})[u.dir];
    const base = Math.atan2(fr, fc) + angle * Math.PI / 180;
    const note = {kind, k, x: u.x, y: u.y, vx: Math.cos(base), vy: Math.sin(base), age: 0, out: 0, target, scale, type, pierce, done: false, hit: new Set(), color: COLORS[kind]};
    this.notes.push(note); (this.b.regularVisualProjectiles ??= new Set()).add(note);
    this.syncPenetration();
  }
  stepNotes(dt) {
    const {b, u} = this, t1 = talent(u, 'max_cnt');
    for (const note of this.notes) {
      if (note.done) continue;
      note.age += dt;
      if (note.pierceUntil != null) {
        // Piano notes pass through enemies after their hit (PRTS: 0.8 radius, speed 3.0, 0.5 s).
        note.x += note.vx * 3 * dt; note.y += note.vy * 3 * dt;
        for (const e of b.foesInRadius(note.x, note.y, .8, true)) if (!note.hit.has(e) && live(e)) { note.hit.add(e); this.damage(e, note); }
        if (note.age >= note.pierceUntil) note.done = true;
        continue;
      }
      let speed = note.k.free;
      if (note.age >= note.k.switchAt) {
        if (!live(note.target)) note.target = b.foesInRadius(note.x, note.y, note.k.radius, true).filter(live)
          .sort((p, q) => Math.hypot(p.x - note.x, p.y - note.y) - Math.hypot(q.x - note.x, q.y - note.y))[0] ?? null;
        if (note.target) {
          const dx = note.target.x - note.x, dy = note.target.y - note.y, d = Math.hypot(dx, dy) || 1;
          note.vx = dx / d; note.vy = dy / d; speed = note.k.track;
        }
      }
      note.x += note.vx * speed * dt; note.y += note.vy * speed * dt;
      if (note.target && live(note.target) && Math.hypot(note.target.x - note.x, note.target.y - note.y) <= HIT) {
        this.damage(note.target, note); note.hit.add(note.target);
        if (note.pierce) note.pierceUntil = note.age + .5; else note.done = true;
      }
      note.out = this.inRange(note.x, note.y) ? 0 : note.out + dt;
      if (note.age >= LIFE || note.out >= (t1?.delay ?? 1)) note.done = true;
    }
    const before = this.notes.length;
    for (const n of this.notes) if (n.done) b.regularVisualProjectiles?.delete(n);
    this.notes = this.notes.filter(n => !n.done);
    if (this.notes.length !== before) this.syncPenetration();
  }
  damage(e, note) {
    const {b, u} = this, lord = u.def.trait?.bb?.atk_scale ?? .8;
    const ranged = e.blockedBy !== u ? lord : 1;
    b.dealDamage(u, e, {amount: u.s.atk * u.s.atkScaleMul * note.scale * ranged, type: note.type, isAttack: true, isSkill: note.kind !== 'ordinary',
      applyWay: 'ranged', tags: ['oblvns', `oblvns:${note.kind}`]});
  }
  // Talent 1: every live note lets members ignore a share of DEF/RES (max_cnt stacks).
  syncPenetration() {
    const {b, u} = this, t1 = talent(u, 'max_cnt'), key = `oblvns:notes:${u.id}`;
    const stacks = Math.min(t1?.max_cnt ?? 0, this.notes.length);
    for (const m of b.allyUnits) {
      const ok = stacks > 0 && t1?.def_penetrate_ratio > 0 && this.valid() && live(m) && m.kind === 'op' && FEVER_MEMBERS.includes(m.defId);
      if (!ok) { if (m.findBuff(key)) b.removeBuff(m, key); continue; }
      const mods = {defIgnorePct: stacks * t1.def_penetrate_ratio, resIgnorePct: stacks * t1.magic_resist_penetrate_ratio};
      const old = m.findBuff(key);
      if (!old || old.mods.defIgnorePct !== mods.defIgnorePct) b.addBuff(m, {key, source: u, mods});
    }
  }
  // Talent 2: ASPD in her range; members whose base range overlaps hers share it.
  syncAuras() {
    const {b, u} = this, t2 = talent(u, 'attack_speed'), aspdKey = `oblvns:aspd:${u.id}`;
    const inside = new Set(this.valid() ? b.alliesInGrid(u) : []);
    for (const a of b.allyUnits) {
      const ok = t2?.attack_speed > 0 && inside.has(a) && live(a);
      if (ok && !a.findBuff(aspdKey)) { b.addBuff(a, {key: aspdKey, source: u, mods: {aspd: t2.attack_speed}}); this.aura.add(a); }
      else if (!ok && a.findBuff(aspdKey)) { b.removeBuff(a, aspdKey); this.aura.delete(a); }
    }
    const mine = this.valid() ? absoluteRangeKeys(u.rangeGrid, u.tileR, u.tileC, u.dir, 0) : [];
    const set = new Set(mine);
    for (const m of b.allyUnits) {
      if (m === u || m.kind !== 'op' || !FEVER_MEMBERS.includes(m.defId) || m.defId === ID) continue;
      const overlaps = t2?.enable && live(m) && (m.baseRangeKeys ?? []).some(k => set.has(k));
      if (overlaps && !this.shared.has(m)) { this.shared.add(m); b.setExtraRange(m, mine); }
      else if (!overlaps && this.shared.has(m)) { this.shared.delete(m); b.setExtraRange(m, null); }
    }
  }
  attackTick() {
    const {b, u} = this, n = this.n();
    if (b.time + 1e-9 < this.nextAttack || !u.canAct || u.s.flags.disarm || b.isUnitInBornState(u)) return;
    if (n === 1) return;
    const es = this.enemies(), clip = n === 3 ? 'Skill_3_Loop' : (es.some(e => e.blockedBy === u) ? 'Combat' : 'Attack');
    const r = rate(u), at = model(u).hits[clip], fever = feverOf(b);
    this.nextAttack = b.time + u.s.interval;
    u.mem.regularFormVisual = {clip: n === 2 ? `Skill_2_Loop_${this.instrument === 'piano' ? 'A' : 'B'}` : clip, speed: r, playId: `oblvns:${this.seq}:${b.time}`};
    const target = es.sort((p, q) => (q.blockedBy === u) - (p.blockedBy === u))[0] ?? null, angle = talent(u, 'max_cnt')?.['attack@angle'] ?? 20;
    const random = () => (b.rng() * 2 - 1) * angle;
    b.after(at[0] / r, () => {
      if (!this.valid()) return;
      if (n === 3) {
        const bb = u.skill.bb, byRes = [...es].filter(live).sort((p, q) => q.s.res - p.s.res)[0], byDef = [...es].filter(live).sort((p, q) => q.s.def - p.s.def)[0];
        for (let i = 0; i < 2; i++) this.fire('s3', {angle: random(), target: byRes, scale: bb['attack@atk_scale'], type: 'phys'});
        b.after((at[1] - at[0]) / r, () => { if (this.valid()) for (let i = 0; i < 2; i++) this.fire('s3', {angle: random(), target: byDef, scale: bb['attack@atk_scale'], type: 'arts'}); }, {owner: u});
      } else if (this.record.index === 1) {
        const kind = this.instrument, shots = fever.active ? 2 : 1;
        for (let i = 0; i < shots; i++) this.fire(kind, {angle: random(), target, type: kind === 'piano' ? 'phys' : 'arts', pierce: kind === 'piano'});
      } else this.fire('ordinary', {angle: target ? 0 : random(), target});
      if (b._hooks.attack) b.emit('attack', {attacker: u, targets: target ? [target] : [], isSkill: n > 0});
      u.skill?.onAttackPerformed(target ? [target] : [], n > 0);
    }, {owner: u});
  }
  instrumentMods() {
    const {b, u} = this, key = `oblvns:instrument:${u.id}`, bb = u.skill?.bb ?? {};
    if (this.record.index !== 1) return;
    b.addBuff(u, {key, source: u, mods: this.instrument === 'piano' ? {atkPct: bb['attack@atk']} : {aspd: bb['attack@attack_speed']}});
  }
  install() {
    const {b, u} = this;
    u.mem.oblvnsOwner = this;
    const fever = feverOf(b), t2 = talent(u, 'cnt');
    this.handles = [
      b.on('deploy', ({unit, move}) => {
        if (unit !== u || move) return;
        for (const n of this.notes) b.regularVisualProjectiles?.delete(n);
        this.seq = u.deploySeq; this.notes = []; this.instrument = 'piano'; this.nextAttack = 0; this.instrumentMods();
      }, {owner: u}),
      b.on('tick', () => {
        if (!this.valid()) return;
        this.stepNotes(b.dt); this.syncAuras(); this.attackTick();
        // S1 auto-releases at full charges (not a manual cast, so no Fever start).
        if (this.record.index === 0 && u.skill.charges >= u.skill.maxCharges && !u.skill.active && u.canAct) u.skill.activate('auto');
      }, {owner: u}),
      b.on('damaged', ({source, amount}) => { if (source === u && t2 && this.valid() && amount >= 0) fever.add(u, t2.cnt); }, {owner: u}),
      b.on('dodge', ({source}) => { if (source === u && t2 && this.valid()) fever.add(u, t2.cnt); }, {owner: u}),
      // S3 during Fever: members are held at 1 HP and retreat when Fever ends.
      b.on('fatal', ctx => {
        if (ctx.prevented || this.record.index !== 2 || !this.valid() || !u.skill.active || !fever.active) return;
        const m = ctx.unit;
        if (m?.kind === 'op' && FEVER_MEMBERS.includes(m.defId) && m.side === 'ally') { ctx.prevented = true; m.hp = 1; this.undying.add(m); }
      }, {owner: u, priority: -3000}),
      b.on('feverEnd', () => { for (const m of this.undying) if (live(m)) b.retreat(m, {reason: 'fever-end'}); this.undying.clear(); }, {owner: u}),
      b.on('death', ({unit}) => { if (unit === u) this.stop(); }, {owner: u}),
      b.on('battleEnd', () => this.stop(), {owner: u}),
    ];
  }
  stop() {
    const {b, u} = this;
    for (const n of this.notes) b.regularVisualProjectiles?.delete(n);
    this.notes = []; this.syncPenetration();
    for (const a of this.aura) if (a.findBuff(`oblvns:aspd:${u.id}`)) b.removeBuff(a, `oblvns:aspd:${u.id}`);
    for (const m of this.shared) b.setExtraRange(m, null);
    this.aura.clear(); this.shared.clear();
  }
}
export function customizeOblvnsKit({battle: b, id, unit: u, kit}) {
  if (id !== ID) return;
  reviewed(b);
  if (!OBLVNS_SKILLS.includes(u.def.skill?.id)) throw Error('Missing original selected Sakiko skill');
  const owner = new OblvnsOwner(b, u), s = u.def.skill, n = OBLVNS_SKILLS.indexOf(s.id) + 1;
  u.mem.oblvnsPrepared = owner;
  kit.talents = [];
  kit.trait = {noAttack: true};
  if (n === 1) kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: model(u).durations.Skill_1,
    onStart: () => {
      const bb = u.skill.bb, r = rate(u);
      u.mem.regularFormVisual = {clip: 'Skill_1', speed: r, playId: `oblvns:s1:${b.time}`};
      b.after(model(u).hits.Skill_1[0] / r, () => {
        if (!owner.valid()) return;
        const scales = [1, 2, 3, 4, 5, 6, 7, 8].map(i => bb[i === 1 ? 'atk_scale' : `atk_scale_${i}`]);
        scales.forEach((scale, i) => owner.fire('s1', {angle: -13.125 + 3.75 * i, scale, type: 'arts'}));
      }, {owner: u});
    }};
  else if (n === 2) kit.skill = {id: s.id, name: s.name, kind: 'instant', trigger: 'NEVER',
    canActivate: () => !feverOf(b).active,
    onStart: () => {
      if (feverOf(b).full) return; // the cast only starts Fever
      owner.instrument = owner.instrument === 'piano' ? 'organ' : 'piano'; owner.instrumentMods();
      u.mem.regularFormVisual = {clip: `Skill_2_Trans_${owner.instrument === 'piano' ? 'A' : 'B'}`, playId: `oblvns:s2:${b.time}`};
    }};
  else kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration,
    targeting: {rangeGrid: owner.record.skillRangeGrid},
    onStart: () => { u.mem.regularFormVisual = {clip: 'Skill_3_Idle', loop: true, replace: true}; },
    onEnd: () => { u.mem.regularFormVisual = {clip: 'Skill_3_End', playId: `oblvns:s3end:${b.time}`}; }};
}
export function installOblvns({battle: b, unit: u, def}) {
  if (def.charId !== ID) return;
  reviewed(b);
  const owner = u.mem.oblvnsPrepared;
  if (!owner) throw Error('Missing selected Sakiko owner');
  delete u.mem.oblvnsPrepared; owner.install();
}
