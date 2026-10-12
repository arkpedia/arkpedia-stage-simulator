// SPDX-License-Identifier: GPL-3.0-or-later
// Source-selected diagnostic bridge. Public roster approval stays separate.
import evidence from '../../../data/arkpedia-shu-prefabs.json' with { type: 'json' };
import { absoluteRangeKeys, canTargetEnemy } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { makeDamageInfo } from '../damage.js';
import { crossedRootTiles } from '../movement-observer.js';
import { enforceBlockCapacity } from '../ai.js';
import { prepareShuCore, SHU_CORE_CONTRACT, SHU_ID } from './arkpedia-shu.js';

export const SHU_SKILL_CONTRACT = Object.freeze({
  scope: 'All thirty selected Shu skill ranks, charge healing, enhanced Sowing, independent attack/heal paths, enemy aura and persistent teleport marks',
  mapping: 'Original hit/Born/begin/end clocks; S1 preserves trigger input and refunds a dead target, S2 uses additive BAT and two healing targets, S3 uses capped enemy-present ATK/ASPD and root-tile Manhattan GE teleport before exit. Source mark immunity and teleport immunity are separate.',
  limits: 'Diagnostic only, not public roster approval. Compiled selector post-filters, combined-ability event4, FSM switching, listener ordering and nearest-centre root geometry are bounded local mappings, not certified Unity frame parity. Native persistent pull physics, collision-offset reset, modules, particles, shaders and audio remain unsupported.',
  frameParity: false,
});
const comps = [...Object.values(evidence.characters), ...Object.values(evidence.skills)].flat().flatMap(r => r.components);
const comp = id => comps.find(c => c.pathId === id)?.data;
const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const due = (b, time) => b.time + 1e-9 >= time;
const grid = id => evidence.tables.ranges[id].grids.map(g => [g.row, g.col]);
const healable = (b, u, a) => live(a) && a.kind !== 'device' && b.allySelectable(a, u)
  && !a.s.flags.untargetable && !a.s.flags.healFree
  && (a === u || !(a.s.flags.noHeal || a.profile?.noHeal));

function verifySkills() {
  for (const [id, begin] of [['5135447623683147884', 0], ['-693315539737974652', 1], ['-8754875440332982733', 1]]) {
    const s = comp(id);
    if (s?._canSilenced !== 0 || s._canUseInAbnormalState !== 0 || s._allowSpRecoveryWhenAffecting !== 0
      || s._playSkillBeginAnim !== begin) throw Error('Unreviewed Shu skill holder');
  }
  for (const [id, cap] of [['1176209197441157228', 1], ['68298077655102755', 1],
    ['7347642668084917539', -1], ['-2132432784322038493', 1]]) {
    const a = comp(id);
    if (a?._waitForAttackEvent !== 1 || a._maxAnimScale !== cap) throw Error('Unreviewed Shu skill clock');
  }
  const first = comp('1902398344753842284');
  if (first?._maxHpRatio !== .5 || first._maxHpExcludeEqual !== 0 || first._postFilter !== 3
    || comp('5135447623683147884')._recoverSpIfTargetDead !== 1)
    throw Error('Unreviewed Shu first-aid selector');
}

export class ShuSkills {
  constructor(core) {
    this.core = core; this.b = core.b; this.u = core.u; this.record = core.record;
    this.marks = new Map(); this.inside = new Set(); this.aura = new Set(); this.handles = [];
    this.lock = `shu:cast:${this.u.id}`; this.auraKey = `shu:s3:range:${this.u.id}`;
  }
  get active() { return this.core.valid() && this.record.index > 0 && !!this.u.skill.active; }
  get sowingScale() { return this.active && this.record.index === 1 ? this.record.bb.extra_extend_scale : 1; }
  get range() { return grid(this.record.source.rangeId); }
  keys() { return new Set(absoluteRangeKeys(this.range, this.u.tileR, this.u.tileC, this.u.dir)); }
  allies(first = false) {
    const keys = this.keys();
    return this.b.allyUnits.filter(a => healable(this.b, this.u, a) && bodyInKeys(a, keys)
      && a.hp < a.s.maxHp - 1e-9 && (!first || a.hpRatio <= .5 + 1e-9))
      .sort((a, z) => a.hpRatio - z.hpRatio || a.deploySeq - z.deploySeq || a.id - z.id);
  }
  canCast() {
    if (!this.core.valid() || !this.u.canAct || this.u.s.flags.disarm) return false;
    const p = this.core.phase;
    if (p && ['heal', 'skill-attack', 'begin', 'end'].includes(p.kind)) return false;
    return this.record.index > 0 || p?.kind !== 'born' && this.allies(true).length > 0;
  }
  transition(kind) {
    const clip = `Skill_${this.record.index + 1}_${kind === 'begin' ? 'Begin' : 'End'}`;
    this.core.phase = { kind, readyAt: this.b.time + this.core.model().durations[clip] };
    this.core.visual(clip); this.u.atkCd = 0;
  }
  start() {
    if (this.record.index === 0) {
      const input = this.allies(true)[0];
      this.launch('heal', 'Attack_2', 1, { input, inputSeq: input.deploySeq, first: true });
      this.b.addBuff(this.u, { key: this.lock, flags: { noSp: true } });
    } else {
      this.transition('begin'); this.core.syncSowing(); this.syncEnemies(); this.syncAura();
    }
  }
  end(reason) {
    if (this.record.index === 0) return; // charge runtime ends immediately; native cast stays locked
    this.clearEnemyState(); this.core.syncSowing();
    // SkillRuntime removes the source skill modifiers after this callback.
    // Enforce the smaller block capacity on the next controller tick.
    this.enforceCapacity = this.record.index === 1;
    if (this.core.valid() && !['death', 'withdrawn'].includes(reason)) this.transition('end');
    else this.clearPhase();
  }
  clearPhase() {
    this.core.phase = null; this.b.removeBuff(this.u, this.lock);
  }
  launch(kind, clip, cap, extra = {}) {
    const speed = Math.min(cap, this.u.s.aspd / 100), m = this.core.model();
    this.core.phase = { kind, clip, epoch: this.u.attackControlEpoch, released: false,
      releaseAt: this.b.time + m.eventPayloads[clip].find(e => e.name === 'OnAttack').time / speed,
      readyAt: this.b.time + Math.max(this.u.s.interval, m.durations[clip] / speed), ...extra };
    this.u.atkCd = this.u.s.interval; this.core.visual(clip, speed);
  }
  heal(a, scale = 1) {
    if (this.core.valid() && healable(this.b, this.u, a))
      this.b.heal(this.u, a, this.u.s.atk * scale);
  }
  releaseAttack(t, info) {
    const p = this.core.phase;
    if (!this.core.accepting || !this.active || !this.u.canAct || this.u.s.flags.disarm
      || !p || p.kind !== 'skill-attack' || p.accepted || p.epoch !== this.u.attackControlEpoch
      || p.target !== t || p.targetSeq !== t.deploySeq || !live(t) || !due(this.b, p.releaseAt)
      || !canTargetEnemy(this.u, t, { canHitFly: false })
      || !bodyInKeys(t, this.keys()) && t.blockedBy !== this.u) return false;
    p.accepted = true;
    this.b.dealDamage(this.u, t, makeDamageInfo({ amount: this.u.s.atk * this.u.s.atkScaleMul,
      type: 'phys', isAttack: true, isSkill: true, isSplash: false, applyWay: 'melee',
      attackId: info.attackId, tags: ['shu:s3'] }));
    // Native event4 dispatch is independent of positive damage. The Heal
    // selector is evaluated for the callback, not against the damaged body.
    for (const a of this.allies().slice(0, 1)) this.heal(a);
    return true;
  }
  release(p) {
    if (p.first) {
      if (!p.input.alive) this.u.skill.addCharge(1);
      else if (p.input.deploySeq === p.inputSeq) this.heal(p.input, this.record.bb.heal_scale);
      return;
    }
    if (!this.active) return;
    if (p.kind === 'skill-attack') {
      // CAST selection follows the shared source bridge's strike-time mapping.
      const t = this.core.targets()[0];
      if (!t) return;
      p.target = t; p.targetSeq = t.deploySeq; this.core.accepting = true;
      try { this.b.forceAttack(this.u, [t]); } finally { this.core.accepting = false; }
    } else {
      // alwaysIncludeTarget retains the primary input, not every member of the
      // CAST selector. Re-evaluate the remaining healing targets at the strike.
      const inputs = this.allies(), primary = p.input;
      if (primary?.deploySeq === p.inputSeq && healable(this.b, this.u, primary)) {
        const i = inputs.indexOf(primary); if (i >= 0) inputs.splice(i, 1);
        inputs.unshift(primary);
      }
      const count = this.record.index === 1 ? this.record.bb['attack@max_target'] : 1;
      for (const a of inputs.slice(0, count)) this.heal(a);
    }
  }
  tickAttack() {
    if (!this.core.valid()) { this.clearPhase(); return true; }
    let p = this.core.phase;
    if (p?.kind === 'begin' || p?.kind === 'end') {
      if (!due(this.b, p.readyAt)) return true;
      this.clearPhase(); p = null;
    }
    const owned = p?.kind === 'heal' || p?.kind === 'skill-attack';
    if (!this.active && !owned) return false;
    if (!this.u.canAct || this.u.s.flags.disarm || owned && p.epoch !== this.u.attackControlEpoch) {
      this.clearPhase(); this.core.visual(this.active ? `Skill_${this.record.index + 1}_Idle` : 'Idle', 1, true);
      return true;
    }
    if (owned) {
      if (!p.released && due(this.b, p.releaseAt)) { p.released = true; this.release(p); }
      if (!this.core.valid() || this.core.phase !== p || !due(this.b, p.readyAt)) return true;
      this.clearPhase();
      if (!this.active) return true;
    }
    if (this.u.atkCd > 1e-9) return true;
    if (this.record.index === 2) {
      const target = this.core.targets()[0];
      if (target) { this.launch('skill-attack', 'Skill_3_Attack_1', Infinity, { target, targetSeq: target.deploySeq }); return true; }
    }
    const count = this.record.index === 1 ? this.record.bb['attack@max_target'] : 1;
    const targets = this.allies().slice(0, count);
    if (targets.length) this.launch('heal', `Skill_${this.record.index + 1}_Attack${this.record.index === 2 ? '_2' : ''}`,
      1, { input: targets[0], inputSeq: targets[0].deploySeq });
    else this.core.visual(`Skill_${this.record.index + 1}_Idle`, 1, true);
    return true;
  }
  eligibleEnemy(e) { return live(e) && e.side === 'enemy' && e.motion !== 'FLY'; }
  atRoot(e, r, c) {
    if (!this.active || this.record.index !== 2 || !this.eligibleEnemy(e)) return false;
    const onTile = this.core.tiles.has(this.b.grid.key(r, c));
    if (onTile) {
      const entering = !this.inside.has(e);
      this.inside.add(e);
      if (entering && !this.marks.has(e) && !e.findBuff('immune_shu_blink')) this.marks.set(e, { r, c, seq: e.deploySeq });
    } else this.inside.delete(e);
    const mark = this.marks.get(e);
    if (!mark || mark.seq !== e.deploySeq) return false;
    if (Math.abs(r - mark.r) + Math.abs(c - mark.c) < this.record.bb.max_distance) return false;
    // Native BE_TELEPORTED immunity blocks the action, unlike immune_shu_blink
    // which rejects the mark itself. StaticBody/noDisplace is not teleport immunity.
    if (e.def.immune?.has('be_teleported')) return false;
    const from = { x: e.x, y: e.y };
    e.x = mark.c; e.y = mark.r; e.moving = false;
    if (e.route) e.route.pts = null; // keep legIdx, passed checkpoints, waits and speed
    // releaseFromBlocker=false: keep both ends of an existing block relation.
    this.inside.add(e);
    this.b.emit('shuTeleport', { owner: this.u, enemy: e, from, to: { x: e.x, y: e.y } });
    this.b.fx('displace', { x: e.x, y: e.y, id: e.id });
    return true;
  }
  moved({ enemy, from, to }) {
    if (!this.active || this.record.index !== 2) return;
    for (const [r, c] of crossedRootTiles(from, to)) if (this.atRoot(enemy, r, c)) break;
    this.syncAura();
  }
  syncEnemies() {
    if (!this.active || this.record.index !== 2) return;
    for (const e of this.b.enemies) {
      if (!this.eligibleEnemy(e)) { this.inside.delete(e); this.marks.delete(e); continue; }
      if (this.marks.has(e) && this.marks.get(e).seq !== e.deploySeq) {
        this.marks.delete(e); this.inside.delete(e);
      }
      this.atRoot(e, Math.round(e.y), Math.round(e.x));
    }
    for (const e of this.marks.keys()) if (!this.eligibleEnemy(e)) this.marks.delete(e);
    for (const e of this.inside) if (!this.eligibleEnemy(e)) this.inside.delete(e);
  }
  syncAura() {
    const enabled = this.active && this.record.index === 2 && this.inside.size > 0, keys = this.keys();
    for (const a of this.b.allyUnits) {
      // This native purpose0 validator explicitly ignores ally target-free and
      // HEAL_FREE. Isolation is bypassed; devices are not characters.
      const eligible = enabled && live(a) && a.kind !== 'device' && bodyInKeys(a, keys);
      if (!eligible) { this.b.removeBuff(a, this.auraKey); this.aura.delete(a); }
      else {
        if (!a.findBuff(this.auraKey)) this.b.addBuff(a, { key: this.auraKey, source: this.u,
          mods: { atkPct: this.record.bb.e_atk, aspd: this.record.bb.e_attack_speed } });
        this.aura.add(a);
      }
    }
  }
  clearEnemyState() {
    this.marks.clear(); this.inside.clear();
    for (const a of this.aura) this.b.removeBuff(a, this.auraKey);
    this.aura.clear();
  }
  tick() {
    if (this.enforceCapacity) { this.enforceCapacity = false; enforceBlockCapacity(this.b, this.u); }
    this.syncEnemies(); this.syncAura();
  }
  install() {
    this.handles = [this.b.on('enemyMoved', ctx => this.moved(ctx), { owner: this.u }),
      this.b.on('death', ({ unit }) => {
        this.marks.delete(unit); this.inside.delete(unit); this.syncAura();
      }, { owner: this.u }),
      this.b.on('deploy', () => this.syncAura(), { owner: this.u }),
      this.b.on('enemyHidden', ({ enemy, hidden }) => {
        if (hidden) { this.marks.delete(enemy); this.inside.delete(enemy); this.syncAura(); }
      }, { owner: this.u })];
  }
  stop() {
    this.clearPhase(); this.clearEnemyState();
    for (const h of this.handles) this.b.off(h); this.handles = [];
  }
}

export function prepareShuSkills(b, u, { contract } = {}) {
  if (contract !== SHU_SKILL_CONTRACT) throw Error('Shu requires the reviewed skill contract');
  verifySkills();
  const prepared = prepareShuCore(b, u, { contract: SHU_CORE_CONTRACT });
  const bridge = new ShuSkills(prepared.controller); prepared.controller.skills = bridge;
  bridge.install();
  const { record } = prepared, first = record.index === 0;
  const mods = first ? null : { atkPct: record.bb.atk,
    ...(record.index === 1 ? { batFlat: record.bb.base_attack_time, blockCnt: record.bb.block_cnt } : {}) };
  return { ...prepared, skills: bridge, kit: { ...prepared.kit, skill: {
    id: u.def.skill.id, name: u.def.skill.name, kind: first ? 'charges' : 'duration',
    charges: record.source.spData.maxChargeTime, duration: record.source.duration,
    trigger: first ? 'SP_FULL' : 'NEVER', silenceable: false, mods,
    targeting: first ? null : { rangeGrid: bridge.range },
    canActivate: () => bridge.canCast(), onStart: () => bridge.start(), onEnd: ({ reason }) => bridge.end(reason),
  } } };
}

// Public approval is a separate receipt; the native extraction remains held.
export function customizeShuKit({ battle, id, unit, kit }) {
  if (id !== SHU_ID) return;
  const prepared = prepareShuSkills(battle, unit, { contract: SHU_SKILL_CONTRACT });
  Object.assign(kit, prepared.kit);
}
export function installShu({ unit }) { unit.mem.shuController?.install(); }
