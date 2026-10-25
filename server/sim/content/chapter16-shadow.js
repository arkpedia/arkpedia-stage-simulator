// SPDX-License-Identifier: GPL-3.0-or-later
import { COLS } from '../constants.js';
import { chapter17Environment } from './chapter17.js';

// range_table x-2: the 5x5 square with its four corners omitted. x-4 is
// the miner's 3x3 temporary escape range. Both are retained in device-source.
export const FACILITY_SHADOW_RANGE = Object.freeze(Array.from({ length: 5 }, (_, r) => r - 2)
  .flatMap(r => Array.from({ length: 5 }, (_, c) => c - 2)
    .filter(c => Math.abs(r) !== 2 || Math.abs(c) !== 2).map(c => Object.freeze([r, c]))));

/** Persistent shadow producers and temporary escape are independent layers. */
export function chapter16Shadow(b) {
  const env = chapter17Environment(b);
  if (env.shadowSources) return env;
  const active = (owner, field) => owner.alive && owner.deployed !== false && owner.deploySeq === field.deploySeq;
  env.shadowSources = new Map();
  env.setShadowSource = (owner, tiles) => {
    const keys = new Set(tiles.filter(([r, c]) => b.grid.inRect(r, c)).map(([r, c]) => r * COLS + c));
    const field = { keys, deploySeq: owner.deploySeq };
    env.shadowSources.set(owner, field);
    return () => {
      if (env.shadowSources.get(owner) === field) env.shadowSources.delete(owner);
    };
  };
  env.isShadow = (r, c) => {
    if (!b.grid.inRect(r, c)) return false;
    const key = r * COLS + c;
    if ((env.shadowSuppressedUntil.get(key) ?? -Infinity) > b.time + 1e-9) return false;
    for (const [owner, field] of env.shadowSources) if (active(owner, field) && field.keys.has(key)) return true;
    return false;
  };
  env.suppressShadow = (r, c, duration) => {
    if (!b.grid.inRect(r, c)) return;
    const key = r * COLS + c;
    env.shadowSuppressedUntil.set(key, Math.max(env.shadowSuppressedUntil.get(key) ?? -Infinity, b.time + duration));
  };
  // Remove dead producers and expired escape entries without waiting for a
  // query. Both the object and deployment sequence belong to the source life.
  b.on('tick', () => {
    for (const [owner, field] of env.shadowSources) if (!active(owner, field)) env.shadowSources.delete(owner);
    for (const [key, until] of env.shadowSuppressedUntil) if (until <= b.time + 1e-9) env.shadowSuppressedUntil.delete(key);
  });
  return env;
}

/** Native fowstn_t[shadow_tile]: add the owner's range on start, remove on finish. */
export function facilityShadow(b, owner) {
  return chapter16Shadow(b).setShadowSource(owner,
    FACILITY_SHADOW_RANGE.map(([r, c]) => [owner.tileR + r, owner.tileC + c]));
}
