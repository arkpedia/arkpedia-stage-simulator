// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make, ready, until, advance, near, enemy} from './helpers/aphrissa-s1-fixture.js';
import {skillHud} from '../shared/arkpedia/skill-hud.js';
const ATK = 'aphris_sk1', MODE = 'aphris_sk1_switch_mode', MARKER = 'aphris_sk1_token';

for (let rank = 1; rank <= 10; rank++) test(`S1 rank ${rank} uses its real automatic account and infinite selected ATK parent`, () => {
  const f = make({rank}), base = f.u.s.atk;
  ready(f);
  assert.equal(f.u.skill.manual, false); assert.equal(f.u.skill.active, true);
  assert.equal(f.u.skill.activations, 1); assert.equal(f.u.skill.charges, 0); near(f.u.skill.sp, 0);
  near(f.u.s.atk, base * (1 + f.selected.bb.atk));
  assert.equal(f.u.findBuff(ATK).duration, Infinity); assert.equal(f.u.findBuff(MODE).duration, Infinity);
  advance(f.b, 10); assert.equal(f.u.skill.activations, 1); near(f.u.skill.sp, 0);
  assert.equal(f.ends.length, 0); assert.equal(f.starts.length, 1);
});

test('Natural time-SP auto-activates S1 without any enemy, relay or manual click', () => {
  const f = make(); advance(f.b, f.u.skill.spCost - .1);
  assert.equal(f.u.skill.active, false);
  until(f, () => f.controller.mode === 's1', 1);
  assert.equal(f.starts.length, 1); assert.equal(f.receipts.length, 0);
  assert.equal(f.u.skill.active, true);
});

for (const [dir, begin, attack] of [
  ['RIGHT', 'Skill_1_Begin', 'Skill_1_Loop_A'], ['UP', 'Skill_1_Begin', 'Skill_1_Loop_A'],
  ['DOWN', 'Skill_Down_1_Begin', 'Skill_Down_1_Loop_A'],
]) test(`${dir} S1 uses its original Begin and A/B family without an invented attack marker`, () => {
  const f = make({dir}); enemy(f, {row: dir === 'UP' ? 6 : dir === 'DOWN' ? 4 : 5, col: dir === 'RIGHT' ? 6 : 5});
  f.u.skill.setSpTotal(f.u.skill.spCost); advance(f.b, f.b.dt);
  assert.equal(f.u.mem.regularFormVisual.clip, begin); assert.equal(f.controller.intro != null, true);
  assert.equal(f.hits.length, 0); near(f.u.s.atk, f.selected.stats.atk);
  until(f, () => f.controller.s1Attacks.phase != null);
  assert.equal(f.u.mem.regularFormVisual.clip, attack);
  until(f, () => f.hits.length === 2, 8);
  assert.equal(f.u.mem.regularFormVisual.clip, attack.replace(/A$/, 'B'));
  assert.ok(f.hits.every(hit => hit.isSkill));
});

test('S1 damage composes selected ATK, relay ATK and source fixed RES penetration through one beam receipt', () => {
  const f = make(), base = f.u.s.atk, a = enemy(f, {res: 50}), b = enemy(f, {col: 8, res: 50, fly: true});
  const token = f.controller.deck.place(5, 7, 'RIGHT');
  ready(f); until(f, () => f.hits.length === 2);
  const expected = base * (1 + f.selected.bb.atk + .25) * .6;
  near(f.hits[0].amount, expected); near(f.hits[1].amount, expected);
  assert.deepEqual(f.hits.map(hit => hit.id), [a.id, b.id]);
  assert.equal(f.hits[0].attackId, f.hits[1].attackId); assert.equal(f.receipts.length, 1);
  assert.equal(token.findBuff(MARKER).source, f.u);
});

test('S1 marks existing relay lives with an independent marker and suppresses their normal withdrawal', () => {
  const f = make(), t = f.controller.deck.place(5, 7);
  advance(f.b, 2); ready(f);
  const marker = t.findBuff(MARKER); assert.ok(marker); assert.equal(marker.duration, Infinity);
  assert.equal(marker.source, f.u); assert.equal(t.skill.spec.formCountdown(), null);
  advance(f.b, 26); assert.equal(t.deployed, true); assert.equal(f.controller.deck.point.lifetimeResolved, true);
});

test('A relay born after S1 gets the separate native self-sourced marker before its lifetime starts', () => {
  const f = make(); ready(f); const t = f.controller.deck.place(5, 7);
  const marker = t.findBuff(MARKER); assert.ok(marker); assert.equal(marker.source, t);
  assert.equal(t.skill.spec.formCountdown(), null);
  advance(f.b, 26); assert.equal(t.deployed, true);
});

test('Removing an accepted nonderived marker after the original timer resolved cannot restart withdrawal', () => {
  const f = make(); ready(f); const t = f.controller.deck.place(5, 7);
  advance(f.b, 26); f.b.removeBuff(t, t.findBuff(MARKER));
  advance(f.b, 5); assert.equal(t.deployed, true); assert.equal(f.controller.deck.point.lifetimeResolved, true);
});

test('Removing the marker before the normal deadline leaves the original withdrawal check intact', () => {
  const f = make(); ready(f); const t = f.controller.deck.place(5, 7);
  f.b.removeBuff(t, t.findBuff(MARKER)); advance(f.b, 26);
  assert.equal(t.deployed, false);
});

test('Ending the ATK parent does not end its separate mode parent or retract existing relay markers', () => {
  const f = make(), base = f.u.s.atk, t = f.controller.deck.place(5, 7);
  ready(f); const marker = t.findBuff(MARKER);
  f.b.removeBuff(f.u, f.u.findBuff(ATK));
  assert.equal(f.controller.mode, 's1'); assert.equal(f.u.skill.active, true);
  near(f.u.s.atk, base * 1.25); assert.equal(t.findBuff(MARKER), marker);
  advance(f.b, 26); assert.equal(t.deployed, true);
});

test('Ending the independent mode parent restores ordinary combat while the ATK parent remains', () => {
  const f = make(); ready(f); const atk = f.u.findBuff(ATK);
  f.b.removeBuff(f.u, f.u.findBuff(MODE));
  assert.equal(f.controller.mode, 'normal'); assert.equal(f.u.findBuff(ATK), atk);
  assert.equal(f.u.skill.active, true); assert.equal(f.u.profile.isSkill, false);
});

test('disableOverride preserves an existing same-key relay marker and its original source', () => {
  const f = make(), t = f.controller.deck.place(5, 7);
  const foreign = f.b.addBuff(t, {key: MARKER, source: t});
  ready(f); assert.equal(t.findBuff(MARKER), foreign);
});

test('S1 activation cancels the old ordinary windup while preserving its positive cooldown', () => {
  const f = make(); enemy(f); until(f, () => f.controller.ordinary.phase != null);
  const oldCd = f.u.atkCd; f.u.skill.setSpTotal(f.u.skill.spCost); advance(f.b, f.b.dt);
  assert.equal(f.controller.ordinary.phase, null); assert.ok(f.u.atkCd > 2);
  assert.ok(f.u.atkCd <= oldCd); advance(f.b, .5); assert.equal(f.hits.length, 0);
});

test('S1 ignores silence but cannot automatically cast while stunned', () => {
  const f = make(); f.b.addBuff(f.u, {key: 'fixture:control', flags: {silence: true, stun: true}});
  f.u.skill.setSpTotal(f.u.skill.spCost); advance(f.b, .5); assert.equal(f.u.skill.active, false);
  f.b.removeBuff(f.u, 'fixture:control'); f.b.addBuff(f.u, {key: 'fixture:silence', flags: {silence: true}});
  until(f, () => f.controller.mode === 's1'); assert.equal(f.u.skill.active, true);
});

test('Stun during the accepted uninterruptible Begin does not invent a missing-marker stall', () => {
  const f = make(); f.u.skill.setSpTotal(f.u.skill.spCost); advance(f.b, f.b.dt);
  f.b.addBuff(f.u, {key: 'fixture:stun', flags: {stun: true}});
  advance(f.b, .3); assert.equal(f.controller.mode, 's1'); assert.ok(f.u.findBuff(ATK));
});

for (const reason of ['retreat', 'death', 'life', 'replacement', 'battleEnd'])
  test(`S1 owner ${reason} drains all composed source resources`, () => {
    const f = make(); ready(f); const t = f.controller.deck.place(5, 7);
    if (reason === 'retreat') f.b.retreat(f.u, {permanent: true});
    if (reason === 'death') f.b.kill(f.u, null);
    if (reason === 'life') { f.u.deploySeq++; advance(f.b, .1); }
    if (reason === 'replacement') { f.u.mem.aphrissaS1Owner = {}; advance(f.b, .1); }
    if (reason === 'battleEnd') f.b.emit('battleEnd', {});
    assert.equal(t.deployed, false); assert.equal(f.controller.stopped, true);
    assert.equal(f.controller.handles.length, 0);
    assert.ok(f.controller.parts.every(part => part.handles.length === 0));
    assert.equal(f.u.findBuff(ATK), null); assert.equal(f.u.findBuff(MODE), null);
  });

test('A rejected ATK grant does not falsely retract the separately accepted mode grant', () => {
  const f = make(); f.b.on('beforeBuff', context => { if (context.buff.key === ATK) context.cancel = true; });
  ready(f); assert.equal(f.u.findBuff(ATK), null); assert.ok(f.u.findBuff(MODE));
  assert.equal(f.controller.mode, 's1');
});

test('A modified source stat parent is rejected rather than applying a forged coefficient', () => {
  const f = make(), base = f.u.s.atk;
  f.b.on('beforeBuff', context => { if (context.buff.key === ATK) context.buff.mods = {atkPct: 999}; });
  ready(f); near(f.u.s.atk, base); assert.equal(f.u.findBuff(ATK), null);
});

test('S1 HUD stays active indefinitely and does not invent a manual cancel or readiness loop', () => {
  const f = make(); ready(f); const hud = skillHud(f.u.skill);
  assert.equal(hud.state, 'active'); assert.equal(hud.ready, false); assert.equal(hud.canCancel, false);
  advance(f.b, 20); assert.equal(f.u.skill.activations, 1);
});

test('Unreviewed S1 contracts and changed selected stats cannot construct a fallback', () => {
  assert.throws(() => make({contract: {}}), /exact S1 owner contract/);
  assert.throws(() => make({mutate: def => def.stats.atk++}), /Incomplete original/);
});

for (const elite of [0, 1]) test(`E${elite} composed S1 preserves lower-promotion talents and source stats`, () => {
  const f = make({elite}), base = f.u.s.atk;
  ready(f); f.controller.deck.place(5, 7);
  near(f.u.s.atk, base * (1 + f.selected.bb.atk + (elite === 1 ? .15 : 0)));
  near(f.u.s.resIgnoreFlat, 0); assert.equal(f.u.skill.active, true);
});

test('Direct attack entry cannot bypass mode, Born, cooldown or current ray acquisition', () => {
  const f = make({defer: true});
  assert.equal(f.controller.ordinary.begin(), false);
  f.deploy(); enemy(f);
  assert.equal(f.controller.ordinary.begin(), false);
  assert.equal(f.controller.s1Attacks.begin(), false);
  until(f, () => !!f.controller.ordinary.phase);
  assert.equal(f.controller.ordinary.begin(), false);
});

test('The S1 dispatcher rejects a non-source clip or a down clip in the wrong original mode', () => {
  const f = make(); ready(f); advance(f.b, 1);
  enemy(f);
  f.controller.s1Attacks.pickClip = () => 'Attack';
  assert.throws(() => f.controller.s1Attacks.begin(), /original mode clip/);
  f.controller.s1Attacks.pickClip = () => 'Skill_Down_1_Loop_A';
  assert.throws(() => f.controller.s1Attacks.begin(), /original direction mode/);
  assert.equal(f.controller.s1Attacks.phase, null);
});

test('A reentrant clip dispatcher cannot start a second pending beam', () => {
  const f = make(); ready(f); advance(f.b, 1); enemy(f);
  let calls = 0;
  f.controller.s1Attacks.pickClip = () => {
    calls++; assert.equal(f.controller.s1Attacks.begin(), false); return 'Skill_1_Loop_A';
  };
  assert.equal(f.controller.s1Attacks.begin(), true); assert.equal(calls, 1);
  until(f, () => f.hits.length === 1); assert.equal(f.receipts.length, 1);
});
