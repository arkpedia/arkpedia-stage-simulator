// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import *as legacy from '../server/sim/content/enemies.js';
import *as runtime from '../server/sim/content/arkpedia-enemy-ability-runtime.js';
import *as forms from '../server/sim/content/arkpedia-enemy-forms.js';
import *as effects from '../server/sim/content/arkpedia-enemy-effects.js';
import *as spawns from '../server/sim/content/arkpedia-enemy-spawn.js';
import {touchInfection as legacyInfection} from '../server/sim/content/devices.js';
import {touchInfection,INFECTION_BUFF} from '../server/sim/content/terrain-infection.js';
import {makeBattle,enemyRec} from './helpers/battleHarness.js';
function fixture(){
 const h=makeBattle({content:'none',autoFinish:false,timeLimit:60,defs:{enemies:{source:enemyRec({key:'source',hp:1000,atk:100,speed:0})}}});
 h.b.start();const e=h.b.spawnEnemy('source',{pos:[9,6]});e.profile.noAttack=true;return{...h,e};
}
test('legacy exports and selected-stage helpers share the same implementations',()=>{
 for(const name of['installFeatureDispatch','abOf','attach','T','silenced','canCast','enterEnemyHusk'])assert.equal(legacy[name],runtime[name],name);
 for(const name of['elem','alliesInTiles','EROSION','hurt','areaAlliesInTiles'])assert.equal(legacy[name],effects[name],name);
 for(const name of['remainingRoute','stayRoute','spawnChildren'])assert.equal(legacy[name],spawns[name],name);
 for(const name of['rebornAbility','huskAbility','setHits','hitCount','isHitCount','setForm','HUSK_REBIRTH'])assert.equal(legacy[name],forms[name],name);
 assert.equal(legacyInfection,touchInfection);
});
test('cross-entry attachment uses one ability list, hook set and battle-result state',()=>{
 const f=fixture(),state=runtime.installFeatureDispatch(f.b),counts={first:0,second:0};
 const hooks=f.b._hooks.hit.length;
 assert.equal(legacy.installFeatureDispatch(f.b),state);assert.equal(f.b._hooks.hit.length,hooks);
 legacy.attach(f.b,f.e,[{taken(){counts.first++;}}]);runtime.attach(f.b,f.e,[{taken(){counts.second++;}}]);
 assert.equal(legacy.abOf(f.b,f.e),runtime.abOf(f.b,f.e));
 f.b.dealDamage(null,f.e,{amount:10,type:'true',sourceless:true});assert.deepEqual(counts,{first:1,second:1});
 legacy.lpLoss(f.b,2,'fixture',f.e);assert.equal(state.lpLoss,2);
 assert.throws(()=>legacy.ensureInstalled(f.b),/Enemy kit scope cannot change/);assert.deepEqual(f.b.errors,[]);
});
test('legacy and regular Active Originium contact preserve one effect and its original tick rhythm',()=>{
 const f=fixture(),spec={infection:{duration:3,damage:10,atk:.2,aspd:20}};
 touchInfection(f.b,spec,f.e);f.run(.5);legacyInfection(f.b,spec,f.e);f.run(.6);
 assert.equal(f.e.hp,990);assert.equal(f.e.s.atk,120);assert.equal(f.e.buffs.filter(b=>b.key===INFECTION_BUFF).length,1);
 assert.deepEqual(f.b.errors,[]);
});
