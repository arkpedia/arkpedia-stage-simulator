// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { make as baseMake, born, advance, until } from './helpers/marcil-fixture.js';
import { prepareMarcilFamiliar, MARCIL_FAMILIAR_CONTRACT } from '../server/sim/content/arkpedia-marcil-familiar.js';
import { prepareMarcilExplosion, MARCIL_EXPLOSION_CONTRACT } from '../server/sim/content/arkpedia-marcil-explosion.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';

function make(skill, opts = {}) {
  const f = baseMake({ skill, ...opts,
    ...(skill === 2 ? { prepare: prepareMarcilFamiliar, contract: MARCIL_FAMILIAR_CONTRACT } : {}),
    ...(skill === 3 ? { prepare: prepareMarcilExplosion, contract: MARCIL_EXPLOSION_CONTRACT } : {}),
  });
  f.events = [];
  for (const key of ['marcilChantStart', 'marcilChantEnd', 'skillStart', 'skillEnd'])
    f.b.on(key, x => { if (x.unit === f.u) f.events.push({ key, ...x, time: f.b.time }); });
  return f;
}
function begin(f) {
  born(f);
  if (f.record.index !== 1) assert.equal(f.u.skill.activate('manual'), true);
  assert.equal(f.controller.isChanting(), true);
}
function complete(f) { until(f, () => f.u.skill.active, 25); }
const count = (f, key) => f.events.filter(e => e.key === key).length;

for (const skill of [1,2,3]) for (let rank = 1; rank <= 10; rank++)
  test(`S${skill} rank ${rank} emits skillStart once at completion, never at the chant request`, () => {
    const f = make(skill, { rank }); begin(f);
    const mana = f.wallet.value;
    assert.equal(f.u.skill.active, false); assert.equal(f.u.skill.activations, 0);
    assert.equal(count(f, 'marcilChantStart'), 1); assert.equal(count(f, 'skillStart'), 0);
    assert.equal(f.u.skill.activate('manual'), false); assert.equal(f.u.skill.end('manual'), false);
    advance(f, .4); assert.equal(f.u.skill.active, false); assert.equal(f.wallet.value, mana);
    assert.equal(f.u.findBuff(`marcil:s${skill}`), null);
    assert.equal(skillHud(f.u.skill).state, 'charging');
    assert.equal(skillHud(f.u.skill).ready, false); assert.match(skillHud(f.u.skill).text, /Chanting/);
    complete(f);
    assert.equal(f.controller.isChanting(), false); assert.equal(f.u.skill.activations, 1);
    assert.equal(count(f, 'skillStart'), 1); assert.equal(count(f, 'marcilChantEnd'), 1);
    assert.equal(f.events.find(e => e.key === 'marcilChantEnd').completed, true);
    assert.equal(f.u.skill.gainSp(10, 'gift'), 0);
    assert.equal(skillHud(f.u.skill).state, 'active'); assert.doesNotMatch(skillHud(f.u.skill).text, /Chanting/);
    assert.equal(f.wallet.value, skill === 2 ? mana - 35 : mana);
    advance(f, .1); assert.equal(count(f, 'skillStart'), 1);
    f.b.forceEnd('fixture'); assert.deepEqual(f.b.errors, []);
  });

for (const skill of [1,2,3]) for (const interruption of ['stun', 'hidden', 'mana', 'retreat', 'death', 'battle-end'])
  test(`S${skill} ${interruption} retires a chant without an active skill or skill-start effects`, () => {
    const f = make(skill); begin(f); const mana = f.wallet.value;
    if (interruption === 'stun') f.b.applyStatus(f.u, 'stun', { duration: 2 });
    else if (interruption === 'hidden') f.u.hidden = true;
    else if (interruption === 'mana') f.u.skill.setSpTotal(f.record.bb.skill_cost_min_sp - 1);
    else if (interruption === 'retreat') f.b.retreat(f.u, { permanent: true });
    else if (interruption === 'death') f.b.kill(f.u);
    else f.b.forceEnd('fixture');
    until(f, () => !f.controller.isChanting(), 1);
    assert.equal(f.u.skill.active, false); assert.equal(f.u.skill.activations, 0);
    assert.equal(count(f, 'skillStart'), 0); assert.equal(count(f, 'skillEnd'), 0);
    assert.equal(count(f, 'marcilChantEnd'), 1);
    assert.equal(f.events.find(e => e.key === 'marcilChantEnd').completed, false);
    assert.equal(f.wallet.value, interruption === 'mana' ? f.record.bb.skill_cost_min_sp - 1 : mana);
    assert.equal(f.u.findBuff(`marcil:s${skill}`), null);
    assert.equal(f.controller.enhancement ?? false, false);
    assert.equal(f.controller.marker ?? null, null);
    f.b.forceEnd('fixture'); advance(f, 30); assert.equal(count(f, 'skillStart'), 0);
  });

for (const skill of [1,2,3])
  test(`S${skill} accepts external recovery and assignments while chanting but locks both after completion`, () => {
    const f = make(skill); begin(f); const mana = f.wallet.value;
    assert.equal(f.u.skill.gainSp(5, 'gift'), 5); assert.equal(f.wallet.value, mana + 5);
    f.u.skill.setSpTotal(mana); assert.equal(f.wallet.value, mana);
    f.b.addBuff(f.u, { key: 'fixture:no-sp', flags: { noSp: true } });
    assert.equal(f.u.skill.gainSp(5, 'gift'), 0);
    // Forced assignments retain the shared engine's noSp bypass; this is not
    // recovered native assignment dispatch.
    f.u.skill.setSpTotal(mana + 3); assert.equal(f.wallet.value, mana + 3);
    f.b.removeBuff(f.u, 'fixture:no-sp'); complete(f);
    const activeMana = f.wallet.value; f.u.skill.setSpTotal(80);
    assert.equal(f.wallet.value, activeMana); assert.equal(f.u.skill.gainSp(10, 'gift'), 0);
    f.b.forceEnd('fixture');
  });

test('manual S3 extra-chant release commits one skill start and one explosion', () => {
  const f = make(3); begin(f); until(f, () => f.controller.mode === 's3-extra', 8);
  assert.equal(f.u.skill.active, false); assert.equal(count(f, 'skillStart'), 0);
  assert.equal(skillHud(f.u.skill).canCancel, true);
  const bursts = []; f.b.on('marcilExplosion', x => bursts.push(x));
  assert.equal(f.u.skill.end('manual'), true);
  assert.equal(f.u.skill.active, true); assert.equal(f.u.skill.activations, 1);
  assert.equal(count(f, 'skillStart'), 1); assert.equal(f.wallet.completedExtraChant, false);
  until(f, () => !f.u.skill.active, 8);
  assert.equal(bursts.length, 1); assert.equal(count(f, 'skillEnd'), 1);
  assert.equal(f.wallet.value, f.record.mana.initial - 8);
  f.b.forceEnd('fixture');
});

test('S3 manual release rechecks minimum mana before committing a skill start', () => {
  const f = make(3); begin(f); until(f, () => f.controller.mode === 's3-extra', 8);
  f.u.skill.setSpTotal(7);
  assert.equal(f.u.skill.end('manual'), false);
  assert.equal(f.controller.isChanting(), false); assert.equal(f.u.skill.activations, 0);
  assert.equal(count(f, 'skillStart'), 0); assert.equal(f.wallet.value, 7);
  assert.equal(f.controller.marker, null); f.b.forceEnd('fixture');
});

test('a grant callback committing S3 cannot add mana after the active-skill lock begins', () => {
  const f = make(3); begin(f); until(f, () => f.controller.mode === 's3-extra', 8);
  const mana = f.wallet.value;
  f.b.on('spGain', ({ unit }) => { if (unit === f.u) assert.equal(f.controller.cancel(), true); });
  assert.equal(f.u.skill.gainSp(10, 'gift'), 0);
  assert.equal(f.wallet.value, mana); assert.equal(f.u.skill.active, true);
  assert.equal(count(f, 'skillStart'), 1); f.b.forceEnd('fixture');
});

for (const skill of [1,2,3]) for (const point of ['request', 'start'])
  test(`S${skill} retirement inside ${point} callback cannot leave a cast on a fresh actor`, () => {
    const f = make(skill);
    f.b.on(point === 'request' ? 'marcilChantStart' : 'skillStart', ({ unit }) => {
      if (unit === f.u) f.b.retreat(unit, { permanent: true });
    });
    born(f);
    if (skill !== 2) assert.equal(f.u.skill.activate('manual'), true);
    until(f, () => f.controller.stopped, 25);
    assert.equal(f.u.skill.active, false); assert.deepEqual(f.controller.handles, []);
    assert.equal(count(f, 'skillStart'), point === 'request' ? 0 : 1);
    assert.equal(f.wallet.owner, null);
    const next = f.create(); assert.equal(next.wallet, f.wallet); assert.equal(next.u.skill.active, false);
    assert.equal(next.controller.chantRequests, 0); assert.equal(next.u.skill.activations, 0);
    f.b.forceEnd('fixture'); assert.deepEqual(f.b.errors, []);
  });

test('a new S1 request in a skill-start callback retains distinct chant receipts', () => {
  const f = make(1);
  f.b.on('skillStart', ({ unit }) => {
    if (unit === f.u && unit.skill.activations === 1) {
      assert.equal(unit.skill.end('manual'), undefined);
      assert.equal(unit.skill.activate('manual'), true);
    }
  });
  begin(f); until(f, () => f.u.skill.activations === 2, 10);
  assert.deepEqual(f.events.filter(e => e.key === 'marcilChantEnd').map(e => e.request), [1,2]);
  assert.deepEqual(f.events.filter(e => e.key === 'marcilChantStart').map(e => e.request), [1,2]);
  assert.equal(f.u.skill.active, true); assert.equal(f.wallet.value, f.record.mana.initial);
  f.b.forceEnd('fixture');
});
