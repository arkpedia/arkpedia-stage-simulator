// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make, cast, until, advance, near, enemy} from './helpers/aphrissa-s2-fixture.js';
import {skillHud} from '../shared/arkpedia/skill-hud.js';
import {APHRISSA_S2_CONTRACT as contract} from '../server/sim/content/arkpedia-aphrissa-s2.js';
const MODE = 'aphris_sk2_switch_mode4';

for (let rank = 1; rank <= 10; rank++) test(`Held S2 rank ${rank} composes the selected manual account and original mode parent`, () => {
  const f = make({rank}), state = cast(f);
  assert.equal(f.u.skill.manual, true); assert.equal(f.u.skill.active, true);
  assert.equal(f.u.skill.activations, 1); near(f.u.skill.sp, 0);
  assert.equal(f.controller.mode, 's2'); assert.equal(f.u.findBuff(MODE).duration, Infinity);
  assert.equal(f.u.findBuff(MODE).source, f.u); assert.equal(state.activation, 1);
  advance(f.b, 7.5); assert.equal(f.u.skill.active, true); near(f.u.skill.sp, 0);
  until(f, () => !f.u.skill.active, 1);
  assert.equal(f.controller.mode, 'normal'); assert.equal(f.u.findBuff(MODE), null);
  assert.equal(f.ends.length, 1); assert.equal(f.u.skill.activations, 1);
});

test('Natural SP reaches readiness without casting until a manual request', () => {
  const f = make(); advance(f.b, 3); assert.equal(f.u.skill.active, false);
  assert.equal(f.u.skill.ready, true); assert.equal(f.starts.length, 0); assert.equal(f.controller.state, null);
  assert.equal(f.u.skill.activate(), true); assert.equal(f.starts.length, 1);
});

for (const [dir, prefix] of [['RIGHT', 'Skill_2'], ['LEFT', 'Skill_2'], ['UP', 'Skill_2'], ['DOWN', 'Skill_Down_2']])
  test(`${dir} S2 plays original Begin, Loop and End without inventing animation hit markers`, () => {
    const f = make({dir}); cast(f);
    assert.equal(f.u.mem.regularFormVisual.clip, `${prefix}_Begin`);
    assert.equal(f.hits.length, 0); advance(f.b, .16);
    assert.equal(f.u.mem.regularFormVisual.clip, `${prefix}_Begin`);
    until(f, () => !f.controller.state.intro); assert.equal(f.u.mem.regularFormVisual.clip, `${prefix}_Loop`);
    assert.equal(f.u.mem.regularFormVisual.loop, true);
    f.u.skill.end('fixture'); assert.equal(f.u.mem.regularFormVisual.clip, `${prefix}_End`);
    until(f, () => !f.controller.tail); assert.equal(f.u.mem.regularFormVisual.clip, 'Idle');
  });

test('A selected S2 cast has sixteen periodic skill receipts with both live talents composed', () => {
  const f = make(), base = f.u.s.atk;
  f.controller.deck.place(5, 7, 'RIGHT');
  const a = enemy(f, {res: 50}), z = enemy(f, {col: 17, fly: true, res: 50});
  cast(f); until(f, () => f.hits.length === 2);
  const expected = base * 1.25 * f.selected.bb.atk_scale * .6;
  near(f.hits[0].amount, expected); near(f.hits[1].amount, expected);
  assert.deepEqual(f.hits.map(hit => hit.id), [a.id, z.id]);
  assert.equal(f.hits[0].attackId, f.hits[1].attackId);
  until(f, () => !f.u.skill.active, 9); assert.equal(f.receipts.filter(r => r.isSkill).length, 16);
  assert.equal(f.hits.filter(hit => hit.isSkill).length, 32);
  assert.equal(f.receipts.filter(r => !r.isSkill).length, 0);
});

test('The real infinite beam and owner RES aura follow a deployed operator turn', () => {
  const f = make(), turn = f.b.deployOperator('char_122_beagle', 5, 7, 'UP');
  cast(f); assert.ok(turn.findBuff('aphris[t2]'));
  const target = enemy(f, {row: 12, col: 7, res: 50});
  until(f, () => f.hits.length === 1); assert.equal(f.hits[0].id, target.id);
  near(f.hits[0].amount, f.u.s.atk * f.selected.bb.atk_scale * .6);
  turn.dir = 'RIGHT'; advance(f.b, .6); assert.equal(f.hits.length, 1);
});

test('Removing the independent mode parent restores aura range without ending the owned beam account', () => {
  const f = make(), turn = f.b.deployOperator('char_122_beagle', 5, 12, 'UP');
  cast(f); f.b.removeBuff(f.u, f.u.findBuff(MODE));
  assert.equal(f.controller.mode, 'normal'); assert.equal(f.u.skill.active, true);
  const target = enemy(f, {row: 10, col: 12}); until(f, () => f.hits.length === 1);
  assert.equal(f.hits[0].id, target.id); assert.equal(turn.findBuff('aphris[t2]'), null);
  assert.equal(f.u.profile.isSkill, true);
});

test('Rejected mode admission leaves its separate beam alive and does not invent an accepted mode grant', () => {
  const f = make(); enemy(f, {col: 17});
  f.b.on('beforeBuff', context => { if (context.unit === f.u && context.buff.key === MODE) context.cancel = true; });
  cast(f); assert.equal(f.controller.mode, 'normal'); assert.equal(f.u.findBuff(MODE), null);
  until(f, () => f.hits.length === 1); assert.equal(f.hits[0].isSkill, true);
});

test('The non-restarting source transition preserves positive ordinary cooldown on both edges', () => {
  const f = make(); f.u.atkCd = 20; cast(f); near(f.u.atkCd, 20);
  advance(f.b, 2); const before = f.u.atkCd; assert.ok(before > 17);
  f.u.skill.end('fixture'); near(f.u.atkCd, before);
  enemy(f); advance(f.b, 1); assert.equal(f.receipts.length, 0);
});

test('Casting during an ordinary windup cancels its unborn hit and uses the separate S2 predelay', () => {
  const f = make(); enemy(f); until(f, () => f.controller.ordinary.phase != null);
  cast(f); assert.equal(f.controller.ordinary.phase, null);
  until(f, () => f.hits.length === 1);
  assert.equal(f.hits[0].isSkill, true); assert.equal(f.receipts.length, 1);
});

test('S2 can cast during original Start without an invented one-second skill hold', () => {
  const f = make(); enemy(f); cast(f);
  until(f, () => f.hits.length === 1); assert.ok(f.b.time < 1);
  assert.equal(f.hits[0].isSkill, true);
});

test('Full End finishes before ordinary combat or another cast, while SP recovery resumes normally', () => {
  const f = make(); enemy(f); cast(f); advance(f.b, 1); f.u.skill.end('fixture');
  assert.ok(f.controller.tail); assert.equal(f.u.profile.isSkill, false);
  const count = f.hits.length; f.u.skill.setSpTotal(f.u.skill.spCost);
  assert.equal(f.u.skill.activate(), false); advance(f.b, .1); assert.equal(f.hits.length, count);
  until(f, () => !f.controller.tail); until(f, () => f.hits.length > count, 4);
  assert.equal(f.hits.at(-1).isSkill, false);
});

for (const control of ['stun', 'disarm', 'hidden', 'silence'])
  test(`Held ${control} policy preserves account/mode lifetime without replaying Begin`, () => {
    const f = make(); enemy(f); cast(f); until(f, () => !f.controller.state.intro);
    const visual = f.u.mem.regularFormVisual, hits = f.hits.length;
    if (control === 'hidden') f.u.hidden = true;
    else f.b.addBuff(f.u, {key: 'fixture:control', flags: {[control]: true}});
    advance(f.b, 1.5); assert.equal(f.u.skill.active, true); assert.equal(f.controller.mode, 's2');
    assert.equal(f.u.mem.regularFormVisual, visual);
    if (control !== 'silence') assert.equal(f.hits.length, hits);
    else assert.ok(f.hits.length > hits);
    f.u.hidden = false; f.b.removeBuff(f.u, 'fixture:control');
    const current = f.hits.length; until(f, () => f.hits.length > current);
    assert.equal(f.u.mem.regularFormVisual, visual); assert.equal(f.starts.length, 1);
  });

test('Retreat during the first beam hit drains both talents, relay resources, mode and all owned hooks', () => {
  const f = make(), token = f.controller.deck.place(5, 7, 'RIGHT');
  const first = enemy(f), later = enemy(f, {col: 8});
  f.b.on('damaged', event => { if (event.source === f.u && event.target === first) f.b.retreat(f.u, {permanent: true}); });
  cast(f); until(f, () => f.hits.length === 1); advance(f.b, 1);
  assert.equal(f.hits.length, 1); assert.equal(later.hp, later.s.maxHp); assert.equal(token.deployed, false);
  assert.equal(f.u.findBuff(MODE), null); assert.equal(f.u.findBuff('aphris[t2]'), null);
  assert.equal(f.u.findBuff('aphris_t1[atk]'), null); assert.equal(f.controller.handles.length, 0);
  assert.ok(f.controller.parts.every(part => part.handles.length === 0));
});

for (const replacement of ['slot', 'life', 'account', 'spec'])
  test(`${replacement} replacement retires the complete old S2 composition`, () => {
    const f = make(); enemy(f); cast(f); until(f, () => f.hits.length === 1);
    if (replacement === 'slot') f.u.mem.aphrissaS2Owner = {};
    if (replacement === 'life') f.u.deploySeq++;
    if (replacement === 'account') f.u.skill = Object.create(Object.getPrototypeOf(f.u.skill), Object.getOwnPropertyDescriptors(f.u.skill));
    if (replacement === 'spec') f.u.skill.spec = {...f.u.skill.spec};
    advance(f.b, .7); assert.equal(f.hits.length, 1); assert.equal(f.controller.handles.length, 0);
    assert.ok(f.controller.parts.every(part => part.handles.length === 0));
    assert.equal(f.u.findBuff(MODE), null);
  });

test('Foreign same-key mode and presentation replacements survive old-owner cleanup', () => {
  const f = make(); cast(f); f.b.removeBuff(f.u, f.u.findBuff(MODE));
  const foreign = f.b.addBuff(f.u, {key: MODE, source: null, duration: Infinity});
  const visual = f.u.mem.regularFormVisual = {clip: 'fixture:foreign'};
  f.controller.stop(); assert.equal(f.u.findBuff(MODE), foreign);
  assert.equal(f.u.mem.regularFormVisual, visual);
});

test('The selected owner contract and original source inputs are mandatory', () => {
  assert.throws(() => make({contract: {...contract}}), /exact S2 owner/);
  assert.throws(() => make({mutate: def => { def.skill.initSp++; }}), /Incomplete original/);
  assert.throws(() => make({skill: 1}), /Changed original Aphrissa S2 owner/);
});

test('S2 account SP and active duration remain visible through the existing skill HUD', () => {
  const f = make(); const before = skillHud(f.u.skill); cast(f); const active = skillHud(f.u.skill);
  near(before.fraction, 16 / 18); assert.equal(before.state, 'charging');
  assert.equal(active.state, 'active'); assert.equal(active.fraction, 1); assert.equal(active.canCancel, false);
  assert.equal(active.text, 'Skill active · 8s');
  advance(f.b, 1); near(skillHud(f.u.skill).fraction, 7 / 8); near(f.u.skill.sp, 0);
});

test('E1 S2 uses the source fifteen-percent relay bonus without inventing the E2 RES talent', () => {
  const f = make({elite: 1}), base = f.u.s.atk; f.controller.deck.place(5, 7, 'RIGHT');
  enemy(f, {res: 50}); cast(f); until(f, () => f.hits.length === 1);
  near(f.hits[0].amount, base * 1.15 * f.selected.bb.atk_scale * .5);
  assert.equal(f.u.findBuff('aphris[t2]'), null);
});

test('P6 and full trust preserve the selected ATK and thirteen fixed RES penetration', () => {
  const f = make({potential: 6, trust: 200}); enemy(f, {res: 50}); cast(f);
  until(f, () => f.hits.length === 1);
  near(f.hits[0].amount, 1021 * f.selected.bb.atk_scale * .63);
});

test('S2 does not mark relay permanence or remove a normal relay when its account ends', () => {
  const f = make(), token = f.controller.deck.place(5, 7, 'RIGHT'); cast(f);
  until(f, () => !f.u.skill.active, 9);
  assert.equal(token.deployed, true); assert.equal(token.findBuff('aphris_sk1_token'), null);
  near(f.u.s.atk, f.selected.stats.atk * 1.25);
  advance(f.b, 18); assert.equal(token.deployed, false); near(f.u.s.atk, f.selected.stats.atk);
});

for (const reason of ['death', 'battleEnd']) test(`S2 ${reason} drains the whole composed controller`, () => {
  const f = make(), token = f.controller.deck.place(5, 7, 'RIGHT'); cast(f);
  if (reason === 'death') f.b.kill(f.u, null); else f.b._finish('fixture');
  assert.equal(token.deployed, false); assert.equal(f.controller.handles.length, 0);
  assert.ok(f.controller.parts.every(part => part.handles.length === 0));
  assert.equal(f.u.findBuff(MODE), null); assert.equal(f.u.findBuff('aphris[t2]'), null);
});

test('A foreign visual present at natural account end survives both End time and cleanup', () => {
  const f = make(); cast(f); until(f, () => !f.controller.state.intro);
  const foreign = f.u.mem.regularFormVisual = {clip: 'fixture:replacement'};
  until(f, () => !f.u.skill.active, 9); assert.equal(f.u.mem.regularFormVisual, foreign);
  until(f, () => !f.controller.tail); assert.equal(f.u.mem.regularFormVisual, foreign);
  f.controller.stop(); assert.equal(f.u.mem.regularFormVisual, foreign);
});

test('An End visual replaced mid-transition cannot be removed by the old transition timer', () => {
  const f = make(); cast(f); advance(f.b, 1); f.u.skill.end('fixture');
  const foreign = f.u.mem.regularFormVisual = {clip: 'fixture:tail-replacement'};
  until(f, () => !f.controller.tail); assert.equal(f.u.mem.regularFormVisual, foreign);
});

test('A Begin visual replacement survives the old transition to Loop and later End', () => {
  const f = make(); cast(f);
  const foreign = f.u.mem.regularFormVisual = {clip: 'fixture:begin-replacement'};
  until(f, () => !f.controller.state.intro); assert.equal(f.u.mem.regularFormVisual, foreign);
  f.u.skill.end('fixture'); until(f, () => !f.controller.tail);
  assert.equal(f.u.mem.regularFormVisual, foreign);
});

test('A forged mode parent cannot apply foreign modifiers or lend S2 owner range', () => {
  const f = make(), base = f.u.s.atk;
  f.b.on('beforeBuff', context => {
    if (context.unit === f.u && context.buff.key === MODE) context.buff.mods = {atkPct: 999};
  });
  cast(f); assert.equal(f.u.findBuff(MODE), null); near(f.u.s.atk, base);
  assert.equal(f.controller.mode, 'normal'); enemy(f); until(f, () => f.hits.length === 1);
  near(f.hits[0].amount, base * f.selected.bb.atk_scale);
});

test('Ending the account during mode admission cannot leave a parent or delayed beam behind', () => {
  const f = make(); enemy(f);
  f.b.on('beforeBuff', context => { if (context.unit === f.u && context.buff.key === MODE) f.u.skill.end('fixture'); });
  f.u.skill.setSpTotal(f.u.skill.spCost); assert.equal(f.u.skill.activate(), true);
  assert.equal(f.controller.state, null); assert.equal(f.u.findBuff(MODE), null);
  advance(f.b, .4); assert.equal(f.hits.filter(hit => hit.isSkill).length, 0);
});

test('A reentrant S2 start cannot reset its clock, parent or active account', () => {
  const f = make(); cast(f); const state = f.controller.state, parent = f.u.findBuff(MODE), p = f.controller.beam.phase;
  advance(f.b, 1); f.controller.start(); f.controller.end(999);
  assert.equal(f.controller.state, state); assert.equal(f.controller.beam.phase, p);
  assert.equal(f.u.findBuff(MODE), parent); assert.equal(f.starts.length, 1);
});

test('A later valid manual activation gets a fresh mode parent and fresh predelay', () => {
  const f = make(); enemy(f); cast(f); const parent = f.u.findBuff(MODE);
  advance(f.b, 1); f.u.skill.end('fixture'); until(f, () => !f.controller.tail);
  const count = f.hits.length; cast(f); assert.notEqual(f.u.findBuff(MODE), parent);
  advance(f.b, .1); assert.equal(f.hits.length, count);
  until(f, () => f.hits.length > count); assert.equal(f.starts.length, 2); assert.equal(f.ends.length, 1);
});

test('A changed activation retires old channel state rather than borrowing the new activation number', () => {
  const f = make(); enemy(f); cast(f); f.u.skill.activations++;
  advance(f.b, .4); assert.equal(f.hits.length, 0); assert.equal(f.controller.state, null);
  assert.equal(f.u.findBuff(MODE), null); assert.equal(f.controller.beam.phase, null);
});
