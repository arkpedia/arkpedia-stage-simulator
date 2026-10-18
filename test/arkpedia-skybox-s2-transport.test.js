// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make as fixture,enemy,near,advance,until} from './helpers/skybox-fixture.js';
import {SkyboxSkillTwoTransport,SKYBOX_S2_TRANSPORT_CONTRACT,verifySkyboxS2Transport} from '../server/sim/content/arkpedia-skybox-s2-transport.js';
import {skyboxNativeInputs,skyboxSourceComponent,SKYBOX_ID} from '../server/sim/content/arkpedia-skybox-source.js';
const fixtures=[];
function make(opts={}){const f=fixture({skill:2,...opts,defer:true});fixtures.push(f);const payload=new SkyboxSkillTwoTransport(f.b,f.u,{contract:SKYBOX_S2_TRANSPORT_CONTRACT});
 f.deploy();payload.bind();return{...f,payload};}
test.afterEach(()=>{for(const f of fixtures.splice(0))assert.deepEqual(f.b.errors,[]);});
const launch=(f,t,args={})=>{assert.equal(f.payload.launch({target:t,attackId:1,...args}),true);};
const hits=f=>f.hits.filter(h=>h.dmg.tags.includes('skybox:s2'));
test('The payload binds only original selected S2 and exact source projectile/collider facts',()=>{
 verifySkyboxS2Transport();const f=fixture({defer:true});assert.throws(()=>new SkyboxSkillTwoTransport(f.b,f.u),/exact transport contract/);
 assert.throws(()=>make({skill:1}),/exact transport contract/);
 for(const field of['radius','cap','motion','speed','mover']){
  const n=structuredClone(skyboxNativeInputs()),ps=n.projectiles.projectile_chr_skybx_s2.flatMap(r=>r.components);
  if(field==='radius')ps.find(p=>p.type==='CircleCollider2D').data.m_Radius=2;
  if(field==='cap')ps.find(p=>p.data._lifeTime!=null).data._hitNumType=1;
  if(field==='motion')ps.find(p=>p.data._onlyCheckHitWhenReachTarget!=null).data._targetOptions.targetMotion=2;
  if(field==='speed')ps.find(p=>p.data._speed!=null).data._speed=8;
  if(field==='mover')ps.find(p=>p.data._speed!=null).data._moveType=2;
  assert.throws(()=>verifySkyboxS2Transport(n),/Changed original/);
 }
 for(const id of['-3554859342631338737','-7408980494276821745'])for(const field of['_useCachedAtkOnly','_emitToInputPosWhenTargetIsInvalid'])
  assert.throws(()=>verifySkyboxS2Transport(skyboxNativeInputs(),path=>{const a=structuredClone(skyboxSourceComponent('characters',SKYBOX_ID,path));
   if(path===id)a[field]=field==='_useCachedAtkOnly'?0:1;return a;}),/Changed original/);
});
for(let rank=1;rank<=10;rank++)test(`Rank${rank} keeps cached source ATK and selected scale across one original-radius ground/air explosion`,()=>{
 const f=make({rank}),a=enemy(f),ground=enemy(f,{col:8}),air=enemy(f,{col:7.5,motion:'FLY'}),edge=enemy(f,{col:8.100000023841858}),outside=enemy(f,{col:8.101});
 const atk=f.u.s.atk*f.u.s.atkScaleMul,scale=f.record.bb['attack@atk_scale'];launch(f,a);advance(f.b,.15);assert.equal(hits(f).length,0);
 f.b.addBuff(f.u,{key:'fixture:late-atk',mods:{atkPct:1,atkScaleMul:2}});until(f,()=>hits(f).length===4);
 for(const t of[a,ground,air,edge])near(t.s.maxHp-t.hp,atk*scale);near(outside.hp,outside.s.maxHp);assert.equal(f.payload.flights.size,0);
 assert.equal(f.payload.watchers.length,0);assert.equal(f.talent.records.size,4);
});
test('Outgoing multipliers and penetration stay live separately from cached ATK',()=>{
 const f=make(),a=enemy(f);a.base.def=100;a.markDirty();const atk=f.u.s.atk*f.u.s.atkScaleMul;launch(f,a);
 f.b.addBuff(f.u,{key:'fixture:late-output',mods:{dmgDealtMul:2,physDealtMul:1.5,defIgnoreFlat:50}});
 until(f,()=>hits(f).length===1);near(hits(f)[0].amount,(atk*f.record.bb['attack@atk_scale']-50)*3);
});
for(const flag of['stealth','untargetable','sleep'])test(`Secondary ${flag} is excluded while the retained same-life primary remains included`,()=>{
 const f=make(),a=enemy(f),other=enemy(f,{col:7.2,flags:{[flag]:true}});launch(f,a);f.b.addBuff(a,{key:'fixture:primary-state',flags:{[flag]:true}});
 advance(f.b,.5);near(other.hp,other.s.maxHp);
 if(flag==='sleep'){assert.equal(hits(f).length,0);}else{assert.equal(hits(f).length,1);assert.equal(hits(f)[0].target.id,a.id);}
});
for(const change of['dead','replacement','hidden'])test(`A ${change} input before projectile birth rejects the launch without a point explosion`,()=>{
 const f=make(),a=enemy(f),other=enemy(f,{col:7.2}),life=a.deploySeq,x=a.x,y=a.y;
 if(change==='dead')f.b.kill(a,null);if(change==='replacement'){a.deploySeq++;a.x=15;a.y=15;}if(change==='hidden')a.hidden=true;
 assert.equal(f.payload.launch({target:a,life,x,y,attackId:1}),false);advance(f.b,.5);
 assert.equal(hits(f).length,0);near(other.hp,other.s.maxHp);assert.equal(f.payload.flights.size,0);assert.equal(f.payload.watchers.length,0);
});
for(const change of['dead','replacement','hidden'])test(`A ${change} retained input during flight explodes once at its last location`,()=>{
 const f=make(),a=enemy(f),other=enemy(f,{col:7.2});launch(f,a);
 if(change==='dead')f.b.kill(a,null);if(change==='replacement'){a.deploySeq++;a.x=15;a.y=15;}if(change==='hidden')a.hidden=true;
 until(f,()=>hits(f).length===1);assert.equal(hits(f)[0].target.id,other.id);assert.equal(f.payload.flights.size,0);
});
for(const reason of['retreat','death','replacement'])test(`Source ${reason} leaves finite cached transport on its old ledger without a new Silence parent`,()=>{
 const f=make(),a=enemy(f),atk=f.u.s.atk*f.u.s.atkScaleMul,ledger=f.u.stats;launch(f,a);
 if(reason==='death')f.b.kill(f.u,null);else f.b.retreat(f.u);
 if(reason==='replacement'){f.u.deploySeq++;f.u.stats={...ledger,dmg:0};f.u.base.atk=9999;f.u.markDirty();}
 until(f,()=>hits(f).length===1);near(hits(f)[0].amount,atk*f.record.bb['attack@atk_scale']);assert.equal(hits(f)[0].source.stats,ledger);
 assert.equal(hits(f)[0].source.alive,false);assert.equal(!!a.s.flags.silence,false);assert.equal(f.payload.watchers.length,0);
});
test('The explosion claims its one impact before a damage callback can replay it',()=>{
 const f=make(),a=enemy(f);launch(f,a);const p=[...f.payload.flights.keys()][0];
 f.b.on('outputDamage',c=>{if(c.dmg.tags.includes('skybox:s2'))p.onHit({x:a.x,y:a.y});});until(f,()=>hits(f).length===1);
 assert.equal(hits(f).length,1);assert.equal(f.payload.flights.size,0);
});
for(const event of['outputDamage','hit','calculatedDamage'])test(`Replacement of a later splash recipient in ${event} cannot accept a captured old-life explosion`,()=>{
 const f=make(),a=enemy(f),other=enemy(f,{col:7.2});f.b.on(event,c=>{if(c.dmg.tags.includes('skybox:s2')&&c.target===a)other.deploySeq++;});
 launch(f,a);advance(f.b,.5);assert.equal(hits(f).length,1);near(other.hp,other.s.maxHp);
});
test('A dodge is local to each victim and still spends each selected first-target mark',()=>{
 const f=make(),a=enemy(f),other=enemy(f,{col:7.2});f.b.addBuff(a,{key:'fixture:dodge',mods:{dodgePhys:1}});launch(f,a);
 until(f,()=>hits(f).length===1);assert.equal(hits(f)[0].target.id,other.id);assert.equal(!!a.s.flags.silence,false);
 assert.equal(other.s.flags.silence,true);assert.equal(f.talent.records.size,2);
});
test('External interception and battle end drain finite transport and listeners',()=>{
 for(const end of[false,true]){const f=make(),a=enemy(f);launch(f,a);
  if(end){f.b.finished=true;f.b.emit('battleEnd',{});}else{f.b.removeProjectiles(p=>f.payload.flights.has(p));advance(f.b,.05);}
  assert.equal(f.payload.flights.size,0);assert.equal(f.payload.watchers.length,0);assert.equal(hits(f).length,0);
 }
});
test('Original always-hit-at-end reaches a distant input once at the finite ten-second boundary',()=>{
 const f=make(),a=enemy(f);launch(f,a);a.x=1000;f.b.retreat(f.u);advance(f.b,10.2);
 assert.equal(hits(f).length,1);assert.equal(f.payload.flights.size,0);assert.equal(f.payload.watchers.length,0);
});

test('Source retirement during the first splash action is irreversible for the remaining released payload',()=>{
 const f=make(),a=enemy(f),other=enemy(f,{col:7.2}),atk=f.u.s.atk*f.u.s.atkScaleMul,ledger=f.u.stats;let changed=false;
 f.b.on('outputDamage',c=>{if(changed||c.target!==a||!c.dmg.tags.includes('skybox:s2'))return;changed=true;
  f.b.retreat(f.u);f.u.alive=true;f.u.deployed=true;f.u.removed=false;f.u.base.atk=9999;f.u.stats={...ledger,dmg:0};
  f.b.addBuff(f.u,{key:'fixture:new-source',mods:{dmgDealtMul:9}});f.u.markDirty();
 });launch(f,a);until(f,()=>hits(f).length===2);const later=hits(f).find(h=>h.target===other);
 assert.equal(changed,true);assert.notEqual(later.source,f.u);near(later.amount,atk*f.record.bb['attack@atk_scale']);
 assert.equal(later.source.stats,ledger);near(f.u.stats.dmg,hits(f).find(h=>h.target===a).hpLoss);assert.equal(f.payload.watchers.length,0);
});

for(const flag of['stealth','untargetable','sleep'])test(`Burst does not force an otherwise excluded ${flag} retained primary into its collider`,()=>{
 const f=make(),a=enemy(f),other=enemy(f,{col:7.2});launch(f,a,{burst:true});f.b.addBuff(a,{key:'fixture:primary-state',flags:{[flag]:true}});
 until(f,()=>hits(f).length===1);assert.equal(hits(f)[0].target.id,other.id);near(a.hp,a.s.maxHp);
});
test('Every accepted burst shell is an independent one-shot payload, with no implicit eight-shot default',()=>{
 const f=make(),a=enemy(f),atk=f.u.s.atk*f.u.s.atkScaleMul;
 for(let i=0;i<3;i++)launch(f,a,{burst:true,attackId:100+i});
 until(f,()=>hits(f).length===3);near(a.s.maxHp-a.hp,3*atk*f.record.bb['attack@atk_scale']);
 assert.deepEqual(hits(f).map(h=>h.dmg.attackId).sort(),[100,101,102]);assert.equal(f.payload.flights.size,0);assert.equal(f.payload.watchers.length,0);
});
