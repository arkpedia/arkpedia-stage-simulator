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
  prepareBlazeIgnitingCore,prepareBlazeIgnitingS3,BLAZE_IGNITING_S3_CONTRACT as S3_CONTRACT} from '../server/sim/content/arkpedia-blaze-igniting.js';
const near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps,`${a} != ${z}`);
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function until(f,p,s=12){const end=f.b.time+s;while(!p()&&f.b.time<end)advance(f.b,f.b.dt);assert.ok(p(),`Expected condition at ${f.b.time}`);}
function owner(b,{rank=10,elite=2,level=e.tables.character.phases[elite].maxLevel,potential=1,trust=0,
  skill=3,dir='RIGHT',defer=false,row=5,col=5,contract=CONTRACT,sourceS3=true}={}){
  const build={elite,level,potential,trust,skillId:`skchr_blaze2_${skill}`,skillRank:Math.min(rank,[4,7,10][elite])};
  const r=selectedBlazeIgnitingBuild(build),c=e.tables.character;
  const def=normalizeChess({chessId:ID,charId:ID,name:c.name,profession:c.profession,position:c.position,
    subProfessionId:c.subProfessionId,stats:r.stats,rangeGrid:r.rangeGrid,talents:r.talents,
    tags:[c.nationId,c.groupId,c.teamId].filter(v=>typeof v==='string'&&v),
    skill:{...r.source,...r.source.spData,skillId:build.skillId,
      rangeGrid:r.source.rangeId?e.tables.ranges[r.source.rangeId].grids.map(v=>[v.row,v.col]):[],trigger:{rule:'NEVER'}},arkpedia:build});
  const u=b._makeAlly(b.getPlayer('arkpedia'),def,'op',row,col,{dir});
  const prepared=sourceS3?prepareBlazeIgnitingS3(b,u,{contract:S3_CONTRACT}):prepareBlazeIgnitingCore(b,u,{contract});b._setupUnit(u,prepared.kit);prepared.controller.install();
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
function receipts(f){const a=[];f.b.on('damaged',ctx=>{if(ctx.dmg.tags.some(t=>t.startsWith('blaze2:s3-')))a.push({...ctx,time:f.b.time});});return a;}
const tagged=(rs,tag)=>rs.filter(r=>r.dmg.tags.includes(`blaze2:s3-${tag}`));
function activate(f){until(f,()=>f.u.skill.ready,45);assert.ok(f.u.skill.activate());return f.u.skill.lastStart;}
function shot(f){until(f,()=>f.births.some(r=>r.projectile.data.blazeIgnitingKind==='s3'));return f.births.find(r=>r.projectile.data.blazeIgnitingKind==='s3');}
function move(t,row,col){t.x=col;t.y=row;t.tileR=row;t.tileC=col;}

test('S3 source build/contract are checked before hooks; complete private kit does not enable public Blaze',()=>{
  assert.equal(REGULAR_OPERATORS[ID],undefined);assert.equal(data.operators[ID],undefined);assert.deepEqual(e.enabledOperators,[]);
  const f=make({defer:true,sourceS3:false});f.controller.stop();delete f.u.mem.blazeIgnitingController;
  assert.throws(()=>prepareBlazeIgnitingS3(f.b,f.u,{contract:{...S3_CONTRACT}}),/contract/);
  const z=make({defer:true,skill:2,sourceS3:false});z.controller.stop();delete z.u.mem.blazeIgnitingController;
  assert.throws(()=>prepareBlazeIgnitingS3(z.b,z.u,{contract:S3_CONTRACT}),/third skill/);
  f.u.def.skill.bb['attack@trigger_time']=99;assert.throws(()=>prepareBlazeIgnitingS3(f.b,f.u,{contract:S3_CONTRACT}),/selected source/);
});
for(let rank=1;rank<=10;rank++)test(`S3 rank${rank}: natural SP, eventless source cadence, one ammo per stop-area Arts hit and no manufactured FIRE injury`,()=>{
  const f=make({rank}),rs=receipts(f);assert.equal(f.u.skill.activate(),false);const begin=activate(f);near(begin,f.u.skill.spCost-f.u.def.skill.initSp,f.b.dt*2);
  const nominal=f.record.bb['attack@trigger_time'];assert.equal(f.u.skill.ammoLeft,nominal);near(f.u.s.interval,.3);
  const t=enemy(f),inside=enemy(f,{row:6,col:6}),outside=enemy(f,{row:5,col:8});const p=shot(f);
  assert.equal(f.u.skill.ammoLeft,nominal-1);near(p.time-begin,.4,f.b.dt*2);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_3_Loop');assert.equal(f.u.mem.regularFormVisual.loop,true);
  until(f,()=>tagged(rs,'shot').length>=2);const atk=f.record.stats.atk*(1+f.record.bb.atk);
  assert.equal(tagged(rs,'shot').length,2);for(const r of tagged(rs,'shot'))near(r.amount,atk);
  assert.ok(tagged(rs,'shot').some(r=>r.target===t));assert.ok(tagged(rs,'shot').some(r=>r.target===inside));assert.equal(tagged(rs,'shot').filter(r=>r.target===outside).length,0);
  assert.equal(tagged(rs,'bonus').length,0);assert.equal(t.elem.burn,0);assert.equal(f.u.skill.activations,1);near(f.u.skill.spTotal,0);
  until(f,()=>f.births.filter(v=>v.projectile.data.blazeIgnitingKind==='s3').length>=3);
  const born=f.births.filter(v=>v.projectile.data.blazeIgnitingKind==='s3');near(born[1].time-born[0].time,.3,f.b.dt);near(born[2].time-born[1].time,.3,f.b.dt);
  assert.equal(f.u.skill.ammoLeft,nominal-3);assert.equal(f.attacks.length,3);assert.ok(f.attacks.every(x=>x.isSkill));
});
for(const [dir,row,col,face]of [['RIGHT',5,9,'Front'],['DOWN',1,5,'Front'],['LEFT',5,1,'Back'],['UP',9,5,'Back']])
test(`${dir}: rotated source S3 range and original continuous Front/Back loop`,()=>{
  const f=make({dir}),rs=receipts(f);activate(f);const t=enemy(f,{row,col}),p=shot(f);until(f,()=>tagged(rs,'shot').length>0);
  assert.equal(p.target,t);near(p.time-f.u.skill.lastStart,.4,f.b.dt*2);assert.equal(f.u.mem.regularVisualDirection,face==='Back'?'UP':'RIGHT');
  assert.equal(f.u.mem.regularFormVisual.clip,'Skill_3_Loop');assert.equal(e.models[ID][face].eventPayloads.Skill_3_Loop,undefined);
});
test('Burn bonus is Elemental HP damage before Arts, separately mitigated and based on each stop-area recipient',()=>{
  const f=make(),rs=receipts(f);activate(f);const t=enemy(f,{res:50}),z=enemy(f,{row:6,col:6,res:50});
  f.b.addBuff(t,{key:'burnBurst',duration:10,flags:{burstLock:true}});shot(f);until(f,()=>tagged(rs,'shot').length===2);
  const atk=f.record.stats.atk*(1+f.record.bb.atk),bonus=tagged(rs,'bonus');assert.equal(bonus.length,1);assert.equal(bonus[0].target,t);near(bonus[0].amount,atk*.8);
  assert.equal(bonus[0].type,'elemental');assert.equal(bonus[0].dmg.sourceless,false);assert.equal(bonus[0].source,f.u);
  for(const r of tagged(rs,'shot'))near(r.amount,atk*.5);
  assert.ok(rs.indexOf(bonus[0])<rs.indexOf(tagged(rs,'shot').find(x=>x.target===t)));assert.equal(z.elem.burn,0);
});
test('non-FIRE burst recovery does not grant the bonus; ending FIRE recovery before stop suppresses it',()=>{
  const f=make(),rs=receipts(f);activate(f);const t=enemy(f);f.b.addBuff(t,{key:'necrosisBurst',duration:10,flags:{burstLock:true}});
  shot(f);until(f,()=>tagged(rs,'shot').length>0);assert.equal(tagged(rs,'bonus').length,0);
  const g=make(),out=receipts(g);activate(g);const z=enemy(g);const buff=g.b.addBuff(z,{key:'burnBurst',duration:10,flags:{burstLock:true}});
  shot(g);g.b.removeBuff(z,buff);until(g,()=>tagged(out,'shot').length>0);assert.equal(tagged(out,'bonus').length,0);
});
test('FIRE beginning between birth and stop enables the bonus; lethal bonus suppresses primary Arts on the dead recipient',()=>{
  const f=make(),rs=receipts(f);activate(f);const t=enemy(f);shot(f);f.b.addBuff(t,{key:'burnBurst',duration:10,flags:{burstLock:true}});t.hp=100;
  until(f,()=>!t.alive);assert.equal(tagged(rs,'bonus').length,1);assert.equal(tagged(rs,'shot').filter(x=>x.target===t).length,0);
});
test('birth ATK snapshot survives stat changes, skill end and owner retreat for primary and transferred-source bonus',()=>{
  for(const action of ['stat','end','retreat']){const f=make(),rs=receipts(f);activate(f);const t=enemy(f);
    f.b.addBuff(t,{key:'burnBurst',duration:10,flags:{burstLock:true}});const p=shot(f),atk=p.projectile.data.cachedAtk;
    if(action==='stat')f.b.addBuff(f.u,{key:'fixture:atk',mods:{atkPct:1}});else if(action==='end')f.u.skill.end('manual');else f.b.retreat(f.u);
    until(f,()=>tagged(rs,'shot').length>0);near(tagged(rs,'shot')[0].amount,atk);near(tagged(rs,'bonus')[0].amount,atk*.8);
  }
});
test('fixed point stop area admits entrants and force-hits a valid moved trace target, without restoring a dead one',()=>{
  for(const removed of [false,true]){const f=make(),rs=receipts(f);activate(f);const t=enemy(f);const p=shot(f);
    if(removed)f.b.kill(t);else move(t,12,12);const entrant=enemy(f);until(f,()=>tagged(rs,'shot').some(x=>x.target===entrant));
    assert.equal(tagged(rs,'shot').filter(x=>x.target===t).length,removed?0:1);
    assert.ok(tagged(rs,'shot').some(x=>x.target===entrant));near(p.projectile.tx,6);near(p.projectile.ty,5);
  }
});
test('explicit beforeAttack rejection spends no ammo; invalidated input preserves its captured point and accepted ammo cost',()=>{
  const f=make();activate(f);enemy(f);f.b.on('beforeAttack',ctx=>{if(ctx.attacker===f.u)ctx.targets=[];});advance(f.b,2);
  assert.equal(f.births.length,0);assert.equal(f.u.skill.ammoLeft,25);
  const g=make(),rs=receipts(g);activate(g);const t=enemy(g),z=enemy(g,{row:6,col:6});let once=false;
  g.b.on('beforeAttack',ctx=>{if(ctx.attacker===g.u&&!once){once=true;g.b.kill(t);}});shot(g);until(g,()=>tagged(rs,'shot').length>0);
  assert.equal(tagged(rs,'shot')[0].target,z);assert.equal(g.births[0].target,t);assert.ok(g.u.skill.ammoLeft<25);
});
test('stop circle can hit air and camouflage but rejects stealth, sleeping and target-free recipients',()=>{
  const f=make(),rs=receipts(f);activate(f);enemy(f);const cam=enemy(f,{flags:{camou:true}}),air=enemy(f,{fly:true});
  const excluded=[enemy(f,{flags:{stealth:true}}),enemy(f,{flags:{sleep:true}}),enemy(f,{flags:{untargetable:true}})];
  shot(f);until(f,()=>tagged(rs,'shot').length>=3);assert.ok(tagged(rs,'shot').some(x=>x.target===cam));assert.ok(tagged(rs,'shot').some(x=>x.target===air));
  for(const t of excluded)assert.equal(tagged(rs,'shot').filter(x=>x.target===t).length,0);
});
test('a large enemy body overlapping the stop circle receives one hit and no extra ammunition is consumed',()=>{
  const f=make(),rs=receipts(f);activate(f);enemy(f);const t=enemy(f,{row:5,col:9});t.hitArea={w:4,h:2,dx:0,dy:0};
  shot(f);until(f,()=>tagged(rs,'shot').length>=2);assert.equal(tagged(rs,'shot').filter(x=>x.target===t).length,1);assert.equal(f.attacks.length,2);
});
test('global Burn recovery precedes lethal Meltdown, ignores range and increases ammo beyond the starting count',()=>{
  const f=make();activate(f);const t=enemy(f,{row:12,col:12,hp:100}),events=[];
  f.b.on('blazeIgnitingS3AmmoRecover',ctx=>events.push({...ctx}));f.u.hp=100;
  f.b.dealDamage(f.u,t,{amount:1000,type:'element',element:'burn'});
  assert.equal(events.length,1);assert.equal(events[0].before,25);assert.equal(events[0].after,27);assert.equal(f.u.skill.ammoLeft,27);assert.equal(f.u.skill.ammoMax,27);
  assert.equal(t.alive,false);assert.ok(f.u.hp>100);near(f.u.skill.spTotal,0);
});
test('global listener accepts air/camouflage, ignores other elements and stops when the skill is inactive or owner removed',()=>{
  const f=make(),t=enemy(f,{row:12,col:12,fly:true,flags:{camou:true}});advance(f.b,1);const events=[];f.b.on('blazeIgnitingS3AmmoRecover',c=>events.push(c));
  f.b.dealDamage(f.u,t,{amount:1000,type:'element',element:'burn'});assert.equal(events.length,0);
  activate(f);const other=enemy(f,{row:12,col:13});f.b.dealDamage(f.u,other,{amount:1000,type:'element',element:'necrosis'});assert.equal(events.length,0);
  const a=enemy(f,{row:12,col:14,fly:true,flags:{camou:true}});f.b.dealDamage(f.u,a,{amount:1000,type:'element',element:'burn'});assert.equal(events.length,1);
  f.b.retreat(f.u);const z=enemy(f,{row:12,col:15});f.b.dealDamage(f.u,z,{amount:1000,type:'element',element:'burn'});assert.equal(events.length,1);
});
test('global source listener recovers independently of who caused Burn and only once per actual burst',()=>{
  const f=make();activate(f);const t=enemy(f,{row:12,col:12}),events=[];f.b.on('blazeIgnitingS3AmmoRecover',c=>events.push(c));
  f.b.dealDamage(null,t,{amount:1000,type:'element',element:'burn',sourceless:true});assert.equal(f.u.skill.ammoLeft,27);assert.equal(events.length,1);
  f.b.dealDamage(null,t,{amount:1000,type:'element',element:'burn',sourceless:true});assert.equal(events.length,1);
});
test('one-second HP loss bypasses shields/modifiers and cannot grant SP, including under control and with no targets',()=>{
  const f=make(),rs=receipts(f);activate(f);const hp=f.u.hp,shield=f.b.addBuff(f.u,{key:'fixture:shield',shield:10000,shieldTypes:['true']});let mods=0;
  f.b.on('damage',ctx=>{if(ctx.target===f.u){mods++;ctx.cancel=true;}});f.b.applyStatus(f.u,'stun',{duration:3});advance(f.b,2.1);
  assert.equal(f.births.length,0);assert.equal(f.u.skill.ammoLeft,25);assert.equal(tagged(rs,'self').length,2);near(f.u.hp,hp-f.u.s.maxHp*.06);near(shield.shield,10000);
  assert.equal(mods,0);for(const x of tagged(rs,'self')){assert.equal(x.dmg.noSp,true);near(x.hpLoss,f.u.s.maxHp*.03);}near(f.u.skill.spTotal,0);
});
test('self-drain downing records source count recovery, interrupts S3, cleans drain and returns to ordinary after revival',()=>{
  const f=make(),rs=receipts(f);activate(f);f.u.skill.ammoLeft=3;f.u.hp=1;const restored=[];f.b.on('blazeIgnitingS3DownedAmmoRestore',c=>restored.push(c));
  until(f,()=>f.controller.reborn?.kind==='downed');assert.equal(restored.length,1);assert.equal(restored[0].before,3);assert.equal(restored[0].after,25);
  assert.equal(f.u.skill.active,false);assert.equal(f.u.skill.ammoLeft,0);assert.equal(f.controller.s3.drain,null);assert.equal(f.controller.s3.transition,null);
  assert.equal(f.u.findBuff('blaze2_s_3[lose_hp]'),null);const n=tagged(rs,'self').length;until(f,()=>f.controller.reborn===null,40);
  assert.equal(tagged(rs,'self').length,n);near(f.u.s.atk,f.record.stats.atk);near(f.u.s.interval,1.6);assert.equal(f.u.mem.regularFormVisual.clip,'Idle');
});
test('fatal external hit does not truncate already emitted cached shots and repeats downing without adding a once-per-battle cap',()=>{
  const f=make(),rs=receipts(f);activate(f);enemy(f);const p=shot(f);f.b.dealDamage(null,f.u,{amount:99999,type:'true'});
  assert.equal(f.controller.reborn.kind,'downed');until(f,()=>tagged(rs,'shot').length>0);near(tagged(rs,'shot')[0].amount,p.projectile.data.cachedAtk);
  until(f,()=>f.controller.reborn===null,40);f.b.dealDamage(null,f.u,{amount:99999,type:'true'});assert.equal(f.controller.reborn.kind,'downed');assert.ok(f.u.alive);
});
test('manual stop consumes no further ammo/drain, plays original End guard and permits ordinary attacks and natural SP',()=>{
  const f=make(),rs=receipts(f);activate(f);enemy(f);shot(f);f.u.skill.end('manual');assert.equal(f.u.mem.regularFormVisual.clip,'Skill_3_End');
  const count=tagged(rs,'self').length,births=f.births.length;advance(f.b,.8);assert.equal(f.births.length,births);assert.equal(tagged(rs,'self').length,count);
  until(f,()=>f.births.some(x=>x.projectile.data.blazeIgnitingKind==='ordinary'));assert.ok(f.u.skill.spTotal>0);near(f.u.s.atk,f.record.stats.atk);
});
test('final accepted birth spends the last ammo once and its area damage settles after mode end',()=>{
  const f=make(),rs=receipts(f);activate(f);enemy(f);f.u.skill.ammoLeft=1;const p=shot(f);assert.equal(f.u.skill.active,false);assert.equal(f.u.skill.ammoLeft,0);
  assert.equal(f.u.mem.regularFormVisual.clip,'Skill_3_End');until(f,()=>tagged(rs,'shot').length>0);near(tagged(rs,'shot')[0].amount,p.projectile.data.cachedAtk);
  assert.equal(f.births.filter(x=>x.projectile.data.blazeIgnitingKind==='s3').length,1);assert.equal(f.controller.s3.drain,null);
});
test('real source ammo exhaustion at every rank ends the mode and returns to ordinary attacks',()=>{
  for(let rank=1;rank<=10;rank++){const f=make({rank}),rs=receipts(f);activate(f);enemy(f);
    until(f,()=>!f.u.skill.active,15);const nominal=f.record.bb['attack@trigger_time'];
    assert.equal(f.births.filter(x=>x.projectile.data.blazeIgnitingKind==='s3').length,nominal);assert.equal(f.attacks.length,nominal);
    advance(f.b,.5);assert.equal(tagged(rs,'shot').length,nominal);assert.equal(f.controller.s3.drain,null);assert.ok(f.u.alive);
  }
});
test('battle end clears all pending point hits, drain and owned hooks',()=>{
  const f=make(),rs=receipts(f);activate(f);enemy(f);shot(f);f.b.finished=true;f.b.emit('battleEnd',{});
  assert.equal(f.u.findBuff('blaze2_s_3[lose_hp]'),null);assert.equal(f.controller.handles.length,0);assert.equal(f.controller.s3.drain,null);
  assert.equal(f.b.projectiles.list.filter(p=>p.data?.blazeIgnitingOwner===f.controller&&!p.removed).length,0);advance(f.b,.5);assert.equal(tagged(rs,'shot').length,0);
});
test('trace fallback rejects a different deployment life outside the circle and deduplicates valid in-circle input',()=>{
  const f=make(),rs=receipts(f);activate(f);const t=enemy(f);shot(f);move(t,12,12);t.deploySeq++;
  advance(f.b,.4);assert.equal(tagged(rs,'shot').filter(x=>x.target===t).length,0);
  const g=make(),out=receipts(g);activate(g);const z=enemy(g);shot(g);until(g,()=>tagged(out,'shot').length>0);
  assert.equal(tagged(out,'shot').filter(x=>x.target===z).length,1);
});
test('self-drain uses current maximum HP and stops after removal without leaked periodic output',()=>{
  const f=make(),rs=receipts(f);activate(f);f.b.addBuff(f.u,{key:'fixture:hp',mods:{hpPct:1}});const max=f.u.s.maxHp;
  until(f,()=>tagged(rs,'self').length===1);near(tagged(rs,'self')[0].hpLoss,max*.03);f.b.retreat(f.u);
  const n=tagged(rs,'self').length;advance(f.b,2);assert.equal(tagged(rs,'self').length,n);assert.equal(f.controller.s3.drain,null);
});
test('active control pauses births without losing ammo and resumes eventless attacks when it clears',()=>{
  const f=make();activate(f);enemy(f);f.b.applyStatus(f.u,'stun',{duration:1});advance(f.b,.8);
  assert.equal(f.births.length,0);assert.equal(f.u.skill.ammoLeft,25);shot(f);assert.ok(f.u.skill.ammoLeft<25);assert.ok(f.u.skill.active);
});
