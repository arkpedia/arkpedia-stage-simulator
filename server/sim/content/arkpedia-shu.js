// SPDX-License-Identifier: GPL-3.0-or-later
// Original source records remain held; the complete skill bridge/public review
// must be completed separately before enabling Shu in regular battles.
import evidence from '../../../data/arkpedia-shu-prefabs.json' with { type: 'json' };
import { sourceCandidate } from '../../../shared/arkpedia/summons.js';
import { normalizeChess, flattenBlackboard as flat } from '../simdata.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { makeDamageInfo } from '../damage.js';

export const SHU_ID = 'char_2025_shu';
export const SHU_CORE_CONTRACT = Object.freeze({
  scope: 'Selected source build, ordinary Physical attack, Sowing tile regeneration/Sanctuary and both talents',
  mapping: 'Original facing attack hit clock, one ground target, heal-output cross Sowing, nonstacking tile recipients and source-derived removal; deployed class counts and independent Sui squad count with per-recipient SP clocks.',
  limits: 'Three active skills and teleport remain held. Compiled selectors, tile-listener timing, aura attachment, deck-buff dispatch and animation/callback ordering use bounded local mappings, not certified Unity frame parity. Modules and native particles/shaders/audio are unsupported.',
  frameParity: false,
});
const ID = SHU_ID, character = evidence.tables.character;
const skills = [1, 2, 3].map(n => `skchr_shu_${n}`);
const present = u => u?.alive && u.deployed && !u._removing;
const live = u => present(u) && !u.hidden;
const due = (b, t) => b.time + 1e-9 >= t;
const same = (a, z) => JSON.stringify(a) === JSON.stringify(z);
const grid = id => id ? evidence.tables.ranges[id].grids.map(g => [g.row, g.col]) : [];
const tags = [...new Set([character, character.mainPower, ...(character.subPower ?? [])].filter(Boolean)
  .flatMap(p => ['nationId', 'groupId', 'teamId'].map(k => p[k])).filter(v => typeof v === 'string' && v))];
const components = Object.values(evidence.characters).flat().flatMap(r => r.components);
export const shuSourceComponent = id => components.find(c => c.pathId === id)?.data;
const interpolate = (frames, level) => {
  const lo = frames[0], hi = frames.at(-1), t = hi.level === lo.level ? 0 : (level - lo.level) / (hi.level - lo.level);
  return Object.fromEntries(Object.entries(lo.data).filter(([, v]) => typeof v === 'number')
    .map(([k, v]) => [k, v + (hi.data[k] - v) * t]));
};

export function selectedShuBuild(build) {
  const c = character;
  if (!build || !Number.isInteger(build.elite) || !c.phases[build.elite]
    || !Number.isInteger(build.level) || build.level < 1 || build.level > c.phases[build.elite].maxLevel
    || !Number.isInteger(build.potential) || build.potential < 1 || build.potential > 6
    || !Number.isInteger(build.trust ?? 0) || (build.trust ?? 0) < 0 || (build.trust ?? 0) > 200
    || !Number.isInteger(build.skillRank) || build.skillRank < 1 || build.skillRank > [4, 7, 10][build.elite]
    || build.module && build.module !== 'none') throw Error('Invalid Shu source build');
  const index = skills.indexOf(build.skillId);
  if (index < 0 || index > build.elite) throw Error('Locked Shu source skill');
  const phase = c.phases[build.elite], source = evidence.tables.skills[build.skillId].levels[build.skillRank - 1];
  const stats = interpolate(phase.attributesKeyFrames, build.level);
  const favor = interpolate(c.favorKeyFrames, Math.min(100, build.trust ?? 0) / 2);
  for (const key of ['maxHp', 'atk', 'def']) stats[key] = Math.round(stats[key] + favor[key]);
  const attrs = { COST: 'cost', MAX_HP: 'maxHp', ATK: 'atk' };
  for (const p of c.potentialRanks.slice(0, build.potential - 1)) for (const m of p.buff?.attributes.attributeModifiers ?? []) {
    if (!attrs[m.attributeType] || m.formulaItem !== 'ADDITION') throw Error('Unreviewed Shu potential');
    stats[attrs[m.attributeType]] += m.value;
  }
  const talents = c.talents.map(t => sourceCandidate(t.candidates, build)).filter(Boolean);
  return { build: { ...build }, index, source, bb: flat(source.blackboard), stats, talents,
    tags: [...tags], rangeGrid: grid(phase.rangeId),
    sowing: flat(talents.find(t => t.prefabKey === '1')?.blackboard),
    seasons: flat(talents.find(t => t.prefabKey === '2')?.blackboard) };
}

function validate(u, contract) {
  if (contract !== SHU_CORE_CONTRACT) throw Error('Shu requires the reviewed core contract');
  if (u.def.charId !== ID || u.deploySeq !== 0 || u.mem.shuController) throw Error('Shu requires a fresh original owner');
  const build = { ...u.def.raw.arkpedia, skillId: u.def.skill?.id }, r = selectedShuBuild(build), s = u.def.skill;
  if (u.def.raw.arkpedia.skillId != null && u.def.raw.arkpedia.skillId !== build.skillId
    || s.skillType !== r.source.skillType || s.durationType !== r.source.durationType || s.spType !== 'time'
    || s.spCost !== r.source.spData.spCost || s.initSp !== r.source.spData.initSp
    || s.maxCharges !== r.source.spData.maxChargeTime || s.duration !== r.source.duration
    || !same(s.bb, r.bb) || !same(s.rangeGrid ?? [], grid(r.source.rangeId))
    || !same(u.rangeGrid, r.rangeGrid) || !same(u.def.tags, tags)
    || !same(u.def.stats, normalizeChess({ stats: r.stats }).stats)
    || !same(u.def.talents.map(t => t.bb), r.talents.map(t => flat(t.blackboard))))
    throw Error('Incomplete Shu selected source');
  const attack = shuSourceComponent('7151449430089692451');
  if (attack._waitForAttackEvent !== 1 || attack._animKey !== 'Attack_1' || attack._damageType !== 1
    || attack._maxAnimScale !== -1) throw Error('Unreviewed Shu attack clock');
  return r;
}

function mods(b, a, key, value, source) {
  const old = a.findBuff(key);
  if (!value) { if (old) { void a.s; b.removeBuff(a, key); void a.s; } }
  else if (!old || old.source !== source || !same(old.mods, value)) {
    void a.s; b.addBuff(a, { key, source, mods: value }); void a.s;
  }
}
const professionAlly = a => live(a) && a.kind === 'op';

// Native deck talent is separate from the deployed owner's aura. Keep one
// squad-level controller across fresh Shu unit objects/redeployments.
export function installShuSquad(b, u, record) {
  const records = new Map([[ID, u.def]]);
  for (const id of Object.keys(b.bench ?? {})) {
    const def = b.data.getChess(id);
    if (def?.charId) records.set(def.charId, def);
  }
  return installSquad(b, record, u, records);
}

// The deck talent applies before Shu is deployed and persists after retreat.
// Its public owner is the battle, rather than a fabricated deployed unit.
export function installShuRoster({ battle: b, records }) {
  if (!records[ID]) return null;
  const selected = selectedShuBuild({ ...records[ID].arkpedia, skillId: records[ID].skill.skillId });
  return installSquad(b, selected, null, new Map(Object.entries(records)
    .map(([id, record]) => [id, normalizeChess(record)])));
}

function installSquad(b, record, source, records) {
  if (!record.seasons.interval) return null;
  if (b.shuSquad) return b.shuSquad;
  const suiCount = [...records.values()].filter(d => d.tags.includes('sui')).length;
  const enabled = suiCount >= shuSourceComponent('-3066102878310402781')._options.minCntToTrig;
  const entries = new Map(), key = 'shu:seasons:squad';
  const state = { enabled, suiCount, entries, stopped: false, handles: [], stop() {
    if (state.stopped) return;
    state.stopped = true;
    for (const a of b.allyUnits) b.removeBuff(a, key);
    entries.clear(); for (const h of state.handles) b.off(h); state.handles = [];
  } };
  const tick = () => {
    if (b.finished) { state.stop(); return; }
    for (const a of b.allyUnits) {
      if (!enabled || !professionAlly(a)) { mods(b, a, key, null, source); entries.delete(a); continue; }
      mods(b, a, key, { atkPct: record.seasons.atk }, source);
      let entry = entries.get(a);
      if (!entry || entry.seq !== a.deploySeq) {
        entry = { seq: a.deploySeq, nextSp: b.time + record.seasons.interval }; entries.set(a, entry);
      }
      while (due(b, entry.nextSp)) {
        a.skill?.gainSp(record.seasons.sp, 'shu-sui-squad'); entry.nextSp += record.seasons.interval;
      }
    }
    for (const a of entries.keys()) if (!professionAlly(a)) entries.delete(a);
  };
  state.handles = [b.on('tick', tick), b.on('deploy', tick), b.on('death', tick), b.on('battleEnd', () => state.stop())];
  b.shuSquad = state; tick(); return state;
}

export class ShuCoreController {
  constructor(b, u, record) {
    this.b = b; this.u = u; this.record = record; this.seq = null; this.stopped = false;
    this.handles = []; this.tiles = new Set(); this.recipients = new Set(); this.phase = null; this.accepting = false;
  }
  valid() { return !this.stopped && !this.b.finished && live(this.u) && this.seq === this.u.deploySeq; }
  model() { return evidence.models[ID][['UP', 'LEFT'].includes(this.u.dir) ? 'Back' : 'Front']; }
  visual(clip, speed = 1, loop = false) {
    this.u.mem.regularVisualDirection = ['UP', 'LEFT'].includes(this.u.dir) ? 'UP' : 'RIGHT';
    this.u.mem.regularFormVisual = { clip, speed, loop };
    // Back has no native Die clip; record that boundary without inventing one.
    if (this.model().durations.Die != null)
      this.u.mem.regularDeathVisual = { clip: 'Die', die: 'Die', duration: this.model().durations.Die };
    else delete this.u.mem.regularDeathVisual;
  }
  targets(limit = 1) {
    const { b, u } = this;
    const keys = u.rangeKeySet ?? new Set(absoluteRangeKeys(u.rangeGrid, u.tileR, u.tileC, u.dir, u.s.rangeExtend));
    const out = b.enemies.filter(t => live(t) && canTargetEnemy(u, t, { canHitFly: false })
      && (!t.s.flags.camou || !!t.blockedBy) && (bodyInKeys(t, keys) || t.blockedBy === u));
    sortEnemyTargets(b, u, out); return out.slice(0, limit);
  }
  release(t, info) {
    if (this.phase?.kind === 'skill-attack') return this.skills?.releaseAttack(t, info) ?? false;
    const { b, u, phase: p } = this;
    if (!this.accepting || !this.valid() || !u.canAct || u.s.flags.disarm || !p || p.kind !== 'attack'
      || p.epoch !== u.attackControlEpoch || p.target !== t || p.targetSeq !== t.deploySeq || p.accepted
      || !live(t) || !due(b, p.releaseAt) || !canTargetEnemy(u, t, { canHitFly: false })) return false;
    p.accepted = true;
    b.dealDamage(u, t, makeDamageInfo({ amount: u.s.atk * u.s.atkScaleMul, type: 'phys', isAttack: true,
      isSkill: false, isSplash: false, applyWay: 'melee', attackId: info.attackId ?? 0, tags: ['shu:ordinary'] }));
    return true;
  }
  tickAttack() {
    if (this.skills?.tickAttack()) return;
    const { b, u } = this;
    if (!this.valid()) { this.phase = null; return; }
    let p = this.phase;
    if (p?.kind === 'born') { if (!due(b, p.readyAt)) return; this.phase = null; p = null; }
    if (!u.canAct || u.s.flags.disarm || p && p.epoch !== u.attackControlEpoch) {
      this.phase = null; this.visual('Idle', 1, true); return;
    }
    if (p) {
      if (!p.released && due(b, p.releaseAt)) {
        p.released = true;
        if (live(p.target) && p.target.deploySeq === p.targetSeq) {
          this.accepting = true;
          try { b.forceAttack(u, [p.target]); } finally { this.accepting = false; }
        }
      }
      if (!this.valid() || this.phase !== p || !due(b, p.readyAt)) return;
      this.phase = null;
    }
    if (u.atkCd > 1e-9) return;
    const target = this.targets()[0];
    if (!target) { this.visual('Idle', 1, true); return; }
    const speed = u.base.bat / u.s.interval, m = this.model(), clip = 'Attack_1';
    this.phase = { kind: 'attack', target, targetSeq: target.deploySeq, epoch: u.attackControlEpoch, accepted: false,
      releaseAt: b.time + m.eventPayloads[clip].find(e => e.name === 'OnAttack').time / speed,
      readyAt: b.time + Math.max(u.s.interval, m.durations[clip] / speed), released: false };
    this.visual(clip, speed); u.atkCd = u.s.interval;
  }
  sow(target) {
    if (!this.valid() || !this.record.sowing.hp_recovery_per_sec || !live(target)) return;
    for (const [dr, dc] of grid('x-5')) {
      const r = target.tileR + dr, c = target.tileC + dc;
      if (!this.b.grid.inRect(r, c)) continue;
      const tile = this.b.grid.tile(r, c);
      if (tile.build !== 'NONE' || tile.pass === 'ALL') this.tiles.add(this.b.grid.key(r, c));
    }
    this.syncSowing(); this.skills?.syncEnemies(); this.skills?.syncAura();
    this.b.emit('shuSowing', { owner: this.u, target, tiles: [...this.tiles] });
  }
  syncSowing() {
    const { b, u, record } = this, regen = `shu:sowing:regen:${u.id}`, sanctuary = `shu:sowing:sanctuary:${u.id}`;
    for (const a of b.allyUnits) {
      // Sowing is an HP_RECOVERY_PER_SEC attribute, so passive noHeal and
      // HEAL_FREE do not reject it. A direct skill heal still does.
      const eligible = this.valid() && live(a) && a.kind !== 'device'
        && b.allySelectable(a, u) && this.tiles.has(b.grid.key(a.tileR, a.tileC));
      const scale = this.skills?.sowingScale ?? 1;
      mods(b, a, regen, eligible ? { hpRegen: record.sowing.hp_recovery_per_sec * scale } : null, u);
      if (!eligible) { b.removeBuff(a, sanctuary); this.recipients.delete(a); }
      else {
        const value = record.sowing.damage_resistance * scale;
        if (a.findBuff(sanctuary)?.data?.value !== value) {
          b.removeBuff(a, sanctuary);
          b.applyStatus(a, 'sanctuary', { key: sanctuary, source: u, value });
        }
        this.recipients.add(a);
      }
    }
  }
  syncClasses() {
    const { b, u, record } = this, t = record.seasons;
    const counts = new Map();
    for (const a of b.allyUnits.filter(professionAlly)) counts.set(a.def.profession, (counts.get(a.def.profession) ?? 0) + 1);
    const different = this.valid() && t.max_hp && counts.size >= 3;
    const sameClass = this.valid() && t.attack_speed && [...counts.values()].some(n => n >= 3);
    for (const a of b.allyUnits) {
      mods(b, a, `shu:seasons:hp:${u.id}`, different && professionAlly(a) ? { hpPct: t.max_hp } : null, u);
      mods(b, a, `shu:seasons:aspd:${u.id}`, sameClass && professionAlly(a) ? { aspd: t.attack_speed } : null, u);
    }
  }
  install() {
    const { b, u } = this;
    installShuSquad(b, u, this.record);
    this.handles = [b.on('deploy', ({ unit, move }) => {
      if (unit === u && !move) {
        this.seq = u.deploySeq; this.phase = { kind: 'born', readyAt: b.time + this.model().durations.Start };
        this.visual('Start');
      }
      this.syncClasses(); this.syncSowing();
    }, { owner: u }), b.on('calculatedHeal', ({ source, target, opts }) => {
      if (source === u && !opts.regen) this.sow(target);
    }, { owner: u }), b.on('tick', () => {
      if (this.stopped || b.finished) { this.stop(); return; }
      this.syncClasses(); this.syncSowing(); this.skills?.tick(); this.tickAttack();
    }, { owner: u }), b.on('death', ({ unit }) => {
      if (unit === u) this.stop(); else { this.syncClasses(); this.syncSowing(); }
    }, { owner: u }), b.on('battleEnd', () => this.stop())];
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.skills?.stop(); this.phase = null; this.tiles.clear();
    this.syncClasses(); this.syncSowing(); this.recipients.clear();
    this.u.mem.regularFormVisual = null; delete this.u.mem.regularVisualDirection;
    for (const h of this.handles) this.b.off(h); this.handles = [];
  }
}

export function prepareShuCore(b, u, { contract } = {}) {
  const record = validate(u, contract), controller = new ShuCoreController(b, u, record);
  u.mem.shuController = controller;
  const trait = { noAttack: true, attackDrivenSkill: true, attack: 'melee', projectile: 'none', dmgType: 'phys',
    canHitFly: false, maxTargets: 1, maxTargetsByBlock: false, hitAllBlocked: false,
    allInRange: false, rangeAoe: false, hits: 1, hitsFn: null, chain: null, splashRadius: 0, heal: null,
    onHit: null, onEachHit: null, install: null, requiresAcceptedLaunch: true, attackVisual: 'none',
    launchAttack: (_b, _u, _p, target, info) => controller.release(target, info) };
  return { record, controller, kit: { trait, talents: [], install: null,
    skill: { kind: 'instant', trigger: { rule: 'NEVER' }, canActivate: () => false } } };
}
