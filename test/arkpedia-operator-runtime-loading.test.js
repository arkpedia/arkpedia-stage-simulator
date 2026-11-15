// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createOperatorRuntime } from '../server/sim/content/arkpedia-operator-runtime.js';
import { OPERATOR_RUNTIME_INDEX } from '../server/sim/content/arkpedia-operator-runtime-index.js';
import { buildRuntimeIndex, guardedIdentity, guardedFamily } from '../tools/arkpedia/operator-runtime-index.mjs';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild, skillRankCap } from '../shared/arkpedia/loadout.js';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };

test('generated runtime ownership requires an immediate shared identity guard and remains fresh', async () => {
  const source = "export const OWNER_ID = 'char_123_fang'; const ID = OWNER_ID;\nexport function a({id}) { if (id !== ID) return; run(); }\nexport function b({def}) { if (def.charId !== ID) return; run(); }";
  assert.equal(guardedIdentity(source, ['a', 'b']), 'char_123_fang');
  assert.equal(guardedIdentity(source.replace('if (id', 'sideEffect(); if (id'), ['a', 'b']), null);
  assert.equal(guardedIdentity(source.replace('def.charId !== ID', "def.charId !== 'char_124_kroos'"), ['a', 'b']), null);
  assert.equal(guardedIdentity(source.replace('if (id !== ID) return;', ''), ['a', 'b']), null);
  assert.equal(guardedIdentity(source.replace('a({id})', 'a({id, value = sideEffect()})'), ['a', 'b']), null);
  const family = 'export function a({id}) { if (!FAMILY[id] || !def.skill) return; run(); }\nexport function b({def}) { const id = def.charId; if (!FAMILY[id]) return; run(); }';
  const registries = new Map([['FAMILY', ['char_123_fang', 'char_124_kroos']]]);
  assert.deepEqual(guardedFamily(family, ['a', 'b'], registries), registries.get('FAMILY'));
  assert.equal(guardedFamily(family.replace('const id', 'sideEffect(); const id'), ['a', 'b'], registries), null);
  assert.equal(guardedFamily(family.replace('|| !def.skill', '&& !def.skill'), ['a', 'b'], registries), null);
  const { output } = await buildRuntimeIndex();
  assert.equal(await readFile(new URL('../server/sim/content/arkpedia-operator-runtime-index.js', import.meta.url), 'utf8'), output);
});

test('selected runtime shares concurrent imports, retries failures, preserves hook order and refuses unprepared kits', async () => {
  const calls = [], loads = [], entry = (key, id = null) => ({ key, id, hooks: { customize: 'customize', install: 'install' },
    load: async () => { loads.push(key); return { customize: () => calls.push(`c:${key}`), install: () => calls.push(`i:${key}`) }; } });
  let fail = true;
  const a = entry('shared'), b = entry('selected', 'char_a'), c = entry('other', 'char_b'), original = b.load;
  b.load = async () => { if (fail) { fail = false; throw Error('temporary'); } return original(); };
  const runtime = createOperatorRuntime([a, b, c]);
  assert.throws(() => runtime.assertPrepared(['char_a']), /must be prepared/);
  await assert.rejects(runtime.prepare(['char_a']), /temporary/);
  await Promise.all([runtime.prepare(['char_a']), runtime.prepare(['char_a'])]);
  assert.deepEqual(loads, ['shared', 'selected']);
  assert.doesNotThrow(() => runtime.assertPrepared(['char_a']));
  runtime.customize({ id: 'char_a' }); runtime.install({ id: 'char_a' });
  assert.deepEqual(calls, ['c:shared', 'c:selected', 'i:shared', 'i:selected']);
  assert.throws(() => runtime.install({ id: 'char_b' }), /must be prepared/);
  assert.equal(runtime.stats().pending, 0);
});

test('every selected operator and skill keeps the eager registry battle state with demand-loaded adapters', async () => {
  const source = { ...data, stage: { ...data.stage, geometry: { ...data.stage.geometry, waves: [] } } };
  const runtime = createOperatorRuntime(), failures = [];
  const state = (battle, unit) => ({ hp: unit.hp, stats: unit.s, results: unit.stats,
    // This existing field controller uses a process-wide cosmetic instance
    // serial. Compare the field identity and effects across separate battles.
    buffs: unit.buffs.map(b => ({ key: b.key.replace(/^(thorns2_s_1\[buff\]):\d+$/, '$1:<instance>'), mods: b.mods, flags: b.flags })),
    hooks: Object.fromEntries(Object.entries(battle._hooks).map(([k, v]) => [k, v.length])),
    skill: { active: unit.skill.active, sp: unit.skill.sp, activations: unit.skill.activations }, errors: battle.errors });
  for (const op of Object.values(data.operators)) {
    await runtime.prepare([op.id]);
    for (const skill of op.skills.length ? op.skills : [null]) {
      try {
        const build = { ...defaultBuild(op), skillId: skill?.id ?? null };
        build.skillRank = skill ? skillRankCap(op, skill.id, build.elite) : null;
        const results = [];
        for (const operatorRuntime of [null, runtime]) {
          const b = new StandardBattle(source, { operators: [build] }, { seed: 123, operatorRuntime });
          b.autoFinish = false; b.setViewport('fullscreen-workspace'); b.addDp('arkpedia', 99);
          let tile;
          for (let r = 0; r < source.stage.geometry.rows; r++) for (let c = 0; c < source.stage.geometry.cols; c++)
            if (!tile && !b.placementError(op.id, r, c)) tile = [r, c];
          const u = b.deployOperator(op.id, ...tile, 'RIGHT'); b.step();
          u.skill?.gainSp(u.skill.spCost, 'test'); b.activateOperator(op.id);
          for (let i = 0; i < 60; i++) b.step();
          assert.deepEqual(b.errors, []); results.push(state(b, u));
        }
        assert.deepEqual(results[1], results[0]);
      } catch (error) { failures.push(`${op.id}/${skill?.id ?? 'none'}: ${error.message}`); }
    }
  }
  assert.deepEqual(failures, []);
  const isolated = createOperatorRuntime(); await isolated.prepare(['char_123_fang']);
  const unloaded = OPERATOR_RUNTIME_INDEX.filter(e => e.ids ? !e.ids.includes('char_123_fang') : e.id && e.id !== 'char_123_fang').map(e => e.key);
  assert.deepEqual(isolated.stats().loaded, [], 'basic Fang needs no specialized adapter');
  assert.ok(unloaded.length > 100); assert.ok(unloaded.every(key => !isolated.stats().loaded.includes(key)));
});

test('squad services bind to the current selection even after another owner was cached', async () => {
  const calls = [];
  const runtime = createOperatorRuntime([{ key: 'squad:owner', ids: ['char_owner'], hooks: {},
    services: { discount: 'cost', start: 'zero', install: 'noop', refund: 'required' },
    load: async () => ({ discount: (_b, _id, cost) => cost - 2, start: () => 3,
      install: () => calls.push('install'), refund: () => 4 }) }]);
  assert.throws(() => runtime.servicesFor(['char_owner']), /must be prepared/);
  await runtime.prepare(['char_owner']);
  const first = runtime.servicesFor(['char_owner']), next = runtime.servicesFor(['char_other']);
  assert.equal(first.discount(null, 'char_other', 10), 8);
  assert.equal(next.discount(null, 'char_other', 10), 10);
  assert.equal(first.start(), 3); assert.equal(next.start(), 0);
  first.install(); next.install(); assert.deepEqual(calls, ['install']);
  assert.throws(() => next.refund(), /requires its selected owner/);
  assert.equal(first.refund(), 4);
});

test('selected squad services preserve Zima ally costs and Bagpipe ally SP without leaking into later squads', async () => {
  const ids = ['char_115_headbr', 'char_222_bpipe', 'char_123_fang'];
  const runtime = createOperatorRuntime(); await runtime.prepare(ids);
  const source = { ...data, stage: { ...data.stage, geometry: { ...data.stage.geometry, waves: [] } } };
  const make = squad => {
    const b = new StandardBattle(source, { operators: squad.map(id => defaultBuild(data.operators[id])) }, { operatorRuntime: runtime });
    b.autoFinish = false; b.setViewport('fullscreen-workspace'); b.addDp('arkpedia', 99);
    let tile;
    for (let r = b.rect.r0; r <= b.rect.r1; r++) for (let c = b.rect.c0; c <= b.rect.c1; c++)
      if (!tile && !b.placementError('char_123_fang', r, c)) tile = [r, c];
    const cost = b.cost('char_123_fang'), u = b.deployOperator('char_123_fang', ...tile, 'RIGHT');
    return { b, u, cost };
  };
  const withOwners = make(ids), alone = make(['char_123_fang']);
  const zima = withOwners.b.data.getChess(ids[0]), bagpipe = withOwners.b.data.getChess(ids[1]);
  assert.equal(withOwners.cost, alone.cost + zima.talents[0].bb.cost);
  assert.equal(withOwners.u.skill.sp, alone.u.skill.sp + bagpipe.talents.find(t => t.bb.sp != null).bb.sp);
  assert.deepEqual(withOwners.b.errors, []); assert.deepEqual(alone.b.errors, []);
});
