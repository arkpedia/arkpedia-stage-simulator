// SPDX-License-Identifier: GPL-3.0-or-later
import { stageEnemyKey } from '../../../shared/arkpedia/stage-rules.js';

/** A triggered phase owns its queue independently of the triggering body's
 * life. Branch spawns have no planned-count credit but can hold final victory. */
export class StageBranchScheduler {
  constructor(battle, branches = {}, rules) {
    this.battle = battle; this.branches = branches; this.rules = rules;
    this.serial = 0; this.tags = new Set();
    battle.on('enemySpawn', ({ enemy }) => {
      if (!this.tags.has(enemy.tag)) return;
      enemy.mem.stageBranch = true;
      // This admitted path is managed=true, extraMeta=null, non-unharmful.
      // A source enemy excluded from total also bypasses native registration.
      enemy.profile.holdsBattle = !enemy.def.notCountInTotal;
    }, { priority: 1000 });
  }
  /** Source-selected action: an activation transfers its current HP ratio to
   * one managed body, using the branch's already compiled route. */
  summon(key, actionIndex, {hpRatio=1}={}) {
    const action=this.branches[key]?.spawns.find(a=>a.order===actionIndex);
    if(!action||action.count!==1||action.offset!==0||!Number.isFinite(hpRatio)||hpRatio<=0||hpRatio>1)
      throw Error('Invalid immediate branch summon');
    const b=this.battle;if(b.finished)return null;
    const tag=`stage-branch:${++this.serial}:${action.order}:0`;this.tags.add(tag);
    return b.spawnEnemy(stageEnemyKey(this.rules,action.enemyKey),{routeIndex:action.routeIndex,
      countInTotal:false,tag,ownerPlayerId:'arkpedia',initialHpRatio:hpRatio});
  }
  /** SummonEnemiesFollowBranchRoute with _unharmful, _alwaysCountAsKilled and no scheduler management (the Explosives
   * Loading Point): the branch's single body, uncounted, never holding the battle, costing nothing if it leaks. */
  summonUnharmful(key) {
    const action = this.branches[key]?.spawns;
    if (!Array.isArray(action) || action.length !== 1 || action[0].count !== 1 || action[0].offset !== 0) throw Error('Invalid unharmful branch summon');
    const b = this.battle; if (b.finished) return null;
    const e = b.spawnEnemy(stageEnemyKey(this.rules, action[0].enemyKey), { routeIndex: action[0].routeIndex, countInTotal: false,
      tag: `stage-unharmful:${++this.serial}`, ownerPlayerId: 'arkpedia' });
    if (e) { e.mem.stageWaveUnharmful = true; e.profile.holdsBattle = false; e.counted = false; }
    return e;
  }
  /** The level-branch trigger: true while an activation branch has a phase left. */
  hasNext(key) {
    const branch = this.branches[key];
    return Array.isArray(branch?.phases) && (this.phaseIndex?.[key] ?? 0) < branch.phases.length;
  }
  /** MoveNextLevelBranch: run the next phase of an activation branch. Without `loop`, past the last phase nothing
   * happens; with `loop` (_isLoop, the Black Snake's SummonFlame) it starts again from the first phase. */
  advance(key, { loop = false } = {}) {
    const branch = this.branches[key];
    if (!Array.isArray(branch?.phases) || !branch.phases.length) throw Error(`Unknown activation branch: ${key}`);
    const b = this.battle; this.phaseIndex ??= {};
    let i = this.phaseIndex[key] ?? 0;
    if (loop) i %= branch.phases.length;
    if (b.finished || i >= branch.phases.length) return false;
    this.phaseIndex[key] = i + 1;
    for (const alias of branch.phases[i]) b.activateStagePredefined(alias);
    return true;
  }
  /** MoveNextLevelBranch on a spawn branch (the Core Amplifiers' branch): start its next phase's spawns. Past the last
   * phase nothing happens. */
  advanceSpawns(key) {
    const branch = this.branches[key];
    if (!Array.isArray(branch?.sequencePhases)) throw Error(`Unknown sequence branch: ${key}`);
    this.phaseIndex ??= {};
    const i = this.phaseIndex[key] ?? 0;
    if (this.battle.finished || i >= branch.sequencePhases.length) return false;
    this.phaseIndex[key] = i + 1;
    return this._startSpawns(branch.sequencePhases[i]);
  }
  /** PickRandomBranchPhase with _notRepeatInOneLoop: a random phase not yet run in this loop (seeded battle RNG). A
   * single-phase branch is ordinary start(). */
  startRandomPhase(key, { blockGameFinish = false } = {}) {
    const branch = this.branches[key];
    if (!branch) throw Error(`Unknown stage branch: ${key}`);
    if (!Array.isArray(branch.randomPhases)) return this.start(key, { blockGameFinish });
    this.randomLeft ??= {};
    if (!this.randomLeft[key]?.length) this.randomLeft[key] = branch.randomPhases.map((_, i) => i);
    const left = this.randomLeft[key], index = left.splice(this.battle.rng.int(left.length), 1)[0];
    return this._startSpawns(branch.randomPhases[index], { blockGameFinish });
  }
  /** SummonEnemiesFollowBranchRoute with a blackboard enemy (the upgraded Bloodcalling Altar's `talent@enemy_key`):
   * one phase's actions, each body replaced by `enemyKey`. `_summonAllRoute` false; nothing reviewed names which phase
   * of a several-phase branch it takes, so one is drawn (seeded battle RNG) [inference]. */
  summonFollowRoute(key, enemyKey) {
    const branch = this.branches[key];
    if (!branch || typeof enemyKey !== 'string' || !enemyKey) throw Error(`Unknown stage branch: ${key}`);
    const phases = Array.isArray(branch.randomPhases) ? branch.randomPhases : [branch.spawns];
    const phase = phases.length === 1 ? phases[0] : phases[this.battle.rng.int(phases.length)];
    return this._startSpawns(phase, { enemyKey });
  }
  start(key, { blockGameFinish = false } = {}) {
    const phase = this.branches[key];
    if (!phase) throw Error(`Unknown stage branch: ${key}`);
    return this._startSpawns(phase.spawns, { blockGameFinish });
  }
  _startSpawns(spawns, { blockGameFinish = false, enemyKey = null } = {}) {
    const b = this.battle, serial = ++this.serial;
    if (b.finished) return false;
    for (const action of spawns) for (let i = 0; i < action.count; i++) {
      const tag = `stage-branch:${serial}:${action.order}:${i}`; this.tags.add(tag);
      const spawn = () => b.spawnEnemy(stageEnemyKey(this.rules, enemyKey ?? action.enemyKey), {
        routeIndex: action.routeIndex, countInTotal: false, tag, ownerPlayerId: 'arkpedia',
      });
      const offset = action.offset + i * action.interval;
      if (offset === 0) spawn();
      else b.after(offset, spawn, { holdsBattle: blockGameFinish });
    }
    return true;
  }
}
