// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-caster-third-prefabs.json' with { type: 'json' };
import { CASTER_THIRD_OPERATORS } from '../shared/arkpedia/caster-third-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
const DUSK='char_2015_dusk',LOGOS='char_4133_logos',TOKEN='token_10015_dusk_drgn';
const near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps,`${a} != ${z}`);
const component=(rows,id)=>rows.flatMap(r=>r.components).find(c=>c.pathId===id);
function advance(b,s){for(let i=0;i<Math.round(s/b.dt);i++)b.step();assert.deepEqual(b.errors,[]);}
function make(id,{skill=0,elite=2,rank=10,potential=1,dir='UP'}={}){
 const src=structuredClone(data),op=src.operators[id];assert.ok(op,`Snapshot must enable ${id}`);
 src.stage.geometry.waves[0].spawns=[];src.stage.battle.dp_per_second=0;
 const build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,potential,skillRank:elite===2?rank:Math.min(rank,7),skillId:op.skills[skill].id};
 const b=new StandardBattle(src,{operators:[build]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);
 const u=b.deployOperator(id,2,4,dir);assert.ok(u);u.atkCd=1000;b.rng.chance=()=>false;return{b,u};
}
function enemy(b,{row=3,col=4,hp=100000,res=0,fly=false}={}){
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:100000,def:0,res});e.markDirty();void e.s;e.hp=hp;
 if(fly)e.motion='FLY';b.addBuff(e,{key:'test:pin',persist:true,flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function cast(b,u){u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.manual?b.activateOperator(u.defId):u.skill.activate('DEFAULT'),true);u.atkCd=1000;}
function shot(b,u,e,s=1.4){const hp=e.hp;b.forceAttack(u,[e]);u.atkCd=1000;advance(b,s);return hp-e.hp;}
const token=b=>b.allyUnits.find(t=>t.defId===TOKEN&&t.alive);

test('third caster evidence keeps exact original timing, models, summon and native boundaries',()=>{
 assert.equal(evidence.frameParity,false);assert.equal(evidence.moduleSupport,false);
 for(const[id,c]of Object.entries(CASTER_THIRD_OPERATORS)){
  assert.match(evidence.source.bundles.find(x=>x.path===`charpack/${id}.ab`).sha256,/^[a-f0-9]{64}$/);
  for(const facing of ['Front','Back'])assert.equal(evidence.officialSkeletonBindings[id][facing].sha256,evidence.models[id][facing].sha256);
  for(const sid of c.skillIds)assert.ok(evidence.skills[sid].length);
 }
 const aura=component(evidence.skills.skchr_logos_3,'7167625259498604350');assert.equal(aura._targetSide,2);assert.equal(aura._verifyProjectileType,0);
 const execute=evidence.buffTemplates.logos_s_1.eventToActions.ON_BUFF_TRIGGER.find(x=>x.$type.includes('NoSourceDamage'));
 assert.equal(execute._instantKillLikeDamage,true);assert.equal(execute._attackType,'NORMAL');assert.match(execute._ignoreCancelReasonMask,/HIT_FAILED/);
 const root=component(evidence.token[TOKEN],'2194531589984869784');assert.equal(root._occupiedRemainingCharacterCnt,0);assert.equal(root._useRealBornTimeFromAnim,1);
 near(evidence.tokenModel.hits.Attack[0],.433);near(evidence.tokenModel.durations.Start,.667);
 assert.ok(evidence.limitations.some(x=>x.includes('Fixed-time')));assert.ok(evidence.limitations.some(x=>x.includes('instantKillLike')));
});
test('both third-caster whole kits select all skills/ranks and promotion talents without passive duplication',()=>{
 for(const[id,c]of Object.entries(CASTER_THIRD_OPERATORS))for(let skill=0;skill<3;skill++)for(let rank=1;rank<=10;rank++){
  const{b,u}=make(id,{skill,rank});assert.equal(u.skill.id,c.skillIds[skill]);assert.equal(u.skill.noSkill,false);
  near(u.s.atk,u.base.atk);assert.equal(u.profile.allInRange,false);advance(b,.1);
 }
 for(const id of [DUSK,LOGOS])for(const elite of [0,1]){
  const{u}=make(id,{elite,rank:4});assert.equal(u.def.talents.length,elite?1:0);
 }
});
test('Dusk normal attack waits original event and applies one direct1.1 splash to each legal victim',()=>{
 const{b,u}=make(DUSK,{elite:1,rank:7}),a=enemy(b),z=enemy(b,{col:5}),outside=enemy(b,{col:6});
 b.forceAttack(u,[a]);u.atkCd=1000;advance(b,1);near(a.hp,100000);near(z.hp,100000);assert.equal(b.projectiles.list.length,0);
 advance(b,.1);near(100000-a.hp,u.s.atk);near(100000-z.hp,u.s.atk);near(outside.hp,100000);assert.equal(u.stats.attacks,1);
});
test('Dusk S1 stores selected charges and selected multiplier with source1.7 radius at every rank',()=>{
 for(let rank=1;rank<=10;rank++){
  const{b,u}=make(DUSK,{rank,elite:2}),a=enemy(b),diagonal=enemy(b,{row:4,col:5}),outside=enemy(b,{row:4,col:6});
  // Both neighboring targets are high ground, so first Freeling only spawns on primary.
  u.skill.setSpTotal(u.skill.spCost*u.skill.maxCharges);assert.equal(u.skill.maxCharges,u.skill.bb.cnt);
  const scale=u.skill.bb.atk_scale;assert.equal(u.skill.activate('DEFAULT'),true);b.forceAttack(u,[a]);u.atkCd=1000;advance(b,1.1);
  near(100000-a.hp,u.base.atk*scale);near(100000-diagonal.hp,u.base.atk*scale);near(outside.hp,100000);
  assert.equal(u.skill.charges,u.skill.maxCharges-1);assert.equal(u.stats.attacks,1);
 }
});
test('Dusk S2 natural attack hits every range victim once and uses strict pre-output HP threshold',()=>{
 const{b,u}=make(DUSK,{skill:1}),a=enemy(b),z=enemy(b,{col:5}),threshold=enemy(b,{row:4,hp:50000}),low=enemy(b,{row:4,col:5,hp:49999});
 cast(b,u);advance(b,.2);u.atkCd=0;advance(b,.4);const atk=u.s.atk;
 near(100000-a.hp,atk);near(100000-z.hp,atk);near(50000-threshold.hp,atk);near(49999-low.hp,atk*u.skill.bb.damage_scale);
 assert.equal(u.stats.attacks,1);assert.equal(b.projectiles.list.length,0);
});
test('Dusk S3 uses percentage BAT independently and chooses unblocked primary without duplicate splash',()=>{
 const{b,u}=make(DUSK,{skill:2}),blocked=enemy(b),free=enemy(b,{col:5});blocked.blockedBy={id:999,alive:true,deployed:true,canBlock:true,blocking:[blocked],side:'ally',s:{blockCnt:1}};cast(b,u);
 b.addBuff(u,{key:'test:bat',mods:{batFlat:.2,batPct:.1,batMul:.8,aspd:20}});
 near(u.s.interval,(u.base.bat+.2)*1.5*.8/1.2);assert.equal(acquireTargets(b,u,effectiveProfile(u))[0],free);
 blocked.blockedBy=null;
 b.forceAttack(u,[free]);u.atkCd=1000;advance(b,1.3);near(100000-free.hp,u.s.atk);near(100000-blocked.hp,u.s.atk);assert.equal(u.stats.attacks,1);
});
test('Dusk first actual attack spawns original zero-slot Freeling with birth lock and source Arts strike',()=>{
 const{b,u}=make(DUSK),e=enemy(b);shot(b,u,e,1.1);const t=token(b);assert.ok(t);assert.equal(t.deploymentSlotCost,0);
 near(t.s.atk,398);near(t.s.res,50);assert.equal(t.s.blockCnt,2);assert.ok(t.s.flags.healFree);assert.ok(t.s.flags.disarm);
 const hp=e.hp;t.atkCd=0;advance(b,.5);near(e.hp,hp);advance(b,.7);assert.ok(e.hp<hp);near(hp-e.hp,398);
 assert.equal(t.stats.attacks,1);assert.equal(b.heal(u,t,100),0);
});
test('Dusk first invalid high-ground attempt is consumed, while interrupted unborn attack is not',()=>{
 const{b,u}=make(DUSK),high=enemy(b,{row:4});shot(b,u,high,1.1);assert.equal(token(b),undefined);assert.equal(u.mem.duskFirstAttack,false);
 const ground=enemy(b);shot(b,u,ground,1.1);assert.equal(token(b),undefined);
 const next=make(DUSK),e=enemy(next.b);next.b.forceAttack(next.u,[e]);next.b.applyStatus(next.u,'stun',{duration:.001});advance(next.b,1.1);
 assert.equal(token(next.b),undefined);assert.equal(next.u.mem.duskFirstAttack,true);
});
test('Dusk S3 overlay heals existing owned Freeling and refreshes25s without changing slots or duplicating body',()=>{
 const{b,u}=make(DUSK,{skill:2}),e=enemy(b);shot(b,u,e,1.1);const t=token(b);assert.ok(t);t.atkCd=1000;t.hp=50;
 advance(b,3);cast(b,u);shot(b,u,e,1.3);assert.equal(token(b),t);assert.equal(b.allyUnits.filter(x=>x.defId===TOKEN&&x.alive).length,1);
 near(t.hp,t.s.maxHp);assert.ok(t.findBuff('token_dusk[withdraw]').timeLeft>24);assert.equal(t.deploymentSlotCost,0);
});
test('Dusk token lifetime survives owner withdrawal and expires without erasing a replacement',()=>{
 const{b,u}=make(DUSK),e=enemy(b);shot(b,u,e,1.1);const t=token(b);t.atkCd=1000;b.retreat(u,{permanent:true});
 advance(b,24);assert.equal(t.alive,true);advance(b,1.2);assert.equal(t.alive,false);
});
test('Dusk and own Freeling kills share selected promotion/potential Sublimity cap',()=>{
 for(const[elite,potential,cap]of [[1,1,10],[1,5,13],[2,1,15],[2,5,18]]){
  const{b,u}=make(DUSK,{elite,potential,rank:7});for(let i=0;i<cap+3;i++)b.kill(enemy(b),u);
  assert.equal(u.mem.duskStacks,cap);near(u.s.atk,u.base.atk*(1+.02*cap));
 }
 const{b,u}=make(DUSK),e=enemy(b);shot(b,u,e,1.1);const t=token(b);b.kill(enemy(b),t);assert.equal(u.mem.duskStacks,1);
});
test('Logos ordinary projectile releases at source event and applies same-hit nonstacking RES/Arts addition',()=>{
 const{b,u}=make(LOGOS),e=enemy(b,{res:40});b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.4667);near(e.hp,100000);
 advance(b,.0667);assert.equal(b.projectiles.list.length,1);advance(b,.2);
 near(100000-e.hp,(u.s.atk+150)*.7);near(e.s.res,30);assert.ok(e.findBuff('logos_t_2[core]'));
 const hp=e.hp;b.dealDamage(null,e,{amount:100,type:'arts'});near(hp-e.hp,250*.7);
 b.dealDamage(null,e,{amount:100,type:'phys'});assert.equal(e.buffs.filter(x=>x.key==='logos_t_2[core]').length,1);
 advance(b,5.1);near(e.s.res,40);const current=e.hp;b.dealDamage(null,e,{amount:100,type:'arts'});near(current-e.hp,60);
});
test('Logos born projectile retains selected passive after withdrawal and temporary hook does not leak',()=>{
 const{b,u}=make(LOGOS,{potential:3}),e=enemy(b,{row:4,res:50}),other=enemy(b,{col:5,res:50});b.forceAttack(u,[e]);u.atkCd=1000;
 advance(b,.5333);b.retreat(u,{permanent:true});advance(b,.4);near(100000-e.hp,(u.base.atk+165)*.6);
 const hp=other.hp;b.dealDamage(null,other,{amount:100,type:'arts'});near(hp-other.hp,50);assert.equal(other.findBuff('logos_t_2[core]'),null);
});
test('Logos seeded talent adds one captured-ATK projectile and E2Slow with no ordinary recursive proc',()=>{
 const{b,u}=make(LOGOS),e=enemy(b,{row:4});b.rng.chance=()=>true;b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.5333);
 b.addBuff(u,{key:'test:atk',mods:{atkPct:1}});advance(b,.7);
 near(100000-e.hp,u.base.atk*2+150+u.base.atk*.6+150);assert.ok(e.findBuff('sluggish'));
 assert.equal(u.stats.attacks,1);assert.equal(b.projectiles.list.length,0);
});
test('Logos promotion/potential selects exact talent extra-hit scale and only E2Slow/RES mark',()=>{
 for(const[elite,potential,scale]of [[1,1,.4],[1,5,.45],[2,1,.6],[2,5,.65]]){
  const{b,u}=make(LOGOS,{elite,potential,rank:7}),e=enemy(b,{row:4});b.rng.chance=()=>true;
  shot(b,u,e,1.2);const addition=elite===2?(potential===5?165:150):0;
  near(100000-e.hp,u.base.atk*(1+scale)+addition*2);
  assert.equal(!!e.findBuff('sluggish'),elite===2);assert.equal(!!e.findBuff('logos_t_2[core]'),elite===2);
 }
});
test('Logos S2 first source scale is selected correctly at every skill rank',()=>{
 for(let rank=1;rank<=10;rank++){
  const{b,u}=make(LOGOS,{skill:1,rank}),e=enemy(b,{res:30});cast(b,u);advance(b,.7);
  near(100000-e.hp,(u.base.atk*u.skill.bb['attack@atk_scale_base']+150)*.8);
  near(e.s.moveSpeed,e.base.moveSpeed*(1+u.skill.bb['attack@move_speed']));assert.equal(u.mem.logosStacks,1);
 }
});
test('Logos S1 is permanent and executes strictly below current threshold with saved-HP transfer',()=>{
 const{b,u}=make(LOGOS),source=enemy(b,{row:4,hp:100}),other=enemy(b,{col:5});cast(b,u);assert.equal(source.alive,false);
 const baseAtk=u.s.atk;advance(b,1);assert.equal(u.skill.active,true);assert.equal(u.skill.timeLeft,Infinity);
 near(100000-other.hp,100+150);const threshold=enemy(b,{row:4,hp:baseAtk*u.skill.bb['attack@kill_atk_scale']});advance(b,.2);assert.equal(threshold.alive,true);
 threshold.hp-=1;advance(b,.2);assert.equal(threshold.alive,false);
});
test('Logos execution preserves ordinary shield/HP-floor/invulnerability pipeline instead of direct kill',()=>{
 for(const flag of ['invulnerable','hpFloor']){
  const{b,u}=make(LOGOS),e=enemy(b,{hp:100});b.addBuff(e,{key:'test:protection',flags:flag==='invulnerable'?{invulnerable:true}:null,mods:flag==='hpFloor'?{damageHpFloorRatio:.00001}:null});
  cast(b,u);advance(b,.3);assert.equal(e.alive,true);
 }
 const{b,u}=make(LOGOS),e=enemy(b,{hp:100});b.addBuff(e,{key:'test:shield',shieldHits:2});cast(b,u);
 assert.equal(e.alive,true);advance(b,.15);assert.equal(e.alive,true);advance(b,.15);assert.equal(e.alive,false);
});
test('Logos execution aura handles entry/leave and does not retain removed owner membership',()=>{
 const{b,u}=make(LOGOS),e=enemy(b,{row:4,hp:5000});cast(b,u);assert.ok(e.findBuff(`logos:execution:${u.id}`));
 e.x=7;e.y=1;b._buildEnemyIndex();advance(b,.1);assert.equal(e.findBuff(`logos:execution:${u.id}`),null);
 e.x=4;e.y=4;e.hp=100;b._buildEnemyIndex();advance(b,.1);assert.equal(e.alive,false);
 const liveEnemy=enemy(b,{hp:5000});advance(b,.1);b.retreat(u,{permanent:true});assert.equal(liveEnemy.findBuff(`logos:execution:${u.id}`),null);
});
test('Logos S2 direct channel uses fixed source interval, capped prior-stack scale and movement debuff',()=>{
 const{b,u}=make(LOGOS,{skill:1}),e=enemy(b);cast(b,u);advance(b,.7);assert.equal(u.mem.logosStacks,1);
 near(100000-e.hp,u.base.atk*.75+150);near(e.s.moveSpeed,e.base.moveSpeed*.94);
 advance(b,5);assert.equal(u.mem.logosStacks,10);near(e.s.moveSpeed,e.base.moveSpeed*.4);
 assert.equal(b.projectiles.list.length,0);assert.ok(u.stats.attacks<=12);
 const hp=e.hp;advance(b,.5);near(hp-e.hp,u.base.atk*2.25+150);
});
test('Logos direct channel retains ranged origin while the talent action retains literal NONE origin',()=>{
 const{b,u}=make(LOGOS,{skill:1}),e=enemy(b);b.addBuff(e,{key:'test:melee-only',shield:100000,shieldApplyWays:['melee']});
 const origins=[];b.on('damaged',c=>{if(c.source===u)origins.push([c.dmg.tags,c.dmg.applyWay]);});b.rng.chance=()=>true;
 cast(b,u);advance(b,1.1);assert.ok(e.hp<100000);near(e.findBuff('test:melee-only').shield,100000);
 assert.ok(origins.some(([tags,way])=>tags.includes('logos:channel')&&way==='ranged'));
 assert.ok(origins.some(([tags,way])=>tags.includes('logos:lexical')&&way==='none'));
});
test('Logos S2 original Down override plays literal Begin/Loop/End without inventing alternate hit timings',()=>{
 for(const dir of ['DOWN','UP']){
  const{b,u}=make(LOGOS,{skill:1,dir});cast(b,u);const prefix=dir==='DOWN'?'Skill_Down_2':'Skill_2';
  assert.equal(u.mem.regularFormVisual.clip,`${prefix}_Begin`);advance(b,.267);assert.equal(u.mem.regularFormVisual.clip,`${prefix}_Loop`);
  u.skill.end('duration');assert.equal(u.mem.regularFormVisual.clip,`${prefix}_End`);advance(b,.4);assert.equal(u.mem.regularFormVisual,null);
 }
});
test('Logos S2 no-backlog hide/reveal, retarget and sub-tick accepted-control reset owned lock',()=>{
 const{b,u}=make(LOGOS,{skill:1}),e=enemy(b);cast(b,u);advance(b,1.2);assert.ok(u.mem.logosStacks>=2);
 e.hidden=true;advance(b,3);assert.equal(u.mem.logosStacks,0);assert.equal(e.findBuff(`logos:lock:${u.id}`),null);
 e.hidden=false;advance(b,.2);assert.equal(u.mem.logosStacks,0);advance(b,.3);assert.equal(u.mem.logosStacks,1);
 b.applyStatus(u,'stun',{duration:.001});advance(b,.1);assert.equal(u.mem.logosStacks,0);
 advance(b,.5);assert.equal(u.mem.logosStacks,1);
 const z=enemy(b,{col:5});b.kill(e);advance(b,.5);assert.equal(u.mem.logosTarget,z);assert.equal(u.mem.logosStacks,1);
 u.skill.end('test');assert.equal(z.findBuff(`logos:lock:${u.id}`),null);near(z.s.moveSpeed,z.base.moveSpeed);
});
test('Logos S3 natural attack has selected3/4 distinct projectiles and source attack metadata',()=>{
 for(const rank of [7,10]){
  const{b,u}=make(LOGOS,{skill:2,rank}),enemies=[enemy(b),enemy(b,{col:5}),enemy(b,{row:4}),enemy(b,{row:4,col:5})];
  const hits=[];b.on('damaged',c=>{if(c.source===u)hits.push(c);});cast(b,u);advance(b,.2);u.atkCd=0;advance(b,1);
  const n=u.skill.bb['attack@max_target'];assert.equal(enemies.filter(e=>e.hp<100000).length,n);assert.equal(hits.length,n);
  for(const c of hits){assert.equal(c.dmg.isAttack,true);assert.equal(c.dmg.isSkill,true);near(c.amount,u.s.atk+150);}
  assert.equal(u.stats.attacks,1);
 }
});
test('Logos projectile aura slows eligible speed movers only and preserves wall-clock/fixed-time expiry',()=>{
 const{b,u}=make(LOGOS,{skill:2}),e=enemy(b);cast(b,u);let impacts=0;
 const slow=b.addProjectile({from:e,target:u,source:e,speed:10,onHit:()=>impacts++});
 const friendly=b.addProjectile({from:e,to:{x:4,y:2},source:u,speed:10,onHit:()=>impacts++});
 const fixed=b.addProjectile({from:e,target:u,source:e,flightTime:.3,onHit:()=>impacts++});
 advance(b,.4);assert.ok(b.projectiles.list.includes(slow));assert.equal(b.projectiles.list.includes(friendly),false);assert.equal(b.projectiles.list.includes(fixed),false);
 assert.equal(impacts,2);near(slow.age,.4);assert.equal(slow.maxAge,10);
 advance(b,1.8);assert.equal(impacts,3);
});
test('Logos ordinary S3 end retains aura ATK/range until original .333 elimination event and full cast lock',()=>{
 const{b,u}=make(LOGOS,{skill:2}),e=enemy(b);cast(b,u);advance(b,.2);
 let impacts=0;const p=b.addProjectile({from:e,target:u,source:e,speed:1,onHit:()=>impacts++});const atk=u.s.atk;
 u.skill.end('duration');assert.ok(u.findBuff('logos:ending'));near(u.s.atk,atk);advance(b,.2);assert.ok(b.projectiles.list.includes(p));near(u.s.atk,atk);
 advance(b,.2);assert.equal(b.projectiles.list.includes(p),false);near(u.s.atk,u.base.atk);assert.equal(impacts,0);
 assert.ok(u.findBuff('logos:ending'));advance(b,.9);assert.equal(u.findBuff('logos:ending'),null);
});
test('Logos controlled S3 end releases aura without eliminating enemy shots, and withdrawal cleans all own aura state',()=>{
 const{b,u}=make(LOGOS,{skill:2}),e=enemy(b);cast(b,u);advance(b,.2);let impacts=0;
 b.addProjectile({from:e,target:u,source:e,speed:1,onHit:()=>impacts++});b.applyStatus(u,'stun',{duration:1});u.skill.end('duration');
 assert.equal(u.mem.logosAura,null);assert.equal(u.findBuff('logos:ending'),null);near(u.s.atk,u.base.atk);advance(b,1.1);assert.equal(impacts,1);
 const next=make(LOGOS,{skill:2});cast(next.b,next.u);next.b.retreat(next.u,{permanent:true});assert.equal(next.u.mem.logosAura,null);
 assert.equal(next.b.projectiles.speedAuras.size,0);
});
test('Logos pending end attack remembers sub-tick control while immunity rejects it without canceling elimination',()=>{
 for(const immune of [false,true]){
  const{b,u}=make(LOGOS,{skill:2}),e=enemy(b);cast(b,u);advance(b,.2);u.skill.end('duration');
  const p=b.addProjectile({from:e,target:u,source:e,speed:.1});
  if(immune)u.def.immune.add('stun');b.applyStatus(u,'stun',{duration:.001});advance(b,.4);
  assert.equal(b.projectiles.list.includes(p),!immune);assert.equal(u.mem.logosAura,null);
 }
});

test('Logos source CAST reacquires normal/S1/S3 victims at emission when cached targets leave or become target-free',()=>{
 for(const mode of ['normal','s1','s3'])for(const state of ['leave','target-free']){
  const{b,u}=make(LOGOS,{skill:mode==='s3'?2:0}),old=enemy(b),next=enemy(b,{row:6,col:8});
  if(mode!=='normal'){cast(b,u);advance(b,.5);}
  const profile=effectiveProfile(u);assert.equal(profile.retargetOnRelease,true);const hp=old.hp;
  assert.equal(b.forceAttack(u,[old]),true);u.atkCd=1000;
  if(state==='leave'){old.x=8;old.y=6;}else b.addBuff(old,{key:'test:free',flags:{untargetable:true}});
  next.x=4;next.y=3;b._enemiesDirty=true;b._buildEnemyIndex();advance(b,1);
  near(old.hp,hp);assert.ok(next.hp<100000,`${mode}/${state} must emit at the entering legal victim`);
 }
});
test('Logos source CAST suppresses ordinary/S1/S3 emission when no legal release victim remains',()=>{
 for(const mode of ['normal','s1','s3']){
  const{b,u}=make(LOGOS,{skill:mode==='s3'?2:0}),e=enemy(b);
  if(mode!=='normal'){cast(b,u);advance(b,.5);}
  assert.equal(b.forceAttack(u,[e]),true);u.atkCd=1000;e.x=8;e.y=6;b._enemiesDirty=true;b._buildEnemyIndex();
  advance(b,1);near(e.hp,100000);assert.equal(b.projectiles.list.length,0);assert.equal(e.findBuff('logos_t_2[core]'),null);
 }
});
