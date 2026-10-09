// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test'; import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type:'json' };
import evidence from '../data/arkpedia-catherine-prefabs.json' with { type:'json' };
import { CATHERINE_OPERATORS as configs } from '../shared/arkpedia/catherine-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, acquireTargets } from '../server/sim/ai.js';
import { REGULAR_SUMMONS, summonCardId, summonUnitId, summonRecordFor } from '../shared/arkpedia/summons.js';
import { regularSummonCards, deployRegularSummon, retreatRegularSummon, summonPlacementError } from '../server/sim/content/arkpedia-summons.js';
const ID='char_4162_cathy',TOKEN='token_10041_cathy_catsld',CASTER='char_141_nights',SUPPORT='char_258_podego',GUARD='char_208_melan';
const near=(a,z,e=1e-5)=>assert.ok(Math.abs(a-z)<e,`${a} != ${z}`),rows=rs=>rs.flatMap(g=>g.components.map(c=>({pathId:c.pathId,...c.data})));
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function make({skill=0,rank=10,elite=2,potential=1,dir='RIGHT',trust=0,defer=false,extra=[]}={}){
 const d=structuredClone(data),o=d.operators[ID];assert.ok(o,'Reviewed Catherine snapshot required');
 d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;d.stage.geometry.rows=19;d.stage.geometry.cols=21;d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
 const build={...defaultBuild(o),elite,level:o.phases[elite].maxLevel,potential,trust,skillId:o.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
 const b=new StandardBattle(d,{operators:[build,...[...new Set([CASTER,SUPPORT,GUARD,...extra])].map(id=>defaultBuild(d.operators[id]))]});
 b.autoFinish=false;b.setViewport('fullscreen-workspace');b.recordEvents=true;b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));b.addDp('arkpedia',99);
 const deploy=(id=ID,r=5,c=5,f=dir)=>{b.addDp('arkpedia',99);const a=b.deployOperator(id,r,c,f);assert.ok(a);a.atkCd=1000;if(a.skill)a.skill.rule='NEVER';return a;};
 const receipts=[];b.on('damaged',x=>receipts.push({...x,time:b.time}));return{b,u:defer?null:deploy(),build,deploy,receipts};
}
const card=b=>regularSummonCards(b).find(s=>s.ownerId===ID),state=b=>b.regularSummons.get(summonCardId(ID));
function device(b,r=5,c=7,dir='RIGHT'){b.addDp('arkpedia',99);const t=deployRegularSummon(b,summonCardId(ID),r,c,dir);assert.ok(t);return t;}
function readyNext(b){const n=card(b).readyAt-b.time;if(n>0)advance(b,n+2*b.dt);}
function enemy(b,{x=6,y=5,hp=100000,def=0,fly=false}={}){const e=b.spawnEnemy('enemy_1007_slime',{pos:[y,x]});Object.assign(e.base,{maxHp:100000,def,res:0,moveSpeed:0});if(fly)e.motion='FLY';e.markDirty();void e.s;e.hp=hp;b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;}
function move(b,e,x,y=5){e.x=x;e.y=y;e.tileR=Math.round(y);e.tileC=Math.round(x);b._enemiesDirty=true;b._buildEnemyIndex();}
function cast(b,u){u.skill.setSpTotal(u.skill.spCost);if(u.skill.manual)assert.equal(b.activateOperator(ID),true);else assert.equal(u.skill.activate('test'),true);u.atkCd=1000;}
function shot(b,u,e){assert.equal(b.forceAttack(u,[e]),true);u.atkCd=1000;}
const own=(rs,u,e)=>rs.filter(r=>r.source===u&&r.type==='phys'&&(!e||r.target===e));
const tbb=u=>u.def.talents[0].bb,bb=(s,r=10)=>Object.fromEntries(data.operators[ID].skills[s].levels[r-1].blackboard.map(x=>[x.key,x.value]));

const key=u=>`cathy:core:${u.id}`,attr=u=>`cathy:s1:${u.id}`;
const pool=(u,a)=>a.findBuff(key(u))?.shield ?? 0;
function drain(b,u,a,amount=10000){const e=enemy(b);b.dealDamage(e,a,{type:'true',amount});return e;}
test('six original bundles/all22 owner and empty token skill levels, native no-hit device facings',()=>{
 assert.equal(evidence.source.bundles.length,6);assert.equal(evidence.frameParity,false);
 assert.equal(Object.values(evidence.tables.skills).flatMap(s=>s.levels).length,22);
 assert.deepEqual(Object.keys(configs),[ID]);assert.equal(Object.keys(evidence.templates).length,11);
 for(const f of['Front','Back']){assert.equal(evidence.models[ID][f].sha256,evidence.officialSkeletonBindings[ID][f].sha256);near(evidence.models[ID][f].hits.Attack[0],.5);near(evidence.models[ID][f].hits.Skill_1[0],.5);assert.equal(evidence.models[ID][f].hits.Skill_2_Loop,undefined);near(evidence.models[TOKEN][f].durations.Start,.667);assert.deepEqual(evidence.models[TOKEN][f].hits,{});}
 for(const r of Object.values(evidence.tokenArtwork.models[TOKEN].facings)){assert.equal(r.originalPathIds.alphaTexture,'0');assert.equal(r.materialFloats._UseAlphaTex,0);assert.equal(r.materialFloats._StraightAlphaInput,0);assert.equal(r.animationRoles.attack,null);}
 assert.equal(evidence.templates['cathy_s_2[recycle]'],undefined);
 for(const s of data.tokens[TOKEN].skills){assert.equal(s.levels.length,1);assert.equal(s.levels[0].skillType,'PASSIVE');assert.deepEqual(s.levels[0].blackboard,[]);}
});
test('all20 ranks retain exact passiveATK/DEF and manualHP/DEF/duration/SP/disarm',()=>{
 for(let skill=0;skill<2;skill++)for(let rank=1;rank<=10;rank++){
  const{b,u}=make({skill,rank});const x=bb(skill,rank);
  assert.equal(u.profile.maxTargets,1);assert.equal(u.profile.splashRadius,0);assert.equal(u.profile.canHitFly,false);
  if(!skill){near(u.s.atk,u.base.atk*(1+x.s1_atk));near(u.s.def,u.base.def*(1+x.s1_def));assert.equal(u.skill.kind,'passive');assert.equal(u.skill.ready,false);}
  else{near(u.s.atk,u.base.atk);const hp=u.hp/max(u);cast(b,u);near(u.s.maxHp,u.base.maxHp*(1+x.max_hp));near(u.s.def,u.base.def*(1+x.def));near(u.hp/u.s.maxHp,hp);near(u.skill.timeLeft,30);assert.equal(u.s.flags.disarm,true);assert.equal(u.skill.spType,'time');}
 }
 function max(u){return u.s.maxHp;}
});
test('E0/E1/E2 selected stock2/3/3 and potential shield10/12,15/17,20/22 percent',()=>{
 for(const elite of[0,1,2])for(const potential of[1,5,6]){const{b,u,deploy}=make({elite,potential}),a=deploy(GUARD,5,8),t=device(b);assert.equal(card(b).stock,(elite?3:2)-1);near(pool(u,a),u.s.maxHp*([.1,.15,.2][elite]+(potential>=5?.02:0)));assert.equal(t.kind,'device');assert.equal(t.skill.noSkill,true);assert.equal(t.s.blockCnt,0);}
});
test('device immediate aura before Start, cost5/cooldown15/zero slots/infinite life/no damage',()=>{
 const{b,u,deploy,receipts}=make(),a=deploy(GUARD,5,8),slots=b.deployedSlots();b.addDp('arkpedia',99);const dp=b.dp,t=device(b);near(dp-b.dp,5);near(card(b).readyAt,15);assert.equal(b.deployedSlots(),slots);assert.equal(t.mem.regularFormVisual.clip,'Start');near(pool(u,a),536);assert.ok(a.findBuff(attr(u)));const e=enemy(b,{x:7});b.dealDamage(e,t,{type:'true',amount:100000});near(t.hp,100);t.atkCd=0;advance(b,100);assert.equal(t.alive,true);assert.equal(t.mem.regularFormVisual.clip,'Idle');assert.equal(t.stats.attacks,0);assert.equal(receipts.some(r=>r.source===t),false);
});
test('each device facing grants only its one forward tile and can use low or high terrain',()=>{
 for(const dir of['RIGHT','LEFT','UP','DOWN']){const{b,u,deploy}=make(),p={RIGHT:[8,5],LEFT:[6,5],UP:[7,6],DOWN:[7,4]}[dir],a=deploy(GUARD,p[1],p[0]);b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'HIGH',build:'RANGED'}));const t=device(b,5,7,dir);near(pool(u,a),536);assert.equal(t.dir,dir);assert.equal(t.def.position,'ALL');assert.equal(t.findBuff(key(u)),null);}
});
test('quiet5s then first derived1s pulse, depleted core persists, then cap and S1 restoration',()=>{
 const{b,u,deploy}=make(),a=deploy(GUARD,5,8),atk=a.s.atk;device(b);drain(b,u,a,536);near(pool(u,a),0);assert.ok(a.findBuff(key(u)));assert.equal(a.findBuff(attr(u)),null);near(a.s.atk,atk);advance(b,5.9);near(pool(u,a),0);advance(b,.2);near(pool(u,a),160.8);assert.ok(a.findBuff(attr(u)));advance(b,3);near(pool(u,a),536);
});
test('accepted shield-zero and partial shield damage resetquiet without replacing/refilling pool',()=>{
 const{b,u,deploy}=make(),a=deploy(GUARD,5,8);device(b);const core=a.findBuff(key(u));drain(b,u,a,100);near(pool(u,a),436);advance(b,5.9);drain(b,u,a,436);near(pool(u,a),0);assert.equal(a.findBuff(key(u)),core);advance(b,5.9);near(pool(u,a),0);advance(b,.2);near(pool(u,a),160.8);assert.equal(a.findBuff(key(u)),core);
});
test('Physical/Arts/True shield consumption is postmitigation and partialoverrun reachesHP',()=>{
 for(const type of['phys','arts','true']){const{b,u,deploy}=make(),a=deploy(GUARD,5,8);device(b);a.base.def=0;a.base.res=0;a.markDirty();const hp=a.hp,e=enemy(b);b.dealDamage(e,a,{type,amount:600,canDodge:false});near(hp-a.hp,64);near(pool(u,a),0);assert.ok(a.findBuff(key(u)));}
});
test('cancelled/dodged damage, HPLOSS and elemental gauge do not restart nativequiet timer',()=>{
 for(const mode of['cancel','dodge','hpLoss','element']){const{b,u,deploy}=make(),a=deploy(GUARD,5,8);device(b);drain(b,u,a,100);advance(b,4);const n=u.mem.cathyBarriers.get(a).nextNormal,e=enemy(b);
  if(mode==='cancel'){b.on('hit',ctx=>{if(ctx.target===a)ctx.dmg.cancel=true;});b.dealDamage(e,a,{type:'phys',amount:100});}
  if(mode==='dodge'){b.addBuff(a,{key:'dodge',mods:{dodgePhys:1}});b.dealDamage(e,a,{type:'phys',amount:100,canDodge:true});}
  if(mode==='hpLoss')b.loseHp(a,10);
  if(mode==='element')b.emit('damaged',{target:a,type:'element',dmg:{tags:[]}});
  near(u.mem.cathyBarriers.get(a).nextNormal,n);advance(b,2.1);near(pool(u,a),536);
 }
});
test('S1 all10 ranks applies once to self and shielded recipients, lost only when pool reacheszero',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u,deploy}=make({rank}),a=deploy(GUARD,5,8),atk=a.s.atk,def=a.s.def;device(b);const x=bb(0,rank);near(a.s.atk,atk+a.base.atk*x.s1_atk);near(a.s.def,def+a.base.def*x.s1_def);drain(b,u,a,500);near(pool(u,a),36);assert.ok(a.findBuff(attr(u)));drain(b,u,a,36);assert.equal(a.findBuff(attr(u)),null);assert.ok(u.findBuff(attr(u)));advance(b,6.1);near(a.s.atk,atk+a.base.atk*x.s1_atk);}
});
test('overlapping opposite devices never double stats/refill shield/reset quiet; removing one keepsother',()=>{
 const{b,u,deploy}=make(),a=deploy(GUARD,5,8),atk=a.s.atk,t=device(b);readyNext(b);drain(b,u,a,100);const core=a.findBuff(key(u)),quiet=u.mem.cathyBarriers.get(a).nextNormal,z=device(b,5,9,'LEFT');near(pool(u,a),436);assert.equal(a.findBuff(key(u)),core);near(u.mem.cathyBarriers.get(a).nextNormal,quiet);near(a.s.atk,atk+a.base.atk*.15);retreatRegularSummon(b,summonUnitId(t));near(pool(u,a),436);retreatRegularSummon(b,summonUnitId(z));near(pool(u,a),0);assert.equal(a.findBuff(attr(u)),null);
});
test('unhealable ordinary operators of all8 classes receive Barrier, devices/tokens neverdo',()=>{
 for(const profession of['PIONEER','WARRIOR','TANK','SNIPER','CASTER','SUPPORT','MEDIC','SPECIAL']){const id=Object.keys(data.operators).find(k=>k!==ID&&data.operators[k].profession===profession),{b,u,deploy}=make({extra:[id]}),a=deploy(id,5,8),t=device(b);b.addBuff(a,{key:'free-heal',flags:{healFree:true,noHeal:true,stealth:true,camou:true}});advance(b,.12);near(pool(u,a),536);assert.equal(t.findBuff(key(u)),null);}
});
test('recipient leave/free/isolation/death clears only owned pool; reentry creates one freshinitialBarrier',()=>{
 for(const flag of['untargetable','isolated']){const{b,u,deploy}=make(),a=deploy(GUARD,5,8);device(b);b.addBuff(a,{key:'foreign',shield:20});b.addBuff(a,{key:'free',flags:{[flag]:true}});advance(b,.12);assert.equal(a.findBuff(key(u)),null);assert.ok(a.findBuff('foreign'));b.removeBuff(a,'free');advance(b,.12);near(pool(u,a),536);b.retreatOperator(GUARD);assert.equal(a.findBuff(key(u)),null);const z=deploy(CASTER,5,8);near(pool(u,z),536);}
});
test('changing devicefacing removes previous recipient and initializes the newly coveredtile',()=>{
 const{b,u,deploy}=make(),a=deploy(GUARD,5,8),z=deploy(CASTER,5,6),t=device(b);drain(b,u,a,100);t.dir='LEFT';b.refreshRange(t);advance(b,.3);near(pool(u,a),0);near(pool(u,z),536);assert.equal(a.findBuff(attr(u)),null);near(z.s.atk,z.base.atk*1.15);
});
test('manual withdrawal refundsfloor2DP without stock or cooldown refill; failedthird placement consumesnothing',()=>{
 const{b}=make(),t=device(b);readyNext(b);device(b,5,9);state(b).readyAt=b.time;const n=card(b).stock,dp=b.dp;assert.equal(summonPlacementError(b,summonCardId(ID),6,8),'Summon deployment limit reached.');assert.throws(()=>deployRegularSummon(b,summonCardId(ID),6,8));near(b.dp,dp);assert.equal(card(b).stock,n);retreatRegularSummon(b,summonUnitId(t));near(b.dp,dp+2);assert.equal(card(b).stock,n);assert.equal(REGULAR_SUMMONS[ID].additiveBornStock,undefined);
});
test('new ownerdeployment resets supply2/3 rather than adding retainedstock and removes oldderivedbuffs',()=>{
 for(const elite of[0,1,2]){const{b,u,deploy}=make({elite}),a=deploy(GUARD,5,8),t=device(b);b.retreatOperator(ID);assert.equal(t.alive,false);assert.equal(a.findBuff(key(u)),null);assert.equal(a.findBuff(attr(u)),null);advance(b,100);const z=deploy();assert.notEqual(u,z);assert.equal(card(b).stock,elite?3:2);assert.equal(u.mem.cathyBarriers.size,0);}
});
test('S2 all10ranks forcedimmediate+one-second regen despite incoming hits and liveHP cap',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u,deploy}=make({skill:1,rank}),a=deploy(GUARD,5,8);device(b);drain(b,u,a,536);const hp=u.base.maxHp*(1+bb(1,rank).max_hp);cast(b,u);near(pool(u,a),hp*.06);advance(b,.9);near(pool(u,a),hp*.06);drain(b,u,a,10);advance(b,.2);near(pool(u,a),hp*.12-10);advance(b,5);near(pool(u,a),hp*.2);near(u.skill.spTotal,0);assert.equal(u.stats.attacks,0);}
});
test('S2 new device joins active mode with exactly one forcedpulse and noattack/stockrecharge',()=>{
 const{b,u,deploy}=make({skill:1}),a=deploy(GUARD,5,8);cast(b,u);advance(b,2);const t=device(b);near(pool(u,a),u.s.maxHp*.2);const n=card(b).stock;assert.equal(t.mem.regularFormVisual.clip,'Start');advance(b,31);assert.equal(card(b).stock,n);assert.equal(t.alive,true);assert.equal(u.skill.active,false);assert.equal(u.s.flags.disarm,undefined);assert.equal(t.stats.attacks,0);
});
test('S2 expiration/interruption restores ordinary stats andquiet clock without erasing a foreignbuff',()=>{
 for(const reason of['duration','test']){const{b,u,deploy}=make({skill:1}),a=deploy(GUARD,5,8);device(b);cast(b,u);advance(b,2);drain(b,u,a,100);b.addBuff(u,{key:'foreign',mods:{defFlat:17}});const quiet=u.mem.cathyBarriers.get(a).nextNormal,old=pool(u,a);if(reason==='duration')advance(b,28.1);else u.skill.end(reason);assert.equal(u.skill.active,false);near(u.s.maxHp,u.base.maxHp);near(u.s.def,u.base.def+17);assert.ok(u.findBuff('foreign'));if(reason==='test'){near(pool(u,a),old);near(u.mem.cathyBarriers.get(a).nextNormal,quiet);assert.equal(u.mem.cathyBarriers.get(a).nextSkill,null);advance(b,6.1);near(pool(u,a),536);}assert.equal(card(b).stock,2);}
});
test('Barrier cap follows source liveMaxHP, not deviceHP or recipientHP, trustdoesnottransfer',()=>{
 const{b,u,deploy}=make({trust:100}),a=deploy(GUARD,5,8),t=device(b);near(t.s.maxHp,100);near(t.s.atk,100);near(pool(u,a),536);b.addBuff(u,{key:'foreign-hp',mods:{hpPct:1}});drain(b,u,a,536);advance(b,6.1);near(pool(u,a),u.s.maxHp*.06);near(pool(u,a),321.6);
});
test('original fourfacing normal/S1 hit timingcap1 and animspeedcap1 prevent splash/air/fast release',()=>{
 for(const skill of[0,1])for(const dir of['RIGHT','LEFT','UP','DOWN']){const{b,u,receipts}=make({skill,dir}),p={RIGHT:[6,5],LEFT:[4,5],UP:[5,6],DOWN:[5,4]}[dir],e=enemy(b,{x:p[0],y:p[1]}),z=enemy(b,{x:p[0]+.05,y:p[1]+.05});b.addBuff(u,{key:'fast',mods:{aspd:100}});shot(b,u,e);advance(b,.45);near(e.hp,100000);advance(b,.1);near(100000-e.hp,u.s.atk);near(z.hp,100000);assert.equal(own(receipts,u).length,1);}
});
test('slowASPD scales native.5 release; manualS2 cancels an unreleasedattack without fakehit',()=>{
 const{b,u,receipts}=make({skill:1}),e=enemy(b);b.addBuff(u,{key:'slow',mods:{aspd:-50}});shot(b,u,e);advance(b,.9);near(e.hp,100000);cast(b,u);advance(b,.3);near(e.hp,100000);assert.equal(own(receipts,u).length,0);const n=u.stats.attacks;u.atkCd=0;advance(b,2);assert.equal(u.stats.attacks,n);near(e.hp,100000);
});
test('literal S2Begin/Loop/End originalevents are presentation only, nofictional attacking orendSP lock',()=>{
 const{b,u}=make({skill:1}),e=enemy(b);cast(b,u);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Begin');u.atkCd=0;advance(b,.5);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Loop');advance(b,29.6);assert.equal(u.skill.active,false);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_End');assert.ok(u.skill.spTotal>0);advance(b,.5);assert.equal(u.mem.regularFormVisual,null);assert.ok(u.stats.attacks>0);
});
test('empty source devicepassives cannot become a fictional manual recycle or damage ability',()=>{
 const build={...defaultBuild(data.operators[ID]),elite:2,level:80,potential:1};
 assert.equal(summonRecordFor(ID,build,data.tokens).skill,null);
 for(const field of['skillType','spCost','blackboard']){const t=structuredClone(data.tokens),s=t[TOKEN].skills[0].levels[0];if(field==='skillType')s.skillType='MANUAL';if(field==='spCost')s.spData.spCost=1;if(field==='blackboard')s.blackboard=[{key:'atk',value:1}];assert.throws(()=>summonRecordFor(ID,build,t),/Unreviewed Catherine/);}
});
test('owner can be protected by own directional device; S2 liveMAXHP drives pool and preservedHP ratio',()=>{
 const{b,u}=make({skill:1});device(b,5,4,'RIGHT');near(pool(u,u),536);u.hp=u.s.maxHp*.5;drain(b,u,u,200);const ratio=u.hp/u.s.maxHp;cast(b,u);near(u.hp/u.s.maxHp,ratio);near(pool(u,u),336+u.s.maxHp*.06);advance(b,2.1);near(pool(u,u),u.s.maxHp*.2);u.skill.end('test');near(u.s.maxHp,2680);near(pool(u,u),911.2);advance(b,5);near(pool(u,u),536);
});
test('non-silenceable/stunnable/freezable auras persist under control and source noClearOnDisappear',()=>{
 const{b,u,deploy}=make(),a=deploy(GUARD,5,8),t=device(b);b.applyStatus(u,'stun',{duration:2});b.applyStatus(t,'freeze',{duration:2});advance(b,.3);near(pool(u,a),536);assert.ok(a.findBuff(attr(u)));u.hidden=true;t.hidden=true;advance(b,.3);near(pool(u,a),536);assert.ok(a.findBuff(attr(u)));u.hidden=false;t.hidden=false;
});
