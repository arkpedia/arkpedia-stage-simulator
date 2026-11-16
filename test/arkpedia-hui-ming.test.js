// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with{type:'json'};
import support from '../data/arkpedia-enemy-support.json' with{type:'json'};
import evidence from '../data/arkpedia-enemy-native-abilities.json' with{type:'json'};
import {nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {plainHuiMingNative,huiMingAccountNative,huiMingArcherNative,huiMingBlockeeNative} from '../shared/arkpedia/enemy-hui-ming-features.js';
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
