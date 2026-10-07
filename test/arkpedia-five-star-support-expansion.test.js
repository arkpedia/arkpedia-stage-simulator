// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-five-star-support-expansion-prefabs.json' with { type: 'json' };
import { FIVE_STAR_SUPPORT_EXPANSION_OPERATORS } from '../shared/arkpedia/five-star-support-expansion-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
import { regularSummonCards, deployRegularSummon } from '../server/sim/content/arkpedia-summons.js';
const IST='char_195_glassb',PRO='char_4032_provs',GRA='char_4122_grabds',MAN='char_215_mantic',KIR='char_478_kirara';
const near=(a,e)=>assert.ok(Math.abs(a-e)<1e-5,`${a} != ${e}`);
function advance(b,seconds){for(let i=0;i<Math.round(seconds/b.dt);i++)b.step();assert.deepEqual(b.errors,[]);}
function make(id,{skill=0,rank=10,elite=2,potential=1,others=[]}={}){
  const source=structuredClone(data),op=source.operators[id];assert.ok(op,`Reviewed snapshot required: ${id}`);
  source.stage.geometry.waves[0].spawns=[];source.stage.battle.dp_per_second=0;
  const b=new StandardBattle(source,{operators:[{...defaultBuild(op),elite,level:op.phases[elite].maxLevel,
    potential,skillId:op.skills[skill].id,skillRank:rank},...others.map(id=>defaultBuild(source.operators[id]))]});
  b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);
  const deploy=(who=id,row=[MAN,KIR].includes(who)?3:1,col=[MAN,KIR].includes(who)?3:4,dir=[MAN,KIR].includes(who)?'RIGHT':'UP')=>{
    const u=b.deployOperator(who,row,col,dir);u.atkCd=1000;return u;
  };
  return{b,deploy,source};
}
function enemy(b,{row=2,col=4,def=0,res=0,fly=false,wild=false}={}){
  const e=b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});e.base.maxHp=e.hp=100000;e.base.def=def;e.base.res=res;e.base.moveSpeed=1;
  if(fly)e.motion='FLY';if(wild)e.tags.add('wildanimal');e.markDirty();
  b.addBuff(e,{key:'test:pin',persist:true,flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function cast(b,u){u.skill.gainSp(u.skill.spCost,'test');assert.equal(u.skill.manual?b.activateOperator(u.defId):u.skill.activate('test'),true);u.atkCd=1000;}
function bb(id,skill,rank){const s=data.operators[id].skills[skill].levels[rank-1],values=Object.fromEntries(s.blackboard.map(r=>[r.key,r.value]));return{...values,duration:s.duration>0?s.duration:values.duration};}
function strike(b,u,targets,seconds=1){const hp=targets.map(e=>e.hp);b.forceAttack(u,targets);u.atkCd=1000;advance(b,seconds);return targets.map((e,i)=>hp[i]-e.hp);}

test('original source contracts include BAT addition, faction tags, Wild Beast trait, Manticore cast selection and Kirara timer cadence',()=>{
  for(const[id,config]of Object.entries(FIVE_STAR_SUPPORT_EXPANSION_OPERATORS)){
    assert.match(evidence.sourceBundles.find(b=>b.path===`charpack/${id}.ab`).sha256,/^[a-f0-9]{64}$/);
    assert.ok(evidence.characters[id].length);assert.match(evidence.models[id].Front.sha256,/^[a-f0-9]{64}$/);
    for(const skill of config.skillIds)assert.ok(evidence.skills[skill].length);
  }
  assert.equal(evidence.skills.skchr_glassb_1.find(x=>x._buffs?.length)._buffs[0].attributes.attributeModifiers[0].formulaItem,0);
  assert.deepEqual(evidence.characters[PRO].find(x=>x._tags)._tags,['kazimierz']);
  assert.equal(evidence.characters[MAN].find(x=>'_isInitToggled'in x)._isInitToggled,0);
  const attack=evidence.characters[KIR].find(x=>x._timeMode===3&&x._damageType===2);
  near(attack._preDelay,.45);near(attack._cooldown,1);assert.equal(attack._waitForAttackEvent,0);
});
test('all ten selected skills load every original rank without guessed kits or duplicate passive talents',()=>{
  for(const[id,config]of Object.entries(FIVE_STAR_SUPPORT_EXPANSION_OPERATORS))for(let skill=0;skill<2;skill++)for(let rank=1;rank<=10;rank++){
    const{b,deploy}=make(id,{skill,rank}),u=deploy();assert.equal(u.skill.id,config.skillIds[skill]);assert.equal(u.skill.noSkill,false);
    assert.equal(u.def.raw.arkpedia.skillRank,rank);assert.deepEqual(b.errors,[]);
  }
});
test('Istina E2 talent uses source DEF percent and ASPD by potential without affecting E0/E1',()=>{
  for(const[elite,potential,speed]of[[0,1,100],[1,1,100],[2,1,118],[2,5,121]]){
    const{b,deploy}=make(IST,{elite,potential,rank:[4,7,10][elite]}),u=deploy();near(u.s.aspd,speed);near(u.s.def,u.base.def*(elite===2?.65:1));
  }
});
test('Istina S1 subtracts absolute source seconds from BAT rather than multiplying BAT by that number, and expires at every rank',()=>{
  for(let rank=1;rank<=10;rank++){
    const{b,deploy}=make(IST,{rank}),u=deploy(),s=bb(IST,0,rank),base=u.s.interval;cast(b,u);
    near(u.s.interval,(u.base.bat+s.base_attack_time)*100/u.s.aspd);advance(b,s.duration+.1);near(u.s.interval,base);
  }
});
test('Istina S2 uses expanded original range, original two/three target cap and source .5 release, then restores range and ATK',()=>{
  for(let rank=1;rank<=10;rank++){
    const{b,deploy}=make(IST,{rank,skill:1}),u=deploy(),s=bb(IST,1,rank),range=[...u.rangeKeys],atk=u.s.atk;
    for(let i=0;i<4;i++)enemy(b,{col:4+i*.1});cast(b,u);assert.ok(u.s.flags.disarm);near(u.s.atk,atk*(1+s.atk));
    advance(b,.45);assert.equal(Boolean(u.s.flags.disarm),false);assert.equal(u.mem.regularFormVisual.clip,'Skill_Loop');
    assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,s['attack@max_target']);near(effectiveProfile(u).windup,.5);
    assert.equal(effectiveProfile(u).attackVisual,'none');
    b.drainEvents();
    const e=b.enemies[0];strike(b,u,[e],.5);near(e.hp,100000);advance(b,.2);near(100000-e.hp,u.s.atk);
    const visual=b.drainEvents().find(event=>event[0]==='atk'&&event[1]===u.id)?.[4];
    assert.equal(visual.animation,'none');near(visual.windup,.5);assert.equal(visual.projectile,'tracked');
    advance(b,u.skill.timeLeft+.05);near(u.s.atk,atk);assert.deepEqual(u.rangeKeys,range);assert.equal(u.mem.regularFormVisual.clip,'Skill_End');
  }
});
test('Proviso faction talent selects one live original Kazimierz ally, excludes tokens and nonfaction allies, and removes its source on withdrawal',()=>{
  const meteor='char_126_shotst',gravel='char_237_gravel',fang='char_123_fang';
  const{b,deploy}=make(PRO,{others:[meteor,gravel,fang]});
  const a=deploy(meteor,1,3),g=deploy(gravel,2,7),f=deploy(fang,2,6);b.rng.pick=list=>list[0];const u=deploy();
  near(u.s.aspd,110);near(a.s.aspd,110);near(g.s.aspd,100);near(f.s.aspd,100);assert.ok(a.def.raw.tags.includes('kazimierz'));
  b.retreat(a);advance(b,.1);near(g.s.aspd,110);b.retreat(u);near(g.s.aspd,100);
});
test('Proviso S1 preserves charges, source Arts scale, extended Slow duration and one target at every rank',()=>{
  for(let rank=1;rank<=10;rank++){
    const{b,deploy}=make(PRO,{rank}),u=deploy(),e=enemy(b,{res:20}),s=bb(PRO,0,rank);cast(b,u);
    const amounts=strike(b,u,[e],.8);near(amounts[0],u.s.atk*s.atk_scale*.8);assert.ok(e.findBuff('sluggish'));
    advance(b,s.sluggish);assert.equal(Boolean(e.findBuff('sluggish')),false);assert.equal(u.skill.maxCharges,s.ct);
    const n=strike(b,u,[e],.8);near(n[0],u.s.atk*.8);
  }
});
test('Proviso S2 area attack hits ground/air at source begin strike, applies statuses and only changes BAT after the original begin clip ends',()=>{
  for(let rank=1;rank<=10;rank++){
    const{b,deploy}=make(PRO,{rank,skill:1}),u=deploy(),e=enemy(b),air=enemy(b,{col:4.1,fly:true}),s=bb(PRO,1,rank),base=u.s.interval;cast(b,u);
    advance(b,.4);near(e.hp,100000);near(u.s.interval,base);advance(b,.15);
    for(const t of[e,air]){near(100000-t.hp,u.s.atk*s.atk_scale);assert.ok(t.findBuff('sluggish'));assert.ok(t.s.flags.silence);}
    assert.ok(u.s.flags.disarm);advance(b,.3);near(u.s.interval,(u.base.bat+s.base_attack_time)*100/u.s.aspd);assert.equal(Boolean(u.s.flags.disarm),false);
    advance(b,s.duration);near(u.s.interval,base);assert.equal(u.skill.active,false);
  }
});
test('Grain Buds source Wild Beast tag alone extends the trait Slow for phase/potential, with no duplicated ASPD talent',()=>{
  for(const[elite,potential,speed,extension]of[[0,1,100,0],[1,1,106,.2],[1,5,108,.2],[2,1,110,.4],[2,5,112,.4]]){
    const{b,deploy}=make(GRA,{elite,potential,rank:[4,7,10][elite]}),u=deploy(),e=enemy(b,{wild:true}),other=enemy(b,{col:4.1});near(u.s.aspd,speed);
    strike(b,u,[e],.7);strike(b,u,[other],.7);assert.ok(other.findBuff('sluggish'));advance(b,.75);assert.equal(Boolean(other.findBuff('sluggish')),false);
    // A new wild hit lets us observe its own duration independently.
    strike(b,u,[e],.7);advance(b,.75);assert.equal(Boolean(e.findBuff('sluggish')),extension>0);advance(b,.4);assert.equal(Boolean(e.findBuff('sluggish')),false);
  }
});
test('Grain Buds S1 releases two source projectiles for one charge at every rank and ordinary attacks select one',()=>{
  for(let rank=1;rank<=10;rank++){
    const{b,deploy}=make(GRA,{rank}),u=deploy(),e=enemy(b),other=enemy(b,{col:4.1}),third=enemy(b,{col:4.2}),s=bb(GRA,0,rank);cast(b,u);
    const list=acquireTargets(b,u,effectiveProfile(u));assert.equal(list.length,2);const amounts=strike(b,u,list,.8);
    for(const amount of amounts)near(amount,u.s.atk*s.atk_scale);assert.equal(u.skill.pending,false);near(third.hp,100000);
    assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,1);assert.equal(u.skill.maxCharges,s.ct);
  }
});
test('Grain Buds S2 sleeps only the original capped targets including air, disarms for source sleep interval, then attacks three until original duration ends',()=>{
  for(let rank=1;rank<=10;rank++){
    const{b,deploy}=make(GRA,{rank,skill:1}),u=deploy(),s=bb(GRA,1,rank),initial=[];
    for(let i=0;i<4;i++)initial.push(enemy(b,{col:4+i*.1,fly:i===0}));cast(b,u);
    assert.equal(initial.filter(e=>e.s.flags.sleep).length,s.max_target);assert.ok(u.s.flags.disarm);
    const late=enemy(b,{col:4.2});assert.equal(Boolean(late.s.flags.sleep),false);advance(b,s.sleep+.1);
    assert.equal(Boolean(u.s.flags.disarm),false);assert.equal(initial.some(e=>e.s.flags.sleep),false);near(u.s.aspd,110+s.attack_speed);
    assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,s.max_target);near(effectiveProfile(u).windup,.2);
    assert.equal(effectiveProfile(u).attackVisual,'none');
    advance(b,s.duration-s.sleep);assert.equal(u.skill.active,false);near(u.s.aspd,110);assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,1);
  }
});
test('Manticore and Kirara preserve zero block, source low taunt and 50% physical/Arts dodge without dodging true damage',()=>{
  for(const id of[MAN,KIR]){
    const{b,deploy}=make(id),u=deploy();near(u.s.blockCnt,0);near(u.s.taunt,-1);near(u.s.dodgePhys,.5);near(u.s.dodgeArts,.5);b.rng=()=>0;
    const hp=u.hp;b.dealDamage(null,u,{amount:100,type:'phys'});b.dealDamage(null,u,{amount:100,type:'arts'});near(u.hp,hp);
    b.dealDamage(null,u,{amount:100,type:'true'});near(u.hp,hp-100);
  }
});
test('Manticore S1 damages all ground targets and stacks its movement multiplier with Slow instead of replacing Slow at every rank',()=>{
  for(let rank=1;rank<=10;rank++){
    const{b,deploy}=make(MAN,{rank}),u=deploy(),e=enemy(b,{row:3,col:4}),other=enemy(b,{row:3,col:3.9}),air=enemy(b,{row:3,col:4,fly:true}),s=bb(MAN,0,rank);
    const list=acquireTargets(b,u,effectiveProfile(u));assert.equal(list.length,2);for(const amount of strike(b,u,list,.8))near(amount,u.s.atk);near(air.hp,100000);
    near(e.s.moveSpeed,1+s.move_speed);b.applyStatus(e,'sluggish',{duration:10});near(e.s.moveSpeed,(1+s.move_speed)*.2);
    advance(b,s.duration+.1);near(e.s.moveSpeed,.2);assert.equal(Boolean(e.findBuff('manticore:movement')),false);
  }
});
test('Manticore invisibility uses original initial-off delay, source promotion/potential charge and consumes one whole area attack after damage',()=>{
  for(const[elite,potential,delay,atk]of[[1,1,6,.25],[1,5,6,.29],[2,1,5,.5],[2,5,5,.54]]){
    const{b,deploy}=make(MAN,{elite,potential,rank:elite===1?7:10}),u=deploy(),e=enemy(b,{row:3,col:4}),other=enemy(b,{row:3,col:3.9}),base=u.s.atk;
    assert.equal(Boolean(u.s.flags.stealth),false);advance(b,delay-.1);near(u.s.atk,base);advance(b,.15);assert.ok(u.s.flags.stealth);near(u.s.atk,base*(1+atk));
    for(const amount of strike(b,u,[e,other],.8))near(amount,base*(1+atk));assert.equal(Boolean(u.s.flags.stealth),false);near(u.s.atk,base);
    advance(b,delay);assert.ok(u.s.flags.stealth);
  }
});
test('Manticore S2 uses additive ATK charge, additive BAT, longer original windup and strike-time target selection at all ranks',()=>{
  for(let rank=1;rank<=10;rank++){
    const{b,deploy}=make(MAN,{rank,skill:1}),u=deploy(),e=enemy(b,{row:3,col:4}),s=bb(MAN,1,rank);advance(b,5.1);const base=u.base.atk;cast(b,u);
    near(u.s.atk,base*(1+.5+s.atk));near(u.s.interval,u.base.bat+s.base_attack_time);near(effectiveProfile(u).windup(b,u),1.167);
    b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.5);e.x=8;b._buildEnemyIndex();const late=enemy(b,{row:3,col:4});advance(b,.75);
    near(e.hp,100000);near(100000-late.hp,base*(1+.5+s.atk));assert.ok(late.s.flags.stun);near(u.s.atk,base*(1+s.atk));
    advance(b,s['attack@stun']+.1);assert.equal(Boolean(late.s.flags.stun),false);advance(b,s.duration);assert.equal(u.skill.active,false);
  }
});
test('Kirara regeneration distinguishes cardinal/diagonal allied operators from distant operators and devices; source skill multiplies the currently selected regen family',()=>{
  const fang='char_123_fang',roberta='char_484_robrta';
  for(const[elite,potential,nearRate,farRate]of[[1,1,.01,.02],[1,5,.01,.025],[2,1,.02,.035],[2,5,.02,.04]]){
    const{b,deploy}=make(KIR,{elite,potential,rank:elite===1?7:10,skill:1,others:[fang,roberta]}),u=deploy();advance(b,.1);near(u.s.hpRegen,u.s.maxHp*farRate);
    const ally=deploy(fang,2,3);advance(b,.1);near(u.s.hpRegen,u.s.maxHp*nearRate);b.retreat(ally);advance(b,.1);near(u.s.hpRegen,u.s.maxHp*farRate);
    deploy(roberta,2,7);const card=regularSummonCards(b).find(c=>c.ownerId===roberta);assert.ok(card);
    const device=deployRegularSummon(b,card.key,2,2,'RIGHT');assert.ok(device);advance(b,.1);near(u.s.hpRegen,u.s.maxHp*farRate);
    cast(b,u);near(u.s.hpRegen,u.s.maxHp*farRate*bb(KIR,1,elite===1?7:10).talent_scale);advance(b,u.skill.duration+.1);near(u.s.hpRegen,u.s.maxHp*farRate);
  }
});
test('Kirara S1 preserves each physical area hit and follows it .15 seconds later with independent Arts mitigation at every rank',()=>{
  for(let rank=1;rank<=10;rank++){
    const{b,deploy}=make(KIR,{rank}),u=deploy(),e=enemy(b,{row:3,col:4,def:100,res:50}),other=enemy(b,{row:3,col:3.9,res:50}),s=bb(KIR,0,rank);cast(b,u);
    strike(b,u,[e,other],.5);near(100000-e.hp,u.s.atk-100);near(100000-other.hp,u.s.atk);advance(b,.2);
    near(100000-e.hp,u.s.atk-100+u.s.atk*s['kirara_s_1.atk_scale']*.5);near(100000-other.hp,u.s.atk*(1+s['kirara_s_1.atk_scale']*.5));
  }
});
test('Kirara S2 timer uses eight ground Arts pulses at .45+integer seconds, remains independent of ASPD, and stops on original duration/death',()=>{
  for(let rank=1;rank<=10;rank++){
    const{b,deploy}=make(KIR,{rank,skill:1}),u=deploy(),e=enemy(b,{row:3,col:4,res:50}),air=enemy(b,{row:3,col:4,fly:true}),s=bb(KIR,1,rank);b.addBuff(u,{key:'test:aspd',mods:{aspd:200}});cast(b,u);
    advance(b,.4);near(e.hp,100000);advance(b,.1);near(100000-e.hp,u.s.atk*s['attack@atk_scale']*.5);
    advance(b,s.duration);near(100000-e.hp,u.s.atk*s['attack@atk_scale']*.5*8);near(air.hp,100000);assert.equal(u.skill.active,false);
    const hp=e.hp;advance(b,2);near(e.hp,hp);
  }
  const{b,deploy}=make(KIR,{skill:1}),u=deploy(),e=enemy(b,{row:3,col:4});cast(b,u);advance(b,1);b.retreat(u);const hp=e.hp;advance(b,2);near(e.hp,hp);
});

test('entering a duration mode cancels a source normal attack still winding up, without a late projectile or duplicate release',()=>{
  for(const id of[IST,PRO,GRA,KIR]){
    const{b,deploy}=make(id,{skill:1}),u=deploy(),e=enemy(b,{row:id===KIR?3:2,col:4});
    b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.1);cast(b,u);advance(b,.3);near(e.hp,100000);
    if(id===IST||id===GRA){advance(b,.7);near(e.hp,100000);}
    assert.deepEqual(b.errors,[]);
  }
});
test('withdrawal during the original skill entrance cancels Proviso burst/interval and all owned visual transition callbacks',()=>{
  for(const id of[IST,PRO,GRA,KIR]){
    const{b,deploy}=make(id,{skill:1}),u=deploy(),e=enemy(b,{row:id===KIR?3:2,col:4});
    cast(b,u);advance(b,.1);b.retreat(u);const hp=e.hp;advance(b,2);
    near(e.hp,hp);assert.equal(u.findBuff('proviso:interval'),null);assert.equal(u.skill.active,false);
    assert.equal(u.mem.regularFormVisual,null);assert.deepEqual(b.errors,[]);
  }
});
test('Manticore preserves the charged attack after a wholly dodged area hit, consumes it only after damage, and never duplicates it on restoration',()=>{
  const{b,deploy}=make(MAN),u=deploy(),e=enemy(b,{row:3,col:4}),base=u.s.atk;
  advance(b,5.1);b.addBuff(e,{key:'test:dodge',mods:{dodgePhys:1}});const hp=e.hp;
  strike(b,u,[e],.8);near(e.hp,hp);near(u.s.atk,base*1.5);assert.equal(Boolean(u.s.flags.stealth),false);
  advance(b,5);near(u.s.atk,base*1.5);assert.ok(u.s.flags.stealth);
  b.removeBuff(e,'test:dodge');strike(b,u,[e],.8);near(hp-e.hp,base*1.5);near(u.s.atk,base);
});
test('Kirara timer cannot output damage while controlled and its skill still expires on the source wall-clock duration',()=>{
  const{b,deploy}=make(KIR,{skill:1}),u=deploy(),e=enemy(b,{row:3,col:4});cast(b,u);
  b.applyStatus(u,'stun',{duration:2});advance(b,1.9);near(e.hp,100000);advance(b,.8);
  near(100000-e.hp,u.s.atk);advance(b,5.4);assert.equal(u.skill.active,false);const hp=e.hp;advance(b,2);near(e.hp,hp);
});
