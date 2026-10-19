// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import {make as base,enemy,advance,near,until} from './helpers/makoto-fixture.js';
import {MakotoAllOutCombat,MAKOTO_ALLOUT_CONTRACT as CONTRACT,verifyMakotoAllOut} from '../server/sim/content/arkpedia-makoto-allout.js';
import {makotoAllOutInputs} from '../server/sim/content/arkpedia-makoto-source.js';
const active=new Set();test.afterEach(()=>{for(const f of active){f.combat.stop();assert.deepEqual(f.b.errors,[]);}active.clear();});
function make({mayBegin,defer=false,...build}={}){
 const f=base({...build,defer:true});f.controller.stop();f.allow=true;f.alloutHits=[];f.b.on('damaged',h=>{if(h.dmg.tags.includes('makoto:allout')&&(h.source===f.u||h.credit===f.u))f.alloutHits.push({...h,time:f.b.time});});
 f.combat=new MakotoAllOutCombat(f.b,f.u,{contract:CONTRACT,mayBegin:mayBegin?(ticket)=>mayBegin(f,ticket):()=>f.allow});
 f.b._setupUnit(f.u,{trait:{noAttack:true},talents:[],skill:{kind:'instant',completeOnAttack:false,trigger:{rule:'NEVER'}}});f.combat.install();active.add(f);if(!defer)f.deploy();return f;
}
function member(f,{row=5,col=7,sees=true,makoto=false,kind='op',hidden=false,flags={}}={}){
 const def={...f.u.def,charId:makoto?f.u.def.charId:'diagnostic:sees',tags:sees?['sees']:[]},t=f.b._makeAlly(f.u.player,def,kind,row,col,{dir:'RIGHT'});
 f.b._setupUnit(t,{trait:{noAttack:true,noBlock:true},talents:[],skill:{kind:'passive'}});f.u.player.dp=99;assert.ok(f.b._deploy(t,{initial:false}));t.hidden=hidden;f.b.addBuff(t,{key:'fixture:recipient',flags});return t;
}
const hits=f=>f.alloutHits;
for(const elite of [0,1,2])for(const potential of [1,3,5,6])test(`All-out E${elite} P${potential} uses the selected talent once after the original world delay`,()=>{
 const f=make({elite,potential}),t=enemy(f),ticket={};assert.equal(f.combat.begin(ticket),true);assert.equal(f.combat.begin(ticket),false);const p=[...f.combat.grants][0];near(p.nextAt-f.b.time,1.600000023841858);
 advance(f.b,1.5);assert.equal(hits(f).length,0);until(f,()=>hits(f).length===1,1);near(hits(f)[0].amount,f.u.s.atk*f.record.talentBb[1].atk_scale);
 assert.equal(hits(f)[0].type,'true');assert.equal(hits(f)[0].source,f.u);assert.equal(hits(f)[0].dmg.sourceless,false);assert.equal(f.combat.grants.size,0);assert.equal(f.receipts.length,0);assert.equal(f.b.projectiles.list.length,0);
 advance(f.b,2);assert.equal(hits(f).length,1);assert.ok(t.hp<t.s.maxHp);
});
test('Overlapping S.E.E.S. participants independently damage an enemy using live Makoto ATK, not their own ATK',()=>{
 const f=make(),a=member(f),t=enemy(f);a.base.atk=1e5;a.markDirty();assert.equal(f.combat.begin({}),true);assert.equal(f.combat.grants.size,2);
 f.b.addBuff(f.u,{key:'fixture:power',mods:{atkPct:1}});until(f,()=>f.combat.grants.size===0);assert.equal(hits(f).length,2);
 for(const h of hits(f))near(h.amount,f.u.s.atk*f.record.talentBb[1].atk_scale);near(f.u.stats.dmg,2*f.u.s.atk*f.record.talentBb[1].atk_scale);assert.ok(t.hp<t.s.maxHp);
});
test('Makoto own True hit has source modifiers; squad True hits use the original sourceless branch with Makoto credit',()=>{
 const f=make();member(f);const t=enemy(f);f.b.addBuff(f.u,{key:'fixture:output',mods:{dmgDealtMul:2}});f.b.addBuff(t,{key:'fixture:incoming',mods:{trueTakenMul:1.5}});
 const damage=[];f.b.on('damaged',h=>{if(h.dmg.tags.includes('makoto:allout'))damage.push(h);});f.combat.begin({});until(f,()=>f.combat.grants.size===0);
 assert.equal(damage.length,2);const self=damage.find(h=>!h.dmg.sourceless),party=damage.find(h=>h.dmg.sourceless),amount=f.u.s.atk*f.record.talentBb[1].atk_scale;
 near(self.amount,amount*3);near(party.amount,amount*1.5);assert.equal(party.source,null);assert.equal(party.credit,f.u);near(f.u.stats.dmg,amount*4.5);
});
test('Each participant uses its own current range center, with all ground/air victims and no target cap',()=>{
 const f=make(),a=member(f,{row:5,col:9}),self=enemy(f,{col:4}),party=enemy(f,{col:10,motion:'FLY'}),extra=enemy(f,{row:4,col:9}),far=enemy(f,{row:10,col:10});
 f.b.addBuff(f.u,{key:'fixture:range',mods:{rangeExtend:10}});f.combat.begin({});until(f,()=>f.combat.grants.size===0);
 assert.equal(hits(f).filter(h=>h.target===self).length,1);assert.equal(hits(f).filter(h=>h.target===party).length,1);assert.equal(hits(f).filter(h=>h.target===extra).length,1);near(far.hp,far.s.maxHp);assert.ok(a.alive);
});
test('Moving a captured participant before its pulse moves its all-out area; it does not use a stale entry position',()=>{
 const f=make(),a=member(f),t=enemy(f,{col:10});f.combat.begin({});a.x=9.5;a.tileC=9;until(f,()=>f.combat.grants.size===0);assert.equal(hits(f).filter(h=>h.target===t).length,1);
});
test('Hidden, target-free, invulnerable and sleeping enemies do not receive an inherited True hit',()=>{
 const f=make(),h=enemy(f),v=enemy(f,{flags:{invulnerable:true}}),a=enemy(f,{flags:{untargetable:true}}),s=enemy(f);h.hidden=true;f.b.applyStatus(s,'sleep',{duration:10});
 f.combat.begin({});until(f,()=>f.combat.grants.size===0);assert.equal(hits(f).length,0);for(const t of [h,v,a,s])near(t.hp,t.s.maxHp);
});
test('Buff damage is not an ordinary attack selector: camouflage does not suppress the all-out area hit',()=>{
 const f=make(),t=enemy(f,{flags:{camou:true}});f.combat.begin({});until(f,()=>f.combat.grants.size===0);assert.equal(hits(f).filter(h=>h.target===t).length,1);
});
test('No-victim participation finishes after its one attempted pulse instead of becoming an infinite future trap',()=>{
 const f=make();f.combat.begin({});until(f,()=>f.combat.grants.size===0);enemy(f);advance(f.b,2);assert.equal(hits(f).length,0);
});
test('The source group snapshot excludes foreign actors, devices/tokens, hidden members and another Makoto UID',()=>{
 const f=make();member(f,{col:7,sees:false});member(f,{col:8,makoto:true});member(f,{col:9,kind:'token'});member(f,{col:10,kind:'device'});member(f,{col:11,hidden:true});f.combat.begin({});assert.equal(f.combat.grants.size,1);
});
test('Group broadcast is independent of healing and isolation selectors',()=>{
 const f=make(),a=member(f,{flags:{healFree:true,isolated:true,untargetable:true}});f.combat.begin({});assert.ok([...f.combat.grants].some(p=>p.owner===a));
});
test('A newly deployed S.E.E.S. participant cannot borrow a previously issued broadcast',()=>{
 const f=make();f.combat.begin({});const a=member(f);assert.equal([...f.combat.grants].some(p=>p.owner===a),false);
});
test('Source and receiver ASPD, slowDown zero, disarm, stun and silence do not retime a born all-out buff',()=>{
 const f=make(),a=member(f);enemy(f);f.combat.begin({});for(const t of [f.u,a])f.b.addBuff(t,{key:'fixture:control',flags:{stun:true,silence:true,disarm:true},mods:{aspd:500,slowDownMul:0}});
 until(f,()=>f.combat.grants.size===0);assert.equal(hits(f).length,2);near(hits(f)[0].time,1.6);near(hits(f)[1].time,1.6);
});
for(const how of ['retreat','death','replace','stop','end'])test(`Source ${how} cancels all owned pending group attacks`,()=>{
 const f=make(),a=member(f);enemy(f);f.combat.begin({});if(how==='retreat')f.b.retreat(f.u);if(how==='death')f.b.kill(f.u,null);if(how==='replace')f.u.deploySeq++;if(how==='stop')f.combat.stop();if(how==='end'){f.b.finished=true;f.b.emit('battleEnd',{});}
 advance(f.b,2);assert.equal(hits(f).length,0);assert.equal(f.combat.grants.size,0);assert.equal(a.buffs.some(b=>b.key.startsWith('makoto:allout:')),false);
});
for(const how of ['retreat','death','replace','hidden','dispel'])test(`Receiver ${how} cancels only that participant without erasing a different group hit`,()=>{
 const f=make(),a=member(f);enemy(f);f.combat.begin({});const p=[...f.combat.grants].find(p=>p.owner===a);
 if(how==='retreat')f.b.retreat(a);if(how==='death')f.b.kill(a,null);if(how==='replace')a.deploySeq++;if(how==='hidden')a.hidden=true;if(how==='dispel')f.b.removeBuff(a,p.buff);
 until(f,()=>f.combat.grants.size===0);assert.equal(hits(f).length,1);
});
test('Source mode departure alone does not erase a nonderived born all-out grant',()=>{
 const f=make();enemy(f);const ticket={};f.combat.begin(ticket);f.allow=false;until(f,()=>f.combat.grants.size===0);assert.equal(hits(f).length,1);assert.equal(f.combat.begin({}),false);
});
for(const how of ['reject','source','receiver','metadata'])test(`beforeBuff ${how} cannot issue inherited all-out output`,()=>{
 const f=make(),a=member(f);enemy(f);f.b.on('beforeBuff',h=>{if(h.unit!==a||!h.buff.key.startsWith('makoto:allout:'))return;
 if(how==='reject')h.cancel=true;if(how==='source')f.u.deploySeq++;if(how==='receiver')a.deploySeq++;if(how==='metadata')h.buff.data={};
 });f.combat.begin({});advance(f.b,2);assert.equal(hits(f).length,how==='source'?0:1);
});
test('The return ticket is claimed before reentrant grant callbacks and cannot broadcast a second time',()=>{
 const f=make(),ticket={};member(f);f.b.on('beforeBuff',h=>{if(h.buff.key.startsWith('makoto:allout:'))assert.equal(f.combat.begin(ticket),false);});
 f.combat.begin(ticket);assert.equal(f.combat.grants.size,2);advance(f.b,2);assert.equal(f.combat.begin(ticket),false);assert.equal(f.combat.begin({}),true);
});
test('Duplicate/reentrant pulse calls claim one native group attempt before damage callbacks',()=>{
 const f=make();enemy(f);f.combat.begin({});const p=[...f.combat.grants][0];f.b.on('damaged',h=>{if(h.dmg.tags.includes('makoto:allout'))assert.equal(f.combat.pulse(p),false);});until(f,()=>f.combat.grants.size===0);assert.equal(hits(f).length,1);
});
test('Replacement of a captured enemy during a prior victim callback cannot inherit old output',()=>{
 const f=make(),a=enemy(f),z=enemy(f);f.combat.begin({});let done=false;f.b.on('damaged',h=>{if(!done&&h.dmg.tags.includes('makoto:allout')){done=true;const other=h.target===a?z:a;other.deploySeq++;}});
 until(f,()=>f.combat.grants.size===0);assert.equal(hits(f).length,1);
});
for(const [label,edit]of[
 ['rounded clock',n=>n.templates.makoto_on_enter_normal.eventToActions.ON_BUFF_START[0]._succeedNodes[0]._buffData.triggerInterval=1.6],
 ['ordinary source for party',n=>n.templates.makoto_allout_attack_damage.eventToActions.ON_BUFF_TRIGGER[0]._failNodes[0]._damageConfig.isNoSourceDamage=false],
 ['Arts substitute',n=>n.templates.makoto_allout_attack_damage.eventToActions.ON_BUFF_TRIGGER[0]._succeedNodes[0]._damageConfig.damageType='MAGICAL'],
 ['ground-only selector',n=>n.selector._targetMotion=1],['range extension',n=>n.range._extendable=1],['missing owner cleanup',n=>n.templates.makoto_talent_2.eventToActions.ON_OWNER_FINISH[0]._checkBuffSource=false],
])test(`Changed original all-out ${label} is rejected`,()=>{const n=structuredClone(makotoAllOutInputs());edit(n);assert.throws(()=>verifyMakotoAllOut(n),/Changed original/);});
for(const how of ['coefficient','source-branch','deadline'])test(`Altered born-grant ${how} fails closed rather than fabricating output`,()=>{
 const f=make(),a=member(f);enemy(f);f.b.on('beforeBuff',h=>{if(h.unit!==a||!h.buff.key.startsWith('makoto:allout:'))return;const p=h.buff.data.makotoAllout;
 if(how==='coefficient')p.bb.atk_scale=100;if(how==='source-branch')p.sourceLess=false;if(how==='deadline')p.nextAt=0;
 });f.combat.begin({});assert.equal([...f.combat.grants].some(p=>p.owner===a),false);until(f,()=>f.combat.grants.size===0);assert.equal(hits(f).length,1);
});
test('A later accepted native broadcast replaces its own pending receiver buff rather than stacking duplicate participation',()=>{
 const f=make();enemy(f);f.combat.begin({});const old=[...f.combat.grants][0];advance(f.b,.5);assert.equal(f.combat.begin({}),true);assert.equal(old.finished,true);assert.equal(f.combat.grants.size,1);
 const current=[...f.combat.grants][0];near(current.nextAt-f.b.time,1.600000023841858);until(f,()=>f.combat.grants.size===0);assert.equal(hits(f).length,1);
});
test('A refused replacement broadcast preserves the already accepted receiver grant',()=>{
 const f=make();enemy(f);f.combat.begin({});const old=[...f.combat.grants][0];f.b.on('beforeBuff',h=>{if(h.buff.key===old.key)h.cancel=true;});assert.equal(f.combat.begin({}),false);assert.equal(f.combat.grants.has(old),true);
 until(f,()=>f.combat.grants.size===0);assert.equal(hits(f).length,1);
});
test('Different original Makoto sources retain independent receiver grants; owner-finish cleanup cannot erase the other source',()=>{
 const f=make(),other=f.b._makeAlly(f.u.player,f.u.def,'op',5,4,{dir:'RIGHT'}),second=new MakotoAllOutCombat(f.b,other,{contract:CONTRACT,mayBegin:()=>true});
 f.b._setupUnit(other,{trait:{noAttack:true},talents:[],skill:{kind:'passive'}});second.install();f.u.player.dp=99;assert.ok(f.b._deploy(other,{initial:false}));active.add({b:f.b,combat:second});
 const a=member(f),t=enemy(f),out=[];f.b.on('damaged',h=>{if(h.dmg.tags.includes('makoto:allout'))out.push(h);});
 f.combat.begin({});second.begin({});assert.equal(f.combat.grants.size,2);assert.equal(second.grants.size,2);const foreign=[...second.grants].find(p=>p.owner===a).buff;
 f.combat.stop();assert.equal(a.buffs.includes(foreign),true);until(f,()=>second.grants.size===0);assert.equal(out.length,2);assert.ok(out.every(h=>h.credit===other));assert.ok(t.hp<t.s.maxHp);
});
