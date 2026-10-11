// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-defender-third-prefabs.json' with { type: 'json' };
import { DEFENDER_THIRD_OPERATORS as configs } from '../shared/arkpedia/defender-third-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, acquireTargets } from '../server/sim/ai.js';
const LISK='char_107_liskam',VULCAN='char_163_hpsts',AURORA='char_422_aurora',HOSHI='char_136_hsguma',FANG='char_123_fang',BEAGLE='char_122_beagle',KROOS='char_124_kroos';
const near=(a,e,t=1e-5)=>assert.ok(Math.abs(a-e)<t,`${a} != ${e}`);
function advance(b,s){for(let i=0;i<Math.round(s/b.dt);i++)b.step();assert.deepEqual(b.errors,[]);}
function make(id,{skill=0,rank=10,elite=2,potential=1,others=[]}={}){
 const source=structuredClone(data);source.stage.geometry.waves[0].spawns=[];source.stage.battle.dp_per_second=0;
 const op=source.operators[id],build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,potential,skillId:op.skills[skill].id,skillRank:rank};
 const b=new StandardBattle(source,{operators:[build,...others.map(v=>defaultBuild(source.operators[v]))]});b.autoFinish=false;b.setViewport('fullscreen-workspace');
 const rng=()=>.999;rng.int=()=>0;b.rng=rng;
 const deploy=(who=id,r=3,c=4,dir='RIGHT')=>{b.addDp('arkpedia',99);const u=b.deployOperator(who,r,c,dir);assert.ok(u);u.atkCd=1000;u.skill.rule='NEVER';return u;};return{b,deploy};
}
function cast(b,u){u.skill.setSpTotal(u.skill.spCost*u.skill.maxCharges);assert.equal(u.skill.activate('test'),true);u.atkCd=1000;}
function enemy(b,{r=3,c=5,fly=false}={}){const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});e.base.maxHp=100000;e.base.atk=1000;e.base.def=0;e.base.res=0;if(fly)e.motion='FLY';e.markDirty();void e.s;e.hp=100000;b.addBuff(e,{key:'test:pin',persist:true,flags:{disarm:true,noMove:true}});b._buildEnemyIndex();return e;}
const bb=(id,skill,rank=10)=>Object.fromEntries(data.operators[id].skills[skill].levels[rank-1].blackboard.map(v=>[v.key,v.value]));
const nodes=rows=>rows.flatMap(r=>r.components);
function move(b,e,r,c){e.x=c;e.y=r;e.tileR=r;e.tileC=c;b._enemiesDirty=true;b._buildEnemyIndex();}
const shot=(b,u,e)=>{b.forceAttack(u,[e]);u.atkCd=1000;};
function hurt(b,u){b.addBuff(u,{key:'test:HP',mods:{hpFlat:20000}});void u.s;u.hp=1000;return u;}

test('four complete kits retain exact nine source skills, original role hashes and defensive source contracts',()=>{
 for(const[id,c]of Object.entries(configs)){
  assert.match(evidence.sourceBundles.find(v=>v.path===`charpack/${id}.ab`).sha256,/^[a-f0-9]{64}$/);
  assert.match(evidence.originalModels[id].Front.sha256,/^[a-f0-9]{64}$/);
  for(const s of c.skillIds)assert.ok(evidence.skills[s].length);
 }
 assert.match(evidence.originalModels[LISK].Front.path,/char_107_liskarm\/Front\/char_107_liskarm\.skel$/);
 const vulcan=nodes(evidence.skills.skchr_hpsts_2).flatMap(c=>c._buffs??[]).flatMap(v=>v.attributes.attributeModifiers);
 assert.ok(vulcan.some(v=>v.attributeType===8&&v.formulaItem===0));
 const aurora=nodes(evidence.skills.skchr_aurora_2).flatMap(c=>c._buffs??[]).flatMap(v=>v.attributes.attributeModifiers);
 assert.ok(aurora.some(v=>v.attributeType===8&&v.formulaItem===1));
 assert.equal(evidence.buffTemplates.damage_block.eventToActions.ON_TAKE_DAMAGE[1]._filterDamageType,false);
 assert.equal(evidence.independentCalculatorEvidence.files[0].reviewedBinding,'skchr_hsguma_3.sec=true');
 assert.ok(evidence.verificationLimits.some(v=>v.includes('frame parity')));
});
test('all nine skills and all ten ranks load with exact promotion/potential talents and no generic duplication',()=>{
 for(const[id,c]of Object.entries(configs))for(let skill=0;skill<c.skillIds.length;skill++)for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make(id,{skill,rank}),u=deploy();assert.equal(u.skill.id,c.skillIds[skill]);assert.equal(u.skill.noSkill,false);assert.deepEqual(b.errors,[]);
 }
 for(const id of Object.keys(configs)){const{deploy}=make(id,{elite:0,rank:4});assert.equal(deploy().def.talents.length,0);}
 for(const [id,potential]of [[LISK,5],[VULCAN,5],[AURORA,5],[HOSHI,6]]){const{deploy}=make(id,{potential});assert.ok(deploy().def.talents.length);}
});
test('normal timing, physical type, source facing caps and anti-air match each original mode',()=>{
 for(const id of [VULCAN,AURORA,HOSHI])for(const dir of ['RIGHT','UP']){
  const{b,deploy}=make(id,{elite:id===AURORA?0:2,rank:id===AURORA?4:10}),u=deploy(id,3,4,dir),e=enemy(b),p=effectiveProfile(u);
  const t=evidence.originalModels[id][dir==='UP'?'Back':'Front'].hits.Attack[0];near(p.windup(b,u),t);assert.equal(p.dmgType,'phys');
  b.addBuff(u,{key:'test:ASPD',mods:{aspd:100}});near(p.windup(b,u),t/(id===VULCAN?1:2));shot(b,u,e);advance(b,t+.1);near(100000-e.hp,u.s.atk);
  const air=enemy(b,{c:4.2,fly:true});assert.ok(!acquireTargets(b,u,p).includes(air));
 }
 const{b,deploy}=make(LISK),u=deploy(),e=enemy(b,{c:6,fly:true});assert.ok(acquireTargets(b,u,u.profile).includes(e));
});
test('Liskarm first beam retains source begin then loop event and subsequent attacks omit the opening',()=>{
 const{b,deploy}=make(LISK),u=deploy(),e=enemy(b);near(u.profile.windup(b,u,[e]),.366);u.mem.liskarmOpened=false;shot(b,u,e);
 advance(b,.3);near(e.hp,100000);advance(b,.15);near(100000-e.hp,u.s.atk);shot(b,u,e);advance(b,.1);near(100000-e.hp,2*u.s.atk);
 move(b,e,7,7);advance(b,.1);assert.equal(u.mem.liskarmOpened,false);move(b,e,3,5);b._buildEnemyIndex();near(u.profile.windup(b,u,[e]),.366);
});
test('Liskarm S1 selected defense is independent of one-hit shield and preserves defensive SP on an absorbed hit',()=>{
 for(const rank of [1,7,10]){
  const{b,deploy}=make(LISK,{rank}),u=hurt(b,deploy()),e=enemy(b),base=u.s.def;cast(b,u);near(u.s.def,base*(1+bb(LISK,0,rank).def));
  const hp=u.hp,sp=u.skill.spTotal;b.dealDamage(e,u,{amount:1000,type:'true',isAttack:true,applyWay:'ranged'});near(u.hp,hp);near(u.skill.spTotal-sp,2);
  assert.equal(u.findBuff('liskarm:block-once'),null);assert.ok(u.findBuff('liskarm:charged-defense'));
  b.dealDamage(e,u,{amount:100,type:'true',isAttack:true});near(u.hp,hp-100);advance(b,8.1);near(u.s.def,base);
 }
});
test('Liskarm S1 expires unused shield and does not absorb HP-loss or elemental gauge',()=>{
 const{b,deploy}=make(LISK),u=hurt(b,deploy()),e=enemy(b);cast(b,u);const hp=u.hp;
 b.loseHp(u,10,{source:e});near(u.hp,hp-10);assert.equal(u.findBuff('liskarm:block-once').shieldHits,1);
 b.dealDamage(e,u,{amount:10,type:'element',element:'neural'});assert.equal(u.findBuff('liskarm:block-once').shieldHits,1);advance(b,8.1);assert.equal(u.findBuff('liskarm:block-once'),null);
});
test('Liskarm talent chooses one x-5 ally, ignores healing/general target-free, retains isolation and active SP rules',()=>{
 const{b,deploy}=make(LISK,{others:[FANG,BEAGLE]}),u=hurt(b,deploy()),a=deploy(FANG,3,5),diagonal=deploy(BEAGLE,3,6),e=enemy(b);a.skill.setSpTotal(0);diagonal.skill.setSpTotal(0);u.skill.setSpTotal(0);
 b.addBuff(a,{key:'test:free',flags:{healFree:true,untargetable:true}});b.dealDamage(e,u,{amount:1,type:'true',isAttack:true});near(a.skill.spTotal,1);near(diagonal.skill.spTotal,0);near(u.skill.spTotal,2);
 b.addBuff(a,{key:'test:isolated',flags:{isolated:true}});b.dealDamage(e,u,{amount:1,type:'true',isAttack:true});near(a.skill.spTotal,1);
 b.removeBuff(a,'test:isolated');b.addBuff(a,{key:'test:noSP',flags:{noSp:true}});b.dealDamage(e,u,{amount:1,type:'true',isAttack:true});near(a.skill.spTotal,1);
 const self=u.skill.spTotal;b.dealDamage(e,u,{amount:1,type:'arts',isAttack:false});near(u.skill.spTotal,self+1);near(a.skill.spTotal,1);
});
test('Liskarm selected E2 RES and S2 percentage BAT, non-event predelay, target cap and per-victim stun',()=>{
 for(const rank of [1,7,10]){
  const{b,deploy}=make(LISK,{skill:1,rank}),u=deploy(),base=u.s.atk,bat=u.s.bat;near(u.s.res,10);const victims=[4.1,4.3,5,6,5.4].map(c=>enemy(b,{c}));cast(b,u);
  near(u.s.atk,base*(1+bb(LISK,1,rank).atk));near(u.s.bat,bat*1.7);assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,bb(LISK,1,rank)['attack@max_target']);
  const rng=()=>0;rng.int=()=>0;b.rng=rng;const selected=acquireTargets(b,u,effectiveProfile(u));b.forceAttack(u,selected);u.atkCd=1000;
  advance(b,.2);for(const e of victims)near(e.hp,100000);advance(b,.2);for(const e of selected){near(100000-e.hp,u.s.atk);assert.equal(e.s.flags.stun,true);}
  const outside=victims.filter(v=>!selected.includes(v));for(const e of outside)near(e.hp,100000);
  u.skill.end('test');near(u.s.atk,base);near(u.s.bat,bat);assert.ok(!u.s.flags.stun);
 }
 const{deploy}=make(LISK,{potential:5});near(deploy().s.res,13);
});
test('Liskarm S2 retargets at strike and self stun only follows natural expiry',()=>{
 const{b,deploy}=make(LISK,{skill:1}),u=hurt(b,deploy()),e=enemy(b,{c:6});cast(b,u);shot(b,u,e);move(b,e,7,7);advance(b,.4);near(e.hp,100000);
 advance(b,19.7);assert.equal(u.s.flags.stun,true);advance(b,5.1);assert.ok(!u.s.flags.stun);
 for(const reason of ['retreat','death']){const{b,deploy}=make(LISK,{skill:1}),u=deploy();cast(b,u);if(reason==='retreat')b.retreat(u);else b.kill(u,null);assert.ok(!u.s.flags.stun);}
});
test('Vulcan rejects outside healing while self regeneration and source heal-free exception remain legal',()=>{
 const{b,deploy}=make(VULCAN,{others:[FANG]}),u=hurt(b,deploy()),a=deploy(FANG,3,5);const hp=u.hp;near(b.heal(a,u,100),0);near(b.heal(u,u,100,{self:true}),100);
 b.addBuff(u,{key:'test:healFree',flags:{healFree:true}});cast(b,u);const before=u.hp;advance(b,1);near(u.hp-before,u.s.maxHp*.09,.01);assert.ok(u.hp>hp);
});
test('Vulcan S1 combines selected skill/talent regen and block+1, cleans up at every selected rank',()=>{
 for(const [elite,potential,talent]of [[0,1,0],[1,1,.04],[2,1,.04],[2,5,.05]]){
  const{b,deploy}=make(VULCAN,{elite,potential,rank:elite===0?4:elite===1?7:10}),u=hurt(b,deploy()),def=u.s.def,block=u.s.blockCnt;cast(b,u);const selected=bb(VULCAN,0,elite===0?4:elite===1?7:10);
  near(u.s.def,def*(1+selected.def));near(u.s.blockCnt,block+1);near(u.s.hpRegen,u.s.maxHp*(selected.hp_recovery_per_sec_by_max_hp_ratio+talent));u.skill.end('test');near(u.s.hpRegen,0);near(u.s.blockCnt,block);near(u.s.def,def);
 }
});
test('Vulcan skill-active evade uses actual Physical MELEE origin only, honors potential and excludes guaranteed hits',()=>{
 for(const[type,applyWay,canDodge,expect]of [['phys','melee',true,0],['phys','ranged',true,1],['arts','melee',true,1],['true','melee',true,1],['phys','melee',false,1]]){
  const{b,deploy}=make(VULCAN,{skill:1,potential:5}),u=hurt(b,deploy()),e=enemy(b);cast(b,u);b.rng=()=>.26;const before=u.hp;
  b.dealDamage(e,u,{amount:1000,type,applyWay,canDodge,isAttack:true});assert.equal(u.hp<before,!!expect);
  u.skill.end('test');b.dealDamage(e,u,{amount:1000,type:'phys',applyWay:'melee',isAttack:true});assert.ok(u.hp<before);
 }
});
test('Vulcan S2 uses flat BAT, source Front capped timing and current block-capacity targets with one heal per attack',()=>{
 const{b,deploy}=make(VULCAN,{skill:1}),u=hurt(b,deploy(VULCAN,3,4,'UP')),base=u.s.atk,bat=u.s.bat;const victims=[4.1,4.3,4.5].map(c=>enemy(b,{c}));cast(b,u);
 near(u.s.atk,base*2.5);near(u.s.bat,bat+.4);near(u.s.blockCnt,2);assert.equal(u.mem.regularAttackFacing,'Front');
 u.blocking=vitimsSafe(victims,u);const selected=acquireTargets(b,u,effectiveProfile(u));assert.equal(selected.length,2);
 const hp=u.hp;u.skill.spec.mods.hpRegenRatio=0;b.removeBuff(u,u.skill._buffKey);b.addBuff(u,{key:u.skill._buffKey,mods:{atkPct:1.5,blockCnt:-1,batFlat:.4}});b.forceAttack(u,selected);u.atkCd=1000;advance(b,.8);near(u.hp,hp);advance(b,.25);near(u.hp-hp,u.s.maxHp*.1);for(const e of selected)near(100000-e.hp,u.s.atk);
 u.skill.end('test');assert.equal(u.mem.regularAttackFacing,null);near(u.s.bat,bat);
 function vitimsSafe(vs,op){for(const e of vs)e.blockedBy=op;return vs;}
});
test('Vulcan interrupted attack performs neither damage nor attack-triggered healing',()=>{
 const{b,deploy}=make(VULCAN,{skill:1}),u=hurt(b,deploy()),e=enemy(b,{c:4.2});cast(b,u);shot(b,u,e);advance(b,.2);b.applyStatus(u,'stun',{duration:.1});const hp=u.hp;advance(b,1);near(e.hp,100000);assert.ok(u.hp-hp<u.s.maxHp*.06);
});
test('Aurora unblocked trait stops natural and gifted SP but retains initial SP; blocking restores gifts and time',()=>{
 const{b,deploy}=make(AURORA,{elite:0,rank:4}),u=deploy();const initial=u.skill.spTotal;assert.ok(initial>0);assert.equal(u.s.flags.noSp,true);
 advance(b,1);near(u.skill.spTotal,initial);near(u.skill.gainSp(5,'gift'),0);const e=enemy(b,{c:4.2});advance(b,.1);assert.equal(e.blockedBy,u);assert.ok(!u.s.flags.noSp);
 near(u.skill.gainSp(2,'gift'),2);const sp=u.skill.spTotal;advance(b,1);near(u.skill.spTotal-sp,1,.06);b.kill(e,null);advance(b,.1);assert.equal(u.s.flags.noSp,true);
});
test('Aurora rest has inclusive half-SP boundary, selected regen and owns only her disarm modifier',()=>{
 for(const [elite,potential,ratio]of [[1,1,.015],[1,5,.02],[2,1,.03],[2,5,.035]]){
  const{b,deploy}=make(AURORA,{elite,potential,rank:7}),u=hurt(b,deploy());u.skill.setSpTotal(u.skill.spCost*.5);advance(b,.05);assert.equal(u.s.flags.disarm,true);near(u.s.hpRegen,u.s.maxHp*ratio);
  b.addBuff(u,{key:'test:foreign',flags:{disarm:true},mods:{hpRegen:13}});u.skill.setSpTotal(u.skill.spCost*.5+.001);advance(b,.05);near(u.s.hpRegen,13);assert.equal(u.s.flags.disarm,true);b.removeBuff(u,'test:foreign');assert.ok(!u.s.flags.disarm);
 }
});
test('Aurora S1 selected defense/block, source begin/loop, Resist and natural end stun restore resting state',()=>{
 for(const rank of [1,7,10]){
  const{b,deploy}=make(AURORA,{rank}),u=deploy(),base=u.s.def;cast(b,u);near(u.s.def,base*(1+bb(AURORA,0,rank).def));near(u.s.blockCnt,3);near(b.resistOf(u),.5);assert.equal(u.mem.regularFormVisual.clip,'Skill_Begin');
  advance(b,.6);assert.equal(u.mem.regularFormVisual.clip,'Skill_Idle');near(effectiveProfile(u).windup(b,u),.467);assert.equal(u.findBuff('aurora:rest'),null);
  advance(b,29.5);assert.equal(u.s.flags.stun,true);assert.equal(u.findBuff('aurora:resist'),null);near(b.resistOf(u),0);near(u.s.def,base);near(u.s.blockCnt,1);advance(b,5.1);assert.ok(!u.s.flags.stun);
 }
});
test('Aurora S2 scales only an already Frozen hit; initial Cold and second Cold precede third heavy output',()=>{
 for(const rank of [1,7,10]){
  const{b,deploy}=make(AURORA,{skill:1,rank}),u=deploy(),e=enemy(b),base=u.s.atk,bat=u.s.bat;cast(b,u);advance(b,.75);
  near(u.s.atk,base*(1+bb(AURORA,1,rank).atk));near(u.s.bat,bat*1.25);near(effectiveProfile(u).windup(b,u),.3);assert.equal(u.skill.ammoLeft,9);
  shot(b,u,e);advance(b,.4);near(100000-e.hp,u.s.atk);assert.equal(e.s.flags.cold,true);assert.ok(!e.s.flags.freeze);
  shot(b,u,e);advance(b,.4);near(100000-e.hp,2*u.s.atk);assert.equal(e.s.flags.freeze,true);
  shot(b,u,e);advance(b,.4);near(100000-e.hp,u.s.atk*(2+bb(AURORA,1,rank).atk_scale));assert.equal(u.skill.ammoLeft,6);
 }
});
test('Aurora S2 ninth completed attack exhausts ammo; manual cancel/end/death remove only owned form flags',()=>{
 const{b,deploy}=make(AURORA,{skill:1}),u=deploy(),e=enemy(b);cast(b,u);advance(b,.75);for(let i=0;i<9;i++){shot(b,u,e);advance(b,.4);}assert.equal(u.skill.active,false);assert.equal(u.skill.ammoLeft,0);near(u.s.atk,u.base.atk);advance(b,.6);assert.ok(u.findBuff('aurora:rest'));
 for(const reason of ['cancel','retreat','death']){const{b,deploy}=make(AURORA,{skill:1}),u=deploy();cast(b,u);if(reason==='cancel')u.skill.end('cancel');else if(reason==='retreat')b.retreat(u);else b.kill(u,null);advance(b,1);assert.ok(!u.findBuff('defender-third:begin'));assert.ok(!u.s.flags.stun);if(reason!=='cancel')assert.equal(u.mem.regularFormVisual,null);}
});
test('Hoshiguma all-HP-type block chance follows selected promotion/potential and never blocks HP-loss/gauge',()=>{
 for(const [elite,potential,chance]of [[1,1,.12],[1,3,.15],[2,1,.25],[2,3,.28]])for(const type of ['phys','arts','true','elemental']){
  const{b,deploy}=make(HOSHI,{elite,potential,rank:7}),u=hurt(b,deploy()),e=enemy(b);const hp=u.hp;b.rng=()=>chance-.001;b.dealDamage(e,u,{amount:1000,type,isAttack:true});near(u.hp,hp);b.rng=()=>chance+.001;b.dealDamage(e,u,{amount:1000,type,isAttack:true});assert.ok(u.hp<hp);
 }
 const{b,deploy}=make(HOSHI),u=hurt(b,deploy()),e=enemy(b);b.rng=()=>0;const hp=u.hp;b.loseHp(u,20,{source:e});near(u.hp,hp-20);b.dealDamage(e,u,{amount:10,type:'element',element:'neural'});near(u.hp,hp-20);
});
test('Hoshiguma defender aura includes self and untargetable defenders, excludes isolation/other professions, preserves foreign buffs',()=>{
 const{b,deploy}=make(HOSHI,{potential:6,others:[BEAGLE,FANG]}),u=deploy(),a=deploy(BEAGLE,3,5),f=deploy(FANG,3,6);near(u.s.def,u.base.def*1.08);const ownDef=a.s.def-a.base.def*.08;near(a.s.def,ownDef+a.base.def*.08);near(f.s.def,f.base.def);
 b.addBuff(a,{key:'test:free',flags:{untargetable:true}});advance(b,.05);near(a.s.def,ownDef+a.base.def*.08);b.addBuff(a,{key:'test:foreign',mods:{defPct:.2}});b.addBuff(a,{key:'test:isolated',flags:{isolated:true}});advance(b,.05);near(a.s.def,ownDef+a.base.def*.2);
 b.removeBuff(a,'test:isolated');advance(b,.05);near(a.s.def,ownDef+a.base.def*.28);b.retreat(u);near(a.s.def,ownDef+a.base.def*.2);
});
test('Hoshiguma S1 selected ATK/DEF stacks with aura and reverts at every rank',()=>{
 for(const rank of [1,7,10]){const{b,deploy}=make(HOSHI,{rank}),u=deploy(),atk=u.s.atk;cast(b,u);near(u.s.atk,atk*(1+bb(HOSHI,0,rank).atk));near(u.s.def,u.base.def*(1+.06+bb(HOSHI,0,rank).def));u.skill.end('test');near(u.s.atk,atk);near(u.s.def,u.base.def*1.06);}
});
test('Hoshiguma passive reflection uses live ATK and independent receipt despite block, shield, incoming skill; HP-loss/gauge do not reflect',()=>{
 for(const rank of [1,7,10]){
  const{b,deploy}=make(HOSHI,{skill:1,rank}),u=hurt(b,deploy()),e=enemy(b);near(u.s.def,u.base.def*(1+.06+bb(HOSHI,1,rank).def));const atk=u.s.atk;b.rng=()=>0;
  b.dealDamage(e,u,{amount:1000,type:'true',isAttack:true});near(100000-e.hp,atk*bb(HOSHI,1,rank).atk_scale);b.addBuff(u,{key:'test:ATK',mods:{atkPct:.5}});b.dealDamage(e,u,{amount:10,type:'arts',isAttack:false});near(100000-e.hp,atk*bb(HOSHI,1,rank).atk_scale*2.5);
  const hp=e.hp;b.loseHp(u,10,{source:e});b.dealDamage(e,u,{amount:10,type:'element',element:'neural'});near(e.hp,hp);
 }
});
test('Hoshiguma saw uses exact non-event .4 start, fixed1s pulses, all source-range ground targets and live selected ATK',()=>{
 const{b,deploy}=make(HOSHI,{skill:2}),u=deploy(),a=enemy(b),self=enemy(b,{c:4.2}),air=enemy(b,{c:5,fly:true}),side=enemy(b,{r:4,c:4}),behind=enemy(b,{c:3}),outside=enemy(b,{c:6});cast(b,u);const atk=u.s.atk;u.blocking=[behind];behind.blockedBy=u;
 advance(b,.3);near(a.hp,100000);advance(b,.2);near(100000-a.hp,atk);near(100000-self.hp,atk);for(const e of [air,side,behind,outside])near(e.hp,100000);
 b.addBuff(u,{key:'test:speed',mods:{aspd:300,batFlat:2}});advance(b,.8);near(100000-a.hp,atk);advance(b,.2);near(100000-a.hp,2*atk);b.addBuff(u,{key:'test:ATK',mods:{atkPct:.5}});const current=u.s.atk;advance(b,1);near(100000-a.hp,2*atk+current);
});
test('Hoshiguma saw timers cancel on early end/death/retreat and controlled periods do not accumulate backlog',()=>{
 for(const why of ['end','death','retreat']){const{b,deploy}=make(HOSHI,{skill:2}),u=deploy(),e=enemy(b);cast(b,u);advance(b,.1);if(why==='end')u.skill.end('test');else if(why==='death')b.kill(u,null);else b.retreat(u);advance(b,2);near(e.hp,100000);}
 const{b,deploy}=make(HOSHI,{skill:2}),u=deploy(),e=enemy(b);cast(b,u);advance(b,.5);const hp=e.hp;b.applyStatus(u,'stun',{duration:2});advance(b,2);near(e.hp,hp);advance(b,1);near(hp-e.hp,u.s.atk);u.skill.end('test');const done=e.hp;advance(b,2);near(e.hp,done);
});
