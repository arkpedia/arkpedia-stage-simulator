// SPDX-License-Identifier: GPL-3.0-or-later
// Public card adapter; the selected native point controller owns every transaction.
import e from '../../../data/arkpedia-native-operators/char_4228_closur.json' with { type: 'json' };
import { CLOSUR_ID as ID, CLOSUR_TOKEN_ID as TOKEN } from './arkpedia-closur-source.js';
const present = u => u?.alive && u.deployed && !u._removing;
export function installClosurDeck(point) {
  const { b, u, record } = point, key = `summon:${ID}`;
  if (u.mem.closurDeck) throw Error('Closure command-center deck cannot be reinstalled');
  b.regularSummons ??= new Map();
  const existing = b.regularSummons.get(key);
  if (existing && present(existing.owner)) throw Error('A current Closure command-center deck already exists');
  const state = {
    key, ownerId: ID, tokenId: TOKEN, owner: u,
    record: { ...record, name: e.tables.tokens[TOKEN].appellation,
      arkpedia: { ...u.def.raw.arkpedia }, skill: null },
    config: { tokenId: TOKEN, chooseFacing: false, fixedRotation: true,
      deploymentSlotCost: 0, refundRatio: 0, healFree: true, tacticalPoint: true },
    get stock() { return !point.stopped && !point.own().length ? 1 : 0; },
    get readyAt() { return point.readyAt; },
    deck: { own: () => point.own(), placementError: (r, c) => point.placementError(r, c),
      place: (r, c) => point.place(r, c),
      retreat: token => {
        if (point.point?.unit !== token || !point.rest()) throw Error('Command center is already recovering.');
      } },
  };
  b.regularSummons.set(key, state); u.mem.closurDeck = state;
  const cleanup = () => {
    // An old owner's delayed teardown must not remove a fresh redeployed card.
    if (b.regularSummons.get(key) === state) b.regularSummons.delete(key);
    b.off(death); b.off(end);
  };
  const death = b.on('death', ({ unit }) => { if (unit === u) cleanup(); }, { owner: u });
  const end = b.on('battleEnd', cleanup);
  return state;
}
