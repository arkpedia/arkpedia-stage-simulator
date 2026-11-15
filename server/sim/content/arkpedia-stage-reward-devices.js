// SPDX-License-Identifier: GPL-3.0-or-later
import { rewardDeviceDefinition } from '../../../shared/arkpedia/device-runtime.js';
import { stageDeviceAttributes } from '../../../shared/arkpedia/stage-character-attributes.js';
import { recordStageOutcome } from './arkpedia-stage-outcomes.js';
import { isHpLoss } from '../damage.js';

/** Source aliases own activation, while each spawned body owns its kill log.
 * Rewards are results for the run caller; these devices never count as waves. */
export class StageRewardDevices {
  constructor(battle, entries = []) {
    this.battle = battle; this.entries = new Map();
    for (const entry of entries) {
      if (!entry.alias || this.entries.has(entry.alias)) throw Error('Ambiguous reward-device alias');
      this.entries.set(entry.alias, { ...entry, activated: false, unit: null });
    }
    for (const entry of this.entries.values()) if (!entry.hidden) this.activate(entry.alias);
  }
  activate(alias) {
    const entry = this.entries.get(alias);
    if (!entry) return false;
    if (entry.activated) return true;
    const b = this.battle, spec = rewardDeviceDefinition(entry.key, entry.instance);
    if (spec.mimic && !b.stageBranches?.branches[spec.branchId]) throw Error(`Missing mimic branch program: ${spec.branchId}`);
    const stats = stageDeviceAttributes(b.stageCardRules, entry.key, spec);
    const initialize = unit => {
      unit.def.profession = 'TRAP'; unit.def.immune = new Set(spec.immune); unit.base.tauntLevel = spec.taunt;
      unit.profile.characterLikeDevice = true;
      unit.deploymentSlotCost = 0; unit.profile.holdsBattle = false;
      unit.mem.stageRewardAlias = alias; unit.markDirty();
      if (spec.epochChild) {
        b.addBuff(unit, { key: 'skztzs_self_mark', persist: true });
        const child = b.spawnEnemy(spec.epochChild, { pos: [entry.row, entry.col], countInTotal: false });
        if (!child) throw Error('Missing compiled Epoch Mark dependency');
        b.on('death', ({ unit: removed }) => {
          if (removed === unit && child.alive) b.kill(child);
        }, { owner: unit });
      }
      if (spec.rescue) installRescueObjective(b, unit, spec.counter);
      else if (spec.mimic) {
        b.addBuff(unit, { key: 'stage:stationaryReward', flags: { noMove: true } });
        b.on('damaged', event => {
          if (event.target !== unit || !unit.alive || unit.mem.stageMimicTriggered || isHpLoss(event.dmg) || event.type === 'element') return;
          unit.mem.stageMimicTriggered = true;
          b.stageBranches.start(spec.branchId, { blockGameFinish: false });
          b.kill(unit, unit);
        }, { owner: unit });
      }
      else {
        b.addBuff(unit, { key: 'stage:stationaryReward', flags: { noMove: true } });
        b.on('death', event => {
          if (event.unit !== unit || event.reason !== 'killed' || unit.mem.stageRewardLogged) return;
          unit.mem.stageRewardLogged = true; recordStageOutcome(b, unit, spec.counter);
        }, { owner: unit });
      }
    };
    const unit = b.spawnDevice(entry.key, entry.row, entry.col, { side: spec.side, name: spec.name,
      hp: stats.hp, def: stats.def, res: stats.res, blockCnt: stats.block, initialize });
    // A failed occupied-tile activation finishes this action. It does not
    // silently retry on a later frame or remove an existing operator.
    entry.activated = true;
    if (!unit) return true;
    entry.unit = unit;
    return true;
  }
}

function installRescueObjective(b, unit, counter) {
  unit.profile.characterLikeDevice = true; unit.profile.enemyTargetableDevice = true;
  b.addBuff(unit, { key: 'stage:rescueIdentity', persist: true,
    flags: { noMove: true, targetFree: true, undeadable: true }, mods: { taunt: -1 } });
  // Native initialization takes one maximum-HP amount with an undeadable floor,
  // before publishing the placed body to deployment observers.
  unit.hp = Math.min(1, unit.s.maxHp);
  const complete = () => {
    if (!unit.alive || !unit.deployed || unit.hp < unit.s.maxHp || unit.mem.stageRewardLogged) return;
    unit.mem.stageRewardLogged = true; recordStageOutcome(b, unit, counter);
    b.kill(unit, unit);
  };
  b.on('healed', event => { if (event.target === unit) complete(); }, { owner: unit });
  let elapsed = 0;
  b.on('tick', ({ dt }) => {
    if (!unit.alive || !unit.deployed) return;
    elapsed += dt;
    if (elapsed + 1e-7 >= .1) { elapsed %= .1; complete(); }
  }, { owner: unit });
}
