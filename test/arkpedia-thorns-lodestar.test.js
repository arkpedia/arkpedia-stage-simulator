// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import e from '../data/arkpedia-thorns-lodestar-prefabs.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {normalizeChess} from '../server/sim/simdata.js';
import {defaultBuild} from '../shared/arkpedia/loadout.js';
import {REGULAR_OPERATORS} from '../shared/arkpedia/operators.js';
import {THORNS_LODESTAR_ID as ID,THORNS_CORE_CONTRACT as CONTRACT,selectedThornsBuild,
  prepareThornsCore,prepareThornsS1,prepareThornsS2,prepareThornsS3,THORNS_S1_CONTRACT,THORNS_S2_CONTRACT,THORNS_S3_CONTRACT,thornsStraightTiles} from '../server/sim/content/arkpedia-thorns-lodestar.js';
const near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps,`${a} != ${z}`);
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function until(f,p,s=12){const end=f.b.time+s;while(!p()&&f.b.time<end)advance(f.b,f.b.dt);assert.ok(p(),`Expected condition at ${f.b.time}`);}
function owner(b,{rank=10,elite=2,level=e.tables.character.phases[elite].maxLevel,potential=1,trust=0,
  skill=1,dir='RIGHT',defer=false,row=5,col=5,contract=CONTRACT,sourceS1=false,sourceS2=false,sourceS3=false}={}){
  const build={elite,level,potential,trust,skillId:`skchr_thorn2_${skill}`,skillRank:Math.min(rank,[4,7,10][elite])};
  const r=selectedThornsBuild(build),c=e.tables.character;
  const def=normalizeChess({chessId:ID,charId:ID,name:c.name,profession:c.profession,position:c.position,
    subProfessionId:c.subProfessionId,stats:r.stats,rangeGrid:r.rangeGrid,talents:r.talents,
    tags:[c.nationId,c.groupId,c.teamId].filter(v=>typeof v==='string'&&v),
    skill:{...r.source,...r.source.spData,skillId:build.skillId,
      rangeGrid:r.source.rangeId?e.tables.ranges[r.source.rangeId].grids.map(v=>[v.row,v.col]):[],trigger:{rule:'NEVER'}},arkpedia:build});
  const u=b._makeAlly(b.getPlayer('arkpedia'),def,'op',row,col,{dir});
  const prepared=sourceS1?prepareThornsS1(b,u,{contract:THORNS_S1_CONTRACT}):sourceS2?prepareThornsS2(b,u,{contract:THORNS_S2_CONTRACT}):sourceS3?prepareThornsS3(b,u,{contract:THORNS_S3_CONTRACT}):prepareThornsCore(b,u,{contract});b._setupUnit(u,prepared.kit);prepared.controller.install();
  const hits=[],attacks=[],births=[];
  b.on('damaged',ctx=>{if(ctx.source===u)hits.push({...ctx,time:b.time});});
  b.on('attack',ctx=>{if(ctx.attacker===u)attacks.push({...ctx,time:b.time});});
  b.on('thornsProjectileBirth',ctx=>{if(ctx.owner===u)births.push({...ctx,time:b.time});});
  const deploy=()=>{u.player.dp=99;assert.ok(b._deploy(u,{initial:false}));u.player.dp=99;};if(!defer)deploy();
  return {b,u,build,deploy,hits,attacks,births,...prepared};
}
function make(opts={}){
  const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
  d.stage.geometry.rows=19;d.stage.geometry.cols=21;d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
  const b=new StandardBattle(d,{operators:[defaultBuild(d.operators.char_289_gyuki)]});
  b.autoFinish=false;b.recordEvents=true;b.rng=()=>.99;b.setViewport('fullscreen-workspace');
  b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
  if(opts.roads)terrain({b},opts.roads);
  return owner(b,opts);
}
function enemy(f,{row=5,col=6,hp=1e7,res=0,fly=false,taunt=0,flags={}}={}){
  const t=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});
  Object.assign(t.base,{maxHp:hp,atk:0,def:0,res,moveSpeed:0,tauntLevel:taunt});t.markDirty();void t.s;t.hp=hp;
  if(fly)t.motion='FLY';f.b.addBuff(t,{key:'fixture:pin',flags:{noMove:true,disarm:true,...flags}});
  f.b._buildEnemyIndex();return t;
}
function ally(f,{row=5,col=6,kind='op',flags={}}={}){
  const def=normalizeChess({chessId:'fixture:ally',name:'Ally',profession:'GUARD',position:'MELEE',
    stats:{maxHp:10000,atk:0,def:0,baseAttackTime:1,attackSpeed:100,cost:0},rangeGrid:[[0,0]],skill:null});
  const t=f.b._makeAlly(f.u.player,def,kind,row,col,{dir:'RIGHT'});
  f.b._setupUnit(t,{trait:{noAttack:true},talents:[]});assert.ok(f.b._deploy(t,{initial:false}));
  if(Object.keys(flags).length)f.b.addBuff(t,{key:'fixture:flags',flags});return t;
}
function terrain(f,coordinates){
  const set=new Set(coordinates.map(([r,c])=>r*21+c));
  f.b.grid.tiles=f.b.grid.tiles.map((t,k)=>({...t,pass:set.has(k)?'ALL':'FLY'}));
}

test('private foundation stays absent from public data/registry; activated skills are held',()=>{
  assert.equal(REGULAR_OPERATORS[ID],undefined);assert.equal(data.operators[ID],undefined);
  assert.deepEqual(e.enabledOperators,[]);assert.equal(CONTRACT.frameParity,false);
  assert.throws(()=>make({contract:{...CONTRACT}}),/contract/);
  for(const skill of [1,2,3]){const f=make({skill});f.u.skill.addCharge(1);assert.equal(f.u.skill.activate(),false);}
});
test('selected source respects promotion, trust, potential and passive S3 range',()=>{
  const build={elite:2,level:90,potential:1,trust:0,skillId:'skchr_thorn2_1',skillRank:10};
  const r=selectedThornsBuild(build);near(r.stats.maxHp,1173);near(r.stats.atk,501);near(r.stats.def,106);
  near(r.stats.magicResistance,30);near(r.stats.cost,18);near(r.stats.respawnTime,70);near(r.extension.atk,.1);
  const z=selectedThornsBuild({...build,potential:6,trust:200});near(z.stats.magicResistance,42);near(z.stats.cost,16);near(z.stats.respawnTime,66);near(z.extension.atk,.14);
  assert.ok(z.stats.atk>501);assert.deepEqual(selectedThornsBuild({...build,skillId:'skchr_thorn2_3'}).rangeGrid,e.tables.ranges['3-9'].grids.map(v=>[v.row,v.col]));
  for(const change of [{elite:3},{level:0},{level:91},{potential:0},{potential:7},{trust:201},{trust:1.5},
    {skillRank:11},{module:'x'},{elite:0,level:1,skillRank:1,skillId:'skchr_thorn2_2'}])assert.throws(()=>selectedThornsBuild({...build,...change}));
});
test('tampered selected records fail before any controller hook is installed',()=>{
  for(const change of [d=>d.stats.atk++,d=>d.skill.spCost++,d=>d.skill.initSp++,d=>d.skill.duration++,
    d=>d.skill.bb.projectile_delay_time++,d=>{d.skill.spType='hurt';},d=>{d.rangeGrid=[[0,0]];},
    d=>{d.talents=[];},d=>{d.tags=[];},d=>d.skill.maxCharges++,d=>{d.skill.skillType='MANUAL';}]){
    const f=make({defer:true}),raw={...structuredClone(f.u.def.raw),skill:structuredClone(f.u.def.skill)};f.controller.stop();delete f.u.mem.thornsController;
    change(raw);f.u.def=normalizeChess(raw);f.u.rangeGrid=f.u.def.rangeGrid;
    const counts=Object.fromEntries(Object.entries(f.b._hooks).map(([k,v])=>[k,v.length]));
    assert.throws(()=>prepareThornsCore(f.b,f.u,{contract:CONTRACT}),/source/);
    assert.deepEqual(Object.fromEntries(Object.entries(f.b._hooks).map(([k,v])=>[k,v.length])),counts);
  }
});
for(const skill of [1,2,3])for(const [dir,row,col,face]of [['RIGHT',5,6,'Front'],['DOWN',4,5,'Front'],['LEFT',5,4,'Back'],['UP',6,5,'Back']])
test(`S${skill} ordinary mode ${dir}: original release event, one Arts target and native-facing clip`,()=>{
  const f=make({skill,dir});const t=enemy(f,{row,col});enemy(f,{row:row+1,col:col+1});until(f,()=>f.hits.length===1);
  assert.equal(f.births.length,1);assert.equal(f.attacks.length,1);assert.equal(f.hits[0].target,t);near(f.hits[0].amount,501*1.1);
  const clip=skill===3?'Skill_3_Loop':'Attack';near(f.births[0].time,1+e.models[ID][face].hits[clip][0],f.b.dt*2);
  near(f.hits[0].time-f.births[0].time,.1,f.b.dt*2);assert.equal(f.u.mem.regularFormVisual.clip,clip);
  assert.equal(f.u.mem.regularVisualDirection,face==='Back'?'UP':'RIGHT');near(f.u.skill.sp,Math.min(f.u.skill.spCost,f.b.time+f.u.def.skill.initSp),f.b.dt*2);
});
for(let skill=1;skill<=3;skill++)for(let rank=1;rank<=10;rank++)test(`selected S${skill} rank ${rank}: source SP, charges and ordinary combat`,()=>{
  const f=make({skill,rank}),s=e.tables.skills[`skchr_thorn2_${skill}`].levels[rank-1];enemy(f);until(f,()=>f.hits.length===1);
  near(f.u.skill.spCost,s.spData.spCost);assert.equal(f.u.skill.maxCharges,s.spData.maxChargeTime);
  near(f.record.bb.projectile_delay_time,s.blackboard.find(x=>x.key==='projectile_delay_time').value);
  near(f.hits[0].amount,501*1.1);assert.equal(f.u.skill.activations,0);
});
test('ASPD cannot move the capped native attack event earlier or shorten its clip; slowing stretches both',()=>{
  const fast=make();enemy(fast);fast.b.addBuff(fast.u,{key:'fixture:fast',mods:{aspd:100}});until(fast,()=>fast.births.length===2);
  near(fast.births[0].time,1.5,fast.b.dt*2);near(fast.births[1].time-fast.births[0].time,1.5,fast.b.dt*2);
  near(fast.u.mem.regularFormVisual.speed,1);
  const slow=make({elite:1,rank:7});enemy(slow);slow.b.addBuff(slow.u,{key:'fixture:slow',mods:{aspd:-50}});until(slow,()=>slow.births.length===2);
  near(slow.births[0].time,2,slow.b.dt*2);near(slow.births[1].time-slow.births[0].time,3,slow.b.dt*2);near(slow.u.mem.regularFormVisual.speed,.5);
});
test('ordinary live-ATK impact applies Arts mitigation without cached snapshot or extra talent hits',()=>{
  const f=make(),t=enemy(f,{res:50});until(f,()=>f.births.length===1);
  f.b.addBuff(f.u,{key:'fixture:atk',mods:{atkPct:1}});until(f,()=>f.hits.length===1);
  near(f.hits[0].amount,501*2.1*.5);assert.equal(f.hits[0].target,t);assert.equal(f.hits.length,1);
});
for(const flag of ['stun','freeze','sleep','disarm'])test(`${flag} interrupts unreleased ordinary attacks without disabling either talent`,()=>{
  const f=make();enemy(f);until(f,()=>f.controller.phase?.kind==='attack');
  f.b.addBuff(f.u,{key:'fixture:control',flags:{[flag]:true}});advance(f.b,1);assert.equal(f.births.length,0);
  near(f.u.s.atk,501*1.1);near(f.u.s.aspd,110);f.b.removeBuff(f.u,'fixture:control');until(f,()=>f.hits.length===1);
});
test('control applied and removed between ticks still cancels the captured windup',()=>{
  const f=make();enemy(f);until(f,()=>f.controller.phase?.kind==='attack');const p=f.controller.phase;
  f.b.addBuff(f.u,{key:'fixture:control',flags:{stun:true}});f.b.removeBuff(f.u,'fixture:control');
  advance(f.b,.7);assert.equal(f.births.length,0);assert.notEqual(f.controller.phase,p);until(f,()=>f.hits.length===1);
});
test('released shots survive control and retreat; a new target life cannot receive an old shot',()=>{
  const f=make();enemy(f);until(f,()=>f.births.length===1);f.b.retreat(f.u);until(f,()=>f.hits.length===1);
  assert.equal(f.controller.stopped,true);near(f.hits[0].amount,501);assert.equal(f.attacks.length,1);
  const z=make(),t=enemy(z);until(z,()=>z.births.length===1);t.deploySeq++;advance(z.b,.2);assert.equal(z.hits.length,0);
  const c=make();enemy(c);until(c,()=>c.births.length===1);c.b.addBuff(c.u,{key:'fixture:control',flags:{stun:true}});until(c,()=>c.hits.length===1);
});
test('dead windup target keeps source clip cooldown and never produces an accepted launch',()=>{
  const f=make(),t=enemy(f);until(f,()=>f.controller.phase?.kind==='attack');const p=f.controller.phase;
  f.b.kill(t);const z=enemy(f,{col:7});advance(f.b,.8);assert.equal(f.births.length,0);assert.equal(f.controller.phase,p);
  until(f,()=>f.births.length===1);assert.equal(f.births[0].target,z);assert.ok(f.births[0].time>=p.readyAt+.5-1e-6);
});
test('stealth, camouflage, sleeping, hidden and target-free enemies cannot be ordinary targets; airborne targets can',()=>{
  for(const flags of [{stealth:true},{camou:true},{sleep:true},{untargetable:true}]){
    const f=make();enemy(f,{flags});advance(f.b,3);assert.equal(f.births.length,0);
  }
  const f=make();const t=enemy(f);t.hidden=true;advance(f.b,3);assert.equal(f.births.length,0);
  t.hidden=false;t.motion='FLY';until(f,()=>f.hits.length===1);
});
for(const elite of [0,1,2])for(const potential of [1,5])test(`E${elite} P${potential}: talent ATK and duration memo use the selected tier and cap`,()=>{
  const f=make({elite,potential,rank:[4,7,10][elite]});const bb=f.record.extension;
  near(f.u.s.atk,f.record.stats.atk*(1+bb.atk));near(f.controller.fieldDuration(),f.record.bb.projectile_delay_time);
  const t=ally(f);near(f.controller.fieldDuration(),f.record.bb.projectile_delay_time+bb.projectile_extend);
  ally(f,{row:6,col:6});near(f.controller.fieldDuration(),f.record.bb.projectile_delay_time+bb.projectile_extend_max);
  near(f.controller.fieldDuration(),f.record.bb.projectile_delay_time+bb.projectile_extend_max);
  f.b.retreat(t);assert.ok(f.controller.fieldDuration()<=f.record.bb.projectile_delay_time+bb.projectile_extend_max);
});
test('duration extension excludes owner, tokens, devices, heal-free, hidden and outside-range operators',()=>{
  const f=make();ally(f,{kind:'token'});ally(f,{kind:'device',row:6,col:6});
  ally(f,{row:4,col:6,flags:{healFree:true}});const hidden=ally(f,{row:7,col:6});hidden.hidden=true;
  ally(f,{row:10,col:10});near(f.controller.fieldDuration(),8);
  const t=ally(f,{row:6,col:5,flags:{isolated:true}});near(f.controller.fieldDuration(),11);
  t.hidden=true;near(f.controller.fieldDuration(),8);t.hidden=false;t.x=10;t.y=10;near(f.controller.fieldDuration(),8);
});
test('S3 passive extended range governs both attack targeting and extension recipients',()=>{
  const f=make({skill:3});const t=enemy(f,{col:9});ally(f,{row:6,col:8});until(f,()=>f.hits.length===1);
  assert.equal(f.hits[0].target,t);near(f.controller.fieldDuration(),f.record.bb.projectile_delay_time+3);
  const z=make();enemy(z,{col:9});ally(z,{row:6,col:8});advance(z.b,3);assert.equal(z.births.length,0);near(z.controller.fieldDuration(),8);
});
test('tile aura uses maximal six-or-longer straight runs, never diagonals or six units',()=>{
  const f=make();terrain(f,[[5,5],[5,6],[5,7],[5,8],[5,9]]);assert.equal(thornsStraightTiles(f.b.grid).size,0);
  terrain(f,Array.from({length:6},(_,i)=>[5,5+i]));assert.equal(thornsStraightTiles(f.b.grid).size,6);
  terrain(f,Array.from({length:7},(_,i)=>[5+i,5]));assert.equal(thornsStraightTiles(f.b.grid).size,7);
  terrain(f,Array.from({length:6},(_,i)=>[5+i,5+i]));assert.equal(thornsStraightTiles(f.b.grid).size,0);
  const z=make({roads:Array.from({length:6},(_,i)=>[5+i,5+i])});
  for(let i=0;i<6;i++)ally(z,{row:2,col:2+i});advance(z.b,.1);near(z.u.s.aspd,105);
});
test('global base speed includes air/heal-free allies; extra speed follows eligible ground lines and motion',()=>{
  const f=make({roads:Array.from({length:6},(_,i)=>[5,5+i])}),t=ally(f,{flags:{healFree:true}}),z=enemy(f,{fly:true});
  const isolated=ally(f,{row:7,col:7,flags:{isolated:true}}),device=ally(f,{row:8,col:8,kind:'device'});
  terrain(f,Array.from({length:6},(_,i)=>[5,5+i]));advance(f.b,.1);
  near(t.s.aspd,110);near(z.s.aspd,90);near(isolated.s.aspd,100);near(device.s.aspd,100);
  t.x=6;t.y=6;z.x=6;z.y=6;advance(f.b,.1);near(t.s.aspd,105);near(z.s.aspd,95);
});
test('battle-start road eligibility survives runtime crate/terrain changes without stacking base buffs',()=>{
  const f=make({roads:Array.from({length:6},(_,i)=>[5,5+i])}),t=ally(f);advance(f.b,.1);near(t.s.aspd,110);
  f.b.grid.setObstacle(5,8,true,'crate');advance(f.b,.1);near(t.s.aspd,110);
  f.b.grid.setObstacle(5,8,false,'crate');advance(f.b,.1);near(t.s.aspd,110);
  for(let i=0;i<12;i++)advance(f.b,.1);assert.equal(t.buffs.filter(v=>v.key==='thorn2_t_2_speed_ally').length,1);
  f.b.grid.tiles[5*21+8]={...f.b.grid.tiles[5*21+8],pass:'FLY'};advance(f.b,.1);near(t.s.aspd,110);
});
test('hidden, removed and changed-life recipients lose old aura claims and reacquire without compounding',()=>{
  const f=make(),t=ally(f),z=enemy(f);advance(f.b,.1);near(t.s.aspd,110);near(z.s.aspd,90);
  t.hidden=true;z.hidden=true;advance(f.b,.1);near(t.s.aspd,100);near(z.s.aspd,100);
  t.hidden=false;z.hidden=false;t.deploySeq++;z.deploySeq++;advance(f.b,.1);near(t.s.aspd,110);near(z.s.aspd,90);
  f.b.retreat(t);assert.equal(t.findBuff('thorn2_t_2_speed_ally'),null);f.b.kill(z);assert.equal(z.findBuff('thorn2_t_2_speed_enemy'),null);
});
test('silence and control do not disable source nonsilenceable speed/ATK talents; E1 has no speed aura',()=>{
  const f=make(),t=ally(f);f.b.addBuff(f.u,{key:'fixture:silence',flags:{silence:true,stun:true}});advance(f.b,.1);
  near(t.s.aspd,110);near(f.u.s.atk,501*1.1);
  const z=make({elite:1,rank:7}),a=ally(z);advance(z.b,.1);near(a.s.aspd,100);assert.equal(a.findBuff('thorn2_t_2_speed_ally'),null);
});
test('duplicate private talent providers share one aura and a surviving provider resumes after retreat',()=>{
  const f=make(),z=owner(f.b,{row:7,col:5}),t=ally(f);advance(f.b,.1);near(t.s.aspd,110);
  assert.equal(t.buffs.filter(v=>v.key.startsWith('thorn2_t_2_')).length,2);
  f.b.retreat(f.u);near(t.s.aspd,110);assert.equal(t.findBuff('thorn2_t_2_speed_ally').source,z.u);
  f.b.retreat(z.u);near(t.s.aspd,100);assert.equal(t.findBuff('thorn2_t_2_speed_ally'),null);
});
for(const end of ['withdraw','death','battleEnd'])test(`${end} removes both aura channels, self ATK and controller hooks`,()=>{
  const f=make(),t=ally(f),z=enemy(f);advance(f.b,.1);
  if(end==='withdraw')f.b.retreat(f.u);else if(end==='death')f.b.kill(f.u);else f.b.forceEnd('fixture');
  assert.equal(f.controller.stopped,true);assert.equal(f.controller.handles.length,0);assert.equal(f.controller.auraClaims.size,0);
  assert.equal(f.u.mem.regularFormVisual,null);assert.equal(f.u.findBuff('thorn2_t_1'),null);
  near(t.s.aspd,100);near(z.s.aspd,100);assert.equal(t.findBuff('thorn2_t_2_ally_extra'),null);
});
test('temporarily hidden owner detaches both talents and resumes on the same deployment life',()=>{
  const f=make(),t=ally(f);advance(f.b,.1);near(t.s.aspd,110);f.u.hidden=true;advance(f.b,.1);
  near(t.s.aspd,100);assert.equal(f.controller.stopped,false);assert.equal(f.u.findBuff('thorn2_t_1'),null);
  f.u.hidden=false;advance(f.b,.1);near(t.s.aspd,110);near(f.u.s.atk,551.1);
});

const s1=f=>f.controller.s1;
const fieldBuff=t=>t.buffs.find(v=>v.data?.nativeBuffKey==='thorns2_s_1[buff]')??null;
const holdSp=f=>f.b.addBuff(f.u,{key:'fixture:holdSP',flags:{noSp:true}});
for(let rank=1;rank<=10;rank++)test(`S1 rank ${rank} casts with natural SP and gives source continuous regeneration/DEF`,()=>{
  const f=make({sourceS1:true,rank}),t=ally(f);t.hp=1000;
  until(f,()=>s1(f).fields.length>0,12);const field=s1(f).fields[0],bb=f.record.bb;
  assert.equal(f.u.skill.activations,1);assert.equal(f.u.skill.active,true);near(f.u.skill.sp,0);
  near(field.cachedAtk,551.1);near(t.s.hpRegen,field.cachedAtk*bb.hp_recovery_per_sec_ratio);
  near(t.s.def,bb.def);near(field.expiresAt-f.b.time,bb.projectile_delay_time+3,f.b.dt*2);
  const before=t.hp;advance(f.b,.3);near(t.hp-before,field.cachedAtk*bb.hp_recovery_per_sec_ratio*.3,1.1);
  const start=f.u.skill.lastStart;assert.ok(start>=Math.max(1,f.u.def.skill.spCost-f.u.def.skill.initSp)-f.b.dt);
  until(f,()=>!f.u.skill.active);near(f.b.time-start,1.5,f.b.dt*2);advance(f.b,.2);assert.ok(f.u.skill.sp>0);
});
for(const dir of ['UP','RIGHT','DOWN','LEFT'])test(`S1 ${dir}: exact original Skill event and capped native cast speed`,()=>{
  const f=make({sourceS1:true,dir}),throws=[];f.b.on('thornsS1Throw',c=>throws.push({...c,time:f.b.time}));
  f.b.addBuff(f.u,{key:'fixture:fast',mods:{aspd:100}});until(f,()=>throws.length===1);
  near(throws[0].time-f.u.skill.lastStart,.6,f.b.dt*2);near(f.u.mem.regularFormVisual.speed,1);
  assert.equal(f.u.mem.regularFormVisual.clip,'Skill');assert.equal(throws[0].target,f.u);
});
test('S1 slowed cast stretches its source clip and holds SP until completion',()=>{
  const f=make({sourceS1:true,elite:1,rank:7}),throws=[];f.b.addBuff(f.u,{key:'fixture:slow',mods:{aspd:-50}});
  f.b.on('thornsS1Throw',c=>throws.push({...c,time:f.b.time}));until(f,()=>throws.length===1);
  near(throws[0].time-f.u.skill.lastStart,1.2,f.b.dt*2);near(f.u.skill.sp,0);
  until(f,()=>!f.u.skill.active);near(f.b.time-f.u.skill.lastStart,3,f.b.dt*2);
});
test('S1 snapshots duration at cast start and ATK at release, never compounds extension on repeated casts',()=>{
  const f=make({sourceS1:true}),throws=[];f.b.on('thornsS1Throw',c=>throws.push(c));until(f,()=>s1(f).cast!==null);
  const t=ally(f);t.hp=1000;f.b.addBuff(f.u,{key:'fixture:atk',mods:{atkPct:1}});
  until(f,()=>throws.length===1);near(throws[0].duration,8);near(throws[0].cachedAtk,501*2.1);
  f.b.removeBuff(f.u,'fixture:atk');until(f,()=>s1(f).fields.length===1);near(f.u.s.hpRegen,501*2.1*.2);
  until(f,()=>throws.length===2);near(throws[1].duration,11);near(throws[1].cachedAtk,551.1);
  until(f,()=>throws.length===3);near(throws[2].duration,11);
});
test('S1 lowest-HP-ratio target selection and field are independent of ordinary enemy targeting',()=>{
  const f=make({sourceS1:true}),a=ally(f),z=ally(f,{row:6,col:6}),throws=[];a.hp=7000;z.hp=1000;enemy(f);
  f.b.on('thornsS1Throw',ctx=>throws.push(ctx));until(f,()=>throws.length===1);assert.equal(throws[0].target,z);
  until(f,()=>s1(f).fields.length===1);assert.ok(fieldBuff(a));assert.ok(fieldBuff(z));assert.equal(f.hits.length,0);
});
test('S1 anchors stop following after arrival; leaving, entering and expiry detach only the field buff',()=>{
  const f=make({sourceS1:true}),t=ally(f);t.hp=1000;until(f,()=>s1(f).fields.length===1);holdSp(f);
  const field=s1(f).fields[0];near(field.x,t.x);near(field.y,t.y);assert.ok(fieldBuff(t));
  t.x=10;t.y=10;advance(f.b,.1);assert.equal(fieldBuff(t),null);near(t.s.hpRegen,0);near(t.s.def,0);
  t.x=6;t.y=5;advance(f.b,.1);assert.ok(fieldBuff(t));near(field.x,6);near(field.y,5);
  const own=f.b.addBuff(t,{key:'fixture:other',mods:{defFlat:7,hpRegen:2}});
  until(f,()=>!field.active,15);assert.equal(fieldBuff(t),null);assert.equal(t.findBuff(own.key),own);near(t.s.hpRegen,2);near(t.s.def,7);
});
test('S1 heal-free, target-free, isolated and device recipients are excluded; eligible summons can receive the field',()=>{
  const f=make({sourceS1:true}),t=ally(f);t.hp=1000;
  const free=ally(f,{row:4,col:6,flags:{healFree:true}}),isolated=ally(f,{row:6,col:6,flags:{isolated:true}});
  const untargetable=ally(f,{row:5,col:7,flags:{untargetable:true}}),device=ally(f,{row:6,col:7,kind:'device'});
  const token=ally(f,{row:4,col:7,kind:'token'});until(f,()=>s1(f).fields.length===1);
  for(const a of [free,isolated,untargetable,device])assert.equal(fieldBuff(a),null);
  assert.ok(fieldBuff(token));assert.ok(fieldBuff(t));
});
test('S1 no eligible targets never spends SP, while full-health eligible allies still receive DEF',()=>{
  const f=make({sourceS1:true});f.b.addBuff(f.u,{key:'fixture:free',flags:{healFree:true}});advance(f.b,3);
  assert.equal(f.u.skill.activations,0);assert.equal(f.u.skill.charges,1);f.b.removeBuff(f.u,'fixture:free');
  until(f,()=>s1(f).fields.length===1);assert.ok(fieldBuff(f.u));near(f.u.hp,f.u.s.maxHp);near(f.u.s.def,206);
});
for(const flag of ['stun','freeze','sleep','disarm'])test(`S1 ${flag} cancels unborn field; already released field remains`,()=>{
  const f=make({sourceS1:true});until(f,()=>s1(f).cast!==null);f.b.addBuff(f.u,{key:'fixture:control',flags:{[flag]:true}});
  advance(f.b,1);assert.equal(s1(f).fields.length,0);assert.equal(f.u.skill.active,false);
  const z=make({sourceS1:true});until(z,()=>s1(z).fields.length===1);z.b.addBuff(z.u,{key:'fixture:control',flags:{[flag]:true}});
  advance(z.b,1);assert.equal(s1(z).fields.length,1);assert.ok(fieldBuff(z.u));
});
test('S1 short between-tick control cancels the native cast and does not emit a field',()=>{
  const f=make({sourceS1:true});until(f,()=>s1(f).cast!==null);
  f.b.addBuff(f.u,{key:'fixture:control',flags:{stun:true}});f.b.removeBuff(f.u,'fixture:control');advance(f.b,1);
  assert.equal(s1(f).fields.length,0);assert.equal(f.u.skill.active,false);
});
test('S1 target death before release refunds the source cost and cannot heal a reused target life',()=>{
  const f=make({sourceS1:true}),t=ally(f);t.hp=1000;until(f,()=>s1(f).cast!==null);assert.equal(s1(f).cast.target,t);
  f.b.kill(t);advance(f.b,f.b.dt);assert.equal(f.u.skill.active,false);assert.equal(f.u.skill.charges,1);assert.equal(s1(f).fields.length,0);
  until(f,()=>s1(f).fields.length===1);assert.equal(fieldBuff(t),null);
});
test('S1 emitted flight and field survive retreat with cached ATK and independent expiry/hook cleanup',()=>{
  const f=make({sourceS1:true}),t=ally(f),throws=[];t.hp=1000;f.b.on('thornsS1Throw',ctx=>throws.push(ctx));
  until(f,()=>throws.length===1);f.b.retreat(f.u);until(f,()=>s1(f).fields.length===1);const field=s1(f).fields[0];
  near(t.s.hpRegen,551.1*.2);near(field.cachedAtk,551.1);assert.equal(f.controller.stopped,true);assert.ok(s1(f).handles.length>0);
  until(f,()=>s1(f).fields.length===0,15);assert.equal(fieldBuff(t),null);assert.equal(s1(f).handles.length,0);
});
test('S1 independently owned fields stack and expiring one preserves the remaining contribution',()=>{
  const f=make({sourceS1:true}),t=ally(f);t.hp=1000;until(f,()=>s1(f).fields.length===1);holdSp(f);
  const old=s1(f).fields[0];const z=owner(f.b,{sourceS1:true,row:6,col:5,potential:5});
  until(z,()=>s1(z).fields.length===1);holdSp(z);near(t.s.hpRegen,(old.cachedAtk+s1(z).fields[0].cachedAtk)*.2);near(t.s.def,200);
  assert.equal(t.buffs.filter(v=>v.data?.nativeBuffKey==='thorns2_s_1[buff]').length,2);
  until(f,()=>!old.active,15);near(t.s.hpRegen,s1(z).fields[0].cachedAtk*.2);near(t.s.def,100);
  f.b.forceEnd('fixture');assert.equal(fieldBuff(t),null);assert.equal(s1(f).handles.length,0);assert.equal(s1(z).handles.length,0);
});
test('S1 recipient hide/new life and field completion never leak a derived buff',()=>{
  const f=make({sourceS1:true}),t=ally(f);t.hp=1000;until(f,()=>s1(f).fields.length===1);holdSp(f);
  t.hidden=true;advance(f.b,.1);assert.equal(fieldBuff(t),null);t.hidden=false;t.deploySeq++;advance(f.b,.1);assert.ok(fieldBuff(t));
  f.b.retreat(t);assert.equal(fieldBuff(t),null);f.b.forceEnd('fixture');assert.equal(fieldBuff(f.u),null);assert.equal(s1(f).handles.length,0);
});
test('S1 original nonextendable field remains nine tiles when owner attack range is extended',()=>{
  const f=make({sourceS1:true}),t=ally(f,{col:9});t.hp=1000;
  f.b.addBuff(f.u,{key:'fixture:range',mods:{rangeExtend:2}});until(f,()=>s1(f).fields.length===1);
  const field=s1(f).fields[0];assert.equal(field.col,9);assert.equal(field.keys.size,9);
  assert.equal(fieldBuff(f.u),null);assert.ok(fieldBuff(t));
});
test('S1 source nonsilenceable skill can cast under silence, while noSp stops natural charging',()=>{
  const f=make({sourceS1:true,rank:1});f.b.addBuff(f.u,{key:'fixture:block',flags:{noSp:true,silence:true}});
  advance(f.b,10);assert.equal(f.u.skill.activations,0);near(f.u.skill.sp,0);
  f.b.removeBuff(f.u,'fixture:block');f.b.addBuff(f.u,{key:'fixture:silence',flags:{silence:true}});
  until(f,()=>s1(f).fields.length===1);assert.equal(f.u.skill.activations,1);
});
test('finished battle clears released ordinary shots and S1 flights before any later receipt',()=>{
  for(const sourceS1 of [false,true]){
    const f=make({sourceS1}),throws=[];enemy(f);const t=ally(f);t.hp=1000;
    f.b.on('thornsS1Throw',ctx=>throws.push(ctx));until(f,()=>sourceS1?throws.length===1:f.births.length===1);
    f.b.forceEnd('fixture');assert.equal(f.b.projectiles.list.filter(p=>p.data?.thornsOwner===f.controller||p.data?.thornsS1===s1(f)).length,0);
    assert.equal(f.controller.stopped,true);if(sourceS1)assert.equal(s1(f).handles.length,0);
  }
});

const s2=f=>f.controller.s2;
function makeS2(opts={}){return make({...opts,skill:2,sourceS2:true});}
function startS2(f){until(f,()=>f.u.skill.ready&&s2(f).canCast(),35);assert.equal(f.u.skill.activate(),true);}
function s2Dots(f){const hits=[];f.b.on('damaged',c=>{if(c.dmg?.tags?.includes('thorns:s2'))hits.push({...c,time:f.b.time});});return hits;}
function enemyHeal(f,t,amount=400){t.hp=t.s.maxHp-10000;return f.b.heal(t,t,amount,{self:true});}
const s2Buff=t=>t.buffs.find(v=>v.data?.nativeBuffKey?.startsWith('thorn2_s'))??null;
for(let rank=1;rank<=10;rank++)test(`S2 rank ${rank}: manual natural SP, source charges, cached regeneration and mitigated periodic damage`,()=>{
  const f=makeS2({rank}),a=ally(f),t=enemy(f,{res:50}),dots=s2Dots(f),ends=[];a.hp=1000;
  f.b.on('skillEnd',c=>{if(c.unit===f.u)ends.push(f.b.time);});
  until(f,()=>f.u.skill.ready,35);assert.equal(f.u.skill.activations,0);advance(f.b,.3);assert.equal(f.u.skill.activations,0);
  startS2(f);const start=f.b.time;assert.equal(f.u.skill.active,true);const charge=f.u.skill.charges;
  until(f,()=>s2(f).fields.length===1);const field=s2(f).fields[0],bb=f.record.bb;
  assert.equal(field.startX,6);assert.equal(field.startY,5);near(field.radius,1.1);near(field.cachedAtk,551.1);
  near(a.s.hpRegen,551.1*bb.hp_recovery_per_sec_ratio_chr);near(enemyHeal(f,t),200);
  near(field.expiresAt-field.bornAt,bb.projectile_delay_time+3);assert.equal(dots.length,0);
  until(f,()=>dots.length===1);near(dots[0].time-field.bornAt,.9,f.b.dt*2);
  near(dots[0].amount,551.1*bb.atk_scale*.5);assert.equal(dots[0].target,t);assert.equal(dots[0].source,null);
  until(f,()=>!f.u.skill.active);near(ends[0]-start,1.5,f.b.dt*2);assert.equal(f.u.skill.charges,charge);
  assert.equal(f.u.skill.maxCharges,rank>=7?2:1);advance(f.b,.2);assert.ok(f.u.skill.sp>0);
});
for(const [dir,x,y]of [['RIGHT',7,5],['UP',5,7],['LEFT',3,5],['DOWN',5,3]])test(`S2 ${dir}: no-enemy throw uses the farthest forward tile and exact capped original event`,()=>{
  const f=makeS2({dir}),throws=[];f.b.on('thornsS2Throw',c=>throws.push({...c,time:f.b.time}));
  f.b.addBuff(f.u,{key:'fixture:fast',mods:{aspd:100}});startS2(f);const start=f.b.time;
  until(f,()=>throws.length===1);near(throws[0].time-start,.566666663,f.b.dt*2);
  assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2');near(f.u.mem.regularFormVisual.speed,1);
  assert.equal(throws[0].x,x);assert.equal(throws[0].y,y);
  until(f,()=>s2(f).fields.length===1);const field=s2(f).fields[0];advance(f.b,2);
  near(field.x,x+(x-5)/2*.1*2);near(field.y,y+(y-5)/2*.1*2);near(field.radius,1.1*(1+.13*2));
});
test('S2 slowed original cast stretches release/clip and stops SP until completion',()=>{
  const f=makeS2({elite:1,rank:7}),throws=[];f.b.addBuff(f.u,{key:'fixture:slow',mods:{aspd:-50}});
  f.b.on('thornsS2Throw',c=>throws.push({...c,time:f.b.time}));startS2(f);const start=f.b.time,sp=f.u.skill.sp;
  until(f,()=>throws.length===1);near(throws[0].time-start,.566666663*2,f.b.dt*2);near(f.u.skill.sp,sp);
  until(f,()=>!f.u.skill.active);near(f.b.time-start,3,f.b.dt*2);
});
test('S2 two charges retain partial SP, allow separate fields and never auto-cast',()=>{
  const f=makeS2();until(f,()=>f.u.skill.charges===2,60);assert.equal(f.u.skill.activations,0);
  startS2(f);assert.equal(f.u.skill.charges,1);assert.equal(f.u.skill.activate(),false);
  until(f,()=>!f.u.skill.active);advance(f.b,2);const partial=f.u.skill.sp;assert.ok(partial>0&&partial<20);
  assert.ok(f.u.skill.activate());near(f.u.skill.sp,partial);assert.equal(f.u.skill.charges,0);
  until(f,()=>s2(f).fields.length===2);assert.equal(f.u.skill.activations,2);
});
test('S2 enemy motion is sampled at release and landing remains fixed after target removal',()=>{
  const f=makeS2(),t=enemy(f),throws=[];f.b.on('thornsS2Throw',c=>throws.push(c));startS2(f);
  t.x=7;t.y=6;until(f,()=>throws.length===1);assert.equal(throws[0].x,7);assert.equal(throws[0].y,6);
  t.x=10;t.y=10;f.b.kill(t);until(f,()=>s2(f).fields.length===1);near(s2(f).fields[0].startX,7);near(s2(f).fields[0].startY,6);
});
test('S2 losing the pre-event enemy retains its original root tile and does not refund the spent charge',()=>{
  const f=makeS2(),t=enemy(f);startS2(f);const charge=f.u.skill.charges;f.b.kill(t);
  until(f,()=>s2(f).fields.length===1);assert.equal(s2(f).fields[0].startX,6);assert.equal(f.u.skill.charges,charge);
});
test('S2 lifetime extends while motion and growth stop at selected base remaining_time',()=>{
  const f=makeS2(),t=ally(f);startS2(f);until(f,()=>s2(f).fields.length===1);holdSp(f);
  const field=s2(f).fields[0],bb=f.record.bb;advance(f.b,bb.remaining_time+1);
  assert.equal(field.active,true);near(field.x,7+.1*bb.remaining_time);near(field.radius,1.1*(1+.13*bb.remaining_time));
  const x=field.x,r=field.radius;advance(f.b,1);near(field.x,x);near(field.radius,r);
  until(f,()=>!field.active,5);assert.equal(s2Buff(t),null);
});
test('S2 a same-tile enemy yields a growing stationary field instead of a fabricated drift direction',()=>{
  const f=makeS2(),t=enemy(f,{col:5});startS2(f);until(f,()=>s2(f).fields.length===1);const field=s2(f).fields[0];
  advance(f.b,2);near(field.x,5);near(field.y,5);near(field.radius,1.1*(1+.13*2));assert.ok(s2Buff(t));
});
test('S2 newly covered recipients get their own .9-second damage clock; leave/re-entry and new lives reset it',()=>{
  const f=makeS2(),t=enemy(f),dots=s2Dots(f);startS2(f);until(f,()=>s2(f).fields.length===1);
  t.x=12;t.y=12;advance(f.b,1.1);assert.equal(s2Buff(t),null);assert.equal(dots.length,0);
  const field=s2(f).fields[0];t.x=field.x;t.y=field.y;advance(f.b,f.b.dt);const enter=f.b.time;
  advance(f.b,.8);assert.equal(dots.length,0);until(f,()=>dots.length===1);near(dots[0].time-enter,.9,f.b.dt*2);
  t.deploySeq++;advance(f.b,f.b.dt);const life=f.b.time;advance(f.b,.8);assert.equal(dots.length,1);
  until(f,()=>dots.length===2);near(dots[1].time-life,.9,f.b.dt*2);
  t.hidden=true;advance(f.b,.1);assert.equal(s2Buff(t),null);t.hidden=false;advance(f.b,.1);assert.ok(s2Buff(t));
});
test('S2 fields exclude devices, isolated/heal-free/target-free allies and airborne or target-free enemies',()=>{
  const f=makeS2(),anchor=enemy(f),a=ally(f),token=ally(f,{row:6,col:6,kind:'token'});
  const rejected=[ally(f,{row:4,col:6,kind:'device'}),ally(f,{row:5,col:7,flags:{isolated:true}}),
    ally(f,{row:6,col:5,flags:{healFree:true}}),ally(f,{row:4,col:5,flags:{untargetable:true}}),
    enemy(f,{fly:true}),enemy(f,{flags:{untargetable:true}}),enemy(f,{flags:{sleep:true}}),enemy(f,{flags:{stealth:true}})];
  startS2(f);until(f,()=>s2(f).fields.length===1);
  assert.ok(s2Buff(anchor));assert.ok(s2Buff(a));assert.ok(s2Buff(token));for(const t of rejected)assert.equal(s2Buff(t),null);
  anchor.motion='FLY';advance(f.b,.1);assert.equal(s2Buff(anchor),null);
});
test('S2 selection excludes air/camouflage while collateral ground camouflage can receive the field',()=>{
  const f=makeS2(),air=enemy(f,{fly:true,col:6}),camou=enemy(f,{flags:{camou:true},col:7});
  startS2(f);until(f,()=>s2(f).fields.length===1);assert.equal(s2(f).fields[0].startX,7);
  assert.equal(s2Buff(air),null);assert.ok(s2Buff(camou));
});
test('S2 overlapping fields stack regeneration/damage and multiply healing and both kinds of HP recovery',()=>{
  const f=makeS2(),t=enemy(f),a=ally(f),dots=s2Dots(f);a.hp=1000;
  f.b.addBuff(t,{key:'fixture:regen',mods:{hpRegen:100,hpRegenRatio:.001}});startS2(f);
  until(f,()=>s2(f).fields.length===1);const old=s2(f).fields[0];until(f,()=>!f.u.skill.active);holdSp(f);
  const z=owner(f.b,{sourceS2:true,skill:2,row:6,col:5,potential:5});startS2(z);until(z,()=>s2(z).fields.length===1);holdSp(z);
  const other=s2(z).fields[0];near(a.s.hpRegen,(old.cachedAtk+other.cachedAtk)*.18);
  near(enemyHeal(f,t),100);near(t.s.hpRegen,(100+.001*t.s.maxHp)*.25);
  const oldCount=dots.length;advance(f.b,1.2);assert.ok(dots.length>=oldCount+2);
  until(f,()=>!old.active,20);near(t.s.hpRegen,(100+.001*t.s.maxHp)*.5);near(enemyHeal(f,t),200);near(a.s.hpRegen,other.cachedAtk*.18);
  f.b.forceEnd('fixture');near(t.s.hpRegen,100+.001*t.s.maxHp);near(enemyHeal(f,t),400);near(a.s.hpRegen,0);
});
test('S2 DOT caches release ATK and ignores source damage modifiers while retaining enemy mitigation',()=>{
  const f=makeS2(),t=enemy(f,{res:50}),dots=s2Dots(f);startS2(f);
  f.b.addBuff(f.u,{key:'fixture:atk',mods:{atkPct:1,dmgDealtMul:3,resIgnoreFlat:50}});
  until(f,()=>s2(f).fields.length===1);const cached=s2(f).fields[0].cachedAtk;near(cached,501*2.1);
  f.b.removeBuff(f.u,'fixture:atk');f.b.addBuff(t,{key:'fixture:fragile',mods:{dmgTakenMul:1.5}});
  f.b.retreat(f.u);until(f,()=>dots.length===1);near(dots[0].amount,cached*1.8*.5*1.5);
  assert.equal(dots[0].source,null);assert.equal(f.controller.stopped,true);
  until(f,()=>s2(f).fields.length===0,25);assert.equal(s2(f).handles.length,0);assert.equal(s2Buff(t),null);
});
for(const flag of ['stun','freeze','sleep','disarm'])test(`S2 ${flag} cancels an unreleased cast but does not remove a released field`,()=>{
  const f=makeS2();startS2(f);f.b.addBuff(f.u,{key:'fixture:control',flags:{[flag]:true}});advance(f.b,1);
  assert.equal(s2(f).fields.length,0);assert.equal(f.u.skill.active,false);
  const z=makeS2();startS2(z);until(z,()=>s2(z).fields.length===1);z.b.addBuff(z.u,{key:'fixture:control',flags:{[flag]:true}});
  advance(z.b,1);assert.equal(s2(z).fields.length,1);
});
test('S2 between-tick control and temporary owner hiding cancel only the unborn cast',()=>{
  const f=makeS2();startS2(f);f.b.addBuff(f.u,{key:'fixture:control',flags:{stun:true}});f.b.removeBuff(f.u,'fixture:control');
  advance(f.b,1);assert.equal(s2(f).fields.length,0);assert.equal(f.u.skill.active,false);
  const z=makeS2();startS2(z);z.u.hidden=true;advance(z.b,.1);assert.equal(z.u.skill.active,false);
  z.u.hidden=false;advance(z.b,.1);assert.equal(z.controller.stopped,false);
});
test('S2 source silence does not block manual activation; noSp prevents natural recharge',()=>{
  const f=makeS2();f.b.addBuff(f.u,{key:'fixture:noSP',flags:{noSp:true}});advance(f.b,25);assert.equal(f.u.skill.ready,false);
  f.b.removeBuff(f.u,'fixture:noSP');f.b.addBuff(f.u,{key:'fixture:silence',flags:{silence:true}});startS2(f);until(f,()=>s2(f).fields.length===1);
});
test('S2 released flights survive source retreat; finished battles remove flights, fields and all derived instances',()=>{
  const f=makeS2(),a=ally(f),throws=[];f.b.on('thornsS2Throw',c=>throws.push(c));startS2(f);until(f,()=>throws.length===1);
  f.b.retreat(f.u);until(f,()=>s2(f).fields.length===1);assert.ok(s2Buff(a));f.b.forceEnd('fixture');
  assert.equal(s2Buff(a),null);assert.equal(s2(f).fields.length,0);assert.equal(s2(f).handles.length,0);
  const z=makeS2(),shots=[];z.b.on('thornsS2Throw',c=>shots.push(c));startS2(z);until(z,()=>shots.length===1);z.b.forceEnd('fixture');
  assert.equal(z.b.projectiles.list.filter(p=>p.data?.thornsS2).length,0);assert.equal(s2(z).fields.length,0);
});
test('S2 no valid forward tile does not consume its charge; changing direction restores eligibility',()=>{
  const f=makeS2({col:20});until(f,()=>f.u.skill.ready,35);assert.equal(f.u.skill.activate(),false);assert.equal(f.u.skill.charges,1);
  f.u.dir='LEFT';f.b._refreshRange(f.u);assert.equal(f.u.skill.activate(),true);until(f,()=>s2(f).fields.length===1);assert.equal(s2(f).fields[0].startX,18);
});
test('S1 equal-HP-ratio targets use the latest deployment instead of the oldest',()=>{
  const f=make({sourceS1:true}),a=ally(f),z=ally(f,{row:6,col:6}),throws=[];a.hp=z.hp=5000;
  f.b.on('thornsS1Throw',c=>throws.push(c));until(f,()=>throws.length===1);assert.equal(throws[0].target,z);
});

test('S2 enemy healing/recovery reduction applies to actual HP changes and detaches on leaving the field',()=>{
  const f=makeS2(),t=enemy(f);t.hp=1000;f.b.addBuff(t,{key:'fixture:regeneration',mods:{hpRegen:100,hpRegenRatio:.0001}});
  startS2(f);until(f,()=>s2(f).fields.length===1);near(t.s.hpRegen,550);
  const regenBefore=t.hp;advance(f.b,.3);near(t.hp-regenBefore,165,1.1);
  const before=t.hp;f.b.heal(t,t,200,{self:true});near(t.hp-before,100);
  t.x=15;t.y=15;advance(f.b,.1);near(t.s.hpRegen,1100);near(enemyHeal(f,t),400);
  const after=t.hp;f.b.heal(t,t,200,{self:true});near(t.hp-after,200);assert.equal(s2Buff(t),null);
});
test('S2 growth reaches new ground recipients without replacing the original enemy DOT clock',()=>{
  const f=makeS2(),t=enemy(f),a=ally(f,{row:5,col:8}),dots=s2Dots(f);startS2(f);until(f,()=>s2(f).fields.length===1);
  assert.equal(s2Buff(a),null);until(f,()=>!!s2Buff(a),10);near(a.s.hpRegen,551.1*.18);
  assert.ok(dots.length>=3);for(let i=1;i<dots.length;i++)near(dots[i].time-dots[i-1].time,1,f.b.dt*2);
  assert.ok(s2Buff(t));
});
test('S2 delayed field ticks kill the enemy once and remove its derived buff without recursive damage',()=>{
  const f=makeS2(),t=enemy(f),dots=s2Dots(f);startS2(f);until(f,()=>s2(f).fields.length===1);t.hp=1;
  until(f,()=>!t.alive);assert.equal(dots.length,1);assert.equal(s2Buff(t),null);advance(f.b,2);assert.equal(dots.length,1);
});
test('S2 native ground/heal-free hit checker detaches when an enemy becomes heal-free',()=>{
  const f=makeS2(),t=enemy(f),dots=s2Dots(f);startS2(f);until(f,()=>s2(f).fields.length===1);
  f.b.addBuff(t,{key:'fixture:healFree',flags:{healFree:true}});advance(f.b,1.1);assert.equal(s2Buff(t),null);assert.equal(dots.length,0);
  f.b.removeBuff(t,'fixture:healFree');advance(f.b,f.b.dt);until(f,()=>dots.length===1);assert.ok(s2Buff(t));
});
test('S2 native circle checks large enemy bodies rather than only their center',()=>{
  const f=makeS2(),t=enemy(f);startS2(f);until(f,()=>s2(f).fields.length===1);const field=s2(f).fields[0];
  t.x=field.x+2;t.y=field.y;t.hitArea={w:3,h:1,dx:0,dy:0};advance(f.b,f.b.dt);assert.ok(s2Buff(t));
  t.hitArea=null;advance(f.b,f.b.dt);assert.equal(s2Buff(t),null);
});
test('S2 deferred battle finish requested during DOT removes all fields/instances at the phase boundary',()=>{
  const f=makeS2(),t=enemy(f),z=enemy(f),dots=s2Dots(f);startS2(f);until(f,()=>s2(f).fields.length===1);
  f.b.on('damaged',ctx=>{if(ctx.dmg?.tags?.includes('thorns:s2'))f.b.forceEnd('fixture:receipt');});
  until(f,()=>f.b.finished);assert.equal(dots.length,2);assert.equal(s2Buff(t),null);assert.equal(s2Buff(z),null);assert.equal(s2(f).handles.length,0);
});
test('S2 preparation rejects the wrong selected skill or copied contract before installing hooks',()=>{
  const f=make({defer:true});f.controller.stop();delete f.u.mem.thornsController;
  const counts=Object.fromEntries(Object.entries(f.b._hooks).map(([k,v])=>[k,v.length]));
  assert.throws(()=>prepareThornsS2(f.b,f.u,{contract:THORNS_S2_CONTRACT}),/second skill/);
  assert.throws(()=>prepareThornsS2(f.b,f.u,{contract:{...THORNS_S2_CONTRACT}}),/contract/);
  assert.deepEqual(Object.fromEntries(Object.entries(f.b._hooks).map(([k,v])=>[k,v.length])),counts);
});
test('road capture rejects a late first preparation instead of scanning changed runtime terrain',()=>{
  const f=make();advance(f.b,.2);
  // A second controller in a previously captured battle shares its initial road map.
  const z=owner(f.b,{defer:true});assert.equal(z.controller.roads,f.controller.roads);z.controller.stop();
  const b=new StandardBattle(data,{operators:[defaultBuild(data.operators.char_289_gyuki)]});b.time=.2;
  assert.throws(()=>owner(b,{defer:true}),/before combat/);
});


test('S2 ordinary heal modifier survives owner retreat without changing regeneration or explicit event bypass',()=>{
  const f=makeS2(),t=enemy(f);startS2(f);until(f,()=>s2(f).fields.length===1);
  f.b.retreat(f.u);near(enemyHeal(f,t),200);
  t.hp=t.s.maxHp-10000;near(f.b.heal(t,t,400,{self:true,regen:true}),400);
  near(f.b.heal(t,t,400,{self:true,skipModifierEvent:true}),400);
  f.b.forceEnd('fixture');near(enemyHeal(f,t),400);assert.equal(s2(f).handles.length,0);
});
test('S2 healing modifier composes with other incoming heal modifiers without reducing regeneration twice',()=>{
  const f=makeS2(),t=enemy(f);f.b.addBuff(t,{key:'fixture:incoming-heal',mods:{healingTakenMul:.8}});
  startS2(f);until(f,()=>s2(f).fields.length===1);near(enemyHeal(f,t),160);
  f.b.removeBuff(t,'fixture:incoming-heal');near(enemyHeal(f,t),200);
  f.b.removeBuff(t,s2Buff(t));near(enemyHeal(f,t),400);
});

const s3=f=>f.controller.s3;
const makeS3=opts=>make({...opts,skill:3,sourceS3:true});
function startS3(f){until(f,()=>f.u.skill.ready&&s3(f).canCast(),80);assert.equal(f.u.skill.activate(),true);}
function s3Hits(f){const hits=[];f.b.on('damaged',c=>{if(c.dmg?.tags?.includes('thorns:s3'))hits.push({...c,time:f.b.time});});return hits;}
function anchorsS3(f){return [ally(f,{row:4,col:6}),ally(f,{row:6,col:6}),ally(f,{row:6,col:7}),ally(f,{row:4,col:7})];}
for(let rank=1;rank<=10;rank++)test(`S3 rank ${rank}: natural manual SP, selected anchor count, cached Arts output and reduction ramps`,()=>{
  const f=makeS3({rank}),anchors=anchorsS3(f),t=enemy(f,{row:5,col:6,res:50}),hits=s3Hits(f);
  t.x=6.75;t.base.atk=100;t.base.def=100;t.markDirty();until(f,()=>f.u.skill.ready,80);assert.equal(f.u.skill.activations,0);
  startS3(f);const start=f.b.time;until(f,()=>s3(f).fields.length===1);const field=s3(f).fields[0],bb=f.record.bb;
  assert.equal(field.anchors.length,bb.max_target_token);assert.deepEqual(field.anchors,anchors.slice().reverse().slice(0,bb.max_target_token));
  near(field.releasedAt-start,.7,f.b.dt*2);assert.equal(hits.length,0);until(f,()=>hits.length===1);
  near(hits[0].time-field.releasedAt,.5,f.b.dt*2);near(hits[0].amount,field.cachedAtk*bb.atk_scale*(1-50*(1+bb.magic_resistance)/100));
  near(t.s.atk,100*(1+bb.atk));near(t.s.def,100*(1+bb.def));near(t.s.res,50*(1+bb.magic_resistance));
  assert.equal(hits[0].source,null);until(f,()=>hits.length===2);near(hits[1].time-hits[0].time,1,f.b.dt*2);
  const value=s3(f).values(field);assert.equal(value.count,1);near(value.scale,bb.atk_scale+bb.atk_scale_per_interval);
  until(f,()=>f.b.time>=field.readyAt+15,20);const max=s3(f).values(field);assert.equal(max.count,15);near(max.scale,bb.max_atk_scale);advance(f.b,f.b.dt);
  near(t.s.atk,100*(1+bb.max_atk));near(t.s.def,100*(1+bb.max_def));near(t.s.res,50*(1+bb.max_magic_resistance));
  assert.ok(field.active);until(f,()=>!field.active,12);near(t.s.atk,100);near(t.s.def,100);near(t.s.res,50);
});
for(const [dir,row,col]of [['RIGHT',5,6],['UP',6,5],['LEFT',5,4],['DOWN',4,5]])test(`S3 ${dir} uses the original facing and capped event while region remains independent`,()=>{
  const f=makeS3({dir}),a=ally(f,{row,col}),t=enemy(f,{row,col}),hits=s3Hits(f);
  f.b.addBuff(f.u,{key:'fixture:fast',mods:{aspd:100}});startS3(f);const start=f.b.time;until(f,()=>s3(f).fields.length===1);
  const field=s3(f).fields[0];near(field.releasedAt-start,.7,f.b.dt*2);assert.equal(field.region.kind,'line');assert.ok(field.anchors.includes(a));
  f.b.retreat(f.u);until(f,()=>hits.length===1);assert.ok(field.active);assert.ok(s3(f).handles.length);
  f.b.forceEnd('fixture');assert.equal(field.active,false);assert.equal(s3(f).handles.length,0);assert.equal(t.findBuff('thorn2_s3_enemy_hit'),null);
});
test('S3 no other anchor still permits natural activation and creates a point at the owner tile',()=>{
  const f=makeS3(),here=enemy(f,{row:5,col:5}),nearby=enemy(f,{row:5,col:6}),hits=s3Hits(f);startS3(f);
  until(f,()=>hits.length>0);const field=s3(f).fields[0];assert.equal(field.region.kind,'point');assert.deepEqual(field.anchors,[f.u]);
  assert.equal(hits[0].target,here);assert.equal(hits.some(v=>v.target===nearby),false);
});
test('S3 excludes token/device/isolated/heal-free and out-of-range anchors; lowest block precedes latest deployment',()=>{
  const f=makeS3(),a=ally(f,{row:5,col:6}),z=ally(f,{row:5,col:7});a.base.blockCnt=0;a.markDirty();z.base.blockCnt=2;z.markDirty();
  const excluded=[ally(f,{row:4,col:6,kind:'token'}),ally(f,{row:4,col:7,kind:'device'}),ally(f,{row:6,col:6,flags:{isolated:true}}),
    ally(f,{row:6,col:7,flags:{healFree:true}}),ally(f,{row:10,col:10})];
  startS3(f);until(f,()=>s3(f).fields.length);const field=s3(f).fields[0];assert.equal(field.anchors[0],a);
  assert.deepEqual(field.anchors,[a,f.u,z]);for(const t of excluded)assert.equal(field.anchors.includes(t),false);
});
test('S3 anchor positions freeze at release; later retreat and movement do not reshape the region',()=>{
  const f=makeS3(),a=ally(f,{row:5,col:7});startS3(f);a.x=6;until(f,()=>s3(f).fields.length===1);
  const field=s3(f).fields[0],snapshot=structuredClone(field.region);a.x=15;a.y=15;f.b.retreat(a);advance(f.b,2);
  assert.deepEqual(field.region,snapshot);assert.deepEqual(field.region.anchors,[{x:5,y:5},{x:6,y:5}]);
});
test('S3 collateral air/camouflage take sourceless damage while target-free/stealth/sleep are excluded',()=>{
  const f=makeS3();anchorsS3(f);const air=enemy(f,{fly:true}),camou=enemy(f,{flags:{camou:true}}),hits=s3Hits(f);
  const excluded=[enemy(f,{flags:{untargetable:true}}),enemy(f,{flags:{stealth:true}}),enemy(f,{flags:{sleep:true}})];
  startS3(f);until(f,()=>hits.length>=2);assert.ok(hits.some(v=>v.target===air));assert.ok(hits.some(v=>v.target===camou));
  for(const t of excluded)assert.equal(hits.some(v=>v.target===t),false);
});
test('S3 ally blockers in the region confer membership on enemies outside it; devices do not',()=>{
  const f=makeS3(),a=ally(f,{row:5,col:7}),t=enemy(f,{row:5,col:10}),hits=s3Hits(f);
  t.blockedBy=a;startS3(f);until(f,()=>hits.length===1);assert.equal(hits[0].target,t);
  t.blockedBy=null;advance(f.b,.1);assert.equal(t.findBuff('thorn2_s3_enemy_hit'),null);
  const device=ally(f,{row:5,col:6,kind:'device'});t.blockedBy=device;advance(f.b,1.2);assert.equal(hits.length,1);
});
test('S3 region ramps are global to the cast: a late entrant receives the current reduction, not a fresh ramp',()=>{
  const f=makeS3();anchorsS3(f);const t=enemy(f,{row:10,col:10}),hits=s3Hits(f);t.base.atk=100;t.markDirty();startS3(f);
  until(f,()=>s3(f).fields.length);const field=s3(f).fields[0];until(f,()=>f.b.time>=field.readyAt+10.2);
  t.x=6;t.y=5;advance(f.b,.1);near(t.s.atk,75);assert.equal(hits.length,0);until(f,()=>hits.length===1);near(s3(f).values(field).scale,3.42);
});
test('S3 original target mitigation is applied after the source reduction and cached damage ignores owner multipliers',()=>{
  const f=makeS3();anchorsS3(f);const t=enemy(f,{res:80}),hits=s3Hits(f);startS3(f);
  f.b.addBuff(f.u,{key:'fixture:output',mods:{atkPct:1,dmgDealtMul:3,resIgnoreFlat:100}});until(f,()=>s3(f).fields.length);
  const field=s3(f).fields[0];near(field.cachedAtk,501*2.1);f.b.removeBuff(f.u,'fixture:output');f.b.retreat(f.u);
  until(f,()=>hits.length===1);near(hits[0].amount,field.cachedAtk*2.1*(1-80*.65/100));assert.equal(hits[0].source,null);
});
for(const flag of ['stun','freeze','sleep','disarm'])test(`S3 ${flag} interrupts an unborn region but preserves an already released one`,()=>{
  const f=makeS3();startS3(f);f.b.addBuff(f.u,{key:'fixture:control',flags:{[flag]:true}});advance(f.b,1);assert.equal(s3(f).fields.length,0);
  const z=makeS3();startS3(z);until(z,()=>s3(z).fields.length);const field=s3(z).fields[0];z.b.addBuff(z.u,{key:'fixture:control',flags:{[flag]:true}});
  advance(z.b,2);assert.ok(field.active);assert.equal(z.u.skill.active,false);
});
test('S3 owner hiding and between-tick control cancel only unreleased casts',()=>{
  for(const hiding of [false,true]){const f=makeS3();startS3(f);
    if(hiding)f.u.hidden=true;else{f.b.addBuff(f.u,{key:'fixture:control',flags:{stun:true}});f.b.removeBuff(f.u,'fixture:control');}
    advance(f.b,1);assert.equal(s3(f).fields.length,0);assert.equal(f.u.skill.active,false);}
});
test('S3 slowed source event/clip holds natural SP without auto-activation',()=>{
  const f=makeS3({elite:2});f.b.addBuff(f.u,{key:'fixture:slow',mods:{aspd:-60}});startS3(f);const start=f.b.time;
  until(f,()=>s3(f).fields.length);near(s3(f).fields[0].releasedAt-start,1.4,f.b.dt*2);const sp=f.u.skill.sp;
  until(f,()=>!f.u.skill.active);near(f.b.time-start,3,f.b.dt*2);near(f.u.skill.sp,sp);advance(f.b,1);assert.ok(f.u.skill.sp>0);
});
test('S3 overlapping casts add damage but only the strongest ATK-priority debuff applies, with expiry fallback',()=>{
  const f=makeS3({rank:1}),t=enemy(f,{res:50}),hits=s3Hits(f);t.x=6.75;t.base.atk=100;t.base.def=100;t.markDirty();anchorsS3(f);startS3(f);
  until(f,()=>s3(f).fields.length);const old=s3(f).fields[0];holdSp(f);until(f,()=>f.b.time>=old.readyAt+6);
  const z=owner(f.b,{skill:3,sourceS3:true,row:5,col:4});startS3(z);until(z,()=>s3(z).fields.length);holdSp(z);const newer=s3(z).fields[0];
  until(f,()=>f.b.time>=newer.readyAt+f.b.dt);near(t.s.atk,83);near(t.s.def,63);near(t.s.res,31.5);
  assert.equal(t.buffs.filter(v=>v.key==='thorn2_s3_enemy_hit').length,1);const count=hits.length;advance(f.b,1);assert.ok(hits.length>=count+2);
  until(f,()=>!old.active);const v=s3(z).values(newer);near(t.s.atk,100*(1+v.atk));near(t.s.def,100*(1+v.def));
  f.b.forceEnd('fixture');near(t.s.atk,100);near(t.s.res,50);assert.equal(s3(f).handles.length,0);assert.equal(s3(z).handles.length,0);
});
test('S3 lethal immediate periodic damage cleans the recipient without recursive ticks',()=>{
  const f=makeS3();anchorsS3(f);const t=enemy(f),hits=s3Hits(f);startS3(f);until(f,()=>s3(f).fields.length);t.hp=1;
  until(f,()=>!t.alive);assert.equal(hits.length,1);assert.equal(t.findBuff('thorn2_s3_enemy_hit'),null);assert.equal(s3(f).fields[0].recipients.has(t),false);
});
test('S3 preparation rejects copied contracts and wrong selected skills',()=>{
  const f=make({skill:3,defer:true});assert.throws(()=>prepareThornsS3(f.b,f.u,{contract:{...THORNS_S3_CONTRACT}}),/contract/);
  const z=make({skill:2,defer:true});z.controller.stop();delete z.u.mem.thornsController;
  assert.throws(()=>prepareThornsS3(z.b,z.u,{contract:THORNS_S3_CONTRACT}),/third skill/);
});


test('S3 simultaneous unequal fields apply the strongest debuff before the weaker field first receipt',()=>{
  const f=makeS3({rank:1}),z=owner(f.b,{skill:3,sourceS3:true,col:4});anchorsS3(f);
  const t=enemy(f,{res:50}),hits=s3Hits(f);t.x=6.75;t.base.atk=100;t.base.def=100;t.markDirty();
  startS3(f);startS3(z);until(f,()=>hits.length>=2);
  near(t.s.atk,85);near(t.s.def,65);near(t.s.res,32.5);
  const field=s3(f).fields[0];near(hits[0].amount,field.cachedAtk*.9*(1-50*.65/100));
  assert.equal(t.buffs.filter(v=>v.key==='thorn2_s3_enemy_hit').length,1);
});
