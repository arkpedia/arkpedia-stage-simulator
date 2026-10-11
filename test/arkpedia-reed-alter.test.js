// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import evidence from '../data/arkpedia-reed-alter-prefabs.json' with {type:'json'};
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, acquireTargets, performAttack } from '../server/sim/ai.js';
const ID='char_1020_reed2', ALLY='char_208_melan', CINDER='reed2:cinder';
const near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps,`${a} != ${z}`);
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function make({skill=0,rank=10,elite=2,potential=1,trust=0,allies=[ALLY],dir='RIGHT'}={}){
  const d=structuredClone(data),op=d.operators[ID];
  d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
  d.stage.geometry.rows=19;d.stage.geometry.cols=21;d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
  const build={...defaultBuild(op),elite,potential,trust,level:op.phases[elite].maxLevel,
    skillId:op.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
  const b=new StandardBattle(d,{operators:[build,...allies.map(id=>defaultBuild(d.operators[id]))]});
  b.autoFinish=false;b.recordEvents=true;b.setViewport('fullscreen-workspace');
  b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));b.rng=()=>1;
  b.addDp('arkpedia',99);const u=b.deployOperator(ID,5,5,dir);u.skill.rule='NEVER';u.atkCd=10000;
  const ally=(row=5,col=6,id=ALLY)=>{b.addDp('arkpedia',99);const a=b.deployOperator(id,row,col,'RIGHT');
    a.atkCd=10000;a.skill.rule='NEVER';return a;};
  const activate=()=>{u.skill.setSpTotal(u.skill.spCost);assert.equal(b.activateOperator(ID),true);};
  const damage=[],calculated=[],healing=[];
  b.on('damaged',c=>damage.push(c));b.on('calculatedDamage',c=>calculated.push(c));b.on('calculatedHeal',c=>healing.push(c));
  return {b,u,ally,activate,damage,calculated,healing};
}
function enemy(b,{x=8,y=5,fly=false,stealth=false,free=false,invulnerable=false,res=0,hp=100000}={}){
  const e=b.spawnEnemy('enemy_1007_slime',{pos:[y,x]});
  Object.assign(e.base,{maxHp:100000,def:0,res,moveSpeed:0,atk:100});e.markDirty();void e.s;e.hp=hp;
  e.x=x;e.y=y;if(fly)e.motion='FLY';
  b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true,unblockable:true,untargetable:free,stealth,invulnerable}});b._buildEnemyIndex();return e;
}
const hit=(b,u,e,amount=100,extra={})=>b.dealDamage(u,e,{amount,type:'arts',canDodge:false,...extra});
const dot=(u,e)=>e.findBuff(`reed2:dot:${u.id}`);
test('all thirty ranks retain selected SP, duration, S1 stats, S2 host counts and S3 coefficients',()=>{
  for(const skill of [0,1,2])for(let rank=1;rank<=10;rank++){
    const {b,u,ally,activate}=make({skill,rank}),a=ally();
    const source=data.operators[ID].skills[skill].levels[rank-1];
    near(u.skill.spTotal,source.spData.initSp);assert.equal(u.skill.spCost,source.spData.spCost);activate();
    near(u.skill.timeLeft,source.duration);
    if(skill===0){near(u.s.atk,u.base.atk*(1+u.skill.bb.atk));near(u.s.aspd,100+u.skill.bb.attack_speed);}
    if(skill===1){advance(b,.234);assert.equal(u.mem.reedOrbits.length,u.skill.bb.max_target);
      assert.equal(b.reedFireballs.length,u.skill.bb.max_target*3);near(u.mem.reedOrbits[0].scale,u.skill.bb.atk_scale);}
    if(skill===2){near(u.s.atk,u.base.atk*(1+u.skill.bb['reed2_skil_3[switch_mode].atk']));
      near(u.skill.bb['talent@atk'],-.2);near(u.skill.bb['talent@damage_scale'],1.3);}
    assert.ok(a.alive);assert.deepEqual(b.errors,[]);
  }
});
test('all promotions and potentials select source Cinder, reflected healing and base stats',()=>{
  for(const elite of [0,1,2])for(const potential of [1,3,6]){
    const {b,u,ally}=make({elite,potential,trust:200}),a=ally(),e=enemy(b);b.rng=()=>0;
    a.hp=100;u.hp=100;hit(b,u,e);
    if(elite===0){assert.equal(e.findBuff(CINDER),null);near(a.hp,150);near(u.hp,100);}
    else {const scale=elite===1?(potential>=3?1.17:1.15):(potential>=3?1.32:1.3);
      near(e.s.artsTakenMul,scale);near(a.hp,100+50*scale);near(u.hp,elite===2?100+50*scale*(potential===6?.55:.5):100);}
  }
});
test('ordinary attacks keep one victim, original facing event, capped animation speed and speed-ten homing flight',()=>{
  for(const dir of ['RIGHT','UP','LEFT','DOWN']){
    const {b,u,damage}=make({dir}),e=enemy(b,{x:6});b.addBuff(u,{key:'speed',mods:{aspd:200}});
    const p=effectiveProfile(u);near(p.windup(b,u),evidence.models[ID][['UP','LEFT'].includes(dir)?'Back':'Front'].eventPayloads.Attack[0].time);
    performAttack(b,u,p,[e]);advance(b,.4);assert.equal(damage.length,0);advance(b,.1);
    assert.equal(b.projectiles.list.length,1);near(b.projectiles.list[0].speed,10);
    advance(b,.134);assert.equal(damage.length,1);near(damage[0].amount,u.s.atk);
    assert.equal(damage[0].dmg.isAttack,true);assert.equal(damage[0].dmg.isProjectile,true);
  }
});
test('ordinary selectors reject invisible, sleeping and target-free enemies, but include airborne enemies',()=>{
  const {b,u}=make();const ground=enemy(b,{x:6}),air=enemy(b,{x:7,fly:true});
  enemy(b,{x:6,stealth:true});enemy(b,{x:6,free:true});const sleeping=enemy(b,{x:6});b.applyStatus(sleeping,'sleep',{duration:100});
  const p=effectiveProfile(u);assert.deepEqual(acquireTargets(b,u,p),[ground]);b.kill(ground);
  assert.deepEqual(acquireTargets(b,u,p),[air]);
});
test('calculated damage healing respects RES, shields and overkill without duplicating damage credit',()=>{
  const {b,u,ally,calculated,healing}=make(),a=ally(),e=enemy(b,{res:50,hp:5});a.hp=100;u.hp=100;
  b.addBuff(e,{key:'barrier',shield:1000});near(hit(b,u,e,200),0);near(e.hp,5);
  near(calculated.at(-1).amount,100);near(a.hp,150);near(u.hp,125);near(u.stats.dmg,0);
  b.removeBuff(e,'barrier');near(hit(b,u,e,200),5);near(a.hp,200);near(u.hp,150);near(u.stats.dmg,5);
  assert.equal(healing.length,4);assert.equal(e.alive,false);
});
test('reflected healing uses calculated overheal and excludes self receipts without recursion',()=>{
  const {b,u,ally,healing}=make({potential:6}),a=ally(),e=enemy(b);u.hp=100;a.hp=a.s.maxHp;
  b.heal(u,a,100);near(a.hp,a.s.maxHp);near(u.hp,155);assert.equal(healing.length,2);
  // Ordinary low-HP selector now picks Reed; reflection must not fire again.
  a.x=15;hit(b,u,e,200);near(u.hp,255);assert.equal(healing.length,3);
  b.addBuff(a,{key:'heal-mod',mods:{healingTakenMul:2}});b.heal(u,a,100);near(u.hp,365);
  assert.equal(healing.length,5);assert.deepEqual(b.errors,[]);
});
test('trait lowest-HP selector includes self and rejects healing-free, no-heal and target-free allies',()=>{
  const {b,u,ally}=make(),a=ally(),e=enemy(b);u.hp=100;a.hp=1;
  for(const flags of [{healFree:true},{noHeal:true},{untargetable:true}]){
    b.addBuff(a,{key:'blocked',flags});const hp=u.hp;hit(b,u,e);near(a.hp,1);near(u.hp,hp+50);b.removeBuff(a,'blocked');
  }
  u.hp=u.s.maxHp;hit(b,u,e);near(a.hp,51);
});
test('rejected, missed, elemental and HP-loss receipts never trigger calculated damage healing',()=>{
  const {b,u,ally,calculated}=make(),a=ally(),e=enemy(b,{invulnerable:true});a.hp=100;u.hp=100;
  hit(b,u,e);assert.equal(calculated.length,0);b.removeBuff(e,'test:pin');
  b.addBuff(e,{key:'dodge',mods:{dodgeArts:1}});b.rng=()=>0;b.dealDamage(u,e,{amount:100,type:'arts'});near(a.hp,100);
  b.removeBuff(e,'dodge');b.on('hit',c=>{if(c.dmg.tags.includes('cancel'))c.dmg.cancel=true;});hit(b,u,e,100,{tags:['cancel']});
  b.loseHp(e,100,{source:u});b.dealDamage(u,e,{amount:100,type:'element',element:'burn'});near(a.hp,100);near(u.hp,100);
});
test('ordinary Cinder applies before mitigation, refreshes duration and never multiplies its own effects',()=>{
  const {b,u}=make(),e=enemy(b);b.rng=()=>0;const hp=e.hp;hit(b,u,e);
  near(hp-e.hp,130);near(e.s.atk,80);near(e.s.artsTakenMul,1.3);advance(b,4);
  hit(b,u,e);near(e.findBuff(CINDER).timeLeft,6);near(e.findBuff('reed2:cinder-fragile').timeLeft,6);
  near(e.s.atk,80);near(e.s.artsTakenMul,1.3);advance(b,6.034);assert.equal(e.findBuff(CINDER),null);near(e.s.atk,100);
});
test('Cinder ATK reduction remains independent of a stronger Arts Fragility producer',()=>{
  const {b,u}=make(),e=enemy(b);b.rng=()=>0;b.applyStatus(e,'artsFragile',{key:'other',duration:100,value:.5});
  hit(b,u,e);near(e.s.atk,80);near(e.s.artsTakenMul,1.5);b.removeBuff(e,'other');near(e.s.artsTakenMul,1.3);
});
test('S2 requires a legal operator host and prioritizes ground operators over ranged hosts',()=>{
  const {b,u,ally,activate}=make({skill:1,allies:[ALLY,'char_122_beagle','char_123_fang','char_120_hibisc']});
  const a=ally(),z=ally(4,6,'char_122_beagle'),ranged=ally(6,5,'char_120_hibisc');a.hp=a.s.maxHp;z.hp=z.s.maxHp;ranged.hp=1;
  activate();advance(b,.234);assert.deepEqual(u.mem.reedOrbits.map(o=>o.host),[a,z]);
  const f=make({skill:1});b.addBuff(u,{key:'free',flags:{untargetable:true}});
  f.b.addBuff(f.u,{key:'free',flags:{untargetable:true}});f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.b.activateOperator(ID),false);
});
test('S2 casts from the verified front event for every facing and can be interrupted before emission',()=>{
  for(const dir of ['RIGHT','UP','LEFT','DOWN']){
    const {b,u,activate}=make({skill:1,dir});activate();assert.equal(u.mem.regularFormVisual.forceFront,true);
    advance(b,.134);assert.equal(u.mem.reedOrbits.length,0);advance(b,.1);assert.equal(u.mem.reedOrbits.length,1);
    advance(b,.3);assert.equal(u.mem.regularFormVisual,null);assert.equal(!!u.s.flags.disarm,false);
  }
  const {b,u,activate}=make({skill:1});activate();b.applyStatus(u,'stun',{duration:.1});advance(b,1);assert.equal(u.mem.reedOrbits.length,0);
});
test('S2 particles retain exact orbit radius, speed, spacing and independent selected collision cooldowns',()=>{
  const {b,u,ally,activate,damage}=make({skill:1}),a=ally(5,7),e=enemy(b,{x:7,y:5});a.hp=100;u.hp=100;
  activate();advance(b,.234);const o=u.mem.reedOrbits[0];assert.equal(o.host,a);assert.equal(o.particles.length,3);
  for(const p of o.particles)near(Math.hypot(p.x-a.x,p.y-a.y),.5);
  const first=damage.filter(d=>d.dmg.tags.includes('reed2:fireball'));assert.equal(first.length,3);
  for(const d of first){near(d.amount,u.s.atk*2.4);assert.equal(d.dmg.traitAlly,a);}
  const hp=e.hp;advance(b,1.3);near(e.hp,hp);advance(b,.234);assert.ok(e.hp<hp);
  const angle=o.angle;advance(b,.1);near((o.angle-angle+Math.PI*2)%(Math.PI*2),Math.PI/12);
});
test('fireball healing always selects its host and never falls back when that host cannot be healed',()=>{
  const {b,u,ally,activate}=make({skill:1}),a=ally(5,7);a.hp=1;u.hp=1;b.addBuff(a,{key:'no-heal',flags:{noHeal:true}});
  const e=enemy(b,{x:7});activate();advance(b,.234);assert.ok(e.hp<100000);near(a.hp,1);near(u.hp,1);
  b.removeBuff(a,'no-heal');advance(b,1.534);assert.ok(a.hp>1);assert.ok(u.hp>1);
});
test('S2 collisions reject air, sleeping, invisible and target-free units while ignoring camouflage',()=>{
  for(const option of [{fly:true},{stealth:true},{free:true},{sleep:true}]){
    const {b,u,ally,activate}=make({skill:1});ally();const e=enemy(b,{x:6,...option});if(option.sleep)b.applyStatus(e,'sleep',{duration:100});
    activate();advance(b,.3);near(e.hp,100000);assert.equal(b.reedFireballs.length,6);
  }
  const {b,ally,activate}=make({skill:1});ally();const e=enemy(b,{x:6});b.addBuff(e,{key:'camou',flags:{camou:true}});
  activate();advance(b,.3);assert.ok(e.hp<100000);
});
test('S2 fireballs use live source ATK, survive skill detachment and expire on their own projectile lifetime',()=>{
  const {b,u,ally,activate,damage}=make({skill:1});ally();const e=enemy(b,{x:6});activate();advance(b,.234);
  const o=u.mem.reedOrbits[0];u.skill.end();b.addBuff(u,{key:'atk',mods:{atkFlat:100,atkScaleMul:1.5}});
  advance(b,1.6);near(damage.at(-1).amount,u.s.atk*1.5*2.4);assert.ok(e.hp<100000);
  advance(b,o.expires-b.time+.034);assert.equal(u.mem.reedOrbits.length,0);assert.equal(b.reedFireballs.length,0);
});
test('S2 owner/host withdrawal cancels only the applicable fireballs',()=>{
  const {b,u,ally,activate}=make({skill:1}),a=ally();activate();advance(b,.234);assert.equal(u.mem.reedOrbits.length,2);
  b.retreat(a);advance(b,.034);assert.deepEqual(u.mem.reedOrbits.map(o=>o.host),[u]);
  b.retreat(u);assert.equal(b.reedFireballs.length,0);assert.equal(u.mem.reedOrbits.length,0);
});
test('S3 source animation transitions and two-victim homing attacks retain selected timing',()=>{
  const {b,u,activate,damage}=make({skill:2}),a=enemy(b,{x:6}),z=enemy(b,{x:7});enemy(b,{x:7,y:6});
  activate();assert.equal(u.mem.regularFormVisual.clip,'Skill_3_Begin');advance(b,.367);assert.equal(u.mem.regularFormVisual.clip,'Skill_3_Loop');
  const p=effectiveProfile(u);assert.equal(p.attackVisual,'Skill_3_Attack');near(p.windup(b,u),evidence.models[ID].Front.eventPayloads.Skill_3_Attack[0].time);
  const targets=acquireTargets(b,u,p);assert.equal(targets.length,2);assert.deepEqual(targets,[a,z]);performAttack(b,u,p,targets);
  advance(b,.434);assert.equal(damage.length,0);advance(b,.3);assert.ok(damage.some(d=>d.target===a));assert.ok(damage.some(d=>d.target===z));
  assert.equal(damage.filter(d=>d.dmg.isAttack).length,2);u.skill.end();assert.equal(u.mem.regularFormVisual.clip,'Skill_3_End');advance(b,1.034);assert.equal(u.mem.regularFormVisual,null);
});
test('S3 does not upgrade pre-existing ordinary Cinder until that victim receives new damage',()=>{
  const {b,u,activate}=make({skill:2}),a=enemy(b),z=enemy(b,{x:9});b.rng=()=>0;hit(b,u,a);activate();
  assert.equal(a.findBuff(CINDER).data.enhanced,false);assert.equal(dot(u,a),null);hit(b,u,z);
  assert.equal(z.findBuff(CINDER).data.enhanced,true);assert.ok(dot(u,z));hit(b,u,a);assert.equal(a.findBuff(CINDER).data.enhanced,true);
});
test('S3 DOT starts after 0.2 seconds, repeats each second and refresh does not reset its cadence',()=>{
  const {b,u,activate,damage}=make({skill:2}),e=enemy(b);activate();hit(b,u,e);advance(b,.1);
  assert.equal(damage.filter(d=>d.dmg.tags.includes('reed2:dot')).length,0);hit(b,u,e);advance(b,.134);
  let ticks=damage.filter(d=>d.dmg.tags.includes('reed2:dot'));assert.equal(ticks.length,1);near(ticks[0].amount,u.s.atk*.6*1.3);
  b.addBuff(u,{key:'more-atk',mods:{atkFlat:100}});advance(b,1.2-b.time);assert.equal(damage.filter(d=>d.dmg.tags.includes('reed2:dot')).length,1);
  advance(b,b.dt);ticks=damage.filter(d=>d.dmg.tags.includes('reed2:dot'));assert.equal(ticks.length,2);near(ticks[1].amount,u.s.atk*.6*1.3);
});
test('S3 death diffusion attaches Cinder immediately, then emits delayed Arts damage to ground/air in radius',()=>{
  const {b,u,activate,damage}=make({skill:2}),center=enemy(b,{x:8}),nearby=enemy(b,{x:9.6,fly:true}),far=enemy(b,{x:9.71});
  activate();hit(b,u,center);b.kill(center,u);assert.ok(dot(u,nearby));assert.equal(dot(u,far),null);
  assert.equal(damage.filter(d=>d.dmg.tags.includes('reed2:blast')).length,0);advance(b,.067);
  assert.equal(damage.filter(d=>d.dmg.tags.includes('reed2:blast')).length,0);advance(b,.034);
  const blast=damage.filter(d=>d.dmg.tags.includes('reed2:blast'));assert.equal(blast.length,1);near(blast[0].amount,u.s.atk*1.4*1.3);
});
test('S3 delayed explosions propagate chains without requiring ordinary attack range',()=>{
  const {b,u,activate,damage}=make({skill:2}),first=enemy(b,{x:12}),second=enemy(b,{x:13.6,hp:1}),third=enemy(b,{x:15.2});
  activate();hit(b,u,first);b.kill(first,u);assert.ok(dot(u,second));assert.equal(dot(u,third),null);
  advance(b,.134);assert.equal(second.alive,false);assert.ok(dot(u,third));advance(b,.134);
  assert.ok(damage.some(d=>d.target===third && d.dmg.tags.includes('reed2:blast')));
});
test('S3 skill end clears owned DOT/Cinder without removing unrelated statuses or ordinary marks',()=>{
  const {b,u,activate}=make({skill:2}),a=enemy(b),z=enemy(b,{x:9});b.rng=()=>0;hit(b,u,a);activate();hit(b,u,z);
  b.applyStatus(z,'artsFragile',{key:'other',duration:100,value:.5});u.skill.end();assert.ok(a.findBuff(CINDER));
  assert.equal(z.findBuff(CINDER),null);assert.equal(dot(u,z),null);near(z.s.artsTakenMul,1.5);
  b.retreat(u);assert.equal(a.findBuff(CINDER),null);assert.ok(z.findBuff('other'));
});
test('S3 source withdrawal, enemy leak and battle end cannot start new diffusion chains',()=>{
  for(const finish of ['retreat','battleEnd','leak']){
    const {b,u,activate,damage}=make({skill:2}),a=enemy(b),z=enemy(b,{x:9});activate();hit(b,u,a);
    if(finish==='retreat')b.retreat(u);else if(finish==='battleEnd')b.emit('battleEnd',{});else b._remove(a,'leak');
    if(finish!=='leak')b.kill(a,u);advance(b,.134);assert.equal(dot(u,z),null);
    assert.equal(damage.filter(d=>d.dmg.tags.includes('reed2:blast')).length,0);
  }
});
test('pending issued splash survives skill end, but cannot leave another enhanced Cinder',()=>{
  const {b,u,activate,damage}=make({skill:2}),a=enemy(b),z=enemy(b,{x:9});activate();hit(b,u,a);b.kill(a,u);u.skill.end();advance(b,.134);
  assert.ok(damage.some(d=>d.target===z && d.dmg.tags.includes('reed2:blast')));assert.equal(dot(u,z),null);
});
test('ordinary damage and healing modifiers remain compatible with calculated receipt hooks',()=>{
  const {b,u,ally,calculated,healing}=make(),a=ally(),e=enemy(b);a.hp=100;u.hp=100;
  b.on('damageFinal',c=>{c.amount*=.4;});b.on('heal',c=>{c.amount*=2;});
  b.on('calculatedDamage',c=>{c.amount=999;});hit(b,u,e,100);near(e.hp,99960);
  near(a.hp,140);near(u.hp,140);near(healing.find(c=>c.target===a).amount,40);
  assert.equal(calculated.length,1);assert.deepEqual(b.errors,[]);
});
test('ordinary Cinder keeps a stronger incumbent producer and upgrades a weaker one without stacking',()=>{
  const {b,u}=make({potential:6}),e=enemy(b);b.rng=()=>0;
  const other={id:-1};b.addBuff(e,{key:CINDER,source:other,duration:2,mods:{atkPct:-.3},
    data:{owner:other,enhanced:false,scale:1.5,aoe:0}});
  b.applyStatus(e,'artsFragile',{key:'reed2:cinder-fragile',source:other,duration:2,value:.5});
  hit(b,u,e);assert.equal(e.findBuff(CINDER).source,other);near(e.findBuff(CINDER).timeLeft,6);
  near(e.s.atk,70);near(e.s.artsTakenMul,1.5);b.retreat(u);assert.ok(e.findBuff(CINDER));
  const f=make({potential:6}),victim=enemy(f.b);f.b.rng=()=>0;
  f.b.addBuff(victim,{key:CINDER,source:other,mods:{atkPct:-.1},data:{owner:other,enhanced:false,scale:1.15}});
  hit(f.b,f.u,victim);assert.equal(victim.findBuff(CINDER).source,f.u);near(victim.s.atk,78);near(victim.s.artsTakenMul,1.32);
});
test('S3 independent DOT does not steal a stronger shared diffusion holder or clear a foreign producer',()=>{
  const {b,u,activate}=make({skill:2}),e=enemy(b),other={id:-1};
  b.addBuff(e,{key:CINDER,source:other,mods:{atkPct:-.3},data:{owner:other,enhanced:true,scale:1.5,aoe:2,radius:1.7}});
  b.applyStatus(e,'artsFragile',{key:'reed2:cinder-fragile',source:other,value:.5});
  b.addBuff(e,{key:'reed2:dot:-1',source:other});activate();hit(b,u,e);
  assert.ok(dot(u,e));assert.equal(e.findBuff(CINDER).data.owner,other);near(e.s.atk,70);near(e.s.artsTakenMul,1.5);
  u.skill.end();assert.equal(dot(u,e),null);assert.ok(e.findBuff('reed2:dot:-1'));assert.equal(e.findBuff(CINDER).data.owner,other);
});
test('S2 operator host selection excludes summons and preserves heal-free host damage',()=>{
  const {b,u,ally,activate}=make({skill:1}),a=ally();a.kind='token';activate();advance(b,.234);
  assert.deepEqual(u.mem.reedOrbits.map(o=>o.host),[u]);
  const f=make({skill:1}),host=f.ally(5,7);host.hp=1;f.b.addBuff(host,{key:'heal-free',flags:{healFree:true}});
  const e=enemy(f.b,{x:7});f.activate();advance(f.b,.3);assert.ok(e.hp<100000);near(host.hp,1);
});
test('short-lived cast controls cancel S2 emission even when they expire before the release tick',()=>{
  const {b,u,activate}=make({skill:1});activate();advance(b,.067);
  b.applyStatus(u,'stun',{duration:.001});advance(b,.6);assert.equal(u.mem.reedOrbits.length,0);
  assert.equal(u.mem.regularFormVisual,null);assert.equal(!!u.s.flags.disarm,false);
});
test('calculated damage receipts occur after modifiers and retain accepted hit-count damage',()=>{
  const {b,u,ally,calculated}=make(),a=ally(),e=enemy(b);a.hp=100;u.hp=100;
  b.addBuff(e,{key:'frequency',flags:{hitCount:true}});b.addBuff(e,{key:'barrier',shieldHits:1});
  hit(b,u,e,9999);near(calculated.at(-1).amount,1);near(a.hp,100.5);near(u.hp,100.25);near(e.hp,100000);
  b.addBuff(e,{key:'blocked',flags:{invulnerable:true}});const count=calculated.length;hit(b,u,e);assert.equal(calculated.length,count);
});
