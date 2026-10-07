// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-sniper-six-star-second-prefabs.json' with { type: 'json' };
import { SNIPER_SIX_STAR_SECOND_OPERATORS as configs } from '../shared/arkpedia/sniper-six-star-second-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
const EX='char_103_angel',FANG='char_123_fang',MEL='char_208_melan';
const near=(a,z,e=1e-5)=>assert.ok(Math.abs(a-z)<e,`${a} != ${z}`);
const advance=(b,s)=>{for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);};
const rows=p=>p.flatMap(r=>r.components.map(c=>({pathId:c.pathId,...c.data})));
function build(id,{skill=0,elite=null,rank=10,potential=1}={}){
 const op=data.operators[id];assert.ok(op,`Reviewed ${id} snapshot is required`);elite??=op.phases.length-1;rank=Math.min(rank,elite===2?10:elite===1?7:4);
 return{...defaultBuild(op),elite,level:op.phases[elite].maxLevel,skillId:op.skills[skill].id,skillRank:rank,potential};
}
function make(opts={},more=[]){
 const src=structuredClone(data);src.stage.geometry.waves[0].spawns=[];src.stage.battle.dp_per_second=0;
 const b=new StandardBattle(src,{operators:[build(EX,opts),...more.map(id=>build(id))]});b.autoFinish=false;b.recordEvents=true;b.setViewport('fullscreen-workspace');
 b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));b.rng.pick=xs=>xs[0];
 const deploy=(id=EX,row=3,col=4,dir='RIGHT')=>{b.addDp('arkpedia',99);const u=b.deployOperator(id,row,col,dir);assert.ok(u);u.atkCd=1000;u.skill.rule='NEVER';return u;};
 return{b,deploy};
}
function enemy(b,{x=5,y=3,hp=100000,def=0,fly=false}={}){
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[y,x]});Object.assign(e.base,{maxHp:100000,def,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=hp;if(fly)e.motion='FLY';
 b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function move(b,e,x,y=3){e.x=x;e.y=y;e.tileR=y;e.tileC=x;b._enemiesDirty=true;b._buildEnemyIndex();}
function cast(b,u){u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.manual?b.activateOperator(EX):u.skill.activate('DEFAULT'),true);u.atkCd=1000;}
function shot(b,u,e,s=.7){assert.equal(b.forceAttack(u,[e]),true);u.atkCd=1000;advance(b,s);}
function firstFlight(b,u){
 let fired=0;const original=b.addProjectile.bind(b);b.addProjectile=p=>{if(p.source===u)fired++;return original(p);};
 for(let i=0;i<30&&!fired;i++)b.step();assert.deepEqual(b.errors,[]);assert.equal(fired,1);assert.equal(b.projectiles.list.length,1);
}
const hits=(b,u)=>b._evq.filter(e=>e[0]==='dmg'&&e[1]===u.id);

test('Exusiai source resolves exact native attacks, both original facings and independently corroborated double BAT',()=>{
 assert.deepEqual(Object.keys(configs),[EX]);assert.equal(evidence.frameParity,false);assert.equal(evidence.sourceBundles.length,4);
 for(const x of evidence.sourceBundles)assert.match(x.sha256,/^[0-9a-f]{64}$/);
 for(const face of['Front','Back']){assert.equal(evidence.models[EX][face].sha256,evidence.officialSkeletonBindings[EX][face].sha256);near(evidence.models[EX][face].hits.Attack[0],.3);}
 const normal=rows(evidence.characters[EX]).find(x=>x.pathId==='-1535311515910829805');assert.equal(normal._projectileKey,undefined);assert.equal(normal._selectTargetTiming,0);assert.equal(normal._maxAnimScale,2);
 const s1=rows(evidence.skills.skchr_angel_1).find(x=>x._projectileKey);assert.equal(s1._maxAnimScale,1);near(s1._triggerDelta,.05);assert.equal(s1._waitAttackEventForAllAttacks,0);
 const bat=rows(evidence.skills.skchr_angel_3).flatMap(x=>x._buffs??[]).flatMap(x=>x.attributes.attributeModifiers);assert.equal(bat.length,2);for(const x of bat){assert.equal(x.attributeType,8);assert.equal(x.formulaItem,0);assert.equal(x.loadFromBlackboard,1);}
 assert.equal(evidence.independentCalculator.repository,'xulai1001/akdata');assert.match(evidence.independentCalculator.selectedExcerpt,/base_attack_time \*= 2/);
 const proj=rows(evidence.projectiles.projectile_angel);assert.equal(proj.find(x=>x._speed)._speed,30);assert.equal(proj.find(x=>x._lifeTime)._lifeTime,5);
});
test('all thirty skill/rank builds retain native SP types, costs and full skills',()=>{
 for(let skill=0;skill<3;skill++)for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make({skill,rank}),u=deploy(),l=data.operators[EX].skills[skill].levels[rank-1];assert.equal(u.skill.id,configs[EX].skillIds[skill]);assert.equal(u.skill.noSkill,false);near(u.skill.spCost,l.spData.spCost);assert.equal(u.skill.spType,skill===0?'attack':'time');assert.equal(u.skill.manual,skill===1);assert.deepEqual(b.errors,[]);
 }
});
test('selected promotion/potential talents apply self ASPD/ATK/HP once without generic duplicates',()=>{
 for(const[elite,potential,speed,atk,hp]of[[0,1,0,0,0],[1,1,6,0,0],[1,3,9,0,0],[2,1,12,.06,.1],[2,3,15,.06,.1],[2,6,15,.08,.13]]){
  const{deploy}=make({elite,potential}),u=deploy();near(u.s.aspd,u.base.aspd+speed);near(u.s.atk,u.base.atk*(1+atk));near(u.s.maxHp,u.base.maxHp*(1+hp));near(u.hp,u.s.maxHp);
 }
});
test('deployment blessing chooses one seeded existing legal operator and includes unhealable/target-free allies',()=>{
 const{b,deploy}=make({},[FANG,MEL]),a=deploy(FANG,3,3),z=deploy(MEL,2,3),zAtk=z.s.atk;b.addBuff(a,{key:'test:healfree',flags:{healFree:true,noHeal:true,untargetable:true}});const u=deploy();
 near(a.s.atk,a.base.atk*1.06);near(a.s.maxHp,a.base.maxHp*1.1);near(z.s.atk,zAtk);assert.ok(a.findBuff(`exusiai:blessing:${u.id}`));assert.equal(z.findBuff(`exusiai:blessing:${u.id}`),null);
});
test('deployment choice excludes isolated/disappeared allies and does not invent a later recipient or reroll',()=>{
 const{b,deploy}=make({},[FANG,MEL]),a=deploy(FANG,3,3),z=deploy(MEL,2,3),zAtk=z.s.atk;b.addBuff(a,{key:'test:isolation',flags:{isolated:true}});z.hidden=true;const u=deploy();near(a.s.atk,a.base.atk);near(z.s.atk,zAtk);
 b.removeBuff(a,'test:isolation');z.hidden=false;advance(b,.2);near(a.s.atk,a.base.atk);near(z.s.atk,zAtk);near(u.s.atk,u.base.atk*1.06);
 const f=make({},[FANG]),v=f.deploy();const later=f.deploy(FANG,3,3);advance(f.b,.2);assert.equal(later.findBuff(`exusiai:blessing:${v.id}`),null);
});
test('chosen blessing detaches on source/recipient removal and preserves foreign modifiers without replacement',()=>{
 for(const end of['source','recipient','isolated','outside']){
  const{b,deploy}=make({},[FANG,MEL]),a=deploy(FANG,3,3),z=deploy(MEL,2,3),u=deploy();b.addBuff(a,{key:'test:foreign',mods:{atkPct:.2}});
  if(end==='source')b.retreat(u);else if(end==='recipient')b.retreat(a);else if(end==='isolated')b.addBuff(a,{key:'test:isolated',flags:{isolated:true}});else a.x=40;
  advance(b,.1);assert.equal(a.findBuff(`exusiai:blessing:${u.id}`),null);if(end!=='recipient')assert.ok(a.findBuff('test:foreign'));assert.equal(z.findBuff(`exusiai:blessing:${u.id}`),null);
 }
});
test('ordinary direct ranged Physical release follows original event/cap2 and creates no invented projectile',()=>{
 for(const dir of['RIGHT','UP']){
  const{b,deploy}=make(),u=deploy(EX,3,4,dir),e=enemy(b,{x:dir==='RIGHT'?6:4,y:dir==='RIGHT'?3:5,def:100});const interval=u.s.interval,wind=.3/Math.min(2,u.base.bat/interval);near(effectiveProfile(u).windup(b,u),wind);
  const received=[];b.on('damaged',c=>{if(c.source===u)received.push(c.dmg.applyWay);});b.forceAttack(u,[e]);u.atkCd=1000;advance(b,wind-.04);near(e.hp,100000);advance(b,.1);near(100000-e.hp,u.s.atk-100);assert.deepEqual(received,['ranged']);assert.equal(b.projectiles.list.length,0);
 }
});
test('all ten S1 ranks create three full separate mitigated shots with one charge and attack identity',()=>{
 for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make({rank}),u=deploy(),e=enemy(b,{def:200}),other=enemy(b,{x:5.1});const ids=[];b.on('damaged',c=>{if(c.source===u)ids.push(c.dmg.attackId);});cast(b,u);const atk=u.s.atk,scale=u.skill.bb.atk_scale;
  near(effectiveProfile(u).windup(b,u),.3);shot(b,u,e);near(100000-e.hp,3*Math.max(atk*scale-200,atk*scale*.05));near(other.hp,100000);assert.equal(ids.length,3);assert.equal(new Set(ids).size,1);assert.equal(u.skill.charges,0);near(u.skill.sp,0);assert.equal(u.skill.pending,false);
 }
});
test('S1 source cap1 differs from ordinary cap2 under high external ASPD',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b);b.addBuff(u,{key:'test:aspd',mods:{aspd:188}});near(effectiveProfile(u).windup(b,u),.15);cast(b,u);near(effectiveProfile(u).windup(b,u),.3);shot(b,u,e);near(100000-e.hp,3*u.s.atk*u.skill.bb.atk_scale);
});
test('S1 refunds dead input only before emission, CAST selects live replacement and emitted kill spends once',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b);cast(b,u);b.forceAttack(u,[e]);u.atkCd=1000;b.kill(e);advance(b,.7);assert.equal(u.skill.charges,1);assert.equal(b.projectiles.list.length,0);
 const f=make(),v=f.deploy(),old=enemy(f.b),next=enemy(f.b,{x:5.1});cast(f.b,v);f.b.forceAttack(v,[old]);v.atkCd=1000;f.b.kill(old);advance(f.b,.7);assert.ok(next.hp<100000);assert.equal(v.skill.charges,0);
 const g=make(),w=g.deploy(),victim=enemy(g.b,{hp:1});cast(g.b,w);shot(g.b,w,victim);assert.equal(victim.alive,false);assert.equal(w.skill.charges,0);
});
test('S1 accepted sub-tick control cancels unborn release preserving pending charge, rejected immunity does not',()=>{
 for(const immune of[false,true]){
  const{b,deploy}=make(),u=deploy(),e=enemy(b);if(immune)u.def.immune.add('stun');cast(b,u);b.forceAttack(u,[e]);u.atkCd=1000;b.applyStatus(u,'stun',{duration:.001});advance(b,.7);
  if(immune){near(100000-e.hp,3*u.s.atk*u.skill.bb.atk_scale);assert.equal(u.skill.pending,false);}else{near(e.hp,100000);assert.equal(u.skill.pending,true);}
 }
});
test('S2/S3 all ranks use four/five individual selected-scale shots and one ordinary attack lifecycle',()=>{
 for(const skill of[1,2])for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make({skill,rank}),u=deploy(),e=enemy(b,{def:150}),z=enemy(b,{x:5.1});cast(b,u);const count=u.skill.bb['attack@times'],atk=u.s.atk,scale=u.skill.bb['attack@atk_scale'];shot(b,u,e);
  near(100000-e.hp,count*Math.max(atk*scale-150,atk*scale*.05));near(z.hp,100000);assert.equal(u.stats.attacks,1);
 }
});
test('S3 both selected BAT additions compose independently with flat/percent/final external interval buckets at all ranks',()=>{
 for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make({skill:2,rank}),u=deploy();b.addBuff(u,{key:'test:bat',mods:{batFlat:.2,batPct:.3,batMul:.8,aspd:10}});cast(b,u);const delta=u.skill.bb.base_attack_time;
  near(u.s.bat,(u.base.bat+.2+2*delta)*1.3*.8);near(u.s.interval,u.s.bat*100/u.s.aspd);u.skill.end('duration');near(u.s.bat,(u.base.bat+.2)*1.3*.8);
 }
});
test('S3 native AUTO starts naturally and emits two five-shot bursts at the selected attack interval',()=>{
 const{b,deploy}=make({skill:2}),u=deploy(),e=enemy(b);u.skill.rule='DEFAULT';u.skill.setSpTotal(u.skill.spCost);u.atkCd=0;const amounts=[];b.on('damaged',c=>{if(c.source===u)amounts.push(c.amount);});advance(b,1.3);
 assert.equal(u.skill.active,true);assert.equal(u.skill.activations,1);near(u.s.bat,.78);assert.equal(u.stats.attacks,2);assert.equal(amounts.length,10);near(100000-e.hp,10*u.s.atk*1.1);
});
test('normal/S1/S2/S3 CAST rechecks leaving/entering/target-free victims at emission',()=>{
 for(const mode of['normal','s1','s2','s3'])for(const state of['leave','free']){
  const{b,deploy}=make({skill:mode==='s2'?1:mode==='s3'?2:0}),u=deploy(),old=enemy(b),next=enemy(b,{x:9});if(mode!=='normal')cast(b,u);b.forceAttack(u,[old]);u.atkCd=1000;
  if(state==='leave')move(b,old,9);else b.addBuff(old,{key:'test:free',flags:{untargetable:true}});move(b,next,5);advance(b,.7);near(old.hp,100000);assert.ok(next.hp<100000);
 }
});
test('burst keeps exact serialized .05 additional releases, not duplicate immediate damage or extra Attack animation events',()=>{
 const{b,deploy}=make({skill:2}),u=deploy(),e=enemy(b,{x:6});cast(b,u);const released=[];const original=b.addProjectile.bind(b);b.addProjectile=p=>{released.push(b.time);return original(p);};b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.7);assert.equal(released.length,5);for(let i=1;i<5;i++)assert.ok(released[i]-released[i-1]>=b.dt-1e-8);assert.equal(b._evq.filter(x=>x[0]==='atk'&&x[1]===u.id).length,1);
});
test('accepted sub-tick control between source rounds permanently cancels unborn shots while born shots survive',()=>{
 for(const immune of[false,true]){
  const{b,deploy}=make({skill:2}),u=deploy(),e=enemy(b,{x:7});if(immune)u.def.immune.add('stun');cast(b,u);b.forceAttack(u,[e]);u.atkCd=1000;firstFlight(b,u);b.applyStatus(u,'stun',{duration:.001});advance(b,.7);
  near(100000-e.hp,(immune?5:1)*u.s.atk*1.1);
 }
});
test('born skill flight retains selected scale on withdrawal while source death cancels all unfired rounds',()=>{
 const{b,deploy}=make({skill:1}),u=deploy(),e=enemy(b,{x:7});cast(b,u);b.forceAttack(u,[e]);u.atkCd=1000;firstFlight(b,u);b.retreat(u);advance(b,.6);near(100000-e.hp,u.s.atk*1.25);
});
test('already-started selected burst survives native mode detach at skill expiry without changing selected scale',()=>{
 for(const skill of[1,2]){
  const{b,deploy}=make({skill}),u=deploy(),e=enemy(b,{x:7});cast(b,u);b.forceAttack(u,[e]);u.atkCd=1000;firstFlight(b,u);u.skill.end('duration');advance(b,.7);
  near(100000-e.hp,(skill===1?4:5)*u.s.atk*(skill===1?1.25:1.1));
 }
});
test('S2 timing restores original direct normal attack and no owned timer leaks across redeployment',()=>{
 const{b,deploy}=make({skill:1}),u=deploy(),e=enemy(b);cast(b,u);shot(b,u,e);u.skill.end('duration');const hp=e.hp;shot(b,u,e);near(hp-e.hp,u.s.atk);assert.equal(b.projectiles.list.length,0);b.retreat(u);b.bench[EX].readyAt=b.time;const v=deploy();near(v.s.aspd,112);near(v.s.atk,v.base.atk*1.06);
});
