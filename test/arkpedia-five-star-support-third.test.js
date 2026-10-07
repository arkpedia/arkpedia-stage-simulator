// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-five-star-support-third-prefabs.json' with { type: 'json' };
import { FIVE_STAR_SUPPORT_THIRD_OPERATORS } from '../shared/arkpedia/five-star-support-third-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
import { regularSummonCards, deployRegularSummon } from '../server/sim/content/arkpedia-summons.js';
const SOR='char_101_sora',SHA='char_254_vodfox',CLI='char_173_slchan',ENF='char_4036_forcer',FEA='char_241_panda';
const near=(a,e)=>assert.ok(Math.abs(a-e)<1e-5,`${a} != ${e}`);
function advance(b,s){for(let i=0;i<Math.round(s/b.dt);i++)b.step();assert.deepEqual(b.errors,[]);}
function make(id,{skill=0,rank=10,elite=2,potential=1,others=[]}={}){
  const source=structuredClone(data),op=source.operators[id];assert.ok(op,`Reviewed snapshot required: ${id}`);
  source.stage.geometry.waves[0].spawns=[];source.stage.battle.dp_per_second=0;
  const b=new StandardBattle(source,{operators:[{...defaultBuild(op),elite,level:op.phases[elite].maxLevel,
    potential,skillId:op.skills[skill].id,skillRank:rank},...others.map(build=>typeof build==='string'?defaultBuild(source.operators[build]):build)]});
  b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);
  const deploy=(who=id,row=[SOR,SHA].includes(who)?1:3,col=[SOR,SHA].includes(who)?4:3,dir=[SOR,SHA].includes(who)?'UP':'RIGHT')=>{
    const u=b.deployOperator(who,row,col,dir);u.atkCd=1000;return u;
  };
  return{b,deploy,source};
}
function enemy(b,{row=3,col=4,def=0,weight=0,fly=false}={}){
  const e=b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});e.base.maxHp=e.hp=100000;e.base.def=def;e.base.res=0;e.base.massLevel=weight;e.base.moveSpeed=1;
  if(fly)e.motion='FLY';e.markDirty();b.addBuff(e,{key:'test:pin',persist:true,flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function cast(b,u){u.skill.gainSp(u.skill.spCost,'test');assert.equal(u.skill.manual?b.activateOperator(u.defId):u.skill.activate('test'),true);u.atkCd=1000;}
function strike(b,u,targets,seconds=2){const hp=targets.map(e=>e.hp);b.forceAttack(u,targets);u.atkCd=1000;advance(b,seconds);return targets.map((e,i)=>hp[i]-e.hp);}
function values(id,skill,rank){return Object.fromEntries(data.operators[id].skills[skill].levels[rank-1].blackboard.map(r=>[r.key,r.value]));}

test('original source evidence preserves five exact kits, source projectiles, circle selector and doll duration',()=>{
  for(const[id,config]of Object.entries(FIVE_STAR_SUPPORT_THIRD_OPERATORS)){
    assert.match(evidence.sourceBundles.find(b=>b.path===`charpack/${id}.ab`).sha256,/^[a-f0-9]{64}$/);
    assert.match(evidence.models[id].Front.sha256,/^[a-f0-9]{64}$/);
    for(const skill of config.skillIds)assert.ok(evidence.skills[skill].length);
  }
  near(evidence.skills.skchr_panda_2.find(x=>'m_Radius'in x)?.m_Radius ?? evidence.skills.skchr_panda_2.find(x=>x.m_Radius)?.m_Radius,.9);
  for(const l of evidence.tokens.token_10006_vodfox_doll.levels)near(l.duration,15);
  assert.equal(evidence.characters[ENF].find(x=>x._beginAnim==='Attack_Begin')._onlyPlayBeginAnimWhenFirstAttack,1);
  assert.equal(evidence.buffTemplates['atk_to_atk[final_addition]'].eventToActions.ON_BUFF_TRIGGER[0]._formulaType,'FINAL_ADDITION');
});
test('all ten selected skills load every original rank and the three shifters deploy on both native tile classes',()=>{
  for(const[id,config]of Object.entries(FIVE_STAR_SUPPORT_THIRD_OPERATORS))for(let skill=0;skill<2;skill++)for(let rank=1;rank<=10;rank++){
    const{b,deploy}=make(id,{skill,rank}),u=deploy();assert.equal(u.skill.id,config.skillIds[skill]);assert.equal(u.skill.noSkill,false);
    assert.equal(u.def.raw.arkpedia.skillRank,rank);assert.deepEqual(b.errors,[]);
  }
  for(const id of[CLI,ENF,FEA]){const{deploy}=make(id);assert.ok(deploy(id,1,4,'UP').alive);}
});
test('Sora never attacks; her source one-second heal reaches self and heal-free allies and follows their range',()=>{
  const{b,deploy}=make(SOR,{others:['char_185_frncat']}),u=deploy(),ally=deploy('char_185_frncat',3,4,'RIGHT');
  u.hp-=500;ally.hp-=500;advance(b,.05);const a=u.hp,c=ally.hp;
  advance(b,1);near(u.hp-a,u.s.atk*.1);near(ally.hp-c,u.s.atk*.1);
  assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[]);
  ally.tileR=4;ally.y=4;advance(b,.05);const before=ally.hp;advance(b,1);near(ally.hp,before);
});
test('Sora S1 enhanced healing and sleep aura affect entering enemies, clear on leaving and respect immunity',()=>{
  const{b,deploy}=make(SOR),u=deploy(),e=enemy(b,{row:2,col:4}),immune=enemy(b,{row:2,col:4.1});
  immune.def={...immune.def,immune:new Set(['sleep'])};cast(b,u);assert.ok(e.s.flags.sleep);
  const later=enemy(b,{row:2,col:5});advance(b,.1);
  assert.ok(later.s.flags.sleep);assert.equal(Boolean(immune.s.flags.sleep),false);
  e.x=8;e.y=4;advance(b,.05);assert.equal(Boolean(e.s.flags.sleep),false);
  u.hp-=1500;advance(b,1);assert.ok(u.hp>u.s.maxHp-1500+u.s.atk*.9);
  advance(b,7);assert.equal(Boolean(later.s.flags.sleep),false);
});
test('Sora Inspiration is final additive ATK after recipient modifiers, excludes herself/bards, updates and clears on withdrawal',()=>{
  const{b,deploy}=make(SOR,{skill:1,others:['char_123_fang','char_254_vodfox']}),u=deploy(),ally=deploy('char_123_fang',3,4,'RIGHT'),other=deploy(SHA,1,5,'UP');
  b.addBuff(ally,{key:'test:atk',mods:{atkPct:.5,atkMul:2}});other.def={...other.def,subProf:'bard'};cast(b,u);
  near(ally.s.atk,ally.base.atk*3+u.s.atk);near(u.s.atk,u.base.atk);near(other.s.atk,other.base.atk);
  b.addBuff(u,{key:'test:sora',mods:{atkPct:.5}});advance(b,1.05);near(ally.s.atk,ally.base.atk*3+u.s.atk);
  b.retreatOperator(SOR);near(ally.s.atk,ally.base.atk*3);
});
test('Sora Inspiration carries its semantic tag and respects live noInspire eligibility without suppressing healing',()=>{
  const{b,deploy}=make(SOR,{skill:1,others:['char_123_fang']}),u=deploy(),ally=deploy('char_123_fang',3,4,'RIGHT');
  ally.hp-=500;ally.mem.noInspire=true;const hp=ally.hp;cast(b,u);advance(b,1.05);
  near(ally.s.atk,ally.base.atk);assert.ok(ally.hp>hp);assert.equal(ally.findBuff(`sora:inspiration:${u.id}`),null);
  ally.mem.noInspire=false;advance(b,.05);near(ally.s.atk,ally.base.atk+u.s.atk);
  assert.ok(ally.findBuff(`sora:inspiration:${u.id}`).tags.includes('inspire'));
  ally.mem.noInspire=true;advance(b,.05);near(ally.s.atk,ally.base.atk);assert.equal(ally.findBuff(`sora:inspiration:${u.id}`),null);
});
test('Sora ATK-to-recovery applies recipient final multipliers exactly once for immediate and periodic recovery',()=>{
  const{b,deploy}=make(SOR,{others:['char_123_fang']}),ally=deploy('char_123_fang',3,4,'RIGHT');
  ally.hp=1;b.addBuff(ally,{key:'test:regen-a',mods:{hpRegenMul:.5}});b.addBuff(ally,{key:'test:regen-b',mods:{hpRegenMul:.4}});
  const before=ally.hp,u=deploy();near(ally.hp-before,u.s.atk*.1*.2);advance(b,.05);
  const start=ally.hp;advance(b,1);near(ally.hp-start,u.s.atk*.1*.2);
  b.removeBuff(ally,'test:regen-b');const half=ally.hp;advance(b,1);near(ally.hp-half,u.s.atk*.1*.5);
  b.removeBuff(ally,'test:regen-a');const ordinary=ally.hp;advance(b,1);near(ally.hp-ordinary,u.s.atk*.1);
});
test('Sora cannot regenerate the original Beeswax obelisk in either selected skill, including S1 immediate mode transition',()=>{
  const BEE='char_344_beewax',source=data.operators[BEE];assert.ok(source);
  const beeBuild={...defaultBuild(source),elite:2,level:source.phases[2].maxLevel,skillId:source.skills[1].id,skillRank:10};
  for(const skill of[0,1]){
    const{b,deploy}=make(SOR,{skill,others:[beeBuild]}),u=deploy(SOR,2,4),bee=deploy(BEE,1,4);
    enemy(b,{row:3,col:4});b.rng.pick=list=>list[0];cast(b,bee);advance(b,.8);
    const token=bee.mem.obelisk;assert.ok(token);assert.equal(token.tileR,3);assert.equal(token.tileC,4);
    token.hp=100;assert.equal(token.s.hpRegen,0);cast(b,u);near(token.hp,100);advance(b,1.1);near(token.hp,100);
    assert.ok(token.findBuff(`sora:heal:${u.id}`));assert.equal(b.deployedSlots(),2);
  }
});
test('Sora Encore rolls source probability at natural completion and grants a fraction of max SP, with no withdrawal refund',()=>{
  for(const[elite,ratio]of[[1,.25],[2,.5]]){
    const{b,deploy}=make(SOR,{elite,rank:elite===1?7:10}),u=deploy();b.rng.chance=()=>true;cast(b,u);advance(b,7.05);
    assert.ok(u.skill.sp>=u.skill.spCost*ratio&&u.skill.sp<u.skill.spCost*ratio+.2);
  }
  const{b,deploy}=make(SOR),u=deploy();let rolls=0;b.rng.chance=()=>{rolls++;return true;};cast(b,u);b.retreatOperator(SOR);assert.equal(rolls,0);
});
test('Sora S1 source mode change reattaches healing immediately and restores the default ratio after its seven seconds',()=>{
  const{b,deploy}=make(SOR),u=deploy();u.hp=1;const before=u.hp;cast(b,u);near(u.hp-before,u.s.atk);
  advance(b,7.1);u.hp=1;const baseline=u.hp;advance(b,1);near(u.hp-baseline,u.s.atk*.1);
});
test('Shamare Fragile uses strict less-than threshold, source potential and S1 increases only the Fragile delta',()=>{
  for(const[elite,potential,delta]of[[0,1,.1],[1,1,.2],[2,5,.33]]){
    const{b,deploy}=make(SHA,{elite,potential,rank:[4,7,10][elite]}),u=deploy(),e=enemy(b,{row:2,col:4});e.hp=40000;advance(b,.05);near(e.s.dmgTakenMul,1);
    e.hp=39999;advance(b,.1);near(e.s.dmgTakenMul,1+delta);cast(b,u);near(e.s.dmgTakenMul,1+delta*values(SHA,0,[4,7,10][elite]).scale_delta_to_one);
    e.hp=40000;advance(b,.1);near(e.s.dmgTakenMul,1);b.retreatOperator(SHA);near(e.s.dmgTakenMul,1);
  }
});
test('Shamare selected S1 has no summon card; S2 automatically recharges one stock and blocks all further SP until used',()=>{
  const first=make(SHA);first.deploy();assert.deepEqual(regularSummonCards(first.b),[]);
  const{b,deploy}=make(SHA,{skill:1}),u=deploy();assert.equal(regularSummonCards(b)[0].stock,0);
  advance(b,20.1);assert.equal(regularSummonCards(b)[0].stock,1);assert.ok(u.s.flags.noSp);const sp=u.skill.sp;
  advance(b,35);near(u.skill.sp,sp);assert.equal(regularSummonCards(b)[0].stock,1);
});
test('Shamare doll uses source DP, zero deployment slots, exact final ATK/DEF scalers and fifteen-second cleanup',()=>{
  for(let rank=1;rank<=10;rank++){
    const{b,deploy}=make(SHA,{skill:1,rank}),u=deploy();cast(b,u);const state=regularSummonCards(b)[0],dp=b.dp,slots=b.deployedSlots();
    const e=enemy(b,{row:3,col:4,def:300});b.addBuff(e,{key:'test:stats',mods:{atkPct:.5,defPct:.5}});const atk=e.s.atk,def=e.s.def;
    const token=deployRegularSummon(b,state.key,3,3);near(b.dp,dp-5);assert.equal(b.deployedSlots(),slots);assert.equal(Boolean(u.s.flags.noSp),false);
    const bb=values(SHA,1,rank);near(e.s.atk,atk*(1+bb.atk));near(e.s.def,def*(1+bb.def));assert.ok(token.s.flags.untargetable);
    advance(b,15.1);assert.equal(token.alive,false);near(e.s.atk,atk);near(e.s.def,def);
    assert.ok(u.skill.sp>14&&u.skill.sp<16);
  }
});
test('Shamare doll aura removes from enemies leaving range and owner withdrawal removes the deployed doll',()=>{
  const{b,deploy}=make(SHA,{skill:1}),u=deploy();cast(b,u);const state=regularSummonCards(b)[0],e=enemy(b,{row:3,col:4,def:300}),token=deployRegularSummon(b,state.key,3,3);
  e.x=7;e.y=3;advance(b,.1);near(e.s.def,300);b.retreatOperator(SHA);assert.equal(token.alive,false);
});
test('Cliffheart conditional talent follows actual blocking and restores when enemies are released',()=>{
  const{b,deploy}=make(CLI),u=deploy();near(u.s.atk,u.base.atk*1.12);const e=enemy(b,{row:3,col:3.3});b._checkBlock(e);advance(b,.05);
  near(u.s.atk,u.base.atk);b._unblock(e);e.x=6;advance(b,.05);near(u.s.atk,u.base.atk*1.12);
});
test('Cliffheart S1 launches at source Skill_Start event, deals Arts and pulls the farthest selected enemy',()=>{
  const{b,deploy}=make(CLI),u=deploy(),close=enemy(b,{col:4}),far=enemy(b,{col:5,def:800});cast(b,u);
  assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[far]);const p=effectiveProfile(u);near(p.windup(b,u),1.167);
  const hp=far.hp,atk=u.s.atk;b.forceAttack(u);u.atkCd=1000;advance(b,1.1);near(far.hp,hp);advance(b,.5);near(hp-far.hp,atk*1.8);assert.ok(far.x<5);near(close.hp,100000);
  assert.ok(u.s.flags.noSp);advance(b,2.1);assert.equal(Boolean(u.s.flags.noSp),false);
});
test('Cliffheart S2 hits source two/three cap with true damage and adds stun only after hook link',()=>{
  const{b,deploy}=make(CLI,{skill:1}),u=deploy(),a=enemy(b,{col:5,def:2000}),c=enemy(b,{col:4}),d=enemy(b,{row:4,col:4}),e=enemy(b,{row:2,col:4});
  const atk=u.s.atk;cast(b,u);advance(b,1.6);const hit=[a,c,d,e].filter(t=>t.hp<100000);assert.equal(hit.length,3);
  for(const t of hit){near(100000-t.hp,atk*2);assert.equal(Boolean(t.s.flags.stun),false);}
  advance(b,1.1);for(const t of hit)assert.ok(t.s.flags.stun);
});
test('Cliffheart original unmanaged hooks keep their flight and final stun when the owner withdraws after release',()=>{
  const{b,deploy}=make(CLI,{skill:1}),u=deploy(),e=enemy(b,{col:5});cast(b,u);advance(b,1.25);
  assert.ok(b.projectiles.list.length);assert.ok(b.projectiles.list[0].data.arkpediaTrackedVisual);
  near(e.hp,100000);b.retreatOperator(CLI);advance(b,.3);assert.ok(e.hp<100000);
  advance(b,1);assert.ok(e.s.flags.stun);assert.deepEqual(b.errors,[]);
});
test('Enforcer source normal attacks cap by block count and first engagement prepends Attack_Begin only once',()=>{
  const{b,deploy}=make(ENF),u=deploy();enemy(b);enemy(b,{col:4.1});enemy(b,{col:4.2});assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,2);
  let p=effectiveProfile(u);near(p.windup(b,u),.5);assert.equal(p.attackVisual(b,u).begin,'Attack_Begin');
  strike(b,u,[b.enemies[0]],.6);p=effectiveProfile(u);near(p.windup(b,u),.333);assert.equal(p.attackVisual(b,u),'Attack_Loop');
});
test('Enforcer talent ignores flat DEF only for attacking weight-three-or-heavier targets',()=>{
  const{b,deploy}=make(ENF),u=deploy(),light=enemy(b,{weight:2,def:300}),heavy=enemy(b,{weight:3,def:300});
  const output=strike(b,u,[light,heavy],.6);near(output[0],u.s.atk-300);near(output[1],u.s.atk-120);
});
test('Enforcer S1 uses ordinary full physical damage and applies collision stun only against high ground',()=>{
  const{b,deploy}=make(ENF),u=deploy(),e=enemy(b,{row:3,col:4});cast(b,u);const output=strike(b,u,[e],.6);near(output[0],u.s.atk);assert.ok(e.x>4);
  assert.equal(Boolean(e.s.flags.stun),false);
});
test('Enforcer collision template is highland-only: a raised wall stuns while a low impassable tile does not',()=>{
  for(const height of['HIGH','LOW']){
    const{b,deploy}=make(ENF),u=deploy(),e=enemy(b);b.grid.tiles[3*21+5]={...b.grid.tile(3,5),height,pass:'FLY'};
    cast(b,u);strike(b,u,[e],.6);assert.equal(Boolean(e.s.flags.stun),height==='HIGH');
  }
});
test('Enforcer S2 deals no damage, pushes all source ground targets, stuns direct victims and complete-path brush contacts',()=>{
  const{b,deploy}=make(ENF,{skill:1}),u=deploy(),direct=enemy(b,{col:4}),brush=enemy(b,{col:6.2,row:3.2}),air=enemy(b,{col:4,fly:true});
  const brushX=brush.x;cast(b,u);advance(b,.5);near(direct.hp,100000);near(brush.hp,100000);near(air.hp,100000);
  assert.ok(direct.s.flags.stun);assert.ok(brush.s.flags.stun);near(brush.x,brushX);assert.equal(Boolean(air.s.flags.stun),false);assert.ok(u.s.flags.disarm);
  advance(b,.8);assert.equal(Boolean(u.s.flags.disarm),false);
});
test('FEater Physical Dodge follows promotion and potential and never dodges Arts',()=>{
  for(const[elite,potential,prob]of[[0,1,0],[1,1,.2],[2,1,.4],[2,5,.43]]){
    const{b,deploy}=make(FEA,{elite,potential,rank:[4,7,10][elite]}),u=deploy();near(u.s.dodgePhys,prob);near(u.s.dodgeArts,0);
    const before=u.hp;b.rng.chance=()=>true;b.dealDamage(null,u,{amount:100,type:'arts'});assert.ok(u.hp<before);
  }
});
test('FEater S1 uses source force, multiplicative movement slow, all-rank duration and native block target limit',()=>{
  for(let rank=1;rank<=10;rank++){
    const{b,deploy}=make(FEA,{rank}),u=deploy(),e=enemy(b),s=values(FEA,0,rank);cast(b,u);strike(b,u,[e],1);near(e.s.moveSpeed,1+s.move_speed);assert.ok(e.x>4);
    advance(b,s.duration+.1);near(e.s.moveSpeed,1);
  }
});
test('FEater S2 casts source nearest-target circle rather than whole line and locks through original Start/End',()=>{
  const{b,deploy}=make(FEA,{skill:1}),u=deploy(),nearby=enemy(b,{col:4}),cluster=enemy(b,{col:4.5}),far=enemy(b,{col:6});
  const atk=u.s.atk;cast(b,u);advance(b,.75);near(nearby.hp,100000);advance(b,.1);
  near(100000-nearby.hp,atk*2.5);near(100000-cluster.hp,atk*2.5);near(far.hp,100000);assert.ok(u.s.flags.disarm);
  advance(b,1);assert.equal(Boolean(u.s.flags.disarm),false);
});
test('manual shift casts refuse targetless activation and control/withdrawal cancel the delayed strike',()=>{
  for(const id of[ENF,FEA]){
    const{b,deploy}=make(id,{skill:1}),u=deploy();u.skill.gainSp(u.skill.spCost,'test');assert.equal(b.activateOperator(id),false);
    const e=enemy(b);assert.equal(b.activateOperator(id),true);b.applyStatus(u,'stun',{duration:3});advance(b,2);near(e.hp,100000);
  }
});
