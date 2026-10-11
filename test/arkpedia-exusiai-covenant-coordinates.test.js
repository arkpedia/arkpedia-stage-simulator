// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import e from '../data/arkpedia-exusiai-covenant-prefabs.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {normalizeChess} from '../server/sim/simdata.js';
import {defaultBuild} from '../shared/arkpedia/loadout.js';
import {REGULAR_OPERATORS} from '../shared/arkpedia/operators.js';
import {EXUSIAI_COVENANT_ID as ID,selectedExusiaiCovenantBuild,
  prepareExusiaiCovenantCoordinates} from '../server/sim/content/arkpedia-exusiai-covenant.js';
import {EXUSIAI_COVENANT_COORDINATES_CONTRACT} from '../server/sim/content/arkpedia-exusiai-covenant-coordinates.js';
const near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps,`${a} != ${z}`);
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function until(f,p,s=12){const end=f.b.time+s;while(!p()&&f.b.time<end)advance(f.b,f.b.dt);assert.ok(p(),`Expected condition at ${f.b.time}`);}
function owner(b,{rank=10,elite=2,level=e.tables.character.phases[elite].maxLevel,potential=1,trust=0,
  skill=3,dir='RIGHT',defer=false,row=5,col=5,contract=EXUSIAI_COVENANT_COORDINATES_CONTRACT}={}){
  const build={elite,level,potential,trust,skillId:`skchr_angel2_${skill}`,skillRank:Math.min(rank,[4,7,10][elite])};
  const r=selectedExusiaiCovenantBuild(build),c=e.tables.character;
  const def=normalizeChess({chessId:ID,charId:ID,name:c.name,profession:c.profession,position:c.position,
    subProfessionId:c.subProfessionId,stats:r.stats,rangeGrid:r.rangeGrid,talents:r.talents,
    tags:r.tags,
    skill:{...r.source,...r.source.spData,skillId:build.skillId,
      rangeGrid:r.source.rangeId?e.tables.ranges[r.source.rangeId].grids.map(v=>[v.row,v.col]):[],trigger:{rule:'NEVER'}},arkpedia:build});
  const u=b._makeAlly(b.getPlayer('arkpedia'),def,'op',row,col,{dir});
  const prepared=prepareExusiaiCovenantCoordinates(b,u,{contract});b._setupUnit(u,prepared.kit);prepared.controller.install();
  const hits=[],attacks=[],births=[],bombs=[];
  b.on('exusiaiCovenantS3ProjectileBirth',ctx=>{if(ctx.owner===u)births.push({...ctx,time:b.time});});
  b.on('exusiaiCovenantBombBirth',ctx=>{if(ctx.owner===u)bombs.push({...ctx,time:b.time});});
  b.on('damaged',ctx=>{if(ctx.source===u)hits.push({...ctx,time:b.time});});
  b.on('attack',ctx=>{if(ctx.attacker===u)attacks.push({...ctx,time:b.time});});

  const deploy=()=>{u.player.dp=99;assert.ok(b._deploy(u,{initial:false}));u.player.dp=99;};if(!defer)deploy();
  return {b,u,build,deploy,hits,attacks,births,bombs,...prepared};
}
function make(opts={}){
  const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
  d.stage.geometry.rows=19;d.stage.geometry.cols=21;d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
  const b=new StandardBattle(d,{operators:[defaultBuild(d.operators.char_289_gyuki), {...defaultBuild(d.operators.char_1013_chen2),elite:2,level:90,skillId:'skchr_chen2_3',skillRank:10}, {...defaultBuild(d.operators.char_4039_horn),elite:2,level:90,skillId:'skchr_horn_2',skillRank:10}]});
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

const TOKEN='token_10056_angel2_target', GUARD='char_289_gyuki', HORN='char_4039_horn', RANGED='char_1013_chen2';
const deck=f=>f.controller.coordinates;
function start(f){until(f,()=>f.u.skill.ready,20);assert.equal(f.u.skill.activate('manual'),true);}
function retired(f,id=GUARD,{col=2,ready=70}={}){
  f.b.getPlayer('arkpedia').dp=99;const a=f.b.deployOperator(id,2,col,'RIGHT');
  f.b.retreatOperator(id);f.b.bench[id].readyAt=f.b.time+ready;return a;
}
function deliveries(f){const out=[];f.b.on('exusiaiCovenantDelivery',c=>{if(c.owner===f.u)out.push({...c,time:f.b.time});});return out;}
function cannon(f){const out=[];f.b.on('exusiaiCovenantDeliveryProjectileBirth',c=>{if(c.owner===f.u)out.push({...c,time:f.b.time});});return out;}

test('delivery requires its exact separate contract and selected S3 while all public source gates remain held',()=>{
  assert.throws(()=>make({contract:{...EXUSIAI_COVENANT_COORDINATES_CONTRACT}}),/contract/);
  assert.throws(()=>make({skill:2}),/third skill/);
  assert.equal(data.operators[ID],undefined);assert.equal(REGULAR_OPERATORS[ID],undefined);assert.deepEqual(e.enabledOperators,[]);
});

test('the original owner deployment grants one coordinate card; a fresh diagnostic cannot place it before deployment',()=>{
  const f=make({defer:true});assert.equal(deck(f).stock,0);assert.match(deck(f).placementError(5,6),/Exusiai/);
  f.deploy();assert.equal(deck(f).stock,1);assert.equal(deck(f).readyAt,f.b.time);
  const t=deck(f).place(5,6,'LEFT');assert.equal(t.defId,TOKEN);assert.equal(t.ownerUnit,f.u);
  assert.equal(t.dir,'LEFT');assert.equal(deck(f).stock,0);assert.match(deck(f).placementError(5,7),/already/);
});

test('all ten ranks retain the selected original passive token skill and interpolated token HP',()=>{
  for(let rank=1;rank<=10;rank++){
    const f=make({rank,level:1});const t=deck(f).place(5,6,'RIGHT');
    assert.equal(t.skill.id,'sktok_angel2_target_3');assert.equal(t.skill.kind,'passive');near(t.s.maxHp,2370);
    assert.equal(t.s.blockCnt,0);assert.equal(t.base.cost,0);assert.equal(t.base.respawnTime,70);
    assert.equal(t.profile.noAttack,true);assert.equal(t.deploymentSlotCost,0);
  }
  const f=make({level:90});near(deck(f).place(5,6,'RIGHT').s.maxHp,3000);
});

test('coordinate placement costs no DP or deployment slot, even when the unit limit is full',()=>{
  const f=make();f.b.unitLimit=f.b.deployedSlots();f.u.player.dp=0;const before=f.b.deployedSlots();
  const t=deck(f).place(5,6,'UP');near(f.u.player.dp,0);assert.equal(f.b.deployedSlots(),before);
  assert.equal(t.s.flags.invulnerable,true);assert.equal(t.s.flags.untargetable,true);
  near(f.b.dealDamage(f.u,t,{amount:1e9,type:'true'}),0);assert.equal(t.alive,true);
});

test('placement validates range, ground tile, occupancy, reservations, facing and fullscreen without consuming the card',()=>{
  const f=make();assert.match(deck(f).placementError(18,20),/range/);
  assert.match(deck(f).placementError(5,5),/occupied/);assert.match(deck(f).placementError(-1,6),/map/);
  const tile=f.b.grid.tile(5,6);tile.build='RANGED';assert.match(deck(f).placementError(5,6),/melee/);tile.build='ALL';
  assert.ok(f.b.reserveTile(f.u,5,6,'fixture:reserved'));assert.match(deck(f).placementError(5,6),/reserved/);
  f.b.releaseTileReservations(f.u);
  assert.throws(()=>deck(f).place(5,6,'BAD'),/facing/);assert.equal(deck(f).stock,1);
  f.b.setViewport('embedded-preview');assert.match(deck(f).placementError(5,6),/fullscreen/);
  assert.equal(deck(f).stock,1);
});

test('retreating coordinates starts the independent seventy-second clock and supports a new marker life',()=>{
  const f=make(),first=deck(f).place(5,6,'RIGHT');f.b.retreat(first,{permanent:true});
  assert.equal(deck(f).token,null);assert.equal(deck(f).stock,1);near(deck(f).readyAt,f.b.time+70);
  assert.match(deck(f).placementError(5,6),/redeploying/);advance(f.b,69.9);
  assert.match(deck(f).placementError(5,6),/redeploying/);advance(f.b,.15);
  const second=deck(f).place(5,6,'DOWN');assert.notEqual(first,second);assert.equal(second.dir,'DOWN');
});

test('a marker takes priority over normal targets, launches at the cannon event, and does not consume volley ammunition',()=>{
  const f=make(),t=deck(f).place(5,7,'RIGHT'),born=cannon(f);enemy(f);start(f);
  until(f,()=>f.controller.phase?.kind==='s3-delivery');const p=f.controller.phase;
  assert.equal(f.u.mem.regularFormVisual.clip,'Skill_3_Skill');assert.equal(born.length,0);
  until(f,()=>born.length===1);near(born[0].time,p.releaseAt,f.b.dt+1e-6);assert.equal(born[0].projectile.speed,10);
  assert.equal(f.u.skill.ammoLeft,50);assert.equal(f.births.length,0);assert.equal(born[0].token,t);
  until(f,()=>!t.alive);assert.equal(f.u.skill.ammoLeft,50);
});

test('the independent delivery works without enemies and deploys the longest-cooldown ground operator with six SP',()=>{
  const f=make();retired(f,GUARD,{ready:60});const old=retired(f,HORN,{ready:80,col:3});retired(f,RANGED,{ready:100,col:4});
  const t=deck(f).place(5,7,'DOWN'),out=deliveries(f),sp=[];
  f.b.on('spGain',c=>{if(c.reason==='angel2:delivery')sp.push(c);});
  f.u.player.dp=0;start(f);until(f,()=>out.length===1);const a=out[0].unit;
  assert.equal(a.defId,HORN);assert.notEqual(a,old);assert.equal(a.dir,'DOWN');assert.equal(a.tileR,5);assert.equal(a.tileC,7);
  assert.equal(a.def.skill.id,'skchr_horn_2');assert.equal(a.def.raw.arkpedia.skillRank,10);
  assert.equal(old.alive,false);assert.equal(t.alive,false);assert.equal(f.b.bench[HORN].readyAt,out[0].time);
  near(f.u.player.dp,0);assert.equal(f.b.bench[HORN].lastCost,0);assert.equal(sp.length,1);near(sp[0].amount,6);
  assert.equal(deck(f).deliveries,1);assert.equal(f.u.skill.ammoLeft,50);
});

test('the real deployment path runs original selected kits and their deploy hooks rather than cloning a former life',()=>{
  const f=make(),old=retired(f,HORN);f.b.bench[GUARD].readyAt=f.b.time;
  old.mem.hornReborn=true;old.mem.hornFlareSeq=9;
  deck(f).place(5,6,'LEFT');const out=deliveries(f);let deployed=0;
  f.b.on('deploy',c=>{if(c.unit.defId===HORN)deployed++;});start(f);until(f,()=>out.length===1);
  const a=out[0].unit;assert.equal(deployed,1);assert.notEqual(a.id,old.id);assert.ok(a.deploySeq>old.deploySeq);
  assert.equal(a.skill.ammo,10);assert.equal(a.mem.hornReborn,false);assert.equal(a.mem.hornFlareSeq,0);
  assert.equal(typeof a.skill.spec.onManualCancel,'function');
  assert.equal(f.b.bench[HORN].deployments,2);near(a.hp,a.s.maxHp);
});

test('source-selected cooldown ties keep squad order and exclude deployed and high-ground cards',()=>{
  const f=make();retired(f,GUARD);retired(f,HORN,{col:3});retired(f,RANGED,{col:4,ready:999});
  const list=deck(f).cards();assert.deepEqual(list.map(v=>v.id),[GUARD,HORN]);
  assert.equal(list[0].remaining,list[1].remaining);assert.ok(!list.some(v=>v.id===ID));
});

test('the delivery splash uses current ATK, radius 1.8 and includes flying and camouflaged area victims',()=>{
  const f=make();deck(f).place(5,7,'RIGHT');const a=enemy(f,{col:7}),z=enemy(f,{row:6,col:7,fly:true,flags:{camou:true}}),outside=enemy(f,{col:10});
  const born=cannon(f);start(f);until(f,()=>born.length===1);f.b.addBuff(f.u,{key:'fixture:atk',mods:{atkPct:1}});
  until(f,()=>f.hits.filter(h=>h.dmg.tags.includes('angel2:delivery')).length===2);
  const hits=f.hits.filter(h=>h.dmg.tags.includes('angel2:delivery'));assert.deepEqual(new Set(hits.map(h=>h.target)),new Set([a,z]));
  for(const h of hits){near(h.dmg.amount,f.u.s.atk*2.5);assert.equal(h.dmg.isSplash,true);assert.equal(h.dmg.isSkill,true);}
  near(outside.hp,outside.s.maxHp);
});

test('a full unit limit blocks forced delivery but not its splash or marker consumption, with no card/cooldown mutation',()=>{
  const f=make();retired(f);const entry=f.b.bench[GUARD],ready=entry.readyAt,count=entry.deployments;
  const t=deck(f).place(5,7,'RIGHT');f.b.unitLimit=f.b.deployedSlots();const out=deliveries(f),blocked=[];
  f.b.on('exusiaiCovenantDeliveryBlocked',c=>blocked.push(c));enemy(f,{col:7});start(f);until(f,()=>!t.alive);
  assert.equal(out.length,0);assert.equal(blocked.length,1);assert.match(blocked[0].error,/limit/);
  assert.equal(entry.readyAt,ready);assert.equal(entry.deployments,count);assert.ok(f.hits.some(h=>h.dmg.tags.includes('angel2:delivery')));
});

test('no available ground card still allows the delivery splash and consumes only the marker',()=>{
  const f=make();for(const id of [GUARD,HORN]){f.u.player.dp=99;f.b.deployOperator(id,2,id===GUARD?2:3,'RIGHT');}
  const t=deck(f).place(5,7,'RIGHT'),out=deliveries(f);enemy(f,{col:7});start(f);until(f,()=>!t.alive);
  assert.equal(out.length,0);assert.equal(deck(f).deliveries,0);assert.ok(f.hits.some(h=>h.dmg.tags.includes('angel2:delivery')));
});

test('skill-driven deployment ignores current viewport and zero DP but ordinary manual deployment keeps both restrictions',()=>{
  const f=make();retired(f);const t=deck(f).place(5,7,'UP'),born=cannon(f),out=deliveries(f);
  f.u.player.dp=0;start(f);until(f,()=>born.length===1);f.b.setViewport('embedded-preview');until(f,()=>out.length===1);
  assert.equal(out[0].unit.dir,'UP');near(f.u.player.dp,0);assert.equal(t.alive,false);
  assert.match(f.b.placementError(HORN,3,3),/fullscreen/);assert.throws(()=>f.b.deployOperator(HORN,3,3,'RIGHT'),/fullscreen/);
});

test('withdrawing the owner before or after cannon birth cancels delivery and removes its own coordinates and hooks',()=>{
  for(const when of ['windup','born']){
    const f=make();const t=deck(f).place(5,8,'RIGHT'),born=cannon(f),out=deliveries(f);start(f);
    until(f,()=>when==='born'?born.length===1:f.controller.phase?.kind==='s3-delivery');f.b.retreat(f.u);advance(f.b,1);
    assert.equal(t.alive,false);assert.equal(out.length,0);assert.equal(deck(f).token,null);assert.equal(deck(f).stock,0);
    assert.equal(deck(f).handles.length,0);assert.equal(f.b.projectiles.list.filter(p=>p.data?.exusiaiCovenantKind==='delivery').length,0);
  }
});

test('stun cancels an unfired cannon without spending ammo or withdrawing the marker; a later legal cast resumes',()=>{
  const f=make(),t=deck(f).place(5,7,'RIGHT'),born=cannon(f);start(f);until(f,()=>f.controller.phase?.kind==='s3-delivery');
  f.b.addBuff(f.u,{key:'fixture:stun',flags:{stun:true}});advance(f.b,.5);
  assert.equal(born.length,0);assert.equal(t.alive,true);assert.equal(f.u.skill.ammoLeft,50);
  f.b.removeBuff(f.u,'fixture:stun');until(f,()=>born.length===1);until(f,()=>!t.alive);
});

test('manual end cancels an unborn cannon but an already born source-valid shot keeps its arrival action',()=>{
  for(const when of ['windup','born']){
    const f=make(),t=deck(f).place(5,8,'LEFT'),born=cannon(f),out=deliveries(f);start(f);
    until(f,()=>when==='born'?born.length===1:f.controller.phase?.kind==='s3-delivery');f.u.skill.end('manual');advance(f.b,1);
    assert.equal(born.length,when==='born'?1:0);assert.equal(t.alive,when!=='born');assert.equal(out.length,when==='born'?1:0);
  }
});

test('a marker removed in flight preserves the fixed impact point and cannot consume a replacement marker life',()=>{
  const f=make(),t=deck(f).place(5,8,'LEFT'),born=cannon(f),out=deliveries(f);enemy(f,{col:8});start(f);until(f,()=>born.length===1);
  f.b.retreat(t,{permanent:true});deck(f).readyAt=f.b.time;const replacement=deck(f).place(5,7,'RIGHT');
  until(f,()=>out.length===1);assert.equal(replacement.alive,true);assert.equal(deck(f).token,replacement);
  assert.equal(out[0].unit.dir,'LEFT');assert.equal(out[0].unit.tileC,8);assert.ok(f.hits.some(h=>h.dmg.tags.includes('angel2:delivery')));
});

test('delivery stops after the source ninety-nine deployment limit without deleting an unrelated bench entry',()=>{
  const f=make(),t=deck(f).place(5,7,'RIGHT'),out=deliveries(f);deck(f).deliveries=99;
  start(f);until(f,()=>!t.alive);assert.equal(out.length,0);assert.equal(f.b.bench[GUARD].deployments,0);assert.equal(deck(f).deliveries,99);
});

test('battle finish removes the marker, card and delivery projectile without leaving owned producer hooks',()=>{
  const f=make(),t=deck(f).place(5,8,'RIGHT'),born=cannon(f),out=deliveries(f);start(f);until(f,()=>born.length===1);
  f.b._finish('victory');advance(f.b,1);assert.equal(t.alive,false);assert.equal(out.length,0);
  assert.equal(deck(f).token,null);assert.equal(deck(f).stock,0);assert.equal(deck(f).handles.length,0);
});

test('the six-SP grant respects a delivered operator SP lock and a full holder rather than forcing overflow',()=>{
  for(const mode of ['locked','full']){
    const f=make();retired(f);deck(f).place(5,7,'RIGHT');const out=deliveries(f);
    f.b.on('deploy',({unit})=>{
      if(unit.defId!==GUARD)return;
      if(mode==='locked')f.b.addBuff(unit,{key:'fixture:no-sp',flags:{noSp:true}});
      else {unit.skill.charges=unit.skill.maxCharges;unit.skill.sp=unit.skill.spCost;}
    });
    start(f);until(f,()=>out.length===1);const a=out[0].unit;
    if(mode==='locked')near(a.skill.spTotal,a.skill.initSp);
    else {assert.equal(a.skill.charges,a.skill.maxCharges);near(a.skill.sp,a.skill.spCost);}
  }
});

test('each facing retains the uncapped original cannon event and selected marker direction',()=>{
  for(const dir of ['RIGHT','UP','DOWN','LEFT']){
    const f=make({dir});const r=dir==='UP'?7:dir==='DOWN'?3:5,c=dir==='RIGHT'?7:dir==='LEFT'?3:5;
    deck(f).place(r,c,dir);f.b.addBuff(f.u,{key:'fixture:aspd',mods:{aspd:100}});const born=cannon(f),out=deliveries(f);
    start(f);until(f,()=>f.controller.phase?.kind==='s3-delivery');const p=f.controller.phase;
    near(f.u.mem.regularFormVisual.speed,2);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_3_Skill');
    until(f,()=>born.length===1);near(born[0].time,p.releaseAt,f.b.dt+1e-6);until(f,()=>out.length===1);
    assert.equal(out[0].unit.dir,dir);assert.equal(out[0].unit.tileR,r);assert.equal(out[0].unit.tileC,c);
  }
});

test('ordinary manual deployment still spends its normal DP and refuses an active redeployment timer',()=>{
  const f=make(),cost=f.b.cost(GUARD);f.u.player.dp=99;f.b.deployOperator(GUARD,2,2,'RIGHT');near(f.u.player.dp,99-cost);
  f.b.retreatOperator(GUARD);assert.match(f.b.placementError(GUARD,2,2),/redeploying/);
  assert.throws(()=>f.b.deployOperator(GUARD,2,2,'RIGHT'),/redeploying/);
  f.b.bench[GUARD].readyAt=f.b.time;f.u.player.dp=0;assert.match(f.b.placementError(GUARD,2,2),/DP/);
});
