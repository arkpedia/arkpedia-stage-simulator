// SPDX-License-Identifier: GPL-3.0-or-later
import { COLS } from '../constants.js';
const live = unit => unit.alive && unit.deployed && !unit.removed;
/** Platforms retain their occupied tile while a ranged guest uses the core
 * host/guest deployment account. One battle registry owns build overrides. */
export function attachRangedPlatform(b, unit, { onLost = () => {} } = {}) {
  if (!b.rangedPlatforms) {
    b.rangedPlatforms = new Map();
    const previous = b.regularTileBuild;
    b.regularTileBuild = (r, c) => {
      const host = b.rangedPlatforms.get(r * COLS + c);
      return host && live(host) ? 'RANGED' : previous?.(r, c) ?? null;
    };
  }
  const key = unit.tileR * COLS + unit.tileC;
  if (b.rangedPlatforms.has(key)) throw Error('Platform tile already has a host');
  b.rangedPlatforms.set(key, unit);
  const elevated = (b._elevated ??= new Set()).has(key); b._elevated.add(key);
  const tileKey = `${unit.tileR},${unit.tileC}`, waterPlatform = (b.platformTiles ??= new Set()).has(tileKey);
  b.platformTiles.add(tileKey);
  unit.mem.regularHost = { guest: null, accepts: guest => live(unit) && !unit.mem.regularHost.guest
    && (guest.def?.position ?? b.data.getChess(guest.defId)?.position) === 'RANGED'
    && (guest.kind ?? 'op') === 'op' };
  b.on('death', ({ unit: lost, reason }) => {
    if (lost !== unit) return;
    b.rangedPlatforms.delete(key); if (!elevated) b._elevated.delete(key);
    if (!waterPlatform) b.platformTiles.delete(tileKey);
    const guest = unit.mem.regularHost.guest;
    unit.mem.regularHost.guest = null;
    if (guest && live(guest)) onLost(guest, reason);
    if (guest?.mem.regularHostedBy === unit) {
      delete guest.mem.regularHostedBy;
      guest.ground = b.grid.isLow(guest.tileR, guest.tileC) && !b._elevated.has(key);
      if (live(guest) && guest.tileR === unit.tileR && guest.tileC === unit.tileC && !b.unitAt(unit.tileR, unit.tileC))
        b._occ[key] = guest;
    }
  }, { owner: unit });
}
