// SPDX-License-Identifier: GPL-3.0-or-later
// Ability-only harness: this timed account and skip-on-control adapter are
// explicit test policies, not a recovered native S2 owner FSM.
import assert from 'node:assert/strict';
import data from '../../data/arkpedia-mvp.json' with {type: 'json'};
import evidence from '../../data/arkpedia-native-operators/char_4229_aphris.json' with {type: 'json'};
import {StandardBattle} from '../../server/sim/arkpedia.js';
import {normalizeChess} from '../../server/sim/simdata.js';
import {defaultBuild} from '../../shared/arkpedia/loadout.js';
import {APHRISSA_ID as ID, selectedAphrissaBuild} from '../../server/sim/content/arkpedia-aphrissa-source.js';
import {prepareAphrissaS2Beam, APHRISSA_S2_BEAM_CONTRACT} from '../../server/sim/content/arkpedia-aphrissa-s2-beam.js';
import {prepareAphrissaRelay, APHRISSA_RELAY_CONTRACT} from '../../server/sim/content/arkpedia-aphrissa-relay.js';
export {near, advance, until, enemy} from './aphrissa-s1-fixture.js';

export function make({rank = 10, elite = 2, dir = 'RIGHT', defer = false,
  contract = APHRISSA_S2_BEAM_CONTRACT, mutate, channelCurrent, mayRelease} = {}) {
  const d = structuredClone(data);
  d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({length: 19}, () => Array(21).fill(2));
  const b = new StandardBattle(d, {operators: [defaultBuild(d.operators.char_122_beagle)]});
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({...t, height: 'LOW', build: 'ALL', pass: 'ALL'}));
  const c = evidence.tables.character, build = {elite, potential: 1, trust: 0, level: c.phases[elite].maxLevel,
    skillId: 'skchr_aphris_2', skillRank: rank, module: 'none'}, selected = selectedAphrissaBuild(build);
  const def = normalizeChess({chessId: ID, charId: ID, name: c.appellation, profession: c.profession,
    position: c.position, stats: selected.stats, rangeGrid: selected.rangeGrid, tags: selected.tags, talents: selected.talents,
    skill: {...selected.source, ...selected.source.spData, skillId: build.skillId, rangeGrid: selected.skillRangeGrid}, arkpedia: build});
  mutate?.(def);
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 5, 5, {dir}), mode = {current: true, release: true};
  const beam = prepareAphrissaS2Beam(b, u, {contract,
    channelCurrent: channelCurrent ? () => channelCurrent({b, u, mode, beam}) : () => mode.current,
    mayRelease: mayRelease ? () => mayRelease({b, u, mode, beam}) : () => mode.release && u.canAct && !u.s.flags.disarm});
  const deck = prepareAphrissaRelay(b, u, {contract: APHRISSA_RELAY_CONTRACT});
  b._setupUnit(u, {trait: beam.trait(), talents: [], skill: {kind: 'duration', duration: selected.source.duration,
    silenceable: false, manualCancel: false, onStart: () => beam.start(), onEnd: () => beam.detach()}});
  beam.install(); deck.install();
  const hits = [], receipts = [];
  b.on('damaged', event => { if (event.source === u) hits.push({id: event.target.id, at: b.time,
    amount: event.amount, attackId: event.dmg.attackId, isSkill: event.dmg.isSkill}); });
  b.on('attack', event => { if (event.attacker === u) receipts.push({at: b.time,
    ids: event.targets.map(t => t.id), isSkill: event.isSkill}); });
  const deploy = () => { u.player.dp = 99; assert.ok(b._deploy(u, {initial: false})); };
  if (!defer) deploy();
  return {b, u, build, selected, beam, deck, mode, deploy, hits, receipts};
}
export function cast(f) {
  f.u.skill.setSpTotal(f.u.skill.spCost);
  assert.equal(f.u.skill.activate(), true); assert.ok(f.beam.phase);
  return f.beam.phase;
}
