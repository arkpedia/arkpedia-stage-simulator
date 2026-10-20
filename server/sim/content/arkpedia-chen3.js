// SPDX-License-Identifier: GPL-3.0-or-later
// Ch'en the Dawnstreak (char_1050_chen3), Arts Fighter Guard.
// Source: data/arkpedia-native-operators/char_1050_chen3.json.
//
// From data: Arts Fighter trait (Arts melee attacks); ordinary hit at the
// Attack clip event. Talent 1 ATK/ASPD and weakness damage (common_weak_damage:
// "根据目标防御力和法术抗性变更伤害类型"). Talent 2 (chen3_t2, [timer], [evade]):
// every second without taking damage adds a stack; at stack_time stacks she
// heals a random integer heal_atk_scale_min..max % of ATK and gains one evade
// that dodges the next Physical or Arts damage; any damage restarts the count.
// S1: ATK, the two Skill_1_Loop events each hit, and struck enemies are
// silenced until the skill ends (chen3_s1[derived_silence]). S2: SP is cleared,
// she leaves the field invincible for the fixed 2 s (chen3_s2[invincible],
// [skill_not_available]) and slashes the nearest enemy in range `times` (10)
// times for atk_scale; a kill moves the slashes to the nearest other enemy and
// adds one (chen3_s2[dead_listener]); then she moves (ba.addash) onto a
// surviving target's tile when it is deployable, else returns, and keeps
// chen3_s2[respawn_buff] ATK and `prob` evasion until the skill ends. S3: skill
// range, up to attack@max_target targets hit at the three Skill_3_Loop events
// for attack@atk_scale, and at the start a sword wave (projectile_chr_chen3_s3:
// speed 1.5, life 10 s, ends with the skill) moving along her facing, bouncing
// off high ground, impassable tiles and the map edge, hitting each enemy within
// 0.25 once per leg for hp_ratio of its current HP (at least
// projectile_min_atk_scale x ATK) as Arts.
// Declared local mappings:
// - Weakness damage takes whichever of Physical (after DEF) and Arts (after
//   RES) would deal more; a source-flagged enemy type is not modelled.
// - The ten S2 slashes are spread evenly over the 2 s away window, and she is
//   drawn off the field after Skill_2_Begin and Skill_2_Disappear; "deployable"
//   means a melee/all build tile not occupied by another unit.
// - A bounce reverses the wave's direction (axis-aligned facings).
import evidence from '../../../data/arkpedia-native-operators/char_1050_chen3.json' with {type: 'json'};
import review from '../../../data/arkpedia-chen3-runtime-review.json' with {type: 'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {normalizeChess} from '../simdata.js';
import {canTargetEnemy} from '../targeting.js';
import {COLS, ROWS} from '../constants.js';
export const CHEN3_ID = 'char_1050_chen3';
export const CHEN3_SKILLS = Object.freeze(['skchr_chen3_1', 'skchr_chen3_2', 'skchr_chen3_3']);
export const selectedChen3Build = build => selectedCNSourceBuild(evidence, CHEN3_ID, build);
const ID = CHEN3_ID, live = u => !!u?.alive && u.deployed && !u.hidden;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const AWAY = 2, WAVE = Object.freeze({speed: 1.5, life: 10, hit: .25});
function reviewed(b) {
  const approved = same(review.enabledOperators, [ID]) && review.verification.browser.status === 'passed';
  const candidate = b.regularReviewCandidates?.includes(ID) && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !candidate) || review.frameParity !== false || review.moduleSupport !== false
    || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-chen3-weakness-dawnstreak-v1')
    throw Error("Missing Ch'en the Dawnstreak runtime review or explicit held browser candidate");
}
// The projectile constants above are the original prefab values.
export function verifyChen3Source() {
  const rows = evidence.projectiles.projectile_chr_chen3_s3.flatMap(r => r.components.map(c => c.data));
  const f = k => rows.find(d => k in d)?.[k];
  if (f('_speed') !== WAVE.speed || f('_lifeTime') !== WAVE.life || f('_hitDistance') !== WAVE.hit || f('_changeDirectionWhenHit') !== 1
    || f('_checkHitHighland') !== 1 || f('_checkHitMapEdge') !== 1 || f('_clearTargetsAlreadyHitListWhenHit') !== 1 || f('_canHitSameTargetMultipleTimes') !== 0)
    throw Error("Changed original Ch'en the Dawnstreak sword wave");
  const away = JSON.stringify(evidence.skills).includes('"buffKey": "chen3_s2[skill_not_available]"') || JSON.stringify(evidence.skills).includes('"buffKey":"chen3_s2[skill_not_available]"');
  if (!away) throw Error("Changed original Ch'en the Dawnstreak away window");
}
export function selectedChen3Inputs(unit) {
  const skill = unit.def.skill, build = unit.def.raw.arkpedia;
  if (!skill) throw Error("Incomplete original selected Ch'en the Dawnstreak inputs");
  const s = selectedChen3Build({...build, skillId: skill.id});
  if (unit.def.charId !== ID || !same(unit.def.stats, normalizeChess({stats: s.stats}).stats) || !same(unit.rangeGrid, s.rangeGrid)
    || !same(unit.def.talents.map(t => t.bb), s.talentBb) || !same(skill.bb, s.bb) || skill.spCost !== s.source.spData.spCost)
    throw Error("Incomplete original selected Ch'en the Dawnstreak inputs");
  return s;
}
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => u.base.bat / u.s.interval;
const talent = (u, key) => u.def.talents.find(t => t.bb[key] != null)?.bb;
const front = u => ({UP: [1, 0], DOWN: [-1, 0], LEFT: [0, -1], RIGHT: [0, 1]})[u.dir];
class Chen3Owner {
  constructor(b, u) { Object.assign(this, {b, u, record: selectedChen3Inputs(u), seq: null, handles: [], quiet: 0, stacks: 0, evade: false, wave: null, away: null, silenced: new Set()}); }
  valid() { return live(this.u) && this.u.deploySeq === this.seq && this.u.mem.chen3Owner === this; }
  n() { return this.u.skill?.active ? CHEN3_SKILLS.indexOf(this.u.skill.id) + 1 : 0; }
  legal(e) { return live(e) && e.side === 'enemy' && canTargetEnemy(this.u, e, this.u.profile); }
  arts(e, amount, tag, extra = {}) { if (live(e)) this.b.dealDamage(this.u, e, {amount, type: 'arts', applyWay: 'melee', isSkill: true, tags: ['chen3', `chen3:${tag}`], ...extra}); }
  // Talent 1: weakness damage picks the better of Physical and Arts per target.
  weak(h) {
    if (h.source !== this.u || !['phys', 'arts'].includes(h.dmg.type)) return;
    const e = h.target, a = h.dmg.amount * (h.dmg.mul ?? 1);
    const phys = Math.max(a - Math.max(0, e.s.def * (1 - (h.dmg.defIgnorePct ?? 0)) - (h.dmg.defIgnoreFlat ?? 0)), a * .05);
    const arts = Math.max(a * (1 - Math.max(0, e.s.res * (1 - (h.dmg.resIgnorePct ?? 0)) - (h.dmg.resIgnoreFlat ?? 0)) / 100), a * .05);
    h.dmg.type = phys > arts ? 'phys' : 'arts';
  }
  // Talent 2: a quiet second adds a stack; enough stacks heal and grant one evade.
  quietTick() {
    const {b, u} = this, t = talent(u, 'stack_time');
    if (!t || !this.valid() || this.away || b.time + 1e-9 < this.quiet) return;
    this.quiet = b.time + 1;
    if (++this.stacks < t.stack_time) return;
    this.stacks = 0;
    const pct = t.heal_atk_scale_min + Math.floor(b.rng() * (t.heal_atk_scale_max - t.heal_atk_scale_min + 1));
    b.heal(u, u, u.s.atk * pct / 100, {tags: ['chen3:t2']});
    this.evade = true;
  }
  hurt() { this.stacks = 0; this.quiet = this.b.time + 1; }
  // S3 sword wave.
  launch() {
    const {u} = this, [dr, dc] = front(u);
    this.wave = {x: u.x, y: u.y, dx: dc, dy: dr, until: this.b.time + WAVE.life, hit: new Set(), color: 0x9fd8ff};
    (this.b.regularVisualProjectiles ??= new Set()).add(this.wave);
  }
  blockedTile(x, y) {
    const r = Math.round(y), c = Math.round(x);
    if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return true;
    const t = this.b.grid.tiles[r * COLS + c];
    return !t || t.height === 'HIGH' || t.passable === false;
  }
  moveWave(dt) {
    const {b, u} = this, w = this.wave;
    if (!w) return;
    if (!this.valid() || this.n() !== 3 || b.time >= w.until) { this.endWave(); return; }
    let nx = w.x + w.dx * WAVE.speed * dt, ny = w.y + w.dy * WAVE.speed * dt;
    const ahead = this.blockedTile(nx + w.dx * .5, ny + w.dy * .5);
    if (ahead) { w.dx = -w.dx; w.dy = -w.dy; w.hit.clear(); nx = w.x; ny = w.y; }
    w.x = nx; w.y = ny;
    const bb = u.skill.bb;
    for (const e of b.enemies) {
      if (!this.legal(e) || w.hit.has(e) || Math.hypot(e.x - w.x, e.y - w.y) > WAVE.hit + (e.radius ?? 0)) continue;
      w.hit.add(e);
      this.arts(e, Math.max(e.hp * bb.hp_ratio, u.s.atk * bb.projectile_min_atk_scale), 's3-wave', {applyWay: 'none', canDodge: false});
    }
  }
  endWave() { if (this.wave) this.b.regularVisualProjectiles?.delete(this.wave); this.wave = null; }
  // S2: away window of slashes, then move or return.
  nearest(x, y, exclude) {
    return this.b.enemies.filter(e => this.legal(e) && e !== exclude).sort((p, q) => Math.hypot(p.x - x, p.y - y) - Math.hypot(q.x - x, q.y - y) || p.spawnSeq - q.spawnSeq)[0] ?? null;
  }
  inRange() { if (this.b.rangeChanged(this.u)) this.b._refreshRange(this.u); return this.b.enemiesInKeys(this.u.rangeKeys, this.u, this.u.profile).filter(e => this.legal(e)); }
  startAway() {
    const {b, u} = this, bb = u.skill.bb;
    const first = this.inRange().sort((p, q) => Math.hypot(p.x - u.x, p.y - u.y) - Math.hypot(q.x - u.x, q.y - u.y) || p.spawnSeq - q.spawnSeq)[0];
    u.skill.charges = 0; u.skill.sp = 0;
    this.away = {target: first, left: 10, epoch: (this.away?.epoch ?? 0) + 1};
    b.addBuff(u, {key: 'chen3:away', source: u, duration: AWAY, timeLeft: AWAY, flags: {invulnerable: true, untargetable: true, noBlock: true, disarm: true}});
    b.releaseBlocked(u);
    u.mem.regularFormVisual = {clip: 'Skill_2_Begin', playId: `chen3:s2:${u.id}:${b.time}`};
    // She leaves the field visually once the Begin and Disappear clips have played.
    const gone = model(u).durations.Skill_2_Begin + model(u).durations.Skill_2_Disappear;
    b.after(model(u).durations.Skill_2_Begin, () => { if (this.away && this.valid()) u.mem.regularFormVisual = {clip: 'Skill_2_Disappear', playId: `chen3:gone:${u.id}:${b.time}`}; }, {owner: u});
    b.after(gone, () => { if (this.away && this.valid()) u.mem.regularHidden = true; }, {owner: u});
    const step = AWAY / 10, epoch = this.away.epoch;
    const slash = () => {
      const a = this.away;
      if (!a || a.epoch !== epoch || !this.valid()) return;
      if (a.left <= 0) { this.arrive(); return; }
      if (!live(a.target)) a.target = null;
      if (a.target) {
        const t = a.target;
        this.arts(t, u.s.atk * bb.atk_scale, 's2-slash', {canDodge: true});
        a.left--;
        if (!live(t)) { a.target = this.nearest(t.x, t.y, t); a.left++; if (!a.target) a.left = 0; }
      } else a.left = 0;
      b.after(step, slash, {owner: u});
    };
    b.after(step, slash, {owner: u});
  }
  arrive() {
    const {b, u} = this, a = this.away, t = a?.target;
    this.away = null;
    delete u.mem.regularHidden;
    b.removeBuff(u, 'chen3:away');
    if (live(t)) {
      const r = Math.round(t.y), c = Math.round(t.x), tile = b.grid.tile?.(r, c) ?? b.grid.tiles[r * COLS + c];
      if (['MELEE', 'ALL'].includes(tile?.build) && b.moveRedeploy(u, r, c)) this.seq = u.deploySeq;
    }
    if (u.skill?.active && u.skill.id === CHEN3_SKILLS[1]) {
      const bb = u.skill.bb;
      b.addBuff(u, {key: 'chen3:s2-respawn', source: u, mods: {atkPct: bb['chen3_s2[respawn_buff].atk']}});
      u.mem.chen3Dodge = bb['chen3_s2[respawn_buff].prob'];
    }
    u.mem.regularFormVisual = {clip: 'Start_2', playId: `chen3:arrive:${u.id}:${b.time}`};
  }
  endS2() {
    const {b, u} = this;
    if (this.away) this.arrive();
    b.removeBuff(u, 'chen3:s2-respawn'); delete u.mem.chen3Dodge;
  }
  install() {
    const {b, u} = this;
    u.mem.chen3Owner = this;
    this.handles = [
      b.on('deploy', ({unit, move}) => {
        if (unit !== u || move) return;
        this.seq = u.deploySeq; this.quiet = b.time + 1;
        // Talent 1 ATK/ASPD while deployed.
        const t1 = talent(u, 'attack_speed');
        if (t1) b.addBuff(u, {key: 'chen3:t1', source: u, mods: {atkPct: t1.atk, aspd: t1.attack_speed}});
      }, {owner: u}),
      b.on('tick', ({dt}) => { this.quietTick(); this.moveWave(dt ?? b.dt); }, {owner: u}),
      b.on('hit', ctx => {
        if (ctx.source === u && this.valid()) this.weak(ctx);
        if (ctx.target !== u || !this.valid() || !['phys', 'arts'].includes(ctx.dmg.type)) return;
        // Talent 2 evade, then the S2 respawn evasion.
        if (this.evade) { this.evade = false; ctx.cancel = true; return; }
        if (u.mem.chen3Dodge && b.rng() < u.mem.chen3Dodge) ctx.cancel = true;
      }, {owner: u}),
      b.on('damaged', ({target, amount}) => { if (target === u && amount > 0) this.hurt(); }, {owner: u}),
      b.on('death', ({unit}) => { if (unit === u) this.stop(); }, {owner: u}),
      b.on('battleEnd', () => this.stop(), {owner: u}),
    ];
  }
  stop() {
    this.endWave(); this.away = null; delete this.u.mem.regularHidden;
    for (const e of this.silenced) if (e.findBuff?.('chen3:s1-silence')) this.b.removeBuff(e, 'chen3:s1-silence');
    this.silenced.clear();
  }
}
export function customizeChen3Kit({battle: b, id, unit: u, kit}) {
  if (id !== ID) return;
  reviewed(b);
  verifyChen3Source();
  if (!CHEN3_SKILLS.includes(u.def.skill?.id)) throw Error("Missing original selected Ch'en the Dawnstreak skill");
  const owner = new Chen3Owner(b, u), s = u.def.skill, n = CHEN3_SKILLS.indexOf(s.id) + 1;
  u.mem.chen3Prepared = owner;
  kit.talents = [];
  const clip = a => a.skill?.active && n !== 2 ? `Skill_${n}_Loop` : 'Attack';
  kit.trait = {...kit.trait, dmgType: 'arts', windup: (_b, a) => model(a).hits[clip(a)][0] / rate(a), attackVisual: (_b, a) => clip(a),
    canAttack: (bb, a) => !bb.isUnitInBornState(a) && !owner.away};
  const pose = {onStart: () => { u.mem.regularFormVisual = {clip: `Skill_${n}_Idle`, loop: true, attack: `Skill_${n}_Loop`}; }};
  // Later clip events of a multi-hit skill attack.
  const more = (target, events, scale, tag, after) => events.slice(1).forEach(t => b.after((t - events[0]) / rate(u), () => {
    if (owner.valid() && u.skill?.active && live(target)) { owner.arts(target, u.s.atk * scale, tag, {isAttack: true}); after?.(target); }
  }, {owner: u}));
  const silence = e => {
    if (!live(e) || !u.skill?.active) return;
    b.addBuff(e, {key: 'chen3:s1-silence', source: u, status: 'silence', flags: {silence: true}, duration: u.skill.timeLeft, timeLeft: u.skill.timeLeft});
    owner.silenced.add(e);
  };
  if (n === 1) kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration, mods: {atkPct: s.bb.atk}, ...pose,
    onEnd: () => { u.mem.regularFormVisual = null; for (const e of owner.silenced) if (e.findBuff?.('chen3:s1-silence')) b.removeBuff(e, 'chen3:s1-silence'); owner.silenced.clear(); },
    attack: {onEachHit: ({target, kind}) => { if (kind !== 'main') return; silence(target); more(target, model(u).hits.Skill_1_Loop, 1, 's1-second', silence); }}};
  else if (n === 2) kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration,
    targeting: {rangeGrid: owner.record.skillRangeGrid},
    canActivate: () => owner.valid() && owner.inRange().length > 0,
    onStart: () => owner.startAway(), onEnd: () => { owner.endS2(); u.mem.regularFormVisual = null; }};
  else kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration, ...pose,
    targeting: {maxTargets: s.bb['attack@max_target'], rangeGrid: owner.record.skillRangeGrid},
    onStart: () => { pose.onStart(); owner.launch(); },
    onEnd: () => { u.mem.regularFormVisual = null; owner.endWave(); },
    attack: {atkScale: s.bb['attack@atk_scale'], groundOnly: true, canHitFly: false,
      onEachHit: ({target, kind}) => { if (kind === 'main') more(target, model(u).hits.Skill_3_Loop, s.bb['attack@atk_scale'], 's3-hit'); }}};
}
export function installChen3({battle: b, unit: u, def}) {
  if (def.charId !== ID) return;
  reviewed(b);
  const owner = u.mem.chen3Prepared;
  if (!owner) throw Error("Missing selected Ch'en the Dawnstreak owner");
  delete u.mem.chen3Prepared; owner.install();
}
