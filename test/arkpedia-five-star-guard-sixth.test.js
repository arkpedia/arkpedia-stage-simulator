// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-five-star-guard-sixth-prefabs.json' with { type: 'json' };
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { FIVE_STAR_GUARD_SIXTH_OPERATORS } from '../shared/arkpedia/five-star-guard-sixth-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
const NOIR='char_1030_noirc2',DOC='char_4125_rdoc',LAIOS='char_4142_laios',TACH='char_459_tachak';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
function make(id, opts={}, extras=[]){const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];
 const b=new StandardBattle(d,{operators:[{...defaultBuild(d.operators[id]),...opts},...extras.map(x=>defaultBuild(d.operators[x]))]});
 b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);return b;}
function deploy(b,id,r=2,c=7){b.addDp('arkpedia',99);const u=b.deployOperator(id,r,c,'RIGHT');u.atkCd=1000;return u;}
function enemy(b,x=8,y=2){const e=b.spawnEnemy('enemy_1007_slime',{routeIndex:1});e.x=x;e.y=y;e.base.maxHp=100000;e.base.def=e.base.res=e.base.moveSpeed=0;e.markDirty();e.s;e.hp=100000;b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;}
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function cast(u,n=1){u.skill.setSpTotal(u.skill.spCost*n);assert.equal(u.skill.activate('test'),true);}
function hit(b,u,e,s=1){const hp=e.hp;u.atkCd=1000;b.forceAttack(u,[e]);advance(b,s);u.atkCd=1000;return hp-e.hp;}
const comps=rs=>rs.flatMap(r=>r.components);

test('sixth guards keep exact original source hashes, ten skills and Fuze exclusion',()=>{
 assert.equal(evidence.sourceVersion,'26-09-23-17-49-43_b9cc4a');assert.equal(Object.keys(evidence.skills).length,10);
 assert.equal(FIVE_STAR_GUARD_SIXTH_OPERATORS.char_4126_fuze,undefined);assert.equal(data.operators.char_4126_fuze,undefined);
 for(const[id,cfg]of Object.entries(FIVE_STAR_GUARD_SIXTH_OPERATORS)){assert.equal(data.operators[id].skills.length,2);
  assert.match(evidence.sourceBundles.find(x=>x.path===`charpack/${id}.ab`).sha256,/^[a-f0-9]{64}$/);
  for(const face of['Front','Back'])assert.match(evidence.originalModels[id][face].sha256,/^[a-f0-9]{64}$/);
  for(const skill of cfg.skillIds)assert.ok(evidence.skills[skill]);}
 assert.equal(comps(evidence.skills.skchr_laios_1).find(c=>c._enemyLevelMask)._enemyLevelMask,4);
 assert.deepEqual(evidence.originalModels[NOIR].Front.hits.Skill_2,[.467,.533,.6,.667,.733,.8,.867]);
 assert.equal(comps(evidence.skills.skchr_fuze_2).find(c=>c._additionalTimes===4)._offset,.25);
 const bat=comps(evidence.skills.skchr_rdoc_1).flatMap(c=>c._buffs??[]).find(b=>b.buffKey==='rdoc_s1[switch_mode]').attributes.attributeModifiers[0];
 assert.equal(bat.attributeType,8);assert.equal(bat.formulaItem,0);
 assert.deepEqual(evidence.ranges['x-5'],[[1,0],[0,-1],[0,0],[0,1],[-1,0]]);
});

test('all supported skills retain ten selected source ranks and real controller specs',()=>{
 for(const[id,cfg]of Object.entries(FIVE_STAR_GUARD_SIXTH_OPERATORS))for(const sid of cfg.skillIds)for(let rank=1;rank<=10;rank++){
  const b=make(id,{skillId:sid,skillRank:rank}),u=deploy(b,id);assert.equal(u.skill.id,sid);assert.equal(u.skill.noSkill,false);
  near(u.skill.spCost,u.def.skill.spCost);assert.equal(u.skill.maxCharges,u.def.skill.maxCharges);
  if(sid==='skchr_rdoc_1')near(u.skill.ammo,u.def.skill.bb['attack@trigger_time']);
 }
});

test('Rathalos source promotion tenacity/heal values and allied heal refusal',()=>{
 for(const[elite,value,aspd,def,hp]of[[0,30,30,.3,.5],[1,50,40,.4,.4],[2,70,50,.5,.3]]){
  const b=make(NOIR,{elite,level:elite===0?50:elite===1?70:80,skillRank:elite===0?4:7}),u=deploy(b,NOIR),e=enemy(b);
  u.hp=u.s.maxHp*hp;advance(b,.27);near(u.s.aspd,u.base.aspd+aspd);near(u.s.def,u.base.def*(1+(u.def.talents[0].bb.def??def)));
  const before=u.hp;hit(b,u,e,.6);near(u.hp,before+value);assert.equal(b.heal(null,u,100),0);
 }
});

test('Rathalos blade levels count actual inactive outputs, cap three and reset partial on gaps/control',()=>{
 const b=make(NOIR),u=deploy(b,NOIR),e=enemy(b),base=u.base.atk;
 for(let i=0;i<15;i++)hit(b,u,e,.6);assert.equal(u.mem.noirBlade,3);near(u.s.atk,base*1.21);
 for(let i=0;i<5;i++)hit(b,u,e,.6);assert.equal(u.mem.noirBlade,3);
 u.mem.noirCount=3;advance(b,2);hit(b,u,e,.6);assert.equal(u.mem.noirCount,1);
 b.applyStatus(u,'stun',{duration:.1,source:e});assert.equal(u.mem.noirCount,0);advance(b,.2);
 cast(u);assert.equal(u.mem.noirCount,0);assert.equal(u.mem.regularSpineSkin,'Red');assert.equal(u.mem.regularSpineSkinKey,'RedBlade');
});

test('Rathalos S1 .4 sheath boundary guards exactly one true hit then four source-separated strikes',()=>{
 const b=make(NOIR),u=deploy(b,NOIR),e=enemy(b);e.base.def=100;e.markDirty();u.hp-=500;cast(u);
 const hp=u.hp;b.dealDamage(e,u,{amount:30,type:'true'});near(u.hp,hp-30);advance(b,.42);
 const before=u.hp;b.dealDamage(e,u,{amount:50,type:'true'});near(u.hp,before);
 b.dealDamage(e,u,{amount:10,type:'true'});near(u.hp,before-10);advance(b,.15);
 const first=u.base.atk*1.5-100;near(100000-e.hp,first);assert.equal(u.mem.noirBlade,1);
 advance(b,.6);near(100000-e.hp,first+3*(u.base.atk*1.07*1.5-100));
 advance(b,.5);assert.equal(u.skill.active,false);assert.equal(u.mem.noirGuard,false);
});

test('Rathalos S1 own skill kill re-sheathes free while unrelated kills and timeout do not',()=>{
 const b=make(NOIR),u=deploy(b,NOIR),e=enemy(b);e.hp=10;cast(u);advance(b,.42);
 b.dealDamage(e,u,{amount:20,type:'true'});advance(b,1.1);assert.equal(u.skill.active,true);assert.equal(u.mem.noirGuard,false);
 advance(b,.42);assert.equal(u.mem.noirGuard,true);assert.equal(u.skill.activations,1);
 b.kill(enemy(b),null);advance(b,6.1);assert.equal(u.skill.active,false);
});

test('Rathalos counter blade gain follows accepted source output, excluding dodge but retaining shielded output',()=>{
 for(const dodge of[true,false]){
  const b=make(NOIR),u=deploy(b,NOIR),e=enemy(b);b.addBuff(e,{key:'test:output',...(dodge?{mods:{dodgePhys:1}}:{shield:100000})});
  cast(u);advance(b,.42);b.dealDamage(e,u,{amount:10,type:'true'});advance(b,.8);
  near(e.hp,100000);assert.equal(u.mem.noirBlade,dodge?0:1);
 }
});

test('Rathalos guard ignores HP loss and control cancels reaction without late strikes',()=>{
 for(const mode of['loss','stun','withdraw']){
  const b=make(NOIR),u=deploy(b,NOIR),e=enemy(b);cast(u);advance(b,.42);
  if(mode==='loss'){const hp=u.hp;b.loseHp(u,15,{source:e});near(u.hp,hp-15);assert.equal(u.mem.noirGuard,true);}
  else{b.dealDamage(e,u,{amount:20,type:'true'});if(mode==='stun')b.applyStatus(u,'stun',{duration:.05,source:e});else b.retreatOperator(NOIR);
   advance(b,.5);near(e.hp,100000);assert.equal(u.skill.active,false);}
 }
});

test('Rathalos S2 seven original events use full mitigation, no normal leakage, and consume one blade',()=>{
 const b=make(NOIR,{skillId:'skchr_noirc2_2'}),u=deploy(b,NOIR),e=enemy(b);e.base.def=100;e.markDirty();
 u.mem.noirBlade=2;b.addBuff(u,{key:'noirc2:blade',mods:{atkPct:.14},source:u});cast(u,2);const one=u.s.atk*1.8-100;
 advance(b,.45);near(e.hp,100000);advance(b,.06);near(100000-e.hp,one);advance(b,.4);near(100000-e.hp,7*one);
 assert.equal(u.stats.attacks,0);advance(b,.6);assert.equal(u.skill.active,false);assert.equal(u.mem.noirBlade,1);near(u.s.atk,u.base.atk*1.07);
 assert.equal(u.skill.charges,1);
});

test('Rathalos S2 interrupted startup cannot resume after control recovery',()=>{
 const b=make(NOIR,{skillId:'skchr_noirc2_2'}),u=deploy(b,NOIR),e=enemy(b);cast(u);advance(b,.1);
 b.applyStatus(u,'stun',{source:e,duration:.05});advance(b,1.5);near(e.hp,100000);assert.equal(u.mem.noirBlade,0);
});

test('Rathalos source S2 alone selects airborne enemies and preserves ordinary source priority',()=>{
 const b=make(NOIR,{skillId:'skchr_noirc2_2'}),u=deploy(b,NOIR),e=enemy(b);e.motion='FLY';
 assert.equal(acquireTargets(b,u,u.profile).length,0);cast(u);advance(b,.95);near(100000-e.hp,7*u.s.atk*u.def.skill.bb.multi_atk_scale);
 const c=make(NOIR,{skillId:'skchr_noirc2_2'}),v=deploy(c,NOIR,2,5),late=enemy(c,5,2),urgent=enemy(c,6,2);
 c.addBuff(urgent,{key:'test:taunt',mods:{taunt:10}});cast(v);advance(c,.95);near(late.hp,100000);assert.ok(urgent.hp<100000);
});

test('Doc instructor rider and source fixed DEF penetration apply per actual projectile victim',()=>{
 const b=make(DOC),u=deploy(b,DOC),e=enemy(b);e.base.def=300;e.markDirty();
 const dmg=hit(b,u,e,.6);near(dmg,u.s.atk*1.2-(300-u.def.talents[0].bb.def_penetrate_fixed));e.x=7.2;e.blockedBy=u;u.blocking=[e];b._buildEnemyIndex();
 near(hit(b,u,e,.6),u.s.atk-(300-u.def.talents[0].bb.def_penetrate_fixed));assert.equal(u.stats.attacks,2);
});

test('Doc source instructor damage rider excludes enemies blocked by Doc using the live Unit reference',()=>{
 for(const blocked of[false,true]){
  const b=make(DOC),u=deploy(b,DOC),e=enemy(b,blocked?7.2:8,2);e.base.def=300;e.markDirty();
  if(blocked){e.blockedBy=u;u.blocking=[e];}const damage=hit(b,u,e,.6);
  near(damage,u.s.atk*(blocked?1:1.2)-(300-u.def.talents[0].bb.def_penetrate_fixed));
 }
});

test('Doc S1 heals at original event, enters31-ammo stance after heal, subtracts BAT seconds and returns',()=>{
 const b=make(DOC),u=deploy(b,DOC),e=enemy(b);u.hp-=200;const hp=u.hp;cast(u);advance(b,.42);near(u.hp,hp);
 advance(b,.06);near(u.hp,u.s.maxHp);near(u.s.bat,u.base.bat);advance(b,1.1);near(u.s.bat,u.base.bat-.7);
 assert.equal(u.skill.ammoLeft,31);hit(b,u,e,.2);assert.equal(u.skill.ammoLeft,30);
 u.skill.end('manual');advance(b,.43);near(u.s.bat,u.base.bat);assert.equal(u.mem.sixthCast,null);
});

test('Doc limited uses are per deployment and interrupted/manual casts cannot leave locks or delayed healing',()=>{
 const b=make(DOC),u=deploy(b,DOC),e=enemy(b);u.hp-=400;
 for(let i=0;i<3;i++){cast(u);u.skill.end('manual');advance(b,.43);}
 assert.equal(u.skill.spec.remainingUses(),0);u.skill.setSpTotal(100);assert.equal(u.skill.activate('test'),false);
 const hp=u.hp;advance(b,2);near(u.hp,hp);assert.equal(u.findBuff(`guard-sixth:cast:${u.id}`),null);
 b.retreatOperator(DOC);advance(b,80);const next=deploy(b,DOC);assert.equal(next.skill.spec.remainingUses(),3);
 cast(next);advance(b,.1);b.applyStatus(next,'stun',{source:e,duration:.05});const after=next.hp;advance(b,1.5);near(next.hp,after);assert.equal(next.skill.active,false);
});

test('Doc healing excess creates own current-amount floor-decaying barrier after1s and leaves foreign shields',()=>{
 const b=make(DOC,{skillId:'skchr_rdoc_2'}),u=deploy(b,DOC);
 b.addBuff(u,{key:'foreign:shield',shield:900});b.heal(u,u,105);const shield=u.findBuff('rdoc:barrier');near(shield.shield,105);
 advance(b,.98);near(shield.shield,105);advance(b,.05);near(shield.shield,103);
 advance(b,.12);near(shield.shield,101);assert.equal(u.findBuff('foreign:shield').shield,900);
 const hp=u.hp;b.dealDamage(null,u,{amount:50,type:'true'});near(u.hp,hp);near(shield.shield,51);near(u.findBuff('foreign:shield').shield,900);
 b.heal(u,u,20);near(shield.shield,71);advance(b,.12);assert.ok(shield.shield<71);
});

test('Doc barrier cap follows live Doc ATK, E1 faster decay, zero excess and foreign healing exclusions',()=>{
 for(const elite of[0,1,2]){
  const b=make(DOC,{elite,level:elite===0?50:elite===1?70:80,skillRank:elite===0?4:7}),u=deploy(b,DOC);
  u.hp-=20;b.heal(u,u,20);assert.equal(u.findBuff('rdoc:barrier'),null);b.heal(null,u,50);assert.equal(u.findBuff('rdoc:barrier'),null);
  b.heal(u,u,1e6);const shield=u.findBuff('rdoc:barrier');
  if(!elite){assert.equal(shield,null);continue;}near(shield.shield,u.s.atk*50);const initial=shield.shield;
  advance(b,1.03);near(shield.shield,initial+Math.floor(initial*(elite===1?-.2:-.1)*.1));
 }
});

test('Doc S2 traverses at speed5 and heals first ground operator only, ignores enemies/token/free targets',()=>{
 const b=make(DOC,{skillId:'skchr_rdoc_2'},['char_281_popka','char_122_beagle']),u=deploy(b,DOC,2,5);
 const first=deploy(b,'char_281_popka',2,6),second=deploy(b,'char_122_beagle',2,7);first.hp-=400;second.hp-=400;
 const hp1=first.hp,hp2=second.hp;enemy(b,5.5,2);cast(u);advance(b,.34);near(first.hp,hp1);advance(b,.24);
 near(first.hp,first.s.maxHp);near(second.hp,hp2);assert.ok(first.findBuff('rdoc:barrier'));
 const barrier=first.findBuff('rdoc:barrier').shield;b.addBuff(first,{key:'test:heal-free',flags:{healFree:true}});
 advance(b,.6);cast(u);advance(b,.9);near(second.hp,second.s.maxHp);assert.ok(first.findBuff('rdoc:barrier').shield<=barrier);
});

test('Doc S2 is uninterruptible during predelay but a withdrawn deployment cannot emit late shots',()=>{
 for(const mode of['stun','withdraw']){
  const b=make(DOC,{skillId:'skchr_rdoc_2'},['char_281_popka']),u=deploy(b,DOC,2,5),a=deploy(b,'char_281_popka',2,6);a.hp-=300;const hp=a.hp;
  cast(u);advance(b,.1);if(mode==='stun')b.applyStatus(u,'stun',{duration:.5});else b.retreatOperator(DOC);
  advance(b,.6);near(a.hp,mode==='stun'?a.s.maxHp:hp);
 }
});

test('Doc healing dart passes an isolated ally and friendly stealth does not obstruct legal healing',()=>{
 for(const isolated of[true,false]){
  const b=make(DOC,{skillId:'skchr_rdoc_2'},['char_281_popka','char_122_beagle']),u=deploy(b,DOC,2,5);
  const first=deploy(b,'char_281_popka',2,6),second=deploy(b,'char_122_beagle',2,7);first.hp-=400;second.hp-=400;
  const hp1=first.hp,hp2=second.hp;b.addBuff(first,{key:'test:eligibility',flags:isolated?{isolated:true}:{stealth:true}});
  cast(u);advance(b,.9);near(first.hp,isolated?hp1:first.s.maxHp);near(second.hp,isolated?second.s.maxHp:hp2);
 }
});

test('Laios strict HP vigor responds to current HP and uses actual Boss rank only once per character battle',()=>{
 const b=make(LAIOS),u=deploy(b,LAIOS),e=enemy(b);near(u.s.atk,u.base.atk*1.7);
 u.hp=u.s.maxHp*.5;advance(b,.03);near(u.s.atk,u.base.atk);u.hp+=1;advance(b,.03);near(u.s.atk,u.base.atk*1.7);
 e.isBoss=true;advance(b,.1);assert.equal(u.findBuff('laios:boss-fear'),null);e.def={...e.def,rank:'ELITE'};advance(b,.03);assert.equal(u.findBuff('laios:boss-fear'),null);
 e.def={...e.def,rank:'BOSS'};advance(b,.03);assert.ok(u.findBuff('laios:boss-fear'));assert.equal(u.s.flags.disarm,true);advance(b,15.1);assert.equal(u.findBuff('laios:boss-fear'),null);
 const born=enemy(b);born.def={...born.def,rank:'BOSS'};advance(b,.1);assert.equal(u.findBuff('laios:boss-fear'),null);
 b.retreatOperator(LAIOS);advance(b,80);const next=deploy(b,LAIOS);advance(b,.03);assert.equal(next.findBuff('laios:boss-fear'),null);
});

test('Laios Boss trigger waits actual appearance, including source target-free/motion exceptions',()=>{
 const b=make(LAIOS),u=deploy(b,LAIOS),e=enemy(b);e.def={...e.def,rank:'BOSS'};e.hidden=true;advance(b,.1);assert.equal(u.findBuff('laios:boss-fear'),null);
 e.motion='FLY';b.addBuff(e,{key:'test:free',flags:{untargetable:true,stealth:true}});e.hidden=false;advance(b,.03);assert.ok(u.findBuff('laios:boss-fear'));
});

test('Laios learned original enemy IDs apply selected DEF percent, survive redeploy and never use display name',()=>{
 const b=make(LAIOS,{skillId:'skchr_laios_2'}),u=deploy(b,LAIOS),e=enemy(b);e.base.def=400;e.markDirty();
 near(hit(b,u,e,.7),u.s.atk-400);b.kill(enemy(b),u);near(hit(b,u,e,.7),u.s.atk-240);
 const distinct=enemy(b);distinct.def={...distinct.def,id:'different-id',name:e.def.name};distinct.base.def=400;distinct.markDirty();near(hit(b,u,distinct,.7),u.s.atk-400);
 b.retreatOperator(LAIOS);advance(b,80);const next=deploy(b,LAIOS);near(hit(b,next,e,.7),next.s.atk-240);
});

test('Laios S2 owns frightened current blockees only, preserves other sources and releases current blocked finisher',()=>{
 const b=make(LAIOS,{skillId:'skchr_laios_2'}),u=deploy(b,LAIOS),e=enemy(b,7.1,2),other=enemy(b,8,2);
 e.x=7.2;e.blockedBy=u;u.blocking=[e];b._buildEnemyIndex();b.applyStatus(other,'tremble',{key:'other:tremble',duration:20});cast(u);assert.equal(e.s.flags.tremble,true);
 e.x=8;e.blockedBy=null;u.blocking=[];b._buildEnemyIndex();advance(b,.03);assert.equal(Boolean(e.s.flags.tremble),false);assert.ok(other.findBuff('other:tremble'));
 e.x=7.2;e.blockedBy=u;u.blocking=[e];b._buildEnemyIndex();advance(b,.03);assert.equal(e.s.flags.tremble,true);const hp=e.hp;
 advance(b,10);assert.equal(Boolean(e.s.flags.tremble),false);near(e.hp,hp);advance(b,.7);near(hp-e.hp,u.s.atk*4.5);near(other.hp,100000);assert.ok(other.findBuff('other:tremble'));
});

test('Laios premature skill end/withdraw cannot emit a finisher or erase foreign frightened status',()=>{
 for(const reason of['interrupt','withdraw']){
  const b=make(LAIOS,{skillId:'skchr_laios_2'}),u=deploy(b,LAIOS),e=enemy(b,7.1,2);e.x=7.2;e.blockedBy=u;u.blocking=[e];b._buildEnemyIndex();cast(u);
  if(reason==='withdraw')b.retreatOperator(LAIOS);else u.skill.end('interrupt');advance(b,1);near(e.hp,100000);assert.equal(Boolean(e.s.flags.tremble),false);
 }
});

test('Tachanka source talent extends each promotion range, adds20s redeploy and keeps selected DEF',()=>{
 for(const[elite,extension,def]of[[0,1,0],[1,1,.1],[2,2,.15]]){
  const b=make(TACH,{elite,level:elite===0?50:elite===1?70:80,skillRank:elite===0?4:7}),u=deploy(b,TACH,2,5);
  near(u.base.respawnTime,100);near(u.s.def,u.base.def*(1+(u.def.talents[0].bb.def??def)));assert.equal(u.s.rangeExtend,extension);
  const inRange=enemy(b,6+extension,2),out=enemy(b,7+extension,2);assert.ok(acquireTargets(b,u,u.profile).includes(inRange));assert.ok(!acquireTargets(b,u,u.profile).includes(out));
 }
});

test('Tachanka normal pair respects original .16 release, speed30, separate mitigation and first-hit kill',()=>{
 const b=make(TACH),u=deploy(b,TACH),e=enemy(b);e.base.def=300;e.markDirty();const one=u.s.atk-300;
 b.forceAttack(u,[e]);advance(b,.4);near(100000-e.hp,one);advance(b,.2);near(100000-e.hp,2*one);assert.equal(u.stats.attacks,1);
 e.hp=1;hit(b,u,e,.8);assert.equal(e.alive,false);
});

test('Tachanka second round cancels on brief control and skill switch, no stale redeploy shot',()=>{
 const b=make(TACH,{skillId:'skchr_tachak_2'}),u=deploy(b,TACH),e=enemy(b);b.forceAttack(u,[e]);advance(b,.4);const hp=e.hp;
 b.applyStatus(u,'stun',{duration:.05,source:e});advance(b,.3);near(e.hp,hp);
 b.forceAttack(u,[e]);advance(b,.4);const next=e.hp;cast(u);advance(b,.3);near(e.hp,next);
});

test('Tachanka S2 percentage BAT, exact skill range and random acquisition ignore blocked-first priority',()=>{
 const b=make(TACH,{skillId:'skchr_tachak_2'}),u=deploy(b,TACH,2,5),front=enemy(b,6,2),far=enemy(b,8,2);front.blockedBy=u;u.blocking=[front];
 cast(u);near(u.s.bat,u.base.bat*.15);const p=effectiveProfile(u);const selected=new Set();for(let i=0;i<60;i++)for(const e of acquireTargets(b,u,p))selected.add(e);
 assert.ok(selected.has(front));assert.ok(selected.has(far));assert.equal(u.s.rangeExtend,2);u.skill.end('duration');near(u.s.bat,u.base.bat);
});

test('Tachanka S2 native capped animation follows BAT so natural firing is not slowed to normal windup',()=>{
 const b=make(TACH,{skillId:'skchr_tachak_2'}),u=deploy(b,TACH),e=enemy(b);cast(u);u.atkCd=0;b.rng.chance=()=>false;
 const releases=[];b.drainEvents();for(let i=0;i<Math.ceil(3.85/b.dt);i++){b.step();for(const ev of b.drainEvents())if(ev[0]==='atk'&&ev[1]===u.id)releases.push({time:b.time,windup:ev[4].windup});}
 assert.deepEqual(b.errors,[]);assert.ok(releases.length>=18&&releases.length<=20,`native loop shots: ${releases.length}`);
 assert.ok(e.hp<100000);for(const shot of releases)near(shot.windup,.333/2);
 for(let i=1;i<releases.length;i++)assert.ok(releases[i].time-releases[i-1].time<=.22);
 near(u.s.interval,u.base.bat*.15);u.skill.end('duration');u.atkCd=0;advance(b,.04);near(u.mem.tachRate,1);
});

test('Tachanka S1 excludes flying-only skill targets while normal attacks and S2 retain source ALL motion',()=>{
 const b=make(TACH),u=deploy(b,TACH),e=enemy(b);e.motion='FLY';assert.ok(acquireTargets(b,u,u.profile).includes(e));
 u.skill.setSpTotal(99);assert.equal(u.skill.activate('test'),false);hit(b,u,e,.6);assert.ok(e.hp<100000);
 const c=make(TACH,{skillId:'skchr_tachak_2'}),v=deploy(c,TACH),air=enemy(c);air.motion='FLY';cast(v);assert.ok(acquireTargets(c,v,effectiveProfile(v)).includes(air));
});

test('Tachanka source crit rolls each damage formula before DEF, independently per full strike',()=>{
 const b=make(TACH,{skillId:'skchr_tachak_2'}),u=deploy(b,TACH),e=enemy(b);e.base.def=300;e.markDirty();cast(u);
 const rolls=[true,false];b.rng.chance=()=>rolls.shift()??false;const damage=hit(b,u,e,.8);near(damage,(u.s.atk*2-300)+(u.s.atk-300));
});

test('Tachanka S1 requires target, waits source cast event/flight, burns plus tiles and marks selected rank DEF ignore',()=>{
 for(const rank of[1,10]){
  const b=make(TACH,{skillRank:rank}),u=deploy(b,TACH,2,5);u.skill.setSpTotal(99);assert.equal(u.skill.activate('test'),false);
  const main=enemy(b,7,2),side=enemy(b,7,3),diagonal=enemy(b,8,3);cast(u);const one=u.s.atk*u.def.skill.bb.atk_scale;
  advance(b,.85);near(main.hp,100000);advance(b,.25);near(100000-main.hp,one);near(100000-side.hp,one);near(diagonal.hp,100000);
  main.base.def=500;main.markDirty();advance(b,1.4);const before=main.hp;const ignore=u.def.skill.bb.def_penetrate_fixed;
  hit(b,u,main,.6);near(before-main.hp,2*(u.s.atk-(500-ignore))+one); // One periodic zone tick overlaps the normal pair.
 }
});

test('Tachanka born grenade persists through withdrawal, owned marks end at zone lifetime without erasing foreign buffs',()=>{
 const b=make(TACH),u=deploy(b,TACH),e=enemy(b);cast(u);advance(b,1.1);const hp=e.hp;b.addBuff(e,{key:'foreign:marker',duration:20});
 b.retreatOperator(TACH);advance(b,2);assert.ok(e.hp<hp);advance(b,5);assert.equal(e.buffs.some(x=>x.key.startsWith('tachak:zone:')),false);assert.ok(e.findBuff('foreign:marker'));
});
