// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-blacknight-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { summonRecordFor, summonCardId, summonUnitId, REGULAR_SUMMONS } from '../shared/arkpedia/summons.js';
import { deployRegularSummon, retreatRegularSummon, regularSummonCards, summonPlacementError } from '../server/sim/content/arkpedia-summons.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
import { canTargetAlly, canTargetEnemy } from '../server/sim/targeting.js';
const ID = 'char_476_blkngt', TOKEN = 'token_10021_blkngt_hypnos', FANG = 'char_123_fang';
const SLEEP = 'blkngt_hypnos_s_1[sleep]', HEAL = 'blkngt_hypnos_s_1[heal]', RAGE = 'blkngt_hypnos_s_1[rage]', AREA = 'blkngt_hypnos_s_2[atk_scale]';
const near = (a, e, tol = 1e-5) => assert.ok(Math.abs(a-e) < tol, `${a} != ${e}`);
const advance = (b,s) => { for(let i=0;i<Math.round(s/b.dt);i++) b.step(); assert.deepEqual(b.errors,[]); };
const row = (rs,id) => rs.find(r=>r.pathId===id)?.data;
const bb = (skill,rank=10) => Object.fromEntries(data.operators[ID].skills[skill].levels[rank-1].blackboard.map(r=>[r.key,r.value]));
function make({skill=0,rank=10,elite=2,level=null,potential=1,trust=0,dir='RIGHT',others=[],defer=false}={}) {
 const source=structuredClone(data),o=source.operators[ID];assert.ok(o,'Reviewed Blacknight snapshot required');
 source.stage.geometry.waves[0].spawns=[];source.stage.battle.dp_per_second=0;
 const build={...defaultBuild(o),elite,level:level??o.phases[elite].maxLevel,potential,trust,skillId:o.skills[skill].id,skillRank:rank};
 const b=new StandardBattle(source,{operators:[build,...others.map(id=>defaultBuild(source.operators[id]))]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);
 const deploy=(id=ID,r=1,c=4)=>{b.addDp('arkpedia',99);const u=b.deployOperator(id,r,c,dir);assert.ok(u);u.atkCd=1000;return u;};
 return {b,u:defer?null:deploy(),build,deploy};
}
const card=b=>regularSummonCards(b).find(s=>s.ownerId===ID);
function point(b,r=2,c=5,{warm=true}={}){const t=deployRegularSummon(b,summonCardId(ID),r,c,'RIGHT');assert.ok(t);t.atkCd=1000;if(warm){advance(b,1.034);t.atkCd=1000;}return t;}
function cast(b,u,{finish=true}={}){const pts=b.allyUnits.filter(t=>t.ownerUnit===u&&t.defId===TOKEN&&t.alive);if(finish)for(const t of pts)b.addBuff(t,{key:'test:pause',flags:{disarm:true}});u.skill.setSpTotal(u.skill.spCost);assert.equal(b.activateOperator(ID),true);u.atkCd=1000;if(finish){advance(b,1.3);u.atkCd=1000;for(const t of pts){b.removeBuff(t,'test:pause');t.atkCd=1000;}} }
function enemy(b,{hp=100000,x=6,y=2,def=0,res=0,fly=false,stealth=false}={}){const e=b.spawnEnemy('enemy_1007_slime',{pos:[0,0]});e.x=x;e.y=y;e.base.maxHp=100000;e.base.def=def;e.base.res=res;e.base.moveSpeed=0;if(fly)e.motion='FLY';e.markDirty();void e.s;e.hp=hp;b.addBuff(e,{key:'pin',flags:{noMove:true,disarm:true,...(stealth?{stealth:true}:{})}});b._buildEnemyIndex();return e;}
const hit=(b,u,e,s=.7)=>{b.forceAttack(u,[e]);u.atkCd=1000;advance(b,s);};
function sleepEnemy(b,e,duration=20){b.applyStatus(e,'sleep',{duration});}

// These fixtures target source arithmetic, not the unrecovered C# dispatcher.
test('six verified original bundles, exact two skills/all20 ranks and actual owner/token byte bindings are retained',()=>{
 assert.equal(evidence.frameParity,false);assert.deepEqual(evidence.enabledOperators,[ID]);assert.equal(evidence.source.bundles.length,6);
 for(const r of evidence.source.bundles){assert.match(r.sha256,/^[a-f0-9]{64}$/);assert.match(r.md5,/^[a-f0-9]{32}$/);assert.ok(r.size>0);}
 for(const id of['skchr_blkngt_1','skchr_blkngt_2'])assert.equal(evidence.tables[ID].skillLevels[id].length,10);
 for(const f of['Front','Back']){assert.equal(evidence.models[ID][f].sha256,evidence.originalFacingBindings[ID][f].sha256);near(evidence.models[ID][f].hits.Attack[0],.267);near(evidence.models[ID][f].hits.Skill_1[0],.167);near(evidence.models[ID][f].hits.Skill_2[0],.533);}
 assert.equal(evidence.models[TOKEN].spineVersion,'3.8.99');assert.equal(evidence.models[TOKEN].files[TOKEN+'.skel'].sha256,'e79547cfc2c45b22c61fa817a9123bb567b21630dfbe003ddcefe47c8911cf3c');near(evidence.models[TOKEN].hits.Attack[0],.5);near(evidence.models[TOKEN].hits.Skill_2[0],.5);assert.equal(evidence.models[TOKEN].bounds,null);
});
test('literal native INPUT1/source3/radius1.1, four mode IDs and explicit rebirth1s are preserved alongside bounded assumptions',()=>{
 const rs=evidence.tokens[TOKEN],s2=row(rs,'-856545566027739364'),birth=row(rs,'-860548810646221028'),root=row(rs,'4969589579726524188');
 assert.equal(s2._selectTargetSource,3);assert.equal(s2._selectTargetTiming,1);assert.equal(s2._alwaysIncludeTarget,1);assert.equal(s2._allowNoTarget,1);near(row(rs,'1759367963185254172').m_Radius,evidence.runtimeTiming.areaRadius);
 assert.equal(root._modes.length,4);assert.equal(root._occupiedRemainingCharacterCnt,0);assert.equal(root._buildCondition.limitByHostAttackRange,1);assert.equal(birth._waitForAttackEvent,0);assert.equal(birth._preDelay,1);assert.equal(birth._animKey,'ReBorn');assert.ok(root._retainedBuffsWhenDead.includes(AREA));assert.ok(root._retainedBuffsWhenDead.includes(RAGE));
 assert.ok(evidence.verificationLimits.some(x=>x.includes('SelectTargetSource3')));assert.ok(evidence.verificationLimits.some(x=>x.includes('ignoreEs:false')));assert.ok(evidence.verificationLimits.some(x=>x.includes('Sequence')));
});
test('source point card stock1/DP0/slot0/ground-owner-range/facing-free exact limits do not borrow owner attributes',()=>{
 for(const elite of[0,1,2]){const {b,u,build}=make({elite,rank:[4,7,10][elite],trust:200,potential:6}),r=summonRecordFor(ID,build,data.tokens);assert.equal(card(b).stock,1);assert.equal(r.stats.maxDeployCount,1);assert.equal(r.stats.cost,0);assert.equal(r.stats.respawnTime,[20,17,15][elite]);assert.equal(REGULAR_SUMMONS[ID].chooseFacing,false);
 const slots=b.deployedSlots(),dp=b.dp,t=point(b);near(b.dp,dp);assert.equal(b.deployedSlots(),slots);assert.equal(t.ownerUnit,u);assert.equal(card(b).stock,0);assert.notEqual(t.base.atk,u.base.atk);assert.equal(t.s.flags.healFree,true);
 }
});
test('original point stats interpolate their own promotion/level without source trust or potential transfer',()=>{
 for(const elite of[0,1,2])for(const level of[1,data.operators[ID].phases[elite].maxLevel]){const {b,build}=make({elite,level,rank:[4,7,10][elite],trust:200,potential:6}),t=point(b),s=data.tokens[TOKEN].phases[elite],lo=s.attributesKeyFrames[0],hi=s.attributesKeyFrames.at(-1),f=(level-lo.level)/(hi.level-lo.level);for(const k of['atk','def','maxHp'])near(t.base[k],Math.round(lo.data[k]+(hi.data[k]-lo.data[k])*f));assert.equal(summonRecordFor(ID,build,data.tokens).skill,null);}
});
test('source card rejects high tiles/outside owner range and permits only its one persistent point',()=>{
 const {b}=make();assert.equal(summonPlacementError(b,summonCardId(ID),1,5),'Choose a melee tile.');assert.match(summonPlacementError(b,summonCardId(ID),3,8),/range/);const t=point(b);assert.equal(summonPlacementError(b,summonCardId(ID),2,6),'No summons remaining.');assert.equal(t.kind,'token');
});
test('missing/fabricated point source and unsupported promotion/level fail closed',()=>{
 const{build}=make(),tokens=structuredClone(data.tokens);delete tokens[TOKEN];assert.throws(()=>summonRecordFor(ID,build,tokens),/Missing reviewed/);assert.throws(()=>summonRecordFor(ID,{...build,elite:3},data.tokens),/promotion/);assert.throws(()=>summonRecordFor(ID,{...build,level:81},data.tokens),/promotion/);
});
test('one explicit Start/ReBorn second precedes full-HP active block1, without double deploy delay',()=>{
 const{b}=make(),t=point(b,2,5,{warm:false});assert.equal(t.mem.blacknightMode,'warming');assert.equal(t.s.blockCnt,0);assert.equal(t.s.flags.invulnerable,true);assert.equal(t.mem.regularFormVisual.clip,'Start');advance(b,.967);assert.equal(t.mem.blacknightMode,'warming');advance(b,.1);assert.equal(t.mem.blacknightMode,1);near(t.hp,t.s.maxHp);assert.equal(t.s.blockCnt,1);assert.equal(!!t.s.flags.invulnerable,false);assert.equal(t.mem.regularFormVisual.clip,'Idle_1');
});
test('accepted fatal hit rests same living point/release block/no stock refund, then20/17/15 seconds+1 rebirth',()=>{
 for(const elite of[0,1,2]){const{b}=make({elite,rank:[4,7,10][elite]}),t=point(b),e=enemy(b,{x:5,y:2});t.blocking=[e];e.blockedBy=t;t.hp=50;const before=b.time;b.dealDamage(e,t,{type:'true',amount:100,isAttack:true});assert.equal(t.alive,true);assert.equal(t.deployed,true);assert.equal(t.mem.blacknightMode,0);assert.equal(t.hp,1);assert.equal(t.blocking.length,0);assert.equal(e.blockedBy,null);assert.equal(t.s.blockCnt,0);assert.equal(card(b).stock,0);near(t.mem.blacknightReadyAt,before+[20,17,15][elite]+1);advance(b,[20,17,15][elite]+.067);assert.equal(t.mem.blacknightMode,'warming');advance(b,1.1);assert.equal(t.mem.blacknightMode,1);near(t.hp,t.s.maxHp);}
});
test('manual tactical retreat uses native rest, costs/refunds0 and does not consume another token identity',()=>{
 const{b}=make(),t=point(b),id=t.id,dp=b.dp;retreatRegularSummon(b,summonUnitId(t));assert.equal(t.alive,true);assert.equal(t.id,id);assert.equal(t.mem.blacknightMode,0);near(b.dp,dp);assert.equal(card(b).stock,0);advance(b,16.1);assert.equal(t.id,id);assert.equal(t.mem.blacknightMode,1);
});
test('inactive point is invulnerable/target-free/zero-block and repeated retreat never resets its source timer',()=>{
 const{b}=make(),t=point(b),e=enemy(b);retreatRegularSummon(b,summonUnitId(t));const ready=t.mem.blacknightReadyAt;advance(b,2);retreatRegularSummon(b,summonUnitId(t));near(t.mem.blacknightReadyAt,ready);assert.equal(canTargetAlly(e,t,true),false);b.dealDamage(e,t,{type:'true',amount:99999});assert.equal(t.hp,1);assert.equal(t.s.blockCnt,0);
});
test('genuine scripted removal and owner withdrawal remove the point rather than invoke fatal rebirth',()=>{
 for(const removal of['kill','owner']){const{b}=make(),t=point(b);if(removal==='kill')b.kill(t,null);else b.retreatOperator(ID);assert.equal(t.alive,false);advance(b,20);assert.equal(t.alive,false);assert.equal(card(b).stock,0);if(removal==='owner')assert.equal(card(b).available,false);}
});
test('normal point can hit Sleep, prioritizes sleeping ground and excludes invisible/free/hidden/air',()=>{
 const{b}=make(),t=point(b),a=enemy(b,{x:5.8}),z=enemy(b,{x:4.8}),f=enemy(b,{x:5.2,fly:true}),h=enemy(b,{x:5.3}),free=enemy(b,{x:5.4}),stealth=enemy(b,{x:6,stealth:true});sleepEnemy(b,z);h.hidden=true;b.addBuff(free,{key:'free',flags:{untargetable:true}});assert.equal(acquireTargets(b,t,effectiveProfile(t))[0],z);hit(b,t,z);near(100000-z.hp,t.s.atk);for(const e of[a,f,h,free,stealth])near(e.hp,100000);
});
test('normal point CAST0 reacquires entrants at .5 release and does not hit a departed initial trigger',()=>{
 const{b}=make(),t=point(b),old=enemy(b,{x:5.8}),fresh=enemy(b,{x:8});b.forceAttack(t,[old]);t.atkCd=1000;advance(b,.2);old.x=9;fresh.x=5.9;b._buildEnemyIndex();advance(b,.4);near(old.hp,100000);near(100000-fresh.hp,t.s.atk);
});
test('Blacknight normal source arrow release/.267+speed10 flight is Physical and CAST selects a new legal target',()=>{
 for(const dir of['RIGHT','LEFT']){const{b,u}=make({dir}),e=enemy(b,{x:dir==='LEFT'?3.2:4.8,y:1,def:100});hit(b,u,e,.2);near(e.hp,100000);advance(b,.267);near(100000-e.hp,Math.max(u.s.atk-100,u.s.atk*.05));}
});
test('native owner trait1.5 applies before DEF only when blocked by its own Slumberfoot, without generic attack filter',()=>{
 const{b,u,deploy}=make({others:[FANG]}),t=point(b),fang=deploy(FANG,3,3),e=enemy(b,{x:4.8,y:1,def:100});e.blockedBy=t;b.dealDamage(u,e,{type:'phys',amount:100,isAttack:false});near(100000-e.hp,50);e.hp=100000;e.blockedBy=fang;b.dealDamage(u,e,{type:'phys',amount:100,isAttack:false});near(100000-e.hp,5);e.hp=100000;e.blockedBy={ownerUnit:u,defId:'fake'};b.dealDamage(u,e,{type:'phys',amount:100});near(100000-e.hp,5);
});
test('S1 source event .167 grants11DP with no point; cast tail and selected10s hold SP independently',()=>{
 const{b,u}=make(),dp=b.dp;cast(b,u,{finish:false});advance(b,.133);near(b.dp,dp);advance(b,.1);near(b.dp-dp,11);assert.equal(u.s.flags.disarm,true);assert.equal(u.s.flags.noSp,true);advance(b,1);assert.equal(!!u.s.flags.disarm,false);assert.equal(u.skill.active,true);u.skill.gainSp(50);near(u.skill.spTotal,0);advance(b,9);assert.equal(u.skill.active,false);assert.ok(u.skill.spTotal>0);
});
test('every source S1 rank enables10s own-MaxHP regen and infinite source sleep wrapper without HP immunity',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u}=make({rank}),t=point(b);t.hp=1;cast(b,u);const v=bb(0,rank);near(t.s.hpRegen,t.s.maxHp*v.hp_recovery_per_sec_by_max_hp_ratio);assert.ok(t.findBuff(SLEEP));assert.equal(t.findBuff(SLEEP).timeLeft,Infinity);assert.equal(t.mem.blacknightMode,2);assert.equal(t.s.blockCnt,1);assert.equal(!!t.s.flags.sleep,false);assert.equal(!!t.s.flags.invulnerable,false);assert.ok(t.hp>1);near(u.s.hpRegen,0);}
});
test('S1 native sleep keeps blocking and is targetable; it suppresses attack without releasing its enemy',()=>{
 const{b,u}=make(),t=point(b),e=enemy(b,{x:5,y:2});t.blocking=[e];e.blockedBy=t;cast(b,u);assert.equal(e.blockedBy,t);assert.equal(t.s.blockCnt,1);assert.equal(canTargetAlly(e,t,false),true);t.atkCd=0;const attacks=t.stats.attacks;advance(b,1);assert.equal(t.stats.attacks,attacks);assert.equal(!!t.s.flags.sleep,false);
});
test('S1 regen expires after10s but native INFINITY mode sleep persists until incoming damage',()=>{
 const{b,u}=make(),t=point(b);t.hp=t.s.maxHp/2;cast(b,u);advance(b,10.1);assert.equal(t.findBuff(HEAL),null);assert.ok(t.findBuff(SLEEP));assert.equal(t.mem.blacknightMode,2);near(t.s.hpRegen,t.base.hpRecoveryPerSec);const e=enemy(b);b.dealDamage(e,t,{type:'true',amount:1});assert.equal(t.findBuff(SLEEP),null);assert.equal(t.mem.blacknightMode,1);assert.ok(t.findBuff(RAGE));
});
test('nonlethal incoming modifier wakes/ends regen and grants each selected source10s ATK/ASPD rage with foreign additive buffs',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u}=make({rank}),t=point(b),e=enemy(b);b.addBuff(t,{key:'foreign',mods:{atkPct:.2,aspd:30}});cast(b,u);const hp=t.hp;b.dealDamage(e,t,{type:'true',amount:1});near(t.hp,hp-1);const v=bb(0,rank);near(t.s.atk,t.base.atk*(1+.2+v['blkngt_hypnos_s_1[rage].atk']));near(t.s.aspd,t.base.aspd+30+t.base.aspd*v['blkngt_hypnos_s_1[rage].attack_speed']);assert.equal(t.findBuff(HEAL),null);assert.equal(t.mem.blacknightMode,1);advance(b,10.1);assert.equal(t.findBuff(RAGE),null);near(t.s.atk,t.base.atk*1.2);near(t.s.aspd,t.base.aspd+30);}
});
test('explicit bounded pre-shield wake accepts shielded positive0HP-loss output but misses/canceled/zero inputs do not wake',()=>{
 const{b,u}=make(),t=point(b),e=enemy(b);cast(b,u);b.addBuff(t,{key:'shield',shield:100});const hp=t.hp;b.dealDamage(e,t,{type:'true',amount:10});near(t.hp,hp);assert.equal(t.mem.blacknightMode,1);assert.ok(t.findBuff(RAGE));u.skill.end('test');cast(b,u);b.dealDamage(e,t,{type:'true',amount:0});assert.equal(t.mem.blacknightMode,2);const off=b.on('hit',ctx=>{if(ctx.target===t)ctx.dmg.cancel=true;});b.dealDamage(e,t,{type:'true',amount:10});b.off(off);assert.equal(t.mem.blacknightMode,2);b.addBuff(t,{key:'dodge',mods:{dodgePhys:1}});b.dealDamage(e,t,{type:'phys',amount:10000});assert.equal(t.mem.blacknightMode,2);assert.ok(t.findBuff(SLEEP));
});
test('element gauge/HP loss are separate paths and do not synthesize a damage-modifier wake',()=>{
 const{b,u}=make(),t=point(b),e=enemy(b);cast(b,u);b.dealDamage(e,t,{type:'element',element:'burn',amount:100});assert.equal(t.mem.blacknightMode,2);b.loseHp(t,1);assert.equal(t.mem.blacknightMode,2);assert.ok(t.findBuff(SLEEP));
});
test('lethal greater-than-currentHP modifier clears sleep without rage then rests, while nativeLE equality is explicit',()=>{
 const{b,u}=make(),t=point(b),e=enemy(b);cast(b,u);t.hp=50;b.dealDamage(e,t,{type:'true',amount:51});assert.equal(t.mem.blacknightMode,0);assert.equal(t.findBuff(RAGE),null);assert.equal(t.findBuff(SLEEP),null);advance(b,16.1);u.skill.end('test');cast(b,u);t.hp=50;b.dealDamage(e,t,{type:'true',amount:50});assert.equal(t.mem.blacknightMode,0);assert.ok(t.findBuff(RAGE));
});
test('S1 on an inactive point grantsDP but never forces rebirth/heal or resets its selected rest timer',()=>{
 const{b,u}=make(),t=point(b);retreatRegularSummon(b,summonUnitId(t));const ready=t.mem.blacknightReadyAt,dp=b.dp;cast(b,u);near(b.dp-dp,11);near(t.mem.blacknightReadyAt,ready);assert.equal(t.mem.blacknightMode,0);assert.equal(t.findBuff(SLEEP),null);assert.equal(t.findBuff(HEAL),null);near(t.hp,1);
});
test('normal and S2 literal attacks use source .5 event/cap1 and mode-change short control cancels unborn release',()=>{
 const{b}=make(),t=point(b),e=enemy(b,{x:5.8});b.forceAttack(t,[e]);t.atkCd=1000;advance(b,.2);b.applyStatus(t,'stun',{duration:.001});advance(b,.4);near(e.hp,100000);b.forceAttack(t,[e]);advance(b,.533);near(100000-e.hp,t.s.atk);
});
test('S2 event .533 grants4DP with no point and source charges1/2 recover only after full1.133 cast',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u}=make({skill:1,rank}),dp=b.dp;assert.equal(u.skill.maxCharges,rank>=7?2:1);cast(b,u,{finish:false});advance(b,.5);near(b.dp,dp);advance(b,.1);near(b.dp-dp,4);assert.equal(u.s.flags.noSp,true);near(u.skill.spTotal,0);advance(b,.467);near(u.skill.spTotal,0);advance(b,.2);assert.ok(u.skill.spTotal>0);}
});
test('S2 each source rank pulses ground Sleep4/5/6 seconds and mode3 coefficient1.2..2.1, never owner ATK buffs',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u}=make({skill:1,rank}),t=point(b),e=enemy(b,{x:5.8}),fly=enemy(b,{x:5.5,fly:true});cast(b,u);const v=bb(1,rank);assert.equal(t.mem.blacknightMode,3);assert.equal(e.s.flags.sleep,true);assert.equal(!!fly.s.flags.sleep,false);near(t.findBuff(AREA).data.atkScale,v['blkngt_s_2.atk_scale']);near(t.s.atk,t.base.atk);near(u.s.atk,u.base.atk);assert.ok(e.findBuff(`blkngt:sleep:${t.id}`).timeLeft<=v['blkngt_s_2.duration']);}
});
test('S2 one born Sleep pulse has no continuous entrants capture; purpose0 allows invisible but rejects hidden/free/air/immunity',()=>{
 const{b,u}=make({skill:1}),t=point(b),invisible=enemy(b,{x:5.6,stealth:true}),hidden=enemy(b,{x:5.7}),free=enemy(b,{x:5.8}),fly=enemy(b,{x:5.9,fly:true}),immune=enemy(b,{x:4.8}),late=enemy(b,{x:9});hidden.hidden=true;b.addBuff(free,{key:'free',flags:{untargetable:true}});immune.def={...immune.def,immune:new Set([...immune.def.immune,'sleep'])};cast(b,u);assert.equal(invisible.s.flags.sleep,true);for(const e of[hidden,free,fly,immune,late])assert.equal(!!e.s.flags.sleep,false);late.x=5.9;advance(b,.1);assert.equal(!!late.s.flags.sleep,false);
});
test('S2 token Arts applies selected coefficient only to Sleep recipients beforeRES, awake neighbors receive unscaledArts',()=>{
 const{b,u}=make({skill:1}),t=point(b),input=enemy(b,{x:5.8,res:20}),awake=enemy(b,{x:6.6,res:20});cast(b,u);assert.equal(input.s.flags.sleep,true);assert.equal(!!awake.s.flags.sleep,false);hit(b,t,input);near(100000-input.hp,t.s.atk*2.1*.8);near(100000-awake.hp,t.s.atk*.8);
});
test('S2 retained radius is input-centered, hits beyond tactical range near INPUT, excludes a victim near point outside radius',()=>{
 const{b,u}=make({skill:1}),t=point(b),input=enemy(b,{x:5.95,y:2}),nearInput=enemy(b,{x:6.9,y:2}),nearPoint=enemy(b,{x:4.6,y:2});cast(b,u);b.removeBuff(nearPoint,`blkngt:sleep:${t.id}`);sleepEnemy(b,input);const shot=acquireTargets(b,t,effectiveProfile(t))[0];assert.equal(shot,input);hit(b,t,input);assert.ok(nearInput.hp<100000);near(nearPoint.hp,100000);
});
test('S2 INPUT1 caches victim deployments at startup: leaving input/neighbors remain, new entrants/current input neighbors excluded',()=>{
 const{b,u}=make({skill:1}),t=point(b),input=enemy(b,{x:5.8}),held=enemy(b,{x:6.7}),late=enemy(b,{x:9}),newAtCurrent=enemy(b,{x:10});cast(b,u);b.forceAttack(t,[input]);t.atkCd=1000;advance(b,.2);input.x=9;held.x=10;late.x=6.6;newAtCurrent.x=9.5;b._buildEnemyIndex();advance(b,.4);assert.ok(input.hp<100000);assert.ok(held.hp<100000);near(late.hp,100000);near(newAtCurrent.hp,100000);
});
test('S2 startup selected victims dying/hiding/replacing/free/invisible/air before hit are excluded; alive neighbors retain output',()=>{
 for(const change of['dead','hidden','replace','free','stealth','fly']){const{b,u}=make({skill:1}),t=point(b),input=enemy(b,{x:5.8}),neighbor=enemy(b,{x:6.6});cast(b,u);b.forceAttack(t,[input]);t.atkCd=1000;advance(b,.2);if(change==='dead')b.kill(input,null);else if(change==='hidden')input.hidden=true;else if(change==='replace')input.deploySeq++;else if(change==='free')b.addBuff(input,{key:'free',flags:{untargetable:true}});else if(change==='stealth')b.addBuff(input,{key:'hide',flags:{stealth:true}});else input.motion='FLY';const hp=input.hp;advance(b,.4);near(input.hp,hp);assert.ok(neighbor.hp<100000);}
});
test('S2 asleep/awake coefficient is sampled at actual output, independently of retained input list',()=>{
 const{b,u}=make({skill:1}),t=point(b),input=enemy(b,{x:5.8}),awake=enemy(b,{x:6.6});cast(b,u);b.forceAttack(t,[input]);t.atkCd=1000;advance(b,.2);b.removeBuff(input,`blkngt:sleep:${t.id}`);sleepEnemy(b,awake);advance(b,.4);near(100000-input.hp,t.s.atk);near(100000-awake.hp,t.s.atk*2.1);
});
test('S2 mode expiry restores original physical clip; its pending former-mode attack cannot leak after expiry',()=>{
 const{b,u}=make({skill:1}),t=point(b),e=enemy(b,{x:5.8});cast(b,u);const left=t.findBuff(AREA).timeLeft;advance(b,left-.2);b.forceAttack(t,[e]);t.atkCd=1000;const prevent=b.on('beforeAttack',ctx=>{if(ctx.attacker===t)ctx.targets=[];});const hp=e.hp;advance(b,.4);b.off(prevent);assert.equal(t.mem.blacknightMode,1);assert.equal(t.mem.regularFormVisual.attack,'Attack');near(e.hp,hp);hit(b,t,e);near(hp-e.hp,t.s.atk);
});
test('S2 while resting pulses Sleep but preserves rebirth countdown; reborn checks retained still-active coefficient',()=>{
 const{b,u}=make({skill:1}),t=point(b),e=enemy(b,{x:5.8});retreatRegularSummon(b,summonUnitId(t));advance(b,12);const ready=t.mem.blacknightReadyAt;cast(b,u);assert.equal(t.mem.blacknightMode,0);assert.equal(e.s.flags.sleep,true);assert.ok(t.findBuff(AREA));near(t.mem.blacknightReadyAt,ready);advance(b,3);assert.equal(t.mem.blacknightMode,3);near(t.hp,t.s.maxHp);advance(b,3);assert.equal(t.mem.blacknightMode,1);
});
test('defeat preserves exact rage/S2 timers but clears regen/wrapper/control, and expired retained buffs never reappear',()=>{
 const{b,u}=make(),t=point(b),e=enemy(b);cast(b,u);b.dealDamage(e,t,{type:'true',amount:1});assert.ok(t.findBuff(RAGE));retreatRegularSummon(b,summonUnitId(t));assert.ok(t.findBuff(RAGE));assert.equal(t.findBuff(SLEEP),null);assert.equal(t.findBuff(HEAL),null);advance(b,16.1);assert.equal(t.findBuff(RAGE),null);assert.equal(t.mem.blacknightMode,1);near(t.s.atk,t.base.atk);
});
test('brief sub-dt control/withdrawal cancels unborn S1/S2 command without DP or source token mode, emitted effects survive later control',()=>{
 for(const skill of[0,1])for(const cancel of['stun','withdraw']){const{b,u}=make({skill}),t=point(b),dp=b.dp;cast(b,u,{finish:false});advance(b,.1);if(cancel==='stun')b.applyStatus(u,'stun',{duration:.001});else b.retreatOperator(ID);const expectedDp=dp+(cancel==='withdraw'?Math.floor(b.bench[ID].lastCost/2):0);advance(b,.7);near(b.dp,expectedDp);if(cancel==='stun'){assert.equal(t.mem.blacknightMode,1);assert.equal(u.mem.blacknightCast,null);}else assert.equal(t.alive,false);}
 for(const skill of[0,1]){const{b,u}=make({skill}),t=point(b);cast(b,u,{finish:false});advance(b,skill?.6:.233);assert.ok(t.findBuff(skill?AREA:HEAL),'The original command must be emitted before later control.');b.applyStatus(u,'stun',{duration:.001});advance(b,.2);assert.equal(t.mem.blacknightMode,skill?3:2);assert.ok(t.findBuff(skill?AREA:HEAL));}
});
test('owner withdrawal cleans same point and card; already-born enemy Sleep independently lasts until selected expiry',()=>{
 const{b,u,deploy}=make({skill:1}),t=point(b),e=enemy(b,{x:5.8});cast(b,u);const remaining=e.findBuff(`blkngt:sleep:${t.id}`).timeLeft;b.retreatOperator(ID);assert.equal(t.alive,false);assert.equal(e.s.flags.sleep,true);advance(b,remaining+.1);assert.equal(!!e.s.flags.sleep,false);b.time=100;const n=deploy();assert.notEqual(n,u);assert.equal(card(b).stock,1);assert.equal(card(b).deployed,0);
});

test('owner unmanaged emitted arrow survives withdrawal/control while impact rechecks hidden/free/Sleep/dead recipients',()=>{
 for(const change of['withdraw','control','hidden','free','sleep','dead']){const{b,u}=make(),e=enemy(b,{x:6,y:1});b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.333);assert.equal(b.projectiles.list.length,1);const hp=e.hp;if(change==='withdraw')b.retreatOperator(ID);else if(change==='control')b.applyStatus(u,'stun',{duration:1});else if(change==='hidden')e.hidden=true;else if(change==='free')b.addBuff(e,{key:'free',flags:{untargetable:true}});else if(change==='sleep')sleepEnemy(b,e);else b.kill(e,null);advance(b,.3);if(['withdraw','control'].includes(change))near(hp-e.hp,u.s.atk);else if(change!=='dead')near(e.hp,hp);}
});
test('owner arrow follows current legal target outside attack range after emission without adding INPUT phase restrictions',()=>{
 const{b,u}=make(),e=enemy(b,{x:6,y:1});b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.333);e.x=8;advance(b,.5);near(100000-e.hp,u.s.atk);assert.equal(b.projectiles.list.length,0);
});
test('owner arrow emission remains canceled by short pre-release control, while five-second source lifetime forces its original final trace hit',()=>{
 const{b,u}=make(),e=enemy(b,{x:6,y:1});b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.1);b.applyStatus(u,'stun',{duration:.001});advance(b,.5);near(e.hp,100000);assert.equal(b.projectiles.list.length,0);
 b.forceAttack(u,[e]);advance(b,.333);assert.equal(b.projectiles.list[0].maxAge,5);e.x=100;advance(b,5.1);near(100000-e.hp,u.s.atk);assert.equal(b.projectiles.list.length,0);
});

test('stored S2 second charge cannot replace an unfinished source command, then can cast while token mode already exists',()=>{
 const{b,u}=make({skill:1}),t=point(b);u.skill.setSpTotal(u.skill.spCost*2);assert.equal(b.activateOperator(ID),true);assert.equal(u.skill.charges,1);assert.equal(b.activateOperator(ID),false);assert.equal(u.skill.charges,1);advance(b,1.2);assert.equal(t.mem.blacknightMode,3);assert.equal(b.activateOperator(ID),true);assert.equal(u.skill.charges,0);advance(b,1.2);assert.equal(t.mem.blacknightMode,3);
});
