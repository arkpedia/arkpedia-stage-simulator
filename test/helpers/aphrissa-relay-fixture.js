// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import data from '../../data/arkpedia-mvp.json' with {type: 'json'};
import evidence from '../../data/arkpedia-native-operators/char_4229_aphris.json' with {type: 'json'};
import {StandardBattle} from '../../server/sim/arkpedia.js';
import {normalizeChess} from '../../server/sim/simdata.js';
import {defaultBuild} from '../../shared/arkpedia/loadout.js';
import {APHRISSA_ID as ID, selectedAphrissaBuild} from '../../server/sim/content/arkpedia-aphrissa-source.js';
import {prepareAphrissaRelay, APHRISSA_RELAY_CONTRACT} from '../../server/sim/content/arkpedia-aphrissa-relay.js';
import {prepareAphrissaOrdinary, APHRISSA_ORDINARY_CONTRACT} from '../../server/sim/content/arkpedia-aphrissa-ordinary.js';
export {near, advance} from './mon3tr-fixture.js';

export function make({elite = 2, skill = 1, defer = false, contract = APHRISSA_RELAY_CONTRACT,
  ordinary = false, ordinaryContract = APHRISSA_ORDINARY_CONTRACT, dir = 'RIGHT', mutate} = {}) {
  const d = structuredClone(data);
  d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({length: 19}, () => Array(21).fill(2));
  const b = new StandardBattle(d, {operators: [defaultBuild(d.operators.char_122_beagle)]});
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({...t, height: 'LOW', build: 'ALL', pass: 'ALL'}));
  const c = evidence.tables.character, build = {elite, level: c.phases[elite].maxLevel,
    potential: 1, trust: 0, skillId: `skchr_aphris_${skill}`, skillRank: [4, 7, 10][elite], module: 'none'};
  const r = selectedAphrissaBuild(build);
  const def = normalizeChess({chessId: ID, charId: ID, name: c.appellation, profession: c.profession,
    position: c.position, stats: r.stats, rangeGrid: r.rangeGrid, tags: r.tags, talents: r.talents,
    skill: {...r.source, ...r.source.spData, skillId: build.skillId, rangeGrid: r.skillRangeGrid}, arkpedia: build});
  mutate?.(def);
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 5, 5, {dir});
  const deck = prepareAphrissaRelay(b, u, {contract});
  const mode = {ordinary: true};
  const attacks = ordinary ? prepareAphrissaOrdinary(b, u, {contract: ordinaryContract,
    mayBegin: () => mode.ordinary}) : null;
  // The owner deliberately has no combat or active skill implementation here.
  // This fixture exercises only the independently held normal relay controller.
  b._setupUnit(u, {trait: attacks?.trait() ?? {noAttack: true}, talents: [], skill: {kind: 'passive'}});
  deck.install(); attacks?.install();
  const deploy = () => { u.player.dp = 99; assert.ok(b._deploy(u, {initial: false})); };
  if (!defer) deploy();
  return {b, u, build, deck, deploy, attacks, mode};
}
