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
  prepareThornsCore,prepareThornsS1,THORNS_S1_CONTRACT,thornsStraightTiles} from '../server/sim/content/arkpedia-thorns-lodestar.js';
const near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps,`${a} != ${z}`);
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function until(f,p,s=12){const end=f.b.time+s;while(!p()&&f.b.time<end)advance(f.b,f.b.dt);assert.ok(p(),`Expected condition at ${f.b.time}`);}
function owner(b,{rank=10,elite=2,level=e.tables.character.phases[elite].maxLevel,potential=1,trust=0,
  skill=1,dir='RIGHT',defer=false,row=5,col=5,contract=CONTRACT,sourceS1=false}={}){
  const build={elite,level,potential,trust,skillId:`skchr_thorn2_${skill}`,skillRank:Math.min(rank,[4,7,10][elite])};
  const r=selectedThornsBuild(build),c=e.tables.character;
  const def=normalizeChess({chessId:ID,charId:ID,name:c.name,profession:c.profession,position:c.position,
    subProfessionId:c.subProfessionId,stats:r.stats,rangeGrid:r.rangeGrid,talents:r.talents,
    tags:[c.nationId,c.groupId,c.teamId].filter(v=>typeof v==='string'&&v),
    skill:{...r.source,...r.source.spData,skillId:build.skillId,
      rangeGrid:r.source.rangeId?e.tables.ranges[r.source.rangeId].grids.map(v=>[v.row,v.col]):[],trigger:{rule:'NEVER'}},arkpedia:build});
  const u=b._makeAlly(b.getPlayer('arkpedia'),def,'op',row,col,{dir});
  const prepared=sourceS1?prepareThornsS1(b,u,{contract:THORNS_S1_CONTRACT}):prepareThornsCore(b,u,{contract});b._setupUnit(u,prepared.kit);prepared.controller.install();
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
  return owner(b,opts);
}
function enemy(f,{row=5,col=6,hp=1e7,res=0,fly=false,taunt=0,flags={}}={}){
  const t=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});
  Object.assign(t.base,{maxHp:hp,atk:0,def:0,res,moveSpeed:0,tauntLevel:taunt});t.markDirty();t.hp=hp;
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
  for(let i=0;i<6;i++)ally(f,{row:2,col:2+i});advance(f.b,.1);near(f.u.s.aspd,105);
});
test('global base speed includes air/heal-free allies; extra speed follows eligible ground lines and motion',()=>{
  const f=make(),t=ally(f,{flags:{healFree:true}}),z=enemy(f,{fly:true});
  const isolated=ally(f,{row:7,col:7,flags:{isolated:true}}),device=ally(f,{row:8,col:8,kind:'device'});
  terrain(f,Array.from({length:6},(_,i)=>[5,5+i]));advance(f.b,.1);
  near(t.s.aspd,110);near(z.s.aspd,90);near(isolated.s.aspd,100);near(device.s.aspd,100);
  t.x=6;t.y=6;z.x=6;z.y=6;advance(f.b,.1);near(t.s.aspd,105);near(z.s.aspd,95);
});
test('terrain and crate changes remove and restore extra speed without stacking base buffs',()=>{
  const f=make(),t=ally(f);terrain(f,Array.from({length:6},(_,i)=>[5,5+i]));advance(f.b,.1);near(t.s.aspd,110);
  f.b.grid.setObstacle(5,8,true,'crate');advance(f.b,.1);near(t.s.aspd,105);
  f.b.grid.setObstacle(5,8,false,'crate');advance(f.b,.1);near(t.s.aspd,110);
  for(let i=0;i<12;i++)advance(f.b,.1);assert.equal(t.buffs.filter(v=>v.key==='thorn2_t_2_speed_ally').length,1);
  f.b.grid.tiles[5*21+8]={...f.b.grid.tiles[5*21+8],pass:'FLY'};advance(f.b,.1);near(t.s.aspd,105);
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
const fieldBuff=t=>t.findBuff('thorns2_s_1[buff]');
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
test('S1 named field buff never stacks on overlap and a remaining field resumes when the incumbent expires',()=>{
  const f=make({sourceS1:true}),t=ally(f);t.hp=1000;until(f,()=>s1(f).fields.length===1);holdSp(f);
  const old=s1(f).fields[0];const z=owner(f.b,{sourceS1:true,row:6,col:5,potential:5});
  until(z,()=>s1(z).fields.length===1);holdSp(z);near(t.s.hpRegen,old.cachedAtk*.2);
  assert.equal(t.buffs.filter(v=>v.key==='thorns2_s_1[buff]').length,1);
  until(f,()=>!old.active,15);near(t.s.hpRegen,s1(z).fields[0].cachedAtk*.2);
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
