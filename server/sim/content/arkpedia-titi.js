// SPDX-License-Identifier: GPL-3.0-or-later
// Titi (char_4056_titi), Incantation Medic.
// Source: data/arkpedia-native-operators/char_4056_titi.json.
//
// From data: Incantation Medic trait (Arts attacks; heals one ally in range
// for `scale` of the damage dealt); ordinary hit at the Attack clip event;
// talent 1 (E1+) she can attack sleeping enemies, +extra_atk_scale ATK Arts
// on non-moving enemies, and sleeping enemies take damage_atk_scale ATK Arts
// per second while she is deployed; talent 2 (E2) Minos/Sargon operators
// above hp_ratio HP get attack_speed vigor; S1 ATK and attack@prob chance to
// sleep the target attack@sleep s; S2 stops attacking, ATK, sleeps herself
// and the lowest-HP-ratio operator in range until the skill ends, keeps
// enemies around both asleep, talent 1 x talent_scale, manual stop; S3 ATK,
// two targets, sleep on non-sleeping targets, wake/kill damage from
// min_atk_scale to max_atk_scale with a chained `sleep` on one enemy within
// range_radius, and allies in range held asleep on fatal damage.
// Declared local mappings:
// - "Non-moving" means the enemy's `moving` flag is false at the hit.
// - S2 keeps enemies within 1 tile of her and of her target asleep, refreshed
//   every second; its talent scaling multiplies talent 1's damage terms.
// - S3 wake/kill damage covers every enemy on the field and scales linearly
//   with the sleep time, reaching max_atk_scale after 5 s asleep. A fatal hit
//   on an ally in range during S3 leaves it asleep at 1 HP until it is fully
//   healed or S3 ends; this engine's sleep rule keeps sleepers out of heal
//   targeting, so in practice only untargeted healing wakes it early.
import evidence from '../../../data/arkpedia-native-operators/char_4056_titi.json' with {type: 'json'};
import review from '../../../data/arkpedia-titi-runtime-review.json' with {type: 'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {normalizeChess} from '../simdata.js';
export const TITI_ID = 'char_4056_titi';
export const TITI_SKILLS = Object.freeze(['skchr_titi_1', 'skchr_titi_2', 'skchr_titi_3']);
export const selectedTitiBuild = build => selectedCNSourceBuild(evidence, TITI_ID, build);
const ID = TITI_ID, live = u => !!u?.alive && u.deployed && !u.hidden;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const asleep = e => !!e?.s?.flags?.sleep;
function reviewed(b) {
  const approved = same(review.enabledOperators, [ID]) && review.verification.browser.status === 'passed';
  const candidate = b.regularReviewCandidates?.includes(ID) && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !candidate) || review.frameParity !== false || review.moduleSupport !== false
    || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-titi-sleep-v1')
    throw Error('Missing Titi runtime review or explicit held browser candidate');
}
export function selectedTitiInputs(unit) {
  const skill = unit.def.skill, build = unit.def.raw.arkpedia;
  if (!skill) throw Error('Incomplete original selected Titi inputs');
  const s = selectedTitiBuild({...build, skillId: skill.id});
  if (unit.def.charId !== ID || !same(unit.def.stats, normalizeChess({stats: s.stats}).stats) || !same(unit.rangeGrid, s.rangeGrid)
    || !same(unit.def.talents.map(t => t.bb), s.talentBb) || !same(skill.bb, s.bb) || skill.spCost !== s.source.spData.spCost)
    throw Error('Incomplete original selected Titi inputs');
  return s;
}
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => u.base.bat / u.s.interval;
const talent = (u, key) => u.def.talents.find(t => t.bb[key] != null)?.bb;
class TitiOwner {
  constructor(b, u) { Object.assign(this, {b, u, record: selectedTitiInputs(u), seq: null, handles: [], vigor: new Set(), slept: new Map(), held: new Set(), target: null}); }
  valid() { return live(this.u) && this.u.deploySeq === this.seq && this.u.mem.titiOwner === this; }
  n() { return this.u.skill?.active ? TITI_SKILLS.indexOf(this.u.skill.id) + 1 : 0; }
  scale() { return this.n() === 2 ? this.u.skill.bb.talent_scale : 1; }
  arts(e, amount, tag) {
    if (live(e)) this.b.dealDamage(this.u, e, {amount, type: 'arts', ignoreSleep: true, applyWay: 'ranged', tags: ['titi', `titi:${tag}`]});
  }
  sleep(e, duration) { if (live(e)) this.b.applyStatus(e, 'sleep', {source: this.u, duration}); }
  allies() { if (this.b.rangeChanged(this.u)) this.b._refreshRange(this.u); return this.b.alliesInGrid(this.u).filter(live); }
  enemiesNear(x, y, r) { return this.b.enemiesInRadius(x, y, r, true).filter(e => live(e) && e.side === 'enemy'); }
  tick() {
    const {b, u} = this, t1 = talent(u, 'damage_atk_scale'), t2 = talent(u, 'hp_ratio');
    if (!this.valid()) return;
    // Talent 1: sleeping enemies take Arts every second.
    if (t1 && b.time + 1e-9 >= (this.burnAt ?? 0)) {
      this.burnAt = b.time + 1;
      for (const e of b.enemies) if (asleep(e) && live(e)) this.arts(e, u.s.atk * t1.damage_atk_scale * this.scale(), 'sleeping');
    }
    // Talent 2: vigor ASPD for healthy Minos/Sargon operators.
    for (const a of b.allyUnits) {
      const ok = t2 && live(a) && a.kind === 'op' && ['minos', 'sargon'].includes(b.regularNations?.[a.defId]) && a.hpRatio > t2.hp_ratio;
      if (ok && !a.findBuff('titi:vigor')) { b.addBuff(a, {key: 'titi:vigor', source: u, mods: {aspd: t2.attack_speed}}); this.vigor.add(a); }
      else if (!ok && a.findBuff('titi:vigor')) { b.removeBuff(a, 'titi:vigor'); this.vigor.delete(a); }
    }
    // S2: keep enemies around her and her target asleep.
    if (this.n() === 2 && b.time + 1e-9 >= (this.s2At ?? 0)) {
      this.s2At = b.time + 1;
      for (const p of [u, this.target].filter(live)) for (const e of this.enemiesNear(p.x, p.y, 1)) this.sleep(e, 1.1);
    }
    for (const a of [...this.held]) if (!live(a) || a.hp >= a.s.maxHp - 1e-6 || this.n() !== 3) { b.removeBuff(a, 'titi:s3-doze'); this.held.delete(a); }
  }
  // S3: waking or dying asleep costs Arts and chains sleep to a nearby enemy.
  wake(e, killed) {
    const {b, u} = this, bb = u.skill.bb, at = this.slept.get(e);
    this.slept.delete(e);
    if (this.n() !== 3 || at == null) return;
    const f = Math.min(1, (b.time - at) / 5), scale = bb.min_atk_scale + (bb.max_atk_scale - bb.min_atk_scale) * f;
    if (!killed) this.arts(e, u.s.atk * scale, 's3-wake');
    const next = this.enemiesNear(e.x, e.y, bb.range_radius).filter(x => x !== e && !asleep(x))[0];
    if (next) this.sleep(next, bb.sleep);
  }
  install() {
    const {b, u} = this;
    u.mem.titiOwner = this;
    this.handles = [
      b.on('deploy', ({unit, move}) => { if (unit === u && !move) this.seq = u.deploySeq; }, {owner: u}),
      b.on('tick', () => {
        this.tick();
        // Every enemy's sleep start, so S3 can price a wake by its length.
        for (const e of b.enemies) if (live(e) && asleep(e) && !this.slept.has(e)) this.slept.set(e, b.time);
        for (const [e] of [...this.slept]) if (live(e) && !asleep(e)) this.wake(e, false); else if (!live(e)) this.slept.delete(e);
      }, {owner: u}),
      b.on('death', ({unit}) => {
        if (unit === u) { this.stop(); return; }
        if (this.slept.has(unit) && this.valid()) this.wake(unit, true);
      }, {owner: u}),
      b.on('fatal', ctx => {
        const a = ctx.unit;
        if (ctx.prevented || this.n() !== 3 || !this.valid() || a === u || a?.side !== 'ally' || a.kind !== 'op' || !this.allies().includes(a)) return;
        ctx.prevented = true; a.hp = 1; b.addBuff(a, {key: 'titi:s3-doze', source: u, flags: {sleep: true, noBlock: true, invulnerable: true}}); this.held.add(a);
      }, {owner: u, priority: -2000}),
      b.on('battleEnd', () => this.stop(), {owner: u}),
    ];
  }
  stop() {
    for (const a of this.vigor) if (a.findBuff('titi:vigor')) this.b.removeBuff(a, 'titi:vigor');
    for (const a of this.held) this.b.removeBuff(a, 'titi:s3-doze');
    this.vigor.clear(); this.held.clear();
  }
}
export function customizeTitiKit({battle: b, id, unit: u, kit}) {
  if (id !== ID) return;
  reviewed(b);
  if (!TITI_SKILLS.includes(u.def.skill?.id)) throw Error('Missing original selected Titi skill');
  const owner = new TitiOwner(b, u), s = u.def.skill, n = TITI_SKILLS.indexOf(s.id) + 1, t1 = talent(u, 'extra_atk_scale');
  u.mem.titiPrepared = owner;
  kit.talents = [];
  const extra = (bb, a, e) => { if (t1 && live(e) && !e.moving) owner.arts(e, a.s.atk * t1.extra_atk_scale * owner.scale(), 'still'); };
  // The table's heal attack kind would make her a healer; the trait says Arts attacks.
  kit.trait = {...kit.trait, dmgType: 'arts', heal: null, attack: 'ranged', projectile: kit.trait?.projectile ?? 'bolt', hitSleep: !!t1,
    windup: (_b, a) => model(a).hits[a.skill?.active && n !== 2 ? `Skill_${n}_Loop` : 'Attack'][0] / rate(a),
    attackVisual: (_b, a) => a.skill?.active && n !== 2 ? `Skill_${n}_Loop` : 'Attack',
    canAttack: (bb, a) => !bb.isUnitInBornState(a) && !(a.skill?.active && n === 2),
    onEachHit: (bb, a, e) => extra(bb, a, e)};
  if (n === 1) kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration, mods: {atkPct: s.bb.atk},
    attack: {onEachHit: ({target}) => { if (live(target) && b.rng() < u.skill.bb['attack@prob']) owner.sleep(target, u.skill.bb['attack@sleep']); }}};
  else if (n === 2) kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration, mods: {atkPct: s.bb.atk},
    manualCancel: true,
    // Stoppable while only her own S2 sleep holds her.
    cancelWhileOwnSleep: () => !!u.findBuff('titi:s2-sleep') && !u.buffs.some(x => x.key !== 'titi:s2-sleep' && (x.flags?.stun || x.flags?.sleep || x.flags?.freeze || x.status === 'stun' || x.status === 'freeze' || x.status === 'sleep')),
    onStart: () => {
      owner.target = owner.allies().filter(a => a !== u && a.kind === 'op').sort((x, y) => x.hpRatio - y.hpRatio)[0] ?? null;
      for (const a of [u, owner.target].filter(live)) b.addBuff(a, {key: 'titi:s2-sleep', source: u, flags: {sleep: true, noBlock: true}});
      owner.s2At = 0; u.mem.regularFormVisual = {clip: 'Skill_2_Idle', loop: true, replace: true};
    },
    onEnd: () => {
      for (const a of [u, owner.target].filter(Boolean)) if (a.findBuff?.('titi:s2-sleep')) b.removeBuff(a, 'titi:s2-sleep');
      owner.target = null; u.mem.regularFormVisual = {clip: 'Skill_2_End', playId: `titi:s2end:${b.time}`};
    }};
  else kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration, mods: {atkPct: s.bb.atk},
    targeting: {maxTargets: s.bb['attack@max_target']},
    attack: {onEachHit: ({target}) => { if (live(target) && !asleep(target)) owner.sleep(target, u.skill.bb['attack@sleep']); }},
    onEnd: () => { for (const a of [...owner.held]) { b.removeBuff(a, 'titi:s3-doze'); owner.held.delete(a); } }};
}
export function installTiti({battle: b, unit: u, def}) {
  if (def.charId !== ID) return;
  reviewed(b);
  const owner = u.mem.titiPrepared;
  if (!owner) throw Error('Missing selected Titi owner');
  delete u.mem.titiPrepared; owner.install();
}
