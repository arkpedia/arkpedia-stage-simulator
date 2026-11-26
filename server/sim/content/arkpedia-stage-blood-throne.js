// SPDX-License-Identifier: GPL-3.0-or-later
// Throne of Blood (trap_127_bldore). Reviewed in shared/arkpedia/stage-blood-throne.js. An enemy-side trap that no
// selector takes. While it stands:
// - every `amberInterval` s from its start it summons one Blood Amber on its own branch (a random phase);
// - it releases Blood Mist on its own tile when its SP is full (20 SP at 1 SP/s from 15); the skill lasts until the
//   mist ends, and the SP is read as charging only between mists [inference];
// - it holds the battle (trap_bldore_block_game) until Duq'arael's first form reaches the exit or the Throne dies;
// - a first form without it dies 0.5 s in (enemy_blord_mark); a killed first form returns on the reborn branch
//   `rebornDelay` s later (trap_bldore_summon[blord1][timer]); his defeat makes it fire Blood Surge (`surge()`);
// - Blood Amber does not lose HP (DseedHpCtrl). Once it is gone, and no Bloodcalling Altar stands, each Blood Amber
//   loses 10% of its max HP every second (enemy_dseed_hp_loss, `Passive.hp_ratio`).
// A bomb that reaches it (KillBmbcar, radius 1; arkpedia-enemy-bombs.js calls `bombed()` at the explosion's end): if
// it still holds the battle, the second form is summoned (PickRandomBranchPhase on `formTwoBranchId`, holding the
// battle); then the Throne dies, the first form dies with it (no return), and the current wave is released.
import { bloodThroneDefinition, stageDeviceSpec } from '../../../shared/arkpedia/device-runtime.js';
import { BLOOD_LORD, BLOOD_AMBER_KEY, BLOOD_SURGE_CROSS } from '../../../shared/arkpedia/stage-blood-throne.js';
import { bloodMists, BloodSurgeRound } from './arkpedia-blood-mist.js';

const AMBER_HP_LOSS = .1; // enemy_1367_dseed Passive.hp_ratio (reviewed with the record; enemy-blood-lord-features.js)
const live = u => u?.alive && u.deployed !== false && !u.hidden;

export class StageBloodThrone {
  constructor(b, devices, geometry, stage = null) {
    this.battle = b; this.entry = null; this.lords = new Set();
    const thrones = devices.filter(d => stageDeviceSpec(d)?.bloodThrone);
    if (!thrones.length) return;
    if (thrones.length !== 1) throw Error('Only one Throne of Blood per stage is modelled');
    const d = thrones[0];
    if (d.hidden) throw Error('Hidden Throne of Blood requires an activation controller');
    const spec = bloodThroneDefinition(d.instance);
    for (const key of [spec.branchId, spec.rebornBranchId, spec.formTwoBranchId])
      if (!b.stageBranches?.branches[key]) throw Error(`Missing Throne of Blood branch program: ${key}`);
    const unit = b.spawnDevice(d.key, d.row, d.col, { name: d.name, hp: spec.hp, def: spec.def, res: spec.res, blockCnt: 0, dir: spec.direction });
    if (!unit) throw Error(`Occupied Throne of Blood tile: ${d.row},${d.col}`);
    unit.def.profession = 'TRAP'; unit.deploymentSlotCost = 0; unit.mem.stageDeviceId = `stage-device:${d.key}:${d.row}:${d.col}`;
    b.changeDeviceSide(unit, 'enemy');
    b.addBuff(unit, { key: 'stage:bloodThrone', persist: true,
      flags: { invulnerable: true, untargetable: true, noMove: true, noDisplace: true, disarm: true, unblockable: true } });
    this.entry = { unit, spec, row: d.row, col: d.col, sp: spec.mist.initSp, mist: null, mists: 0, amberClock: spec.amberInterval,
      ambers: 0, returns: [], revivals: 0, rounds: [], surges: 0, destroyed: false, formTwo: 0, exited: false };
    // trap_bldore_block_game: AddGameFinishBlockerByKey until the first form leaks or the Throne dies.
    this.hold = b.after(1e9, () => {}, { holdsBattle: true });
    this.decayAt = null;
    b.on('tick', ({ dt }) => this.tick(dt));
  }
  get alive() { return !!this.entry?.unit.alive && !this.entry.destroyed; }
  /** BlordReborn (global): a first form takes trap_bldore_summon[blord1] while the Throne stands. */
  adopt(e) { if (!this.alive) return false; this.lords.add(e); return true; }
  holds(e) { return this.alive && this.lords.has(e); }
  /** enemy_blord_fountain[trigger] on the Throne: a Blood Surge round. */
  surge(source) {
    const a = this.entry;
    if (!this.alive) return null;
    const round = new BloodSurgeRound(this.battle, a.unit, { ...a.spec.surge, cross: BLOOD_SURGE_CROSS });
    round.lord = source; a.rounds.push(round); a.surges++;
    return round;
  }
  /** trap_bldore_summon[blord1] ON_OWNER_KILLED: the return timer, if the Throne lives. */
  lordKilled(e) {
    if (!this.lords.delete(e) || !this.alive) return;
    this.entry.returns.push({ at: this.battle.time + this.entry.spec.rebornDelay });
  }
  /** ON_OWNER_REACH_EXIT: the Throne no longer holds the battle. */
  lordExited(e) {
    if (!this.lords.delete(e) || !this.alive) return;
    this.entry.exited = true; this.release();
  }
  release() { if (this.hold) { this.hold.cancel(); this.hold = null; } }
  /** Within the bomb's reach of the Throne's KillBmbcar circle. */
  touches(e, collider) {
    const a = this.entry;
    return this.alive && (a.col - e.x) ** 2 + (a.row - e.y) ** 2 <= (a.spec.bombRadius + collider) ** 2 + 1e-9;
  }
  /** trap_bldore_kill[bmbcar] ON_BUFF_FINISH: the second form (while the battle is held), then the Throne's death. */
  bombed() {
    const a = this.entry, b = this.battle;
    if (!this.alive) return;
    if (this.hold) { b.stageBranches.startRandomPhase(a.spec.formTwoBranchId, { blockGameFinish: true }); a.formTwo++; }
    this.destroy();
  }
  destroy() {
    const a = this.entry, b = this.battle;
    if (!this.alive) return;
    a.destroyed = true; a.returns = []; a.rounds = []; a.mist = null;
    this.release();
    b.removeBuff(a.unit, 'stage:bloodThrone');
    b.kill(a.unit, null);
    // trap_bldore_summon[blord1] ends with the Throne: InstantKill on every first form (no return).
    for (const e of [...this.lords]) { this.lords.delete(e); if (e.alive) { e.mem.bloodLordOrphaned = true; b.kill(e, null); } }
    // trap_bldore_finish_current_wave: FinishCurrentWave, no next-wave tracking.
    b.stageWaveScheduler?.releaseCurrentWave(null);
    this.decayAt = b.time + 1;
  }
  tick(dt) {
    const a = this.entry, b = this.battle;
    if (!a) return;
    if (!this.alive) { this.decay(); return; }
    a.amberClock -= dt;
    while (a.amberClock <= 1e-9) {
      a.amberClock += a.spec.amberInterval;
      b.stageBranches.summonFollowRoute(a.spec.branchId, a.spec.amberEnemy); a.ambers++;
    }
    for (const r of [...a.returns]) if (b.time + 1e-9 >= r.at) {
      a.returns = a.returns.filter(x => x !== r); a.revivals++;
      // SummonEnemiesFollowBranchRoute, managed by the scheduler: the returned body holds the battle.
      b.stageBranches.start(a.spec.rebornBranchId, { blockGameFinish: true });
    }
    a.rounds = a.rounds.filter(r => r.tick(dt));
    if (a.mist && b.time + 1e-9 >= a.mist.end) a.mist = null;
    if (!a.mist) {
      a.sp = Math.min(a.spec.mist.spCost, a.sp + a.spec.mist.spPerSecond * dt);
      if (a.sp + 1e-9 >= a.spec.mist.spCost) {
        a.sp = 0; a.mists++;
        a.mist = bloodMists(b).release(a.unit, a.col, a.row, a.spec.mist);
      }
    }
  }
  /** enemy_dseed_hp_loss without DseedHpCtrl: every 1 s, `hp_ratio` of max HP as pure damage. */
  decay() {
    const b = this.battle;
    if (this.decayAt == null || b.time + 1e-9 < this.decayAt) return;
    this.decayAt += 1;
    if ((b.stageBloodAltars?.entries ?? []).some(x => x.unit.alive && !x.destroyed)) return;
    for (const e of b.enemies) if (live(e) && (e.defId === BLOOD_AMBER_KEY || e.def?.key === BLOOD_AMBER_KEY))
      b.dealDamage(null, e, { amount: e.s.maxHp * AMBER_HP_LOSS, type: 'true', sourceless: true, noSp: true, applyWay: 'none', tags: ['hpLoss', 'amberDecay'] });
  }
}
export { BLOOD_LORD };
