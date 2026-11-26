// SPDX-License-Identifier: GPL-3.0-or-later
// Bloodcalling Altar instance shapes beyond 13-12's (tools/arkpedia/stage-device-instances.mjs compileAltarBlackboard):
// ActiveOutset.alias (13-11, 13-15, 13-16), a doubled branch_id (13-8) and a branch the level lacks (13-19).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import native from '../data/arkpedia-device-native-source.json' with { type: 'json' };
import { bloodAltarNativeReviewed, BLOOD_AMBER } from '../shared/arkpedia/stage-blood-altar.js';
import { createStageLibraryLoader } from '../shared/arkpedia/stage-library.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { StageBloodAltars } from '../server/sim/content/arkpedia-stage-blood-altars.js';

const manifest = JSON.parse(await readFile(new URL('../data/arkpedia-library.json', import.meta.url)));
const loader = createStageLibraryLoader(async url => new Response(await readFile(new URL(`..${url}`, import.meta.url))));
const load = id => { const entry = manifest.stages.find(s => s.id === id); assert.equal(entry?.availability, 'available', id); return loader.load(entry); };
const clone = v => JSON.parse(JSON.stringify(v));
const battle = stage => new StandardBattle({ ...mvp, stage, enemies: { ...mvp.enemies, ...stage.enemies } },
  { operators: [defaultBuild(mvp.operators.char_151_myrtle)] }, { seed: 1 });
const quiet = async id => {
  const stage = clone(await load(id));
  for (const w of stage.geometry.waves) w.spawns = [];
  const b = battle(stage);
  b.life = 999;
  b.step();
  for (const e of b.enemies.filter(u => u.alive && !u.mem.stageDeviceId)) b._remove(e, 'withdraw', null, true);
  b.after(1e6, () => {}, { holdsBattle: true });
  return b;
};
const until = (b, pred, limit) => { while (!b.finished && b.time < limit && !pred()) b.step(); return pred(); };

test('ActiveOutset is reviewed: it activates the instance its blackboard names, then kills the Altar', () => {
  const named = clone(native);
  named.templates.trap_bonore_active_outset.eventToActions.ON_BUFF_START[0]._instAlias = 'trap_126_outset#1';
  assert.equal(bloodAltarNativeReviewed(named), false, 'a fixed alias');
  const kept = clone(native);
  kept.templates.trap_bonore_active_outset.eventToActions.ON_BUFF_START.pop();
  assert.equal(bloodAltarNativeReviewed(kept), false, 'an Altar that survives');
});

test('13-11: a bomb destroying the Altar at (4,2) reveals the hidden Loading Point there, charging from 0 SP', async () => {
  const b = await quiet('13-11');
  const loaders = b.stageBombLoaders, altar = b.stageBloodAltars.entries.find(a => a.row === 4 && a.col === 2);
  assert.equal(altar.spec.outsetAlias, 'trap_126_outset#2');
  assert.equal(loaders.entries.size, 1);
  assert.ok(loaders.hidden.has('trap_126_outset#2'));
  until(b, () => b.time >= 30, 31);
  b.stageBloodAltars.destroy(altar);
  assert.equal(altar.unit.alive, false);
  assert.equal(loaders.entries.size, 2);
  const point = [...loaders.entries.values()].find(d => d.row === 4 && d.col === 2);
  assert.ok(point?.unit.alive);
  assert.equal(point.state, 'charging');
  assert.equal(point.spec.branchId, 'bmbcar2');
  b.getPlayer('arkpedia').dp = 99;
  assert.ok(until(b, () => point.state === 'ready', b.time + 41));
  const bomb = loaders.activate(point.id);
  assert.equal(bomb.alive, true);
  // The other Altar has no Loading Point of its own: destroying it reveals nothing.
  b.stageBloodAltars.destroy(b.stageBloodAltars.entries.find(a => a !== altar));
  assert.equal(loaders.entries.size, 2);
});

test('13-8: the Altar names branch_id twice; the last (bonore_dfello2) is the one its pulse runs', async () => {
  const b = await quiet('13-8');
  const altar = b.stageBloodAltars.entries[0];
  assert.equal(altar.spec.branchId, 'bonore_dfello2');
  assert.ok(b.stageBranches.branches.bonore_dfello1, 'the shadowed branch is bound');
  const spawned = [], spawn = b.spawnEnemy.bind(b);
  b.spawnEnemy = (key, opts) => { const e = spawn(key, opts); if (opts?.tag?.startsWith('stage-branch:')) spawned.push(opts.routeIndex); return e; };
  const e = b.spawnEnemy(BLOOD_AMBER, { pos: [4, 6], countInTotal: false });
  b.addBuff(e, { key: 'test:hold', persist: true, flags: { noMove: true } });
  assert.ok(until(b, () => spawned.length === 1, 21));
  const route = b.stageBranches.branches.bonore_dfello2.randomPhases?.[0]?.[0] ?? b.stageBranches.branches.bonore_dfello2.spawns[0];
  assert.equal(spawned[0], route.routeIndex);
  assert.notEqual(route.routeIndex, (b.stageBranches.branches.bonore_dfello1.randomPhases?.[0]?.[0] ?? b.stageBranches.branches.bonore_dfello1.spawns[0]).routeIndex);
});

test('13-19: Altars whose branches the level lacks are accepted only with nothing that carries a mark', async () => {
  const stage = await load('13-19');
  const b = battle(stage);
  assert.equal(b.stageBloodAltars.entries.length, 2);
  assert.equal(b.stageBranches.branches[b.stageBloodAltars.entries[0].spec.branchId], undefined);
  const amber = { ...stage, enemies: { ...stage.enemies, [BLOOD_AMBER]: stage.enemies.enemy_1365_spnwiz } };
  assert.throws(() => new StageBloodAltars(battle(stage), stage.devices, stage.geometry, amber), /Missing Bloodcalling Altar branch program/);
});

for (const id of ['13-8', '13-11', '13-15', '13-16', '13-19', 'h13-1_adverse_environment']) {
  test(`headless ${id} clears`, async () => {
    const b = battle(await load(id));
    b.life = 999;
    // Every enemy that can be struck is knocked out within 3 s (Fluxcasters drift and revive in between). At 600 s every
    // Altar is destroyed, as the bombs would, so drifting Fluxcasters withdraw.
    let last = 0;
    while (!b.finished && b.time < 900) {
      b.step();
      if (b.time >= 600) for (const a of b.stageBloodAltars.entries) b.stageBloodAltars.destroy(a);
      if (b.time - last >= 3) { last = b.time;
        for (const e of b.enemies) if (e.alive && !e.mem.stageDeviceId && !e.s.flags.untargetable && !e.s.flags.invulnerable)
          b.dealDamage(null, e, { amount: 1e7, type: 'true', sourceless: true }); }
    }
    assert.equal(b.reason, 'cleared');
  });
}
