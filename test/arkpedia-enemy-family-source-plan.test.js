// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {familySourcePlan} from '../tools/arkpedia/fetch-enemy-family-source.mjs';
test('retained mechanics fetch plan contains exact unique prefab, template, projectile and clock dependencies',async()=>{
  const plan=await familySourcePlan(['ch16-story-guardian','ch16-fear-projectile','ch16-artillery','ch16-crossbow','ch17-brute','ch17-flyer','ch17-bag','ch17-channel-carrier','ch17-war-caster','ch17-firewall-boss','ch17-brute']);
  assert.deepEqual(plan.map(p=>p.path).sort(),['battle/enm_pfb_27.ab','battle/enm_pfb_28.ab','battle/enm_pfb_31.ab',
    'battle/prefabs/[uc]envsystems.ab','battle/prefabs/[uc]projectiles.ab','config/buff_template_holder.ab','refs/arts/enm_art_23.ab','refs/arts/enm_art_26.ab']);
  assert.ok(plan.every(p=>p.bytes>0&&/^[a-f0-9]{64}$/.test(p.sha256)));
});
test('source fetch planning refuses path traversal and a clock reattached to another graph',async()=>{
  for(const families of [[],['../source'],['ch16-story-guardian/other']])await assert.rejects(familySourcePlan(families),/Plain retained/);
  await assert.rejects(familySourcePlan(['ch16-story-guardian'],{read:async url=>{
    const bytes=await readFile(url);if(!String(url).endsWith('-animation-source.json'))return bytes;
    const changed=JSON.parse(bytes);changed.source.graph.sha256='0'.repeat(64);return Buffer.from(JSON.stringify(changed));
  }}),/pins disagree/);
});
