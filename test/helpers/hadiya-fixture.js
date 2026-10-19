// SPDX-License-Identifier: GPL-3.0-or-later
// Private component fixture. This is deliberately not a substitute gameplay kit.
import assert from 'node:assert/strict';
import data from '../../data/arkpedia-mvp.json' with {type: 'json'};
import evidence from '../../data/arkpedia-native-operators/char_394_hadiya.json' with {type: 'json'};
import {StandardBattle} from '../../server/sim/arkpedia.js';
import {normalizeChess} from '../../server/sim/simdata.js';
import {defaultBuild} from '../../shared/arkpedia/loadout.js';
import {selectedHadiyaBuild, HADIYA_ID as ID} from '../../server/sim/content/arkpedia-hadiya-source.js';
import {HadiyaPayments, HADIYA_PAYMENT_CONTRACT} from '../../server/sim/content/arkpedia-hadiya-payments.js';
export {advance, near, until} from './mon3tr-fixture.js';

export function make({skill = 1, elite = 2, level = [50, 70, 80][elite], rank = [4, 7, 10][elite],
  potential = 1, trust = 0, dir = 'RIGHT', defer = false, spec = {}, guard,
  prepare, payments = true} = {}) {
  const d = structuredClone(data);
  d.stage.geometry.waves[0].spawns = [];
  d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19;
  d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({length: 19}, () => Array(21).fill(2));
  const b = new StandardBattle(d, {operators: [defaultBuild(d.operators.char_122_beagle)]});
  b.autoFinish = false;
  b.recordEvents = true;
  b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({...t, height: 'LOW', build: 'ALL', pass: 'ALL'}));
  const build = {elite, level, potential, trust, skillId: `skchr_hadiya_${skill}`, skillRank: rank, module: 'none'};
  const record = selectedHadiyaBuild(build), c = evidence.tables.character;
  const def = normalizeChess({chessId: ID, charId: ID, name: c.appellation, profession: c.profession,
    position: c.position, subProfessionId: c.subProfessionId, stats: record.stats, rangeGrid: record.rangeGrid,
    tags: record.tags, talents: record.talents,
    skill: {...record.source, ...record.source.spData, skillId: build.skillId, rangeGrid: record.skillRangeGrid},
    arkpedia: build});
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 5, 5, {dir});
  b._setupUnit(u, {trait: {noAttack: true}, talents: [],
    skill: {kind: 'toggle', trigger: {rule: 'NEVER'}, manualTriggerOnly: () => true, ...spec}});
  const f = {b, u, build, record, statuses: []};
  if (payments) {
    f.payment = new HadiyaPayments(b, u, {contract: HADIYA_PAYMENT_CONTRACT, guard});
    f.payment.install();
  }
  f.prepared = prepare?.(b, u);
  b.on('statusApplied', c => { if (c.source === u) f.statuses.push({...c, time: b.time}); });
  f.deploy = () => { u.player.dp = 99; assert.ok(b._deploy(u, {initial: false})); };
  f.ready = () => { u.skill.sp = u.skill.spCost; u.skill.charges = 1; };
  if (!defer) f.deploy();
  return f;
}

export function enemy(f, {row = 5, col = 6, hp = 1e7, motion = 'WALK', flags = {}} = {}) {
  const t = f.b.spawnEnemy('enemy_1007_slime', {pos: [row, col]});
  Object.assign(t.base, {maxHp: hp, def: 0, res: 0, moveSpeed: 0});
  t.markDirty();
  t.hp = t.s.maxHp;
  t.motion = motion;
  f.b.addBuff(t, {key: 'fixture:pin', flags: {noMove: true, disarm: true, ...flags}});
  f.b._buildEnemyIndex();
  return t;
}
