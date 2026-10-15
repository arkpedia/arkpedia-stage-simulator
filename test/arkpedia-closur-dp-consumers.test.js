// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import native from '../data/arkpedia-closur-dp-consumers.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { installClosurRoster, CLOSUR_ROSTER_CONTRACT } from '../server/sim/content/arkpedia-closur-roster.js';
import { advance, near } from './helpers/mon3tr-fixture.js';
const LEE = 'char_322_lmlee', SWIRE = 'char_1033_swire2';
const merchants = ['char_272_strong', 'char_455_nothin', 'char_4155_talr', LEE, SWIRE];

function make(id, { floor = 3, debt = true, elite = 2 } = {}) {
  const d = structuredClone(data); d.stage.geometry.waves[0].spawns = []; d.stage.battle.dp_per_second = 0;
  const build = { ...defaultBuild(d.operators[id]), elite, level: d.operators[id].phases[elite].maxLevel,
    skillId: d.operators[id].skills[0].id, skillRank: [4, 7, 10][elite] };
  const b = new StandardBattle(d, { operators: [build] });
  b.autoFinish = false; b.setViewport('fullscreen-workspace'); b.recordEvents = true;
  b.grid.tiles = b.grid.tiles.map(t => ({ ...t, height: 'LOW', build: 'ALL', pass: 'ALL' }));
  if (debt) installClosurRoster(b, [{ id: 'char_4228_closur', elite: 2, level: 90,
    potential: floor === 4 ? 3 : 1, trust: 0, skillId: 'skchr_closur_1', skillRank: 10, module: 'none' }],
  { contract: CLOSUR_ROSTER_CONTRACT });
  b.getPlayer('arkpedia').dp = 99;
  const u = b.deployOperator(id, 3, 3, 'RIGHT'); assert.ok(u);
  u.profile.noAttack = true;
  return { b, u, player: b.getPlayer('arkpedia') };
}

test('source review retains twelve CheckCost templates and the exact six selected native graphs', () => {
  assert.deepEqual(native.enabledOperators, []); assert.equal(native.frameParity, false);
  assert.equal(Object.keys(native.checkCostInventory).length, 12);
  assert.equal(native.source.pathId, '6070581171229484677');
  assert.equal(native.source.client, 'cn');
  for (const [key, graph] of Object.entries(native.selectedOriginalTemplates)) {
    assert.equal(graph.templateKey, key);
    for (const { node } of native.checkCostInventory[key]) {
      assert.equal(node._compareType, 'GE');
      assert.equal(node._considerNegativeCost, key !== 'lmlee_tr' || node._blackboardKey !== 'extra_cost');
    }
  }
});

for (const id of merchants) for (const floor of [3, 4]) {
  test(`${id}: upkeep borrows exactly to floor -${floor}, then withdraws without another payment`, () => {
    const { b, u, player } = make(id, { floor }); player.dp = 3 - floor;
    advance(b, 3.05); near(player.dp, -floor); assert.equal(u.deployed, true);
    if (id === LEE) assert.equal(u.mem.leeShield, false);
    if (id === SWIRE) assert.equal(u.mem.swireCoinEconomy.stacks, 1);
    advance(b, 3.05); assert.equal(u.deployed, false); near(player.dp, -floor);
  });
  test(`${id}: a fraction below the upkeep boundary withdraws and cannot partially spend`, () => {
    const { b, u, player } = make(id, { floor }); player.dp = 3 - floor - .001;
    advance(b, 3.05); assert.equal(u.deployed, false); near(player.dp, 3 - floor - .001);
  });
}
for (const id of merchants) test(`${id}: without Closure, insufficient ordinary DP still withdraws`, () => {
  const { b, u, player } = make(id, { debt: false }); player.dp = 2.999;
  advance(b, 3.05); assert.equal(u.deployed, false); near(player.dp, 2.999);
});

test('Lee cannot borrow the extra shield payment, but can still pay ordinary upkeep', () => {
  const { b, u, player } = make(LEE); player.dp = 2;
  advance(b, 3.05); near(player.dp, -1); assert.equal(u.mem.leeShield, false);
  player.dp = 5; advance(b, 3); near(player.dp, 0); assert.equal(u.mem.leeShield, true);
  advance(b, 3); near(player.dp, -3); assert.equal(u.mem.leeShield, true);
});
test('pre-talent Lee also uses the ordinary debt-aware upkeep path', () => {
  const { b, u, player } = make(LEE, { elite: 0 }); player.dp = 0;
  advance(b, 3.05); assert.equal(u.deployed, true); near(player.dp, -3); assert.equal(u.mem.leeShield, false);
});
for (const floor of [3, 4]) for (const affordable of [true, false]) {
  test(`Swire emergency revival ${affordable ? 'borrows' : 'rejects below'} floor -${floor}`, () => {
    const { b, u, player } = make(SWIRE, { floor });
    player.dp = 5 - floor - (affordable ? 0 : .001);
    const before = player.dp;
    b.loseHp(u, u.s.maxHp * 2, { source: u });
    assert.equal(u.alive, affordable);
    if (!affordable) { near(player.dp, before); return; }
    near(player.dp, -floor); assert.equal(u.mem.swireCoinEconomy.fatalCost, 10);
    advance(b, .1); assert.ok(u.hp > 1);
    // A doubled bill can also reach the exact floor. The following bill
    // cannot be partially paid or clamped into another free revival.
    player.dp = 10 - floor;
    b.loseHp(u, u.s.maxHp * 2, { source: u });
    assert.equal(u.alive, true); near(player.dp, -floor);
    assert.equal(u.mem.swireCoinEconomy.fatalCost, 20); advance(b, .1);
    player.dp = 20 - floor - .001;
    b.loseHp(u, u.s.maxHp * 2, { source: u });
    assert.equal(u.alive, false); near(player.dp, 20 - floor - .001);
  });
}
test('ordinary merchant cancellation and zero-cost hooks retain the unit at the debt floor', () => {
  for (const mode of ['cancel', 'zero']) {
    const { b, u, player } = make('char_272_strong'); player.dp = -3;
    b.on('merchantPay', ctx => { if (mode === 'cancel') ctx.cancel = true; else ctx.cost = 0; });
    advance(b, 6.1); assert.equal(u.deployed, true); near(player.dp, -3);
  }
});
