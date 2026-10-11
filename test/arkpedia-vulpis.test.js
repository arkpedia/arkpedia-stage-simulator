// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import evidence from '../data/arkpedia-vulpis-prefabs.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild} from '../shared/arkpedia/loadout.js';
import {battleHud} from '../shared/arkpedia/battle-hud.js';
import {acquireTargets,effectiveProfile} from '../server/sim/ai.js';
import {canTargetAlly} from '../server/sim/targeting.js';
import {dirVec} from '../server/sim/dir.js';
const ID='char_4026_vulpis',near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps,`${a} != ${z}`);
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function make({skill=0,rank=10,elite=2,potential=1,dpRate=0}={}){
 const src=structuredClone(data),op=src.operators[ID];src.stage.geometry.waves[0].spawns=[];src.stage.battle.dp_per_second=dpRate;
 const build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,potential,skillId:op.skills[skill].id,skillRank:Math.min(rank,elite===0?4:elite===1?7:10)};
 const b=new StandardBattle(src,{operators:[build]});b.autoFinish=false;b.setViewport('fullscreen-workspace');
 b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 const hits=[];b.on('damaged',ctx=>hits.push(ctx));
 const deploy=(r=3,c=4,dir='RIGHT')=>{b.getPlayer('arkpedia').dp=90;const u=b.deployOperator(ID,r,c,dir);assert.ok(u);u.atkCd=1000;u.skill.rule='NEVER';return u;};
 return{b,deploy,hits};
}
function enemy(b,{r=3,c=5,def=0,res=0,fly=false,hp=100000}={}){
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});Object.assign(e.base,{maxHp:hp,def,res,moveSpeed:0,massLevel:10});e.markDirty();void e.s;e.hp=hp;
 if(fly)e.motion='FLY';b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function cast(b,u,total=u.skill.spCost){u.skill.setSpTotal(total);assert.equal(b.activateOperator(ID),true);}
function shot(b,u,e,{skill=false}={}){
 if(skill){u.skill.setSpTotal(u.skill.spCost);u.skill.rule='DEFAULT';assert.equal(u.skill.activate('DEFAULT'),true);}
 assert.equal(b.forceAttack(u,[e]),true);u.atkCd=1000;u.skill.rule='NEVER';
}
const outputs=(hits,u)=>hits.filter(h=>h.source===u && h.type!=='element');

test('Vulpisfoglia retains all30 ranks, source selector/dispatch boundaries and both actual native facing bytes',()=>{
 assert.equal(evidence.frameParity,false);assert.equal(evidence.moduleSupport,false);assert.equal(evidence.source.bundles.length,5);
 for(const s of data.operators[ID].skills)assert.deepEqual(s.levels,evidence.tables.skills[s.id].levels.map(l=>l.rangeId?{...l,rangeGrid:evidence.tables.ranges[l.rangeId].grids.map(p=>[p.row,p.col])}:l));
 for(const face of ['Front','Back']){
  const asset=data.sd.models[`operator/${ID}/default/${face.toLowerCase()}`].skeleton;
  const bytes=readFileSync(new URL('../../arkpedia-sd-assets/'+asset.path,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),evidence.officialSkeletonBindings[ID][face].sha256);
 }
 const t=evidence.templates.vulpis_t_1.eventToActions.ON_OUTPUT_MODIFIER;
 assert.equal(t.find(n=>n._attackTypeFilter)._attackTypeFilter,'ADDITION');
 assert.equal(t.find(n=>n._atkScaleVar)._attackType,'ADDITION');
 assert.equal(evidence.templates['vulpis_s_1[damage]'].eventToActions.ON_BUFF_START[0]._attackType,'NORMAL');
 assert.deepEqual(Object.keys(evidence.templates.vulpis_s_3.eventToActions),['ON_BUFF_START','ON_BUFF_FINISH','ON_BEFORE_ATTACK']);
});
test('Fox Hunt includes the first hit at selected elite, independently mitigates Arts and never recursively adds riders',()=>{
 for(const[elite,ratio]of [[0,0],[1,.2],[2,.3]]){
  const{b,deploy,hits}=make({elite}),u=deploy(),e=enemy(b,{def:100,res:30});shot(b,u,e);advance(b,.6);
  const out=outputs(hits,u);assert.equal(out.length,ratio?2:1);assert.equal(out.at(-1).type,'phys');near(out.at(-1).hpLoss,u.s.atk-100);
  if(ratio){assert.equal(out[0].type,'arts');near(out[0].hpLoss,u.s.atk*ratio*.7);assert.ok(out[0].dmg.tags.includes('addition'));}
 }
});
test('Fox Hunt window is per victim and deployment, does not refresh, and unrelated sources cannot share it',()=>{
 const{b,deploy,hits}=make(),u=deploy(),a=enemy(b),z=enemy(b,{c:5.1});
 b.dealDamage(u,a,{amount:10,type:'true'});advance(b,9);b.dealDamage(u,a,{amount:10,type:'true'});
 b.dealDamage(u,z,{amount:10,type:'true'});advance(b,1.1);const n=outputs(hits,u).length;
 b.dealDamage(u,a,{amount:10,type:'true'});assert.equal(outputs(hits,u).length,n+1);
 b.dealDamage(u,z,{amount:10,type:'true'});assert.equal(outputs(hits,u).length,n+3);
 b.dealDamage(u,a,{amount:10,type:'true',tags:['addition']});assert.equal(outputs(hits,u).length,n+4);
 b.retreatOperator(ID);assert.equal(a.buffs.some(x=>x.key.startsWith('vulpis:hunt:')),false);assert.equal(z.buffs.some(x=>x.key.startsWith('vulpis:hunt:')),false);
 b.bench[ID].readyAt=b.time;const v=deploy();const before=outputs(hits,v).length;b.dealDamage(v,a,{amount:10,type:'true'});assert.equal(outputs(hits,v).length,before+2);
});
test('accepted shielded/zero parent damage can hunt; dodge, cancellation, HP loss and element gauge do not',()=>{
 const{b,deploy,hits}=make(),u=deploy(),e=enemy(b);
 b.addBuff(e,{key:'test:shield',shield:100000});b.dealDamage(u,e,{amount:0,type:'arts'});assert.equal(outputs(hits,u).length,2);near(e.hp,100000);
 const before=outputs(hits,u).length;b.loseHp(e,10,{source:u});b.dealDamage(u,e,{amount:10,type:'element',element:'erosion'});assert.equal(outputs(hits,u).length,before+1);
 b.addBuff(e,{key:'test:dodge',mods:{dodgePhys:1}});b.dealDamage(u,e,{amount:10,type:'phys'});assert.equal(outputs(hits,u).length,before+1);
 b.on('hit',ctx=>{if(ctx.source===u&&ctx.dmg.tags.includes('test:cancel'))ctx.dmg.cancel=true;});
 b.dealDamage(u,e,{amount:10,type:'arts',tags:['test:cancel']});assert.equal(outputs(hits,u).length,before+1);
 b.removeBuff(e,'test:shield');b.addBuff(e,{key:'test:arts-dodge',mods:{dodgeArts:1}});b.dealDamage(u,e,{amount:10,type:'true'});
 assert.equal(outputs(hits,u).length,before+2);near(e.hp,100000-20);
});
test('Accelerando scales actual natural DP and its HUD only while live, retains cap, and zero recovery stays zero',()=>{
 for(const elite of [0,1,2])for(const dpRate of [0,.5,1]){
  const{b,deploy}=make({elite,dpRate}),u=deploy(),expected=dpRate*(elite===2?1.1:1);
  near(b.dpRecoveryRateFor(),expected);const before=b.dp;advance(b,2);near(b.dp,before+expected*2);
  assert.equal(battleHud(b,false).recoveryText,expected?`+${expected} DP/s`:'No recovery');
  b.getPlayer('arkpedia').dp=98.99;advance(b,2);assert.ok(b.dp<=99);if(expected)near(b.dp,99);
  b.retreatOperator(ID);near(b.dpRecoveryRateFor(),dpRate);assert.equal(u.alive,false);
 }
});
test('Accelerando begins a4s deployment quiet period then adds continuous selected potential regeneration',()=>{
 for(const[elite,potential,ratio]of [[0,1,0],[1,1,0],[2,1,.04],[2,5,.05]]){
  const{b,deploy}=make({elite,potential}),u=deploy();u.hp=u.s.maxHp*.5;const hp=u.hp;advance(b,3.9);near(u.hp,hp);
  advance(b,.2);near(u.s.hpRegen,ratio*u.s.maxHp);
  const start=u.hp;advance(b,1);near(u.hp-start,ratio*u.s.maxHp,1.1);
 }
});
test('shielded and zero accepted damage reset quiet recovery; dodge, HP loss and gauge accumulation leave it running',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b);u.hp=u.s.maxHp*.5;advance(b,4.1);assert.ok(u.findBuff('vulpis:regen'));
 for(const shield of [false,true]){
  if(shield)b.addBuff(u,{key:'test:shield',shield:100000});
  b.dealDamage(e,u,{amount:shield?100:0,type:'arts'});assert.equal(u.findBuff('vulpis:regen'),null);advance(b,3.9);assert.equal(u.findBuff('vulpis:regen'),null);advance(b,.2);assert.ok(u.findBuff('vulpis:regen'));
 }
 b.addBuff(u,{key:'test:dodge',mods:{dodgePhys:1}});b.dealDamage(e,u,{amount:100,type:'phys'});assert.ok(u.findBuff('vulpis:regen'));
 b.loseHp(u,100,{source:e});b.dealDamage(e,u,{amount:10,type:'element',element:'erosion'});assert.ok(u.findBuff('vulpis:regen'));
 b.retreatOperator(ID);assert.equal(u.findBuff('vulpis:regen'),null);
});
test('normal and S1 use capped literal facing windups and one original victim, with no attack-SP recovery',()=>{
 for(const dir of ['UP','RIGHT','DOWN','LEFT'])for(const bonus of [-50,0,200]){
  const{b,deploy,hits}=make({elite:0}),u=deploy(3,4,dir),[dr,dc]=dirVec(dir),e=enemy(b,{r:3+dr,c:4+dc});
  b.addBuff(u,{key:'test:aspd',mods:{aspd:bonus}});const playback=Math.min(1,u.s.aspd/100);near(effectiveProfile(u).windup(b,u,[e]),.5/playback);
  const sp=u.skill.spTotal;shot(b,u,e);advance(b,.5/playback+.1);assert.equal(outputs(hits,u).length,1);near(u.skill.spTotal,sp+.5/playback+.1,1e-5);
 }
 const{b,deploy,hits}=make({elite:0}),u=deploy(),e=enemy(b),other=enemy(b,{c:5.1});shot(b,u,e);b.kill(e,null);advance(b,.6);assert.equal(outputs(hits,u).length,0);near(other.hp,100000);
});
test('S1 all10 ranks spend one of3 charges, grant1DP, and separately mitigate NORMAL Arts plus Physical',()=>{
 for(let rank=1;rank<=10;rank++){
  const{b,deploy,hits}=make({rank}),u=deploy(),e=enemy(b,{def:100,res:30});u.skill.setSpTotal(u.skill.spCost*3);u.skill.rule='DEFAULT';assert.equal(u.skill.activate('DEFAULT'),true);
  const before=b.dp;assert.equal(b.forceAttack(u,[e]),true);u.atkCd=1000;u.skill.rule='NEVER';near(b.dp,before+1);assert.equal(u.skill.charges,2);
  advance(b,.53);assert.equal(outputs(hits,u).length,0);advance(b,.1);
  const out=outputs(hits,u);assert.equal(out.length,4);assert.deepEqual(out.map(x=>x.type),['arts','arts','arts','phys']);
  near(out[0].hpLoss,u.s.atk*.3*.7);near(out[1].hpLoss,u.s.atk*u.def.skill.bb.extra_damage_ratio*.7);near(out[2].hpLoss,u.s.atk*.3*.7);near(out[3].hpLoss,u.s.atk-100);
  advance(b,1);assert.equal(u.mem.vulpisCast,null);assert.equal(u.findBuff('vulpis:cast'),null);assert.equal(u.skill.active,false);
 }
});
test('S1 wholly dead input refunds only an un-emitted charge, retains committed DP, and does not retarget',()=>{
 const{b,deploy,hits}=make(),u=deploy(),e=enemy(b),other=enemy(b,{c:5.1}),before=b.dp;shot(b,u,e,{skill:true});advance(b,.2);b.kill(e,null);advance(b,.5);
 assert.equal(outputs(hits,u).length,0);near(u.skill.spTotal,u.skill.spCost+.1);near(b.dp,before+1);near(other.hp,100000);assert.equal(u.mem.vulpisCast,null);
 const next=enemy(b,{hp:1});shot(b,u,next,{skill:true});advance(b,.7);assert.equal(next.alive,false);near(u.skill.spTotal,0);
});
test('S2 all10 ranks keep2 charges, grant selected DP, cap6 including air, and separate Arts and hunt receipts',()=>{
 for(let rank=1;rank<=10;rank++){
  const{b,deploy,hits}=make({skill:1,rank}),u=deploy(),bb=u.def.skill.bb;
  const victims=Array.from({length:8},(_,i)=>enemy(b,{c:5+i*.01,res:30,fly:i===0})),before=b.dp;cast(b,u,u.skill.spCost*2);near(b.dp,before+bb.cost);assert.equal(u.skill.charges,1);
  advance(b,.067);assert.equal(outputs(hits,u).length,0);advance(b,.1);assert.equal(outputs(hits,u).length,12);
  const struck=[...new Set(outputs(hits,u).map(x=>x.target))];assert.equal(struck.length,6);assert.ok(struck.includes(victims[0]));
  for(const e of struck){const out=outputs(hits,u).filter(x=>x.target===e);near(out[0].hpLoss,u.s.atk*.3*.7);near(out[1].hpLoss,u.s.atk*bb.atk_scale*.7);assert.ok(e.findBuff('sluggish'));assert.equal(!!e.s.flags.stun,false);}
  advance(b,1.3);assert.equal(u.skill.active,false);assert.equal(u.mem.vulpisCast,null);assert.equal(u.skill.charges,1);
 }
});
test('S2 stuns only previously named Sluggish, not generic movement reduction; a second charged cast can stun',()=>{
 const{b,deploy}=make({skill:1}),u=deploy(),a=enemy(b),z=enemy(b,{c:5.1}),other=enemy(b,{c:5.2});
 b.applyStatus(a,'sluggish',{duration:10,source:u});b.addBuff(z,{key:'test:slow',mods:{moveSpeedMul:.2}});cast(b,u);advance(b,.2);
 assert.equal(a.s.flags.stun,true);assert.equal(!!z.s.flags.stun,false);assert.equal(!!other.s.flags.stun,false);advance(b,1.2);
 cast(b,u);advance(b,.2);assert.equal(z.s.flags.stun,true);assert.equal(other.s.flags.stun,true);
});
test('S2 empty cast still spends charge and gains DP; native range rotates and excludes stealth/outside victims',()=>{
 const{b,deploy,hits}=make({skill:1}),u=deploy(),before=b.dp;cast(b,u);advance(b,1.3);assert.equal(outputs(hits,u).length,0);near(b.dp,before+u.def.skill.bb.cost);assert.equal(u.skill.charges,0);
 for(const dir of ['UP','RIGHT','DOWN','LEFT']){
  const{b,deploy,hits}=make({skill:1}),u=deploy(3,4,dir),[dr,dc]=dirVec(dir),a=enemy(b,{r:3+dr,c:4+dc}),z=enemy(b,{r:3-dr*2,c:4-dc*2}),hide=enemy(b,{r:3+dr,c:4+dc+.01});
  b.addBuff(hide,{key:'test:stealth',flags:{stealth:true}});cast(b,u);advance(b,.2);
  assert.equal(outputs(hits,u).filter(x=>x.target===a).length,2);near(z.hp,100000);near(hide.hp,100000);
 }
});
test('S1/S2 unborn output cancels on brief accepted control or retirement without stranded locks or extra refunds',()=>{
 for(const skill of [0,1])for(const reason of ['control','retreat','death']){
  const{b,deploy,hits}=make({skill}),u=deploy(),e=enemy(b);if(skill===0)shot(b,u,e,{skill:true});else cast(b,u);
  if(reason==='control')b.applyStatus(u,'stun',{duration:.01});else if(reason==='retreat')b.retreatOperator(ID);else b.kill(u,null);
  advance(b,2);assert.equal(outputs(hits,u).length,0);assert.equal(u.skill.charges,0);assert.equal(u.mem.vulpisCast,null);assert.equal(u.findBuff('vulpis:cast'),null);assert.equal(u.mem.regularFormVisual,null);
 }
});
test('S3 all10 ranks grant DP, extend range, add source ATK, sample decaying ASPD before attacks and last exactly10s',()=>{
 for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make({skill:2,rank}),u=deploy(),bb=u.def.skill.bb,before=b.dp;cast(b,u);near(b.dp,before+bb.cost);near(u.s.atk,u.base.atk*(1+bb.atk));near(u.s.aspd,100+bb.attack_speed);
  advance(b,5);near(u.s.aspd,100+bb.attack_speed);const e=enemy(b,{c:6});assert.ok(acquireTargets(b,u,effectiveProfile(u)).includes(e));shot(b,u,e);near(u.s.aspd,100+bb.attack_speed*.5);
  advance(b,4.9);assert.equal(u.skill.active,true);advance(b,.2);assert.equal(u.skill.active,false);near(u.s.atk,u.base.atk);near(u.s.aspd,100);assert.equal(u.s.blockCnt,2);assert.equal(!!u.s.flags.camou,false);
 }
});
test('S3 native Block-stat target cap hits two unblocked in-range victims and prioritizes actual blocked enemies',()=>{
 const{b,deploy,hits}=make({skill:2}),u=deploy(),a=enemy(b,{c:5}),z=enemy(b,{c:6}),other=enemy(b,{c:5.5}),air=enemy(b,{c:5,fly:true});cast(b,u);advance(b,.2);
 const p=effectiveProfile(u),targets=acquireTargets(b,u,p);assert.equal(targets.length,2);assert.ok(!targets.includes(air));assert.equal(u.blocking.length,0);
 assert.equal(b.forceAttack(u,targets),true);u.atkCd=1000;advance(b,.9);assert.equal(outputs(hits,u).length,4);
 for(const e of targets){assert.ok(outputs(hits,u).some(x=>x.target===e));assert.ok(e.findBuff('stun'));}
 const outside=enemy(b,{r:3,c:3});outside.blockedBy=u;u.blocking=[outside];const selected=acquireTargets(b,u,effectiveProfile(u));assert.ok(selected.includes(outside));assert.equal(selected.length,2);
 b.addBuff(u,{key:'test:block',mods:{blockCnt:1}});assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,3);
 near(air.hp,100000);assert.ok([a,z,other].some(e=>e.hp===100000));
});
test('S3 uses the actual DOWN clip and Back UP clip, original capped hit time and no invented end gameplay lock',()=>{
 for(const dir of ['UP','RIGHT','DOWN','LEFT']){
  const{b,deploy,hits}=make({skill:2}),u=deploy(3,4,dir),[dr,dc]=dirVec(dir),e=enemy(b,{r:3+dr,c:4+dc});cast(b,u);advance(b,.2);shot(b,u,e);
  const clip=dir==='DOWN'?'Skill_Down_3_Loop':'Skill_3_Loop';assert.equal(u.mem.vulpisAttackVisual,clip);near(effectiveProfile(u).windup(b,u,[e]),.833);advance(b,.8);assert.equal(outputs(hits,u).length,0);advance(b,.1);assert.equal(outputs(hits,u).length,2);
  advance(b,9);assert.equal(u.skill.active,false);assert.equal(!!u.s.flags.disarm,false);assert.equal(!!u.s.flags.noSp,false);assert.equal(u.profile.canAttack(),true);
 }
});
test('S3 kill-earned camouflage disappears while blocking and returns on original half-second checks until next cast',()=>{
 const{b,deploy}=make({skill:2}),u=deploy(),e=enemy(b,{hp:1});cast(b,u);advance(b,.2);shot(b,u,e);advance(b,10);assert.equal(e.alive,false);assert.equal(u.s.flags.camou,true);
 const other=enemy(b,{c:7});other.profile.attack='ranged';assert.equal(canTargetAlly(other,u,true),false);
 const blocked=enemy(b,{c:4.2});advance(b,.6);assert.equal(blocked.blockedBy,u);assert.equal(!!u.s.flags.camou,false);assert.equal(u.mem.vulpisCam,true);
 b.kill(blocked,null);advance(b,.6);assert.equal(u.s.flags.camou,true);cast(b,u);assert.equal(!!u.s.flags.camou,false);assert.equal(u.mem.vulpisCam,false);advance(b,10.2);assert.equal(!!u.s.flags.camou,false);
});
test('S3 other-source kills do not earn camouflage; retirement clears ASPD, visuals and natural DP modifiers',()=>{
 const{b,deploy}=make({skill:2,dpRate:1}),u=deploy(),e=enemy(b);cast(b,u);b.kill(e,null);advance(b,10.2);assert.equal(!!u.s.flags.camou,false);
 cast(b,u);b.retreatOperator(ID);advance(b,2);assert.equal(u.findBuff('vulpis:aspd'),null);assert.equal(u.findBuff('vulpis:cam-check'),null);assert.equal(u.mem.regularFormVisual,null);near(b.dpRecoveryRateFor(),1);
 b.bench[ID].readyAt=b.time;const z=deploy();assert.notEqual(z,u);assert.equal(z.skill.activations,0);assert.equal(!!z.s.flags.camou,false);near(b.dpRecoveryRateFor(),1.1);
});
test('ordinary AI activates S1 without intervention, keeps finite ready charges and never applies inherited mode modules',()=>{
 const{b,deploy,hits}=make(),u=deploy(),e=enemy(b);u.skill.rule='DEFAULT';u.atkCd=0;advance(b,3.2);
 assert.ok(u.skill.activations>=2);assert.ok(outputs(hits,u).length>=8);assert.equal(u.s.blockCnt,2);assert.ok(Number.isFinite(u.skill.spTotal));assert.ok(u.skill.charges>=0&&u.skill.charges<=3);
 assert.ok(!u.buffs.some(x=>x.key.includes('module')));assert.ok(e.hp<100000);
});
