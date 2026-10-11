import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { StandardBattle } from "../server/sim/arkpedia.js";
import { defaultBuild } from "../shared/arkpedia/loadout.js";
import { skillHud } from "../shared/arkpedia/skill-hud.js";
const data = JSON.parse(fs.readFileSync(new URL("../data/arkpedia-mvp.json", import.meta.url)));
function deployed(id) {
  const quiet = structuredClone(data);
  quiet.stage.geometry.waves[0].spawns = [];
  const b = new StandardBattle(quiet, { operators: [defaultBuild(data.operators[id])] });
  b.setViewport("fullscreen-workspace");
  b.autoFinish = false;
  advance(b, b.cost(id));
  const row = data.operators[id].position === "RANGED" ? 1 : 2;
  return { b, unit: b.deployOperator(id, row, 3, "RIGHT") };
}
function advance(b, seconds) {
  for (let i = 0; i < Math.round(seconds / b.dt); i++) b.step();
}
test("manual skill HUD follows charging, readiness, activation, duration and recharge in a real battle", () => {
  const { b, unit } = deployed("char_208_melan"), sk = unit.skill;
  assert.equal(skillHud(sk).ready, false);
  advance(b, 5);
  const charging = skillHud(sk);
  assert.ok(charging.fraction > 0 && charging.fraction < 1);
  advance(b, sk.spCost);
  assert.equal(skillHud(sk).fraction, 1);
  assert.equal(skillHud(sk).ready, true);
  assert.match(skillHud(sk).text, /Manual activation · Ready/);
  b.activateOperator(unit.defId);
  assert.equal(skillHud(sk).ready, false);
  assert.equal(skillHud(sk).state, "active");
  assert.equal(skillHud(sk).fraction, 1);
  advance(b, sk.duration / 2);
  assert.ok(Math.abs(skillHud(sk).fraction - 0.5) < 0.01);
  assert.equal(sk.sp, 0, "SP must not recover during a running skill");
  advance(b, sk.duration / 2 + 1);
  assert.equal(skillHud(sk).state, "charging");
  assert.equal(skillHud(sk).ready, false);
  assert.ok(skillHud(sk).fraction < 0.1);
});
test("an automatic attack skill can hold a full gauge without a manual-ready diamond", () => {
  const { unit } = deployed("char_124_kroos"), sk = unit.skill;
  sk.gainSp(sk.spCost, "attack");
  assert.equal(sk.ready, true);
  assert.equal(skillHud(sk).fraction, 1);
  assert.equal(skillHud(sk).state, "active");
  assert.equal(skillHud(sk).ready, false);
});
test("manual cancellation is opt-in and ends the active effect without spending another charge", () => {
  const { b, unit } = deployed("char_208_melan"), sk = unit.skill;
  sk.gainSp(sk.spCost, "test");
  const ordinaryAtk = unit.s.atk;
  assert.equal(b.activateOperator(unit.defId), true);
  assert.ok(unit.s.atk > ordinaryAtk);
  assert.equal(skillHud(sk).canCancel, false);
  assert.equal(b.activateOperator(unit.defId), false);
  sk.spec.manualCancel = true;
  assert.equal(skillHud(sk).canCancel, true);
  assert.equal(b.activateOperator(unit.defId), true);
  assert.equal(sk.active, false);
  assert.equal(sk.activations, 1);
  assert.equal(sk.spTotal, 0);
  assert.equal(unit.s.atk, ordinaryAtk);
  assert.equal(skillHud(sk).canCancel, false);
  advance(b, 1);
  assert.ok(sk.spTotal > 0, "manual ending restores SP recovery");
});
test("regular manual commands cannot spend SP while stunned or silenced", () => {
  const { b, unit } = deployed("char_208_melan"), sk = unit.skill;
  sk.gainSp(sk.spCost, "test");
  const sp = sk.spTotal;
  for (const status of ['stun', 'silence']) {
    b.applyStatus(unit, status, { duration: 1 });
    assert.equal(b.activateOperator(unit.defId), false);
    assert.equal(sk.spTotal, sp);
    assert.equal(sk.activations, 0);
    advance(b, 1.1);
  }
  assert.equal(b.activateOperator(unit.defId), true);
});
test("a missing cast target preserves full SP and its ready diamond without claiming the skill is exhausted", () => {
  const { b, unit } = deployed("char_208_melan"), sk = unit.skill;
  let eligible = false;
  sk.spec.canActivate = () => eligible;
  sk.gainSp(sk.spCost, "test");
  const sp = sk.spTotal;
  assert.equal(sk.ready, true);
  assert.equal(sk.exhausted, false);
  assert.equal(sk.castEligible, false);
  assert.equal(skillHud(sk).ready, true);
  assert.equal(skillHud(sk).canActivate, false);
  assert.equal(skillHud(sk).fraction, 1);
  assert.doesNotMatch(skillHud(sk).text, /No skill uses/);
  assert.equal(b.activateOperator(unit.defId), false);
  assert.equal(sk.activate("test", { free: true }), false);
  assert.equal(sk.spTotal, sp);
  assert.equal(sk.activations, 0);
  eligible = true;
  assert.equal(skillHud(sk).canActivate, true);
  assert.equal(b.activateOperator(unit.defId), true);
  assert.equal(sk.activations, 1);
  assert.equal(sk.spTotal, 0);
});
test("skills without an SP gauge stay hidden; ammo and infinite skills never produce invalid bar widths", () => {
  assert.equal(skillHud(null), null);
  assert.equal(skillHud({ kind: "passive" }), null);
  assert.equal(skillHud({ noSkill: true }), null);
  assert.equal(skillHud({ active: true, kind: "ammo", ammoLeft: 3, ammoMax: 6 }).fraction, 0.5);
  assert.equal(skillHud({ active: true, kind: "toggle", timeLeft: Infinity }).fraction, 1);
  const pending = skillHud({ pending: true, ready: true, manual: true });
  assert.equal(pending.ready, false);
  assert.equal(pending.fraction, 1);
  assert.equal(pending.state, "active");
});
