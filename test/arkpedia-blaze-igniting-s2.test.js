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
  prepareBlazeIgnitingCore,prepareBlazeIgnitingS2,BLAZE_IGNITING_S2_CONTRACT as S2_CONTRACT} from '../server/sim/content/arkpedia-blaze-igniting.js';
const near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps,`${a} != ${z}`);
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function until(f,p,s=12){const end=f.b.time+s;while(!p()&&f.b.time<end)advance(f.b,f.b.dt);assert.ok(p(),`Expected condition at ${f.b.time}`);}
function owner(b,{rank=10,elite=2,level=e.tables.character.phases[elite].maxLevel,potential=1,trust=0,
  skill=2,dir='RIGHT',defer=false,row=5,col=5,contract=CONTRACT,sourceS2=true}={}){
  const build={elite,level,potential,trust,skillId:`skchr_blaze2_${skill}`,skillRank:Math.min(rank,[4,7,10][elite])};
  const r=selectedBlazeIgnitingBuild(build),c=e.tables.character;
  const def=normalizeChess({chessId:ID,charId:ID,name:c.name,profession:c.profession,position:c.position,
    subProfessionId:c.subProfessionId,stats:r.stats,rangeGrid:r.rangeGrid,talents:r.talents,
    tags:[c.nationId,c.groupId,c.teamId].filter(v=>typeof v==='string'&&v),
    skill:{...r.source,...r.source.spData,skillId:build.skillId,
      rangeGrid:r.source.rangeId?e.tables.ranges[r.source.rangeId].grids.map(v=>[v.row,v.col]):[],trigger:{rule:'NEVER'}},arkpedia:build});
  const u=b._makeAlly(b.getPlayer('arkpedia'),def,'op',row,col,{dir});
  const prepared=sourceS2?prepareBlazeIgnitingS2(b,u,{contract:S2_CONTRACT}):prepareBlazeIgnitingCore(b,u,{contract});b._setupUnit(u,prepared.kit);prepared.controller.install();
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
function receipts(f){const a=[];f.b.on('damaged',ctx=>{if(ctx.dmg.tags.some(t=>t.startsWith('blaze2:s2-')))a.push({...ctx,time:f.b.time});});return a;}
const tagged=(rs,tag)=>rs.filter(r=>r.dmg.tags.includes(`blaze2:s2-${tag}`));
function activate(f){until(f,()=>f.u.skill.ready,45);assert.ok(f.u.skill.activate());return f.u.skill.lastStart;}
function shot(f){until(f,()=>f.births.some(r=>r.projectile.data.blazeIgnitingKind==='s2'));return f.births.find(r=>r.projectile.data.blazeIgnitingKind==='s2');}
function field(f){until(f,()=>f.controller.s2.tiles.size>0);return [...f.controller.s2.tiles.values()][0];}
function move(t,row,col){t.x=col;t.y=row;t.tileR=row;t.tileC=col;}

test('S2 validates selected source and contract before hooks; public Blaze remains held',()=>{
  assert.equal(REGULAR_OPERATORS[ID].mechanic,'blaze-igniting');assert.ok(data.operators[ID]);assert.deepEqual(e.enabledOperators,[]);
  const f=make({defer:true,sourceS2:false});f.controller.stop();delete f.u.mem.blazeIgnitingController;
  assert.throws(()=>prepareBlazeIgnitingS2(f.b,f.u,{contract:{...S2_CONTRACT}}),/contract/);
  const z=make({defer:true,skill:1,sourceS2:false});z.controller.stop();delete z.u.mem.blazeIgnitingController;
  assert.throws(()=>prepareBlazeIgnitingS2(z.b,z.u,{contract:S2_CONTRACT}),/second skill/);
  f.u.def.skill.bb.atk=99;assert.throws(()=>prepareBlazeIgnitingS2(f.b,f.u,{contract:S2_CONTRACT}),/selected source/);
});
for(let rank=1;rank<=10;rank++)test(`S2 rank${rank}: natural manual SP, full-strength three shots, one self cost and separate tile Arts/Burn`,()=>{
  const f=make({rank}),rs=receipts(f);assert.equal(f.u.skill.activate(),false);advance(f.b,2);
  const begun=activate(f);near(begun, f.u.skill.spCost-f.u.def.skill.initSp,f.b.dt*2);
  const targets=[enemy(f,{row:5,col:6}),enemy(f,{row:6,col:6}),enemy(f,{row:4,col:6}),enemy(f,{row:5,col:7})];
  const born=shot(f);until(f,()=>tagged(rs,'shot').length===3);const accepted=f.births.filter(v=>v.projectile.data.blazeIgnitingKind==='s2');
  assert.equal(accepted.length,3);assert.equal(new Set(accepted.map(x=>x.target)).size,3);assert.equal(new Set(tagged(rs,'shot').map(x=>x.dmg.attackId)).size,1);
  const attackAtk=f.record.stats.atk*(1+f.record.bb.atk);
  for(const x of tagged(rs,'shot')){near(x.amount,attackAtk);assert.equal(x.dmg.isSkill,true);assert.equal(x.source,f.u);}
  assert.equal(tagged(rs,'self').length,1);near(tagged(rs,'self')[0].hpLoss,f.u.s.maxHp*.05);
  assert.equal(tagged(rs,'self')[0].dmg.noSp,true);assert.equal(f.attacks.at(-1).isSkill,true);
  assert.equal(f.controller.s2.tiles.size,3);assert.equal(tagged(rs,'tile').length,3);assert.equal(tagged(rs,'injury').length,3);
  for(const x of tagged(rs,'tile'))near(x.amount,attackAtk*.35);
  for(const x of tagged(rs,'injury')){near(x.amount,attackAtk*.35*.3);assert.equal(x.source,f.u);assert.equal(x.credit,f.u);assert.equal(x.dmg.sourceless,false);}
  for(const t of accepted.map(x=>x.target)){assert.equal(t.findBuff('blaze2_s_2[on_tile]').source,f.u);near(t.findBuff('blaze2_s_2[on_tile]').mods.moveMul,.5);}
  assert.equal(targets.filter(t=>tagged(rs,'shot').some(x=>x.target===t)).length,3);
  near(f.u.s.interval,2.5);near(born.time-begun,.333+.4333333,f.b.dt*2);assert.equal(f.u.skill.activations,1);near(f.u.skill.spTotal,0);
});
for(const [dir,row,col,face]of [['RIGHT',5,7,'Front'],['DOWN',3,5,'Front'],['LEFT',5,3,'Back'],['UP',7,5,'Back']])
test(`${dir}: S2 changes range and uses original Front/Back loop event`,()=>{
  const f=make({dir}),t=enemy(f,{row,col}),rs=receipts(f);activate(f);const born=shot(f);until(f,()=>tagged(rs,'shot').length>0);
  assert.equal(born.target,t);near(born.time-f.u.skill.lastStart,.333+e.models[ID][face].eventPayloads.Skill_2_Loop.find(v=>v.name==='OnAttack').time,f.b.dt*2);
  assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_Loop');assert.equal(f.u.mem.regularVisualDirection,face==='Back'?'UP':'RIGHT');
});
test('no targets or a fully rejected beforeAttack cause no self damage; losing one target still pays once',()=>{
  const f=make(),rs=receipts(f);activate(f);advance(f.b,2);assert.equal(tagged(rs,'self').length,0);assert.equal(f.births.length,0);
  const a=enemy(f),z=enemy(f,{row:6,col:6});until(f,()=>f.controller.phase?.kind==='s2-attack');f.b.kill(a);shot(f);
  assert.equal(f.births.at(-1).target,z);assert.equal(tagged(rs,'self').length,1);
  const g=make(),out=receipts(g);activate(g);enemy(g);g.b.on('beforeAttack',ctx=>{if(ctx.attacker===g.u)ctx.targets=[];});advance(g.b,3);
  assert.equal(g.births.length,0);assert.equal(tagged(out,'self').length,0);
});
test('original speed-one cap prevents haste shortening a loop; reduced ASPD stretches the event',()=>{
  const f=make();activate(f);f.b.addBuff(f.u,{key:'fixture:haste',mods:{aspd:100}});enemy(f);const born=shot(f);
  near(f.u.mem.regularFormVisual.speed,1);near(born.time-f.u.skill.lastStart,.333+.4333333,f.b.dt*2);
  const g=make();activate(g);g.b.addBuff(g.u,{key:'fixture:slow',mods:{aspd:-50}});enemy(g);const a=shot(g);
  near(g.u.mem.regularFormVisual.speed,.5);near(a.time-g.u.skill.lastStart,.333+.4333333/.5,g.b.dt*2);
});
test('sourced tile output uses current ATK, mitigation and settled HP damage; shields suppress injury',()=>{
  const f=make(),rs=receipts(f);activate(f);const t=enemy(f,{res:50}),s=enemy(f,{row:6,col:6});field(f);until(f,()=>tagged(rs,'tile').length===2);
  const base=f.u.s.atk;near(tagged(rs,'tile').find(x=>x.target===t).amount,base*.35*.5);
  f.b.addBuff(f.u,{key:'fixture:atk',mods:{atkPct:1}});f.b.addBuff(s,{key:'fixture:shield',shield:10000,shieldTypes:['arts']});
  const tBefore=tagged(rs,'tile').filter(x=>x.target===t).length,sBefore=tagged(rs,'injury').filter(x=>x.target===s).length;
  until(f,()=>tagged(rs,'tile').filter(x=>x.target===t).length>tBefore);
  const hit=tagged(rs,'tile').filter(x=>x.target===t).at(-1);near(hit.amount,f.u.s.atk*.35*.5);
  near(tagged(rs,'injury').filter(x=>x.target===t).at(-1).amount,hit.hpLoss*.3);assert.equal(tagged(rs,'injury').filter(x=>x.target===s).length,sBefore);
});
test('leaving and reentry removes/recreates one immediate clock; a large body on two fire tiles receives only one tick',()=>{
  const f=make(),rs=receipts(f);activate(f);const t=enemy(f),z=enemy(f,{row:5,col:7});field(f);until(f,()=>f.controller.s2.tiles.size===2);
  f.b.addBuff(f.u,{key:'fixture:disarm',flags:{disarm:true}});move(t,12,12);advance(f.b,f.b.dt);assert.equal(t.findBuff('blaze2_s_2[on_tile]'),null);
  const n=tagged(rs,'tile').filter(x=>x.target===t).length;advance(f.b,1.2);assert.equal(tagged(rs,'tile').filter(x=>x.target===t).length,n);
  move(t,5,6);advance(f.b,f.b.dt);assert.equal(tagged(rs,'tile').filter(x=>x.target===t).length,n+1);
  t.hitArea={w:2,h:1,dx:.5,dy:0};const before=tagged(rs,'tile').filter(x=>x.target===t).length;advance(f.b,1);
  assert.equal(tagged(rs,'tile').filter(x=>x.target===t).length,before+1);assert.equal(t.buffs.filter(x=>x.key==='blaze2_s_2[on_tile]').length,1);
  assert.ok(z.alive);
});
test('ground-only listener rejects air, sleep, stealth and target-free; camouflage can enter an existing tile',()=>{
  const f=make(),rs=receipts(f);activate(f);const t=enemy(f),air=enemy(f,{row:6,col:6,fly:true});field(f);until(f,()=>tagged(rs,'shot').length===2);
  assert.equal(f.controller.s2.tiles.size,1);assert.ok(tagged(rs,'shot').some(x=>x.target===air));assert.equal(tagged(rs,'tile').filter(x=>x.target===air).length,0);
  f.b.addBuff(f.u,{key:'fixture:disarm',flags:{disarm:true}});const cam=enemy(f,{flags:{camou:true}});
  const excluded=[enemy(f,{flags:{sleep:true}}),enemy(f,{flags:{stealth:true}}),enemy(f,{flags:{untargetable:true}})];advance(f.b,f.b.dt);
  assert.ok(tagged(rs,'tile').some(x=>x.target===cam));for(const x of excluded)assert.equal(x.findBuff('blaze2_s_2[on_tile]'),null);assert.ok(t.alive);
});
test('unwalkable or high target tiles do not ignite; emitted projectiles still settle full direct Arts',()=>{
  for(const change of [{pass:'NONE'},{height:'HIGH'}]){const f=make(),rs=receipts(f);activate(f);enemy(f);const tile=f.b.grid.tiles[5*21+6];Object.assign(tile,change);
    shot(f);until(f,()=>tagged(rs,'shot').length>0);assert.equal(f.controller.s2.tiles.size,0);assert.equal(tagged(rs,'tile').length,0);}
});
test('a killed impact target still leaves its grounded tile burning for a later entrant',()=>{
  const f=make(),rs=receipts(f);activate(f);const t=enemy(f,{hp:100});field(f);assert.equal(t.alive,false);
  f.b.addBuff(f.u,{key:'fixture:disarm',flags:{disarm:true}});const entrant=enemy(f);advance(f.b,f.b.dt);assert.ok(tagged(rs,'tile').some(x=>x.target===entrant));
});
test('control interrupts pending shots without a self hit; existing tiles persist while skill time elapses',()=>{
  const f=make(),rs=receipts(f);activate(f);enemy(f);until(f,()=>f.controller.phase?.kind==='s2-attack');f.b.applyStatus(f.u,'stun',{duration:1});advance(f.b,.8);
  assert.equal(tagged(rs,'self').length,0);assert.equal(tagged(rs,'shot').length,0);assert.ok(f.u.skill.active);
  field(f);const n=tagged(rs,'tile').length;f.b.applyStatus(f.u,'stun',{duration:1.5});advance(f.b,1.1);assert.ok(tagged(rs,'tile').length>n);assert.ok(f.u.skill.active);
});
test('self cost bypasses shields/modifier hooks and cannot grant SP; fatal cost enters the downed talent once',()=>{
  const f=make(),rs=receipts(f);activate(f);enemy(f);f.u.hp=20;
  const shield=f.b.addBuff(f.u,{key:'fixture:durable-shield',persist:true,shield:10000,shieldTypes:['true']});let mods=0;
  f.b.on('damage',ctx=>{if(ctx.target===f.u){mods++;ctx.cancel=true;}});shot(f);
  assert.equal(mods,0);near(shield.shield,10000);assert.equal(tagged(rs,'self').length,1);assert.equal(f.controller.reborn.kind,'downed');near(f.u.hp,1);
  assert.equal(f.u.skill.active,false);assert.equal(f.controller.s2.tiles.size,0);assert.equal(f.controller.s2.transition,null);near(f.u.skill.spTotal,0);
});
test('fatal self cost without E2 revival removes owner; already released shots survive while tile listeners cannot appear',()=>{
  const f=make({elite:1,rank:7}),rs=receipts(f);activate(f);const t=enemy(f);f.u.hp=1;shot(f);assert.equal(f.u.alive,false);
  until(f,()=>tagged(rs,'shot').length>0);assert.equal(tagged(rs,'shot')[0].target,t);assert.equal(f.controller.s2.tiles.size,0);assert.equal(tagged(rs,'tile').length,0);
});
test('source lifetime ends at 35 seconds, clears all recipients, restores ordinary range/stats and allows fresh SP',()=>{
  const f=make(),rs=receipts(f);activate(f);enemy(f);field(f);const end=f.u.skill.lastStart+35;
  until(f,()=>!f.u.skill.active,40);near(f.b.time,end,f.b.dt*2);assert.equal(f.controller.s2.tiles.size,0);assert.equal(f.controller.s2.recipients.size,0);
  near(f.u.s.atk,f.record.stats.atk);near(f.u.s.interval,1.6);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2_End');
  const count=tagged(rs,'tile').length;advance(f.b,1);assert.equal(tagged(rs,'tile').length,count);assert.ok(f.u.skill.spTotal>0);
  assert.equal(f.u.mem.regularFormVisual.clip,'Attack');
});
test('retreat clears listeners and slow immediately, but launched projectiles survive; battle end clears owned state',()=>{
  const f=make(),rs=receipts(f);activate(f);const t=enemy(f);field(f);assert.ok(t.findBuff('blaze2_s_2[on_tile]'));f.b.retreat(f.u);
  assert.equal(f.controller.s2.tiles.size,0);assert.equal(f.controller.s2.recipients.size,0);assert.equal(t.findBuff('blaze2_s_2[on_tile]'),null);
  const n=tagged(rs,'tile').length;advance(f.b,1.2);assert.equal(tagged(rs,'tile').length,n);
  const g=make(),out=receipts(g);activate(g);enemy(g);shot(g);g.b.retreat(g.u);until(g,()=>tagged(out,'shot').length>0);
  assert.equal(g.controller.s2.tiles.size,0);assert.equal(tagged(out,'tile').length,0);
  const z=make();activate(z);const a=enemy(z);field(z);z.b.finished=true;z.b.emit('battleEnd',{});
  assert.equal(z.controller.s2.tiles.size,0);assert.equal(z.controller.s2.recipients.size,0);assert.equal(a.findBuff('blaze2_s_2[on_tile]'),null);assert.equal(z.controller.handles.length,0);
  assert.equal(z.b.projectiles.list.filter(p=>p.data?.blazeIgnitingOwner===z.controller&&!p.removed).length,0);
});
test('repeated impacts on one tile retain a single slow and one-second recipient clock',()=>{
  const f=make(),rs=receipts(f);activate(f);const t=enemy(f);field(f);const born=tagged(rs,'tile')[0].time;
  advance(f.b,6.1);const ticks=tagged(rs,'tile').filter(x=>x.target===t);
  assert.equal(ticks.length,7);for(let n=0;n<ticks.length;n++)near(ticks[n].time,born+n,f.b.dt*2);
  assert.equal(f.controller.s2.tiles.size,1);assert.equal(t.buffs.filter(x=>x.key==='blaze2_s_2[on_tile]').length,1);
  assert.ok(tagged(rs,'shot').length>=3);assert.equal(tagged(rs,'self').length,tagged(rs,'shot').length);
});
test('arrival captures the target current root tile, not its launch position; a changed life rejects impact',()=>{
  const f=make(),rs=receipts(f);activate(f);const t=enemy(f);shot(f);move(t,5,7);field(f);
  assert.equal([...f.controller.s2.tiles.values()][0].col,7);assert.equal([...f.controller.s2.tiles.values()][0].row,5);
  assert.equal(tagged(rs,'shot')[0].target,t);
  const g=make(),out=receipts(g);activate(g);const z=enemy(g);shot(g);z.deploySeq++;
  advance(g.b,.2);assert.equal(tagged(out,'shot').length,0);assert.equal(g.controller.s2.tiles.size,0);assert.equal(tagged(out,'self').length,1);
});
test('ending the mode between birth and impact suppresses new tiles and uses current unboosted ATK',()=>{
  const f=make(),rs=receipts(f);activate(f);enemy(f);shot(f);f.u.skill.end('fixture');until(f,()=>tagged(rs,'shot').length>0);
  near(tagged(rs,'shot')[0].amount,f.record.stats.atk);assert.equal(f.controller.s2.tiles.size,0);assert.equal(tagged(rs,'tile').length,0);
});
test('tile Burn can trigger the global Meltdown talent and heal the active owner',()=>{
  const f=make(),rs=receipts(f);activate(f);const t=enemy(f);f.u.hp=100;const meltdown=[];
  f.b.on('damaged',c=>{if(c.dmg.tags.includes('blaze2:meltdown'))meltdown.push(c);});
  t.elem.burn=950;field(f);assert.equal(meltdown.length,1);assert.equal(meltdown[0].target,t);
  near(meltdown[0].hpLoss,f.u.s.atk*f.record.meltdown.ep_damage_scale);assert.ok(f.u.hp>100);assert.ok(tagged(rs,'injury').length>0);
});
test('tile killing output does not injure a dead recipient and removes its slow/listener',()=>{
  const f=make(),rs=receipts(f);activate(f);enemy(f);field(f);f.b.addBuff(f.u,{key:'fixture:disarm',flags:{disarm:true}});
  const t=enemy(f,{hp:100});advance(f.b,f.b.dt);assert.equal(t.alive,false);
  assert.equal(tagged(rs,'tile').filter(x=>x.target===t).length,1);assert.equal(tagged(rs,'injury').filter(x=>x.target===t).length,0);
  advance(f.b,f.b.dt);assert.equal(f.controller.s2.recipients.has(t),false);assert.equal(t.findBuff('blaze2_s_2[on_tile]'),null);
});
test('downed revival returns to ordinary mode with no stale tile listeners or S2 modifiers',()=>{
  const f=make(),rs=receipts(f);activate(f);const t=enemy(f);field(f);f.u.hp=1;until(f,()=>f.controller.reborn?.kind==='downed');
  assert.equal(t.findBuff('blaze2_s_2[on_tile]'),null);assert.equal(f.u.skill.active,false);near(f.u.s.atk,f.record.stats.atk);
  until(f,()=>f.controller.reborn===null,40);assert.equal(f.controller.s2.tiles.size,0);assert.equal(f.controller.s2.transition,null);
  const n=tagged(rs,'tile').length;until(f,()=>f.births.at(-1).projectile.data.blazeIgnitingKind==='ordinary');advance(f.b,.3);
  assert.equal(tagged(rs,'tile').length,n);assert.ok(f.u.canAct);near(f.u.s.interval,1.6);
});
