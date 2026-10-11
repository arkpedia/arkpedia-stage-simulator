// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-bena-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
const ID = 'char_369_bena';
const near = (a,z,eps=1e-5) => assert.ok(Math.abs(a-z)<eps, `${a} != ${z}`);
function advance(b,s) { for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]); }
function make({skill=0,rank=10,elite=2,potential=1,dir='RIGHT'}={}) {
  const src=structuredClone(data);src.stage.geometry.waves[0].spawns=[];
  const op=src.operators[ID],build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,
    potential,skillId:op.skills[skill].id,skillRank:Math.min(rank,elite===0?4:elite===1?7:10)};
  const b=new StandardBattle(src,{operators:[build]});b.autoFinish=false;
  b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=80;
  b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
  const u=b.deployOperator(ID,3,4,dir);assert.ok(u);u.atkCd=1000;u.skill.rule='NEVER';
  const hits=[];b.on('damaged',ctx=>hits.push(ctx));return {b,u,hits};
}
function enemy(b,{r=3,c=5,fly=false}={}) {
  const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});
  Object.assign(e.base,{maxHp:100000,def:100,res:50,moveSpeed:0});e.markDirty();void e.s;e.hp=100000;
  if(fly)e.motion='FLY';b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function cast(b,u) {u.skill.setSpTotal(u.skill.spCost);assert.equal(b.activateOperator(ID),true);}
function doll(b,u) {b.loseHp(u,u.s.maxHp*2);advance(b,2.1);u.atkCd=1000;assert.equal(u.trait.doll,true);}

test('Bena preserves all20 ranks, original mode graph/templates and actual facing byte identities',()=>{
  assert.equal(evidence.frameParity,false);assert.equal(evidence.source.bundles.length,5);
  assert.equal(Object.keys(evidence.templates).length,10);
  for(const s of data.operators[ID].skills)assert.deepEqual(s.levels,evidence.tables.skills[s.id].levels);
  for(const face of ['Front','Back']) {
    const asset=data.sd.models[`operator/${ID}/default/${face.toLowerCase()}`].skeleton;
    const raw=readFileSync(new URL('../../arkpedia-sd-assets/'+asset.path,import.meta.url));
    assert.equal(createHash('sha256').update(raw).digest('hex'),evidence.officialSkeletonBindings[ID][face].sha256);
  }
  assert.equal(evidence.templates.bena_tr.eventToActions.ON_BEFORE_TRY_SET_HP_ZERO[0]._succeedNodes[0].$type.includes('FinishDerivedBuff'),true);
});
test('normal form uses one Physical target, original A clips and capped animation clock in every direction',()=>{
  for(const dir of ['UP','DOWN','LEFT','RIGHT'])for(const aspd of [-50,0,200]) {
    const {b,u,hits}=make({dir});b.addBuff(u,{key:'test:aspd',mods:{aspd}});
    const e=enemy(b),z=enemy(b,{c:5.1}),p=effectiveProfile(u);
    near(p.windup(b,u),.467/Math.min(2,u.s.aspd/100));assert.equal(acquireTargets(b,u,p).length,dir==='RIGHT'?1:0);
    assert.equal(u.mem.regularFormVisual.clip,'Idle_A');b.forceAttack(u,[e]);u.atkCd=1000;advance(b,1.1);
    const hit=hits.find(h=>h.target===e);assert.ok(hit);assert.equal(hit.type,'phys');near(hit.amount,u.s.atk-100);near(z.hp,100000);
  }
});
test('S1 all10 ranks uses multiplicative half maxHP, exact ATK/DEF penetration and selected duration',()=>{
  for(let rank=1;rank<=10;rank++) {
    const {b,u,hits}=make({rank}),e=enemy(b),bb=u.def.skill.bb;
    b.addBuff(u,{key:'test:extra-hp',mods:{hpPct:.4}});const hp=u.s.maxHp;
    cast(b,u);near(u.s.maxHp,hp*.5);near(u.s.atk,u.base.atk*(1+bb.atk));near(u.s.defIgnorePct,bb.def_penetrate);
    b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.7);near(hits.find(h=>h.target===e).amount,u.s.atk-100*(1-bb.def_penetrate));
    advance(b,20);near(u.s.maxHp,hp);near(u.s.defIgnorePct,0);assert.equal(u.skill.active,false);
  }
});
test('S2 all10 ranks adds source ATK/ASPD and charges four percent MAX HP for accepted output',()=>{
  for(let rank=1;rank<=10;rank++) {
    const {b,u,hits}=make({skill:1,rank}),e=enemy(b),bb=u.def.skill.bb;
    cast(b,u);near(u.s.atk,u.base.atk*(1+bb.atk));near(u.s.aspd,u.base.aspd+bb.attack_speed);
    const hp=u.hp;b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.7);near(hp-u.hp,u.s.maxHp*.04);
    const cost=hits.find(h=>h.dmg.tags.includes('bena:s2-cost'));assert.equal(cost.type,'true');assert.equal(cost.dmg.noSp,true);
    assert.equal(cost.dmg.tags.includes('hpLoss'),false);advance(b,u.def.skill.duration);near(u.s.aspd,u.base.aspd);
  }
});
test('S2 self cost bypasses shields/reduction, cannot recurse and gives no defensive SP',()=>{
  const {b,u,hits}=make({skill:1}),e=enemy(b);cast(b,u);
  b.addBuff(u,{key:'test:shield',shield:9999,mods:{trueTakenMul:0,dmgTakenMul:0}});
  u.skill.spType='hurt';const hp=u.hp;b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.7);
  near(hp-u.hp,u.s.maxHp*.04);near(u.findBuff('test:shield').shield,9999);
  assert.equal(hits.filter(h=>h.dmg.tags.includes('bena:s2-cost')).length,1);near(u.skill.spTotal,0);
});
test('S2 accepted shield-zero output costs HP; dodged or cancelled output does not',()=>{
  for(const mode of ['shield','dodge','cancel']) {
    const {b,u}=make({skill:1}),e=enemy(b);cast(b,u);
    if(mode==='shield')b.addBuff(e,{key:'test:shield',shield:99999});
    if(mode==='dodge')b.addBuff(e,{key:'test:dodge',mods:{dodgePhys:1}});
    if(mode==='cancel')b.on('hit',c=>{if(c.target===e)c.dmg.cancel=true;});
    const hp=u.hp;b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.7);
    near(hp-u.hp,mode==='shield'?u.s.maxHp*.04:0);
  }
});
test('fatal normal HP loss clears timed effects and SP, preserves durable buffs and immediately releases blocks',()=>{
  const {b,u}=make({skill:1}),e=enemy(b);u.blocking.push(e);e.blockedBy=u;cast(b,u);
  b.addBuff(u,{key:'test:temporary',mods:{atkPct:1}});b.addBuff(u,{key:'test:durable',persist:true,mods:{defPct:.1}});
  b.applyStatus(u,'stun',{duration:30});b.loseHp(u,u.s.maxHp*2);
  assert.equal(u.alive,true);assert.equal(u.trait.dollSwitching,true);near(u.s.blockCnt,0);
  assert.equal(e.blockedBy,null);assert.equal(u.skill.active,false);near(u.skill.spTotal,0);
  assert.equal(u.findBuff('test:temporary'),null);assert.ok(u.findBuff('test:durable'));assert.equal(!!u.s.flags.stun,false);
  assert.equal(u.mem.regularFormVisual.clip,'Die_2_A');near(u.hp,u.s.maxHp);
});
test('original two-stage transitions prevent attacks, statuses and SP until actual substitute entry',()=>{
  const {b,u}=make();b.loseHp(u,u.s.maxHp*2);advance(b,.9);assert.equal(!!u.trait.doll,false);
  for(const status of ['stun','freeze','sleep'])assert.equal(b.applyStatus(u,status,{duration:5}),false);
  near(u.skill.spTotal,0);assert.equal(b.forceAttack(u,[]),false);
  advance(b,.2);assert.equal(u.trait.doll,true);assert.equal(u.mem.regularFormVisual.clip,'Start_B');
  assert.equal(u.s.flags.disarm,true);advance(b,1);assert.equal(u.trait.dollSwitching,false);
  assert.equal(u.mem.regularFormVisual.clip,'Idle_B');assert.equal(u.s.flags.noSp,true);
});
test('substitute uses x-4 range, single-target Arts against ground/air, original B clips and no splash',()=>{
  for(const dir of ['UP','DOWN','LEFT','RIGHT'])for(const fly of [false,true]) {
    const {b,u,hits}=make({dir});doll(b,u);const e=enemy(b,{r:3,c:5,fly}),z=enemy(b,{r:3,c:5.1});
    assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,1);assert.deepEqual(u.rangeGrid,u.def.talents[0].rangeGrid);
    assert.equal(b.forceAttack(u,[e]),true);advance(b,.7);const hit=hits.find(h=>h.target===e);
    assert.equal(hit.type,'arts');near(hit.amount,u.s.atk*.5);near(z.hp,100000);near(u.s.blockCnt,0);
  }
});
test('substitute Physical/Arts Sanctuary follows each promotion/potential; True damage and HP loss bypass',()=>{
  for(const [elite,potential,value] of [[0,1,0],[1,1,.2],[1,5,.23],[2,1,.4],[2,5,.43]]) {
    const {b,u}=make({elite,potential});doll(b,u);
    for(const type of ['phys','arts','true']) {
      u.hp=u.s.maxHp;const hp=u.hp;
      b.dealDamage(null,u,{amount:1000,type,canDodge:false,noSp:true});
      const raw=type==='phys'?1000-u.s.def:type==='arts'?1000*(1-u.s.res/100):1000;
      near(hp-u.hp,raw*(type==='true'?1:1-value));
    }
    u.hp=u.s.maxHp;const hp=u.hp;b.loseHp(u,100);near(hp-u.hp,100);
  }
});
test('20-second timer starts on local mode entry and returns through Die_B then Start_A',()=>{
  const {b,u}=make();doll(b,u);advance(b,18.8);assert.equal(u.trait.doll,true);
  advance(b,.3);assert.equal(u.trait.doll,false);assert.equal(u.trait.dollSwitching,true);
  assert.equal(u.mem.regularFormVisual.clip,'Die_B');near(u.s.blockCnt,2);near(u.hp,u.s.maxHp);
  advance(b,1);assert.equal(u.mem.regularFormVisual.clip,'Start_A');advance(b,1.1);
  assert.equal(u.trait.dollSwitching,false);assert.equal(u.mem.regularFormVisual.clip,'Idle_A');
  assert.equal(!!u.s.flags.noSp,false);assert.deepEqual(u.rangeGrid,u.def.rangeGrid);
});
test('fatal substitute finishes its derived buff and returns alive; the previous timer cannot interrupt a new cycle',()=>{
  const {b,u}=make();doll(b,u);b.loseHp(u,u.s.maxHp*2);
  assert.equal(u.alive,true);assert.equal(u.trait.doll,false);assert.equal(u.mem.regularFormVisual.clip,'Die_B');
  advance(b,2.1);doll(b,u);advance(b,15);assert.equal(u.trait.doll,true);
  advance(b,5.1);assert.equal(u.trait.doll,false);assert.equal(u.alive,true);
});
test('S2 fatal self cost ends skill and switches once without removing the deployment',()=>{
  const {b,u,hits}=make({skill:1}),e=enemy(b);cast(b,u);u.hp=u.s.maxHp*.01;
  b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.7);assert.equal(u.alive,true);assert.equal(u.deployed,true);
  assert.equal(u.trait.dollSwitching,true);assert.equal(u.skill.active,false);
  assert.equal(hits.filter(h=>h.dmg.tags.includes('bena:s2-cost')).length,1);
});
test('substitute cannot activate either skill or receive unforced SP; restored normal form can charge and cast',()=>{
  for(const skill of [0,1]) {
    const {b,u}=make({skill});doll(b,u);u.skill.setSpTotal(u.skill.spCost);
    assert.equal(b.activateOperator(ID),false);u.skill.setSpTotal(0);u.skill.gainSp(5,'gift');near(u.skill.spTotal,0);
    b.loseHp(u,u.s.maxHp*2);advance(b,2.1);advance(b,1);assert.ok(u.skill.spTotal>0);cast(b,u);
  }
});
test('withdrawal during either transition or substitute never resurrects an old deployment',()=>{
  for(const elapsed of [.2,1.2,2.1]) {
    const {b,u}=make();b.loseHp(u,u.s.maxHp*2);advance(b,elapsed);b.retreat(u);
    advance(b,25);assert.equal(u.deployed,false);assert.equal(u.mem.regularFormVisual,null);assert.equal(u.form,null);
  }
});
test('already-born substitute projectiles keep Arts classification after source withdrawal',()=>{
  const {b,u,hits}=make();doll(b,u);const e=enemy(b,{c:6});
  b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.55);
  assert.equal(hits.filter(h=>h.target===e).length,0);assert.ok(b.projectiles.list.length>0);
  b.retreat(u);advance(b,.3);const hit=hits.find(h=>h.target===e);
  assert.ok(hit);assert.equal(hit.type,'arts');near(hit.amount,u.s.atk*.5);
});
test('the next deployment has the normal range, A form, blocking and Physical attacks',()=>{
  const {b,u}=make();doll(b,u);b.retreat(u);advance(b,80);
  b.getPlayer('arkpedia').dp=80;const next=b.deployOperator(ID,3,4,'UP');assert.ok(next);
  assert.equal(!!next.trait.doll,false);assert.equal(next.profile.dmgType,'phys');
  assert.equal(next.profile.canHitFly,false);assert.deepEqual(next.rangeGrid,next.def.rangeGrid);
  near(next.s.blockCnt,2);assert.equal(next.mem.regularFormVisual.clip,'Idle_A');
});
