// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-summon-prefabs.json' with { type: 'json' };
import { REGULAR_SUMMONS, summonCardId, summonUnitId, summonRecordFor } from '../../../shared/arkpedia/summons.js';
import { canDeployInViewport } from '../../../shared/arkpedia/squad.js';
import { createMetalCrab, customizeBeanstalk, installBeanstalk } from './arkpedia-tacticians.js';
import { installShamareDoll } from './arkpedia-five-star-support-third.js';
import { installNightingaleCage } from './arkpedia-six-star-medic.js';
import { installSilenceDrone } from './arkpedia-five-star-medic-fourth.js';
import { createPhantomClone } from './arkpedia-phantom.js';
import { createKaltsitMon3tr } from './arkpedia-kaltsit.js';
import { createSceneBuggyCam } from './arkpedia-scene.js';
import { createSlumberfoot } from './arkpedia-blacknight.js';
import { createWindflitBattery } from './arkpedia-windflit.js';
import { createAlannaDevice } from './arkpedia-alanna.js';
import { createFrostMat } from './arkpedia-frost.js';
import { createRobinClip } from './arkpedia-robin.js';
import { installSilenceParadigmaticDrone } from './arkpedia-silence-paradigmatic.js';

const live = unit => unit?.alive && unit.deployed;
const ownTokens = (battle, owner) => battle.allyUnits.filter(token =>
  (token.kind === 'token' || token.kind === 'device' && token.mem.regularSummonCard)
  && token.ownerUnit === owner && live(token));
const cardState = (battle, key) => battle.regularSummons?.get(key);

export function regularSummonCards(battle) {
  return [...(battle.regularSummons?.values() ?? [])].map(state => ({
    ...state, available: live(state.owner) && state.stock > 0
      && (!state.config.requiresActiveSkill || state.owner.skill.active),
    deployed: ownTokens(battle, state.owner).length,
    cost: state.record.stats.cost,
  }));
}

export function summonPlacementError(battle, key, row, col) {
  const state = cardState(battle, key);
  if (!canDeployInViewport(battle.viewport)) return 'Open the fullscreen workspace to deploy.';
  if (battle.finished) return 'Battle has ended.';
  if (!state || !live(state.owner)) return 'Deploy the summoner first.';
  if (state.config.requiresActiveSkill && !state.owner.skill.active) return 'Activate the summoner skill first.';
  if (state.stock <= 0) return 'No summons remaining.';
  if (state.readyAt > battle.time + 1e-9) return 'Summon is still redeploying.';
  if (ownTokens(battle, state.owner).length >= state.record.stats.maxDeployCount)
    return 'Summon deployment limit reached.';
  if (battle.deployedSlots() + state.config.deploymentSlotCost > battle.unitLimit)
    return 'Deployment limit reached.';
  if (!Number.isInteger(row) || !Number.isInteger(col) || !battle.grid.inRect(row, col))
    return 'Select a tile on the map.';
  if (state.config.limitByHostAttackRange && !state.owner.rangeKeySet.has(row * 21 + col))
    return "Choose a tile inside the summoner's attack range.";
  const tile = battle.grid.tile(row, col);
  if (tile.build !== 'ALL' && tile.build !== state.record.position
    && !(state.record.position === 'ALL' && ['MELEE', 'RANGED'].includes(tile.build)))
    return state.record.position === 'ALL' ? 'Choose a deployable tile.' : 'Choose a melee tile.';
  if (battle.allyUnits.some(unit => live(unit) && unit.tileR === row && unit.tileC === col))
    return 'Tile is occupied.';
  if (state.config.excludeWalkingEnemy && battle.enemies.some(enemy => live(enemy)
    && enemy.motion !== 'FLY' && Math.round(enemy.x) === col && Math.round(enemy.y) === row))
    return 'Choose a tile without a ground enemy.';
  if (battle.dp < state.record.stats.cost) return 'Not enough DP.';
  return null;
}

export function deployRegularSummon(battle, key, row, col, dir = 'RIGHT') {
  const error = summonPlacementError(battle, key, row, col);
  if (error) throw Error(error);
  if (!['UP', 'DOWN', 'LEFT', 'RIGHT'].includes(dir)) throw Error('Choose a facing direction.');
  const state = cardState(battle, key), source = evidence.tokens[state.record.id];
  const token = state.ownerId === 'char_250_phatom' ? createPhantomClone(battle, state, row, col, dir)
    : state.ownerId === 'char_003_kalts' ? createKaltsitMon3tr(battle, state, row, col, dir)
    : state.ownerId === 'char_336_folivo' ? createSceneBuggyCam(battle, state, row, col, dir)
    : state.ownerId === 'char_476_blkngt' ? createSlumberfoot(battle, state, row, col)
    : state.ownerId === 'char_433_windft' ? createWindflitBattery(battle, state, row, col, dir)
    : state.ownerId === 'char_4178_alanna' ? createAlannaDevice(battle, state, row, col, dir)
    : state.ownerId === 'char_458_rfrost' ? createFrostMat(battle, state, row, col)
    : state.ownerId === 'char_451_robin' ? createRobinClip(battle, state, row, col)
    : state.config.tacticalPoint ? createMetalCrab(battle, state, row, col)
    : battle.spawnToken(state.owner, state.record.id, row, col, {
    dir, def: state.record, kit: { skill: null, trait: { attack: 'melee',
      dmgType: 'phys', projectile: 'none', canHitFly: false,
      ...(state.config.noAttack ? { canAttack: () => false }
        : { windup: source.model.hits[state.config.attackClip][0] }) },
      install: (battle, unit) => {
        if (state.config.healFree) battle.addBuff(unit, { key: 'summon:heal-free',
          flags: { healFree: true }, persist: true, allowDead: true });
      },
    },
  });
  if (!token) throw Error('Summon placement failed.');
  token.deploymentSlotCost = state.config.deploymentSlotCost;
  token.mem.regularSummonCard = key;
  battle.getPlayer(state.owner.ownerId).dp -= state.record.stats.cost;
  state.stock--;
  // Phantom's original ON_FINISH token recharge starts the independent clock
  // when the clone is removed. Existing consumable-token clocks stay unchanged.
  if (state.ownerId !== 'char_250_phatom' && !state.config.rechargeOnFinish)
    state.readyAt = battle.time + state.record.stats.respawnTime;
  // The original Tentacle has no facing picker: its attack ability turns toward
  // the selected target; the one-tile source range is independent of direction.
  if (!state.config.chooseFacing && !state.config.fixedRotation) battle.on('beforeAttack', ctx => {
    if (ctx.attacker === token && ctx.targets[0])
      token.dir = ctx.targets[0].x < token.x ? 'LEFT' : 'RIGHT';
  }, { owner: token });
  if (state.ownerId === 'char_179_cgbird') installNightingaleCage(battle, token, state);
  if (state.ownerId === 'char_108_silent') installSilenceDrone(battle, token, state);
  if (state.ownerId === 'char_1031_slent2') installSilenceParadigmaticDrone(battle, token, state);
  if (state.ownerId === 'char_484_robrta') installModeler(battle, token, state);
  if (state.ownerId === 'char_254_vodfox') {
    installShamareDoll(battle, token, state);
    battle.removeBuff(state.owner, 'shamare:stock-full');
  }
  state.syncSkill?.();
  return token;
}

export function selectedRegularSummon(battle, key) {
  if (key?.startsWith('summon:')) return cardState(battle, key) ?? null;
  if (!key?.startsWith('token:')) return null;
  const unit = battle.allyUnits.find(token => summonUnitId(token) === key && live(token));
  const state = unit && cardState(battle, unit.mem.regularSummonCard);
  return state ? { ...state, unit } : null;
}

export function retreatRegularSummon(battle, key) {
  if (!canDeployInViewport(battle.viewport) || battle.finished) throw Error('Battle workspace is inactive.');
  const state = selectedRegularSummon(battle, key), token = state?.unit;
  if (!live(token)) throw Error('Summon is not deployed.');
  if (token.mem.metalCrabRest) { token.mem.metalCrabRest(); return; }
  battle.addDp(token.ownerId, Math.floor(state.record.stats.cost * state.config.refundRatio));
  battle.retreat(token, { permanent: true });
}

/** Before setup; suppress inferred own-ATK/DEF/regeneration from S1. */
export function customizeSummonerKit({ id, def, unit, kit }) {
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
  const config = REGULAR_SUMMONS[def.id];
  if (!config || config.skillId && def.skill?.id !== config.skillId
    || config.minimumElite != null && def.raw.arkpedia.elite < config.minimumElite) return;
  const build = ['char_250_phatom', 'char_451_robin', 'char_458_rfrost'].includes(def.id)
    ? { ...def.raw.arkpedia, skillId: def.skill.id } : def.raw.arkpedia;
  const key = summonCardId(def.id), record = summonRecordFor(def.id, build, battle.data.raw.tokens);
  if (!battle.regularSummons) battle.regularSummons = new Map();
  const previous = battle.regularSummons.get(key);
  const state = { key, ownerId: def.id, owner: unit, tokenId: record.id, config,
    record, stock: config.additiveBornStock ? previous?.stock ?? 0 : 0,
    readyAt: def.id === 'char_250_phatom' ? previous?.readyAt ?? battle.time : battle.time, unit: null,
    syncSkill: () => unit.mem.summonSkillSync?.(battle),
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
      if (def.id === 'char_250_phatom') state.stock = Math.min(1, state.stock);
      else state.readyAt = battle.time;
      if (config.stockLimit) battle.removeBuff(unit, 'shamare:stock-full');
      if (def.id === 'char_108_silent') battle.removeBuff(unit, 'silence:stock-full');
      if (['char_451_robin', 'char_458_rfrost'].includes(def.id)) state.syncSkill();
    }
    if (live(unit) && unit.skill.active) state.syncSkill();
  }, { owner: unit });
  battle.on('death', ({ unit: removed }) => {
    if (removed !== unit) return;
    for (const token of ownTokens(battle, unit)) battle.retreat(token, { reason: 'owner-removed', permanent: true });
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
