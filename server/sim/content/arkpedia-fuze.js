// SPDX-License-Identifier: GPL-3.0-or-later
// Source-fed ordinary kit. Geometry is corroborated by authored gameplay notes;
// compiled native FSM, projectile dispatch and frame parity remain unverified.
import evidence from '../../../data/arkpedia-fuze-prefabs.json' with { type: 'json' };
import { sourceCandidate } from '../../../shared/arkpedia/summons.js';
import { canTargetEnemy, sortEnemyTargets, absoluteRangeKeys } from '../targeting.js';
import { bodyInKeys, bodyInRadius } from '../body.js';
import { rotateOffset } from '../dir.js';
import { OB_BLOCK, OB_CRATE } from '../grid.js';
import { COLS } from '../constants.js';
import { resolveHit } from '../ai.js';

export const FUZE_ID = 'char_4126_fuze';
export const FUZE_CONTRACT = Object.freeze({
  phase: 'source-transitions-capped-events-and-attack-cooldown-v1',
  geometry: 'contiguous-three-cell-width-right-to-left-v1',
  grenade: 'speed-eight-then-source-reached-delay-v1',
  damage: 'all-grounded-stop-recipients-current-source-atk-v1',
  shield: 'ranged-modifier-source-physical-block-v1',
  reviewNote: 'Destination width follows published gameplay observations. Gadget origin, exact offset endpoints, phase clocks, stop-area dispatch and transferred-source statistics are local mappings. Compiled native callbacks, modules and original particles/audio are unverified.',
});
const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const flat = rows => Object.fromEntries(rows.map(v => [v.key, v.value]));
const model = u => evidence.models[FUZE_ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const component = (group, id) => Object.values(group).flatMap(rs => rs.flatMap(r => r.components)).find(c => c.pathId === id)?.data;
const mover = component(evidence.projectiles, '-1799061712939353497');
const projectile = component(evidence.projectiles, '6581086060126173799');
const emission = component(evidence.skills, '1058628261399541707');
const radius = component(evidence.projectiles, '7514207246336096871')?.m_Radius;
const same = (a, z) => JSON.stringify(a) === JSON.stringify(z);

/** The central tile two steps forward must pass ground units. Its passable
 * left/right neighbours contribute to one contiguous width. Five endpoints
 * cover the width from the right edge to the left edge, turning with facing.
 * Dynamic hard obstacles/crates may supply the front blocking surface. */
export function fuzeClusterGeometry(b, u) {
  const point = (cross, forward) => {
    const [dr, dc] = rotateOffset(cross, forward, u.dir);
    return { x: u.tileC + dc, y: u.tileR + dr };
  };
  const front = point(0, 1), center = point(0, 2), tile = b.grid.tile(front.y, front.x);
  if (!b.grid.inRect(front.y, front.x) || !b.grid.inRect(center.y, center.x)
    || tile.height !== 'HIGH' && !(b.grid.obstacle[front.y * COLS + front.x] & (OB_BLOCK | OB_CRATE))
    || !b.grid.groundPassable(center.y, center.x)) return null;
  const right = point(-1, 2), left = point(1, 2);
  const lo = b.grid.groundPassable(right.y, right.x) ? -1 : 0;
  const hi = b.grid.groundPassable(left.y, left.x) ? 1 : 0;
  const width = hi - lo + 1;
  return { front, center, width, spacing: width * emission._offset,
    destinations: Array.from({ length: emission._additionalTimes + 1 }, (_, i) =>
      point(lo - .5 + width * (emission._beginOffset + i * emission._offset), 2)) };
}

export function selectedFuzeBuild(u) {
  const build = { ...u.def.raw.arkpedia, skillId: u.def.skill?.id }, c = evidence.tables.character;
  if (u.def.charId !== FUZE_ID || !Number.isInteger(build.elite) || !c.phases[build.elite]
    || !Number.isInteger(build.level) || build.level < 1 || build.level > c.phases[build.elite].maxLevel
    || !Number.isInteger(build.potential) || build.potential < 1 || build.potential > 6
    || !Number.isInteger(build.skillRank) || build.skillRank < 1 || build.skillRank > [4, 7, 10][build.elite]
    || build.module && build.module !== 'none'
    || u.def.raw.arkpedia.skillId != null && u.def.raw.arkpedia.skillId !== build.skillId)
    throw Error('Invalid Fuze selected build');
  const index = ['skchr_fuze_1', 'skchr_fuze_2'].indexOf(build.skillId), s = u.def.skill;
  const selected = evidence.tables.skills[build.skillId]?.levels[build.skillRank - 1];
  const grid = id => id ? evidence.tables.ranges[id].grids.map(v => [v.row, v.col]) : [];
  if (!selected || index > build.elite || s.spType !== 'time' || s.skillType !== 'MANUAL'
    || s.spCost !== selected.spData.spCost || s.initSp !== selected.spData.initSp
    || s.duration !== selected.duration || s.maxCharges !== selected.spData.maxChargeTime
    || !same(s.bb, flat(selected.blackboard)) || !same(s.rangeGrid ?? [], grid(selected.rangeId))
    || !same(u.rangeGrid, grid(c.phases[build.elite].rangeId)))
    throw Error('Incomplete Fuze selected skill or range');
  if (mover._speed !== 8 || mover._delayAfterReached <= 0 || projectile._lifeTime !== 10
    || projectile._stopWhenSourceInvalid !== 0 || projectile._managedBySource !== 0
    || emission._additionalTimes !== 4 || emission._triggerDelta !== .5 || emission._offset !== .25
    || emission._beginOffset !== 0 || emission._useCachedAtkOnly !== 0 || radius !== 1.2000000476837158)
    throw Error('Unreviewed Fuze grenade source');
  return { build, index, selected, talent: sourceCandidate(c.talents[0].candidates, build) };
}

export class FuzeController {
  constructor(b, u, record, contract) {
    if (!Object.keys(FUZE_CONTRACT).filter(k => k !== 'reviewNote').every(k => contract?.[k] === FUZE_CONTRACT[k])
      || typeof contract?.reviewNote !== 'string' || !contract.reviewNote.trim())
      throw Error('Fuze requires reviewed execution contracts');
    this.b = b; this.u = u; this.record = record; this.phase = null; this.mode = 0;
    this.uses = 0; this.stopped = false; this.handles = []; this.born = new Set();
    this.controlEpoch = u.attackControlEpoch;
  }
  visual(clip, speed = 1, loop = false) {
    if (!Object.hasOwn(model(this.u).durations, clip)) throw Error(`Missing Fuze original clip ${clip}`);
    this.u.mem.regularFormVisual = { clip, speed, loop };
  }
  idle() { this.visual(this.mode === 1 ? 'Skill_1_Idle' : 'Idle', 1, true); }
  canCast() {
    const u = this.u;
    return !this.stopped && !this.b.finished && live(u) && u.canAct && !u.s.flags.disarm
      && !u.s.flags.silence && !u.s.flags.noSp && !u.skill.active
      && !['entrance', 'skill-begin', 'skill-end', 'cluster'].includes(this.phase?.kind)
      && (this.record.index === 0 || this.uses < u.def.skill.bb.skill_max_trigger_time && !!fuzeClusterGeometry(this.b, u));
  }
  candidates() {
    const u = this.u, keys = this.mode === 1 ? u.rangeKeySet
      : new Set(absoluteRangeKeys(u.rangeGrid, u.tileR, u.tileC, u.dir));
    const rows = this.b.enemies.filter(e => canTargetEnemy(u, e, { canHitFly: true })
      && (!e.s.flags.camou || e.blockedBy === u) && (bodyInKeys(e, keys) || e.blockedBy === u));
    sortEnemyTargets(this.b, u, rows);
    return rows.slice(0, Math.max(1, Math.floor(u.s.blockCnt)));
  }
  fire(e, info) {
    const p = this.phase, u = this.u;
    if (this.stopped || !live(u) || !u.canAct || u.s.flags.disarm || p?.kind !== 'attack'
      || this.b.time + 1e-9 < p.releaseAt || p.mode !== this.mode || p.seq !== u.deploySeq
      || p.epoch !== u.attackControlEpoch || !p.targets.some(t => t.unit === e && t.seq === e.deploySeq)
      || p.born.has(e) || p.born.size >= Math.max(1, Math.floor(u.s.blockCnt))
      || !this.candidates().includes(e)) return false;
    p.born.add(e);
    resolveHit(this.b, u, { dmgType: 'phys', atkScale: 1, hits: 1, applyWay: 'melee' }, e,
      { ...info, isSkill: p.mode === 1 }, e.x, e.y);
    return true;
  }
  startSkill() {
    this.u.atkCd = 0;
    if (this.record.index === 0) {
      this.mode = 1; this.visual('Skill_1_Begin');
      this.phase = { kind: 'skill-begin', readyAt: this.b.time + model(this.u).durations.Skill_1_Begin };
    } else {
      const geometry = fuzeClusterGeometry(this.b, this.u);
      if (!geometry) throw Error('Fuze charge geometry changed before activation');
      this.uses++;
      const clip = this.u.dir === 'DOWN' ? 'Skill_Down_2' : 'Skill_2';
      const event = model(this.u).eventPayloads[clip].find(e => e.name === 'OnAttack');
      this.visual(clip);
      this.phase = { kind: 'cluster', geometry, seq: this.u.deploySeq,
        epoch: this.u.attackControlEpoch, bornAt: this.b.time, releaseAt: this.b.time + event.time,
        next: 0, readyAt: this.b.time + model(this.u).durations[clip] };
    }
  }
  endSkill() {
    if (this.stopped || !live(this.u) || this.b.finished) return;
    this.mode = 0; this.u.atkCd = 0;
    if (this.record.index === 0) {
      this.visual('Skill_1_End'); this.b.addBuff(this.u, { key: 'fuze:end', flags: { noSp: true } });
      this.phase = { kind: 'skill-end', readyAt: this.b.time + model(this.u).durations.Skill_1_End };
    } else { this.phase = null; this.idle(); }
  }
  emitGrenade(p, index) {
    const b = this.b, u = this.u, destination = p.geometry.destinations[index];
    const shot = { source: u, ownerSeq: u.deploySeq, index, destination: { ...destination },
      birthAt: b.time, attackId: ++b._attackSeq, stopped: false, emitted: false };
    this.born.add(shot);
    const land = () => {
      if (b.finished || shot.stopped) return;
      shot.reachedAt = b.time;
      // The original projectile has a finite total life. Force-reach at that
      // bound must not schedule a second full delay beyond it. The shared
      // fixed-step loop may dispatch at the following tick.
      const delay = Math.min(mover._delayAfterReached, Math.max(0, shot.birthAt + projectile._lifeTime - b.time));
      shot.timer = b.after(delay, () => {
        if (b.finished || shot.stopped) return;
        const victims = b.enemies.filter(e => e.motion !== 'FLY'
          && canTargetEnemy(u, e, { canHitFly: false, groundOnly: true })
          && bodyInRadius(e, destination.x, destination.y, radius));
        for (const e of victims) resolveHit(b, u, { dmgType: 'phys', atkScale: u.def.skill.bb.atk_scale,
          hits: 1, applyWay: 'ranged' }, e, { isSkill: true, isProjectile: true, attackId: shot.attackId }, e.x, e.y);
        shot.emitted = true; shot.stopAt = b.time; this.born.delete(shot);
        b.fx('explode', { ...destination, radius }); b.emit('fuzeGrenadeStop', { shot, victims });
        if (this.stopped && !this.born.size) this.clearFinishHook();
      });
    };
    shot.projectile = b.addProjectile({ from: p.geometry.front, to: destination, source: u,
      speed: mover._speed, maxAge: projectile._lifeTime, visual: 'bomb',
      data: { arkpediaTrackedVisual: true }, onHit: land });
    b.emit('fuzeGrenadeBirth', { shot });
  }
  interrupt() {
    const cluster = this.phase?.kind === 'cluster';
    this.phase = null;
    if (cluster && this.u.skill.active) this.u.skill.end('interrupt');
    else this.idle();
  }
  tick() {
    const b = this.b, u = this.u;
    if (this.stopped) return;
    if (!live(u) || b.finished) { this.stop(); return; }
    let p = this.phase;
    if (p?.kind === 'entrance' || p?.kind === 'skill-begin' || p?.kind === 'skill-end') {
      if (b.time + 1e-9 >= p.readyAt) {
        if (p.kind === 'skill-end') b.removeBuff(u, 'fuze:end');
        this.phase = null; this.idle();
      }
      this.controlEpoch = u.attackControlEpoch; return;
    }
    if (!u.canAct || u.s.flags.disarm || this.controlEpoch !== u.attackControlEpoch) {
      this.controlEpoch = u.attackControlEpoch; this.interrupt(); return;
    }
    if (p?.kind === 'cluster') {
      while (p.next < p.geometry.destinations.length && b.time + 1e-9 >= p.releaseAt + p.next * emission._triggerDelta) {
        this.emitGrenade(p, p.next++);
      }
      if (b.time + 1e-9 >= p.readyAt) u.skill.end('cast');
      return;
    }
    if (p?.kind === 'attack') {
      if (!p.released && b.time + 1e-9 >= p.releaseAt) {
        p.released = true;
        const targets = p.targets.filter(t => t.unit.deploySeq === t.seq).map(t => t.unit)
          .filter(e => this.candidates().includes(e));
        if (targets.length) b.forceAttack(u, targets);
        if (this.phase !== p) return; // Last round started the original End.
      }
      if (b.time + 1e-9 < p.readyAt) return;
      this.phase = null;
    }
    if (u.atkCd > 1e-9) return;
    const targets = this.candidates();
    if (!targets.length) { this.idle(); return; }
    const clip = this.mode === 1 ? 'Skill_1_Loop' : 'Attack', m = model(u);
    const speed = Math.min(1, u.base.bat / u.s.interval);
    this.visual(clip, speed);
    const windup = m.eventPayloads[clip].find(e => e.name === 'OnAttack').time / speed;
    this.phase = { kind: 'attack', mode: this.mode, seq: u.deploySeq, epoch: u.attackControlEpoch,
      targets: targets.map(unit => ({ unit, seq: unit.deploySeq })), born: new Set(), released: false,
      releaseAt: b.time + windup,
      // Animation acceleration is capped; the next attack follows its own
      // interval and may restart the original Loop before that clip ends.
      // Waiting a whole unscaled Loop would erase S1's ASPD increase.
      readyAt: b.time + Math.max(u.s.interval, windup) };
    u.atkCd = u.s.interval;
  }
  clearFinishHook() { if (this.finishHook) this.b.off(this.finishHook); this.finishHook = null; }
  cancelBorn() {
    for (const shot of this.born) {
      shot.stopped = true; shot.timer?.cancel();
      this.b.projectiles.remove(p => p === shot.projectile);
    }
    this.born.clear(); this.clearFinishHook();
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.phase = null; this.u.skill?.end('owner-finish');
    this.b.removeBuff(this.u, 'fuze:end'); this.u.mem.regularFormVisual = null;
    for (const h of this.handles) this.b.off(h); this.handles = [];
    if (this.b.finished) this.cancelBorn(); else if (!this.born.size) this.clearFinishHook();
  }
  install() {
    if (this.handles.length || this.stopped) return;
    const b = this.b, u = this.u;
    this.finishHook = b.on('battleEnd', () => { this.stop(); this.cancelBorn(); });
    this.handles = [b.on('tick', () => this.tick(), { owner: u }),
      b.on('deploy', ({ unit }) => {
        if (unit !== u) return;
        this.visual('Start'); this.phase = { kind: 'entrance', readyAt: b.time + model(u).durations.Start };
        this.controlEpoch = u.attackControlEpoch;
      }, { owner: u }), b.on('death', ({ unit }) => { if (unit === u) this.stop(); }, { owner: u }),
      b.on('damageFinal', ctx => {
        // Native guard selects MODIFIER_SOURCE with ranged apply-way. The
        // engine's source attack profile is the local classifier, including
        // non-attack Physical receipts from that source. No flat mitigation.
        if (ctx.target === u && live(u) && this.record.talent && ctx.source?.profile?.attack === 'ranged'
          && ctx.dmg.type === 'phys' && ctx.amount > 0
          && b.rng() < flat(this.record.talent.blackboard).prob) ctx.amount = 0;
      }, { owner: u })];
  }
}

/** Selected ordinary kit; compiled native execution remains unverified. */
export function prepareFuzeKit(b, u, { contract } = {}) {
  const record = selectedFuzeBuild(u), controller = new FuzeController(b, u, record, contract), s = u.def.skill;
  const kit = {
    trait: { noAttack: true, attackDrivenSkill: true, attack: 'melee', projectile: 'none', dmgType: 'phys',
      canHitFly: true, hits: 1, requiresAcceptedLaunch: true, attackVisual: 'none',
      launchAttack: (_b, _u, _p, e, info) => controller.fire(e, info) },
    skill: { id: s.id, name: s.name, kind: record.index === 0 ? 'ammo' : 'toggle',
      duration: record.index === 0 ? 0 : model(u).durations.Skill_2,
      ammo: record.index === 0 ? s.bb['attack@trigger_time'] : 0, trigger: { rule: 'NEVER' },
      canActivate: () => controller.canCast(), manualCancel: record.index === 0,
      isExhausted: () => record.index === 1 && controller.uses >= s.bb.skill_max_trigger_time,
      remainingUses: () => record.index === 1 ? s.bb.skill_max_trigger_time - controller.uses : null,
      ...(record.index === 0 ? { mods: { atkPct: s.bb.atk, aspd: s.bb.attack_speed },
        targeting: { rangeExtend: s.bb.ability_range_forward_extend }, attack: {} } : {}),
      onStart: () => controller.startSkill(), onEnd: () => controller.endSkill(),
      ...(record.index === 1 ? { onTick: ({ skill }) => {
        skill.timeLeft = Math.max(0, (controller.phase?.readyAt ?? b.time) - b.time);
      } } : {}) },
  };
  return { record, controller, kit };
}


export function customizeFuzeKit({ battle, id, unit, kit }) {
  if (id !== FUZE_ID) return;
  if (!evidence.enabledOperators.includes(id) || evidence.runtimeMapping?.[id] !== 'fuze')
    throw Error('Fuze source record lacks a complete ordinary runtime review');
  const prepared = prepareFuzeKit(battle, unit, { contract: FUZE_CONTRACT });
  unit.mem.fuzeController = prepared.controller;
  kit.install = null; kit.talents = []; Object.assign(kit, prepared.kit);
}
export function installFuze({ unit, def }) {
  if (def.charId !== FUZE_ID) return;
  if (!unit.mem.fuzeController) throw Error('Missing selected Fuze controller');
  unit.mem.fuzeController.install();
}
