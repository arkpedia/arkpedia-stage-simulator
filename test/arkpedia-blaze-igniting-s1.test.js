// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import e from '../data/arkpedia-blaze-igniting-prefabs.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {normalizeChess} from '../server/sim/simdata.js';
import {defaultBuild} from '../shared/arkpedia/loadout.js';
import {REGULAR_OPERATORS} from '../shared/arkpedia/operators.js';
import {BLAZE_IGNITING_ID as ID,BLAZE_IGNITING_CORE_CONTRACT as CONTRACT,selectedBlazeIgnitingBuild,
  prepareBlazeIgnitingCore,prepareBlazeIgnitingS1,BLAZE_IGNITING_S1_CONTRACT as S1_CONTRACT} from '../server/sim/content/arkpedia-blaze-igniting.js';
const near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps,`${a} != ${z}`);
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function until(f,p,s=12){const end=f.b.time+s;while(!p()&&f.b.time<end)advance(f.b,f.b.dt);assert.ok(p(),`Expected condition at ${f.b.time}`);}
function owner(b,{rank=10,elite=2,level=e.tables.character.phases[elite].maxLevel,potential=1,trust=0,
  skill=1,dir='RIGHT',defer=false,row=5,col=5,contract=CONTRACT,sourceS1=true}={}){
  const build={elite,level,potential,trust,skillId:`skchr_blaze2_${skill}`,skillRank:Math.min(rank,[4,7,10][elite])};
  const r=selectedBlazeIgnitingBuild(build),c=e.tables.character;
  const def=normalizeChess({chessId:ID,charId:ID,name:c.name,profession:c.profession,position:c.position,
    subProfessionId:c.subProfessionId,stats:r.stats,rangeGrid:r.rangeGrid,talents:r.talents,
    tags:[c.nationId,c.groupId,c.teamId].filter(v=>typeof v==='string'&&v),
    skill:{...r.source,...r.source.spData,skillId:build.skillId,
      rangeGrid:r.source.rangeId?e.tables.ranges[r.source.rangeId].grids.map(v=>[v.row,v.col]):[],trigger:{rule:'NEVER'}},arkpedia:build});
  const u=b._makeAlly(b.getPlayer('arkpedia'),def,'op',row,col,{dir});
  const prepared=sourceS1?prepareBlazeIgnitingS1(b,u,{contract:S1_CONTRACT}):prepareBlazeIgnitingCore(b,u,{contract});b._setupUnit(u,prepared.kit);prepared.controller.install();
  const hits=[],attacks=[],births=[];
  b.on('damaged',ctx=>{if(ctx.source===u)hits.push({...ctx,time:b.time});});
  b.on('attack',ctx=>{if(ctx.attacker===u)attacks.push({...ctx,time:b.time});});
  b.on('blazeIgnitingProjectileBirth',ctx=>{if(ctx.owner===u)births.push({...ctx,time:b.time});});
  const deploy=()=>{u.player.dp=99;assert.ok(b._deploy(u,{initial:false}));u.player.dp=99;};if(!defer)deploy();
  return {b,u,build,deploy,hits,attacks,births,...prepared};
}
function make(opts={}){
  const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
  d.stage.geometry.rows=19;d.stage.geometry.cols=21;d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
  const b=new StandardBattle(d,{operators:[defaultBuild(d.operators.char_289_gyuki)]});
  b.autoFinish=false;b.recordEvents=true;b.rng=()=>.99;b.setViewport('fullscreen-workspace');
  b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
  return owner(b,opts);
}
function enemy(f,{row=5,col=6,hp=1e7,res=0,fly=false,taunt=0,flags={}}={}){
  const t=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});
  Object.assign(t.base,{maxHp:hp,atk:0,def:0,res,moveSpeed:0,tauntLevel:taunt});t.markDirty();void t.s;t.hp=hp;
  if(fly)t.motion='FLY';f.b.addBuff(t,{key:'fixture:pin',flags:{noMove:true,disarm:true,...flags}});
  f.b._buildEnemyIndex();return t;
}
function ally(f,{row=5,col=6,hp=10000,kind='op',flags={}}={}){
  const def=normalizeChess({chessId:'fixture:ally',name:'Ally',profession:'GUARD',position:'MELEE',
    stats:{maxHp:hp,atk:0,def:0,baseAttackTime:1,attackSpeed:100,cost:0},rangeGrid:[[0,0]],skill:null});
  const t=f.b._makeAlly(f.u.player,def,kind,row,col,{dir:'RIGHT'});
  f.b._setupUnit(t,{trait:{noAttack:true},talents:[]});assert.ok(f.b._deploy(t,{initial:false}));
  if(Object.keys(flags).length)f.b.addBuff(t,{key:'fixture:flags',flags});return t;
}
function receipts(f){const a=[];f.b.on('damaged',ctx=>{if(ctx.dmg.tags.some(t=>t.startsWith('blaze2:s1-')))a.push({...ctx,time:f.b.time});});return a;}
function field(f){until(f,()=>f.controller.s1.fields.size>0,30);return [...f.controller.s1.fields][0];}
function cast(f){until(f,()=>f.controller.s1.cast!==null,30);return f.controller.s1.cast;}
const arts=a=>a.filter(x=>x.dmg.tags.includes('blaze2:s1-field'));
const injury=a=>a.filter(x=>x.dmg.tags.includes('blaze2:s1-injury'));

test('S1 private adapter does not enable the public operator or the core-only activated skills',()=>{
  assert.equal(REGULAR_OPERATORS[ID],undefined);assert.equal(data.operators[ID],undefined);assert.deepEqual(e.enabledOperators,[]);
  const f=make({defer:true,sourceS1:false});f.controller.stop();delete f.u.mem.blazeIgnitingController;
  assert.throws(()=>prepareBlazeIgnitingS1(f.b,f.u,{contract:{...S1_CONTRACT}}),/contract/);
  const z=make({skill:2,sourceS1:false,defer:true});z.controller.stop();delete z.u.mem.blazeIgnitingController;
  assert.throws(()=>prepareBlazeIgnitingS1(z.b,z.u,{contract:S1_CONTRACT}),/first skill/);
});
for(let rank=1;rank<=10;rank++)test(`S1 rank${rank}: natural source SP, selected radius/period/duration and tagged sourceless Arts/Burn`,()=>{
  const f=make({rank}),a=ally(f),t=enemy(f,{row:6,col:6}),out=enemy(f,{row:6,col:8}),r=receipts(f);
  assert.equal(f.u.skill.activate(),false);const c=cast(f);near(f.b.time,f.u.skill.spCost-f.u.def.skill.initSp,f.b.dt*2);
  assert.equal(c.target,a);const p=field(f);assert.equal(p.anchor,a);near(p.cachedAtk,662);near(p.duration,20);near(p.interval,1);near(p.radius,1.5);
  near(p.bornAt-c.releaseAt,0,f.b.dt);until(f,()=>arts(r).length>0);
  const hit=arts(r)[0];assert.equal(hit.target,t);assert.equal(hit.source,null);assert.equal(hit.credit,f.u);assert.equal(hit.dmg.sourceless,true);
  near(hit.amount,662*f.record.bb.atk_scale);near(injury(r)[0].amount,hit.amount*.3);assert.equal(injury(r)[0].source,null);
  assert.equal(arts(r).filter(x=>x.target===out).length,0);assert.equal(p.pulses,1);
  assert.ok(hit.time>=p.bornAt+1-f.b.dt);assert.equal(f.u.skill.activations,1);
});
for(const [dir,row,col,face]of [['RIGHT',5,6,'Front'],['DOWN',4,5,'Front'],['LEFT',5,4,'Back'],['UP',6,5,'Back']])
test(`${dir} selects a highest-HP operator in the rotated range and releases at original Skill_1 event`,()=>{
  const f=make({dir}),a=ally(f,{row,col}),outside=ally(f,{row:12,col:12,hp:99999});const c=cast(f);assert.equal(c.target,a);assert.notEqual(c.target,outside);
  const p=field(f);near(p.bornAt-c.releaseAt,0,f.b.dt);near(c.releaseAt-(f.u.skill.lastStart),e.models[ID][face].eventPayloads.Skill_1.find(v=>v.name==='OnAttack').time);
  assert.equal(f.u.mem.regularFormVisual.clip,'Skill_1');assert.equal(f.u.mem.regularVisualDirection,face==='Back'?'UP':'RIGHT');
});
test('highest Max HP differs from lowest HP ratio; ties choose latest deployment and self is eligible',()=>{
  const f=make(),a=ally(f,{hp:3000}),z=ally(f,{row:6,col:6,hp:4000});a.hp=1;assert.equal(cast(f).target,z);
  const g=make(),x=ally(g,{hp:3000}),y=ally(g,{row:6,col:6,hp:3000});assert.equal(cast(g).target,y);assert.notEqual(g.controller.s1.cast.target,x);
  const self=make();assert.equal(cast(self).target,self.u);
});
test('selector excludes nonoperators, hidden, isolated, target-free, heal-free and outside-range anchors',()=>{
  const f=make();ally(f,{kind:'token',hp:50000});ally(f,{kind:'device',row:6,col:6,hp:50000});
  ally(f,{row:4,col:6,hp:50000,flags:{isolated:true}});ally(f,{row:6,col:5,hp:50000,flags:{healFree:true}});
  ally(f,{row:4,col:5,hp:50000,flags:{untargetable:true}});const h=ally(f,{row:5,col:7,hp:50000});h.hidden=true;
  ally(f,{row:12,col:12,hp:50000});assert.equal(cast(f).target,f.u);
});
test('all missing eligible anchors retain full SP; restoring the owner permits automatic activation',()=>{
  const f=make();f.b.addBuff(f.u,{key:'fixture:no-anchor',flags:{healFree:true}});advance(f.b,20);
  assert.equal(f.u.skill.ready,true);assert.equal(f.u.skill.activations,0);f.b.removeBuff(f.u,'fixture:no-anchor');advance(f.b,f.b.dt);assert.equal(f.u.skill.activations,1);
});
test('release-time ATK is cached and all later field ticks ignore caster stat changes',()=>{
  const f=make();ally(f);const r=receipts(f);enemy(f,{row:6,col:6});const c=cast(f);
  f.b.addBuff(f.u,{key:'fixture:release-atk',mods:{atkPct:1}});const p=field(f);near(p.cachedAtk,1324);
  f.b.removeBuff(f.u,'fixture:release-atk');until(f,()=>arts(r).length>=2);near(arts(r)[0].amount,1324*.7);near(arts(r)[1].amount,1324*.7);
  assert.ok(p.bornAt>=c.releaseAt-f.b.dt);
});
test('Arts mitigation and shield absorption determine the subsequent FIRE receipt',()=>{
  const f=make();ally(f);field(f);const t=enemy(f,{row:6,col:6,res:50}),s=enemy(f,{row:4,col:6}),r=receipts(f);
  f.b.addBuff(s,{key:'fixture:shield',shield:1000,shieldTypes:['arts']});until(f,()=>arts(r).length>=2);
  near(arts(r).find(x=>x.target===t).amount,662*.7*.5);near(injury(r).find(x=>x.target===t).amount,662*.7*.5*.3);
  assert.equal(injury(r).filter(x=>x.target===s).length,0);near(s.elem.burn,0);near(s.hp,1e7);
});
test('killing Arts receipt does not accumulate FIRE on a dead target',()=>{
  const f=make();ally(f);field(f);const t=enemy(f,{row:6,col:6,hp:100}),r=receipts(f);until(f,()=>!t.alive);
  assert.equal(arts(r).length,1);assert.equal(injury(r).length,0);near(t.elem.burn,0);
});
test('field follows its anchor and reevaluates circle membership each pulse, including air and camouflage',()=>{
  const f=make(),a=ally(f),old=enemy(f,{row:6,col:6}),next=enemy(f,{row:10,col:10,fly:true,flags:{camou:true}}),r=receipts(f);
  field(f);until(f,()=>arts(r).length===1);assert.equal(arts(r)[0].target,old);a.x=10;a.y=10;a.tileR=10;a.tileC=10;
  until(f,()=>arts(r).length===2);assert.equal(arts(r)[1].target,next);assert.equal(arts(r).filter(x=>x.target===old).length,1);
});
test('sleeping, stealth and target-free enemies do not receive the field; a live new entrant does',()=>{
  const f=make();ally(f);enemy(f,{row:6,col:6,flags:{sleep:true}});enemy(f,{row:4,col:6,flags:{untargetable:true}});
  enemy(f,{row:5,col:7,flags:{stealth:true}});const r=receipts(f);field(f);advance(f.b,2);assert.equal(arts(r).length,0);
  const t=enemy(f,{row:6,col:6});until(f,()=>arts(r).length>0);assert.equal(arts(r)[0].target,t);
});
test('hosted field runs for exactly the local twenty pulses, releases its buff and leaves no hidden stacked field',()=>{
  const f=make(),a=ally(f),r=receipts(f);enemy(f,{row:6,col:6});const p=field(f);
  f.b.addBuff(f.u,{key:'fixture:stop-recast',flags:{disarm:true}});advance(f.b,21);
  assert.equal(p.pulses,20);assert.equal(p.active,false);assert.equal(a.findBuff('blaze2_s_1'),null);assert.equal(f.controller.s1.fields.size,0);
  assert.equal(arts(r).length,20);
});
test('same-anchor recast replaces rather than stacks and snapshots new ATK',()=>{
  const f=make(),a=ally(f);const first=field(f);f.b.addBuff(f.u,{key:'fixture:new-atk',mods:{atkPct:1}});
  until(f,()=>f.u.skill.activations===2,20);until(f,()=>[...f.controller.s1.fields].some(p=>p!==first));
  const second=[...f.controller.s1.fields][0];assert.equal(first.active,false);assert.equal(second.anchor,a);near(second.cachedAtk,1324);
  assert.equal(f.controller.s1.fields.size,1);assert.equal(a.buffs.filter(x=>x.key==='blaze2_s_1').length,1);
});
test('changing selected highest-HP anchor permits independent live fields on different allies',()=>{
  const f=make(),a=ally(f);const first=field(f),z=ally(f,{row:6,col:6,hp:20000});
  until(f,()=>f.u.skill.activations===2,20);until(f,()=>f.controller.s1.fields.size===2);
  assert.equal(first.active,true);assert.deepEqual(new Set([...f.controller.s1.fields].map(p=>p.anchor)),new Set([a,z]));
});
test('separate casters on the same anchor do not create hidden duplicate damage sources',()=>{
  const f=make(),a=ally(f),first=field(f),z=owner(f.b,{row:4,col:5,rank:10});const next=field(z);
  assert.equal(next.anchor,a);assert.equal(first.active,false);assert.equal(f.controller.s1.fields.size,0);
  assert.equal(a.buffs.filter(x=>x.key==='blaze2_s_1').length,1);
});
for(const flag of ['stun','freeze','sleep','disarm'])test(`${flag} before release cancels the cast without emitting a field`,()=>{
  const f=make();ally(f);cast(f);f.b.addBuff(f.u,{key:'fixture:control',flags:{[flag]:true}});advance(f.b,2);
  assert.equal(f.controller.s1.fields.size,0);assert.equal(f.controller.s1.cast,null);assert.equal(f.u.skill.active,false);
});
test('losing the captured anchor before release suppresses the field without switching target or refunding SP',()=>{
  const f=make(),a=ally(f);cast(f);f.b.retreat(a);advance(f.b,2);
  assert.equal(f.controller.s1.fields.size,0);assert.equal(f.u.skill.activations,1);assert.ok(f.u.skill.sp<f.u.skill.spCost);
});
test('a new anchor deployment life cannot receive an old cast or an old field',()=>{
  const f=make(),a=ally(f);cast(f);a.deploySeq++;advance(f.b,2);assert.equal(f.controller.s1.fields.size,0);
  const z=make(),t=ally(z),p=field(z);t.deploySeq++;advance(z.b,z.b.dt);assert.equal(p.active,false);assert.equal(t.findBuff('blaze2_s_1'),null);
});
test('caster retreat preserves a released ally-hosted field and its cached damage until expiry',()=>{
  const f=make();ally(f);const r=receipts(f);enemy(f,{row:6,col:6});const p=field(f);f.b.retreat(f.u);
  assert.equal(f.controller.stopped,true);assert.equal(p.active,true);until(f,()=>arts(r).length>0);near(arts(r)[0].amount,662*.7);
  advance(f.b,21);assert.equal(p.active,false);assert.equal(f.controller.s1.handles.length,0);
});
for(const action of ['retreat','kill','clear'])test(`anchor ${action} ends the field with no ghost ticks`,()=>{
  const f=make(),a=ally(f),r=receipts(f);enemy(f,{row:6,col:6});const p=field(f);
  if(action==='clear')f.b.removeBuff(a,'blaze2_s_1');else f.b[action](a);advance(f.b,.1);
  assert.equal(p.active,false);const n=arts(r).length;f.b.addBuff(f.u,{key:'fixture:stop',flags:{disarm:true}});advance(f.b,3);assert.equal(arts(r).length,n);
});
test('downing cancels an unreleased cast and clears a self-hosted field through native temporary-buff removal',()=>{
  const f=make();ally(f);cast(f);f.b.dealDamage(null,f.u,{amount:1e6,type:'true'});advance(f.b,2);assert.equal(f.controller.s1.fields.size,0);
  const z=make(),p=field(z);assert.equal(p.anchor,z.u);z.b.dealDamage(null,z.u,{amount:1e6,type:'true'});assert.equal(p.active,false);
});
test('downing the caster keeps another ally-hosted field and its Burn injury can heal the downed caster through Meltdown',()=>{
  const f=make();ally(f);const t=enemy(f,{row:6,col:6}),p=field(f);f.b.dealDamage(null,f.u,{amount:1e6,type:'true'});
  assert.equal(p.active,true);const heals=[];f.b.on('heal',ctx=>{if(ctx.target===f.u&&ctx.opts.ignoreHealFree)heals.push(ctx);});
  until(f,()=>t.findBuff('burnBurst'),12);assert.equal(heals.length,1);near(heals[0].amount,1608*.12);assert.ok(f.u.hp>=1+1608*.12);
  assert.ok(f.hits.some(h=>h.dmg.tags.includes('blaze2:meltdown')));assert.equal(f.controller.reborn.kind,'downed');
});
test('battle end removes hosted fields, unowned hooks and active casts',()=>{
  const f=make(),a=ally(f),p=field(f);f.b._finish('forced');assert.equal(p.active,false);assert.equal(a.findBuff('blaze2_s_1'),null);
  assert.equal(f.controller.s1.handles.length,0);assert.equal(f.controller.s1.cast,null);assert.equal(f.controller.stopped,true);
});

test('sourceless injury hides its attacker from both hooks while retaining producer credit and gauge statistics',()=>{
  const f=make({sourceS1:false}),t=enemy(f),seen=[];let reactive=0;
  f.b.on('elementHit',ctx=>{seen.push({event:'elementHit',source:ctx.source,credit:ctx.credit});if(ctx.source===f.u)reactive++;});
  f.b.on('damaged',ctx=>{if(ctx.type==='element'){seen.push({event:'damaged',source:ctx.source,credit:ctx.credit});if(ctx.source===f.u)reactive++;}});
  near(f.b.dealDamage(f.u,t,{amount:100,type:'element',element:'burn',sourceless:true}),100);
  assert.deepEqual(seen.map(x=>[x.event,x.source,x.credit]),[['elementHit',null,f.u],['damaged',null,f.u]]);
  assert.equal(reactive,0);near(f.u.stats.elem,100);near(t.elem.burn,100);
});
test('ordinary sourced injury keeps its attacker and credit visible to existing hooks',()=>{
  const f=make({sourceS1:false}),t=enemy(f),seen=[];
  f.b.on('elementHit',ctx=>seen.push(ctx));f.b.on('damaged',ctx=>{if(ctx.type==='element')seen.push(ctx);});
  f.b.dealDamage(f.u,t,{amount:100,type:'element',element:'burn'});assert.equal(seen.length,2);
  for(const ctx of seen){assert.equal(ctx.source,f.u);assert.equal(ctx.credit,f.u);}near(f.u.stats.elem,100);
});
test('cancelled or converted sourceless injury preserves receipt invariants',()=>{
  for(const converted of [false,true]){
    const f=make({sourceS1:false}),t=enemy(f),seen=[];
    f.b.on('elementHit',ctx=>{assert.equal(ctx.source,null);assert.equal(ctx.credit,f.u);if(converted)ctx.dmg.type='true';else ctx.dmg.cancel=true;});
    f.b.on('damaged',ctx=>seen.push(ctx));const hp=t.hp;f.b.dealDamage(f.u,t,{amount:100,type:'element',element:'burn',sourceless:true});
    near(t.elem.burn,0);near(f.u.stats.elem??0,0);near(t.hp,hp-(converted?100:0));assert.equal(seen.length,converted?1:0);
    if(converted){assert.equal(seen[0].source,null);assert.equal(seen[0].credit,f.u);near(f.u.stats.dmg,100);}
  }
});
test('a lethal burst from sourceless injury retains the original producer kill and damage credit',()=>{
  const f=make({sourceS1:false,elite:0,rank:4}),t=enemy(f,{hp:500}),seen=[];
  f.b.on('damaged',ctx=>seen.push(ctx));f.b.dealDamage(f.u,t,{amount:t.gaugeMax,type:'element',element:'burn',sourceless:true});
  assert.equal(t.alive,false);near(f.u.stats.elem,1000);near(f.u.stats.dmg,500);assert.equal(f.u.stats.kills,1);
  assert.ok(seen.some(ctx=>ctx.type==='elemental'));for(const ctx of seen){assert.equal(ctx.source,null);assert.equal(ctx.credit,f.u);}
});
