import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { installFakePixi } from './render/fakepixi.js';

let fake, BattleActor;
before(async () => {
  fake = installFakePixi();
  ({ BattleActor } = await import('../public/arkpedia/battle-actor.js'));
});
after(() => fake.restore());

function actor(facing) {
  const model = data.sd.models[`operator/char_208_melan/default/${facing}`];
  const entry = { anims: model.animationRoles, animations: model.animations, hits: model.hits };
  const a = new BattleActor({ animations: Object.keys(entry.animations).map(name => ({ name })) }, entry);
  // Fake PIXI records queued tracks but does not advance them automatically.
  a.queued = [];
  const queue = a.spine.state.addAnimation;
  a.spine.state.addAnimation = (track, name, loop, delay) => {
    a.queued.push({ name, loop });
    return queue(track, name, loop, delay);
  };
  return a;
}

for (const facing of ['front', 'back']) {
  test(`Melantha ${facing} plays one swing per attack and returns to idle without extra strikes`, () => {
    const a = actor(facing);
    a.attack(1.5);
    assert.equal(a.spine.state.tracks[0].loop, false);
    for (let i = 0; i < 150; i++) a.update(1 / 60);
    assert.equal(a.mode, 'base');
    assert.equal(a.current, 'Attack_End');
    assert.deepEqual(a.queued.at(-1), { name: 'Idle', loop: true });
    a.attack(1.5);
    assert.equal(a.spine.state.tracks[0].loop, false);
    assert.equal(a.mode, 'attack');
    a.destroy();
  });
}

test('Melantha ATK buff does not invent attacks without a target', () => {
  const a = actor('front');
  a.setSkill(true);
  for (let i = 0; i < 120; i++) a.update(1 / 60);
  assert.equal(a.mode, 'base');
  assert.equal(a.current, 'Idle');
  a.attack(1.5);
  assert.equal(a.mode, 'attack');
  assert.equal(a.spine.state.tracks[0].loop, false);
  a.setSkill(false);
  for (let i = 0; i < 150; i++) a.update(1 / 60);
  assert.equal(a.mode, 'base');
  assert.deepEqual(a.queued.at(-1), { name: 'Idle', loop: true });
  a.destroy();
});

test('Melantha damages only one of two overlapping enemies per attack, before and during her skill', () => {
  const isolated = structuredClone(data);
  isolated.stage.geometry.waves[0].spawns = [
    { enemy_id: 'enemy_1007_slime', count: 2, time: 0, interval: 0, route: 1 },
  ];
  Object.assign(isolated.enemies.enemy_1007_slime.stats, { maxHp: 100000, atk: 0, moveSpeed: 0 });
  const b = new StandardBattle(isolated, { operators: [defaultBuild(isolated.operators.char_208_melan)] });
  b.setViewport('fullscreen-workspace');
  b.addDp('arkpedia', 99);
  const u = b.deployOperator('char_208_melan', 2, 7, 'RIGHT');
  const attacks = [], damage = new Map();
  b.on('attack', ctx => {
    if (ctx.attacker !== u) return;
    assert.equal(b.enemiesInKeys(u.rangeKeys, u, u.profile).length, 2, 'both enemies are alive in range');
    assert.equal(ctx.targets.length, 1);
    attacks.push({ target: ctx.targets[0].id, active: u.skill.active });
  });
  b.on('damaged', ctx => {
    if (ctx.source !== u) return;
    const id = ctx.dmg.attackId;
    if (!damage.has(id)) damage.set(id, []);
    damage.get(id).push(ctx.target.id);
  });
  for (let i = 0; i < 41 / b.dt; i++) b.step();
  assert.equal(b.activateOperator(u.defId), true);
  for (let i = 0; i < 15 / b.dt; i++) b.step();
  assert.ok(attacks.some(a => !a.active));
  assert.ok(attacks.some(a => a.active));
  assert.equal(damage.size, attacks.length);
  for (const victims of damage.values()) assert.equal(victims.length, 1);
  const untouched = b.enemies.find(e => !attacks.some(a => a.target === e.id));
  assert.ok(untouched, 'the other enemy is never hit by the same swing');
  assert.equal(untouched.hp, untouched.s.maxHp);
  assert.equal(b.errors.length, 0);
});
