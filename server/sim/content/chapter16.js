// SPDX-License-Identifier: GPL-3.0-or-later
// Candidate chapter 16/17 controllers. Parameters come from canonical enemy
// records; native actions are retained in arkpedia-ch16-action-source.json.
import { COLS } from '../constants.js';
import { patrolCaptain } from './chapter16-patrol.js';
import { frontlineCommander } from './chapter16-commander.js';
import { abnormalSlug } from './chapter16-abnormal-slug.js';
import { fortbreaker } from './chapter16-fortbreaker.js';
import { abnormalManglerbeast } from './chapter16-manglerbeast.js';
import { armyPhantom } from './chapter16-phantom.js';
import { shieldguard } from './chapter16-shieldguard.js';
import { lightArtillery } from './chapter16-artillery.js';
import { mobileCrossbow } from './chapter16-crossbow.js';
import { rockbreaker } from './chapter17-rockbreaker.js';
import { pollutionInfantry, pollutionBowman } from './chapter17-pollution-reactions.js';
import {ordinaryAttackFromClock} from './chapter17-ordinary-attacks.js';
import minerClock from '../../../data/candidates/arkpedia-ch16-miner-clock-contract.json' with {type:'json'};
import {minerListeners,stageLocalMinerListeners} from './chapter16-miner-listeners.js';

const living = u => u?.alive && u.deployed && !u.hidden;
const flag = (b, e, key, flags, duration) => b.addBuff(e, { key, flags, duration, persist: duration == null, refresh: 'replace' });
const operators = b => b.allyUnits.filter(u => living(u) && u.kind === 'op');

import { reverseDamage, deadSummon, chargeRift, warCaster, leakSource } from './chapter17.js';
export { chapter17Environment as chapter16Environment, reverseDamage, deadSummon, chargeRift, warCaster, leakSource, pollute, beamIntersection } from './chapter17.js';

export function miner(r) {
  if(r.key!==minerClock.enemy||r.prefabKey!==minerClock.enemy)throw Error('Unreviewed miner runtime identity');
  return minerController(r,minerListeners(r));
}

// Internal direct attachment; no feature registration or stage admission.
export function stageLocalMiner(r) {
  const equal=(a,b)=>a===b||a!==null&&b!==null&&typeof a==='object'&&typeof b==='object'
    &&Array.isArray(a)===Array.isArray(b)&&Object.keys(a).length===Object.keys(b).length
    &&Object.keys(a).every(key=>Object.hasOwn(b,key)&&equal(a[key],b[key]));
  if(!equal(r,minerClock.local.record))throw Error('Unreviewed stage-local miner record');
  return minerController(r,stageLocalMinerListeners(r));
}

function minerController(r,listeners) {
  const attack=ordinaryAttackFromClock(minerClock.cast,{tag:'chapter16',key:'ch16:miner-cast',memory:'ch16MinerAttack'});
  return {
    spawn(b, e, a) {
      e.profile.friendly = true; e.profile.neutral = true; e.profile.noAttack = true;
      e.mem.ch16Miner = true;
      b.addBuff(e, { key: 'enemy_mcreep_self_mark', persist: true });
      b.addBuff(e, { key: 'mark_neutral[effect]', persist: true });
      e.profile.meleeTarget = () => {
        return b.enemies.filter(u => u !== e && living(u) && !u.profile?.neutral && !u.profile?.friendly
          && !u.s.flags.sleep && !u.s.flags.stealth && !u.s.flags.camou
          // Native selector ignores TARGET_FREE, including the Rock Wall's
          // passive. Other invisibility states still prevent acquisition.
          && Math.hypot(u.x - e.x, u.y - e.y) <= r.stats.rawRangeRadius + (u.mem.ch16BodyRadius ?? .1) + 1e-9)
          .sort((a, z) => (z.s.taunt ?? 0) - (a.s.taunt ?? 0)
            || Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(z.x - e.x, z.y - e.y) || a.id - z.id)[0] ?? null;
      };
      b.addBuff(e, { key: 'ch16:neutral-taunt', persist: true, mods: { taunt: -1 } });
      b.on('elementHit', c => { if (c.target === e) c.cancel = true; }, { owner: e });
      flag(b, e, 'ch16:neutral', { unblockable: true });
      a.heal = 0;
      e.profile.attackCooldownAffectedBySlowDown=true;
      a.cast={};attack.spawn(b,e,a.cast);
      a.listeners={};listeners.spawn(b,e,a.listeners);
    },
    tick(b, e, a, dt) {
      attack.tick(b,e,a.cast);
      listeners.tick(b,e,a.listeners);
      if(!a.listeners.valid())return;
      const row = Math.round(e.y), col = Math.round(e.x);
      a.heal += dt;
      if (a.heal >= 1 - 1e-9) {
        a.heal -= 1;
        for (const medic of operators(b)) {
          // The native HP filter runs for each aura recipient before ATK is
          // copied. Earlier healing may fill HP or retire another source.
          if(!a.listeners.valid()||e.hp/e.s.maxHp>=1)break;
          if(!living(medic))continue;
          if (medic.def.profession !== 'MEDIC') continue;
          if (medic.rangeChanged) b._refreshRange(medic);
          if (medic.rangeKeys?.includes(row * COLS + col)) {
            // Native AssignAttributeToBB(ATK, scaleVar='') -> FixedValueHeal.
            // The retained action never reads the catalogue's legacy heal_scale.
            b.heal(medic, e, medic.s.atk);
          }
        }
      }
    },
    death(c,b,e,a){attack.death(c,b,e,a.cast);listeners.death(c,b,e,a.listeners);},
  };
}

export const chapter16Abilities = { ch17PollutionInfantry: pollutionInfantry, ch17PollutionBowman: pollutionBowman, ch17Rockbreaker: rockbreaker,
  ch16Manglerbeast: abnormalManglerbeast, ch16ArmyPhantom: armyPhantom,
  ch16AbnormalSlug: abnormalSlug, ch16Commander: frontlineCommander, ch16Fortbreaker: fortbreaker, ch16PatrolCaptain: patrolCaptain, ch16Shieldguard: shieldguard, ch16LightArtillery: lightArtillery, ch16MobileCrossbow: mobileCrossbow, ch16Miner: miner, ch16ReverseDamage: reverseDamage, ch16DeadSummon: deadSummon,
  ch16ChargeRift: chargeRift, ch16WarCaster: warCaster, ch16LeakSource: leakSource };
