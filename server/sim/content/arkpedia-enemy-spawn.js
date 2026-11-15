// SPDX-License-Identifier: GPL-3.0-or-later
// Source-owned child routes and spawning; no enemy registry is loaded here.
/** Remaining route of an enemy from its current position (for summons / phantoms that continue its path). */
export function remainingRoute(e) {
  const R = e.route;
  const here = [e.y, e.x];
  if (!R || !Array.isArray(R.legs) || !R.legs.length) return { motion: e.motion === 'FLY' ? 'FLY' : 'WALK', start: here, end: here, checkpoints: [] };
  const steps = [];
  let end = null;
  for (let i = Math.max(0, R.legIdx); i < R.legs.length; i++) {
    const L = R.legs[i];
    if (L.final) { end = [L.r, L.c]; break; }
    if (L.t === 'move') steps.push({ t: 'move', p: [L.r, L.c] });
    else if (L.t === 'wait') steps.push({ t: 'wait', s: i === R.legIdx && R.waitLeft != null ? R.waitLeft : L.time });
    else if (L.t === 'deadline') steps.push({ t: 'WAIT_UNTIL', s: L.time, clock: 'absolute' });
    else if (L.t === 'disappear') steps.push({ t: 'disappear' });
    else if (L.t === 'appear') steps.push({ t: 'appear', p: [L.r, L.c] });
  }
  if (!end) { const last = R.legs[R.legs.length - 1]; end = last && last.r != null ? [last.r, last.c] : [Math.round(e.y), Math.round(e.x)]; }
  const route = { motion: e.motion === 'FLY' ? 'FLY' : 'WALK', start: here, end, checkpoints: [] };
  if (steps.length) route.steps = steps;
  return route;
}

/** A route that keeps an enemy in place (content moves it by hand). */
export function stayRoute(e, secs = 99999) {
  const p = [Math.round(e.y), Math.round(e.x)];
  return { motion: e.motion === 'FLY' ? 'FLY' : 'WALK', start: p, end: p, steps: [{ t: 'wait', s: secs }] };
}

/**
 * Mods copied onto a split or summoned child. The parent's stat multipliers travel; a kill bounty does not
 * (owner 2026-10-04: the main body alone carries it — GitHub #67, #89-2). `bountyId` is the 悬赏 card and
 * `bountyCoins` is the coin copy the match writes for 联防. The parent object is left as it is.
 */
function modsWithoutBounty(mods) {
  if (!mods || typeof mods !== 'object') return mods ?? null;
  if (mods.bountyId == null && mods.bountyCoins == null) return mods;
  const copy = { ...mods };
  delete copy.bountyId;
  delete copy.bountyCoins;
  return copy;
}

/** Spawn `n` enemies at the parent's position that continue its route. Returns the spawned units. */
export function spawnChildren(b, parent, key, n, opts = {}) {
  const out = [];
  const route = opts.route ?? remainingRoute(parent);
  const cnt = Math.max(0, Math.min(20, Math.floor(n)));
  const mods = modsWithoutBounty(opts.mods ?? parent.mods ?? null);
  for (let i = 0; i < cnt; i++) {
    const off = cnt > 1 ? (i - (cnt - 1) / 2) * 0.2 : 0;
    const pos = opts.pos ?? [parent.y, parent.x + off];
    const c = b.spawnEnemy(key, {
      pos, route, mods, tag: opts.tag ?? null, countInTotal: opts.countInTotal,
      ownerPlayerId: parent.ownerId ?? null, sourcePlayerId: parent.sourcePlayerId ?? null,
    });
    if (c) out.push(c);
  }
  if (out.length) b.fx('summon', { x: parent.x, y: parent.y, id: parent.id, key, n: out.length });
  return out;
}

