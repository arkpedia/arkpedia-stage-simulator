// SPDX-License-Identifier: GPL-3.0-or-later
// Chapter 15: the "static" forms the Intrusive Call deploys on highland tiles (PRTS: a level-1 device of the same
// name with basically the same attributes and abilities; taunt -1, weight 0). Compile-time only: the wave program
// carries the numbers (stage-waves.mjs), the battle never imports this file.
// Reviewed for each pair in the control system's list (stage-prts-control.js):
// - the trap's level-1 record equals the enemy's level-0 record in HP, ATK, DEF, RES and attack interval, with taunt
//   level -1 and mass level 0, and its talent's `attack@ability_range_radius` equals the enemy's range radius;
// - the trap's prefab is enemy side, default category (operators can attack it), and its attack fires the pinned
//   projectile of its family.
// The battle keeps the grabbed enemy's own unit and behaviour (its attack, the echo's tile denial, the crystal's DP
// halt) and gives it these numbers. Stage rules that name the trap id scale them (char_attribute_mul), as the game
// scales the device; enemy rules do not.
import native from '../../data/arkpedia-device-native-source.json' with { type: 'json' };
import tables from '../../data/arkpedia-device-source.json' with { type: 'json' };
import records from '../../data/arkpedia-enemy-records.json' with { type: 'json' };

export const PRTS_STATIC_FORMS = Object.freeze({ enemy_10074_mpcata: 'trap_229_mpcata', enemy_10074_mpcata_2: 'trap_230_mpcatab',
  enemy_10076_mpgrou: 'trap_231_mpgrou', enemy_10076_mpgrou_2: 'trap_232_mpgroub', enemy_10079_mpmage: 'trap_233_mpmage',
  enemy_10079_mpmage_2: 'trap_234_mpmageb' });

// The projectile each trap's attack fires (pinned; the Cold Drink Machine's is checked against the enemy prefab's).
const PROJECTILES = Object.freeze({ enemy_10074_mpcata: 'projectile_enemy_mpcata', enemy_10074_mpcata_2: 'projectile_enemy_mpcata_2',
  enemy_10076_mpgrou: 'projectile_enemy_mpgrou', enemy_10076_mpgrou_2: 'projectile_enemy_mpgrou', enemy_10079_mpmage: 'projectile_enemy_mpmage',
  enemy_10079_mpmage_2: 'projectile_enemy_mpmage' });
export function prtsStaticFormReviewed(enemyKey, e = native, t = tables, r = records) {
  const trap = PRTS_STATIC_FORMS[enemyKey], record = t.devices?.[trap], frame = record?.phases?.[0]?.attributesKeyFrames?.[0];
  const enemy = (r.enemies ?? r)[enemyKey]?.levels?.[0], rows = (e.prefabs?.[trap]?.components ?? []).map(c => c.data);
  const root = rows.find(c => '_modes' in c), shots = rows.filter(c => c._projectileKey).map(c => c._projectileKey);
  const radius = record?.talents?.[0]?.candidates?.[0]?.blackboard?.find(x => x.key === 'attack@ability_range_radius')?.value;
  return !!trap && frame?.level === 1 && !!enemy && enemy.stats.motion === 'WALK'
    && frame.data.maxHp === enemy.stats.maxHp && frame.data.atk === enemy.stats.atk && frame.data.def === enemy.stats.def
    && frame.data.magicResistance === enemy.stats.res && frame.data.baseAttackTime === enemy.stats.bat
    && frame.data.tauntLevel === -1 && frame.data.massLevel === 0 && frame.data.blockCnt === 0 && radius === enemy.stats.rangeRadius
    && root?._sideType === 2 && root._category === 1 && shots.length >= 1 && shots[0] === PROJECTILES[enemyKey];
}

/** The numbers the battle gives a grabbed enemy deployed as its static form. */
export function prtsStaticForm(enemyKey) {
  if (!prtsStaticFormReviewed(enemyKey)) throw Error(`Unsupported static form: ${enemyKey}`);
  const trap = PRTS_STATIC_FORMS[enemyKey], d = tables.devices[trap].phases[0].attributesKeyFrames[0].data;
  return { trap, hp: d.maxHp, atk: d.atk, def: d.def, res: d.magicResistance, taunt: -1, mass: 0 };
}
