// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-five-star-defender-second-prefabs.json' with { type: 'json' };
import { FIVE_STAR_DEFENDER_SECOND_OPERATORS as configs } from '../shared/arkpedia/five-star-defender-second-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, acquireTargets } from '../server/sim/ai.js';
const NEARL='char_148_nearl',HUNG='char_226_hmau',BASS='char_4109_baslin',CZERNY='char_4047_pianst',FANG='char_123_fang',KROOS='char_124_kroos',BEAGLE='char_122_beagle';
const near=(a,e,t=1e-5)=>assert.ok(Math.abs(a-e)<t,`${a} != ${e}`);
function advance(b,s){for(let i=0;i<Math.round(s/b.dt);i++)b.step();assert.deepEqual(b.errors,[]);}
function make(id,{skill=0,rank=10,elite=2,potential=1,others=[]}={}){
 const source=structuredClone(data);source.stage.geometry.waves[0].spawns=[];source.stage.battle.dp_per_second=0;
 const op=source.operators[id],build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,potential,skillId:op.skills[skill].id,skillRank:rank};
 const b=new StandardBattle(source,{operators:[build,...others.map(v=>defaultBuild(source.operators[v]))]});b.autoFinish=false;b.setViewport('fullscreen-workspace');
 const deploy=(who=id,r=3,c=4,dir='RIGHT')=>{b.addDp('arkpedia',99);const u=b.deployOperator(who,r,c,dir);assert.ok(u);u.atkCd=1000;return u;};return{b,deploy};
}
function cast(b,u){u.skill.setSpTotal(u.skill.spCost*u.skill.maxCharges);assert.equal(u.skill.activate('test'),true);u.atkCd=1000;u.skill.rule='NEVER';}
function enemy(b,{r=3,c=5,fly=false}={}){const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});e.base.maxHp=100000;e.base.atk=300;e.base.def=0;e.base.res=0;if(fly)e.motion='FLY';e.markDirty();void e.s;e.hp=100000;b.addBuff(e,{key:'test:pin',persist:true,flags:{disarm:true,noMove:true}});b._buildEnemyIndex();return e;}
function injured(b,u,hp=100){b.addBuff(u,{key:'test:health',mods:{hpFlat:10000}});void u.s;u.hp=hp;return u;}
const bb=(id,skill,rank=10)=>Object.fromEntries(data.operators[id].skills[skill].levels[rank-1].blackboard.map(v=>[v.key,v.value]));
const components=rows=>rows.flatMap(r=>r.components);
function findNode(x,suffix){if(!x||typeof x!=='object')return null;if(x.$type?.includes(suffix))return x;for(const v of Object.values(x)){let r=findNode(v,suffix);if(r)return r;}return null;}

test('four complete defenders preserve original hashes, exact eight skills, typed barrier and Senshi refusal',()=>{
 for(const[id,c]of Object.entries(configs)){
  assert.match(evidence.sourceBundles.find(x=>x.path===`charpack/${id}.ab`).sha256,/^[a-f0-9]{64}$/);
  assert.match(evidence.originalModels[id].Front.sha256,/^[a-f0-9]{64}$/);
  for(const s of c.skillIds)assert.ok(evidence.skills[s].length);
 }
 const barrier=findNode(evidence.buffTemplates.shield_magic,'+BlockDamage,');assert.equal(barrier._damageMask,'MAGICAL');assert.equal(barrier._filterDamageType,true);
 const source=components(evidence.skills.skchr_nearl_1).find(c=>c._maxHpRatio!==undefined);assert.equal(source._maxHpRatio,.5);assert.equal(source._maxHpExcludeEqual,0);
 const mana=findNode(evidence.buffTemplates['sensi_s_2[recover_magic]'],'+CheckTargetRootTile,');assert.deepEqual(mana._characterKeys,['char_4141_marcil']);
 assert.equal(evidence.runtimeMapping.char_4143_sensi.supported,false);assert.equal(configs.char_4143_sensi,undefined);
 assert.ok(evidence.deferredManaSource.components.some(c=>c._valueKey==='mana'&&c._period===1));
 assert.ok(evidence.verificationLimits.some(v=>v.includes('frame parity')));
});
test('all selected skill ranks, E0/E1/E2 and potential load without generic talent duplication',()=>{
 for(const[id,c]of Object.entries(configs))for(let skill=0;skill<2;skill++)for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make(id,{skill,rank}),u=deploy();assert.equal(u.skill.id,c.skillIds[skill]);assert.equal(u.skill.noSkill,false);assert.deepEqual(b.errors,[]);
 }
 for(const id of Object.keys(configs)){const{deploy}=make(id,{elite:0,rank:4});assert.equal(deploy().def.talents.length,0);}
});
test('normal defender output retains source event, facing animation cap and single physical target',()=>{
 for(const id of Object.keys(configs))for(const dir of ['RIGHT','UP']){
  const{b,deploy}=make(id),u=deploy(id,3,4,dir),e=enemy(b),other=enemy(b,{c:5.2});let time=evidence.originalModels[id][dir==='UP'?'Back':'Front'].hits.Attack[0];
  const p=effectiveProfile(u);near(p.windup(b,u),time);assert.equal(p.dmgType,'phys');b.forceAttack(u,[e]);u.atkCd=1000;
  advance(b,time-.1);near(e.hp,100000);advance(b,.2);near(100000-e.hp,u.s.atk);near(other.hp,100000);
  b.addBuff(u,{key:'test:fast',mods:{aspd:100}});near(p.windup(b,u),time/(id===HUNG?1:2));
 }
});
test('Nearl and Bassline first aid use inclusive half HP and selected charges/scale at every rank',()=>{
 for(const id of [NEARL,BASS])for(const rank of [1,7,10]){
  const{b,deploy}=make(id,{rank,others:[FANG]}),u=deploy(),a=injured(b,deploy(FANG,3,5));a.hp=a.s.maxHp*.5;const hp=a.hp;cast(b,u);
  assert.equal(u.skill.charges,u.skill.maxCharges-1);advance(b,.3);near(a.hp,hp);advance(b,.35);near(a.hp-hp,u.s.atk*bb(id,0,rank).heal_scale*(id===NEARL?1.1:1));
  a.hp=a.s.maxHp*.5001;advance(b,1);u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.activate('test'),false);
 }
});
test('first aid sees diagonal x-4 and self, but not isolated/heal-free/untargetable targets',()=>{
 for(const flag of ['isolated','noHeal','healFree','untargetable']){
  const{b,deploy}=make(BASS,{others:[KROOS]}),u=deploy(),a=injured(b,deploy(KROOS,4,5));u.skill.setSpTotal(u.skill.spCost);
  b.addBuff(a,{key:'test:flag',flags:{[flag]:true}});assert.equal(u.skill.activate('test'),false);b.removeBuff(a,'test:flag');
  b.addBuff(a,{key:'test:stealth',flags:{stealth:true}});assert.equal(u.skill.activate('test'),true);advance(b,.6);assert.ok(a.hp>100);
 }
 const{b,deploy}=make(BASS),u=injured(b,deploy());const hp=u.hp;cast(b,u);advance(b,.6);near(u.hp-hp,u.s.atk*1.8);
});
test('Nearl forceFront healing uses original Front event when facing Back and scales uncapped S1 ASPD',()=>{
 const{b,deploy}=make(NEARL,{others:[FANG]}),u=deploy(NEARL,3,4,'UP'),a=injured(b,deploy(FANG,3,5));b.addBuff(u,{key:'test:aspd',mods:{aspd:100}});cast(b,u);
 assert.equal(u.mem.regularFormVisual.forceFront,true);assert.equal(evidence.originalModels[NEARL].Back.hits.Skill,undefined);
 advance(b,.2);near(a.hp,100);advance(b,.1);near(a.hp-100,u.s.atk*1.8*1.1);
});
test('first aid refunds selected dead target and never resumes after brief control or withdrawal',()=>{
 for(const id of [NEARL,HUNG,BASS])for(const mode of ['death','control','retreat']){
  const{b,deploy}=make(id,{others:[FANG]}),u=deploy(),a=injured(b,deploy(FANG,3,5));cast(b,u);const charges=u.skill.charges;advance(b,.1);
  if(mode==='death')b.kill(a,null);else if(mode==='control')b.applyStatus(u,'stun',{duration:.1});else b.retreat(u);
  advance(b,1.3);if(mode==='death')assert.equal(u.skill.charges,charges+1);else near(a.hp,100);
 }
});
test('Nearl outgoing healing talent follows source self E1 and global E2, with potential and isolation cleanup',()=>{
 for(const [elite,potential,scale]of [[0,1,1],[1,1,1.1],[1,5,1.12],[2,1,1.1],[2,5,1.12]]){
  const{b,deploy}=make(NEARL,{elite,potential,rank:elite===0?4:7,others:[FANG,BEAGLE]}),u=deploy(),a=deploy(FANG,3,5),t=injured(b,deploy(BEAGLE,3,6));
  near(u.s.healingDealtMul,scale);near(a.s.healingDealtMul,elite===2?scale:1);b.heal(a,t,100);near(t.hp-100,elite===2?100*scale:100);
  b.addBuff(a,{key:'test:foreign-healing',mods:{healingDealtMul:1.3}});b.addBuff(a,{key:'test:isolate',flags:{isolated:true}});advance(b,.1);near(a.s.healingDealtMul,1.3);
  b.removeBuff(a,'test:isolate');advance(b,.1);near(a.s.healingDealtMul,1.3*(elite===2?scale:1));b.retreat(u);near(a.s.healingDealtMul,1.3);
 }
});
test('Nearl S2 uses original percentage BAT, heals while blocked, selected ATK and clean reversion',()=>{
 const{b,deploy}=make(NEARL,{skill:1,others:[FANG]}),u=deploy(),a=injured(b,deploy(FANG,3,5)),e=enemy(b);const bat=u.s.bat,atk=u.s.atk;cast(b,u);
 near(u.s.bat,bat*(1+bb(NEARL,1).base_attack_time));near(u.s.atk,atk*1.8);const p=effectiveProfile(u);assert.equal(p.dmgType,'heal');assert.equal(u.mem.regularAttackFacing,'Front');assert.deepEqual(acquireTargets(b,u,p),[a]);
 b.forceAttack(u,[a]);u.atkCd=1000;advance(b,.4);near(a.hp,100);advance(b,.25);near(a.hp-100,u.s.atk*1.1);near(e.hp,100000);
 u.skill.end('test');assert.equal(u.mem.regularAttackFacing,null);near(u.s.bat,bat);near(u.s.atk,atk);assert.equal(effectiveProfile(u).dmgType,'phys');
});
test('Hung S1 heals injured targets above half, original Skill event and speed15 projectile delay',()=>{
 const{b,deploy}=make(HUNG,{others:[FANG]}),u=deploy(),a=injured(b,deploy(FANG,3,5));a.hp=a.s.maxHp*.8;const hp=a.hp;cast(b,u);
 let projectiles=0;const native=b.addProjectile.bind(b);b.addProjectile=o=>{near(o.speed,15);projectiles++;return native(o);};advance(b,.4);near(a.hp,hp);advance(b,.15);assert.equal(projectiles,1);near(a.hp-hp,u.s.atk*1.7);
});
test('Hung healing bonus applies to high-ground recipient behind facing only, not healing received by Hung',()=>{
 for(const dir of ['DOWN','UP']){
  const{b,deploy}=make(HUNG,{others:[KROOS,FANG]}),u=deploy(HUNG,3,4,dir),high=injured(b,deploy(KROOS,2,4)),low=injured(b,deploy(FANG,3,5));
  near(u.s.def,u.base.def*1.06);b.heal(u,high,100);near(high.hp-100,dir==='UP'?175:100);b.heal(u,low,100);near(low.hp-100,100);
  u.hp=100;b.heal(low,u,100);near(u.hp-100,100);
 }
 const{b,deploy}=make(HUNG,{potential:5,others:[KROOS]}),u=deploy(HUNG,3,4,'UP'),a=injured(b,deploy(KROOS,2,4));b.heal(u,a,100);near(a.hp-100,185);near(u.s.def,u.base.def*1.08);
});
test('Hung S2 flat BAT and outgoing target SP respect active/no-SP recipients and skill expiry',()=>{
 const{b,deploy}=make(HUNG,{skill:1,others:[FANG,BEAGLE]}),u=deploy(),a=injured(b,deploy(FANG,3,5)),locked=injured(b,deploy(BEAGLE,3,3));const bat=u.s.bat,atk=u.s.atk,def=u.s.def;
 cast(b,u);near(u.s.bat,bat+1.3);near(u.s.atk,atk*1.8);near(u.s.def,def+u.base.def*.8);a.skill.setSpTotal(0);b.heal(u,a,100);near(a.skill.sp,1);
 locked.skill.setSpTotal(locked.skill.spCost);assert.equal(locked.skill.activate('test'),true);locked.skill.rule='NEVER';locked.skill.setSpTotal(0);b.heal(u,locked,100);near(locked.skill.sp,0);
 b.addBuff(a,{key:'test:no-sp',flags:{noSp:true}});b.heal(u,a,100);near(a.skill.sp,1);b.removeBuff(a,'test:no-sp');u.skill.end('test');b.heal(u,a,100);near(a.skill.sp,1);near(u.s.bat,bat);near(u.s.atk,atk);near(u.s.def,def);
});
test('Hung launched healing survives retreat while an interrupted unfired heal does not',()=>{
 for(const fired of [false,true]){
  const{b,deploy}=make(HUNG,{others:[KROOS]}),u=deploy(),a=injured(b,deploy(KROOS,4,5));cast(b,u);advance(b,fired?.45:.1);b.retreat(u);advance(b,.6);assert.equal(a.hp>100,fired);
 }
});
test('Bassline talent source adjacent operator toggles flat RES with diagonal, departure and isolation',()=>{
 const{b,deploy}=make(BASS,{others:[FANG,KROOS]}),u=deploy(),far=deploy(FANG,3,6);near(u.s.res,u.base.res+12);const diagonal=deploy(KROOS,4,5);near(u.s.res,u.base.res+16);
 b.addBuff(diagonal,{key:'test:isolation',flags:{isolated:true}});advance(b,.1);near(u.s.res,u.base.res+16);b.retreat(diagonal);advance(b,.1);near(u.s.res,u.base.res+12);b.retreat(far);advance(b,.1);near(u.s.res,u.base.res+12);
});
test('Bassline S2 typed shield uses current ATK, compares remaining value and never adds to a stronger barrier',()=>{
 const{b,deploy}=make(BASS,{skill:1,others:[FANG]}),u=deploy(),a=injured(b,deploy(FANG,3,5));const bat=u.s.bat;cast(b,u);advance(b,.35);near(u.s.bat,bat+1.3);
 const p=effectiveProfile(u);b.forceAttack(u,[a]);u.atkCd=1000;advance(b,.6);const amount=u.s.atk*.6,barrier=a.findBuff('baslin_s2[shield]');near(barrier.shield,amount);assert.deepEqual(barrier.shieldTypes,['arts']);
 b.forceAttack(u,[a]);u.atkCd=1000;advance(b,.6);near(a.findBuff('baslin_s2[shield]').shield,amount);
 a.findBuff('baslin_s2[shield]').shield=amount*.4;b.forceAttack(u,[a]);u.atkCd=1000;advance(b,.6);near(a.findBuff('baslin_s2[shield]').shield,amount);
 b.addBuff(u,{key:'test:less-atk',mods:{atkPct:-.5}});b.forceAttack(u,[a]);u.atkCd=1000;advance(b,.6);near(a.findBuff('baslin_s2[shield]').shield,amount);assert.equal(p.dmgType,'heal');
});
test('Bassline barrier absorbs mitigated Arts only and preserves Physical, True and HP-loss boundaries',()=>{
 const{b,deploy}=make(BASS,{skill:1,others:[FANG]}),u=deploy(),a=injured(b,deploy(FANG,3,5),5000),e=enemy(b);cast(b,u);advance(b,.35);b.forceAttack(u,[a]);u.atkCd=1000;advance(b,.6);
 let shield=a.findBuff('baslin_s2[shield]').shield,hp=a.hp;b.dealDamage(e,a,{amount:100,type:'arts'});near(a.hp,hp);near(a.findBuff('baslin_s2[shield]').shield,shield-100);
 shield=a.findBuff('baslin_s2[shield]').shield;b.dealDamage(e,a,{amount:1000,type:'phys'});assert.ok(a.hp<hp);near(a.findBuff('baslin_s2[shield]').shield,shield);hp=a.hp;
 b.dealDamage(e,a,{amount:100,type:'true'});near(hp-a.hp,100);near(a.findBuff('baslin_s2[shield]').shield,shield);hp=a.hp;b.loseHp(a,50,{source:e});near(hp-a.hp,50);near(a.findBuff('baslin_s2[shield]').shield,shield);
});
test('Bassline source finish clears shared barriers in x-4 despite target-free, preserves unrelated/outside barriers',()=>{
 const{b,deploy}=make(BASS,{skill:1,others:[FANG,BEAGLE]}),u=deploy(),nearby=deploy(FANG,3,5),far=deploy(BEAGLE,3,6);cast(b,u);
 for(const a of [u,nearby,far]){b.addBuff(a,{key:'baslin_s2[shield]',source:far,shield:100,shieldTypes:['arts']});b.addBuff(a,{key:'test:unrelated',shield:200});}
 b.addBuff(nearby,{key:'test:free',flags:{isolated:true,untargetable:true,healFree:true}});u.skill.end('test');
 assert.equal(u.findBuff('baslin_s2[shield]'),null);assert.equal(nearby.findBuff('baslin_s2[shield]'),null);assert.ok(far.findBuff('baslin_s2[shield]'));for(const a of [u,nearby,far])assert.ok(a.findBuff('test:unrelated'));
});
test('Bassline source begin/end prevent attack leakage and retreat clears local barriers',()=>{
 const{b,deploy}=make(BASS,{skill:1,others:[FANG]}),u=deploy(),a=injured(b,deploy(FANG,3,5)),e=enemy(b);cast(b,u);u.atkCd=0;advance(b,.2);near(a.hp,100);near(e.hp,100000);advance(b,.7);assert.ok(a.findBuff('baslin_s2[shield]'));b.retreat(u);assert.equal(a.findBuff('baslin_s2[shield]'),null);
});
test('Czerny talent selected RES and normal Arts counter filter retain shields, cancellation and damage origin',()=>{
 for(const[elite,potential,res,scale]of [[0,1,0,0],[1,1,5,.5],[2,1,10,.8],[2,5,10,.85]]){
  const{b,deploy}=make(CZERNY,{elite,potential,rank:elite===0?4:7}),u=deploy(),e=enemy(b);near(u.s.res,u.base.res+res);b.addBuff(u,{key:'test:shield',shield:100000});
  b.dealDamage(e,u,{amount:100,type:'arts',isAttack:true});near(100000-e.hp,u.s.atk*scale);let hp=e.hp;
  b.dealDamage(e,u,{amount:100,type:'phys',isAttack:true});b.dealDamage(e,u,{amount:100,type:'arts',isAttack:false,isSkill:true});b.loseHp(u,10,{source:e});near(e.hp,hp);
  b.addBuff(u,{key:'test:dodge',mods:{dodgeArts:1}});b.dealDamage(e,u,{amount:100,type:'arts',isAttack:true});near(hp-e.hp,u.s.atk*scale);
 }
});
test('Czerny S1 selected ATK and RES multiply after flat talent, Arts mode and expiry at every rank',()=>{
 for(const rank of [1,7,10]){const{b,deploy}=make(CZERNY,{rank}),u=deploy(),atk=u.s.atk,res=u.s.res;cast(b,u);near(u.s.atk,atk*(1+bb(CZERNY,0,rank).atk));near(u.s.res,res*(1+bb(CZERNY,0,rank).magic_resistance));assert.equal(effectiveProfile(u).dmgType,'arts');u.skill.end('test');near(u.s.atk,atk);near(u.s.res,res);assert.equal(effectiveProfile(u).dmgType,'phys');}
});
test('Czerny S2 receipts stack selected ATK to source cap, including blocked/dodged hits but excluding skill-only HP loss',()=>{
 for(const rank of [1,7,10]){
  const{b,deploy}=make(CZERNY,{skill:1,rank}),u=deploy(),e=enemy(b);const atk=u.s.atk,maxHp=u.s.maxHp;cast(b,u);near(u.s.maxHp,maxHp*(1+bb(CZERNY,1,rank).max_hp));near(u.s.taunt,1);b.addBuff(u,{key:'test:shield',shield:100000});
  for(let i=0;i<25;i++)b.dealDamage(e,u,{amount:100,type:'phys',isAttack:true});near(u.s.atk,atk*(1+bb(CZERNY,1,rank).atk*bb(CZERNY,1,rank).max_stack_cnt));assert.equal(u.mem.czernyStacks,bb(CZERNY,1,rank).max_stack_cnt);
  u.skill.end('test');near(u.s.atk,atk);near(u.s.maxHp,maxHp);near(u.s.taunt,0);assert.equal(u.findBuff('czerny:attack-stacks'),null);
 }
 const{b,deploy}=make(CZERNY,{skill:1}),u=deploy(),e=enemy(b);cast(b,u);b.addBuff(u,{key:'test:dodge',mods:{dodgePhys:1}});b.dealDamage(e,u,{amount:100,type:'phys',isAttack:true});assert.equal(u.mem.czernyStacks,1);b.dealDamage(e,u,{amount:100,type:'arts',isAttack:false});b.loseHp(u,1,{source:e});assert.equal(u.mem.czernyStacks,1);
});
test('Czerny FinalAttack source timer and non-event .5 release hit ALL motion within x-1 at live stacked ATK',()=>{
 const{b,deploy}=make(CZERNY,{skill:1}),u=deploy(),e=enemy(b),air=enemy(b,{r:2,c:4,fly:true}),edge=enemy(b,{c:6}),far=enemy(b,{c:7});cast(b,u);b.addBuff(u,{key:'test:shield',shield:100000});
 advance(b,18.7);assert.equal(u.mem.czernyFinishing,true);near(e.hp,100000);b.dealDamage(e,u,{amount:100,type:'phys',isAttack:true});const amount=u.s.atk*2.5;
 advance(b,.3);near(e.hp,100000);advance(b,.2);for(const x of [e,air,edge])near(100000-x.hp,amount);near(far.hp,100000);advance(b,1.2);assert.equal(u.skill.active,false);assert.equal(u.findBuff('czerny:attack-stacks'),null);
});
test('Czerny final attack cancels permanently on early end, death, retreat or brief control',()=>{
 for(const mode of ['end','death','retreat','control']){
  const{b,deploy}=make(CZERNY,{skill:1}),u=deploy(),e=enemy(b);cast(b,u);advance(b,18.7);
  if(mode==='end')u.skill.end('test');else if(mode==='death')b.kill(u,null);else if(mode==='retreat')b.retreat(u);else b.applyStatus(u,'stun',{duration:.1});
  advance(b,2);near(e.hp,100000);
 }
});


test('Hung S2 fires its actual original speed15 heal projectile rather than bypassing launch through generic healing',()=>{
 const{b,deploy}=make(HUNG,{skill:1,others:[FANG]}),u=deploy(),a=injured(b,deploy(FANG,3,5));cast(b,u);
 let shots=0;const add=b.addProjectile.bind(b);b.addProjectile=o=>{near(o.speed,15);assert.equal(o.target,a);shots++;return add(o);};
 b.forceAttack(u,[a]);u.atkCd=1000;advance(b,.4);near(a.hp,100);advance(b,.15);assert.equal(shots,1);near(a.hp-100,u.s.atk);
});
test('Nearl S2 source forced Front resets on both retirement and death',()=>{
 for(const mode of ['retreat','death']){const{b,deploy}=make(NEARL,{skill:1}),u=deploy(NEARL,3,4,'UP');cast(b,u);assert.equal(u.mem.regularAttackFacing,'Front');if(mode==='retreat')b.retreat(u);else b.kill(u,null);assert.equal(u.mem.regularAttackFacing,null);}
});
test('Nearl E2 default aura excludes untargetable targets without erasing foreign healing modifiers',()=>{
 const{b,deploy}=make(NEARL,{others:[FANG]}),u=deploy(),a=deploy(FANG,3,5);near(a.s.healingDealtMul,1.1);
 b.addBuff(a,{key:'test:foreign',mods:{healingDealtMul:1.3}});b.addBuff(a,{key:'test:free',flags:{untargetable:true}});advance(b,.1);near(a.s.healingDealtMul,1.3);b.removeBuff(a,'test:free');advance(b,.1);near(a.s.healingDealtMul,1.43);b.retreat(u);near(a.s.healingDealtMul,1.3);
});
