// SPDX-License-Identifier: GPL-3.0-or-later
import { installStageDanger } from './arkpedia-stage-danger.js';
import { installParasiticEnvironment } from './arkpedia-stage-parasitic.js';
import { installStageSight } from './arkpedia-stage-sight.js';
/** Level-wide effects share the ordinary damage, buff and DP accounts. */
export function installStageEnvironments(b, environments = []) {
  if (b.stageEnvironments) throw Error('Stage environments already installed');
  b.stageEnvironments = environments;
  for (const [i, environment] of environments.entries()) {
    if (environment.kind === 'rogue_4_parasitic_buff') {
      installParasiticEnvironment(b, environment);
    } else if (environment.kind === 'legion_mode_enemy_boost') {
      installStageDanger(b, environment);
    } else if (environment.kind === 'strife_mode_feature') {
      if (b.stageDeadline || !Number.isSafeInteger(environment.duration) || environment.duration < 1 || environment.duration > 3600)
        throw Error('Invalid or duplicate stage deadline');
      b.stageDeadline = Object.freeze({ endAt: b.time + environment.duration, duration: environment.duration });
    } else if (environment.kind === 'periodic_damage') {
      const attach = unit => {
        if (!unit.alive || !unit.deployed || unit.side !== 'ally' || !['op', 'token'].includes(unit.kind)) return;
        const key = `stage:environment:${i}`;
        if (unit.findBuff(key)) return;
        b.addBuff(unit, { key, interval: environment.interval,
          onTick: () => b.dealDamage(null, unit, { amount: environment.damage, type: 'true',
            sourceless: true, noSp: true, isEnvironment: true, canDodge: false,
            tags: ['dot', 'periodic', 'stageEnvironment'] }) });
      };
      b.on('deploy', ({ unit }) => attach(unit));
      for (const unit of b.units) attach(unit);
    } else if (environment.kind === 'character_in_magiccircuit_env') {
      const update = () => {
        for (const unit of b.allyUnits) {
          if (!unit.alive || !unit.deployed || !['op', 'token'].includes(unit.kind)) continue;
          const key = `stage:environment:${i}`, eligible = !unit.hidden && !unit.s.flags.untargetable && b.allySelectable(unit);
          const connectedKey = 'character_in_magiccircuit[normal]';
          if (!eligible) { b.removeBuff(unit, key); b.removeBuff(unit, connectedKey); continue; }
          const connected = b.stageMagicCircuit?.contains(unit) ?? false;
          const spRecoveryFlat = environment.sp_recover_ratio;
          if (unit.findBuff(key)?.mods.spRecoveryFlat !== spRecoveryFlat)
            b.addBuff(unit, { key, mods: { spRecoveryFlat } });
          const bonus = environment['character_in_magiccircuit[normal].sp_recover_ratio'];
          if (connected && unit.findBuff(connectedKey)?.mods.spRecoveryFlat !== bonus)
            b.addBuff(unit, { key: connectedKey, mods: { spRecoveryFlat: bonus } });
          else if (!connected) b.removeBuff(unit, connectedKey);
        }
      };
      b.on('deploy', update); b.on('death', update); b.on('tick', update, { priority: 200 }); update();
    } else if (environment.kind === 'mainline12_sightManager') {
      installStageSight(b, environment);
    } else if (environment.kind === 'kill_to_add_cost') {
      b.on('death', ({ unit, reason }) => {
        if (reason === 'killed' && unit.side === 'enemy' && unit.kind === 'enemy') b.addDp('arkpedia', environment.cost);
      });
    } else throw Error(`Unimplemented stage environment runtime: ${environment.kind}`);
  }
}

/** Source TriggerEnvSystem action. A level-owned environment subscribes to this
 * event; an absent environment has no effect. Admission of the level's required
 * environment controller remains the stage compiler's responsibility. */
export function triggerStageEnvironment(battle, source, key, eventName = null) {
  if (typeof key !== 'string' || !key || eventName !== null && typeof eventName !== 'string')
    throw Error('Invalid stage environment trigger');
  battle.emit('stageEnvironmentTrigger', { key, source, eventName });
}
