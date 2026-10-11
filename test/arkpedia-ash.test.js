// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import evidence from '../data/arkpedia-ash-prefabs.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild} from '../shared/arkpedia/loadout.js';
import {acquireTargets,effectiveProfile} from '../server/sim/ai.js';
import {dirVec} from '../server/sim/dir.js';
const ID='char_456_ash',near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps,`${a} != ${z}`);
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function make({skill=1,rank=10,elite=2,potential=1}={}){
  const src=structuredClone(data),op=src.operators[ID];src.stage.geometry.waves[0].spawns=[];src.stage.battle.dp_per_second=0;
  const build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,potential,skillId:op.skills[skill].id,skillRank:Math.min(rank,elite===0?4:elite===1?7:10)};
  const b=new StandardBattle(src,{operators:[build]});b.autoFinish=false;b.setViewport('fullscreen-workspace');
  b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
  const hits=[];b.on('damaged',ctx=>hits.push(ctx));
  const deploy=(dir='RIGHT')=>{b.getPlayer('arkpedia').dp=90;const u=b.deployOperator(ID,3,4,dir);assert.ok(u);u.atkCd=1000;u.skill.rule='NEVER';return u;};
  return{b,deploy,hits};
}
function enemy(b,{r=3,c=5,def=0,fly=false,heavy=true}={}){
  const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});Object.assign(e.base,{maxHp:100000,def,res:0,moveSpeed:0,massLevel:heavy?10:0});e.markDirty();void e.s;e.hp=100000;
  if(fly)e.motion='FLY';b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function cast(b,u){u.skill.setSpTotal(u.skill.spCost);if(u.skill.manual)assert.equal(b.activateOperator(ID),true);else{u.skill.rule='SP_FULL';advance(b,b.dt);assert.equal(u.skill.active,true);u.skill.rule='NEVER';}}
function shot(b,u,e){assert.equal(b.forceAttack(u,[e]),true);u.atkCd=1000;}

test('Ash preserves all30 rank rows, native projectile/charge contracts and original facing bytes',()=>{
  assert.equal(evidence.source.bundles.length,5);assert.equal(evidence.frameParity,false);assert.equal(evidence.moduleSupport,false);
  for(const s of data.operators[ID].skills)assert.deepEqual(s.levels,evidence.tables.skills[s.id].levels.map(l=>l.rangeId?{...l,rangeGrid:evidence.tables.ranges[l.rangeId].grids.map(p=>[p.row,p.col])}:l));
  for(const face of ['Front','Back']){
    const asset=data.sd.models[`operator/${ID}/default/${face.toLowerCase()}`].skeleton;
    const bytes=readFileSync(new URL('../../arkpedia-sd-assets/'+asset.path,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),evidence.officialSkeletonBindings[ID][face].sha256);
  }
  const root=evidence.skills.skchr_ash_3.flatMap(g=>g.components).find(c=>c.data._maxTriggerTime!=null).data;
  assert.equal(root._maxTriggerTime,2);assert.equal(evidence.runtimeMapping.s2.ammo,31);
  assert.equal(evidence.templates['ash_s_2[atk_scale]'].eventToActions.ON_CALCULATE_DAMAGE[0]._abnormalFlag,'STUNNED');
});
test('first-deployment E2 cost discount and selected SP apply once; failed placement does not consume them',()=>{
  for(const[elite,potential,sp]of [[0,1,0],[1,1,0],[2,1,17],[2,5,20]]){
    const{b,deploy}=make({skill:0,elite,potential}),def=b.data.getChess(ID),ordinary=def.stats.cost;
    near(b.cost(ID),ordinary-(elite===2?3:0));b.getPlayer('arkpedia').dp=0;
    assert.throws(()=>b.deployOperator(ID,3,4,'RIGHT'),/Not enough DP/);assert.equal(b.bench[ID].deployments,0);
    const u=deploy();near(u.skill.spTotal,u.def.skill.initSp+sp);near(b.bench[ID].lastCost,ordinary-(elite===2?3:0));
    b.retreatOperator(ID);advance(b,80);near(b.cost(ID),Math.floor(ordinary*1.5));
    const z=deploy();near(z.skill.spTotal,z.def.skill.initSp);
  }
});
test('deployment flash is selected3/4-second area stun including air, with no damage',()=>{
  for(const[elite,duration]of [[1,3],[2,4]]){
    const{b,deploy,hits}=make({skill:0,elite}),a=enemy(b),z=enemy(b,{c:5.5,fly:true}),outside=enemy(b,{c:7});deploy();
    advance(b,.2);assert.equal(!!a.s.flags.stun,false);advance(b,.4);
    assert.equal(a.s.flags.stun,true);assert.equal(z.s.flags.stun,true);assert.equal(!!outside.s.flags.stun,false);assert.equal(hits.length,0);
    advance(b,duration+.1);assert.equal(!!a.s.flags.stun,false);assert.equal(!!z.s.flags.stun,false);
  }
});
test('normal fire prioritizes air, keeps one input victim and has first-only native Begin delay',()=>{
  const{b,deploy,hits}=make({elite:0,skill:0}),u=deploy(),ground=enemy(b),air=enemy(b,{c:5.2,fly:true});
  assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[air]);shot(b,u,ground);advance(b,.29);assert.equal(hits.length,0);
  advance(b,.12);assert.equal(hits.length,1);near(hits[0].hpLoss,u.s.atk);assert.equal(hits[0].target,ground);near(air.hp,100000);
  near(effectiveProfile(u).windup(b,u,[ground]),0);ground.hidden=true;air.hidden=true;advance(b,.05);
  ground.hidden=false;near(effectiveProfile(u).windup(b,u,[ground]),.3);
});
test('S1 all10 ranks retain selected ATK, SP, unlimited duration and separate two-shot timing',()=>{
  for(let rank=1;rank<=10;rank++){
    const{b,deploy,hits}=make({skill:0,rank}),u=deploy(),s=u.def.skill,atk=u.s.atk;enemy(b);advance(b,.7);
    const e=b.enemies[0];cast(b,u);near(u.s.atk,atk*(1+s.bb.atk));near(u.skill.spCost,s.spCost);assert.equal(u.skill.active,true);
    shot(b,u,e);advance(b,.43);assert.equal(hits.length,1);advance(b,.08);assert.equal(hits.length,2);
    near(hits[0].hpLoss,u.s.atk);near(hits[1].hpLoss,u.s.atk);advance(b,50);assert.equal(u.skill.active,true);u.skill.end('test');near(u.s.atk,atk);
  }
});
test('normal and S1 use uncapped and capped first-Begin clocks with real Down variants',()=>{
  for(const dir of ['UP','RIGHT','DOWN','LEFT']){
    const{b,deploy}=make({skill:0}),u=deploy(dir),[dr,dc]=dirVec(dir),e=enemy(b,{r:3+dr,c:4+dc});
    b.addBuff(u,{key:'test:aspd',mods:{aspd:200}});near(effectiveProfile(u).windup(b,u,[e]),.1);
    cast(b,u);near(effectiveProfile(u).windup(b,u,[e]),.333/2);
    assert.equal(u.mem.ashAttackVisual.loop,dir==='DOWN'?'Skill_1_Loop_Down':'Skill_1_Loop');
  }
});
test('S1 unborn second bullet cancels on transient control while first born shot remains independent',()=>{
  const{b,deploy,hits}=make({skill:0}),u=deploy(),e=enemy(b,{c:7});advance(b,.7);cast(b,u);shot(b,u,e);advance(b,.34);
  b.applyStatus(u,'stun',{duration:.01});advance(b,.5);assert.equal(hits.length,1);
});
test('S2 all10 ranks use31 bullets and fractional attack interval; startup and no-target wait spend no ammo',()=>{
  for(let rank=1;rank<=10;rank++){
    const{b,deploy}=make({rank}),u=deploy(),interval=u.s.interval;cast(b,u);
    near(u.s.interval,interval*(1+u.def.skill.bb.base_attack_time));assert.equal(u.skill.ammoLeft,31);
    assert.equal(u.s.flags.disarm,true);advance(b,.9);assert.equal(!!u.s.flags.disarm,false);advance(b,3);assert.equal(u.skill.ammoLeft,31);
    assert.equal(b.activateOperator(ID),true);assert.equal(u.skill.active,false);near(u.s.interval,interval);
  }
});
test('S2 stun multiplier is physical pre-DEF and checks impact-time actual Stun, excluding Freeze/Levitate',()=>{
  for(const status of ['stun','freeze','levitate',null]){
    const{b,deploy,hits}=make(),u=deploy(),e=enemy(b,{def:300});advance(b,.7);cast(b,u);advance(b,5);
    if(status)b.applyStatus(e,status,{duration:1});shot(b,u,e);advance(b,.15);
    near(hits.at(-1).hpLoss,u.s.atk*(status==='stun'?2.5:1)-300);assert.equal(u.skill.ammoLeft,30);
  }
});
test('S2 reacts to stun gain and loss while a shot travels and retains the final born shot contract',()=>{
  const{b,deploy,hits}=make(),u=deploy(),e=enemy(b,{c:7});advance(b,.7);cast(b,u);advance(b,5);
  u.skill.ammoLeft=1;shot(b,u,e);assert.equal(u.skill.active,false);b.applyStatus(e,'stun',{duration:1});advance(b,.25);
  near(hits.at(-1).hpLoss,u.s.atk*2.5);
  cast(b,u);advance(b,.9);shot(b,u,e);for(const buff of [...e.buffs])if(buff.flags?.stun)b.removeBuff(e,buff.key);advance(b,.25);
  near(hits.at(-1).hpLoss,u.s.atk);
});
test('S2 consumes exactly31 released shots, ends when empty and can manually discard unused ammo',()=>{
  const{b,deploy,hits}=make(),u=deploy(),e=enemy(b);advance(b,.7);cast(b,u);advance(b,5);
  for(let n=0;n<31;n++){shot(b,u,e);advance(b,.1);if(n<30)assert.equal(u.skill.ammoLeft,30-n);}
  assert.equal(u.skill.active,false);assert.equal(hits.length,31);near(u.s.interval,u.base.bat*100/u.s.aspd);
  cast(b,u);advance(b,.9);assert.equal(b.activateOperator(ID),true);assert.equal(u.skill.active,false);assert.equal(u.skill.ammoLeft,0);
});
test('S3 all10 ranks preserve selected damage, two-use cap, cast clock and recovery lock',()=>{
  for(let rank=1;rank<=10;rank++){
    const{b,deploy,hits}=make({skill:2,rank}),u=deploy(),e=enemy(b,{c:8});advance(b,.7);
    const s=u.def.skill;cast(b,u);near(u.skill.timeLeft,1.3);advance(b,.5);assert.equal(hits.length,0);near(u.skill.spTotal,0);
    advance(b,.55);assert.equal(hits.length,2);near(hits[0].hpLoss,u.s.atk*s.bb.atk_scale);near(hits[1].hpLoss,u.s.atk*s.bb.not_hitwall_scale);
    advance(b,.35);assert.equal(u.skill.active,false);cast(b,u);advance(b,1.5);u.skill.setSpTotal(u.skill.spCost);assert.equal(b.activateOperator(ID),false);assert.equal(u.skill.exhausted,true);
  }
});
test('S3 ground-to-HIGH wall blast uses selected stronger scale at the boundary; HIGH emission does not',()=>{
  for(const raised of [false,true]){
    const{b,deploy,hits}=make({skill:2}),tile=b.grid.tile(3,6);tile.height='HIGH';
    if(raised)b.grid.tile(3,4).height='HIGH';const u=deploy(),e=enemy(b,{c:6.5});advance(b,.7);cast(b,u);advance(b,1.4);
    near(hits.at(-1).hpLoss,u.s.atk*(raised?4:8));assert.equal(hits.filter(h=>h.dmg.amount===u.s.atk*8).length,raised?0:1);
  }
});
test('S3 sweeps radius1.2 in every facing, ignores camouflage, hits air and pushes only displaceable bodies',()=>{
  for(const dir of ['UP','RIGHT','DOWN','LEFT']){
    const{b,deploy,hits}=make({skill:2}),u=deploy(dir),[dr,dc]=dirVec(dir),a=enemy(b,{r:3+dr,c:4+dc}),air=enemy(b,{r:3+2*dr,c:4+2*dc,fly:true}),miss=enemy(b,{r:3+dr+dc*1.21,c:4+dc+dr*1.21});
    advance(b,.7);b.addBuff(a,{key:'test:camou',flags:{camou:true}});cast(b,u);advance(b,1.4);
    assert.ok(hits.some(h=>h.target===a));assert.ok(hits.some(h=>h.target===air));near(miss.hp,100000);
  }
  const{b,deploy}=make({skill:2}),u=deploy(),e=enemy(b,{c:5,heavy:false});advance(b,.7);cast(b,u);advance(b,1.4);assert.ok(e.x>5);
});
test('S3 stop blast reads live occupancy separately from lane contacts and can damage the same enemy again',()=>{
  const{b,deploy,hits}=make({skill:2}),u=deploy(),e=enemy(b,{c:7.5});advance(b,.7);cast(b,u);advance(b,1.4);
  assert.equal(hits.filter(h=>h.target===e).length,2);near(hits[0].hpLoss,u.s.atk*3);near(hits[1].hpLoss,u.s.atk*4);
});
test('unborn S3 cancels without refund; born lane and stop blast survive source retirement',()=>{
  for(const born of [false,true]){
    const{b,deploy,hits}=make({skill:2}),u=deploy();enemy(b,{c:8});advance(b,.7);cast(b,u);advance(b,born?.7:.2);if(born)assert.equal(b.projectiles.list.length,1);
    b.retreatOperator(ID);advance(b,1.5);assert.equal(hits.length,born?2:0);assert.equal(u.mem.ashBreach,null);assert.equal(b.projectiles.list.length,0);
  }
});
test('sub-frame S3 control cancels the unborn projectile and fresh deployment restores two uses',()=>{
  const{b,deploy,hits}=make({skill:2}),u=deploy();enemy(b,{c:8});advance(b,.7);cast(b,u);advance(b,.2);
  b.applyStatus(u,'stun',{duration:.01});advance(b,1.5);assert.equal(hits.length,0);assert.equal(u.skill.activations,1);assert.equal(u.findBuff('ash:breach'),null);
  cast(b,u);advance(b,1.5);b.retreatOperator(ID);advance(b,80);const z=deploy();assert.equal(z.skill.activations,0);assert.equal(z.skill.exhausted,false);
});
