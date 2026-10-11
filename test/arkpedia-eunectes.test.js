// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-eunectes-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
const ID='char_416_zumama';
const near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps,`${a} != ${z}`);
function advance(b,seconds){for(let i=0;i<Math.ceil(seconds/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function make({skill=0,rank=10,elite=2,potential=1}={}){
  const src=structuredClone(data),op=src.operators[ID];src.stage.geometry.waves[0].spawns=[];
  const build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,potential,
    skillId:op.skills[skill].id,skillRank:Math.min(rank,elite===0?4:elite===1?7:10)};
  const b=new StandardBattle(src,{operators:[build]});b.autoFinish=false;b.setViewport('fullscreen-workspace');
  b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
  const hits=[];b.on('damaged',ctx=>hits.push(ctx));
  const deploy=(r=3,c=4,dir='RIGHT')=>{b.getPlayer('arkpedia').dp=80;
    const u=b.deployOperator(ID,r,c,dir);assert.ok(u);u.atkCd=1000;u.skill.rule='NEVER';return u;};
  return{b,deploy,hits};
}
function enemy(b,{r=3,c=5,hp=100000,def=0,fly=false}={}){
  const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});
  Object.assign(e.base,{maxHp:hp,def,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=hp;
  if(fly)e.motion='FLY';b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function hold(b,u,e){e.blockedBy=u;u.blocking.push(e);b.emit('blocked',{blocker:u,enemy:e});}
function cast(b,u){u.skill.setSpTotal(u.skill.spCost);assert.equal(b.activateOperator(ID),true);}
const own=(hits,u)=>hits.filter(h=>h.source===u&&h.target.side==='enemy');

test('Eunectes retains30 selected source ranks and both actual skeleton identities',()=>{
  assert.equal(evidence.frameParity,false);assert.equal(evidence.source.bundles.length,5);
  for(const s of data.operators[ID].skills)assert.deepEqual(s.levels,evidence.tables.skills[s.id].levels);
  for(const face of ['Front','Back']){
    const asset=data.sd.models[`operator/${ID}/default/${face.toLowerCase()}`].skeleton;
    const raw=readFileSync(new URL('../../arkpedia-sd-assets/'+asset.path,import.meta.url));
    assert.equal(createHash('sha256').update(raw).digest('hex'),evidence.officialSkeletonBindings[ID][face].sha256);
  }
  assert.deepEqual(evidence.models[ID].Front.hits.Skill_2_Loop,[.567]);
  assert.equal(evidence.models[ID].Back.durations.Skill_2_Begin,undefined);
  assert.equal(evidence.models[ID].Front.hits.Skill_2_Begin,undefined);
});
test('unblocked Eunectes retains source initial SP but cannot gain natural, attack or gift SP',()=>{
  for(const skill of [1,2]){
    const {b,deploy}=make({skill}),u=deploy();near(u.skill.spTotal,u.skill.initSp);
    const before=u.skill.spTotal;advance(b,2);near(u.skill.spTotal,before);
    near(u.skill.gainSp(5,'gift'),0);near(u.skill.gainSp(5,'attack'),0);near(u.skill.spTotal,before);
    assert.equal(u.s.flags.noSp,true);
  }
});
test('live block gates all SP, with promotion-selected Resilience and stale-array protection',()=>{
  for(const [elite,rate]of [[1,1],[2,1.2]]){
    const {b,deploy}=make({skill:1,elite}),u=deploy(),e=enemy(b);hold(b,u,e);
    u.skill.setSpTotal(0);advance(b,1);near(u.skill.spTotal,rate);
    near(u.skill.gainSp(3,'gift'),3);near(u.skill.spTotal,rate+3);
    e.blockedBy=null;near(u.skill.gainSp(3,'gift'),0);advance(b,1);near(u.skill.spTotal,rate+3);
    assert.equal(u.s.flags.noSp,true);
  }
});
test('S1 all ranks are deployment passives with additive ATK/DEF and no skill gauge',()=>{
  for(let rank=1;rank<=10;rank++){
    const {b,deploy}=make({rank}),u=deploy(),bb=u.def.skill.bb;
    near(u.s.atk,u.base.atk*(1+bb.atk));near(u.s.def,u.base.def*(1+bb.def));
    assert.equal(u.skill.kind,'passive');near(u.skill.spTotal,0);assert.equal(b.activateOperator(ID),false);
    near(u.s.blockCnt,1);advance(b,.2);
  }
});
test('Peerless Bravery samples .1seconds and separates damage at high HP from Sanctuary at LE half HP',()=>{
  for(const [elite,potential,scale,cut]of [[0,1,1,0],[1,1,1.08,.1],[1,5,1.1,.12],[2,1,1.15,.2],[2,5,1.17,.22]]){
    const {b,deploy}=make({elite,potential}),u=deploy(),e=enemy(b,{def:100});
    advance(b,.2);b.dealDamage(u,e,{amount:1000,type:'phys'});near(100000-e.hp,1000*scale-100);
    u.hp=u.s.maxHp*.5;advance(b,.2);near(u.mem.eunectesScale??1,1);
    const before=u.hp;b.dealDamage(e,u,{amount:1000,type:'arts'});near(before-u.hp,1000*(1-cut));
    const hp=u.hp;b.dealDamage(e,u,{amount:100,type:'true'});near(hp-u.hp,100);
    b.heal(u,u,u.s.maxHp,{self:true});advance(b,.2);assert.equal(u.findBuff('eunectes:sanctuary'),null);
  }
});
test('Bravery Sanctuary keeps the strongest shared status and never reduces direct HP loss',()=>{
  const {b,deploy}=make(),u=deploy();u.hp=u.s.maxHp*.5;advance(b,.2);
  b.applyStatus(u,'sanctuary',{key:'test:other-sanctuary',value:.4,duration:5});
  const e=enemy(b),before=u.hp;b.dealDamage(e,u,{amount:100,type:'arts'});near(before-u.hp,60);
  const hp=u.hp;b.loseHp(u,100);near(hp-u.hp,100);
  b.heal(u,u,u.s.maxHp,{self:true});advance(b,.2);assert.ok(u.findBuff('test:other-sanctuary'));
});
test('normal attacks select one ground victim and use literal uncapped directional hit events',()=>{
  for(const dir of ['UP','DOWN','RIGHT','LEFT'])for(const aspd of [-50,0,100]){
    const {b,deploy,hits}=make(),u=deploy(3,4,dir),e=enemy(b);
    b.addBuff(u,{key:'test:aspd',mods:{aspd}});const p=effectiveProfile(u);
    near(p.windup(b,u),.467/(u.s.aspd/100));
    assert.equal(b.forceAttack(u,[e]),true);advance(b,.467/(u.s.aspd/100)+.1);assert.equal(own(hits,u).length,1);
  }
  const {b,deploy}=make(),u=deploy(),e=enemy(b),air=enemy(b,{c:5.1,fly:true}),z=enemy(b,{c:5.2});
  assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[e]);assert.ok(air.alive&&z.alive);
});
test('S2 all ranks apply exact ATK and additive interval with selected source duration',()=>{
  for(let rank=1;rank<=10;rank++){
    const {b,deploy}=make({skill:1,rank}),u=deploy();cast(b,u);
    near(u.s.atk,u.base.atk*(1+u.def.skill.bb.atk));near(u.s.bat,u.base.bat+u.def.skill.bb.base_attack_time);
    near(u.skill.timeLeft,u.def.skill.duration);
    advance(b,u.def.skill.duration+.1);assert.equal(u.skill.active,false);near(u.s.atk,u.base.atk);
  }
});
test('S2 owns only blocked-victim stuns, adds new blockees and respects immune targets',()=>{
  const {b,deploy}=make({skill:1}),u=deploy(),e=enemy(b),z=enemy(b,{c:5.1}),f=enemy(b,{c:5.2});
  f.def={...f.def,immune:new Set(['stun'])};hold(b,u,e);cast(b,u);
  assert.equal(e.s.flags.stun,true);assert.equal(z.s.flags.stun,false);
  hold(b,u,z);assert.equal(z.s.flags.stun,true);hold(b,u,f);assert.equal(f.s.flags.stun,false);
  b.applyStatus(e,'stun',{key:'test:other-stun',duration:30});b._unblock(e);advance(b,.1);
  assert.equal(e.findBuff(`eunectes:blocked:${u.id}`),null);assert.ok(e.findBuff('test:other-stun'));
  u.skill.end('test');assert.equal(z.s.flags.stun,false);assert.ok(e.findBuff('test:other-stun'));
});
test('S2 attack cap follows current Block and reselects targets at the actual Skill .633event',()=>{
  const {b,deploy,hits}=make({skill:1}),u=deploy(),e=enemy(b),z=enemy(b,{c:5.1}),f=enemy(b,{c:5.2});cast(b,u);
  b.addBuff(u,{key:'test:block',mods:{blockCnt:1}});const p=effectiveProfile(u);
  near(p.windup(b,u),.633);assert.equal(acquireTargets(b,u,p).length,2);
  assert.equal(b.forceAttack(u,[e,z]),true);b.kill(e,null);advance(b,.7);
  assert.deepEqual(new Set(own(hits,u).map(h=>h.target)),new Set([z,f]));
});
test('withdrawal and crowd control release S2 stuns and stop blocking SP',()=>{
  const {b,deploy}=make({skill:1}),u=deploy(),e=enemy(b);hold(b,u,e);cast(b,u);
  b.applyStatus(u,'stun',{duration:1});advance(b,.1);assert.equal(e.s.flags.stun,false);assert.equal(u.s.flags.noSp,true);
  advance(b,1.1);hold(b,u,e);assert.equal(e.s.flags.stun,true);
  b.retreatOperator(ID);assert.equal(e.s.flags.stun,false);assert.equal(e.blockedBy,null);
});
test('S3 all ranks grants exact early stats, three Block, continuous regeneration and bounded Begin+mode duration',()=>{
  for(let rank=1;rank<=10;rank++){
    const {b,deploy}=make({skill:2,rank}),u=deploy(3,4,'UP');u.hp=1000;cast(b,u);
    const bb=u.def.skill.bb;near(u.s.atk,u.base.atk*(1+bb.atk));near(u.s.def,u.base.def*(1+bb.def));near(u.s.blockCnt,3);
    assert.equal(u.mem.regularFormVisual.forceFront,true);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Begin');
    near(u.skill.timeLeft,u.def.skill.duration+1.5);const hp=u.hp;
    advance(b,.5);near(u.hp-hp,u.s.maxHp*bb.hp_recovery_per_sec_by_max_hp_ratio*.5);
    assert.ok(u.mem.eunectesTransform);advance(b,1.1);assert.equal(u.mem.eunectesTransform,null);
    assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Idle');
  }
});
test('S3 transformation cancels source-mapped stun/freeze/silence only during Begin',()=>{
  const {b,deploy}=make({skill:2}),u=deploy();cast(b,u);
  for(const status of ['stun','freeze','silence'])assert.equal(b.applyStatus(u,status,{duration:1}),false);
  assert.equal(b.applyStatus(u,'bind',{duration:.2}),true);advance(b,1.6);
  assert.equal(b.applyStatus(u,'stun',{duration:1}),true);
});
test('S3 front/down attack clocks, cap and release exclude air and respect attack cancellation',()=>{
  for(const dir of ['UP','DOWN','RIGHT','LEFT']){
    const {b,deploy,hits}=make({skill:2}),u=deploy(3,4,dir);cast(b,u);advance(b,1.6);
    const e=enemy(b,{c:4}),z=enemy(b,{c:4.1}),f=enemy(b,{c:4.2}),extra=enemy(b,{c:4.3}),air=enemy(b,{c:4.4,fly:true});
    hold(b,u,e);hold(b,u,z);hold(b,u,f);const p=effectiveProfile(u);near(p.windup(b,u),.567);
    assert.equal(acquireTargets(b,u,p).length,3);assert.equal(b.forceAttack(u,[e,z,f]),true);u.atkCd=1000;
    advance(b,.567);assert.equal(own(hits,u).length,0);
    b.step();assert.deepEqual(b.errors,[]);assert.equal(own(hits,u).length,3);near(extra.hp,100000);near(air.hp,100000);
    hits.length=0;assert.equal(b.forceAttack(u,[e]),true);b.applyStatus(u,'stun',{duration:1});advance(b,.7);
    assert.equal(own(hits,u).length,0);
  }
});
test('S3 expiration restores normal stats and invokes exactly five seconds of ending stun',()=>{
  const {b,deploy}=make({skill:2}),u=deploy();cast(b,u);advance(b,36.5);
  assert.equal(u.skill.active,false);near(u.s.blockCnt,1);near(u.s.atk,u.base.atk);near(u.s.def,u.base.def);
  assert.equal(u.s.flags.stun,true);assert.equal(u.s.flags.noSp,true);
  advance(b,4.9);assert.equal(u.s.flags.stun,true);advance(b,.2);assert.equal(u.s.flags.stun,false);
  assert.equal(u.mem.regularFormVisual,null);
});
test('S3 withdrawal during Begin or mecha mode cancels old callbacks and redeployment starts fresh',()=>{
  for(const delay of [.3,2]){
    const {b,deploy}=make({skill:2}),u=deploy();cast(b,u);advance(b,delay);b.retreatOperator(ID);
    b.bench[ID].readyAt=b.time;const v=deploy();advance(b,2);
    assert.equal(v.skill.active,false);assert.equal(v.mem.regularFormVisual??null,null);
    assert.equal(v.mem.eunectesTransform??null,null);near(v.s.blockCnt,1);
    assert.equal(v.s.flags.stun,false);near(v.skill.spTotal,v.skill.initSp);
  }
});
