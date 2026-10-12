// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-muelsyse-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { normalizeChess } from '../server/sim/simdata.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { MUELSYSE_ID as ID, selectedMuelsyseBuild } from '../server/sim/content/arkpedia-muelsyse.js';
import { MUELSYSE_SQUAD_CONTRACT as CONTRACT, installMuelsyseSquad, adjustMuelsyseSquadCost } from '../server/sim/content/arkpedia-muelsyse-squad.js';

const MAYER = 'char_242_otter', SILENCE = 'char_108_silent', MELANTHA = 'char_208_melan';
function make({ elite = 2, potential = 1, install = true } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  const b = new StandardBattle(d, { operators: [MAYER, SILENCE, MELANTHA].map(id => defaultBuild(d.operators[id])) });
  b.autoFinish = false; b.setViewport('fullscreen-workspace');
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, build: 'ALL' }));
  const build = { elite, potential, level: evidence.tables.character.phases[elite].maxLevel,
    skillId: 'skchr_mlyss_1', skillRank: [4, 7, 10][elite], trust: 0 };
  const r = selectedMuelsyseBuild(build), c = evidence.tables.character;
  const raw = { chessId: ID, charId: ID, name: c.name, stats: r.stats,
    position: c.position, profession: c.profession, tags: r.tags, talents: r.talents, arkpedia: build,
    rangeGrid: r.rangeGrid, skill: { ...r.source, ...r.source.spData, skillId: build.skillId } };
  b.data.raw.chess[ID] = raw;
  b.bench[ID] = { build, deployments: 0, unit: null, readyAt: 0, lastCost: 0 };
  const baseline = Object.fromEntries(Object.keys(b.bench).map(id => [id, b.cost(id)]));
  const state = install ? installMuelsyseSquad(b, { contract: CONTRACT }) : null;
  b.getPlayer('arkpedia').dp = 99;
  return { b, raw, build, baseline, state };
}
function deploy(f, id = MAYER, row = 2, col = 7) {
  const before = f.b.dp, quoted = f.b.cost(id), u = f.b.deployOperator(id, row, col, 'RIGHT');
  assert.equal(before - f.b.dp, quoted); assert.deepEqual(f.b.errors, []); return u;
}

test('squad cost remains explicitly opted in, without public roster approval', () => {
  const f = make({ install: false });
  assert.throws(() => installMuelsyseSquad(f.b), /reviewed squad contract/);
  assert.throws(() => installMuelsyseSquad(f.b, { contract: { ...CONTRACT } }), /reviewed squad contract/);
  installMuelsyseSquad(f.b, { contract: CONTRACT });
  assert.throws(() => installMuelsyseSquad(f.b, { contract: CONTRACT }), /already installed/);
  assert.equal(data.operators[ID], undefined); assert.equal(CONTRACT.frameParity, false);
  assert.match(CONTRACT.limits, /after the ordinary redeploy multiplier/);
});

test('source selection rejects missing, changed and already deployed squad records', () => {
  const f = make({ install: false }); delete f.b.bench[ID];
  assert.throws(() => installMuelsyseSquad(f.b, { contract: CONTRACT }), /fresh selected roster/);
  const changed = make({ install: false }); changed.b.data._chess.set(ID, normalizeChess({ ...changed.raw, tags: [] }));
  assert.throws(() => installMuelsyseSquad(changed.b, { contract: CONTRACT }), /Incomplete.*source/);
  assert.equal(changed.b._muelsyseSquad, undefined);
  const used = make({ install: false }); deploy(used);
  assert.throws(() => installMuelsyseSquad(used.b, { contract: CONTRACT }), /fresh selected roster/);
  for (const field of ['time', 'finished']) {
    const late = make({ install: false }); late.b[field] = field === 'time' ? 1 : true;
    assert.throws(() => installMuelsyseSquad(late.b, { contract: CONTRACT }), /fresh selected roster/);
  }
});

test('only E2 unlocks the talent, with the selected potential threshold', () => {
  for (const elite of [0, 1, 2]) for (let potential = 1; potential <= 6; potential++) {
    const f = make({ elite, potential });
    const permanent = elite === 2 ? 2 : 0, first = elite === 2 ? potential >= 5 ? 2 : 1 : 0;
    assert.equal(f.b.cost(MAYER), f.baseline[MAYER] - permanent - first);
    assert.equal(f.b.cost(SILENCE), f.baseline[SILENCE] - permanent - first);
    assert.equal(f.b.cost(ID), f.baseline[ID] - permanent - first);
    assert.equal(f.b.cost(MELANTHA), f.baseline[MELANTHA]);
    deploy(f, MELANTHA); assert.equal(f.state.firstUsed, false);
    deploy(f, MAYER, 2, 8); assert.equal(f.state.firstUsed, true);
    assert.equal(f.b.cost(SILENCE), f.baseline[SILENCE] - permanent);
    assert.equal(f.b.cost(ID), f.baseline[ID] - permanent);
  }
});

test('failed terrain, facing, DP, reserved, occupied and unit-limit placements retain the first discount', () => {
  for (const failure of ['terrain', 'facing', 'dp', 'reserved', 'occupied', 'limit']) {
    const f = make(); const cost = f.b.cost(MAYER);
    let dir = 'RIGHT';
    if (failure === 'terrain') f.b.grid.tile(2, 7).build = 'NONE';
    if (failure === 'facing') dir = 'DIAGONAL';
    if (failure === 'dp') f.b.getPlayer('arkpedia').dp = cost - 1;
    if (failure === 'reserved') {
      const owner = deploy(f, MELANTHA, 2, 6);
      assert.equal(f.b.reserveTile(owner, 2, 7, 'fixture'), true);
    }
    if (failure === 'occupied') deploy(f, MELANTHA);
    if (failure === 'limit') f.b.unitLimit = 0;
    const dp = f.b.dp;
    assert.throws(() => f.b.deployOperator(MAYER, 2, 7, dir), undefined, failure);
    assert.equal(f.state.firstUsed, false, failure); assert.equal(f.b.dp, dp, failure);
    assert.equal(f.b.cost(MAYER), cost); assert.equal(f.b.bench[MAYER].deployments, 0);
  }
});

test('first discount is shared across Rhine cards and is consumed before nested deployment callbacks', () => {
  const f = make(); let nestedCost, nested;
  f.b.on('deploy', ({ unit }) => {
    if (unit.defId !== MAYER) return;
    nestedCost = f.b.cost(SILENCE); nested = f.b.deployOperator(SILENCE, 2, 8, 'RIGHT');
  });
  const before = f.b.dp, first = f.b.cost(MAYER);
  f.b.deployOperator(MAYER, 2, 7, 'RIGHT');
  assert.ok(nested?.alive); assert.equal(nestedCost, f.baseline[SILENCE] - 2);
  assert.equal(before - f.b.dp, first + nestedCost); assert.deepEqual(f.b.errors, []);
});

test('Muelsyse can consume her own first discount; source retirement does not remove the squad talent', () => {
  const f = make();
  // The held owner is deliberately an isolated source unit, not a public generic kit.
  const u = f.b._makeAlly(f.b.getPlayer('arkpedia'), f.b.data.getChess(ID), 'op', 2, 7, { dir: 'RIGHT' });
  f.b._setupUnit(u, { trait: { noAttack: true }, skill: null });
  assert.equal(f.b._deploy(u), true); assert.equal(f.state.firstUsed, true);
  f.b.retreat(u); assert.equal(f.b.cost(MAYER), f.baseline[MAYER] - 2);
  assert.deepEqual(f.b.errors, []);
});

test('enemy and token births and rejected engine births cannot consume the first Rhine operator discount', () => {
  const f = make(), def = f.b.data.getChess(MAYER);
  const token = f.b._makeAlly(f.b.getPlayer('arkpedia'), def, 'token', 2, 7, { dir: 'RIGHT' });
  f.b._setupUnit(token, { trait: { noAttack: true }, skill: null });
  assert.equal(f.b._deploy(token), true); assert.equal(f.state.firstUsed, false);
  const op = f.b._makeAlly(f.b.getPlayer('arkpedia'), def, 'op', 2, 7, { dir: 'RIGHT' });
  f.b._setupUnit(op, { trait: { noAttack: true }, skill: null });
  assert.equal(f.b._deploy(op), false); assert.equal(f.state.firstUsed, false);
  f.b.spawnEnemy('enemy_1007_slime', { routeIndex: 1 }); assert.equal(f.state.firstUsed, false);
});

test('redeployment retains only the permanent addition and refunds never exceed payment', () => {
  const f = make(), u = deploy(f), firstPaid = f.b.bench[MAYER].lastCost;
  const before = f.b.dp; f.b.retreatOperator(MAYER);
  assert.equal(f.b.dp - before, Math.floor(firstPaid / 2));
  assert.equal(f.b.cost(MAYER), Math.floor(f.baseline[MAYER] * 1.5) - 2);
  f.b.time = f.b.bench[MAYER].readyAt; f.b.getPlayer('arkpedia').dp = 99;
  deploy(f); assert.equal(f.state.firstUsed, true); assert.equal(u.alive, false);
  assert.equal(f.b.cost(SILENCE), f.baseline[SILENCE] - 2);
  assert.equal(adjustMuelsyseSquadCost(f.b, SILENCE, 0), 0);
  assert.equal(adjustMuelsyseSquadCost(f.b, SILENCE, Infinity), Infinity);
  assert.equal(f.b.cost('missing'), Infinity);
});

test('battle instances have independent first-deployment state', () => {
  const f = make(), other = make(); deploy(f);
  assert.equal(other.state.firstUsed, false);
  assert.equal(other.b.cost(MAYER), other.baseline[MAYER] - 3);
});

test('membership uses the exact source tag and excludes token records even if they carry the Rhine tag', () => {
  for (const kind of ['wrong-tag', 'token']) {
    const f = make({ install: false }), original = f.b.data.getChess(MAYER);
    const raw = structuredClone(original.raw);
    if (kind === 'wrong-tag') raw.tags = ['Rhine Lab'];
    else raw.arkpedia.isToken = true;
    f.b.data._chess.set(MAYER, normalizeChess(raw));
    const state = installMuelsyseSquad(f.b, { contract: CONTRACT });
    assert.equal(state.eligible.has(MAYER), false);
    assert.equal(f.b.cost(MAYER), f.baseline[MAYER]);
    deploy(f); assert.equal(state.firstUsed, false);
    assert.equal(f.b.cost(SILENCE), f.baseline[SILENCE] - 3);
  }
});
