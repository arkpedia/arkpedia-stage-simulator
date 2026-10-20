// SPDX-License-Identifier: GPL-3.0-or-later
// Nasti (char_4212_nasti), Artificer Supporter, and her devices, one per
// selected skill (overrideTokenKey): token_10059_nasti_nstdef (S1),
// token_10060_nasti_nstchr (S2) and token_10061_nasti_nstbld (S3).
// Source: data/arkpedia-native-operators/char_4212_nasti.json.
//
// From data: talent 1: `cnt` devices, at most the token's maxDeployCount on
// the field. Talent 2 (nasti_t2): Sanctuary nasti_t2[res].damage_resistance;
// once a ranged enemy has appeared, Sanctuary nasti_t2[res_plus] for her and
// the operators on high ground, and she gains 1 SP every
// nasti_t2[add_sp].interval s. Every device faces the operator on its front
// tile (its 1-1 range).
// S1 (40 s): ATK `atk`, DEF `def`, she attacks every blocked enemy; the
// inspector's talent gives the front operator DEF `def`; during S1 it gives
// block +talent@block_cnt and DEF talent@def instead and loses talent@hp_ratio
// of its max HP a second (sktok_nasti_nstdef). One more device at the start.
// S2 (4 s): she stops attacking and gains a barrier of
// nasti_s2[update_shield].shield_each_hp_rate x max HP every 0.5 s up to
// shield_max_hp_rate; supervisors on the field are activated: every
// talent@interval s each loses talent@hp HP and gives the front operator
// talent@sp SP (not while its skill is active) and a barrier of
// talent@shield_each_hp_rate x her max HP up to talent@shield_max_hp_rate.
// Activated supervisors leave when S2 ends. A supervisor has the fixed max HP
// init_max_hp, deploys with init_hp and recovers `value` HP each time its own
// skill fills (sktok_nasti_nstchr). One more device when S2 ends.
// S3 (15 s): ATK `atk`, DEF `def`, one more device at the start. An engineer
// device spawns the platform (mode 3) on the deployable ground tile in front
// of it when none exists (nasti_nstbld[create_m3]); each second an engineer
// gives the platform in front m1_sp SP (m2_sp while her skill is active) and,
// while it is hurt, heals it hp_ratio x its max HP at a cost of
// hp_ratio x cnt of its own. At full SP the platform upgrades (modes 4-6):
// from mode 4 it blocks one enemy, its tile takes one ranged operator, who
// gains the m4/m5/m6_bonus max HP and ATK (TileAuraBuff 0-1); modes 5 and 6
// add the attribute_up max HP, DEF and RES; mode 6 stays when she leaves.
// When the platform falls, the operator on it leaves (ClearCharacterOnTileIfExists).
// Declared local mappings:
// - Engineers and the inspector/supervisor are untargetable and take no damage;
//   the platform can be attacked.
// - The platform's levels are drawn with a marker (its idle clip is empty);
//   the operator on it is drawn at tile height.
// - The operator on a fallen platform is retreated with its normal redeploy time.
import evidence from '../../../data/arkpedia-native-operators/char_4212_nasti.json' with {type: 'json'};
import review from '../../../data/arkpedia-nasti-runtime-review.json' with {type: 'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {normalizeChess} from '../simdata.js';
import {COLS} from '../constants.js';
import {STATUS} from '../buffs.js';
import {absoluteRangeKeys} from '../targeting.js';
export const NASTI_ID = 'char_4212_nasti';
export const NASTI_SKILLS = Object.freeze(['skchr_nasti_1', 'skchr_nasti_2', 'skchr_nasti_3']);
export const NASTI_DEVICES = Object.freeze(evidence.tables.character.skills.map(s => s.overrideTokenKey));
export const selectedNastiBuild = build => selectedCNSourceBuild(evidence, NASTI_ID, build);
const ID = NASTI_ID, [DEF, CHR, BLD] = NASTI_DEVICES, live = u => !!u?.alive && u.deployed && !u.hidden;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const bbOf = rows => Object.fromEntries(rows.map(r => [r.key, r.value]));
const SKILL_OF = Object.freeze({token_10059_nasti_nstdef: 'sktok_nasti_nstdef', token_10060_nasti_nstchr: 'sktok_nasti_nstchr', token_10061_nasti_nstbld: 'sktok_nasti_nstbld'});
const tokenSkill = (id, rank) => bbOf(evidence.tables.tokenSkills[SKILL_OF[id]].levels[rank - 1].blackboard);
const tokenTalent = (id, elite, key) => {
  const rows = evidence.tables.tokens[id].talents.flatMap(t => t.candidates)
    .filter(c => Number(c.unlockCondition.phase.at(-1)) <= elite && c.blackboard.some(r => r.key === key));
  return rows.length ? bbOf(rows.at(-1).blackboard) : null;
};
if (!same(NASTI_DEVICES, ['token_10059_nasti_nstdef', 'token_10060_nasti_nstchr', 'token_10061_nasti_nstbld']))
  throw Error('Unreviewed Nasti device tokens');
function reviewed(b) {
  const approved = same(review.enabledOperators, [ID]) && review.verification.browser.status === 'passed';
  const candidate = b.regularReviewCandidates?.includes(ID) && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !candidate) || review.frameParity !== false || review.moduleSupport !== false
    || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-nasti-devices-v1')
    throw Error('Missing Nasti runtime review or explicit held browser candidate');
}
export function selectedNastiInputs(unit) {
  const skill = unit.def.skill, build = unit.def.raw.arkpedia;
  if (!skill) throw Error('Incomplete original selected Nasti inputs');
  const s = selectedNastiBuild({...build, skillId: skill.id});
  if (unit.def.charId !== ID || !same(unit.def.stats, normalizeChess({stats: s.stats}).stats) || !same(unit.rangeGrid, s.rangeGrid)
    || !same(unit.def.talents.map(t => t.bb), s.talentBb) || !same(skill.bb, s.bb) || skill.spCost !== s.source.spData.spCost)
    throw Error('Incomplete original selected Nasti inputs');
  return s;
}
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => u.base.bat / u.s.interval;
const talent = (u, key) => u.def.talents.find(t => t.bb[key] != null)?.bb;
const FRONT = [[0, 1]];
export class NastiOwner {
  constructor(b, u) {
    Object.assign(this, {b, u, record: selectedNastiInputs(u), seq: null, handles: [], rangedSeen: false, nextSp: 0, protect: new Set(),
      platform: null, active: new Set(), nextTick: 0, marker: null});
    const build = this.record.build;
    this.rank = build.skillRank; this.elite = build.elite;
  }
  valid() { return live(this.u) && this.u.deploySeq === this.seq && this.u.mem.nastiOwner === this; }
  n() { return this.u.skill?.active ? NASTI_SKILLS.indexOf(this.u.skill.id) + 1 : 0; }
  state() { return this.b.regularSummons?.get(`summon:${ID}`); }
  devices(id) { return this.b.allyUnits.filter(t => live(t) && t.ownerUnit === this.u && t.defId === id && !t.mem.nastiPlatform); }
  frontTile(t) { const k = absoluteRangeKeys(FRONT, t.tileR, t.tileC, t.dir)[0]; return k == null ? null : [Math.floor(k / COLS), k % COLS]; }
  // The operator on a tile (a platform's guest counts).
  opAt(r, c) { return this.b.allyUnits.find(a => live(a) && a.kind === 'op' && a.tileR === r && a.tileC === c) ?? null; }
  frontOp(t) { const f = this.frontTile(t); return f && this.opAt(...f); }
  // Talent 2.
  talentTick(dt) {
    const {b, u} = this, t2 = talent(u, 'nasti_t2[res].damage_resistance');
    if (!t2) return;
    if (!this.rangedSeen && b.enemies.some(e => e.alive && String(e.def?.applyWay ?? '').toUpperCase() === 'RANGED')) {
      this.rangedSeen = true; this.nextSp = b.time + t2['nasti_t2[add_sp].interval'];
    }
    const value = this.rangedSeen ? t2['nasti_t2[res_plus].damage_resistance'] : t2['nasti_t2[res].damage_resistance'];
    const want = new Set(this.valid() ? [u, ...(this.rangedSeen ? b.allyUnits.filter(a => live(a) && a.kind === 'op' && !a.ground) : [])] : []);
    const key = `nasti:t2:${u.id}`;
    for (const a of [...this.protect]) if (!want.has(a)) { if (a.alive) b.removeBuff(a, key); this.protect.delete(a); }
    for (const a of want) {
      const old = a.findBuff(key);
      if (!old || old.data?.value !== value) { b.addBuff(a, {key, source: u, status: 'sanctuary', data: {value}, mods: STATUS.sanctuary.mods(value)}); this.protect.add(a); }
    }
    if (this.rangedSeen && this.valid() && b.time + 1e-9 >= this.nextSp) {
      this.nextSp += t2['nasti_t2[add_sp].interval'];
      if (!u.skill.active && u.skill.sp < u.skill.spCost) u.skill.gainSp(1, 'nasti:t2');
    }
    void dt;
  }
  // S1 inspector: front operator DEF; during S1 block and more DEF, and the device decays.
  inspectorTick(dt) {
    const {b, u} = this, s1 = this.n() === 1, sk = tokenSkill(DEF, this.rank), t = tokenTalent(DEF, this.elite, 'def');
    for (const d of this.devices(DEF)) {
      const op = this.frontOp(d), key = `nasti:inspector:${d.id}`, mods = s1 ? {defPct: sk['talent@def'], blockCnt: sk['talent@block_cnt']} : {defPct: t?.def ?? 0};
      if (d.mem.nastiFront && d.mem.nastiFront !== op && d.mem.nastiFront.alive) b.removeBuff(d.mem.nastiFront, key);
      d.mem.nastiFront = op;
      if (op && !same(op.findBuff(key)?.mods, mods)) b.addBuff(op, {key, source: d, mods});
      // nasti_nstdef_t[self_damage]: direct HP loss while S1 runs.
      if (s1) { d.hp = Math.max(0, d.hp - d.s.maxHp * sk['talent@hp_ratio'] * dt); if (d.hp <= 0) b.retreat(d, {permanent: true, reason: 'nasti-inspector-spent'}); }
    }
  }
  // S2 supervisors.
  supervisorTick(dt) {
    const {b, u} = this, sk = tokenSkill(CHR, this.rank);
    for (const d of this.devices(CHR)) {
      if (this.active.has(d)) {
        d.mem.nastiNext ??= b.time + sk['talent@interval'];
        if (b.time + 1e-9 < d.mem.nastiNext) continue;
        d.mem.nastiNext += sk['talent@interval'];
        d.hp = Math.max(0, d.hp - sk['talent@hp']);
        const op = this.frontOp(d);
        if (op) {
          if (!op.skill?.active) op.skill?.gainSp(sk['talent@sp'], 'nasti:supervisor');
          const key = `nasti:supervisor:shield:${u.id}`, cap = u.s.maxHp * sk['talent@shield_max_hp_rate'];
          const cur = op.findBuff(key)?.shield ?? 0;
          b.addBuff(op, {key, source: u, shield: Math.min(cap, cur + u.s.maxHp * sk['talent@shield_each_hp_rate'])});
        }
        if (d.hp <= 0) b.retreat(d, {permanent: true, reason: 'nasti-supervisor-spent'});
      } else {
        // Its own skill: `value` HP each time it fills.
        d.mem.nastiSp = (d.mem.nastiSp ?? 0) + dt * (evidence.tables.tokenSkills.sktok_nasti_nstchr.levels[this.rank - 1].spData.increment);
        const cost = evidence.tables.tokenSkills.sktok_nasti_nstchr.levels[this.rank - 1].spData.spCost;
        if (d.mem.nastiSp + 1e-9 >= cost) { d.mem.nastiSp = 0; d.hp = Math.min(d.s.maxHp, d.hp + sk.value); }
      }
    }
  }
  s2Start() { for (const d of this.devices(CHR)) { this.active.add(d); d.mem.nastiNext = this.b.time + tokenSkill(CHR, this.rank)['talent@interval']; } }
  s2End() { for (const d of this.active) if (live(d)) this.b.retreat(d, {permanent: true, reason: 'nasti-s2-end'}); this.active.clear(); }
  // S3 engineers and the platform.
  engineerTick() {
    const {b} = this, p = this.platform, skill = this.n() > 0;
    const tal = tokenTalent(BLD, this.elite, 'm1_sp');
    for (const d of this.devices(BLD)) {
      const f = this.frontTile(d);
      if (!f || !live(p) || p.tileR !== f[0] || p.tileC !== f[1] || !tal) continue;
      if (p.mem.nastiLevel < 6) {
        p.mem.nastiSp += skill ? tal.m2_sp : tal.m1_sp;
        if (p.mem.nastiSp + 1e-9 >= p.mem.nastiSpCost) this.upgrade(p);
      }
      const ratio = skill ? tal['nasti_nstbld_m2[heal_m456].hp_ratio'] : tal['nasti_nstbld_m1[heal_m456].hp_ratio'];
      const cnt = skill ? tal['nasti_nstbld_m2[heal_m456].cnt'] : tal['nasti_nstbld_m1[heal_m456].cnt'];
      if (p.hp < p.s.maxHp - 1e-9) {
        p.hp = Math.min(p.s.maxHp, p.hp + p.s.maxHp * ratio);
        d.hp = Math.max(0, d.hp - d.s.maxHp * ratio * cnt);
        if (d.hp <= 0) b.retreat(d, {permanent: true, reason: 'nasti-engineer-spent'});
      }
    }
  }
  spawnPlatform(d) {
    const {b, u} = this, state = this.state(), f = this.frontTile(d);
    if (live(this.platform) || !f || !b.grid.inRect(...f)) return null;
    const tile = b.grid.tile(...f);
    if (tile.build !== 'MELEE' && tile.build !== 'ALL' || b.unitAt(...f) || b.tileReservation(...f)) return null;
    const p = b.spawnToken(u, BLD, f[0], f[1], {dir: d.dir, def: state.record, kit: {skill: null, talents: [], trait: {noAttack: true, canAttack: () => false},
      install: (battle, t) => { battle.addBuff(t, {key: 'nasti:platform', persist: true, allowDead: true, flags: {healFree: true}}); }}});
    if (!p) return null;
    p.kind = 'device'; p.deploymentSlotCost = 0; p.mem.regularSummonCard = state.key;
    p.mem.nastiPlatform = true; p.mem.nastiLevel = 3; p.mem.nastiSp = 0;
    p.mem.nastiSpCost = evidence.tables.tokenSkills.sktok_nasti_nstbld.levels[this.rank - 1].spData.spCost;
    p.base.blockCnt = 0; p.markDirty();
    p.mem.regularFormVisual = {clip: 'Idle_4', loop: true};
    this.platform = p;
    (b.regularVisualProjectiles ??= new Set()).add(this.marker = {x: p.x, y: p.y, color: 0xc9a46a});
    return p;
  }
  upgrade(p) {
    const {b} = this, sk = tokenSkill(BLD, this.rank), next = p.mem.nastiLevel + 1, k = p.tileR * COLS + p.tileC;
    p.mem.nastiLevel = next; p.mem.nastiSp = 0;
    if (next === 4) {
      p.base.blockCnt = 1; p.markDirty();
      (b._elevated ??= new Set()).add(k);
      p.mem.regularHost = {guest: null, accepts: g => !p.mem.regularHost.guest && live(p) && (g.def?.position ?? b.data.getChess(g.defId)?.position) === 'RANGED' && (g.kind ?? 'op') === 'op'};
    }
    if (next >= 5) {
      const up = n => ({hpFlat: sk[`attack@nasti_nstbld_m${n}[attribute_up].max_hp`], defFlat: sk[`attack@nasti_nstbld_m${n}[attribute_up].def`], resFlat: sk[`attack@nasti_nstbld_m${n}[attribute_up].magic_resistance`]});
      const before = p.s.maxHp;
      b.addBuff(p, {key: 'nasti:platform:up', persist: true, mods: up(next)});
      p.hp += p.s.maxHp - before;
    }
    if (next === 6) p.mem.regularKeepOnOwnerRemoved = true;
  }
  platformTick() {
    const {b} = this, p = this.platform;
    if (!p) return;
    if (!live(p)) { this.platformGone(); return; }
    if (this.marker) { this.marker.x = p.x; this.marker.y = p.y; this.marker.color = [0xc9a46a, 0xe8c27a, 0xf0d890, 0xfff0b0][p.mem.nastiLevel - 3]; }
    const guest = p.mem.regularHost?.guest, key = `nasti:platform:bonus:${p.id}`, sk = tokenSkill(BLD, this.rank), lv = p.mem.nastiLevel;
    if (guest && live(guest) && lv >= 4) {
      const mods = {hpPct: sk[`attack@nasti_nstbld[m${lv}_bonus].max_hp`], atkPct: sk[`attack@nasti_nstbld[m${lv}_bonus].atk`]};
      if (!same(guest.findBuff(key)?.mods, mods)) b.addBuff(guest, {key, source: p, mods});
    }
  }
  platformGone() {
    const {b} = this, p = this.platform;
    this.platform = null;
    if (this.marker) { b.regularVisualProjectiles?.delete(this.marker); this.marker = null; }
    b._elevated?.delete(p.tileR * COLS + p.tileC);
    const guest = p.mem.regularHost?.guest;
    if (guest && live(guest)) b.retreat(guest, {reason: 'nasti-platform-lost'});
    if (p.mem.regularHost) p.mem.regularHost.guest = null;
  }
  install() {
    const {b, u} = this;
    u.mem.nastiOwner = this;
    const prevBuild = b.regularTileBuild;
    b.regularTileBuild = (r, c) => {
      const p = this.platform;
      if (live(p) && p.mem.nastiLevel >= 4 && p.tileR === r && p.tileC === c) return 'RANGED';
      return prevBuild?.(r, c) ?? null;
    };
    this.handles = [
      b.on('deploy', ({unit, move}) => {
        if (unit === u) { if (!move) { this.seq = u.deploySeq; } return; }
        if (unit?.ownerUnit === u && unit.defId === BLD && !unit.mem.nastiPlatform && !live(this.platform)) this.spawnPlatform(unit);
      }, {owner: u}),
      b.on('tick', ({dt}) => {
        const step = dt ?? b.dt;
        this.talentTick(step); this.inspectorTick(step); this.supervisorTick(step); this.platformTick();
        if (b.time + 1e-9 >= this.nextTick) { this.nextTick = b.time + 1; this.engineerTick(); }
      }, {owner: u}),
      b.on('skillStart', ({unit}) => {
        if (unit !== u) return;
        const s = this.state();
        if (s && this.n() !== 2) s.stock += 1;
        if (this.n() === 2) this.s2Start();
      }, {owner: u}),
      b.on('skillEnd', ({unit}) => {
        if (unit !== u || u.skill.id !== NASTI_SKILLS[1]) return;
        this.s2End();
        const s = this.state(); if (s) s.stock += 1;
      }, {owner: u}),
      b.on('death', ({unit}) => {
        if (unit === u) { for (const a of [...this.protect]) if (a.alive) b.removeBuff(a, `nasti:t2:${u.id}`); this.protect.clear(); }
        if (unit === this.platform) this.platformGone();
      }),
      b.on('battleEnd', () => { this.protect.clear(); }, {owner: u}),
    ];
  }
}
// Device factory: inspector, supervisor or engineer.
export function createNastiDevice(b, state, row, col, dir) {
  const u = state.owner, owner = u.mem.nastiOwner, id = state.record.id;
  if (!owner || !NASTI_DEVICES.includes(id)) throw Error('Missing reviewed Nasti device owner');
  const kit = {skill: null, talents: [], trait: {noAttack: true, canAttack: () => false},
    install: (battle, t) => {
      battle.addBuff(t, {key: 'nasti:device-free', source: t, persist: true, allowDead: true, flags: {invulnerable: true, untargetable: true, healFree: true}});
      if (id === CHR) {
        const blood = tokenTalent(CHR, owner.elite, 'init_max_hp');
        t.base.maxHp = blood.init_max_hp; t.markDirty();
        battle.on('deploy', ({unit}) => { if (unit === t) t.hp = blood.init_hp; }, {owner: t});
      }
      t.mem.regularFormVisual = {clip: id === DEF ? 'Idle' : 'Idle_1', loop: true};
    }};
  const t = b.spawnToken(u, id, row, col, {dir, def: state.record, kit});
  if (t) { t.kind = 'device'; t.deploymentSlotCost = 0; }
  return t;
}
export function customizeNastiKit({battle: b, id, unit: u, kit}) {
  if (id !== ID) return;
  reviewed(b);
  if (!NASTI_SKILLS.includes(u.def.skill?.id)) throw Error('Missing original selected Nasti skill');
  const owner = new NastiOwner(b, u), s = u.def.skill, n = NASTI_SKILLS.indexOf(s.id) + 1;
  u.mem.nastiPrepared = owner;
  kit.talents = [];
  kit.trait = {...kit.trait, dmgType: 'phys', attack: 'melee', windup: (_b, a) => model(a).hits?.Attack?.[0] / rate(a) || 0, attackVisual: () => 'Attack'};
  if (n === 1) kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration, mods: {atkPct: s.bb.atk, defPct: s.bb.def},
    attack: {hitAllBlocked: true}};
  else if (n === 2) {
    const bb = s.bb, key = `nasti:s2:shield:${u.id}`;
    kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration,
      attack: {noAttack: true},
      onStart: () => {
        u.mem.regularFormVisual = {clip: 'Skill_2_Idle', loop: true};
        let next = b.time;
        u.mem.nastiShieldTick = () => {
          if (!u.skill.active || b.time + 1e-9 < next) return;
          next += bb['attack@nasti_s2[update_shield].interval'];
          const cap = u.s.maxHp * bb['attack@nasti_s2[update_shield].shield_max_hp_rate'], cur = u.findBuff(key)?.shield ?? 0;
          b.addBuff(u, {key, source: u, shield: Math.min(cap, cur + u.s.maxHp * bb['attack@nasti_s2[update_shield].shield_each_hp_rate'])});
        };
      },
      onTick: () => u.mem.nastiShieldTick?.(),
      onEnd: () => { u.mem.regularFormVisual = null; delete u.mem.nastiShieldTick; }};
  } else kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration, mods: {atkPct: s.bb.atk, defPct: s.bb.def},
    onStart: () => { u.mem.regularFormVisual = {clip: 'Skill_3_Idle', loop: true, attack: 'Skill_3_Loop'}; },
    onEnd: () => { u.mem.regularFormVisual = null; }};
}
export function installNasti({battle: b, unit: u, def}) {
  if (def.charId !== ID) return;
  reviewed(b);
  const owner = u.mem.nastiPrepared;
  if (!owner) throw Error('Missing selected Nasti owner');
  delete u.mem.nastiPrepared; owner.install();
}
