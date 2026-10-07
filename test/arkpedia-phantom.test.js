// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import evidence from '../data/arkpedia-phantom-prefabs.json' with {type:'json'};
import {StandardBattle}from'../server/sim/arkpedia.js';
import{defaultBuild}from'../shared/arkpedia/loadout.js';
import{summonRecordFor,summonCardId,summonUnitId,REGULAR_SUMMONS}from'../shared/arkpedia/summons.js';
import{deployRegularSummon,retreatRegularSummon,regularSummonCards,summonPlacementError}from'../server/sim/content/arkpedia-summons.js';
import{effectiveProfile,acquireTargets}from'../server/sim/ai.js';
const ID='char_250_phatom',TOKEN='token_10007_phatom_twin',FAN='char_123_fang';
const near=(a,e,t=1e-5)=>assert.ok(Math.abs(a-e)<t,`${a} != ${e}`);
const advance=(b,s)=>{for(let n=0;n<Math.round(s/b.dt);n++)b.step();assert.deepEqual(b.errors,[]);};
function make({skill=0,rank=10,elite=2,level=null,potential=1,trust=0,dir='RIGHT',defer=false,others=[]}={}){
 const source=structuredClone(data),op=source.operators[ID];assert.ok(op,'Reviewed Phantom snapshot required');
 source.stage.geometry.waves[0].spawns=[];source.stage.battle.dp_per_second=0;
 const build={...defaultBuild(op),elite,level:level??op.phases[elite].maxLevel,potential,trust,skillId:op.skills[skill].id,skillRank:rank};
 const builds=[build,...others.map(id=>defaultBuild(source.operators[id]))];
 const b=new StandardBattle(source,{operators:builds});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);
 const deploy=(id=ID,row=3,col=3)=>{const u=b.deployOperator(id,row,col,dir);assert.ok(u);u.atkCd=1000;return u;};
 return{b,u:defer?null:deploy(),build,deploy};
}
function enemy(b,{hp=100000,x=4,y=3,def=0,res=0,fly=false}={}){
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[0,0]});e.x=x;e.y=y;e.base.maxHp=100000;e.base.def=def;e.base.res=res;e.base.moveSpeed=0;if(fly)e.motion='FLY';e.markDirty();void e.s;e.hp=hp;
 b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
const bb=(skill,rank=10)=>Object.fromEntries(data.operators[ID].skills[skill].levels[rank-1].blackboard.map(x=>[x.key,x.value]));
const clone=(b,row=2,col=3,dir='RIGHT')=>{const t=deployRegularSummon(b,summonCardId(ID),row,col,dir);assert.ok(t);t.atkCd=1000;return t;};
const shot=(b,u,target,time=.5)=>{b.forceAttack(u,[target]);u.atkCd=1000;advance(b,time);};
const row=(rows,id)=>rows.find(r=>r.pathId===id).data;

test('original source retains six exact skills, both real clone facings, six verified bundles and explicit clock limits',()=>{
 assert.equal(evidence.frameParity,false);assert.deepEqual(evidence.enabledOperators,[ID]);assert.equal(evidence.sourceBundles.length,6);
 for(const r of evidence.sourceBundles)assert.match(r.sha256,/^[a-f0-9]{64}$/);
 for(const id of[ID,TOKEN])for(const[n,levels]of Object.entries(evidence.tableContracts[id].skills)){assert.equal(levels.length,10);assert.equal(levels[0].prefabId,n);}
 const faces=evidence.originalTokenModels.models[TOKEN].facings;
 assert.notEqual(faces.front.files[TOKEN+'.skel'].sha256,faces.back.files[TOKEN+'.skel'].sha256);
 for(const face of['Front','Back']){near(evidence.models[ID][face].hits.Attack[0],.267);near(evidence.models[ID][face].hits.Attack_2[0],.4);near(evidence.models[ID][face].hits.Skill[0],.433);assert.equal(evidence.originalOwnerFacingBindings[face].sha256,evidence.models[ID][face].sha256);}
 const action=JSON.parse(row(evidence.skills.skchr_phatom_3,'-2435240728104102152')._actions.SerializedState)[0];assert.match(action.$type,/RandomCastAbility/);assert.deepEqual(action._abilities.map(x=>x._abilityName),['sluggish','stun','root']);
 assert.equal(evidence.buffTemplates['charge_token[finish]'].eventToActions.ON_OWNER_FINISH[0]._rechargeTiming,'ON_FINISH');
});

test('every selected owner skill and all ranks load as original deployment passives',()=>{
 for(let skill=0;skill<3;skill++)for(let rank=1;rank<=10;rank++){const{b,u}=make({skill,rank});assert.equal(u.skill.kind,'passive');assert.equal(u.skill.active,true);assert.equal(u.skill.spTotal,0);assert.equal(u.skill.ready,false);assert.equal(u.skill.id,`skchr_phatom_${skill+1}`);assert.deepEqual(b.errors,[]);}
});

test('clone appears only with E1 talent and respects exact ground-facing/one-slot/one-stock limits',()=>{
 const e0=make({elite:0,rank:4});assert.equal(regularSummonCards(e0.b).length,0);
 const{b,u}=make({elite:1,rank:7});const state=regularSummonCards(b)[0];assert.equal(state.stock,1);assert.equal(state.config.deploymentSlotCost,1);assert.equal(state.config.chooseFacing,true);assert.equal(REGULAR_SUMMONS[ID].minimumElite,1);
 assert.equal(summonPlacementError(b,summonCardId(ID),3,3),'Tile is occupied.');assert.equal(summonPlacementError(b,summonCardId(ID),1,3),'Choose a melee tile.');
 const slots=b.deployedSlots(),dp=b.dp,t=clone(b);near(dp-b.dp,5);assert.equal(b.deployedSlots(),slots+1);assert.equal(t.ownerUnit,u);assert.equal(state.record.stats.maxDeployCount,1);assert.equal(regularSummonCards(b)[0].stock,0);assert.equal(summonPlacementError(b,summonCardId(ID),2,4),'No summons remaining.');
});

test('source clone skill/rank resolution fails closed on fabricated, locked or out-of-phase choices',()=>{
 const{build}=make();const tokens=structuredClone(data.tokens);
 for(const patch of[{skillId:'fabricated'},{skillRank:11},{skillRank:0},{elite:1,level:1,skillId:'skchr_phatom_3',skillRank:7}])assert.throws(()=>summonRecordFor(ID,{...build,...patch},tokens),/clone skill|rank/);
 const s=tokens[TOKEN].skills.find(x=>x.id==='sktok_phatom_1');s.levels[9].prefabId='fabricated';assert.throws(()=>summonRecordFor(ID,build,tokens),/Unreviewed/);s.levels[9].prefabId='sktok_phatom_1';s.levels[9].blackboard=[];assert.throws(()=>summonRecordFor(ID,build,tokens),/blackboard/);
});

test('clone own keyframes do not inherit parent trust/potential ATK/HP/DEF and E2 talent reduces only clone redeploy',()=>{
 for(const elite of[1,2])for(const level of[1,data.operators[ID].phases[elite].maxLevel])for(const potential of[1,6]){
  const{b,u,build}=make({elite,level,potential,trust:200,rank:elite===1?7:10}),t=clone(b),source=data.tokens[TOKEN].phases[elite];
  const lo=source.attributesKeyFrames[0],hi=source.attributesKeyFrames.at(-1),q=(level-lo.level)/(hi.level-lo.level);
  for(const[name,attr]of[['maxHp','maxHp'],['atk','atk'],['def','def']])near(t.base[name],Math.round(lo.data[attr]+(hi.data[attr]-lo.data[attr])*q));
  near(t.base.respawnTime,elite===2?35:45);assert.notEqual(t.base.atk,u.base.atk);assert.equal(t.def.raw.arkpedia.skillRank,build.skillRank);
 }
});

test('clone selected S1/S2/S3 uses its distinct source skill and every original rank',()=>{
 for(let skill=0;skill<3;skill++)for(let rank=1;rank<=10;rank++){const{b,u}=make({skill,rank}),t=clone(b);assert.equal(t.skill.id,`sktok_phatom_${skill+1}`);assert.equal(t.skill.kind,'passive');assert.deepEqual(t.skill.bb,bb(skill,rank));assert.equal(t.skill.spTotal,0);if(skill===1){near(u.s.atk/u.base.atk,1+bb(skill,rank).times*bb(skill,rank).atk);near(t.s.atk/t.base.atk,1+bb(skill,rank).times*bb(skill,rank).atk);}}
});

test('clone is HealFree but receives legal non-healing buffs and defensive SP remains absent',()=>{
 const{b,u}=make({skill:1}),t=clone(b);t.hp-=100;near(b.heal(u,t,100),0);assert.equal(t.s.flags.healFree,true);b.addBuff(t,{key:'test:buff',mods:{defPct:.5}});near(t.s.def,t.base.def*1.5);b.dealDamage(null,t,{amount:20,type:'true',canDodge:false});assert.equal(t.skill.spTotal,0);
});

test('clone stock/cooldown starts from actual withdrawal after a long deployment, with half DP refund',()=>{
 const{b}=make({skill:1}),t=clone(b);advance(b,40);assert.equal(regularSummonCards(b)[0].stock,0);const before=b.dp;retreatRegularSummon(b,summonUnitId(t));near(b.dp-before,2);const state=regularSummonCards(b)[0];assert.equal(state.stock,1);near(state.readyAt,b.time+35);assert.equal(summonPlacementError(b,summonCardId(ID),2,3),'Summon is still redeploying.');advance(b,34.8);assert.equal(summonPlacementError(b,summonCardId(ID),2,3),'Summon is still redeploying.');advance(b,.3);assert.equal(summonPlacementError(b,summonCardId(ID),2,3),null);const fresh=clone(b);assert.equal(fresh.hp,fresh.s.maxHp);assert.notEqual(fresh,t);
});

test('clone death recharges stock and starts native E1 delay without retreat refund or duplicate recharge',()=>{
 const{b}=make({elite:1,rank:7}),t=clone(b),before=b.dp;b.kill(t);assert.equal(regularSummonCards(b)[0].stock,1);near(regularSummonCards(b)[0].readyAt,b.time+45);near(b.dp,before);b.kill(t);assert.equal(regularSummonCards(b)[0].stock,1);advance(b,45.1);assert.equal(summonPlacementError(b,summonCardId(ID),2,3),null);
});

test('owner withdrawal kills clone and preserves independent cooldown through earlier parent redeployment',()=>{
 const{b,u}=make({skill:1}),t=clone(b);advance(b,2);b.retreatOperator(ID);assert.equal(t.alive,false);assert.equal(t.removeReason,'owner-removed');const ready=regularSummonCards(b)[0].readyAt;near(ready,b.time+35);advance(b,u.base.respawnTime+.1);b.addDp('arkpedia',99);const fresh=b.deployOperator(ID,3,3,'RIGHT');fresh.atkCd=1000;assert.equal(regularSummonCards(b)[0].stock,1);near(regularSummonCards(b)[0].readyAt,ready);assert.equal(summonPlacementError(b,summonCardId(ID),2,3),'Summon is still redeploying.');advance(b,ready-b.time+.1);assert.equal(summonPlacementError(b,summonCardId(ID),2,3),null);
});

test('owner death removes only its active clone without generating a refund',()=>{
 const{b,u}=make(),t=clone(b),before=b.dp;b.kill(u);assert.equal(t.alive,false);assert.equal(regularSummonCards(b)[0].available,false);near(b.dp,before);
});

test('S1 every rank installs exact independent physical shields and physical-only dodge for selected duration',()=>{
 for(let rank=1;rank<=10;rank++){
  const{b,u}=make({rank}),t=clone(b),v=bb(0,rank);for(const a of[u,t]){near(a.findBuff('phantom:physical-shield').shield,a.s.maxHp*v.hp_ratio);near(a.s.dodgePhys,v.prob);near(a.s.dodgeArts,0);near(a.findBuff('phantom:physical-shield').duration,v.duration);}
  advance(b,v.duration+.1);for(const a of[u,t]){assert.equal(a.findBuff('phantom:physical-shield'),null);near(a.s.dodgePhys,0);}
 }
});

test('S1 physical shield blocks mitigated Physical only, while Arts/TRUE/PURE bypass and dodges spend no shield',()=>{
 const{b,u}=make(),shield=u.findBuff('phantom:physical-shield'),initial=shield.shield,hp=u.hp;b.rng=()=>0;b.dealDamage(null,u,{amount:1000,type:'phys'});near(shield.shield,initial);near(u.hp,hp);
 b.dealDamage(null,u,{amount:u.s.def+100,type:'phys',canDodge:false});near(shield.shield,initial-100);near(u.hp,hp);
 b.dealDamage(null,u,{amount:50,type:'arts',canDodge:false});b.dealDamage(null,u,{amount:60,type:'true',canDodge:false});b.loseHp(u,70,{source:u});near(shield.shield,initial-100);near(u.hp,hp-180);
});

test('S2 all ranks preserve source ATK per stack and consume exactly one after each accepted output',()=>{
 for(let rank=1;rank<=10;rank++){
  const{b,u}=make({skill:1,rank}),v=bb(1,rank),e=enemy(b,{def:100});const base=u.base.atk;
  for(let n=v.times;n>0;n--){near(u.s.atk,base*(1+n*v.atk));const hp=e.hp,atk=u.s.atk;shot(b,u,e);near(hp-e.hp,Math.max(atk-100,atk*.05));assert.equal(u.mem.phantomStacks,n-1);}
  near(u.s.atk,base);assert.equal(effectiveProfile(u).attackVisual(b,u),'Attack');shot(b,u,e);assert.equal(u.mem.phantomStacks,0);
 }
});

test('S2 parent and clone charge stacks remain independent and compose with external ATK percent',()=>{
 const{b,u}=make({skill:1}),t=clone(b),e=enemy(b),z=enemy(b,{y:2});b.addBuff(u,{key:'test:ATK',mods:{atkPct:.4}});near(u.s.atk,u.base.atk*3.4);shot(b,u,e);assert.equal(u.mem.phantomStacks,9);assert.equal(t.mem.phantomStacks,10);shot(b,t,z);assert.equal(t.mem.phantomStacks,9);near(u.s.atk,u.base.atk*3.2);near(t.s.atk,t.base.atk*2.8);
});

test('S2 dodge/cancellation keep stacks but fully shielded accepted output consumes one',()=>{
 const{b,u}=make({skill:1}),e=enemy(b);b.addBuff(e,{key:'test:dodge',mods:{dodgePhys:1}});shot(b,u,e);assert.equal(u.mem.phantomStacks,10);b.removeBuff(e,'test:dodge');const h=b.on('hit',c=>{if(c.source===u)c.dmg.cancel=true;});shot(b,u,e);assert.equal(u.mem.phantomStacks,10);b.off(h);b.addBuff(e,{key:'test:shield',shield:100000});shot(b,u,e);near(e.hp,100000);assert.equal(u.mem.phantomStacks,9);
});

test('original normal/charged hit timings and cap1.1 are retained for parent and actual clone both facings',()=>{
 for(const dir of['RIGHT','UP'])for(const skill of[0,1]){const{b,u}=make({dir,skill}),t=clone(b,2,3,dir);for(const a of[u,t]){const expected=skill===1?.4:.267;b.addBuff(a,{key:'test:ASPD',mods:{aspd:100}});near(effectiveProfile(a).windup(b,a),expected/1.1);assert.equal(effectiveProfile(a).attackVisual(b,a),skill===1?'Attack_2':'Attack');}}
});

test('normal CAST selection reacquires actual release victims and does not damage departed/hidden/air input',()=>{
 for(const kind of['leave','hidden','air']){const{b,u}=make({skill:1}),a=enemy(b),z=enemy(b,{x:8});b.forceAttack(u,[a]);u.atkCd=1000;advance(b,.1);if(kind==='leave')a.x=8;else if(kind==='hidden')a.hidden=true;else a.motion='FLY';z.x=4;b._buildEnemyIndex();advance(b,.4);near(a.hp,100000);assert.ok(z.hp<100000);assert.equal(u.mem.phantomStacks,9);}
});

test('S3 all ranks emits at original .433 birth event and chooses one status for all legal x4 ground victims',()=>{
 for(let rank=1;rank<=10;rank++)for(const[rng,status]of[[0,'sluggish'],[.4,'stun'],[.9,'bind']]){
  const{b,deploy}=make({skill:2,rank,defer:true}),a=enemy(b,{x:4,y:3}),z=enemy(b,{x:3,y:2}),far=enemy(b,{x:5,y:3}),air=enemy(b,{x:3,y:4,fly:true});b.rng=()=>rng;const u=deploy(),v=bb(2,rank);advance(b,.4);near(a.hp,100000);advance(b,.067);for(const e of[a,z]){near(100000-e.hp,u.s.atk*v.atk_scale);assert.equal(e.buffs.some(x=>x.status===status),true);near(e.buffs.find(x=>x.status===status).duration,v[status==='bind'?'root':status]);}near(far.hp,100000);near(air.hp,100000);assert.equal(u.mem.phantomDeploymentStatus,status);assert.equal(u.mem.regularFormVisual.clip,'Skill');advance(b,.6);assert.equal(u.mem.regularFormVisual,null);
 }
});

test('S3 parent and clone each use own source ATK, independent branch draw and actual placement center',()=>{
 const{b,deploy}=make({skill:2,defer:true}),a=enemy(b,{x:4,y:4}),z=enemy(b,{x:3,y:1});let rng=0;b.rng=()=>rng;const u=deploy();advance(b,.5);assert.equal(a.buffs.some(x=>x.status==='sluggish'),true);const old=a.hp;rng=.9;const t=clone(b);advance(b,.5);near(100000-z.hp,t.s.atk*3);assert.equal(z.s.flags.bind,true);near(a.hp,old);assert.equal(t.mem.phantomDeploymentStatus,'bind');assert.notEqual(u.s.atk,t.s.atk);
});

test('S3 source statuses affect living shielded/dodged victims, honor immunity/Resist and use force0 relative push',()=>{
 const{b,deploy}=make({skill:2,defer:true}),a=enemy(b),z=enemy(b,{x:3.2,y:3.2}),d=enemy(b,{x:2,y:3}),r=enemy(b,{x:3,y:4});a.base.massLevel=0;a.markDirty();b.addBuff(a,{key:'test:shield',shield:10000});z.def={...z.def,immune:new Set([...z.def.immune,'stun'])};b.addBuff(d,{key:'test:dodge',mods:{dodgePhys:1}});b.applyStatus(r,'resist',{duration:10});b.rng=()=>.4;const u=deploy();advance(b,.5);near(a.hp,100000);near(d.hp,100000);assert.equal(a.s.flags.stun,true);assert.equal(d.s.flags.stun,true);near(r.buffs.find(x=>x.status==='stun').duration,2.25);assert.equal(z.s.flags.stun,false);assert.ok(a.x>4,'source force0 must move a sufficiently light victim away from source');assert.equal(u.mem.phantomDeploymentStatus,'stun');
});

test('S3 source excludes hidden/target-free at release, accepts new range entrants and canceled owner emits nothing',()=>{
 const{b,deploy}=make({skill:2,defer:true}),a=enemy(b),z=enemy(b,{x:9}),free=enemy(b,{x:3,y:2});b.addBuff(free,{key:'test:free',flags:{untargetable:true}});const u=deploy();advance(b,.1);a.hidden=true;z.x=4;b._buildEnemyIndex();advance(b,.5);near(a.hp,100000);near(free.hp,100000);assert.ok(z.hp<100000);
 const next=make({skill:2,defer:true}),e=enemy(next.b),gone=next.deploy();next.b.retreatOperator(ID);advance(next.b,.6);near(e.hp,100000);assert.equal(gone.mem.regularFormVisual,null);
});

test('actual natural AI charged attacks use one victim and decay source stacks without fabricated splash/projectiles',()=>{
 const{b,u}=make({skill:1}),a=enemy(b),z=enemy(b,{x:4.1});u.atkCd=0;const atk=u.s.atk;advance(b,.6);near(100000-a.hp,atk);near(z.hp,100000);assert.equal(u.mem.phantomStacks,9);assert.equal(b.projectiles.list.length,0);
});


test('actual owner and clone direct attack damage waits for the selected literal normal or charged hit event',()=>{
 for(const skill of[0,1]){const{b,u}=make({skill}),t=clone(b),a=enemy(b),z=enemy(b,{y:2});
  for(const[unit,victim]of[[u,a],[t,z]]){const atk=unit.s.atk,hp=victim.hp;b.forceAttack(unit,[victim]);unit.atkCd=1000;advance(b,skill===1?.367:.233);near(victim.hp,hp);advance(b,.1);near(hp-victim.hp,atk);}
 }
});
