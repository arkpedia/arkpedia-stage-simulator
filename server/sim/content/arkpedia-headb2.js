// SPDX-License-Identifier: GPL-3.0-or-later
// Zima the Raging Tide (char_1051_headb2), Earthshaker Guard.
// Source: data/arkpedia-native-operators/char_1051_headb2.json.
//
// From data: Earthshaker trait splash (attack@ability_range_radius, 50%);
// ordinary hit at the Attack clip event; talent 1 splash damage x damage_scale
// and high-ground pulses of attack@splash_atk_scale ATK with attack@sluggish;
// talent 2 ATK/DEF for every deployed operator during skills, doubled
// (scale_bonus) for teamId "student"; S1 ATK/ASPD; S2 SP per high-ground
// tile triggered, auto-start with 2-5 range and ATK/DEF, doubled and
// infinite from the second use; S3 atk_base, five blows at the Skill_3
// events of atk_scale with +atk_step ATK per blow, pulses x
// splash_atk_scale_bonus with `unmovable` s bind and spreading pulses.
// Declared local mappings (PRTS notes):
// - A pulse fires 0.1 s after its trigger from every HIGH tile whose centre is
//   within 1.0 of the hit centre, on ground enemies of that tile and its four
//   neighbours (x-5); its damage is ranged and sourceless.
// - S3 blows land 1.0 ahead of her with a 1.5 splash and ignore attack speed;
//   from the second blow, triggered high tiles spread to adjacent untouched
//   high tiles up to (blows completed) steps; each tile pulses once per blow.
import evidence from '../../../data/arkpedia-native-operators/char_1051_headb2.json' with {type: 'json'};
import review from '../../../data/arkpedia-headb2-runtime-review.json' with {type: 'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {normalizeChess} from '../simdata.js';
import {canTargetEnemy, sortEnemyTargets} from '../targeting.js';
import {COLS, ROWS} from '../constants.js';
export const HEADB2_ID = 'char_1051_headb2';
export const HEADB2_SKILLS = Object.freeze(['skchr_headb2_1', 'skchr_headb2_2', 'skchr_headb2_3']);
export const selectedHeadb2Build = build => selectedCNSourceBuild(evidence, HEADB2_ID, build);
const ID = HEADB2_ID, live = u => !!u?.alive && u.deployed && !u.hidden;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const plain = {groundOnly: true, canHitFly: false};
function reviewed(b) {
  const approved = same(review.enabledOperators, [ID]) && review.verification.browser.status === 'passed';
  const candidate = b.regularReviewCandidates?.includes(ID) && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !candidate) || review.frameParity !== false || review.moduleSupport !== false
    || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-headb2-highland-pulses-v1')
    throw Error('Missing Zima the Raging Tide runtime review or explicit held browser candidate');
}
export function selectedHeadb2Inputs(unit) {
  const skill = unit.def.skill, build = unit.def.raw.arkpedia;
  if (!skill) throw Error('Incomplete original selected Zima the Raging Tide inputs');
  const s = selectedHeadb2Build({...build, skillId: skill.id});
  if (unit.def.charId !== ID || !same(unit.def.stats, normalizeChess({stats: s.stats}).stats) || !same(unit.rangeGrid, s.rangeGrid)
    || !same(unit.def.talents.map(t => t.bb), s.talentBb) || !same(skill.bb, s.bb) || skill.spCost !== s.source.spData.spCost)
    throw Error('Incomplete original selected Zima the Raging Tide inputs');
  return s;
}
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => u.base.bat / u.s.interval;
const talent = (u, key) => u.def.talents.find(t => t.bb[key] != null)?.bb;
const front = u => ({UP: [1, 0], DOWN: [-1, 0], LEFT: [0, -1], RIGHT: [0, 1]})[u.dir];
class Headb2Owner {
  constructor(b, u) { Object.assign(this, {b, u, record: selectedHeadb2Inputs(u), seq: null, handles: [], aura: new Set(), uses: 0}); }
  valid() { return live(this.u) && this.u.deploySeq === this.seq && this.u.mem.headb2Owner === this; }
  high(r, c) { return r >= 0 && c >= 0 && r < ROWS && c < COLS && this.b.grid.tiles[r * COLS + c]?.height === 'HIGH'; }
  legal(e) { return live(e) && e.side === 'enemy' && canTargetEnemy(this.u, e, plain); }
  strike(at, main, scale, radius, info) {
    const {b, u} = this, t1 = talent(u, 'damage_scale'), atk = u.s.atk * u.s.atkScaleMul;
    const hit = (e, amount, tag) => { if (this.legal(e)) b.dealDamage(u, e, {amount, type: 'phys', isAttack: true, isSkill: info.isSkill,
      attackId: info.attackId, applyWay: 'melee', tags: ['headb2', `headb2:${tag}`]}); };
    if (main) hit(main, atk * scale, 'main');
    const splash = (u.def.trait?.bb?.['attack@atk_scale_2'] ?? .5) * (t1?.damage_scale ?? 1);
    for (const e of b.foesInRadius(at.x, at.y, radius, true)) if (e !== main) hit(e, atk * scale * splash, 'splash');
    this.pulses(at, info);
  }
  // Talent 1: HIGH tiles whose centre lies within 1.0 of the hit centre pulse after 0.1 s.
  pulses(at, info) {
    const {b, u} = this, t1 = talent(u, 'attack@splash_atk_scale');
    if (!t1) return;
    const tiles = [];
    for (let r = Math.floor(at.y - 1); r <= Math.ceil(at.y + 1); r++)
      for (let c = Math.floor(at.x - 1); c <= Math.ceil(at.x + 1); c++)
        if (this.high(r, c) && Math.hypot(c - at.x, r - at.y) <= 1 + 1e-9) tiles.push([r, c]);
    const s3 = info.s3, done = info.round ?? new Set();
    const fire = (r, c, step) => {
      const key = r * COLS + c;
      if (done.has(key)) return;
      done.add(key);
      b.after(.1, () => {
        if (!live(u) || u.deploySeq !== this.seq) return;
        const scale = t1['attack@splash_atk_scale'] * (s3 ? u.skill.bb.splash_atk_scale_bonus : 1);
        for (const e of b.enemies) {
          const er = Math.round(e.y), ec = Math.round(e.x);
          if (!this.legal(e) || Math.abs(er - r) + Math.abs(ec - c) > 1) continue;
          b.dealDamage(u, e, {amount: u.s.atk * u.s.atkScaleMul * scale, type: 'phys', sourceless: true, applyWay: 'ranged', tags: ['headb2', 'headb2:pulse']});
          if (!live(e)) continue;
          if (s3) b.applyStatus(e, 'bind', {source: u, duration: u.skill.bb.unmovable});
          else if (t1['attack@sluggish'] > 0) b.applyStatus(e, 'sluggish', {source: u, duration: t1['attack@sluggish']});
        }
        // S3: spread to adjacent untouched HIGH tiles, up to the completed blow count.
        if (s3 && step < info.spread) for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.high(r + dr, c + dc)) fire(r + dr, c + dc, step + 1);
      }, {owner: u});
    };
    for (const [r, c] of tiles) fire(r, c, 0);
    // S2 passive: SP per HIGH tile triggered.
    if (u.skill?.id === HEADB2_SKILLS[1] && !u.skill.active && tiles.length) u.skill.gainSp(tiles.length * u.skill.bb.sp_per_highland, 'talent');
  }
  syncAura() {
    const {b, u} = this, t2 = talent(u, 'scale_bonus'), key = `headb2:aura:${u.id}`, on = !!t2 && this.valid() && !!u.skill?.active;
    for (const a of b.allyUnits) {
      const ok = on && live(a) && a.kind === 'op';
      if (!ok) { if (a.findBuff(key)) b.removeBuff(a, key); this.aura.delete(a); continue; }
      const m = b.regularTeams?.[a.defId] === 'student' ? t2.scale_bonus : 1;
      if (!a.findBuff(key)) { b.addBuff(a, {key, source: u, mods: {atkPct: t2.atk * m, defPct: t2.def * m}}); this.aura.add(a); }
    }
  }
  install() {
    const {b, u} = this;
    u.mem.headb2Owner = this;
    this.handles = [
      b.on('deploy', ({unit, move}) => { if (unit === u && !move) { this.seq = u.deploySeq; this.uses = 0; } }, {owner: u}),
      b.on('tick', () => this.syncAura(), {owner: u}),
      b.on('death', ({unit}) => { if (unit === u) this.stop(); }, {owner: u}),
      b.on('battleEnd', () => this.stop(), {owner: u}),
    ];
  }
  stop() { const key = `headb2:aura:${this.u.id}`; for (const a of this.aura) if (a.findBuff(key)) this.b.removeBuff(a, key); this.aura.clear(); }
}
export function customizeHeadb2Kit({battle: b, id, unit: u, kit}) {
  if (id !== ID) return;
  reviewed(b);
  if (!HEADB2_SKILLS.includes(u.def.skill?.id)) throw Error('Missing original selected Zima the Raging Tide skill');
  const owner = new Headb2Owner(b, u), s = u.def.skill, n = HEADB2_SKILLS.indexOf(s.id) + 1;
  u.mem.headb2Prepared = owner;
  kit.talents = [];
  const radius = u.def.trait?.bb?.['attack@ability_range_radius'] ?? 1;
  kit.trait = {...kit.trait, splashRadius: 0, canHitFly: false,
    windup: (_b, a) => model(a).hits[a.skill?.active && n === 2 ? 'Skill_2_Loop' : a.skill?.active && n === 1 ? 'Skill_1' : 'Attack'][0] / rate(a),
    attackVisual: (_b, a) => a.skill?.active && n === 2 ? 'Skill_2_Loop' : a.skill?.active && n === 1 ? 'Skill_1' : 'Attack',
    canAttack: (bb, a) => !bb.isUnitInBornState(a) && !(a.skill?.active && n === 3),
    acquireTargets: (bb, a) => { const ts = bb.enemiesInKeys(a.rangeKeys, a, plain).filter(e => owner.legal(e)); for (const e of bb.blockedTargets(a, plain)) if (!ts.includes(e)) ts.push(e); return sortEnemyTargets(bb, a, ts).slice(0, 1); },
    launchAttack: (_b, a, _p, t, info) => { owner.strike({x: t.x, y: t.y}, t, 1, radius, info); return true; }};
  if (n === 1) kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration, mods: {atkPct: s.bb.atk, aspd: s.bb.attack_speed}};
  else if (n === 2) kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'SP_FULL', duration: s.duration,
    targeting: {rangeGrid: owner.record.skillRangeGrid},
    onStart: () => {
      owner.uses++;
      const second = owner.uses > 1, bb = u.skill.bb;
      if (second) u.skill.timeLeft = Infinity;
      b.addBuff(u, {key: `headb2:s2:${u.id}`, source: u, mods: second ? {atkPct: bb['headb2_s_2[second].atk'], defPct: bb['headb2_s_2[second].def']} : {atkPct: bb.atk, defPct: bb.def}});
      u.mem.regularFormVisual = {clip: 'Skill_2_Idle', loop: true, replace: true};
    },
    onEnd: () => { b.removeBuff(u, `headb2:s2:${u.id}`); u.mem.regularFormVisual = {clip: 'Skill_2_End', playId: `headb2:s2end:${b.time}`}; }};
  else kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: model(u).durations.Skill_3, mods: {atkPct: s.bb.atk_base},
    onStart: () => {
      const bb = u.skill.bb, seq = owner.seq, act = u.skill.activations, [fr, fc] = front(u), events = model(u).hits.Skill_3;
      u.mem.regularFormVisual = {clip: 'Skill_3', playId: `headb2:s3:${b.time}`};
      events.forEach((t, i) => b.after(t, () => {
        if (!owner.valid() || u.deploySeq !== seq || !u.skill.active || u.skill.activations !== act) return;
        if (i > 0) b.addBuff(u, {key: `headb2:s3-step:${u.id}`, source: u, mods: {atkPct: bb.atk_step * i}});
        const at = {x: u.tileC + fc, y: u.tileR + fr};
        const main = b.enemies.filter(e => owner.legal(e) && Math.round(e.x) === at.x && Math.round(e.y) === at.y)[0] ?? null;
        owner.strike(at, main, bb.atk_scale, 1.5, {isSkill: true, attackId: ++b._attackSeq, s3: true, spread: i, round: new Set()});
      }, {owner: u}));
    },
    onEnd: () => b.removeBuff(u, `headb2:s3-step:${u.id}`)};
}
export function installHeadb2({battle: b, unit: u, def}) {
  if (def.charId !== ID) return;
  reviewed(b);
  const owner = u.mem.headb2Prepared;
  if (!owner) throw Error('Missing selected Zima the Raging Tide owner');
  delete u.mem.headb2Prepared; owner.install();
}
