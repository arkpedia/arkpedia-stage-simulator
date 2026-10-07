// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec, enemyRec } from './helpers/battleHarness.js';
function fixture() {
 const h=makeBattle({content:'none',autoFinish:false,
  defs:{chess:{guard:chessRec({id:'guard',skill:null,stats:{maxHp:100000,def:100,res:20}})},
   enemies:{enemy:enemyRec({key:'enemy',hp:100000,atk:100,speed:0})}},
  units:[{chessId:'guard',row:10,col:5}],enemies:[{key:'enemy',pos:[10,5.3]}]});
 h.step();const b=h.b,u=h.unit('guard'),e=h.enemies()[0];u.atkCd=e.atkCd=1000;return{h,b,u,e};
}
const near=(a,e)=>assert.ok(Math.abs(a-e)<1e-7,`${a} != ${e}`);
test('opt-in final damage observes DEF/RES, multipliers and flat cuts before HP shields',()=>{
 for(const type of['phys','arts']){
  const{b,u,e}=fixture();b.addBuff(u,{key:'test:mitigation',mods:{dmgTakenMul:.8,flatDamageResistance:10}});
  b.addBuff(u,{key:'test:shield',shield:50});let original;
  b.on('damageFinal',ctx=>{assert.equal(ctx.source,e);assert.equal(ctx.target,u);assert.equal(ctx.dmg.type,type);original=ctx.amount;ctx.amount*=.5;});
  const expected=(type==='phys'?500-u.s.def:500*(1-u.s.res/100))*.8-10;
  const hp=u.hp;near(b.dealDamage(e,u,{amount:500,type}),Math.max(0,expected*.5-50));near(original,expected);near(hp-u.hp,expected*.5-50);assert.deepEqual(b.errors,[]);
 }
});
test('barriers absorb modified hits and dodged/cancelled hits never reach final damage modifiers',()=>{
 const{b,u,e}=fixture();let calls=0;b.on('damageFinal',ctx=>{calls++;ctx.amount*=.5;});
 b.addBuff(u,{key:'test:barrier',shieldHits:1});const hp=u.hp;near(b.dealDamage(e,u,{amount:500,type:'phys'}),0);near(u.hp,hp);assert.equal(calls,1);assert.equal(u.findBuff('test:barrier'),null);
 b.addBuff(u,{key:'test:dodge',mods:{dodgePhys:1}});near(b.dealDamage(e,u,{amount:500,type:'phys'}),0);assert.equal(calls,1);b.removeBuff(u,'test:dodge');
 b.on('hit',ctx=>{ctx.dmg.cancel=true;});near(b.dealDamage(e,u,{amount:500,type:'arts'}),0);assert.equal(calls,1);assert.deepEqual(b.errors,[]);
});
test('element gauges and pure HP loss bypass the new final damage modifier',()=>{
 const{b,u,e}=fixture();let calls=0;b.on('damageFinal',ctx=>{calls++;ctx.amount=0;});
 b.dealDamage(e,u,{amount:100,type:'element',element:'neural'});assert.equal(calls,0);const hp=u.hp;b.loseHp(u,50,{source:e});near(hp-u.hp,50);assert.equal(calls,0);assert.deepEqual(b.errors,[]);
});
test('ordinary damage remains unchanged without a final modifier, and invalid modified amounts cannot corrupt HP',()=>{
 const{b,u,e}=fixture();near(b.dealDamage(e,u,{amount:500,type:'phys'}),500-u.s.def);const hp=u.hp;
 b.on('damageFinal',ctx=>{ctx.amount=NaN;});near(b.dealDamage(e,u,{amount:500,type:'arts'}),0);near(u.hp,hp);assert.deepEqual(b.errors,[]);
});

test('source Arts-only shields skip physical/true/elemental damage and consume only mitigated Arts hits',()=>{
 const{b,u,e}=fixture();b.addBuff(u,{key:'test:arts',shield:200,shieldTypes:['arts']});
 for(const type of['phys','true','elemental']){const hp=u.hp;const n=b.dealDamage(e,u,{amount:150,type,canDodge:false});assert.ok(n>0);near(hp-u.hp,n);near(u.findBuff('test:arts').shield,200);}
 near(b.dealDamage(e,u,{amount:150,type:'arts'}),0);near(u.findBuff('test:arts').shield,200-150*(1-u.s.res/100));
 const left=u.findBuff('test:arts').shield;near(b.dealDamage(e,u,{amount:500,type:'arts'}),500*(1-u.s.res/100)-left);assert.equal(u.findBuff('test:arts'),null);assert.deepEqual(b.errors,[]);
});
test('typed hit barriers and ordinary shields preserve order, refresh filters, and never absorb unknown types',()=>{
 const{b,u,e}=fixture();b.addBuff(u,{key:'test:hit',shieldHits:1,shieldTypes:['arts']});b.addBuff(u,{key:'test:ordinary',shield:1000});
 b.dealDamage(e,u,{amount:300,type:'phys'});assert.equal(u.findBuff('test:hit').shieldHits,1);const remaining=u.findBuff('test:ordinary').shield;
 b.dealDamage(e,u,{amount:300,type:'arts'});assert.equal(u.findBuff('test:hit'),null);near(u.findBuff('test:ordinary').shield,remaining);
 b.removeBuff(u,'test:ordinary');b.addBuff(u,{key:'test:restricted',shield:100,shieldTypes:['arts']});
 b.addBuff(u,{key:'test:restricted',shield:200,shieldTypes:['phys'],refresh:'extend'});const hp=u.hp;assert.ok(b.dealDamage(e,u,{amount:300,type:'arts'})>0);assert.ok(u.hp<hp);near(u.findBuff('test:restricted').shield,200);
 b.addBuff(u,{key:'test:empty',shield:100,shieldTypes:['unknown']});b.dealDamage(e,u,{amount:300,type:'true'});near(u.findBuff('test:empty').shield,100);assert.deepEqual(b.errors,[]);
});
