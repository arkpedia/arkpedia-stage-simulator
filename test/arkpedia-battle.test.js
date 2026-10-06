import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { StandardBattle, stageAdapter } from "../server/sim/arkpedia.js";
import { defaultBuild, recordFor } from "../shared/arkpedia/loadout.js";
import { maxedSupport } from "../shared/arkpedia/squad.js";
import { catalogueFor } from "../shared/arkpedia/loadout.js";
const data = JSON.parse(
  fs.readFileSync(new URL("../data/arkpedia-mvp.json", import.meta.url)),
);
const selection = {
  operators: Object.values(data.operators).map(defaultBuild),
};
const make = () => {
  const b = new StandardBattle(data, selection);
  b.setViewport("fullscreen-workspace");
  return b;
};
const advance = (b, seconds) => {
  for (let i = 0; i < seconds / b.dt && !b.finished; i++) b.step();
};
test("source geometry preserves all 11 spawns, overrides, and the soldier route wait", () => {
  const a = stageAdapter(data.stage);
  assert.equal(a.spawns.length, 11);
  assert.equal(a.spawns.at(-1).time, 63.7);
  assert.equal(a.routes[2].checkpoints[1].type, "WAIT");
  assert.equal(a.routes[2].checkpoints[1].time, 3);
  assert.equal(data.enemies.enemy_1002_nsabr.stats.def, 30);
});
test("loadouts use real promotion/trust/potential caps and talents", () => {
  const op = data.operators.char_208_melan;
  let b = defaultBuild(op);
  assert.equal(recordFor(b, data).stats.atk, 738);
  assert.equal(recordFor(b, data).arkpedia.modifiers.atkPct, 0.08);
  b.trust = 100;
  assert.equal(recordFor(b, data).stats.atk, 803);
  b.trust = 200;
  assert.equal(recordFor(b, data).stats.atk, 803);
  b.potential = 6;
  assert.equal(recordFor(b, data).stats.atk, 828);
  assert.equal(recordFor(b, data).stats.cost, 13);
  assert.equal(recordFor(b, data).stats.respawnTime, 60);
  assert.throws(() => recordFor({ ...b, elite: 2 }, data));
});
test("maxed support stats are resolved by the simulator", () => {
  const cat = catalogueFor(data);
  const b = maxedSupport(
    { id: "char_123_fang", skillId: data.operators.char_123_fang.skills[0].id },
    cat,
  );
  assert.equal(b.level, 55);
  assert.equal(recordFor(b, data).stats.cost, 8);
});
test("deployment requires fullscreen, valid terrain, funds and a unique vacant tile", () => {
  const b = make();
  b.setViewport("preview");
  assert.throws(
    () => b.deployOperator("char_123_fang", 2, 3, "RIGHT"),
    /fullscreen/,
  );
  b.setViewport("fullscreen-workspace");
  assert.throws(
    () => b.deployOperator("char_124_kroos", 2, 3, "RIGHT"),
    /ranged/,
  );
  assert.throws(() => b.deployOperator("char_208_melan", 2, 3, "RIGHT"), /DP/);
  const u = b.deployOperator("char_123_fang", 2, 3, "RIGHT");
  assert.equal(b.dp, 0);
  assert.equal(u.alive, true);
  assert.throws(
    () => b.deployOperator("char_123_fang", 2, 5, "RIGHT"),
    /unavailable/,
  );
  assert.equal(b.bench.char_123_fang.deployments, 1);
});
test("manual retreat refunds DP, clears tile, and never automatically redeploys", () => {
  const b = make();
  const u = b.deployOperator("char_123_fang", 2, 3, "RIGHT");
  b.retreatOperator(u.defId);
  assert.equal(b.dp, 5);
  assert.equal(u.alive, false);
  assert.equal(b.cost(u.defId), 15);
  assert.throws(() => b.deployOperator(u.defId, 2, 5, "RIGHT"), /redeploying/);
  b.autoFinish = false;
  advance(b, 72);
  assert.equal(b.bench[u.defId].unit.alive, false);
  assert.equal(b.placementError(u.defId, 2, 5), null);
  const next = b.deployOperator(u.defId, 2, 5, "LEFT");
  assert.notEqual(next.id, u.id);
  assert.equal(next.tileC, 5);
  assert.equal(b.cost(u.defId), 20);
});
test("Fang blocks and attacks, auto skill creates DP, stage finishes without leaks", () => {
  const b = make();
  const u = b.deployOperator("char_123_fang", 2, 3, "RIGHT");
  advance(b, 100);
  assert.equal(b.reason, "cleared");
  assert.equal(b.killed, 11);
  assert.equal(b.life, 20);
  assert.ok(u.stats.attacks > 0);
  assert.ok(u.skill.activations > 0);
  assert.equal(b.errors.length, 0);
});
test("manual skills stay ready until clicked and then boost ATK", () => {
  const b = make();
  b.addDp("arkpedia", 99);
  const u = b.deployOperator("char_208_melan", 2, 3, "RIGHT");
  advance(b, 41);
  assert.equal(u.skill.activations, 0);
  assert.equal(u.skill.ready, true);
  const before = u.s.atk;
  assert.equal(b.activateOperator(u.defId), true);
  assert.ok(u.s.atk > before);
  assert.equal(b.activateOperator(u.defId), false);
});
test("a healer restores injured ally HP; no heals on healthy allies", () => {
  const b = make();
  b.addDp("arkpedia", 99);
  const fang = b.deployOperator("char_123_fang", 2, 3, "RIGHT");
  const hibiscus = b.deployOperator("char_120_hibisc", 1, 3, "UP");
  fang.hp -= 500;
  advance(b, 5);
  assert.equal(fang.hp, fang.s.maxHp);
  assert.ok(hibiscus.stats.attacks > 0);
  assert.equal(b.errors.length, 0);
});
test("escaping enemies consume life and zero life ends in defeat", () => {
  const b = make();
  b.life = 1;
  advance(b, 50);
  assert.equal(b.reason, "defeated");
  assert.equal(b.life, 0);
  assert.equal(b.leakedCount, 1);
});
