// SPDX-License-Identifier: GPL-3.0-or-later
import { chapter16Shadow, facilityShadow } from './chapter16-shadow.js';
import { MINER_BODY_RADIUS } from './chapter16-engagement.js';
export { MINER_BODY_RADIUS } from './chapter16-engagement.js';

// Original StopMcreep trigger and the miner's body collider, not its attack
// selector. Physics overlap includes both radii.
export const STRUCTURE_STOP_RADIUS = .8;
const live = u => u?.alive && u.deployed && !u.hidden;

/** Attach the retained facility/Rock Wall contract to the real stage unit. */
export function installChapter16Structures(b) {
  const structures = b.enemies.filter(u => u.mem.stageUnitDevice?.chapter16Structure);
  if (!structures.length) return;
  const env = chapter16Shadow(b);
  for (const unit of structures) {
    const spec = unit.mem.stageUnitDevice;
    const sourceLife = unit.deploySeq;
    const key = `ch16:structure-stop:${unit.id}:${sourceLife}`;
    const stopped = new Map();
    unit.mem.ch16Structure = true;
    unit.holdsBattle = false;
    unit.mem.ch16BodyRadius = .25;
    if (spec.chapter16Structure === 'rock')
      b.addBuff(unit, { key: 'ch16:rock-target-free', persist: true, flags: { untargetable: true } });
    const finishField = spec.chapter16Structure === 'facility' ? facilityShadow(b, unit) : () => {};
    const valid = () => live(unit) && unit.deploySeq === sourceLife;
    const release = target => { b.removeBuff(target, key); stopped.delete(target); };
    const cleanup = () => {
      finishField();
      for (const target of stopped.keys()) release(target);
    };
    b.on('tick', () => {
      if (!valid()) { cleanup(); return; }
      const inContact = target => live(target) && target.mem.ch16Miner
        && !target.s.flags.sleep && !target.s.flags.untargetable && !target.s.flags.stealth
        && Math.hypot(target.x - unit.x, target.y - unit.y) <= STRUCTURE_STOP_RADIUS + MINER_BODY_RADIUS + 1e-9;
      for (const [target, life] of stopped)
        if (target.deploySeq !== life || !inContact(target)) release(target);
      for (const target of b.enemies) if (inContact(target) && !stopped.has(target)) {
        stopped.set(target, target.deploySeq);
        b.addBuff(target, { key, source: unit, persist: true, flags: { noMove: true } });
      }
    });
    b.on('death', ({ unit: dead }) => { if (dead === unit) cleanup(); });
    // ON_TAKE_DAMAGE / DamageScale changes the recipient's final multiplier,
    // after DEF/RES, before shields. Do not mutate a shared area DamageInfo.
    b.on('damageFinal', c => {
      if (c.target === unit && valid() && c.source?.findBuff('enemy_mcreep_self_mark')) c.amount *= 5;
    });
  }
  if (structures.some(u => u.mem.stageUnitDevice.chapter16Structure === 'facility')) {
    const attach = unit => {
      if (unit.profile?.neutral || !live(unit) || unit.findBuff('ch16:shadow-trigger')) return;
      b.addBuff(unit, { key: 'ch16:shadow-trigger', persist: true, interval: .3,
        onTick() {
          if (!unit.blockedBy && env.isShadow(Math.round(unit.y), Math.round(unit.x))) {
            if (!unit.findBuff('mainline16_enemy_target_free[core]'))
              b.addBuff(unit, { key: 'mainline16_enemy_target_free[core]', persist: true, flags: { stealth: true } });
          } else b.removeBuff(unit, 'mainline16_enemy_target_free[core]');
        } });
    };
    for (const unit of b.enemies) attach(unit);
    b.on('enemySpawn', ({ enemy }) => attach(enemy));
  }
}
