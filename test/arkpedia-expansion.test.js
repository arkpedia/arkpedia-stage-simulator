import { test } from "node:test";
import assert from "node:assert/strict";
import data from "../data/arkpedia-mvp.json" with { type: "json" };
import { StandardBattle } from "../server/sim/arkpedia.js";
import { defaultBuild, recordFor, catalogueFor } from "../shared/arkpedia/loadout.js";
import { coverageFor } from "../tools/arkpedia/coverage.mjs";

function make(id, spawns = []) {
  const isolated = structuredClone(data);
  isolated.stage.geometry.waves[0].spawns = spawns;
  const b = new StandardBattle(isolated, { operators: [defaultBuild(data.operators[id])] });
  b.autoFinish = false;
  b.setViewport("fullscreen-workspace");
  b.addDp("arkpedia", 40);
  return b;
}
function advance(b, seconds) {
  for (let i = 0; i < Math.ceil(seconds / b.dt); i++) b.step();
  assert.deepEqual(b.errors, []);
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≠ ${b}`);

test("Vanilla's manual skill grants six DP once, buffs ATK for ten seconds and stops SP during the buff", () => {
  const b = make("char_240_wyvern");
  const u = b.deployOperator("char_240_wyvern", 2, 7, "RIGHT");
  const base = u.s.atk;
  assert.equal(u.skill.sp, 6);
  advance(b, 14.1);
  assert.equal(u.skill.ready, true);
  assert.equal(u.skill.activations, 0);
  const dp = b.dp;
  assert.equal(b.activateOperator(u.defId), true);
  near(b.dp, dp + 6);
  // Talent and skill ATK bonuses are additive to the base stat.
  near(u.s.atk - base, u.base.atk * 0.35);
  assert.equal(b.activateOperator(u.defId), false);
  near(b.dp, dp + 6);
  advance(b, 5);
  assert.equal(u.skill.sp, 0);
  advance(b, 5.1);
  assert.equal(u.skill.active, false);
  near(u.s.atk, base);
});

test("Cardigan deploys at full talent-adjusted HP and heals immediately, without waiting for an attack", () => {
  const b = make("char_209_ardign");
  const u = b.deployOperator("char_209_ardign", 2, 7, "RIGHT");
  near(u.s.maxHp, u.base.maxHp * 1.12);
  near(u.hp, u.s.maxHp);
  assert.equal(u.skill.sp, 10);
  u.hp = u.s.maxHp * 0.1;
  advance(b, 10.1);
  assert.equal(u.skill.activations, 0);
  assert.equal(b.activateOperator(u.defId), true);
  near(u.hp, u.s.maxHp * 0.5);
  assert.equal(u.skill.pending, false);
  assert.equal(u.skill.active, false);
  assert.equal(u.skill.sp, 0);
  assert.equal(u.stats.attacks, 0);
  advance(b, 20.1);
  u.hp = u.s.maxHp - 1;
  assert.equal(b.activateOperator(u.defId), true);
  near(u.hp, u.s.maxHp);
});

test("Orchid's attacks deal Arts damage and apply an expiring 80% movement slow", () => {
  const b = make("char_278_orchid", [
    { enemy_id: "enemy_1007_slime", count: 1, time: 0, route: 1 },
  ]);
  const u = b.deployOperator("char_278_orchid", 1, 7, "DOWN");
  assert.equal(u.profile.dmgType, "arts");
  assert.equal(u.s.aspd, 109);
  const hits = [];
  b.on("damaged", ctx => { if (ctx.source === u) hits.push(ctx); });
  for (let i = 0; i < 150 && !hits.length; i++) b.step();
  assert.ok(hits.length, "Orchid attacks an enemy in range");
  const target = hits[0].target;
  near(target.s.moveSpeed, target.base.moveSpeed * 0.2);
  // Prevent another attack refreshing the status, then verify the exact expiry window.
  u.atkCd = 100;
  advance(b, 0.7);
  near(target.s.moveSpeed, target.base.moveSpeed * 0.2);
  advance(b, 0.2);
  near(target.s.moveSpeed, target.base.moveSpeed);
});

test("Orchid's manual skill adds ATK and ASPD for 25 seconds; E0 does not gain the E1 talent", () => {
  const op = data.operators.char_278_orchid;
  const e0 = recordFor({ ...defaultBuild(op), elite: 0, level: 40, skillRank: 4 }, data);
  assert.deepEqual(e0.arkpedia.modifiers, {});
  const b = make(op.id);
  const u = b.deployOperator(op.id, 1, 7, "DOWN");
  const atk = u.s.atk;
  advance(b, 45.1);
  assert.equal(b.activateOperator(op.id), true);
  near(u.s.atk, atk * 1.25);
  assert.equal(u.s.aspd, 134);
  advance(b, 25.1);
  near(u.s.atk, atk);
  assert.equal(u.s.aspd, 109);
});

test("regular stages reject unknown operators, skills and unimplemented talent keys", () => {
  const altered = structuredClone(data);
  altered.operators.char_999_unknown = { ...altered.operators.char_123_fang, id: "char_999_unknown" };
  assert.throws(() => catalogueFor(altered), /Unsupported regular-stage/);
  delete altered.operators.char_999_unknown;
  altered.operators.char_123_fang.skills[0].id = "new-skill";
  assert.throws(() => catalogueFor(altered), /Unsupported regular-stage/);
  altered.operators.char_123_fang.skills[0].id = data.operators.char_123_fang.skills[0].id;
  altered.operators.char_123_fang.talents[0].candidates[0].blackboard.push({ key: "new-mechanic", value: 1 });
  assert.throws(() => catalogueFor(altered), /Unsupported talent/);
});

test("coverage never enables an operator merely because Stronghold has a kit for it", () => {
  const report = coverageFor({
    characters: { char_example: { name: "Example", rarity: "TIER_6", profession: "WARRIOR", skills: [{ skillId: "s" }] } },
    enemies: { enemies: [] }, chess: { mode_example: { charId: "char_example" } },
    inherited: { chess: [{ chessId: "mode_example", skills: [{ skillId: "s", covered: true }] }] }, data,
  });
  const op = report.operators[0];
  assert.deepEqual(op.skills[0].strongholdCandidates, ["mode_example"]);
  assert.equal(op.playable, false);
  assert.equal(op.skills[0].regularAdapter, false);
  assert.equal(op.gameFidelityVerified, false);
});

test('published artwork availability is reported independently from combat support and lazy battle assets', () => {
  const operator = { name: 'Art-only', rarity: 'TIER_6', profession: 'WARRIOR', skills: [{ skillId: 'unreviewed' }] };
  const model = { animationRoles: { idle: 'Idle', attack: { loop: 'Attack' } }, premultipliedAlpha: true };
  const input = { characters: { char_art_only: operator }, enemies: { enemies: [] }, chess: {},
    inherited: { chess: [] }, data };
  const missing = coverageFor(input);
  assert.equal(missing.operators[0].animations, 'not-imported');
  const report = coverageFor({ ...input, assetModels: {
    'operator/char_art_only/default/front': model, 'operator/char_art_only/default/back': model,
  } });
  assert.equal(report.summary.operatorsWithImportedAnimations, 1);
  assert.equal(report.operators[0].animations, 'imported');
  assert.equal(report.operators[0].playable, false);
  assert.equal(report.operators[0].skills[0].regularAdapter, false);
  assert.equal(report.summary.regularSkills, 0);
  assert.equal(report.operators[0].gameFidelityVerified, false);
});

test("ordinary stages reject unsupported enemies and absent enemy records instead of using fallback combat", () => {
  const altered = structuredClone(data);
  const selection = { operators: [defaultBuild(data.operators.char_123_fang)] };
  altered.enemies.enemy_unknown = structuredClone(altered.enemies.enemy_1007_slime);
  assert.throws(() => new StandardBattle(altered, selection), /Unsupported regular-stage enemy/);
  delete altered.enemies.enemy_unknown;
  delete altered.enemies.enemy_1007_slime;
  assert.throws(() => new StandardBattle(altered, selection), /Missing supported enemy record/);
});
