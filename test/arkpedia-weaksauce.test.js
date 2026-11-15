// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with{type:'json'};
import evidence from '../data/arkpedia-enemy-native-abilities.json' with{type:'json'};
import {nativeComponents} from '../shared/arkpedia/enemy-support.js';
import {weaksauceNative} from '../shared/arkpedia/enemy-weaksauce-features.js';
import {withCompiledEnemyRuntime} from '../shared/arkpedia/enemy-runtime-compiler.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
const id='enemy_5010_catrdg',row=records.enemies[id].levels[0];
function fixture(compiled=true){
 const guard=chessRec({id:'contact_guard',stats:{maxHp:2000,atk:0,def:150},skill:null});
 const h=makeBattle({content:'none',autoFinish:false,defs:{enemies:{[id]:compiled?withCompiledEnemyRuntime(row):row},chess:{[guard.chessId]:guard}},
  units:[{chessId:guard.chessId,row:10,col:6}],kits:{[guard.chessId]:()=>({trait:{noAttack:true}})},setup:installEnemyFeatures});
 h.b.start();const e=h.b.spawnEnemy(id,{pos:[10,6]}),g=h.b.allyUnits[0];h.b.addBuff(e,{key:'hold',flags:{noMove:true}});
 return{...h,e,g};
}
test('Weaksauce compiles a shared contact program, never a normal attack or hand-coded damage adapter',()=>{
 assert.ok(weaksauceNative(row,nativeComponents(evidence,id)));
 assert.deepEqual(withCompiledEnemyRuntime(row).runtimeFeatures.entries.filter(e=>e.ability).map(e=>e.ability.kind),['contactBuffProgram']);
});
test('contact applies one unmissable source-ATK physical hit through defence, then kills its own source',()=>{
 for(const compiled of[false,true]){
  const h=fixture(compiled),hp=h.g.hp;let attacks=0;
  h.b.on('attack',c=>{if(c.attacker===h.e)attacks++;});
  h.b.addBuff(h.g,{key:'dodge',mods:{dodgePhys:1}});h.b.addBuff(h.e,{key:'miss',mods:{hitRatePhys:-1}});
  h.run(.2);assert.equal(hp-h.g.hp,250);assert.equal(h.e.alive,false);assert.equal(attacks,0);h.run(2);assert.equal(hp-h.g.hp,250);
  assert.deepEqual(h.b.errors,[]);
 }
});
test('the source contact circle includes an ally collider but does not invent a full tile of reach',()=>{
 const h=fixture(),hp=h.g.hp;h.e.x=h.g.x+.36;h.run(.2);assert.equal(h.g.hp,hp);assert.equal(h.e.alive,true);
 h.e.x=h.g.x+.34;h.run(.2);assert.equal(hp-h.g.hp,250);assert.equal(h.e.alive,false);
});
test('hidden, sleeping and untargetable contacts cannot consume the source; it can contact once selectable',()=>{
 for(const flags of[{stealth:true},{sleep:true},{untargetable:true}]){
  const h=fixture(),hp=h.g.hp;h.b.addBuff(h.g,{key:'protect',flags});h.run(.2);assert.equal(h.e.alive,true);assert.equal(h.g.hp,hp);
  h.b.removeBuff(h.g,'protect');h.run(.2);assert.equal(h.e.alive,false);assert.equal(hp-h.g.hp,250);
 }
});
test('an invulnerable contact takes no damage but still consumes the source through its separate native kill node',()=>{
 const h=fixture(),hp=h.g.hp;h.b.addBuff(h.g,{key:'invuln',flags:{invulnerable:true}});h.run(.2);
 assert.equal(h.g.hp,hp);assert.equal(h.e.alive,false);assert.deepEqual(h.b.errors,[]);
});
test('a source killed before contact cannot leave a delayed hit behind',()=>{
 const h=fixture(),hp=h.g.hp;h.b.kill(h.e);h.run(1);assert.equal(h.g.hp,hp);assert.deepEqual(h.b.errors,[]);
});
test('admission refuses changed native contact radius, target validator, damage template and custom-root scope',()=>{
 for(const edit of[
  n=>n[id].find(c=>'_modes'in c)._delayToBorn=1,
  n=>n.$ref(n.Crash.find(c=>'_targetValidator'in c)._targetValidator)._targetOptions.targetSide=1,
  n=>n.$siblings(n.Crash.find(c=>'_targetValidator'in c)).find(c=>'m_Radius'in c).m_Radius=1,
  n=>n.Crash.find(c=>'_targetValidator'in c)._buffs[0].isDamageMissable=1,
  n=>n.Crash.find(c=>'_targetValidator'in c)._buffs[0].attributes.abnormalFlags.push(9),
 ]){const n=nativeComponents(structuredClone(evidence),id);edit(n);assert.equal(weaksauceNative(row,n),false);}
 const r=structuredClone(row);r.prefabKey='enemy_other';assert.equal(weaksauceNative(r,nativeComponents(evidence,id)),false);
});
test('the reusable contact trigger owns one attachment per deployment and permits a fresh entry after leaving',async()=>{
 const {contactBuffProgram}=await import('../server/sim/content/arkpedia-enemy-contact-program.js');
 const params=structuredClone(withCompiledEnemyRuntime(row).runtimeFeatures.entries.find(e=>e.ability).ability.params);
 // A second contact consumer can use the same transport without self-destruction.
 params.program.templates.enemy_catrdg_crash.events.ON_BUFF_START.pop();
 const trigger=contactBuffProgram(params),a={},h=fixture(),hp=h.g.hp;
 trigger.tick(h.b,h.e,a);trigger.tick(h.b,h.e,a);assert.equal(hp-h.g.hp,250);
 h.e.x+=1;trigger.tick(h.b,h.e,a);h.e.x-=1;trigger.tick(h.b,h.e,a);assert.equal(hp-h.g.hp,500);
 h.g.deploySeq++;trigger.tick(h.b,h.e,a);assert.equal(hp-h.g.hp,750);assert.equal(h.e.alive,true);
});
