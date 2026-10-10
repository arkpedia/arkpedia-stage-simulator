// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-vina-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
import { immuneSet } from '../server/sim/simdata.js';
import { regularTokenIdsFor, REGULAR_SUMMONS } from '../shared/arkpedia/summons.js';
const ID='char_1019_siege2',TOKEN='token_10040_siege2_vlion';
test('Golden Vows models preload with Vina without allocating a deployment card',()=>{
 assert.deepEqual(regularTokenIdsFor([ID]),[TOKEN]);assert.equal(REGULAR_SUMMONS[ID],undefined);
 for(const facing of ['front','back'])assert.ok(data.sd.models[`operator/${TOKEN}/default/${facing}`]);
 assert.equal(data.tokens[TOKEN].automaticOnly,true);assert.equal(data.tokens[TOKEN].avatar,null);
});
const near=(a,z)=>assert.ok(Math.abs(a-z)<1e-5,`${a} != ${z}`);
function advance(b,s){const end=b.time+s;while(b.time<end-1e-9)b.step();assert.deepEqual(b.errors,[]);}
function make({skill=0,rank=10,elite=2,potential=1,dir='RIGHT',others=[]}={}){
 const src=structuredClone(data);src.stage.geometry.waves[0].spawns=[];src.stage.battle.dp_per_second=0;
 const op=src.operators[ID],build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,potential,
  skillId:op.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
 const b=new StandardBattle(src,{operators:[build,...others.map(id=>defaultBuild(src.operators[id]))]});
 b.autoFinish=false;b.recordEvents=true;b.setViewport('fullscreen-workspace');
 b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 b.addDp('arkpedia',99);const u=b.deployOperator(ID,3,2,dir);
 u.profile.noAttack=true;u.atkCd=1000;u.skill.rule='NEVER';
 const hits=[];b.on('damaged',c=>hits.push({...c,time:b.time}));return{b,u,hits};
}
function enemy(b,{r=3,c=3,hp=100000,def=0,res=0,fly=false}={}){
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});Object.assign(e.base,{maxHp:hp,atk:0,def,res});
 e.markDirty();void e.s;e.hp=hp;if(fly)e.motion='FLY';
 b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function cast(u){u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.activate('test'),true);}
function fire(b,u,es){b.forceAttack(u,es??acquireTargets(b,u,effectiveProfile(u)));u.atkCd=1000;}
const tokens=b=>b.allyUnits.filter(t=>t.defId===TOKEN&&t.alive&&t.deployed);
function ally(b,id,r,c){b.addDp('arkpedia',99);const a=b.deployOperator(id,r,c,'RIGHT');assert.ok(a);
 a.profile.noAttack=true;a.atkCd=1000;a.skill.rule='NEVER';return a;}
test('original 30 ranks, zero-range summon stats and single native skeleton are preserved',()=>{
 for(const s of data.operators[ID].skills)assert.deepEqual(s.levels.map(({rangeGrid,...l})=>l),evidence.tables.skills[s.id].levels);
 assert.equal(data.tokens[TOKEN].automaticOnly,true);assert.equal(data.tokens[TOKEN].avatar,null);
 assert.equal(evidence.models[TOKEN].originalPathIds.alphaTexturePathId,'0');
 assert.deepEqual(evidence.models[TOKEN].hits.Attack,[.5]);
 for(const p of data.tokens[TOKEN].phases)assert.deepEqual(p.rangeGrid,[[0,0]]);
});
test('normal attack selects one ground enemy, alternates original clips and caps animation speed',()=>{
 const{b,u,hits}=make({elite:0});enemy(b);enemy(b);enemy(b,{fly:true});
 assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,1);fire(b,u);advance(b,.55);
 assert.equal(hits.length,1);assert.equal(hits[0].dmg.type,'arts');near(hits[0].amount,u.s.atk);
 assert.equal(u.mem.vinaAttackClip,'Attack_1');fire(b,u);advance(b,.55);assert.equal(u.mem.vinaAttackClip,'Attack_2');
 b.addBuff(u,{key:'aspd',mods:{aspd:100}});near(u.profile.windup(b,u),.5);
});
for(let rank=1;rank<=10;rank++)test(`S1 rank ${rank}: normal Arts receipt and independent five-tile True area receipt`,()=>{
 const{b,u,hits}=make({rank});const primary=enemy(b,{def:99999,res:50}),side=enemy(b,{r:2,c:2}),diag=enemy(b,{r:2,c:3}),air=enemy(b,{fly:true});
 cast(u);assert.equal(u.s.flags.noSp,true);fire(b,u,[primary]);advance(b,.6);assert.equal(hits.length,0);advance(b,.1);
 assert.equal(hits.length,3);assert.equal(hits[0].dmg.type,'arts');near(hits[0].amount,u.s.atk*.5);
 const area=hits.filter(h=>h.dmg.tags.includes('vina:s1-area'));assert.equal(area.length,2);
 area.forEach(h=>near(h.amount,u.s.atk*u.skill.bb.atk_scale));near(diag.hp,100000);near(air.hp,100000);
 assert.ok(side.hp<100000);assert.equal(u.skill.active,false);
});
test('short stun cancels the unreleased S1 and no extra damage survives retreat',()=>{
 const{b,u,hits}=make();enemy(b);cast(u);fire(b,u);b.applyStatus(u,'stun',{duration:.001});advance(b,.7);assert.equal(hits.length,0);
 const next=make();enemy(next.b);cast(next.u);fire(next.b,next.u);next.b.retreatOperator(ID);advance(next.b,.8);assert.equal(next.hits.length,0);
});
for(const elite of[1,2])for(const potential of[1,5])test(`E${elite} P${potential}: nearby allies count excludes self, physical-only aura cleans up`,()=>{
 const{b,u}=make({elite,potential,others:['char_208_melan','char_124_kroos']});
 const a=ally(b,'char_208_melan',2,3),far=ally(b,'char_124_kroos',1,5);advance(b,.05);
 const t=u.def.talents.find(t=>t.bb.damage_resistance!=null).bb;near(u.s.atk,u.base.atk*(1+t.atk));
 const e=enemy(b),before=a.hp;b.dealDamage(e,a,{amount:a.s.def+100,type:'phys'});near(a.hp,before-100*(1-t.damage_resistance));
 b.dealDamage(e,a,{amount:100,type:'arts'});near(a.hp,before-100*(1-t.damage_resistance)-100);
 near(far.s.physTakenMul,1);near(u.s.physTakenMul,1-t.damage_resistance);
 b.retreatOperator(ID);near(a.s.physTakenMul,1);
});
test('first enemy receipt applies Tremble before dodge; separate targets and immunity remain independent',()=>{
 const{b,u}=make();const e=enemy(b);b.addBuff(e,{key:'dodge',mods:{artsDodge:1}});
 b.dealDamage(u,e,{amount:100,type:'arts'});assert.ok(e.s.flags.tremble);const mark=e.findBuff('tremble');
 advance(b,1);b.dealDamage(u,e,{amount:100,type:'arts'});assert.equal(e.findBuff('tremble'),mark);
 const f=enemy(b);f.def={...f.def,immune:immuneSet({disarmedCombatImmune:true})};
 b.dealDamage(u,f,{amount:100,type:'arts'});assert.equal(!!f.s.flags.tremble,false);
 f.def={...f.def,immune:immuneSet({})};b.dealDamage(u,f,{amount:100,type:'arts'});assert.ok(f.s.flags.tremble);
});
test('aura ignores ally-target-free recipients; S3 includes a neighbouring device blocker and respects the rank cap',()=>{
 const{b,u}=make({skill:2,others:['char_208_melan']});const a=ally(b,'char_208_melan',2,2);
 b.addBuff(a,{key:'target-free',flags:{untargetable:true}});advance(b,.05);near(u.s.atk,u.base.atk);near(a.s.physTakenMul,1);
 const device=b.spawnDevice('test:barrier',2,1,{blockCnt:10});cast(u);advance(b,.45);
 const es=Array.from({length:6},()=>enemy(b,{r:1,c:1}));es.forEach(e=>{e.blockedBy=device;device.blocking.push(e);});
 const chosen=acquireTargets(b,u,effectiveProfile(u));assert.equal(chosen.length,u.skill.bb['attack@max_target']);
 chosen.forEach(e=>assert.ok(es.includes(e)));
 b.kill(device);assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,0);
});
for(let rank=1;rank<=10;rank++)test(`S2 rank ${rank}: two other allies accelerate SP, permanent two-target extended-range Arts mode`,()=>{
 const{b,u,hits}=make({skill:1,rank,others:['char_208_melan','char_122_beagle']});
 u.skill.setSpTotal(0);near(u.s.spRecovery,1);ally(b,'char_208_melan',2,2);advance(b,.05);near(u.s.spRecovery,1);
 const a=ally(b,'char_122_beagle',2,3);advance(b,.05);near(u.s.spRecovery,1+u.skill.bb.sp_recovery_per_sec);
 b.retreat(a);advance(b,.05);near(u.s.spRecovery,1);cast(u);assert.ok(u.s.flags.disarm);advance(b,.55);
 assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Idle');const es=[enemy(b,{c:4}),enemy(b,{c:4}),enemy(b,{c:4}),enemy(b,{c:4,fly:true})];
 const chosen=acquireTargets(b,u,effectiveProfile(u));assert.equal(chosen.length,2);fire(b,u,chosen);advance(b,.55);
 assert.equal(hits.length,2);hits.forEach(h=>near(h.amount,u.s.atk));near(es[3].hp,100000);
 near(u.s.atk,u.base.atk*(1+u.skill.bb.atk+u.def.talents[0].bb.atk));advance(b,75);assert.equal(u.skill.active,true);
});
for(let rank=1;rank<=10;rank++)test(`S3 rank ${rank}: eight True-attacking non-slot summons, remote blocked-target union and timed cleanup`,()=>{
 const{b,u,hits}=make({skill:2,rank});const slots=b.deployedSlots();cast(u);advance(b,.45);
 const ts=tokens(b);assert.equal(ts.length,8);assert.equal(b.deployedSlots(),slots);ts.forEach(t=>{t.profile.noAttack=true;t.atkCd=1000;});
 const blocker=ts.find(t=>t.tileR===2&&t.tileC===1);const remote=enemy(b,{r:1,c:1}),ordinary=enemy(b),outside=enemy(b,{r:1,c:4}),air=enemy(b,{fly:true});
 remote.blockedBy=blocker;blocker.blocking.push(remote);const chosen=acquireTargets(b,u,effectiveProfile(u));
 assert.ok(chosen.includes(remote));assert.ok(chosen.includes(ordinary));assert.ok(!chosen.includes(outside));assert.ok(!chosen.includes(air));
 fire(b,u,chosen);advance(b,.45);assert.equal(hits.length,2);hits.forEach(h=>{assert.equal(h.dmg.type,'true');near(h.amount,u.s.atk);});
 near(u.s.interval,u.base.bat+u.skill.bb.base_attack_time);near(blocker.s.maxHp,4000);near(blocker.s.atk,500);
 assert.equal(b.heal(u,blocker,100),0);near(blocker.s.physTakenMul,1-u.def.talents[0].bb.damage_resistance);
 advance(b,25);assert.equal(u.skill.active,false);assert.equal(tokens(b).length,0);near(u.s.interval,u.base.bat);
});
test('S3 blocks occupied/high/undeployable/reserved tiles, supports natural token combat, and owner retreat cleans all summons',()=>{
 const{b,u,hits}=make({skill:2,others:['char_208_melan']});ally(b,'char_208_melan',2,1);
 b.grid.tile(2,2).height='HIGH';b.grid.tile(2,3).build='NONE';cast(u);advance(b,.45);
 assert.equal(tokens(b).length,5);const t=tokens(b)[0],e=enemy(b,{r:t.tileR,c:t.tileC});
 fire(b,t,[e]);advance(b,.55);assert.equal(hits.length,1);assert.equal(hits[0].source,t);assert.equal(hits[0].dmg.type,'true');
 b.retreatOperator(ID);assert.equal(tokens(b).length,0);advance(b,.1);assert.deepEqual(b.errors,[]);
});
for(const dir of['UP','LEFT','RIGHT','DOWN'])test(`${dir}: source clip hit timing is used for both activated modes`,()=>{
 for(const skill of[1,2]){const{b,u}=make({skill,dir});cast(u);advance(b,.55);const e=enemy(b,{c:2});
  fire(b,u,[e]);const m=evidence.models[ID][['UP','LEFT'].includes(dir)?'Back':'Front'];
  const clip=skill===2?'Skill_3_Loop':dir==='DOWN'?'Skill_Down_2_Loop':'Skill_2_Loop';near(u.profile.windup(b,u),m.hits[clip][0]);}
});
