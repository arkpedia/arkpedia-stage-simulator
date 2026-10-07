// SPDX-License-Identifier: GPL-3.0-or-later
// Regular-stage kits verified against pinned Global skill/talent tables and
// original Android 26-09-23-17-49-43_b9cc4a charpack/[uc]skills prefabs.
import { absoluteRangeKeys } from '../targeting.js';
import { COLS } from '../constants.js';

export const GUARD_CLIENT_EVIDENCE = Object.freeze({
  version: '26-09-23-17-49-43_b9cc4a',
  charpacks: {
    char_289_gyuki: '60ced2241f70409cf3673fdae351f975',
    char_127_estell: '348f8ebc5e896925d55efef008be82bb',
    char_130_doberm: 'edb28bbbcac60abe9c5fa5525eecc481',
    char_185_frncat: '3e43ad7fca864424e276ab3690bbd060',
    char_193_frostl: '1676977dc01b6ee74c27b095a9a29397',
  },
});

/** Called before SkillRuntime is constructed; does not modify shared definitions. */
export function customizeGuardKit({ id, def, kit }) {
  const skill = def.skill;
  if (!skill) return;
  const bb = skill.bb;
  if (id === 'char_289_gyuki' && skill.id === 'skcom_heal_self[2]') {
    kit.skill = {
      id: skill.id, name: skill.name, kind: 'instant',
      onStart: ({ battle, unit }) => battle.heal(unit, unit,
        unit.s.maxHp * bb.heal_scale, { self: true }),
    };
  } else if (id === 'char_289_gyuki' && skill.id === 'skchr_gyuki_2') {
    // gyuki_s_1: DEF FINAL_SCALER = 0, including outside buffs.
    kit.skill.mods = { ...kit.skill.mods, defMul: 0 };
  } else if (id === 'char_127_estell' && skill.id === 'skchr_estell_2') {
    // Abnormal flag 7 blocks ally healing; her own talent remains usable.
    kit.skill.flags = { ...kit.skill.flags, noHeal: true };
  } else if (id === 'char_185_frncat' && skill.id === 'skchr_frncat_1') {
    // The client uses a next-attack self ATK PERCENTAGE buff and a target ATK
    // PERCENTAGE debuff. Neither is a DEF reduction nor a persistent self buff.
    kit.skill = {
      id: skill.id, name: skill.name, kind: 'instant',
      mods: { atkPct: bb.atk },
      attack: {
        onHit: ({ battle, unit, target }) => {
          if (target?.alive) battle.addBuff(target, {
            key: `mousse:scratch:${unit.id}`, source: unit,
            duration: bb['frncat_s_1[debuff].duration'],
            mods: { atkPct: bb['frncat_s_1[debuff].atk'] },
          });
        },
      },
    };
  } else if (id === 'char_193_frostl') {
    const slow = ({ battle, unit, target }) => {
      if (!target?.alive) return;
      const duration = skill.id === 'skchr_frostl_1' ? bb.duration : bb.debuff;
      battle.applyStatus(target, 'slow', {
        duration, source: unit, value: -bb.move_speed,
      });
      if (skill.id === 'skchr_frostl_2' && battle.rng.chance(bb.prob))
        battle.applyStatus(target, 'bind', { duration: bb.debuff, source: unit });
    };
    // The S2 client has separate guaranteed slow and probabilistic Bind
    // abilities, both lasting the `debuff` blackboard duration.
    kit.skill.attack = { ...kit.skill.attack, onHit: slow };
  }
}

/** Called after setup, before deployment, so owned hooks see the initial deploy. */
export function installGuard({ battle, unit, def }) {
  const id = def.charId;
  const talent = def.talents[0];
  if (id === 'char_127_estell') {
    unit.profile.hitAllBlocked = false;
    Object.defineProperty(unit.profile, 'maxTargets', {
      enumerable: true, get: () => Math.max(1, unit.s.blockCnt),
    });
    if (!talent) return;
    if (!talent.rangeGrid?.length) throw Error('Missing source Estelle talent range');
    battle.on('kill', ({ victim }) => {
      if (!unit.alive || !unit.deployed || victim.side !== 'enemy') return;
      const keys = absoluteRangeKeys(talent.rangeGrid, unit.tileR, unit.tileC, unit.dir);
      if (!keys.includes(Math.round(victim.y) * COLS + Math.round(victim.x))) return;
      // estell_t_1 explicitly bypasses HealFree; this is HP recovery credited
      // to Estelle herself even when someone else killed the nearby enemy.
      battle.heal(unit, unit, unit.s.maxHp * talent.bb.hp_ratio,
        { self: true, ignoreHealFree: true });
    }, { owner: unit });
  } else if (id === 'char_130_doberm' && talent) {
    const key = `dobermann:instructor:${unit.id}`;
    const clear = () => {
      for (const ally of battle.allyUnits) battle.removeBuff(ally, key);
    };
    const refresh = () => {
      clear();
      if (!unit.alive || !unit.deployed) return;
      const scale = unit.skill.active && unit.skill.id === 'skchr_doberm_2'
        ? def.skill.bb.talent_scale : 1;
      for (const ally of battle.allyUnits)
        if (ally.alive && ally.deployed && ally.kind === 'op' && ally.def.rarity === 3)
          battle.addBuff(ally, { key, source: unit,
            mods: { atkPct: talent.bb.atk * scale } });
    };
    battle.on('deploy', ({ unit: deployed }) => {
      if (deployed === unit || deployed.side === 'ally') refresh();
    }, { owner: unit });
    battle.on('skillStart', ({ unit: casting }) => {
      if (casting === unit) refresh();
    }, { owner: unit });
    battle.on('skillEnd', ({ unit: casting }) => {
      if (casting === unit) refresh();
    }, { owner: unit });
    battle.on('death', ({ unit: removed }) => {
      if (removed === unit) clear();
    }, { owner: unit });
  } else if (id === 'char_185_frncat') {
    // recordFor's profession fallback is physical; the Arts Fighter trait is
    // authoritative for Mousse at every promotion, including before talent.
    unit.profile.dmgType = 'arts';
    if (!talent) return;
    // The talent is an alternate normal attack with `_additionalTimes: 1`.
    // Scratch replaces that attack with its own next-hit skill ability; Fury
    // only modifies stats, so normal combo attacks still occur during S2.
    unit.profile.hitsFn = () => unit.skill.active && unit.skill.id === 'skchr_frncat_1'
      ? 1 : battle.rng.chance(talent.bb.prob) ? 2 : 1;
  } else if (id === 'char_193_frostl' && talent) {
    if (!talent.rangeGrid?.length) throw Error('Missing source Frostleaf talent range');
    unit.rangeGrid = talent.rangeGrid;
    // frostl_t_1 is BASE_ATTACK_TIME ADDITION, not PERCENTAGE.
    battle.addBuff(unit, { key: 'frostleaf:covered-strike', allowDead: true,
      persist: true, mods: { batPct: talent.bb.base_attack_time / unit.base.bat } });
  }
}
