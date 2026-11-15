// SPDX-License-Identifier: GPL-3.0-or-later
import { PROFESSION_BITS, BUILDABLE_BITS } from '../../../shared/arkpedia/stage-card-rules.js';
import { stageCharacterMultipliers, stageCharacterAdditions } from '../../../shared/arkpedia/stage-character-attributes.js';

/** Shared native stage modifiers. The compiler accepts only reviewed prefab IDs. */
export function installNativeStageRules(b, rules) {
  if (rules?.characterAttributes?.length) b.on('deploy', ({ unit: u }) => {
    if (u.side !== 'ally' || u.kind === 'device' || !u.alive || !u.deployed) return;
    const values = stageCharacterMultipliers(rules, { id: u.defId, profession: u.def.profession, position: u.def.position });
    const additions = stageCharacterAdditions(rules, { id: u.defId, profession: u.def.profession, position: u.def.position });
    const mods = { ...(values.atk != null ? { atkMul: values.atk } : {}), ...(values.def != null ? { defMul: values.def } : {}), ...(values.maxHp != null ? { hpMul: values.maxHp } : {}),
      ...(additions.blockCnt != null ? { blockCnt: additions.blockCnt } : {}) };
    if (Object.keys(mods).length) b.addBuff(u, { key: 'stage:characterAttributes', mods });
  }, { priority: 200 });
  if (rules?.deploymentDamage?.length) b.on('deploy', ({ unit: u, move, moveLikeRespawn }) => {
    if (move || moveLikeRespawn || u.side !== 'ally' || !u.alive || !u.deployed || u.hidden
      || u.kind === 'device' || u.s.flags.untargetable || !b.allySelectable(u)) return;
    for (const rule of rules.deploymentDamage) {
      if (!(rule.professionMask & PROFESSION_BITS[u.def.profession])
        || (rule.buildableMask !== 3 && !(rule.buildableMask & BUILDABLE_BITS[u.def.position]))) continue;
      // Native POST_BORN max-HP ratio is a normal True-damage packet. It retains
      // damage modifiers, shields, lethal handling and defensive SP generation.
      b.dealDamage(u, u, { amount: u.s.maxHp * rule.hpRatio, type: 'true', applyWay: 'none',
        isAttack: true, canDodge: false, noSp: false, tags: ['stage:deploy_damage'] });
    }
  }, { priority: -100 });
  if (Object.values(rules?.enemyDynamicAbilities ?? {}).some(keys => keys.includes('invisible')))
    b.on('enemySpawn', ({ enemy: e }) => {
      if (rules.enemyDynamicAbilities[e.defId]?.includes('invisible'))
        b.addBuff(e, { key: 'stage:invisible', flags: { stealth: true }, data: { stealthRestore: 3 } });
    });
  if (rules?.environmentBuffs?.includes('common_char_melee_built')) {
    b.stageExtraBattleInfo ??= {};
    b.stageExtraBattleInfo.melee_built = 0;
    b.on('deploy', ({ unit: u, move, moveLikeRespawn }) => {
      // Native instantaneous ON_BUFF_START metric: real births, not movement.
      if (move || moveLikeRespawn || u.side !== 'ally' || !u.alive || !u.deployed
        || !(PROFESSION_BITS[u.def.profession] & 639) || !b.grid.isLow(u.tileR, u.tileC)
        || !['MELEE', 'ALL'].includes(u.def.position)) return;
      b.stageExtraBattleInfo.melee_built++;
    });
  }
}
