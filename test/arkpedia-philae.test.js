// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-philae-prefabs.json' with { type: 'json' };
import { PHILAE_OPERATORS } from '../shared/arkpedia/philae-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
const ID='char_4148_philae',near=(x,y,e=1e-5)=>assert.ok(Math.abs(x-y)<e,`${x} != ${y}`);
const advance=(b,s)=>{for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);};
function make({skill=0,rank=10,elite=2,potential=1,dir='RIGHT'}={}){
 const src=structuredClone(data),op=src.operators[ID];assert.ok(op,'Reviewed Philae snapshot required');src.stage.geometry.waves[0].spawns=[];src.stage.battle.dp_per_second=0;
 src.stage.geometry.rows=13;src.stage.geometry.cols=13;src.stage.geometry.tileGrid=Array.from({length:13},()=>Array(13).fill(2));
 const build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,potential,skillId:op.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
 const b=new StandardBattle(src,{operators:[build]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);
 b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));const u=b.deployOperator(ID,5,5,dir);assert.ok(u);u.atkCd=1000;u.skill.rule='NEVER';const hits=[];b.on('damaged',r=>hits.push({...r,time:b.time}));return{b,u,hits};
}
function enemy(b,{x=6,y=5,hp=100000,res=0,def=0,fly=false}={}){
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[y,x]});Object.assign(e.base,{maxHp:100000,res,def,moveSpeed:0});if(fly)e.motion='FLY';e.markDirty();void e.s;e.hp=hp;
 Object.defineProperty(e,'gaugeMax',{value:100000,configurable:true});b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function cast(b,u){u.skill.setSpTotal(u.skill.spCost);assert.equal(b.activateOperator(ID),true);u.atkCd=1000;}
function incoming(b,u,e,{type='true',amount=1,...info}={}){b.dealDamage(e,u,{type,amount,canDodge:false,...info});}
const counters=(hits,u)=>hits.filter(h=>h.source===u&&h.dmg?.tags.includes('philae:counter'));
const bb=(skill,rank)=>Object.fromEntries(evidence.tables[ID].skillLevels[`skchr_philae_${skill+1}`][rank-1].blackboard.map(v=>[v.key,v.value]));

test('exact source retains both skills/all20 ranks/five original bundles and actual two native facings',()=>{
 assert.deepEqual(PHILAE_OPERATORS[ID].skillIds,['skchr_philae_1','skchr_philae_2']);assert.equal(evidence.source.bundles.length,5);assert.equal(evidence.frameParity,false);
 for(const f of['Front','Back']){assert.equal(evidence.models[ID][f].sha256,evidence.originalFacingBindings[ID][f].sha256);near(evidence.models[ID][f].hits.Attack[0],.767);near(evidence.models[ID][f].hits.Skill_1[0],.433);near(evidence.models[ID][f].durations.Skill_1,1.667);}
 assert.ok(evidence.models[ID].Back.durations.Skill_2_Start);assert.equal(evidence.models[ID].Back.durations.Skill_2_Begin,undefined);assert.ok(evidence.verificationLimits.some(s=>s.includes('cancel/dodge')));
});
test('all selected ranks bind exact SP/durations and source HP/shield/counter blackboards',()=>{
 for(const skill of[0,1])for(let rank=1;rank<=10;rank++){const{u}=make({skill,rank}),r=evidence.tables[ID].skillLevels[u.skill.id][rank-1];near(u.skill.spCost,r.spData.spCost);near(u.skill.spTotal,r.spData.initSp);near(u.skill.duration,r.duration);assert.deepEqual(u.skill.bb,bb(skill,rank));}
});
test('normal natural attack is one physical ground victim with no fabricated generic elemental injury',()=>{
 const{b,u,hits}=make(),e=enemy(b,{x:5}),z=enemy(b,{x:5.1}),air=enemy(b,{x:5.2,fly:true});u.atkCd=0;b.step();u.atkCd=1000;advance(b,1.1);assert.equal(u.stats.attacks,1);assert.equal(hits.filter(h=>h.source===u&&h.type==='phys').length,1);assert.equal([e,z].filter(e=>e.hp<100000).length,1);near(air.hp,100000);near(e.elem.necrosis+z.elem.necrosis,0);
});
test('normal .767 event follows CAST victims through all facings and sub-tick interruption',()=>{
 for(const dir of['RIGHT','LEFT','UP','DOWN'])for(const mode of['normal','replace','control']){const{b,u}=make({dir}),coords=[5,5],e=enemy(b,{x:coords[0],y:coords[1]}),fresh=enemy(b,{x:10,y:10});b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.7);near(e.hp,100000);if(mode==='control')b.applyStatus(u,'stun',{duration:.001});if(mode==='replace'){b._unblock(e);e.x=10;e.y=10;fresh.x=coords[0];fresh.y=coords[1];b._buildEnemyIndex();}advance(b,.2);assert.equal(e.hp<100000,mode==='normal');assert.equal(fresh.hp<100000,mode==='replace');}
});
test('T1 exact E0/E1/E2 potential source scales every injury type and grants only DARK typed SP',()=>{
 for(const[elite,potential,res,sp]of[[0,1,0,0],[1,1,.05,1],[1,5,.07,1],[2,1,.1,2],[2,5,.12,2]]){const{b,u}=make({elite,potential}),e=enemy(b);for(const el of['burn','neural','necrosis','erosion']){const before=u.skill.spTotal;b.dealDamage(e,u,{type:'element',element:el,amount:100});near(u.elem[el],100*(1-res));near(u.skill.spTotal-before,el==='necrosis'?sp:0);}}
});
test('T1 does not gain SP from ordinary/HP-elemental/HP-loss output or wrong gauge subtype',()=>{
 const{b,u}=make(),e=enemy(b),sp=u.skill.spTotal;for(const type of['phys','arts','true','elemental'])incoming(b,u,e,{type,amount:1,element:'necrosis'});b.loseHp(u,1);near(u.skill.spTotal,sp);b.dealDamage(e,u,{type:'element',element:'neural',amount:10});near(u.skill.spTotal,sp);
});
test('T1 typed zero and fully absorbed DARK input retain explicit source no-amount predicate, normal SP restrictions apply',()=>{
 const{b,u}=make(),e=enemy(b),sp=u.skill.spTotal;b.dealDamage(e,u,{type:'element',element:'necrosis',amount:0});near(u.skill.spTotal,sp+2);b.addBuff(u,{key:'no-sp',flags:{noSp:true}});b.dealDamage(e,u,{type:'element',element:'necrosis',amount:100});near(u.skill.spTotal,sp+2);b.removeBuff(u,'no-sp');cast(b,u);b.dealDamage(e,u,{type:'element',element:'necrosis',amount:100});near(u.skill.spTotal,0);near(u.elem.necrosis,0);
});
test('S1 immediate selected HP% preserves HP ratio and max-clears all unlocked gauges without an invented HP heal',()=>{
 const{b,u,hits}=make();u.hp=u.s.maxHp/2;const ratio=u.hpRatio;Object.assign(u.elem,{burn:100,neural:200,necrosis:300,erosion:400});cast(b,u);near(u.s.maxHp,u.base.maxHp*1.9);near(u.hpRatio,ratio);for(const v of Object.values(u.elem))near(v,0);assert.equal(hits.filter(h=>h.source===u).length,0);assert.equal(u.mem.regularFormVisual.clip,'Skill_1');
});
test('S1 every rank creates selected600..1800 pool/15s HP% independently of original animation event',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u}=make({rank});cast(b,u);const s=bb(0,rank);near(u.mem.philaeBarrier.value,s.shield_value);near(u.s.maxHp,u.base.maxHp*(1+s.max_hp));advance(b,.5);assert.ok(u.skill.active);near(u.mem.philaeBarrier.value,s.shield_value);near(u.skill.timeLeft,14.5);assert.ok(u.s.flags.disarm);}
});
test('S1 original1.667 animation holds attack while .433 produces no fake heal/hit, then normal resumes before15s ends',()=>{
 const{b,u,hits}=make(),e=enemy(b,{x:5});cast(b,u);u.atkCd=0;advance(b,1.6);assert.equal(u.stats.attacks,0);u.atkCd=1000;advance(b,.2);assert.equal(u.mem.philaeAnimation,null);assert.equal(!!u.s.flags.disarm,false);u.atkCd=0;b.step();u.atkCd=1000;advance(b,.9);assert.equal(u.stats.attacks,1);assert.equal(hits.filter(h=>h.source===u&&h.type==='phys').length,1);assert.ok(u.skill.active);
});
test('S1 accepted short control cancels remaining clip lock without retracting its born independent shield/HP/clear',()=>{
 const{b,u}=make();u.elem.burn=100;cast(b,u);advance(b,.1);b.applyStatus(u,'stun',{duration:.001});advance(b,.1);assert.equal(u.mem.philaeAnimation,null);assert.ok(u.skill.active);near(u.mem.philaeBarrier.value,1800);near(u.s.maxHp,u.base.maxHp*1.9);near(u.elem.burn,0);
});
test('S1 shared source pool absorbs different injury types, preserves selected empty shield and lets overflow through',()=>{
 const{b,u}=make(),e=enemy(b);cast(b,u);for(const el of['burn','neural','necrosis','erosion'])b.dealDamage(e,u,{type:'element',element:el,amount:500});near(u.mem.philaeBarrier.value,0);for(const v of Object.values(u.elem))near(v,0);b.dealDamage(e,u,{type:'element',element:'erosion',amount:10});near(u.elem.erosion,9);assert.ok(u.skill.active);
});
test('S1 pool uses bounded post-resistance/multiplier quantity with foreign protection rather than raw input',()=>{
 const{b,u}=make(),e=enemy(b);u.def={...u.def,epResistance:20};b.addBuff(u,{key:'foreign',mods:{elemTakenMul:.5}});cast(b,u);b.dealDamage(e,u,{type:'element',element:'burn',amount:100,mul:2});near(u.mem.philaeBarrier.value,1800-100*2*.9*.5*.8);near(u.elem.burn,0);
});
test('S1 cancelled/invulnerable/locked-gauge contexts do not consume its source pool or fabricate talent SP',()=>{
 for(const mode of['cancel','immune','locked']){const{b,u}=make(),e=enemy(b);cast(b,u);if(mode==='cancel')b.on('elementHit',c=>{if(c.target===u)c.dmg.cancel=true;},{priority:100});if(mode==='immune')b.addBuff(u,{key:'immune',flags:{invulnerable:true}});if(mode==='locked')b.addBuff(u,{key:'neuralBurst',flags:{burstLock:true}});b.dealDamage(e,u,{type:'element',element:'necrosis',amount:100});near(u.mem.philaeBarrier.value,1800);near(u.elem.necrosis,0);near(u.skill.spTotal,0);}
});
test('S1 max-element-heal cannot erase an active burst recovery or its locked gauges',()=>{
 const{b,u}=make();u.elem.burn=1000;b.addBuff(u,{key:'burnBurst',duration:3,flags:{burstLock:true}});cast(b,u);near(u.elem.burn,1000);assert.ok(u.findBuff('burnBurst'));advance(b,3.1);assert.equal(u.findBuff('burnBurst'),null);assert.ok(u.skill.active);
});
test('S1 exact duration removes pool/HP modifier and withdrawal removes future hooks without ghost barrier',()=>{
 for(const mode of['expire','withdraw']){const{b,u}=make(),e=enemy(b);cast(b,u);if(mode==='expire')advance(b,15.1);else b.retreat(u);assert.equal(u.mem.philaeBarrier,null);near(u.s.maxHp,u.base.maxHp);const pool=u.mem.philaeBarrier;b.dealDamage(e,u,{type:'element',element:'necrosis',amount:100});assert.equal(u.mem.philaeBarrier,pool);}
});
test('S2 all ranks disable natural attacks with selected HP% and40s parent SP duration',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u}=make({skill:1,rank});enemy(b);cast(b,u);u.atkCd=0;advance(b,1);assert.equal(u.stats.attacks,0);near(u.s.maxHp,u.base.maxHp*(1+bb(1,rank).max_hp));near(u.skill.timeLeft,39);near(u.skill.gainSp(10,'test'),0);}
});
test('S2 every rank one delayed current-ATK Arts counter plus independent25% necrosis uses selected scale/RES',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u,hits}=make({skill:1,rank}),e=enemy(b,{res:60});cast(b,u);incoming(b,u,e);near(e.hp,100000);advance(b,.0333);near(e.hp,100000);advance(b,.067);near(100000-e.hp,u.s.atk*bb(1,rank).atk_scale*.4);near(e.elem.necrosis,u.s.atk*.25);assert.equal(counters(hits,u).length,1);}
});
test('S2 counter injury is separate from shielded or high-RES primary Arts amount',()=>{
 for(const mode of['shield','res']){const{b,u}=make({skill:1}),e=enemy(b,{res:mode==='res'?100:0});if(mode==='shield')b.addBuff(e,{key:'shield',shield:100000});cast(b,u);incoming(b,u,e);advance(b,.1);near(e.elem.necrosis,u.s.atk*.25);near(100000-e.hp,mode==='shield'?0:u.s.atk*2*.05);}
});
test('S2 accepted shielded/floored0HP loss receipt and each typed HP damage family trigger one counter',()=>{
 for(const mode of['shield','floor','phys','arts','true','elemental','zero']){const{b,u,hits}=make({skill:1}),e=enemy(b);cast(b,u);if(mode==='shield')b.addBuff(u,{key:'shield',shield:100000});if(mode==='floor'){b.addBuff(u,{key:'floor',mods:{damageHpFloorRatio:.5}});u.hp=u.s.maxHp*.5;}incoming(b,u,e,{type:['phys','arts','true','elemental'].includes(mode)?mode:'true',amount:mode==='zero'?0:10000});advance(b,.1);assert.equal(counters(hits,u).length,1);}
});
test('S2 rejected dodge/cancel/invulnerability never dispatch the bounded accepted counter bridge',()=>{
 for(const mode of['dodge','cancel','immune']){const{b,u,hits}=make({skill:1}),e=enemy(b);cast(b,u);if(mode==='dodge')b.addBuff(u,{key:'dodge',mods:{dodgePhys:1}});if(mode==='cancel')b.on('hit',c=>{if(c.target===u)c.dmg.cancel=true;});if(mode==='immune')b.addBuff(u,{key:'immune',flags:{invulnerable:true}});incoming(b,u,e,{type:'phys',amount:10000,canDodge:true});advance(b,.1);assert.equal(counters(hits,u).length,0);assert.equal(u.findBuff('philae_s_2[cd]'),null);}
});
test('S2 gauges/HP-loss do not synthesize HP counter, while typed gauge adds only its derived ATK',()=>{
 const{b,u,hits}=make({skill:1}),e=enemy(b);cast(b,u);b.loseHp(u,1);b.dealDamage(e,u,{type:'element',element:'burn',amount:1});advance(b,.1);assert.equal(counters(hits,u).length,0);assert.ok(u.findBuff('philae_s_2[atk]'));near(u.s.atk,u.base.atk*2);
});
test('S2 selected2s cooldown excludes repeats and resumes after expiry without inheriting raw.8 template default',()=>{
 const{b,u,hits}=make({skill:1}),e=enemy(b);cast(b,u);incoming(b,u,e);near(u.findBuff('philae_s_2[cd]').timeLeft,2);advance(b,1);incoming(b,u,e);advance(b,.1);assert.equal(counters(hits,u).length,1);advance(b,1.1);incoming(b,u,e);advance(b,.1);assert.equal(counters(hits,u).length,2);
});
test('S2 x-4 is surrounding8 ground tiles rather than range1 or a large circular splash',()=>{
 const{b,u}=make({skill:1}),input=enemy(b),diag=enemy(b,{x:6,y:6}),far=enemy(b,{x:7}),air=enemy(b,{x:5.5,fly:true});cast(b,u);incoming(b,u,input);advance(b,.1);assert.ok(diag.hp<100000);near(far.hp,100000);near(air.hp,100000);
});
test('S2 purposeNONE admits invisible recipients but rejects initial hidden/free; Sleep retains core damage immunity',()=>{
 const{b,u}=make({skill:1}),input=enemy(b),stealth=enemy(b,{x:6,y:6}),hidden=enemy(b,{x:4,y:6}),free=enemy(b,{x:4,y:5}),sleep=enemy(b,{x:5,y:6});b.addBuff(stealth,{key:'stealth',flags:{stealth:true}});hidden.hidden=true;b.addBuff(free,{key:'free',flags:{untargetable:true}});b.applyStatus(sleep,'sleep',{duration:3});cast(b,u);incoming(b,u,input);advance(b,.1);assert.ok(stealth.hp<100000);for(const t of[hidden,free,sleep])near(t.hp,100000);near(sleep.elem.necrosis,0);
});
test('S2 explicit nonmissable child ignores recipient dodge but normal immunity still rejects damage and gauge',()=>{
 const{b,u}=make({skill:1}),e=enemy(b),immune=enemy(b,{x:6,y:6});b.addBuff(e,{key:'dodge',mods:{dodgeArts:1}});b.addBuff(immune,{key:'immune',flags:{invulnerable:true}});cast(b,u);incoming(b,u,e);advance(b,.1);assert.ok(e.hp<100000);near(immune.hp,100000);near(immune.elem.necrosis,0);
});
test('S2 primary Arts killing a recipient leaves no fabricated postmortem injury output',()=>{
 const{b,u,hits}=make({skill:1}),e=enemy(b,{hp:1});cast(b,u);incoming(b,u,e);advance(b,.1);assert.equal(e.alive,false);assert.equal(hits.filter(h=>h.source===u&&h.type==='element').length,0);
});
test('S2 recipient list is fixed at receipt and emitted nonderived buff follows its same recipient away without new entrants',()=>{
 const{b,u}=make({skill:1}),e=enemy(b),late=enemy(b,{x:10});cast(b,u);incoming(b,u,e);e.x=10;late.x=6;b._buildEnemyIndex();advance(b,.1);assert.ok(e.hp<100000);near(late.hp,100000);
});
test('S2 born child survives owner withdrawal/death and keeps original retired source/current ATK',()=>{
 for(const mode of['withdraw','death']){const{b,u,hits}=make({skill:1}),e=enemy(b);cast(b,u);b.dealDamage(e,u,{type:'element',element:'burn',amount:1});incoming(b,u,e);if(mode==='withdraw')b.retreat(u);else b.kill(u,null);const atk=u.s.atk;advance(b,.1);assert.equal(counters(hits,u).length,1);near(100000-e.hp,atk*2);near(e.elem.necrosis,atk*.25);}
});
test('S2 born child survives parent end and samples restored current ATK, without retaining a derived ATK snapshot',()=>{
 const{b,u,hits}=make({skill:1}),e=enemy(b);cast(b,u);b.dealDamage(e,u,{type:'element',element:'burn',amount:1});incoming(b,u,e);u.skill.end('test');assert.equal(u.findBuff('philae_s_2[atk]'),null);assert.equal(u.findBuff('philae_s_2[cd]'),null);advance(b,.1);assert.equal(counters(hits,u).length,1);near(100000-e.hp,u.base.atk*2);
});
test('S2 all selected ATK thresholds are one derived modifier, no repeated stack, with foreign percentage preserved',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u}=make({skill:1,rank}),e=enemy(b);b.addBuff(u,{key:'foreign',mods:{atkPct:.2}});cast(b,u);for(const el of['burn','neural','necrosis','erosion'])b.dealDamage(e,u,{type:'element',element:el,amount:1});near(u.s.atk,u.base.atk*(1+.2+bb(1,rank).atk));assert.equal(u.buffs.filter(v=>v.key==='philae_s_2[atk]').length,1);u.skill.end('test');near(u.s.atk,u.base.atk*1.2);}
});
test('S2 typed0/fully-absorbed input uses bounded source IsElementDamage predicate but cancelled input does not',()=>{
 for(const mode of['zero','shield','cancel']){const{b,u}=make({skill:1}),e=enemy(b);cast(b,u);if(mode==='shield')b.on('elementHit',c=>{if(c.target===u)c.dmg.amount=0;},{priority:100});if(mode==='cancel')b.on('elementHit',c=>{if(c.target===u)c.dmg.cancel=true;},{priority:100});b.dealDamage(e,u,{type:'element',element:'erosion',amount:mode==='zero'?0:100});assert.equal(!!u.findBuff('philae_s_2[atk]'),mode!=='cancel');}
});
test('S2 selected non-stunnable buff still counters/gets derived ATK through source stun and silence',()=>{
 const{b,u,hits}=make({skill:1}),e=enemy(b);cast(b,u);b.applyStatus(u,'stun',{duration:3});b.applyStatus(u,'silence',{duration:3});b.dealDamage(e,u,{type:'element',element:'burn',amount:1});incoming(b,u,e);advance(b,.1);assert.equal(counters(hits,u).length,1);assert.ok(u.findBuff('philae_s_2[atk]'));
});
test('S2 all literal facings use actual Begin/Back Start then Loop/End without invented postduration lock',()=>{
 for(const dir of['RIGHT','LEFT','UP','DOWN']){const{b,u}=make({skill:1,dir});cast(b,u);assert.equal(u.mem.regularFormVisual.clip,['LEFT','UP'].includes(dir)?'Skill_2_Start':'Skill_2_Begin');advance(b,.4);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Loop');advance(b,39.7);assert.equal(u.skill.active,false);assert.equal(!!u.s.flags.disarm,false);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_End');assert.ok(u.skill.gainSp(1,'test')>0);advance(b,1);assert.equal(u.mem.regularFormVisual,null);}
});
test('S2 withdrawal/new deployment cannot inherit old derived cooldown/ATK or old pending child source',()=>{
 const{b,u,hits}=make({skill:1}),e=enemy(b);cast(b,u);b.dealDamage(e,u,{type:'element',element:'burn',amount:1});incoming(b,u,e);b.retreat(u);b.bench[ID].readyAt=b.time;b.addDp('arkpedia',99);const z=b.deployOperator(ID,5,5,'RIGHT');assert.ok(z);z.atkCd=1000;assert.notEqual(z,u);near(z.s.atk,z.base.atk);assert.equal(z.findBuff('philae_s_2[cd]'),null);advance(b,.1);assert.equal(counters(hits,u).length,1);assert.equal(counters(hits,z).length,0);
});

test('T1 cancelled-at-hook/invulnerable/locked incoming gauges do not gain SP while inactive',()=>{
 for(const mode of['cancel','immune','locked']){const{b,u}=make(),e=enemy(b),sp=u.skill.spTotal;if(mode==='cancel')b.on('elementHit',c=>{if(c.target===u)c.dmg.cancel=true;},{priority:100});if(mode==='immune')b.addBuff(u,{key:'immune',flags:{invulnerable:true}});if(mode==='locked')b.addBuff(u,{key:'neuralBurst',flags:{burstLock:true}});b.dealDamage(e,u,{type:'element',element:'necrosis',amount:100});near(u.skill.spTotal,sp);near(u.elem.necrosis,0);}
});
test('explicit bounded modifier order does not roll back earlier SP/derived ATK/pool if another later hook cancels',()=>{
 for(const mode of['talent','shield','skill-atk']){const{b,u}=make({skill:mode==='skill-atk'?1:0}),e=enemy(b);if(mode!=='talent')cast(b,u);const sp=u.skill.spTotal;b.on('elementHit',c=>{if(c.target===u)c.dmg.cancel=true;},{priority:-3000});b.dealDamage(e,u,{type:'element',element:'necrosis',amount:100});near(u.elem.necrosis,0);if(mode==='talent')near(u.skill.spTotal,sp+2);if(mode==='shield')near(u.mem.philaeBarrier.value,1710);if(mode==='skill-atk')assert.ok(u.findBuff('philae_s_2[atk]'));}
});
