// SPDX-License-Identifier: GPL-3.0-or-later
import { SIGHT_SYSTEM, sightNativeReviewed } from './stage-sight.js';
import { PROFESSION_BITS, BUILDABLE_BITS, cardRuleMask } from './stage-card-rules.js';
import { nativeStageRuleReviewed, STAGE_DYNAMIC_ABILITIES } from './stage-native-rules.js';
import { compileStageEnvironments } from './stage-environments.js';
import { compileReedTileRule, compileReedIgnitionRule } from './stage-reeds.js';
const ATTRIBUTES = Object.freeze({ max_hp: 'maxHp', atk: 'atk', def: 'def', move_speed: 'moveSpeed', attack_speed: 'aspd', magic_resistance: 'res', mass_level: 'massLevel' });

/** A replacement applies once to the original wave identity, never recursively. */
export const stageEnemyKey = (rules, id) => rules?.enemyReplacements?.[id] ?? id;

/** Only reviewed, per-stage rule receipts can enable a variant. Unknown rune
 * keys, targeting masks and parameters fail before compilation writes files. */
export function compileStageRules(source, receipt) {
  if (!source.variant && !receipt) return null;
  if (!source.variant && receipt?.parentStageId) throw Error('Variant rules attached to a normal stage');
  if (!receipt) throw Error(`Missing executable variant rules: ${source.variant.kind ?? 'variant'}`);
  const challenge = source.variant?.kind === 'challenge_mode', adverse = source.variant?.kind === 'adverse_environment';
  const sixStar = source.variant?.kind === 'six_star';
  // IS alternates are independent original levels, not difficulty toggles on
  // their parent. The viewer links them only for navigation.
  const variation = source.stage_type === 'integrated_strategies' && source.variant?.kind === 'variation';
  const ownVariationLevel = variation && source.variant.shares_parent_level_file === false
    && /^[a-z0-9_-]+(?:\/[a-z0-9_-]+)+$/i.test(source.id ?? '')
    && receipt.source?.path?.endsWith(`/levels/${source.id.toLowerCase()}.json`);
  // Adverse environments have their own original level, including standalone
  // H-stages with no normal parent. A normal-stage receipt cannot stand in.
  const ownLevel = adverse && source.variant.shares_parent_level_file === false
    && receipt.source?.stageTable?.stageId === source.id
    && receipt.source.path?.endsWith(`/levels/${receipt.source.stageTable.levelId?.toLowerCase()}.json`);
  const sharedSixStarLevel = sixStar && source.variant.shares_parent_level_file === true
    && receipt.source?.stageTable?.stageId === source.variant.of_stage_id
    && receipt.source.path?.endsWith(`/levels/${receipt.source.stageTable.levelId?.toLowerCase()}.json`);
  if ((source.variant && !challenge && !adverse && !sixStar && !variation) || (adverse && !ownLevel)
    || (sixStar && !sharedSixStarLevel) || (variation && !ownVariationLevel) || receipt.schemaVersion !== 1
    || receipt.stageId !== source.id || (source.variant && (receipt.parentStageId ?? null) !== (source.variant.of_stage_id ?? null))
    || !/^[a-f0-9]{40}$/.test(receipt.source?.commit ?? '') || !/^[a-f0-9]{64}$/.test(receipt.source?.sha256 ?? '')
    || !(Array.isArray(receipt.runes) || (!challenge && receipt.runes === null))
    || ((challenge || sixStar) && !receipt.runes?.length))
    throw Error('Invalid or incompatible variant rule receipt');
  const allyCards = [], forbiddenLocations = [], deviceSkillCost = {}, deviceSkillAdd = {}, enemyReplacements = {};
  let sightSystem = false;
  const enemyDynamicAbilities = {}, environmentBuffs = [], enemyScopedAdd = {};
  const deploymentDamage = [], predefinedDevices = {}, predefinedOperators = {}, environmentOverrides = {};
  const enemyTalentGlobal = {}, enemyTalentAddScoped = {}, enemyElementalDamage = {};
  const characterAttributes = [], enemySkillScoped = {};
  const reedTileParameters = {}, reedIgnitions = [];
  let enemySkillCooldownScale = 1;
  let deploymentExcludedProfessionMask = 0;
  let excludePredefinedTraps = false;
  const battle = {}, enemies = {}, enemyAdd = {}, hiddenGroups = {}, enemyScoped = {}, tokenCountAdd = {}, enemyTalentScoped = {}, enemySkillRadiusScoped = {};
  if (receipt.options != null) {
    if (Object.keys(receipt.options).join() !== 'maxPlayTime' || !Number.isFinite(receipt.options.maxPlayTime)
      || (receipt.options.maxPlayTime !== -1 && receipt.options.maxPlayTime <= 0))
      throw Error('Unsupported original level options');
    battle.max_play_time = receipt.options.maxPlayTime;
  }
  for (const rune of receipt.runes ?? []) {
    if (Object.keys(rune).sort().join() !== 'blackboard,buildableMask,difficultyMask,key,professionMask')
      throw Error(`Unsupported rune fields: ${rune.key}`);
    if (!['ALL', 'NORMAL', 'FOUR_STAR', 'EASY', 'SIX_STAR', 'NONE', 0, 2].includes(rune.difficultyMask))
      throw Error(`Unsupported rune targeting: ${rune.key}`);
    const active = rune.difficultyMask === 'ALL'
      || (rune.difficultyMask === 'NORMAL' && (!source.variant || variation))
      || (rune.difficultyMask === 'SIX_STAR' && sixStar)
      || (['FOUR_STAR', 2].includes(rune.difficultyMask) && (challenge || adverse));
    // An inactive difficulty's rules cannot affect this stage. Retain hidden
    // group decisions so the wave compiler can explicitly exclude those groups.
    if (!active && rune.key !== 'level_hidden_group_enable') continue;
    if (rune.key === 'map_tile_blackb_add') {
      const cells = compileReedIgnitionRule(rune);
      if (cells.some(cell => reedIgnitions.some(other => cell.row === other.row && cell.col === other.col)))
        throw Error('Overlapping Reeds ignition rules');
      reedIgnitions.push(...cells); continue;
    }
    if (rune.key === 'map_tile_blackb_assign') {
      const values = compileReedTileRule(rune);
      if (Object.keys(values).some(id => Object.hasOwn(reedTileParameters, id))) throw Error('Overlapping Reeds tile rules');
      Object.assign(reedTileParameters, values); continue;
    }
    if (rune.key === 'env_system_new') {
      const keys = (rune.blackboard ?? []).filter(entry => entry.key === 'key');
      if (keys.length !== 1 || keys[0].value !== 0 || !/^env_[a-z0-9_]+$/i.test(keys[0].valueStr ?? ''))
        throw Error('Invalid stage environment controller identity');
      // Chapter 12: the sight system (stage-sight.js); the level must also carry its global buff (stage-environments.mjs).
      if (keys[0].valueStr === SIGHT_SYSTEM && sightNativeReviewed() && !sightSystem) { sightSystem = true; continue; }
      throw Error(`Unsupported stage environment controller: ${keys[0].valueStr}`);
    }
    // 11-14 adverse: every operator's redeployment time +value s (no `char` target; other forms stay refused).
    if (rune.key === 'char_respawntime_add' && rune.blackboard?.length === 1 && rune.blackboard[0].key === 'value') {
      const professionMask = cardRuleMask(rune.professionMask, PROFESSION_BITS, 1023);
      const buildableMask = cardRuleMask(rune.buildableMask, BUILDABLE_BITS, 3);
      const value = rune.blackboard[0].value;
      if (professionMask !== 1023 || buildableMask !== 3 || !Number.isFinite(value) || value <= 0 || rune.blackboard[0].valueStr)
        throw Error('Unsupported redeployment-time addition');
      allyCards.push({ attribute: 'respawnTime', professionMask, buildableMask, add: value });
      continue;
    }
    if (['cbuff_char_cost', 'char_cost_mul', 'cbuff_respawn_time', 'char_respawn_time_mul', 'char_respawntime_mul'].includes(rune.key)) {
      const professionMask = cardRuleMask(rune.professionMask, PROFESSION_BITS, 1023);
      const buildableMask = cardRuleMask(rune.buildableMask, BUILDABLE_BITS, 3);
      const [entry] = rune.blackboard ?? [];
      if (!professionMask || !buildableMask)
        throw Error(`Unsupported card-rule targeting: ${rune.key}`);
      if (rune.blackboard?.length !== 1 || entry.key !== 'scale' || !Number.isFinite(entry.value)
        || entry.value <= 0 || entry.valueStr) throw Error(`Invalid card-rule scale: ${rune.key}`);
      allyCards.push({ attribute: rune.key.includes('respawn') ? 'respawnTime' : 'cost', professionMask, buildableMask, scale: entry.value });
      continue;
    }
    if (rune.key === 'cbuff_excluded' && rune.blackboard?.length === 1
      && rune.blackboard[0].key === 'include_predefined') {
      const entry = rune.blackboard[0];
      if (!['TRAP', PROFESSION_BITS.TRAP].includes(rune.professionMask)
        || !['ALL', 3].includes(rune.buildableMask) || entry.value !== 1 || entry.valueStr)
        throw Error('Unsupported predefined trap exclusion');
      excludePredefinedTraps = true;
      continue;
    }
    if (rune.key === 'cbuff_excluded' && rune.blackboard?.length === 0) {
      const mask = cardRuleMask(rune.professionMask, PROFESSION_BITS, 1023);
      const operatorMask = 639;
      if (!mask || (mask & ~operatorMask) !== 0 || !['ALL', 3].includes(rune.buildableMask))
        throw Error('Unsupported deployment exclusion targeting');
      deploymentExcludedProfessionMask |= mask;
      continue;
    }
    // include_predefined 0 (11-9/11-18 adverse) keeps preplaced units, which the exclusion never touches: it only
    // refuses squad cards (stage-roster.js).
    if (rune.key === 'char_exclude' && (rune.blackboard?.length === 0 || rune.blackboard?.length === 1
      && rune.blackboard[0].key === 'include_predefined' && rune.blackboard[0].value === 0 && !rune.blackboard[0].valueStr)) {
      const mask = cardRuleMask(rune.professionMask, PROFESSION_BITS, 1023);
      if (!mask || !['ALL', 3].includes(rune.buildableMask)) throw Error('Unsupported profession exclusion targeting');
      battle.excluded_profession_mask = (battle.excluded_profession_mask ?? 0) | mask;
      continue;
    }
    if (['char_attribute_mul', 'cbuff_attribute', 'char_attribute_add'].includes(rune.key)) {
      const additive = rune.key === 'char_attribute_add';
      const professionMask = cardRuleMask(rune.professionMask, PROFESSION_BITS, 1023);
      const buildableMask = cardRuleMask(rune.buildableMask, BUILDABLE_BITS, 3);
      const multipliers = {}; let ids = null;
      if (!professionMask || !buildableMask) throw Error('Unsupported character attribute targeting');
      for (const entry of rune.blackboard ?? []) {
        if (entry.key === 'char') {
          if (ids || entry.value !== 0 || !/^(?:char|token|trap)_[a-z0-9_]+(?:\|(?:char|token|trap)_[a-z0-9_]+)*$/.test(entry.valueStr ?? ''))
            throw Error('Invalid character attribute selector');
          ids = entry.valueStr.split('|');
          if (new Set(ids).size !== ids.length) throw Error('Duplicate character attribute selector');
        } else {
          const field = { atk: 'atk', def: 'def', max_hp: 'maxHp' }[entry.key];
          if (!field || Object.hasOwn(multipliers, field) || !Number.isFinite(entry.value) || (!additive && entry.value <= 0) || entry.valueStr)
            throw Error(`Unsupported character attribute: ${entry.key}`);
          multipliers[field] = entry.value;
        }
      }
      if (!Object.keys(multipliers).length) throw Error('Empty character attribute rule');
      // The reviewed additive use is Turret ATK. Other character attributes
      // require a reviewed modifier-order contract before they can be admitted.
      if (additive && (!ids?.length || ids.some(id => id !== 'trap_007_ballis')
        || ![1023, PROFESSION_BITS.TRAP].includes(professionMask) || buildableMask !== 3
        || Object.keys(multipliers).join() !== 'atk')) throw Error('Unsupported additive character attribute rule');
      characterAttributes.push({ professionMask, buildableMask, ...(ids ? { ids } : {}),
        [additive ? 'additions' : 'multipliers']: multipliers });
      continue;
    }
    if (rune.key === 'char_blockcnt_add') {
      const professionMask = cardRuleMask(rune.professionMask, PROFESSION_BITS, 1023);
      const buildableMask = cardRuleMask(rune.buildableMask, BUILDABLE_BITS, 3);
      const [entry] = rune.blackboard ?? [];
      if (!professionMask || !buildableMask || rune.blackboard?.length !== 1 || entry.key !== 'value'
        || !Number.isSafeInteger(entry.value) || entry.valueStr) throw Error('Unsupported character block addition');
      characterAttributes.push({ professionMask, buildableMask, additions: { blockCnt: entry.value } });
      continue;
    }
    if (rune.key === 'env_gbuff_new' && rune.blackboard?.some(x => x.key === 'key' && x.valueStr === 'deploy_damage')) {
      const professionMask = cardRuleMask(rune.professionMask, PROFESSION_BITS, 1023);
      const buildableMask = cardRuleMask(rune.buildableMask, BUILDABLE_BITS, 3);
      const key = rune.blackboard.find(x => x.key === 'key'), ratio = rune.blackboard.find(x => x.key === 'hp_ratio');
      if (!professionMask || !buildableMask || rune.blackboard.length !== 2 || key.value !== 0
        || !Number.isFinite(ratio?.value) || ratio.value <= 0 || ratio.value > 1 || ratio.valueStr
        || !nativeStageRuleReviewed('deploy_damage') || deploymentDamage.length)
        throw Error('Unsupported deployment damage rule');
      deploymentDamage.push({ professionMask, buildableMask, hpRatio: ratio.value });
      continue;
    }
    if (rune.key === 'cbuff_token_initial_cnt' || rune.key === 'global_token_cnt_add') {
      const mask = cardRuleMask(rune.professionMask, PROFESSION_BITS, 1023);
      const entries = rune.blackboard ?? [], target = entries.find(x => x.key === 'char'), amount = entries.find(x => x.key === 'value');
      if (rune.key === 'global_token_cnt_add' && (!target || mask !== 1023)
        || ![1023, PROFESSION_BITS.TRAP].includes(mask) || !['ALL', 3].includes(rune.buildableMask)
        || entries.length !== (target ? 2 : 1) || !Number.isSafeInteger(amount?.value) || amount.valueStr
        || target && (target.value !== 0 || !/^trap_[a-z0-9_]+$/.test(target.valueStr ?? '')))
        throw Error('Invalid stage token count rune');
      const key = target?.valueStr ?? '*';
      tokenCountAdd[key] = (tokenCountAdd[key] ?? 0) + amount.value;
      continue;
    }
    // JT8-3 Challenge: the Energy Aggregate's skill `damage` + value. The rune names the TRAP profession and its
    // device; only this reviewed device parameter is accepted.
    if (rune.key === 'char_skill_blackb_add' && ['TRAP', 256].includes(rune.professionMask) && ['ALL', 3].includes(rune.buildableMask)) {
      const entries = rune.blackboard ?? [], target = entries.find(x => x.key === 'char'), amount = entries.find(x => x.key === 'damage');
      if (entries.length !== 2 || target?.value !== 0 || target.valueStr !== 'trap_021_flame'
        || !Number.isFinite(amount?.value) || amount.value <= 0 || amount.valueStr)
        throw Error('Unsupported device skill-parameter rule');
      if (active) { const add = deviceSkillAdd[target.valueStr] ??= {}; add.damage = (add.damage ?? 0) + amount.value; }
      continue;
    }
    // Original enemy-attribute runes also encode NONE/NONE for the unused
    // character selector. Their enemy IDs remain the explicit target selector.
    const unusedCharacterMask = rune.key === 'enemy_attribute_mul'
      && ['NONE', 0].includes(rune.professionMask) && ['NONE', 0].includes(rune.buildableMask);
    if (!unusedCharacterMask && (rune.professionMask !== 1023 || !['ALL', 3].includes(rune.buildableMask)))
      throw Error(`Unsupported rune targeting: ${rune.key}`);
    if (rune.key === 'level_predefines_enable') {
      if (!rune.blackboard?.length) throw Error('Empty predefined-device rule');
      for (const entry of rune.blackboard) {
        const target = /^trap_[a-z0-9_]+#[a-zA-Z0-9_-]+$/.test(entry.key) ? predefinedDevices
          : /^char_[a-z0-9_]+(?:#[a-zA-Z0-9_-]+)?$/.test(entry.key) ? predefinedOperators : null;
        if (!target || ![0, 1].includes(entry.value) || entry.valueStr || Object.hasOwn(target, entry.key))
          throw Error('Invalid predefined-device rule');
        target[entry.key] = entry.value === 1;
      }
      continue;
    }
    if (rune.key === 'enemy_dynamic_ability_new') {
      const entries = rune.blackboard ?? [], target = entries.find(x => x.key === 'enemy'), key = entries.find(x => x.key === 'key');
      if (entries.length !== 2 || target?.value !== 0 || !/^enemy_[a-z0-9_]+(?:\|enemy_[a-z0-9_]+)*$/.test(target.valueStr ?? '')
        || key?.value !== 0 || !STAGE_DYNAMIC_ABILITIES.includes(key.valueStr) || !nativeStageRuleReviewed(key.valueStr))
        throw Error('Unsupported stage dynamic ability');
      const ids = target.valueStr.split('|');
      if (new Set(ids).size !== ids.length) throw Error('Duplicate dynamic ability target');
      for (const id of ids) {
        const list = enemyDynamicAbilities[id] ??= [];
        if (list.includes(key.valueStr)) throw Error('Duplicate stage dynamic ability');
        list.push(key.valueStr);
      }
      continue;
    }
    if (rune.key === 'env_gbuff_new') {
      const [entry] = rune.blackboard ?? [];
      if (entry?.key === 'key' && entry.value === 0 && ['periodic_damage', 'kill_to_add_cost'].includes(entry.valueStr)) {
        if (!['ALL', 1023].includes(rune.professionMask) || !['ALL', 3].includes(rune.buildableMask)
          || Object.hasOwn(environmentOverrides, entry.valueStr)) throw Error('Unsupported environment buff targeting or duplicate');
        const [compiled] = compileStageEnvironments([{ prefabKey: entry.valueStr, blackboard: rune.blackboard.slice(1) }]);
        environmentOverrides[entry.valueStr] = compiled;
        continue;
      }
      if (rune.blackboard?.length !== 1 || entry.key !== 'key' || entry.value !== 0
        || entry.valueStr !== 'common_char_melee_built' || !nativeStageRuleReviewed(entry.valueStr)
        || environmentBuffs.includes(entry.valueStr)) throw Error('Unsupported environment buff');
      environmentBuffs.push(entry.valueStr);
      continue;
    }
    // 12-20: env_gbuff_new_with_verify apply_elemental_damage gives exactly the listed enemies Corrosion of
    // ep_damage_ratio x each damage they deal (stage-native-rules.js). No other with_verify buff is accepted.
    if (rune.key === 'env_gbuff_new_with_verify' && rune.blackboard?.some(x => x.key === 'key' && x.valueStr === 'apply_elemental_damage')) {
      const entries = rune.blackboard, key = entries.find(x => x.key === 'key'), ratio = entries.find(x => x.key === 'ep_damage_ratio'),
        target = entries.find(x => x.key === 'enemy');
      if (entries.length !== 3 || key.value !== 0 || !Number.isFinite(ratio?.value) || ratio.value <= 0 || ratio.value > 1 || ratio.valueStr
        || target?.value !== 0 || !/^enemy_[a-z0-9_]+(?:\|enemy_[a-z0-9_]+)*$/.test(target.valueStr ?? '')
        || !['ALL', 1023].includes(rune.professionMask) || !['ALL', 3].includes(rune.buildableMask)
        || !nativeStageRuleReviewed('apply_elemental_damage')) throw Error('Unsupported stage elemental damage rule');
      const ids = target.valueStr.split('|');
      if (new Set(ids).size !== ids.length || ids.some(id => Object.hasOwn(enemyElementalDamage, id)))
        throw Error('Duplicate stage elemental damage target');
      for (const id of ids) enemyElementalDamage[id] = { element: 'erosion', ratio: ratio.value };
      continue;
    }
    if (rune.key === 'level_enemy_replace') {
      const entries = rune.blackboard ?? [], from = entries.find(x => x.key === 'key'), to = entries.find(x => x.key === 'value');
      if (entries.length !== 2 || [from, to].some(x => x?.value !== 0 || !/^enemy_[a-z0-9_]+$/.test(x.valueStr ?? ''))
        || from.valueStr === to.valueStr || Object.hasOwn(enemyReplacements, from.valueStr))
        throw Error('Invalid stage enemy replacement');
      enemyReplacements[from.valueStr] = to.valueStr;
      continue;
    }
    if (rune.key === 'char_skill_cd_mul') {
      const entries = rune.blackboard ?? [], target = entries.find(x => x.key === 'char'), scale = entries.find(x => x.key === 'scale');
      if (entries.length !== 2 || target?.value !== 0 || !['trap_010_frosts', 'trap_008_farm'].includes(target.valueStr)
        || !Number.isFinite(scale?.value) || scale.value <= 0 || scale.valueStr)
        throw Error('Unsupported device skill-cost rule');
      deviceSkillCost[target.valueStr] = (deviceSkillCost[target.valueStr] ?? 1) * scale.value;
      continue;
    }
    if (rune.key === 'global_squad_num_limit') {
      const [entry] = rune.blackboard ?? [];
      if (rune.blackboard?.length !== 1 || entry.key !== 'value' || entry.valueStr
        || !Number.isSafeInteger(entry.value) || entry.value < 1 || entry.value > 13)
        throw Error('Invalid stage squad limit');
      battle.squad_limit = Math.min(battle.squad_limit ?? 13, entry.value);
      continue;
    }
    if (rune.key === 'global_forbid_location') {
      const [entry] = rune.blackboard ?? [];
      if (rune.blackboard?.length !== 1 || entry.key !== 'location' || entry.value !== 0
        || !/^\(\d+,\d+\)(?:\|\(\d+,\d+\))*$/.test(entry.valueStr ?? ''))
        throw Error('Invalid stage deployment locations');
      for (const pair of entry.valueStr.split('|')) {
        const [row, col] = pair.slice(1, -1).split(',').map(Number);
        if (!Number.isSafeInteger(row) || !Number.isSafeInteger(col)
          || forbiddenLocations.some(p => p.row === row && p.col === col)) throw Error('Duplicate or invalid stage deployment location');
        forbiddenLocations.push({ row, col });
      }
      continue;
    }
    if (['cbuff_excluded', 'char_exclude'].includes(rune.key)) {
      const [entry] = rune.blackboard ?? [];
      if (rune.blackboard?.length !== 1 || entry.key !== 'char' || entry.value !== 0
        || typeof entry.valueStr !== 'string' || !/^char_[a-z0-9_]+(?:\|char_[a-z0-9_]+)*$/.test(entry.valueStr))
        throw Error('Invalid operator exclusion rune');
      const ids = entry.valueStr.split('|');
      if (new Set(ids).size !== ids.length) throw Error('Duplicate operator exclusion');
      battle.excluded_operator_ids = [...new Set([...(battle.excluded_operator_ids ?? []), ...ids])].sort();
      continue;
    }
    if (rune.key === 'level_hidden_group_enable') {
      const [entry] = rune.blackboard ?? [];
      if (rune.blackboard?.length !== 1 || entry.key !== 'key' || entry.value !== 0
        || typeof entry.valueStr !== 'string' || !/^[a-z0-9_-]+$/i.test(entry.valueStr))
        throw Error('Invalid hidden-group rune');
      hiddenGroups[entry.valueStr] = (hiddenGroups[entry.valueStr] ?? false) || active;
      continue;
    }
    if (rune.key === 'enemy_skill_blackb_mul') {
      const values = {}, selectors = {};
      for (const entry of rune.blackboard ?? []) {
        if (['enemy', 'skill'].includes(entry.key)) {
          const pattern = entry.key === 'enemy' ? /^enemy_[a-z0-9_]+(?:\|enemy_[a-z0-9_]+)*$/ : /^[a-zA-Z][a-zA-Z0-9_]*$/;
          if (Object.hasOwn(selectors, entry.key) || entry.value !== 0 || !pattern.test(entry.valueStr ?? ''))
            throw Error('Invalid enemy skill selector');
          selectors[entry.key] = entry.valueStr;
        } else {
          if (!/^[a-zA-Z0-9_.@\[\]]+$/.test(entry.key) || Object.hasOwn(values, entry.key)
            || !Number.isFinite(entry.value) || entry.value <= 0 || entry.valueStr) throw Error('Invalid enemy skill multiplier');
          values[entry.key] = entry.value;
        }
      }
      if (!selectors.enemy || !Object.keys(values).length) throw Error('Incomplete enemy skill multiplier');
      // Without a `skill` selector each key names its skill itself ("PetrifiedRay.atk_scale", 9-19 Challenge).
      const scoped = selectors.skill ? Object.entries(values).map(([key, value]) => [selectors.skill, key, value])
        : Object.entries(values).map(([key, value]) => {
          const m = /^([a-zA-Z][a-zA-Z0-9_]*)\.(.+)$/.exec(key);
          if (!m) throw Error('Incomplete enemy skill multiplier');
          return [m[1], m[2], value];
        });
      const ids = selectors.enemy.split('|');
      if (new Set(ids).size !== ids.length) throw Error('Duplicate enemy skill target');
      for (const id of ids) {
        const skills = enemySkillScoped[id] ??= {};
        for (const [skill, key, value] of scoped) { const params = skills[skill] ??= {}; params[key] = (params[key] ?? 1) * value; }
      }
      continue;
    }
    const bb = {};
    let targets = null;
    for (const entry of rune.blackboard ?? []) {
      if (entry.key === 'enemy' && ['ebuff_attribute', 'enemy_attribute_mul', 'enemy_attribute_add', 'enemy_weight_add', 'ebuff_talent_blackb_mul', 'enemy_talent_blackb_mul', 'enemy_talent_blackb_add', 'enemy_skill_radius_mul', 'enemy_attackradius_mul'].includes(rune.key)) {
        if (targets || entry.value !== 0 || typeof entry.valueStr !== 'string'
          || !/^enemy_[a-z0-9_]+(?:\|enemy_[a-z0-9_]+)*$/.test(entry.valueStr))
          throw Error(`Invalid enemy targeting: ${rune.key}`);
        targets = entry.valueStr.split('|');
        if (new Set(targets).size !== targets.length) throw Error(`Duplicate enemy targeting: ${rune.key}`);
        continue;
      }
      const signedAddition = ['global_initial_cost_add', 'global_placable_char_num_add', 'gbuff_placable_char_num', 'enemy_attribute_add', 'enemy_talent_blackb_add'].includes(rune.key);
      const nonnegativeMultiplier = ['enemy_talent_blackb_mul', 'ebuff_talent_blackb_mul'].includes(rune.key);
      if (Object.hasOwn(bb, entry.key) || !Number.isFinite(entry.value)
        || (!signedAddition && (nonnegativeMultiplier ? entry.value < 0 : entry.value <= 0)) || entry.valueStr)
        throw Error(`Invalid rune parameter: ${rune.key}.${entry.key}`);
      bb[entry.key] = entry.value;
    }
    if (rune.key === 'ebuff_skill_cd' && Object.keys(bb).join() === 'scale') {
      enemySkillCooldownScale *= bb.scale;
    } else if (rune.key === 'enemy_skill_radius_mul' && targets && Object.keys(bb).join() === 'scale') {
      for (const id of targets) enemySkillRadiusScoped[id] = (enemySkillRadiusScoped[id] ?? 1) * bb.scale;
    } else if (['ebuff_talent_blackb_mul', 'enemy_talent_blackb_mul'].includes(rune.key) && Object.keys(bb).length) {
      const sets = targets ? targets.map(id => enemyTalentScoped[id] ??= {}) : [enemyTalentGlobal];
      for (const set of sets) for (const [key, value] of Object.entries(bb)) {
        set[key] = (set[key] ?? 1) * value;
      }
    } else if (rune.key === 'enemy_talent_blackb_add' && targets && Object.keys(bb).length) {
      for (const id of targets) for (const [key, value] of Object.entries(bb)) {
        const set = enemyTalentAddScoped[id] ??= {};
        set[key] = (set[key] ?? 0) + value;
      }
    } else if (['global_initial_cost_add', 'global_placable_char_num_add', 'gbuff_placable_char_num'].includes(rune.key)
      && Object.keys(bb).join() === 'value' && Number.isSafeInteger(bb.value)) {
      const field = rune.key === 'global_initial_cost_add' ? 'initial_dp' : 'unit_limit';
      const value = (battle[field] ?? source.battle?.[field]) + bb.value;
      if (!Number.isSafeInteger(value) || value < 0) throw Error(`Invalid stage budget: ${field}`);
      battle[field] = value;
    } else if (rune.key === 'cbuff_max_cost' && Object.keys(bb).sort().join() === 'max_cost,max_cost_ceil'
      && Number.isSafeInteger(bb.max_cost) && Number.isSafeInteger(bb.max_cost_ceil) && bb.max_cost <= bb.max_cost_ceil) {
      // Chapter 12: the DP cap starts at max_cost; ModifyMaxCost (the Norport Civilian's reward) may raise it up to
      // max_cost_ceil.
      if (battle.max_dp_ceil != null) throw Error('Duplicate stage DP capacity rule');
      battle.max_dp = bb.max_cost; battle.max_dp_ceil = bb.max_cost_ceil;
    } else if (rune.key === 'cbuff_initial_cost' && Object.keys(bb).join() === 'cost' && Number.isSafeInteger(bb.cost)) {
      // The legacy starting-DP rune (only 0-6 Challenge): `cost` DP added to the level's initialCost.
      // Confirmed in game by the owner (2026-11-24): 0-6 Challenge starts with 8 + 3 = 11 DP.
      const value = (battle.initial_dp ?? source.battle?.initial_dp) + bb.cost;
      if (!Number.isSafeInteger(value) || value < 0) throw Error('Invalid stage budget: initial_dp');
      battle.initial_dp = value;
    } else if (['cbuff_cost_recovery', 'global_cost_recovery_mul'].includes(rune.key) && Object.keys(bb).join() === 'scale') {
      // This legacy rune multiplies the recovery INTERVAL: OF-EX5's scale 3
      // means one third the ordinary natural DP rate, not triple recovery.
      const rate = (battle.dp_per_second ?? source.battle?.dp_per_second) / bb.scale;
      const interval = (battle.dp_recovery_interval_seconds ?? source.battle?.dp_recovery_interval_seconds) * bb.scale;
      if (!Number.isFinite(rate) || rate < 0 || !Number.isFinite(interval) || interval <= 0)
        throw Error('Invalid stage DP recovery interval');
      battle.dp_per_second = rate; battle.dp_recovery_interval_seconds = interval;
    } else if (['gbuff_lifepoint', 'global_lifepoint'].includes(rune.key) && Object.keys(bb).join() === 'value' && Number.isSafeInteger(bb.value)) {
      if (battle.max_life != null) throw Error('Conflicting life-point runes');
      battle.max_life = bb.value;
    } else if (['enemy_weight_add', 'ebuff_weight'].includes(rune.key) && Object.keys(bb).join() === 'value' && Number.isSafeInteger(bb.value)) {
      const sets = targets ? targets.map(id => enemyScopedAdd[id] ??= {}) : [enemyAdd];
      for (const set of sets) set.massLevel = (set.massLevel ?? 0) + bb.value;
    } else if ((rune.key === 'ebuff_attack_radius' && Object.keys(bb).join() === 'range_scale')
      || (rune.key === 'enemy_attackradius_mul' && Object.keys(bb).join() === 'scale')) {
      const multiplier = bb.range_scale ?? bb.scale;
      // The raw source radius also belongs to abilities on some melee enemies.
      // Their effective ordinary-attack radius remains zero, so this never
      // turns a blocker-only enemy into a ranged attacker.
      const sets = targets ? targets.map(id => enemyScoped[id] ??= {}) : [enemies];
      for (const set of sets) for (const key of ['rangeRadius', 'rawRangeRadius'])
        set[key] = (set[key] ?? 1) * multiplier;
    } else if (rune.key === 'enemy_attribute_add' && Object.keys(bb).length) {
      for (const [key, value] of Object.entries(bb)) {
        // LE-EX-5 explicitly adds 1.3 ASPD points. Do not reinterpret a
        // fractional addition as a multiplier or a percentage bonus.
        const field = { atk: 'atk', def: 'def', magic_resistance: 'res', attack_speed: 'aspd' }[key];
        if (!field) throw Error(`Unsupported additive enemy rune attribute: ${key}`);
        const sets = targets ? targets.map(id => enemyScopedAdd[id] ??= {}) : [enemyAdd];
        for (const set of sets) set[field] = (set[field] ?? 0) + value;
      }
    } else if (['ebuff_attribute', 'enemy_attribute_mul'].includes(rune.key) && Object.keys(bb).length) {
      for (const [key, value] of Object.entries(bb)) {
        // The original 4-4 challenge contains this neutral legacy typo.
        // Do not reinterpret non-neutral values as a supported HP modifier.
        if (key === 'map_hp' && value === 1) continue;
        if (!ATTRIBUTES[key]) throw Error(`Unsupported enemy rune attribute: ${key}`);
        const sets = targets ? targets.map(id => enemyScoped[id] ??= {}) : [enemies];
        for (const set of sets) set[ATTRIBUTES[key]] = (set[ATTRIBUTES[key]] ?? 1) * value;
      }
    } else throw Error(`Unsupported stage rune: ${rune.key}`);
  }
  return { variant: source.variant?.kind ?? null, source: receipt.source, battle, enemies, enemyAdd, hiddenGroups,
    ...(sightSystem ? { sightSystem } : {}),
    ...(Object.keys(reedTileParameters).length ? { reedTileParameters } : {}),
    ...(reedIgnitions.length ? { reedIgnitions } : {}),
    ...(deploymentExcludedProfessionMask ? { deploymentExcludedProfessionMask } : {}),
    ...(excludePredefinedTraps ? { excludePredefinedTraps } : {}),
    ...(enemySkillCooldownScale !== 1 ? { enemySkillCooldownScale } : {}),
    ...(Object.keys(predefinedDevices).length ? { predefinedDevices } : {}),
    ...(Object.keys(predefinedOperators).length ? { predefinedOperators } : {}),
    ...(Object.keys(enemyScoped).length ? { enemyScoped } : {}),
    ...(Object.keys(enemyTalentAddScoped).length ? { enemyTalentAddScoped } : {}),
    ...(Object.keys(enemyTalentScoped).length ? { enemyTalentScoped } : {}),
    ...(Object.keys(tokenCountAdd).length ? { tokenCountAdd } : {}),
    ...(allyCards.length ? { allyCards } : {}),
    ...(forbiddenLocations.length ? { forbiddenLocations } : {}),
    ...(Object.keys(deviceSkillCost).length ? { deviceSkillCost } : {}),
    ...(Object.keys(deviceSkillAdd).length ? { deviceSkillAdd } : {}),
    ...(Object.keys(enemyReplacements).length ? { enemyReplacements } : {}),
    ...(Object.keys(enemyDynamicAbilities).length ? { enemyDynamicAbilities } : {}),
    ...(Object.keys(enemyScopedAdd).length ? { enemyScopedAdd } : {}),
    ...(environmentBuffs.length ? { environmentBuffs } : {}),
    ...(Object.keys(environmentOverrides).length ? { environmentOverrides } : {}),
    ...(deploymentDamage.length ? { deploymentDamage } : {}),
    ...(Object.keys(enemyTalentGlobal).length ? { enemyTalentGlobal } : {}),
    ...(characterAttributes.length ? { characterAttributes } : {}),
    ...(Object.keys(enemySkillScoped).length ? { enemySkillScoped } : {}),
    ...(Object.keys(enemySkillRadiusScoped).length ? { enemySkillRadiusScoped } : {}),
    ...(Object.keys(enemyElementalDamage).length ? { enemyElementalDamage } : {}) };
}
