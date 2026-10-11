// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-hoolheyak-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, performAttack } from '../server/sim/ai.js';
const ID = 'char_4027_heyak';
const near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps,`${a} != ${z}`);
function advance(b,s){const end=b.time+s;while(b.time<end-1e-9)b.step();assert.deepEqual(b.errors,[]);}
function make({skill=0,rank=10,elite=2,potential=1,dir='RIGHT'}={}){
  const src=structuredClone(data);src.stage.geometry.waves[0].spawns=[];
  const op=src.operators[ID],build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,
    potential,skillId:op.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
  const b=new StandardBattle(src,{operators:[build]});b.autoFinish=false;b.setViewport('fullscreen-workspace');
  b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'HIGH',build:'ALL',pass:'ALL'}));
  b.getPlayer('arkpedia').dp=99;b.rng=()=>.999;
  const u=b.deployOperator(ID,3,4,dir);assert.ok(u);u.profile.noAttack=true;u.atkCd=1000;
  const hits=[];b.on('damaged',ctx=>hits.push({...ctx,time:b.time}));return{b,u,hits};
}
function enemy(b,{r=3,c=5,fly=false,hp=1000000,res=0,mass=0}={}){
  const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});Object.assign(e.base,{maxHp:hp,res,def:0,atk:100,massLevel:mass});
  e.markDirty();void e.s;e.hp=hp;if(fly)e.motion='FLY';
  b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function cast(b,u,delay=.4){u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.id.endsWith('_1')?u.skill.activate():b.activateOperator(ID),true);advance(b,delay);}
function fire(b,u,es){performAttack(b,u,effectiveProfile(u),Array.isArray(es)?es:[es]);}
const tagged=(hs,t)=>hs.filter(h=>h.dmg.tags.includes(t));
test('exact ranks, native templates, source buff DB and actual delivered facings are retained',()=>{
  assert.equal(evidence.frameParity,false);assert.equal(evidence.moduleSupport,false);
  assert.equal(evidence.source.bundles.length,5);assert.equal(Object.keys(evidence.templates).length,8);
  assert.deepEqual(Object.keys(evidence.buffDatabase),['mass_loss','silence']);
  for(const s of data.operators[ID].skills)
    assert.deepEqual(s.levels.map(({rangeGrid,...l})=>l),evidence.tables.skills[s.id].levels);
  for(const face of ['Front','Back']){
    const path=data.sd.models[`operator/${ID}/default/${face.toLowerCase()}`].skeleton.path;
    const raw=readFileSync(new URL('../../arkpedia-sd-assets/'+path,import.meta.url));
    assert.equal(createHash('sha256').update(raw).digest('hex'),evidence.officialSkeletonBindings[ID][face].sha256);
    assert.deepEqual(evidence.models[ID][face].hits.Skill_3_Loop,[.867]);
    assert.equal(evidence.models[ID][face].hits.Skill_2_Loop,undefined);
  }
});
for(let rank=1;rank<=10;rank++)test(`S1 rank${rank}: stored charges, one-target lift before aerial damage and silence`,()=>{
  const{b,u,hits}=make({rank}),e=enemy(b);cast(b,u,0);fire(b,u,e);advance(b,.6);
  const out=tagged(hits,'heyak:s1');assert.equal(out.length,1);
  near(out[0].amount,u.base.atk*u.skill.bb.atk_scale*1.2);
  assert.ok(e.s.flags.levitate&&e.s.flags.silence);assert.equal(u.skill.active,false);
  b.kill(e);advance(b,u.skill.spCost*u.skill.maxCharges+.2);assert.equal(u.skill.charges,u.skill.maxCharges);
});
for(let rank=1;rank<=10;rank++)test(`S2 rank${rank}: nine independently released hits, fixed projectile delay and expiry`,()=>{
  const{b,u,hits}=make({skill:1,rank}),e=enemy(b);cast(b,u);fire(b,u,e);advance(b,1.2);
  const out=tagged(hits,'heyak:s2');assert.equal(out.length,9);
  for(const h of out)near(h.amount,u.base.atk*u.skill.bb['attack@atk_scale']);
  assert.equal(!!e.s.flags.levitate,false);near(u.skill.sp,0);
  advance(b,u.skill.timeLeft+.3);assert.equal(u.skill.active,false);assert.equal(u.mem.regularFormVisual,null);
});
for(let rank=1;rank<=10;rank++)test(`S3 rank${rank}: three independent lanes, live curve damage and one hit per whirlwind`,()=>{
  const{b,u,hits}=make({skill:2,rank});b.rng=()=>0;
  const es=[-1,0,1].map(l=>enemy(b,{r:3+l,c:6}));cast(b,u);advance(b,3);
  const out=tagged(hits,'heyak:s3');assert.equal(out.length,3);
  for(const e of es){assert.equal(out.filter(h=>h.target===e).length,1);assert.ok(e.s.flags.levitate);}
  for(const h of out)assert.ok(h.amount>=u.base.atk*u.skill.bb['attack@min_atk_scale']*1.2
    &&h.amount<=u.base.atk*u.skill.bb['attack@max_atk_scale']*1.2+1e-5);
  near(u.s.interval,1.6+u.skill.bb.base_attack_time);
  assert.deepEqual(u.skill.spec.targeting.rangeGrid,u.skill.def.rangeGrid);
  advance(b,u.skill.timeLeft+.3);assert.equal(u.skill.active,false);near(u.s.interval,1.6);
});
test('S1 two emitted projectiles never lift, including when the other victim disappears in flight',()=>{
  const{b,u,hits}=make(),a=enemy(b,{c:6}),z=enemy(b,{r:4,c:6});cast(b,u,0);fire(b,u,[a,z]);
  advance(b,.41);assert.equal(b.projectiles.list.length,2);b.kill(z);advance(b,.3);
  const out=tagged(hits,'heyak:s1');assert.equal(out.length,1);near(out[0].amount,u.base.atk*3);
  assert.equal(!!a.s.flags.levitate,false);
});
test('S1 skips invalid release targets; the single emitted projectile retains its lift',()=>{
  const{b,u,hits}=make(),a=enemy(b),z=enemy(b,{r:4});cast(b,u,0);fire(b,u,[a,z]);b.kill(z);advance(b,.6);
  assert.equal(tagged(hits,'heyak:s1').length,1);assert.ok(a.s.flags.levitate);
});
test('normal aerial talent follows elite/potential; ground hits do not receive its damage or silence',()=>{
  for(const[elite,potential,scale]of[[0,1,1],[1,1,1.1],[1,5,1.13],[2,1,1.2],[2,5,1.23]]){
    const{b,u,hits}=make({elite,potential}),a=enemy(b,{fly:true}),z=enemy(b,{r:4});
    fire(b,u,a);advance(b,.7);fire(b,u,z);advance(b,.7);
    near(hits[0].amount,u.base.atk*scale);near(hits[1].amount,u.base.atk);
    assert.equal(!!a.s.flags.silence,elite>0);assert.equal(!!z.s.flags.silence,false);
  }
});
test('aerial targets and levitate-immune ground enemies obey source hit ordering',()=>{
  const{b,u,hits}=make(),a=enemy(b,{fly:true});cast(b,u,0);fire(b,u,a);advance(b,.6);
  assert.equal(!!a.s.flags.levitate,false);assert.ok(a.s.flags.silence);near(hits[0].amount,u.base.atk*3*1.2);
  const z=enemy(b);z.def.immune.add('levitate');cast(b,u,0);fire(b,u,z);advance(b,.6);
  assert.equal(!!z.s.flags.levitate,false);assert.equal(!!z.s.flags.silence,false);near(hits.at(-1).amount,u.base.atk*3);
});
test('Weightless refreshes HP on .4s source clock, uses strict native GT boundary and cleans on range exit',()=>{
  const{b,u}=make(),e=enemy(b,{mass:4});advance(b,.04);near(e.s.massLevel,3);
  e.hp=e.s.maxHp*.8;advance(b,.4);near(e.s.massLevel,4);
  e.hp=e.s.maxHp*.80001;advance(b,.4);near(e.s.massLevel,3);
  e.hp=e.s.maxHp*.79;advance(b,.1);near(e.s.massLevel,3);advance(b,.4);near(e.s.massLevel,4);
  e.hp=e.s.maxHp;advance(b,.4);near(e.s.massLevel,3);
  e.x=0;e.y=0;b._buildEnemyIndex();advance(b,.04);near(e.s.massLevel,4);
  e.x=5;e.y=3;b._buildEnemyIndex();advance(b,.04);near(e.s.massLevel,3);
  b.retreatOperator(ID);near(e.s.massLevel,4);
});
test('Weightless uses named nonstacking status and reduces the mass before Levitate duration is chosen',()=>{
  const{b,u}=make(),e=enemy(b,{mass:4});advance(b,.04);
  b.applyStatus(e,'weightless',{key:'test:other-weightless',value:1});near(e.s.massLevel,3);
  cast(b,u,0);fire(b,u,e);advance(b,.6);assert.ok(e.findBuff('levitate').timeLeft>3.8);
  b.retreatOperator(ID);near(e.s.massLevel,3);b.removeBuff(e,'test:other-weightless');near(e.s.massLevel,4);
});
test('S2 picks again for every release, including a newly entered enemy after first projectile',()=>{
  const{b,u,hits}=make({skill:1}),a=enemy(b);cast(b,u);fire(b,u,a);
  advance(b,.51);a.x=0;a.y=0;b._buildEnemyIndex();const z=enemy(b);advance(b,.6);
  const out=tagged(hits,'heyak:s2');assert.equal(out.length,9);
  assert.equal(out.filter(h=>h.target===a).length,1);assert.equal(out.filter(h=>h.target===z).length,8);
});
test('S2 successful lift boosts the same hit; already levitated targets do not refresh Levitate',()=>{
  const{b,u,hits}=make({skill:1}),e=enemy(b);b.rng=()=>0;cast(b,u);fire(b,u,e);advance(b,1.2);
  assert.equal(hits.length,9);for(const h of hits)near(h.amount,u.base.atk*.45*1.2);
  assert.ok(e.findBuff('levitate').timeLeft<.6);assert.ok(e.s.flags.silence);
});
test('control cancels unfired S2 hits while emitted delayed projectiles still land',()=>{
  const{b,u,hits}=make({skill:1}),e=enemy(b);cast(b,u);fire(b,u,e);advance(b,.51);
  b.applyStatus(u,'stun',{duration:.1});advance(b,.7);
  assert.equal(tagged(hits,'heyak:s2').length,1);
});
test('ordinary and S1 windups use source hit event capped at 1.2; stun interrupts before release',()=>{
  const{b,u,hits}=make({dir:'UP'}),e=enemy(b);b.addBuff(u,{key:'test:aspd',mods:{aspd:100}});
  fire(b,u,e);advance(b,.3);assert.equal(hits.length,0);advance(b,.2);assert.equal(hits.length,1);
  fire(b,u,e);b.applyStatus(u,'stun',{duration:.1});advance(b,.5);assert.equal(hits.length,1);
});
test('S3 allows target-free firing and preserves separate random birth delays',()=>{
  const{b,u}=make({skill:2});let i=0;b.rng=()=>[0,.5,.99][i++%3];cast(b,u);advance(b,.5);
  assert.equal(b.projectiles.list.filter(p=>p.data.heyakWind).length,1);
  advance(b,.2);assert.equal(b.projectiles.list.filter(p=>p.data.heyakWind).length,2);
  advance(b,.1);assert.equal(b.projectiles.list.filter(p=>p.data.heyakWind).length,3);
});
test('S3 queries a moving square, takes one nearest enemy and does not home or pierce',()=>{
  const{b,u,hits}=make({skill:2});b.rng=()=>0;
  const a=enemy(b,{c:5}),z=enemy(b,{c:6}),side=enemy(b,{r:5,c:5});cast(b,u);advance(b,2);
  assert.equal(tagged(hits,'heyak:s3').length,1);assert.equal(hits[0].target,a);assert.equal(z.hp,z.s.maxHp);
  assert.equal(side.hp,side.s.maxHp);assert.ok(b.projectiles.list.filter(p=>p.data.heyakWind).every(p=>p.target==null));
});
test('S3 uses elapsed-life native curve and current ATK at impact, not distance tooltip or a cast snapshot',()=>{
  const{b,u,hits}=make({skill:2});b.rng=()=>0;const e=enemy(b,{c:7});cast(b,u);advance(b,1);
  b.addBuff(u,{key:'test:atk',mods:{atkPct:1}});advance(b,2.5);
  const out=tagged(hits,'heyak:s3');assert.equal(out.length,1);near(out[0].amount,u.base.atk*2*4.2*1.2);
  assert.equal(out[0].target,e);
});
test('S3 delivered Back hit at .867 is presentation only; native .5 pre-delay controls release',()=>{
  const{b,u}=make({skill:2,dir:'UP'});b.rng=()=>0;cast(b,u);advance(b,.5);
  assert.equal(b.projectiles.list.filter(p=>p.data.heyakWind).length,3);
  assert.ok(b.projectiles.list.every(p=>p.y>u.y));
});
test('already emitted S3 winds survive retreat and lose the off-field aerial talent',()=>{
  const{b,u,hits}=make({skill:2});b.rng=()=>0;const e=enemy(b,{c:7});cast(b,u);advance(b,1);
  b.retreatOperator(ID);advance(b,2.5);const out=tagged(hits,'heyak:s3');assert.equal(out.length,1);
  near(out[0].amount,u.base.atk*4.2);assert.ok(e.s.flags.levitate);assert.equal(!!e.s.flags.silence,false);
  advance(b,3);assert.equal(b.projectiles.list.length,0);
});
test('S3 windup interrupted by transient control creates no delayed winds after recovery',()=>{
  const{b,u}=make({skill:2});b.rng=()=>0;cast(b,u);b.applyStatus(u,'stun',{duration:.1});advance(b,.7);
  assert.equal(b.projectiles.list.length,0);advance(b,3);assert.equal(b.projectiles.list.length,3);
});
test('source 4s lifetime expires in place, without snapping to a distant destination',()=>{
  const{b,u}=make({skill:2});b.rng=()=>0;cast(b,u);advance(b,.5);
  const p=b.projectiles.list.find(p=>p.data.heyakWind);assert.ok(p);u.skill.end('test');advance(b,4.1);
  assert.equal(b.projectiles.list.length,0);near(p.x-p.fromX,4,.035);assert.ok(p.x<p.tx);
});

test('damage-missable aerial silence skips dodge, but survives complete shield absorption',()=>{
  const{b,u,hits}=make(),e=enemy(b);b.addBuff(e,{key:'test:evade',mods:{dodgeArts:1}});
  cast(b,u,0);fire(b,u,e);advance(b,.6);assert.ok(e.s.flags.levitate);
  assert.equal(hits.length,0);assert.equal(!!e.s.flags.silence,false);
  b.removeBuff(e,'test:evade');b.addBuff(e,{key:'test:shield',shield:100000});
  const hp=e.hp;fire(b,u,e);advance(b,.6);near(e.hp,hp);assert.ok(e.s.flags.silence);
});

for(const [dir,dx,dy]of[['RIGHT',1,0],['UP',0,1],['LEFT',-1,0],['DOWN',0,-1]])
test(`S3 ${dir}: all three source lanes rotate with the game's row-up convention`,()=>{
  const{b,u}=make({skill:2,dir});b.rng=()=>0;cast(b,u);advance(b,.5);
  const ps=b.projectiles.list.filter(p=>p.data.heyakWind);assert.equal(ps.length,3);
  for(const p of ps){near(p.tx-p.fromX,dx*6);near(p.ty-p.fromY,dy*6);}
  const offsets=ps.map(p=>(p.fromX-u.x)*(-dy)+(p.fromY-u.y)*dx).sort((a,z)=>a-z);
  for(let i=0;i<3;i++)near(offsets[i],i-1);
});
test('S2 retreat cancels unfired repeats without deleting the already emitted projectile',()=>{
  const{b,u,hits}=make({skill:1}),e=enemy(b);cast(b,u);fire(b,u,e);advance(b,.51);
  b.retreatOperator(ID);advance(b,1);assert.equal(hits.length,1);
  near(hits[0].amount,u.base.atk*.45);assert.equal(b.projectiles.list.length,0);
});
test('S2 skill end cancels its unfinished volley, while issued shots still land',()=>{
  const{b,u,hits}=make({skill:1}),e=enemy(b);cast(b,u);fire(b,u,e);advance(b,.51);
  u.skill.end('test');advance(b,1);assert.equal(hits.length,1);assert.equal(u.mem.regularFormVisual,null);
});
test('Weightless and Resist compose before source Levitate duration; silence immunity does not remove aerial ATK',()=>{
  const{b,u,hits}=make(),e=enemy(b,{mass:4});e.hp=e.s.maxHp*.5;e.def.immune.add('silence');
  b.applyStatus(e,'resist',{duration:10,value:.5});cast(b,u,0);fire(b,u,e);advance(b,.6);
  near(hits[0].amount,u.base.atk*3*1.2);assert.equal(!!e.s.flags.silence,false);
  assert.ok(e.findBuff('levitate').timeLeft>.8&&e.findBuff('levitate').timeLeft<=1);
});
