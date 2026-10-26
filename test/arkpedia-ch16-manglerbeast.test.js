// SPDX-License-Identifier: GPL-3.0-or-later
// Direct candidate attachment; source/support approval is checked separately.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash}from'node:crypto';
import{parseSkel}from'../tools/assets/skel.mjs';
import{verifiedNative,verifiedChapter16FamilyGraph}from'../tools/arkpedia/enemy-support.mjs';
import{deriveEnemySupport,prefabPath}from'../shared/arkpedia/enemy-support.js';
import{installEnemyFeatures}from'../server/sim/content/arkpedia-enemy-features.js';
import {abnormalManglerbeast}from'../server/sim/content/chapter16-manglerbeast.js';
import {miner}from'../server/sim/content/chapter16.js';
import {attach,installFeatureDispatch}from'../server/sim/content/enemies.js';
import {makeBattle,chessRec}from'./helpers/battleHarness.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
const records=read('data/candidates/arkpedia-enemy-records.canonical.json').enemies;
const review=read('data/candidates/arkpedia-ch16-reviewed-manglerbeast.json');
const base='enemy_10127_rkmbst',mk='enemy_3010_mcreep';
function fixture(key=base,{block=0}={}){
 const h=makeBattle({content:'generic',autoFinish:false,setup:installFeatureDispatch,defs:{enemies:Object.fromEntries([key,mk].map(k=>[k,records[k].levels[0]])),chess:{dummy:chessRec({id:'dummy',stats:{maxHp:1e6,atk:0,def:0,res:20,blockCnt:block}})}},units:[{chessId:'dummy',row:10,col:block?7:5}]});h.b.start();const e=h.spawn(key,{pos:[10,7]});e.base.moveSpeed=0;e.markDirty();const a=abnormalManglerbeast(records[key].levels[0]);attach(h.b,e,[a]);for(const key of Object.keys(e.profile.attackCooldowns))e.profile.attackCooldowns[key]=1e6;
 const m=h.spawn(mk,{pos:[10,9]});attach(h.b,m,[miner(records[mk].levels[0])]);m.base.moveSpeed=0;m.markDirty();m.atkCd=1e6;
 return{h,b:h.b,e,a,m,u:h.unit('dummy')};
}
const hit=(b,s,t,amount,type='phys')=>b.dealDamage(s,t,{amount,type,isAttack:true,canDodge:false});
for(const key of[base,base+'_2'])test(key+': mode-0 taunt/ASPD, ordinary reduction and no borrowed slug retaliation',()=>{
 const{b,e,a,u}=fixture(key),hp=e.hp,uhp=u.hp;assert.equal(e.s.aspd,200);assert.equal(e.s.interval,1.5);assert.equal(e.s.taunt,1);
 const pool=a.pool;hit(b,u,e,500);hit(b,u,e,500,'arts');hit(b,u,e,100,'true');assert.equal(hp-e.hp,500);assert.equal(a.pool,pool);assert.equal(u.hp,uhp);
});
for(const key of[base,base+'_2'])test(key+': only miner Physical depletes the snapshot and the breaking hit overflows',()=>{
 const{b,e,a,m,h}=fixture(key),hp=e.hp,pool=a.pool,needed=Math.ceil(pool/400),mhp=m.hp;
 hit(b,m,e,100,'arts');assert.equal(a.pool,pool);const before=e.hp;
 for(let n=0;n<needed;n++)hit(b,m,e,500);
 assert.equal(a.mode,1);assert.equal(a.pool,0);assert.equal(before-e.hp,400*needed-pool);assert.equal(m.hp,mhp);
 assert.equal(e.s.aspd,100);assert.equal(e.s.taunt,0);assert.ok(a.phase);h.run(1.04);assert.equal(a.phase,null);assert.deepEqual(b.errors,[]);
});
test('shield-only dispel preserves the independent mode-0 ASPD buff',()=>{
 const{h,b,e,a,u}=fixture();b.removeBuff(e,a.shield);h.run(.04);const hp=e.hp;hit(b,u,e,500);
 assert.equal(hp-e.hp,400);assert.equal(e.s.aspd,200);assert.equal(a.mode,0);assert.equal(e.s.taunt,0);assert.equal(b._takenMultipliers.has(e),false);
 b.emit('battleEnd',{});assert.equal(e.s.aspd,100);
});
test('one physical block and three miner movement links are independent in both modes',()=>{
 const{h,b,e,a,m}=fixture();m.x=7.8;for(const x of[7.3,7.5,7.7]){const m=h.spawn(mk,{pos:[10,x]});attach(b,m,[miner(records[mk].levels[0])]);m.base.moveSpeed=0;m.markDirty();m.atkCd=1e6;}
 h.run(.94);assert.equal(e.blockWeight,1);assert.equal(a.engagements.size,3);a.changeMode();h.run(1.04);assert.equal(a.engagements.size,3);assert.equal(e.findBuff('enemy_field_army_self_mark'),null);
 b.kill(e,null);assert.equal(a.engagements.size,0);assert.equal(b._takenMultipliers.has(e),false);
});
test('forced Trans ignores silence, rejects stun and retires brief other control',()=>{
 const{h,b,e,a}=fixture();b.addBuff(e,{key:'silence',persist:true,flags:{silence:true}});a.changeMode();b.applyStatus(e,'stun',.5);assert.equal(!!e.s.flags.stun,false);
 const freeze=b.addBuff(e,{key:'freeze',persist:true,flags:{freeze:true}});b.removeBuff(e,freeze);h.run(.04);assert.equal(a.phase,null);assert.equal(a.mode,1);
});
test('death/end cleanup removes owned speed/phase but preserves a foreign multiplier',()=>{
 for(const end of['death','battleEnd']){const{h,b,e,a}=fixture();a.changeMode();const foreign=()=>1;b._takenMultipliers.set(e,foreign);
 if(end==='death')b.kill(e,null);else b.emit('battleEnd',{});
 assert.equal(a.phase,null);assert.equal(e.s.aspd,100);assert.equal(b._takenMultipliers.get(e),foreign);h.run(2);assert.deepEqual(b.errors,[]);}
});
test('mode-0 accelerated melee and mode-1 Combat use their independent clocks',()=>{
 const{h,e,a,u}=fixture(base,{block:1});h.run(.1);assert.equal(e.blockedBy,u);
 let hp=u.hp;e.profile.attackCooldowns.m0Combat=0;h.run(.04);assert.equal(u.hp,hp);assert.ok(e.profile.attackCooldowns.m0Combat>1.3&&e.profile.attackCooldowns.m0Combat<1.6);
 assert.ok(e.profile.attackCooldowns.m0Attack>999999);h.run(.9);assert.equal(hp-u.hp,1000);
 a.changeMode();h.run(1.04);hp=u.hp;e.profile.attackCooldowns.m1Combat=0;h.run(.04);assert.equal(u.hp,hp);assert.ok(e.profile.attackCooldowns.m1Combat>2.8);
 h.run(.9);assert.equal(hp-u.hp,1000);assert.deepEqual(h.b.errors,[]);
});
test('Manglerbeast original graph/indexed evidence and skeleton bytes match independent reviewed hashes',()=>{
 const bytes=p=>fs.readFileSync(new URL('../'+p,import.meta.url)),hash=b=>createHash('sha256').update(b).digest('hex');
 for(const p of Object.values(review.sources))assert.equal(hash(bytes(p.path)),p.sha256);
 const clock=read('data/arkpedia-enemy-clock-source.json');
 verifiedChapter16FamilyGraph(bytes(review.sources.graph.path),bytes('data/arkpedia-cn-native-source.json'),bytes('data/arkpedia-cn-enemy-native-source.json'),clock);
 verifiedNative(read(review.sources.indexed.path),clock.prefabs,hash(bytes('data/arkpedia-enemy-clock-source.json')),read('data/arkpedia-mvp.json').behaviors.source);
 const g=read(review.sources.graph.path);
 assert.equal(Object.keys(g.prefabs).length,2);assert.equal(Object.keys(g.projectiles).length,0);
 for(const rows of Object.values(g.prefabs)){
  const nodes=rows.map(r=>JSON.parse(r.originalJson));assert.equal(nodes.find(n=>'_blockVolume'in n)._blockVolume,1);
  const shields=nodes.find(n=>n._buffs?.some(b=>b.buffKey==='rkmbst_m0_t[shield]'))._buffs;
  assert.deepEqual(shields.map(b=>b.buffKey),['rkmbst_m0_t[shield]','rkmbst_m0_t[atk_speed]']);
  assert.equal(shields[1].attributes.attributeModifiers[0].attributeType,7);assert.equal(shields[1].attributes.attributeModifiers[0].loadFromBlackboard,1);
  const wrapper=nodes.find(n=>'_familyMask'in n);assert.equal(wrapper._ignoreSilence,1);assert.equal(wrapper._immuneStunWhenAffecting,1);assert.equal(wrapper._maxTriggerTime,1);
  const trans=nodes.find(n=>n._animKey==='Trans');assert.deepEqual(trans._activeBuffs,[]);assert.equal(trans._waitForAttackEvent,0);
 }
 for(const row of Object.values(read(review.sources.animation.path).enemies)){
  const raw=Buffer.from(row.base64,'base64');assert.equal(raw.length,row.bytes);assert.equal(hash(raw),row.sha256);assert.equal(hash(row.skeletonDataOriginalJson),row.skeletonDataSha256);
  assert.equal(row.prefabBinding.m_PathID,row.skeletonDataPathId);
  const d=parseSkel(raw,undefined,{includeExactDurations:true,includeEventPayloads:true});assert.equal(d.exactDurations.Trans,1);
  for(const key of['A_Attack','B_Attack']){assert.equal(d.exactDurations[key],2);assert.equal(d.eventPayloads[key][0].time,.800000011920929);assert.equal(d.eventPayloads[key][0].name,'OnAttack');}
 }
});
test('candidate feature dispatch installs each exact Manglerbeast once and rejects changed source or record claims',()=>{
 const native=read(review.sources.indexed.path),clock=read('data/arkpedia-enemy-clock-source.json');
 const evidence={...native,chapter16Families:{manglerbeast:{graphSha256:review.sources.graph.sha256}}};
 for(const key of Object.keys(review.enemies)){
  const entries={[key]:records[key]};
  assert.equal(deriveEnemySupport(entries,clock.prefabs,evidence)[key].policy,'stats-attacks-and-features');
  assert.equal(deriveEnemySupport(entries,clock.prefabs,native)[key].policy,null);
  for(const mutate of [n=>{n.chapter16Families.manglerbeast.graphSha256='0'.repeat(64);},n=>{n.prefabs[prefabPath(key)][0].originalJson+=' ';}]){
   const changed=structuredClone(evidence);mutate(changed);
   assert.equal(deriveEnemySupport(entries,clock.prefabs,changed)[key].policy,null);
  }
  for(const mutate of [r=>{r.talents.bb['M0Shield.attack_speed']++;},r=>{r.skills[0].cooldown++;},r=>{r.abilities[0].text+=' changed';}]){
   const changed=structuredClone(entries);mutate(changed[key].levels[0]);
   assert.equal(deriveEnemySupport(changed,clock.prefabs,evidence)[key].policy,null);
  }
  const h=makeBattle({content:'generic',autoFinish:false,setup:b=>{installFeatureDispatch(b);installEnemyFeatures(b);},defs:{enemies:{[key]:records[key].levels[0]}}});
  h.b.start();const e=h.spawn(key,{pos:[10,7]});
  assert.equal(e.mem.ab.list.length,1);assert.equal(e.mem.ab.list.filter(a=>a.changeMode).length,1);
  assert.equal(e.s.aspd,200);assert.equal(e.s.taunt,1);assert.deepEqual(h.b.errors,[]);
 }
});

test('the native pool/DR actions contain no slug-style InverseDamage',()=>{
 const g=read(review.sources.graph.path),n=JSON.parse(g.templates['rkmbst_m0_t[shield]'].originalJson);
 const start=JSON.parse(n.eventToActions._items.find(e=>e.key===0).value.SerializedState);assert.equal(start[0]._attributeType,'MAX_HP');assert.equal(start[1]._multiplyParamKey,'init_shield_hp_ratio');
 const hit=JSON.parse(n.eventToActions._items.find(e=>e.key===10).value.SerializedState);
 assert.equal(hit.length,1);assert.deepEqual(hit[0]._conditionNode._buffKeys,['enemy_mcreep_self_mark']);assert.equal(hit[0]._succeedNodes[0]._damageMask,'PHYSICAL');
 assert.equal(hit[0]._failNodes[0]._damageMask,'PHYSICAL_AND_MAGICAL');assert.equal(hit[0]._succeedNodes[2]._modeIndex,1);
 assert.equal(hit[0]._succeedNodes[3]._skillName,'M1Start');assert.equal(hit[0]._succeedNodes[3]._clearPalsyingBuffBeforeTrigger,true);
});
test('snapshot pool never refills after later maximum-HP changes and shared packets stay recipient-local',()=>{
 const{b,e,a,u,m}=fixture(),pool=a.pool;b.addBuff(e,{key:'max-hp',persist:true,mods:{hpPct:1}});assert.equal(e.s.maxHp,40000);assert.equal(a.pool,pool);
 const dmg={amount:500,type:'phys',isAttack:true,canDodge:false},hp=m.hp;b.dealDamage(u,e,dmg);b.dealDamage(u,m,dmg);assert.equal(hp-m.hp,350);assert.equal(dmg.mul,undefined);
 hit(b,null,e,500);assert.equal(a.pool,pool);assert.equal(a.mode,0);
});
