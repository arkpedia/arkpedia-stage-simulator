// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import source from '../data/arkpedia-zuole-prefabs.json' with { type: 'json' };
import { ZUOLE_OPERATORS as configs } from '../shared/arkpedia/zuole-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
const ID = 'char_4121_zuole';
const near = (a, e, t = 1e-5) => assert.ok(Math.abs(a-e)<t, `${a} != ${e}`);
const nodes = rs => rs.flatMap(r=>r.components.map(c=>({pathId:c.pathId,...c.data})));
function build({skill=0,rank=10,elite=2,potential=1}={}) {
 const op=data.operators[ID];assert.ok(op,'Reviewed Zuo Le source snapshot required');
 rank=Math.min(rank,elite===2?10:elite===1?7:4);
 return {...defaultBuild(op),elite,level:op.phases[elite].maxLevel,potential,skillId:op.skills[skill].id,skillRank:rank};
}
function make(opts={}) {
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const b=new StandardBattle(d,{operators:[build(opts)]});b.setViewport('fullscreen-workspace');b.autoFinish=false;b.recordEvents=true;
 b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 rng(b,[.99]);b.receipts=[];b.on('damaged',c=>b.receipts.push({...c,time:b.time}));
 return {b,deploy:(r=3,c=4,dir='RIGHT')=>{b.addDp('arkpedia',99);const u=b.deployOperator(ID,r,c,dir);assert.ok(u);u.atkCd=1000;u.skill.rule='NEVER';return u;}};
}
function rng(b,values) {let n=0;const prior=b.rng;const r=()=>values[Math.min(n++,values.length-1)];r.pick=prior.pick;r.int=prior.int;r.chance=p=>r()<p;b.rng=r;return()=>n;}
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function enemy(b,{r=3,c=5,hp=100000,def=0,fly=false}={}) {
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});Object.assign(e.base,{maxHp:100000,def,res:0,moveSpeed:0});
 e.def={...e.def,immune:new Set(e.def.immune)};e.markDirty();void e.s;e.hp=hp;if(fly)e.motion='FLY';
 b.addBuff(e,{key:'test:pin',persist:true,flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function move(b,e,r,c){e.x=c;e.y=r;e.tileR=r;e.tileC=c;b._enemiesDirty=true;b._buildEnemyIndex();}
function cast(u){u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.activate('test'),true);u.atkCd=1000;}
function shot(b,u,target){assert.equal(b.forceAttack(u,target==null?undefined:Array.isArray(target)?target:[target]),true);u.atkCd=1000;return b._evq.filter(x=>x[0]==='atk'&&x[1]===u.id).at(-1)?.[4];}
function wound(b,u,ratio){u.hp=u.s.maxHp*ratio;advance(b,.27);}
const damage=(b,u,e)=>b.receipts.filter(c=>c.source===u&&c.target===e);
const s2bar=u=>u.findBuff('zuole:s2-barrier');
const s3bar=u=>u.findBuff('zuole:s3-barrier');

test('complete three-skill source retains four exact bundles, official facing bytes, selectors and explicit clock limits',()=>{
 assert.deepEqual(Object.keys(configs),[ID]);assert.equal(source.frameParity,false);assert.equal(source.sourceBundles.length,4);
 for(const x of source.sourceBundles)assert.match(x.sha256,/^[0-9a-f]{64}$/);
 for(const f of['Front','Back'])assert.equal(source.originalModels[ID][f].sha256,source.officialSkeletonBindings[ID][f].sha256);
 const n=nodes(source.characters[ID]);assert.equal(n.find(x=>x.pathId==='6783719039450205986')._limitedMaxTargetNumToBlockedCnt,1);
 const a=nodes(source.skills.skchr_zuole_3).find(x=>x.pathId==='5501235587358330213');assert.equal(a._timeMode,1);assert.equal(a._waitAttackEventForAllAttacks,1);assert.equal(a._onlyFeedActiveBuffToLastOne,1);
 assert.deepEqual(source.originalModels[ID].Front.hits.Skill_3,[.2,.5,.6,.7,.8,.9,1.2]);
 assert.ok(source.verificationLimits.some(x=>x.includes('1.2')));assert.ok(source.verificationLimits.some(x=>x.includes('shielded0')));
});
test('all thirty ranks and source promotion/potential candidates instantiate complete native kits',()=>{
 for(let skill=0;skill<3;skill++)for(let rank=1;rank<=10;rank++){const{b,deploy}=make({skill,rank}),u=deploy();assert.equal(u.skill.id,configs[ID].skillIds[skill]);assert.equal(u.skill.noSkill,false);assert.deepEqual(b.errors,[]);}
 for(const elite of[0,1,2]){const{deploy}=make({elite}),u=deploy();assert.equal(u.def.traitBb.value,[30,50,70][elite]);assert.equal(u.def.talents.length,elite===2?2:1);}
});
test('native normal opening adds Begin once, with one direct ground physical victim and independent DEF',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b,{def:100}),z=enemy(b,{c:5.1}),air=enemy(b,{fly:true});
 const v=shot(b,u,e);assert.deepEqual(v.animation,{begin:'Attack_Begin',loop:'Attack',beginDuration:.233});near(v.windup,.7);
 advance(b,.65);near(e.hp,100000);advance(b,.1);near(100000-e.hp,u.s.atk-100);near(z.hp,100000);near(air.hp,100000);assert.equal(b.projectiles.list.length,0);
 const next=shot(b,u,e);assert.equal(next.animation,'Attack');near(next.windup,.467);
});
test('normal INPUT retains an unavailable living startup victim instead of retargeting at release',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b),other=enemy(b,{c:5.1});shot(b,u,e);e.hidden=true;advance(b,.8);near(e.hp,100000);near(other.hp,100000);
});
test('normal full animation disengages through exact End before next first-only opening',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b);shot(b,u,e);advance(b,.8);move(b,e,1,8);advance(b,.67);
 assert.equal(u.mem.regularFormVisual?.clip,'Attack_End');advance(b,.3);assert.equal(u.mem.regularFormVisual,null);move(b,e,3,5);const next=shot(b,u,e);assert.equal(next.animation.begin,'Attack_Begin');
});
test('uncapped native normal/S1 animation rates scale while S2 loop cap1 stays distinct',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b);b.addBuff(u,{key:'speed',mods:{aspd:200}});near(shot(b,u,e).windup,.7/3);advance(b,.3);cast(u);near(shot(b,u,e).windup,.666/3);
 const second=make({skill:1}),a=second.deploy(),z=enemy(second.b);cast(a);advance(second.b,.4);second.b.addBuff(a,{key:'speed',mods:{aspd:200}});near(shot(second.b,a,z).windup,.367);
});
test('trait30/50/70 heals per accepted output and external heals remain prohibited',()=>{
 for(const elite of[0,1,2]){const{b,deploy}=make({elite}),u=deploy(),e=enemy(b);wound(b,u,.2);const hp=u.hp;b.dealDamage(u,e,{amount:100,type:'phys',isAttack:true});near(u.hp-hp,[30,50,70][elite]);near(b.heal(e,u,100),0);}
});
test('accepted-output bridge counts shielded zero but excludes cancelled/dodged/reflected/element/HPLOSS output',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b);wound(b,u,.1);u.skill.spType='none';u.skill.setSpTotal(0);rng(b,[0]);const hp=u.hp;
 b.addBuff(e,{key:'shield',shield:1000});b.dealDamage(u,e,{amount:100,type:'phys',isAttack:true});near(u.hp-hp,70);near(u.skill.spTotal,1);
 b.addBuff(e,{key:'dodge',mods:{dodgePhys:1}});let h=u.hp,s=u.skill.spTotal;b.dealDamage(u,e,{amount:100,type:'phys',isAttack:true});near(u.hp,h);near(u.skill.spTotal,s);b.removeBuff(e,'dodge');
 const hook=b.on('hit',ctx=>{if(ctx.source===u)ctx.dmg.cancel=true;});b.dealDamage(u,e,{amount:100,type:'phys',isAttack:true});b.off(hook);near(u.hp,h);near(u.skill.spTotal,s);
 for(const x of[{type:'true',tags:['mlynar:inverse']},{type:'element',element:'burn'},{type:'elemental',element:'burn'}])b.dealDamage(u,e,{amount:1,isAttack:true,...x});
 b.loseHp(e,1,{source:u});b.dealDamage(u,e,{amount:1,type:'true',isAttack:false});near(u.hp,h);near(u.skill.spTotal,s);
});
test('trait self-heal bypasses HealFree but still respects shared healing received modifiers',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b);wound(b,u,.1);b.addBuff(u,{key:'heal',flags:{healFree:true},mods:{healingTakenMul:.5}});const hp=u.hp;b.dealDamage(u,e,{amount:1,type:'phys',isAttack:true});near(u.hp-hp,35);
});
test('Tenacity linear maxima use exact E0/E1/E2 HP thresholds and additive SP regeneration',()=>{
 for(const elite of[0,1,2]){const{b,deploy}=make({elite}),u=deploy(),t=u.def.talents.find(t=>t.bb.min_hp_ratio!=null).bb;
 b.addBuff(u,{key:'external',mods:{aspd:7,spRecoveryFlat:.3}});wound(b,u,(1+t.min_hp_ratio)/2);near(u.s.aspd,u.base.aspd+7+t.min_attack_speed/2);near(u.s.spRecovery,1+.3+t.min_sp_recovery_per_sec/2);
 wound(b,u,.01);near(u.s.aspd,u.base.aspd+7+t.min_attack_speed);near(u.s.spRecovery,1+.3+t.min_sp_recovery_per_sec);wound(b,u,1);near(u.s.aspd,u.base.aspd+7);assert.equal(u.buffs.filter(x=>x.key==='zuole:tenacity').length,1);}
});
test('Tenacity sampling starts at actual fractional deployment rather than bench construction',()=>{
 const{b,deploy}=make();advance(b,1.5);const u=deploy();u.hp=u.s.maxHp*.1;advance(b,.2);near(u.s.aspd,u.base.aspd);advance(b,.1);near(u.s.aspd,u.base.aspd+50);
});
test('T2 strict half-HP comparison and potential selected probabilities use pre-trait-heal HP',()=>{
 for(const[potential,ratio,roll,expected]of[[1,.5,.2,0],[1,.499,.69,1],[1,.499,.7,0],[5,.5,.22,1],[5,.499,.74,1]]){
 const{b,deploy}=make({potential}),u=deploy(),e=enemy(b);wound(b,u,ratio);u.skill.spType='none';u.skill.setSpTotal(0);rng(b,[roll]);b.dealDamage(u,e,{amount:1,type:'phys',isAttack:true});near(u.skill.spTotal,expected);}
});
test('T2 per-output lottery cannot bypass own S1 noSP or timed S2 locks',()=>{
 for(const skill of[0,1]){const{b,deploy}=make({skill}),u=deploy(),e=enemy(b);wound(b,u,.1);u.skill.spType='none';rng(b,[0]);cast(u);
 if(skill===0){shot(b,u,e);advance(b,.7);}else{advance(b,.4);b.dealDamage(u,e,{amount:1,type:'phys',isAttack:true});}
 near(u.skill.spTotal,0);}
});
test('S1 all ranks retain selected costs/charges and independently armored chosen low-HP triple hits',()=>{
 for(let rank=1;rank<=10;rank++){const{b,deploy}=make({rank}),u=deploy(),e=enemy(b,{def:100});wound(b,u,.1);u.skill.spType='none';const hp=u.hp,atk=u.s.atk;cast(u);const v=shot(b,u,e);advance(b,v.windup+.25);
 near(100000-e.hp,3*(atk*u.skill.bb.atk_scale-100));near(u.hp-hp,210);assert.equal(damage(b,u,e).length,3);assert.equal(u.skill.active,false);assert.equal(u.skill.charges,0);assert.equal(u.skill.maxCharges,data.operators[ID].skills[0].levels[rank-1].spData.maxChargeTime);}
});
test('S1 HP exactly.8/.5 selects strict branches and below thresholds selects2/3',()=>{
 for(const[ratio,count]of[[.8,1],[.799,2],[.5,2],[.499,3]]){const{b,deploy}=make(),u=deploy(),e=enemy(b);wound(b,u,ratio);cast(u);const v=shot(b,u,e);advance(b,v.windup+.3);assert.equal(damage(b,u,e).length,count);}
});
test('S1 pre-cast HP branch stays triple when self-healing crosses halfHP between releases',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b);wound(b,u,.499);const hp=u.hp;cast(u);const v=shot(b,u,e);advance(b,v.windup+.3);assert.equal(damage(b,u,e).length,3);near(u.hp-hp,210);assert.ok(u.hpRatio>.5);
});
test('S1 first hit plus .1 sampled-rate tails share identity and each mitigate DEF separately',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b,{def:100});wound(b,u,.1);const rate=u.s.aspd/100;cast(u);const v=shot(b,u,e);for(let i=0;i<60&&!damage(b,u,e).length;i++)b.step();assert.equal(damage(b,u,e).length,1);advance(b,.1/rate);assert.equal(damage(b,u,e).length,2);advance(b,.1/rate+.02);const rs=damage(b,u,e);assert.equal(rs.length,3);assert.equal(new Set(rs.map(c=>c.dmg.attackId)).size,1);for(const r of rs)near(r.amount,u.s.atk*u.skill.bb.atk_scale-100);
});
test('S1 dead unborn input refunds one charge; emitted own kill or living hidden input do not',()=>{
 for(const why of['dead','ownkill','hidden']){const{b,deploy}=make(),u=deploy(),e=enemy(b,{hp:why==='ownkill'?1:100000});cast(u);const v=shot(b,u,e);if(why==='dead')b.kill(e);else if(why==='hidden')e.hidden=true;advance(b,v.windup+.3);assert.equal(u.skill.charges,why==='dead'?1:0);}
});
test('S1 does not replace first input or a dying tail victim with another nearby enemy',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b,{hp:1}),z=enemy(b,{c:5.1});wound(b,u,.1);cast(u);const v=shot(b,u,e);advance(b,v.windup+.3);near(z.hp,100000);assert.equal(e.alive,false);assert.equal(u.skill.charges,0);
});
test('S1 accepted sub-frame control cancels unborn release and preserves pending charge',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b);cast(u);const v=shot(b,u,e);b.applyStatus(u,'stun',{duration:.001});advance(b,v.windup+.2);near(e.hp,100000);assert.equal(u.skill.pending,true);assert.equal(u.mem.zuoleS1,null);assert.equal(Boolean(u.s.flags.noSp),false);
});
test('S1 sub-frame control after first release cancels extra spells without refunding emitted output',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b);wound(b,u,.1);cast(u);const v=shot(b,u,e);for(let i=0;i<60&&!damage(b,u,e).length;i++)b.step();assert.equal(damage(b,u,e).length,1);b.applyStatus(u,'stun',{duration:.001});advance(b,.3);assert.equal(damage(b,u,e).length,1);assert.equal(u.skill.charges,0);
});
test('S1 own summed Begin+Loop noSP window differs from emitted outputs and literal End presentation',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b);u.skill.spType='none';cast(u);shot(b,u,e);advance(b,.8);assert.equal(damage(b,u,e).length,1);near(u.skill.gainSp(1,'talent'),0);advance(b,.65);assert.equal(u.mem.regularFormVisual?.clip,'Skill_1_End');assert.equal(u.skill.gainSp(1,'talent'),1);assert.ok(u.s.flags.disarm);advance(b,.3);assert.equal(u.mem.regularFormVisual,null);assert.equal(Boolean(u.s.flags.disarm),false);
});
test('S2 currentHP cost is exact at all ranks, nonlethal fractional floor, shield/modifier bypass',()=>{
 for(let rank=1;rank<=10;rank++){const{b,deploy}=make({skill:1,rank}),u=deploy();u.hp=100;b.addBuff(u,{key:'external-shield',shield:10000});b.addBuff(u,{key:'fragile',mods:{dmgTakenMul:10}});cast(u);near(u.hp,50);near(u.findBuff('external-shield').shield,10000);near(s2bar(u).shield,u.s.maxHp*u.skill.bb.scale);const r=b.receipts.find(c=>c.target===u);assert.equal(r.dmg.type,'true');assert.equal(r.dmg.isAttack,true);assert.equal(r.dmg.tags.includes('HPLOSS'),false);}
 const{deploy}=make({skill:1}),u=deploy();u.hp=1.2;cast(u);near(u.hp,1);
});
test('S2 selected ATK/block lasts12sec, source Begin/Idle/End forms cleanly restore',()=>{
 const{b,deploy}=make({skill:1}),u=deploy();b.addBuff(u,{key:'external',mods:{atkPct:.2,blockCnt:1}});cast(u);near(u.s.atk,u.base.atk*(1+.2+u.skill.bb.atk));near(u.s.blockCnt,u.base.blockCnt+2);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Begin');assert.ok(u.s.flags.disarm);
 advance(b,.4);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Idle');assert.equal(Boolean(u.s.flags.disarm),false);advance(b,11.7);assert.equal(u.skill.active,false);near(u.s.atk,u.base.atk*1.2);near(u.s.blockCnt,u.base.blockCnt+1);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_End');advance(b,.3);assert.equal(u.mem.regularFormVisual,null);assert.ok(u.findBuff('external'));
});
test('S2 cap current block capacity includes unblocked range victims with blocked priority and no fourth hit',()=>{
 const{b,deploy}=make({skill:1}),u=deploy(),e=enemy(b,{r:3,c:3}),a=enemy(b),z=enemy(b,{c:5.1}),extra=enemy(b,{c:5.2}),air=enemy(b,{fly:true});cast(u);advance(b,.4);e.blockedBy=u;u.blocking=[e];let ts=acquireTargets(b,u,effectiveProfile(u));assert.equal(ts.length,2);assert.equal(ts[0],e);assert.ok(!ts.includes(air));b.addBuff(u,{key:'block',mods:{blockCnt:1}});ts=acquireTargets(b,u,effectiveProfile(u));assert.equal(ts.length,3);assert.ok(ts.includes(a)&&ts.includes(z));shot(b,u);advance(b,.5);assert.equal([e,a,z,extra].filter(e=>e.hp<100000).length,3);
});
test('natural S2 capacity attack emits each victim exactly once and self-heals for each',()=>{
 const{b,deploy}=make({skill:1}),u=deploy(),e=enemy(b),z=enemy(b,{c:5.1}),extra=enemy(b,{c:5.2});cast(u);advance(b,.4);const hp=u.hp;u.atkCd=0;b.step();u.atkCd=1000;advance(b,.5);assert.equal(u.stats.attacks,1);assert.equal([e,z,extra].filter(e=>e.hp<100000).length,2);near(u.hp-hp,140);
});
test('S2 nonderived barrier survives skill finish and decreases200 only at its original one-second cadence',()=>{
 const{b,deploy}=make({skill:1}),u=deploy();cast(u);const amount=s2bar(u).shield;advance(b,.55);u.skill.end('manual-test');assert.ok(s2bar(u));advance(b,.35);near(s2bar(u).shield,amount);advance(b,.15);near(s2bar(u).shield,amount-200);advance(b,1);near(s2bar(u).shield,amount-400);
});
test('S2 reactivation adds remaining value capped2MaxHP and pauses decay without restarting its clock',()=>{
 const{b,deploy}=make({skill:1}),u=deploy();cast(u);advance(b,.55);u.skill.end('test');advance(b,.3);b.dealDamage(null,u,{amount:100,type:'true'});const old=s2bar(u),before=old.shield,acc=old._acc;cast(u);assert.equal(s2bar(u),old);near(old.shield,Math.min(u.s.maxHp*2,before+u.s.maxHp*u.skill.bb.scale));near(old._acc,acc);advance(b,.3);near(old.shield,Math.min(u.s.maxHp*2,before+u.s.maxHp*u.skill.bb.scale));u.skill.end('test');advance(b,.9);assert.ok(old.shield<Math.min(u.s.maxHp*2,before+u.s.maxHp*u.skill.bb.scale));
});
test('S2 barrier absorbs Physical/Arts/True after mitigation but direct HP loss bypasses it',()=>{
 const{b,deploy}=make({skill:1}),u=deploy(),e=enemy(b);cast(u);let amount=s2bar(u).shield,hp=u.hp;
 for(const[type,value]of[['phys',u.s.def+100],['arts',100/Math.max(.01,1-u.s.res/100)],['true',100]]){b.dealDamage(e,u,{amount:value,type});amount-=100;near(s2bar(u).shield,amount);near(u.hp,hp);}
 b.loseHp(u,10);near(u.hp,hp-10);near(s2bar(u).shield,amount);
});
test('S2 zero remaining barrier removes owned core while unrelated shields stay separate',()=>{
 const{b,deploy}=make({skill:1}),u=deploy();cast(u);const amount=s2bar(u).shield;b.dealDamage(null,u,{amount,type:'true'});assert.equal(s2bar(u),null);b.addBuff(u,{key:'other',shield:50});u.skill.end('test');advance(b,1.1);near(u.findBuff('other').shield,50);
});
test('S3 manual eligibility requires source ground strip while hidden/air/side/out-of-range inputs preserve SP',()=>{
 for(const where of[{fly:true},{r:2,c:5},{r:3,c:8},{c:5,hidden:true}]){const{b,deploy}=make({skill:2}),u=deploy(),e=enemy(b,where);if(where.hidden)e.hidden=true;u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.activate('test'),false);assert.equal(u.skill.charges,1);}
 const{deploy,b}=make({skill:2}),u=deploy();enemy(b,{c:7});cast(u);assert.ok(u.mem.zuoleS3);
});
test('S3 all ten ranks hit six ordinary and one double armored wave with last-only source Stun',()=>{
 for(let rank=1;rank<=10;rank++){const{b,deploy}=make({skill:2,rank}),u=deploy(),e=enemy(b,{def:100});cast(u);advance(b,1.15);assert.equal(damage(b,u,e).length,6);assert.equal(Boolean(e.s.flags.stun),false);advance(b,.15);assert.equal(damage(b,u,e).length,7);const rs=damage(b,u,e);for(const x of rs.slice(0,6))near(x.amount,u.s.atk*u.skill.bb.atk_scale-100);near(rs[6].amount,u.s.atk*u.skill.bb.atk_scale*2-100);assert.equal(e.s.flags.stun,true);}
});
test('S3 exact seven absolute output clocks ignore ASPD while full2sec action/noSP remains separate',()=>{
 const{b,deploy}=make({skill:2}),u=deploy(),e=enemy(b);b.addBuff(u,{key:'speed',mods:{aspd:200}});u.skill.spType='none';cast(u);const start=b.time;advance(b,1.3);const rs=damage(b,u,e);assert.equal(rs.length,7);for(let i=0;i<7;i++)near(rs[i].time-start,source.originalModels[ID].Front.hits.Skill_3[i],b.dt*1.1);assert.ok(u.mem.zuoleS3);near(u.skill.gainSp(1,'talent'),0);assert.ok(u.s.flags.disarm);advance(b,.8);assert.equal(u.mem.zuoleS3,null);assert.equal(Boolean(u.s.flags.disarm),false);assert.equal(u.skill.gainSp(1,'talent'),1);
});
test('S3 cap3 and fixed strip exclude out-of-range blocked input without multiplying whole waves per victim',()=>{
 const{b,deploy}=make({skill:2}),u=deploy(),es=[enemy(b),enemy(b,{c:5.1}),enemy(b,{c:6}),enemy(b,{c:7})],far=enemy(b,{r:2,c:3});far.blockedBy=u;u.blocking=[far];cast(u);advance(b,1.3);assert.equal(es.filter(e=>e.hp<100000).length,3);for(const e of es.filter(e=>e.hp<100000))assert.equal(damage(b,u,e).length,7);near(far.hp,100000);assert.equal(b.receipts.filter(c=>c.source===u&&c.target.side==='enemy').length,21);
});
test('S3 CAST reselection accepts new legal strip victim and stops hidden previous victim between waves',()=>{
 const{b,deploy}=make({skill:2}),u=deploy(),e=enemy(b),z=enemy(b,{r:1,c:8});cast(u);advance(b,.27);assert.equal(damage(b,u,e).length,1);e.hidden=true;move(b,z,3,6);advance(b,1);assert.equal(damage(b,u,e).length,1);assert.equal(damage(b,u,z).length,6);
});
test('S3 each accepted output converts fixed trait70 into210barrier without HP healing or damage-based scaling',()=>{
 const{b,deploy}=make({skill:2}),u=deploy(),e=enemy(b,{def:100000});u.hp=u.s.maxHp*.1;const hp=u.hp;cast(u);advance(b,.27);near(u.hp,hp);near(s3bar(u).shield,210);advance(b,1.05);near(s3bar(u).shield,7*210);near(u.hp,hp);
});
test('S3 conversion extends remaining barrier to15sec and preserves consumed value across repeated uses',()=>{
 const{b,deploy}=make({skill:2}),u=deploy(),e=enemy(b);cast(u);advance(b,2.1);let old=s3bar(u);b.dealDamage(null,u,{amount:100,type:'true'});const remaining=old.shield;advance(b,1);cast(u);advance(b,.27);assert.equal(s3bar(u),old);near(old.shield,Math.min(u.s.maxHp*2,remaining+210));near(old.timeLeft+b.time,damage(b,u,e).at(-1).time+15,b.dt*2);advance(b,2);near(old.shield,Math.min(u.s.maxHp*2,remaining+1470));advance(b,15.1);assert.equal(s3bar(u),null);
});
test('S3 stopped conversion restores ordinary self healing while independent shield persists',()=>{
 const{b,deploy}=make({skill:2}),u=deploy(),e=enemy(b);u.hp=u.s.maxHp*.1;cast(u);advance(b,2.1);const shield=s3bar(u).shield,hp=u.hp;b.dealDamage(u,e,{amount:1,type:'phys',isAttack:true});near(u.hp-hp,70);near(s3bar(u).shield,shield);
});
test('S3 accepted sub-frame control cancels all unborn waves and clears own noSP/action form',()=>{
 const{b,deploy}=make({skill:2}),u=deploy(),e=enemy(b);cast(u);b.applyStatus(u,'stun',{duration:.001});advance(b,2.1);near(e.hp,100000);assert.equal(u.mem.zuoleS3,null);assert.equal(Boolean(u.s.flags.noSp),false);assert.equal(Boolean(u.s.flags.disarm),false);assert.equal(u.mem.regularFormVisual,null);
});
test('S3 after first output control cancels tails but preserves emitted nonderived15sec shield',()=>{
 const{b,deploy}=make({skill:2}),u=deploy(),e=enemy(b);cast(u);advance(b,.27);assert.equal(damage(b,u,e).length,1);b.applyStatus(u,'freeze',{duration:.001});advance(b,1.5);assert.equal(damage(b,u,e).length,1);near(s3bar(u).shield,210);assert.equal(u.mem.zuoleS3,null);
});
test('source Stun immunity and Resist use status pipeline without cancelling final double damage',()=>{
 for(const mode of['immune','resist']){const{b,deploy}=make({skill:2}),u=deploy(),e=enemy(b);if(mode==='immune')e.def.immune.add('stun');else b.applyStatus(e,'resist',{duration:10,value:.5});cast(u);advance(b,1.3);assert.equal(damage(b,u,e).length,7);if(mode==='immune')assert.equal(Boolean(e.s.flags.stun),false);else{assert.ok(e.s.flags.stun);advance(b,2.6);assert.equal(Boolean(e.s.flags.stun),false);}}
});
test('owner control immunity does not falsely invalidate the S3 latched cast',()=>{
 const{b,deploy}=make({skill:2}),u=deploy(),e=enemy(b);u.def={...u.def,immune:new Set(u.def.immune)};u.def.immune.add('stun');cast(u);const epoch=u.attackControlEpoch;assert.equal(b.applyStatus(u,'stun',{duration:.001}),false);assert.equal(u.attackControlEpoch,epoch);advance(b,1.3);assert.equal(damage(b,u,e).length,7);
});
test('S1/S3 withdrawal or death cancels unborn outputs and removes only owner barriers',()=>{
 for(const skill of[0,2])for(const why of['withdraw','death']){const{b,deploy}=make({skill}),u=deploy(),e=enemy(b);wound(b,u,.1);cast(u);if(skill===0)shot(b,u,e);if(why==='withdraw')b.retreatOperator(ID);else b.kill(u);advance(b,2);near(e.hp,100000);assert.equal(u.mem.zuoleS1,null);assert.equal(u.mem.zuoleS3,null);assert.equal(u.mem.regularFormVisual,null);}
});
test('S2/S3 nonderived barriers die with the actual owner and redeployment starts without inherited shield',()=>{
 for(const skill of[1,2]){const{b,deploy}=make({skill}),u=deploy(),e=enemy(b);cast(u);advance(b,.4);assert.ok(skill===1?s2bar(u):s3bar(u));b.retreatOperator(ID);b.bench[ID].readyAt=b.time;const v=deploy();assert.equal(s2bar(v),null);assert.equal(s3bar(v),null);assert.ok(v!==u);near(v.hp,v.s.maxHp);}
});
test('sub-frame accepted control cancels normal startup and restores first-only Begin on recovery',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b);shot(b,u,e);b.applyStatus(u,'stun',{duration:.001});advance(b,.8);near(e.hp,100000);const v=shot(b,u,e);assert.equal(v.animation.begin,'Attack_Begin');near(v.windup,.7);advance(b,.8);assert.equal(damage(b,u,e).length,1);
});
test('S3 actual barrier addition clamps to2currentMaxHP even when one converted output exceeds the cap',()=>{
 const{b,deploy}=make({skill:2}),u=deploy(),e=enemy(b);u.base.maxHp=100;u.markDirty();void u.s;u.hp=100;cast(u);advance(b,.27);near(s3bar(u).shield,200);advance(b,1.05);near(s3bar(u).shield,200);near(u.hp,100);
});
test('S3 accepted shielded0 output converts trait value while dodged/reflected/HPLOSS receipts do not',()=>{
 const{b,deploy}=make({skill:2}),u=deploy(),e=enemy(b);cast(u);b.addBuff(e,{key:'shield',shield:10000});b.dealDamage(u,e,{amount:100,type:'phys',isAttack:true});near(s3bar(u).shield,210);const hp=u.hp;
 rng(b,[0]);b.addBuff(e,{key:'dodge',mods:{dodgePhys:1}});b.dealDamage(u,e,{amount:100,type:'phys',isAttack:true});b.removeBuff(e,'dodge');
 b.dealDamage(u,e,{amount:1,type:'true',isAttack:true,tags:['mlynar:inverse']});b.loseHp(e,1,{source:u});b.dealDamage(u,e,{amount:1,type:'element',element:'burn',isAttack:true});near(s3bar(u).shield,210);near(u.hp,hp);
});
test('S1 SELF release selects a legal substitute without refund and retains that first release victim for tails',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b),z=enemy(b,{r:1,c:8}),later=enemy(b,{r:1,c:7});wound(b,u,.1);u.skill.spType='none';cast(u);shot(b,u,e);b.kill(e);move(b,z,3,5);
 for(let i=0;i<60&&!damage(b,u,z).length;i++)b.step();assert.equal(damage(b,u,z).length,1);move(b,later,3,5);b.addBuff(later,{key:'taunt',mods:{taunt:100}});advance(b,.3);assert.equal(damage(b,u,z).length,3);near(later.hp,100000);assert.equal(u.skill.charges,0);
});
test('S1 pre-cast HP branch survives an external HP rise before the first release',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b);wound(b,u,.499);cast(u);const v=shot(b,u,e);u.hp=u.s.maxHp*.85;advance(b,v.windup+.3);assert.equal(damage(b,u,e).length,3);
});
test('S2 SELF release reads changed current block capacity rather than the startup target count',()=>{
 for(const change of[0,1]){const{b,deploy}=make({skill:1}),u=deploy(),es=[enemy(b),enemy(b,{c:5.1}),enemy(b,{c:5.2})];cast(u);advance(b,.4);shot(b,u);b.addBuff(u,{key:'dynamic-cap',mods:change?{blockCnt:1}:{blockCntMul:0}});advance(b,.5);assert.equal(es.filter(e=>e.hp<100000).length,change?3:1);}
});
