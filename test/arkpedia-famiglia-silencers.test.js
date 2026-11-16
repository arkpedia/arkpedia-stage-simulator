// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with{type:'json'};
import support from '../data/arkpedia-enemy-support.json' with{type:'json'};
import evidence from '../data/arkpedia-enemy-native-abilities.json' with{type:'json'};
import {nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {famigliaSilencerNative} from '../shared/arkpedia/enemy-famiglia-silencer-features.js';
import {withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {compileNativeBuffProgram} from '../shared/arkpedia/behavior-native-compiler.js';
import {prepareBehaviorProgram} from '../shared/arkpedia/behavior-program.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {enemyStealthed} from '../server/sim/targeting.js';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
const ids=['enemy_1283_sgkill','enemy_1283_sgkill_2'],parent='enemy_sgkill_vg_check',stat='enemy_sgskill_up';
function fixture(id=ids[0],compiled=true){
 const g=chessRec({id:'silencer_guard',stats:{maxHp:1e6,atk:0,def:0,res:0,blockCnt:0},skill:null});
 const record=compiled?withCompiledEnemyRuntime(records.enemies[id].levels[0]):records.enemies[id].levels[0];
 const h=makeBattle({content:'none',autoFinish:false,defs:{enemies:{[id]:record},chess:{[g.chessId]:g}},units:[{chessId:g.chessId,row:10,col:6}],kits:{[g.chessId]:()=>({trait:{noAttack:true}})},setup:installEnemyFeatures});h.b.start();const e=h.b.spawnEnemy(id,{pos:[10,5]}),guard=h.b.allyUnits[0],hits=[];h.b.addBuff(e,{key:'hold',flags:{noMove:true}});h.b.on('hit',c=>{if(c.source===e&&c.target===guard)hits.push(c.dmg.type);});return{...h,e,guard,hits,aura:()=>h.b.addBuff(e,{key:'vgctrl_s[aura]'})};
}
for(const id of ids){
 test(`${id}: exact native stealth, stat checker and ordinary projectile compile without a permanent stealth trait`,()=>{
  const r=records.enemies[id].levels[0];assert.ok(famigliaSilencerNative(r,nativeComponents(evidence,id)));assert.ok(support.enemies[id].policy);const entries=withCompiledEnemyRuntime(r).runtimeFeatures.entries;assert.deepEqual(entries.map(v=>v.ability.kind),['programmedProjectileModes','nativeStealth','stageOutcomeCounter']);assert.ok(entries.every(v=>!v.trait));
 });
 test(`${id}: one native stat attachment follows half-second polling and preserves the database stats`,()=>{
  for(const compiled of[false,true]){const h=fixture(id,compiled),base={atk:h.e.s.atk,def:h.e.s.def,aspd:h.e.s.aspd},aura=h.aura();h.run(.4);assert.equal(h.e.findBuff(stat),null);h.run(.2);const buff=h.e.findBuff(stat);assert.ok(buff);assert.equal(buff.stacks,1);assert.equal(h.e.s.atk,base.atk*1.15);assert.equal(h.e.s.def,base.def*1.15);assert.equal(h.e.s.aspd,base.aspd+50);h.run(2);assert.equal(h.e.findBuff(stat),buff);assert.equal(buff.stacks,1);h.b.applyStatus(h.e,'silence',{duration:10});h.run(.55);assert.equal(h.e.findBuff(stat),buff);h.b.removeBuff(h.e,aura);h.run(.55);assert.equal(h.e.findBuff(stat),null);assert.equal(h.e.s.atk,base.atk);assert.equal(h.e.s.def,base.def);assert.equal(h.e.s.aspd,base.aspd);assert.ok(h.hits.every(v=>v==='phys'));assert.deepEqual(h.b.errors,[]);}
 });
}
test('the checker owns polling but not its non-derived permanent child',()=>{
 const h=fixture();h.aura();h.run(.55);const buff=h.e.findBuff(stat);h.b.removeBuff(h.e,parent);h.b.removeBuff(h.e,'vgctrl_s[aura]');h.run(.6);assert.equal(h.e.findBuff(stat),buff);assert.equal(h.e.s.atk,h.e.base.atk*1.15);assert.deepEqual(h.b.errors,[]);
});
test('guarded stat creation honors present same-key instances; native FinishBuffsById removes all of them',()=>{
 const h=fixture(),foreign=h.b.addBuff(h.e,{key:stat,mods:{atkPct:.3},refresh:'independent',maxStacks:Infinity});h.aura();h.run(.55);assert.deepEqual(h.e.buffs.filter(v=>v.key===stat),[foreign]);assert.equal(h.e.s.atk,h.e.base.atk*1.3);h.b.removeBuff(h.e,'vgctrl_s[aura]');h.run(.55);assert.equal(h.e.findBuff(stat),null);assert.deepEqual(h.b.errors,[]);
});
test('native invisibility survives attacks and silence, reveals on block and restores after its one-second source delay',()=>{
 const h=fixture();assert.equal(enemyStealthed(h.e),true);h.run(.8);assert.ok(h.hits.length);assert.equal(enemyStealthed(h.e),true);h.b.applyStatus(h.e,'silence',{duration:10});assert.equal(enemyStealthed(h.e),true);h.e.blockedBy=h.guard;assert.equal(enemyStealthed(h.e),false);h.e.blockedBy=null;h.b._stealthSwitch(h.e);h.run(.8);assert.equal(enemyStealthed(h.e),false);h.run(.25);assert.equal(enemyStealthed(h.e),true);h.b.removeBuff(h.e,'enemy_sgkill_passive');assert.equal(enemyStealthed(h.e),false);h.b.kill(h.e);assert.equal(h.b.stageOutcomes.counters.killed,1);assert.deepEqual(h.b.errors,[]);
});
test('source admission rejects stat payload, absent-guard, selector, stealth-clock and packet changes',()=>{
 for(const edit of[
  n=>n.$template('enemy_sgkill_passive').eventToActions.ON_BUFF_TRIGGER[0]._succeedNodes[0]._failNodes[0]._buff.attributes.attributeModifiers[0].fetchBaseValueFromSourceEntity=true,
  n=>n.$template('enemy_sgkill_passive').eventToActions.ON_BUFF_TRIGGER[0]._succeedNodes[0]._conditionNode._buffKeys=['other'],
  n=>n.$ref(n.Invisible.find(v=>v._checker)._checker)._restoreDelay=3,
  n=>n.Passive.find(v=>v._buffs)._buffs[0].isSilenceable=1,
  n=>n.$ref(n.$ref(n[ids[0]].find(v=>v._modes)._modes[0])._attackTrigger).m_Script.m_PathID='other',
 ]){const n=nativeComponents(structuredClone(evidence),ids[0]);edit(n);assert.equal(famigliaSilencerNative(records.enemies[ids[0]].levels[0],n),false);}
});
const compile=templates=>compileNativeBuffProgram('enemy_sgkill_passive',k=>templates[k]);
test('guarded-stat compiler refuses arbitrary STACK application, foreign owners, active templates and unsupported caps before effects',()=>{
 for(const edit of[
  b=>b.attributes.abnormalFlags=['INVISIBLE'],b=>b.attributes.attributeModifiers[0].value=2,
  b=>b.overrideType='DEFAULT',b=>b.refreshRemainingTimeWhenStackMax=true,b=>b.maxValidStackCnt=2,
 ]){const t=structuredClone(evidence.templates),b=t.enemy_sgkill_passive.eventToActions.ON_BUFF_TRIGGER[0]._succeedNodes[0]._failNodes[0]._buff;edit(b);assert.throws(()=>compile(t),/Unsupported native behaviour/);}
 const p=prepareBehaviorProgram(compile(evidence.templates));assert.deepEqual(p.requiredServices,[]);
 for(const bb of[{atk:NaN},{attack_speed:Infinity},{max_valid_stack_cnt:0},{max_stack_cnt:1.5}])assert.throws(()=>p.validateBlackboard(bb),/Invalid behaviour program/);
 assert.deepEqual(p.validateBlackboard({atk:0,def:-.2,attack_speed:50}),{atk:0,def:-.2,attack_speed:50});
});
test('missing stat operands use the source zero fallback and explicit zero remains zero',()=>{
 const h=fixture(),p=prepareBehaviorProgram(compile(evidence.templates));h.aura();p.run('ON_BUFF_TRIGGER',{battle:h.b,unit:h.e,blackboard:{atk:0,def:-.2}});assert.deepEqual(h.e.findBuff(stat).mods,{aspd:0,atkPct:0,defPct:-.2});assert.equal(h.e.s.atk,h.e.base.atk);assert.equal(h.e.s.def,h.e.base.def*.8);assert.deepEqual(h.b.errors,[]);
});
test('a shared operand keeps the stricter damage domain, including an inactive damage branch',()=>{
 const graph=structuredClone(compile(evidence.templates));graph.templates.enemy_sgkill_passive.events.ON_BEFORE_ATTACK=[{op:'damage',type:'phys',scaleKey:'atk',defaultScale:1}];const p=prepareBehaviorProgram(graph);assert.throws(()=>p.validateBlackboard({atk:-.2}),/number/);assert.equal(p.validateBlackboard({atk:0}).atk,0);
});
test('source death inside attachment admission cannot install a stat buff on a retired life',()=>{
 const h=fixture();h.aura();const off=h.b.on('beforeBuff',c=>{if(c.unit===h.e&&c.buff.key===stat)h.b.kill(h.e);});h.run(.6);h.b.off(off);assert.equal(h.e.alive,false);assert.equal(h.e.findBuff(stat),null);assert.equal(h.e.findBuff('enemy_sgkill_passive'),null);assert.deepEqual(h.b.errors,[]);
});
test('guarded modifiers cannot be moved into a different child binding or reinterpret a non-root target',()=>{
 const graph=structuredClone(compile(evidence.templates));graph.templates.enemy_sgkill_passive.events.ON_BUFF_TRIGGER[0].yes[0].who='target';assert.throws(()=>prepareBehaviorProgram(graph),/stat binding/);
 const h=fixture(),p=prepareBehaviorProgram(compile(evidence.templates));h.aura();h.b.kill(h.e);p.run('ON_BUFF_TRIGGER',{battle:h.b,unit:h.e,blackboard:{atk:.9}});assert.equal(h.e.findBuff(stat),null);assert.deepEqual(h.b.errors,[]);
});
