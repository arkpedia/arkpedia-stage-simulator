// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make,advance,near} from './helpers/mcnist-barrier-fixture.js';
import {normalizeChess} from '../server/sim/simdata.js';
import {MCGRAF_ID} from '../server/sim/content/arkpedia-mcnist-source.js';
const hurt=(f,amount,target=f.u,type='true',opts={})=>f.b.dealDamage(null,target,{amount,type,canDodge:false,...opts});
const shield=(f,t=f.u)=>t.findBuff(`mcnist:t2:barrier:${t.id}`);
function token(f,{hp=2000,defer=false,register=true,owner=f.u,id=MCGRAF_ID,col=7}={}){
 const d=normalizeChess({chessId:id,charId:id,name:'Diagnostic original McGraf instance',profession:'TOKEN',position:'MELEE',stats:{maxHp:hp,atk:0,def:100,res:20,cost:0,blockCnt:1},skill:null});
 const t=f.b._makeAlly(f.u.player,d,'token',5,col,{dir:'RIGHT',ownerUnit:owner});
 f.b._setupUnit(t,{trait:{noAttack:true},talents:[],skill:null});if(register)f.resources.registerToken(t);
 const deploy=()=>assert.ok(f.b._deploy(t));if(!defer)deploy();return{t,deploy};
}
for(const elite of[0,1,2])for(const potential of[1,4,5,6])test(`Mechanist E${elite}/P${potential} deployment barrier uses the selected promotion/potential operand`,()=>{
 const f=make({elite,potential});if(elite<2)assert.equal(shield(f),null);else near(shield(f).shield,f.u.s.maxHp*(potential>=5?.4:.3));assert.deepEqual(f.b.errors,[]);
});
for(const skill of[1,2,3])test(`Mechanist selected S${skill} has the same independent T2 barrier without activating a skill`,()=>{
 const f=make({skill}),hp=f.u.hp,budget=shield(f).shield;hurt(f,budget+100000);near(f.u.hp,hp);assert.equal(shield(f),null);hurt(f,100);near(f.u.hp,hp-100);assert.equal(f.attacks.length,0);
});
for(const type of['phys','arts','true','elemental'])test(`Mechanist T2 blocks accepted ${type} damage and cancels the breaking hit overflow`,()=>{
 const f=make(),s=shield(f),hp=f.u.hp;hurt(f,100,f.u,type);assert.ok(s.shield< f.u.s.maxHp*.3);const e=f.resources.entries.get(f.u);assert.ok(e.absorbed>0);hurt(f,100000,f.u,type);near(f.u.hp,hp);assert.equal(e.overflows,1);assert.equal(shield(f),null);
});
test('Mechanist barrier snapshots maximum HP at accepted deployment, rather than following later HP buffs',()=>{
 const f=make({defer:true});f.b.on('deploy',({unit})=>{if(unit===f.u)f.b.addBuff(f.u,{key:'qa:hp-before',mods:{hpPct:1}});},{priority:10});f.deploy();near(shield(f).shield,3631*2*.3);f.b.addBuff(f.u,{key:'qa:hp-after',mods:{hpPct:1}});near(shield(f).shield,3631*2*.3);
});
test('Mechanist exact exhaustion cancels no future hit and does not regenerate through time or healing',()=>{
 const f=make(),budget=shield(f).shield;hurt(f,budget);assert.equal(shield(f),null);advance(f.b,5);f.b.heal(null,f.u,1000);assert.equal(shield(f),null);const hp=f.u.hp;hurt(f,1);near(f.u.hp,hp-1);
});
for(const mode of['cancel','invulnerable','drain','gauge','zero'])test(`Mechanist barrier ignores ${mode} outside accepted HP absorption`,()=>{
 const f=make(),s=shield(f),budget=s.shield;
 if(mode==='cancel')f.b.on('hit',c=>c.cancel=true);
 if(mode==='invulnerable')f.b.addBuff(f.u,{key:'qa:invuln',flags:{invulnerable:true}});
 if(mode==='drain')f.b.loseHp(f.u,10);else if(mode==='gauge')hurt(f,100,f.u,'element',{element:'neural'});else hurt(f,mode==='zero'?0:100);
 near(s.shield,budget);assert.equal(f.resources.entries.get(f.u).absorbed,0);
});
test('Mechanist hit-count protection spends before the deployment HP barrier',()=>{
 const f=make(),s=shield(f),budget=s.shield;f.b.addBuff(f.u,{key:'qa:count',shieldHits:1});hurt(f,100000);near(s.shield,budget);assert.equal(f.resources.entries.get(f.u).absorbed,0);
});
test('Mechanist silence, stun and disarm do not suspend passive barrier absorption',()=>{
 const f=make(),hp=f.u.hp;for(const k of['silence','stun','disarm'])f.b.applyStatus(f.u,k,{duration:10});hurt(f,100000);near(f.u.hp,hp);assert.equal(shield(f),null);
});
test('Mechanist foreign-source shield does not prevent its own exhausted barrier overflow guard',()=>{
 const f=make(),foreign=f.b.addBuff(f.u,{key:'qa:foreign',source:{id:'foreign'},shield:10}),hp=f.u.hp;hurt(f,100000);near(f.u.hp,hp);near(foreign.shield,10);
});
test('Mechanist another same-owner barrier keeps remaining damage live until that barrier absorbs it',()=>{
 const f=make(),same=f.b.addBuff(f.u,{key:'qa:same-owner',source:f.u,shield:10}),hp=f.u.hp,budget=shield(f).shield;
 near(hurt(f,budget+30),20);near(f.u.hp,hp-20);assert.equal(f.u.findBuff(same.key),null);
});
test('Mechanist registered McGraf barrier uses its own maximum HP and lifetime',()=>{
 const f=make(),{t}=token(f),owner=shield(f);near(shield(f,t).shield,600);hurt(f,100000,t);near(t.hp,t.s.maxHp);assert.equal(shield(f,t),null);assert.equal(shield(f),owner);hurt(f,10,t);near(t.hp,t.s.maxHp-10);
});
test('Mechanist McGraf P5 barrier uses the potential operand without borrowing owner HP',()=>{const f=make({potential:5}),{t}=token(f,{hp:500});near(shield(f,t).shield,200);});
for(const elite of[0,1])test(`Mechanist E${elite} cannot invent an E2 barrier on its token`,()=>{
 const f=make({elite});if(elite===0)assert.throws(()=>token(f));else{const{t}=token(f);assert.equal(shield(f,t),null);}assert.equal(shield(f),null);
});
test('Mechanist linked McGraf shields count as family while unrelated summons remain foreign',()=>{
 const f=make(),{t}=token(f),hp=f.u.hp,budget=shield(f).shield;f.b.addBuff(f.u,{key:'qa:token-source',source:t,shield:10});near(hurt(f,budget+30),20);near(f.u.hp,hp-20);
});
test('Mechanist owner stop removes only its barrier and keeps an already deployed McGraf independent',()=>{
 const f=make(),{t}=token(f),s=shield(f,t);f.resources.stop();assert.equal(shield(f),null);assert.equal(shield(f,t),s);hurt(f,100000,t);near(t.hp,t.s.maxHp);f.b.retreat(t,{permanent:true});assert.equal(f.resources.entries.size,0);assert.equal(f.resources.tokenHandles.length,0);
});
test('Mechanist pending McGraf registration is cancelled on owner retirement',()=>{
 const f=make(),p=token(f,{defer:true});f.resources.stop();p.deploy();assert.equal(shield(f,p.t),null);assert.equal(f.resources.tokens.size,0);assert.equal(f.resources.tokenHandles.length,0);
});
for(const mode of['retreat','death','life'])test(`Mechanist token ${mode} removes old-life barrier ownership without touching owner`,()=>{
 const f=make(),{t}=token(f),s=shield(f);if(mode==='retreat')f.b.retreat(t,{permanent:true});if(mode==='death')f.b.kill(t,null);if(mode==='life'){t.deploySeq++;advance(f.b,.1);}assert.equal(shield(f,t),null);assert.equal(shield(f),s);assert.equal(f.resources.tokens.size,0);
});
for(const mode of['reject','stop','retreat','life'])test(`Mechanist reentrant ${mode} during barrier admission never leaves an orphan`,()=>{
 const f=make({defer:true});f.b.on('beforeBuff',c=>{if(!c.buff.key.startsWith('mcnist:t2:'))return;if(mode==='reject')c.cancel=true;if(mode==='stop')f.resources.stop();if(mode==='retreat')f.b.retreat(f.u,{permanent:true});if(mode==='life')f.u.deploySeq++;});f.deploy();assert.equal(shield(f),null);assert.equal(f.resources.entries.size,0);assert.deepEqual(f.b.errors,[]);
});
test('Mechanist rejected McGraf attachment records no hidden barrier or callback',()=>{
 const f=make();f.b.on('beforeBuff',c=>{if(c.unit!==f.u&&c.buff.key.startsWith('mcnist:t2:'))c.cancel=true;});const{t}=token(f);assert.equal(shield(f,t),null);assert.equal(f.resources.entries.has(t),false);const hp=t.hp;hurt(f,10,t);near(t.hp,hp-10);
});
test('Mechanist rejects foreign identity, unlinked owner, duplicate registration and already deployed tokens',()=>{
 const f=make();assert.throws(()=>token(f,{id:'wrong'}));assert.throws(()=>token(f,{owner:{id:'foreign'}}));const p=token(f,{defer:true});assert.throws(()=>f.resources.registerToken(p.t));p.deploy();assert.throws(()=>f.resources.registerToken(p.t));
 const q=token(f,{register:false,col:8});assert.throws(()=>f.resources.registerToken(q.t));
});
test('Mechanist source admission rejects altered selected inputs and missing explicit contract',()=>{
 assert.throws(()=>make({contract:{}}));for(const mutate of[d=>d.stats.maxHp++,d=>d.skill.bb.atk_scale=100,d=>d.skill.spCost++,d=>d.talents=[],d=>d.rangeGrid.push([9,9])])assert.throws(()=>make({mutate}));
});
test('Mechanist battle-end cleanup removes owner and independently registered token barriers',()=>{
 const f=make(),{t}=token(f);f.b.finished=true;f.b.emit('battleEnd',{});assert.equal(shield(f),null);assert.equal(shield(f,t),null);assert.equal(f.resources.handles.length,0);assert.equal(f.resources.tokenHandles.length,0);assert.equal(f.resources.entries.size,0);
});

test('Mechanist repeated token lives release retired family identities after their last authored barrier ends',()=>{
 const f=make(),{t}=token(f),s=f.b.addBuff(f.u,{key:'qa:retired-source',source:t,shield:10});f.b.retreat(t,{permanent:true});assert.ok(f.resources.members.has(t));f.b.removeBuff(f.u,s);hurt(f,100000);assert.equal(f.resources.members.has(t),false);
 const p=token(f,{col:8});f.b.retreat(p.t,{permanent:true});assert.equal(f.resources.members.size,1);
});
test('Mechanist token unregistration inside admission removes the pending barrier without affecting owner',()=>{
 const f=make(),p=token(f,{defer:true}),owner=shield(f);f.b.on('beforeBuff',c=>{if(c.unit===p.t)f.resources.removeToken(p.t);});p.deploy();assert.equal(shield(f,p.t),null);assert.equal(shield(f),owner);assert.equal(f.resources.entries.size,1);
});
