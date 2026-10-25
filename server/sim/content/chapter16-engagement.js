// SPDX-License-Identifier: GPL-3.0-or-later
// mainline16_g[block_mcreep] / block_mcreep[to_mcreep], retained in device-source.
const live = u => u?.alive && u.deployed && !u.hidden;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function blockMcreep({ cnt, range, rangeAdd }) {
  if (cnt !== 1 || !(range > 0) || !(rangeAdd >= 0)) throw Error('Unreviewed BlockMcreep parameters');
  return {
    spawn(b, e, a) {
      a.scan = 0; a.engagement = null;
      // The table's applyWay NONE suppresses generic attacks; its retained
      // Default/Attack graph still performs physical melee against marked
      // neutrals. Only the engagement target below enables that attack.
      e.profile.melee = true;
      e.profile.dmgType = 'phys';
      e.profile.meleeTarget = () => {
        const link = a.engagement;
        return link && live(link.target) && link.target.deploySeq === link.targetLife ? link.target : null;
      };
      a.release = () => {
        const link = a.engagement;
        if (!link) return;
        a.engagement = null;
        if (link.target.mem.ch16Engagement === link) {
          delete link.target.mem.ch16Engagement;
          delete link.target.mem.blockedMcreepBy;
        }
        e.mem.mcTarget = null;
        b.removeBuff(e, link.sourceKey);
        b.removeBuff(link.target, link.targetKey);
      };
      b.on('death', ({ unit }) => {
        if (unit === e || unit === a.engagement?.target) a.release();
      }, { owner: e });
    },
    tick(b, e, a, dt) {
      const previous = a.engagement;
      if (previous && (!live(e) || e.deploySeq !== previous.sourceLife || !live(previous.target)
        || previous.target.deploySeq !== previous.targetLife || previous.target.mem.ch16Engagement !== previous)) a.release();
      a.scan += dt;
      while (a.scan >= .3 - 1e-9) {
        a.scan -= .3;
        // The recipient's periodic CheckTargetInRange uses the acquisition
        // radius plus range_radius_add after BlackboardAdd on buff start.
        if (a.engagement && distance(e, a.engagement.target) > range + rangeAdd + 1e-9) a.release();
        if (a.engagement || !live(e)) continue;
        const target = b.enemies.filter(u => live(u) && u.mem.ch16Miner && !u.mem.ch16Engagement
          && !u.s.flags.sleep && !u.s.flags.untargetable && distance(e, u) <= range + 1e-9)
          .sort((u, v) => distance(e, u) - distance(e, v) || u.id - v.id)[0];
        if (!target) continue;
        const link = { source: e, target, sourceLife: e.deploySeq, targetLife: target.deploySeq,
          sourceKey: `ch16:engagement-source:${target.id}`, targetKey: `ch16:engagement-target:${e.id}` };
        a.engagement = link; target.mem.ch16Engagement = link;
        target.mem.blockedMcreepBy = e.id; e.mem.mcTarget = target;
        // Native UNMOVABLE belongs to both sides, rather than a renewable
        // 0.35-second status that can leak into another deployment life.
        b.addBuff(e, { key: link.sourceKey, persist: true, flags: { noMove: true }, onRemove: a.release });
        b.addBuff(target, { key: link.targetKey, persist: true, flags: { noMove: true }, onRemove: a.release });
      }
    },
  };
}
