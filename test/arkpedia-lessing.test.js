// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import source from '../data/arkpedia-lessing-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, performAttack } from '../server/sim/ai.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
const ID = 'char_4011_lessng';
const near = (a, z) => assert.ok(Math.abs(a-z) < 1e-5, `${a} != ${z}`);
function advance(b, sec) { for (let i=0;i<Math.ceil(sec/b.dt-1e-9);i++) b.step(); assert.deepEqual(b.errors,[]); }
function make({skill=0,rank=10,elite=2,potential=1,dir='RIGHT'}={}) {
  const d=structuredClone(data),o=d.operators[ID];d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
  d.stage.geometry.rows=19;d.stage.geometry.cols=21;d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
  const build={...defaultBuild(o),elite,potential,level:o.phases[elite].maxLevel,skillId:o.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
  const b=new StandardBattle(d,{operators:[build]});b.autoFinish=false;b.setViewport('fullscreen-workspace');
  b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));b.addDp('arkpedia',99);
  const receipts=[];b.on('damaged',c=>receipts.push({...c,time:b.time}));const u=b.deployOperator(ID,5,5,dir);u.atkCd=1000;u.profile.canAttack=()=>false;
  return{b,u,receipts};
}
function enemy(b,{x=6,y=5,fly=false}={}) {
  const e=b.spawnEnemy('enemy_1007_slime',{pos:[y,x]});Object.assign(e.base,{maxHp:100000,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=100000;
  if(fly)e.motion='FLY';b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function cast(b,u) {u.skill.setSpTotal(u.skill.spCost);assert.equal(b.activateOperator(ID),true);}
function shot(b,u,e){performAttack(b,u,effectiveProfile(u),[e]);u.atkCd=1000;}
const outgoing=(rs,u)=>rs.filter(r=>r.source===u&&r.target.side==='enemy');
const incoming=(b,u,type='phys',source=null,rest={})=>b.dealDamage(source,u,{type,amount:1000,isAttack:true,applyWay:'ranged',...rest});

test('Lessing retains all source ranks, literal anti masks, original per-facing events and fidelity boundaries',()=>{
  assert.equal(source.source.bundles.length,5);assert.equal(source.frameParity,false);assert.equal(source.moduleSupport,false);
  assert.equal(Object.values(source.tables.skills).flatMap(s=>s.levels).length,30);
  assert.deepEqual(source.buffDatabase.resistable_abnormal_flag_anti.attributes.abnormalAntis,['STUNNED','COLD','FROZEN']);
  assert.deepEqual(source.buffDatabase.status_resistable_anti.attributes.abnormalFlags,['ANTI_STATUS_RESISTABLE']);
  assert.equal(source.buffDatabase.fear.statusResistable,'YES');assert.equal(source.buffDatabase.sleep.statusResistable,'AUTOMATIC');
  for(const f of ['Front','Back']){assert.equal(source.models[ID][f].sha256,source.officialSkeletonBindings[ID][f].sha256);assert.deepEqual(source.models[ID][f].hits.Skill_2_Loop,[.3,.567]);}
});
for(let skill=0;skill<3;skill++)for(let rank=1;rank<=10;rank++)test(`S${skill+1} rank${rank}: selected native cost, duration and damage`,()=>{
  const{b,u,receipts}=make({skill,rank}),e=enemy(b),atk=u.s.atk;
  const s=source.tables.skills[`skchr_lessng_${skill+1}`].levels[rank-1];near(u.skill.spCost,s.spData.spCost);
  if(skill===0){u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.activate('test'),true);}
  if(skill===2){cast(b,u);e.blockedBy=u;u.blocking=[e];}
  if(skill===1){assert.equal(u.skill.active,true);near(u.skill.duration,s.duration);}
  shot(b,u,e);advance(b,1.1);
  const hits=outgoing(receipts,u);assert.equal(hits.length,skill===1?2:1);
  for(const h of hits)near(h.amount,atk*(skill===0?s.blackboard[0].value:skill===2?s.blackboard.find(x=>x.key.endsWith('atk_scale')).value:1));
});
for(const dir of ['RIGHT','UP','LEFT','DOWN'])test(`S2 ${dir} uses distinct native subhits and preserves a single input`,()=>{
  const{b,u,receipts}=make({skill:1,dir}),e=enemy(b,{x:5,y:5});shot(b,u,e);advance(b,.334);
  assert.equal(outgoing(receipts,u).length,1);advance(b,.3);assert.equal(outgoing(receipts,u).length,2);
  const hits=outgoing(receipts,u);assert.ok(hits[1].time-hits[0].time>=.266-1e-6);assert.equal(hits[0].dmg.attackId,hits[1].dmg.attackId);
});
for(const action of ['stun','retreat','end','death'])test(`S2 ${action} cancels an unfired second subhit`,()=>{
  const{b,u,receipts}=make({skill:1}),e=enemy(b);shot(b,u,e);advance(b,.334);assert.equal(outgoing(receipts,u).length,1);
  if(action==='stun')b.applyStatus(u,'stun',{duration:1});else if(action==='retreat')b.retreat(u);else if(action==='end')u.skill.end('test');else b.kill(u);
  advance(b,.5);assert.equal(outgoing(receipts,u).length,1);
});
test('S2 does not replace a dead first victim with another enemy for its second hit',()=>{
  const{b,u,receipts}=make({skill:1}),a=enemy(b),z=enemy(b,{x:5.5});a.hp=1;shot(b,u,a);advance(b,1);
  assert.equal(a.alive,false);assert.equal(z.hp,z.s.maxHp);assert.equal(outgoing(receipts,u).length,1);
});
for(const elite of [0,1,2])for(const potential of [1,5,6])test(`E${elite} P${potential}: native talent eligibility and receipt expiry`,()=>{
  const{b,u}=make({elite,potential}),e=enemy(b);u.blocking=[e];e.blockedBy=u;
  const hp=u.hp;incoming(b,u,'arts');const reduction=elite===2?.35:elite===1?.2:0;near(hp-u.hp,1000*(1-reduction));
  near(u.s.atk/u.base.atk,elite===2?1+(potential>=5?.16:.12):1);
  advance(b,15.034);near(u.s.atk/u.base.atk,1);
});
test('Pain Focus requires blocking; excludes own blocked source and true damage; S2 scales selected reduction',()=>{
  const{b,u}=make({skill:1}),e=enemy(b),other=enemy(b,{x:7});
  near(incoming(b,u,'arts',other),1000);u.blocking=[e];e.blockedBy=u;
  near(incoming(b,u,'arts',other),1000*(1-.35*2.2));near(incoming(b,u,'arts',e),1000);near(incoming(b,u,'true',other),1000);
});
test('talent2 accepts shielded receipts and extends once; HPLOSS does not trigger it',()=>{
  const{b,u}=make();b.loseHp(u,1);assert.equal(u.findBuff('lessing:talent-atk'),null);
  b.addBuff(u,{key:'test:shield',shield:100000});incoming(b,u);const first=u.findBuff('lessing:talent-atk');assert.ok(first);
  advance(b,10);incoming(b,u);assert.equal(u.buffs.filter(x=>x.key==='lessing:talent-atk').length,1);advance(b,6);assert.ok(u.findBuff('lessing:talent-atk'));
  advance(b,9.034);assert.equal(u.findBuff('lessing:talent-atk'),null);
});
for(const status of ['stun','cold','freeze','fear'])test(`S3 cleanses ${status}, charges self-hit before maxHP and blocks new source statuses`,()=>{
  const{b,u,receipts}=make({skill:2});b.applyStatus(u,status,{duration:50});const hp=u.hp,max=u.s.maxHp;cast(b,u);
  const self=receipts.filter(r=>r.target===u);assert.equal(self.length,1);near(self[0].amount,600);assert.equal(self[0].dmg.noSp,true);
  assert.equal(u.findBuff(status),null);near(u.s.maxHp,max*2.1);near(u.hp,(hp-600)*2.1);
  assert.equal(b.applyStatus(u,status,{duration:2}),false);assert.equal(u.mem.lessingAnti,true);
  u.skill.end('test');assert.equal(u.mem.lessingAnti,false);near(u.s.maxHp,max);assert.equal(b.applyStatus(u,status,{duration:2}),true);
});
for(const status of ['sleep','bind','slow','sluggish','disarm'])test(`S3 does not guess native resistance for ordinary ${status}`,()=>{
  const{b,u,receipts}=make({skill:2});b.applyStatus(u,status,{duration:50});cast(b,u);
  assert.ok(u.findBuff(status));assert.equal(receipts.filter(r=>r.target===u).length,0);assert.equal(b.applyStatus(u,status,{duration:2}),true);
});
test('explicit source YES descriptors cleanse and refuse raw custom buffs; NO non-mask buffs survive',()=>{
  const{b,u,receipts}=make({skill:2});b.addBuff(u,{key:'test:fire',sourceStatusResistable:true,duration:30,mods:{atkPct:-.1}});
  b.addBuff(u,{key:'test:no',sourceStatusResistable:false,duration:30,flags:{bind:true}});cast(b,u);
  assert.equal(u.findBuff('test:fire'),null);assert.ok(u.findBuff('test:no'));assert.equal(receipts.filter(r=>r.target===u).length,1);
  assert.equal(b.addBuff(u,{key:'test:new-fire',sourceStatusResistable:true}),null);assert.equal(b.addBuff(u,{key:'test:raw-stun',flags:{stun:true}}),null);
  assert.ok(b.addBuff(u,{key:'test:unrelated',mods:{atkPct:-.1}}));
});
test('S3 self-hit can kill before cleanse/maxHP; ready SP is consumed and no immunity survives',()=>{
  const{b,u}=make({skill:2});u.hp=100;b.applyStatus(u,'stun',{duration:30});cast(b,u);
  assert.equal(u.alive,false);assert.equal(!!u.mem.lessingAnti,false);assert.equal(u.findBuff('lessing:max-hp'),null);
});
test('explicit YES metadata survives valued-status normalization before the cleanse',()=>{
  const{b,u}=make({skill:2});b.applyStatus(u,'slow',{duration:30,value:.5,sourceStatusResistable:true});
  assert.equal(u.findBuff('slow').sourceStatusResistable,true);cast(b,u);assert.equal(u.findBuff('slow'),null);
  assert.equal(b.applyStatus(u,'slow',{duration:2,value:.5,sourceStatusResistable:true}),false);
});
test('S3 self-hit receives current RES and ordinary shield mitigation',()=>{
  const{b,u,receipts}=make({skill:2});b.addBuff(u,{key:'test:res',mods:{resFlat:50}});b.addBuff(u,{key:'test:shield',shield:100});
  b.applyStatus(u,'cold',{duration:30});cast(b,u);near(receipts.find(r=>r.target===u).amount,200);
});
test('S3 blocked target scale accepts another ally blocker and removes the scale when released',()=>{
  const{b,u,receipts}=make({skill:2}),e=enemy(b);cast(b,u);const atk=u.s.atk;e.blockedBy={alive:true,deployed:true,s:u.s,blocking:[e]};
  shot(b,u,e);advance(b,.8);near(outgoing(receipts,u).at(-1).amount,atk*2.2);
  e.blockedBy=null;shot(b,u,e);advance(b,.8);near(outgoing(receipts,u).at(-1).amount,atk);
});
test('S1 selected enemy dying before emission refunds SP only if no replacement can be hit',()=>{
  const{b,u,receipts}=make(),e=enemy(b);u.skill.setSpTotal(u.skill.spCost);u.skill.activate('test');shot(b,u,e);b.kill(e);advance(b,1);
  assert.equal(outgoing(receipts,u).length,0);assert.equal(u.skill.ready,true);
});
test('S3 permit is scoped: S1 and ordinary operators cannot manually cast while stunned',()=>{
  const{b,u}=make();u.skill.setSpTotal(u.skill.spCost);b.applyStatus(u,'stun',{duration:2});assert.equal(b.activateOperator(ID),false);
});
test('S2 shows active deployment duration, then removes its gauge without a false recharge/ready state',()=>{
  const{b,u}=make({skill:1});assert.equal(skillHud(u.skill).state,'active');
  advance(b,24.034);assert.equal(u.skill.active,false);assert.equal(skillHud(u.skill),null);
  assert.equal(u.mem.regularFormVisual.clip,'Skill_2_End');advance(b,.2);assert.equal(u.mem.regularFormVisual,null);
});
