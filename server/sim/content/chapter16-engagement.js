// SPDX-License-Identifier: GPL-3.0-or-later
// mainline16_g[block_mcreep] / block_mcreep[to_mcreep], retained in device-source.
import { canTargetAlly, sortAllyTargets } from '../targeting.js';
const live = u => u?.alive && u.deployed && !u.hidden;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const MINER_BODY_RADIUS = .1;

export function blockMcreep({ cnt, range, rangeAdd, attackRange = 1, markArmy = false, dualWeapon = false }) {
  if (![1, 3].includes(cnt) || !(range > 0) || !(rangeAdd >= 0) || !(attackRange > 0)) throw Error('Unreviewed BlockMcreep parameters');
  return {
    spawn(b, e, a) {
      a.scan = 0; a.engagements = new Set();
      Object.defineProperty(a, 'engagement', { get: () => a.engagements.values().next().value ?? null });
      // Weapon selection remains independent of the movement engagements.
      e.profile.melee = true; e.profile.dmgType = 'phys';
      if (dualWeapon) {
        e.profile.attackCooldowns = { attack: 0, combat: 0 };
        e.profile.attackMode = () => e.blockedBy ? 'combat' : 'attack';
      }
      if (markArmy) b.addBuff(e, { key: 'enemy_field_army_self_mark', persist: true });
      e.profile.meleeTarget = () => {
        const targets = b.enemies.filter(u => u !== e && live(u) && u.profile?.neutral
          && u.findBuff('mark_neutral[effect]') && canTargetAlly(e, u, true)
          && distance(e, u) <= attackRange + (u.mem.ch16BodyRadius ?? MINER_BODY_RADIUS) + 1e-9);
        sortAllyTargets(e, targets);
        return targets[0] ?? null;
      };
      a.release = (link = a.engagement) => {
        if (!link || !a.engagements.delete(link)) return;
        if (link.target.mem.ch16Engagement === link) {
          delete link.target.mem.ch16Engagement;
          delete link.target.mem.blockedMcreepBy;
        }
        e.mem.mcTarget = a.engagement?.target ?? null;
        b.removeBuff(e, link.sourceKey);
        b.removeBuff(link.target, link.targetKey);
      };
      a.releaseAll = () => { for (const link of [...a.engagements]) a.release(link); };
      b.on('death', ({ unit }) => {
        if (unit === e) a.releaseAll();
        else for (const link of [...a.engagements]) if (unit === link.target) a.release(link);
      }, { owner: e });
      b.on('battleEnd', a.releaseAll, { owner: e });
    },
    tick(b, e, a, dt) {
      for (const link of [...a.engagements]) if (!live(e) || e.deploySeq !== link.sourceLife || !live(link.target)
        || link.target.deploySeq !== link.targetLife || link.target.mem.ch16Engagement !== link) a.release(link);
      a.scan += dt;
      while (a.scan >= .3 - 1e-9) {
        a.scan -= .3;
        for (const link of [...a.engagements]) if (distance(e, link.target) > range + rangeAdd + 1e-9) a.release(link);
        if (a.engagements.size >= cnt || !live(e)) continue;
        // The native periodic selector acquires one nearest available miner per
        // scan, even when the source can retain several simultaneous links.
        const target = b.enemies.filter(u => live(u) && u.mem.ch16Miner && !u.mem.ch16Engagement
          && !u.s.flags.sleep && !u.s.flags.untargetable && distance(e, u) <= range + MINER_BODY_RADIUS + 1e-9)
          .sort((u, v) => distance(e, u) - distance(e, v) || u.id - v.id)[0];
        if (!target) continue;
        const link = { source: e, target, sourceLife: e.deploySeq, targetLife: target.deploySeq,
          sourceKey: `ch16:engagement-source:${target.id}`, targetKey: `ch16:engagement-target:${e.id}` };
        a.engagements.add(link); target.mem.ch16Engagement = link;
        target.mem.blockedMcreepBy = e.id; e.mem.mcTarget = a.engagement.target;
        b.addBuff(e, { key: link.sourceKey, persist: true, flags: { noMove: true }, onRemove: () => a.release(link) });
        b.addBuff(target, { key: link.targetKey, persist: true, flags: { noMove: true }, onRemove: () => a.release(link) });
      }
    },
  };
}
