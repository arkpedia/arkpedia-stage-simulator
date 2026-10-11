// SPDX-License-Identifier: GPL-3.0-or-later
// Pinned Global tables + original client evidence: data/arkpedia-utility-prefabs.json.
import { UTILITY_OPERATORS } from '../../../shared/arkpedia/utility-operators.js';
import { absoluteRangeKeys } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { acquireTargets, performAttack } from '../ai.js';

const nearbyGrid = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,0],[0,1],[1,-1],[1,0],[1,1]];
const physicianGrid = [[1,0],[1,1],[0,0],[0,1],[0,2],[-1,0],[-1,1]];
const live = u => u.alive && u.deployed && !u.hidden;
const selectable = u => live(u) && !u.s.flags.untargetable && !u.s.flags.sleep && !u.s.flags.isolated;
const keys = (grid, u) => new Set(absoluteRangeKeys(grid, u.tileR, u.tileC, u.dir));
const resistance = (b, u, t, bb) => bb && b.applyStatus(t, 'resist', {
  duration: bb['status_resistance[limit]'], value: -bb.one_minus_status_resistance, source: u,
});

export function customizeUtilityKit({ battle, id, def, kit, unit }) {
  if (!UTILITY_OPERATORS[id]) return;
  if (id === 'char_376_therex') return;
  const s = def.skill, bb = s?.bb;
  if (id === 'char_199_yak' && s) {
    kit.skill.mods = s.id === 'skchr_yak_1'
      ? { hpPct: bb.max_hp, hpRegen: bb.hp_recovery_per_sec }
      : { hpPct: bb.max_hp, defPct: bb.def, resMul: 1 + bb.magic_resistance };
  } else if (id === 'char_4130_luton' && s?.id === 'skchr_luton_2') {
    kit.skill = { id: s.id, name: s.name, kind: 'duration', duration: s.duration,
      mods: { defPct: bb.def }, attack: { noAttack: true },
      onStart: ({ unit }) => { unit.mem.magneticTimer = 0; },
      onTick: ({ battle: b, unit: u, dt }) => {
        u.mem.magneticTimer += dt;
        while (u.mem.magneticTimer + 1e-9 >= bb.interval) {
          u.mem.magneticTimer -= bb.interval;
          const range = absoluteRangeKeys(s.rangeGrid, u.tileR, u.tileC, u.dir);
          for (const e of b.enemiesInKeys(range, u, { canHitFly: false })) {
            b.dealDamage(u, e, { amount: u.s.atk * bb.magic_atk_scale, type: 'arts', isSkill: true });
            // The source Pull selector excludes blocked enemies; no block is
            // broken by the field. Pulls obey the same force/weight rules.
            if (e.alive && !e.blockedBy) b.pull(e, bb.p_force,
              { to: { x: u.x, y: u.y }, center: u });
          }
        }
      },
    };
  } else if (id === 'char_385_finlpp' && s) {
    if (s.id === 'skchr_finlpp_1') {
      kit.skill = { id: s.id, name: s.name, kind: 'instant',
        onStart: ({ battle: b, unit: u }) => {
          const targets = b.allyUnits.filter(t => live(t) && t.kind !== 'device'
            && bodyInKeys(t, u.rangeKeySet) && (t === u || !(t.s.flags.noHeal || t.profile.noHeal)));
          performAttack(b, u, { ...u.profile, isSkill: true, attackVisual: 'skill',
            windup: 17 / 30, healProjectileSpeed: 0, healScale: bb.heal_scale }, targets);
        },
      };
    } else {
      kit.skill = { id: s.id, name: s.name, kind: 'duration', duration: s.duration,
        mods: { batMul: bb.base_attack_time },
        attack: { dmgType: 'heal', windup: 0, healProjectileSpeed: 0, healScale: bb['attack@heal_scale'],
          heal: { mode: 'single', priority: 'random',
            scaleForTarget: (b, u, t) => bodyInKeys(t, keys(physicianGrid, u)) ? 1 : def.traitBb.heal_scale },
        },
      };
    }
  } else if (id === 'char_4041_chnut' && s) {
    if (s.id === 'skchr_chnut_1') {
      kit.skill = { id: s.id, name: s.name, kind: 'charges', charges: bb.cnt,
        canActivate: () => battle.injuredAlliesInKeys(unit.rangeKeys, unit, true).length > 0,
        // The cast is a source
        // skill heal, rather than waiting for the next normal-heal cooldown.
        onStart: ({ battle: b, unit: u }) => {
          const targets = acquireTargets(b, u, u.profile);
          performAttack(b, u, { ...u.profile, isSkill: true, attackVisual: 'skill', windup: 14 / 30, healProjectileSpeed: 0,
            heal: { ...u.profile.heal,
              elementHealRatio: (b, u, t) => chestnutElementRatio(u, t, def) * bb.trait_scale } }, targets);
          u.atkCd = u.s.interval;
        },
      };
    } else {
      kit.skill = { id: s.id, name: s.name, kind: 'duration', duration: s.duration,
        mods: { aspd: bb.attack_speed }, targeting: { rangeGrid: s.rangeGrid },
        onStart: ({ unit: u }) => { u.mem.chestnutPrevious = null; },
        onEnd: ({ unit: u }) => { u.mem.chestnutPrevious = null; },
        attack: { dmgType: 'heal', windup: 19 / 30,
          heal: { mode: 'single',
            scaleForTarget: (b, u, t) => u.mem.chestnutPrevious === t.id ? bb['attack@heal_continuously_scale'] : 1,
            elementHealRatio: (b, u, t) => chestnutElementRatio(u, t, def)
              * (u.mem.chestnutPrevious === t.id ? bb['attack@heal_continuously_scale'] : 1),
          },
        },
      };
    }
  }
}

function chestnutElementRatio(u, target, def) {
  return def.traitBb.ep_heal_ratio * (target.ground ? def.talents[0]?.bb.ep_heal_scale ?? 1 : 1);
}

/** A duration-bound source aura: updates late deployments; cleans up on exit. */
function timedAura(b, u, duration, refresh, clear) {
  let ends = Infinity;
  const sync = () => {
    if (!live(u) || b.time >= ends - 1e-9) { clear(); return; }
    refresh();
  };
  b.on('deploy', ({ unit }) => {
    if (unit === u) { ends = b.time + duration; b.after(duration, clear, { owner: u }); }
    sync();
  }, { owner: u });
  b.on('tick', sync, { owner: u });
  b.on('death', ({ unit }) => { if (unit === u) clear(); }, { owner: u });
}

export function installUtility({ battle: b, unit: u, def }) {
  const id = def.charId;
  if (!UTILITY_OPERATORS[id]) return;
  if (id === 'char_376_therex') u.profile.noAttack = true;
  const bb = def.talents[0]?.bb;
  if (id === 'char_199_yak' && bb) b.addBuff(u, {
    key: 'matterhorn:res', persist: true, allowDead: true, mods: { resFlat: bb.magic_resistance },
  });
  if (id === 'char_4130_luton') {
    u.profile.noHeal = true;
    if (bb) b.on('fatal', ({ unit: e }) => {
      if (live(u) && e.side === 'enemy' && e.blockedBy === u)
        b.heal(u, u, u.s.maxHp * bb.hp_ratio, { self: true, ignoreHealFree: true });
    }, { owner: u });
  }
  if (id === 'char_385_finlpp') {
    u.profile.windup = 11 / 30;
    u.profile.healProjectileSpeed = 12;
    u.profile.heal = { ...u.profile.heal,
      // Replace the generic Chebyshev-distance shortcut with the source
      // physician inner range, avoiding a second penalty on the same heal.
      farMul: null,
      scaleForTarget: (b, u, t) => bodyInKeys(t, keys(physicianGrid, u)) ? 1 : def.traitBb.heal_scale };
    u.profile.afterHeal = (b, u, t) => resistance(b, u, t, bb);
  }
  if (id === 'char_4041_chnut') {
    u.profile.windup = 25 / 30;
    u.profile.healProjectileSpeed = 7;
    u.profile.heal = { ...u.profile.heal,
      elementHealRatio: (b, u, t) => chestnutElementRatio(u, t, def) };
    u.profile.afterHeal = (b, u, t) => { u.mem.chestnutPrevious = t.id; };
    if (def.skill.id === 'skchr_chnut_1') u.skill.spec.canActivate = () =>
      b.injuredAlliesInKeys(u.rangeKeys, u, true).length > 0;
  }
  if (!bb) return;
  if (id === 'char_285_medic2') b.on('deploy', ({ unit }) => {
    if (unit === u) for (const ally of b.allyUnits.filter(live)) b.heal(u, ally, bb.value);
  }, { owner: u });
  if (id === 'char_286_cast3' || id === 'char_4000_jnight' || id === 'char_4093_frston') {
    const key = `robot:aura:${u.id}`;
    const clear = () => {
      for (const ally of b.allyUnits) b.removeBuff(ally, key);
      for (const enemy of b.enemies) b.removeBuff(enemy, key);
    };
    const refresh = () => {
      const range = keys(id === 'char_4093_frston' ? nearbyGrid : u.def.rangeGrid, u);
      for (const ally of b.allyUnits) {
        const eligible = selectable(ally) && ally.kind !== 'device'
          && (id !== 'char_4093_frston' || !(ally.s.flags.noHeal || ally.s.flags.healFree || ally.profile.noHeal))
          && (id === 'char_286_cast3'
          ? ally.ground : bodyInKeys(ally, range)
            && (id !== 'char_4000_jnight' || ally.def.position === 'RANGED'));
        if (eligible) {
          if (!ally.findBuff(key)) b.addBuff(ally, { key, source: u,
            mods: id === 'char_286_cast3' ? { atkPct: bb.atk, defPct: bb.def }
              : id === 'char_4000_jnight' ? { taunt: bb['jnight_t.taunt_level'] }
                : { flatDamageResistance: -bb.damage_resistance } });
        } else if (id !== 'char_4093_frston') b.removeBuff(ally, key);
      }
      if (id === 'char_4000_jnight') for (const enemy of b.enemies) {
        if (selectable(enemy) && enemy.isFlying && bodyInKeys(enemy, range))
          b.applyStatus(enemy, 'fragile', { key, source: u, duration: .1, value: bb.damage_scale - 1 });
        else b.removeBuff(enemy, key);
      }
    };
    timedAura(b, u, bb.duration, refresh, clear);
  }
  if (id === 'char_376_therex') b.on('deploy', ({ unit }) => {
    if (unit !== u) return;
    b.after(bb.interval, () => {
      if (!live(u)) return;
      const range = absoluteRangeKeys(nearbyGrid, u.tileR, u.tileC, u.dir);
      for (const e of b.enemiesInKeys(range, u, { canHitFly: true })) {
        b.dealDamage(u, e, { amount: u.s.atk * bb.damage_by_atk_scale, type: 'phys' });
        if (e.alive) b.applyStatus(e, 'fragile', {
          duration: bb['weak[limit]'], value: bb.damage_scale - 1, source: u,
        });
      }
      b.retreat(u, { permanent: true });
    }, { owner: u });
  }, { owner: u });
  if (id === 'char_4188_confes') b.on('blocked', ({ blocker, enemy }) => {
    if (blocker !== u || u.mem.confessTriggered) return;
    u.mem.confessTriggered = true;
    b.addDp(u.ownerId, bb.cost);
    b.applyStatus(enemy, 'sleep', { duration: bb.sleep, source: u });
  }, { owner: u });
}
