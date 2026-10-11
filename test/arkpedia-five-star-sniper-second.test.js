// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-five-star-sniper-second-prefabs.json' with { type: 'json' };
import { FIVE_STAR_SNIPER_SECOND_OPERATORS } from '../shared/arkpedia/five-star-sniper-second-operators.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
import { canTargetAlly } from '../server/sim/targeting.js';
const G='char_367_swllow',A='char_365_aprl',K='char_1021_kroos2',I='char_498_inside',S='char_379_sesa';
const near=(a,e)=>assert.ok(Math.abs(a-e)<1e-5,`${a} != ${e}`);
function make(ids,overrides={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const b=new StandardBattle(d,{operators:ids.map(id=>({...defaultBuild(d.operators[id]),...overrides[id]}))});
 b.autoFinish=false;b.setViewport('fullscreen-workspace');return b;
}
function deploy(b,id,r=1,c=7){b.getPlayer('arkpedia').dp=99;const u=b.deployOperator(id,r,c,'UP');assert.ok(u);u.atkCd=1000;return u;}
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function enemy(b,x=7,y=2,hp=100000){const e=b.spawnEnemy('enemy_1007_slime',{routeIndex:1});e.x=x;e.y=y;
 e.base.maxHp=hp;e.base.def=e.base.res=e.base.moveSpeed=0;e.markDirty();void e.s;e.hp=hp;
 b.addBuff(e,{key:'pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;}
function cast(u){u.skill.gainSp(u.skill.spCost,'test');assert.equal(u.skill.activate('test'),true);}
function attack(b,u,e,s=1){const hp=e.hp;b.forceAttack(u,[e]);advance(b,s);return hp-e.hp;}

test('second sniper group is bound to original prefab hashes, full Spine events and every selected rank',()=>{
 assert.equal(evidence.reviewedMechanics.frameFidelityValidated,false);
 assert.equal(evidence.models[G].Front.hits.Skill_2_Loop.length,3);
 assert.equal(evidence.templates['inside_t_1'].eventToActions.ON_BUFF_FINISH[0]._recoverEventCount,false);
 for(const[id,cfg]of Object.entries(FIVE_STAR_SNIPER_SECOND_OPERATORS)){
  assert.match(evidence.sourceBundles.find(s=>s.path===`charpack/${id}.ab`).sha256,/^[a-f0-9]{64}$/);
  for(const skillId of cfg.skillIds)for(let skillRank=1;skillRank<=10;skillRank++){
   const b=make([id],{[id]:{skillId,skillRank}}),u=deploy(b,id);assert.equal(u.skill.noSkill,false);assert.equal(u.skill.id,skillId);
  }
 }
});
test('GreyThroat talent supplies ASPD by promotion and rolls independently per physical damage instance',()=>{
 const b=make([G]),u=deploy(b,G),e=enemy(b);near(u.s.aspd,106);let n=0;b.rng.chance=()=>++n===2;
 cast(u);near(attack(b,u,e,.5),u.s.atk*1.4*2.5);assert.equal(n,2);
 const c=make([G],{[G]:{elite:1,level:70,potential:1,skillRank:7}}),v=deploy(c,G);near(v.def.talents[0].bb.prob,0);near(v.s.aspd,106);
});
test('GreyThroat S1 preserves stock and fires the second source event after its first projectile despite instant skill ending',()=>{
 const b=make([G]),u=deploy(b,G),e=enemy(b);b.rng.chance=()=>false;u.skill.gainSp(12,'test');assert.equal(u.skill.charges,3);
 cast(u);assert.equal(u.skill.charges,2);b.forceAttack(u,[e]);advance(b,.15);near(100000-e.hp,u.s.atk*1.4);
 advance(b,.2);near(100000-e.hp,u.s.atk*2.8);assert.equal(u.skill.active,false);
});
test('GreyThroat S2 emits exactly three spaced original shots; cap1 is retained with bonus ASPD',()=>{
 const b=make([G],{[G]:{skillId:'skchr_swllow_2'}}),u=deploy(b,G),e=enemy(b);b.rng.chance=()=>false;cast(u);advance(b,.2);
 b.addBuff(u,{key:'fast',mods:{aspd:100}});near(effectiveProfile(u).windup(b,u),.067);
 const atk=u.s.atk;b.forceAttack(u,[e]);advance(b,.2);near(100000-e.hp,atk);advance(b,.4);near(100000-e.hp,atk*3);
});
test('unfired GreyThroat burst cancels after brief control or withdrawal while the launched round remains valid',()=>{
 for(const retreat of[false,true]){
  const b=make([G]),u=deploy(b,G),e=enemy(b);b.rng.chance=()=>false;cast(u);b.forceAttack(u,[e]);advance(b,.1);
  if(retreat)b.retreatOperator(G);else b.applyStatus(u,'stun',{duration:.05});advance(b,.3);near(100000-e.hp,u.s.atk*1.4);
 }
});
test('GreyThroat second round cannot resume when control expires within a single tick',()=>{
 const b=make([G]),u=deploy(b,G),e=enemy(b);b.rng.chance=()=>false;cast(u);
 b.forceAttack(u,[e]);advance(b,.1);b.applyStatus(u,'stun',{duration:.001});
 advance(b,.3);assert.equal(u.canAct,true);near(100000-e.hp,u.s.atk*1.4);
});
test('April source E2 redeployment/cost talent is applied once and S1 single-shot scale survives impact delay',()=>{
 const b=make([A]),u=deploy(b,A),e=enemy(b);near(u.base.respawnTime,50);near(u.base.cost,data.operators[A].phases[2].attributesKeyFrames.at(-1).data.cost-1);
 cast(u);near(attack(b,u,e,.9),u.s.atk*2.3);assert.equal(u.skill.active,false);
});
test('April deploy camouflage and ATK buff expire once at26s, never auto-recast, and reset on redeployment',()=>{
 const b=make([A],{[A]:{skillId:'skchr_aprl_2'}}),u=deploy(b,A),e=enemy(b);
 assert.equal(u.skill.active,true);assert.equal(u.s.flags.camou,true);near(u.s.atk,u.base.atk*2);
 assert.equal(canTargetAlly(e,u,true),false);advance(b,26.1);assert.equal(u.skill.active,false);assert.ok(!u.s.flags.camou);near(u.s.atk,u.base.atk);
 advance(b,20);assert.equal(u.skill.activations,1);b.retreatOperator(A);advance(b,51);const v=deploy(b,A);assert.equal(v.skill.active,true);
});
test('Kroos alter per-hit crit stuns even when the physical shot is dodged; control duration stays source.2',()=>{
 const b=make([K]),u=deploy(b,K),e=enemy(b);b.rng.chance=()=>true;b.addBuff(e,{key:'dodge',mods:{dodgePhys:1}});
 b.forceAttack(u,[e]);advance(b,.5);near(e.hp,100000);assert.equal(e.s.flags.stun,true);advance(b,.23);assert.ok(!e.s.flags.stun);
});
test('Kroos S1 camouflage uses two original shots with per-hit crit and source entrance/end forms',()=>{
 const b=make([K],{[K]:{skillId:'skchr_kroos2_1'}}),u=deploy(b,K),e=enemy(b);b.rng.chance=()=>false;cast(u);
 assert.equal(u.mem.regularFormVisual.clip,'Skill_Begin');assert.equal(u.s.flags.camou,true);advance(b,.34);
 near(attack(b,u,e,.3),u.s.atk*2);advance(b,15);assert.ok(!u.s.flags.camou);assert.equal(u.skill.active,false);
});
test('Kroos S2 warming counts damage instances, changes from2 to4 hits exactly atM3threshold and resets',()=>{
 const b=make([K],{[K]:{skillId:'skchr_kroos2_2'}}),u=deploy(b,K),e=enemy(b);b.rng.chance=()=>false;cast(u);advance(b,.34);
 near(u.s.bat,u.base.bat*.625);for(let n=0;n<16;n++)attack(b,u,e,.3);
 assert.equal(u.mem.kroosHits,32);assert.equal(u.mem.kroosWarmed,true);assert.equal(effectiveProfile(u).attackVisual(b,u),'Skill_Loop_2');
 near(attack(b,u,e,.4),u.s.atk*4);u.skill.end('test');assert.equal(u.mem.kroosHits,0);assert.equal(u.mem.kroosWarmed,false);
});
test('Kroos warming sees dodge outcomes at source calculation event without inventing landed damage',()=>{
 const b=make([K],{[K]:{skillId:'skchr_kroos2_2'}}),u=deploy(b,K),e=enemy(b);b.rng.chance=()=>true;b.addBuff(e,{key:'dodge',mods:{dodgePhys:1}});cast(u);advance(b,.34);
 attack(b,u,e,.3);near(e.hp,100000);assert.equal(u.mem.kroosHits,2);
});
test('Insider S2 has source ATK/BAT/taunt and ranged target priority, rather than aerial priority',()=>{
 const b=make([I],{[I]:{skillId:'skchr_inside_2'}}),u=deploy(b,I),ground=enemy(b),ranged=enemy(b,7.3,2);
 ranged.base.rangeRadius=2;ranged.def={...ranged.def,applyWay:'RANGED'};cast(u);advance(b,.7);
 near(u.s.atk,u.base.atk*2.3);near(u.s.bat,u.base.bat*.7);near(u.s.taunt,u.base.tauntLevel-1);
 assert.equal(acquireTargets(b,u,effectiveProfile(u))[0],ranged);assert.equal(u.skill.ammoLeft,14);assert.equal(u.skill.spec.manualCancel,true);
});
test('Insider delayed talent modifies capacity without refilling an active cast and later activations use larger stock',()=>{
 const b=make([I]),u=deploy(b,I),e=enemy(b);cast(u);advance(b,.7);attack(b,u,e,.6);assert.equal(u.skill.ammoLeft,3);
 advance(b,19);assert.equal(u.skill.ammo,7);assert.equal(u.skill.ammoLeft,3);assert.equal(u.skill.ammoMax,7);
 u.skill.end('manual');advance(b,.4);cast(u);assert.equal(u.skill.ammoLeft,7);
});
test('Insider final projectile retains skill damage, then source ending locks attacks/SP and safely resets',()=>{
 const b=make([I],{[I]:{skillId:'skchr_inside_2'}}),u=deploy(b,I),e=enemy(b);cast(u);advance(b,.7);u.skill.ammoLeft=1;
 const atk=u.s.atk;b.forceAttack(u,[e]);advance(b,.44);assert.equal(u.skill.active,true);assert.equal(u.skill.ammoLeft,0);near(e.hp,100000);
 advance(b,.1);near(100000-e.hp,atk);assert.equal(u.skill.active,true);advance(b,.55);assert.equal(u.skill.active,false);
 assert.equal(u.s.flags.noSp,true);const sp=u.skill.spTotal;advance(b,.3);near(u.skill.spTotal,sp);advance(b,.4);assert.ok(u.skill.spTotal>sp);
});
test('Insider manually discards current ammo; retirement cancels entrance and pending rounds',()=>{
 const b=make([I]),u=deploy(b,I),e=enemy(b);cast(u);advance(b,.7);u.skill.end('manual');assert.equal(u.skill.ammoLeft,0);assert.equal(u.skill.active,false);
 advance(b,.4);cast(u);b.forceAttack(u,[e]);b.retreatOperator(I);advance(b,1);near(e.hp,100000);
});
test('Sesa physical vulnerability applies only to blocked enemies, keeps stronger owned status, and clears on retreat',()=>{
 const b=make([S]),u=deploy(b,S),e=enemy(b);b.applyStatus(e,'physFragile',{key:'other',value:.3,duration:20});e.blockedBy=u;advance(b,.04);
 near(e.s.physTakenMul,1.3);b.removeBuff(e,'other');near(e.s.physTakenMul,1.14);near(e.s.artsTakenMul,1);
 e.blockedBy=null;advance(b,.04);near(e.s.physTakenMul,1);e.blockedBy=u;advance(b,.04);b.retreatOperator(S);near(e.s.physTakenMul,1);
});
test('Sesa S1 uses normal attack art, source radius1 and ATK without applying the S2 debuff',()=>{
 const b=make([S]),u=deploy(b,S),e=enemy(b),other=enemy(b,7.9,2),far=enemy(b,8.2,2);cast(u);
 assert.equal(effectiveProfile(u).attackVisual(b,u),'Attack');near(attack(b,u,e,1),u.s.atk);near(100000-other.hp,u.s.atk);near(far.hp,100000);near(e.s.aspd,100);
});
test('Sesa delayed grenade waits two seconds after arrival, explodes at fixed launch point and applies ASPD before damage',()=>{
 const b=make([S],{[S]:{skillId:'skchr_sesa_2'}}),u=deploy(b,S),e=enemy(b),other=enemy(b,7.5,2);cast(u);b.forceAttack(u,[e]);advance(b,1.8);
 near(e.hp,100000);e.x=9;b._buildEnemyIndex();advance(b,1.8);near(other.hp,100000);advance(b,.2);
 near(e.hp,100000);near(100000-other.hp,u.s.atk*2.4);near(other.s.aspd,80);advance(b,3.1);near(other.s.aspd,100);
});
test('a fired Sesa shell survives withdrawal and primary death and does not damage immune untargetable units',()=>{
 const b=make([S],{[S]:{skillId:'skchr_sesa_2'}}),u=deploy(b,S),e=enemy(b),other=enemy(b,7.5,2),hidden=enemy(b,7.3,2);
 cast(u);b.forceAttack(u,[e]);advance(b,1.8);b.addBuff(hidden,{key:'hidden',flags:{untargetable:true}});b.kill(e);b.retreatOperator(S);advance(b,2.1);
 assert.ok(other.hp<100000);near(hidden.hp,100000);
});

test('April far-target impact uses original10 speed and .667 event; no early damage at the incorrect15 speed',()=>{
 const b=make([A]),u=deploy(b,A),e=enemy(b,7,4);cast(u);b.forceAttack(u,[e]);advance(b,.94);
 near(e.hp,100000);advance(b,.12);near(100000-e.hp,u.s.atk*2.3);
 for(const skillId of FIVE_STAR_SNIPER_SECOND_OPERATORS[A].skillIds){
  const c=make([A],{[A]:{skillId}}),v=deploy(c,A);near(effectiveProfile(v).projectileSpeed,10);
 }
});
test('Insider percentage BAT and Kroos flat seconds retain distinct source buckets with another percent buff',()=>{
 for(const[id,skillId]of[[I,'skchr_inside_2'],[K,'skchr_kroos2_2']]){
  const b=make([id],{[id]:{skillId}}),u=deploy(b,id);b.addBuff(u,{key:'percent-bat',mods:{batPct:.2}});cast(u);
  near(u.s.bat,u.base.bat*(id===I?.9:1.2*.625));
 }
});
test('Insider infinite max1 wrapper grants only eligible Laterano ammo recipients, including late deployments, and restores capacity',()=>{
 const later='char_129_bluep',other='char_204_platnm';const b=make([I,later,other]),u=deploy(b,I);advance(b,20.1);
 // Existing supported operators are synthetic selector fixtures, not extra kits.
 const ally=deploy(b,later,3,2),wrong=deploy(b,other,1,3);
 ally.tags.add('laterano');ally.skill.kind='ammo';ally.skill.ammo=4;wrong.skill.kind='ammo';wrong.skill.ammo=4;
 advance(b,.04);assert.equal(ally.skill.ammo,5);assert.equal(wrong.skill.ammo,4);
 b.addBuff(ally,{key:'hide',flags:{untargetable:true}});advance(b,.04);assert.equal(ally.skill.ammo,4);
 b.removeBuff(ally,'hide');advance(b,.04);assert.equal(ally.skill.ammo,5);
 ally.skill.active=true;ally.skill.timeLeft=Infinity;ally.skill.ammoLeft=2;ally.skill.ammoMax=5;
 b.addBuff(ally,{key:'hide',flags:{untargetable:true}});advance(b,.04);assert.equal(ally.skill.ammo,4);assert.equal(ally.skill.ammoLeft,2);assert.equal(ally.skill.ammoMax,4);
 b.removeBuff(ally,'hide');advance(b,.04);assert.equal(ally.skill.ammo,5);assert.equal(ally.skill.ammoLeft,2);
 b.addBuff(ally,{key:'isolate',flags:{isolated:true}});advance(b,.04);assert.equal(ally.skill.ammo,4);
 b.removeBuff(ally,'isolate');advance(b,.04);assert.equal(ally.skill.ammo,5);
 b.retreatOperator(I);assert.equal(ally.skill.ammo,4);
});

test('Insider automatic S1 permits explicit manual discard through the actual player command and HUD',()=>{
 const b=make([I]),u=deploy(b,I);cast(u);advance(b,.7);
 assert.equal(u.skill.manual,false);assert.equal(skillHud(u.skill).canCancel,true);
 b.applyStatus(u,'stun',{duration:.1});assert.equal(b.activateOperator(I),false);advance(b,.2);
 assert.equal(b.activateOperator(I),true);assert.equal(u.skill.active,false);assert.equal(u.skill.ammoLeft,0);
});

test('Sesa source incoming CheckBlocked sees same-frame block/unblock before mitigation without a tick',()=>{
 const b=make([S]),u=deploy(b,S),e=enemy(b);e.blockedBy=u;
 near(b.dealDamage(u,e,{amount:100,type:'phys'}),114);
 e.blockedBy=null;near(b.dealDamage(u,e,{amount:100,type:'phys'}),100);
 e.blockedBy=u;near(b.dealDamage(u,e,{amount:100,type:'arts'}),100);
 b.applyStatus(e,'physFragile',{key:'stronger',value:.3,duration:20});near(b.dealDamage(u,e,{amount:100,type:'phys'}),130);
 b.retreatOperator(S);b.removeBuff(e,'stronger');near(b.dealDamage(null,e,{amount:100,type:'phys'}),100);
});

test('Insider S1 source ending uses the actual facing .233Front versus .333Back and then resumes SP',()=>{
 for(const[dir,duration]of[['DOWN',.233],['UP',.333]]){
  const b=make([I]),u=deploy(b,I);u.dir=dir;cast(u);advance(b,.7);u.skill.end('manual');
  near(u.findBuff('sniper:ending').duration,duration);advance(b,duration-.04);assert.equal(u.s.flags.noSp,true);
  advance(b,.1);assert.ok(!u.s.flags.noSp);
 }
});
