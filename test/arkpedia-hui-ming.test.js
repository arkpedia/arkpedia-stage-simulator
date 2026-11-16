// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with{type:'json'};
import support from '../data/arkpedia-enemy-support.json' with{type:'json'};
import evidence from '../data/arkpedia-enemy-native-abilities.json' with{type:'json'};
import {nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {plainHuiMingNative,huiMingAccountNative} from '../shared/arkpedia/enemy-hui-ming-features.js';
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
