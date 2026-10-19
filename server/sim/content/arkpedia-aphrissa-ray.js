// SPDX-License-Identifier: GPL-3.0-or-later
// Held geometry adapter only. It emits neither attacks nor skill activations.
import {aphrissaNativeInputs, APHRISSA_ID as ID, APHRISSA_RELAY_ID as TOKEN,
  selectedAphrissaInputs} from './arkpedia-aphrissa-source.js';
import {DIR_VEC as vectors} from '../dir.js';

export const APHRISSA_RAY_CONTRACT = Object.freeze({
  scope: 'Diagnostic current-tile ray geometry for ordinary/S1/S3 and S2 only; not a playable kit.',
  mapping: 'Trace source straight range from the current owner tile and facing. A friendly original relay changes the outgoing direction and adds two cells to finite range. S2 follows an infinite ray to the map boundary and can turn through actual operators (source mask639) as well as relays. Each live grid occupant is sampled once per arrival. Returned cells retain first-arrival direction/extension counts; repeated directed arrivals terminate cycles. No source ownership filter is invented for the native ID-only relay validator.',
  limits: 'Grid-centre occupancy, direction aliases, first-arrival metadata, rectangular boundary and cycle termination are explicit local rules. The original custom range class compiled traversal, continuous body intersection, tie ordering and frame parity are unverified. Ordinary hits, S2 repeated damage and S3 payloads are separate gates. This adapter has no public registration or rendering approval.',
  frameParity: false,
});
const present = unit => unit?.alive && unit.deployed && !unit._removing && !unit.hidden;

export function aphrissaRayCells(b, u, {skill2 = false, contract} = {}) {
  if (contract !== APHRISSA_RAY_CONTRACT || u.def.charId !== ID || !present(u)
    || !vectors[u.dir]) throw Error('Current Aphrissa and explicit ray geometry contract required');
  const selected = selectedAphrissaInputs(u), n = aphrissaNativeInputs();
  if (skill2 && selected.index !== 1) throw Error('S2 ray requires the original selected second skill');
  if (n.ordinaryRange._infinite !== 0 || n.ordinaryRange._extendable !== 1
    || n.ordinaryRange._extendLengthEveryValidateChar !== 2 || n.ordinaryRelayValidator._targetId !== TOKEN
    || n.s2Range._infinite !== 1 || n.s2Range._extendable !== 0
    || n.s2TurnUnion._isAnd !== 0 || n.s2TurnUnion._invertedValidators.length
    || n.s2RelayValidator._targetId !== TOKEN || n.s2ExtendValidator._targetId !== TOKEN
    || n.s2OperatorValidator._targetOptions.professionMask !== 639)
    throw Error('Changed original Aphrissa ray selectors');
  const ordinary = selected.rangeGrid;
  if (!ordinary.length || ordinary.some(([row, col], i) => row !== 0 || col !== i))
    throw Error('Changed original Aphrissa straight source range');
  let row = u.tileR, col = u.tileC, dir = u.dir, remaining = skill2 ? Infinity : ordinary.length - 1;
  let extensionCount = 0, directionChanges = 0;
  const arrivals = new Set(), cells = new Map(), turns = [];
  while (b.grid.inRect(row, col)) {
    const arrival = `${row},${col},${dir}`;
    if (arrivals.has(arrival)) return {cells: [...cells.values()], turns, cycle: true};
    arrivals.add(arrival);
    const target = b.unitAt(row, col);
    const friendly = target !== u && present(target) && target.side === u.side;
    const relay = friendly && target.defId === TOKEN;
    const operator = friendly && target.kind === 'op' && !['TOKEN', 'TRAP', 'DEVICE'].includes(target.def.profession)
      && !target.s.flags.untargetable && !target.s.flags.isolated;
    if (relay || skill2 && operator) {
      if (!vectors[target.dir]) throw Error('Relay ray target has no cardinal direction');
      const incoming = dir;
      dir = target.dir;
      if (dir !== incoming) directionChanges++;
      if (relay) {
        extensionCount++;
        if (!skill2) remaining += n.ordinaryRange._extendLengthEveryValidateChar;
      }
      turns.push({row, col, sourceId: target.id, sourceLife: target.deploySeq, relay,
        incoming, outgoing: dir, extensionCount, directionChanges});
    }
    const key = `${row},${col}`;
    if (!cells.has(key)) cells.set(key, {row, col, dir, extensionCount, directionChanges});
    if (remaining <= 0) break;
    remaining--;
    const [dr, dc] = vectors[dir]; row += dr; col += dc;
  }
  return {cells: [...cells.values()], turns, cycle: false};
}
