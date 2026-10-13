// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../../data/arkpedia-marcil-runtime-review.json' with { type: 'json' };
import { MARCIL_ID as ID, validateMarcilDefinition } from './arkpedia-marcil-source.js';
import { MarcilManaWallet } from './arkpedia-marcil-mana.js';
import { MARCIL_ATTACK_CONTRACT, prepareMarcilAttacks } from './arkpedia-marcil-attacks.js';
import { MARCIL_FAMILIAR_CONTRACT, prepareMarcilFamiliar } from './arkpedia-marcil-familiar.js';
import { MARCIL_EXPLOSION_CONTRACT, prepareMarcilExplosion } from './arkpedia-marcil-explosion.js';
import { MARCIL_PARTY_CONTRACT, installMarcilParty } from './arkpedia-marcil-party.js';
function reviewed() {
  if (review.enabledOperators.length !== 1 || review.enabledOperators[0] !== ID
    || review.frameParity !== false || review.moduleSupport !== false || review.nativeParticleSupport !== false
    || review.chantPolicy !== 'request-then-active-v1'
    || review.projectilePolicy !== 'retain-born-unmanaged-shots-v1')
    throw Error('Marcille source lacks a public runtime review');
}
export function installMarcilSquad(b) {
  if (!b.bench[ID]) return;
  reviewed();
  const record = validateMarcilDefinition(b.data.getChess(ID));
  installMarcilParty(b, { contract: MARCIL_PARTY_CONTRACT });
  b._marcilManaWallets = new Map([['arkpedia:' + ID, new MarcilManaWallet(b, record)]]);
}
export function customizeMarcilKit({ battle, id, unit, kit }) {
  if (id !== ID) return;
  reviewed();
  const index = validateMarcilDefinition(unit.def).index;
  const prepare = [prepareMarcilAttacks, prepareMarcilFamiliar, prepareMarcilExplosion][index];
  const contract = [MARCIL_ATTACK_CONTRACT, MARCIL_FAMILIAR_CONTRACT, MARCIL_EXPLOSION_CONTRACT][index];
  Object.assign(kit, prepare(battle, unit, { contract }).kit);
}
export function installMarcil({ unit, def }) {
  if (def.charId !== ID) return;
  const controller = unit.mem.marcilAttacks;
  if (!controller) throw Error('Missing selected Marcille controller');
  controller.install();
}

export function marcilBenchMana(b, id) {
  if (id !== ID) return null;
  const wallet = b?._marcilManaWallets?.get('arkpedia:' + ID);
  return wallet && !wallet.closed && !wallet.owner ? {
    current: wallet.value, maximum: wallet.record.mana.maximum,
    fraction: wallet.value / wallet.record.mana.maximum,
    text: `${wallet.value} / ${wallet.record.mana.maximum} Mana`,
  } : null;
}
