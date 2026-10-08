// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test'; import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type:'json' };
import evidence from '../data/arkpedia-alanna-prefabs.json' with { type:'json' };
import { ALANNA_OPERATORS as configs } from '../shared/arkpedia/alanna-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, acquireTargets } from '../server/sim/ai.js';
import { REGULAR_SUMMONS, summonCardId, summonUnitId, summonRecordFor } from '../shared/arkpedia/summons.js';
import { regularSummonCards, deployRegularSummon, retreatRegularSummon, summonPlacementError } from '../server/sim/content/arkpedia-summons.js';
const ID='char_4178_alanna',TOKEN='token_10045_alanna_crane',CASTER='char_141_nights',SUPPORT='char_258_podego',GUARD='char_208_melan';
const near=(a,z,e=1e-5)=>assert.ok(Math.abs(a-z)<e,`${a} != ${z}`),rows=rs=>rs.flatMap(g=>g.components.map(c=>({pathId:c.pathId,...c.data})));
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function make({skill=0,rank=10,elite=2,potential=1,dir='RIGHT',defer=false,extra=[]}={}){
 const d=structuredClone(data),o=d.operators[ID];assert.ok(o,'Reviewed Alanna snapshot required');
 d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;d.stage.geometry.rows=19;d.stage.geometry.cols=21;d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
 const build={...defaultBuild(o),elite,level:o.phases[elite].maxLevel,potential,skillId:o.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
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

const key=u=>`alanna_t:${u.id}`;
function phys(b,a,e,amount=500){b.dealDamage(a,e,{type:'phys',amount,isAttack:true,applyWay:'melee'});}
function received(receipts,a,e){return receipts.filter(r=>r.source===a&&r.target===e&&r.type==='phys');}
test('six verified originals/all20 ranks and exact native non-attacking crane pointer chain',()=>{
 assert.equal(evidence.frameParity,false);assert.equal(evidence.source.bundles.length,6);assert.deepEqual(Object.keys(configs),[ID]);
 assert.equal(Object.values(evidence.tables[ID].skillLevels).flat().length,20);
 for(const f of['Front','Back']){assert.equal(evidence.originalFacingBindings[ID][f].sha256,evidence.models[ID][f].sha256);near(evidence.models[ID][f].hits.Attack[0],.5);near(evidence.models[ID][f].hits.Skill_1[0],.5);near(evidence.models[ID][f].hits.Skill_2_Loop[0],.667);}
 const m=evidence.models[TOKEN];assert.equal(m.files[TOKEN+'.skel'].bytes,29615);assert.deepEqual(Object.keys(m.durations),['Default','Die','Idle','Start']);assert.deepEqual(m.hits,{});for(const r of['attack','skill','stun'])assert.equal(m.animationRoles[r],null);
 const n=rows(evidence.tokens[TOKEN]).find(x=>x.pathId==='-8957608926235710259');assert.equal(n._alwaysHideHp,1);assert.equal(n._occupiedRemainingCharacterCnt,0);assert.equal(n._useRealBornTimeFromAnim,0);near(n._withdrawCostRecoverRatio,.5);
 const aura=rows(evidence.characters[ID]).find(x=>x.pathId==='-946219463250323635');near(aura._interval,.1);assert.equal(aura._forceTick,1);assert.equal(aura._clearBuffsWhenDisappear,1);
});
test('all20 skill ranks preserve base stats/cap1/CAST0 and passiveS1 versus manualS2',()=>{
 for(let s=0;s<2;s++)for(let rank=1;rank<=10;rank++){const{b,u}=make({skill:s,rank});near(u.s.atk,u.base.atk);near(u.s.interval,u.base.bat);assert.equal(u.profile.maxTargets,1);assert.equal(u.profile.splashRadius,0);assert.equal(u.profile.retargetOnRelease,true);assert.equal(u.skill.kind,s?'duration':'passive');assert.equal(u.skill.ready,false);assert.deepEqual(b.errors,[]);}
});
test('E0/E1/E2 source stock2/3/3 and selected potential DEF penetration40/50/60/70/80/90',()=>{
 for(const elite of[0,1,2])for(const potential of[1,5,6]){const{b,u}=make({elite,potential});assert.equal(card(b).stock,elite?3:2);near(tbb(u).def_penetrate_fixed_bb,[40,60,80][elite]+(potential>=5?10:0));const t=device(b);assert.equal(t.kind,'device');assert.equal(t.mem.regularHideHp,true);assert.equal(t.skill.noSkill,true);}
});
test('device exactDP5/redeploy15/direction/zero slots/maxDeck3 and low-high placement',()=>{
 const{b}=make();b.addDp('arkpedia',99);const slots=b.deployedSlots(),dp=b.dp,t=device(b);near(dp-b.dp,5);assert.equal(card(b).stock,2);near(card(b).readyAt,15);assert.equal(b.deployedSlots(),slots);assert.equal(t.dir,'RIGHT');assert.equal(REGULAR_SUMMONS[ID].refundRatio,.5);assert.equal(REGULAR_SUMMONS[ID].chooseFacing,true);assert.equal(REGULAR_SUMMONS[ID].noAttack,true);assert.equal(REGULAR_SUMMONS[ID].additiveBornStock,true);
});
test('native immediate marker/lifetime beforeStart1 and no fictional attack/damage/block/HPbar',()=>{
 const{b,u,deploy,receipts}=make(),a=deploy(GUARD,5,8),t=device(b);assert.ok(a.findBuff(key(u)));near(t.mem.alannaExpiry,60);assert.equal(t.mem.regularFormVisual.clip,'Start');assert.equal(t.mem.regularHideHp,true);assert.equal(t.s.blockCnt,0);const e=enemy(b,{x:7,y:5});b.dealDamage(e,t,{type:'true',amount:9999});near(t.hp,100);t.atkCd=0;advance(b,1.2);assert.equal(t.stats.attacks,0);assert.equal(t.mem.regularFormVisual.clip,'Idle');assert.equal(receipts.some(r=>r.source===t),false);
});
test('native passiveS1 all10 ranks adds exactASPD only to marked recipient and extends life once',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u,deploy}=make({rank}),a=deploy(GUARD,5,8),base=a.s.aspd,t=device(b);near(a.s.aspd,base+bb(0,rank).attack_speed);near(u.s.aspd,u.base.aspd);near(t.mem.alannaExpiry,30+bb(0,rank).extend_time);advance(b,2);near(t.mem.alannaExpiry,30+bb(0,rank).extend_time);}
});
test('same owner two opposite facing devices do not stack eitherASPD or fixed DEF penetration',()=>{
 const{b,u,deploy,receipts}=make(),a=deploy(GUARD,5,8),base=a.s.aspd,t=device(b),e=enemy(b,{def:400});phys(b,a,e);const one=received(receipts,a,e).at(-1).amount;near(one,180);near(a.s.aspd,base+23);readyNext(b);const z=device(b,5,9,'LEFT');phys(b,a,e);near(received(receipts,a,e).at(-1).amount,one);near(a.s.aspd,base+23);retreatRegularSummon(b,summonUnitId(t));assert.ok(a.findBuff(key(u)));phys(b,a,e);near(received(receipts,a,e).at(-1).amount,one);retreatRegularSummon(b,summonUnitId(z));assert.equal(a.findBuff(key(u)),null);near(a.s.aspd,base);phys(b,a,e);near(received(receipts,a,e).at(-1).amount,100);
});
test('foreign DEF-ignore remains independent and is not erased when the Alanna marker ends',()=>{
 const{b,u,deploy,receipts}=make({skill:1}),a=deploy(GUARD,5,8),t=device(b),e=enemy(b,{def:400});b.addBuff(a,{key:'foreign',mods:{defIgnoreFlat:50,defIgnorePct:.25}});phys(b,a,e);near(received(receipts,a,e).at(-1).amount,330);retreatRegularSummon(b,summonUnitId(t));phys(b,a,e);near(received(receipts,a,e).at(-1).amount,250);assert.ok(a.findBuff('foreign'));
});
test('DEF penetration is scoped recipient output, not enemy DEF reduction or an Arts/True damage boost',()=>{
 const{b,u,deploy,receipts}=make({skill:1}),a=deploy(GUARD,5,8),e=enemy(b,{def:400});device(b);phys(b,a,e);near(received(receipts,a,e).at(-1).amount,180);near(e.s.def,400);const before=e.hp;b.dealDamage(a,e,{type:'arts',amount:500});b.dealDamage(a,e,{type:'true',amount:500});near(before-e.hp,1000);phys(b,u,e);near(received(receipts,u,e).at(-1).amount,100);
});
test('every source profession can receive purposeNONE device, but token/device actors cannot',()=>{
 const professions=['PIONEER','WARRIOR','TANK','SNIPER','CASTER','SUPPORT','MEDIC','SPECIAL'];
 for(const profession of professions){const id=Object.keys(data.operators).find(k=>k!==ID&&data.operators[k].profession===profession);assert.ok(id,profession);const{b,u,deploy,receipts}=make({extra:[id]}),a=deploy(id,5,8),t=device(b),e=enemy(b,{def:400});assert.ok(a.findBuff(key(u)),profession);phys(b,a,e);near(received(receipts,a,e).at(-1).amount,180);assert.equal(t.findBuff(key(u)),null);assert.equal(u.findBuff(key(u)),null);}
});
test('non-HEAL marker retains healFree/noHeal/stealth/camouflage recipient but excludesfree/isolation',()=>{
 const{b,u,deploy}=make(),a=deploy(GUARD,5,8),base=a.s.aspd;device(b);b.addBuff(a,{key:'unhealable',flags:{healFree:true,noHeal:true,stealth:true,camou:true}});advance(b,.12);assert.ok(a.findBuff(key(u)));near(a.s.aspd,base+23);for(const flag of['untargetable','isolated']){b.addBuff(a,{key:'free',flags:{[flag]:true}});advance(b,.12);assert.equal(a.findBuff(key(u)),null);b.removeBuff(a,'free');advance(b,.12);assert.ok(a.findBuff(key(u)));}
});
test('current facing recipient substitution receives only original remaining lifetime with no timer refresh',()=>{
 const{b,u,deploy}=make(),a=deploy(GUARD,5,8),t=device(b);advance(b,5);b.retreatOperator(GUARD);assert.equal(a.findBuff(key(u)),null);const z=deploy(CASTER,5,8);advance(b,.12);assert.ok(z.findBuff(key(u)));near(t.mem.alannaExpiry,60);advance(b,t.mem.alannaExpiry-b.time-b.dt);assert.equal(t.alive,true);advance(b,2*b.dt);assert.equal(t.alive,false);assert.equal(z.findBuff(key(u)),null);
});
test('changing device facing recomputes recipients without stacking or new device lifetime',()=>{
 const{b,u,deploy}=make(),a=deploy(GUARD,5,8),z=deploy(CASTER,5,6),t=device(b);assert.ok(a.findBuff(key(u)));t.dir='LEFT';b.refreshRange(t);advance(b,.12);assert.equal(a.findBuff(key(u)),null);assert.ok(z.findBuff(key(u)));near(t.mem.alannaExpiry,60);
});
test('owner hidden clear-on-disappear and device hidden clear mark, with unchanged timers after reentry',()=>{
 const{b,u,deploy}=make(),a=deploy(GUARD,5,8),t=device(b);u.hidden=true;advance(b,.12);assert.equal(a.findBuff(key(u)),null);u.hidden=false;advance(b,.12);assert.ok(a.findBuff(key(u)));t.hidden=true;advance(b,.12);assert.equal(a.findBuff(key(u)),null);t.hidden=false;advance(b,.12);assert.ok(a.findBuff(key(u)));near(t.mem.alannaExpiry,60);
});
test('source nonstunnable/unfreezable marks retain effects through owner/device short control',()=>{
 const{b,u,deploy}=make(),a=deploy(GUARD,5,8),t=device(b);b.applyStatus(u,'stun',{duration:1});b.applyStatus(t,'freeze',{duration:1});advance(b,.12);assert.ok(a.findBuff(key(u)));near(a.s.aspd,a.base.aspd+23);near(t.mem.alannaExpiry,60);
});
test('native manual device removal refunds floor5×.5=2, no stock or cooldown reset',()=>{
 const{b}=make(),t=device(b),dp=b.dp,n=card(b).stock,ready=card(b).readyAt;retreatRegularSummon(b,summonUnitId(t));near(b.dp,dp+2);assert.equal(card(b).stock,n);near(card(b).readyAt,ready);
});
test('finite native max2 deployment cap rejects third with remaining stock, failed placement no consumption',()=>{
 const{b}=make();device(b);readyNext(b);device(b,5,9);state(b).readyAt=b.time;const stock=card(b).stock,dp=b.dp;assert.equal(summonPlacementError(b,summonCardId(ID),6,8),'Summon deployment limit reached.');assert.throws(()=>deployRegularSummon(b,summonCardId(ID),6,8));assert.equal(card(b).stock,stock);near(b.dp,dp);
});
test('E0 source NORMAL retained unused1+born2 caps3, spent0+born2 remains2',()=>{
 for(const remaining of[0,1]){const{b,u,deploy}=make({elite:0});device(b);if(!remaining){readyNext(b);device(b,5,9);}assert.equal(card(b).stock,remaining);b.retreatOperator(ID);advance(b,100);const fresh=deploy();assert.notEqual(fresh,u);assert.equal(card(b).stock,Math.min(3,remaining+2));}
});
test('E1/E2 normal birth counts add and clamp3 on one actual newowner deploy, never failedplacement',()=>{
 for(const elite of[1,2]){const{b,u,deploy}=make({elite});device(b);const n=card(b).stock;assert.throws(()=>deploy(ID,5,8));assert.equal(card(b).stock,n);b.retreatOperator(ID);advance(b,100);deploy();assert.equal(card(b).stock,3);advance(b,2);assert.equal(card(b).stock,3);}
});
test('all10 S1 devices expire once at30+extension, not repeated attach/poll or Start-based lifetime',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u,deploy}=make({rank}),a=deploy(GUARD,5,8),t=device(b),stock=card(b).stock,L=30+bb(0,rank).extend_time;advance(b,L-b.dt);assert.equal(t.alive,true);assert.ok(a.findBuff(key(u)));advance(b,2*b.dt);assert.equal(t.alive,false);assert.equal(card(b).stock,stock);assert.equal(a.findBuff(key(u)),null);}
});
test('S2 devices expire at native30 even duringactive skill and expiry never restoresDP or stock',()=>{
 const{b,u,deploy}=make({skill:1}),a=deploy(GUARD,5,8),t=device(b),dp=b.dp,n=card(b).stock;advance(b,29.9);assert.ok(a.findBuff(key(u)));advance(b,.2);assert.equal(t.alive,false);near(b.dp,dp);assert.equal(card(b).stock,n);
});
test('all10 S2 ranks use exact stat/talent multiplier on actual armored damage and only one device effect',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u,deploy,receipts}=make({skill:1,rank}),a=deploy(GUARD,5,8),e=enemy(b,{def:400});device(b);cast(b,u);near(u.s.atk,u.base.atk*(1+bb(1,rank).atk));near(u.s.interval,u.base.bat*100/(100+bb(1,rank).attack_speed));phys(b,a,e);near(received(receipts,a,e).at(-1).amount,100+80*bb(1,rank).multi);advance(b,u.skill.duration+.05);phys(b,a,e);near(received(receipts,a,e).at(-1).amount,180);}
});
test('S2 scaling follows potential and current mode exactly before/after command, not only owner tick',()=>{
 const{b,u,deploy,receipts}=make({skill:1,potential:5}),a=deploy(GUARD,5,8),e=enemy(b,{def:400});device(b);phys(b,a,e);near(received(receipts,a,e).at(-1).amount,190);cast(b,u);phys(b,a,e);near(received(receipts,a,e).at(-1).amount,343);u.skill.end('test');phys(b,a,e);near(received(receipts,a,e).at(-1).amount,190);
});
test('S2 new device joins same current multiplier immediately while Start plays, no lifetime extension',()=>{
 const{b,u,deploy,receipts}=make({skill:1}),a=deploy(GUARD,5,8),e=enemy(b,{def:400});cast(b,u);advance(b,2);const t=device(b);phys(b,a,e);near(received(receipts,a,e).at(-1).amount,316);assert.equal(t.mem.regularFormVisual.clip,'Start');near(t.mem.alannaExpiry,32);advance(b,13.1);phys(b,a,e);near(received(receipts,a,e).at(-1).amount,180);assert.equal(t.alive,true);
});
test('actual S2 Begin.267 gates natural first attack then literalIdle/Loop/End without extraSP endlock',()=>{
 const{b,u}=make({skill:1}),e=enemy(b);cast(b,u);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Begin');u.atkCd=0;advance(b,.2);assert.equal(u.stats.attacks,0);advance(b,.12);assert.equal(u.stats.attacks,1);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Idle');u.atkCd=1000;advance(b,u.skill.duration-b.time+b.dt);assert.equal(u.skill.active,false);assert.ok(u.skill.spTotal>0);assert.equal(!!u.s.flags.disarm,false);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_End');advance(b,.3);assert.equal(u.mem.regularFormVisual,null);
});
test('normal/S1/S2 actual four facing event releases hit single ground victim without splash',()=>{
 for(const skill of[0,1])for(const dir of['RIGHT','LEFT','UP','DOWN']){const{b,u,receipts}=make({skill,dir}),p={RIGHT:[6,5],LEFT:[4,5],UP:[5,6],DOWN:[5,4]}[dir],e=enemy(b,{x:p[0],y:p[1],def:200}),z=enemy(b,{x:p[0]+.05,y:p[1]+.05});if(skill){cast(b,u);advance(b,.3);}const atk=u.s.atk,f=['LEFT','UP'].includes(dir)?'Back':'Front',clip=skill?'Skill_2_Loop':'Skill_1',wind=evidence.models[ID][f].hits[clip][0]/(u.base.bat/u.s.interval);shot(b,u,e);advance(b,wind-b.dt);near(e.hp,100000);advance(b,2*b.dt);near(100000-e.hp,Math.max(atk-200,atk*.05));near(z.hp,100000);const r=own(receipts,u,e)[0];assert.equal(r.dmg.isAttack,true);assert.equal(r.dmg.applyWay,'melee');assert.equal(r.dmg.isSkill,!!skill);}
});
test('normal passiveS1 and S2 CAST release substitutes entrant and suppresses leaving/free cached victim',()=>{
 for(const skill of[0,1]){const{b,u,receipts}=make({skill}),e=enemy(b),z=enemy(b,{x:9});if(skill){cast(b,u);advance(b,.3);}shot(b,u,e);advance(b,.1);move(b,e,9);move(b,z,6);advance(b,.7);assert.equal(own(receipts,u,e).length,0);assert.equal(own(receipts,u,z).length,1);shot(b,u,z);advance(b,.1);b.addBuff(z,{key:'free',flags:{untargetable:true}});advance(b,.7);assert.equal(own(receipts,u,z).length,1);}
});
test('subtickacceptedcontrol cancels unbornnormal/S2 shot, rejectedimmune preserves single output',()=>{
 for(const skill of[0,1])for(const immune of[false,true]){const{b,u,receipts}=make({skill}),e=enemy(b);if(skill){cast(b,u);advance(b,.3);}if(immune)u.def.immune.add('stun');shot(b,u,e);advance(b,.1);b.applyStatus(u,'stun',{duration:.001});advance(b,.7);assert.equal(own(receipts,u,e).length,immune?1:0);}
});
test('normalS2 finish adds exactly1 capped3 preserving live devices and originalcard redeploy clock',()=>{
 const{b,u}=make({skill:1}),t=device(b),n=card(b).stock,ready=card(b).readyAt;cast(b,u);advance(b,15+.05);assert.equal(card(b).stock,Math.min(3,n+1));near(card(b).readyAt,ready);assert.equal(t.alive,true);state(b).stock=3;cast(b,u);advance(b,15+.05);assert.equal(card(b).stock,3);
});
test('earlyfinish/death/withdraw do not recharge whileshortcontrol nonstunnable mode stillnormalfinishes',()=>{
 for(const reason of['test','manual','death','withdraw']){const{b,u}=make({skill:1});device(b);const n=card(b).stock;cast(b,u);if(reason==='death')b.kill(u);else if(reason==='withdraw')b.retreatOperator(ID);else u.skill.end(reason);advance(b,.3);assert.equal(card(b).stock,n);}
 const{b,u}=make({skill:1});device(b);const n=card(b).stock;cast(b,u);b.applyStatus(u,'stun',{duration:.001});advance(b,15+.05);assert.equal(card(b).stock,Math.min(3,n+1));
});
test('ownerwithdraw removes onlyown markers/devices, preserves foreignbuff and finite state history',()=>{
 const{b,u,deploy}=make(),a=deploy(GUARD,5,8),t=device(b);b.addBuff(a,{key:'foreign',mods:{defIgnoreFlat:50}});b.retreatOperator(ID);assert.equal(t.alive,false);assert.equal(a.findBuff(key(u)),null);assert.ok(a.findBuff('foreign'));assert.equal(card(b).stock,2);
});
test('original missingtoken source failsclosed and inappropriateS2promotion is rejected',()=>{
 const{build}=make();const tokens=structuredClone(data.tokens);delete tokens[TOKEN];assert.throws(()=>summonRecordFor(ID,build,tokens),/Missing reviewed/);assert.throws(()=>make({elite:0,skill:1}),/skill|promotion|unlock/i);
});
test('explicit cached-flight bridge uses current ownerS2 at impact, then restores base after earlyend',()=>{
 const{b,u,deploy,receipts}=make({skill:1}),a=deploy(GUARD,5,8),e=enemy(b,{x:9,def:400});device(b);b.addProjectile({from:a,target:e,flightTime:1,onHit:()=>phys(b,a,e)});advance(b,.2);cast(b,u);advance(b,.85);near(received(receipts,a,e).at(-1).amount,316);b.addProjectile({from:a,target:e,flightTime:1,onHit:()=>phys(b,a,e)});advance(b,.2);u.skill.end('test');advance(b,.85);near(received(receipts,a,e).at(-1).amount,180);
});
test('emitted recipient projectile outlives Alanna withdrawal but loses detached aura under bounded current-impact law',()=>{
 const{b,u,deploy,receipts}=make({skill:1}),a=deploy(GUARD,5,8),e=enemy(b,{x:9,def:400});device(b);b.addBuff(a,{key:'foreign',mods:{defIgnoreFlat:50}});b.addProjectile({from:a,target:e,flightTime:1,onHit:()=>phys(b,a,e)});advance(b,.2);b.retreatOperator(ID);advance(b,.85);near(received(receipts,a,e).at(-1).amount,150);assert.ok(a.findBuff('foreign'));assert.equal(a.findBuff(key(u)),null);
});
