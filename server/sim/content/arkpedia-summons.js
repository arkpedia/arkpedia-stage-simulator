// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-summon-prefabs.json' with { type: 'json' };
import { REGULAR_SUMMONS, summonCardId, summonRecordFor } from '../../../shared/arkpedia/summons.js';
import { createMetalCrab, customizeBeanstalk, installBeanstalk } from './arkpedia-tacticians.js';
import { installShamareDoll } from './arkpedia-five-star-support-third.js';
import { installNightingaleCage } from './arkpedia-six-star-medic.js';
import { installSilenceDrone } from './arkpedia-five-star-medic-fourth.js';
import { installSilenceParadigmaticDrone } from './arkpedia-silence-paradigmatic.js';

import { liveSummonUnit as live, ownedSummons as ownTokens, summonCardState as cardState } from './arkpedia-summon-deck.js';
export { regularSummonCards, summonPlacementError, deployRegularSummon, selectedRegularSummon, retreatRegularSummon } from './arkpedia-summon-deck.js';

/** Before setup; suppress inferred own-ATK/DEF/regeneration from S1. */
export function customizeSummonerKit({ id, def, unit, kit }) {
  if (!REGULAR_SUMMONS[id]) return;
  if (id === 'char_484_robrta') { customizeRoberta({ id, def, unit, kit }); return; }
  if (id === 'char_452_bstalk') { customizeBeanstalk({ id, def, unit, kit }); return; }
  if (id !== 'char_110_deepcl') return;
  const skill = def.skill, bb = skill.bb;
  // Original Deepcolor uses a delayed direct Arts hit, without a projectile.
  kit.trait = { ...kit.trait, attack: 'melee', projectile: 'none', dmgType: 'arts',
    canHitFly: true, windup: evidence.operators[id].models.Front.hits.Attack[0] };
  const key = `deepcolor:${unit.id}:${skill.id}`;
  const clear = battle => { for (const ally of battle.allyUnits) battle.removeBuff(ally, key); };
  const sync = battle => {
    for (const ally of battle.allyUnits) {
      const allowed = live(unit) && unit.skill.active && live(ally) && !ally.hidden &&
        (skill.id === 'skchr_deepcl_1'
          ? ally.ownerUnit === unit && ally.defId === REGULAR_SUMMONS[id].tokenId && !ally.s.flags.untargetable
          : unit.rangeKeySet.has(ally.tileR * 21 + ally.tileC) && battle.allySelectable(ally, unit));
      if (!allowed) battle.removeBuff(ally, key);
      else if (!ally.findBuff(key)) battle.addBuff(ally, { key, source: unit,
        mods: skill.id === 'skchr_deepcl_1'
          ? { atkPct: bb.atk, defPct: bb.def, hpRegen: bb.hp_recovery_per_sec }
          : { dodgePhys: bb.prob },
      });
    }
  };
  kit.skill = { id: skill.id, name: skill.name, kind: 'duration',
    ...(skill.id === 'skchr_deepcl_2' ? { targeting: { rangeGrid: skill.rangeGrid } } : {}),
    onStart: ({ battle }) => sync(battle), onTick: ({ battle }) => sync(battle),
    onEnd: ({ battle }) => clear(battle),
  };
  unit.mem.summonSkillSync = sync;
}

/** After setup, before deployment. The original owner-finish ability removes
 * all owned Tentacles. Stock is charged afresh on a new owner deployment. */
export function installSummoner({ battle, unit, def }) {
  if (!REGULAR_SUMMONS[def.charId]) return;
  if (def.id === 'char_4123_ela') return; // Installed by the reviewed Ela controller.
  const config = REGULAR_SUMMONS[def.id];
  if (!config || config.skillId && def.skill?.id !== config.skillId
    || config.minimumElite != null && def.raw.arkpedia.elite < config.minimumElite) return;
  const build = ['char_4212_nasti', 'char_4195_radian', 'char_4117_ray', 'char_427_vigil', 'char_4055_bgsnow', 'char_1012_skadi2', 'char_4048_doroth', 'char_400_weedy', 'char_250_phatom', 'char_451_robin', 'char_458_rfrost', 'char_242_otter', 'char_4171_wulfen'].includes(def.id)
    ? { ...def.raw.arkpedia, skillId: def.skill.id } : def.raw.arkpedia;
  const key = summonCardId(def.id), record = summonRecordFor(def.id, build, battle.data.raw.tokens);
  if (!battle.regularSummons) battle.regularSummons = new Map();
  const previous = battle.regularSummons.get(key);
  const state = { key, ownerId: def.id, owner: unit, tokenId: record.id, config,
    record, stock: config.additiveBornStock ? previous?.stock ?? 0 : 0,
    readyAt: def.id === 'char_250_phatom' || config.preserveCooldown ? previous?.readyAt ?? battle.time : battle.time, unit: null,
    syncSkill: () => unit.mem.summonSkillSync?.(battle),
    sourceToken: evidence.tokens[record.id],
    createToken: config.tacticalPoint ? createMetalCrab : null,
    installToken: def.id === 'char_179_cgbird' ? installNightingaleCage
      : def.id === 'char_108_silent' ? installSilenceDrone
      : def.id === 'char_1031_slent2' ? installSilenceParadigmaticDrone
      : def.id === 'char_484_robrta' ? installModeler
      : def.id === 'char_254_vodfox' ? (b, token, state) => {
        installShamareDoll(b, token, state);
        b.removeBuff(state.owner, 'shamare:stock-full');
      } : null,
  };
  battle.regularSummons.set(key, state);
  if (def.id === 'char_254_vodfox') unit.mem.shamareState = state;
  if (def.id === 'char_108_silent') unit.mem.silentState = state;
  if (def.id === 'char_1031_slent2') unit.mem.slent2State = state;
  if (def.id === 'char_452_bstalk') installBeanstalk({ battle, unit, def, state });
  battle.on('deploy', ({ unit: deployed }) => {
    if (deployed === unit) {
      const bornCount = config.stockLimit ? 0 : def.talents[config.talentIndex ?? 0].bb.cnt;
      state.stock = config.stockLimit ? 0 : config.additiveBornStock ? state.stock + bornCount : bornCount;
      // Mayer's bounded total supply follows the source born count; raw token
      // maxDeckStackCnt/maxDeployCount remain untouched in the record.
      if (config.bornStockBudget) { state.stockBudget = bornCount; state.stock = Math.min(bornCount, state.stock); }
      if (def.id === 'char_250_phatom') state.stock = Math.min(1, state.stock);
      else if (!config.preserveCooldown) state.readyAt = battle.time;
      if (config.stockLimit) battle.removeBuff(unit, 'shamare:stock-full');
      if (def.id === 'char_108_silent') battle.removeBuff(unit, 'silence:stock-full');
      if (['char_4048_doroth', 'char_451_robin', 'char_458_rfrost', 'char_4171_wulfen'].includes(def.id)) state.syncSkill();
    }
    if (live(unit) && unit.skill.active) state.syncSkill();
  }, { owner: unit });
  battle.on('death', ({ unit: removed }) => {
    if (removed !== unit) return;
    // A token may outlive its owner (Nasti's fully upgraded platform).
    for (const token of ownTokens(battle, unit)) if (!token.mem.regularKeepOnOwnerRemoved) battle.retreat(token, { reason: 'owner-removed', permanent: true });
  }, { owner: unit });
}

function customizeRoberta({ id, def, unit, kit }) {
  const skill = def.skill, bb = skill.bb;
  kit.trait = { ...kit.trait, attack: 'melee', dmgType: 'phys', projectile: 'none', canHitFly: false,
    windup: evidence.operators[id].models.Front.hits.Attack[0] };
  const second = skill.id === 'skchr_robrta_2';
  kit.skill = { id: skill.id, name: skill.name, kind: 'duration',
    mods: second ? { defPct: bb.def, blockCnt: bb.block_cnt } : { atkPct: bb.atk, defPct: bb.def },
    ...(second ? { attack: { noAttack: true }, onEnd: ({ battle }) => {
      const state = cardState(battle, summonCardId(id));
      // The source post-cast RechargeToken charges one item after the spell.
      if (state?.owner === unit && live(unit))
        state.stock = Math.min(state.record.stats.maxDeckStackCnt, state.stock + bb['robrta_s_2[recharge].cnt']);
    } } : {}),
  };
}

function modelerTarget(battle, token) {
  return battle.allyUnits.find(ally => live(ally) && ally.kind === 'op' && !ally.hidden
    && !ally.s.flags.noHeal && !ally.s.flags.healFree && battle.allySelectable(ally, token)
    && token.rangeKeySet.has(ally.tileR * 21 + ally.tileC)
    && ['MELEE', 'ALL'].includes(battle.grid.tile(ally.tileR, ally.tileC).build));
}

/** The device holds its shield count. A new ally occupying the facing tile
 * inherits only the unspent charges, while DEF never stacks across Modelers. */
function syncModelers(battle, owner) {
  const devices = ownTokens(battle, owner).filter(token => token.defId === REGULAR_SUMMONS.char_484_robrta.tokenId);
  const affected = new Map();
  for (const token of devices) {
    const target = modelerTarget(battle, token);
    token.mem.modelerTarget = target ?? null;
    token.mem.regularFormVisual = { clip: target ? 'Idle' : 'Default', loop: true, die: 'End' };
    if (!target) continue;
    const previous = affected.get(target);
    if (!previous || previous.value < token.mem.modelerDef)
      affected.set(target, { value: token.mem.modelerDef, source: token });
  }
  const key = `roberta:def:${owner.id}`;
  for (const ally of battle.allyUnits) {
    const effect = affected.get(ally), old = ally.findBuff(key);
    if (!effect) battle.removeBuff(ally, key);
    else if (old?.mods.defPct !== effect.value)
      battle.addBuff(ally, { key, source: effect.source, mods: { defPct: effect.value } });
  }
}

function installModeler(battle, token, state) {
  const talent = state.record.talents[0], bb = talent.bb;
  token.mem.modelerDef = bb.def;
  token.mem.modelerShields = talent.prefabKey === '1+' ? 2 : 1;
  battle.addBuff(token, { key: 'modeler:invulnerable', flags: { invulnerable: true, untargetable: true }, persist: true });
  // HIGH_PRIORITY source BlockDamage runs once for the beneficiary's damage;
  // other Modelers retain their own unspent charges for later hits.
  battle.on('hit', ctx => {
    if (!live(token) || !live(state.owner) || ctx.dmg.cancel || !(ctx.dmg.amount > 0)) return;
    syncModelers(battle, state.owner);
    const active = ownTokens(battle, state.owner).find(device => device.mem.modelerTarget === ctx.target
      && device.mem.modelerShields > 0);
    if (active !== token) return;
    token.mem.modelerShields--; ctx.dmg.cancel = true;
  }, { owner: token, priority: 100 });
  const sync = () => syncModelers(battle, state.owner);
  sync(); battle.every(battle.dt, sync, { owner: token });
  battle.on('deploy', sync, { owner: token });
  battle.on('death', ({ unit: removed }) => {
    if (removed === token) sync();
  }, { owner: token });
  battle.after(bb.duration, () => {
    if (live(token)) battle.retreat(token, { permanent: true, reason: 'modeler-expired' });
  }, { owner: token });
}
