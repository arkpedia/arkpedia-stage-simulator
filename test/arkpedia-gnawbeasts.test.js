// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with {type:'json'};
import native from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import support from '../data/arkpedia-enemy-support.json' with {type:'json'};
import {withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {nativeComponents,prefabPath} from '../shared/arkpedia/enemy-support.js';
import {gnawbeastNative} from '../shared/arkpedia/enemy-gnawbeast-features.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {isHpLoss} from '../server/sim/damage.js';
import {SkillRuntime} from '../server/sim/skills.js';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
const ids=['enemy_1335_bldrat','enemy_1335_bldrat_2'];
function fixture(id=ids[0],{automatic=false,legacy=false}={}){
  const record=withCompiledEnemyRuntime(records.enemies[id].levels[0]);
  if(legacy){
    const entry=record.runtimeFeatures.entries.find(e=>e.ability?.kind==='chargedMeleeBuffProgram');
    entry.ability={kind:'chargedMeleePeriodicLoss',params:{initialSp:0,maxSp:1,increment:1,cost:1,
      key:'blood_dec',amount:record.skills[0].bb.blood_value,duration:5,interval:1,firstDelay:Math.fround(.1),
      excludedProfessions:['TOKEN','TRAP'],silenceBlocksSpend:false,effectSilenceable:true,
      attackAnim:entry.ability.params.attackAnim}};
  }
  const op=chessRec({id:'bleed_target',stats:{maxHp:100000,atk:0,def:0},skill:null});
  const h=makeBattle({content:'none',autoFinish:false,timeLimit:60,defs:{enemies:{[id]:record},chess:{[op.chessId]:op}},
    units:[{chessId:op.chessId,row:10,col:6}],setup:installEnemyFeatures});
  h.b.start();const e=h.b.spawnEnemy(id,{pos:[10,6]}),target=h.b.allyUnits[0],pulses=[];
  h.b.addBuff(e,{key:'test:hold',flags:{noMove:true}});e.profile.noAttack=!automatic;
  target.profile.noAttack=true;
  h.b.on('damaged',c=>{if(c.target===target&&c.dmg.tags?.includes('blood_dec'))pulses.push({time:h.b.time,amount:c.amount,loss:isHpLoss(c.dmg)});});
  const fire=()=>{++h.b._attackSeq;h.b.emit('attack',{attacker:e,targets:[target],isSkill:false});};
  return{...h,e,target,fire,pulses,record};
}
for(const id of ids){
  test(`${id}: source, charge cadence and five independently timed fixed-loss pulses`,()=>{
    const h=fixture(id),amount=h.record.skills[0].bb.blood_value;
    assert.ok(support.enemies[id].policy);assert.ok(gnawbeastNative(h.record,nativeComponents(native,id)));
    h.fire();assert.equal(h.target.findBuff('blood_dec'),null);
    h.fire();assert.ok(h.target.findBuff('blood_dec'));const hp=h.target.hp;
    h.run(.06);assert.equal(h.pulses.length,0);h.run(.1);assert.equal(h.pulses.length,1);
    h.run(5);assert.equal(h.pulses.length,5);assert.equal(hp-h.target.hp,amount*5);
    assert.ok(h.pulses.every(p=>p.loss&&p.amount===amount));
    for(let i=1;i<h.pulses.length;i++)assert.ok(Math.abs(h.pulses[i].time-h.pulses[i-1].time-1)<h.b.dt*1.1);
    assert.equal(h.target.findBuff('blood_dec'),null);assert.deepEqual(h.b.errors,[]);
  });
  test(`${id}: real melee attacks use the shared two-attack charge path`,()=>{
    const h=fixture(id,{automatic:true});let attacks=0;h.b.on('attack',c=>{if(c.attacker===h.e)attacks++;});
    assert.ok(h.runUntil(()=>attacks===1,5));assert.equal(h.target.findBuff('blood_dec'),null);
    assert.ok(h.runUntil(()=>attacks===2,5));assert.ok(h.target.findBuff('blood_dec'));assert.deepEqual(h.b.errors,[]);
  });
}
test('silence suppresses application while the attack-recovery spend cycle continues',()=>{
  const h=fixture();h.b.applyStatus(h.e,'silence',{duration:30});
  for(let i=0;i<4;i++)h.fire();assert.equal(h.target.findBuff('blood_dec'),null);
  h.b.removeBuff(h.e,'silence');h.fire();assert.equal(h.target.findBuff('blood_dec'),null);
  h.fire();assert.ok(h.target.findBuff('blood_dec'));assert.deepEqual(h.b.errors,[]);
});
test('noSp stops charging but does not erase or prevent spending an existing charge',()=>{
  const h=fixture();h.b.addBuff(h.e,{key:'test:noSp',flags:{noSp:true}});
  for(let i=0;i<3;i++)h.fire();assert.equal(h.target.findBuff('blood_dec'),null);
  h.b.removeBuff(h.e,'test:noSp');h.fire();assert.equal(h.target.findBuff('blood_dec'),null);
  h.b.addBuff(h.e,{key:'test:noSp',flags:{noSp:true}});h.fire();assert.ok(h.target.findBuff('blood_dec'));
});
test('a dodged charged packet spends its charge but does not attach bleed',()=>{
  const h=fixture();h.b.addBuff(h.target,{key:'test:dodge',mods:{dodgePhys:1}});
  h.fire();h.fire();assert.equal(h.target.findBuff('blood_dec'),null);
  h.b.removeBuff(h.target,'test:dodge');h.fire();assert.equal(h.target.findBuff('blood_dec'),null);
  h.fire();assert.ok(h.target.findBuff('blood_dec'));
});
for(const kind of['token','device'])test(`${kind} bodies take the physical hit without the operator-only bleed`,()=>{
  const h=fixture(),hp=h.target.hp;h.target.kind=kind;
  h.fire();h.fire();assert.equal(hp-h.target.hp,h.e.s.atk*2);assert.equal(h.target.findBuff('blood_dec'),null);
});
test('attached bleed survives healing and source death, bypasses barriers/invulnerability, and grants no hurt SP',()=>{
  const h=fixture();h.target.skill=new SkillRuntime(h.b,h.target,{skillType:'AUTO'},
    {id:'test:hurt',kind:'instant',spCost:99,initSp:0,spType:'hurt',trigger:'NEVER'});h.target.skill.reset();
  h.fire();h.fire();const hp=h.target.hp,sp=h.target.skill.sp;
  h.b.addBuff(h.target,{key:'test:protected',shield:10000,flags:{invulnerable:true},mods:{dmgTakenMul:.1}});
  h.b.heal(null,h.target,1);const healed=h.target.hp-hp;
  h.b.kill(h.e);h.run(5.2);
  assert.equal(hp+healed-h.target.hp,100);assert.equal(h.target.skill.sp,sp);
  assert.equal(h.target.findBuff('test:protected').shield,10000);assert.equal(h.pulses.length,5);assert.deepEqual(h.b.errors,[]);
});
test('EXTEND retains one buff instance and its pulse clock when another charged hit refreshes it',()=>{
  const h=fixture();h.fire();h.fire();const original=h.target.findBuff('blood_dec');h.run(1.2);
  assert.equal(h.pulses.length,2);h.fire();h.fire();assert.equal(h.target.findBuff('blood_dec'),original);
  h.run(.2);assert.equal(h.pulses.length,2);h.run(.9);assert.equal(h.pulses.length,3);
  assert.ok(h.target.findBuff('blood_dec'));assert.deepEqual(h.b.errors,[]);
});
test('native admission refuses altered charge, attack, silence, target and periodic-loss contracts',()=>{
  const id=ids[0],path=prefabPath(id);
  for(const mutation of['sp','damageType','wrapperSilence','payload','profession','firstDelay','damageModifiers']){
    const row=structuredClone(records.enemies[id].levels[0]);
    const evidence={...native,prefabs:{[path]:structuredClone(native.prefabs[path])},templates:{...native.templates,
      'bldrat_t_1[blood]':structuredClone(native.templates['bldrat_t_1[blood]']),blood_dec:structuredClone(native.templates.blood_dec)}};
    if(mutation==='sp')row.sp.increment=2;
    else if(['damageType','wrapperSilence','payload'].includes(mutation)){
      for(const entry of evidence.prefabs[path]){const c=JSON.parse(entry.originalJson);
        if(mutation==='damageType'&&entry.objectName==='Combat'&&'_damageType'in c)c._damageType=2;
        if(mutation==='wrapperSilence'&&entry.objectName==='BloodHit'&&'_ignoreSilence'in c)c._ignoreSilence=0;
        if(mutation==='payload'&&c.m_Script?.m_PathID==='1339719624887862345')c._buffs=[];
        entry.originalJson=JSON.stringify(c);
      }
    }else if(mutation==='profession')evidence.templates['bldrat_t_1[blood]'].eventToActions.ON_AFTER_OUTPUT_DAMAGE[1]._profession=['TOKEN'];
    else if(mutation==='firstDelay')evidence.templates['bldrat_t_1[blood]'].eventToActions.ON_AFTER_OUTPUT_DAMAGE[3]._buff.firstTriggerInterval=1;
    else evidence.templates.blood_dec.eventToActions.ON_BUFF_TRIGGER[0]._skipModifierEvent=false;
    assert.equal(gnawbeastNative(row,nativeComponents(evidence,id)),false,mutation);
  }
});

for(const id of ids)test(`${id}: old pinned periodic-loss plans match the new program through refresh and source death`,()=>{
  const results=[];
  for(const legacy of[true,false]){
    const h=fixture(id,{legacy});h.fire();h.fire();h.run(.4);
    h.fire();h.fire();h.b.kill(h.e);h.run(5.5);
    results.push({pulses:h.pulses,hp:h.target.hp,remaining:h.target.findBuff('blood_dec'),errors:h.b.errors});
  }
  assert.deepEqual(results[1],results[0]);
});
