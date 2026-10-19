// SPDX-License-Identifier: GPL-3.0-or-later
// Kal'tsit·Esperanta (char_1052_kalts2), Watchman Medic, and her tactical
// anchor (token_10068_kalts2_mtship, S3 only).
// Source: data/arkpedia-native-operators/char_1052_kalts2.json.
//
// From data: trait heals allies and lets her lift off. Talent 1 (kalts2_t_1):
// max HP and DEF `max_hp`/`def`, block +block_cnt, BLOCK_RADIUS_SCALE
// +block_radius_scale (block_radius_scaler[inf]); she lifts off after
// deployment and her block mode is FLY (ChangeCharBlockMode). Talent 2
// (kalts2_t_2): an operator (profession mask 639) entering her attack range
// gets hp_recovery_per_sec HP a second for buff_duration s (x rhodes_bonus for
// Rhodes Island, [hp_recover]) and, unless it still holds one from her, a
// shield that blocks one damage instance ([shield]: BlockDamage, FinishBuff).
// S1: ATK `atk`, ASPD attack_speed; every other lifted-off ally gains
// BLOCK_RADIUS_SCALE attack@block_radius_scale (Aura, selfOption 2). S2 (ammo
// attack@trigger_time, range y-11, manual stop): ATK `atk`; each attack fires a
// medical unit, at an enemy when there is one in range (AttackEnemy) and
// otherwise at an injured ally (HealAlly), speed 12 (projectile_chr_kalts2_s2_*).
// On impact enemies within the 1.5 radius take attack@atk_scale x ATK true
// damage and allies within it are healed attack@heal_scale x ATK; the enemy
// shot also leaves them sluggish for attack@sluggish s (its _activeBuffs).
// S3: ATK `atk`, base attack time base_attack_time, one more heal target, and
// one tactical anchor card (kalts2_s_3[token_ctrl] RechargeToken cnt). The
// anchor goes on a ranged tile outside her attack range (token description)
// and takes no damage. When it is born she flies to it (StartTransporting,
// projectile_chr_kalts2_s3_2 speed 3.5) with her skill progress locked; after
// kalts2_s_3[withdraw]'s first trigger (0.6 s) up to two operators in her y-6
// range (S3OperatorSelector, max 2) are withdrawn for free, with no redeploy
// wait, and may be deployed only inside her attack range until their next
// deployment or the end of S3. On arrival the anchor is withdrawn and she is
// moved onto its tile (MOVE_LIKE_RESPAWN_SELF, RespawnBorn) with its facing,
// keeping her HP ratio and the rest of S3; no second anchor is granted.
// Declared local mappings:
// - Talent 2 is given to operators that were not in her range on the previous
//   tick; S2 range counts as her range while S2 runs (kalts2_t_2[s2]).
// - S3 picks the two operators nearest to her; withdrawn operators get no DP
//   refund (cost_scale 0 card).
// - In flight she is hidden, untargetable and cannot act; a marker follows
//   her path. The anchor takes no deployment slot.
// - Kalts2S3ApplyPunishBuff (S3 interrupt) has no data body and is not modelled.
import evidence from '../../../data/arkpedia-native-operators/char_1052_kalts2.json' with {type: 'json'};
import review from '../../../data/arkpedia-kalts2-runtime-review.json' with {type: 'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {normalizeChess} from '../simdata.js';
import {COLS} from '../constants.js';
import {acquireTargets} from '../ai.js';
import {commandBlockMode} from '../block-mode.js';
import {canSpendDp} from './arkpedia-dp-budget.js';
import {canDeployInViewport} from '../../../shared/arkpedia/squad.js';
export const KALTS2_ID = 'char_1052_kalts2', KALTS2_ANCHOR = 'token_10068_kalts2_mtship';
export const KALTS2_SKILLS = Object.freeze(['skchr_kalts2_1', 'skchr_kalts2_2', 'skchr_kalts2_3']);
export const selectedKalts2Build = build => selectedCNSourceBuild(evidence, KALTS2_ID, build);
const ID = KALTS2_ID, TOKEN = KALTS2_ANCHOR, live = u => !!u?.alive && u.deployed && !u.hidden;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const behaviour = (key, object, field) => {
  for (const o of evidence.projectiles[key] ?? []) if (o.object === object)
    for (const c of o.components) if (c.data?.[field] != null) return c.data[field];
  throw Error(`Missing Kal'tsit·Esperanta projectile field: ${key}.${field}`);
};
const radius = key => {
  for (const o of evidence.projectiles[key] ?? []) for (const c of o.components) if (c.type === 'CircleCollider2D') return c.data.m_Radius;
  throw Error(`Missing Kal'tsit·Esperanta projectile radius: ${key}`);
};
export const KALTS2_SPLASH = radius('projectile_chr_kalts2_s2_dmg'), KALTS2_SHOT_SPEED = behaviour('projectile_chr_kalts2_s2_dmg', 'projectile_chr_kalts2_s2_dmg', '_speed');
export const KALTS2_FLIGHT_SPEED = behaviour('projectile_chr_kalts2_s3_2', 'projectile_chr_kalts2_s3_2', '_speed');
const bornActions = evidence.templates['kalts2_s_3[on_token_born]'].eventToActions.ON_BUFF_START;
export const KALTS2_WITHDRAW_DELAY = bornActions.find(a => a._buff?.buffKey === 'kalts2_s_3[withdraw]')._buff.firstTriggerInterval;
if (KALTS2_SPLASH !== 1.5 || KALTS2_SHOT_SPEED !== 12 || KALTS2_FLIGHT_SPEED !== 3.5 || Math.abs(KALTS2_WITHDRAW_DELAY - .6) > 1e-6)
  throw Error("Unreviewed Kal'tsit·Esperanta source projectile or withdraw timing");
const SELECT_RANGE = evidence.tables.ranges['y-6'].grids.map(g => [g.row, g.col]), SELECT_MAX = 2;
function reviewed(b) {
  const approved = same(review.enabledOperators, [ID]) && review.verification.browser.status === 'passed';
  const candidate = b.regularReviewCandidates?.includes(ID) && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !candidate) || review.frameParity !== false || review.moduleSupport !== false
    || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-kalts2-anchor-v1')
    throw Error("Missing Kal'tsit·Esperanta runtime review or explicit held browser candidate");
}
export function selectedKalts2Inputs(unit) {
  const skill = unit.def.skill, build = unit.def.raw.arkpedia;
  if (!skill) throw Error("Incomplete original selected Kal'tsit·Esperanta inputs");
  const s = selectedKalts2Build({...build, skillId: skill.id});
  if (unit.def.charId !== ID || !same(unit.def.stats, normalizeChess({stats: s.stats}).stats) || !same(unit.rangeGrid, s.rangeGrid)
    || !same(unit.def.talents.map(t => t.bb), s.talentBb) || !same(skill.bb, s.bb) || skill.spCost !== s.source.spData.spCost)
    throw Error("Incomplete original selected Kal'tsit·Esperanta inputs");
  return s;
}
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => u.base.bat / u.s.interval;
const talent = (u, key) => u.def.talents.find(t => t.bb[key] != null)?.bb;
const keysAround = (grid, r, c, dir) => {
  const rot = {RIGHT: (x, y) => [x, y], LEFT: (x, y) => [-x, -y], UP: (x, y) => [-y, x], DOWN: (x, y) => [y, -x]}[dir];
  return new Set(grid.map(([dr, dc]) => { const [rr, cc] = rot(dr, dc); return (r + rr) * COLS + (c + cc); }));
};
// The anchor uses its own source keyframes at her elite and level.
function anchorRecord(b, build) {
  const source = b.data.raw.tokens?.[TOKEN], phase = source?.phases?.[build.elite];
  if (!source || source.id !== TOKEN || !phase) throw Error("Missing reviewed Kal'tsit·Esperanta anchor source");
  const low = phase.attributesKeyFrames[0], high = phase.attributesKeyFrames.at(-1);
  const ratio = high.level === low.level ? 0 : (build.level - low.level) / (high.level - low.level);
  const stats = Object.fromEntries(Object.entries(low.data).filter(([, v]) => typeof v === 'number')
    .map(([k, v]) => [k, v + ((high.data[k] ?? v) - v) * ratio]));
  for (const k of ['maxHp', 'atk', 'def']) stats[k] = Math.round(stats[k]);
  return {id: TOKEN, name: source.name, profession: source.profession, subProfessionId: source.subProfessionId, position: source.position,
    stats, rangeGrid: phase.rangeGrid, dmgType: 'phys', attackKind: 'melee', canHitFly: false, abnormal: ['healFree'], talents: [], skill: null,
    arkpedia: {elite: build.elite, level: build.level, potential: build.potential}};
}
export class Kalts2Owner {
  constructor(b, u) {
    Object.assign(this, {b, u, record: selectedKalts2Inputs(u), seq: null, handles: [], inRange: new Set(), radiusBoosted: new Set(),
      anchor: null, anchorGranted: false, flight: null, moved: new Map()});
  }
  valid() { return live(this.u) && this.u.deploySeq === this.seq && this.u.mem.kalts2Owner === this; }
  n() { return this.u.skill?.active ? KALTS2_SKILLS.indexOf(this.u.skill.id) + 1 : 0; }
  rangeKeys() { if (this.b.rangeChanged(this.u)) this.b._refreshRange(this.u); return this.u.rangeKeySet; }
  operators() { return this.b.allyUnits.filter(a => live(a) && a.kind === 'op' && a !== this.u && a.ownerId === this.u.ownerId); }
  // Talent 1: lift off, FLY block mode, block and radius.
  deployed(move) {
    const {b, u} = this, t1 = talent(u, 'block_radius_scale');
    this.seq = u.deploySeq;
    if (!t1) return;
    const full = u.hp >= u.s.maxHp - 1e-9;
    b.addBuff(u, {key: 'kalts2:t1', source: u, persist: true, flags: {liftoff: true},
      mods: {hpPct: t1.max_hp, defPct: t1.def, blockCnt: t1.block_cnt, blockRadiusScale: t1.block_radius_scale}});
    if (full && !move) u.hp = u.s.maxHp;
    commandBlockMode(b, u, 'FLY', this);
  }
  // Talent 2: an operator entering her range gets regeneration and, once, a shield.
  talentTick() {
    const {b, u} = this, t2 = talent(u, 'hp_recovery_per_sec');
    if (!t2 || !this.valid() || this.flight) { this.inRange.clear(); return; }
    const keys = this.rangeKeys(), now = new Set(this.operators().filter(a => keys.has(a.tileR * COLS + a.tileC)));
    for (const a of now) {
      if (this.inRange.has(a)) continue;
      const rhodes = a.def.tags?.includes('rhodes');
      b.addBuff(a, {key: `kalts2:t2:regen:${u.id}`, source: u, duration: t2.buff_duration, refresh: 'replace',
        mods: {hpRegen: t2.hp_recovery_per_sec * (rhodes ? t2.rhodes_bonus : 1)}});
      if (!a.findBuff(`kalts2:t2:shield:${u.id}`)) b.addBuff(a, {key: `kalts2:t2:shield:${u.id}`, source: u, shieldHits: 1});
    }
    this.inRange = now;
  }
  // S1: every other lifted-off ally blocks over a wider radius.
  s1Tick() {
    const {b, u} = this, key = `kalts2:s1:radius:${u.id}`, on = this.valid() && this.n() === 1;
    const want = on ? new Set(this.operators().filter(a => a.s.flags.liftoff)) : new Set();
    for (const a of [...this.radiusBoosted]) if (!want.has(a) || !live(a)) { if (a.alive) b.removeBuff(a, key); this.radiusBoosted.delete(a); }
    for (const a of want) if (!this.radiusBoosted.has(a)) {
      b.addBuff(a, {key, source: u, mods: {blockRadiusScale: u.skill.bb['attack@block_radius_scale']}}); this.radiusBoosted.add(a);
    }
  }
  // S2: one medical unit per attack; both halves resolve around the impact.
  s2Shot(t) {
    const {b, u} = this, bb = u.skill.bb, atk = u.s.atk, enemyShot = t.side === 'enemy';
    b.addProjectile({from: u, target: t, speed: KALTS2_SHOT_SPEED, source: u, visual: 'orb', hitDead: true, data: {arkpediaTrackedVisual: true},
      onHit: ({x, y}) => {
        for (const e of b.enemiesInRadius(x, y, KALTS2_SPLASH, true).filter(live)) {
          b.dealDamage(u, e, {amount: atk * bb['attack@atk_scale'], type: 'true', applyWay: 'ranged', isSkill: true, tags: ['kalts2', 'kalts2:s2']});
          if (enemyShot && e.alive) b.applyStatus(e, 'sluggish', {source: u, duration: bb['attack@sluggish']});
        }
        for (const a of b.alliesInRadius(x, y, KALTS2_SPLASH, u.ownerId)) b.heal(u, a, atk * bb['attack@heal_scale'], {tags: ['kalts2:s2']});
      }});
    return true;
  }
  // S3 anchor card (Closure-style deck).
  installDeck() {
    const {b, u} = this, key = `summon:${ID}`, owner = this;
    b.regularSummons ??= new Map();
    const state = {key, ownerId: ID, tokenId: TOKEN, owner: u, record: anchorRecord(b, u.def.raw.arkpedia),
      config: {tokenId: TOKEN, chooseFacing: true, deploymentSlotCost: 0, refundRatio: 0, healFree: true},
      get stock() { return owner.anchorGranted && !owner.anchor && !owner.flight && owner.n() === 3 ? 1 : 0; },
      get readyAt() { return 0; },
      deck: {own: () => (live(owner.anchor) ? [owner.anchor] : []), placementError: (r, c) => owner.anchorError(r, c),
        place: (r, c, dir) => owner.placeAnchor(r, c, dir),
        retreat: () => { throw Error('The tactical anchor cannot be retreated.'); }}};
    b.regularSummons.set(key, state); this.deckState = state;
  }
  anchorError(r, c) {
    const {b, u} = this, state = this.deckState;
    if (!canDeployInViewport(b.viewport)) return 'Open the fullscreen workspace to deploy.';
    if (b.finished) return 'Battle has ended.';
    if (!this.valid() || state.stock <= 0) return "Activate Kal'tsit·Esperanta's S3 first.";
    if (!Number.isInteger(r) || !Number.isInteger(c) || !b.grid.inRect(r, c)) return 'Select a tile on the map.';
    if (!['RANGED', 'ALL'].includes(b.grid.tile(r, c).build)) return 'Choose a high-ground tile.';
    if (b.unitAt(r, c) || b.tileReservation(r, c) || b.downOn(r, c)) return 'Tile is occupied.';
    if (this.rangeKeys().has(r * COLS + c)) return "Choose a tile outside Kal'tsit·Esperanta's attack range.";
    if (!canSpendDp(b, u.ownerId, state.record.stats.cost)) return 'Not enough DP.';
    return null;
  }
  placeAnchor(r, c, dir = 'RIGHT') {
    const error = this.anchorError(r, c); if (error) throw Error(error);
    const {b, u} = this, state = this.deckState;
    const t = b.spawnToken(u, TOKEN, r, c, {dir, def: state.record, kit: {talents: [], skill: null, trait: {noAttack: true, canAttack: () => false},
      install: (battle, token) => {
        token.deploymentSlotCost = 0;
        battle.addBuff(token, {key: 'kalts2:anchor', persist: true, allowDead: true, flags: {healFree: true, untargetable: true, invulnerable: true}});
      }}});
    if (!t) throw Error('Tactical anchor placement failed.');
    t.deploymentSlotCost = 0; t.mem.regularSummonCard = state.key;
    b.getPlayer(u.ownerId).dp -= state.record.stats.cost;
    this.anchor = t; this.anchorGranted = false;
    this.depart(t);
    return t;
  }
  // StartTransporting: lock S3, pick two operators, fly to the anchor.
  depart(t) {
    const {b, u} = this, from = {x: u.x, y: u.y}, dist = Math.hypot(t.x - u.x, t.y - u.y);
    (u.skill.timerHolds ??= new Set()).add(this);
    const keys = keysAround(SELECT_RANGE, u.tileR, u.tileC, u.dir);
    const picked = this.operators().filter(a => keys.has(a.tileR * COLS + a.tileC) && this.b.bench[a.defId]?.unit === a)
      .sort((p, q) => Math.hypot(p.x - u.x, p.y - u.y) - Math.hypot(q.x - u.x, q.y - u.y) || p.deploySeq - q.deploySeq).slice(0, SELECT_MAX);
    const marker = {x: from.x, y: from.y, color: 0x9be7ff};
    (b.regularVisualProjectiles ??= new Set()).add(marker);
    b.releaseBlocked(u);
    b.addBuff(u, {key: 'kalts2:flight', source: u, flags: {untargetable: true, invulnerable: true, disarm: true, noBlock: true}});
    u.mem.regularHidden = true;
    this.flight = {from, to: t, start: b.time, until: b.time + dist / KALTS2_FLIGHT_SPEED, marker, withdrawAt: b.time + KALTS2_WITHDRAW_DELAY, picked};
  }
  flightTick() {
    const {b, u} = this, f = this.flight;
    if (!f) return;
    const k = f.until > f.start ? Math.min(1, (b.time - f.start) / (f.until - f.start)) : 1;
    f.marker.x = f.from.x + (f.to.x - f.from.x) * k; f.marker.y = f.from.y + (f.to.y - f.from.y) * k;
    if (f.picked && b.time + 1e-9 >= f.withdrawAt) { this.withdraw(f.picked); f.picked = null; }
    if (b.time + 1e-9 >= f.until) this.land();
  }
  // kalts2_s_3[withdraw]: free, immediate redeploy into her range.
  withdraw(list) {
    const {b, u} = this;
    if (!live(u) || this.n() !== 3) return;
    for (const a of list) {
      const entry = b.bench[a.defId];
      if (!live(a) || entry?.unit !== a) continue;
      b.retreat(a, {permanent: true, reason: 'kalts2-transport'});
      entry.readyAt = b.time; entry.costDelta = -Infinity;
      this.moved.set(a.defId, entry);
    }
    this.syncDeny();
  }
  syncDeny() {
    const {b} = this;
    b.regularPlacementDeny ??= {};
    for (const [id, entry] of [...this.moved]) {
      if (entry.unit?.alive || this.n() !== 3 || !this.valid() && !this.flight) {
        this.moved.delete(id); if (b.regularPlacementDeny[id]?.owner === this) delete b.regularPlacementDeny[id];
        continue;
      }
      if (b.regularPlacementDeny[id]?.owner === this) continue;
      const deny = (r, c) => this.flight ? "Wait for Kal'tsit·Esperanta to land."
        : this.rangeKeys().has(r * COLS + c) ? null : "Choose a tile inside Kal'tsit·Esperanta's attack range.";
      deny.owner = this; b.regularPlacementDeny[id] = deny;
    }
  }
  land() {
    const {b, u} = this, f = this.flight, t = f.to;
    this.flight = null; b.regularVisualProjectiles?.delete(f.marker);
    if (f.picked) { this.withdraw(f.picked); f.picked = null; }
    const r = t.tileR, c = t.tileC, dir = t.dir;
    if (t.alive) b.retreat(t, {permanent: true, reason: 'kalts2-landed'});
    this.anchor = null;
    b.removeBuff(u, 'kalts2:flight'); u.mem.regularHidden = false; u.skill.timerHolds?.delete(this);
    if (!u.alive) return;
    const oldDir = u.dir; u.dir = dir;
    if (!b.moveRedeploy(u, r, c, {clearSp: true})) u.dir = oldDir;
    this.syncDeny();
  }
  endS3() {
    const {b, u} = this;
    this.anchorGranted = false;
    if (this.flight) { b.regularVisualProjectiles?.delete(this.flight.marker); this.flight = null; b.removeBuff(u, 'kalts2:flight'); u.mem.regularHidden = false; u.skill?.timerHolds?.delete(this); }
    if (this.anchor?.alive) b.retreat(this.anchor, {permanent: true, reason: 'kalts2-s3-end'});
    this.anchor = null;
    this.syncDeny();
  }
  install() {
    const {b, u} = this;
    u.mem.kalts2Owner = this;
    if (this.record.build.skillId === KALTS2_SKILLS[2]) this.installDeck();
    this.handles = [
      b.on('deploy', ({unit, move}) => { if (unit === u) this.deployed(move); if (this.moved.has(unit?.defId)) this.syncDeny(); }, {owner: u}),
      b.on('tick', () => { this.flightTick(); this.talentTick(); this.s1Tick(); if (this.moved.size) this.syncDeny(); }, {owner: u}),
      b.on('death', ({unit}) => { if (unit === u) this.stop(); }, {owner: u}),
      b.on('battleEnd', () => this.stop(), {owner: u}),
    ];
  }
  stop() {
    this.endS3(); this.s1Tick();
    if (this.deckState && this.b.regularSummons?.get(this.deckState.key) === this.deckState) this.b.regularSummons.delete(this.deckState.key);
  }
}
export function customizeKalts2Kit({battle: b, id, unit: u, kit}) {
  if (id !== ID) return;
  reviewed(b);
  if (!KALTS2_SKILLS.includes(u.def.skill?.id)) throw Error("Missing original selected Kal'tsit·Esperanta skill");
  const owner = new Kalts2Owner(b, u), s = u.def.skill, n = KALTS2_SKILLS.indexOf(s.id) + 1;
  u.mem.kalts2Prepared = owner;
  kit.talents = [];
  const clip = name => ({windup: (_b, a) => model(a).hits[name][0] / rate(a), attackVisual: () => name});
  kit.trait = {...kit.trait, dmgType: 'heal', heal: {mode: 'single'}, attack: 'ranged', ...clip('Attack_Loop'),
    canAttack: (bb, a) => !bb.isUnitInBornState(a) && !owner.flight};
  const pose = (idle, attack) => ({onStart: () => { u.mem.regularFormVisual = {clip: idle, loop: true, attack}; }, onEnd: () => { u.mem.regularFormVisual = null; }});
  if (n === 1) kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration, mods: {atkPct: s.bb.atk, aspd: s.bb.attack_speed}};
  else if (n === 2) {
    const heal = {...kit.trait, dmgType: 'heal', heal: {mode: 'single'}, acquireTargets: undefined};
    const strike = {...kit.trait, dmgType: 'true', heal: null, acquireTargets: undefined};
    const p = pose('Skill_2_Idle', 'Skill_2_Attack');
    kit.skill = {id: s.id, name: s.name, kind: 'ammo', ammo: s.bb['attack@trigger_time'], duration: 0, trigger: 'NEVER', manualCancel: true,
      mods: {atkPct: s.bb.atk}, targeting: {rangeGrid: owner.record.skillRangeGrid},
      attack: {dmgType: 'true', heal: null, requiresAcceptedLaunch: true, ...clip('Skill_2_Attack'),
        // AttackEnemy first; HealAlly when no enemy is in range.
        acquireTargets: (bb, a, prof) => {
          const enemies = acquireTargets(bb, a, {...prof, ...strike, rangeGrid: prof.rangeGrid});
          return enemies.length ? enemies.slice(0, 1) : acquireTargets(bb, a, {...prof, ...heal, rangeGrid: prof.rangeGrid}).slice(0, 1);
        },
        launchAttack: (_b, _a, _prof, t) => owner.s2Shot(t)},
      onStart: p.onStart, onEnd: p.onEnd};
  } else {
    const p = pose('Skill_3_Idle', 'Skill_3_Attack');
    kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration, mods: {atkPct: s.bb.atk, batFlat: s.bb.base_attack_time},
      targeting: {maxTargets: 2}, attack: {...clip('Skill_3_Attack')},
      onStart: () => { p.onStart(); owner.anchorGranted = true; }, onEnd: () => { p.onEnd(); owner.endS3(); }};
  }
}
export function installKalts2({battle: b, unit: u, def}) {
  if (def.charId !== ID) return;
  reviewed(b);
  const owner = u.mem.kalts2Prepared;
  if (!owner) throw Error("Missing selected Kal'tsit·Esperanta owner");
  delete u.mem.kalts2Prepared; owner.install();
}
