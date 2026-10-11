// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test'; import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type:'json' };
import evidence from '../data/arkpedia-windflit-prefabs.json' with { type:'json' };
import { WINDFLIT_OPERATORS as configs } from '../shared/arkpedia/windflit-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, acquireTargets } from '../server/sim/ai.js';
import { REGULAR_SUMMONS, summonCardId, summonUnitId, summonRecordFor } from '../shared/arkpedia/summons.js';
import { regularSummonCards, deployRegularSummon, retreatRegularSummon, summonPlacementError } from '../server/sim/content/arkpedia-summons.js';
const ID='char_433_windft',TOKEN='token_10023_windft_wrench',CASTER='char_141_nights',SUPPORT='char_258_podego',GUARD='char_208_melan';
const near=(a,z,e=1e-5)=>assert.ok(Math.abs(a-z)<e,`${a} != ${z}`),rows=rs=>rs.flatMap(g=>g.components.map(c=>({pathId:c.pathId,...c.data})));
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function make({skill=0,rank=10,elite=2,potential=1,dir='RIGHT',defer=false}={}){
 const d=structuredClone(data),o=d.operators[ID];assert.ok(o,'Reviewed Windflit snapshot required');
 d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;d.stage.geometry.rows=19;d.stage.geometry.cols=21;d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
 const build={...defaultBuild(o),elite,level:o.phases[elite].maxLevel,potential,skillId:o.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
 const b=new StandardBattle(d,{operators:[build,...[CASTER,SUPPORT,GUARD].map(id=>defaultBuild(d.operators[id]))]});
 b.autoFinish=false;b.setViewport('fullscreen-workspace');b.recordEvents=true;b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));b.addDp('arkpedia',99);
 const deploy=(id=ID,r=5,c=5,f=dir)=>{b.addDp('arkpedia',99);const a=b.deployOperator(id,r,c,f);assert.ok(a);a.atkCd=1000;if(a.skill)a.skill.rule='NEVER';return a;};
 const receipts=[];b.on('damaged',x=>receipts.push({...x,time:b.time}));return{b,u:defer?null:deploy(),build,deploy,receipts};
}
const card=b=>regularSummonCards(b).find(s=>s.ownerId===ID),state=b=>b.regularSummons.get(summonCardId(ID));
function battery(b,r=5,c=7,dir='RIGHT'){b.addDp('arkpedia',99);const t=deployRegularSummon(b,summonCardId(ID),r,c,dir);assert.ok(t);return t;}
function readyNext(b){const n=card(b).readyAt-b.time;if(n>0)advance(b,n+2*b.dt);}
function enemy(b,{x=6,y=5,hp=100000,def=0,fly=false}={}){const e=b.spawnEnemy('enemy_1007_slime',{pos:[y,x]});Object.assign(e.base,{maxHp:100000,def,res:0,moveSpeed:0});if(fly)e.motion='FLY';e.markDirty();void e.s;e.hp=hp;b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;}
function move(b,e,x,y=5){e.x=x;e.y=y;e.tileR=Math.round(y);e.tileC=Math.round(x);b._enemiesDirty=true;b._buildEnemyIndex();}
function cast(b,u){u.skill.setSpTotal(u.skill.spCost);if(u.skill.manual)assert.equal(b.activateOperator(ID),true);else assert.equal(u.skill.activate('test'),true);u.atkCd=1000;}
function shot(b,u,e){assert.equal(b.forceAttack(u,[e]),true);u.atkCd=1000;}
const own=(rs,u,e)=>rs.filter(r=>r.source===u&&r.type==='phys'&&(!e||r.target===e));
const tbb=u=>u.def.talents[0].bb,bb=(s,r=10)=>Object.fromEntries(data.operators[ID].skills[s].levels[r-1].blackboard.map(x=>[x.key,x.value]));

test('full six-original source, all40 owner/token ranks and real battery pointer/Idle0 evidence retained',()=>{
 assert.equal(evidence.frameParity,false);assert.equal(evidence.source.bundles.length,6);assert.deepEqual(Object.keys(configs),[ID]);
 for(const id of[ID,TOKEN])for(const sk of Object.values(evidence.tables[id].skillLevels))assert.equal(sk.length,10);
 for(const f of['Front','Back']){assert.equal(evidence.originalFacingBindings[ID][f].sha256,evidence.models[ID][f].sha256);near(evidence.models[ID][f].hits.Attack[0],.3);near(evidence.models[ID][f].hits.Skill_1[0],.367);near(evidence.models[ID][f].hits.Skill_2_Loop[0],.433);}
 const m=evidence.models[TOKEN];assert.equal(m.animationRoles.attack,null);assert.deepEqual(m.hits.Idle,[0]);near(m.durations.Start,.333);near(m.durations.End,.267);assert.equal(m.files[TOKEN+'.skel'].bytes,4974);
 const component=rows(evidence.tokens[TOKEN]).find(c=>c.pathId==='-4873286971795661019');assert.equal(component._attackType,0);assert.equal(component._damageType,1);assert.equal(component._waitForAttackEvent,1);assert.equal(component._animKey,'');
 assert.ok(evidence.verificationLimits.some(x=>x.includes('current-target')));assert.equal(evidence.primaryCorroboration[0].gitBlobSha,'87cf0b27f7a7c9aa74976d8ca2bb2e7d4ac79eb8');
});
test('all20 selected ranks preserve source base owner without leaked battery/talent percent modifiers',()=>{
 for(let s=0;s<2;s++)for(let rank=1;rank<=10;rank++){const{b,u}=make({skill:s,rank,potential:6});near(u.s.atk,u.base.atk);near(u.s.interval,u.base.bat);assert.equal(u.profile.maxTargets,1);assert.equal(u.profile.splashRadius,0);assert.equal(u.profile.retargetOnRelease,true);assert.equal(u.skill.kind,s?'duration':'charges');assert.equal(u.skill.maxCharges,s?1:bb(0,rank).ct);assert.deepEqual(b.errors,[]);}
});
test('native E0/E1/E2 stocks2/3/3, maxDeploy2, maxDeck3 and exact potential-scaled battery ATK',()=>{
 for(const elite of[0,1,2])for(const potential of[1,5,6]){const{b,u,build}=make({elite,rank:[4,7,10][elite],potential}),r=summonRecordFor(ID,build,data.tokens);assert.equal(card(b).stock,elite?3:2);assert.equal(r.stats.maxDeployCount,2);assert.equal(r.stats.maxDeckStackCnt,3);near(r.talents[0].bb.atk,tbb(u).atk);near(tbb(u).atk,[.05,.1,.15][elite]+(potential>=5?.02:0));}
});
test('battery consumesDP5/stock1, zero slots and source15sec placement cooldown with explicit facing',()=>{
 const{b,u}=make();b.addDp('arkpedia',99);const dp=b.dp,slots=b.deployedSlots(),t=battery(b);near(dp-b.dp,5);assert.equal(card(b).stock,2);near(card(b).readyAt,15);assert.equal(b.deployedSlots(),slots);assert.equal(t.ownerUnit,u);assert.equal(t.kind,'device');assert.equal(t.dir,'RIGHT');assert.equal(summonPlacementError(b,summonCardId(ID),5,9),'Summon is still redeploying.');readyNext(b);assert.equal(summonPlacementError(b,summonCardId(ID),5,9),null);
});
test('own device source100HP/ATK/zeroBlock is independent from owner trust/potential and has no ordinary skill or friendly damage',()=>{
 const{b,u,deploy,receipts}=make({potential:6}),a=deploy(CASTER,5,8),t=battery(b);near(t.base.maxHp,100);near(t.base.atk,100);near(t.s.blockCnt,0);assert.notEqual(t.base.atk,u.base.atk);assert.equal(t.skill.noSkill,true);assert.equal(t.profile.noAttack,true);const hp=a.hp;advance(b,8);near(a.hp,hp);assert.equal(receipts.some(r=>r.source===t),false);assert.equal(t.stats.attacks,0);assert.equal(t.s.flags.invulnerable,true);assert.equal(t.s.flags.healFree,true);
});
test('realStart.333 is effect birth: no ATK or SP before completion, selected30sec lifetime begins afterward',()=>{
 const{b,u,deploy}=make(),a=deploy(CASTER,5,8),base=a.s.atk,t=battery(b),e=enemy(b);advance(b,.3);near(a.s.atk,base);assert.equal(t.mem.windflitBorn,false);cast(b,u);shot(b,u,e);advance(b,.1);assert.equal(t.mem.windflitBorn,true);near(a.s.atk,base+a.base.atk*tbb(u).atk);advance(b,29.8);assert.equal(t.alive,true);advance(b,.3);assert.equal(t.alive,false);near(a.s.atk,base);
});
test('two same-owner battery effects add independently while retaining foreign ATK buffs and removal ownership',()=>{
 const{b,u,deploy}=make(),a=deploy(CASTER,5,8),base=a.s.atk,t=battery(b);advance(b,.4);readyNext(b);const z=battery(b,5,9,'LEFT');advance(b,.4);near(a.s.atk,base+a.base.atk*tbb(u).atk*2);assert.ok(a.findBuff(`windft_wrench_t:${t.id}`));assert.ok(a.findBuff(`windft_wrench_t:${z.id}`));b.addBuff(a,{key:'foreign',mods:{atkPct:.2}});b.retreat(t,{permanent:true});near(a.s.atk,base+a.base.atk*(tbb(u).atk+.2));assert.equal(a.findBuff(`windft_wrench_t:${t.id}`),null);assert.ok(a.findBuff(`windft_wrench_t:${z.id}`));assert.ok(a.findBuff('foreign'));
});
test('native profession restriction equipsCaster/Support but never Guard or Windflit outside facing grid',()=>{
 for(const id of[CASTER,SUPPORT,GUARD]){const{b,u,deploy}=make(),a=deploy(id,5,8),base=a.s.atk,ownerBase=u.s.atk;battery(b);advance(b,.4);near(a.s.atk,base+([CASTER,SUPPORT].includes(id)?a.base.atk*tbb(u).atk:0));near(u.s.atk,ownerBase);}
});
test('directional1-1 device benefit uses every real facing and does not reach the opposite tile',()=>{
 for(const dir of['RIGHT','LEFT','UP','DOWN']){const{b,u,deploy}=make(),point={RIGHT:[5,8],LEFT:[5,6],UP:[6,7],DOWN:[4,7]}[dir],a=deploy(CASTER,...point),base=a.s.atk,t=battery(b,5,7,dir);advance(b,.4);near(a.s.atk,base+a.base.atk*tbb(u).atk);assert.equal(t.mem.windflitTarget,a);assert.ok(t.rangeKeySet.has(point[0]*21+point[1]));}
});
test('purposeNONE aura preserves target-free/isolated/noHeal/HealFree beneficiaries, while current-targetSP legality remains separate',()=>{
 const{b,u,deploy}=make(),a=deploy(CASTER,5,8),base=a.s.atk,t=battery(b);b.addBuff(a,{key:'free',flags:{untargetable:true,isolated:true,noHeal:true,healFree:true,noSp:true}});advance(b,.4);near(a.s.atk,base+a.base.atk*tbb(u).atk);assert.equal(t.mem.windflitTarget,null);const sp=a.skill.spTotal;cast(b,u);shot(b,u,enemy(b));advance(b,.5);near(a.skill.spTotal,sp);b.removeBuff(a,'free');b.addBuff(a,{key:'noHeal',flags:{noHeal:true,healFree:true,noSp:true}});advance(b,b.dt);assert.equal(t.mem.windflitTarget,a);cast(b,u);shot(b,u,enemy(b));advance(b,.5);assert.ok(a.skill.spTotal>=sp+1);
});
test('facing recipient reassignment removes old effect and grants newly deployed actor only original remaining device lifetime',()=>{
 const{b,u,deploy}=make(),a=deploy(CASTER,5,8),t=battery(b);advance(b,.4);assert.equal(t.mem.windflitTarget,a);b.retreatOperator(CASTER);assert.equal(a.findBuff(`windft_wrench_t:${t.id}`),null);const z=deploy(SUPPORT,5,8),base=z.s.atk-z.base.atk*tbb(u).atk;advance(b,b.dt);assert.equal(t.mem.windflitTarget,z);near(z.s.atk,base+z.base.atk*tbb(u).atk);advance(b,30);assert.equal(t.alive,false);assert.equal(z.findBuff(`windft_wrench_t:${t.id}`),null);
});
test('each equipped device grants forcedSP during active/noSP even from same owner, capped by recipient original capacity',()=>{
 const{b,u,deploy}=make(),a=deploy(CASTER,5,8);battery(b);advance(b,.4);readyNext(b);battery(b,5,9,'LEFT');advance(b,.4);a.skill.setSpTotal(a.skill.spCost);assert.equal(b.activateOperator(CASTER),true);b.addBuff(a,{key:'noSp',flags:{noSp:true}});near(a.skill.spTotal,0);cast(b,u);shot(b,u,enemy(b));advance(b,.5);near(a.skill.spTotal,2);a.skill.gainSp(a.skill.spCost-2.5,'init',true);cast(b,u);shot(b,u,enemy(b));advance(b,.5);near(a.skill.spTotal,a.skill.spCost);
});
test('all10 S1 ranks use exactPhysical scale, ground-only x4 and one forcedSP grant per device per family',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u,deploy,receipts}=make({rank}),a=deploy(CASTER,5,8);battery(b);advance(b,.4);b.addBuff(a,{key:'stopSP',flags:{noSp:true}});a.skill.setSpTotal(0);const e=enemy(b),z=enemy(b,{x:4,y:5}),f=enemy(b,{x:5,y:6,fly:true});cast(b,u);const atk=u.s.atk;shot(b,u,e);advance(b,.5);for(const t of[e,z]){near(100000-t.hp,atk*bb(0,rank).atk_scale);assert.equal(own(receipts,u,t).length,1);}near(f.hp,100000);near(a.skill.spTotal,1);}
});
test('naturalS1 family hits every nearbyground victim once, with no duplicate splash or off-grid victim',()=>{
 const{b,u,receipts}=make(),points=[[6,5],[4,5],[5,6],[5,4],[6,6],[4,4]],es=points.map(([x,y])=>enemy(b,{x,y})),z=enemy(b,{x:9,y:5});u.skill.rule='DEFAULT';u.skill.setSpTotal(u.skill.spCost);u.atkCd=0;advance(b,.5);assert.equal(u.stats.attacks,1);for(const e of es)assert.equal(own(receipts,u,e).length,1);assert.equal(own(receipts,u,z).length,0);assert.equal(new Set(own(receipts,u).map(r=>r.dmg.attackId)).size,1);assert.equal(u.skill.active,false);
});
test('S1 SELF release selectsall entrants and suppressesdeparted or target-free victims',()=>{
 const{b,u,receipts}=make(),e=enemy(b),z=enemy(b,{x:9});cast(b,u);shot(b,u,e);advance(b,.1);move(b,e,9);move(b,z,4);advance(b,.4);assert.equal(own(receipts,u,e).length,0);assert.equal(own(receipts,u,z).length,1);const f=enemy(b);cast(b,u);shot(b,u,f);advance(b,.1);b.addBuff(f,{key:'free',flags:{untargetable:true}});move(b,z,9);advance(b,.4);assert.equal(own(receipts,u,f).length,0);
});
test('normal and S2 source2/CAST0 reacquire an entrant after the startup victim leaves range',()=>{
 for(const skill of[0,1]){const{b,u,receipts}=make({skill}),e=enemy(b),z=enemy(b,{x:9});if(skill){cast(b,u);advance(b,.2);}shot(b,u,e);advance(b,.1);move(b,e,9);move(b,z,6);advance(b,.8);assert.equal(own(receipts,u,e).length,0);assert.equal(own(receipts,u,z).length,1);assert.equal(own(receipts,u).length,1);}
});
test('normal and S2 CAST0 suppress target-free cached victims and never emit without a legal replacement',()=>{
 for(const skill of[0,1])for(const replacement of[false,true]){const{b,u,receipts}=make({skill}),e=enemy(b),z=replacement?enemy(b,{x:9}):null;if(skill){cast(b,u);advance(b,.2);}shot(b,u,e);advance(b,.1);b.addBuff(e,{key:'test:target-free',flags:{untargetable:true}});if(z)move(b,z,6);advance(b,.8);assert.equal(own(receipts,u,e).length,0);assert.equal(own(receipts,u).length,replacement?1:0);if(z)assert.equal(own(receipts,u,z).length,1);}
});
test('dead originalS1 input restoresone charge only before zeroemission; ordinarydeadInput has no spuriousrefund',()=>{
 const{b,u}=make(),e=enemy(b);cast(b,u);const charges=u.skill.charges;shot(b,u,e);b.kill(e);advance(b,.5);assert.equal(u.skill.charges,charges+1);u.skill.setSpTotal(0);const z=enemy(b);shot(b,u,z);b.kill(z);advance(b,.4);assert.equal(u.skill.charges,0);
});
test('accepted.001control cancels unbornS1 damage/SP grant while rejectedimmunecontrol preserves full family',()=>{
 for(const immune of[false,true]){const{b,u,deploy,receipts}=make(),a=deploy(CASTER,5,8);battery(b);advance(b,.4);b.addBuff(a,{key:'noSp',flags:{noSp:true}});a.skill.setSpTotal(0);if(immune)u.def.immune.add('stun');const e=enemy(b);cast(b,u);shot(b,u,e);advance(b,.1);b.applyStatus(u,'stun',{duration:.001});advance(b,.5);assert.equal(own(receipts,u,e).length,immune?1:0);near(a.skill.spTotal,immune?1:0);}
});
test('all10 S2 ranks apply exactATK/talentScale and additiveBAT+.5 independently from flat/percent/multiplier buckets',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u,deploy}=make({skill:1,rank}),a=deploy(CASTER,5,8),base=a.s.atk;battery(b);advance(b,.4);b.addBuff(u,{key:'foreignBAT',mods:{batFlat:.2,batPct:.25,batMul:.8}});cast(b,u);near(u.s.atk,u.base.atk*(1+bb(1,rank).atk));near(u.s.interval,(u.base.bat+.2+.5)*1.25*.8);near(a.s.atk,base+a.base.atk*tbb(u).atk*bb(1,rank).talent_scale);}
});
test('S2 effects are immediate but originalBegin.167 delaysnatural first attack and uses literalIdle/Loop/End',()=>{
 const{b,u,deploy}=make({skill:1}),a=deploy(CASTER,5,8),base=a.s.atk;battery(b);advance(b,.4);const e=enemy(b);cast(b,u);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Begin');near(a.s.atk,base+a.base.atk*tbb(u).atk*2);u.atkCd=0;advance(b,.1);assert.equal(u.stats.attacks,0);advance(b,.2);assert.equal(u.stats.attacks,1);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Idle');u.atkCd=1000;u.skill.end('test');assert.equal(u.mem.regularFormVisual.clip,'Skill_2_End');advance(b,.2);assert.equal(u.mem.regularFormVisual,null);assert.equal(e.hp,100000);
});
test('S2 ordinary single-victimdirect release uses exactSkill2Loop event withPhysical/NORMAL melee origin',()=>{
 for(const dir of['RIGHT','LEFT','UP','DOWN']){const{b,u,receipts}=make({skill:1,dir}),p={RIGHT:[6,5],LEFT:[4,5],UP:[5,6],DOWN:[5,4]}[dir],e=enemy(b,{x:p[0],y:p[1],def:200}),z=enemy(b,{x:p[0]+.05,y:p[1]+.05});cast(b,u);advance(b,.2);const atk=u.s.atk,wind=evidence.models[ID][['LEFT','UP'].includes(dir)?'Back':'Front'].hits.Skill_2_Loop[0]/Math.min(1,u.base.bat/u.s.interval);shot(b,u,e);advance(b,wind-b.dt);near(e.hp,100000);advance(b,2*b.dt);near(100000-e.hp,Math.max(atk-200,atk*.05));near(z.hp,100000);const r=own(receipts,u,e)[0];assert.equal(r.dmg.applyWay,'melee');assert.equal(r.dmg.isAttack,true);assert.equal(r.dmg.isSkill,true);}
});
test('normalS2 duration addsone battery cappeddeck3 without replacingdeployed devices or resetting redeploy clock',()=>{
 const{b,u}=make({skill:1}),t=battery(b);advance(b,.4);const before=card(b).stock,ready=card(b).readyAt;cast(b,u);advance(b,15+2*b.dt);assert.equal(card(b).stock,Math.min(3,before+1));near(card(b).readyAt,ready);assert.equal(t.alive,true);state(b).stock=3;cast(b,u);advance(b,15+2*b.dt);assert.equal(card(b).stock,3);
});
test('S2 effects/normalSP restoreat15 while realEnd.133 presentation doesnot fabricate another lock',()=>{
 const{b,u,deploy}=make({skill:1}),a=deploy(CASTER,5,8),base=a.s.atk;battery(b);advance(b,.4);cast(b,u);advance(b,15+b.dt);assert.equal(u.skill.active,false);near(u.s.atk,u.base.atk);near(u.s.interval,u.base.bat);near(a.s.atk,base+a.base.atk*tbb(u).atk);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_End');assert.ok(u.skill.spTotal>0);assert.equal(!!u.s.flags.disarm,false);advance(b,.2);assert.equal(u.mem.regularFormVisual,null);
});
test('earlyS2 finish/death/withdraw never restoresstock; unrelated shortcontrol preserves nonstunnable15sec mode',()=>{
 for(const reason of['interrupted','manual','death']){const{b,u}=make({skill:1});battery(b);advance(b,.4);const n=card(b).stock;cast(b,u);if(reason==='death')b.kill(u);else u.skill.end(reason);advance(b,.2);assert.equal(card(b).stock,n);}
 const{b,u}=make({skill:1});battery(b);advance(b,.4);const n=card(b).stock;cast(b,u);advance(b,.1);b.applyStatus(u,'stun',{duration:.001});advance(b,15.1);assert.equal(card(b).stock,Math.min(3,n+1));
});
test('battery deployed duringS2 joins selectedmode onlyafter its realbirth and reverts at ownerduration end',()=>{
 const{b,u,deploy}=make({skill:1}),a=deploy(CASTER,5,8),base=a.s.atk;cast(b,u);advance(b,2);const t=battery(b);advance(b,.3);near(a.s.atk,base);advance(b,.1);near(a.s.atk,base+a.base.atk*tbb(u).atk*2);advance(b,13);assert.equal(u.skill.active,false);near(a.s.atk,base+a.base.atk*tbb(u).atk);assert.equal(t.alive,true);
});
test('batteryfiniteE0 lifetime20 differs E1/E2 lifetime30 and never returns spentstock on expiry',()=>{
 for(const elite of[0,1,2]){const{b,u,deploy}=make({elite,rank:[4,7,10][elite]}),a=deploy(CASTER,5,8),t=battery(b),n=card(b).stock;advance(b,.4);assert.ok(a.findBuff(`windft_wrench_t:${t.id}`));advance(b,tbb(u).duration-.1);assert.equal(t.alive,true);advance(b,.1);assert.equal(t.alive,false);assert.equal(card(b).stock,n);assert.equal(a.findBuff(`windft_wrench_t:${t.id}`),null);}
});
test('manual batteryretreat refunds0 and never chargesreplacement or resets originalcard cooldown',()=>{
 const{b}=make(),t=battery(b),dp=b.dp,n=card(b).stock,ready=card(b).readyAt;retreatRegularSummon(b,summonUnitId(t));assert.equal(t.alive,false);near(b.dp,dp);assert.equal(card(b).stock,n);near(card(b).readyAt,ready);
});
test('max2 native simultaneousbattery cap rejects third despite remainingfinite stock',()=>{
 const{b}=make();battery(b);readyNext(b);battery(b,5,9,'LEFT');assert.equal(card(b).stock,1);state(b).readyAt=b.time;assert.equal(summonPlacementError(b,summonCardId(ID),6,8),'Summon deployment limit reached.');
});
test('ownerwithdraw removesallbatteries/onlytheirauras and freshownerdeployment refreshes selectedstock',()=>{
 const{b,u,deploy}=make(),a=deploy(CASTER,5,8),t=battery(b);advance(b,.4);readyNext(b);const z=battery(b,5,9,'LEFT');advance(b,.4);b.addBuff(a,{key:'foreign',mods:{atkPct:.2}});b.retreatOperator(ID);assert.equal(t.alive,false);assert.equal(z.alive,false);assert.equal(a.findBuff(`windft_wrench_t:${t.id}`),null);assert.equal(a.findBuff(`windft_wrench_t:${z.id}`),null);assert.ok(a.findBuff('foreign'));advance(b,100);const fresh=deploy();assert.notEqual(fresh,u);assert.equal(card(b).owner,fresh);assert.equal(card(b).stock,3);near(card(b).readyAt,b.time);
});
test('ownerhidden retains structuralactivemode while devicecontrol doesnotdetach nonstunnableATKaura',()=>{
 const{b,u,deploy}=make({skill:1}),a=deploy(CASTER,5,8),base=a.s.atk,t=battery(b);advance(b,.4);cast(b,u);u.hidden=true;b.applyStatus(t,'stun',{duration:1});advance(b,.1);near(a.s.atk,base+a.base.atk*tbb(u).atk*2);advance(b,15);assert.equal(u.skill.active,false);near(a.s.atk,base+a.base.atk*tbb(u).atk);assert.equal(t.alive,true);
});
test('absentfabricated/outofsource battery recordsfailclosed and ownerselected skillsremainstrict',()=>{
 const{build}=make(),tokens=structuredClone(data.tokens);delete tokens[TOKEN];assert.throws(()=>summonRecordFor(ID,build,tokens),/Missing reviewed/);assert.throws(()=>summonRecordFor(ID,{...build,elite:3},data.tokens),/promotion/);assert.equal(REGULAR_SUMMONS[ID].refundRatio,0);assert.equal(REGULAR_SUMMONS[ID].noAttack,true);assert.equal(REGULAR_SUMMONS[ID].chooseFacing,true);
});
