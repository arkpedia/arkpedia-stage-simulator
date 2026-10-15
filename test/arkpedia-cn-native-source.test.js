// SPDX-License-Identifier: GPL-3.0-or-later
// Metadata contract tests; independent raw-bundle verification is a separate CLI.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import cn from '../data/arkpedia-cn-source.json' with { type: 'json' };
import roster from '../data/arkpedia-roster-target.json' with { type: 'json' };
import receipt from '../data/arkpedia-cn-native-source.json' with { type: 'json' };
import { CN_NATIVE_PIN, parsePinnedCNManifest, prepareCNNativePlan, verifyCNNativeBundle } from '../tools/arkpedia/cn-native-source.mjs';
const hash = (type, bytes) => createHash(type).update(bytes).digest('hex');
const fixture = () => ({ cn: structuredClone(cn), roster: structuredClone(roster),
  globalForms: structuredClone(receipt.source.globalAlternateForms),
  // Deliberately reduced synthetic manifest for projection/refusal tests, not
  // proof that these bytes came from the publisher's pinned full manifest.
  manifest: { versionId: CN_NATIVE_PIN.resourceVersion, manifestName: receipt.source.manifestName,
    manifestVersion: receipt.source.manifestVersion,
    abInfos: receipt.bundles.map(r => ({ name: r.path, abSize: r.bytes, md5: r.md5 })) } });
test('committed source membership covers every CN-only form and all its ranks without enabling a kit', () => {
  const f = fixture(), plan = prepareCNNativePlan(f);
  assert.equal(Object.keys(plan.operators).length, 55); assert.deepEqual(plan.summary, receipt.summary);
  assert.equal(plan.summary.skills, 128); assert.equal(plan.summary.skillRanks, 1280);
  assert.equal(plan.summary.bundles, 120); assert.equal(plan.summary.tokenGroups, 7);
  assert.deepEqual(plan.operators, receipt.operators);
  assert.deepEqual(plan.operators.char_4237_jcinta.skills[0].prefabIds, [null], 'Original null-prefab skill must not acquire an inferred fallback');
  assert.deepEqual(plan.bundles, receipt.bundles.map(({ sha256, ...row }) => row));
  assert.deepEqual(plan.enabledOperators, []);
  for (const flag of ['frameParity', 'moduleSupport', 'nativeParticleSupport', 'graphClosureVerified', 'animationBindingsVerified'])
    assert.equal(plan[flag], false);
});
for (const [name, change] of [
  ['foreign CN table revision', f => { f.cn.source.commit = '0'.repeat(40); }],
  ['foreign target revision', f => { f.roster.source.commit = '0'.repeat(40); }],
  ['moving native version', f => { f.manifest.versionId = 'latest'; }],
  ['already enabled source claim', f => { f.cn.enabledOperators.push('char_4051_akkord'); }],
  ['foreign alternate-form revision', f => { f.globalForms.commit = '0'.repeat(40); }],
  ['duplicate alternate-form exclusions', f => { f.globalForms.formIds.push(f.globalForms.formIds[0]); }],
  ['missing owner bundle', f => { f.manifest.abInfos = f.manifest.abInfos.filter(x => x.name !== 'charpack/char_4051_akkord.ab'); }],
  ['missing artwork bundle', f => { f.manifest.abInfos = f.manifest.abInfos.filter(x => x.name !== 'chararts/char_4051_akkord.ab'); }],
  ['missing skill library', f => { f.manifest.abInfos = f.manifest.abInfos.filter(x => x.name !== 'battle/prefabs/[uc]skills.ab'); }],
  ['missing token groups', f => { f.manifest.abInfos = f.manifest.abInfos.filter(x => !x.name.startsWith('pkgrps/btl_pfb_tokens_')); }],
  ['duplicate native bundle', f => { f.manifest.abInfos.push(f.manifest.abInfos[0]); }],
  ['invalid native checksum', f => { f.manifest.abInfos[0].md5 = 'invalid'; }],
  ['invalid native byte count', f => { f.manifest.abInfos[0].abSize = 0; }],
  ['missing selected skill', f => { delete f.cn.tables.skills.skchr_akkord_1; }],
  ['missing source rank', f => { f.cn.tables.skills.skchr_akkord_1.levels.pop(); }],
  ['changed target skill membership', f => { f.roster.operators.find(x => x.id === 'char_4051_akkord').skills.pop(); }],
  ['unobtainable source selection', f => { f.cn.tables.characters.char_4051_akkord.isNotObtainable = true; }],
]) test('native plan refuses ' + name, () => { const f = fixture(); change(f); assert.throws(() => prepareCNNativePlan(f)); });
test('production manifest parser rejects fabricated metadata even if its version matches', () => {
  const bytes = Buffer.from(JSON.stringify(fixture().manifest));
  assert.throws(() => parsePinnedCNManifest(bytes), /immutable byte pin/);
});
test('byte-pin parser validates byte identity and duplicate names before returning a manifest', () => {
  const good = Buffer.from(JSON.stringify({ versionId: 'fixture', abInfos: [{ name: 'one' }] }));
  const pin = { resourceVersion: 'fixture', manifestBytes: good.length, manifestSha256: hash('sha256', good) };
  assert.equal(parsePinnedCNManifest(good, pin).versionId, 'fixture');
  const changed = Buffer.from(good); changed[1] ^= 1;
  assert.throws(() => parsePinnedCNManifest(changed, pin), /immutable byte pin/);
  assert.throws(() => parsePinnedCNManifest(good.subarray(1), pin), /immutable byte pin/);
  const repeated = Buffer.from(JSON.stringify({ versionId: 'fixture', abInfos: [{ name: 'one' }, { name: 'one' }] }));
  assert.throws(() => parsePinnedCNManifest(repeated, { ...pin, manifestBytes: repeated.length, manifestSha256: hash('sha256', repeated) }), /duplicate/);
  assert.throws(() => parsePinnedCNManifest(good, { ...pin, resourceVersion: 'other' }), /membership/);
});
test('bundle admission rejects changed bytes, declared size, digest and non-Unity headers', () => {
  const raw = Buffer.from('UnityFS\0explicit byte-check fixture'), row = { path: 'diagnostic.ab', bytes: raw.length, md5: hash('md5', raw) };
  assert.equal(verifyCNNativeBundle(row, raw).sha256, hash('sha256', raw));
  const changed = Buffer.from(raw); changed[10] ^= 1;
  assert.throws(() => verifyCNNativeBundle(row, changed), /checksum\/header/);
  assert.throws(() => verifyCNNativeBundle({ ...row, bytes: raw.length + 1 }, raw), /checksum\/header/);
  assert.throws(() => verifyCNNativeBundle({ ...row, md5: '0'.repeat(32) }, raw), /checksum\/header/);
  const header = Buffer.from(raw); header[0] = 0;
  assert.throws(() => verifyCNNativeBundle({ ...row, md5: hash('md5', header) }, header), /checksum\/header/);
});
