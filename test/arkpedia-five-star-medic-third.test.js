// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-five-star-medic-third-prefabs.json' with { type: 'json' };
import { FIVE_STAR_MEDIC_THIRD_OPERATORS } from '../shared/arkpedia/five-star-medic-third-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
const HAR='char_4114_harold',ROS='char_4163_rosesa',NOW='char_4173_nowell',PAP='char_4139_papyrs',HIB='char_1024_hbisc2';
const FAN='char_123_fang',BEA='char_122_beagle',KRO='char_124_kroos',MUL='char_473_mberry';
const near=(a,e,tol=1e-5)=>assert.ok(Math.abs(a-e)<tol,`${a} != ${e}`);
const advance=(b,s)=>{for(let n=0;n<Math.round(s/b.dt);n++)b.step();assert.deepEqual(b.errors,[]);};
function build(id,{skill=0,rank=10,elite=2,potential=1}={}){const o=data.operators[id];assert.ok(o,`Reviewed snapshot required: ${id}`);return{...defaultBuild(o),elite,level:o.phases[elite].maxLevel,potential,skillId:o.skills[skill].id,skillRank:rank};}
function make(id,{skill=0,rank=10,elite=2,potential=1,others=[]}={}){
 const source=structuredClone(data);source.stage.geometry.waves[0].spawns=[];source.stage.battle.dp_per_second=0;
 const b=new StandardBattle(source,{operators:[build(id,{skill,rank,elite,potential}),...others.map(a=>typeof a==='string'?defaultBuild(source.operators[a]):a)]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);
 const deploy=(who=id,r=1,c=4,dir='UP')=>{b.addDp('arkpedia',99);const u=b.deployOperator(who,r,c,dir);assert.ok(u,`${who} on ${r},${c}`);u.atkCd=1000;return u;};return{b,deploy};
}
function cast(b,u){u.skill.gainSp(u.skill.spCost*u.skill.maxCharges,'test');assert.equal(u.skill.manual?b.activateOperator(u.defId):u.skill.activate('test'),true);u.atkCd=1000;}
const wound=(u,n=100000,hp=100)=>{u.base.maxHp=n;u.markDirty();void u.s;u.hp=hp;};
const bb=(id,s,r=10)=>Object.fromEntries(data.operators[id].skills[s].levels[r-1].blackboard.map(x=>[x.key,x.value]));
const shot=(b,u,a,s=1)=>{b.forceAttack(u,a);u.atkCd=1000;advance(b,s);};
function enemy(b,x=4,y=2){const e=b.spawnEnemy('enemy_1007_slime',{routeIndex:1});e.x=x;e.y=y;e.base.maxHp=100000;e.base.def=e.base.res=e.base.moveSpeed=0;e.markDirty();void e.s;e.hp=100000;b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;}
const component=(rows,key)=>rows.find(x=>x.pathId===key)?.data;

test('third medics retain original verified bundles, all ten skills, full selectors and model timing',()=>{
 for(const[id,cfg]of Object.entries(FIVE_STAR_MEDIC_THIRD_OPERATORS)){
  assert.match(evidence.sourceBundles.find(x=>x.path===`charpack/${id}.ab`).sha256,/^[a-f0-9]{64}$/);
  for(const face of['Front','Back'])assert.match(evidence.models[id][face].sha256,/^[a-f0-9]{64}$/);
  for(const sid of cfg.skillIds)assert.ok(evidence.skills[sid.split('[')[0]].length);
 }
 assert.equal(evidence.buffTemplates.harold_t_1.eventToActions.ON_APPLYING_MODIFIER[1]._condType,'LT');
 assert.equal(evidence.buffTemplates.harold_t_1.eventToActions.ON_APPLYING_MODIFIER[1]._epRatio,.5);
 assert.equal(evidence.buffTemplates['rosesa_s_2[ally]'].onEventPriority,'LOW_PRIORITY');
 assert.equal(evidence.buffTemplates['rosesa_s_2[bleed]'].eventToActions.ON_BUFF_TRIGGER[0]._skipModifierEvent,true);
 assert.equal(component(evidence.characters[PAP],'901535693366080264')._preDelay,.6600000262260437);
 assert.equal(component(evidence.skills.skchr_papyrs_2,'-846650473265161135')._postFilter,19);
 assert.deepEqual(evidence.models[NOW].Front.hits.Skill_2,[.533]);assert.equal(evidence.frameParity,false);
});

test('every third-medic selected source rank builds exact skill without generic install fallbacks',()=>{
 for(const[id,cfg]of Object.entries(FIVE_STAR_MEDIC_THIRD_OPERATORS))for(let skill=0;skill<2;skill++)for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make(id,{skill,rank}),u=deploy();assert.equal(u.skill.id,cfg.skillIds[skill]);assert.equal(u.skill.noSkill,false);assert.deepEqual(b.errors,[]);
 }
});

test('all ordinary healing medics wait original OnAttack/flight and reject isolation or healing immunity',()=>{
 for(const id of[HAR,ROS,NOW,PAP]){
  const{b,deploy}=make(id,{others:[FAN,BEA]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5);wound(a);wound(z);
  b.addBuff(z,{key:'test:isolated',flags:{isolated:true}});assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[a]);
  b.forceAttack(u,[a]);u.atkCd=1000;advance(b,.2);near(a.hp,100);advance(b,1);assert.ok(a.hp>100);near(z.hp,100);
  b.removeBuff(z,'test:isolated');b.addBuff(z,{key:'test:immune',flags:{healFree:true}});assert.equal(acquireTargets(b,u,effectiveProfile(u)).includes(z),false);
 }
});

test('Harold ordinary HP-ratio selection recovers elemental injury on a full-HP recipient',()=>{
 const{b,deploy}=make(HAR,{others:[FAN,BEA]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5);
 wound(a,100000,40000);wound(z,100000,60000);a.elem.burn=100;z.elem.burn=700;
 assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[a]);a.hp=a.s.maxHp;z.hp=z.s.maxHp;z.elem.burn=400;
 shot(b,u,[z],1);near(z.elem.burn,Math.max(0,400-u.s.atk*.5));near(z.hp,z.s.maxHp);
});

test('Harold talent has strict greater-than-half injury, promotion/potential and current modifier eligibility',()=>{
 for(const[elite,potential,cut]of[[0,1,0],[1,1,.12],[1,5,.15],[2,1,.15],[2,5,.18]]){
  const{b,deploy}=make(HAR,{elite,potential,rank:[4,7,10][elite],others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);
  a.elem.neural=500;b.dealDamage(null,a,{amount:10,type:'element',element:'neural'});near(a.elem.neural,510);
  b.dealDamage(null,a,{amount:10,type:'element',element:'burn'});near(a.elem.burn,10*(1-cut));
  a.elem.neural=499.999;a.elem.burn=0;b.dealDamage(null,a,{amount:10,type:'element',element:'burn'});near(a.elem.burn,10);
  a.elem.neural=600;b.addBuff(a,{key:'test:no-heal',flags:{noHeal:true}});b.dealDamage(null,a,{amount:10,type:'element',element:'erosion'});near(a.elem.erosion,10*(1-cut));
  b.addBuff(a,{key:'test:isolated',flags:{isolated:true}});b.dealDamage(null,a,{amount:10,type:'element',element:'apoptosis'});near(a.elem.apoptosis,10);
 }
});

test('Harold passive protection shares strongest original channel with Mulberry and resumes on skill departure',()=>{
 const{b,deploy}=make(HAR,{others:[build(MUL,{skill:1}),FAN]}),u=deploy(),berry=deploy(MUL,1,3),a=deploy(FAN,2,3);a.elem.burn=600;
 b.dealDamage(null,a,{amount:100,type:'element',element:'neural'});near(a.elem.neural,85);
 cast(b,berry);b.dealDamage(null,a,{amount:100,type:'element',element:'neural'});near(a.elem.neural,150);
 berry.skill.end('duration');b.dealDamage(null,a,{amount:100,type:'element',element:'neural'});near(a.elem.neural,235);
 b.retreat(u);b.dealDamage(null,a,{amount:100,type:'element',element:'neural'});near(a.elem.neural,335);
});

test('Harold S1 selected ATK and S2 priority, uncapped original skill attack and threshold boost apply all ranks',()=>{
 for(const rank of Array.from({length:10},(_,i)=>i+1)){
  const{b,deploy}=make(HAR,{skill:1,rank,others:[FAN,BEA]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5);wound(a);wound(z,100000,50000);a.elem.neural=100;z.elem.neural=900;
  cast(b,u);assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[z]);near(u.s.aspd,u.base.aspd+bb(HAR,1,rank).attack_speed);
  near(effectiveProfile(u).windup(b,u),.6/(u.s.aspd/100));shot(b,u,[z],.7);near(z.elem.neural,Math.max(0,900-u.s.atk*.5*bb(HAR,1,rank).trait_scale));
  z.elem.neural=500;const hp=z.hp;shot(b,u,[z],.7);near(z.elem.neural,Math.max(0,500-u.s.atk*.5));assert.ok(z.hp>hp);
  const q=make(HAR,{rank}),v=q.deploy();cast(q.b,v);near(v.s.atk,v.base.atk*(1+bb(HAR,0,rank).atk));
 }
});

test('Rose Salt source ATK penalty and healing multiplier affect all three simultaneous targets by promotion',()=>{
 for(const[elite,potential,scale]of[[0,1,1.05],[0,5,1.07],[1,1,1.1],[2,1,1.15],[2,5,1.17]]){
  const{b,deploy}=make(ROS,{elite,potential,rank:[4,7,10][elite],others:[FAN,BEA,KRO]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5),k=deploy(KRO,1,3);
  for(const x of[a,z,k])wound(x);near(u.s.atk,u.base.atk*.95);shot(b,u,[a,z,k],.6);for(const x of[a,z,k])near(x.hp-100,u.s.atk*scale);
  const before=a.hp;b.heal(null,a,100);near(a.hp-before,100*scale);const regen=a.hp;b.heal(null,a,100,{regen:true});near(a.hp-regen,100);
 }
});

test('Rose Salt charged skill heals three at selected scale with exactly one stored charge spent',()=>{
 for(const rank of Array.from({length:10},(_,i)=>i+1)){
  const{b,deploy}=make(ROS,{rank,others:[FAN,BEA,KRO]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5),k=deploy(KRO,1,3);for(const x of[a,z,k])wound(x);cast(b,u);
  const maximum=data.operators[ROS].skills[0].levels[rank-1].spData.maxChargeTime;assert.equal(u.skill.maxCharges,maximum);const charges=u.skill.charges;assert.equal(charges,maximum-1);shot(b,u,[a,z,k],.6);for(const x of[a,z,k])near(x.hp-100,u.s.atk*bb(ROS,0,rank).heal_scale*1.15);assert.equal(u.skill.charges,charges);assert.equal(u.skill.active,false);
 }
});

test('Rose Salt and Papyrus charged heals activate through the real ally attack loop at every source rank',()=>{
 for(const id of[ROS,PAP])for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make(id,{rank,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a);
  u.skill.setSpTotal(u.skill.spCost*u.skill.maxCharges);const maximum=u.skill.maxCharges;u.atkCd=0;advance(b,.9);u.atkCd=1000;
  assert.equal(u.skill.activations,1);assert.equal(u.skill.charges,maximum-1);assert.equal(u.skill.active,false);
  near(a.hp-100,u.s.atk*bb(id,0,rank).heal_scale*(id===ROS?1.15:1));
  a.hp=a.s.maxHp;u.skill.setSpTotal(u.skill.spCost*maximum);u.atkCd=0;advance(b,.9);assert.equal(u.skill.activations,1);
 }
});

test('Rose Salt overlapping source channels choose the strongest legal producer and resume the weaker one',()=>{
 const{b,deploy}=make(ROS,{skill:1,rank:1,elite:1,others:[FAN,BEA]}),u=deploy(),a=deploy(FAN,2,3),second=deploy(BEA,2,5);wound(a,100000,50000);cast(b,u);
 const strong=structuredClone(u.def);strong.talents[0].bb.heal_scale=1.17;strong.skill.bb['attack@damage_scale']=.5;
 second.rangeKeySet=u.rangeKeySet;second.skill.id='skchr_rosesa_2';second.skill.active=true;b._arkpediaRoseSalt.set(second.id,{u:second,def:strong});
 const hp=a.hp;b.heal(null,a,100);near(a.hp-hp,117);const first=a.hp;b.dealDamage(null,a,{amount:100,type:'arts'});near(first-a.hp,50);
 b.retreat(second);const next=a.hp;b.heal(null,a,100);near(a.hp-next,110);const lower=a.hp;
 b.dealDamage(null,a,{amount:100,type:'arts'});near(lower-a.hp,100*bb(ROS,1,1)['attack@damage_scale']);
 assert.equal(a.buffs.filter(x=>x.key.startsWith('rosesa:bleed:')).length,2);
 advance(b,5.1);near(a.hp,next+110-100*bb(ROS,1,1)['attack@damage_scale']-50-100*(1-bb(ROS,1,1)['attack@damage_scale']));
});

test('Rose Salt source flat BAT reduction precedes another percentage BAT modifier',()=>{
 const{b,deploy}=make(ROS,{skill:1}),u=deploy();b.addBuff(u,{key:'test:bat',mods:{batPct:.2}});cast(b,u);
 near(u.s.bat,(u.base.bat+bb(ROS,1).base_attack_time)*1.2);
});

test('Rose Salt S2 defers selected full mitigated damage before shields, then five exact HP-loss ticks',()=>{
 for(const type of['phys','arts'])for(const rank of Array.from({length:10},(_,i)=>i+1)){
  const{b,deploy}=make(ROS,{skill:1,rank,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a,100000,50000);a.base.def=100;a.base.res=20;a.markDirty();
  b.addBuff(a,{key:'test:cuts',mods:{dmgTakenMul:.8,flatDamageResistance:10}});b.addBuff(a,{key:'test:shield',shield:50});cast(b,u);
  const full=(type==='phys'?400:400)*.8-10,scale=bb(ROS,1,rank)['attack@damage_scale'],hp=a.hp;
  b.dealDamage(null,a,{amount:500,type,canDodge:false});near(hp-a.hp,Math.max(0,full*scale-50));
  const delayed=full*(1-scale);advance(b,.9);near(hp-a.hp,full*scale-50);advance(b,.15);near(hp-a.hp,full*scale-50+delayed/5);
  advance(b,4);near(hp-a.hp,full-50);assert.equal(a.buffs.some(x=>x.key.startsWith('rosesa:bleed:')),false);
  near(u.s.bat,u.base.bat+bb(ROS,1,rank).base_attack_time);
 }
});

test('Rose Salt S2 ignores true/elemental/HP-loss and cannot defer dodged or cancelled attacks',()=>{
 const{b,deploy}=make(ROS,{skill:1,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a,100000,50000);cast(b,u);const hp=a.hp;
 b.dealDamage(null,a,{amount:100,type:'true'});b.dealDamage(null,a,{amount:100,type:'elemental',element:'burn'});b.loseHp(a,100);near(hp-a.hp,300);
 b.dealDamage(null,a,{amount:100,type:'element',element:'neural'});near(a.elem.neural,100);assert.equal(a.buffs.some(x=>x.key.startsWith('rosesa:bleed:')),false);
 b.addBuff(a,{key:'test:dodge',mods:{dodgePhys:1}});b.dealDamage(null,a,{amount:1000,type:'phys'});assert.equal(a.buffs.some(x=>x.key.startsWith('rosesa:bleed:')),false);b.removeBuff(a,'test:dodge');
 b.on('hit',ctx=>{ctx.dmg.cancel=true;});b.dealDamage(null,a,{amount:1000,type:'arts'});assert.equal(a.buffs.some(x=>x.key.startsWith('rosesa:bleed:')),false);advance(b,5.1);near(hp-a.hp,300);
});

test('Rose Salt pending independent losses survive aura departure and bypass shields, invulnerability and mitigation',()=>{
 const{b,deploy}=make(ROS,{skill:1,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a,100000,50000);cast(b,u);const hp=a.hp;
 b.dealDamage(null,a,{amount:1000,type:'arts'});near(hp-a.hp,500);b.addBuff(a,{key:'test:shield',shield:10000,flags:{invulnerable:true},mods:{dmgTakenMul:.1}});
 a.skill.spType='hurt';a.skill.setSpTotal(0);b.retreat(u);advance(b,5.1);near(hp-a.hp,1000);near(a.findBuff('test:shield').shield,10000);near(a.skill.sp,0);
});

test('Rose Salt aura ends immediately, non-HEAL beneficiaries remain eligible and foreign healing modifiers survive',()=>{
 const{b,deploy}=make(ROS,{skill:1,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a,100000,50000);b.addBuff(a,{key:'test:own-heal',mods:{healingTakenMul:1.2}});
 b.addBuff(a,{key:'test:no-heal',flags:{noHeal:true}});cast(b,u);const hp=a.hp;b.dealDamage(null,a,{amount:100,type:'arts'});near(hp-a.hp,50);
 a.x=9;a.y=7;const next=a.hp;b.dealDamage(null,a,{amount:100,type:'arts'});near(next-a.hp,100);near(a.findBuff('test:own-heal').mods.healingTakenMul,1.2);
});

test('Nowell normal far reduction uses original inner range and talent checks actual negative status at impact',()=>{
 for(const[elite,potential,scale]of[[0,1,1],[1,1,1.1],[1,5,1.13],[2,1,1.2],[2,5,1.23]]){
  const{b,deploy}=make(NOW,{elite,potential,rank:[4,7,10][elite],others:[FAN]}),u=deploy(),a=deploy(FAN,3,5);wound(a);shot(b,u,[a],.9);near(a.hp-100,u.s.atk*.8);
  b.addBuff(a,{key:'test:atk-cut',mods:{atkMul:.5}});const hp=a.hp;shot(b,u,[a],.9);near(a.hp-hp,u.s.atk*.8);
  b.applyStatus(a,'cold',{duration:3});const next=a.hp;shot(b,u,[a],.9);near(a.hp-next,u.s.atk*.8*scale);
 }
});

test('Nowell S1 selected ATK/ASPD prioritizes actual negative status ahead of a lower-HP ally',()=>{
 for(const rank of Array.from({length:10},(_,i)=>i+1)){
  const{b,deploy}=make(NOW,{rank,others:[FAN,BEA]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5);wound(a);wound(z,100000,90000);b.applyStatus(z,'cold',{duration:10});cast(b,u);
  near(u.s.atk,u.base.atk*(1+bb(NOW,0,rank).atk));near(u.s.aspd,u.base.aspd+bb(NOW,0,rank).attack_speed);assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[z]);
 }
});

test('Nowell S2 selects source rank count after original event, then exactly twelve periodic pulses with own Resist',()=>{
 for(let rank=1;rank<=10;rank++){
 const{b,deploy}=make(NOW,{skill:1,rank,others:[FAN,BEA,KRO]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5),k=deploy(KRO,1,3),s=bb(NOW,1,rank),targets=[a,z,k].slice(0,s.max_target);for(const x of[a,z,k])wound(x);cast(b,u);
 advance(b,.5);for(const x of[a,z,k])near(x.hp,100);advance(b,.08);for(const x of targets){near(x.hp-100,u.s.atk*s.heal_scale);assert.ok(x.findBuff(`nowell:resist:${u.id}`));}
 if(s.max_target===2){near(k.hp,100);assert.equal(k.findBuff(`nowell:resist:${u.id}`),null);}
 advance(b,11.1);for(const x of targets)near(x.hp-100,u.s.atk*s.heal_scale*12);advance(b,1.1);for(const x of targets){near(x.hp-100,u.s.atk*s.heal_scale*12);assert.equal(x.findBuff(`nowell:resist:${u.id}`),null);}
 }
});

test('Nowell S2 can select healthy operators with status first and preserves foreign Resist',()=>{
 const{b,deploy}=make(NOW,{skill:1,others:[FAN,BEA,KRO]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5),k=deploy(KRO,1,3);b.applyStatus(k,'cold',{duration:20});b.applyStatus(z,'resist',{key:'foreign:resist',duration:30});cast(b,u);advance(b,.6);
 assert.ok(k.findBuff(`nowell:resist:${u.id}`));assert.ok(a.findBuff(`nowell:resist:${u.id}`));assert.ok(u.findBuff(`nowell:resist:${u.id}`));assert.equal(z.findBuff(`nowell:resist:${u.id}`),null);
 advance(b,13);assert.ok(z.findBuff('foreign:resist'));near(b.resistOf(z),.5);
});

test('Nowell recipient recovery captures source ATK, survives source retreat and ignores distance penalty after attachment',()=>{
 const{b,deploy}=make(NOW,{skill:1,others:[FAN]}),u=deploy(),a=deploy(FAN,3,5);wound(a);cast(b,u);const atk=u.s.atk;advance(b,.6);near(a.hp-100,atk*.45);
 b.addBuff(u,{key:'test:atk',mods:{atkPct:1}});b.retreat(u);a.x=9;a.y=7;advance(b,2);near(a.hp-100,atk*.45*3);
 b.addBuff(a,{key:'test:isolated',flags:{isolated:true}});const hp=a.hp;advance(b,1);near(a.hp,hp);
});

test('Nowell unfired cast is permanently cancelled by brief control, with no late Resist or recovery',()=>{
 for(const mode of['stun','withdraw']){
  const{b,deploy}=make(NOW,{skill:1,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a);cast(b,u);advance(b,.1);
  if(mode==='stun')b.applyStatus(u,'stun',{duration:.05});else b.retreat(u);advance(b,1.5);near(a.hp,100);assert.equal(a.findBuff(`nowell:resist:${u.id}`),null);assert.equal(u.findBuff('nowell:cast'),null);
 }
});

test('Nowell sub-tick control cancels only unborn recovery, preserving attached recipient timers',()=>{
 for(const status of['stun','freeze','sleep','levitate']){
  const{b,deploy}=make(NOW,{skill:1,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a);cast(b,u);
  advance(b,.1);b.applyStatus(u,status,{duration:.001});advance(b,.8);
  near(a.hp,100);assert.equal(u.canAct,true);assert.equal(u.findBuff('nowell:cast'),null);
  assert.equal(u.mem.regularFormVisual,null);assert.equal(a.findBuff(`nowell:recovery:${u.id}`),null);
  cast(b,u);advance(b,.6);const hp=a.hp,recovery=a.findBuff(`nowell:recovery:${u.id}`);assert.ok(recovery);
  b.applyStatus(u,status,{duration:.001});advance(b,1);assert.ok(a.hp>hp);assert.equal(a.findBuff(`nowell:recovery:${u.id}`),recovery);
 }
});

test('Papyrus normal chain has three real flights/falloff and full source ATK barrier on every operator',()=>{
 for(const[elite,potential,scale]of[[0,1,.05],[0,5,.07],[1,1,.1],[1,5,.12],[2,1,.2],[2,5,.22]]){
  const{b,deploy}=make(PAP,{elite,potential,rank:[4,7,10][elite],others:[FAN,BEA,KRO]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,2),k=deploy(KRO,1,3);for(const x of[a,z,k])wound(x);
  shot(b,u,[a],1);const ordered=[a,z,k].sort((x,y)=>y.hp-x.hp);for(const[i,x]of ordered.entries()){near(x.hp-100,u.s.atk*.75**i);near(x.findBuff('papyrs:barrier').shield,u.s.atk*scale);}
 }
});

test('Papyrus S1 selected heal and barrier multipliers consume one charge across all bounces',()=>{
 for(const rank of Array.from({length:10},(_,i)=>i+1)){
  const{b,deploy}=make(PAP,{rank,others:[FAN,BEA,KRO]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,2),k=deploy(KRO,1,3);for(const x of[a,z,k])wound(x);cast(b,u);const charges=u.skill.charges;
  shot(b,u,[a],1);const ordered=[a,z,k].sort((x,y)=>y.hp-x.hp);for(const[i,x]of ordered.entries()){near(x.hp-100,u.s.atk*bb(PAP,0,rank).heal_scale*.75**i);near(x.findBuff('papyrs:barrier').shield,u.s.atk*.2*bb(PAP,0,rank).shield_scale_skill);}assert.equal(u.skill.charges,charges);assert.equal(u.skill.maxCharges,2);assert.equal(charges,1);assert.equal(u.skill.active,false);
 }
});

test('Papyrus barrier keeps greatest remaining amount, refreshes source lifetime and leaves foreign barriers',()=>{
 const{b,deploy}=make(PAP,{others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a);shot(b,u,[a]);const large=a.findBuff('papyrs:barrier').shield;b.addBuff(a,{key:'foreign:barrier',shield:900});advance(b,5);
 b.addBuff(u,{key:'test:cut',mods:{atkMul:.1}});shot(b,u,[a]);near(a.findBuff('papyrs:barrier').shield,large);advance(b,7);assert.ok(a.findBuff('papyrs:barrier'));advance(b,1.1);assert.equal(a.findBuff('papyrs:barrier'),null);near(a.findBuff('foreign:barrier').shield,900);
});

test('Papyrus S2 requires another legal operator and locks highest MaxHP even while healthy',()=>{
 const solo=make(PAP,{skill:1}),alone=solo.deploy();alone.skill.setSpTotal(99);assert.equal(alone.skill.activate('test'),false);
 const{b,deploy}=make(PAP,{skill:1,others:[FAN,BEA]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5);wound(a,100000);wound(z,200000,200000);cast(b,u);assert.equal(u.mem.papyrusTarget,z);
 assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[]);z.hp-=10000;assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[z]);
 b.removeBuff(z,`papyrs:locked:${u.id}`);assert.equal(u.skill.active,false);assert.equal(u.mem.papyrusTarget,null);
});

test('Papyrus S2 explicit source excluded abnormal flag7 rejects healing-restricted lock recipients',()=>{
 for(const flag of['noHeal','healFree']){
  const{b,deploy}=make(PAP,{skill:1,others:[FAN,BEA]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5);wound(a,100000,100000);wound(z,200000,200000);
  b.addBuff(z,{key:'test:restriction',flags:{[flag]:true}});cast(b,u);assert.equal(u.mem.papyrusTarget,a);
  u.skill.end('test');b.removeBuff(z,'test:restriction');cast(b,u);assert.equal(u.mem.papyrusTarget,z);
 }
});

test('Papyrus S2 uses explicit eventless predelay, ATK/BAT modifiers and fourth bounce including flying secondary',()=>{
 for(let rank=1;rank<=10;rank++){
 const{b,deploy}=make(PAP,{skill:1,rank,others:[FAN,BEA,KRO]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,2),k=deploy(KRO,1,3);wound(a,200000);wound(z);wound(k);wound(u);k.motion='FLY';cast(b,u);
 near(u.s.atk,u.base.atk*(1+bb(PAP,1,rank).atk));near(u.s.bat,u.base.bat+bb(PAP,1,rank).base_attack_time);const p=effectiveProfile(u);assert.equal(p.attackVisual,'none');near(p.windup(b,u),.66);
 shot(b,u,[a],1.3);assert.ok([a,z,k,u].every(x=>x.hp>100));assert.ok(k.findBuff('papyrs:barrier'));
 b.kill(a,null);assert.equal(u.skill.active,false);assert.equal(u.mem.papyrusTarget,null);
 }
});

test('Papyrus already-fired ordinary chain survives withdrawal without leaking a selected skill mark',()=>{
 const{b,deploy}=make(PAP,{others:[FAN,BEA]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,2);wound(a);wound(z);
 b.forceAttack(u,[a]);u.atkCd=1000;advance(b,.55);assert.ok(b.projectiles.list.length);b.retreat(u);advance(b,.7);assert.ok(a.hp>100&&z.hp>100);assert.ok(a.findBuff('papyrs:barrier'));
});

test('Hibiscus normal source Arts projectile applies selected Fragility and heals one legal ally from calculated damage',()=>{
 for(const[elite,potential,scale]of[[0,1,1],[1,1,1.06],[1,5,1.08],[2,1,1.12],[2,5,1.14]]){
  const{b,deploy}=make(HIB,{elite,potential,rank:[4,7,10][elite],others:[FAN,BEA]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5),e=enemy(b);wound(a);wound(z);b.addBuff(z,{key:'test:isolated',flags:{isolated:true}});e.base.res=40;e.markDirty();
  shot(b,u,[e],.7);const dmg=u.s.atk*.6*scale;near(100000-e.hp,dmg);near(a.hp-100,dmg*.5);near(z.hp,100);near(u.stats.heal,dmg*.5);
  if(elite){const f=e.findBuff(`hbisc2:fragile:${u.id}`);assert.ok(f);advance(b,5.1);assert.equal(e.findBuff(`hbisc2:fragile:${u.id}`),null);}
 }
});

test('Hibiscus S1 selected ATK retains ordinary source attack event and flight and supports airborne enemy',()=>{
 for(const rank of Array.from({length:10},(_,i)=>i+1)){
  const{b,deploy}=make(HIB,{rank,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3),e=enemy(b);wound(a);e.motion='FLY';cast(b,u);near(u.s.atk,u.base.atk*(1+bb(HIB,0,rank).atk));
  shot(b,u,[e],.7);near(100000-e.hp,u.s.atk*1.12);near(a.hp-100,u.s.atk*1.12*.5);
 }
});

test('Hibiscus S2 waits native predelay, locks two ALL-motion targets and performs eight separated damage/heal pulses',()=>{
 for(const rank of Array.from({length:10},(_,i)=>i+1)){
  const{b,deploy}=make(HIB,{skill:1,rank,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3),e=enemy(b,4,2),z=enemy(b,5,2),outside=enemy(b,9,7);wound(a);z.motion='FLY';cast(b,u);
  advance(b,.15);near(e.hp,100000);advance(b,.08);const one=u.s.atk*bb(HIB,1,rank).atk_scale*1.12;near(100000-e.hp,one);near(100000-z.hp,one);near(a.hp-100,one);
  near(e.s.moveSpeed,0);near(e.findBuff(`hbisc2:link:${u.id}:${e.id}`).mods.moveMul,1+bb(HIB,1,rank).move_speed);
  advance(b,7.2);near(100000-e.hp,one*8);near(100000-z.hp,one*8);near(outside.hp,100000);near(a.hp-100,one*8);assert.equal(u.stats.attacks,0);
  advance(b,1);assert.equal(u.skill.active,false);assert.equal(e.findBuff(`hbisc2:link:${u.id}:${e.id}`),null);
 }
});

test('Hibiscus retained links follow their original victims outside range and do not select replacements',()=>{
 const{b,deploy}=make(HIB,{skill:1}),u=deploy(),e=enemy(b),z=enemy(b,5,2);cast(b,u);advance(b,.3);e.x=9;e.y=7;z.x=10;z.y=7;const hp=e.hp,newcomer=enemy(b);advance(b,1);
 assert.ok(e.hp<hp);near(newcomer.hp,100000);b.retreat(u);const stopped=e.hp;advance(b,2);near(e.hp,stopped);assert.equal(e.findBuff(`hbisc2:link:${u.id}:${e.id}`),null);
});

test('Hibiscus emitted links survive temporary disappearance, resume their victim and retain original expiry',()=>{
 const{b,deploy}=make(HIB,{skill:1}),u=deploy(),e=enemy(b);cast(b,u);advance(b,.3);
 const amount=100000-e.hp,key=`hbisc2:link:${u.id}:${e.id}`;e.hidden=true;advance(b,2);near(100000-e.hp,amount);
 assert.equal(u.skill.active,true);assert.ok(e.findBuff(key));assert.equal(u.mem.hibiscusLink.targets[0],e);
 e.hidden=false;advance(b,1);near(100000-e.hp,amount*2);assert.equal(u.skill.active,true);
 e.hidden=true;advance(b,5);assert.equal(u.skill.active,false);assert.equal(e.findBuff(key),null);assert.equal(u.mem.hibiscusLink,null);
});

test('Hibiscus startup interruption prevents late links, all victim deaths recover and foreign slows survive',()=>{
 const a=make(HIB,{skill:1}),u=a.deploy(),e=enemy(a.b);cast(a.b,u);advance(a.b,.05);a.b.applyStatus(u,'stun',{duration:.05});advance(a.b,.5);near(e.hp,100000);assert.equal(u.skill.active,false);
 const{b,deploy}=make(HIB,{skill:1}),v=deploy(),z=enemy(b);b.addBuff(z,{key:'foreign:slow',mods:{moveMul:.8}});cast(b,v);advance(b,.3);b.kill(z,null);advance(b,1);
 assert.equal(v.skill.active,false);assert.ok(z.findBuff('foreign:slow'));assert.equal(z.findBuff(`hbisc2:link:${v.id}:${z.id}`),null);
});

test('Hibiscus remembers sub-tick control before link emission while already emitted links continue',()=>{
 for(const status of['stun','freeze','sleep','levitate']){
  const first=make(HIB,{skill:1}),u=first.deploy(),e=enemy(first.b);cast(first.b,u);advance(first.b,.05);
  first.b.applyStatus(u,status,{duration:.001});advance(first.b,.6);
  near(e.hp,100000);assert.equal(u.canAct,true);assert.equal(u.skill.active,false);assert.equal(u.mem.hibiscusLink,null);
  const{b,deploy}=make(HIB,{skill:1}),v=deploy(),z=enemy(b);cast(b,v);advance(b,.3);const hp=z.hp;
  b.applyStatus(v,status,{duration:.001});advance(b,1);assert.ok(z.hp<hp);assert.equal(v.skill.active,true);
  assert.ok(z.findBuff(`hbisc2:link:${v.id}:${z.id}`));
 }
});
