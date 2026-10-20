// SPDX-License-Identifier: GPL-3.0-or-later
// Вий / Veen (char_4226_veen), Mystic Caster.
// Source: data/arkpedia-native-operators/char_4226_veen.json.
//
// From data: Mystic trait (Arts attacks; with no target he stores one energy
// per attack interval, firing them all with his next attack); his trait stores
// up to `times` energy units and merges every merge_cnt into one transposed
// energy. Talent 1: merging needs it (without it he stores merge_cnt singles);
// with a transposed energy stored ATK `atk`, otherwise ASPD `attack_speed`.
// Talent 2 (veen_t_2[damage], _merged): attacks and fired energy put
// attack@value Arts per second on the target for attack@duration s, stacking to
// attack@max_stack_cnt (a transposed energy adds merge_cnt stacks), and he
// does not target enemies carrying it. S1 (auto): ASPD. S2: base attack time,
// and every attack or fired energy stacks veen_s_2_buff[stack] ATK/ASPD to its
// max_stack_cnt (a transposed energy adds merge_cnt). S3: ASPD, and each fired
// energy (projectile_chr_veen_s3) first hits at attack@base_atk_scale then
// bounces once to another enemy for attack@bounce_atk_scale (a transposed one
// merge_hit_cnt times), preferring enemies hit least, attack@delay apart;
// attack@trigger_time ammo, one per energy, merge_cnt per transposed; the
// skill ends when spent and can be stopped at any time.
// Declared local mappings:
// - A transposed energy is one projectile dealing merge_cnt x ATK.
// - Fired energies all strike his attack target (S3 bounces then spread).
import evidence from '../../../data/arkpedia-native-operators/char_4226_veen.json' with {type: 'json'};
import review from '../../../data/arkpedia-veen-runtime-review.json' with {type: 'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {normalizeChess} from '../simdata.js';
import {canTargetEnemy} from '../targeting.js';
export const VEEN_ID = 'char_4226_veen';
export const VEEN_SKILLS = Object.freeze(['skchr_veen_1', 'skchr_veen_2', 'skchr_veen_3']);
export const selectedVeenBuild = build => selectedCNSourceBuild(evidence, VEEN_ID, build);
const ID = VEEN_ID, live = u => !!u?.alive && u.deployed && !u.hidden;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function reviewed(b) {
  const approved = same(review.enabledOperators, [ID]) && review.verification.browser.status === 'passed';
  const candidate = b.regularReviewCandidates?.includes(ID) && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !candidate) || review.frameParity !== false || review.moduleSupport !== false
    || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-veen-transposed-energy-v1')
    throw Error('Missing Veen runtime review or explicit held browser candidate');
}
export function selectedVeenInputs(unit) {
  const skill = unit.def.skill, build = unit.def.raw.arkpedia;
  if (!skill) throw Error('Incomplete original selected Veen inputs');
  const s = selectedVeenBuild({...build, skillId: skill.id});
  if (unit.def.charId !== ID || !same(unit.def.stats, normalizeChess({stats: s.stats}).stats) || !same(unit.rangeGrid, s.rangeGrid)
    || !same(unit.def.talents.map(t => t.bb), s.talentBb) || !same(skill.bb, s.bb) || skill.spCost !== s.source.spData.spCost)
    throw Error('Incomplete original selected Veen inputs');
  return s;
}
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => u.base.bat / u.s.interval;
const talent = (u, key) => u.def.talents.find(t => t.bb[key] != null)?.bb;
class VeenOwner {
  constructor(b, u) { Object.assign(this, {b, u, record: selectedVeenInputs(u), seq: null, handles: [], units: 0, acc: 0, dots: new Map(), stacks: 0, ammo: 0}); }
  valid() { return live(this.u) && this.u.deploySeq === this.seq && this.u.mem.veenOwner === this; }
  n() { return this.u.skill?.active ? VEEN_SKILLS.indexOf(this.u.skill.id) + 1 : 0; }
  get merge() { return this.u.def.trait?.bb?.merge_cnt ?? 3; }
  get merging() { return !!talent(this.u, 'attack_speed'); }
  get cap() { return this.merging ? this.u.def.trait?.bb?.times ?? 9 : this.merge; }
  // Stored energies: transposed ones first, then singles.
  stored() { const m = this.merging ? Math.floor(this.units / this.merge) : 0; return {merged: m, singles: this.units - m * this.merge}; }
  legal(e) { return live(e) && e.side === 'enemy' && canTargetEnemy(this.u, e, this.u.profile); }
  marked(e) { return (this.dots.get(e)?.stacks ?? 0) > 0; }
  // Talent 2: stacked Arts damage over time from him.
  mark(e, stacks) {
    const t = talent(this.u, 'attack@value');
    if (!t || !live(e)) return;
    const d = this.dots.get(e) ?? {stacks: 0, until: 0, next: this.b.time + 1};
    d.stacks = Math.min(t['attack@max_stack_cnt'], d.stacks + stacks); d.until = this.b.time + t['attack@duration'];
    this.dots.set(e, d);
  }
  dotTick() {
    const {b, u} = this, t = talent(u, 'attack@value');
    for (const [e, d] of this.dots) {
      if (!live(e) || b.time >= d.until) { this.dots.delete(e); continue; }
      if (b.time + 1e-9 < d.next) continue;
      d.next = b.time + 1;
      b.dealDamage(u, e, {amount: t['attack@value'] * d.stacks, type: 'arts', applyWay: 'none', canDodge: false, tags: ['veen', 'veen:dot']});
    }
  }
  // Talent 1 buff by what he holds.
  syncTalent() {
    const {b, u} = this, t = talent(u, 'attack_speed');
    if (!t || !this.valid()) return;
    const mods = this.stored().merged > 0 ? {atkPct: t.atk} : {aspd: t.attack_speed}, old = u.findBuff('veen:t1');
    if (!old || !same(old.mods, mods)) b.addBuff(u, {key: 'veen:t1', source: u, mods});
  }
  storeTick(dt) {
    const {u} = this;
    if (!this.valid() || !u.canAct || u.trait.hadTarget || u.atkCd > 0 || this.units >= this.cap) { this.acc = 0; return; }
    this.acc += dt;
    if (this.acc + 1e-9 >= u.s.interval) { this.acc = 0; this.units = Math.min(this.cap, this.units + 1); }
  }
  s2Stack(k) {
    const {b, u} = this, bb = u.skill?.bb;
    if (this.n() !== 2) return;
    this.stacks = Math.min(bb['attack@veen_s_2_buff[stack].max_stack_cnt'], this.stacks + k);
    b.addBuff(u, {key: 'veen:s2', source: u, mods: {atkPct: bb['attack@veen_s_2_buff[stack].atk'] * this.stacks, aspd: bb['attack@veen_s_2_buff[stack].attack_speed'] * this.stacks}});
  }
  hit(e, scale, tag) { if (live(e)) this.b.dealDamage(this.u, e, {amount: this.u.s.atk * scale, type: 'arts', applyWay: 'ranged', isAttack: true, tags: ['veen', `veen:${tag}`]}); }
  // Fire every stored energy with this attack.
  release(target) {
    const {b, u} = this, {merged, singles} = this.stored(), n = this.n();
    if (!merged && !singles) return;
    let shots = [...Array(merged).fill(this.merge), ...Array(singles).fill(1)];
    if (n === 3) {
      const room = [];
      for (const k of shots) { if (this.ammo >= k) { this.ammo -= k; room.push(k); } }
      shots = room;
    }
    this.units -= shots.reduce((a, k) => a + k, 0);
    for (const k of shots) {
      this.mark(target, k);
      this.s2Stack(k);
      if (n === 3) this.bounce(target, k);
      else this.hit(target, k, k > 1 ? 'merged' : 'energy');
    }
    if (n === 3 && this.ammo <= 0) b.after(0, () => { if (u.skill?.active) u.skill.end('ammo'); }, {owner: u});
  }
  bounce(first, k) {
    const {b, u} = this, bb = u.skill.bb, count = new Map(), times = k > 1 ? u.skill.bb.merge_hit_cnt : 1;
    this.hit(first, bb['attack@base_atk_scale'] * k, 's3-shot'); count.set(first, 1);
    let at = first;
    for (let i = 1; i <= times; i++) b.after(bb['attack@delay'] * i, () => {
      if (!this.valid()) return;
      const next = b.enemies.filter(e => this.legal(e) && e !== at && Math.hypot(e.x - at.x, e.y - at.y) <= 2.5)
        .sort((p, q) => (count.get(p) ?? 0) - (count.get(q) ?? 0) || Math.hypot(p.x - at.x, p.y - at.y) - Math.hypot(q.x - at.x, q.y - at.y))[0] ?? (live(at) ? at : null);
      if (!next) return;
      this.hit(next, bb['attack@bounce_atk_scale'], 's3-bounce'); count.set(next, (count.get(next) ?? 0) + 1); at = next;
    }, {owner: u});
  }
  install() {
    const {b, u} = this;
    u.mem.veenOwner = this;
    this.handles = [
      b.on('deploy', ({unit, move}) => { if (unit === u && !move) { this.seq = u.deploySeq; this.units = 0; } }, {owner: u}),
      b.on('tick', ({dt}) => { this.storeTick(dt); this.syncTalent(); this.dotTick(); }, {owner: u}),
      b.on('death', ({unit}) => { if (unit === u) { this.dots.clear(); this.units = 0; } }, {owner: u}),
    ];
  }
}
export function customizeVeenKit({battle: b, id, unit: u, kit}) {
  if (id !== ID) return;
  reviewed(b);
  if (!VEEN_SKILLS.includes(u.def.skill?.id)) throw Error('Missing original selected Veen skill');
  const owner = new VeenOwner(b, u), s = u.def.skill, n = VEEN_SKILLS.indexOf(s.id) + 1;
  u.mem.veenPrepared = owner;
  kit.talents = [];
  const clip = a => a.skill?.active ? `Skill_${n}_Attack` : 'Attack';
  // The owner replaces the generic Mystic store/release.
  kit.trait = {...kit.trait, install: null, hitsFn: null, hits: 1,
    canTarget: (_a, e) => !owner.marked(e),
    windup: (_b, a) => model(a).hits[clip(a)][0] / rate(a), attackVisual: (_b, a) => clip(a),
    canAttack: (bb, a) => !bb.isUnitInBornState(a),
    onEachHit: (_bb, a, e, hc) => { if (hc.kind !== 'main') return; owner.mark(e, 1); owner.s2Stack(1); owner.release(e); }};
  if (n === 1) kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'SP_FULL', duration: s.duration, mods: {aspd: s.bb.attack_speed}};
  else if (n === 2) kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration, mods: {batFlat: s.bb.base_attack_time},
    onEnd: () => { owner.stacks = 0; b.removeBuff(u, 'veen:s2'); }};
  else kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: 1, mods: {aspd: s.bb.attack_speed}, manualCancel: true,
    onStart: () => { owner.ammo = s.bb['attack@trigger_time']; u.skill.timeLeft = Infinity; }, onEnd: () => { owner.ammo = 0; }};
}
export function installVeen({battle: b, unit: u, def}) {
  if (def.charId !== ID) return;
  reviewed(b);
  const owner = u.mem.veenPrepared;
  if (!owner) throw Error('Missing selected Veen owner');
  delete u.mem.veenPrepared; owner.install();
}
