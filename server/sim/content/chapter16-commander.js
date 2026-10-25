// SPDX-License-Identifier: GPL-3.0-or-later
// Candidate only: attaching this controller does not clear an admission gate.
import { blockMcreep } from './chapter16-engagement.js';
import review from '../../../data/candidates/arkpedia-ch16-reviewed-commander.json' with { type: 'json' };
const KEY = 'enemy_uacomd_extra_power';
const present = u => u?.alive && u.deployed;

function commandField(b) {
  if (b.chapter16Commands) return b.chapter16Commands;
  const sources = new Set(), receipts = new Map();
  let refreshing = false, dirty = false;
  const valid = s => present(s.owner) && s.owner.deploySeq === s.life;
  const eligible = u => present(u) && !u.hidden && !u.isFlying && u.kind !== 'device'
    && !u.mem.stageUnitDevice && !u.s.flags.isolated && !!u.findBuff('enemy_field_army_self_mark');
  const field = b.chapter16Commands = {
    refresh() {
      if (refreshing) { dirty = true; return; }
      refreshing = true;
      try {
        do {
          dirty = false;
          for (const s of sources) if (!valid(s)) sources.delete(s);
          const provider = sources.values().next().value;
          for (const [unit, old] of receipts) {
            if (!provider || !eligible(unit) || unit.deploySeq !== old.life) {
              receipts.delete(unit);
              if (unit.deploySeq === old.life) b.removeBuff(unit, old.buff);
            }
          }
          if (!provider) continue;
          for (const unit of b.enemies) {
            if (!valid(provider)) { dirty = true; break; }
            if (!eligible(unit)) continue;
            const old = receipts.get(unit);
            if (old && unit.buffs.includes(old.buff) && old.buff.source === provider.owner) continue;
            const life = unit.deploySeq;
            const buff = b.addBuff(unit, { key: KEY, source: provider.owner, persist: true, refresh: 'replace' });
            if (buff && valid(provider) && eligible(unit) && unit.deploySeq === life && unit.buffs.includes(buff))
              receipts.set(unit, { life, buff });
            else if (buff && unit.deploySeq === life) b.removeBuff(unit, buff);
          }
        } while (dirty);
      } finally { refreshing = false; }
    },
    add(owner) {
      const source = { owner, life: owner.deploySeq };
      sources.add(source); field.refresh();
      return () => { sources.delete(source); field.refresh(); };
    },
  };
  // Global marked-unit validator; no invented distance or periodic cooldown.
  // Owner disappearance does not detach this aura (_clearBuffsWhenDisappear=0).
  b.on('enemySpawn', () => field.refresh());
  b.on('death', () => field.refresh());
  b.on('tick', () => field.refresh());
  b.on('battleEnd', () => { sources.clear(); field.refresh(); });
  return field;
}

export function frontlineCommander(r) {
  if (!Object.hasOwn(review.enemies, r.key) || r.prefabKey !== r.key) throw Error('Unreviewed Commander identity');
  const bb = r.talents.bb;
  const engagement = blockMcreep({ cnt: bb['BlockMcreep.block_mcreep_cnt'], range: bb['BlockMcreep.range_radius'],
    rangeAdd: bb['BlockMcreep.range_radius_add'], attackRange: r.stats.rawRangeRadius });
  return {
    spawn(b, e, a) {
      engagement.spawn(b, e, a);
      b.addBuff(e, { key: 'uacomd_a[effect]', persist: true });
      e.profile.attackCooldowns = { attack: 0, combat: 0 };
      e.profile.attackMode = () => e.blockedBy ? 'combat' : 'attack';
      a.disposeOrders = commandField(b).add(e);
    },
    tick(b, e, a, dt) { engagement.tick(b, e, a, dt); },
    death(c, b, e, a) { a.release(); a.disposeOrders(); },
  };
}
