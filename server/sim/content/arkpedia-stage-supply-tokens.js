// SPDX-License-Identifier: GPL-3.0-or-later
import { configureStageSupply } from './arkpedia-stage-supply-account.js';
import { areaSelectable } from '../targeting.js';

/** A timed deployment pulse uses the same status and removal paths as units. */
export function startStunToken(b, unit, token) {
  configureStageSupply(unit, token);
  unit.mem.stageSupplyReleaseAt = b.time + token.release;
  b.addBuff(unit, { key: 'stage:supplyToken', persist: true, flags: { disarm: true, noMove: true } });
  const keys = new Set(token.range.map(([r, c]) => `${unit.tileR + r},${unit.tileC + c}`));
  unit.rangeKeys = token.range.map(([r, c]) => [unit.tileR + r, unit.tileC + c])
    .filter(([r, c]) => b.grid.inRect(r, c)).map(([r, c]) => r * b.grid.cols + c);
  b.after(token.release, () => {
    if (!unit.alive || !unit.deployed) return;
    for (const e of b.enemies) if (areaSelectable(unit, e) && keys.has(`${Math.round(e.y)},${Math.round(e.x)}`))
      b.applyStatus(e, 'stun', { duration: token.stun, source: unit });
    b.fx('explode', { x: unit.x, y: unit.y, r: 1, kind: 'stun' });
    b._remove(unit, 'withdraw', null, true);
  }, { owner: unit });
}
