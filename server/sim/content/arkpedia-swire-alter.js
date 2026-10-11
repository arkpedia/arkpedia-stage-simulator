// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-swire-alter-prefabs.json' with { type: 'json' };
import { SWIRE_ALTER_ID } from './arkpedia-swire-alter-economy.js';
import { prepareSwirePassives, SWIRE_PASSIVE_CONTRACT } from './arkpedia-swire-alter-passives.js';
import { prepareSwireS3, SWIRE_S3_CONTRACT } from './arkpedia-swire-alter-s3.js';

export function customizeSwireAlterKit({ battle, id, unit, kit }) {
  if (id !== SWIRE_ALTER_ID) return;
  if (!evidence.enabledOperators.includes(id) || evidence.heldOperators.includes(id)
    || evidence.runtimeMapping?.[id] !== 'swire-alter')
    throw Error('Swire source record lacks a complete ordinary runtime review');
  const prepared = unit.def.skill.id === 'skchr_swire2_3'
    ? prepareSwireS3(battle, unit, { contract: SWIRE_S3_CONTRACT })
    : prepareSwirePassives(battle, unit, { contract: SWIRE_PASSIVE_CONTRACT });
  unit.mem.swireController = prepared.controller;
  // Override the Merchant profession installer as well as the inherited kit.
  // Only this source-fed controller owns DP upkeep and talent/resource state.
  kit.install = null; kit.talents = [];
  Object.assign(kit, prepared.kit);
  kit.trait.install = null;
  kit.skill.resourceGauge = () => {
    const c = prepared.controller, wallet = c.wallet;
    return c.valid() && (wallet.active || c.mode === 4) ? {
      current: wallet.coins, maximum: wallet.record.capacity, label: 'Coins',
      canCancel: c.mode === 3 && c.canCancel(), ending: c.mode === 4,
    } : null;
  };
}
export function installSwireAlter({ unit, def }) {
  if (def.charId !== SWIRE_ALTER_ID) return;
  if (!unit.mem.swireController) throw Error('Missing selected Swire controller');
  unit.mem.swireController.install();
}
