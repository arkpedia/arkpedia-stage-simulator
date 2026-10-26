// SPDX-License-Identifier: GPL-3.0-or-later
// Reproduce selected clocks from the retained original graphs and skeletons.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { parseSkel } from '../assets/skel.mjs';
import { writeJSONAtomic } from './write-json.mjs';
const root = new URL('../../', import.meta.url), sources = {}, enemies = {};
const sha = b => createHash('sha256').update(b).digest('hex');
async function read(path, pin) {
  const raw = await readFile(new URL(path, root)); if (pin) assert.equal(sha(raw), pin, path);
  sources[path] = { path, sha256: sha(raw) }; return JSON.parse(raw);
}
for (const family of ['abnormal-slug', 'manglerbeast']) {
  const review = await read(`data/candidates/arkpedia-ch16-reviewed-${family}.json`), inputs = {};
  for (const [key, row] of Object.entries(review.sources)) inputs[key] = await read(row.path, row.sha256);
  for (const id of Object.keys(review.enemies)) {
    const rows = inputs.graph.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`];
    for (const row of rows) assert.equal(sha(row.originalJson), row.sha256);
    const nodes = rows.map(r => ({ ...r, data: JSON.parse(r.originalJson) }));
    const one = predicate => { const found = nodes.filter(n => predicate(n.data)); assert.equal(found.length, 1); return found[0]; };
    const local = ref => { assert.equal(ref.m_FileID, 0); const node = nodes.find(n => n.pathId === ref.m_PathID); assert.ok(node); return node; };
    const entity = one(n => n._modes); assert.equal(entity.data._modes.length, 2);
    const casts = {};
    for (const [mode, ref] of entity.data._modes.entries()) {
      const owner = local(ref);
      for (const kind of ['Attack', 'Combat']) {
        const node = local(owner.data['_' + kind.toLowerCase()]), n = node.data;
        assert.equal(n._animKey, mode ? 'B_Attack' : 'A_Attack');
        assert.equal(n._timeMode, 0); assert.equal(n._maxAnimScale, 1); assert.equal(n._affectedBySlowDown, 1);
        assert.equal(n._selectTargetSource, 2); assert.equal(n._selectTargetTiming, 0); assert.equal(n._waitForAttackEvent, 1);
        assert.equal(n._damageType, 1); assert.equal(n._attackType, 1);
        casts[`m${mode}${kind}`] = { pathId: node.pathId, modePathId: owner.pathId, originalJson: node.originalJson };
      }
    }
    const transition = one(n => n._animKey === 'Trans'), t = transition.data;
    assert.equal(t._timeMode, family === 'abnormal-slug' ? 1 : 0); assert.equal(t._maxAnimScale, -1);
    assert.equal(t._affectedBySlowDown, 1); assert.equal(t._waitForAttackEvent, 0);
    const row = inputs.animation.enemies[id], raw = Buffer.from(row.base64, 'base64');
    assert.equal(raw.length, row.bytes); assert.equal(sha(raw), row.sha256);
    assert.equal(sha(row.skeletonDataOriginalJson), row.skeletonDataSha256);
    assert.equal(row.prefabBinding.m_PathID, row.skeletonDataPathId);
    const decoded = parseSkel(raw, undefined, { includeExactDurations: true, includeEventPayloads: true }), timings = {};
    for (const clip of ['A_Attack', 'B_Attack', 'Trans']) {
      const events = decoded.eventPayloads[clip] ?? [];
      assert.equal(events.length, clip === 'Trans' ? 0 : 1);
      if (events.length) assert.equal(events[0].name, 'OnAttack');
      timings[clip] = { duration: decoded.exactDurations[clip], hit: events[0]?.time ?? null };
    }
    assert.equal(timings.Trans.duration, review.defaults.transitionDuration);
    enemies[id] = { family, entityPathId: entity.pathId, casts,
      transition: { pathId: transition.pathId, originalJson: transition.originalJson }, timings };
  }
}
const result = { schemaVersion: 1, testOnly: true, frameParity: false, sources, enemies,
  limits: ['Selected source-bound ordinary casts and transition clocks only. TimeMode0 samples BAT/interval; maxAnimScale1 caps ordinary playback while -1 is uncapped. TimeMode1 uses fixed playback. Eligible elapsed work consumes live slow_down. These regular-engine mappings do not prove compiled initial FSM or native frame ordering.'] };
const output = new URL('data/candidates/arkpedia-ch16-shielded-clock-contract.json', root);
if (process.argv.includes('--check')) assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), result);
else await writeJSONAtomic(output, result);
console.log('Verified ordinary and transition clocks for both Slug and Manglerbeast variants');
