// SPDX-License-Identifier: GPL-3.0-or-later
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { compileHuiMingTiles, hasHuiMingTiles } from '../../shared/arkpedia/stage-hui-ming.js';
import native from '../../data/arkpedia-hui-ming-tile-source.json' with { type: 'json' };
const canonical = v => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
const digest = v => createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
// Exact retained tile prefabs and the buff templates they name. The reviewed
// reading: a mark tile is a two-mode dynamic buff tile for the player's own
// ground units (mode 0 yin, mode 1 yang, with the same/opposite scale buffs
// and one result log, nothing cleared on leaving, no effect on enemies when
// its mode switches); the switch tile starts the immediate attribute swap on a
// ground enemy that enters. Tile clocks and enter/leave ordering have no
// retained method bodies, so this is not a native frame-order certificate.
const REVIEWED = {
  prefabs: {
    tile_yinyang_road: '4684c420dcae93d5d0f8191fa69aed240caac858abdf6631377a747a481f0730',
    tile_yinyang_wall: 'd3979839d1d9fb1b49018feee76c5f7fc9e2b50cbec53951ee04a18405e0e2af',
    tile_yinyang_switch: '3664c45b21654bfada00b21a60d3861e1fc51751b23a5e4ec0e06d23fe4e448a',
  },
  templates: {
    'buff_yinyang[same]': 'be67ebfdd80778d619e9abbc21de766bd6855e8d8f700595938bdc98a1ee26fd',
    'buff_yinyang[diff]': 'ae0547e526bdc8b9060b7a56eeeb0ede630afb90d35778800f9ae48334d1a4ea',
    'buff_yinyang[log]': 'f95bfc8538da11c3032cee06a3f96a37bf23ea13032cd6a5e0c2e1be47e0ed5a',
    buff_yinyang_switch: '4067595a1db4e0db9363d8d719ec761ee18cca106757f3daa6491bd21a817f56',
    buff_yin: '20cde44947c6e266e434a2602dd6ce82000227d6a41c3f5d72cedd0602d3b811',
    buff_yang: '066c1cabf82dc10bd492a6ba5e6769478bd81e730b3eb801668402d288a481c3',
    empty: 'd69d02ffba6109beba7ab4bece54fad0eb9e9bcc0623c2f764c617adc56a7402',
  },
};
export function huiMingTilesReviewed(evidence = native) {
  return Object.keys(evidence?.prefabs ?? {}).length === 3 && Object.keys(evidence?.templates ?? {}).length === 7
    && Object.entries(REVIEWED.prefabs).every(([k, hash]) => evidence.prefabs[k] && digest(evidence.prefabs[k].components.map(c => c.data)) === hash)
    && Object.entries(REVIEWED.templates).every(([k, hash]) => evidence.templates[k] && digest(evidence.templates[k]) === hash);
}
/** The stage's Hui-Ming tile program, or null for a stage without these tiles. */
export function compileStageHuiMing(geometry, evidence = native) {
  if (!hasHuiMingTiles(geometry)) return null;
  if (!huiMingTilesReviewed(evidence)) throw Error('Unreviewed Hui-Ming tile source');
  return compileHuiMingTiles(geometry);
}
export async function prepareStageHuiMing({ root, geometry }) {
  const huiMing = compileStageHuiMing(geometry);
  if (!huiMing) return { huiMing: null, sources: [] };
  const path = 'data/arkpedia-hui-ming-tile-source.json';
  return { huiMing, sources: [{ path, sha256: createHash('sha256').update(await readFile(join(root, path))).digest('hex') }] };
}
