// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import data from '../../data/arkpedia-mvp.json' with { type: 'json' };
import e from '../../data/arkpedia-mon3tr-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../../server/sim/arkpedia.js';
import { normalizeChess } from '../../server/sim/simdata.js';
import { defaultBuild } from '../../shared/arkpedia/loadout.js';
import { MON3TR_ID as ID, selectedMon3trBuild } from '../../server/sim/content/arkpedia-mon3tr-source.js';
import { prepareMon3trHealing, MON3TR_HEALING_CONTRACT as CONTRACT } from '../../server/sim/content/arkpedia-mon3tr-healing.js';
const TOKEN = 'token_10050_monstr_prosts';
export const near = (a, z, eps = 1e-5) => assert.ok(Math.abs(a - z) < eps, `${a} != ${z}`);
export function advance(b, seconds) {
  for (let n = 0; n < Math.ceil(seconds / b.dt - 1e-9); n++) b.step();
  assert.deepEqual(b.errors, []);
}
export function until(f, condition, seconds = 20) {
  const end = f.b.time + seconds;
  while (!condition() && f.b.time < end) advance(f.b, f.b.dt);
  assert.ok(condition(), `Condition missing at ${f.b.time}`);
}
export function addOwner(b, build, { row = 5, col = 5, dir = 'RIGHT',
  contract = CONTRACT, prepare = prepareMon3trHealing, mutate } = {}) {
  const r = selectedMon3trBuild(build), c = e.tables.character;
  const def = normalizeChess({ chessId: ID, charId: ID, name: c.name, profession: c.profession,
    position: c.position, subProfessionId: c.subProfessionId, stats: r.stats, rangeGrid: r.rangeGrid,
    tags: r.tags, talents: r.talents, skill: { ...r.source, ...r.source.spData, skillId: build.skillId,
      rangeGrid: r.skillRangeGrid, trigger: { rule: 'NEVER' } }, arkpedia: build });
  mutate?.(def);
  const u = b._makeAlly(b.getPlayer('arkpedia'), def, 'op', row, col, { dir });
  const prepared = prepare(b, u, { contract });
  b._setupUnit(u, prepared.kit); prepared.controller.install();
  return { u, ...prepared };
}
export function make({ skill = 1, elite = 2, rank = [4, 7, 10][elite], potential = 1, trust = 0,
  dir = 'RIGHT', defer = false, contract = CONTRACT, prepare = prepareMon3trHealing, mutate } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const b = new StandardBattle(d, { operators: [defaultBuild(d.operators.char_289_gyuki)] });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  const build = { elite, level: e.tables.character.phases[elite].maxLevel, potential, trust,
    skillRank: rank, skillId: `skchr_monstr_${skill}`, module: 'none' };
  const prepared = addOwner(b, build, { dir, contract, prepare, mutate }), { u } = prepared;
  const heals = [], attacks = [];
  b.on('calculatedHeal', ctx => { if (ctx.source === u) heals.push({ ...ctx, time: b.time }); });
  b.on('attack', ctx => { if (ctx.attacker === u) attacks.push({ ...ctx, time: b.time }); });
  const deploy = () => { u.player.dp = 99; assert.ok(b._deploy(u, { initial: false })); };
  if (!defer) deploy();
  return { b, u, d, build, deploy, heals, attacks, ...prepared };
}
export function ally(f, { row = 5, col = 6, hp = 10000, ratio = .1, token = false, flags } = {}) {
  const t = f.b.spawnToken(f.u, token ? TOKEN : 'diagnostic:healing-recipient', row, col, {
    def: { name: token ? 'Reconstruction' : 'Diagnostic recipient', profession: 'TOKEN', position: 'MELEE',
      stats: { maxHp: hp, atk: 0, def: 0, blockCnt: 0, cost: 0 }, skill: null },
    kit: { trait: { noAttack: true, noBlock: true }, talents: [], skill: { kind: 'passive' } },
  });
  assert.ok(t); t.hp = hp * ratio;
  if (flags) f.b.addBuff(t, { key: 'fixture:flags', flags });
  if (token) f.controller.attachReconstruction(t);
  return t;
}
export const disarm = f => f.b.addBuff(f.u, { key: 'fixture:disarm', flags: { disarm: true } });

