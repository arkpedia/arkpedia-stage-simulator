// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import evidence from '../data/arkpedia-saria-prefabs.json' with {type:'json'};
import {SARIA_OPERATORS} from '../shared/arkpedia/saria-operators.js';
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild} from '../shared/arkpedia/loadout.js';
import {acquireTargets,effectiveProfile} from '../server/sim/ai.js';
import {installSaria} from '../server/sim/content/arkpedia-saria.js';
const ID='char_202_demkni',FAN='char_123_fang',BEA='char_122_beagle',KRO='char_124_kroos',MEL='char_208_melan';
const near=(a,e,t=1e-5)=>assert.ok(Math.abs(a-e)<t,`${a} != ${e}`);
const advance=(b,s)=>{for(let i=0;i<Math.round(s/b.dt);i++)b.step();assert.deepEqual(b.errors,[]);};
function make({skill=0,rank=10,elite=2,potential=1,dir='RIGHT',others=[],defer=false}={}){
 const source=structuredClone(data),o=source.operators[ID];assert.ok(o,'Reviewed Saria snapshot required');source.stage.geometry.waves[0].spawns=[];source.stage.battle.dp_per_second=0;
 const b=new StandardBattle(source,{operators:[{...defaultBuild(o),elite,level:o.phases[elite].maxLevel,potential,skillId:o.skills[skill].id,skillRank:rank},...others.map(id=>defaultBuild(source.operators[id]))]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);
 const deploy=(id=ID,r=3,c=4)=>{b.addDp('arkpedia',99);const a=b.deployOperator(id,r,c,dir);assert.ok(a,`${id} at ${r},${c}`);a.atkCd=1000;return a;};return{b,u:defer?null:deploy(),deploy};
}
function wound(a,hp=100,max=100000){a.base.maxHp=max;a.markDirty();void a.s;a.hp=hp;}
function cast(b,u,charges=1){u.skill.setSpTotal(u.skill.spCost*charges);assert.equal(u.skill.manual?b.activateOperator(u.defId):u.skill.activate('test'),true);u.atkCd=1000;}
function enemy(b,{hp=100000,x=5,y=3,def=0,res=0,fly=false}={}){const e=b.spawnEnemy('enemy_1007_slime',{pos:[y,x]});e.x=x;e.y=y;e.base.maxHp=100000;e.base.def=def;e.base.res=res;e.base.moveSpeed=1;if(fly)e.motion='FLY';e.markDirty();void e.s;e.hp=hp;b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._enemiesDirty=true;b._buildEnemyIndex();return e;}
const bb=(skill,rank=10)=>Object.fromEntries(data.operators[ID].skills[skill].levels[rank-1].blackboard.map(x=>[x.key,x.value]));
const row=(rows,id)=>rows.find(r=>r.pathId===id).data;
function outputs(b,u){const list=[];b.on('heal',c=>{if(c.source===u)list.push({at:b.time,target:c.target,ctx:c});});return list;}

test('Saria retains all30 exact ranks, four original bundle hashes, both facing bytes and literal aliases',()=>{
 assert.equal(evidence.frameParity,false);assert.deepEqual(evidence.enabledOperators,[ID]);assert.equal(evidence.source.bundles.length,4);
 for(const r of evidence.source.bundles)assert.match(r.sha256,/^[a-f0-9]{64}$/);
 assert.deepEqual(SARIA_OPERATORS[ID].skillIds,['skchr_demkni_1','skchr_demkni_2','skchr_demkni_3']);
 for(const sid of SARIA_OPERATORS[ID].skillIds)assert.equal(evidence.tables.skills[sid].levels.length,10);
 for(const face of['Front','Back']){assert.equal(evidence.originalFacingBindings[ID][face].sha256,evidence.models[ID][face].sha256);near(evidence.models[ID][face].hits.Attack[0],.567);near(evidence.models[ID][face].hits.Attack_2[0],.467);}
 const aliases=row(evidence.animators[ID],'-6143364476840040723')._animations;assert.ok(aliases.some(a=>a.animKey==='Heal'&&a.animName==='Attack_2'));
 assert.equal(row(evidence.skills.skchr_demkni_1,'5749133806955102138')._maxHpExcludeEqual,0);assert.equal(row(evidence.skills.skchr_demkni_2,'8760559629160851142')._limitTargetNum,0);
 const mode=row(evidence.characters[ID],'-1132218707930447717');near(mode._preDelay,.533,.00001);assert.equal(mode._cooldown,1);assert.equal(mode._escapeTime,1);assert.equal(mode._isCont,0);
 assert.equal(evidence.buffTemplates['damage_scale[mag]'].eventToActions.ON_TAKE_DAMAGE[0]._isStackable,false);
 assert.ok(evidence.verificationLimits.some(s=>s.includes('overheal')));
});

test('all three skills load all selected source ranks without generic passive/skill fallback',()=>{
 for(let skill=0;skill<3;skill++)for(let rank=1;rank<=10;rank++){const{b,u}=make({skill,rank});assert.equal(u.skill.id,`skchr_demkni_${skill+1}`);assert.equal(u.skill.noSkill,false);assert.equal(u.profile.install,null);assert.equal(u.profile.heal,null);assert.deepEqual(b.errors,[]);}
});

test('ordinary attacks preserve source self-tile range, one ground victim and .567 literal release',()=>{
 for(const dir of['RIGHT','UP']){const{b,u}=make({dir}),e=enemy(b,{x:4,y:3}),f=enemy(b,{x:e.x,y:e.y,fly:true});assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[e]);b.forceAttack(u,[e]);advance(b,.5);near(e.hp,100000);advance(b,.15);near(100000-e.hp,u.s.atk);near(f.hp,100000);}
});

test('First Aid uses selected all-rank ATK healing and .567 Attack event rather than Heal alias',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u,deploy}=make({rank,others:[FAN]}),a=deploy(FAN,2,3);wound(a);cast(b,u);assert.equal(u.mem.regularFormVisual.clip,'Attack');advance(b,.5);near(a.hp,100);advance(b,.15);near(a.hp-100,u.s.atk*bb(0,rank).heal_scale);assert.ok(u.findBuff('saria:cast'));advance(b,.6);assert.equal(u.findBuff('saria:cast'),null);}
});

test('First Aid source inclusive50% gate selects lowest HP ratio and excludes over-half recipients',()=>{
 const{b,u,deploy}=make({others:[FAN,BEA]}),a=deploy(FAN,2,3),z=deploy(BEA,2,5);wound(a,500);wound(z,500);a.hp=a.s.maxHp*.5+1;z.hp=z.s.maxHp*.5+1;u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.activate('test'),false);
 a.hp=a.s.maxHp*.5;z.hp=z.s.maxHp*.1;cast(b,u);const ah=a.hp,zh=z.hp;advance(b,.65);near(a.hp,ah);near(z.hp-zh,u.s.atk*bb(0).heal_scale);
});

test('First Aid waits with full stock until injured qualifying target enters its exact x4 grid',()=>{
 const{b,u,deploy}=make({others:[FAN]}),a=deploy(FAN,2,1);wound(a);u.skill.setSpTotal(u.skill.spCost*3);advance(b,.2);assert.equal(u.skill.activations,0);assert.equal(u.skill.charges,3);a.x=3;a.y=3;advance(b,.65);assert.equal(u.skill.activations,1);assert.ok(a.hp>100);assert.equal(u.skill.charges,2);
});

test('First Aid dead INPUT refunds spent charge but hidden/withdrawn/changed-deployment live INPUT do not',()=>{
 for(const mode of['dead','hidden','withdrawn','redeployed']){const{b,u,deploy}=make({others:[FAN]}),a=deploy(FAN,2,3);wound(a);cast(b,u);advance(b,.1);if(mode==='dead')b.kill(a);else if(mode==='hidden')a.hidden=true;else if(mode==='withdrawn')a.deployed=false;else a.deploySeq++;advance(b,.6);assert.equal(u.skill.charges,mode==='dead'?1:0);near(a.hp,mode==='dead'?0:100);}
});

test('First Aid cached input is not replaced by a different ally and can accept a now-healthy original input',()=>{
 const{b,u,deploy}=make({others:[FAN,BEA]}),a=deploy(FAN,2,3),z=deploy(BEA,2,5);wound(a,100);wound(z,500);const out=outputs(b,u);cast(b,u);a.hp=a.s.maxHp;advance(b,.65);assert.deepEqual(out.map(x=>x.target),[a]);near(z.hp,500);
});

test('healing rejects source HEAL-free/noHeal/isolated/target-free recipients including changed impact eligibility',()=>{
 for(const flags of[{healFree:true},{noHeal:true},{isolated:true},{untargetable:true}]){const{b,u,deploy}=make({others:[FAN]}),a=deploy(FAN,2,3);wound(a);b.addBuff(a,{key:'test:deny',flags});u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.activate('test'),false);b.removeBuff(a,'test:deny');cast(b,u);advance(b,.1);b.addBuff(a,{key:'test:deny',flags});advance(b,.6);near(a.hp,100);assert.equal(u.skill.charges,0);}
});

test('automatic First Aid consumes one charge at a time and holds SP through full source cast',()=>{
 const{b,u,deploy}=make({others:[FAN]}),a=deploy(FAN,2,3);wound(a);u.skill.setSpTotal(u.skill.spCost*3);const out=outputs(b,u);advance(b,1.1);assert.equal(u.skill.activations,1);assert.equal(u.skill.charges,2);assert.equal(out.length,1);const sp=u.skill.spTotal;advance(b,.04);near(u.skill.spTotal,sp);advance(b,.7);assert.equal(u.skill.activations,2);assert.equal(out.length,2);
});

test('Medicine Dispensing releases at Heal alias .467 and heals more than three legal recipients at every rank',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u,deploy}=make({skill:1,rank,others:[FAN,BEA,KRO,MEL]}),a=deploy(FAN,2,3),z=deploy(BEA,2,5),k=deploy(KRO,4,4),m=deploy(MEL,3,3);for(const x of[u,a,z,k,m])wound(x);cast(b,u);assert.equal(u.mem.regularFormVisual.clip,'Attack_2');advance(b,.4);for(const x of[u,a,z,k,m])near(x.hp,100);advance(b,.15);for(const x of[u,a,z,k,m])near(x.hp-100,u.s.atk*bb(1,rank).heal_scale);assert.equal(u.skill.charges,0);}
});

test('Medicine Dispensing CAST reacquires entering allies and rejects those leaving or becoming isolated during windup',()=>{
 const{b,u,deploy}=make({skill:1,others:[FAN,BEA]}),a=deploy(FAN,2,3),z=deploy(BEA,2,1);wound(a);wound(z);cast(b,u);advance(b,.1);a.x=8;a.y=3;z.x=3;z.y=3;advance(b,.45);near(a.hp,100);assert.ok(z.hp>100);
 const q=make({skill:1,others:[FAN]}),v=q.deploy(FAN,2,3);wound(v);cast(q.b,q.u);advance(q.b,.1);q.b.addBuff(v,{key:'isolate',flags:{isolated:true}});advance(q.b,.4);near(v.hp,100);
});

test('S1 cap1 and S2 uncapped original animation rate preserve actual heal emission timing',()=>{
 for(const skill of[0,1]){const{b,u,deploy}=make({skill,others:[FAN]}),a=deploy(FAN,2,3);wound(a);b.addBuff(u,{key:'test:ASPD',mods:{aspd:100}});cast(b,u);advance(b,skill===0?.5:.2);near(a.hp,100);advance(b,.1);assert.equal(a.hp>100,skill===1);if(skill===0){advance(b,.1);assert.ok(a.hp>100);}}
});

test('both automatic cast modes remember sub-tick control and clear tails before a fresh successful cast',()=>{
 for(const skill of[0,1])for(const status of['stun','freeze','sleep','levitate']){const{b,u,deploy}=make({skill,others:[FAN]}),a=deploy(FAN,2,3);wound(a);cast(b,u);advance(b,.1);b.applyStatus(u,status,{duration:.001});advance(b,1.3);near(a.hp,100);assert.equal(u.canAct,true);assert.equal(u.findBuff('saria:cast'),null);assert.equal(u.mem.regularFormVisual,null);cast(b,u);advance(b,.65);assert.ok(a.hp>100);}
});

test('Rhine Charged Suit is promotion/potential gated and first applies after selected20s rather than raw30',()=>{
 for(const[elite,potential,atk,def]of[[0,1,0,0],[1,1,.02,.02],[1,5,.03,.03],[2,1,.05,.04],[2,5,.06,.05]]){const{b,u}=make({elite,potential,rank:[4,7,10][elite]});advance(b,19.9);near(u.s.atk,u.base.atk);near(u.s.def,u.base.def);advance(b,.2);near(u.s.atk,u.base.atk*(1+atk));near(u.s.def,u.base.def*(1+def));}
});

test('Suit stacks cap at five and source percentage stacks combine with foreign buffs without deleting them',()=>{
 const{b,u}=make();b.addBuff(u,{key:'foreign',mods:{atkPct:.2,defPct:.1}});advance(b,101);assert.equal(u.findBuff('demkni_t_1[stack]').stacks,5);near(u.s.atk,u.base.atk*1.45);near(u.s.def,u.base.def*1.3);advance(b,40);near(u.s.atk,u.base.atk*1.45);assert.ok(u.findBuff('foreign'));
});

test('Suit deployment removal cancels old clocks and a fresh deployment starts from zero stacks',()=>{
 const{b,u}=make();advance(b,20.1);assert.ok(u.findBuff('demkni_t_1[stack]'));b.retreatOperator(ID);advance(b,u.base.respawnTime+.1);b.addDp('arkpedia',99);const z=b.deployOperator(ID,3,4,'RIGHT');assert.ok(z);z.atkCd=1000;near(z.s.atk,z.base.atk);advance(b,19.9);near(z.s.atk,z.base.atk);advance(b,.2);near(z.s.atk,z.base.atk*1.05);
});

test('Refreshment E2 observes accepted healing output for any SP type, including bounded legal overheal',()=>{
 for(const elite of[1,2])for(const spType of['time','attack','defense']){const{b,u,deploy}=make({skill:1,elite,rank:elite===1?7:10,others:[FAN,BEA]}),a=deploy(FAN,2,3),z=deploy(BEA,2,5);wound(a);z.skill.spType=spType;z.skill.setSpTotal(0);cast(b,u);advance(b,.55);near(z.hp,z.s.maxHp);near(z.skill.spTotal,(spType==='time'?b.time:0)+(elite===2?1:0));}
});

test('Refreshment distinguishes a canceled HEAL modifier, zero healing scalers and healing restrictions from overheal',()=>{
 for(const mode of['cancel','zero','healFree','noHeal']){const{b,u,deploy}=make({skill:1,others:[FAN,BEA]}),a=deploy(FAN,2,3),z=deploy(BEA,2,5);wound(a);wound(z);z.skill.spType='attack';z.skill.setSpTotal(0);if(mode==='cancel')b.on('heal',c=>{if(c.target===z)c.amount=0;},{priority:-100});else if(mode==='zero')b.addBuff(z,{key:'zero',mods:{healingTakenMul:0}});else b.addBuff(z,{key:'deny',flags:{[mode]:true}});cast(b,u);advance(b,.55);near(z.skill.spTotal,0);near(z.hp,100);}
});

test('Refreshment respects recipient active timed skill/noSp and does not leak temporary observer hooks',()=>{
 for(const hold of['active','noSp']){const{b,u,deploy}=make({skill:1,others:[FAN]}),a=deploy(FAN,2,3);wound(a);a.skill.spType='attack';a.skill.setSpTotal(0);if(hold==='active'){a.skill.active=true;a.skill.kind='duration';a.skill.timeLeft=100;}else b.addBuff(a,{key:'hold',flags:{noSp:true}});const count=b._hooks.heal?.length??0;cast(b,u);advance(b,.55);near(a.skill.spTotal,0);assert.equal(b._hooks.heal?.length??0,count);}
});

test('Calcification all selected ranks replace attacks with fixed one-second source healing windows',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u,deploy}=make({skill:2,rank,others:[FAN]}),a=deploy(FAN,2,3),e=enemy(b);wound(a);const out=outputs(b,u);cast(b,u);u.atkCd=0;advance(b,.5);near(a.hp,100);advance(b,.1);near(a.hp-100,u.s.atk*bb(2,rank)['attack@heal_scale']);advance(b,1);assert.equal(out.filter(x=>x.target===a).length,2);near(e.hp,100000);near(u.stats.attacks,0);near(out.filter(x=>x.target===a)[1].at-out.filter(x=>x.target===a)[0].at,1,b.dt+.00001);}
});

test('Calcification timer does not scale with ASPD or BAT and reacquires source current-range recipients',()=>{
 for(const accelerated of[false,true]){const{b,u,deploy}=make({skill:2,others:[FAN,BEA]}),a=deploy(FAN,2,3),z=deploy(BEA,2,1);wound(a);wound(z);if(accelerated)b.addBuff(u,{key:'fast',mods:{aspd:100,batPct:-.5}});const out=outputs(b,u);cast(b,u);advance(b,.2);a.x=8;a.y=3;z.x=3;z.y=3;advance(b,.45);near(a.hp,100);assert.ok(z.hp>100);advance(b,1);assert.equal(out.filter(x=>x.target===z).length,2);near(out.filter(x=>x.target===z)[1].at-out.filter(x=>x.target===z)[0].at,1,b.dt+.00001);}
});

test('Calcification source aura accepts ALL motion and non-ATTACK stealth/Sleep but rejects disappear/target-free',()=>{
 const{b,u}=make({skill:2});const normal=enemy(b),air=enemy(b,{fly:true}),stealth=enemy(b),sleep=enemy(b),hidden=enemy(b),free=enemy(b),far=enemy(b,{x:8,y:3});b.addBuff(stealth,{key:'stealth',flags:{stealth:true}});b.applyStatus(sleep,'sleep',{duration:20});hidden.hidden=true;b.addBuff(free,{key:'free',flags:{untargetable:true}});cast(b,u);for(const e of[normal,air,stealth,sleep]){near(e.s.artsTakenMul,1.55);near(e.s.moveSpeed,e.base.moveSpeed*.4);}for(const e of[hidden,free,far])assert.equal(e.findBuff('demkni_s_3'),null);
});

test('Calcification modifies magical received damage and final movement, preserving physical/true damage',()=>{
 const{b,u}=make({skill:2}),e=enemy(b);cast(b,u);for(const[type,mul]of[['phys',1],['arts',1.55],['true',1]]){const hp=e.hp;b.dealDamage(null,e,{amount:100,type,canDodge:false});near(hp-e.hp,100*mul);}b.addBuff(e,{key:'foreign:move',mods:{movePct:.5,moveMul:.8}});near(e.s.moveSpeed,e.base.moveSpeed*1.5*.8*.4);u.skill.end('duration');near(e.s.moveSpeed,e.base.moveSpeed*1.5*.8);near(e.s.artsTakenMul,1);assert.ok(e.findBuff('foreign:move'));
});

test('Calcification aura immediately detaches on end/withdrawal/death and follows membership changes',()=>{
 for(const finish of['end','retreat','death']){const{b,u}=make({skill:2}),e=enemy(b);cast(b,u);assert.ok(e.findBuff('demkni_s_3'));e.x=8;advance(b,.05);assert.equal(e.findBuff('demkni_s_3'),null);e.x=5;advance(b,.05);assert.ok(e.findBuff('demkni_s_3'));if(finish==='end')u.skill.end('duration');else if(finish==='retreat')b.retreat(u);else b.kill(u);assert.equal(e.findBuff('demkni_s_3'),null);}
});

test('Calcification same-key overlap picks strongest channels once and restores weaker surviving producer',()=>{
 const{b,u,deploy}=make({skill:2,rank:1,others:[BEA]}),z=deploy(BEA,2,5),e=enemy(b);z.def=structuredClone(u.def);z.skill.id='skchr_demkni_3';z.skill.bb={...u.skill.bb,'demkni_s_3.damage_scale':1.55,'demkni_s_3.move_speed':-.6};z.skill.active=true;z.skill.kind='duration';z.skill.timeLeft=1000;z.tileR=u.tileR;z.tileC=u.tileC;z.x=u.x;z.y=u.y;installSaria({battle:b,unit:z,def:z.def});cast(b,u);near(e.s.artsTakenMul,1.55);near(e.s.moveSpeed,e.base.moveSpeed*.4);assert.equal(e.buffs.filter(x=>x.key==='demkni_s_3').length,1);b.retreat(z);near(e.s.artsTakenMul,bb(2,1)['demkni_s_3.damage_scale']);near(e.s.moveSpeed,e.base.moveSpeed*(1+bb(2,1)['demkni_s_3.move_speed']));
});

test('Calcification remembers sub-frame control cancellation without deleting aura or later periodic heals',()=>{
 for(const status of['stun','freeze','sleep','levitate']){const{b,u,deploy}=make({skill:2,others:[FAN]}),a=deploy(FAN,2,3),e=enemy(b);wound(a);cast(b,u);advance(b,.1);b.applyStatus(u,status,{duration:.001});advance(b,.5);near(a.hp,100);assert.ok(e.findBuff('demkni_s_3'));advance(b,1);assert.ok(a.hp>100);}
});

test('Calcification original Front form clips transition without an invented startup combat lock and clean up',()=>{
 const{b,u,deploy}=make({skill:2,dir:'UP',others:[FAN]}),a=deploy(FAN,2,3);wound(a);cast(b,u);assert.deepEqual(u.mem.regularFormVisual,{clip:'Skill_Begin',loop:false,forceFront:true});assert.equal(Boolean(u.s.flags.disarm),false);advance(b,.6);assert.ok(a.hp>100);advance(b,.15);assert.equal(u.mem.regularFormVisual.clip,'Skill_Loop');u.skill.end('duration');assert.equal(u.profile.noAttack,false);assert.equal(u.mem.regularFormVisual.clip,'Skill_End');advance(b,.6);assert.equal(u.mem.regularFormVisual,null);
});

test('Calcification duration end or withdrawal cancels unborn heal and restores ordinary attack profile',()=>{
 for(const finish of['end','retreat']){const{b,u,deploy}=make({skill:2,others:[FAN]}),a=deploy(FAN,2,3);wound(a);cast(b,u);advance(b,.2);if(finish==='end')u.skill.end('duration');else b.retreat(u);advance(b,1.2);near(a.hp,100);assert.equal(u.mem.regularFormVisual,null);assert.equal(u.profile.noAttack,false);}
});


test('accepted control after released heal cancels only cast tail, preserving already applied healing',()=>{
 for(const skill of[0,1]){const{b,u,deploy}=make({skill,others:[FAN]}),a=deploy(FAN,2,3);wound(a);cast(b,u);advance(b,.65);const hp=a.hp;assert.ok(hp>100);assert.ok(u.findBuff('saria:cast'));b.applyStatus(u,'stun',{duration:.001});advance(b,.1);near(a.hp,hp);assert.equal(u.findBuff('saria:cast'),null);assert.equal(u.mem.regularFormVisual,null);assert.equal(u.mem.sariaCast,null);}
});

test('Calcification aura strongest channels can originate from different producers and foreign debuffs survive',()=>{
 const{b,u,deploy}=make({skill:2,rank:1,others:[BEA]}),z=deploy(BEA,2,5),e=enemy(b);z.def=structuredClone(u.def);z.skill.id='skchr_demkni_3';z.skill.bb={...u.skill.bb,'demkni_s_3.damage_scale':1.55,'demkni_s_3.move_speed':-.1};z.skill.active=true;z.skill.kind='duration';z.skill.timeLeft=1000;z.tileR=u.tileR;z.tileC=u.tileC;z.x=u.x;z.y=u.y;installSaria({battle:b,unit:z,def:z.def});b.addBuff(e,{key:'foreign:arts',mods:{artsTakenMul:1.1}});cast(b,u);near(e.s.artsTakenMul,1.55*1.1);near(e.s.moveSpeed,e.base.moveSpeed*(1+bb(2,1)['demkni_s_3.move_speed']));u.skill.end('duration');near(e.s.artsTakenMul,1.55*1.1);near(e.s.moveSpeed,e.base.moveSpeed*.9);b.retreat(z);near(e.s.artsTakenMul,1.1);near(e.s.moveSpeed,e.base.moveSpeed);assert.ok(e.findBuff('foreign:arts'));
});
