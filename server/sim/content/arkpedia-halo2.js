// SPDX-License-Identifier: GPL-3.0-or-later
// Astgenne the Lightchaser (char_1047_halo2), Decel Binder Supporter.
// Source: data/arkpedia-native-operators/char_1047_halo2.json.
//
// From data: Decel Binder trait (Arts attacks, sluggish `sluggish` s on hit);
// ordinary hit at the Attack clip event; talent 1 each sluggish she applies
// gives +attack_speed ASPD, stacking to max_stack_cnt (template halo2_t_2);
// talent 2 enemies in her range take fragile (weak[inf]) damage_scale, rising
// by damage_scale_add every `interval` s in range to damage_scale_max
// (templates halo2_t_1/[check]/[weak]); S1 ATK and attacks that jump between
// enemies up to attack@chain.max_target times within attack@projectile_range;
// S2 (auto, next attack) hits the max_target_attack enemies in range farthest
// from her for atk_scale, sluggish `sluggish` s, and links up to max_target
// enemies within ability_range_radius of each, pulling them (force) toward it
// for atk_scale_link; S3 skill range, ATK, base attack time, two locked
// targets, and Arts damage she deals to a linked target is shared at
// attack@atk_share of its pre-mitigation value to the other linked targets
// (templates halo2_s_3_link/_damage, her own non-continuous Arts only).
// Declared local mappings:
// - S1 jumps go to the nearest enemy within range other than the one just
//   hit, so a jump may return to an earlier enemy ("重复跳跃").
// - S2 target point is her own position; S2's own sluggish replaces the trait's.
//   An enemy struck as an S2 target is not also linked by the other target.
// - S3 links are the targets of her latest S3 attack.
import evidence from '../../../data/arkpedia-native-operators/char_1047_halo2.json' with {type: 'json'};
import review from '../../../data/arkpedia-halo2-runtime-review.json' with {type: 'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {normalizeChess} from '../simdata.js';
import {canTargetEnemy} from '../targeting.js';
import {STATUS} from '../buffs.js';
export const HALO2_ID = 'char_1047_halo2';
export const HALO2_SKILLS = Object.freeze(['skchr_halo2_1', 'skchr_halo2_2', 'skchr_halo2_3']);
export const selectedHalo2Build = build => selectedCNSourceBuild(evidence, HALO2_ID, build);
const ID = HALO2_ID, live = u => !!u?.alive && u.deployed && !u.hidden;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function reviewed(b) {
  const approved = same(review.enabledOperators, [ID]) && review.verification.browser.status === 'passed';
  const candidate = b.regularReviewCandidates?.includes(ID) && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !candidate) || review.frameParity !== false || review.moduleSupport !== false
    || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-halo2-decel-links-v1')
    throw Error('Missing Astgenne the Lightchaser runtime review or explicit held browser candidate');
}
export function selectedHalo2Inputs(unit) {
  const skill = unit.def.skill, build = unit.def.raw.arkpedia;
  if (!skill) throw Error('Incomplete original selected Astgenne the Lightchaser inputs');
  const s = selectedHalo2Build({...build, skillId: skill.id});
  if (unit.def.charId !== ID || !same(unit.def.stats, normalizeChess({stats: s.stats}).stats) || !same(unit.rangeGrid, s.rangeGrid)
    || !same(unit.def.talents.map(t => t.bb), s.talentBb) || !same(skill.bb, s.bb) || skill.spCost !== s.source.spData.spCost)
    throw Error('Incomplete original selected Astgenne the Lightchaser inputs');
  return s;
}
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => u.base.bat / u.s.interval;
const talent = (u, key) => u.def.talents.find(t => t.bb[key] != null)?.bb;
class Halo2Owner {
  constructor(b, u) { Object.assign(this, {b, u, record: selectedHalo2Inputs(u), seq: null, handles: [], stacks: 0, seen: new Map(), links: []}); }
  valid() { return live(this.u) && this.u.deploySeq === this.seq && this.u.mem.halo2Owner === this; }
  n() { return this.u.skill?.active ? HALO2_SKILLS.indexOf(this.u.skill.id) + 1 : 0; }
  legal(e) { return live(e) && e.side === 'enemy' && canTargetEnemy(this.u, e, this.u.profile); }
  inRange() { if (this.b.rangeChanged(this.u)) this.b._refreshRange(this.u); return this.b.enemiesInKeys(this.u.rangeKeys, this.u, this.u.profile).filter(e => this.legal(e)); }
  // Trait sluggish; every one she applies feeds talent 1.
  slug(e, duration) {
    const t = talent(this.u, 'max_stack_cnt');
    if (!live(e) || this.b.applyStatus(e, 'sluggish', {source: this.u, duration}) === false || !t) return;
    if (this.stacks >= t.max_stack_cnt) return;
    this.stacks++;
    this.b.addBuff(this.u, {key: `halo2:aspd:${this.u.id}`, source: this.u, mods: {aspd: t.attack_speed * this.stacks}});
  }
  arts(e, amount, tag, extra = {}) {
    if (!live(e)) return 0;
    return this.b.dealDamage(this.u, e, {amount, type: 'arts', applyWay: 'ranged', tags: ['halo2', `halo2:${tag}`], ...extra});
  }
  // Talent 2: fragile for enemies in range, stronger the longer they stay.
  syncWeak() {
    const {b, u} = this, t = talent(u, 'halo2_t_1[weak].damage_scale'), key = `halo2:weak:${u.id}`;
    const inside = new Set(this.valid() && t ? this.inRange() : []);
    for (const e of b.enemies) {
      if (!inside.has(e)) { if (e.findBuff?.(key)) b.removeBuff(e, key); this.seen.delete(e); continue; }
      if (!this.seen.has(e)) this.seen.set(e, b.time);
      const steps = Math.floor((b.time - this.seen.get(e)) / t['halo2_t_1[weak].interval'] + 1e-9);
      const scale = Math.min(t['halo2_t_1[weak].damage_scale_max'], t['halo2_t_1[weak].damage_scale'] + steps * t['halo2_t_1[weak].damage_scale_add']);
      const mods = STATUS.fragile.mods(scale - 1), old = e.findBuff(key);
      if (!old || old.mods.dmgTakenMul !== mods.dmgTakenMul) b.addBuff(e, {key, source: u, status: 'fragile', mods});
    }
  }
  // S3: share her Arts damage on one linked target with the others.
  share(h) {
    const {u} = this;
    if (this.n() !== 3 || h.source !== u || h.type !== 'arts' || h.dmg?.tags?.includes('halo2:link') || !this.links.includes(h.target)) return;
    const value = (h.dmg?.amount ?? 0) * (h.dmg?.mul ?? 1) * u.skill.bb['attack@atk_share'];
    for (const e of this.links) if (e !== h.target && live(e)) this.arts(e, value, 'link', {sourceless: true, canDodge: false});
  }
  install() {
    const {b, u} = this;
    u.mem.halo2Owner = this;
    this.handles = [
      b.on('deploy', ({unit, move}) => { if (unit === u && !move) this.seq = u.deploySeq; }, {owner: u}),
      b.on('tick', () => this.syncWeak(), {owner: u}),
      b.on('damaged', h => { if (this.valid()) this.share(h); }, {owner: u}),
      b.on('death', ({unit}) => { if (unit === u) this.stop(); }, {owner: u}),
      b.on('battleEnd', () => this.stop(), {owner: u}),
    ];
  }
  stop() {
    const key = `halo2:weak:${this.u.id}`;
    for (const e of this.seen.keys()) if (e.findBuff?.(key)) this.b.removeBuff(e, key);
    this.seen.clear(); this.links = [];
  }
}
export function customizeHalo2Kit({battle: b, id, unit: u, kit}) {
  if (id !== ID) return;
  reviewed(b);
  if (!HALO2_SKILLS.includes(u.def.skill?.id)) throw Error('Missing original selected Astgenne the Lightchaser skill');
  const owner = new Halo2Owner(b, u), s = u.def.skill, n = HALO2_SKILLS.indexOf(s.id) + 1;
  const sluggish = u.def.trait?.bb?.sluggish ?? .8;
  u.mem.halo2Prepared = owner;
  kit.talents = [];
  const clip = a => a.skill?.active && n !== 2 ? `Skill_${n}_Loop` : a.skill?.pending && n === 2 ? 'Skill_2' : 'Attack';
  kit.trait = {...kit.trait, dmgType: 'arts', onHitStatus: null,
    windup: (_b, a) => model(a).hits[clip(a)][0] / rate(a), attackVisual: (_b, a) => clip(a),
    canAttack: (bb, a) => !bb.isUnitInBornState(a),
    onEachHit: (_bb, a, e, hc) => { if (hc.kind === 'main' && !(n === 2 && a.skill?.pending)) owner.slug(e, sluggish); }};
  const pose = {onStart: () => { u.mem.regularFormVisual = {clip: `Skill_${n}_Idle`, loop: true, attack: `Skill_${n}_Loop`}; },
    onEnd: () => { u.mem.regularFormVisual = null; owner.links = []; }};
  if (n === 1) kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration, mods: {atkPct: s.bb.atk}, ...pose,
    attack: {onEachHit: ({target, kind}) => {
      if (kind !== 'main') return;
      let prev = target;
      for (let k = 0; k < u.skill.bb['attack@chain.max_target'] && live(prev); k++) {
        const next = b.enemiesInRadius(prev.x, prev.y, u.skill.bb['attack@projectile_range'], true).filter(e => e !== prev && owner.legal(e))
          .sort((x, y) => Math.hypot(x.x - prev.x, x.y - prev.y) - Math.hypot(y.x - prev.x, y.y - prev.y) || x.spawnSeq - y.spawnSeq)[0];
        if (!next) break;
        owner.arts(next, u.s.atk, 's1-chain', {isAttack: true, isSkill: true}); owner.slug(next, sluggish); prev = next;
      }
    }}};
  else if (n === 2) kit.skill = {id: s.id, name: s.name, kind: 'instant', trigger: 'SP_FULL',
    targeting: {maxTargets: s.bb.max_target_attack},
    attack: {atkScale: s.bb.atk_scale,
      acquireTargets: (_bb, a) => (owner.s2Targets = owner.inRange().sort((x, y) => Math.hypot(y.x - a.x, y.y - a.y) - Math.hypot(x.x - a.x, x.y - a.y) || x.spawnSeq - y.spawnSeq).slice(0, s.bb.max_target_attack)),
      onEachHit: ({target, kind}) => {
        if (kind !== 'main' || !live(target)) return;
        const bb = u.skill.bb;
        owner.slug(target, bb.sluggish);
        for (const e of b.enemiesInRadius(target.x, target.y, bb.ability_range_radius, true).filter(x => x !== target && !owner.s2Targets?.includes(x) && owner.legal(x)).slice(0, bb.max_target)) {
          b.pull(e, bb.force, {to: {x: target.x, y: target.y}, center: target});
          owner.arts(e, u.s.atk * bb.atk_scale_link, 's2-link', {isSkill: true}); owner.slug(e, bb.sluggish);
        }
      }}};
  else kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration,
    mods: {atkPct: s.bb.atk, batFlat: s.bb.base_attack_time}, ...pose,
    targeting: {maxTargets: s.bb['attack@max_target'], rangeGrid: owner.record.skillRangeGrid},
    attack: {afterAttack: (_bb, _a, targets) => { owner.links = (targets ?? []).filter(live); }}};
}
export function installHalo2({battle: b, unit: u, def}) {
  if (def.charId !== ID) return;
  reviewed(b);
  const owner = u.mem.halo2Prepared;
  if (!owner) throw Error('Missing selected Astgenne the Lightchaser owner');
  delete u.mem.halo2Prepared; owner.install();
}
