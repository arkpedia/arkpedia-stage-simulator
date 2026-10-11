// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-virtuosa-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
const ID = 'char_245_cello', near = (a,z,e=1e-5) => assert.ok(Math.abs(a-z)<e,`${a} != ${z}`);
const advance = (b,s) => {for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);};
function make({skill=0,rank=10,elite=2,potential=1,dir='RIGHT'}={}) {
  const src=structuredClone(data), op=src.operators[ID];src.stage.geometry.waves[0].spawns=[];src.stage.battle.dp_per_second=0;
  src.stage.geometry.rows=13;src.stage.geometry.cols=13;src.stage.geometry.tileGrid=Array.from({length:13},()=>Array(13).fill(2));
  const build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,potential,skillId:op.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
  const b=new StandardBattle(src,{operators:[build,...['char_123_fang','char_124_kroos','char_122_beagle'].map(id=>defaultBuild(src.operators[id]))]});
  b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
  const u=b.deployOperator(ID,5,5,dir);assert.ok(u);u.atkCd=1000;if(skill)u.skill.rule='NEVER';
  const hits=[];b.on('damaged',h=>hits.push({...h,time:b.time}));return {b,u,hits};
}
function enemy(b,{x=6,y=5,hp=1e7,res=0,fly=false}={}) {
  const e=b.spawnEnemy('enemy_1007_slime',{pos:[y,x]});Object.assign(e.base,{maxHp:1e7,res,moveSpeed:0});e.markDirty();void e.s;e.hp=hp;if(fly)e.motion='FLY';
  Object.defineProperty(e,'gaugeMax',{value:1e7,configurable:true});b.addBuff(e,{key:'pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function ally(b,id,r,c,{atk=100,def=100,hp=1000,profession}={}) {
  const a=b.deployOperator(id,r,c,'RIGHT');assert.ok(a);a.atkCd=1000;a.skill.rule='NEVER';Object.assign(a.base,{atk,def,maxHp:hp});if(profession)a.def={...a.def,profession};a.markDirty();void a.s;a.hp=a.s.maxHp;return a;
}
const cast=(b,u)=>{u.skill.setSpTotal(u.skill.spCost);assert.equal(b.activateOperator(ID),true);u.atkCd=1000;};
const output=(b,a,e,type='true',amount=1)=>b.dealDamage(a,e,{type,amount,canDodge:false});
const bb=(s,r)=>Object.fromEntries(evidence.tables.skills[`skchr_cello_${s+1}`].levels[r-1].blackboard.map(v=>[v.key,v.value]));

test('three skills/30 ranks and complete original native graph/animation facing evidence are retained',()=>{
 assert.deepEqual(evidence.enabledOperators,[ID]);assert.deepEqual(evidence.heldOperators,[]);assert.equal(evidence.source.bundles.length,5);assert.equal(evidence.nativeTemplateGaps.length,0);assert.equal(Object.keys(evidence.templates).length,13);assert.equal(Object.keys(evidence.projectiles).length,3);assert.equal(evidence.frameParity,false);
 for(const face of ['Front','Back']){const m=evidence.models[ID][face];assert.equal(m.sha256,evidence.officialSkeletonBindings[ID][face].sha256);near(m.hits.Attack[0],.433);near(m.hits.Skill_1[0],.533);near(m.hits.Skill_2_Attack[0],.867);assert.ok(m.durations.Skill_3_Loop);}
});
test('all30 selected ranks bind source blackboards/SP, including three S1 charges',()=>{
 for(const skill of [0,1,2])for(let rank=1;rank<=10;rank++){const {u}=make({skill,rank}),r=evidence.tables.skills[u.skill.id].levels[rank-1];assert.deepEqual(u.skill.bb,bb(skill,rank));near(u.skill.spCost,r.spData.spCost);near(u.skill.spTotal,r.spData.initSp);assert.equal(u.skill.maxCharges,r.spData.maxChargeTime);if(skill)near(u.skill.duration,r.duration);}
});
test('E0/E1/E2/potential selected talents pulse at .9 then every1s with only E1/E2 Slow',()=>{
 for(const [elite,potential,ratio,scale,slow] of [[0,1,.06,1,0],[1,1,.08,1,.2],[2,1,.1,1.2,.2],[2,5,.1,1.22,.2]]){const {b,u}=make({elite,potential}),e=enemy(b);advance(b,.8);near(e.elem.apoptosis,0);advance(b,.14);near(e.elem.apoptosis,u.s.atk*ratio*scale);assert.equal(!!e.findBuff('sluggish'),slow>0);advance(b,.8);near(e.elem.apoptosis,u.s.atk*ratio*scale);advance(b,.2);near(e.elem.apoptosis,u.s.atk*ratio*scale*2);}
});
test('talent is an injury aura through Silence/Stun, not a normal attack or HP damage',()=>{
 const {b,u,hits}=make(),e=enemy(b);b.applyStatus(u,'silence',{duration:3});b.applyStatus(u,'stun',{duration:3});u.atkCd=0;advance(b,1);near(e.elem.apoptosis,u.s.atk*.1*1.2);near(e.hp,1e7);assert.equal(u.stats.attacks,0);assert.equal(hits.filter(h=>h.source===u&&h.type==='arts').length,0);
});
test('talent follows facing/range, includes flying, excludes hidden/stealthed/free recipients while aura can reach camouflage',()=>{
 for(const dir of ['RIGHT','LEFT','UP','DOWN']){const {b,u}=make({dir}),e=enemy(b,{x:5,y:5,fly:true}),far=enemy(b,{x:11,y:11}),hidden=enemy(b,{x:6,y:5}),camo=enemy(b,{x:6,y:5}),free=enemy(b,{x:6,y:5}),stealth=enemy(b,{x:6,y:5});hidden.hidden=true;b.addBuff(stealth,{key:'stealth',flags:{stealth:true}});b.addBuff(camo,{key:'camo',flags:{camou:true}});b.addBuff(free,{key:'free',flags:{untargetable:true}});advance(b,1);assert.ok(e.elem.apoptosis>0);assert.ok(camo.elem.apoptosis>0 || dir==='LEFT');for(const a of [far,hidden,stealth,free])near(a.elem.apoptosis,0);}
});
test('talent range membership is resampled each pulse and withdrawal stops future output',()=>{
 const {b,u}=make(),e=enemy(b);advance(b,.9);const first=e.elem.apoptosis;e.x=11;e.y=11;b._buildEnemyIndex();advance(b,1);near(e.elem.apoptosis,first);e.x=6;e.y=5;b._buildEnemyIndex();b.retreat(u);advance(b,2);near(e.elem.apoptosis,first);
});
test('S1 has no ordinary attack without charge; no-target/burst target cannot spend charge',()=>{
 for(const mode of ['empty','zero','burst','never','silence']){const {b,u,hits}=make();if(mode!=='empty'){const e=enemy(b);if(mode==='burst')b.addBuff(e,{key:'burst',flags:{burstLock:true}});}if(mode==='zero')u.skill.setSpTotal(0);if(mode==='never')u.skill.rule='NEVER';if(mode==='silence')b.applyStatus(u,'silence',{duration:1});u.atkCd=0;const sp=u.skill.spTotal;advance(b,.7);assert.equal(u.stats.attacks,0);assert.equal(u.skill.activations,0);assert.ok(u.skill.spTotal>=sp);assert.equal(hits.filter(h=>h.source===u&&h.type==='arts').length,0);}
});
test('S1 automatically spends one charge at a time, emits at .533 and keeps injury independent of RES',()=>{
 for(const res of [0,100]){const {b,u,hits}=make(),e=enemy(b,{res});u.atkCd=0;b.step();u.atkCd=1000;assert.equal(u.stats.attacks,1);assert.equal(u.skill.activations,1);assert.equal(u.skill.charges,2);advance(b,.5);near(e.hp,1e7);advance(b,.15);near(1e7-e.hp,u.s.atk*3*(res===100?.05:1));near(e.elem.apoptosis,u.s.atk*1.1*1.2);assert.equal(hits.filter(h=>h.dmg?.tags.includes('virtuosa:s1')).length,1);}
});
test('S1 selects nonburst enemy and carries no normal-attack fallback during Silence',()=>{
 const {b,u,hits}=make(),burst=enemy(b),normal=enemy(b,{x:6.1});b.addBuff(burst,{key:'burst',flags:{burstLock:true}});u.atkCd=0;b.step();u.atkCd=1000;advance(b,.65);near(burst.hp,1e7);assert.ok(normal.hp<1e7);assert.equal(hits.filter(h=>h.source===u&&h.type==='arts').length,1);
});
test('S1 charge casting blocks SP through original1.6s clip, then resumes with stored charges preserved',()=>{
 const {b,u}=make();enemy(b);u.atkCd=0;b.step();u.atkCd=1000;const sp=u.skill.spTotal;advance(b,1.5);near(u.skill.spTotal,sp);advance(b,.2);assert.ok(u.skill.spTotal>sp);assert.equal(u.skill.charges,2);
});
test('S1 pending native hit is cancelled by short control, without inventing another damage/charge',()=>{
 const {b,u,hits}=make(),e=enemy(b);u.atkCd=0;b.step();u.atkCd=1000;advance(b,.2);b.applyStatus(u,'stun',{duration:.001});advance(b,.5);near(e.hp,1e7);assert.equal(hits.filter(h=>h.source===u&&h.type==='arts').length,0);assert.equal(u.skill.activations,1);
});
test('S2 ordinary attack is one Arts target; active mode attacks two distinct targets at .867',()=>{
 for(const active of [false,true]){const {b,u,hits}=make({skill:1}),a=enemy(b),z=enemy(b,{x:6.1}),third=enemy(b,{x:6.2});if(active)cast(b,u);u.atkCd=0;b.step();u.atkCd=1000;advance(b,active?.75:.3);assert.equal(hits.filter(h=>h.source===u&&h.type==='arts').length,0);advance(b,.3);assert.equal(hits.filter(h=>h.source===u&&h.type==='arts').length,active?2:1);assert.equal([a,z,third].filter(e=>e.hp<1e7).length,active?2:1);}
});
test('S2 linked highest-ATK operator output uses Virtuosa ATK, independently of ally ATK/DEF/RES/HP shield',()=>{
 for(const type of ['phys','arts','true','elemental']){const {b,u}=make({skill:1}),a=ally(b,'char_124_kroos',5,6,{atk:2500}),low=ally(b,'char_123_fang',4,5,{atk:100}),e=enemy(b,{x:11,y:11});b.addBuff(e,{key:'shield',shield:1e7});cast(b,u);assert.equal(u.mem.virtuosaLinked,a);output(b,low,e,type,1000);near(e.elem.apoptosis,0);output(b,a,e,type,1000);near(e.hp,1e7);near(e.elem.apoptosis,u.s.atk*.25);}
});
test('S2 own output gains injury and T2 scales only in-range Necrosis, not other gauge/HP elements',()=>{
 const {b,u}=make({skill:1}),e=enemy(b);cast(b,u);output(b,u,e);near(e.elem.apoptosis,u.s.atk*.25*1.2);b.dealDamage(null,e,{type:'element',element:'burn',amount:100});near(e.elem.burn,100);const hp=e.hp;b.dealDamage(null,e,{type:'elemental',amount:100,canDodge:false});near(hp-e.hp,100);
});
test('S2 HP-loss/healing/injury do not recursively synthesize output riders',()=>{
 const {b,u,hits}=make({skill:1}),a=ally(b,'char_124_kroos',5,6,{atk:2500}),e=enemy(b,{x:11});cast(b,u);b.dealDamage(a,e,{type:'element',element:'burn',amount:100});near(e.elem.apoptosis,0);b.loseHp(e,1,{source:a});near(e.elem.apoptosis,0);output(b,a,e);near(e.elem.apoptosis,u.s.atk*.25);assert.equal(hits.filter(h=>h.dmg?.tags.includes('virtuosa:s2')).length,1);
});
test('S2 highest ally resamples at .3s and immediately on membership changes; ignores self/tokens',()=>{
 const {b,u}=make({skill:1}),a=ally(b,'char_124_kroos',5,6,{atk:500}),z=ally(b,'char_123_fang',4,5,{atk:100}),token=ally(b,'char_122_beagle',6,5,{atk:9000,profession:'TOKEN'});cast(b,u);assert.equal(u.mem.virtuosaLinked,a);b.addBuff(z,{key:'foreign',mods:{atkFlat:1000}});advance(b,.2);assert.equal(u.mem.virtuosaLinked,a);advance(b,.2);assert.equal(u.mem.virtuosaLinked,z);b.retreat(z);advance(b,.04);assert.equal(u.mem.virtuosaLinked,a);assert.notEqual(u.mem.virtuosaLinked,token);a.x=11;a.y=11;advance(b,.04);assert.equal(u.mem.virtuosaLinked,null);
});
test('S2 parent end/withdrawal removes linked rider without ghost injury',()=>{
 for(const mode of ['end','withdraw','death']){const {b,u}=make({skill:1}),a=ally(b,'char_124_kroos',5,6,{atk:500}),e=enemy(b,{x:11});cast(b,u);if(mode==='end')u.skill.end('test');else if(mode==='withdraw')b.retreat(u);else b.kill(u,null);output(b,a,e);near(e.elem.apoptosis,0);assert.equal(u.mem.virtuosaLinked,null);}
});
test('S3 stops attacks, expands native range and boosts T1 through selected ATK/T2 delta scale',()=>{
 for(const potential of [1,5]){const {b,u,hits}=make({skill:2,potential}),e=enemy(b,{x:7,y:7});advance(b,.9);near(e.elem.apoptosis,0);cast(b,u);near(u.s.atk,u.base.atk*2.8);u.atkCd=0;advance(b,1);assert.equal(u.stats.attacks,0);const scale=potential===5?1.55:1.5;near(e.elem.apoptosis,u.s.atk*.1*scale);assert.equal(hits.filter(h=>h.source===u&&h.type==='arts').length,0);}
});
test('S3 HP/ATK/DEF highest recipients are independent, exact30% additive modifiers not Inspiration',()=>{
 const {b,u}=make({skill:2}),hp=ally(b,'char_122_beagle',5,6,{hp:3000,atk:100,def:100}),atk=ally(b,'char_124_kroos',4,5,{hp:1000,atk:1000,def:100}),def=ally(b,'char_123_fang',6,5,{hp:1000,atk:100,def:1000});b.addBuff(atk,{key:'foreign',mods:{atkPct:.2}});cast(b,u);near(hp.s.maxHp,3900);near(atk.s.atk,1500);near(def.s.def,1300);near(hp.s.atk,100);near(def.s.atk,100);near(atk.s.maxHp,1000);
});
test('S3 one ally can win all three; reselection removes old grants before ranking and preserves HP ratio',()=>{
 const {b,u}=make({skill:2}),a=ally(b,'char_124_kroos',5,6,{hp:2000,atk:1000,def:1000}),z=ally(b,'char_123_fang',4,5,{hp:1000,atk:1100,def:100});a.hp=a.s.maxHp/2;cast(b,u);near(a.s.maxHp,2600);near(a.s.def,1300);near(z.s.atk,1430);near(a.hpRatio,.5);b.removeBuff(z,'foreign');b.addBuff(a,{key:'external',mods:{atkFlat:150}});advance(b,.4);near(a.s.atk,1495);near(z.s.atk,1100);near(a.hpRatio,.5);advance(b,.4);near(a.s.atk,1495);
});
test('S3 leaving range and expiry/withdrawal clean all three grants, current ATK and expanded aura',()=>{
 for(const mode of ['leave','expire','withdraw']){const {b,u}=make({skill:2}),a=ally(b,'char_124_kroos',5,6,{hp:2000,atk:1000,def:1000});cast(b,u);assert.ok(a.s.atk>1000);if(mode==='leave'){a.x=11;a.y=11;advance(b,.04);}else if(mode==='expire')advance(b,40.1);else b.retreat(u);near(a.s.atk,1000);near(a.s.def,1000);near(a.s.maxHp,2000);if(mode==='expire')near(u.s.atk,u.base.atk);}
});
test('all literal facings play original S2/S3 Begin/Idle or Loop/End and return to normal mode',()=>{
 for(const dir of ['RIGHT','LEFT','UP','DOWN'])for(const skill of [1,2]){const {b,u}=make({skill,dir});cast(b,u);assert.equal(u.mem.regularFormVisual.clip,`Skill_${skill+1}_Begin`);advance(b,.4);assert.equal(u.mem.regularFormVisual.clip,skill===1?'Skill_2_Idle':'Skill_3_Loop');u.skill.end('test');assert.equal(u.mem.regularFormVisual.clip,`Skill_${skill+1}_End`);advance(b,2);assert.equal(u.mem.regularFormVisual,null);assert.ok(u.skill.gainSp(1,'test')>0);}
});

test('accepted S1 injury is emitted even behind an HP shield but cannot bypass a burst lock',()=>{
 for(const mode of ['shield','late-lock']){const {b,u}=make(),e=enemy(b);if(mode==='shield')b.addBuff(e,{key:'shield',shield:1e7});u.atkCd=0;b.step();u.atkCd=1000;if(mode==='late-lock')b.addBuff(e,{key:'late-lock',flags:{burstLock:true}});advance(b,.7);near(e.elem.apoptosis,mode==='shield'?u.s.atk*1.1*1.2:0);if(mode==='shield')near(e.hp,1e7);else assert.ok(e.hp<1e7);}
});
test('born S1 projectile follows the original target and survives owner withdrawal without a ghost aura',()=>{
 const {b,u,hits}=make(),e=enemy(b);u.atkCd=0;b.step();u.atkCd=1000;advance(b,.5334);b.retreat(u);advance(b,.2);assert.equal(hits.filter(h=>h.source===u&&h.type==='arts').length,1);assert.ok(e.elem.apoptosis>0);const elem=e.elem.apoptosis;advance(b,2);near(e.elem.apoptosis,elem);
});
test('real Necrosis threshold creates15s burst with800 elemental HP ticks and locks all gauges',()=>{
 const {b,u}=make({skill:1}),e=enemy(b);Object.defineProperty(e,'gaugeMax',{value:1000,configurable:true});b.dealDamage(u,e,{type:'element',element:'apoptosis',amount:1000,canDodge:false});assert.ok(e.findBuff('apoptosisBurst'));near(e.findBuff('apoptosisBurst').timeLeft,15);const hp=e.hp;advance(b,1.1);near(hp-e.hp,800);b.dealDamage(null,e,{type:'element',element:'burn',amount:100});near(e.elem.burn,0);
});
test('S2 rejected dodge/cancel/immune output and sourceless burst credit cannot fabricate linked injury',()=>{
 for(const mode of ['dodge','cancel','immune','sourceless']){const {b,u}=make({skill:1}),a=ally(b,'char_124_kroos',5,6),e=enemy(b,{x:11});cast(b,u);if(mode==='dodge')b.addBuff(e,{key:'dodge',mods:{dodgePhys:1}});if(mode==='cancel')b.on('hit',c=>{if(c.target===e)c.dmg.cancel=true;});if(mode==='immune')b.addBuff(e,{key:'immune',flags:{invulnerable:true}});b.dealDamage(a,e,{type:'phys',amount:100,canDodge:true,sourceless:mode==='sourceless'});near(e.elem.apoptosis,0);}
});
test('T2 samples enemy range for foreign injury and S3 changes only the bonus above1',()=>{
 const {b,u}=make({skill:2}),e=enemy(b),far=enemy(b,{x:11,y:11});b.dealDamage(null,e,{type:'element',element:'apoptosis',amount:100});near(e.elem.apoptosis,120);b.dealDamage(null,far,{type:'element',element:'apoptosis',amount:100});near(far.elem.apoptosis,100);cast(b,u);b.dealDamage(null,e,{type:'element',element:'apoptosis',amount:100});near(e.elem.apoptosis,270);u.skill.end('test');b.dealDamage(null,e,{type:'element',element:'apoptosis',amount:100});near(e.elem.apoptosis,390);
});
