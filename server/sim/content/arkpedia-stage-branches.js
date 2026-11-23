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
  start(key, { blockGameFinish = false } = {}) {
    const phase = this.branches[key];
    if (!phase) throw Error(`Unknown stage branch: ${key}`);
    const b = this.battle, serial = ++this.serial;
    if (b.finished) return false;
    for (const action of phase.spawns) for (let i = 0; i < action.count; i++) {
      const tag = `stage-branch:${serial}:${action.order}:${i}`; this.tags.add(tag);
      const spawn = () => b.spawnEnemy(stageEnemyKey(this.rules, action.enemyKey), {
        routeIndex: action.routeIndex, countInTotal: false, tag, ownerPlayerId: 'arkpedia',
      });
      const offset = action.offset + i * action.interval;
      if (offset === 0) spawn();
      else b.after(offset, spawn, { holdsBattle: blockGameFinish });
    }
    return true;
  }
}
