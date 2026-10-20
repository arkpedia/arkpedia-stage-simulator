// SPDX-License-Identifier: GPL-3.0-or-later
// Raidian (char_4195_radian), Summoner Supporter, and his towers
// (token_10051_radian_tower1 / tower2 / tower3, one per selected skill).
// Source: data/arkpedia-native-operators/char_4195_radian.json.
//
// From data: Summoner trait (Arts attacks; uses summons); ordinary hit at the
// Attack clip event. Talent 1: `cnt` summons, at most the token's
// maxDeployCount on the field, the tower chosen by the selected skill.
// Talent 2: his summons gain inspiration of `atk`/`def`/`max_hp` of their own
// stats. Each skill start gains one summon. S1 (tower 1 "dive", melee
// Physical blocker): Raidian and his summons gain DEF `def` and a barrier of
// hp_ratio x max HP until the skill ends. S2 (tower 2 "cycle", melee): towers
// keep firing piercing Physical bullets forward (projectile_chr_radian_tower2:
// speed 5, life 0.6); while S2 runs, Raidian and his summons gain ATK `atk`,
// towers fire two extra bullets and bullets fly attack@projectile_life_time
// (two tiles further). S3 (tower 3 "centre", ranged Arts): a tower with no
// target joins the target of another Raidian summon in its range (prism
// link); while S3 runs, Raidian and his summons gain ATK `atk`, and their
// damage leaves enemies sluggish for `sluggish` s and Arts-fragile by
// damage_scale for weak[magic][limit] s.
// Declared local mappings:
// - Inspiration is applied as the matching percentage of the summon's stats.
// - A bullet hits each enemy it passes once (within 0.5); S2's two extra
//   bullets fly along the neighbouring lanes.
// - Summons take no deployment slot.
import evidence from '../../../data/arkpedia-native-operators/char_4195_radian.json' with {type: 'json'};
import review from '../../../data/arkpedia-radian-runtime-review.json' with {type: 'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {normalizeChess} from '../simdata.js';
import {COLS, ROWS} from '../constants.js';
export const RADIAN_ID = 'char_4195_radian';
export const RADIAN_SKILLS = Object.freeze(['skchr_radian_1', 'skchr_radian_2', 'skchr_radian_3']);
export const RADIAN_TOWERS = Object.freeze(['token_10051_radian_tower1', 'token_10052_radian_tower2', 'token_10053_radian_tower3']);
export const selectedRadianBuild = build => selectedCNSourceBuild(evidence, RADIAN_ID, build);
const ID = RADIAN_ID, live = u => !!u?.alive && u.deployed && !u.hidden;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const bulletPrefab = () => {
  const rows = evidence.projectiles.projectile_chr_radian_tower2.flatMap(r => r.components.map(c => c.data));
  return {speed: rows.find(d => '_speed' in d)._speed, life: rows.find(d => '_lifeTime' in d)._lifeTime};
};
const BULLET = Object.freeze({...bulletPrefab(), reach: .5});
const S2_LIFE = evidence.tables.tokenSkills.sktok_radian_2.levels.at(-1).blackboard.find(r => r.key === 'attack@projectile_life_time').value;
function reviewed(b) {
  const approved = same(review.enabledOperators, [ID]) && review.verification.browser.status === 'passed';
  const candidate = b.regularReviewCandidates?.includes(ID) && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !candidate) || review.frameParity !== false || review.moduleSupport !== false
    || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-radian-towers-v1')
    throw Error('Missing Raidian runtime review or explicit held browser candidate');
}
export function selectedRadianInputs(unit) {
  const skill = unit.def.skill, build = unit.def.raw.arkpedia;
  if (!skill) throw Error('Incomplete original selected Raidian inputs');
  const s = selectedRadianBuild({...build, skillId: skill.id});
  if (unit.def.charId !== ID || !same(unit.def.stats, normalizeChess({stats: s.stats}).stats) || !same(unit.rangeGrid, s.rangeGrid)
    || !same(unit.def.talents.map(t => t.bb), s.talentBb) || !same(skill.bb, s.bb) || skill.spCost !== s.source.spData.spCost)
    throw Error('Incomplete original selected Raidian inputs');
  return s;
}
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const towerModel = (id, t) => { const m = evidence.models[id]; return m.Single ?? m[t?.dir === 'UP' ? 'Back' : t?.dir === 'DOWN' ? 'Down' : 'Front']; };
const rate = u => u.base.bat / u.s.interval;
const talent = (u, key) => u.def.talents.find(t => t.bb[key] != null)?.bb;
const front = u => ({UP: [1, 0], DOWN: [-1, 0], LEFT: [0, -1], RIGHT: [0, 1]})[u.dir];
export class RadianOwner {
  constructor(b, u) { Object.assign(this, {b, u, record: selectedRadianInputs(u), seq: null, handles: [], bullets: new Set()}); }
  valid() { return live(this.u) && this.u.deploySeq === this.seq && this.u.mem.radianOwner === this; }
  n() { return RADIAN_SKILLS.indexOf(this.u.def.skill.id) + 1; }
  active() { return !!this.u.skill?.active; }
  towers() { return this.b.allyUnits.filter(t => live(t) && t.ownerUnit === this.u && RADIAN_TOWERS.includes(t.defId)); }
  state() { return this.b.regularSummons?.get(`summon:${ID}`); }
  // Talent 2 inspiration and the active skill buffs for him and his towers.
  sync() {
    const {b, u} = this, t2 = talent(u, 'max_hp'), bb = u.skill?.bb, on = this.valid() && this.active();
    for (const t of this.towers()) {
      if (t2 && !t.findBuff('radian:inspire')) b.addBuff(t, {key: 'radian:inspire', source: u, mods: {atkPct: t2.atk, defPct: t2.def, hpPct: t2.max_hp}});
    }
    for (const a of [u, ...this.towers()]) {
      const key = `radian:skill:${u.id}`, want = on ? (this.n() === 1 ? {defPct: bb.def} : {atkPct: bb.atk}) : null, old = a.findBuff(key);
      if (want && !old) {
        b.addBuff(a, {key, source: u, mods: want});
        if (this.n() === 1) b.addBuff(a, {key: `radian:barrier:${u.id}`, source: u, shield: a.s.maxHp * bb.hp_ratio});
      } else if (!want && old) { b.removeBuff(a, key); b.removeBuff(a, `radian:barrier:${u.id}`); }
    }
  }
  // S3: sluggish and Arts fragility from his and his towers' damage.
  s3Mark(e) {
    const {b, u} = this, bb = u.skill.bb;
    if (!live(e)) return;
    b.applyStatus(e, 'sluggish', {source: u, duration: bb.sluggish});
    b.addBuff(e, {key: `radian:fragile:${u.id}`, source: u, duration: bb['weak[magic][limit]'], timeLeft: bb['weak[magic][limit]'], refresh: 'replace', mods: {artsTakenMul: bb.damage_scale}});
  }
  // Tower 2 bullets.
  fire(t) {
    const [dr, dc] = front(t), s2 = this.n() === 2 && this.active(), life = s2 ? S2_LIFE : BULLET.life;
    const lanes = s2 ? [0, -1, 1] : [0];
    for (const k of lanes) {
      const b = {x: t.x + (dr ? k : 0), y: t.y + (dc ? k : 0), dx: dc, dy: dr, until: this.b.time + life, hit: new Set(), atk: t.s.atk, color: 0xffd36b, from: t};
      this.bullets.add(b); (this.b.regularVisualProjectiles ??= new Set()).add(b);
    }
  }
  moveBullets(dt) {
    const {b} = this;
    for (const p of [...this.bullets]) {
      p.x += p.dx * BULLET.speed * dt; p.y += p.dy * BULLET.speed * dt;
      if (b.time >= p.until || p.x < -1 || p.y < -1 || p.x > COLS || p.y > ROWS) { this.bullets.delete(p); b.regularVisualProjectiles?.delete(p); continue; }
      for (const e of b.enemiesInRadius(p.x, p.y, BULLET.reach, true)) {
        if (!live(e) || p.hit.has(e) || e.isFlying) continue;
        p.hit.add(e);
        b.dealDamage(live(p.from) ? p.from : null, e, {amount: p.atk, type: 'phys', applyWay: 'ranged', tags: ['radian', 'radian:bullet']});
      }
    }
  }
  install() {
    const {b, u} = this;
    u.mem.radianOwner = this;
    this.handles = [
      b.on('deploy', ({unit, move}) => { if (unit === u && !move) this.seq = u.deploySeq; }, {owner: u}),
      b.on('tick', ({dt}) => { this.sync(); this.moveBullets(dt ?? b.dt); }, {owner: u}),
      b.on('skillStart', ({unit}) => { const s = this.state(); if (unit === u && s) s.stock = Math.min(s.record.stats.maxDeckStackCnt, s.stock + 1); }, {owner: u}),
      b.on('damaged', h => {
        if (this.n() !== 3 || !this.active() || !this.valid() || h.dmg?.tags?.includes('radian:fragile')) return;
        const src = h.credit ?? h.source;
        if (src === u || (src?.ownerUnit === u && RADIAN_TOWERS.includes(src.defId))) this.s3Mark(h.target);
      }, {owner: u}),
      b.on('death', ({unit}) => { if (unit === u) { for (const p of this.bullets) b.regularVisualProjectiles?.delete(p); this.bullets.clear(); } }, {owner: u}),
    ];
  }
}
// A tower, placed from Raidian's card.
export function createRadianTower(b, state, row, col, dir) {
  const u = state.owner, id = state.record.id, owner = u.mem.radianOwner, record = state.record;
  const kit = {skill: null, install: (battle, t) => {
    t.mem.regularFormVisual = id === RADIAN_TOWERS[0] ? {clip: 'C_Skill1_Idle', loop: true, attack: 'C_Skill1_Attack'} : null;
    if (id === RADIAN_TOWERS[1]) {
      // Tower 2 fires along its facing on its own clock.
      let next = battle.time + towerModel(id, t).durations.Start;
      battle.every(battle.dt, () => {
        if (!live(t) || !owner?.valid()) return;
        if (battle.time + 1e-9 >= next) { next = battle.time + t.s.interval; owner.fire(t); }
      }, {owner: t});
    }
  }};
  if (id === RADIAN_TOWERS[0]) kit.trait = {dmgType: 'phys', attack: 'melee', windup: (_b, t) => towerModel(id, t).hits.C_Skill1_Attack[0] / rate(t), attackVisual: () => 'C_Skill1_Attack'};
  else if (id === RADIAN_TOWERS[1]) kit.trait = {noAttack: true, canAttack: () => false};
  else kit.trait = {dmgType: 'arts', attack: 'ranged', projectile: 'orb',
    windup: (_b, t) => towerModel(id, t).hits.Attack[0] / rate(t), attackVisual: () => 'Attack',
    // Prism link: with nothing in range, join a target of another tower in range.
    acquireTargets: (bb, t, prof) => {
      const own = bb.enemiesInKeys(t.rangeKeys, t, prof).filter(e => live(e));
      if (own.length) return null;
      const mates = owner?.towers().filter(m => m !== t && t.rangeKeySet.has(m.tileR * COLS + m.tileC)) ?? [];
      const linked = mates.flatMap(m => bb.enemiesInKeys(m.rangeKeys, m, prof).filter(e => live(e)));
      return linked.length ? [linked[0]] : [];
    }};
  return b.spawnToken(u, id, row, col, {dir, def: record, kit});
}
export function customizeRadianKit({battle: b, id, unit: u, kit}) {
  if (id !== ID) return;
  reviewed(b);
  if (!RADIAN_SKILLS.includes(u.def.skill?.id)) throw Error('Missing original selected Raidian skill');
  const owner = new RadianOwner(b, u), s = u.def.skill, n = RADIAN_SKILLS.indexOf(s.id) + 1;
  u.mem.radianPrepared = owner;
  kit.talents = [];
  const clip = a => a.skill?.active ? `Skill_${n}_Loop` : 'Attack';
  kit.trait = {...kit.trait, dmgType: 'arts', windup: (_b, a) => model(a).hits[clip(a)][0] / rate(a), attackVisual: (_b, a) => clip(a), canAttack: (bb, a) => !bb.isUnitInBornState(a)};
  kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration,
    onStart: () => { u.mem.regularFormVisual = {clip: `Skill_${n}_Idle`, loop: true, attack: `Skill_${n}_Loop`}; },
    onEnd: () => { u.mem.regularFormVisual = null; }};
}
export function installRadian({battle: b, unit: u, def}) {
  if (def.charId !== ID) return;
  reviewed(b);
  const owner = u.mem.radianPrepared;
  if (!owner) throw Error('Missing selected Raidian owner');
  delete u.mem.radianPrepared; owner.install();
}
