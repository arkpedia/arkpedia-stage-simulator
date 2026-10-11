// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import evidence from '../data/arkpedia-chen-prefabs.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild} from '../shared/arkpedia/loadout.js';
import {acquireTargets,effectiveProfile} from '../server/sim/ai.js';
import {dirVec} from '../server/sim/dir.js';
const ID='char_010_chen',near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps,`${a} != ${z}`);
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function make({skill=0,rank=10,elite=2,potential=1,companions=[]}={}){
 const src=structuredClone(data),op=src.operators[ID];src.stage.geometry.waves[0].spawns=[];src.stage.battle.dp_per_second=0;
 const build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,potential,skillId:op.skills[skill].id,skillRank:Math.min(rank,elite===0?4:elite===1?7:10)};
 const extra=companions.map(id=>({...defaultBuild(src.operators[id]),elite:0,level:1,skillId:src.operators[id].skills[0].id,skillRank:1}));
 const b=new StandardBattle(src,{operators:[build,...extra]});b.autoFinish=false;b.setViewport('fullscreen-workspace');
 b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 const hits=[];b.on('damaged',ctx=>hits.push(ctx));
 const deploy=(id=ID,r=3,c=4,dir='RIGHT')=>{b.getPlayer('arkpedia').dp=90;const u=b.deployOperator(id,r,c,dir);assert.ok(u);u.atkCd=1000;u.skill.rule='NEVER';return u;};
 return{b,deploy,hits};
}
function enemy(b,{r=3,c=5,def=0,res=0,fly=false,hp=100000}={}){
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});Object.assign(e.base,{maxHp:hp,def,res,moveSpeed:0,massLevel:10});e.markDirty();void e.s;e.hp=hp;
 if(fly)e.motion='FLY';b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function cast(b,u){u.skill.setSpTotal(u.skill.spCost);assert.equal(b.activateOperator(ID),true);}
function shot(b,u,e,{skill=false}={}){
 if(skill){u.skill.setSpTotal(u.skill.spCost);u.skill.rule='DEFAULT';assert.equal(u.skill.activate('DEFAULT'),true);}
 assert.equal(b.forceAttack(u,[e]),true);u.atkCd=1000;u.skill.rule='NEVER';
}
const outputs=(hits,u)=>hits.filter(h=>h.source===u);

test('Ch’en retains all30 source ranks, both actual facing bytes and the eleven-event/ten-slash boundary',()=>{
 assert.equal(evidence.frameParity,false);assert.equal(evidence.moduleSupport,false);assert.equal(evidence.source.bundles.length,5);
 for(const s of data.operators[ID].skills)assert.deepEqual(s.levels,evidence.tables.skills[s.id].levels.map(l=>l.rangeId?{...l,rangeGrid:evidence.tables.ranges[l.rangeId].grids.map(p=>[p.row,p.col])}:l));
 for(const face of ['Front','Back']){
  const asset=data.sd.models[`operator/${ID}/default/${face.toLowerCase()}`].skeleton;
  const bytes=readFileSync(new URL('../../arkpedia-sd-assets/'+asset.path,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),evidence.officialSkeletonBindings[ID][face].sha256);
 }
 assert.equal(evidence.literalFrontEvents.hits.Skill_3.length,11);
 assert.ok(evidence.verificationLimits.some(x=>x.includes('first selected-times events')));
 assert.equal(evidence.templates.chen_t_1.eventToActions.ON_BUFF_TRIGGER[0]._spMask,'ATTACK_OR_DAMAGE');
});
test('Blade Art follows elite and potential, adds source ATK/DEF percentages and Physical-only dodge',()=>{
 for(const[elite,potential,mul,dodge]of [[0,1,1,0],[1,1,1,0],[2,1,1.05,.1],[2,5,1.06,.13]]){
  const{deploy}=make({elite,potential}),u=deploy();near(u.s.atk,u.base.atk*mul);near(u.s.def,u.base.def*mul);near(u.s.dodgePhys,dodge);near(u.s.dodgeArts,0);
 }
 const{b,deploy}=make(),u=deploy(),e=enemy(b);b.rng=()=>0;
 b.dealDamage(e,u,{amount:500,type:'phys',isAttack:true});near(u.hp,u.s.maxHp);
 b.dealDamage(e,u,{amount:500,type:'arts',isAttack:true});near(u.hp,u.s.maxHp-500);
});
test('Scolding selected E1/E2 timers include Ch’en and only attack/hurt recovery allies',()=>{
 for(const[elite,interval]of [[0,0],[1,5],[2,4]]){
  const{b,deploy}=make({elite,companions:['char_103_angel','char_107_liskam','char_141_nights']}),u=deploy(),atk=deploy('char_103_angel',3,2),hurt=deploy('char_107_liskam',2,3),time=deploy('char_141_nights',1,2);
  assert.equal(atk.skill.spType,'attack');assert.equal(hurt.skill.spType,'hurt');assert.equal(time.skill.spType,'time');
  for(const a of [u,atk,hurt,time])a.skill.setSpTotal(0);
  if(!interval){advance(b,8);near(u.skill.spTotal,0);near(atk.skill.spTotal,0);near(hurt.skill.spTotal,0);continue;}
  advance(b,interval-.1);near(u.skill.spTotal,0);near(atk.skill.spTotal,0);near(hurt.skill.spTotal,0);
  advance(b,.2);near(u.skill.spTotal,1);near(atk.skill.spTotal,1);near(hurt.skill.spTotal,1);near(time.skill.spTotal,interval+.1);
 }
});
test('Scolding late recipients own their timers, missed no-SP pulses are discarded and source retreat removes gifts',()=>{
 const{b,deploy}=make({companions:['char_103_angel','char_107_liskam']}),u=deploy();u.skill.setSpTotal(0);advance(b,2);
 const a=deploy('char_103_angel',3,2);a.skill.setSpTotal(0);advance(b,2.1);near(u.skill.spTotal,1);near(a.skill.spTotal,0);
 b.addBuff(a,{key:'test:no-sp',flags:{noSp:true}});advance(b,2);near(a.skill.spTotal,0);b.removeBuff(a,'test:no-sp');advance(b,3.8);near(a.skill.spTotal,0);advance(b,.2);near(a.skill.spTotal,1);
 b.retreatOperator(ID);assert.equal(a.buffs.some(x=>x.key.startsWith('chen:scolding:')),false);advance(b,10);near(a.skill.spTotal,1);
});
test('normal sword attacks release exactly two separately mitigated hits to one original ground victim and one SP',()=>{
 const{b,deploy,hits}=make({elite:0}),u=deploy(),e=enemy(b,{def:100}),other=enemy(b,{c:5.1}),air=enemy(b,{fly:true,c:4.5});
 assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[e]);shot(b,u,e);advance(b,1);assert.equal(outputs(hits,u).length,0);
 advance(b,.1);assert.equal(outputs(hits,u).length,1);near(u.skill.spTotal,1);advance(b,.6);assert.equal(outputs(hits,u).length,2);
 for(const h of outputs(hits,u)){assert.equal(h.target,e);near(h.hpLoss,u.s.atk-100);}
 near(other.hp,100000);near(air.hp,100000);near(u.skill.spTotal,1);near(effectiveProfile(u).windup(b,u,[e]),.433);
});
test('normal second slash never retargets after victim death and cancels on brief control or source retirement',()=>{
 for(const reason of ['target-death','control','retreat','skill-switch']){
  const{b,deploy,hits}=make({skill:1}),u=deploy(),e=enemy(b),other=enemy(b,{c:5.1});shot(b,u,e);advance(b,1.1);
  if(reason==='target-death')b.kill(e,u);else if(reason==='control')b.applyStatus(u,'stun',{duration:.01});else if(reason==='retreat')b.retreatOperator(ID);else cast(b,u);
  advance(b,.6);assert.equal(outputs(hits,u).filter(h=>!h.dmg.isSkill).length,1);
  if(reason!=='skill-switch')near(other.hp,100000);
 }
});
test('normal opening resets on lost targets; UP uses Back while S2/S3 force their actual Front clips',()=>{
 for(const dir of ['UP','RIGHT','DOWN','LEFT']){
  const{b,deploy}=make(),u=deploy(ID,3,4,dir),[dr,dc]=dirVec(dir),e=enemy(b,{r:3+dr,c:4+dc});
  b.addBuff(u,{key:'test:aspd',mods:{aspd:200}});near(effectiveProfile(u).windup(b,u,[e]),1.033/3);shot(b,u,e);advance(b,.6);
  near(effectiveProfile(u).windup(b,u,[e]),.433/3);e.hidden=true;advance(b,.1);e.hidden=false;near(effectiveProfile(u).windup(b,u,[e]),1.033/3);
 }
});
test('S1 all10 ranks replace both normal strikes with one selected Physical strike and Stun',()=>{
 for(let rank=1;rank<=10;rank++){
  const{b,deploy,hits}=make({rank}),u=deploy(),e=enemy(b,{def:100});shot(b,u,e,{skill:true});
  advance(b,.43);assert.equal(outputs(hits,u).length,0);advance(b,.1);assert.equal(outputs(hits,u).length,1);
  near(outputs(hits,u)[0].hpLoss,u.s.atk*u.def.skill.bb.atk_scale-100);assert.equal(e.s.flags.stun,true);near(u.skill.spTotal,0);
  assert.ok(u.mem.chenCast);advance(b,1.1);assert.equal(u.mem.chenCast,null);assert.equal(outputs(hits,u).length,1);assert.equal(u.findBuff('chen:cast'),null);
 }
});
test('S1 release-time target selection refunds a wholly dead input only if no strike can be emitted',()=>{
 for(const substitute of [false,true]){
  const{b,deploy,hits}=make(),u=deploy(),e=enemy(b),other=substitute?enemy(b,{c:5.1}):null;
  shot(b,u,e,{skill:true});advance(b,.2);b.kill(e,null);advance(b,.4);
  assert.equal(outputs(hits,u).length,substitute?1:0);near(u.skill.spTotal,substitute?0:u.skill.spCost);
  if(substitute)assert.equal(outputs(hits,u)[0].target,other);else assert.equal(u.mem.chenCast,null);
 }
 const{b,deploy,hits}=make(),u=deploy(),e=enemy(b,{hp:1});shot(b,u,e,{skill:true});advance(b,.6);assert.equal(e.alive,false);near(u.skill.spTotal,0);assert.equal(outputs(hits,u).length,1);
});
test('S1 accepted brief control cancels before release without SP refund or a stranded cast lock',()=>{
 const{b,deploy,hits}=make(),u=deploy(),e=enemy(b);shot(b,u,e,{skill:true});advance(b,.2);b.applyStatus(u,'stun',{duration:.01});advance(b,2);
 assert.equal(outputs(hits,u).length,0);near(u.skill.spTotal,0);assert.equal(u.mem.chenCast,null);assert.equal(u.findBuff('chen:cast'),null);assert.equal(u.skill.active,false);
});
test('S2 all10 ranks independently mitigate Arts and Physical, cap targets, hit air and preserve empty casts',()=>{
 for(let rank=1;rank<=10;rank++){
  const{b,deploy,hits}=make({skill:1,rank}),u=deploy(),bb=u.def.skill.bb;
  const victims=Array.from({length:bb.max_target+2},(_,i)=>enemy(b,{r:3,c:5+i*.02,def:100,res:30,fly:i===0}));
  cast(b,u);advance(b,.43);assert.equal(outputs(hits,u).length,0);advance(b,.1);assert.equal(outputs(hits,u).length,bb.max_target*2);
  const struck=[...new Set(outputs(hits,u).map(h=>h.target))];assert.equal(struck.length,bb.max_target);assert.ok(struck.includes(victims[0]));
  for(const e of struck){const out=outputs(hits,u).filter(h=>h.target===e);assert.deepEqual(out.map(h=>h.type),['arts','phys']);near(out[0].hpLoss,u.s.atk*bb.atk_scale*.7);near(out[1].hpLoss,u.s.atk*bb.atk_scale-100);}
  near(u.skill.spTotal,0);advance(b,1.3);assert.equal(u.skill.active,false);assert.equal(u.mem.regularAttackFacing,null);
 }
 const{b,deploy,hits}=make({skill:1}),u=deploy();cast(b,u);advance(b,2);near(u.skill.spTotal,0);assert.equal(outputs(hits,u).length,0);assert.equal(u.mem.chenCast,null);
});
test('S2 release-time range/cap rotates with deployment direction and excludes stealth/outside bodies',()=>{
 for(const dir of ['UP','RIGHT','DOWN','LEFT']){
  const{b,deploy,hits}=make({skill:1}),u=deploy(ID,3,4,dir),[dr,dc]=dirVec(dir),e=enemy(b,{r:3+dr,c:4+dc}),outside=enemy(b,{r:3-dr*2,c:4-dc*2});
  const hidden=enemy(b,{r:3+dr,c:4+dc});b.addBuff(hidden,{key:'test:camou',flags:{stealth:true}});
  cast(b,u);assert.equal(u.mem.regularAttackFacing,'Front');assert.equal(u.mem.regularFormVisual.clip,'Skill_2');advance(b,2);
  assert.equal(outputs(hits,u).length,2);assert.equal(outputs(hits,u)[0].target,e);near(outside.hp,100000);near(hidden.hp,100000);
 }
});
test('S2 and S1 are uncapped while S3 retains its original max-animation-scale1 clock',()=>{
 for(const[skill,hit]of [[0,.467/3],[1,.467/3],[2,.6]]){
  const{b,deploy,hits}=make({skill}),u=deploy(),e=enemy(b);b.addBuff(u,{key:'test:aspd',mods:{aspd:200}});
  if(skill===0)shot(b,u,e,{skill:true});else cast(b,u);
  advance(b,hit-.06);assert.equal(outputs(hits,u).length,0);advance(b,.1);assert.ok(outputs(hits,u).length>0);
 }
});
test('S3 all10 ranks release exactly ten selected slashes and apply selected Stun only to the final victim',()=>{
 for(let rank=1;rank<=10;rank++){
  const{b,deploy,hits}=make({skill:2,rank}),u=deploy(),e=enemy(b),bb=u.def.skill.bb;
  cast(b,u);advance(b,.55);assert.equal(outputs(hits,u).length,0);advance(b,.1);assert.equal(outputs(hits,u).length,1);assert.equal(!!e.s.flags.stun,false);
  advance(b,2.1);assert.equal(outputs(hits,u).length,9);assert.equal(!!e.s.flags.stun,false);advance(b,.2);assert.equal(outputs(hits,u).length,10);assert.equal(e.s.flags.stun,true);
  for(const h of outputs(hits,u))near(h.hpLoss,u.s.atk*bb.atk_scale);
  advance(b,.5);assert.equal(outputs(hits,u).length,10);assert.equal(u.skill.active,false);near(u.skill.spTotal,0);
 }
});
test('S3 requires a legal ground target without spending ready SP, keeps its victim and substitutes nearest after loss',()=>{
 const{b,deploy,hits}=make({skill:2}),u=deploy(),air=enemy(b,{fly:true});u.skill.setSpTotal(u.skill.spCost);
 assert.equal(b.activateOperator(ID),false);near(u.skill.spTotal,u.skill.spCost);assert.equal(u.skill.ready,true);
 const a=enemy(b,{c:5}),z=enemy(b,{c:5.8});assert.equal(b.activateOperator(ID),true);advance(b,.65);assert.equal(outputs(hits,u)[0].target,a);
 const closer=enemy(b,{c:4.4});advance(b,.2);assert.equal(outputs(hits,u)[1].target,a);b.kill(a,null);advance(b,.2);assert.equal(outputs(hits,u)[2].target,closer);
 b.kill(closer,null);b.kill(z,null);advance(b,.3);assert.equal(u.skill.active,false);assert.equal(u.mem.chenCast,null);near(air.hp,100000);assert.equal(outputs(hits,u).length,3);
});
test('S3 cast is invulnerable and non-blocking, rejects Stun/Freeze, allows other control and restores its state',()=>{
 const{b,deploy}=make({skill:2}),u=deploy(),e=enemy(b);b.rng=()=>.99;const hp=u.hp;cast(b,u);
 assert.equal(u.s.flags.invulnerable,true);assert.equal(u.s.flags.noBlock,true);
 for(const type of ['phys','arts','true'])b.dealDamage(e,u,{amount:1000,type,isAttack:true});near(u.hp,hp);
 b.applyStatus(u,'stun',{duration:2});b.applyStatus(u,'freeze',{duration:2});assert.equal(!!u.s.flags.stun,false);assert.equal(!!u.s.flags.freeze,false);advance(b,3.3);
 assert.equal(!!u.s.flags.invulnerable,false);assert.equal(!!u.s.flags.noBlock,false);assert.equal(u.s.blockCnt,2);assert.equal(u.mem.regularAttackFacing,null);
 b.dealDamage(e,u,{amount:100,type:'arts',isAttack:true});near(u.hp,hp-100);
 for(const status of ['sleep','levitate']){cast(b,u);b.applyStatus(u,status,{duration:.01});advance(b,.1);assert.equal(u.skill.active,false);assert.equal(u.mem.chenCast,null);assert.equal(!!u.s.flags.invulnerable,false);}
});
test('retirement cancels every unborn S1/S2/S3 output and fresh deployment has no stale visual or protection',()=>{
 for(const skill of [0,1,2])for(const reason of ['death','retreat']){
  const{b,deploy,hits}=make({skill}),u=deploy(),e=enemy(b);if(skill===0)shot(b,u,e,{skill:true});else cast(b,u);advance(b,.2);
  if(reason==='death')b.kill(u,null);else b.retreatOperator(ID);advance(b,4);
  assert.equal(outputs(hits,u).length,0);assert.equal(u.mem.chenCast,null);assert.equal(u.mem.regularFormVisual,null);assert.equal(u.mem.regularAttackFacing,null);
  b.bench[ID].readyAt=b.time;const z=deploy();assert.notEqual(z,u);assert.equal(z.skill.activations,0);assert.equal(!!z.s.flags.invulnerable,false);assert.equal(!!z.s.flags.disarm,false);
 }
});

test('natural S1 ready activation happens through the ordinary AI and leaves one strike, not a double attack',()=>{
 const{b,deploy,hits}=make(),u=deploy(),e=enemy(b);u.skill.setSpTotal(u.skill.spCost);u.skill.rule='DEFAULT';u.atkCd=0;
 b.step();u.atkCd=1000;assert.equal(u.skill.activations,1);assert.equal(u.mem.chenCast.n,1);advance(b,1.8);
 assert.equal(outputs(hits,u).length,1);near(100000-e.hp,u.s.atk*u.def.skill.bb.atk_scale);assert.equal(u.mem.chenCast,null);
});
test('S3 releases actual blocked enemies and never accepts new blocks until its protection ends',()=>{
 const{b,deploy}=make({skill:2}),u=deploy(),e=enemy(b,{c:4.5});advance(b,.1);assert.equal(e.blockedBy,u);cast(b,u);advance(b,.1);
 assert.equal(e.blockedBy,null);assert.equal(u.blocking.length,0);advance(b,3.3);const fresh=enemy(b,{c:4.5});advance(b,.1);assert.equal(fresh.blockedBy,u);
});
test('manual cast control cancels unborn S2 damage, while S3 transient nonimmune control cancels the remaining slashes',()=>{
 const second=make({skill:1}),a=second.deploy();enemy(second.b);cast(second.b,a);advance(second.b,.2);second.b.applyStatus(a,'stun',{duration:.001});advance(second.b,2);
 assert.equal(outputs(second.hits,a).length,0);near(a.skill.spTotal,0);assert.equal(a.mem.chenCast,null);
 const third=make({skill:2}),z=third.deploy();enemy(third.b);cast(third.b,z);advance(third.b,.7);assert.equal(outputs(third.hits,z).length,1);
 third.b.applyStatus(z,'sleep',{duration:.001});advance(third.b,3);assert.equal(outputs(third.hits,z).length,1);assert.equal(z.mem.chenCast,null);assert.equal(!!z.s.flags.noBlock,false);
});
test('Scolding does not refill an active S3, accepted cast Stun does not emit or change the shared epoch',()=>{
 const{b,deploy}=make({skill:2}),u=deploy();enemy(b);b.addBuff(u,{key:'test:slow',mods:{aspd:-50}});cast(b,u);const epoch=u.attackControlEpoch;
 b.applyStatus(u,'stun',{duration:.001});assert.equal(u.attackControlEpoch,epoch);advance(b,4.1);assert.equal(u.skill.active,true);near(u.skill.spTotal,0);
 advance(b,2.5);assert.equal(u.skill.active,false);near(u.skill.spTotal,0);advance(b,1.5);near(u.skill.spTotal,1);
});
