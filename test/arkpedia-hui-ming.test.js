// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with{type:'json'};
import support from '../data/arkpedia-enemy-support.json' with{type:'json'};
import evidence from '../data/arkpedia-enemy-native-abilities.json' with{type:'json'};
import {nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {huiMingBlast} from '../server/sim/content/arkpedia-hui-ming-blast.js';
import {installHuiMingTiles,flipHuiMingTileUnder} from '../server/sim/content/arkpedia-hui-ming-tiles.js';
import {huiMingChargedShift} from '../server/sim/content/arkpedia-hui-ming-charge.js';
import {huiMingChargerNative} from '../shared/arkpedia/enemy-hui-ming-features.js';
import {plainHuiMingNative,huiMingAccountNative,huiMingArcherNative,huiMingBlockeeNative,huiMingBlasterNative} from '../shared/arkpedia/enemy-hui-ming-features.js';
import {withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {huiMingOf,setHuiMing,switchHuiMing,huiMingAttribute} from '../server/sim/content/arkpedia-hui-ming.js';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
const ids=['enemy_1122_sphond','enemy_1122_sphond_2','enemy_1123_spsbr','enemy_1123_spsbr_2','enemy_1125_spshld','enemy_1125_spshld_2','enemy_1129_spklr','enemy_1129_spklr_2'],same='buff_yinyang[same]',diff='buff_yinyang[diff]';
function fixture({id=ids[0],compiled=true,edit=null}={}){
 const g=chessRec({id:'huiming_guard',stats:{maxHp:1e7,atk:0,def:0,res:0,blockCnt:1},skill:null});
 let source=records.enemies[id].levels[0];if(edit){source=structuredClone(source);edit(source);}
 const record=compiled?withCompiledEnemyRuntime(source):source;
 const h=makeBattle({content:'none',autoFinish:false,defs:{enemies:{[id]:record},chess:{[g.chessId]:g}},units:[{chessId:g.chessId,row:10,col:6}],kits:{[g.chessId]:()=>({trait:{noAttack:true}})},setup:installEnemyFeatures});h.b.start();
 const e=h.b.spawnEnemy(id,{pos:[10,6]}),guard=h.b.allyUnits[0],hits=[];assert.ok(guard.alive&&guard.deployed);h.run(.2);assert.equal(e.blockedBy,guard);
 h.b.on('damaged',c=>{if(c.source===e&&c.target===guard)hits.push(c.amount);});
 return{...h,e,guard,hits,atk:source.stats.atk};
}
const nextHit=h=>{const count=h.hits.length;assert.ok(h.runUntil(()=>h.hits.length>count,10));return h.hits[count];};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} vs ${b}`);
for(const id of ids)test(`${id}: the shared account passes its source gate and compiles to the shared component`,()=>{
 const r=records.enemies[id].levels[0];assert.ok(plainHuiMingNative(r,nativeComponents(evidence,id)));assert.equal(support.enemies[id].policy,'stats-attacks-and-features');
 const kinds=withCompiledEnemyRuntime(r).runtimeFeatures.entries.filter(v=>v.ability).map(v=>v.ability.kind);assert.ok(kinds.includes('huiMingAttribute'));assert.equal(kinds.includes('taunt'),id.startsWith('enemy_1125_'));
});
test('the talent starts as yang, and scales its output by the recipient attribute',()=>{
 for(const id of [ids[0],ids[3],ids[4]])for(const compiled of [false,true]){const h=fixture({id,compiled});
  assert.equal(huiMingOf(h.e),'yang');assert.ok(h.e.findBuff('buff_yang[effect]'));assert.ok(h.e.findBuff(same)&&h.e.findBuff(diff));
  near(nextHit(h),h.atk);setHuiMing(h.b,h.guard,'yang');near(nextHit(h),h.atk*.6);
  setHuiMing(h.b,h.guard,'yin');assert.equal(huiMingOf(h.guard),'yin');near(nextHit(h),h.atk*1.4);assert.deepEqual(h.b.errors,[]);}
});
test('the Fury talent multiplies a third scale against the opposite attribute only, while its own buff is attached',()=>{
 for(const id of [ids[6],ids[7]])for(const compiled of [false,true]){const h=fixture({id,compiled});assert.ok(h.e.findBuff('spklr_t'));
  near(nextHit(h),h.atk);setHuiMing(h.b,h.guard,'yang');near(nextHit(h),h.atk*.6);setHuiMing(h.b,h.guard,'yin');near(nextHit(h),h.atk*1.4*1.8);
  h.b.removeBuff(h.e,'spklr_t');near(nextHit(h),h.atk*1.4);assert.deepEqual(h.b.errors,[]);}
 const id=ids[6],r=records.enemies[id].levels[0];
 for(const edit of[n=>n.AtkUp.find(v=>v._buffs)._buffs[0].templateKey='empty',n=>n.AtkUp.find(v=>v._buffs)._buffs[0].lifeTimeType=1,n=>n.$template('enemy_spklr_t').eventToActions.ON_CALCULATE_DAMAGE[0]._succeedNodes[0]._buffKeys=['buff_yang'],
  n=>n.$template('enemy_spklr_t').eventToActions.ON_CALCULATE_DAMAGE[0]._failNodes.pop(),n=>n.$ref(n[id].find(v=>v._modes)._modes[0])._generalAbilities[0].m_PathID='5'])
  {const n=nativeComponents(structuredClone(evidence),id);edit(n);assert.equal(plainHuiMingNative(r,n),false,edit.toString());}
 const plain=nativeComponents(structuredClone(evidence),ids[0]);plain.AtkUp=[{}];assert.equal(plainHuiMingNative(records.enemies[ids[0]].levels[0],plain),false);
 const changed=structuredClone(r);changed.talents.bb['atkup.atk_scale']=-1;assert.equal(plainHuiMingNative(changed,nativeComponents(evidence,id)),false);
 assert.throws(()=>huiMingAttribute.validate({dynamic:1,same:.6,diff:1.4,sameKey:same,diffKey:diff,bonus:{key:same,scale:1.8}}),/Invalid Hui-Ming attribute talent/);
});
test('each scale needs its own attached parent buff',()=>{
 const h=fixture();setHuiMing(h.b,h.guard,'yang');h.b.removeBuff(h.e,same);near(nextHit(h),h.atk);setHuiMing(h.b,h.guard,'yin');near(nextHit(h),h.atk*1.4);
 h.b.removeBuff(h.e,diff);near(nextHit(h),h.atk);
 const foreign=fixture();foreign.b.removeBuff(foreign.e,same);foreign.b.addBuff(foreign.e,{key:same});setHuiMing(foreign.b,foreign.guard,'yang');near(nextHit(foreign),foreign.atk);
});
test('the blackboard chooses yin, yang or no attribute once, at the start',()=>{
 const yin=fixture({edit:r=>r.talents.bb['yinyang.dynamic']=0});assert.equal(huiMingOf(yin.e),'yin');assert.ok(yin.e.findBuff('buff_yin[effect]'));setHuiMing(yin.b,yin.guard,'yin');near(nextHit(yin),yin.atk*.6);
 const none=fixture({edit:r=>r.talents.bb['yinyang.dynamic']=-1});assert.equal(huiMingOf(none.e),null);setHuiMing(none.b,none.guard,'yin');near(nextHit(none),none.atk);
 assert.equal(switchHuiMing(none.b,none.e),null);assert.equal(huiMingOf(none.e),null);
});
test('starting one attribute finishes the other and leaves the transition marker; switching follows the current one',()=>{
 const h=fixture();const yang=h.e.findBuff('buff_yang');assert.equal(setHuiMing(h.b,h.e,'yang'),yang);
 switchHuiMing(h.b,h.e);assert.equal(huiMingOf(h.e),'yin');assert.equal(h.e.findBuff('buff_yang'),null);assert.equal(h.e.findBuff('buff_yang[effect]'),null);assert.ok(h.e.findBuff('buff_yang_to_yin[effect]'));
 setHuiMing(h.b,h.guard,'yin');near(nextHit(h),h.atk*.6);switchHuiMing(h.b,h.e);assert.equal(huiMingOf(h.e),'yang');assert.equal(h.e.findBuff('buff_yang_to_yin[effect]'),null);assert.ok(h.e.findBuff('buff_yin_to_yang[effect]'));near(nextHit(h),h.atk*1.4);
 h.b.removeBuff(h.e,'buff_yang');assert.equal(huiMingOf(h.e),null);assert.equal(h.e.findBuff('buff_yin_to_yang[effect]'),null);near(nextHit(h),h.atk);
 assert.throws(()=>setHuiMing(h.b,h.e,'sun'),/Invalid Hui-Ming attribute/);h.b.kill(h.e);assert.equal(setHuiMing(h.b,h.e,'yin'),null);assert.deepEqual(h.b.errors,[]);
});
test('a refused attribute start keeps the previous attribute, and the guard pair gates its taunt talent',()=>{
 const h=fixture();const off=h.b.on('beforeBuff',c=>{if(c.unit===h.e&&c.buff.key==='buff_yin')c.cancel=true;});const result=setHuiMing(h.b,h.e,'yin');h.b.off(off);
 assert.equal(result,null);assert.equal(huiMingOf(h.e),'yang');assert.ok(h.e.findBuff('buff_yang[effect]'));
 const id=ids[4],n=nativeComponents(structuredClone(evidence),id);n.Taunt.find(v=>v._buffs)._buffs[0].attributes.attributeModifiers[0].attributeType=0;assert.equal(plainHuiMingNative(records.enemies[id].levels[0],n),false);
});
test('the pair scale is per recipient: a shared packet is not rewritten and other sources are untouched',()=>{
 const h=fixture();setHuiMing(h.b,h.guard,'yin');const packet={amount:100,type:'phys'},seen=[];h.b.on('damaged',c=>seen.push(c.amount));
 h.b.dealDamage(h.e,h.guard,packet);near(seen.at(-1),140);assert.equal(packet.amount,100);
 let count=seen.length;h.b.dealDamage(h.e,h.guard,{amount:100,type:'phys',sourceless:true});assert.equal(seen.length,count+1);near(seen.at(-1),100);
 count=seen.length;h.b.dealDamage(h.guard,h.e,{amount:100,type:'true'});assert.equal(seen.length,count+1);near(seen.at(-1),100);
 
 assert.deepEqual(h.b.errors,[]);const off=h.b.on('sourceAtkScale',c=>{c.scale=-1;});count=seen.length;assert.equal(h.b.dealDamage(h.e,h.guard,{amount:100,type:'phys'}),0);h.b.off(off);assert.equal(seen.length,count);assert.match(JSON.stringify(h.b.errors),/Invalid source ATK scale/);
});
test('source gates refuse changed talents, templates, database buffs, packets and clocks',()=>{
 const yy=n=>n.YinYang.find(v=>v._buffs),root=(n,id)=>n[id].find(v=>v._modes);
 for(const id of [ids[0],ids[5],ids[7]])for(const edit of[
  n=>yy(n)._buffs.reverse(),n=>yy(n)._buffs[0].lifeTimeType=2,n=>yy(n)._buffs[1].stripBlackboardParamsWithBuffKey=0,n=>yy(n)._buffs[2].isSilenceable=1,n=>yy(n)._buffs.pop(),
  n=>n.$siblings(yy(n)).find(v=>'_applyTalentScale'in v)._applyTalentScale=1,
  n=>n.$template('buff_yinyang[init]').eventToActions.ON_BUFF_START[0]._conditionNode._valueToCompare=2,
  n=>n.$template('buff_yinyang[same]').eventToActions.ON_CALCULATE_DAMAGE[0]._succeedNodes[0]._buffKeys=['buff_yin'],
  n=>n.$template('buff_yinyang[diff]').eventToActions.ON_CALCULATE_DAMAGE[1]._succeedNodes[1]._applyWay='MELEE',
  n=>n.$template('buff_yinyang[diff]').eventToActions.ON_CALCULATE_DAMAGE[0]._succeedNodes[1]._cancelIfAtkScaleZero=true,
  n=>n.$template('buff_yin').eventToActions.ON_BUFF_START[0]._failNodes.shift(),
  n=>n.$template('buff_yang').eventToActions.ON_BUFF_START[0]._succeedNodes[0]._buffKey='other',
  n=>n.$buff('buff_yin').lifeTimeType='LIMITED',n=>n.$buff('buff_yang').templateKey='buff_yin',
  (n,id)=>root(n,id)._commonAbilities.push({m_FileID:0,m_PathID:'1'}),(n,id)=>root(n,id)._blockVolume=2,
  (n,id)=>n.$ref(n.$ref(root(n,id)._modes[0])._combat)._damageType=2,(n,id)=>n.$ref(n.$ref(root(n,id)._modes[0])._combat)._atkScale=2,
  (n,id)=>n.$ref(root(n,id)._modes[0])._generalAbilities.push({m_FileID:0,m_PathID:'1'}),
 ]){const n=nativeComponents(structuredClone(evidence),id);assert.ok(huiMingAccountNative(n));edit(n,id);assert.equal(plainHuiMingNative(records.enemies[id].levels[0],n),false,edit.toString());}
 for(const change of[r=>r.talents.bb['yinyang.dynamic']=2,r=>r.talents.bb['yinyang.buff_yinyang[same].atk_scale']=-1,r=>delete r.talents.bb['yinyang.buff_yinyang[diff].atk_scale'],r=>r.talents.groups.extra=['x'],r=>r.abilities.push({text:'x',format:'NORMAL'}),r=>r.applyWay='RANGED',r=>r.level=1]){
  const r=structuredClone(records.enemies[ids[0]].levels[0]);change(r);assert.equal(plainHuiMingNative(r,nativeComponents(evidence,ids[0])),false);}
});
test('runtime parameters are validated before any buff attaches',()=>{
 const ok={dynamic:1,same:.6,diff:1.4,sameKey:same,diffKey:diff};huiMingAttribute.validate(ok);
 for(const bad of[{dynamic:2},{same:-1},{diff:Infinity},{sameKey:'buff_yin'},{diffKey:same},{sameKey:''}])assert.throws(()=>huiMingAttribute.validate({...ok,...bad}),/Invalid Hui-Ming attribute talent/);
});

// 'Stabby' and 'Blindey'
const archers=['enemy_1124_spbow','enemy_1124_spbow_2'],blockees=['enemy_1127_sptrkg','enemy_1127_sptrkg_2'];
function field(id,{compiled=true,guards=[[10,6]],pos=[10,5],hold=true}={}){
 const g=chessRec({id:'huiming_pair_guard',stats:{maxHp:1e7,atk:0,def:0,res:0,blockCnt:1},skill:null});
 const record=compiled?withCompiledEnemyRuntime(records.enemies[id].levels[0]):records.enemies[id].levels[0];
 const h=makeBattle({content:'none',autoFinish:false,defs:{enemies:{[id]:record},chess:{[g.chessId]:g}},units:guards.map(([row,col])=>({chessId:g.chessId,row,col})),kits:{[g.chessId]:()=>({trait:{noAttack:true}})},setup:installEnemyFeatures});h.b.start();
 const e=h.b.spawnEnemy(id,{pos}),units=h.b.allyUnits,hits=[];assert.equal(units.length,guards.length);if(hold)h.b.addBuff(e,{key:'hold',flags:{noMove:true}});
 h.b.on('damaged',c=>{if(c.source===e)hits.push({target:units.indexOf(c.target),amount:c.amount});});
 const next=()=>{const count=hits.length;assert.ok(h.runUntil(()=>hits.length>count,10));return hits[count];};
 return{...h,e,units,hits,next,atk:record.stats.atk};
}
for(const id of archers)test(`${id}: an ordinary direct ranged hit that prefers the opposite attribute over deployment order and taunt`,()=>{
 const r=records.enemies[id].levels[0];assert.ok(huiMingArcherNative(r,nativeComponents(evidence,id)));assert.equal(support.enemies[id].policy,'stats-attacks-and-features');
 for(const compiled of [false,true]){const h=field(id,{compiled,guards:[[10,7],[11,6]]}),[first,second]=h.units;assert.equal(huiMingOf(h.e),'yang');
  const plain=h.next();assert.equal(h.b.projectiles.list.length,0);near(plain.amount,h.atk);const preferred=plain.target,other=1-preferred;
  setHuiMing(h.b,h.units[other],'yin');let hit=h.next();assert.equal(hit.target,other);near(hit.amount,h.atk*1.4);
  h.b.addBuff(h.units[preferred],{key:'test:taunt',mods:{taunt:1}});setHuiMing(h.b,h.units[preferred],'yang');hit=h.next();assert.equal(hit.target,other);
  switchHuiMing(h.b,h.e);hit=h.next();assert.equal(hit.target,preferred);near(hit.amount,h.atk*1.4);
  h.b.removeBuff(h.e,'buff_yin');hit=h.next();assert.equal(hit.target,preferred);near(hit.amount,h.atk);assert.ok(first&&second);assert.deepEqual(h.b.errors,[]);}
});
for(const id of blockees)test(`${id}: only a blocker of the same attribute admits and keeps the block`,()=>{
 const r=records.enemies[id].levels[0];assert.ok(huiMingBlockeeNative(r,nativeComponents(evidence,id)));assert.equal(support.enemies[id].policy,'stats-attacks-and-features');
 assert.deepEqual(withCompiledEnemyRuntime(r).runtimeFeatures.entries.filter(v=>v.ability).map(v=>v.ability.kind).sort(),['huiMingAttribute','pairedBlockerBuffs']);
 for(const compiled of [false,true]){
  const h=field(id,{compiled,pos:[10,6],hold:false}),guard=h.units[0];h.run(.5);assert.equal(h.e.blockedBy,null);
  h.b.addBuff(h.e,{key:'hold',flags:{noMove:true}});h.e.x=6;h.e.y=10;setHuiMing(h.b,guard,'yin');h.run(.3);assert.equal(h.e.blockedBy,null);
  setHuiMing(h.b,guard,'yang');h.run(.2);assert.equal(h.e.blockedBy,guard);assert.ok(guard.findBuff('enemy_sptrkg_t'));near(h.next().amount,h.atk*.6);
  setHuiMing(h.b,guard,'yin');h.run(.25);assert.equal(h.e.blockedBy,null);assert.equal(guard.findBuff('enemy_sptrkg_t'),null);
  switchHuiMing(h.b,h.e);h.run(.2);assert.equal(h.e.blockedBy,guard);h.b.removeBuff(guard,'buff_yin');h.run(.25);assert.equal(h.e.blockedBy,null);
  setHuiMing(h.b,guard,'yin');h.run(.2);assert.equal(h.e.blockedBy,guard);h.b.removeBuff(h.e,'buff_yin');h.run(.25);assert.equal(h.e.blockedBy,null);
  setHuiMing(h.b,h.e,'yin');h.run(.2);assert.equal(h.e.blockedBy,guard);h.b.kill(h.e);assert.equal(guard.findBuff('enemy_sptrkg_t'),null);assert.deepEqual(h.b.errors,[]);}
});
test('archer and blockee gates refuse changed selectors, packets, block conditions, checkers and release logic',()=>{
 const root=(n,id)=>n[id].find(v=>v._modes),mode=(n,id)=>n.$ref(root(n,id)._modes[0]);
 for(const id of archers)for(const edit of[
  n=>n.$siblings(n.$ref(mode(n,id)._attackTrigger)).find(c=>'_buffKeyPairs'in c)._buffKeyPairs.pop(),
  n=>n.$siblings(n.$ref(mode(n,id)._attackTrigger)).find(c=>'_buffKeyPairs'in c)._sortByTauntAtLast=0,
  n=>n.$siblings(n.$ref(mode(n,id)._attackTrigger)).find(c=>'_buffKeyPairs'in c)._targetMotion=1,
  n=>n.$siblings(n.$ref(mode(n,id)._attackTrigger)).find(c=>'m_Radius'in c).m_Radius=3,
  n=>n.$ref(mode(n,id)._attack)._damageType=2,n=>n.$ref(mode(n,id)._attack)._upAnimKey='',n=>root(n,id)._blockVolume=2,n=>n.YinYang.find(v=>v._buffs)._buffs.pop(),
 ]){const n=nativeComponents(structuredClone(evidence),id);edit(n);assert.equal(huiMingArcherNative(records.enemies[id].levels[0],n),false,edit.toString());}
 for(const id of blockees)for(const edit of[
  n=>root(n,id)._specialBlockCondition._buffKeyPairs.pop(),n=>root(n,id)._specialBlockCondition._type=0,n=>root(n,id)._specialBlockCondition._buffKeyPairs[0].blockerBuffKey='buff_yang',
  n=>n.$ref(n.$ref(mode(n,id)._generalAbilities[0])._checker)._blockMinCnt=0,n=>n.$ref(n.$ref(mode(n,id)._generalAbilities[0])._checker)._buffsToBlockee[0].blackboard[0].value=.5,
  n=>n.$ref(n.$ref(mode(n,id)._generalAbilities[0])._checker)._buffsToBlockee[0].waitFirstTriggerInterval=0,n=>n.$ref(mode(n,id)._generalAbilities[0])._isInverseToggle=1,
  n=>n.$ref(root(n,id)._commonAbilities[0])._buffs[0].templateKey='log_killed',n=>n.$template('enemy_sptrkg_t').eventToActions.ON_BUFF_TRIGGER[0]._failNodes[0]._failNodes=[],
  n=>n.$template('enemy_sptrkg_t').eventToActions.ON_BUFF_TRIGGER[0]._succeedNodes.splice(1,1),n=>n.$ref(mode(n,id)._combat)._atkScale=2,
 ]){const n=nativeComponents(structuredClone(evidence),id);edit(n);assert.equal(huiMingBlockeeNative(records.enemies[id].levels[0],n),false,edit.toString());}
 for(const [id,gate] of [[archers[0],huiMingArcherNative],[blockees[0],huiMingBlockeeNative]])for(const change of[r=>r.abilities=[],r=>r.stats.rangeRadius=9,r=>r.talents.groups.taunt=['taunt_level'],r=>r.applyWay='NONE'])
  {const r=structuredClone(records.enemies[id].levels[0]);change(r);if(id===blockees[0]&&change.toString().includes('rangeRadius'))continue;assert.equal(gate(r,nativeComponents(evidence,id)),false,change.toString());}
});

// 'Smarty'
const blasters=['enemy_1126_spslme','enemy_1126_spslme_2'];
function blastField(id,{compiled=true,guards=[[10,6]],count=1}={}){
 const g=chessRec({id:'huiming_blast_guard',stats:{maxHp:1e7,atk:0,def:0,res:0,blockCnt:1},skill:null});
 const record=compiled?withCompiledEnemyRuntime(records.enemies[id].levels[0]):records.enemies[id].levels[0];
 const h=makeBattle({content:'none',autoFinish:false,defs:{enemies:{[id]:record},chess:{[g.chessId]:g}},units:guards.map(([row,col])=>({chessId:g.chessId,row,col})),kits:{[g.chessId]:()=>({trait:{noAttack:true}})},setup:installEnemyFeatures});h.b.start();
 const units=h.b.allyUnits,hits=[];assert.equal(units.length,guards.length);assert.ok(units.every(u=>u.alive&&u.deployed));
 const spawn=(x,y=10)=>{const e=h.b.spawnEnemy(id,{pos:[y,Math.round(x)]});h.b.addBuff(e,{key:'hold',flags:{noMove:true}});e.x=x;e.y=y;return e;};
 h.b.on('damaged',c=>{if(c.dmg.tags.includes('huiMingBlast'))hits.push({target:units.indexOf(c.target),amount:c.amount,type:c.dmg.type,time:h.b.time,source:c.source});});
 return{...h,units,hits,spawn,atk:record.stats.atk,bb:record.talents.bb,enemies:Array.from({length:count},(_,i)=>spawn(6+i*5))};
}
for(const id of blasters)test(`${id}: death blasts scale by the recipient attribute and skip the account's own output scales`,()=>{
 const r=records.enemies[id].levels[0];assert.ok(huiMingBlasterNative(r,nativeComponents(evidence,id)));assert.equal(support.enemies[id].policy,'stats-attacks-and-features');
 assert.deepEqual(withCompiledEnemyRuntime(r).runtimeFeatures.entries.filter(v=>v.ability).map(v=>v.ability.kind).sort(),['huiMingAttribute','huiMingBlast']);
 for(const compiled of [false,true]){
  // Guards: no attribute, the blaster's attribute, the opposite, one outside 1.25 and one flying inside.
  const h=blastField(id,{compiled,guards:[[10,7],[11,6],[9,6],[10,8],[10,5]]}),[e]=h.enemies,[plain,alike,opposite,far,flying]=h.units;
  setHuiMing(h.b,alike,'yang');setHuiMing(h.b,opposite,'yin');setHuiMing(h.b,far,'yin');flying.motion='FLY';
  const t0=h.b.time;h.b.kill(e);assert.equal(h.hits.length,0);h.run(.15);assert.equal(h.hits.length,0);h.run(.1);
  const by=Object.fromEntries(h.hits.map(v=>[v.target,v]));assert.deepEqual(Object.keys(by).sort(),['0','1','2']);
  near(by[0].amount,h.atk*h.bb['boom.atk_scale']);near(by[1].amount,h.atk*3.6);near(by[2].amount,h.atk*4.4);assert.ok(h.hits.every(v=>v.type==='arts'&&Math.abs(v.time-t0-.2)<h.b.dt*2));
  assert.equal(e.mem.huiMingBlastMode,2);h.run(1);assert.equal(h.hits.length,3);assert.deepEqual(h.b.errors,[]);}
});
test('no blast without an attribute, when silenced, without the death talent buff, or on an exit',()=>{
 const id=blasters[0];
 for(const prepare of[h=>h.b.removeBuff(h.enemies[0],'buff_yang'),h=>{h.b.addBuff(h.enemies[0],{key:'test:silence',flags:{silence:true}});assert.ok(h.enemies[0].s.flags.silence);},h=>h.b.removeBuff(h.enemies[0],'spslme_t[default_boom]'),null]){
  const h=blastField(id,{guards:[[10,7]]});if(prepare){prepare(h);h.b.kill(h.enemies[0]);}else h.b.leak(h.enemies[0]);h.run(.5);assert.equal(h.hits.length,0);assert.deepEqual(h.b.errors,[]);}
 const yin=blastField(id,{guards:[[10,7]]});switchHuiMing(yin.b,yin.enemies[0]);setHuiMing(yin.b,yin.units[0],'yin');yin.b.kill(yin.enemies[0]);yin.run(.3);near(yin.hits[0].amount,yin.atk*3.6);assert.equal(yin.enemies[0].mem.huiMingBlastMode,1);
});
for(const id of blasters)test(`${id}: opposite-attribute neighbours warn inside 1.5 and set each other off inside the trigger radius`,()=>{
 for(const compiled of [false,true]){
  const h=blastField(id,{compiled,guards:[[10,6],[11,7]],count:0}),a=h.spawn(6.2),b=h.spawn(7.6),[plain,second]=h.units,radius=id.endsWith('_2')?.8:1;
  h.run(.3);assert.equal(a.findBuff('spslme_t[mark]'),null);assert.ok(a.findBuff('spslme_t')&&b.findBuff('spslme_t'));
  switchHuiMing(h.b,b);h.run(.2);assert.ok(a.findBuff('spslme_t[mark]')&&b.findBuff('spslme_t[mark]'));assert.ok(a.alive&&b.alive);
  b.x=8;h.run(.2);assert.equal(a.findBuff('spslme_t[mark]'),null);assert.equal(b.findBuff('spslme_t[mark]'),null);
  b.x=6.2+radius+.05;h.run(.3);assert.ok(a.alive&&b.alive&&a.findBuff('spslme_t[mark]'));assert.equal(a.findBuff('spslme_t[boom]'),null);
  setHuiMing(h.b,second,'yin');b.x=6.2+radius-.05;const t0=h.b.time;assert.ok(h.runUntil(()=>!!a.findBuff('spslme_t[boom]')||!a.alive,.2));const started=h.b.time;
  assert.ok(started-t0<=.09+h.b.dt*2);assert.ok(a.alive&&b.alive);assert.equal(a.mem.huiMingBlastMode,4);assert.equal(b.mem.huiMingBlastMode,3);
  h.run(.1+h.b.dt*2);assert.ok(!a.alive&&!b.alive);h.run(.2);
  // Both large blasts land 0.2 s after release; no small death blast follows.
  const large=key=>h.atk*h.bb[key];const hitsOn=i=>h.hits.filter(v=>v.target===i).map(v=>Math.round(v.amount)).sort((x,y)=>x-y);
  assert.deepEqual(hitsOn(0),[large('boom.atk_scale_2'),large('boom.atk_scale_2')].map(Math.round));
  assert.deepEqual(hitsOn(1),[large('boomtosame.atk_scale_2'),large('boomtodiff.atk_scale_2')].map(Math.round).sort((x,y)=>x-y));
  assert.ok(h.hits.every(v=>Math.abs(v.time-started-.2)<h.b.dt*3));assert.equal(h.hits.length,4);h.run(1);assert.equal(h.hits.length,4);assert.deepEqual(h.b.errors,[]);}
});
test('a blast reaches a stealthed ground ally but not a target-free one, and the two trigger radii differ in a mixed pair',()=>{
 const h=blastField(blasters[0],{guards:[[10,7],[11,6]]}),[hidden,free]=h.units;h.b.addBuff(hidden,{key:'test:stealth',flags:{stealth:true}});h.b.addBuff(free,{key:'test:free',flags:{targetFree:true}});
 h.b.kill(h.enemies[0]);h.run(.3);assert.deepEqual(h.hits.map(v=>v.target),[0]);
 const g=chessRec({id:'huiming_mixed_guard',stats:{maxHp:1e7,atk:0,def:0,res:0,blockCnt:1},skill:null}),defs=Object.fromEntries(blasters.map(id=>[id,withCompiledEnemyRuntime(records.enemies[id].levels[0])]));
 const m=makeBattle({content:'none',autoFinish:false,defs:{enemies:defs,chess:{[g.chessId]:g}},units:[{chessId:g.chessId,row:11,col:6}],kits:{[g.chessId]:()=>({trait:{noAttack:true}})},setup:installEnemyFeatures});m.b.start();
 const place=(id,x)=>{const e=m.b.spawnEnemy(id,{pos:[10,Math.round(x)]});m.b.addBuff(e,{key:'hold',flags:{noMove:true}});e.x=x;e.y=10;return e;};
 const normal=place(blasters[0],6),elite=place(blasters[1],6.9);switchHuiMing(m.b,elite);m.run(.5);
 // 0.9 apart: inside the normal body's radius 1, outside the elite's 0.8. Only the elite is set off.
 assert.equal(elite.alive,false);assert.equal(normal.alive,true);assert.equal(normal.findBuff('spslme_t[boom]'),null);assert.deepEqual(m.b.errors,[]);
});
test('the mode order is gated by name',()=>{
 for(const id of blasters){const n=nativeComponents(structuredClone(evidence),id),modes=n[id].find(v=>v._modes)._modes;[modes[1],modes[3]]=[modes[3],modes[1]];assert.equal(huiMingBlasterNative(records.enemies[id].levels[0],n),false);}
});
test('same-attribute neighbours, silenced blasters and other families do not chain',()=>{
 const id=blasters[0],h=blastField(id,{guards:[[10,7]],count:0}),a=h.spawn(6),b=h.spawn(6.5);h.run(.5);assert.ok(a.alive&&b.alive);assert.equal(a.findBuff('spslme_t[mark]'),null);
 h.b.removeBuff(b,'spslme_t');switchHuiMing(h.b,b);h.run(.3);assert.ok(a.alive&&b.alive);
 const quiet=blastField(id,{guards:[[10,7]],count:0}),c=quiet.spawn(6),d=quiet.spawn(6.5);quiet.b.addBuff(c,{key:'test:silence',flags:{silence:true}});switchHuiMing(quiet.b,d);quiet.run(.6);
 assert.ok(!c.alive&&!d.alive);assert.ok(quiet.hits.length>0&&quiet.hits.every(v=>v.source===d));assert.deepEqual(quiet.b.errors,[]);
});
test("a Smarty is blocked only by a blocker of its own attribute and its Arts melee keeps the account's scales",()=>{
 const id=blasters[0],g=chessRec({id:'huiming_blast_blocker',stats:{maxHp:1e7,atk:0,def:0,res:0,blockCnt:1},skill:null}),record=records.enemies[id].levels[0];
 const h=makeBattle({content:'none',autoFinish:false,defs:{enemies:{[id]:record},chess:{[g.chessId]:g}},units:[{chessId:g.chessId,row:10,col:6}],kits:{[g.chessId]:()=>({trait:{noAttack:true}})},setup:installEnemyFeatures});h.b.start();
 const e=h.b.spawnEnemy(id,{pos:[10,6]}),guard=h.b.allyUnits[0],hits=[];h.b.addBuff(e,{key:'hold',flags:{noMove:true}});h.b.on('damaged',c=>{if(c.source===e)hits.push(c);});
 h.run(.3);assert.equal(e.blockedBy,null);setHuiMing(h.b,guard,'yin');h.run(.3);assert.equal(e.blockedBy,null);setHuiMing(h.b,guard,'yang');h.run(.2);assert.equal(e.blockedBy,guard);
 assert.ok(h.runUntil(()=>hits.length>0,8));assert.equal(hits[0].dmg.type,'arts');near(hits[0].amount,record.stats.atk*.6);
 setHuiMing(h.b,guard,'yin');h.run(.5);assert.equal(e.blockedBy,guard);assert.deepEqual(h.b.errors,[]);
});
test('blaster gates and parameters refuse changed blasts, auras, templates, projectiles and scales',()=>{
 for(const id of blasters)for(const edit of[
  n=>n.Boom.find(v=>'_projectileActions'in v)._buffs[0].blackboard[0].valueStr='projectile_enemy_spslme',
  n=>{const c=n.BoomToSame.find(v=>'_projectileActions'in v);c._projectileActions.SerializedState=c._projectileActions.SerializedState.replace('"_emitSourceOnCalculateDamage":false','"_emitSourceOnCalculateDamage":true');},
  n=>{const c=n.BoomToDiff.find(v=>'_projectileActions'in v);c._projectileActions.SerializedState=c._projectileActions.SerializedState.replace('MAGICAL','PHYSICAL');},
  n=>n.BoomToDiff.pop(),n=>n.Boom.find(v=>v.m_Script.m_PathID==='3800760148018415462')._buffs[0].templateKey='empty',
  n=>n.$siblings(n.BoomTrigger.find(v=>v._buffs)).find(v=>'m_Radius'in v).m_Radius=3,n=>n.$siblings(n.BoomHint.find(v=>v._buffs)).find(v=>'m_Radius'in v).m_Radius=1,
  n=>n.$ref(n.BoomTrigger.find(v=>v._buffs)._targetValidator)._buffs=[],n=>n.$ref(n.BoomHint.find(v=>v._buffs)._targetValidator)._targetOptions.targetSide=2,
  n=>n.BoomTrigger.find(v=>v._buffs)._buffs[0].triggerInterval=1,n=>n.BoomHint.find(v=>v._buffs)._passiveBuffs=[],
  n=>n.$template('enemy_spslme_t[boom]').eventToActions.ON_BUFF_TRIGGER=[],n=>n.$template('enemy_spslme_t[default_boom]').eventToActions.ON_OWNER_KILLED[0]._succeedNodes[0]._modeIndex=3,
  n=>n.$template('enemy_spslme_t[to_boom]').eventToActions.ON_BUFF_TRIGGER[0]._succeedNodes[0]._succeedNodes[2]._buff.triggerInterval=1,
  n=>n.$template('projectile_on_buff_start').eventToActions.ON_BUFF_START.shift(),n=>n.$template('enemy_spslme_t[detect]').eventToActions.ON_BUFF_TRIGGER[0]._conditionNode._buffKeys=['buff_yang'],
  (n,id)=>n[id].find(v=>v._modes)._modes.pop(),(n,id)=>n[id].find(v=>v._modes)._specialBlockCondition._type=0,(n,id)=>n.$ref(n.$ref(n[id].find(v=>v._modes)._modes[3])._combat)._damageType=1,
 ]){const n=nativeComponents(structuredClone(evidence),id);edit(n,id);assert.equal(huiMingBlasterNative(records.enemies[id].levels[0],n),false,edit.toString());}
 for(const key of ['projectile_enemy_spslme','projectile_enemy_spslme_s_1'])for(const edit of[p=>p.find(c=>'m_Radius'in c).m_Radius=5,p=>p.find(c=>'_lifeTime'in c)._lifeTime=1,p=>p.find(c=>'_targetOptions'in c)._targetOptions.targetMotion=3]){
  const copy=structuredClone(evidence);const parts=copy.projectiles[key].map(row=>JSON.parse(row.originalJson));edit(parts);copy.projectiles[key].forEach((row,i)=>row.originalJson=JSON.stringify(parts[i]));
  assert.equal(huiMingBlasterNative(records.enemies[blasters[0]].levels[0],nativeComponents(copy,blasters[0])),false);}
 for(const change of[r=>r.talents.bb['boom.atk_scale_2']=-1,r=>delete r.talents.groups.boomtodiff,r=>r.stats.dmgType='phys',r=>r.abilities.pop()]){const r=structuredClone(records.enemies[blasters[0]].levels[0]);change(r);assert.equal(huiMingBlasterNative(r,nativeComponents(evidence,blasters[0])),false);}
 const ok=withCompiledEnemyRuntime(records.enemies[blasters[0]].levels[0]).runtimeFeatures.entries.find(v=>v.ability?.kind==='huiMingBlast').ability.params;huiMingBlast.validate(ok);
 for(const bad of[{interval:0},{triggerRadius:2},{warnKey:ok.markerKey},{blockPairs:[]},{small:{...ok.small,radius:0}},{large:{radius:2,none:1,same:1}}])assert.throws(()=>huiMingBlast.validate({...ok,...bad}),/Invalid Hui-Ming blast talent/);
});

// Hui-Ming tiles and 'Envy'
const chargers=['enemy_1128_spmage','enemy_1128_spmage_2'];
function tileField(id,{compiled=true,guards=[[10,6]],pos=[10,5],marks=[{row:10,col:6,mode:0,same:.6,diff:1.4}],switches=[]}={}){
 const g=chessRec({id:'huiming_tile_guard',stats:{maxHp:1e7,atk:0,def:0,res:0,blockCnt:0},skill:null});
 const record=compiled?withCompiledEnemyRuntime(records.enemies[id].levels[0]):records.enemies[id].levels[0];
 const h=makeBattle({content:'none',autoFinish:false,defs:{enemies:{[id]:record},chess:{[g.chessId]:g}},units:guards.map(([row,col])=>({chessId:g.chessId,row,col})),kits:{[g.chessId]:()=>({trait:{noAttack:true}})},setup:installEnemyFeatures});h.b.start();
 const tiles=marks.length||switches.length?installHuiMingTiles(h.b,{marks,switches}):null,units=h.b.allyUnits,hits=[];assert.ok(units.every(u=>u.alive&&u.deployed));
 const e=h.b.spawnEnemy(id,{pos});h.b.addBuff(e,{key:'hold',flags:{noMove:true}});
 h.b.on('damaged',c=>{if(c.source===e)hits.push({target:units.indexOf(c.target),amount:c.amount,type:c.dmg.type,time:h.b.time});});
 return{...h,e,units,hits,tiles,atk:record.stats.atk};
}
test('a mark tile gives its occupant the tile attribute, both output scales and one log entry; flipping swaps the attribute',()=>{
 const h=tileField(ids[0],{guards:[[10,6],[11,6]],pos:[10,8]}),[on,off]=h.units;h.run(.15);
 assert.equal(huiMingOf(on),'yin');assert.equal(huiMingOf(off),null);assert.ok(on.findBuff(same)&&on.findBuff(diff));assert.equal(h.b.stageOutcomes.counters.locate_on_tile_yinyang,1);
 const dealt=[];h.b.on('damaged',c=>{if(c.source===on)dealt.push(c.amount);});const strike=()=>{h.b.dealDamage(on,h.e,{amount:100,type:'true'});return dealt.at(-1);};
 near(strike(),140);assert.equal(h.tiles.modeAt(10,6),0);assert.equal(h.tiles.flip(10,6),1);assert.equal(huiMingOf(on),'yang');assert.ok(on.findBuff('buff_yin_to_yang[effect]'));near(strike(),60);
 assert.equal(flipHuiMingTileUnder(h.b,off),null);assert.equal(flipHuiMingTileUnder(h.b,on),0);assert.equal(huiMingOf(on),'yin');h.b.removeBuff(on,same);near(strike(),140);h.b.removeBuff(on,diff);near(strike(),100);
 h.b.removeBuff(on,'buff_yin');h.run(.15);assert.equal(huiMingOf(on),'yin');h.run(1);assert.equal(h.b.stageOutcomes.counters.locate_on_tile_yinyang,1);assert.deepEqual(h.tiles.resultTiles(),[{row:10,col:6,mode:0}]);assert.deepEqual(h.b.errors,[]);
});
test('a switch tile swaps a ground enemy once per entry and leaves an enemy without an attribute alone',()=>{
 const h=tileField(ids[0],{guards:[[11,8]],pos:[10,4],marks:[],switches:[{row:10,col:6}]});h.run(.2);assert.equal(huiMingOf(h.e),'yang');
 h.e.x=6;h.run(.15);assert.equal(huiMingOf(h.e),'yin');h.run(.5);assert.equal(huiMingOf(h.e),'yin');h.e.x=7;h.run(.15);assert.equal(huiMingOf(h.e),'yin');h.e.x=6;h.run(.15);assert.equal(huiMingOf(h.e),'yang');
 h.e.x=4;h.run(.15);h.b.removeBuff(h.e,'buff_yang');h.e.x=6;h.run(.15);assert.equal(huiMingOf(h.e),null);assert.deepEqual(h.b.errors,[]);
});
test('tile installation validates its cells and installs once',()=>{
 const h=tileField(ids[0]);assert.throws(()=>installHuiMingTiles(h.b,{marks:[{row:1,col:1,mode:0,same:.6,diff:1.4}]}),/already installed/);
 for(const bad of[{marks:[]},{marks:[{row:1,col:1,mode:2,same:.6,diff:1.4}]},{marks:[{row:1,col:1,mode:0,same:-1,diff:1.4}]},{marks:[{row:1,col:1,mode:0,same:.6,diff:1.4}],switches:[{row:1,col:1}]},{switches:[{row:-1,col:1}]},{switches:[{row:1,col:1}],interval:0}])
  assert.throws(()=>installHuiMingTiles.validate({marks:[],switches:[],interval:.1,logKey:'k',...bad}),/Invalid Hui-Ming tiles/);
 h.tiles.uninstall();assert.equal(h.b.stageHuiMing,null);
});
for(const id of chargers)test(`${id}: ordinary Arts shots, and a charged shot that flips the mark tile under an ally standing on one`,()=>{
 const r=records.enemies[id].levels[0];assert.ok(huiMingChargerNative(r,nativeComponents(evidence,id)));assert.equal(support.enemies[id].policy,'stats-attacks-and-features');assert.equal(support.enemies[id].native[id].claimedWrappers,1);
 assert.deepEqual(withCompiledEnemyRuntime(r).runtimeFeatures.entries.filter(v=>v.ability).map(v=>v.ability.kind).sort(),['huiMingAttribute','huiMingChargedShift']);
 for(const compiled of [false,true]){
  const h=tileField(id,{compiled,guards:[[10,6],[11,5]]}),[on]=h.units;h.run(9.9);assert.ok(h.hits.length>0&&h.hits.every(v=>v.type==='arts'));assert.equal(huiMingOf(on),'yin');
  // Ordinary shots against a yin occupant use the opposite scale; the other guard holds no attribute.
  assert.ok(h.hits.every(v=>Math.abs(v.amount-h.atk*(v.target===0?1.4:1))<1e-6));
  assert.ok(h.runUntil(()=>h.e.mem.regularFormVisual?.clip==='Skill',1));const started=h.b.time;assert.ok(Math.abs(started-10)<.2);near(h.e.mem.regularFormVisual.speed,(95/30)/5);
  const before=h.hits.length;assert.ok(h.runUntil(()=>h.tiles.modeAt(10,6)===1,5));const landed=h.b.time,release=64/30*5/(95/30);
  assert.ok(landed-started>=release-h.b.dt&&landed-started<=release+.3);const shot=h.hits[before];assert.equal(shot.target,0);near(shot.amount,h.atk*2*1.4);assert.equal(h.hits.length,before+1);
  assert.equal(huiMingOf(on),'yang');h.run(started+5-h.b.time+.1);assert.notEqual(h.e.mem.regularFormVisual?.clip,'Skill');
  const count=h.hits.length;assert.ok(h.runUntil(()=>h.hits.length>count,6));assert.ok(Math.abs(h.hits[count].amount-h.atk*(h.hits[count].target===0?.6:1))<1e-6);
  // The sixty-second cooldown runs from the cast start: no second charge follows within the harness's battle clock.
  h.run(30);assert.equal(h.tiles.modeAt(10,6),1);assert.notEqual(h.e.mem.regularFormVisual?.clip,'Skill');assert.deepEqual(h.b.errors,[]);}
});
test('the charge needs an ally on a mark tile, and an interrupted charge releases nothing',()=>{
 const none=tileField(chargers[0],{marks:[],switches:[{row:9,col:9}]});none.run(20);assert.ok(none.hits.length>0);assert.ok(none.hits.every(v=>Math.abs(v.amount-none.atk)<1e-6));
 const h=tileField(chargers[0]);h.run(10.5);assert.equal(h.e.mem.regularFormVisual?.clip,'Skill');const count=h.hits.length;h.b.applyStatus(h.e,'stun',{duration:1});assert.equal(h.e.mem.regularFormVisual,null);
 h.run(8);assert.equal(h.tiles.modeAt(10,6),0);assert.ok(h.hits.slice(count).every(v=>Math.abs(v.amount-h.atk*1.4)<1e-6));assert.deepEqual(h.b.errors,[]);
});
test('charger gates and parameters refuse changed skills, selectors, hit actions, projectiles and clocks',()=>{
 for(const id of chargers)for(const edit of[
  n=>n.ChargeAttack.find(v=>'_familyMask'in v)._ignoreSilence=1,
  n=>{const c=n.$siblings(n.ChargeAttack.find(v=>'_familyMask'in v)).find(v=>'_actions'in v);c._actions.SerializedState=c._actions.SerializedState.replace('FLIP_BOOL','SET_TRUE');},
  n=>{const c=n.$siblings(n.ChargeAttack.find(v=>'_familyMask'in v)).find(v=>'_actions'in v);c._actions.SerializedState=c._actions.SerializedState.replace('"_useOwnerRootTile":false','"_useOwnerRootTile":true');},
  n=>n.$siblings(n.ChargeAttack.find(v=>'_familyMask'in v)).find(v=>'_actions'in v)._timeMode=0,
  n=>n.$siblings(n.ChargeAttack.find(v=>'_familyMask'in v)).find(v=>'_actions'in v)._projectileKey='projectile_enemy_spmage',
  n=>n.$siblings(n.$ref(n.ChargeAttack.find(v=>'_familyMask'in v)._trigger)).find(v=>'_buffKey'in v)._buffKey='',
  n=>n.$siblings(n.$ref(n.ChargeAttack.find(v=>'_familyMask'in v)._trigger)).find(v=>'m_Radius'in v).m_Radius=5,
  (n,id)=>n.$ref(n.$ref(n[id].find(v=>v._modes)._modes[0])._attack)._damageType=1,(n,id)=>n[id].find(v=>v._modes)._commonAbilities.push({m_FileID:0,m_PathID:'1'}),
 ]){const n=nativeComponents(structuredClone(evidence),id);edit(n,id);assert.equal(huiMingChargerNative(records.enemies[id].levels[0],n),false,edit.toString());}
 for(const change of[r=>r.skills[0].cooldown=30,r=>r.skills[0].bb.duration=3,r=>r.skills.push(r.skills[0]),r=>r.stats.rangeRadius=3,r=>r.abilities=[]]){const r=structuredClone(records.enemies[chargers[0]].levels[0]);change(r);assert.equal(huiMingChargerNative(r,nativeComponents(evidence,chargers[0])),false);}
 const copy=structuredClone(evidence);const parts=copy.projectiles.projectile_enemy_spmage_s.map(row=>JSON.parse(row.originalJson));parts.find(c=>'m_Size'in c).m_Size.x=3;copy.projectiles.projectile_enemy_spmage_s.forEach((row,i)=>row.originalJson=JSON.stringify(parts[i]));
 assert.equal(huiMingChargerNative(records.enemies[chargers[0]].levels[0],nativeComponents(copy,chargers[0])),false);
 const ok=withCompiledEnemyRuntime(records.enemies[chargers[0]].levels[0]).runtimeFeatures.entries.find(v=>v.ability?.kind==='huiMingChargedShift').ability.params;huiMingChargedShift.validate(ok);
 for(const bad of[{charge:{...ok.charge,release:9}},{charge:{...ok.charge,requiredBuff:''}},{charge:{...ok.charge,cooldown:0}},{attack:{...ok.attack,noAir:false}}])assert.throws(()=>huiMingChargedShift.validate({...ok,...bad}),/Invalid Hui-Ming charged shift/);
});
