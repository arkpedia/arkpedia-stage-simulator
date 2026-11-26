// SPDX-License-Identifier: GPL-3.0-or-later
import { stageEnemyKey } from '../../../shared/arkpedia/stage-rules.js';
import { hasStageRandomChoices } from './arkpedia-stage-random.js';

const tagFor = (wave, fragment, action) => `stage-wave:${wave}:${fragment}:${action}`;
export function stageWaveSpawns(program, rules) {
  if (program?.schemaVersion !== 1 || !Array.isArray(program.waves)) throw Error('Invalid stage wave program');
  if (hasStageRandomChoices(program))
    throw Error('Resolve stage random choices before expanding spawns');
  return program.waves.flatMap((wave, wi) => wave.fragments.flatMap((fragment, fi) => fragment.spawns.map((action, ai) => ({
    enemyKey: stageEnemyKey(rules, action.enemyKey), routeIndex: action.routeIndex,
    count: action.count, interval: action.interval, time: action.offset,
    ...(action.unharmful ? { countInTotal: false } : {}),
    tag: tagFor(wi, fi, ai), ownerPlayerId: 'arkpedia',
  }))));
}

/** Uses the battle's existing precounted queue and spawn/death lifecycle. Future
 * fragments stay pending, so totals, timeout accounting and enemy hooks agree. */
export class StageWaveScheduler {
  constructor(battle, program) {
    this.battle = battle; this.program = program;
    this.wave = 0; this.fragment = -1; this.origin = 0; this.end = 0; this.armed = false;
    this.groups = new Map(); this.flags = new Map(); this.done = program.waves.length === 0;
    this.managed = new WeakMap();
    this.transitionLimit = program.waves.reduce((n, wave) => n + 2 * wave.fragments.length + 3, 1);
    const byTag = new Map();
    for (const pending of battle._pending) {
      if (!byTag.has(pending.tag)) byTag.set(pending.tag, []);
      byTag.get(pending.tag).push(pending);
    }
    for (const [wi, wave] of program.waves.entries()) for (const [fi, fragment] of wave.fragments.entries()) {
      const group = [];
      for (const [ai, action] of fragment.spawns.entries()) {
        const tag = tagFor(wi, fi, ai); this.flags.set(tag, action);
        for (const pending of byTag.get(tag) ?? []) {
          pending.stageOrder = action.order ?? ai;
          group.push({ pending, offset: pending.time }); pending.time = Infinity;
        }
      }
      for (const action of fragment.activations ?? []) for (let i = 0; i < action.count; i++) {
        const pending = { time: Infinity, seq: ++battle._spawnSeq, stageOrder: action.order,
          execute: () => action.withdraw ? battle.withdrawStagePredefined(action.key) : battle.activateStagePredefined(action.key) };
        battle._pending.push(pending); group.push({ pending, offset: action.offset + i * action.interval });
      }
      this.groups.set(`${wi}:${fi}`, group);
    }
    // Unharmful/always-counted-as-killed is an exit-accounting flag, not
    // a request to finish an actor at spawn. Keep its wave/battle lifetime
    // unless an independently reviewed actor feature opts out.
    battle.on('enemySpawn', ({ enemy }) => {
      if (!this.flags.get(enemy.tag)?.unharmful) return;
      enemy.lpr = 0; enemy.mem.noLeak = true; enemy.mem.stageWaveUnharmful = true;
    }, { priority: 1000 });
    this.sort();
  }
  sort() { this.battle._pending.sort((a, b) => a.time - b.time || (a.stageOrder ?? a.seq) - (b.stageOrder ?? b.seq) || a.seq - b.seq); }
  membership(unit) {
    const managed = this.managed.get(unit);
    if (managed) return managed;
    const flags = this.flags.get(unit?.tag);
    return flags ? { wave: Number(unit.tag.split(':')[1]), dontBlockWave: !!flags.dontBlockWave } : null;
  }
  /** Registration affects wave clearance only. Planned kill credit, final
   * victory and route clocks remain properties of the original spawn. */
  track(unit, { wave = this.wave, dontBlockWave = false } = {}) {
    if (!unit || !Number.isInteger(wave) || wave < 0 || wave >= this.program.waves.length || typeof dontBlockWave !== 'boolean')
      throw Error('Invalid managed wave membership');
    this.managed.set(unit, Object.freeze({ wave, dontBlockWave }));
    return unit;
  }
  /** FinishCurrentWave releases the currently managed enemies, not scheduled
   * actions or their delays. The native next-wave option transfers the caller
   * without killing it; final battle clearance still observes every live body.
   * Only the reviewed zero-delta, single-source form is exposed here. */
  releaseCurrentWave(source, { trackSourceAtNextWave = false } = {}) {
    if (typeof trackSourceAtNextWave !== 'boolean' || trackSourceAtNextWave && !source)
      throw Error('Invalid wave release source');
    if (this.done) return false;
    const wave = this.wave;
    for (const unit of this.battle.enemies) {
      if (!unit.alive || unit.mem.stageBranch || !this.belongsToWave(unit)) continue;
      this.track(unit, { wave, dontBlockWave: true });
    }
    if (trackSourceAtNextWave && wave + 1 < this.program.waves.length)
      this.track(source, { wave: wave + 1 });
    return true;
  }
  /** A delayed native summon belongs to its source's wave, even after that
   * wave times out or its source dies. Capture route/position in the caller;
   * return the emitted unit(s) so timer and child share the same membership. */
  scheduleSummon(source, delay, spawn, { dontBlockWave = false } = {}) {
    if (!source || !Number.isFinite(delay) || delay < 0 || typeof spawn !== 'function' || typeof dontBlockWave !== 'boolean')
      throw Error('Invalid managed summon');
    const wave = this.membership(source)?.wave ?? this.wave;
    if (wave >= this.program.waves.length) throw Error('Cannot schedule a summon after the wave program');
    const membership = { wave, dontBlockWave };
    const timer = this.battle.after(delay, () => {
      const emitted = spawn();
      for (const unit of Array.isArray(emitted) ? emitted : emitted ? [emitted] : []) this.track(unit, membership);
    }, { holdsBattle: true });
    this.track(timer, membership);
    return timer;
  }
  belongsToWave(unit) {
    // Untagged summons still use the existing conservative battle lifetime.
    // A timed-out managed wave must not hold subsequent managed waves.
    const membership = this.membership(unit);
    return !membership || membership.wave === this.wave;
  }
  blocksWave(unit) {
    return unit.alive && unit.kind !== 'token' && unit.kind !== 'device' && unit.profile.holdsBattle !== false
      && !unit.mem.stageBranch
      && this.belongsToWave(unit) && !this.membership(unit)?.dontBlockWave;
  }
  blocksTimer(timer) {
    if (timer.cancelled || !timer.holdsBattle) return false;
    const membership = this.managed.get(timer);
    if (membership) return membership.wave === this.wave && !membership.dontBlockWave;
    return !timer.owner || this.belongsToWave(timer.owner) && !this.membership(timer.owner)?.dontBlockWave;
  }
  /** Advance at most one state. The caller alternates transitions and actual
   * spawns, so zero-delay fragments observe enemies emitted in the same tick. */
  advance() {
    if (this.done) return false;
    const battle = this.battle, now = battle.time, wave = this.program.waves[this.wave];
    if (this.fragment === -1) {
      this.end = this.origin + wave.preDelay; this.fragment = 0; this.armed = false; this.postUntil = null;
      return true;
    }
    const fragment = wave.fragments[this.fragment];
    if (fragment) {
      if (fragment.empty) { this.fragment++; return true; }
      if (!this.armed) {
        const start = this.end + fragment.preDelay;
        if (now + 1e-9 < start) return false;
        for (const { pending, offset } of this.groups.get(`${this.wave}:${this.fragment}`)) {
          pending.time = start + offset;
          pending.routeClock = Object.freeze({ wave: this.origin, fragment: start });
        }
        this.end = start + fragment.duration; this.armed = true;
        this.sort();
        return true;
      }
      if (now + 1e-9 < this.end) return false;
      // SPAWN completes synchronously after emitting the unit. blockFragment
      // concerns action completion, not the lifetime of that spawned unit.
      // Presentation actions use the compiler's declared headless completion.
      this.fragment++; this.armed = false; return true;
    }
    if (this.postUntil === null) {
      if (now + 1e-9 < this.end) return false;
      const blocked = battle.enemies.some(unit => this.blocksWave(unit)) || battle._sched.some(s => this.blocksTimer(s));
      const canTimeout = this.wave + 1 < this.program.waves.length && wave.maxWait !== -1;
      if (blocked && (!canTimeout || now + 1e-9 < this.end + wave.maxWait)) return false;
      this.postUntil = now + wave.postDelay;
      return true;
    }
    if (now + 1e-9 < this.postUntil) return false;
    this.wave++; this.origin = now; this.fragment = -1;
    this.done = this.wave === this.program.waves.length;
    return true;
  }
}
