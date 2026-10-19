// SPDX-License-Identifier: GPL-3.0-or-later
// Yahata Umiri (char_4186_tmoris), Stalker Specialist of Ave Mujica.
// Source: data/arkpedia-native-operators/char_4186_tmoris.json and
// data/arkpedia-fever-source.json.
//
// From data: Stalker trait (all enemies in range, 50% dodge, low threat);
// ordinary Physical hit at the Attack clip's OnAttack event (damageType 1);
// talent 1 sluggish chance/duration and the E2 y-3 skill range; talent 2
// Fever per sluggish/fear inflicted and the Ave Mujica damage bonus against
// sluggish/feared enemies; S1 two charges, five Arts hits (damageType 2) at
// the Skill_1 events on ground enemies in range; S2 1.5 s fear on start, Arts
// damage every attack@interval and talent chance x talent_scale.
// Declared local mappings:
// - Talent 1 rolls once per damage instance she deals, after it lands.
// - "When another member starts a skill, release once more": the five-hit
//   burst runs again for free, without spending a charge.
// - S2 replaces her ordinary attack with its periodic damage.
import evidence from '../../../data/arkpedia-native-operators/char_4186_tmoris.json' with {type: 'json'};
import review from '../../../data/arkpedia-tmoris-runtime-review.json' with {type: 'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {normalizeChess, normSpType} from '../simdata.js';
import {canTargetEnemy} from '../targeting.js';
import {feverOf, FEVER_MEMBERS} from './arkpedia-fever.js';
export const TMORIS_ID = 'char_4186_tmoris';
export const TMORIS_SKILLS = Object.freeze(['skchr_tmoris_1', 'skchr_tmoris_2']);
export const selectedTmorisBuild = build => selectedCNSourceBuild(evidence, TMORIS_ID, build);
const ID = TMORIS_ID, live = u => !!u?.alive && u.deployed && !u.hidden;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function verifyTmorisSource() {
  const kinds = {};
  for (const [g, key] of [['characters', ID], ['skills', 'skchr_tmoris_1']])
    for (const row of evidence[g][key]) for (const c of row.components) if (c.data && '_damageType' in c.data) (kinds[key] ??= []).push(c.data._damageType);
  if (!same(kinds, {[ID]: [1, 2], skchr_tmoris_1: [2]})) throw Error('Changed original Umiri damage types');
  for (const face of ['Front', 'Back']) {
    const h = evidence.models[ID][face].hits;
    if (h.Attack.length !== 1 || h.Skill_1.length !== 5) throw Error('Changed original Umiri attack events');
  }
}
function reviewed(b) {
  const approved = same(review.enabledOperators, [ID]) && review.verification.browser.status === 'passed';
  const candidate = b.regularReviewCandidates?.includes(ID) && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !candidate) || review.frameParity !== false || review.moduleSupport !== false
    || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-tmoris-stalker-sluggish-fear-fever-v1')
    throw Error('Missing Umiri runtime review or explicit held browser candidate');
}
export function selectedTmorisInputs(unit) {
  const skill = unit.def.skill, build = unit.def.raw.arkpedia;
  if (!skill) throw Error('Incomplete original selected Umiri inputs');
  const s = selectedTmorisBuild({...build, skillId: skill.id});
  if (unit.def.charId !== ID || !same(unit.def.stats, normalizeChess({stats: s.stats}).stats) || !same(unit.rangeGrid, s.rangeGrid)
    || !same(unit.def.talents.map(t => t.bb), s.talentBb) || !same(skill.bb, s.bb)
    || skill.spType !== normSpType(s.source.spData.spType) || skill.spCost !== s.source.spData.spCost
    || skill.initSp !== s.source.spData.initSp || skill.duration !== s.source.duration)
    throw Error('Incomplete original selected Umiri inputs');
  return s;
}
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => u.base.bat / u.s.interval;
const talent = (u, key) => u.def.talents.find(t => t.bb[key] != null)?.bb;
// The E2 talent candidate (mark = 1) carries the range used while a skill is active.
function skillRangeGrid(u) {
  const c = evidence.tables.character, e = u.def.raw.arkpedia.elite;
  const cand = c.talents[0].candidates.filter(x => Number(x.unlockCondition.phase.slice(-1)) <= e).at(-1);
  if (!cand?.rangeId || !cand.blackboard.some(b => b.key === 'mark' && b.value === 1)) return null;
  return evidence.tables.ranges[cand.rangeId].grids.map(p => [p.row, p.col]);
}
class TmorisOwner {
  constructor(b, u) {
    verifyTmorisSource();
    Object.assign(this, {b, u, record: selectedTmorisInputs(u), seq: null, handles: [], bursts: new Set(), tick2: null});
  }
  valid() { return live(this.u) && this.u.deploySeq === this.seq && this.u.mem.tmorisOwner === this; }
  inRange(ground) {
    const {b, u} = this;
    if (b.rangeChanged(u)) b._refreshRange(u);
    return b.enemiesInKeys(u.rangeKeys, u, {canHitFly: !ground, groundOnly: ground}).filter(e => live(e) && canTargetEnemy(u, e, {canHitFly: !ground}));
  }
  // Talent 1 on a damaged enemy; S2 scales the chance.
  roll(e) {
    const t = talent(this.u, 'sluggish');
    if (!t || !live(e)) return;
    const p = t.prob * (this.u.skill?.active && this.u.skill.id === TMORIS_SKILLS[1] ? this.u.skill.bb.talent_scale : 1);
    if (this.b.rng() < p && this.b.applyStatus(e, 'sluggish', {source: this.u, duration: t.sluggish}) !== false) this.inflicted();
  }
  inflicted() { const t = talent(this.u, 'cnt'); if (t && this.valid()) feverOf(this.b).add(this.u, t.cnt); }
  arts(e, scale, tag) {
    if (!live(e)) return;
    this.b.dealDamage(this.u, e, {amount: this.u.s.atk * this.u.s.atkScaleMul * scale, type: 'arts', isSkill: true,
      isAttack: tag === 's1', applyWay: 'ranged', tags: ['tmoris', `tmoris:${tag}`]});
  }
  // Five Arts hits on ground enemies in range at the Skill_1 events.
  burst(extra = false) {
    const {b, u} = this, seq = this.seq, times = model(u).hits.Skill_1, bb = u.skill.bb;
    if (!extra) u.mem.regularFormVisual = {clip: 'Skill_1', playId: `tmoris:${seq}:${b.time}`};
    const handle = {cancelled: false};
    this.bursts.add(handle);
    times.slice(0, bb.times).forEach((t, i) => b.after(t, () => {
      if (handle.cancelled || !this.valid() || u.deploySeq !== seq) return;
      for (const e of this.inRange(true)) this.arts(e, bb.atk_scale, 's1');
      if (i === bb.times - 1) this.bursts.delete(handle);
    }, {owner: u}));
  }
  install() {
    const {b, u} = this;
    u.mem.tmorisOwner = this;
    const fever = feverOf(b), aura = talent(u, 'damage_scale');
    // Talent 2: Ave Mujica members deal more damage to sluggish/feared enemies while she is deployed.
    const key = `tmoris:${u.id}`;
    (b._dealtMultipliers ??= new Map()).set(key, (source, target) =>
      aura && this.valid() && source?.kind === 'op' && FEVER_MEMBERS.includes(source.defId)
        && target.buffs.some(f => f.key === 'sluggish' || f.key === 'fear' || f.status === 'sluggish' || f.status === 'fear')
        ? aura.damage_scale : 1);
    this.handles = [
      b.on('deploy', ({unit, move}) => { if (unit === u && !move) { this.seq = u.deploySeq; u.mem.regularBornUntil = b.time + model(u).durations.Start; } }, {owner: u}),
      b.on('damaged', ({source, target, amount}) => { if (source === u && amount > 0 && target?.side === 'enemy') this.roll(target); }, {owner: u}),
      b.on('skillStart', ({unit}) => {
        if (unit !== u && this.valid() && u.skill.id === TMORIS_SKILLS[0] && FEVER_MEMBERS.includes(unit?.defId) && unit.side === 'ally') this.burst(true);
      }, {owner: u}),
      b.on('death', ({unit}) => { if (unit === u) this.stop(); }, {owner: u}),
      b.on('battleEnd', () => this.stop(), {owner: u}),
    ];
    void fever;
  }
  stop() {
    for (const h of this.bursts) h.cancelled = true;
    this.bursts.clear(); this.tick2?.cancel(); this.tick2 = null;
    this.b._dealtMultipliers?.delete(`tmoris:${this.u.id}`);
  }
}
export function customizeTmorisKit({battle: b, id, unit: u, kit}) {
  if (id !== ID) return;
  reviewed(b);
  if (!TMORIS_SKILLS.includes(u.def.skill?.id)) throw Error('Missing original selected Umiri skill');
  const owner = new TmorisOwner(b, u), s = u.def.skill, n = TMORIS_SKILLS.indexOf(s.id) + 1, grid = skillRangeGrid(u);
  u.mem.tmorisPrepared = owner;
  kit.talents = [];
  // Ordinary attack: the Stalker profile, released at the clip's OnAttack event.
  kit.trait = {...kit.trait, windup: (_b, a) => model(a).hits.Attack[0] / rate(a), attackVisual: () => 'Attack',
    canAttack: (bb, a) => !bb.isUnitInBornState(a)};
  const targeting = grid ? {rangeGrid: grid} : null;
  kit.skill = n === 1
    ? {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration, targeting, flags: {disarm: true},
      onStart: () => owner.burst()}
    : {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration, targeting, flags: {disarm: true},
      onStart: () => {
        const bb = u.skill.bb;
        u.mem.regularFormVisual = {clip: 'Skill_2_Loop', loop: true, replace: true};
        for (const e of owner.inRange(false)) if (b.applyStatus(e, 'fear', {source: u, duration: bb.fear}) !== false) owner.inflicted();
        owner.tick2?.cancel();
        owner.tick2 = b.every(bb['attack@interval'], () => {
          if (!owner.valid() || !u.skill.active) { owner.tick2?.cancel(); owner.tick2 = null; return; }
          for (const e of owner.inRange(false)) owner.arts(e, bb['attack@atk_scale'], 's2');
        }, {owner: u});
      },
      onEnd: () => { owner.tick2?.cancel(); owner.tick2 = null; u.mem.regularFormVisual = {clip: 'Skill_2_End', playId: `tmoris:end:${b.time}`}; }};
}
export function installTmoris({battle: b, unit: u, def}) {
  if (def.charId !== ID) return;
  reviewed(b);
  const owner = u.mem.tmorisPrepared;
  if (!owner) throw Error('Missing selected Umiri owner');
  delete u.mem.tmorisPrepared; owner.install();
}
