// SPDX-License-Identifier: GPL-3.0-or-later
// Hoshiguma the Breacher (char_1044_hsgma2), Arts Protector Defender.
// Source: data/arkpedia-native-operators/char_1044_hsgma2.json.
//
// From data: Arts Protector trait (ordinary attacks deal Arts while a skill is
// active); ordinary hit at the Attack clip event. Talent 1 (hsgma2_t_1,
// [heal], [heal][interval]) "我执": at 0 HP she enters a minus-HP state, is not
// a heal target (HEAL_FREE), keeps accumulating damage and falls only at
// max_minus_hp_ratio x max HP; after [heal].interval s without damage she
// recovers [heal].hp_recovery_per_sec_by_max_hp_ratio of max HP per second and
// leaves the state above 0 HP. Talent 2 (limit_bonus[atk]/[magic_resistance])
// 坚忍: ATK min_atk and RES min_magic_resistance, scaling linearly from none at
// max_hp_ratio to full at min_hp_ratio (and in the minus-HP state). S1 (auto,
// charged by damage taken, infinite): ATK/DEF and every damage from an enemy
// returns atk_scale x ATK Arts to it (hsgma2_s_1). S2 (auto, next attack): a
// three-hit attack at the Skill_2_Loop events on every blocked enemy for
// attack@atk_scale, then a shield (projectile_chr_hsgma2_s2: radius 1.0,
// 90 deg/s, 365 deg) circles her; enemies it touches get sluggish `sluggish` s
// and shield_atk_scale x ATK Arts every `interval` s, healing her heal_ratio of
// the damage dealt (hsgma2_s_2[projectile]). S3: skill range, max HP and ATK,
// attack@max_target targets; a manual stop starts [before_dead] for
// before_dead_duration s (bonuses kept, UNDEADABLE, silenced, four-hit attacks,
// allies in her range UNDEADABLE with their overflow damage dealt to her as
// Pure), after which she is forced out as defeated.
// Declared local mappings:
// - The shield touches enemies within 0.5 of it, the shield's range grid
//   carrying no fields; she keeps attacking while it circles.
// - The Front skeleton's B_ clips (absent from Back) are the 我执 form: idle
//   and ordinary attacks use B_Idle/B_Attack while she is at or below 0 HP.
// - An S3 attack hits twice at its clip event (four times in [before_dead]),
//   cycling the Skill_3_Loop_A/B/C clips.
import evidence from '../../../data/arkpedia-native-operators/char_1044_hsgma2.json' with {type: 'json'};
import review from '../../../data/arkpedia-hsgma2-runtime-review.json' with {type: 'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {normalizeChess} from '../simdata.js';
export const HSGMA2_ID = 'char_1044_hsgma2';
export const HSGMA2_SKILLS = Object.freeze(['skchr_hsgma2_1', 'skchr_hsgma2_2', 'skchr_hsgma2_3']);
export const selectedHsgma2Build = build => selectedCNSourceBuild(evidence, HSGMA2_ID, build);
const ID = HSGMA2_ID, live = u => !!u?.alive && u.deployed && !u.hidden;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const EPS = 1e-6, SHIELD = Object.freeze({radius: 1, speed: 90, sweep: 365, touch: .5});
function reviewed(b) {
  const approved = same(review.enabledOperators, [ID]) && review.verification.browser.status === 'passed';
  const candidate = b.regularReviewCandidates?.includes(ID) && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !candidate) || review.frameParity !== false || review.moduleSupport !== false
    || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-hsgma2-minus-hp-shield-v1')
    throw Error('Missing Hoshiguma the Breacher runtime review or explicit held browser candidate');
}
// The shield constants above are the original prefab values.
export function verifyHsgma2Source() {
  const rows = evidence.projectiles.projectile_chr_hsgma2_s2.flatMap(r => r.components.map(c => c.data));
  const f = k => rows.find(d => k in d)?.[k];
  if (f('_projectileAroundRadius') !== SHIELD.radius || f('_aroundSpeed') !== SHIELD.speed || f('_MaxRotateAngle') !== SHIELD.sweep)
    throw Error('Changed original Hoshiguma the Breacher shield');
}
export function selectedHsgma2Inputs(unit) {
  const skill = unit.def.skill, build = unit.def.raw.arkpedia;
  if (!skill) throw Error('Incomplete original selected Hoshiguma the Breacher inputs');
  const s = selectedHsgma2Build({...build, skillId: skill.id});
  if (unit.def.charId !== ID || !same(unit.def.stats, normalizeChess({stats: s.stats}).stats) || !same(unit.rangeGrid, s.rangeGrid)
    || !same(unit.def.talents.map(t => t.bb), s.talentBb) || !same(skill.bb, s.bb) || skill.spCost !== s.source.spData.spCost)
    throw Error('Incomplete original selected Hoshiguma the Breacher inputs');
  return s;
}
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => u.base.bat / u.s.interval;
const talent = (u, key) => u.def.talents.find(t => t.bb[key] != null)?.bb;
const front = u => ({UP: [1, 0], DOWN: [-1, 0], LEFT: [0, -1], RIGHT: [0, 1]})[u.dir];
class Hsgma2Owner {
  constructor(b, u) { Object.assign(this, {b, u, record: selectedHsgma2Inputs(u), seq: null, handles: [], minus: false, pool: 0, lastHurt: -Infinity, shield: null, stand: null, combo: 0}); }
  valid() { return live(this.u) && this.u.deploySeq === this.seq && this.u.mem.hsgma2Owner === this; }
  n() { return this.u.skill?.active ? HSGMA2_SKILLS.indexOf(this.u.skill.id) + 1 : 0; }
  arts(e, amount, tag) { return live(e) ? this.b.dealDamage(this.u, e, {amount, type: 'arts', applyWay: 'none', isSkill: true, tags: ['hsgma2', `hsgma2:${tag}`]}) : 0; }
  limit() { return (talent(this.u, 'max_minus_hp_ratio')?.max_minus_hp_ratio ?? 0) * this.u.s.maxHp; }
  // Talent 1: damage at or below 0 HP goes to the minus-HP pool.
  zero(ctx) {
    const t = talent(this.u, 'max_minus_hp_ratio');
    if (!t) return;
    const add = this.minus ? ctx.amount : ctx.amount - ctx.before;
    if (this.pool + add >= this.limit()) { this.pool += add; return; }
    this.pool += add; ctx.blocked = true;
    if (!this.minus) {
      this.minus = true;
      this.b.addBuff(this.u, {key: 'hsgma2:minus', source: this.u, flags: {healFree: true, noHeal: true}});
      if (!this.u.skill?.active && this.u.dir !== 'UP') this.u.mem.regularFormVisual = {clip: 'B_Idle', loop: true, attack: 'B_Attack'};
    }
  }
  quietTick(dt) {
    const {b, u} = this, t = talent(u, 'max_minus_hp_ratio');
    if (!this.minus || !t) return;
    // Healing that still reaches her (her own S2) pays the pool down first.
    if (u.hp > EPS) { this.pool -= u.hp - EPS; u.hp = EPS; }
    if (this.pool > 0 && b.time - this.lastHurt >= t['hsgma2_t_1[heal].interval'] - 1e-9)
      this.pool -= u.s.maxHp * t['hsgma2_t_1[heal].hp_recovery_per_sec_by_max_hp_ratio'] * dt;
    if (this.pool > 0) return;
    this.minus = false; u.hp = Math.max(EPS, -this.pool); this.pool = 0;
    b.removeBuff(u, 'hsgma2:minus');
    if (u.mem.regularFormVisual?.clip === 'B_Idle') u.mem.regularFormVisual = null;
  }
  // Talent 2: berserk ATK/RES by lost HP.
  berserk() {
    const {b, u} = this, t = talent(u, 'min_hp_ratio');
    if (!t || !this.valid()) return;
    const ratio = this.minus ? 0 : u.hpRatio, f = Math.max(0, Math.min(1, (t.max_hp_ratio - ratio) / (t.max_hp_ratio - t.min_hp_ratio)));
    const mods = {atkPct: t.max_atk + (t.min_atk - t.max_atk) * f, resFlat: t.max_magic_resistance + (t.min_magic_resistance - t.max_magic_resistance) * f};
    const old = u.findBuff('hsgma2:berserk');
    if (!old || old.mods.atkPct !== mods.atkPct || old.mods.resFlat !== mods.resFlat) b.addBuff(u, {key: 'hsgma2:berserk', source: u, mods});
  }
  // S2 shield circling her.
  launch() {
    const {u} = this, [dr, dc] = front(u);
    this.shield = {angle: Math.atan2(dr, dc) * 180 / Math.PI, swept: 0, touched: new Map(), x: u.x + dc, y: u.y + dr, color: 0xd9b36c};
    (this.b.regularVisualProjectiles ??= new Set()).add(this.shield);
  }
  moveShield(dt) {
    const {b, u} = this, s = this.shield;
    if (!s) return;
    if (!this.valid() || s.swept >= SHIELD.sweep) { this.endShield(); return; }
    const step = Math.min(SHIELD.speed * dt, SHIELD.sweep - s.swept);
    s.swept += step; s.angle += step;
    const a = s.angle * Math.PI / 180;
    s.x = u.x + Math.cos(a) * SHIELD.radius; s.y = u.y + Math.sin(a) * SHIELD.radius;
    const bb = this.s2bb;
    for (const e of b.enemies) {
      if (!live(e) || Math.hypot(e.x - s.x, e.y - s.y) > SHIELD.touch) continue;
      if (b.time + 1e-9 < (s.touched.get(e) ?? -Infinity)) continue;
      s.touched.set(e, b.time + bb.interval);
      b.applyStatus(e, 'sluggish', {source: u, duration: bb.sluggish});
      const dealt = this.arts(e, u.s.atk * bb.shield_atk_scale, 's2-shield');
      if (dealt > 0) b.heal(u, u, dealt * bb.heal_ratio, {tags: ['hsgma2:s2'], ignoreHealFree: true});
    }
  }
  endShield() { if (this.shield) this.b.regularVisualProjectiles?.delete(this.shield); this.shield = null; }
  // S3 last stand.
  allies() { if (this.b.rangeChanged(this.u)) this.b._refreshRange(this.u); return this.b.alliesInGrid(this.u).filter(a => live(a) && a !== this.u); }
  lastStand() {
    const {b, u} = this, bb = u.skill.bb;
    if (this.stand) return false;
    this.stand = {until: b.time + bb.before_dead_duration, covered: new Set()};
    u.skill.timeLeft = Infinity;
    b.addBuff(u, {key: 'hsgma2:stand', source: u, flags: {undeadable: true, silence: true}});
    b.after(bb.before_dead_duration, () => { if (this.valid() && this.stand) { this.endStand(); b.kill(u); } }, {owner: u});
    return true;
  }
  standTick() {
    const {b, u} = this, s = this.stand;
    if (!s) return;
    const inside = new Set(this.valid() ? this.allies() : []);
    for (const a of [...s.covered, ...inside]) {
      if (inside.has(a) && !a.findBuff('hsgma2:aura')) { b.addBuff(a, {key: 'hsgma2:aura', source: u, flags: {undeadable: true}}); s.covered.add(a); }
      else if (!inside.has(a) && a.findBuff?.('hsgma2:aura')) { b.removeBuff(a, 'hsgma2:aura'); s.covered.delete(a); }
    }
  }
  endStand() {
    const s = this.stand;
    if (!s) return;
    this.stand = null;
    for (const a of s.covered) if (a.findBuff?.('hsgma2:aura')) this.b.removeBuff(a, 'hsgma2:aura');
    this.b.removeBuff(this.u, 'hsgma2:stand');
  }
  install() {
    const {b, u} = this;
    u.mem.hsgma2Owner = this;
    this.handles = [
      b.on('deploy', ({unit, move}) => { if (unit === u && !move) this.seq = u.deploySeq; }, {owner: u}),
      b.on('tick', ({dt}) => { this.quietTick(dt); this.berserk(); this.moveShield(dt); this.standTick(); }, {owner: u}),
      b.on('beforeHpZero', ctx => { if (ctx.unit === u && this.valid()) this.zero(ctx); }, {owner: u}),
      // Overflow of a protected ally is dealt to her as Pure damage.
      b.on('hpZeroAttempt', ({unit, amount, before}) => {
        if (!this.stand || unit === u || !this.stand.covered.has(unit)) return;
        const over = amount - Math.max(0, before - 1);
        if (over > 0) b.dealDamage(null, u, {amount: over, type: 'true', sourceless: true, canDodge: false, tags: ['hsgma2:overflow']});
      }, {owner: u}),
      b.on('damaged', h => {
        if (h.target !== u || !this.valid()) return;
        this.lastHurt = b.time;
        if (this.minus && u.hp > EPS) u.hp = EPS;
        if (this.n() === 1 && h.source?.side === 'enemy' && live(h.source)) this.arts(h.source, u.s.atk * u.skill.bb.atk_scale, 's1-return');
      }, {owner: u}),
      b.on('death', ({unit}) => { if (unit === u) this.stop(); }, {owner: u}),
      b.on('battleEnd', () => this.stop(), {owner: u}),
    ];
  }
  stop() { this.endShield(); this.endStand(); }
}
export function customizeHsgma2Kit({battle: b, id, unit: u, kit}) {
  if (id !== ID) return;
  reviewed(b);
  verifyHsgma2Source();
  if (!HSGMA2_SKILLS.includes(u.def.skill?.id)) throw Error('Missing original selected Hoshiguma the Breacher skill');
  const owner = new Hsgma2Owner(b, u), s = u.def.skill, n = HSGMA2_SKILLS.indexOf(s.id) + 1;
  owner.s2bb = n === 2 ? s.bb : null;
  u.mem.hsgma2Prepared = owner;
  kit.talents = [];
  kit.trait = {...kit.trait, windup: (_b, a) => model(a).hits.Attack[0] / rate(a), attackVisual: () => 'Attack', canAttack: (bb, a) => !bb.isUnitInBornState(a)};
  if (n === 1) kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'SP_FULL', duration: 1, mods: {atkPct: s.bb.atk, defPct: s.bb.def},
    // "持续时间无限"
    onStart: () => { u.skill.timeLeft = Infinity; }, attack: {dmgType: 'arts'}};
  else if (n === 2) kit.skill = {id: s.id, name: s.name, kind: 'instant', trigger: 'SP_FULL',
    attack: {dmgType: 'arts', atkScale: s.bb['attack@atk_scale'], hitAllBlocked: true, attackVisual: () => 'Skill_2_Loop',
      windup: (_b, a) => model(a).hits.Skill_2_Loop[0] / rate(a),
      onEachHit: ({target, kind}) => {
        if (kind !== 'main') return;
        const ev = model(u).hits.Skill_2_Loop;
        ev.slice(1).forEach(t => b.after((t - ev[0]) / rate(u), () => { if (owner.valid()) owner.arts(target, u.s.atk * s.bb['attack@atk_scale'], 's2-throw'); }, {owner: u}));
      },
      afterAttack: () => { const ev = model(u).hits.Skill_2_Loop; b.after((ev.at(-1) - ev[0]) / rate(u), () => { if (owner.valid()) owner.launch(); }, {owner: u}); }}};
  else {
    const clip = () => `Skill_3_Loop_${'ABC'[owner.combo % 3]}`;
    kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration,
      mods: {hpPct: s.bb.max_hp, atkPct: s.bb.atk}, manualCancel: true,
      canManualCancel: () => !owner.stand, onManualCancel: () => owner.lastStand(),
      onStart: () => { u.mem.regularFormVisual = {clip: 'Skill_3_Idle', loop: true}; },
      onEnd: () => { u.mem.regularFormVisual = null; owner.endStand(); },
      targeting: {maxTargets: s.bb['attack@max_target'], rangeGrid: owner.record.skillRangeGrid},
      attack: {dmgType: 'arts', hitsFn: () => owner.stand ? 4 : 2, attackVisual: () => clip(),
        windup: (_b, a) => model(a).hits[clip()][0] / rate(a), afterAttack: () => { owner.combo++; }}};
  }
}
export function installHsgma2({battle: b, unit: u, def}) {
  if (def.charId !== ID) return;
  reviewed(b);
  const owner = u.mem.hsgma2Prepared;
  if (!owner) throw Error('Missing selected Hoshiguma the Breacher owner');
  delete u.mem.hsgma2Prepared; owner.install();
}
