// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {verifiedFirewallEnvironmentSource,FIREWALL_ENVIRONMENT_BUNDLE as pin} from '../tools/arkpedia/firewall-environment-source.mjs';
const bytes=p=>readFileSync(new URL('../data/'+p,import.meta.url)),inventory=bytes('arkpedia-cn-native-source.json'),raw=bytes('candidates/arkpedia-ch17-firewall-environment-source.json');
const g=verifiedFirewallEnvironmentSource(raw,inventory),components=Object.values(g.prefabs).flat().filter(c=>c.componentType==='MonoBehaviour').map(c=>JSON.parse(c.originalJson));
test('complete original environment closure pins all four firewall configurations without granting support',()=>{
 assert.equal(Object.keys(g.prefabs).length,2);assert.equal(Object.values(g.prefabs).flat().length,8);assert.equal(pin.bytes,168719);
 const config=components.find(c=>c._bossFirewallEffectConfigs)._bossFirewallEffectConfigs;
 assert.equal(config.length,4);
 for(const c of config){assert.equal(c.vulnerabilityButtonDuration,5);assert.equal(c.vulnerabilityRequiredClickCount,3);}
 const snake=config.find(c=>c.bossId==='enemy_1593_musnake');assert.deepEqual([snake.firewallRangeId,snake.firewallWidth,snake.firewallHeight],['',7,4]);
 for(const c of config.filter(c=>c!==snake))assert.deepEqual([c.firewallRangeId,c.firewallWidth,c.firewallHeight],['x-4',0,0]);
 const support=JSON.parse(bytes('candidates/arkpedia-ch16-enemy-support.json'));for(const c of config)assert.equal(support.enemies[c.bossId].policy,null);
});
test('retained generic Leak Source environment corroborates harmless ground summons and native tile filtering',()=>{
 const c=components.find(c=>c._enemyKey==='enemy_10211_murad');assert.ok(c);assert.equal(c._maxTileNum,1);assert.equal(c._unharmful,1);
 assert.equal(c._motionMode,1);assert.equal(c._alwaysCountAsKilled,0);assert.deepEqual(c._buffsToEnemy,[]);
 assert.equal(c._tileOptions.buildableType,3);assert.equal(c._tileOptions.passableMask,1);assert.equal(c._tileOptions.allowNoneBuildableType,0);
});
test('semantic changes, missing components and self-consistent component rehashing cannot authorize new environment rules',()=>{
 for(const mode of ['change','missing','rehash']){
  const changed=structuredClone(g),rows=Object.values(changed.prefabs)[0];
  if(mode==='missing')rows.pop();else{
   const c=rows.find(c=>c.originalJson.includes('_bossFirewallEffectConfigs'));c.originalJson=c.originalJson.replace('"firewallWidth":7','"firewallWidth":8');
   if(mode==='rehash')c.sha256=createHash('sha256').update(c.originalJson).digest('hex');
  }
  assert.throws(()=>verifiedFirewallEnvironmentSource(Buffer.from(JSON.stringify(changed)),inventory),/closure differs/);
 }
});
test('environment verification rejects a different manifest, inventory or bundle receipt',()=>{
 for(const mutate of [g=>{g.source.bundle.sha256='0'.repeat(64);},g=>{g.source.inventory.sha256='0'.repeat(64);},g=>{g.source.bundle.manifestSha256='0'.repeat(64);}]){
  const changed=structuredClone(g);mutate(changed);assert.throws(()=>verifiedFirewallEnvironmentSource(Buffer.from(JSON.stringify(changed)),inventory),/pins disagree/);
 }
});
