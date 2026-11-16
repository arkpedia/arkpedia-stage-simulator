// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with{type:'json'};
import support from '../data/arkpedia-enemy-support.json' with{type:'json'};
import evidence from '../data/arkpedia-enemy-native-abilities.json' with{type:'json'};
import {nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {fatherAgenirNative} from '../shared/arkpedia/enemy-father-agenir-features.js';
import {withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {compileNativeBuffProgram} from '../shared/arkpedia/behavior-native-compiler.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {registerDeviceSp} from '../server/sim/content/arkpedia-device-sp.js';
import {programmedProjectileModes} from '../server/sim/content/arkpedia-enemy-programmed-projectiles.js';
import {selectedSpLink} from '../server/sim/content/arkpedia-enemy-sp-link.js';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
const id='enemy_1284_sgprst',parent='enemy_sgprst_vg_check',add='enemy_sgprst_vg_add',link='enemy_sgprsr_modify_vg',debuff='enemy_sgprst_reduce_def',log='enemy_sgprst_dead_log',closed='enemy_sgprst_eff1',open='enemy_sgprst_eff2';
function fixture({compiled=true,level=0,col=6,controller=true,def=5000}={}){
 const g=chessRec({id:'agenir_guard',stats:{maxHp:1e7,atk:0,def,res:0,blockCnt:0},skill:null});
 const record=compiled?withCompiledEnemyRuntime(records.enemies[id].levels[level]):records.enemies[id].levels[level];
 const h=makeBattle({content:'none',autoFinish:false,defs:{enemies:{[id]:record},chess:{[g.chessId]:g}},units:[{chessId:g.chessId,row:10,col}],kits:{[g.chessId]:()=>({trait:{noAttack:true}})},setup:installEnemyFeatures});h.b.start();
 const state={sp:0,pulses:[]};
 const receiver=()=>{const device=h.b.spawnDevice('review:SP-receiver',10,9,{side:'enemy'});device.tags.add('vgctrl');registerDeviceSp(h.b,device,{get:()=>state.sp,add:n=>{const prior=state.sp;state.sp=Math.min(500,state.sp+n);state.pulses.push(h.b.time);return state.sp-prior;}});return device;};
 const device=controller?receiver():null;
 const e=h.b.spawnEnemy(id,{pos:[10,5]}),guard=h.b.allyUnits[0],hits=[];assert.ok(guard.alive&&guard.deployed);h.b.addBuff(e,{key:'hold',flags:{noMove:true}});
 h.b.on('damaged',c=>{if(c.source===e&&c.target===guard)hits.push({time:h.b.time,type:c.dmg.type,amount:c.dmg.amount});});
 return{...h,e,guard,hits,state,device,receiver,aura:()=>h.b.addBuff(e,{key:'vgctrl_s[aura]'}),ammo:()=>e.mem.enemyAmmo.current,stacks:()=>guard.findBuff(debuff)?.stacks??0};
}
const nextHit=h=>{const count=h.hits.length;assert.ok(h.runUntil(()=>h.hits.length>count,12));return h.hits[count];};
test('both record levels pass the source gate and compile to shared components',()=>{
 for(const level of [0,1]){const r=records.enemies[id].levels[level];assert.ok(fatherAgenirNative(r,nativeComponents(evidence,id)));
  assert.deepEqual(withCompiledEnemyRuntime(r).runtimeFeatures.entries.filter(v=>v.ability).map(v=>v.ability.kind),['selectedSpLink','programmedProjectileModes','stageOutcomeCounter']);}
 assert.equal(support.enemies[id].policy,'stats-attacks-and-features');assert.deepEqual(support.enemies[id].reasons,[]);assert.equal(support.enemies[id].native[id].claimedActive,3);
});
test('the silent periodic SP template lowers to the existing nonnegative target SP operation',()=>{
 assert.deepEqual(compileNativeBuffProgram('modify_sp[trigger_with_no_ui]',k=>evidence.templates[k]).templates['modify_sp[trigger_with_no_ui]'].events,{ON_BUFF_TRIGGER:[{op:'spAdd',who:'target',key:'sp'}]});
 const visible=structuredClone(evidence.templates['modify_sp[trigger_with_no_ui]']);visible.eventToActions.ON_BUFF_TRIGGER[1]._effectKey='some_effect';
 assert.throws(()=>compileNativeBuffProgram('modify_sp[trigger_with_no_ui]',()=>visible),/Unsupported native behaviour/);
 const signed=structuredClone(evidence.templates['modify_sp[trigger_with_no_ui]']);signed.eventToActions.ON_BUFF_TRIGGER[0]._modifyValue=-1;
 assert.throws(()=>compileNativeBuffProgram('modify_sp[trigger_with_no_ui]',()=>signed),/Unsupported native behaviour/);
});
test('each paid arrival spends one round for one permanent DEF stack; an empty magazine leaves ordinary hits',()=>{
 for(const compiled of [false,true]){const h=fixture({compiled});assert.equal(h.ammo(),10);assert.equal(h.guard.s.def,5000);
  const first=nextHit(h);assert.equal(first.type,'phys');assert.equal(h.ammo(),9);assert.equal(h.stacks(),1);assert.equal(h.guard.s.def,4700);
  for(let i=2;i<=10;i++){nextHit(h);assert.equal(h.ammo(),10-i);assert.equal(h.stacks(),i);}
  assert.equal(h.guard.s.def,2000);nextHit(h);nextHit(h);assert.equal(h.ammo(),0);assert.equal(h.stacks(),10);assert.equal(h.guard.s.def,2000);assert.deepEqual(h.b.errors,[]);}
});
test('ordinary casts use the 40-frame Attack clip and its frame-23 release',()=>{
 const h=fixture();assert.equal(h.e.def.attackAnim.dur,Math.fround(40/30));assert.equal(h.e.def.attackAnim.hit,Math.fround(23/30));assert.ok(h.e.findBuff(closed));assert.equal(h.e.findBuff(open),null);assert.equal(h.e.profile.globalRange,false);
});
test('Asset Liquidation polling selects the global Skill mode and its visual passive, then returns',()=>{
 for(const compiled of [false,true]){const h=fixture({compiled,col:8});h.run(6);assert.equal(h.hits.length,0);
  const aura=h.aura();h.run(.4);assert.equal(h.e.mem.projectileModeIndex,0);h.run(.15);assert.equal(h.e.mem.projectileModeIndex,1);assert.equal(h.e.profile.globalRange,true);
  assert.ok(h.e.findBuff(open));assert.equal(h.e.findBuff(closed),null);assert.equal(h.e.def.attackAnim.dur,2);assert.equal(h.e.def.attackAnim.hit,Math.fround(43/30));
  assert.equal(nextHit(h).type,'phys');assert.equal(h.stacks(),1);assert.equal(h.ammo(),9);
  h.b.removeBuff(h.e,aura);h.run(.55);assert.equal(h.e.mem.projectileModeIndex,0);assert.equal(h.e.profile.globalRange,false);assert.ok(h.e.findBuff(closed));assert.equal(h.e.findBuff(open),null);
  const count=h.hits.length;h.run(8);assert.equal(h.hits.length,count);assert.deepEqual(h.b.errors,[]);}
});
test('flying targets are valid in both modes',()=>{
 const h=fixture();h.guard.motion='FLY';assert.equal(nextHit(h).type,'phys');
 const far=fixture({col:8});far.guard.motion='FLY';far.aura();far.run(.55);assert.equal(nextHit(far).type,'phys');
});
test('a round is not spent when the source died before arrival',()=>{
 const h=fixture();assert.ok(h.runUntil(()=>h.b.projectiles.list.length>0,6));h.b.kill(h.e);nextHit(h);assert.equal(h.stacks(),0);assert.equal(h.e.mem.enemyAmmo.current,10);assert.deepEqual(h.b.errors,[]);
});
test('the start-only link gives the selected controller two SP each second until its parent finishes',()=>{
 for(const compiled of [false,true]){const h=fixture({compiled});assert.ok(h.e.findBuff(add));assert.ok(h.device.findBuff(link));h.run(.9);assert.equal(h.state.sp,0);h.run(.2);assert.equal(h.state.sp,2);h.run(4);assert.equal(h.state.sp,10);
  assert.ok(h.state.pulses.every((t,i)=>Math.abs(t-(i+1))<h.b.dt*2));h.b.applyStatus(h.e,'stun',{duration:2});h.run(2);assert.equal(h.state.sp,14);
  h.b.kill(h.e);assert.equal(h.device.findBuff(link),null);h.run(3);assert.equal(h.state.sp,14);assert.deepEqual(h.b.errors,[]);}
});
test('a controller that appears after the passive started is never acquired, and removing the parent ends the link',()=>{
 const late=fixture({controller:false});const device=late.receiver();late.run(3);assert.equal(late.state.sp,0);assert.equal(device.findBuff(link),null);assert.ok(late.e.findBuff(add));
 const h=fixture();h.run(1.1);assert.equal(h.state.sp,2);h.b.removeBuff(h.e,add);assert.equal(h.device.findBuff(link),null);h.run(3);assert.equal(h.state.sp,2);assert.deepEqual(h.b.errors,[]);
});
test('removing a receiver ends only its own link and leaves the parent attached',()=>{
 const h=fixture();h.run(1.1);h.b.removeBuff(h.device,link);h.run(3);assert.equal(h.state.sp,2);assert.ok(h.e.findBuff(add));h.b.kill(h.e);assert.deepEqual(h.b.errors,[]);
});
test('the killed log needs its own live attachment and ignores exits',()=>{
 const h=fixture();h.b.kill(h.e);assert.equal(h.b.stageOutcomes.counters.killed,1);assert.equal(h.e.findBuff(log),null);assert.equal(h.e.findBuff(parent),null);assert.equal(h.e.findBuff(closed),null);
 const gone=fixture();gone.b.removeBuff(gone.e,log);gone.b.kill(gone.e);assert.equal(gone.b.stageOutcomes?.counters.killed??0,0);
 const leak=fixture();leak.b.leak(leak.e);assert.equal(leak.b.stageOutcomes?.counters.killed??0,0);assert.equal(leak.device.findBuff(link),null);
});
test('source gates refuse changed packets, selectors, clocks, templates and controller selection',()=>{
 const root=n=>n[id].find(v=>v._modes),passive=n=>n.Passive.find(v=>v._buffs.some(b=>b.buffKey===parent)),mode=(n,i)=>n.$ref(root(n)._modes[i]);
 for(const edit of[
  n=>passive(n)._buffs[0].triggerInterval=.1,
  n=>passive(n)._buffs[1].isSilenceable=1,
  n=>passive(n)._buffs[2].templateKey='empty',
  n=>root(n)._showSpAsBulletMode=0,
  n=>root(n)._modes[1].m_FileID=1,
  n=>n.$ref(mode(n,0)._attack)._activeBuffs[0].isDamageMissable=1,
  n=>n.$ref(mode(n,1)._attack)._activeBuffs=[],
  n=>n.$ref(mode(n,1)._attack)._projectileKey='projectile_enemy_sgprst',
  n=>n.$ref(mode(n,0)._attack)._damageType=2,
  n=>n.$siblings(n.$ref(mode(n,0)._attackTrigger)).find(c=>'m_Radius'in c).m_Radius=3,
  n=>n.$siblings(n.$ref(mode(n,1)._attackTrigger)).find(c=>'_targetSide'in c)._targetMotion=1,
  n=>n.$siblings(n.$ref(mode(n,1)._attackTrigger)).find(c=>c.m_Script?.m_PathID==='6275044311115013764')._useBlackboardRangeId=1,
  n=>n.$ref(mode(n,1)._generalAbilities[0])._buffs[1].templateKey='log_killed',
  n=>n.$ref(n.SelectVg.find(v=>'_selector'in v)._selector)._filterTag='other',
  n=>n.$template('enemy_sgprst_sp_attack_check').eventToActions.ON_BUFF_START[0]._checkHasSp=2,
  n=>n.$template('enemy_sgprst_sp_attack_check').eventToActions.ON_BUFF_START[1]._buff.attributes.attributeModifiers[0].formulaItem='MULTIPLIER',
  n=>n.$template('enemy_sgprst_sp_attack_check').eventToActions.ON_BUFF_START[2]._modifyValue=-2,
  n=>n.$template('enemy_sgprst_vg_add').eventToActions.ON_BUFF_START[0]._buff.triggerInterval=.5,
  n=>n.$template('enemy_sgprst_vg_add').eventToActions.ON_BUFF_START[0]._finishDerivedBuffIfParentFinish=false,
  n=>n.$template('modify_sp[trigger_with_no_ui]').eventToActions.ON_BUFF_TRIGGER[0]._targetType='BUFF_SOURCE',
  n=>n.$template('enemy_common_check_vg').eventToActions.ON_BUFF_TRIGGER[0]._conditionNode._buffKeys=['other'],
  n=>n.$template('log_killed').eventToActions.ON_OWNER_KILLED[0]._additionValue=2,
  n=>n.$projectile('projectile_enemy_sgprst_s'),
 ]){const n=nativeComponents(structuredClone(evidence),id);edit(n);assert.equal(fatherAgenirNative(records.enemies[id].levels[0],n),edit.toString().includes('$projectile('),edit.toString());}
 for(const change of[r=>r.sp.maxSp=12,r=>r.talents.bb['Passive.sp']=3,r=>r.stats.rangeRadius=2,r=>r.abilities.pop(),r=>r.level=2]){const r=structuredClone(records.enemies[id].levels[0]);change(r);assert.equal(fatherAgenirNative(r,nativeComponents(evidence,id)),false);}
});
test('runtime parameter validation refuses unbound ammunition hits and non-SP link programs',()=>{
 const entries=withCompiledEnemyRuntime(records.enemies[id].levels[0]).runtimeFeatures.entries,find=kind=>structuredClone(entries.find(v=>v.ability?.kind===kind).ability.params);
 const modes=programmedProjectileModes.decodeParameters?.(find('programmedProjectileModes'))??find('programmedProjectileModes');
 assert.ok(modes.program);{const {ammo,...rest}=modes;assert.throws(()=>programmedProjectileModes.validate(rest),/Ammunition hit requires/);assert.throws(()=>programmedProjectileModes.validate({...modes,ammo:{max:10,initial:11}}),/Invalid mode ammunition account/);
  assert.throws(()=>programmedProjectileModes.validate({...modes,modes:modes.modes.map(m=>({...m,ammoHit:{...m.ammoHit,mods:{atkFlat:1}}}))}),/Invalid ammunition hit buff/);
  assert.throws(()=>programmedProjectileModes.validate({...modes,modes:modes.modes.map(m=>({...m,globalRange:1}))}),/Invalid projectile mode range/);}
 const linkParams=selectedSpLink.decodeParameters?.(find('selectedSpLink'))??find('selectedSpLink');
 assert.ok(linkParams.program);{assert.throws(()=>selectedSpLink.validate({...linkParams,interval:0}),/Invalid selected SP link/);assert.throws(()=>selectedSpLink.validate({...linkParams,linkKey:linkParams.parentKey}),/Invalid selected SP link/);
  assert.throws(()=>selectedSpLink.validate({...linkParams,program:modes.program}),/unsupported service/);assert.throws(()=>selectedSpLink.validate({...linkParams,blackboard:{sp:-1}}));}
});
