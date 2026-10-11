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
  prepareBlazeIgnitingCore} from '../server/sim/content/arkpedia-blaze-igniting.js';
const near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps,`${a} != ${z}`);
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function until(f,p,s=12){const end=f.b.time+s;while(!p()&&f.b.time<end)advance(f.b,f.b.dt);assert.ok(p(),`Expected condition at ${f.b.time}`);}
function owner(b,{rank=10,elite=2,level=e.tables.character.phases[elite].maxLevel,potential=1,trust=0,
  skill=1,dir='RIGHT',defer=false,row=5,col=5,contract=CONTRACT}={}){
  const build={elite,level,potential,trust,skillId:`skchr_blaze2_${skill}`,skillRank:Math.min(rank,[4,7,10][elite])};
  const r=selectedBlazeIgnitingBuild(build),c=e.tables.character;
  const def=normalizeChess({chessId:ID,charId:ID,name:c.name,profession:c.profession,position:c.position,
    subProfessionId:c.subProfessionId,stats:r.stats,rangeGrid:r.rangeGrid,talents:r.talents,
    tags:[c.nationId,c.groupId,c.teamId].filter(v=>typeof v==='string'&&v),
    skill:{...r.source,...r.source.spData,skillId:build.skillId,
      rangeGrid:r.source.rangeId?e.tables.ranges[r.source.rangeId].grids.map(v=>[v.row,v.col]):[],trigger:{rule:'NEVER'}},arkpedia:build});
  const u=b._makeAlly(b.getPlayer('arkpedia'),def,'op',row,col,{dir});
  const prepared=prepareBlazeIgnitingCore(b,u,{contract});b._setupUnit(u,prepared.kit);prepared.controller.install();
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
function burn(f,t){return f.b.dealDamage(null,t,{amount:t.gaugeMax,type:'element',element:'burn',canDodge:false});}
function down(f){f.b.dealDamage(null,f.u,{amount:f.u.hp+1,type:'true',canDodge:false});assert.equal(f.controller.reborn?.kind,'downed');}

test('Blaze foundation remains private and refuses activated skills',()=>{
  assert.equal(REGULAR_OPERATORS[ID],undefined);assert.equal(data.operators[ID],undefined);
  assert.deepEqual(e.enabledOperators,[]);assert.equal(CONTRACT.frameParity,false);
  assert.throws(()=>make({contract:{...CONTRACT}}),/contract/);
  for(const skill of [1,2,3]){const f=make({skill});f.u.skill.addCharge(1);assert.equal(f.u.skill.activate(),false);}
});
test('selected source respects stats, promotion, trust and both potential talent upgrades',()=>{
  const build={elite:2,level:90,potential:1,trust:0,skillId:'skchr_blaze2_1',skillRank:10};
  const r=selectedBlazeIgnitingBuild(build);near(r.stats.maxHp,1608);near(r.stats.atk,662);near(r.stats.def,131);
  near(r.stats.magicResistance,15);near(r.stats.cost,21);near(r.stats.respawnTime,70);near(r.revival.dynamic,6000);
  const z=selectedBlazeIgnitingBuild({...build,potential:6,trust:200});near(z.stats.cost,19);near(z.revival.hp_recovery_per_sec_by_max_hp_ratio,.035);
  near(z.meltdown.ep_damage_scale,3.8);near(z.meltdown.hp_ratio,.15);assert.ok(z.stats.atk>r.stats.atk+31);
  for(const change of [{elite:3},{level:0},{level:91},{potential:0},{potential:7},{trust:201},{trust:1.5},
    {skillRank:11},{module:'x'},{elite:0,level:1,skillRank:1,skillId:'skchr_blaze2_2'}])assert.throws(()=>selectedBlazeIgnitingBuild({...build,...change}));
});
test('tampered selected records fail before any controller hook is installed',()=>{
  for(const change of [d=>d.stats.atk++,d=>d.skill.spCost++,d=>d.skill.initSp++,d=>d.skill.duration++,
    d=>{d.skill.bb.atk_scale=999;},d=>{d.skill.spType='hurt';},d=>{d.rangeGrid=[[0,0]];},
    d=>{d.talents=[];},d=>{d.tags=[];},d=>d.skill.maxCharges++,d=>{d.skill.skillType='MANUAL';}]){
    const f=make({defer:true}),raw={...structuredClone(f.u.def.raw),skill:structuredClone(f.u.def.skill)};
    f.controller.stop();delete f.u.mem.blazeIgnitingController;change(raw);f.u.def=normalizeChess(raw);f.u.rangeGrid=f.u.def.rangeGrid;
    const counts=Object.fromEntries(Object.entries(f.b._hooks).map(([k,v])=>[k,v.length]));
    assert.throws(()=>prepareBlazeIgnitingCore(f.b,f.u,{contract:CONTRACT}),/source/);
    assert.deepEqual(Object.fromEntries(Object.entries(f.b._hooks).map(([k,v])=>[k,v.length])),counts);
  }
});
for(const skill of [1,2,3])for(const [dir,row,col,face]of [['RIGHT',5,6,'Front'],['DOWN',4,5,'Front'],['LEFT',5,4,'Back'],['UP',6,5,'Back']])
test(`S${skill} ordinary mode ${dir}: original release event and exactly one Arts target`,()=>{
  const f=make({skill,dir}),t=enemy(f,{row,col});enemy(f,{row:row+1,col:col+1});until(f,()=>f.hits.length===1);
  assert.equal(f.births.length,1);assert.equal(f.attacks.length,1);assert.equal(f.hits[0].target,t);near(f.hits[0].amount,662);
  near(f.births[0].time,1+e.models[ID][face].eventPayloads.Attack.find(e=>e.name==='OnAttack').time,f.b.dt*2);
  near(f.hits[0].time-f.births[0].time,.1,f.b.dt*2);assert.equal(f.u.mem.regularFormVisual.clip,'Attack');
  assert.equal(f.u.mem.regularVisualDirection,face==='Back'?'UP':'RIGHT');assert.equal(f.u.skill.activations,0);
});
for(let skill=1;skill<=3;skill++)for(let rank=1;rank<=10;rank++)test(`selected S${skill} rank${rank}: ordinary combat and natural source SP`,()=>{
  const f=make({skill,rank}),s=e.tables.skills[`skchr_blaze2_${skill}`].levels[rank-1];enemy(f);until(f,()=>f.hits.length===1);
  near(f.u.skill.spCost,s.spData.spCost);near(f.u.skill.sp,Math.min(f.u.skill.spCost,f.b.time+s.spData.initSp),f.b.dt*2);
  assert.equal(f.u.skill.activations,0);near(f.hits[0].amount,662);
});
test('ASPD cannot accelerate the native cap; slowing stretches the attack event and cadence',()=>{
  const f=make();enemy(f);f.b.addBuff(f.u,{key:'fixture:fast',mods:{aspd:100}});until(f,()=>f.births.length===2);
  near(f.births[0].time,1+.4333333,f.b.dt*2);near(f.births[1].time-f.births[0].time,1.6,f.b.dt*2);near(f.u.mem.regularFormVisual.speed,1);
  const z=make();enemy(z);z.b.addBuff(z.u,{key:'fixture:slow',mods:{aspd:-50}});until(z,()=>z.births.length===2);
  near(z.births[0].time,1+.4333333*2,z.b.dt*2);near(z.births[1].time-z.births[0].time,3.2,z.b.dt*2);near(z.u.mem.regularFormVisual.speed,.5);
});
test('ordinary impact uses current ATK and Arts mitigation; released projectile survives retreat',()=>{
  const f=make(),t=enemy(f,{res:50});until(f,()=>f.births.length===1);f.b.addBuff(f.u,{key:'fixture:atk',mods:{atkPct:1}});
  until(f,()=>f.hits.length===1);near(f.hits[0].amount,662);assert.equal(f.hits[0].target,t);
  const z=make();enemy(z);until(z,()=>z.births.length===1);z.b.retreat(z.u);until(z,()=>z.hits.length===1);
  assert.equal(z.controller.stopped,true);near(z.hits[0].amount,662);
});
for(const flag of ['stun','freeze','sleep','disarm'])test(`${flag} cancels an unreleased ordinary attack`,()=>{
  const f=make();enemy(f);until(f,()=>f.controller.phase?.kind==='attack');f.b.addBuff(f.u,{key:'fixture:control',flags:{[flag]:true}});
  advance(f.b,1);assert.equal(f.births.length,0);f.b.removeBuff(f.u,'fixture:control');until(f,()=>f.hits.length===1);
});
test('target life, stealth, camouflage, sleeping and target-free eligibility are rechecked',()=>{
  for(const flags of [{stealth:true},{camou:true},{sleep:true},{untargetable:true}]){
    const f=make();enemy(f,{flags});advance(f.b,3);assert.equal(f.births.length,0);
  }
  const f=make(),t=enemy(f,{fly:true});until(f,()=>f.births.length===1);t.deploySeq++;advance(f.b,.2);assert.equal(f.hits.length,0);
});
for(const elite of [0,1,2])for(const potential of [1,5])test(`E${elite} P${potential}: Burn bonus and self recovery use selected talent globally`,()=>{
  const f=make({elite,potential,rank:[4,7,10][elite]}),t=enemy(f,{row:15,col:18});f.u.hp=f.u.s.maxHp/2;
  const hp=f.u.hp,events=[];f.b.on('damaged',ctx=>{if(ctx.dmg.tags.includes('blaze2:meltdown'))events.push(ctx);});burn(f,t);
  near(f.u.hp,Math.min(f.u.s.maxHp,hp+f.u.s.maxHp*(f.record.meltdown.hp_ratio??0)));
  assert.equal(events.length,elite?1:0);if(elite){near(events[0].amount,f.u.s.atk*f.record.meltdown.ep_damage_scale);assert.equal(events[0].type,'elemental');}
});
test('non-Burn and allied bursts never trigger Meltdown; accepted bonus can kill before the base burst hit',()=>{
  const f=make(),t=enemy(f);f.u.hp=800;f.b.dealDamage(null,t,{amount:t.gaugeMax,type:'element',element:'neural'});near(f.u.hp,800);
  f.b.emit('elementBurst',{target:f.u,element:'burn'});near(f.u.hp,800);
  const z=make(),a=enemy(z,{hp:100});let hits=0;z.b.on('damaged',ctx=>{if(ctx.type==='elemental'&&ctx.target===a)hits++;});burn(z,a);
  assert.equal(a.alive,false);assert.equal(hits,1);assert.equal(z.u.stats.kills,1);
});
test('E0/E1 lethal damage kills; E2 downing preserves the deployed owner and accounts fatal HP loss',()=>{
  for(const elite of [0,1]){const f=make({elite,skill:1,rank:4});f.b.dealDamage(null,f.u,{amount:1e6,type:'true'});assert.equal(f.u.alive,false);}
  const f=make();const seq=f.u.deploySeq,hp=f.u.hp;down(f);near(f.u.hp,1);assert.equal(f.u.alive,true);assert.equal(f.u.deployed,true);
  assert.equal(f.u.deploySeq,seq);near(f.u.stats.taken,hp);near(f.controller.downState.shield,6000);assert.equal(f.u.s.flags.noBlock,true);
  assert.equal(f.u.mem.regularFormVisual.clip,'Revive_Begin');advance(f.b,1.1);assert.equal(f.u.mem.regularFormVisual.clip,'Revive_Idle');
});
test('downing clears temporary modifiers and preserves durable modifiers; no ordinary attack escapes the transition',()=>{
  const f=make();enemy(f);until(f,()=>f.controller.phase?.kind==='attack');
  f.b.addBuff(f.u,{key:'fixture:temp',mods:{atkPct:1}});f.b.addBuff(f.u,{key:'fixture:durable',persist:true,mods:{defFlat:50}});down(f);
  assert.equal(f.u.findBuff('fixture:temp'),null);assert.ok(f.u.findBuff('fixture:durable'));advance(f.b,2);assert.equal(f.births.length,0);
});
test('downed barrier blocks physical/Arts/true damage and depletes; Elemental Damage bypasses it',()=>{
  const z=make();down(z);z.b.dealDamage(null,z.u,{amount:1000,type:'phys'});near(z.u.hp,1);near(z.controller.downState.shield,6000-(1000-z.u.s.def));
  const f=make();down(f);f.b.dealDamage(null,f.u,{amount:1000,type:'true'});near(f.u.hp,1);near(f.controller.downState.shield,5000);
  f.b.dealDamage(null,f.u,{amount:1000,type:'arts'});near(f.controller.downState.shield,4150);near(f.u.hp,1);
  f.u.hp=1000;f.b.dealDamage(null,f.u,{amount:100,type:'elemental'});near(f.u.hp,900);near(f.controller.downState.shield,4150);
  f.b.dealDamage(null,f.u,{amount:5000,type:'true'});assert.equal(f.u.alive,true);near(f.u.hp,50);near(f.controller.downState.shield,0);
  f.b.dealDamage(null,f.u,{amount:100,type:'true'});assert.equal(f.u.alive,false);assert.equal(f.controller.reborn,null);
});
for(const potential of [1,3])test(`P${potential} downed regen reaches full HP and uses the original revival-end clip`,()=>{
  const f=make({potential});down(f);const before=f.u.hp;advance(f.b,1);near(f.u.hp,before+f.u.s.maxHp*f.record.revival.hp_recovery_per_sec_by_max_hp_ratio,1);
  until(f,()=>f.controller.reborn?.kind==='reviving',40);near(f.u.hp,f.u.s.maxHp);assert.equal(f.u.mem.regularFormVisual.clip,'Revive_End');
  assert.equal(f.controller.downState,null);advance(f.b,.9);assert.equal(f.controller.reborn,null);assert.equal(f.u.s.flags.invulnerable,undefined);
});
test('ordinary healing is refused while downed, but native Meltdown recovery ignores heal-free',()=>{
  const f=make();down(f);near(f.b.heal(f.u,f.u,1000,{self:true}),0);near(f.u.hp,1);
  const t=enemy(f,{row:15,col:18});burn(f,t);near(f.u.hp,1+f.u.s.maxHp*.12);
  assert.equal(f.controller.reborn.kind,'downed');
});
test('downed state rejects stun/freeze/sleep, and revived state regains ordinary status susceptibility',()=>{
  const f=make();down(f);for(const status of ['stun','freeze','sleep'])assert.equal(f.b.applyStatus(f.u,status,{duration:2}),false);
  f.b.heal(f.u,f.u,f.u.s.maxHp,{ignoreHealFree:true});until(f,()=>f.controller.reborn===null,2);
  assert.ok(f.b.applyStatus(f.u,'stun',{duration:2}));
});
test('revival stun includes ground/air within radius1.7, respects immunity and excludes outside or camouflaged targets',()=>{
  const f=make(),a=enemy(f,{col:6}),fly=enemy(f,{row:6,col:6,fly:true}),out=enemy(f,{col:7}),cam=enemy(f,{row:4,col:5,flags:{camou:true}}),imm=enemy(f,{row:4,col:6});imm.def={...imm.def,immune:new Set([...imm.def.immune,'stun'])};
  down(f);f.b.heal(f.u,f.u,f.u.s.maxHp,{ignoreHealFree:true});until(f,()=>f.controller.reborn?.kind==='reviving');
  assert.ok(a.findBuff('stun'));assert.ok(fly.findBuff('stun'));assert.equal(out.findBuff('stun'),null);assert.equal(cam.findBuff('stun'),null);assert.equal(imm.findBuff('stun'),null);
  near(a.findBuff('stun').duration,5);advance(f.b,5.1);assert.equal(a.findBuff('stun'),null);
});
test('second defeat after revival can enter downed mode again; no invented once-per-battle cap',()=>{
  const f=make();down(f);f.b.heal(f.u,f.u,f.u.s.maxHp,{ignoreHealFree:true});until(f,()=>f.controller.reborn===null,2);down(f);near(f.controller.downState.shield,6000);
});
test('retreat, scripted death and battle end cancel revival, barrier, future burst healing and owned hooks',()=>{
  for(const action of ['retreat','kill','finish']){const f=make();down(f);if(action==='finish')f.b._finish('forced');else f.b[action](f.u);assert.equal(f.controller.stopped,true);assert.equal(f.controller.downState,null);
    assert.equal(f.controller.handles.length,0);const hp=f.u.hp;burn(f,enemy(f,{row:15,col:18}));near(f.u.hp,hp);advance(f.b,40);assert.equal(f.controller.reborn,null);}
});
test('an unreleased shot is cancelled by fatal downing; an already released shot retains native independent lifetime',()=>{
  const f=make();enemy(f);until(f,()=>f.controller.phase?.kind==='attack');down(f);advance(f.b,.8);assert.equal(f.births.length,0);
  const z=make();enemy(z);until(z,()=>z.births.length===1);down(z);until(z,()=>z.hits.length===1);near(z.hits[0].amount,662);
});
test('Meltdown heal precedes its bonus output, uses current ATK and respects healing modifiers',()=>{
  const f=make(),t=enemy(f,{row:15,col:18});f.u.hp=100;
  f.b.addBuff(f.u,{key:'fixture:mod',mods:{atkPct:1,healingTakenMul:.5}});
  const events=[];f.b.on('heal',ctx=>{if(ctx.target===f.u)events.push('heal');});
  f.b.on('damaged',ctx=>{if(ctx.dmg.tags.includes('blaze2:meltdown'))events.push('damage');});burn(f,t);
  assert.deepEqual(events,['heal','damage']);near(f.u.hp,100+1608*.12*.5);
  const hit=f.hits.find(h=>h.dmg.tags.includes('blaze2:meltdown'));near(hit.amount,662*2*3.5);
});
test('deferred owner has neither attack nor global talent effects before deployment',()=>{
  const f=make({defer:true}),t=enemy(f,{row:15,col:18});advance(f.b,2);assert.equal(f.controller.stopped,false);
  f.u.hp=100;burn(f,t);near(f.u.hp,100);f.deploy();f.u.hp=100;const a=enemy(f,{row:15,col:17});burn(f,a);near(f.u.hp,100+1608*.12);
});
test('separate original owners retain independent global Meltdown claims without sharing state',()=>{
  const f=make(),z=owner(f.b,{row:10,col:10,potential:5});f.u.hp=100;z.u.hp=100;
  const t=enemy(f,{row:15,col:18});burn(f,t);near(f.u.hp,100+1608*.12);near(z.u.hp,100+1608*.15);
  assert.equal(f.hits.filter(h=>h.dmg.tags.includes('blaze2:meltdown')).length,1);
  assert.equal(z.hits.filter(h=>h.dmg.tags.includes('blaze2:meltdown')).length,1);
  f.b.retreat(z.u);burn(f,enemy(f,{row:14,col:18}));near(f.u.hp,100+1608*.24);near(z.u.hp,100+1608*.15);
});
