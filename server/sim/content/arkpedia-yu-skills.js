// SPDX-License-Identifier: GPL-3.0-or-later
// Opt-in diagnostic kit; public approval remains a separate review.
import evidence from '../../../data/arkpedia-yu-prefabs.json' with { type: 'json' };
import { prepareYuCore, YU_CORE_CONTRACT } from './arkpedia-yu.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { enforceBlockCapacity } from '../ai.js';
import { makeDamageInfo } from '../damage.js';

export const YU_SKILL_CONTRACT = Object.freeze({
  scope: 'All thirty selected Yu ranks, defensive-SP S1 and inverse Burn, delayed reachable-ground S2 teleport/Arts mode, directional S3 Arts/Burn wall and enemy projectile interception, global recovery',
  mapping: 'Original uncapped hit clocks and selected stats; one retained S1/S2 attack input, one S3 CAST input, unlimited ground burst inputs, separate delayed teleport, source root comparisons and entry-only projectile probability.',
  limits: 'Diagnostic only. Compiled mode/FSM/ability dispatch, effect-start ordering, count loading and damage-modifier callbacks are bounded local mappings. Projectile width is mapped to a full-width slab; teleport uses corroborated four-corner landing geometry without certified native RNG draw order or persistent pull physics. Modules, particles, shaders, audio and Unity frame parity remain unsupported.',
  frameParity: false,
});
const components = [...Object.values(evidence.characters), ...Object.values(evidence.skills)].flat().flatMap(r => r.components);
const comp = id => components.find(c => c.pathId === id)?.data;
const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const due = (b, t) => b.time + 1e-9 >= t;
const grid = id => id ? evidence.tables.ranges[id].grids.map(g => [g.row, g.col]) : [];
function walk(node, fn) {
  if (!node || typeof node !== 'object') return;
  if (node.$type) fn(node);
  for (const v of Object.values(node)) if (Array.isArray(v)) v.forEach(n => walk(n, fn));
  else if (v && typeof v === 'object') walk(v, fn);
}
const action = (key, name) => {
  let found; walk(evidence.templates[key], n => { if (!found && n.$type.includes(`Nodes+${name},`)) found = n; });
  if (!found) throw Error(`Missing Yu source action ${key}/${name}`); return found;
};
function verify() {
  for (const id of ['-8923436269209185538', '-4680177823739503332', '7597233411092728116']) {
    const d = comp(id);
    if (d?._canSilenced !== 0 || d._canUseInAbnormalState !== 0 || d._allowSpRecoveryWhenAffecting !== 0
      || d._canCastDuringBorn !== 1) throw Error('Unreviewed Yu skill holder');
  }
  for (const [id, clip, type, input] of [['-2748526403551580630', 'Skill_1', 1, 2],
    ['-5870594975936303574', 'Skill_2', 2, 2], ['-6866525990858346966', 'Skill_3_Loop', 1, 1]]) {
    const d = comp(id);
    if (d?._animKey !== clip || d._damageType !== type || d._selectTargetSource !== input
      || d._waitForAttackEvent !== 1 || d._maxAnimScale !== -1) throw Error('Unreviewed Yu skill attack');
  }
  if (comp('8526707160546254108')._targetMotion !== 1 || comp('8526707160546254108')._limitTargetNum !== 0
    || comp('2202384790713026868')._targetOptions.targetSide !== 2
    || comp('4448953952700942644')._eliminateOnEnter !== 1) throw Error('Unreviewed Yu recipient selection');
}

/** Ground connectivity: exclude start-tile cost, reject impassable roots and
 * subsequent obstacle-like tiles, and retain the strict sub-1000 path bound. */
export function yuGroundReachable(b, enemy, r, c) {
  const sr = Math.round(enemy.y), sc = Math.round(enemy.x);
  if (!b.grid.walkable(sr, sc)) return false;
  if (sr === r && sc === c) return true;
  if (!b.grid.groundPassable(r, c)) return false;
  const queue = [[sr, sc, 0]], visited = new Set([`${sr},${sc}`]);
  for (let i = 0; i < queue.length; i++) {
    const [y, x, cost] = queue[i]; if (y === r && x === c) return true;
    if (cost + 1 >= 1000) continue;
    for (const [dy, dx] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const yy = y + dy, xx = x + dx, key = `${yy},${xx}`;
      if (!visited.has(key) && b.grid.groundPassable(yy, xx)) { visited.add(key); queue.push([yy, xx, cost + 1]); }
    }
  }
  return false;
}

/** Literal asymmetric root comparisons, independently of projectile slab geometry. */
export function yuWallCrosses(owner, source, target) {
  const column = ['RIGHT', 'LEFT'].includes(owner.dir), pivot = column ? owner.tileC : owner.tileR;
  const s = Math.round(column ? source.x : source.y), t = Math.round(column ? target.x : target.y);
  return ['RIGHT', 'UP'].includes(owner.dir)
    ? s <= pivot && t > pivot || s > pivot && t <= pivot
    : s < pivot && t >= pivot || s >= pivot && t < pivot;
}

export class YuSkills {
  constructor(core) {
    this.core = core; this.b = core.b; this.u = core.u; this.record = core.record;
    this.handles = []; this.pending = new Map(); this.wall = new Map(); this.entries = new Set();
    this.attemptSeq = 0; this.modeReady = false;
    this.auraKey = `yu:s3:damage:${this.u.id}`; this.wallReady = false; this.interceptor = null;
    this.sourceTeleport = action('yu_s_2[try_tp]', 'ForceSetToTilePosition');
  }
  get active() { return this.core.valid() && !!this.u.skill.active; }
  canCast() { return this.core.valid() && this.u.canAct && !this.u.s.flags.disarm; }
  recoveryRecipients(operators) { return this.active && this.modeReady && this.record.index === 2 ? operators : [this.u]; }
  keys() { return new Set(absoluteRangeKeys(grid(this.record.source.rangeId), this.u.tileR, this.u.tileC, this.u.dir)); }
  burstTargets() {
    return this.b.enemies.filter(t => live(t) && canTargetEnemy(this.u, t, { canHitFly: false })
      && (!t.s.flags.camou || !!t.blockedBy) && bodyInKeys(t, this.keys()));
  }
  attackTargets() {
    if (this.record.index !== 2) return this.core.targets();
    const out = this.core.targets(Infinity).filter(t => !t.isFlying);
    sortEnemyTargets(this.b, this.u, out); return out.slice(0, 1);
  }
  launch(kind, clip, extra = {}) {
    const speed = this.u.base.bat / this.u.s.interval, model = this.core.model();
    this.core.phase = { kind, epoch: this.u.attackControlEpoch, accepted: false, released: false,
      releaseAt: this.b.time + model.eventPayloads[clip].find(e => e.name === 'OnAttack').time / speed,
      readyAt: this.b.time + Math.max(this.u.s.interval, model.durations[clip] / speed), ...extra };
    this.core.visual(clip, speed); this.u.atkCd = this.u.s.interval;
  }
  start() {
    this.core.phase = null;
    this.modeReady = this.record.index === 0;
    if (this.record.index === 1) this.launch('yu:burst', 'Skill_2');
    else if (this.record.index === 2) this.launch('yu:begin', 'Skill_3_Begin');
    else this.u.atkCd = 0;
    this.core.syncRecovery();
  }
  end(reason) {
    this.modeReady = false;
    this.clearPending(); this.clearWall(); this.core.syncRecovery();
    this.enforceCapacity = this.record.index === 1;
    if (this.record.index === 2 && this.core.valid() && !['death', 'withdrawn'].includes(reason)) {
      const clip = 'Skill_3_End';
      this.core.phase = { kind: 'yu:end', readyAt: this.b.time + this.core.model().durations[clip] };
      this.core.visual(clip);
    } else { this.core.phase = null; if (this.core.valid()) this.core.visual('Idle', 1, true); }
    this.u.atkCd = 0;
  }
  handlesRelease() { return this.active || this.core.phase?.kind?.startsWith('yu:'); }
  releaseAttack(t, info) {
    const p = this.core.phase;
    if (!this.core.accepting || !this.active || !this.u.canAct || this.u.s.flags.disarm
      || !p || p.kind !== 'yu:attack' || p.accepted || p.epoch !== this.u.attackControlEpoch
      || p.target !== t || p.targetSeq !== t.deploySeq || !live(t) || !due(this.b, p.releaseAt)
      || !canTargetEnemy(this.u, t, { canHitFly: this.record.index !== 2 && t.blockedBy === this.u })) return false;
    p.accepted = true;
    this.b.dealDamage(this.u, t, makeDamageInfo({ amount: this.u.s.atk * this.u.s.atkScaleMul,
      type: this.record.index === 1 ? 'arts' : 'phys', isAttack: true, isSkill: true,
      applyWay: 'melee', attackId: info.attackId, tags: [`yu:s${this.record.index + 1}:attack`] }));
    return true;
  }
  tickAttack() {
    let p = this.core.phase;
    if (!this.active) {
      if (p?.kind === 'yu:end') {
        if (due(this.b, p.readyAt)) this.core.phase = null;
        else return true;
      }
      return false;
    }
    if (!this.u.canAct || this.u.s.flags.disarm || p && p.epoch !== this.u.attackControlEpoch) {
      this.core.phase = null; this.core.visual(this.record.index === 2 ? 'Skill_3_Idle' : 'Idle', 1, true);
      return true;
    }
    if (p) {
      if (!p.released && due(this.b, p.releaseAt)) {
        p.released = true;
        if (p.kind === 'yu:burst') this.burst();
        else if (p.kind === 'yu:begin') this.startWall();
        else if (p.kind === 'yu:attack') {
          // S3 has a CAST selector; the other two modes retain their INPUT.
          const t = this.record.index === 2 ? this.attackTargets()[0] : p.target;
          if (t && live(t) && (this.record.index === 2 || t.deploySeq === p.targetSeq)) {
            p.target = t; p.targetSeq = t.deploySeq; this.core.accepting = true;
            try { this.b.forceAttack(this.u, [t]); } finally { this.core.accepting = false; }
          }
        }
      }
      if (!this.active || this.core.phase !== p || !due(this.b, p.readyAt)) return true;
      this.core.phase = null;
    }
    if (this.u.atkCd > 1e-9) return true;
    const target = this.attackTargets()[0];
    if (!target) { this.core.visual(this.record.index === 2 ? 'Skill_3_Idle' : 'Idle', 1, true); return true; }
    const clip = ['Skill_1', 'Skill_2', 'Skill_3_Loop'][this.record.index];
    this.launch('yu:attack', clip, { target, targetSeq: target.deploySeq }); return true;
  }
  burn(target, ratio, tag) {
    if (!this.active || !live(target)) return;
    this.b.dealDamage(this.u, target, makeDamageInfo({ amount: this.u.s.atk * ratio, type: 'element', element: 'burn',
      isAttack: false, isSkill: true, canDodge: false, tags: [tag] }));
  }
  inverse({ source, target, type, dmg }) {
    if (this.active && this.record.index === 0 && target === this.u && source?.side === 'enemy'
      && type !== 'element' && !dmg?.tags?.includes('hpLoss')) this.burn(source, this.record.bb.ep_damage_ratio, 'yu:s1:inverse');
  }
  burst() {
    this.modeReady = true;
    for (const t of this.burstTargets()) {
      this.b.dealDamage(this.u, t, makeDamageInfo({ amount: this.u.s.atk * this.record.bb.atk_scale,
        type: 'arts', isAttack: true, isSkill: true, applyWay: 'melee', tags: ['yu:s2:burst'] }));
      if (!this.active || !live(t)) continue;
      const native = comp('954501052673400092')._activeBuffs[0], key = `yu:s2:teleport:${this.u.id}:${++this.attemptSeq}`;
      const buff = this.b.addBuff(t, { key, source: this.u, duration: native.lifeTime });
      if (buff) this.pending.set(buff, { enemy: t, seq: t.deploySeq, due: this.b.time + native.triggerInterval, key });
    }
  }
  teleport(enemy) {
    if (!this.active || !live(enemy) || enemy.motion !== 'WALK' || enemy.s.flags.selfBound
      || enemy.findBuff('immune_shu_blink') || enemy.findBuff('immune_yu_blink')
      || enemy.def.immune?.has('be_teleported') || !yuGroundReachable(this.b, enemy, this.u.tileR, this.u.tileC)) return false;
    const from = { x: enemy.x, y: enemy.y }, radius = this.sourceTeleport._randomOffset;
    const inner = this.sourceTeleport._randomOffsetInnerRange, corner = Math.floor(this.b.rng() * 4);
    // Native fields plus corroborated corner geometry; RNG draw order remains
    // an explicit local mapping. Release the old blocker before relocation.
    this.b._unblock(enemy);
    enemy.x = this.u.tileC + (corner & 1 ? 1 : -1) * (inner + this.b.rng() * radius);
    enemy.y = this.u.tileR + (corner & 2 ? 1 : -1) * (inner + this.b.rng() * radius);
    enemy.moving = false;
    if (enemy.route) enemy.route.pts = null;
    this.b.emit('yuTeleport', { owner: this.u, enemy, from, to: { x: enemy.x, y: enemy.y },
      nativeOffset: radius, nativeInnerRange: this.sourceTeleport._randomOffsetInnerRange });
    this.b.fx('teleport', { x: enemy.x, y: enemy.y, id: enemy.id, src: this.u.id }); return true;
  }
  clearPending() {
    for (const [buff, state] of this.pending) this.b.removeBuff(state.enemy, buff);
    this.pending.clear();
  }
  syncWall() {
    const enabled = this.active && this.wallReady;
    for (const t of new Set([...this.wall.keys(), ...this.b.enemies])) {
      // Source targetSide=ENEMY, ignoreTargetFree=1, both motion masks.
      const eligible = enabled && live(t) && !t.mem?.reborning;
      if (!eligible) { this.b.removeBuff(t, this.auraKey); this.wall.delete(t); }
      else if (this.wall.get(t)?.seq !== t.deploySeq || t.findBuff(this.auraKey) !== this.wall.get(t)?.buff) {
        const buff = this.b.addBuff(t, { key: this.auraKey, source: this.u });
        if (buff) this.wall.set(t, { seq: t.deploySeq, buff });
        else this.wall.delete(t);
      }
    }
  }
  wallDamage({ source, target, type }) {
    if (!this.active || !this.wallReady || type !== 'arts' || !source || source === this.u || source.side === 'enemy'
      || target?.side !== 'enemy' || !live(target)) return;
    this.syncWall();
    const state = this.wall.get(target);
    if (state?.seq === target.deploySeq && target.findBuff(this.auraKey) === state.buff
      && yuWallCrosses(this.u, source, target)) this.burn(target, this.record.bb.ep_damage_ratio, 'yu:s3:wall');
  }
  slabValue(point) {
    const range = comp('1077596554295986484');
    return (point.x - this.u.tileC) * this.u.fwd[1] + (point.y - this.u.tileR) * this.u.fwd[0] - range._horizonOffsetFront;
  }
  intercept({ projectile, from, to }) {
    if (!this.active || !this.wallReady || projectile.source?.side !== 'enemy') return false;
    const half = comp('1077596554295986484')._horizonSize / 2, a = this.slabValue(from), z = this.slabValue(to);
    const touches = Math.min(a, z) <= half && Math.max(a, z) >= -half, inside = Math.abs(z) <= half;
    const entered = touches && !this.entries.has(projectile.id);
    if (inside) this.entries.add(projectile.id); else this.entries.delete(projectile.id);
    if (!entered || this.b.rng() >= this.record.bb.prob) return false;
    const fraction = Math.abs(a) <= half ? 0 : ((a > half ? half : -half) - a) / (z - a);
    const point = { x: from.x + (to.x - from.x) * fraction, y: from.y + (to.y - from.y) * fraction };
    this.b.emit('yuIntercept', { owner: this.u, projectile, point });
    this.b.fx('intercept', { ...point, id: projectile.id, src: this.u.id }); return true;
  }
  startWall() {
    this.modeReady = true;
    this.wallReady = true; this.syncWall();
    this.core.syncRecovery();
    this.interceptor = this.b.projectiles.registerInterceptor({ owner: this.u, intercept: ctx => this.intercept(ctx) });
    this.b.removeProjectiles(p => this.intercept({ projectile: p, from: p, to: p }));
  }
  clearWall() {
    this.wallReady = false; this.interceptor?.cancel(); this.interceptor = null; this.entries.clear();
    for (const t of this.wall.keys()) this.b.removeBuff(t, this.auraKey);
    this.wall.clear();
  }
  tick() {
    if (!this.active) this.entries.clear();
    if (this.enforceCapacity) { this.enforceCapacity = false; enforceBlockCapacity(this.b, this.u); }
    for (const [buff, state] of this.pending) {
      if (!this.active || !live(state.enemy) || state.seq !== state.enemy.deploySeq || state.enemy.findBuff(state.key) !== buff) {
        this.b.removeBuff(state.enemy, buff); this.pending.delete(buff);
      } else if (due(this.b, state.due)) {
        this.pending.delete(buff); this.b.removeBuff(state.enemy, buff); this.teleport(state.enemy);
      }
    }
    this.syncWall();
    const ids = new Set(this.b.projectiles.list.map(p => p.id));
    for (const id of this.entries) if (!ids.has(id)) this.entries.delete(id);
  }
  install() {
    this.handles = [this.b.on('damaged', ctx => { this.inverse(ctx); this.wallDamage(ctx); }, { owner: this.u }),
      this.b.on('enemyHidden', () => this.syncWall(), { owner: this.u }),
      this.b.on('death', () => { this.tick(); this.core.syncRecovery(); }, { owner: this.u }),
      this.b.on('skillEnd', ({ unit }) => { if (unit === this.u) { enforceBlockCapacity(this.b, this.u); this.core.syncRecovery(); } }, { owner: this.u })];
  }
  stop() {
    this.clearPending(); this.clearWall();
    for (const h of this.handles) this.b.off(h); this.handles = [];
  }
}

export function prepareYuSkills(b, u, { contract } = {}) {
  if (contract !== YU_SKILL_CONTRACT) throw Error('Yu requires the reviewed skill contract');
  verify();
  const prepared = prepareYuCore(b, u, { contract: YU_CORE_CONTRACT });
  const bridge = new YuSkills(prepared.controller); prepared.controller.skills = bridge; bridge.install();
  const { record: r } = prepared, mods = { hpPct: r.bb.max_hp,
    ...(r.index !== 0 ? { atkPct: r.bb.atk } : {}), ...(r.index !== 1 ? { defPct: r.bb.def } : { blockCnt: r.bb.block_cnt }) };
  return { ...prepared, skills: bridge, kit: { ...prepared.kit, skill: {
    id: u.def.skill.id, name: u.def.skill.name, kind: 'duration', duration: r.source.duration,
    trigger: 'NEVER', silenceable: false, mods, attack: { dmgType: r.index === 1 ? 'arts' : 'phys' },
    canActivate: () => bridge.canCast(), onStart: () => bridge.start(), onEnd: ({ reason }) => bridge.end(reason),
  } } };
}
