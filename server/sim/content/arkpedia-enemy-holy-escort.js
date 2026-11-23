// SPDX-License-Identifier: GPL-3.0-or-later
// Vesperwings and Wasteland Robbers (enemy_1336_bldbat[_2], enemy_1337_bhrknf[_2]). Every number arrives in `p` from the
// reviewed contract (shared/arkpedia/enemy-holy-escort-features.js).
import { prepareBehaviorProgram } from '../../../shared/arkpedia/behavior-program.js';
import { projectileSingleAttack, chargedAttacks } from './arkpedia-enemy-projectiles.js';

const stageHasDevices = b => (b.mvpStageDevices?.length ?? 0) > 0 || b.units.some(u => u.kind === 'device');
const refuseDevices = (b, who) => { if (stageHasDevices(b)) throw Error(`${who}'s Holy Statue priority is not implemented on device stages`); };
const plainTarget = u => !['token', 'trap'].includes(String(u.def?.profession ?? u.profession ?? '').toLowerCase()) && u.kind !== 'device';

export function vesperwing(p) {
  const program = prepareBehaviorProgram(p.program); program.validateServices([]);
  const blackboard = program.validateBlackboard(p.blackboard);
  const shot = extra => projectileSingleAttack({ speed: p.speed, lifetime: p.lifetime, type: 'arts', ...extra });
  // BloodHit: its accepted hit runs bldrat_t_1[blood] (the program checks silence and the target's profession).
  const blood = shot({ onAcceptedImpact: (b, e, u) => program.run('ON_AFTER_OUTPUT_DAMAGE', { battle: b, unit: e, target: u, blackboard }) });
  const attacks = chargedAttacks(shot({}), blood, { initialSp: p.initialSp, cost: p.cost, increment: p.increment, maxSp: p.maxSp,
    silenceBlocksSpend: false, respectNoSp: true });
  return { ...attacks, spawn(b, e, a) { refuseDevices(b, 'Vesperwing'); attacks.spawn(b, e, a); e.def = { ...e.def, attackAnim: p.attackAnim }; } };
}

export function wastelandRobber(p) {
  if (!Number.isFinite(p?.dp) || !(p.cost >= 1)) throw Error('Invalid Wasteland Robber parameters');
  const mode = steal => {
    const shot = projectileSingleAttack({ speed: p.speed, lifetime: p.lifetime, type: 'phys',
      onAcceptedImpact: steal ? (b, e, u) => { if (!e.s.flags.silence && plainTarget(u)) b.addDp(u.ownerId, p.dp); } : null });
    return {
      spawn(b, e) { shot.spawn(b, e); },
      attack(c, b, e) {
        for (const target of c.targets) {
          if (target !== e.blockedBy) { shot.attack({ ...c, targets: [target] }, b, e); continue; }
          // Blocked: the Combat (Attack_2) strikes the blocker.
          let accepted = false;
          const off = steal ? b.on('calculatedDamage', r => { if (r.target === target && r.source === e) accepted = true; }) : null;
          try { b.dealDamage(e, target, { amount: e.s.atk, type: 'phys', isAttack: true, attackId: c.attackId ?? b._attackSeq, applyWay: 'melee' }); }
          finally { if (off) b.off(off); }
          if (steal && accepted && target.alive && !e.s.flags.silence && plainTarget(target)) b.addDp(target.ownerId, p.dp);
        }
      },
    };
  };
  const attacks = chargedAttacks(mode(false), mode(true), { initialSp: p.initialSp, cost: p.cost, increment: p.increment, maxSp: p.maxSp,
    silenceBlocksSpend: false, respectNoSp: true });
  const clip = e => { e.def = { ...e.def, attackAnim: e.blockedBy ? p.meleeAnim : p.rangedAnim }; };
  return { ...attacks,
    spawn(b, e, a) { refuseDevices(b, 'Wasteland Robber'); attacks.spawn(b, e, a); clip(e); },
    tick(_b, e) { clip(e); } };
}
