// SPDX-License-Identifier: GPL-3.0-or-later
// Internal content composition on a controlled field, not stage admission.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeBattle} from './helpers/battleHarness.js';
import {addOwner} from './helpers/closur-point-fixture.js';
import {prepareClosurCombat,CLOSUR_COMBAT_CONTRACT} from '../server/sim/content/arkpedia-closur-combat.js';
import {installClosurRoster,CLOSUR_ROSTER_CONTRACT} from '../server/sim/content/arkpedia-closur-roster.js';
import {selectedClosurPredefined,CLOSUR_PREDEFINED_CONTRACT} from '../server/sim/content/arkpedia-closur-predefined.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {currentEnemyInstantKillReceipt} from '../server/sim/enemy-instant-kill.js';
const records=JSON.parse(readFileSync(new URL('../data/candidates/arkpedia-enemy-records.canonical.json',import.meta.url))).enemies;
const BAG='enemy_10209_mubag_2',LEAK='enemy_10211_murad';
function fixture(){
 const h=makeBattle({content:'none',autoFinish:false,timeLimit:180,setup:installEnemyFeatures,
  players:[{playerId:'arkpedia',side:'L',coords:'field',units:[]}],defs:{enemies:{[BAG]:records[BAG].levels[0],[LEAK]:records[LEAK].levels[0]}}});
 const b=h.b;b.viewport='fullscreen-workspace';b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 const{build}=selectedClosurPredefined(undefined,{contract:CLOSUR_PREDEFINED_CONTRACT});
 installClosurRoster(b,[build],{contract:CLOSUR_ROSTER_CONTRACT});b.start();
 const f=addOwner(b,build,{row:10,col:4,prepare:prepareClosurCombat,contract:CLOSUR_COMBAT_CONTRACT});assert.ok(b._deploy(f.u));
 b.addBuff(f.u,{key:'fixture:owner-durability',mods:{hpFlat:1e6},persist:true});f.u.hp=f.u.s.maxHp;
 const point=f.point.place(10,6);h.runUntil(()=>f.point.active()&&f.controller.phase?.kind!=='born',5);
 b.addBuff(point,{key:'fixture:point-durability',mods:{hpFlat:1e6},persist:true});point.hp=point.s.maxHp;
 return{h,b,...f};
}

test('the exact predefined module/S3 slows a real Bag while its unmarked feeding clock and native consumption retain world time',()=>{
 const f=fixture(),bag=f.h.spawn(BAG,{pos:[10,6]}),leak=f.h.spawn(LEAK,{pos:[10,6]}),feeding=bag.mem.ab.list.find(a=>a.contacts);
 f.b.addBuff(bag,{key:'fixture:enemy-durability',mods:{hpFlat:1e6},persist:true});bag.hp=bag.s.maxHp;
 const hits=[],consumed=[],native=[];f.b.on('damaged',c=>{if(c.source===f.u)hits.push(c);});
 f.b.on('ch17BagConsumed',c=>consumed.push(c));f.b.on('enemyInstantKill',ctx=>native.push(currentEnemyInstantKillReceipt(ctx,f.b)));
 f.h.runUntil(()=>!!feeding.phase,1);const phase=feeding.phase;
 f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.u.skill.activate('manual'),true);
 f.h.runUntil(()=>bag.s.slowDownRate<1,5);assert.ok(hits.some(c=>c.target===bag));assert.ok(f.u.skill.active);
 assert.equal(leak.s.slowDownRate,1);assert.ok(!hits.some(c=>c.target===leak));assert.ok(!leak.buffs.some(b=>b.data?.nativeSlowDown));
 f.h.run(Math.max(0,10.4-(f.b.time-phase.startedAt)));assert.ok(leak.alive);assert.equal(consumed.length,0);
 f.h.run(.2);assert.equal(leak.alive,false);assert.equal(consumed.length,1);assert.equal(consumed[0].source,bag);
 assert.equal(native.length,1);assert.equal(native[0].unit,leak);assert.equal(native[0].source,bag);assert.equal(native[0].action._skipReborn,false);
 assert.equal(bag.findBuff('enemy_mubag_atk_up[atk]').stacks,10);assert.equal(feeding.phase,phase);
 f.h.run(.6);assert.equal(feeding.phase,null);assert.ok(f.b.getPlayer('arkpedia').dp>0);assert.deepEqual(f.b.errors,[]);
});
