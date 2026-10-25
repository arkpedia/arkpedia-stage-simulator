// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {battle,keys} from './helpers/ch17Harness.js';
import {chapter17Environment,registerChapter17Firewall,clickChapter17Firewall as click,chapter17FirewallSnapshot as snapshot} from '../server/sim/content/chapter17.js';
function fixture(options={}){const f=battle(keys[3]),env=chapter17Environment(f.b),broken=[];
 const wall=registerChapter17Firewall(f.b,f.e,{onBreak:index=>broken.push(index),...options});return{...f,env,wall,broken};}
const all=f=>{f.env.expose(f.e,{allSides:true});return snapshot(f.b);};
const taps=(f,input,n=3)=>{for(let i=0;i<n;i++)assert.equal(click(f.b,input),true);};

test('snake initialization source requests every wall while the frozen environment retains three clicks and five seconds',()=>{
 const graph=JSON.parse(readFileSync(new URL('../data/candidates/arkpedia-ch17-firewall-boss-source.json',import.meta.url)));
 const action=JSON.parse(JSON.parse(graph.templates.enemy_musnake_init_fire_button.originalJson).eventToActions._items.find(e=>e.key===1).value.SerializedState)[0];
 assert.equal(action._createForAllWalls,true);assert.equal(action._radiationSourceType,'SOURCE');
 const source=JSON.parse(readFileSync(new URL('../data/candidates/arkpedia-ch16-action-source.json',import.meta.url)));
 const config=Object.entries(source.environments).find(([k])=>k.endsWith('env_v073_mainline17_boss_ctrl.prefab'))[1].map(r=>JSON.parse(r.originalJson)).find(r=>r._bossFirewallEffectConfigs)._bossFirewallEffectConfigs.find(c=>c.bossId==='enemy_1593_musnake');
 assert.equal(config.firewallWidth,7);assert.equal(config.firewallHeight,4);assert.equal(config.vulnerabilityRequiredClickCount,3);assert.equal(config.vulnerabilityButtonDuration,5);
});
test('all four sides expose independent three-click windows and breaking one preserves the other progress',()=>{
 const f=fixture({width:7,height:4}),inputs=all(f);assert.deepEqual(inputs.map(i=>i.side),[0,1,2,3]);assert.ok(inputs.every(i=>i.remaining===5&&i.required===3));
 taps(f,inputs[0],1);taps(f,inputs[2],2);assert.deepEqual(snapshot(f.b).map(i=>i.clicks),[1,0,2,0]);taps(f,inputs[2],1);
 assert.deepEqual(f.broken,[2]);assert.deepEqual(snapshot(f.b).map(i=>i.side),[0,1,3]);assert.equal(snapshot(f.b).find(i=>i.side===0).clicks,1);assert.equal(click(f.b,inputs[2]),false);
 for(const i of inputs.filter(i=>i.side!==2))taps(f,i,i.side===0?2:3);assert.deepEqual(f.broken,[2,0,1,3]);assert.deepEqual(snapshot(f.b),[]);assert.deepEqual(f.b.errors,[]);
});
test('one-side reexposure resets only that side and retains other still-live button identities',()=>{
 const f=fixture(),inputs=all(f);taps(f,inputs[3],2);taps(f,inputs[0],1);f.h.run(1);
 f.env.expose({x:f.e.x-5,y:f.e.y});const current=snapshot(f.b),left=current.find(i=>i.side===3),top=current.find(i=>i.side===0);
 assert.equal(left.clicks,0);assert.notEqual(left.exposureId,inputs[3].exposureId);assert.equal(top.clicks,1);assert.equal(top.exposureId,inputs[0].exposureId);
 assert.equal(click(f.b,inputs[3]),false);assert.equal(click(f.b,inputs[0]),true);assert.equal(current.length,4);assert.deepEqual(f.b.errors,[]);
});
test('different side windows expire independently at their own five-second boundary',()=>{
 const f=fixture(),inputs=all(f),firstDeadline=f.b.time+inputs[0].remaining;f.h.run(1);f.env.expose({x:f.e.x-5,y:f.e.y});const left=snapshot(f.b).find(i=>i.side===3),leftDeadline=f.b.time+left.remaining;
 f.b.time=firstDeadline;assert.equal(click(f.b,inputs[0]),false);assert.deepEqual(snapshot(f.b).map(i=>i.side),[3]);assert.equal(click(f.b,left),true);
 f.b.time=leftDeadline;assert.equal(click(f.b,left),false);assert.deepEqual(snapshot(f.b),[]);assert.deepEqual(f.broken,[]);
});
test('perimeter refresh rejects old packets even after all sides are exposed again at the same indices',()=>{
 const f=fixture(),old=all(f);taps(f,old[1],2);f.e.x+=2;assert.equal(f.wall.refresh(),true);const next=all(f);
 for(const i of old)assert.equal(click(f.b,i),false);assert.ok(next.every(i=>i.clicks===0));assert.equal(f.wall.sides[1].x,f.e.x+1.5);taps(f,next[1]);assert.deepEqual(f.broken,[1]);
});
for(const retirement of ['death','removed','reuse','battleEnd'])test('all side inputs retire together on '+retirement,()=>{
 const f=fixture(),inputs=all(f);if(retirement==='death')f.b.kill(f.e,null);if(retirement==='removed')f.b.emit('removed',{unit:f.e});
 if(retirement==='reuse')f.e.deploySeq++;if(retirement==='battleEnd')f.b.forceEnd();for(const i of inputs)assert.equal(click(f.b,i),false);
 assert.deepEqual(snapshot(f.b),[]);assert.equal(f.wall.active,false);assert.deepEqual(f.broken,[]);assert.deepEqual(f.b.errors,[]);
});
test('retired wall input cannot reach a replacement wall owned by the same live deployment',()=>{
 const f=fixture(),old=all(f);f.wall.retire();const wall=registerChapter17Firewall(f.b,f.e,{onBreak:i=>f.broken.push(i)});f.env.expose(f.e,{allSides:true});const next=snapshot(f.b);
 assert.notEqual(wall.id,f.wall.id);for(const input of old)assert.equal(click(f.b,input),false);taps(f,next[0]);assert.deepEqual(f.broken,[0]);
});
test('independent owners and malformed inputs cannot progress another boss wall',()=>{
 const f=fixture(),other=f.h.spawn(keys[3],{pos:[10,9]}),second=registerChapter17Firewall(f.b,other);all(f);const inputs=snapshot(f.b),input=inputs[0];assert.equal(inputs.length,8);
 for(const bad of [null,{}, {...input,ownerId:other.id},{...input,ownerLife:input.ownerLife+1},{...input,wallId:second.id}, {...input,exposureId:input.exposureId+1},{...input,side:-1},{...input,side:4},{...input,side:'0'}])assert.equal(click(f.b,bad),false);
 assert.ok(snapshot(f.b).every(i=>i.clicks===0));taps(f,inputs.find(i=>i.ownerId===other.id));assert.equal(snapshot(f.b).filter(i=>i.ownerId===f.e.id).length,4);assert.deepEqual(f.broken,[]);assert.deepEqual(f.b.errors,[]);
});
test('reentrant break refresh does not let old cleanup erase newly exposed buttons',()=>{
 let f;f=fixture({onBreak:()=>{f.wall.refresh();f.env.expose(f.e,{allSides:true});}});const old=all(f);taps(f,old[0]);const next=snapshot(f.b);
 assert.equal(next.length,4);assert.ok(next.every(i=>i.clicks===0));assert.equal(click(f.b,old[0]),false);assert.notEqual(next[0].exposureId,old[0].exposureId);assert.deepEqual(f.b.errors,[]);
});
test('broken sides do not reappear until a full native perimeter refresh',()=>{
 const f=fixture(),inputs=all(f);taps(f,inputs[0]);f.env.expose(f.e,{allSides:true});assert.deepEqual(snapshot(f.b).map(i=>i.side),[1,2,3]);
 f.wall.refresh();all(f);assert.deepEqual(snapshot(f.b).map(i=>i.side),[0,1,2,3]);assert.deepEqual(f.b.errors,[]);
});
test('snapshots are plain copies and invalid perimeter parameters create no wall',()=>{
 const f=fixture(),input=all(f)[0];input.clicks=999;input.remaining=0;assert.equal(snapshot(f.b)[0].clicks,0);assert.equal(snapshot(f.b)[0].remaining,5);
 const count=f.env.firewalls.length;for(const opts of [{width:0},{height:NaN},{duration:-1},{clicks:.5},{onBreak:null}])assert.throws(()=>registerChapter17Firewall(f.b,f.e,opts),/Invalid firewall/);
 assert.equal(f.env.firewalls.length,count);assert.deepEqual(snapshot({}),[]);assert.equal(click({},input),false);
});
