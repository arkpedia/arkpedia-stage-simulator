// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test'; import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-senshi-prefabs.json' with { type: 'json' };
import { SENSHI_OPERATORS } from '../shared/arkpedia/senshi-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, acquireTargets } from '../server/sim/ai.js';
const ID='char_4143_sensi',GUARD='char_208_melan',ALLY='char_103_angel',NEARL='char_148_nearl';
const near=(a,z,e=1e-5)=>assert.ok(Math.abs(a-z)<e,`${a} != ${z}`);
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function make({skill=0,rank=10,elite=2,dir='RIGHT',extra=[],defer=false}={}){
 const d=structuredClone(data),o=d.operators[ID];assert.ok(o);
 d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;d.stage.geometry.rows=19;d.stage.geometry.cols=21;d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
 const build={...defaultBuild(o),elite,level:o.phases[elite].maxLevel,trust:0,potential:1,skillId:o.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
 const b=new StandardBattle(d,{operators:[build,...[...new Set([GUARD,ALLY,...extra])].map(id=>defaultBuild(d.operators[id]))]});
 b.autoFinish=false;b.setViewport('fullscreen-workspace');b.recordEvents=true;b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));b.addDp('arkpedia',99);
 const deploy=(id=ID,r=5,c=5,f=dir)=>{b.addDp('arkpedia',99);const a=b.deployOperator(id,r,c,f);assert.ok(a);a.atkCd=1000;if(a.skill)a.skill.rule='NEVER';return a;};
 const heals=[];b.on('heal',x=>heals.push({...x,time:b.time}));
 return{b,u:defer?null:deploy(),build,deploy,heals};
}
function cast(b,u,recipe='atk'){b.rng.pick=xs=>xs.includes(recipe)?recipe:xs[0];u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.activate('test'),true);u.atkCd=1000;}
function enemy(b,{x=5,y=5,fly=false}={}){const e=b.spawnEnemy('enemy_1007_slime',{pos:[y,x]});Object.assign(e.base,{maxHp:100000,def:0,res:0,moveSpeed:0});if(fly)e.motion='FLY';e.markDirty();void e.s;e.hp=100000;b.addBuff(e,{key:'test:pin',flags:{disarm:true,noMove:true}});b._buildEnemyIndex();return e;}
const bb=(s,r=10)=>Object.fromEntries(data.operators[ID].skills[s].levels[r-1].blackboard.map(x=>[x.key,x.value]));
const food=a=>a.buffs.filter(x=>x.key.startsWith('sensi_s_1[')&&x.key.endsWith('_attribute]'));
function injure(a,n=2000){a.hp=Math.max(1,a.hp-n);}

test('five original bundles, seven templates, all20 ranks and literal Front/Back hit clocks',()=>{
 assert.deepEqual(Object.keys(SENSHI_OPERATORS),[ID]);assert.equal(evidence.source.bundles.length,5);assert.equal(Object.keys(evidence.templates).length,7);assert.equal(Object.values(evidence.tables.skills).flatMap(s=>s.levels).length,20);assert.equal(evidence.frameParity,false);
 for(const face of['Front','Back']){const m=evidence.models[ID][face];assert.equal(m.sha256,evidence.officialSkeletonBindings[ID][face].sha256);near(m.hits.Attack[0],.467);near(m.hits.Skill_1[0],2.6);near(m.hits.Skill_2[0],9.3);near(m.durations.Skill_1,3);near(m.durations.Skill_2,10);}
 assert.deepEqual(evidence.projectiles,[]);
});
test('all20 skill ranks retain source duration/SP and complete healing effects',()=>{
 for(let skill=0;skill<2;skill++)for(let rank=1;rank<=10;rank++){const{b,u,deploy}=make({skill,rank}),a=deploy(GUARD,5,6),x=bb(skill,rank);a.base.maxHp=100000;a.markDirty();void a.s;a.hp=1;cast(b,u);assert.equal(u.skill.kind,'duration');near(u.skill.timeLeft,skill?10:3);assert.equal(u.s.flags.disarm,true);advance(b,skill?9.35:2.65);
  const amount=u.s.atk*1.1*(skill?10*x.tick_heal_scale+x.heal_scale:x.heal_scale);near(a.hp,1+amount);if(!skill)near(a.s.atk,a.base.atk*(1.08+x.atk));near(u.skill.spTotal,0);
 }
});
test('E0/E1/E2 source talent DEF/healing applies once and healing modifiers compose',()=>{
 for(const elite of[0,1,2]){const{b,u,deploy}=make({elite}),a=deploy(GUARD,5,6),scale=[1,1.05,1.1][elite];near(u.s.def,u.base.def*(1+[0,.05,.1][elite]));near(u.s.healingDealtMul,scale);a.base.maxHp=100000;a.markDirty();void a.s;a.hp=1;b.addBuff(a,{key:'received',mods:{healingTakenMul:1.5}});cast(b,u);advance(b,2.65);near(a.hp,1+u.s.atk*bb(0,Math.min(10,[4,7,10][elite])).heal_scale*scale*1.5);}
});
test('normal single Physical ground attack hits once at original .467 and not a second blocked enemy',()=>{
 const{b,u}=make(),a=enemy(b),z=enemy(b,{x:5.1}),fly=enemy(b,{x:5.2,fly:true});const before=[a.hp,z.hp,fly.hp];assert.equal(b.forceAttack(u,[a]),true);u.atkCd=1000;advance(b,.44);near(a.hp,before[0]);advance(b,.1);near(a.hp,before[0]-u.s.atk);near(z.hp,before[1]);near(fly.hp,before[2]);assert.equal(u.profile.maxTargets,1);assert.equal(u.profile.canHitFly,false);assert.equal(acquireTargets(b,u,effectiveProfile(u)).includes(fly),false);
});
test('normal attack native max animation scale1 stretches slowdown but never accelerates release',()=>{
 for(const aspd of[50,100,300]){const{b,u}=make(),e=enemy(b);b.addBuff(u,{key:'speed',mods:{aspd:aspd-100}});const delay=.467/Math.min(1,aspd/100);b.forceAttack(u,[e]);u.atkCd=1000;advance(b,delay-.08);near(e.hp,100000);advance(b,.12);assert.ok(e.hp<100000);}
});
test('S1 cooking fixed3s and release2.6 is unaffected by ASPD; no normal attacks or SP during cook',()=>{
 for(const aspd of[50,300]){const{b,u,deploy}=make(),a=deploy(GUARD,5,6);injure(a);b.addBuff(u,{key:'speed',mods:{aspd:aspd-100}});cast(b,u);u.atkCd=0;const hp=a.hp;advance(b,2.55);near(a.hp,hp);near(u.skill.spTotal,0);assert.equal(u.stats.attacks,0);advance(b,.1);assert.ok(a.hp>hp);assert.equal(u.mem.regularFormVisual.clip,'Skill_1');advance(b,.4);assert.equal(u.skill.active,false);assert.equal(u.mem.regularFormVisual,null);assert.ok(u.skill.spTotal>0);}
});
test('all three equal-weight recipes are chosen once at caststart and buff the heal recipient',()=>{
 for(const recipe of['atk','atk_speed','max_hp']){const{b,u,deploy}=make(),a=deploy(GUARD,5,6),orig={atk:a.s.atk,aspd:a.s.aspd,hp:a.s.maxHp};injure(a,500);let rolls=0;b.rng.pick=xs=>{assert.deepEqual(xs,['atk','atk_speed','max_hp']);rolls++;return recipe;};u.skill.setSpTotal(u.skill.spCost);u.skill.activate('test');assert.equal(rolls,1);assert.equal(u.mem.senshiCooking.recipe,recipe);advance(b,2.65);assert.equal(food(a).length,1);assert.equal(food(a)[0].key,`sensi_s_1[${recipe}_attribute]`);near(a.s.atk,orig.atk+(recipe==='atk'?a.base.atk*.2:0));near(a.s.aspd,orig.aspd+(recipe==='atk_speed'?20:0));near(a.s.maxHp,orig.hp*(recipe==='max_hp'?1.25:1));assert.equal(rolls,1);}
});
test('S1 can buff a full-HP ally, heals self in x4, and ignores allies outside its square',()=>{
 const{b,u,deploy}=make(),a=deploy(GUARD,5,6),outside=deploy(ALLY,5,7);injure(u,500);injure(outside,500);cast(b,u,'atk_speed');advance(b,2.65);assert.ok(u.findBuff('sensi_s_1[atk_speed_attribute]'));assert.equal(food(outside).length,0);assert.equal(food(a).length,0);
 const hp=a.hp;u.skill.end('test');cast(b,u,'atk');advance(b,2.65);assert.ok(food(u).length||food(a).length);near(a.hp,hp);
});
test('S1 automatic readiness cooks without targets and does not refund spent SP',()=>{
 const{b,u}=make();b.addBuff(u,{key:'self-noheal',flags:{healFree:true}});u.skill.setSpTotal(u.skill.spCost);advance(b,.1);assert.equal(u.skill.active,true);assert.equal(u.skill.activations,1);advance(b,3);assert.equal(u.skill.active,false);assert.equal(u.skill.charges,0);assert.equal(food(u).length,0);
});
test('S1 release re-evaluates recipients; dead, moved and newly injured allies do not receive a stale heal',()=>{
 const{b,u,deploy}=make(),a=deploy(GUARD,5,6),z=deploy(ALLY,6,5);injure(a,1000);cast(b,u);a.tileR=8;a.y=8;injure(z,500);const hp=z.hp;advance(b,2.65);assert.ok(z.hp>hp);assert.equal(food(a).length,0);assert.equal(food(z).length,1);
});
test('S1 same food EXTEND never stacks; a different food removes other shared keys and survives owner retreat',()=>{
 const{b,u,deploy}=make(),a=deploy(GUARD,5,6);injure(a,1000);cast(b,u);advance(b,2.65);const f=food(a)[0];u.skill.end('test');injure(a,1000);cast(b,u);advance(b,2.65);assert.equal(food(a).length,1);assert.equal(food(a)[0],f);near(a.s.atk,a.base.atk*1.28);u.skill.end('test');injure(a,1000);cast(b,u,'atk_speed');advance(b,2.65);assert.equal(food(a).length,1);assert.ok(a.findBuff('sensi_s_1[atk_speed_attribute]'));assert.equal(a.findBuff('sensi_s_1[atk_attribute]'),null);b.retreatOperator(ID);assert.ok(a.findBuff('sensi_s_1[atk_speed_attribute]'));advance(b,8.1);assert.equal(food(a).length,0);
});
test('S2 first .15s then1s pulses and final9.3s meal, with no burst until original event',()=>{
 const{b,u,deploy}=make({skill:1}),a=deploy(GUARD,5,6);a.base.maxHp=100000;a.markDirty();void a.s;a.hp=1;cast(b,u);advance(b,.1);near(a.hp,1);advance(b,.1);near(a.hp,1+u.s.atk*.45*1.1);advance(b,.9);near(a.hp,1+u.s.atk*.45*1.1);advance(b,.1);near(a.hp,1+u.s.atk*.45*1.1*2);advance(b,8.05);near(a.hp,1+u.s.atk*.45*1.1*10);advance(b,.1);near(a.hp,1+u.s.atk*1.1*(4.5+1.8));advance(b,.9);assert.equal(u.skill.active,false);const hp=a.hp;advance(b,.9);near(a.hp,hp);
});
test('S2 pulse uses liveATK/outgoing and recipient healing scales, not activation snapshots',()=>{
 const{b,u,deploy}=make({skill:1}),a=deploy(GUARD,5,6);a.base.maxHp=100000;a.markDirty();void a.s;a.hp=1;cast(b,u);advance(b,.2);const first=a.hp-1;b.addBuff(u,{key:'changed',mods:{atkPct:1}});b.addBuff(a,{key:'received',mods:{healingTakenMul:2}});advance(b,1);near(a.hp,1+first+4*first);
});
test('S2 periodic ordinaryprofession filter excludes summons, while final native HealAbility can heal eligible tokens',()=>{
 const{b,u,deploy}=make({skill:1}),a=deploy(GUARD,5,6);a.kind='token';injure(a,1000);const hp=a.hp;cast(b,u);advance(b,9.2);near(a.hp,hp);advance(b,.15);assert.ok(a.hp>hp);assert.equal(food(a).length,0);
});
test('healing target gates include stealth/camouflage but exclude healFree/noHeal/isolation/free/hidden',()=>{
 for(const flag of['healFree','noHeal','isolated','untargetable','hidden','stealth','camou']){const{b,u,deploy}=make({skill:1}),a=deploy(GUARD,5,6);injure(a,1000);const hp=a.hp;if(flag==='hidden')a.hidden=true;else b.addBuff(a,{key:'gate',flags:{[flag]:true}});cast(b,u);advance(b,9.35);if(['stealth','camou'].includes(flag))assert.ok(a.hp>hp);else near(a.hp,hp);}
});
test('S2 heals all full/injured recipients in x4 without giving ordinary allies SP',()=>{
 const{b,u,deploy}=make({skill:1}),a=deploy(GUARD,5,6),z=deploy(ALLY,6,5);injure(a,1000);z.skill.setSpTotal(0);b.addBuff(z,{key:'no-natural',mods:{spRecoveryMul:0}});cast(b,u);advance(b,9.35);assert.ok(a.hp>a.s.maxHp-1000);near(z.skill.spTotal,0);assert.equal(food(a).length,0);assert.equal(food(z).length,0);
});
test('native Mana action binds only Marcille, even at full HP; blocked SP remains blocked',()=>{
 for(const blocked of[false,true]){const{b,u,deploy}=make({skill:1}),a=deploy(ALLY,5,6);a.def={...a.def,charId:'char_4141_marcil'};a.skill.setSpTotal(0);b.addBuff(a,{key:'no-natural',mods:{spRecoveryMul:0},flags:blocked?{noSp:true}:null});cast(b,u);advance(b,9.35);near(a.skill.spTotal,blocked?0:Math.min(10,a.skill.spCost));assert.equal(data.operators.char_4141_marcil,undefined);}
 const tree=evidence.templates['sensi_s_2[recover_magic]'].eventToActions.ON_BUFF_START[0];assert.deepEqual(tree._conditionNode._characterKeys,['char_4141_marcil']);assert.equal(tree._succeedNodes.find(n=>n.$type.includes('ModifySp'))._spString,'magic_sp');
});
test('brief control permanently interrupts unreleased meal and later ticks; no ghost after stun expires',()=>{
 for(const skill of[0,1])for(const status of['stun','freeze','sleep','levitate','disarm']){const{b,u,deploy}=make({skill}),a=deploy(GUARD,5,6);injure(a,1000);cast(b,u);advance(b,.2);b.addBuff(u,{key:'control',duration:.01,flags:{[status]:true}});const hp=a.hp;advance(b,4);assert.equal(u.skill.active,false);near(a.hp,hp);assert.equal(u.mem.regularFormVisual,null);assert.equal(food(a).length,0);}
});
test('source retreat/death cancels cooking while prior recipient food survives; redeploy has fresh cast clocks',()=>{
 for(const mode of['retreat','death']){const{b,u,deploy}=make({skill:1}),a=deploy(GUARD,5,6);injure(a,1000);cast(b,u);advance(b,.2);const hp=a.hp;if(mode==='retreat')b.retreatOperator(ID);else b.kill(u,null);advance(b,10);near(a.hp,hp);assert.equal(u.mem.senshiCooking,null);advance(b,90);const z=deploy();cast(b,z);advance(b,.2);assert.ok(a.hp>hp);}
});
test('pending ordinary attack is cancelled by cooking, and fixed build stats/range return at completion',()=>{
 const{b,u}=make({skill:1}),e=enemy(b),range=[...u.rangeKeys],hp=u.s.maxHp,def=u.s.def;b.forceAttack(u,[e]);cast(b,u);advance(b,10.1);near(e.hp,100000);assert.equal(!!u.s.flags.disarm,false);near(u.s.maxHp,hp);near(u.s.def,def);assert.deepEqual(u.rangeKeys,range);assert.equal(u.s.blockCnt,3);assert.equal(u.mem.regularFormVisual,null);
});
