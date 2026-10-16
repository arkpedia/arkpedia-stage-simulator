// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBattle,chessRec,enemyRec} from './helpers/battleHarness.js';
function make(){const h=makeBattle({content:'none',autoFinish:false,defs:{chess:{guard:chessRec({id:'guard',skill:null,stats:{maxHp:100000,def:100,res:20}})},enemies:{enemy:enemyRec({key:'enemy',hp:100000,atk:100,speed:0})}},units:[{chessId:'guard',row:10,col:5}],enemies:[{key:'enemy',pos:[10,5.3]}]});h.step();const b=h.b,u=h.unit('guard'),e=h.enemies()[0];u.atkCd=e.atkCd=1000;return{b,u,e};}
const hit=(f,amount,type='true',opts={})=>f.b.dealDamage(f.e,f.u,{amount,type,...opts});
const near=(a,z)=>assert.ok(Math.abs(a-z)<1e-7,`${a} != ${z}`);
for(const type of['phys','arts','true','elemental'])test(`native barrier callback observes accepted mitigated ${type} absorption once`,()=>{
 const f=make(),seen=[];const s=f.b.addBuff(f.u,{key:'qa:barrier',source:f.u,shield:1000,onShieldAbsorb:c=>seen.push({...c})});hit(f,200,type);assert.equal(seen.length,1);assert.equal(seen[0].buff,s);assert.equal(seen[0].unit,f.u);assert.equal(seen[0].source,f.e);near(seen[0].absorbed,type==='phys'?100:type==='arts'?160:200);assert.equal(seen[0].remaining,0);assert.equal(seen[0].depleted,false);assert.deepEqual(f.b.errors,[]);
});
test('native barrier may reject overflow after spending its finite budget, while calculated receipt remains intact',()=>{
 const f=make(),hp=f.u.hp,calc=[],done=[];f.b.on('calculatedDamage',c=>calc.push(c));f.b.on('damaged',c=>done.push(c));f.b.addBuff(f.u,{key:'qa:barrier',shield:10,onShieldAbsorb:c=>{assert.equal(c.depleted,true);near(c.absorbed,10);near(c.remaining,90);c.remaining=0;}});near(hit(f,100),0);near(f.u.hp,hp);near(calc[0].amount,100);near(done[0].hpLoss,0);assert.equal(f.u.findBuff('qa:barrier'),null);
});
test('native barrier that does not cap overflow preserves ordinary residual HP damage',()=>{const f=make(),hp=f.u.hp;f.b.addBuff(f.u,{key:'qa:barrier',shield:10,onShieldAbsorb:()=>{}});near(hit(f,100),90);near(f.u.hp,hp-90);});
test('hit-count barriers resolve before native HP barriers and never spend their callback budget',()=>{const f=make();let calls=0;const s=f.b.addBuff(f.u,{key:'qa:native',shield:10,onShieldAbsorb:()=>calls++});f.b.addBuff(f.u,{key:'qa:count',shieldHits:1});near(hit(f,100),0);near(s.shield,10);assert.equal(calls,0);assert.equal(f.u.findBuff('qa:count'),null);});
for(const mode of['dodge','cancel','invulnerable','zero','drain','gauge'])test(`native shield callbacks do not run for ${mode} outside an accepted absorption`,()=>{
 const f=make();let calls=0;const s=f.b.addBuff(f.u,{key:'qa:native',shield:1000,onShieldAbsorb:()=>calls++});
 if(mode==='dodge')f.b.addBuff(f.u,{key:'qa:dodge',mods:{dodgePhys:1}});if(mode==='cancel')f.b.on('hit',c=>c.cancel=true);if(mode==='invulnerable')f.b.addBuff(f.u,{key:'qa:invulnerable',flags:{invulnerable:true}});
 if(mode==='drain')f.b.loseHp(f.u,100);else if(mode==='gauge')f.b.dealDamage(f.e,f.u,{amount:100,type:'element',element:'neural'});else hit(f,mode==='zero'?0:100,mode==='dodge'?'phys':'true',{canDodge:mode==='dodge'});
 assert.equal(calls,0);near(s.shield,1000);
});
for(const value of[NaN,Infinity,-1,1000])test(`invalid native remainder ${value} cannot grow or poison damage`,()=>{const f=make();f.b.addBuff(f.u,{key:'qa:native',shield:10,onShieldAbsorb:c=>c.remaining=value});near(hit(f,100),90);assert.deepEqual(f.b.errors,[]);});
test('newly replenished native barrier is not consumed by the same hit',()=>{
 const f=make();let calls=0;const add=()=>f.b.addBuff(f.u,{key:'qa:native',shield:10,onShieldAbsorb:c=>{calls++;add();c.remaining=0;}});add();near(hit(f,100),0);assert.equal(calls,1);near(f.u.findBuff('qa:native').shield,10);near(hit(f,100),0);assert.equal(calls,2);
});
test('same-packet callback replacement survives removal of the exhausted original buff',()=>{
 const f=make();const original=f.b.addBuff(f.u,{key:'qa:native',shield:10,onShieldAbsorb:()=>f.b.addBuff(f.u,{key:'qa:native',shield:20})});near(hit(f,100),90);const next=f.u.findBuff('qa:native');assert.notEqual(next,original);near(next.shield,20);
});
test('snapshot processing skips removed shields without consuming replacements at another key',()=>{
 const f=make();f.b.addBuff(f.u,{key:'qa:first',shield:10,onShieldAbsorb:()=>{f.b.removeBuff(f.u,'qa:second');f.b.addBuff(f.u,{key:'qa:second',shield:1000});}});f.b.addBuff(f.u,{key:'qa:second',shield:20});near(hit(f,100),90);near(f.u.findBuff('qa:second').shield,1000);
});
for(const mode of['retreat','kill','life'])test(`recipient ${mode} inside absorption cannot apply old damage to a removed/new life`,()=>{
 const f=make(),hp=f.u.hp;f.b.addBuff(f.u,{key:'qa:native',shield:10,onShieldAbsorb:()=>{if(mode==='retreat')f.b.retreat(f.u,{permanent:true});if(mode==='kill')f.b.kill(f.u,null);if(mode==='life')f.u.deploySeq++;}});near(hit(f,100),0);if(mode==='life')near(f.u.hp,hp);assert.deepEqual(f.b.errors,[]);
});
test('nested independent damage sees a newly replenished barrier without replaying the outer callback',()=>{
 const f=make();let calls=0;const add=()=>f.b.addBuff(f.u,{key:'qa:native',shield:10,onShieldAbsorb:c=>{calls++;c.remaining=0;if(calls===1){add();hit(f,100);}}});add();near(hit(f,100),0);assert.equal(calls,2);assert.equal(f.u.findBuff('qa:native'),null);
});
test('typed barrier filters stay authoritative on the callback path',()=>{
 const f=make();let calls=0;const s=f.b.addBuff(f.u,{key:'qa:native',shield:1000,shieldTypes:['arts'],shieldApplyWays:['ranged'],shieldSourceSides:['enemy'],onShieldAbsorb:()=>calls++});
 hit(f,100,'true',{applyWay:'ranged'});hit(f,100,'arts',{applyWay:'melee'});f.b.dealDamage(null,f.u,{amount:100,type:'arts',applyWay:'ranged'});near(s.shield,1000);assert.equal(calls,0);hit(f,100,'arts',{applyWay:'ranged'});assert.equal(calls,1);
});
test('ordinary earlier shields retain ordering before a source callback and later foreign barriers remain untouched after cancellation',()=>{
 const f=make();f.b.addBuff(f.u,{key:'qa:earlier',shield:50});f.b.addBuff(f.u,{key:'qa:native',shield:10,onShieldAbsorb:c=>c.remaining=0});const last=f.b.addBuff(f.u,{key:'qa:later',shield:1000});near(hit(f,100),0);assert.equal(f.u.findBuff('qa:earlier'),null);near(last.shield,1000);
});
test('source-owned empty barrier keeps its exact position while cancelling nested reentrant damage',()=>{
 const f=make(),hp=f.u.hp;let responding=false,outer=0,nested=0;
 const shield=f.b.addBuff(f.u,{key:'qa:guard',shield:10,onShieldAbsorbWhenEmpty:true,keepDepletedShield:true,onShieldAbsorb:c=>{
  c.remaining=0;if(responding){nested++;near(c.absorbed,0);return;}outer++;responding=true;hit(f,100);responding=false;f.b.removeBuff(f.u,c.buff);
 }});near(hit(f,100),0);near(f.u.hp,hp);assert.equal(outer,1);assert.equal(nested,1);assert.equal(f.u.buffs.includes(shield),false);assert.deepEqual(f.b.errors,[]);
});
test('an empty source guard does not bypass an earlier positive shield for the nested packet',()=>{
 const f=make();let nested=false,first;
 f.b.addBuff(f.u,{key:'qa:guard',shield:10,onShieldAbsorbWhenEmpty:true,keepDepletedShield:true,onShieldAbsorb:c=>{
  c.remaining=0;if(nested)return;nested=true;first=f.b.addBuff(f.u,{key:'qa:first',shield:50});f.u.buffs.splice(f.u.buffs.indexOf(first),1);f.u.buffs.unshift(first);hit(f,100);f.b.removeBuff(f.u,c.buff);
 }});near(hit(f,100),0);assert.equal(f.u.findBuff('qa:first'),null);assert.deepEqual(f.b.errors,[]);
});
test('empty source guard still applies type and application filters before its callback',()=>{
 const f=make();let n=0;f.b.addBuff(f.u,{key:'qa:guard',shield:0,onShieldAbsorbWhenEmpty:true,keepDepletedShield:true,shieldTypes:['arts'],shieldApplyWays:['ranged'],onShieldAbsorb:c=>{n++;c.remaining=0;}});
 near(hit(f,100,'true',{applyWay:'ranged'}),100);near(hit(f,100,'arts',{applyWay:'melee'}),80);assert.equal(n,0);near(hit(f,100,'arts',{applyWay:'ranged'}),0);assert.equal(n,1);
});
test('ordinary exhausted callback barriers retain automatic cleanup without source-lifecycle opt-in',()=>{
 const f=make();let n=0;f.b.addBuff(f.u,{key:'qa:ordinary',shield:10,onShieldAbsorb:()=>n++});hit(f,10);hit(f,10);assert.equal(n,1);assert.equal(f.u.findBuff('qa:ordinary'),null);
});
test('an explicitly empty callback barrier normalizes invalid negative/NaN budgets without poisoning a packet',()=>{
 for(const value of[-1,NaN]){const f=make();f.b.addBuff(f.u,{key:'qa:guard',shield:value,onShieldAbsorbWhenEmpty:true,onShieldAbsorb:c=>{near(c.absorbed,0);c.remaining=0;}});near(hit(f,100),0);assert.deepEqual(f.b.errors,[]);}
});
