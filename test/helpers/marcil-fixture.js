// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import data from '../../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../../data/arkpedia-marcil-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../../server/sim/arkpedia.js';
import { normalizeChess } from '../../server/sim/simdata.js';
import { defaultBuild } from '../../shared/arkpedia/loadout.js';
import { selectedMarcilBuild, MARCIL_ID as ID } from '../../server/sim/content/arkpedia-marcil-source.js';
import { prepareMarcilAttacks, MARCIL_ATTACK_CONTRACT as CONTRACT }
  from '../../server/sim/content/arkpedia-marcil-attacks.js';

export function advance(f, seconds) {
  for (let i = 0; i < Math.ceil(seconds / f.b.dt - 1e-9); i++) f.b.step();
  assert.deepEqual(f.b.errors, []);
}
export function until(f, predicate, seconds = 8) {
  const end = f.b.time + seconds;
  while (!predicate() && f.b.time < end) advance(f, f.b.dt);
  assert.ok(predicate(), `Condition missing at ${f.b.time}`);
}
// A controlled source-only actor. The public roster remains unchanged.
export function make({ skill = 1, elite = 2, rank = 10, potential = 1, dir = 'RIGHT',
  deferred = false, contract = CONTRACT, mutate, prepare = prepareMarcilAttacks, operators, support } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = [];
  d.stage.battle.dp_per_second = 0;
  d.stage.geometry.rows = 19; d.stage.geometry.cols = 21;
  d.stage.geometry.tileGrid = Array.from({ length: 19 }, () => Array(21).fill(2));
  const senshi = { ...defaultBuild(d.operators.char_4143_sensi), elite: 2, level: 80,
    skillId: 'skchr_sensi_2', skillRank: 10, trust: 0, potential: 1 };
  const b = new StandardBattle(d, { operators: operators ?? [senshi, defaultBuild(d.operators.char_208_melan)],
    ...(support ? { support } : {}) });
  b.autoFinish = false; b.recordEvents = true; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  b.addDp('arkpedia', 99);
  const build = { elite, level: evidence.tables.character.phases[elite].maxLevel,
    skillId: `skchr_marcil_${skill}`, skillRank: Math.min(rank, [4, 7, 10][elite]),
    potential, trust: 0, module: 'none' };
  const r = selectedMarcilBuild(build), c = evidence.tables.character;
  const def = normalizeChess({ chessId: ID, charId: ID, name: c.name, profession: c.profession,
    position: c.position, subProfessionId: c.subProfessionId, stats: r.stats, rangeGrid: r.rangeGrid,
    talents: r.talents, tags: r.tags, arkpedia: build,
    skill: { ...r.source, ...r.source.spData, skillId: build.skillId, rangeGrid: r.skillRange } });
  const create = ({ selectedContract = contract, modify = mutate, deploy = true } = {}) => {
    const selectedDef = structuredClone(def); modify?.(selectedDef);
    const u = b._makeAlly(b.getPlayer('arkpedia'), selectedDef, 'op', 5, 6, { dir });
    const prepared = prepare(b, u, { contract: selectedContract });
    b._setupUnit(u, prepared.kit); prepared.controller.install();
    if (deploy) assert.ok(b._deploy(u, { initial: false }));
    return { u, ...prepared };
  };
  const first = create({ deploy: !deferred }), hits = [], attacks = [], outputs = [], heals = [];
  b.on('damaged', x => { if (x.source === first.u) hits.push({ ...x, time: b.time }); });
  b.on('attack', x => { if (x.attacker === first.u) attacks.push({ ...x, time: b.time }); });
  b.on('marcilOutput', x => { if (x.unit === first.u) outputs.push({ ...x, time: b.time }); });
  b.on('heal', x => { if (x.source === first.u) heals.push({ ...x, time: b.time }); });
  return { b, build, def, create, hits, attacks, outputs, heals, ...first };
}
export function enemy(f, { row = 5, col = 7, hp = 1e7, def = 0, fly = false, flags = {} } = {}) {
  const t = f.b.spawnEnemy('enemy_1007_slime', { pos: [row, col] });
  Object.assign(t.base, { maxHp: hp, atk: 0, def, res: 0, moveSpeed: 0 });
  t.markDirty(); void t.s; t.hp = hp; if (fly) t.motion = 'FLY';
  f.b.addBuff(t, { key: 'fixture:pin', flags: { noMove: true, disarm: true, unblockable: true, ...flags } });
  f.b._buildEnemyIndex(); return t;
}
export function ally(f, { row = 4, col = 7, ratio = .1, flags = {}, kind = 'op' } = {}) {
  const u = f.b.deployOperator('char_208_melan', row, col, 'RIGHT'); assert.ok(u);
  u.kind = kind; u.skill.rule = 'NEVER'; u.atkCd = 1e5; u.hp = u.s.maxHp * ratio;
  f.b.addBuff(u, { key: 'fixture:flags', flags }); return u;
}
export function cast(f) {
  assert.equal(f.u.skill.activate('manual'), true);
  until(f, () => f.controller.mode === 's1', 10);
}
