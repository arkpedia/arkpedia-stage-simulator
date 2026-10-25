// SPDX-License-Identifier: GPL-3.0-or-later
import test from'node:test';
import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import{createHash}from'node:crypto';
import{makeBattle,chessRec}from'./helpers/battleHarness.js';
import{attach,installFeatureDispatch}from'../server/sim/content/enemies.js';
import{armyPhantom}from'../server/sim/content/chapter16-phantom.js';
import{miner}from'../server/sim/content/chapter16.js';
import{verifiedNative,verifiedChapter16FamilyGraph}from'../tools/arkpedia/enemy-support.mjs';
const bytes=p=>readFileSync(new URL('../'+p,import.meta.url)),read=p=>JSON.parse(bytes(p));
const records=read('data/candidates/arkpedia-enemy-records.canonical.json').enemies,review=read('data/candidates/arkpedia-ch16-reviewed-phantom.json');
const key='enemy_10120_uaghst_2',mk='enemy_3010_mcreep';
function fixture(){
 const h=makeBattle({content:'generic',autoFinish:false,setup:installFeatureDispatch,defs:{enemies:{[key]:records[key].levels[0],[mk]:records[mk].levels[0]},chess:{dummy:chessRec({id:'dummy',stats:{maxHp:1e6,atk:0}})}},units:[{chessId:'dummy',row:10,col:7}]});
 h.b.start();const e=h.spawn(key,{pos:[10,7]}),a=armyPhantom(records[key].levels[0]);attach(h.b,e,[a]);h.b.addBuff(e,{key:'fixture-native-unblockable-trait',persist:true,flags:{unblockable:true}});e.base.moveSpeed=0;e.markDirty();e.atkCd=1e6;
 return{h,b:h.b,e,a,u:h.unit('dummy'),spawnMiner(x){const m=h.spawn(mk,{pos:[10,x]});attach(h.b,m,[miner(records[mk].levels[0])]);m.base.moveSpeed=0;m.atkCd=1e6;m.markDirty();return m;}};
}
test('Army Phantom full graph and indexed identities match its separate exact-record review',()=>{
 const hash=b=>createHash('sha256').update(b).digest('hex');for(const p of Object.values(review.sources))assert.equal(hash(bytes(p.path)),p.sha256);
 const clock=read('data/arkpedia-enemy-clock-source.json');verifiedNative(read(review.sources.indexed.path),clock.prefabs,hash(bytes('data/arkpedia-enemy-clock-source.json')),read('data/arkpedia-mvp.json').behaviors.source);
 verifiedChapter16FamilyGraph(bytes(review.sources.graph.path),bytes('data/arkpedia-cn-native-source.json'),bytes('data/arkpedia-cn-enemy-native-source.json'),clock);
 const nodes=Object.values(read(review.sources.graph.path).prefabs)[0].map(r=>JSON.parse(r.originalJson));
 assert.equal(nodes.find(n=>'_blockVolume'in n)._blockVolume,1);assert.ok(nodes.some(n=>n._buffs?.some(b=>b.buffKey==='enemy_field_army_self_mark')));
 assert.deepEqual(review.enemies[key].counts,{enemyAbilityWrappers:0,activeGeneralOrCommonAbilities:1});
});
test('Phantom retains one miner link, independent neutral-only melee and its source army mark',()=>{
 const{h,e,a,u,spawnMiner}=fixture(),m=spawnMiner(7.6),weaponTarget=spawnMiner(7.9);const hp=u.hp;
 h.run(.61);assert.equal(a.engagements.size,1);assert.equal(a.engagement.target,m);assert.ok(e.findBuff('enemy_field_army_self_mark'));
 assert.equal(e.profile.meleeTarget(),weaponTarget);
 const linkedHp=m.hp,before=weaponTarget.hp;e.atkCd=0;h.run(.04);
 assert.equal(before-weaponTarget.hp,250);assert.equal(m.hp,linkedHp);assert.equal(u.hp,hp);assert.deepEqual(h.b.errors,[]);
});
test('Phantom releases its owned link on distance/death and does not acquire an airborne miner',()=>{
 const{h,b,e,a,spawnMiner}=fixture(),m=spawnMiner(7.6);m.motion='FLY';h.run(.34);assert.equal(a.engagements.size,0);
 m.motion='WALK';h.run(.34);assert.equal(a.engagements.size,1);m.x=9;h.run(.34);assert.equal(a.engagements.size,0);
 m.x=7.6;h.run(.34);assert.equal(a.engagements.size,1);b.kill(e,null);assert.equal(a.engagements.size,0);assert.equal(m.mem.ch16Engagement,undefined);assert.deepEqual(b.errors,[]);
});
test('Phantom construction rejects an unreviewed canonical parameter or handbook mutation',()=>{
 for(const change of[r=>{r.talents.bb['BlockMcreep.block_mcreep_cnt']=3;},r=>{r.abilities.push({text:'Unreviewed'});}]){const r=structuredClone(records[key].levels[0]);change(r);assert.throws(()=>armyPhantom(r),/Unreviewed/);}
});
