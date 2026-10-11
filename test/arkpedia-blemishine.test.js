// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-blemishine-prefabs.json' with { type: 'json' };
import { BLEMISHINE_OPERATORS } from '../shared/arkpedia/blemishine-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
const ID='char_423_blemsh', HUNG='char_226_hmau', VULCAN='char_163_hpsts', MEL='char_208_melan';
const near=(a,z,e=1e-5)=>assert.ok(Math.abs(a-z)<e,`${a} != ${z}`);
const advance=(b,t)=>{for(let i=0;i<Math.ceil(t/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);};
const bb=(skill,rank)=>Object.fromEntries(evidence.tables[ID].skillLevels[`skchr_blemsh_${skill+1}`][rank-1].blackboard.map(x=>[x.key,x.value]));
function make({skill=0,rank=10,elite=2,potential=1,dir='RIGHT'}={}){
 const src=structuredClone(data),op=src.operators[ID];assert.ok(op,'Reviewed Blemishine snapshot required');
 src.stage.geometry.waves[0].spawns=[];src.stage.battle.dp_per_second=0;
 src.stage.geometry.rows=13;src.stage.geometry.cols=13;src.stage.geometry.tileGrid=Array.from({length:13},()=>Array(13).fill(2));
 const build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,potential,skillId:op.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
 const others=[HUNG,VULCAN,MEL].map(id=>defaultBuild(src.operators[id]));
 const b=new StandardBattle(src,{operators:[build,...others]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);
 b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 const u=b.deployOperator(ID,5,5,dir);assert.ok(u);u.atkCd=1000;u.skill.rule='NEVER';
 const hits=[],heals=[];b.on('damaged',c=>hits.push({...c,time:b.time}));b.on('heal',c=>heals.push({...c,time:b.time}));
 return{b,u,hits,heals};
}
function ally(b,id=HUNG,r=6,c=5){b.addDp('arkpedia',99);const a=b.deployOperator(id,r,c,'RIGHT');assert.ok(a);a.atkCd=1000;a.skill.rule='NEVER';return a;}
function enemy(b,{x=6,y=5,hp=100000,def=0,res=0,fly=false}={}){
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[y,x]});Object.assign(e.base,{maxHp:100000,def,res,moveSpeed:0});if(fly)e.motion='FLY';e.markDirty();void e.s;e.hp=hp;
 b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function move(b,e,x,y){b._unblock(e);e.x=x;e.y=y;b._buildEnemyIndex();}
function cast(b,u){u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.activate('test'),true);u.atkCd=1000;}
function shot(b,u,e){b.forceAttack(u,[e]);u.atkCd=1000;}
const hitOutputs=(hits,u)=>hits.filter(h=>h.source===u&&['phys','arts'].includes(h.type));
const directHeals=(heals,u)=>heals.filter(h=>h.source===u&&!h.opts.regen);
const regenHeals=(heals,u)=>heals.filter(h=>h.source===u&&h.opts.regen);

test('literal three skills/all30 ranks/five original digests/two actual facing chains retained',()=>{
 assert.deepEqual(BLEMISHINE_OPERATORS[ID].skillIds,['skchr_blemsh_1','skchr_blemsh_2','skchr_blemsh_3']);
 assert.equal(evidence.source.bundles.length,5);assert.equal(evidence.frameParity,false);
 for(const f of['Front','Back']){assert.equal(evidence.models[ID][f].sha256,evidence.originalFacingBindings[ID][f].sha256);near(evidence.models[ID][f].hits.Attack[0],.5);near(evidence.models[ID][f].hits.Skill_1[0],.5);near(evidence.models[ID][f].hits.Skill_2[0],.5);near(evidence.models[ID][f].hits.Skill_3[0],.567);}
 assert.equal(evidence.primaryCalculator.blob,'05e6f1c21ae08c0db954a43e937800f788acc65a');
 assert.ok(evidence.verificationLimits.some(x=>x.includes('coalesc')));assert.ok(evidence.verificationLimits.some(x=>x.includes('Sequence')));
});
test('every selected rank binds exact skill SP/init/blackboards and separate S2 command versus ten-second mode',()=>{
 for(let skill=0;skill<3;skill++)for(let rank=1;rank<=10;rank++){const{u}=make({skill,rank});const r=evidence.tables[ID].skillLevels[u.skill.id][rank-1];near(u.skill.spCost,r.spData.spCost);near(u.skill.spTotal,r.spData.initSp);assert.deepEqual(u.skill.bb,bb(skill,rank));near(u.skill.duration,skill===1?r.duration+.5:r.duration);if(skill===0)near(u.skill.maxCharges,r.blackboard.find(x=>x.key==='ct').value);}
});
test('natural ordinary attack is exactly one ground physical output with actual .5 clip event',()=>{
 const{b,u,hits}=make(),e=enemy(b),z=enemy(b,{x:6.1}),air=enemy(b,{x:5.9,fly:true});u.atkCd=0;b.step();u.atkCd=1000;advance(b,.4);near(e.hp+z.hp,200000);advance(b,.15);assert.equal(u.stats.attacks,1);assert.equal(hitOutputs(hits,u).length,1);near(air.hp,100000);
});
test('ordinary source CAST reacquires entered victims and rejects leave/hidden/target-free during windup',()=>{
 for(const state of['leave','hidden','free']){const{b,u,hits}=make(),e=enemy(b),z=enemy(b,{x:9});shot(b,u,e);advance(b,.2);if(state==='leave')move(b,e,9,8);if(state==='hidden')e.hidden=true;if(state==='free')b.addBuff(e,{key:'free',flags:{untargetable:true}});move(b,z,6,5);advance(b,.4);near(e.hp,100000);assert.equal(hitOutputs(hits,u).length,1);assert.equal(hitOutputs(hits,u)[0].target,z);}
});
test('ordinary clips and source rate cap2 preserve all facings plus combined BAT/ASPD',()=>{
 for(const dir of['UP','LEFT','DOWN','RIGHT'])for(const speed of[.5,2]){const{b,u}=make({dir}),e=enemy(b,{x:5});b.addBuff(u,{key:'rate',mods:{aspd:speed===2?400:0,batPct:speed===.5?1:0}});shot(b,u,e);const ev=b._evq.findLast(x=>x[0]==='atk'&&x[1]===u.id);near(ev[4].windup,.5/speed);assert.equal(ev[4].animation,dir==='DOWN'?'Attack_Down':'Attack');}
});
test('ordinary unborn attack remembers accepted sub-tick action control',()=>{
 for(const status of['stun','freeze','sleep','levitate']){const{b,u,hits}=make(),e=enemy(b);shot(b,u,e);advance(b,.2);b.applyStatus(u,status,{duration:.001});advance(b,.5);near(e.hp,100000);assert.equal(hitOutputs(hits,u).length,0);assert.equal(u.canAct,true);}
});
test('Mercy unlocks exactly E1/E2/potential coefficients and can hit Sleep without breaking it',()=>{
 for(const[elite,potential,scale]of[[0,1,1],[1,1,1.2],[1,5,1.24],[2,1,1.4],[2,5,1.44]]){const{b,u}=make({elite,potential}),e=enemy(b);b.applyStatus(e,'sleep',{duration:10});shot(b,u,e);advance(b,.7);near(100000-e.hp,elite?u.s.atk*scale:0);assert.ok(e.s.flags.sleep);}
});
test('Mercy gives sleeping target priority over ordinary blocker but never extends native range',()=>{
 const{b,u,hits}=make(),e=enemy(b,{x:5}),sleep=enemy(b,{x:6}),far=enemy(b,{x:9});b.applyStatus(sleep,'sleep',{duration:10});b.applyStatus(far,'sleep',{duration:10});u.atkCd=0;b.step();u.atkCd=1000;advance(b,.6);assert.equal(hitOutputs(hits,u)[0].target,sleep);near(e.hp,100000);near(far.hp,100000);
});
test('Knight aura grants one Defensive-Recovery SP per attack, not per accepted damage output',()=>{
 for(const state of['normal','shield','dodge','cancel']){const{b,u}=make(),a=ally(b),e=enemy(b,{x:5,y:6});a.skill.setSpTotal(0);if(state==='shield')b.addBuff(e,{key:'shield',shield:100000});if(state==='dodge')b.addBuff(e,{key:'dodge',mods:{dodgePhys:1}});if(state==='cancel')b.on('hit',c=>{if(c.source===a)c.dmg.cancel=true;});shot(b,a,e);advance(b,1);near(a.skill.spTotal,1);}
});
test('Knight unlock is E1 and includes noHeal recipients but excludes wrong-SP/isolated/free',()=>{
 for(const[elite,state,expected]of[[0,'normal',0],[1,'normal',1],[2,'noHeal',1],[2,'isolated',0],[2,'free',0]]){const{b,u}=make({elite}),a=ally(b),e=enemy(b,{x:5,y:6});a.skill.setSpTotal(0);if(state!=='normal')b.addBuff(a,{key:'restriction',flags:{[state==='free'?'untargetable':state]:true}});shot(b,a,e);advance(b,1);near(a.skill.spTotal,expected);}
 const{b}=make(),a=ally(b,MEL),e=enemy(b,{x:5,y:6});a.skill.setSpTotal(0);shot(b,a,e);advance(b,1);assert.ok(a.skill.spTotal<2,'natural time regen only, never defensive aura');
});
test('Knight same-key source does not stack and hidden-but-deployed source retains native aura',()=>{
 for(const state of['duplicate','hidden','retired']){const{b,u}=make(),a=ally(b),e=enemy(b,{x:5,y:6});a.skill.setSpTotal(0);if(state==='duplicate')b._arkpediaBlemishine.set('second-source',u);if(state==='hidden')u.hidden=true;if(state==='retired')b.retreat(u,{permanent:true});shot(b,a,e);advance(b,1);near(a.skill.spTotal,state==='retired'?0:1);}
});
test('Knight respects receiver noSP and active timed skill restrictions',()=>{
 const{b,u}=make({skill:2}),e=enemy(b);u.skill.setSpTotal(0);b.addBuff(u,{key:'hold',flags:{noSp:true}});shot(b,u,e);advance(b,.7);near(u.skill.spTotal,0);b.removeBuff(u,'hold');cast(b,u);shot(b,u,e);advance(b,.8);near(u.skill.spTotal,0);
});
test('S1 every rank uses exact physical scale and a separate unscaled-ATK heal after fixed .533',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u,heals}=make({rank}),e=enemy(b),a=ally(b);a.hp=1;const atk=u.s.atk;cast(b,u);shot(b,u,e);advance(b,.7);near(100000-e.hp,atk*bb(0,rank).atk_scale);assert.equal(directHeals(heals,u).length,0);advance(b,.4);assert.equal(directHeals(heals,u).length,1);near(directHeals(heals,u)[0].amount,atk*bb(0,rank).heal_scale);}
});
test('S1 spell-emission healing survives physical dodge/cancel/fully absorbed modifier',()=>{
 for(const state of['dodge','cancel','shield']){const{b,u,heals}=make(),e=enemy(b),a=ally(b);a.hp=1;if(state==='dodge')b.addBuff(e,{key:'dodge',mods:{dodgePhys:1}});if(state==='cancel')b.on('hit',c=>{if(c.source===u)c.dmg.cancel=true;});if(state==='shield')b.addBuff(e,{key:'shield',shield:100000});cast(b,u);shot(b,u,e);advance(b,1.15);near(e.hp,100000);assert.equal(directHeals(heals,u).length,1);}
});
test('S1 secondary CAST chooses current lowest HP ratio at delayed release in native x-4 including self',()=>{
 const{b,u,heals}=make(),e=enemy(b),a=ally(b),z=ally(b,MEL,4,5);u.hp=u.s.maxHp*.2;a.hp=a.s.maxHp*.1;z.hp=z.s.maxHp*.3;cast(b,u);shot(b,u,e);advance(b,.7);a.hp=a.s.maxHp;z.hp=z.s.maxHp*.05;advance(b,.4);assert.equal(directHeals(heals,u)[0].target,z);
 const f=make(),q=enemy(f.b);f.u.hp=1;cast(f.b,f.u);shot(f.b,f.u,q);advance(f.b,1.1);assert.equal(directHeals(f.heals,f.u)[0].target,f.u);
});
test('S1 heal-free/noHeal/isolated/hidden/free targets do not become a secondary recipient',()=>{
 for(const flag of['healFree','noHeal','isolated','untargetable','hidden']){const{b,u,heals}=make(),e=enemy(b),a=ally(b);a.hp=1;if(flag==='hidden')a.hidden=true;else b.addBuff(a,{key:'restriction',flags:{[flag]:true}});cast(b,u);shot(b,u,e);advance(b,1.2);assert.equal(directHeals(heals,u).length,0);}
});
test('S1 dead-only INPUT refund does not emit a heal when CAST has no legal target',()=>{
 for(const state of['dead','leave','hidden','free']){const{b,u,heals}=make(),e=enemy(b),a=ally(b);a.hp=1;cast(b,u);shot(b,u,e);if(state==='dead')b.kill(e);if(state==='leave')move(b,e,9,9);if(state==='hidden')e.hidden=true;if(state==='free')b.addBuff(e,{key:'free',flags:{untargetable:true}});advance(b,1.4);near(u.skill.charges,state==='dead'?1:0);assert.equal(directHeals(heals,u).length,0);}
});
test('S1 dead INPUT plus live CAST replacement emits no refund; own lethal output never refunds',()=>{
 for(const replace of[true,false]){const{b,u,heals}=make(),e=enemy(b,{hp:replace?100000:1}),a=ally(b);a.hp=1;const z=replace?enemy(b,{x:9}):null;cast(b,u);shot(b,u,e);if(replace){b.kill(e);move(b,z,6,5);}advance(b,1.3);near(u.skill.charges,0);assert.equal(directHeals(heals,u).length,1);}
});
test('S1 noSP spans its complete original clip and cancellation clears only unborn/tail work',()=>{
 const{b,u}=make(),e=enemy(b);cast(b,u);shot(b,u,e);near(u.skill.gainSp(10,'test'),0);advance(b,1.1);near(u.skill.gainSp(10,'test'),0);advance(b,.2);assert.equal(u.findBuff('blemsh:s1-cast'),null);assert.ok(u.skill.gainSp(1,'test')>0);
 const f=make(),q=enemy(f.b);cast(f.b,f.u);shot(f.b,f.u,q);f.b.applyStatus(f.u,'stun',{duration:.001});advance(f.b,.7);assert.equal(f.u.findBuff('blemsh:s1-cast'),null);near(q.hp,100000);
});
test('already emitted S1 damage stays while brief control cancels its unborn secondary heal',()=>{
 const{b,u,heals}=make(),e=enemy(b),a=ally(b);a.hp=1;cast(b,u);shot(b,u,e);advance(b,.7);assert.ok(e.hp<100000);b.applyStatus(u,'stun',{duration:.001});advance(b,.6);assert.equal(directHeals(heals,u).length,0);
});
test('secondary Heal owner retirement cancels pending work and cannot heal from a later deployment',()=>{
 const{b,u,heals}=make(),e=enemy(b),a=ally(b);a.hp=1;cast(b,u);shot(b,u,e);advance(b,.7);b.retreat(u,{permanent:true});advance(b,.6);assert.equal(directHeals(heals,u).length,0);
});
test('S2 delayed INPUT pulse sleeps all ground own-tile inputs, excludes new entrants/air/outside',()=>{
 const{b,u}=make({skill:1}),e=enemy(b,{x:5}),z=enemy(b,{x:5.2}),air=enemy(b,{x:5.1,fly:true}),outside=enemy(b),enter=enemy(b,{x:9});cast(b,u);advance(b,.3);assert.equal(!!e.s.flags.sleep,false);move(b,enter,5,5);advance(b,.25);assert.ok(e.s.flags.sleep);assert.ok(z.s.flags.sleep);assert.equal(!!air.s.flags.sleep,false);assert.equal(!!outside.s.flags.sleep,false);assert.equal(!!enter.s.flags.sleep,false);
});
test('S2 INPUT leaves/hides/becomes free/dies before release without replacement or synthetic immunity bypass',()=>{
 for(const state of['leave','hidden','free','dead','immune']){const{b,u}=make({skill:1}),e=enemy(b,{x:5});cast(b,u);if(state==='leave')move(b,e,9,9);if(state==='hidden')e.hidden=true;if(state==='free')b.addBuff(e,{key:'free',flags:{untargetable:true}});if(state==='dead')b.kill(e);if(state==='immune')e.def={...e.def,immune:new Set([...e.def.immune,'sleep'])};advance(b,.7);assert.equal(!!e.s.flags.sleep,false);assert.ok(u.mem.blemshSecondAttached);}
});
test('S2 startup transient control cancels Sleep and mode before .5 without retroactive source effects',()=>{
 for(const status of['stun','freeze','sleep','levitate']){const{b,u,heals}=make({skill:1}),e=enemy(b,{x:5}),a=ally(b);a.hp=1;cast(b,u);advance(b,.2);b.applyStatus(u,status,{duration:.001});advance(b,.5);assert.equal(!!e.s.flags.sleep,false);assert.equal(u.skill.active,false);assert.equal(u.findBuff('blemsh:s2-mode'),null);assert.equal(regenHeals(heals,u).length,0);assert.equal(u.mem.regularAttackFacing,null);}
});
test('S2 all ranks attach selected ATK and immediate-first one-second regen only at .5',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u,heals}=make({skill:1,rank}),a=ally(b);a.hp=1;const base=u.s.atk;cast(b,u);advance(b,.4);near(u.s.atk,base);assert.equal(regenHeals(heals,u).length,0);advance(b,.2);near(u.s.atk,base*(1+bb(1,rank).atk));const hs=regenHeals(heals,u).filter(h=>h.target===a);assert.equal(hs.length,1);near(hs[0].amount,u.s.atk*bb(1,rank)['attack@atk_to_hp_recovery_ratio']);advance(b,.8);assert.equal(regenHeals(heals,u).filter(h=>h.target===a).length,1);a.hp=1;advance(b,.2);assert.equal(regenHeals(heals,u).filter(h=>h.target===a).length,2);}
});
test('S2 ten-second attached lifetime and final pulse persist beyond original command plus10',()=>{
 const{b,u,heals}=make({skill:1}),a=ally(b);a.base.maxHp=100000;a.markDirty();void a.s;a.hp=1;cast(b,u);advance(b,10.2);assert.ok(u.skill.active);assert.ok(u.mem.blemshSecondAttached);near(u.skill.duration,10.5);assert.equal(regenHeals(heals,u).filter(h=>h.target===a).length,10);advance(b,.4);assert.equal(u.skill.active,false);near(u.s.atk,u.base.atk);assert.equal(a.findBuff(`blemsh:s2-regen:${u.id}`),null);
});
test('S2 regen bypasses heal-free/noHeal but respects final HP_REGEN scaler and native x-1 range',()=>{
 const{b,u,heals}=make({skill:1}),a=ally(b,VULCAN,7,5),z=ally(b,HUNG,5,7);a.hp=1;z.hp=1;b.addBuff(a,{key:'heal-free',flags:{healFree:true,noHeal:true}});b.addBuff(z,{key:'no-regen',mods:{hpRegenMul:0}});cast(b,u);advance(b,.7);assert.ok(a.hp>1);near(z.hp,1);assert.ok(regenHeals(heals,u).some(h=>h.target===a));assert.equal(regenHeals(heals,u).filter(h=>h.target===z).length,0);
});
test('S2 explicit purposeNONE target-free exception keeps regen while ordinary ally isolation removes it',()=>{
 const{b,u,heals}=make({skill:1}),a=ally(b);a.hp=1;
 b.addBuff(a,{key:'free',flags:{untargetable:true,healFree:true,noHeal:true}});
 cast(b,u);advance(b,.7);assert.ok(a.hp>1);assert.ok(a.findBuff(`blemsh:s2-regen:${u.id}`));
 const n=regenHeals(heals,u).filter(h=>h.target===a).length;
 b.addBuff(a,{key:'isolated',flags:{isolated:true}});a.hp=1;advance(b,.1);
 assert.equal(a.findBuff(`blemsh:s2-regen:${u.id}`),null);advance(b,1.1);near(a.hp,1);
 assert.equal(regenHeals(heals,u).filter(h=>h.target===a).length,n);
 b.removeBuff(a,'isolated');advance(b,.1);assert.ok(a.hp>1);
});
test('S2 aura detaches membership immediately and reentry begins a fresh native first pulse',()=>{
 const{b,u,heals}=make({skill:1}),a=ally(b);a.hp=1;cast(b,u);advance(b,.7);const key=`blemsh:s2-regen:${u.id}`;assert.ok(a.findBuff(key));a.x=10;a.y=10;advance(b,.1);assert.equal(a.findBuff(key),null);const n=regenHeals(heals,u).filter(h=>h.target===a).length;a.x=5;a.y=6;a.hp=1;advance(b,.1);assert.ok(a.findBuff(key));assert.equal(regenHeals(heals,u).filter(h=>h.target===a).length,n+1);
});
test('S2 emitted Sleep persists after owner skill stop/removal while owner-attached aura/ATK do not',()=>{
 for(const state of['end','remove']){const{b,u}=make({skill:1}),e=enemy(b,{x:5}),a=ally(b);a.hp=1;cast(b,u);advance(b,.7);if(state==='end')u.skill.end('test');else b.retreat(u,{permanent:true});advance(b,.1);assert.ok(e.s.flags.sleep);assert.equal(a.findBuff(`blemsh:s2-regen:${u.id}`),null);advance(b,10);assert.equal(!!e.s.flags.sleep,false);}
});
test('S2 post-release control ends only remaining cast lock and never retracts already born mode/regen/Sleep',()=>{
 const{b,u}=make({skill:1}),e=enemy(b,{x:5}),a=ally(b);a.hp=1;cast(b,u);advance(b,.6);b.applyStatus(u,'stun',{duration:.001});advance(b,.2);assert.ok(u.skill.active);assert.ok(u.findBuff('blemsh:s2-mode'));assert.ok(e.s.flags.sleep);assert.equal(u.findBuff('blemsh:s2-cast'),null);assert.equal(u.mem.regularFormVisual,null);assert.equal(u.mem.regularAttackFacing,'Front');a.hp=1;advance(b,1);assert.ok(a.hp>1);
});
test('S2 actual one-second Skill_2 lock releases ordinary attacks without fabricated skill attack mode',()=>{
 const{b,u,hits}=make({skill:1,dir:'LEFT'}),e=enemy(b,{x:4});cast(b,u);u.atkCd=0;advance(b,.9);assert.equal(u.stats.attacks,0);advance(b,.2);u.atkCd=1000;assert.equal(u.mem.regularFormVisual,null);assert.equal(u.mem.regularAttackFacing,'Front');u.atkCd=0;b.step();u.atkCd=1000;advance(b,.7);assert.ok(hitOutputs(hits,u).length>=1);assert.equal(hitOutputs(hits,u).find(h=>h.type==='phys').dmg.isSkill,false);u.skill.end('test');assert.equal(u.mem.regularAttackFacing,null);
});
test('S3 all ranks combine selected ATK/DEF with one physical and one independent Arts modifier',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u,hits,heals}=make({skill:2,rank}),e=enemy(b,{def:100,res:20}),a=ally(b);a.hp=1;const baseAtk=u.s.atk,baseDef=u.s.def;cast(b,u);near(u.s.atk,baseAtk*(1+bb(2,rank).atk));near(u.s.def,baseDef*(1+bb(2,rank).def));shot(b,u,e);advance(b,.8);const h=hitOutputs(hits,u);assert.equal(h.length,2);near(h.find(x=>x.type==='phys').amount,u.s.atk-100);near(h.find(x=>x.type==='arts').amount,u.s.atk*bb(2,rank)['attack@blemsh_s_3_extra_dmg[magic].atk_scale']*.8);assert.equal(h.find(x=>x.type==='arts').dmg.applyWay,'none');advance(b,.4);assert.equal(directHeals(heals,u).length,1);near(directHeals(heals,u)[0].amount,u.s.atk*bb(2,rank).heal_scale);}
});
test('S3 coalesces accepted physical OR Arts output once; rejected outputs do not heal',()=>{
 for(const state of['normal','dodge-physical','dodge-arts','dodge-both','cancel-physical','cancel-arts','cancel-both','shield','zero','immune']){const{b,u,heals}=make({skill:2}),e=enemy(b),a=ally(b);a.hp=1;if(state.startsWith('dodge'))b.addBuff(e,{key:'dodge',mods:{dodgePhys:state!=='dodge-arts'?1:0,dodgeArts:state!=='dodge-physical'?1:0}});if(state.startsWith('cancel'))b.on('hit',c=>{if(c.source===u&&(state==='cancel-both'||c.dmg.type===(state==='cancel-physical'?'phys':'arts')))c.dmg.cancel=true;});if(state==='shield')b.addBuff(e,{key:'shield',shield:100000});if(state==='zero')b.on('hit',c=>{if(c.source===u)c.dmg.amount=0;});if(state==='immune')b.addBuff(e,{key:'immune',flags:{invulnerable:true}});cast(b,u);shot(b,u,e);advance(b,1.3);assert.equal(directHeals(heals,u).length,['dodge-both','cancel-both','immune'].includes(state)?0:1,state);}
});
test('S3 child ON_BUFF_START is first and an accepted lethal Arts child still produces one heal',()=>{
 const{b,u,hits,heals}=make({skill:2}),e=enemy(b,{hp:1}),a=ally(b);a.hp=1;cast(b,u);shot(b,u,e);advance(b,1.3);const h=hitOutputs(hits,u);assert.equal(h.length,1);assert.equal(h[0].type,'arts');assert.equal(e.alive,false);assert.equal(directHeals(heals,u).length,1);
});
test('S3 sleeping coefficient applies once to both native damage outputs and never boosts heal',()=>{
 const{b,u,hits,heals}=make({skill:2}),e=enemy(b),a=ally(b);a.hp=1;b.applyStatus(e,'sleep',{duration:10});cast(b,u);shot(b,u,e);advance(b,1.3);for(const h of hitOutputs(hits,u))near(h.amount,u.s.atk*1.4);near(directHeals(heals,u)[0].amount,u.s.atk);assert.ok(e.s.flags.sleep);
});
test('S3 never heals owner even at lower HP; native x-1 includes distant eligible ally',()=>{
 const{b,u,heals}=make({skill:2}),e=enemy(b),a=ally(b,HUNG,7,5);u.hp=1;a.hp=10;cast(b,u);shot(b,u,e);advance(b,1.3);assert.equal(directHeals(heals,u)[0].target,a);near(u.hp,1);
});
test('S3 secondary CAST reselects at delay and respects every healing recipient restriction',()=>{
 for(const flag of['move','hidden','healFree','noHeal','isolated']){const{b,u,heals}=make({skill:2}),e=enemy(b),a=ally(b),z=ally(b,MEL,4,5);a.hp=1;z.hp=z.s.maxHp*.5;cast(b,u);shot(b,u,e);advance(b,.8);if(flag==='move'){a.x=10;a.y=10;}else if(flag==='hidden')a.hidden=true;else b.addBuff(a,{key:'restriction',flags:{[flag]:true}});advance(b,.4);assert.equal(directHeals(heals,u)[0].target,z);}
});
test('S3 fixed secondary .533 does not scale with source attack speed/BAT',()=>{
 const{b,u,heals}=make({skill:2}),e=enemy(b),a=ally(b);a.hp=1;b.addBuff(u,{key:'fast',mods:{aspd:300}});cast(b,u);shot(b,u,e);advance(b,.65);assert.equal(directHeals(heals,u).length,0);advance(b,.25);assert.equal(directHeals(heals,u).length,1);near(directHeals(heals,u)[0].time,.567/2+.533,.06);
});
test('S3 parent mode end alone retains secondary Heal but samples current retired mode ATK',()=>{
 const{b,u,heals}=make({skill:2}),e=enemy(b),a=ally(b);a.hp=1;cast(b,u);shot(b,u,e);advance(b,.8);u.skill.end('duration');advance(b,.4);assert.equal(directHeals(heals,u).length,1);near(directHeals(heals,u)[0].amount,u.s.atk);near(u.s.atk,u.base.atk);
});
test('S3 short post-emission control cancels secondary without retracting accepted native damage',()=>{
 const{b,u,heals}=make({skill:2}),e=enemy(b),a=ally(b);a.hp=1;cast(b,u);shot(b,u,e);advance(b,.8);assert.ok(e.hp<100000);b.applyStatus(u,'stun',{duration:.001});advance(b,.4);assert.equal(directHeals(heals,u).length,0);
});
test('S3 no emission after sole INPUT death/leave/free produces no secondary Heal',()=>{
 for(const state of['dead','leave','free']){const{b,u,heals}=make({skill:2}),e=enemy(b),a=ally(b);a.hp=1;cast(b,u);shot(b,u,e);if(state==='dead')b.kill(e);if(state==='leave')move(b,e,9,9);if(state==='free')b.addBuff(e,{key:'free',flags:{untargetable:true}});advance(b,1.3);assert.equal(directHeals(heals,u).length,0);}
});
