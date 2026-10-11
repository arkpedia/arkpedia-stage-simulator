// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import evidence from '../data/arkpedia-five-star-medic-fourth-prefabs.json' with {type:'json'};
import {FIVE_STAR_MEDIC_FOURTH_OPERATORS} from '../shared/arkpedia/five-star-medic-fourth-operators.js';
import {summonCardId,summonUnitId} from '../shared/arkpedia/summons.js';
import {regularSummonCards,deployRegularSummon,retreatRegularSummon,summonPlacementError} from '../server/sim/content/arkpedia-summons.js';
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild} from '../shared/arkpedia/loadout.js';
import {acquireTargets,effectiveProfile} from '../server/sim/ai.js';
import {canTargetAlly} from '../server/sim/targeting.js';
import {installFiveStarMedicFourth} from '../server/sim/content/arkpedia-five-star-medic-fourth.js';
const SIL='char_108_silent',VEN='char_494_vendla',FAN='char_123_fang',BEA='char_122_beagle',KRO='char_124_kroos',GAV='char_187_ccheal',VUL='char_163_hpsts';
const near=(a,e,t=1e-5)=>assert.ok(Math.abs(a-e)<t,`${a} != ${e}`);
const advance=(b,s)=>{for(let n=0;n<Math.round(s/b.dt);n++)b.step();assert.deepEqual(b.errors,[]);};
const bb=(id,s,rank=10)=>Object.fromEntries(data.operators[id].skills[s].levels[rank-1].blackboard.map(x=>[x.key,x.value]));
function build(id,{skill=0,rank=10,elite=2,potential=1}={}){const o=data.operators[id];assert.ok(o,`Reviewed snapshot required ${id}`);return{...defaultBuild(o),elite,level:o.phases[elite].maxLevel,potential,skillId:o.skills[skill].id,skillRank:rank};}
function make(id,{skill=0,rank=10,elite=2,potential=1,others=[]}={}){const source=structuredClone(data);source.stage.geometry.waves[0].spawns=[];source.stage.battle.dp_per_second=0;const b=new StandardBattle(source,{operators:[build(id,{skill,rank,elite,potential}),...others.map(x=>typeof x==='string'?defaultBuild(source.operators[x]):x)]});b.autoFinish=false;b.setViewport('fullscreen-workspace');const deploy=(who=id,r=1,c=4,dir='UP')=>{b.addDp('arkpedia',99);const u=b.deployOperator(who,r,c,dir);assert.ok(u);u.atkCd=1000;return u;};return{b,deploy};}
const wound=(u,hp=100,max=100000)=>{u.base.maxHp=max;u.markDirty();void u.s;u.hp=hp;};
function cast(b,u){u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.manual?b.activateOperator(u.defId):u.skill.activate('test'),true);u.atkCd=1000;}
function enemy(b,x=4,y=2){const e=b.spawnEnemy('enemy_1007_slime',{routeIndex:1});e.x=x;e.y=y;e.base.maxHp=100000;e.base.def=e.base.res=e.base.moveSpeed=0;e.markDirty();void e.s;e.hp=100000;b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;}
const row=(rows,id)=>rows.find(r=>r.pathId===id).data;

test('original source evidence preserves exact selectors, continuous drone and model events with honest clock limits',()=>{
 for(const[id,cfg]of Object.entries(FIVE_STAR_MEDIC_FOURTH_OPERATORS)){assert.equal(cfg.skillIds.length,2);assert.match(evidence.sourceBundles.find(x=>x.path===`charpack/${id}.ab`).sha256,/^[a-f0-9]{64}$/);for(const face of['Front','Back'])assert.match(evidence.models[id][face].sha256,/^[a-f0-9]{64}$/);}
 assert.equal(row(evidence.characters[SIL],'-253045890907916978')._targetOptions.professionMask,8);
 assert.equal(row(evidence.characters[VEN],'3393556555833009049')._ignoreAllyTargetFree,1);
 assert.equal(row(evidence.tokens.token_10000_silent_healrb,'1257144170709166485')._isCont,1);
 assert.equal(row(evidence.tokens.token_10000_silent_healrb,'-61191816510330475')._category,2);
 assert.equal(evidence.models[SIL].Front.hits.Attack[0],.8);assert.equal(evidence.models[VEN].Back.hits.Skill[0],.167);assert.equal(evidence.frameParity,false);assert.ok(evidence.runtimeMapping.limits.some(x=>x.includes('continuous')));
});

test('all four selected skills retain every source rank and promotion gates without fallback installers',()=>{
 for(const[id,cfg]of Object.entries(FIVE_STAR_MEDIC_FOURTH_OPERATORS))for(let skill=0;skill<2;skill++)for(let rank=1;rank<=10;rank++){const{b,deploy}=make(id,{skill,rank}),u=deploy();assert.equal(u.skill.id,cfg.skillIds[skill]);assert.equal(u.skill.noSkill,false);assert.deepEqual(b.errors,[]);}
 const{b,deploy}=make(SIL,{elite:0,rank:4});deploy();assert.equal(regularSummonCards(b).length,0);
});

test('Silence heals at original capped attack event then source speed5 flight, without duplicated heals',()=>{
 for(const dir of['UP','RIGHT']){const{b,deploy}=make(SIL,{others:[FAN]}),u=deploy(SIL,1,4,dir),a=deploy(FAN,2,3);u.dir='UP';b._refreshRange(u);wound(a);b.forceAttack(u,[a]);advance(b,.75);near(a.hp,100);advance(b,.1);near(a.hp,100);advance(b,.35);near(a.hp-100,u.s.atk);assert.equal(u.stats.attacks,1);}
});

test('Silence source projectile survives source withdrawal but rejects newly isolated and heal-free recipients',()=>{
 for(const blocked of[null,'isolated','healFree']){const{b,deploy}=make(SIL,{others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a);const atk=u.s.atk;b.forceAttack(u,[a]);advance(b,.85);if(blocked)b.addBuff(a,{key:'test:blocked',flags:{[blocked]:true}});b.retreat(u);advance(b,.5);near(a.hp-100,blocked?0:atk);}
});

test('Silence S1 selected ATK percentages apply and end at all ten source ranks',()=>{
 for(let rank=1;rank<=10;rank++){const{b,deploy}=make(SIL,{rank}),u=deploy();cast(b,u);near(u.s.atk,u.base.atk*(1+bb(SIL,0,rank).atk));u.skill.end('duration');near(u.s.atk,u.base.atk);}
});

test('Silence global MEDIC aura uses source promotion and potential values, no device or non-Medic boost',()=>{
 for(const[elite,potential,value]of[[0,1,0],[1,1,6],[1,5,8],[2,1,12],[2,5,14]]){const{b,deploy}=make(SIL,{elite,potential,rank:[4,7,10][elite],others:[GAV,FAN]}),u=deploy(),a=deploy(GAV,1,3),z=deploy(FAN,2,5);b.addBuff(a,{key:'test:noHeal',flags:{noHeal:true}});advance(b,.05);near(u.s.aspd,u.base.aspd+value);near(a.s.aspd,a.base.aspd+value);near(z.s.aspd,z.base.aspd);b.addBuff(a,{key:'test:isolate',flags:{isolated:true}});advance(b,.05);near(a.s.aspd,a.base.aspd);b.removeBuff(a,'test:isolate');advance(b,.05);b.retreat(u);near(a.s.aspd,a.base.aspd);}
});

test('Silence shared ASPD aura retains only strongest source and restores weaker live producer',()=>{
 const{b,deploy}=make(SIL,{others:[GAV,FAN]}),u=deploy(),a=deploy(GAV,1,3),second=deploy(FAN,2,5);const def=structuredClone(u.def);def.charId=SIL;def.talents[0].bb.attack_speed=14;installFiveStarMedicFourth({battle:b,unit:second,def});advance(b,.05);near(a.s.aspd,a.base.aspd+14);assert.equal(a.buffs.filter(x=>x.key==='silent_t_1').length,1);b.retreat(second);near(a.s.aspd,a.base.aspd+12);b.retreat(u);near(a.s.aspd,a.base.aspd);
});

test('Silence S2 normal recharge caps stock1 and pauses SP until card deployment at all source ranks',()=>{
 for(let rank=1;rank<=10;rank++){const{b,deploy}=make(SIL,{skill:1,rank}),u=deploy(),key=summonCardId(SIL);assert.equal(regularSummonCards(b)[0].stock,0);cast(b,u);assert.equal(regularSummonCards(b)[0].stock,1);near(u.skill.spTotal,0);advance(b,2);near(u.skill.spTotal,0);assert.equal(u.skill.castEligible,false);deployRegularSummon(b,key,2,3);assert.equal(Boolean(u.s.flags.noSp),false);advance(b,1);near(u.skill.spTotal,1);}
});

test('Silence S2 natural time SP refills once after exactly selected cost and does not create a second stock',()=>{
 const{b,deploy}=make(SIL,{skill:1}),u=deploy();advance(b,17.9);assert.equal(regularSummonCards(b)[0].stock,0);advance(b,.15);assert.equal(regularSummonCards(b)[0].stock,1);assert.equal(u.skill.activations,1);advance(b,20);assert.equal(regularSummonCards(b)[0].stock,1);assert.equal(u.skill.activations,1);
});

test('drone owns source level keyframes without owner trust, DP5, zero slots, device category and no attacks',()=>{
 for(const[elite,atk]of[[1,90],[2,125]]){const{b,deploy}=make(SIL,{skill:1,elite,rank:elite===1?7:10}),u=deploy(),slots=b.deployedSlots();cast(b,u);const before=b.dp,t=deployRegularSummon(b,summonCardId(SIL),2,3);near(before-b.dp,5);near(t.s.atk,atk);near(t.s.maxHp,1000);near(t.s.blockCnt,0);near(t.s.interval,.5);assert.equal(t.kind,'device');assert.equal(b.deployedSlots(),slots);assert.equal(t.profile.canAttack(b,t),false);assert.equal(t.skill.noSkill,true);const e=enemy(b);assert.equal(canTargetAlly(e,t,true),false);advance(b,1);assert.equal(t.stats.attacks,0);near(t.s.aspd,100);}
});

test('drone source ALL placement allows ranged ground but keeps occupied tile, stock and redeploy limits',()=>{
 const{b,deploy}=make(SIL,{skill:1}),u=deploy();cast(b,u);const key=summonCardId(SIL),t=deployRegularSummon(b,key,1,3);assert.equal(t.ground,false);assert.equal(regularSummonCards(b)[0].deployed,1);cast(b,u);assert.equal(summonPlacementError(b,key,2,3),'Summon is still redeploying.');advance(b,5.1);assert.equal(summonPlacementError(b,key,2,3),'Summon deployment limit reached.');const before=b.dp;retreatRegularSummon(b,summonUnitId(t));near(b.dp-before,2);assert.equal(regularSummonCards(b)[0].deployed,0);assert.equal(summonPlacementError(b,key,1,4),'Tile is occupied.');
});

test('drone continuous healing covers all injured x4 beneficiaries, source BAT and ordinary heal restrictions',()=>{
 const{b,deploy}=make(SIL,{skill:1,others:[FAN,BEA,KRO,VUL]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5),k=deploy(KRO,1,3),v=deploy(VUL,3,3);for(const q of[a,z,k,v])wound(q);cast(b,u);const t=deployRegularSummon(b,summonCardId(SIL),2,4);advance(b,1);for(const q of[a,z,k])near(q.hp-100,t.s.atk/t.s.interval);near(v.hp,100);b.addBuff(z,{key:'test:isolate',flags:{isolated:true}});b.addBuff(k,{key:'test:healFree',flags:{healFree:true}});const zh=z.hp,kh=k.hp,ah=a.hp;advance(b,.5);near(a.hp-ah,125);near(z.hp,zh);near(k.hp,kh);a.x=10;advance(b,.5);near(a.hp-ah,125);
});

test('drone source expiry is ten seconds without refund or healing afterward, with explicit adapter boundary',()=>{
 const{b,deploy}=make(SIL,{skill:1,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a);cast(b,u);const t=deployRegularSummon(b,summonCardId(SIL),2,4),dp=b.dp;advance(b,9.9);assert.equal(t.alive,true);near(a.hp,2575);advance(b,.1);near(a.hp,2600);advance(b,b.dt);assert.equal(t.alive,false);near(a.hp,2600);near(b.dp,dp);advance(b,1);near(a.hp,2600);
});

test('Silence withdrawal removes category-device drone, disables old card, and resets recharge stock on redeploy',()=>{
 const{b,deploy}=make(SIL,{skill:1}),u=deploy();cast(b,u);const t=deployRegularSummon(b,summonCardId(SIL),2,3);cast(b,u);assert.equal(regularSummonCards(b)[0].stock,1);b.retreatOperator(SIL);assert.equal(t.alive,false);assert.equal(regularSummonCards(b)[0].available,false);advance(b,u.base.respawnTime+.1);b.addDp('arkpedia',99);const next=b.deployOperator(SIL,1,4,'UP');next.atkCd=1000;assert.equal(regularSummonCards(b)[0].stock,0);near(next.skill.spTotal,0);
});

test('Vendela normal source Arts projectile produces only one accepted-output trait heal',()=>{
 const{b,deploy}=make(VEN,{others:[FAN]}),u=deploy(),a=deploy(FAN,2,3),e=enemy(b);wound(a);const atk=u.s.atk;b.forceAttack(u,[e]);advance(b,.55);near(a.hp,100);near(e.hp,100000);advance(b,.2);near(100000-e.hp,atk);near(a.hp-100,atk*.5*1.15);assert.equal(u.stats.attacks,1);
});

test('Vendela trait uses mitigated calculated output rather than actual overkill HP delta, excludes elemental and HP loss',()=>{
 const{b,deploy}=make(VEN,{others:[FAN]}),u=deploy(),a=deploy(FAN,2,3),e=enemy(b);wound(a);advance(b,.05);e.base.res=25;e.markDirty();e.hp=10;b.dealDamage(u,e,{amount:400,type:'arts'});near(a.hp-100,150*1.15);const z=enemy(b),hp=a.hp;b.loseHp(z,100,{source:u});b.dealDamage(u,z,{amount:100,type:'element',element:'burn'});near(a.hp,hp);
});

test('Vendela trait heal chooses lowest HP ratio, rejects isolation and unhealable targets, independent of talent marking',()=>{
 const{b,deploy}=make(VEN,{others:[FAN,BEA,VUL]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5),v=deploy(VUL,3,3),e=enemy(b);wound(v);wound(a,200);wound(z,100,90000);b.addBuff(z,{key:'test:isolate',flags:{isolated:true}});b.dealDamage(u,e,{amount:100,type:'arts'});near(a.hp,250);near(z.hp,100);near(v.hp,100);
});

test('Vendela incoming heal talent follows live highest MaxHP and original promotion/potential scales',()=>{
 for(const[elite,potential,scale]of[[0,1,1],[1,1,1.08],[1,5,1.11],[2,1,1.15],[2,5,1.18]]){const{b,deploy}=make(VEN,{elite,potential,rank:[4,7,10][elite],others:[FAN,BEA]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5);wound(a);wound(z,100,90000);advance(b,.05);near(a.s.healingTakenMul,scale);near(z.s.healingTakenMul,1);z.base.maxHp=110000;z.markDirty();advance(b,.05);near(a.s.healingTakenMul,1);near(z.s.healingTakenMul,scale);b.retreat(u);near(z.s.healingTakenMul,1);}
});

test('Vendela non-HEAL talent retains highest MaxHP unhealable or isolated recipients and excludes source devices',()=>{
 const{b,deploy}=make(VEN,{others:[VUL,FAN]}),u=deploy(),v=deploy(VUL,2,3),a=deploy(FAN,2,5);wound(v);b.addBuff(v,{key:'test:untargetable',flags:{untargetable:true,isolated:true}});advance(b,.05);near(v.s.healingTakenMul,1.15);near(a.s.healingTakenMul,1);const hp=v.hp;near(b.heal(u,v,100),0);near(v.hp,hp);
});

test('Vendela shared healing talent picks strongest producer and restores lower live source without stacking',()=>{
 const{b,deploy}=make(VEN,{others:[FAN,BEA]}),u=deploy(),a=deploy(FAN,2,3),second=deploy(BEA,2,5);wound(a);const def=structuredClone(u.def);def.charId=VEN;def.talents[0].bb.heal_scale=1.18;second.rangeGrid=structuredClone(u.rangeGrid);second.dir=u.dir;second.tileR=u.tileR;second.tileC=u.tileC;second.x=u.x;second.y=u.y;b._refreshRange(second);installFiveStarMedicFourth({battle:b,unit:second,def});advance(b,.05);near(a.s.healingTakenMul,1.18);assert.equal(a.buffs.filter(x=>x.key==='vendla_t_1').length,1);b.retreat(second);near(a.s.healingTakenMul,1.15);b.retreat(u);near(a.s.healingTakenMul,1);
});

test('Vendela S1 is actual source ASPD addition at every rank and does not accidentally buff ATK',()=>{
 for(let rank=1;rank<=10;rank++){const{b,deploy}=make(VEN,{rank}),u=deploy();cast(b,u);near(u.s.aspd,u.base.aspd+bb(VEN,0,rank).attack_speed);near(u.s.atk,u.base.atk);u.skill.end('duration');near(u.s.aspd,u.base.aspd);}
});

test('Vendela S2 mark waits original Skill event, source taunt1, ATK process waits complete clip and cleans up',()=>{
 for(let rank=1;rank<=10;rank++){const{b,deploy}=make(VEN,{skill:1,rank,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a);cast(b,u);advance(b,.15);assert.equal(a.findBuff('vendla_s_2'),null);near(u.s.atk,u.base.atk);advance(b,.05);near(a.s.taunt,(a.base.taunt??0)+1);near(u.s.atk,u.base.atk);advance(b,.35);near(u.s.atk,u.base.atk*(1+bb(VEN,1,rank).atk));assert.equal(Boolean(u.s.flags.disarm),false);u.skill.end('duration');near(a.s.taunt,a.base.taunt??0);near(u.s.atk,u.base.atk);assert.equal(u.mem.regularFormVisual,null);}
});

test('Vendela S2 predelay remembers brief stun and cancels mark/process despite control ending before release',()=>{
 const{b,deploy}=make(VEN,{skill:1,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a);cast(b,u);advance(b,.05);b.applyStatus(u,'stun',{duration:.05});advance(b,.6);assert.equal(u.skill.active,false);assert.equal(a.findBuff('vendla_s_2'),null);near(u.s.atk,u.base.atk);assert.equal(u.mem.regularFormVisual,null);
});

test('Vendela sub-tick startup control clears pending state without deleting an already released mark',()=>{
 for(const status of['stun','freeze','sleep','levitate']){
  const{b,deploy}=make(VEN,{skill:1,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a);cast(b,u);
  advance(b,.05);b.applyStatus(u,status,{duration:.001});advance(b,.6);
  assert.equal(u.canAct,true);assert.equal(u.skill.active,false);assert.equal(u.findBuff('vendela:cast'),null);
  assert.equal(a.findBuff('vendla_s_2'),null);near(u.s.atk,u.base.atk);assert.equal(u.mem.regularFormVisual,null);
  cast(b,u);advance(b,.25);const marker=a.findBuff('vendla_s_2');assert.ok(marker);
  b.applyStatus(u,status,{duration:.001});advance(b,.4);assert.equal(a.findBuff('vendla_s_2'),marker);
  assert.equal(u.skill.active,true);near(u.s.atk,u.base.atk*(1+bb(VEN,1).atk));
 }
});

test('Vendela S2 source enemy damage causes Arts counter and trait heal exclusively to marked in-range recipient',()=>{
 const{b,deploy}=make(VEN,{skill:1,others:[FAN,BEA]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5),e=enemy(b,5,2);wound(a,1000);wound(z,100,90000);cast(b,u);advance(b,.55);const atk=u.s.atk,hp=a.hp,zh=z.hp;let counter=null;b.on('damaged',ctx=>{if(ctx.dmg?.tags.includes('vendela:s2-counter'))counter=ctx;});b.dealDamage(e,a,{amount:100,type:'arts',isAttack:true});near(100000-e.hp,atk*.5);near(a.hp,hp-100+atk*.25*1.15);near(z.hp,zh);assert.equal(counter.dmg.applyWay,'ranged');b.dealDamage(e,a,{amount:100,type:'arts',isAttack:false});near(100000-e.hp,atk);a.x=10;const moved=a.hp;b.dealDamage(e,a,{amount:100,type:'arts'});near(a.hp,moved-100);near(100000-e.hp,atk*1.5);
});

test('Vendela counter ignores dodged damage and HP loss but accepted shielded hits retain source counter',()=>{
 const{b,deploy}=make(VEN,{skill:1,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3),e=enemy(b);wound(a,10000);cast(b,u);advance(b,.55);b.addBuff(a,{key:'test:dodge',mods:{dodgeArts:1}});b.dealDamage(e,a,{amount:100,type:'arts'});near(e.hp,100000);b.removeBuff(a,'test:dodge');b.loseHp(a,100,{source:e});near(e.hp,100000);b.addBuff(a,{key:'test:shield',shield:1000});b.dealDamage(e,a,{amount:100,type:'arts',canDodge:false});near(100000-e.hp,u.s.atk*.5);
});

test('Vendela mark is source-derived parent lifetime and withdraw cleanup, does not remove foreign buffs',()=>{
 const{b,deploy}=make(VEN,{skill:1,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a);b.addBuff(a,{key:'foreign:taunt',mods:{taunt:2}});cast(b,u);advance(b,.55);near(a.s.taunt,(a.base.taunt??0)+3);b.retreat(u);near(a.s.taunt,(a.base.taunt??0)+2);assert.ok(a.findBuff('foreign:taunt'));assert.equal(a.findBuff('vendla_s_2'),null);near(a.s.healingTakenMul,1);
});
