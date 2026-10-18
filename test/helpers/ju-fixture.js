// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import data from '../../data/arkpedia-mvp.json' with {type: 'json'};
import evidence from '../../data/arkpedia-native-operators/char_4221_ju.json' with {type: 'json'};
import {StandardBattle} from '../../server/sim/arkpedia.js';
import {normalizeChess} from '../../server/sim/simdata.js';
import {defaultBuild} from '../../shared/arkpedia/loadout.js';
import {JU_ID as ID, selectedJuBuild} from '../../server/sim/content/arkpedia-ju-source.js';
import {JuWounds, JU_WOUND_CONTRACT} from '../../server/sim/content/arkpedia-ju-wounds.js';
import {JuOrdinaryAttacks, JU_ORDINARY_CONTRACT} from '../../server/sim/content/arkpedia-ju-ordinary.js';
export {near, advance, until} from './mon3tr-fixture.js';

export function make({elite = 2, level = evidence.tables.character.phases[elite].maxLevel,
  skill = 1, rank = [4, 7, 10][elite], potential = 1, trust = 0, defer = false,
  mutate, beforeInstall, contract = JU_WOUND_CONTRACT, ordinary = false, mayBegin = () => true,
  ordinaryContract = JU_ORDINARY_CONTRACT, dir = 'RIGHT', prepare} = {}) {
  const d = structuredClone(data);
  d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({length: 19}, () => Array(21).fill(2));
  const b = new StandardBattle(d, {operators: [defaultBuild(d.operators.char_122_beagle)]});
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({...t, height: 'LOW', build: 'ALL', pass: 'ALL'}));
  const build = {elite, level, potential, trust, skillId: `skchr_ju_${skill}`, skillRank: rank, module: 'none'};
  const record = selectedJuBuild(build), c = evidence.tables.character;
  const def = normalizeChess({chessId: ID, charId: ID, name: c.appellation, profession: c.profession,
    position: c.position, subProfessionId: c.subProfessionId, stats: record.stats,
    rangeGrid: record.rangeGrid, tags: record.tags, talents: record.talents,
    skill: {...record.source, ...record.source.spData, skillId: build.skillId,
      rangeGrid: record.skillRangeGrid, trigger: {rule: 'NEVER'}}, arkpedia: build});
  mutate?.(def);
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', 5, 5, {dir});
  const prepared = prepare?.(b, u);
  const wounds = prepared?.wounds ?? new JuWounds(b, u, {contract});
  const attacks = prepared?.controller ?? (ordinary ? new JuOrdinaryAttacks(b, u, {contract: ordinaryContract, mayBegin}) : null);
  b._setupUnit(u, prepared?.kit ?? {trait: attacks?.trait() ?? {noAttack: true}, talents: [], skill: {kind: 'passive'}});
  beforeInstall?.(b, u, wounds, attacks);
  if (prepared) attacks.install(); else { wounds.install(); attacks?.install(); }
  const hits = [], receipts = [];
  b.on('damaged', ctx => hits.push({...ctx, time: b.time}));
  b.on('attack', ctx => { if (ctx.attacker === u) receipts.push({...ctx, time: b.time}); });
  const deploy = () => { u.player.dp = 99; assert.ok(b._deploy(u, {initial: false})); };
  if (!defer) deploy();
  return {b, u, record, wounds, attacks, receipts, build, hits, deploy, ...prepared};
}

export function enemy(f, {row = 5, col = 7, hp = 100, flags = {}} = {}) {
  const e = f.b.spawnEnemy('enemy_1007_slime', {pos: [row, col]});
  Object.assign(e.base, {maxHp: hp, def: 0, res: 0, moveSpeed: 0});
  e.markDirty(); void e.s; e.hp = hp;
  f.b.addBuff(e, {key: 'fixture:pin', flags: {noMove: true, disarm: true, ...flags}});
  f.b._buildEnemyIndex(); return e;
}
export function killer(f) {
  f.u.player.dp = 99;
  const k = f.b.deployOperator('char_122_beagle', 4, 5, 'RIGHT');
  assert.ok(k); k.atkCd = 1000; k.skill.rule = 'NEVER'; k.skill.setSpTotal(0); return k;
}
export const hit = (f, target, amount = 200, extra = {}) =>
  f.b.dealDamage(f.u, target, {amount, type: 'true', ...extra});
