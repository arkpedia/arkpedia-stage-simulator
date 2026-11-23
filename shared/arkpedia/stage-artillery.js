// SPDX-License-Identifier: GPL-3.0-or-later
import tables from '../../data/arkpedia-device-source.json' with { type: 'json' };

/** The Londinium Secondary Defense Artillery (trap_058_gunctrl) reads its SP cost and starting SP from the original
 * instance's skill level (sktok_gunctrl: 1 = 120/0, 2 = 90/40, 3 = 120/60). The blast itself is the reviewed PRTS
 * 3000 True damage on the artillery area; the skill has no blackboard. */
export function artilleryDefinition(instance) {
  if (!instance || instance.level !== 1 || ![1, 2, 3].includes(instance.skillLevel)) throw Error('Unsupported original artillery instance');
  const skill = tables.skills.sktok_gunctrl?.levels?.[instance.skillLevel - 1], sp = skill?.spData;
  if (!skill || skill.skillType !== 'AUTO' || skill.blackboard.length || sp.spType !== 'INCREASE_WITH_TIME' || sp.increment !== 1
    || !(sp.spCost > 0) || !(sp.initSp >= 0) || sp.initSp >= sp.spCost) throw Error('Changed artillery skill');
  return { spCost: sp.spCost, initSp: sp.initSp, spPerSecond: sp.increment };
}
