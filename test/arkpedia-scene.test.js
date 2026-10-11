// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import evidence from '../data/arkpedia-scene-prefabs.json' with {type:'json'};
import{StandardBattle}from'../server/sim/arkpedia.js';
import{defaultBuild}from'../shared/arkpedia/loadout.js';
import{summonRecordFor,summonCardId,summonUnitId,REGULAR_SUMMONS}from'../shared/arkpedia/summons.js';
import{deployRegularSummon,retreatRegularSummon,regularSummonCards,summonPlacementError}from'../server/sim/content/arkpedia-summons.js';
import{effectiveProfile,acquireTargets}from'../server/sim/ai.js';
import{canTargetAlly,areaSelectable,enemyStealthed}from'../server/sim/targeting.js';
const ID='char_336_folivo',TOKEN='token_10010_folivo_car',FAN='char_123_fang';
const near=(a,e,t=1e-5)=>assert.ok(Math.abs(a-e)<t,`${a} != ${e}`);
const advance=(b,s)=>{for(let i=0;i<Math.round(s/b.dt);i++)b.step();assert.deepEqual(b.errors,[]);};
function make({skill=0,rank=10,elite=2,level=null,potential=1,trust=0,dir='RIGHT',others=[],defer=false}={}){
 const source=structuredClone(data),o=source.operators[ID];assert.ok(o,'Reviewed Scene snapshot required');source.stage.geometry.waves[0].spawns=[];source.stage.battle.dp_per_second=0;
 const build={...defaultBuild(o),elite,level:level??o.phases[elite].maxLevel,potential,trust,skillId:o.skills[skill].id,skillRank:rank};
 const b=new StandardBattle(source,{operators:[build,...others.map(id=>defaultBuild(source.operators[id]))]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);
 const deploy=(id=ID,r=1,c=4)=>{b.addDp('arkpedia',99);const u=b.deployOperator(id,r,c,dir);assert.ok(u);u.atkCd=1000;return u;};return{b,u:defer?null:deploy(),build,deploy};
}
const bb=(s,r=10)=>Object.fromEntries(data.operators[ID].skills[s].levels[r-1].blackboard.map(x=>[x.key,x.value]));
const card=b=>regularSummonCards(b).find(s=>s.ownerId===ID);
const cam=(b,r=2,c=5,dir='RIGHT')=>{const t=deployRegularSummon(b,summonCardId(ID),r,c,dir);assert.ok(t);t.atkCd=1000;return t;};
function cast(b,u){u.skill.setSpTotal(u.skill.spCost);if(u.skill.manual)assert.equal(b.activateOperator(ID),true);else advance(b,.034);u.atkCd=1000;assert.equal(u.skill.active,true);}
function enemy(b,{hp=100000,x=6,y=2,def=0,res=0,fly=false,stealth=false}={}){const e=b.spawnEnemy('enemy_1007_slime',{pos:[0,0]});e.x=x;e.y=y;e.base.maxHp=100000;e.base.def=def;e.base.res=res;e.base.moveSpeed=0;if(fly)e.motion='FLY';e.markDirty();void e.s;e.hp=hp;b.addBuff(e,{key:'pin',flags:{noMove:true,disarm:true,...(stealth?{stealth:true}:{})}});b._buildEnemyIndex();return e;}
const shot=(b,u,t,s=.9)=>{b.forceAttack(u,[t]);u.atkCd=1000;advance(b,s);};
const row=(rs,id)=>rs.find(r=>r.pathId===id).data;

test('six original bundles, all20 owner+10 remote ranks and actual distinct camera facing bindings retained',()=>{
 assert.equal(evidence.frameParity,false);assert.equal(evidence.source.bundles.length,6);for(const r of evidence.source.bundles)assert.match(r.sha256,/^[a-f0-9]{64}$/);assert.deepEqual(evidence.enabledOperators,[ID]);
 for(const id of['skchr_folivo_1','skchr_folivo_2'])assert.equal(evidence.tables[ID].skillLevels[id].length,10);assert.equal(evidence.tables[TOKEN].skillLevels.sktok_folivo_2.length,10);
 for(const face of['Front','Back']){near(evidence.models[ID][face].hits.Attack[0],.533);assert.equal(evidence.originalFacingBindings[ID][face].sha256,evidence.models[ID][face].sha256);near(evidence.models[TOKEN][face].hits.Attack[0],.333);assert.equal(evidence.models[TOKEN][face].animationRoles.deploy,null);assert.equal(evidence.models[TOKEN][face].durations.Start,undefined);}
 assert.notEqual(evidence.models[TOKEN].Front.files[TOKEN+'.skel'].sha256,evidence.models[TOKEN].Back.files[TOKEN+'.skel'].sha256);assert.ok(evidence.verificationLimits.some(x=>x.includes('waitForCasting0')));const animator=row(evidence.tokens[TOKEN],'-4518583715073781608');assert.deepEqual(animator._animations.find(x=>x.animKey==='Stun'),{animKey:'Stun',animName:'Stun',loop:0,speed:1,ignoreMissing:0});assert.equal(animator._animations.some(x=>['Start','Born'].includes(x.animKey)),false);for(const face of['Front','Back'])near(evidence.models[TOKEN][face].durations.Stun,.9);
});
test('all20 selected ranks suppress own generic ATK/talent and preserve Arts source basic attack',()=>{
 for(let skill=0;skill<2;skill++)for(let rank=1;rank<=10;rank++){const{b,u}=make({skill,rank});assert.equal(u.s.atk,u.base.atk);assert.equal(u.s.def,u.base.def);assert.equal(u.profile.install,null);assert.equal(u.profile.dmgType,'arts');assert.equal(u.profile.retargetOnRelease,true);assert.equal(u.profile.projectileSpeed,10);assert.equal(u.skill.kind,skill===0?'toggle':'duration');assert.deepEqual(b.errors,[]);}
});
test('native E0/E1/E2 born stocks and simultaneous/deck caps are3/4/5, never generic1',()=>{
 for(const elite of[0,1,2]){const{b,build}=make({elite,rank:[4,7,10][elite]}),r=summonRecordFor(ID,build,data.tokens);assert.equal(card(b).stock,elite+3);assert.equal(r.stats.maxDeployCount,elite+3);assert.equal(r.stats.maxDeckStackCnt,elite+3);assert.equal(REGULAR_SUMMONS[ID].sourceStockLimit,true);assert.equal(r.stats.respawnTime,10);}
});
test('camera uses own native source phase/level stats without parent trust/potential bonuses',()=>{
 for(const elite of[0,1,2])for(const level of[1,data.operators[ID].phases[elite].maxLevel])for(const potential of[1,6]){const{b,u}=make({elite,level,potential,trust:200,rank:[4,7,10][elite]}),t=cam(b),s=data.tokens[TOKEN].phases[elite],lo=s.attributesKeyFrames[0],hi=s.attributesKeyFrames.at(-1),r=(level-lo.level)/(hi.level-lo.level);for(const key of['atk','def','maxHp'])near(t.base[key],Math.round(lo.data[key]+(hi.data[key]-lo.data[key])*r));assert.notEqual(t.base.atk,u.base.atk);assert.equal(t.def.skill,null);assert.equal(t.s.flags.healFree,true);}
});
test('camera card ground-facing placement consumes DP5/slot1/one stock and independent10sec cooldown',()=>{
 const{b,u}=make(),dp=b.dp,slots=b.deployedSlots();assert.equal(summonPlacementError(b,summonCardId(ID),1,5),'Choose a melee tile.');const t=cam(b,2,5,'LEFT');near(dp-b.dp,5);assert.equal(b.deployedSlots(),slots+1);assert.equal(t.dir,'LEFT');assert.equal(t.ownerUnit,u);assert.equal(card(b).stock,4);near(card(b).readyAt,10);assert.equal(summonPlacementError(b,summonCardId(ID),2,6),'Summon is still redeploying.');advance(b,10);assert.equal(summonPlacementError(b,summonCardId(ID),2,6),null);
});
test('manual retreat refunds floor2 without replenishing spent camera; source ten-second clock continues',()=>{
 const{b}=make(),t=cam(b),dp=b.dp;retreatRegularSummon(b,summonUnitId(t));assert.equal(t.alive,false);near(b.dp-dp,2);assert.equal(card(b).stock,4);near(card(b).readyAt,10);advance(b,2);assert.equal(summonPlacementError(b,summonCardId(ID),2,5),'Summon is still redeploying.');
});
test('genuine camera defeat never charges a replacement and cleans only its original reveal marker',()=>{
 const{b}=make(),t=cam(b),e=enemy(b,{stealth:true,x:5,y:3});advance(b,.1);assert.equal(enemyStealthed(e),false);b.addBuff(e,{key:'foreignReveal',flags:{reveal:true}});b.kill(t,e);assert.equal(card(b).stock,4);assert.equal(e.findBuff(`scene:reveal:${t.id}`),null);assert.equal(enemyStealthed(e),false);b.removeBuff(e,'foreignReveal');assert.equal(enemyStealthed(e),true);
});
test('source per-owner simultaneous camera cap refuses fourth E0 camera even with synthetic extra stock',()=>{
 const{b}=make({elite:0,rank:4});cam(b,2,5);advance(b,10);cam(b,2,6);advance(b,10);cam(b,3,3);advance(b,10);b.regularSummons.get(summonCardId(ID)).stock=1;assert.equal(summonPlacementError(b,summonCardId(ID),2,6),'Summon deployment limit reached.');
});
test('missing/fabricated camera source or out-of-source promotion/level fail closed',()=>{
 const{build}=make(),tokens=structuredClone(data.tokens);delete tokens[TOKEN];assert.throws(()=>summonRecordFor(ID,build,tokens),/Missing reviewed/);assert.throws(()=>summonRecordFor(ID,{...build,elite:3},data.tokens),/promotion/);assert.throws(()=>summonRecordFor(ID,{...build,level:81},data.tokens),/promotion/);for(const bad of[null,-1,1.5]){const invalid=structuredClone(data.tokens);for(const t of invalid[TOKEN].talents[0].candidates){if(bad===null)t.blackboard=t.blackboard.filter(x=>x.key!=='max_deck_stack_cnt');else t.blackboard.find(x=>x.key==='max_deck_stack_cnt').value=bad;}assert.throws(()=>summonRecordFor(ID,build,invalid),/stock|deck|limits|source/i);}
});
test('S1 automatically activates at full SP without enemies and remains permanent with token-only selected ATK',()=>{
 const{b,u}=make(),t=cam(b);cast(b,u);near(t.s.atk,t.base.atk*1.6);near(u.s.atk,u.base.atk);assert.equal(t.s.flags.camou,true);assert.equal(u.mem.regularFormVisual.clip,'Skill_1');advance(b,1);assert.equal(u.mem.regularFormVisual,null);advance(b,80);assert.equal(u.skill.active,true);near(u.skill.spTotal,0);near(t.s.atk,t.base.atk*1.6);
});
test('S1 every original selected rank applies its source ATK without changing owner or token defense',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u}=make({rank}),t=cam(b);cast(b,u);near(t.s.atk,t.base.atk*(1+bb(0,rank).atk));near(t.s.def,t.base.def);near(t.s.res,0);near(u.s.atk,u.base.atk);}
});
test('native camouflage checker disables while blocking, restores immediately and is distinct from stealth',()=>{
 const{b,u}=make(),t=cam(b),e=enemy(b);cast(b,u);assert.equal(canTargetAlly(e,t,true),false);assert.equal(areaSelectable(e,t),true);assert.equal(!!t.s.flags.stealth,false);t.blocking.push(e);u.mem.summonSkillSync();assert.equal(!!t.s.flags.camou,false);assert.equal(canTargetAlly(e,t,true),true);t.blocking=[];u.mem.summonSkillSync();assert.equal(t.s.flags.camou,true);
});
test('normal camera reveal covers original surrounding8+own tile for air/Sleep/Invisible but not free/hidden',()=>{
 const{b}=make(),t=cam(b),a=enemy(b,{stealth:true,x:4,y:3,fly:true}),z=enemy(b,{stealth:true,x:7,y:2}),s=enemy(b,{stealth:true,x:5,y:3}),f=enemy(b,{stealth:true,x:6,y:3}),h=enemy(b,{stealth:true,x:4,y:2});b.applyStatus(s,'sleep',{duration:10});b.addBuff(f,{key:'free',flags:{untargetable:true}});h.hidden=true;advance(b,.1);for(const e of[a,s])assert.equal(enemyStealthed(e),false);for(const e of[z,f,h])assert.equal(enemyStealthed(e),true);assert.equal(t.rangeKeys.length,2);
});
test('S2 expands only original reveal x-4→x-2 and restores on end without expanding1-1 attack range',()=>{
 const{b,u}=make({skill:1}),t=cam(b),e=enemy(b,{stealth:true,x:7,y:2});advance(b,.1);assert.equal(enemyStealthed(e),true);const range=[...t.rangeKeys];cast(b,u);assert.equal(enemyStealthed(e),false);assert.deepEqual(t.rangeKeys,range);assert.ok(!acquireTargets(b,t,effectiveProfile(t)).includes(e));u.skill.end('test');assert.equal(enemyStealthed(e),true);assert.deepEqual(t.rangeKeys,range);
});
test('revealing is a source aura independent of camera silence/stun and detaches on range/target eligibility',()=>{
 const{b}=make(),t=cam(b),e=enemy(b,{stealth:true,x:6,y:3});advance(b,.1);assert.equal(enemyStealthed(e),false);b.applyStatus(t,'stun',{duration:1});b.addBuff(t,{key:'mute',flags:{silence:true}});advance(b,.1);assert.equal(enemyStealthed(e),false);e.x=9;advance(b,.1);assert.equal(enemyStealthed(e),true);e.x=6;b.addBuff(e,{key:'free',flags:{untargetable:true}});advance(b,.1);assert.equal(enemyStealthed(e),true);
});
test('two source cameras hold independent reveal ownership and one removal does not clear the other',()=>{
 const{b}=make(),t=cam(b,2,5);advance(b,10);const q=cam(b,3,5),e=enemy(b,{stealth:true,x:6,y:2});advance(b,.1);assert.ok(e.findBuff(`scene:reveal:${t.id}`));assert.ok(e.findBuff(`scene:reveal:${q.id}`));b.kill(t,e);assert.equal(enemyStealthed(e),false);b.kill(q,e);assert.equal(enemyStealthed(e),true);
});
test('S2 every selected rank grants source ATK%/DEF%/RESflat on original cameras only',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u}=make({skill:1,rank}),t=cam(b);b.addBuff(t,{key:'foreign',mods:{resPct:.5}});cast(b,u);const v=bb(1,rank);near(t.s.atk,t.base.atk*(1+v.atk));near(t.s.def,t.base.def*(1+v.def));near(t.s.res,v.magic_resistance*1.5);near(u.s.atk,u.base.atk);near(u.s.def,u.base.def);near(u.s.res,u.base.res);assert.equal(u.mem.regularFormVisual,undefined);}
});
test('S2 stock recharge is immediate, capped to original deck stock and works with zero deployed camera',()=>{
 const{b,u}=make({skill:1});cast(b,u);assert.equal(card(b).stock,5);u.skill.end('test');const state=b.regularSummons.get(summonCardId(ID));state.stock=0;advance(b,3.1);cast(b,u);assert.equal(card(b).stock,1);u.skill.end('test');state.stock=4;advance(b,3.1);cast(b,u);assert.equal(card(b).stock,5);
});
test('new cameras join an already-active mode while foreign ordinary ally/token never inherit it',()=>{
 const{b,u,deploy}=make({skill:1,others:[FAN]}),a=deploy(FAN,2,3);cast(b,u);const t=cam(b);near(t.s.atk,t.base.atk*2.3);near(a.s.atk,a.base.atk);const state=b.regularSummons.get(summonCardId(ID)),q=b.spawnToken(a,TOKEN,2,4,{def:state.record,kit:{skill:null,trait:{canAttack:()=>false}}});assert.ok(q);advance(b,.1);near(q.s.atk,q.base.atk);assert.equal(q.findBuff(`scene:mode:${u.id}`),null);
});
test('S2 ends at selected duration, removes bonuses and issues independent self-stun5; SP recovery resumes',()=>{
 const{b,u}=make({skill:1}),t=cam(b);cast(b,u);advance(b,19.9);assert.equal(u.skill.active,true);assert.equal(!!t.s.flags.stun,false);advance(b,.2);assert.equal(u.skill.active,false);near(t.s.atk,t.base.atk);near(t.s.def,t.base.def);near(t.s.res,0);assert.equal(t.s.flags.stun,true);advance(b,4.8);assert.equal(t.s.flags.stun,true);advance(b,.3);assert.equal(!!t.s.flags.stun,false);assert.ok(u.skill.spTotal>5);
});
test('remote end command respects native abnormal-state gate while retaining independent non-silenceable aura',()=>{
 const{b,u}=make({skill:1}),t=cam(b);cast(b,u);b.applyStatus(t,'stun',{duration:2});u.skill.end('test');assert.ok(t.findBuff('stun').timeLeft<2.01);advance(b,2.1);assert.equal(!!t.s.flags.stun,false);advance(b,1);cast(b,u);b.addBuff(t,{key:'mute',flags:{silence:true}});u.skill.end('test');assert.equal(t.s.flags.stun,true);
});
test('native ordinary owner attack releases Arts at .533 and original speed10 without token buff amplification',()=>{
 const{b,u}=make({skill:1}),e=enemy(b,{x:6,y:1,res:25});cast(b,u);const hp=e.hp;shot(b,u,e,.5);near(e.hp,hp);advance(b,.3);near(hp-e.hp,u.base.atk*.75);assert.equal(e.s.flags.reveal,undefined);
});
test('camera physical single-target release at .333 retains defender mitigation and excludes air',()=>{
 const{b}=make(),t=cam(b),a=enemy(b,{def:100}),z=enemy(b,{x:6.1,y:2});shot(b,t,a,.3);near(a.hp,100000);advance(b,.1);near(100000-a.hp,t.base.atk-100);near(z.hp,100000);const f=enemy(b,{fly:true,x:5,y:2});assert.ok(!acquireTargets(b,t,effectiveProfile(t)).includes(f));
});
test('both owner and token windup cap1 ASPD while source normal intervals still shorten',()=>{
 const{b,u}=make(),t=cam(b);for(const x of[u,t])b.addBuff(x,{key:'fast',mods:{aspd:100}});near(effectiveProfile(u).windup(b,u),.533);near(effectiveProfile(t).windup(b,t),.333);near(u.s.interval,u.base.bat/2);near(t.s.interval,t.base.bat/2);
});
test('CAST token attack reacquires entrants and rejects departed/hidden/free victims at release',()=>{
 for(const kind of['leave','hidden','free']){const{b}=make(),t=cam(b),a=enemy(b),z=enemy(b,{x:8,y:2});b.forceAttack(t,[a]);advance(b,.1);if(kind==='leave')a.x=9;if(kind==='hidden')a.hidden=true;if(kind==='free')b.addBuff(a,{key:'free',flags:{untargetable:true}});z.x=6;b._buildEnemyIndex();advance(b,.3);near(a.hp,100000);assert.ok(z.hp<100000);}
});
test('native switch_mode restartFSMfalse preserves an already-unborn camera attack under S2 current stats',()=>{
 const{b,u}=make({skill:1}),t=cam(b),e=enemy(b);b.forceAttack(t,[e]);advance(b,.1);cast(b,u);advance(b,.3);near(100000-e.hp,t.base.atk*2.3);
});
test('short between-frame control cancels unborn strikes but owner removal retains already-emitted projectile',()=>{
 const{b,u}=make(),t=cam(b),e=enemy(b);b.forceAttack(t,[e]);advance(b,.1);b.applyStatus(t,'stun',{duration:.001});advance(b,.4);near(e.hp,100000);const q=enemy(b,{x:6,y:1});b.forceAttack(u,[q]);advance(b,.2);b.applyStatus(u,'stun',{duration:.001});advance(b,.6);near(q.hp,100000);b.forceAttack(u,[q]);advance(b,.567);assert.ok(b.projectiles.list.length);b.retreatOperator(ID);advance(b,.4);near(100000-q.hp,u.base.atk);
});
test('owner withdrawal removes all cameras/reveal/mode, applies no surviving end-stun and fresh born resets stock',()=>{
 const{b,u,deploy}=make({skill:1}),t=cam(b),e=enemy(b,{stealth:true,x:6,y:2});cast(b,u);assert.equal(enemyStealthed(e),false);b.retreatOperator(ID);assert.equal(t.alive,false);assert.equal(enemyStealthed(e),true);assert.equal(!!t.s.flags.stun,false);assert.equal(card(b).available,false);b.time=100;b.addDp('arkpedia',99);const n=deploy();assert.notEqual(n,u);assert.equal(card(b).stock,5);assert.equal(card(b).owner,n);
});
