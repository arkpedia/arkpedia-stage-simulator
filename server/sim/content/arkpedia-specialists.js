// SPDX-License-Identifier: GPL-3.0-or-later
import { absoluteRangeKeys } from '../targeting.js';
import { resolveHit } from '../ai.js';

export function customizeSpecialistKit({ id, def, kit }) {
  const skill = def.skill;
  if (!skill) return;
  const bb = skill.bb;
  if (id === 'char_237_gravel') {
    kit.skill = { id: skill.id, name: skill.name, kind: 'passive',
      onStart: ({ battle, unit }) => {
        if (skill.id === 'skchr_gravel_1') {
          battle.addBuff(unit, { key: 'gravel:defense', source: unit,
            duration: bb.duration, interval: 1, mods: { defPct: bb.def },
            data: { elapsed: 0 }, onTick: ({ unit, buff }) => {
              buff.data.elapsed++;
              buff.mods.defPct = bb.def * Math.max(0, 1 - buff.data.elapsed / bb.duration);
              unit.markDirty();
            } });
        } else {
          const total = unit.s.maxHp * bb.hp_ratio;
          battle.addBuff(unit, { key: 'gravel:barrier', source: unit, visible: true,
            shield: total, duration: bb.duration, interval: 1,
            onTick: ({ unit, buff }) => {
              buff.shield = Math.max(0, buff.shield - total / bb.duration);
              unit.markDirty();
              if (buff.shield <= 1e-9) battle.removeBuff(unit, buff);
            } });
        }
      },
    };
  } else if (id === 'char_355_ethan' && skill.id === 'skchr_ethan_1') {
    kit.skill = { id: skill.id, name: skill.name, kind: 'passive', attack: {
      onEachHit: ({ battle, unit, target }) => {
        if (!target?.alive) return;
        battle.addBuff(target, { key: 'ethan:poison', source: unit,
          duration: bb['attack@duration'], interval: 1, refresh: 'extend',
          onTick: () => battle.dealDamage(unit, target, {
            amount: bb['attack@poison_damage'], type: 'arts', sourceless: true,
            tags: ['ethan:poison'],
          }) });
      },
    } };
  } else if (id === 'char_277_sqrrel') {
    const push = ({ battle, unit, target }) => {
      if (target?.alive) battle.push(target, bb.force, {
        from: unit, dir: { x: unit.fwd[1], y: unit.fwd[0] },
      });
    };
    if (skill.id === 'skchr_sqrrel_1') {
      kit.skill = { id: skill.id, name: skill.name, kind: 'instant',
        attack: { attack: 'ranged', projectile: 'orb', projectileSpeed: 10,
          dmgType: 'phys', atkScale: bb.atk_scale, onEachHit: push } };
    } else {
      if (!skill.rangeGrid?.length) throw Error('Missing source Shaw S2 range');
      kit.skill = { id: skill.id, name: skill.name, kind: 'instant',
        onStart: ({ battle, unit }) => {
          const keys = absoluteRangeKeys(skill.rangeGrid, unit.tileR, unit.tileC, unit.dir);
          const targets = battle.enemiesInKeys(keys, unit, { canHitFly: false });
          // Source cast selects all ground enemies, then each projectile
          // reaches its target at the original ten-tile-per-second speed.
          for (const target of targets) {
            battle.addProjectile({ from: unit, target, speed: 10, source: unit, visual: 'orb',
              onHit: ({ target: hit }) => {
                if (!hit?.alive) return;
                battle.dealDamage(unit, hit, { amount: unit.s.atk * bb.atk_scale,
                  type: 'phys', isAttack: true, isSkill: true });
                push({ battle, unit, target: hit });
              } });
          }
        },
      };
    }
  } else if (id === 'char_236_rope') {
    kit.skill = { id: skill.id, name: skill.name, kind: 'instant',
      attack: { dmgType: 'phys', atkScale: bb.atk_scale,
        onEachHit: ({ battle, unit, target }) => {
          if (target?.alive) battle.pullToFront(target, unit, bb.force);
        },
      },
    };
    if (skill.id === 'skchr_rope_2') {
      if (!skill.rangeGrid?.length) throw Error('Missing source Rope S2 range');
      kit.skill.targeting = { rangeGrid: skill.rangeGrid, maxTargets: bb.max_target };
      kit.skill.onStart = ({ battle, unit, skill: runtime }) => {
        if (!battle.forceAttack(unit)) runtime.end('no-target');
      };
    }
  }
}

export function installSpecialist({ battle, unit, def }) {
  const id = def.charId, talent = def.talents[0]?.bb;
  if (id === 'char_237_gravel') {
    // Original Attack has additionalTimes=1 AND splitDamage=1. Independent
    // calculator/gameplay evidence supports splitting the mitigated output:
    // two half-damage events, with target SP only on the first event.
    unit.profile.hits = 2; unit.profile.atkScale = 1;
    unit.profile.hitDamageScale = .5; unit.profile.onlyFirstHitGainsSp = true;
    if (!talent?.def) return;
    const key = `gravel:little:${unit.id}`;
    const clear = () => {
      for (const ally of battle.allyUnits) battle.removeBuff(ally, key);
    };
    const sync = () => {
      clear();
      if (!unit.alive || !unit.deployed) return;
      for (const ally of battle.allyUnits)
        if (ally.alive && ally.deployed && ally.base.cost <= talent['cond.cost'])
          battle.addBuff(ally, { key, source: unit, mods: { defPct: talent.def } });
    };
    battle.on('deploy', sync, { owner: unit });
    battle.on('death', ({ unit: dead }) => { if (dead === unit) clear(); }, { owner: unit });
  } else if (id === 'char_355_ethan') {
    // The regular character's source stats already include tauntLevel=-1.
    // Stronghold's profession helper also adds -1 for its mode-specific rows.
    const stalker = unit.findBuff('trait:stalker');
    if (stalker) { stalker.mods.taunt = 0; unit.markDirty(); }
    if (!talent) return;
    // Source additive active buff rolls independently for each struck enemy.
    const previous = unit.profile.onEachHit;
    unit.profile.onEachHit = (b, u, target, ctx) => {
      if (target?.alive) {
        const scale = u.skill.active && u.skill.id === 'skchr_ethan_2'
          ? def.skill.bb.talent_scale : 1;
        if (b.rng.chance(talent.prob * scale)) b.applyStatus(target, 'bind', {
          duration: talent.frozen_duration, source: u,
        });
      }
      if (previous) previous(b, u, target, ctx);
    };
  } else if (id === 'char_277_sqrrel') {
    if (talent) battle.addBuff(unit, { key: 'shaw:fireproof', persist: true,
      allowDead: true, mods: { resFlat: talent.magic_resistance } });
    unit.profile.hitAllBlocked = false;
    Object.defineProperty(unit.profile, 'maxTargets', {
      enumerable: true, get: () => Math.max(1, unit.s.blockCnt),
    });
  } else if (id === 'char_236_rope') {
    // Source hook projectile speed is 10; the existing orb primitive shares it.
    unit.profile.attack = 'ranged'; unit.profile.projectile = 'orb';
    unit.profile.launchAttack = (b, u, profile, target, info) => {
      // Skills wait for all hooks to finish their one-second link and then
      // the source's one-second post-delay. Normal hooks have no cast lock.
      let cast = null;
      if (info.isSkill) {
        cast = u.mem.ropeCast;
        if (!cast || cast.attackId !== info.attackId) {
          cast = { attackId: info.attackId, pending: new Set(), linkUntil: b.time };
          u.mem.ropeCast = cast;
          b.addBuff(u, { key: 'rope:cast', flags: { disarm: true, noSp: true } });
          cast.monitor = b.every(b.dt, () => {
            for (const entry of [...cast.pending])
              if (!b.projectiles.list.includes(entry.projectile)) finish(entry, false);
          }, { owner: u });
        }
      }
      const finish = (entry, linked) => {
        if (!cast?.pending.delete(entry)) return;
        cast.linkUntil = Math.max(cast.linkUntil, b.time + (linked ? 1 : 0));
        if (cast.pending.size) return;
        cast.monitor.cancel();
        b.after(Math.max(0, cast.linkUntil - b.time) + 1, () => {
          if (u.mem.ropeCast !== cast) return;
          b.removeBuff(u, 'rope:cast'); u.mem.ropeCast = null;
        }, { owner: u });
      };
      const entry = {};
      entry.projectile = b.addProjectile({ from: u, target, speed: 10,
        source: u, visual: 'orb', onHit: (c) => {
          resolveHit(b, u, profile, c.target, info, c.x, c.y);
          finish(entry, !!c.target);
        } });
      if (cast) cast.pending.add(entry);
    };
    if (talent) battle.addBuff(unit, { key: 'rope:training', persist: true,
      allowDead: true, mods: { dodgePhys: talent.prob } });
  }
}
