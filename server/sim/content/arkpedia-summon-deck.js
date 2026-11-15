// SPDX-License-Identifier: GPL-3.0-or-later
// Shared deck operations depend on the current owner's prepared state. Operator
// controllers and their native evidence load only when that owner is selected.
import { stageSummonCost, stageCardRespawnTime } from './arkpedia-stage-card-cost.js';
import { canSpendDp } from './arkpedia-dp-budget.js';
import { summonUnitId } from '../../../shared/arkpedia/summons.js';
import { canDeployInViewport } from '../../../shared/arkpedia/squad.js';

export const liveSummonUnit = unit => unit?.alive && unit.deployed;
export const ownedSummons = (battle, owner) => battle.allyUnits.filter(token =>
  (token.kind === 'token' || token.kind === 'device' && token.mem.regularSummonCard)
  && token.ownerUnit === owner && liveSummonUnit(token));
export const summonCardState = (battle, key) => battle.regularSummons?.get(key);

export function regularSummonCards(battle) {
  return [...(battle.regularSummons?.values() ?? [])].map(state => ({
    ...state, available: liveSummonUnit(state.owner) && state.stock > 0
      && (!state.config.requiresActiveSkill || state.owner.skill.active),
    deployed: state.deck?.own ? state.deck.own().length : ownedSummons(battle, state.owner).length,
    cost: stageSummonCost(battle, state.record),
  }));
}

export function summonPlacementError(battle, key, row, col) {
  const state = summonCardState(battle, key);
  if (state?.deck?.placementError) return state.deck.placementError(row, col);
  if (!canDeployInViewport(battle.viewport)) return 'Open the fullscreen workspace to deploy.';
  if (battle.finished) return 'Battle has ended.';
  if (!state || !liveSummonUnit(state.owner)) return 'Deploy the summoner first.';
  if (state.config.requiresActiveSkill && !state.owner.skill.active) return 'Activate the summoner skill first.';
  if (state.stock <= 0) return 'No summons remaining.';
  if (state.readyAt > battle.time + 1e-9) return 'Summon is still redeploying.';
  if (ownedSummons(battle, state.owner).length >= state.record.stats.maxDeployCount)
    return 'Summon deployment limit reached.';
  if (battle.deployedSlots() + state.config.deploymentSlotCost > battle.unitLimit)
    return 'Deployment limit reached.';
  if (!Number.isInteger(row) || !Number.isInteger(col) || !battle.grid.inRect(row, col))
    return 'Select a tile on the map.';
  const placementRange = state.owner.mem.regularSummonPlacementKeys?.(state.owner) ?? state.owner.rangeKeySet;
  if (state.config.limitByHostAttackRange && !placementRange.has(row * 21 + col))
    return "Choose a tile inside the summoner's attack range.";
  if (state.config.adjacentToHost && Math.abs(row - state.owner.tileR) + Math.abs(col - state.owner.tileC) !== 1)
    return 'Choose a tile next to the summoner.';
  const tile = battle.grid.tile(row, col);
  if (tile.build !== 'ALL' && tile.build !== state.record.position
    && !(state.record.position === 'ALL' && ['MELEE', 'RANGED'].includes(tile.build)))
    return state.record.position === 'ALL' ? 'Choose a deployable tile.'
      : state.record.position === 'RANGED' ? 'Choose a high-ground tile.' : 'Choose a melee tile.';
  if (battle.allyUnits.some(unit => liveSummonUnit(unit) && unit.tileR === row && unit.tileC === col))
    return 'Tile is occupied.';
  if (state.config.excludeWalkingEnemy && !state.owner.mem.regularSummonAllowsEnemy?.(battle, state.owner, row, col) && battle.enemies.some(enemy => liveSummonUnit(enemy)
    && enemy.motion !== 'FLY' && Math.round(enemy.x) === col && Math.round(enemy.y) === row))
    return 'Choose a tile without a ground enemy.';
  if (!canSpendDp(battle, state.owner.ownerId, stageSummonCost(battle, state.record))) return 'Not enough DP.';
  return null;
}

export function deployRegularSummon(battle, key, row, col, dir = 'RIGHT') {
  const error = summonPlacementError(battle, key, row, col);
  if (error) throw Error(error);
  if (!['UP', 'DOWN', 'LEFT', 'RIGHT'].includes(dir)) throw Error('Choose a facing direction.');
  const state = summonCardState(battle, key);
  if (state.deck?.place) return state.deck.place(row, col, dir);
  const source = state.sourceToken;
  // Ela's source-fed deck owns its charge/cooldown transaction and lifecycle.
  if (state.ownerId === 'char_4123_ela') {
    const deck = state.owner.mem.elaController?.deck;
    if (!deck || deck.state !== state) throw Error('Missing current Ela mine deck.');
    return deck.place(row, col);
  }
  // Selected owner adapters provide native factories; shared placement still owns
  // the stock, DP and cooldown transaction. Never fall back to a generic token.
  if (state.config.ownerFactory && typeof state.owner.mem.regularSummonFactory !== 'function')
    throw Error(`Missing selected summon factory for ${state.ownerId}.`);
  const token = state.config.ownerFactory ? state.owner.mem.regularSummonFactory(battle, state, row, col, dir)
    : state.config.tacticalPoint ? state.createToken(battle, state, row, col)
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
  battle.getPlayer(state.owner.ownerId).dp -= stageSummonCost(battle, state.record);
  state.stock--;
  // Phantom's original ON_FINISH token recharge starts the independent clock
  // when the clone is removed. Existing consumable-token clocks stay unchanged.
  if (state.ownerId !== 'char_250_phatom' && !state.config.rechargeOnFinish)
    state.readyAt = battle.time + stageCardRespawnTime(battle, state.record);
  // The original Tentacle has no facing picker: its attack ability turns toward
  // the selected target; the one-tile source range is independent of direction.
  if (!state.config.chooseFacing && !state.config.fixedRotation) battle.on('beforeAttack', ctx => {
    if (ctx.attacker === token && ctx.targets[0])
      token.dir = ctx.targets[0].x < token.x ? 'LEFT' : 'RIGHT';
  }, { owner: token });
  state.installToken?.(battle, token, state);
  state.syncSkill?.();
  return token;
}

export function selectedRegularSummon(battle, key) {
  if (key?.startsWith('summon:')) return summonCardState(battle, key) ?? null;
  if (!key?.startsWith('token:')) return null;
  const unit = battle.units.find(token => token.mem.regularSummonCard
    && summonUnitId(token) === key && liveSummonUnit(token));
  const state = unit && summonCardState(battle, unit.mem.regularSummonCard);
  return state ? { ...state, unit } : null;
}

export function retreatRegularSummon(battle, key) {
  if (!canDeployInViewport(battle.viewport) || battle.finished) throw Error('Battle workspace is inactive.');
  const state = selectedRegularSummon(battle, key), token = state?.unit;
  if (!liveSummonUnit(token)) throw Error('Summon is not deployed.');
  if (state.deck?.retreat) { state.deck.retreat(token); return; }
  if (token.mem.metalCrabRest) { token.mem.metalCrabRest(); return; }
  battle.addDp(token.ownerId, Math.floor(stageSummonCost(battle, state.record) * state.config.refundRatio));
  battle.retreat(token, { permanent: true });
}

