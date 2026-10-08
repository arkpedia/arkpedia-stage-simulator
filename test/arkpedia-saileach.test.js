// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-saileach-prefabs.json' with { type: 'json' };
import { SAILEACH_OPERATORS } from '../shared/arkpedia/saileach-operators.js';
import { COLS } from '../server/sim/constants.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { deployRegularSummon, regularSummonCards } from '../server/sim/content/arkpedia-summons.js';
import { summonCardId } from '../shared/arkpedia/summons.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { adjustSaileachCost, consumeSaileachCard } from '../server/sim/content/arkpedia-saileach.js';
const ID='char_479_sleach', MEL='char_208_melan', VULCAN='char_163_hpsts', HUNG='char_226_hmau', DEEP='char_110_deepcl';
const IDS=['skcom_assist_cost[3]','skchr_sleach_2','skchr_sleach_3'];
const near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps,`${a} != ${z}`);
const advance=(b,t)=>{for(let i=0;i<Math.ceil(t/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);};
const blackboard=(skill,rank)=>Object.fromEntries(evidence.tables[ID].skillLevels[IDS[skill]][rank-1].blackboard.map(x=>[x.key,x.value]));
function make({skill=0,rank=10,elite=2,potential=1,dir='RIGHT'}={}){
 const src=structuredClone(data),op=src.operators[ID];assert.ok(op,'Reviewed Saileach snapshot required');
 src.stage.geometry.waves[0].spawns=[];src.stage.battle.dp_per_second=0;
 src.stage.geometry.rows=13;src.stage.geometry.cols=13;src.stage.geometry.tileGrid=Array.from({length:13},()=>Array(13).fill(2));
 const build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,potential,skillId:op.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
 const b=new StandardBattle(src,{operators:[build,...[MEL,VULCAN,HUNG,DEEP].map(id=>defaultBuild(src.operators[id]))]});
 b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);
 b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 const u=b.deployOperator(ID,5,5,dir);assert.ok(u);u.atkCd=1000;u.skill.rule='NEVER';
 const hits=[],heals=[];b.on('damaged',c=>hits.push({...c,time:b.time}));b.on('heal',c=>heals.push({...c,time:b.time}));
 return{b,u,hits,heals};
}
function ally(b,id=MEL,r=6,c=5){b.addDp('arkpedia',99);const a=b.deployOperator(id,r,c,'RIGHT');assert.ok(a);a.atkCd=1000;a.skill.rule='NEVER';return a;}
function enemy(b,{x=6,y=5,hp=100000,def=0,res=0,fly=false}={}){
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[y,x]});Object.assign(e.base,{maxHp:100000,def,res,moveSpeed:0});if(fly)e.motion='FLY';e.markDirty();void e.s;e.hp=hp;
 b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function move(b,e,x,y){b._unblock(e);e.x=x;e.y=y;b._buildEnemyIndex();}
function cast(b,u){u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.activate('test'),true);u.atkCd=1000;}
function shot(b,u,e){b.forceAttack(u,[e]);u.atkCd=1000;}
const ownHits=(hits,u)=>hits.filter(h=>h.source===u&&h.dmg.tags.includes('saileach:flag-blast'));
const ownRegen=(heals,u,a)=>heals.filter(h=>h.source===u&&h.opts.regen&&(!a||h.target===a));
function cheapClock(b,dp=20){b.getPlayer('arkpedia').dp=dp;}

test('literal skills/all30 ranks/five originals/two actual facing chains and no fake token retained',()=>{
 assert.deepEqual(SAILEACH_OPERATORS[ID].skillIds,IDS);assert.equal(evidence.source.bundles.length,5);assert.equal(evidence.frameParity,false);assert.equal(evidence.moduleSupport,false);assert.equal(evidence.unityParticleSupport,false);
 assert.equal(evidence.tables[ID].skills[0].overridePrefabKey,'skchr_sleach_1');
 for(const f of['Front','Back']){assert.equal(evidence.models[ID][f].sha256,evidence.originalFacingBindings[ID][f].sha256);near(evidence.models[ID][f].hits.Attack[0],.367);for(const n of[1,2,3])assert.ok(evidence.models[ID][f].durations[`Skill_${n}_Begin`]>0);}
 assert.equal(evidence.models[ID].Back.durations.Die_Skill,undefined);assert.ok(evidence.verificationLimits.some(x=>x.includes('Parallel')));assert.ok(evidence.verificationLimits.some(x=>x.includes('UNTIL'))||evidence.runtimeMapping.card.includes('UNTIL'));
});
test('every selected rank binds exact skill SP/init/blackboards/durations without a guessed default kit',()=>{
 for(let skill=0;skill<3;skill++)for(let rank=1;rank<=10;rank++){const{u}=make({skill,rank}),r=evidence.tables[ID].skillLevels[IDS[skill]][rank-1];near(u.skill.spCost,r.spData.spCost);near(u.skill.spTotal,r.spData.initSp);assert.deepEqual(u.skill.bb,blackboard(skill,rank));near(u.skill.duration,r.duration);}
});
test('natural ordinary attack emits one ground PHYSICAL NORMAL MELEE at .367 event',()=>{
 const{b,u,hits}=make(),e=enemy(b),z=enemy(b,{x:6.1}),air=enemy(b,{x:5.9,fly:true});u.atkCd=0;b.step();u.atkCd=1000;advance(b,.3);near(e.hp+z.hp,200000);advance(b,.1);const out=hits.filter(h=>h.source===u);assert.equal(out.length,1);assert.equal(out[0].dmg.isAttack,true);assert.equal(out[0].dmg.applyWay,'melee');assert.equal(out[0].type,'phys');near(air.hp,100000);
});
test('ordinary CAST0 reacquires new entrant and rejects departure/hidden/target-free with no old stale damage',()=>{
 for(const state of['leave','hidden','free']){const{b,u,hits}=make(),e=enemy(b),z=enemy(b,{x:9});shot(b,u,e);advance(b,.15);if(state==='leave')move(b,e,9,8);if(state==='hidden')e.hidden=true;if(state==='free')b.addBuff(e,{key:'free',flags:{untargetable:true}});move(b,z,6,5);advance(b,.3);near(e.hp,100000);assert.equal(hits.filter(h=>h.source===u)[0].target,z);}
});
test('ordinary unborn attack remembers brief accepted control and mode switch before source release',()=>{
 for(const state of['stun','freeze','sleep','levitate','skill']){const{b,u,hits}=make(),e=enemy(b);shot(b,u,e);advance(b,.1);if(state==='skill')cast(b,u);else b.applyStatus(u,state,{duration:.001});advance(b,.4);assert.equal(hits.filter(h=>h.source===u).length,0);near(e.hp,100000);}
});
test('unlimited native animation rate preserves all facings and combined BAT/ASPD at ordinary event',()=>{
 for(const dir of['UP','LEFT','DOWN','RIGHT'])for(const speed of[.5,3]){const{b,u}=make({dir}),e=enemy(b,{x:5});b.addBuff(u,{key:'rate',mods:speed===3?{aspd:300-u.s.aspd}:{aspd:100-u.s.aspd,batPct:1}});shot(b,u,e);const ev=b._evq.findLast(x=>x[0]==='atk'&&x[1]===u.id);near(ev[4].windup,.367/speed);assert.equal(ev[4].animation,'Attack');}
});
test('banner talent unlocks exact E1/E2/potential flat ASPD without modifying source ATK/DEF',()=>{
 for(const[elite,potential,value]of[[0,1,0],[1,1,5],[1,5,7],[2,1,10],[2,5,12]]){const{b,u}=make({elite,potential}),a=ally(b),e=enemy(b),far=enemy(b,{x:8});advance(b,.05);near(a.s.aspd,a.base.aspd+value);near(e.s.aspd,e.base.aspd-value);near(far.s.aspd,far.base.aspd);near(u.s.atk,u.base.atk);near(u.s.def,u.base.def);}
});
test('ally talent purposeNONE includes unhealable/full-HP/isolated/target-free recipients but not devices or token professions',()=>{
 const{b,u}=make(),a=ally(b,VULCAN);b.addBuff(a,{key:'free',flags:{noHeal:true,healFree:true,isolated:true,untargetable:true}});advance(b,.05);near(a.s.aspd,a.base.aspd+10);
 a.kind='token';advance(b,.05);near(a.s.aspd,a.base.aspd);a.kind='op';a.hidden=true;advance(b,.05);near(a.s.aspd,a.base.aspd);
});
test('enemy talent purposeNONE includes air/Sleep/stealth/camouflage but rejects free/hidden/far',()=>{
 const{b,u}=make(),ground=enemy(b),air=enemy(b,{x:5.9,fly:true}),sleep=enemy(b,{x:6.1}),stealth=enemy(b,{x:6.2}),camou=enemy(b,{x:6.3});b.applyStatus(sleep,'sleep',{duration:10});b.addBuff(stealth,{key:'invisible',flags:{stealth:true}});b.addBuff(camou,{key:'camou',flags:{camou:true}});advance(b,.1);for(const e of[ground,air,sleep,stealth,camou])near(e.s.aspd,e.base.aspd-10);
 b.addBuff(ground,{key:'free',flags:{untargetable:true}});air.hidden=true;move(b,camou,9,9);advance(b,.05);for(const e of[ground,air,camou])near(e.s.aspd,e.base.aspd);assert.equal(!!stealth.s.flags.reveal,false);
});
test('owned flat ASPD preserves foreign additions and cleans up promptly on source withdrawal',()=>{
 const{b,u}=make(),a=ally(b),e=enemy(b);b.addBuff(a,{key:'foreign',mods:{aspd:31}});b.addBuff(e,{key:'foreign',mods:{aspd:11}});advance(b,.1);near(a.s.aspd,a.base.aspd+41);near(e.s.aspd,e.base.aspd+1);b.retreat(u,{permanent:true});near(a.s.aspd,a.base.aspd+31);near(e.s.aspd,e.base.aspd+11);
});
test('all selected modes set block-count final0 and no attack, release old blockers, hold SP, restore at end',()=>{
 for(const skill of[0,1,2]){const{b,u,hits}=make({skill}),e=enemy(b,{x:5});b.addBuff(u,{key:'foreign-block',mods:{blockCnt:3}});e.blockedBy=u;u.blocking.push(e);cast(b,u);near(u.s.blockCnt,0);assert.equal(e.blockedBy,null);assert.ok(u.s.flags.disarm);near(u.skill.gainSp(100,'test'),0);u.atkCd=0;advance(b,.5);assert.equal(hits.filter(h=>h.source===u).length,0);u.skill.end('test');near(u.s.blockCnt,u.base.blockCnt+3);assert.equal(!!u.s.flags.disarm,false);assert.ok(u.skill.gainSp(1,'test')>0);}
});
test('S1 all10 ranks grants exactly18 DP via selected .44 pulses and full8-second mode',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u}=make({rank});cheapClock(b);cast(b,u);near(b.dp,20);advance(b,.4);near(b.dp,20);advance(b,.1);near(b.dp,21);advance(b,7.5);near(b.dp,38);assert.equal(u.skill.active,false);advance(b,.2);near(b.dp,38);}
});
test('S1 born periodic mode survives later action control but true owner removal stops future DP',()=>{
 const{b,u}=make();cheapClock(b);cast(b,u);b.applyStatus(u,'stun',{duration:1});advance(b,1.1);near(b.dp,22);assert.ok(u.skill.active);b.retreat(u,{permanent:true});const dp=b.dp;advance(b,8);near(b.dp,dp);assert.equal(u.skill.active,false);
});
test('S2 initial selector uses lowest HP ratio, includes self/full HP and ignores target-free',()=>{
 const{b,u}=make({skill:1}),a=ally(b,MEL,7,5),z=ally(b,HUNG,5,7);u.hp=u.s.maxHp*.4;a.hp=a.s.maxHp*.2;z.hp=z.s.maxHp*.1;b.addBuff(z,{key:'free',flags:{untargetable:true}});cast(b,u);assert.deepEqual(u.mem.saileachFlag,{tileR:5,tileC:7});assert.ok(z.findBuff(`saileach:s2:${u.id}`));assert.equal(a.findBuff(`saileach:s2:${u.id}`),null);
 const f=make({skill:1});cast(f.b,f.u);assert.deepEqual(f.u.mem.saileachFlag,{tileR:5,tileC:5});
});
test('S2 initial selection excludes isolated/hidden/out-of-range lower HP recipients',()=>{
 const{b,u}=make({skill:1}),a=ally(b,MEL,7,5),z=ally(b,HUNG,5,7),far=ally(b,VULCAN,9,5);a.hp=z.hp=far.hp=1;b.addBuff(a,{key:'isolation',flags:{isolated:true}});z.hidden=true;cast(b,u);assert.deepEqual(u.mem.saileachFlag,{tileR:5,tileC:5});
});
test('S2 all10 ranks applies exact DEF% and immediate first/current-ATK regeneration with one-second cadence',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u,heals}=make({skill:1,rank}),a=ally(b);a.base.maxHp=100000;a.markDirty();void a.s;a.hp=1;const atk=u.s.atk,bb=blackboard(1,rank);cast(b,u);near(a.s.def,a.base.def*(1+bb.def));assert.equal(ownRegen(heals,u,a).length,1);near(a.hp-1,atk*bb.atk_to_hp_recovery_ratio);advance(b,.8);assert.equal(ownRegen(heals,u,a).length,1);b.addBuff(u,{key:'atk',mods:{atkPct:1}});advance(b,.25);assert.equal(ownRegen(heals,u,a).length,2);near(ownRegen(heals,u,a)[1].amount,atk*2*bb.atk_to_hp_recovery_ratio);}
});
test('S2 collision deliberately admits isolation and healing restrictions, final regen scaler0 remains effective',()=>{
 const{b,u,heals}=make({skill:1}),a=ally(b,VULCAN);a.hp=1;b.addBuff(a,{key:'free',flags:{untargetable:true,noHeal:true,healFree:true}});cast(b,u);assert.ok(a.hp>1);b.addBuff(a,{key:'isolated',flags:{isolated:true}});a.hp=1;advance(b,1.1);assert.ok(a.hp>1);assert.ok(a.findBuff(`saileach:s2:${u.id}`));b.addBuff(a,{key:'zero',mods:{hpRegenMul:0}});a.hp=1;advance(b,1.05);near(a.hp,1);assert.ok(ownRegen(heals,u,a).length>=2);
});
test('S2 fixed tile flag does not follow receiver: old occupancy leaves and next operator receives fresh pulse',()=>{
 const{b,u,heals}=make({skill:1}),a=ally(b);a.hp=1;cast(b,u);b.retreat(a,{permanent:true});const z=ally(b,HUNG,6,5);z.hp=1;advance(b,.05);assert.deepEqual(u.mem.saileachFlag,{tileR:6,tileC:5});assert.ok(z.findBuff(`saileach:s2:${u.id}`));assert.ok(z.hp>1);assert.equal(a.findBuff(`saileach:s2:${u.id}`),null);assert.ok(ownRegen(heals,u,z).length);
});
test('S2 tile leave/reentry removes source DEF/regen and restarts immediate first pulse without moving flag',()=>{
 const{b,u,heals}=make({skill:1}),a=ally(b);a.hp=1;cast(b,u);const k=`saileach:s2:${u.id}`,before=ownRegen(heals,u,a).length;a.x=9;a.y=9;advance(b,.05);assert.equal(a.findBuff(k),null);near(a.s.def,a.base.def);a.x=5;a.y=6;a.hp=1;advance(b,.05);assert.ok(a.findBuff(k));assert.equal(ownRegen(heals,u,a).length,before+1);
});
test('S2 moves ally/enemy talent around fixed banner and returns owner center at mode end',()=>{
 const{b,u}=make({skill:1}),a=ally(b,MEL,5,7),e=enemy(b,{x:8,y:5}),old=enemy(b,{x:4,y:5});a.hp=1;advance(b,.05);near(e.s.aspd,e.base.aspd);near(old.s.aspd,old.base.aspd-10);cast(b,u);near(e.s.aspd,e.base.aspd-10);near(old.s.aspd,old.base.aspd);u.skill.end('test');near(e.s.aspd,e.base.aspd);near(old.s.aspd,old.base.aspd-10);
});
test('S2 all ranks gives20 DP at .75 intervals including selected fifteen-second final pulse',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u}=make({skill:1,rank});cheapClock(b);cast(b,u);advance(b,.7);near(b.dp,20);advance(b,.1);near(b.dp,21);advance(b,14.2);near(b.dp,40);assert.equal(u.skill.active,false);advance(b,.2);near(b.dp,40);}
});
test('S2 actual field source invalid/disappearance stops and does not recreate on later reveal',()=>{
 for(const state of['retire','hidden']){const{b,u}=make({skill:1}),a=ally(b);a.hp=1;cast(b,u);if(state==='retire')b.retreat(u,{permanent:true});else u.hidden=true;advance(b,.05);assert.equal(a.findBuff(`saileach:s2:${u.id}`),null);near(a.s.def,a.base.def);if(state==='hidden'){u.hidden=false;advance(b,.05);assert.equal(a.findBuff(`saileach:s2:${u.id}`),null);}}
});
test('S3 cannot spend command without eligible occupied LOW ground tile and accepts exact range/height policy',()=>{
 for(const state of['empty','air','high','far','hidden','free']){const{b,u}=make({skill:2});if(state!=='empty'){const e=enemy(b,{x:state==='far'?9:6,fly:state==='air'});if(state==='high')b.grid.tiles[e.tileR*COLS+e.tileC].height='HIGH';if(state==='hidden')e.hidden=true;if(state==='free')b.addBuff(e,{key:'free',flags:{untargetable:true}});}u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.activate('test'),false);assert.ok(u.skill.ready);assert.equal(u.mem.saileachFlag,null);}
});
test('S3 one shared seeded banner center includes selected victim and all three native children',()=>{
 const{b,u}=make({skill:2}),e=enemy(b,{x:6}),z=enemy(b,{x:7});b.rng.pick=xs=>xs.at(-1);cheapClock(b);cast(b,u);assert.deepEqual(u.mem.saileachFlag,{tileR:5,tileC:7});near(b.dp,30);assert.ok(z.findBuff(`saileach:s3-sluggish:${u.id}`));assert.ok(e.findBuff(`saileach:s3-fragile:${u.id}`));near(z.s.aspd,z.base.aspd-10);
});
test('S3 huge-body overlap cannot choose rounded center outside literal tile range',()=>{
 const{b,u}=make({skill:2}),e=enemy(b,{x:9});e.hitArea={minX:-4,maxX:4,minY:-1,maxY:1};b._buildEnemyIndex();u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.activate('test'),false);
});
test('S3 all10 ranks has selected instantDP10, Slow80%, exact Fragile and one mitigated delayed physical blast',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u,hits}=make({skill:2,rank}),e=enemy(b,{def:100}),bb=blackboard(2,rank);cheapClock(b);e.base.moveSpeed=2;e.markDirty();void e.s;cast(b,u);near(b.dp,30);near(e.s.moveSpeed,e.base.moveSpeed*.2);near(e.s.dmgTakenMul,1+bb['debuff.damage_scale']);advance(b,.9);near(e.hp,100000);advance(b,.15);const out=ownHits(hits,u);assert.equal(out.length,1);near(100000-e.hp,(u.s.atk*bb.atk_scale-100)*(1+bb['debuff.damage_scale']));assert.equal(out[0].dmg.isAttack,true);assert.equal(out[0].dmg.isSkill,true);assert.equal(out[0].dmg.applyWay,'melee');assert.equal(out[0].dmg.noSp,false);assert.ok(e.s.flags.stun);}
});
test('S3 current blast victims can depart/hide/become free while new entrants receive release damage',()=>{
 for(const state of['leave','hidden','free','dead']){const{b,u,hits}=make({skill:2}),e=enemy(b),z=enemy(b,{x:9});cast(b,u);advance(b,.4);if(state==='leave')move(b,e,9,9);if(state==='hidden')e.hidden=true;if(state==='free')b.addBuff(e,{key:'free',flags:{untargetable:true}});if(state==='dead')b.kill(e);move(b,z,6,5);advance(b,.7);assert.equal(ownHits(hits,u).length,1);assert.equal(ownHits(hits,u)[0].target,z);}
});
test('S3 ALL-motion field/blast reaches air, collision Sleep receives stun but shared damage excludes Sleep',()=>{
 const{b,u,hits}=make({skill:2}),e=enemy(b),air=enemy(b,{x:6.1,fly:true}),sleep=enemy(b,{x:6.2}),stealth=enemy(b,{x:6.3}),camou=enemy(b,{x:6.4});b.applyStatus(sleep,'sleep',{duration:20});b.addBuff(stealth,{key:'invisible',flags:{stealth:true}});b.addBuff(camou,{key:'camou',flags:{camou:true}});cast(b,u);for(const a of[e,air,sleep,stealth,camou])assert.ok(a.findBuff(`saileach:s3-sluggish:${u.id}`));advance(b,1.1);assert.equal(ownHits(hits,u).length,4);assert.ok(sleep.s.flags.stun);near(sleep.hp,100000);assert.ok(air.hp<100000);assert.ok(stealth.hp<100000);assert.ok(camou.hp<100000);assert.equal(!!stealth.s.flags.reveal,false);
});
test('S3 born unmanaged blast survives source control/withdrawal and uses current ATK but field detaches',()=>{
 for(const state of['control','retire']){const{b,u,hits}=make({skill:2}),e=enemy(b);cast(b,u);advance(b,.3);if(state==='control')b.applyStatus(u,'stun',{duration:2});else b.retreat(u,{permanent:true});b.addBuff(u,{key:'current-atk',mods:{atkPct:1},allowDead:true});advance(b,.8);assert.equal(ownHits(hits,u).length,1);near(100000-e.hp,u.s.atk*3*(state==='retire'?1:1.3));if(state==='retire')assert.equal(e.findBuff(`saileach:s3-fragile:${u.id}`),null);}
});
test('S3 stun/damage cancellation/immunity/shields keep independent source output semantics',()=>{
 for(const state of['immune','shield','dodge','cancel']){const{b,u,hits}=make({skill:2}),e=enemy(b);if(state==='immune')e.def={...e.def,immune:new Set([...e.def.immune,'stun'])};if(state==='shield')b.addBuff(e,{key:'shield',shield:100000});if(state==='dodge')b.addBuff(e,{key:'dodge',mods:{dodgePhys:1}});if(state==='cancel')b.on('hit',c=>{if(c.source===u)c.dmg.cancel=true;});cast(b,u);advance(b,1.1);assert.equal(!!e.s.flags.stun,state!=='immune');assert.equal(ownHits(hits,u).length,['dodge','cancel'].includes(state)?0:1);if(state!=='immune')near(e.hp,100000);}
});
test('S3 named Fragile strongest source resumes foreign weaker after source field leaves',()=>{
 const{b,u}=make({skill:2}),e=enemy(b);b.applyStatus(e,'fragile',{key:'foreign',value:.2,duration:20});cast(b,u);near(e.s.dmgTakenMul,1.3);u.skill.end('test');near(e.s.dmgTakenMul,1.2);assert.ok(e.findBuff('foreign'));assert.equal(e.findBuff(`saileach:s3-sluggish:${u.id}`),null);
});
test('S3 field lasts selected10 seconds, removal returns talent center and no late periodicDP',()=>{
 const{b,u}=make({skill:2}),e=enemy(b,{x:7});cheapClock(b);cast(b,u);advance(b,9.9);assert.ok(u.skill.active);assert.ok(e.findBuff(`saileach:s3-fragile:${u.id}`));advance(b,.15);assert.equal(u.skill.active,false);assert.equal(e.findBuff(`saileach:s3-fragile:${u.id}`),null);near(e.s.aspd,e.base.aspd);near(b.dp,30);
});
test('source literal Begin/Loop/End presentation uses all native facings without additional combat lock',()=>{
 for(const skill of[0,1,2])for(const dir of['LEFT','RIGHT']){const{b,u}=make({skill,dir});if(skill===2)enemy(b,{x:dir==='LEFT'?4:6});cast(b,u);assert.equal(u.mem.regularFormVisual.clip,`Skill_${skill+1}_Begin`);advance(b,1);assert.equal(u.mem.regularFormVisual.clip,`Skill_${skill+1}_Loop`);u.skill.end('test');assert.equal(u.mem.regularFormVisual.clip,`Skill_${skill+1}_End`);assert.equal(!!u.s.flags.disarm,false);assert.ok(u.skill.gainSp(1,'test')>0);advance(b,.6);assert.equal(u.mem.regularFormVisual,null);}
});
test('E2 card gift appears after own birth, skips same own new filter, and never applies at E0/E1',()=>{
 for(const elite of[0,1,2]){const{b,u}=make({elite});near(b.cost(MEL),b.data.getChess(MEL).stats.cost-(elite===2?2:0));near(adjustSaileachCost(b,ID,7),7);assert.equal(b._arkpediaSaileachCards?.has(u.id)??false,elite===2);}
});
test('card discount consumes only next actual successful ordinary deployment, then costs revert',()=>{
 const{b,u}=make();const base=b.data.getChess(MEL).stats.cost;near(b.cost(MEL),base-2);const before=b.dp,a=b.deployOperator(MEL,6,5,'RIGHT');assert.ok(a);near(before-b.dp,base-2);assert.equal(b._arkpediaSaileachCards.has(u.id),false);near(b.cost(HUNG),b.data.getChess(HUNG).stats.cost);
});
test('failed placement/insufficientDP/occupied tile cannot consume a ready source card filter',()=>{
 const{b,u}=make();assert.throws(()=>b.deployOperator(MEL,5,5,'RIGHT'));assert.ok(b._arkpediaSaileachCards.has(u.id));cheapClock(b,0);assert.throws(()=>b.deployOperator(MEL,6,5,'RIGHT'));assert.ok(b._arkpediaSaileachCards.has(u.id));near(b.cost(MEL),b.data.getChess(MEL).stats.cost-2);
});
test('gift applies fixed minus2 after existing 1.5 and2 redeploy cost and clamps freecost0',()=>{
 const{b}=make();const base=b.data.getChess(MEL).stats.cost;b.bench[MEL].deployments=1;near(b.cost(MEL),Math.max(0,Math.floor(base*1.5)-2));b.bench[MEL].deployments=2;near(b.cost(MEL),Math.max(0,base*2-2));near(adjustSaileachCost(b,MEL,1),0);assert.equal(adjustSaileachCost(b,MEL,Infinity),Infinity);
});
test('owner withdrawal clears unused gift and own redeployment creates a fresh gift without consuming itself',()=>{
 const{b,u}=make();b.retreatOperator(ID);near(b.cost(MEL),b.data.getChess(MEL).stats.cost);assert.equal(b._arkpediaSaileachCards.has(u.id),false);b.bench[ID].readyAt=0;b.addDp('arkpedia',99);const a=b.deployOperator(ID,5,5,'RIGHT');assert.ok(a);assert.notEqual(a,u);assert.ok(b._arkpediaSaileachCards.has(a.id));near(b.cost(MEL),b.data.getChess(MEL).stats.cost-2);
});
test('combat summon creation and non-operator consume calls do not spend a remaining Saileach gift',()=>{
 const{b,u}=make(),a=ally(b,DEEP,8,8); // This successful operator spends the first gift.
 b._arkpediaSaileachCards.set(u.id,{owner:u,value:-2});
 const stock=regularSummonCards(b).find(c=>c.ownerId===DEEP||c.owner?.defId===DEEP)?.stock ?? 4;b.addDp('arkpedia',99);const token=deployRegularSummon(b,summonCardId(DEEP),8,9,'RIGHT');assert.ok(token);assert.equal(regularSummonCards(b).find(c=>c.key===summonCardId(DEEP))?.stock,stock-1);assert.ok(b._arkpediaSaileachCards.has(u.id));consumeSaileachCard({data:{getChess:()=>({profession:'TOKEN'})},_arkpediaSaileachCards:b._arkpediaSaileachCards},token.defId);assert.ok(b._arkpediaSaileachCards.has(u.id));
});

test('stopped S2/S3 flag cannot restore absent Default/S1 owner-talent aura before selected mode ends',()=>{
 for(const skill of[1,2]){const{b,u}=make({skill}),a=ally(b,MEL,6,5),e=enemy(b);a.hp=1;cast(b,u);near(a.s.aspd,a.base.aspd+10);u.hidden=true;advance(b,.05);near(a.s.aspd,a.base.aspd);near(e.s.aspd,e.base.aspd);u.hidden=false;advance(b,.1);near(a.s.aspd,a.base.aspd);near(e.s.aspd,e.base.aspd);u.skill.end('test');near(a.s.aspd,a.base.aspd+10);near(e.s.aspd,e.base.aspd-10);}
});
