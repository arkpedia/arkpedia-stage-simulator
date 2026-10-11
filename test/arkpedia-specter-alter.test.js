// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-specter-alter-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { prepareSpecterAlterSquad } from '../server/sim/content/arkpedia-specter-alter.js';
import { acquireTargets, effectiveProfile, performAttack } from '../server/sim/ai.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
const ID = 'char_1023_ghost2';
const near = (a,z,eps=1e-5) => assert.ok(Math.abs(a-z)<eps, `${a} != ${z}`);
function advance(b,s) { const end=b.time+s;while(b.time<end-1e-9)b.step();assert.deepEqual(b.errors,[]); }
function make({skill=0,rank=10,elite=2,potential=1,dir='RIGHT',allies=[]}={}) {
  const src=structuredClone(data);src.stage.geometry.waves[0].spawns=[];
  const op=src.operators[ID],build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,
    potential,skillId:op.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
  const b=new StandardBattle(src,{operators:[build,...allies.map(id=>defaultBuild(src.operators[id]))]});
  b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;
  b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
  const u=b.deployOperator(ID,3,4,dir);assert.ok(u);u.atkCd=1000;u.skill.rule='NEVER';
  const hits=[];b.on('damaged',ctx=>hits.push({...ctx,time:b.time}));return {b,u,hits};
}
function enemy(b,{r=3,c=5,fly=false,hp=100000}={}) {
  const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});
  Object.assign(e.base,{maxHp:hp,atk:100,def:100,res:50,moveSpeed:1});e.markDirty();void e.s;e.hp=hp;
  if(fly)e.motion='FLY';b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function cast(b,u) {u.skill.setSpTotal(u.skill.spCost);assert.equal(b.activateOperator(ID),true);u.atkCd=1000;}
function shot(b,u) {const p=effectiveProfile(u),t=acquireTargets(b,u,p);assert.ok(t.length);performAttack(b,u,p,t);u.atkCd=1000;}
function doll(b,u) {b.loseHp(u,u.s.maxHp*2);advance(b,2.1);u.atkCd=1000;assert.equal(u.trait.doll,true);}
const auraHits = hits => hits.filter(h=>h.dmg.tags.includes('ghost2:substitute-aura'));
const costHits = hits => hits.filter(h=>h.dmg.tags.includes('ghost2:s3-cost'));
test('Specter retains all30 ranks, original graphs/templates and actual native skeleton byte identities',()=>{
  assert.equal(evidence.frameParity,false);assert.equal(evidence.source.bundles.length,5);
  assert.equal(Object.keys(evidence.templates).length,11);
  for(const s of data.operators[ID].skills) assert.deepEqual(s.levels.map(({rangeGrid,...l})=>l),evidence.tables.skills[s.id].levels);
  for(const face of ['Front','Back']) {
    const asset=data.sd.models[`operator/${ID}/default/${face.toLowerCase()}`].skeleton;
    const raw=readFileSync(new URL('../../arkpedia-sd-assets/'+asset.path,import.meta.url));
    assert.equal(createHash('sha256').update(raw).digest('hex'),evidence.officialSkeletonBindings[ID][face].sha256);
  }
  assert.match(evidence.templates.ghost2_tr.eventToActions.ON_BEFORE_TRY_SET_HP_ZERO[0]._succeedNodes[0].$type,/FinishDerivedBuff/);
});
test('ordinary attacks select one ground target and use actual per-facing hit events without an invented animation cap',()=>{
  for(const dir of ['UP','DOWN','LEFT','RIGHT'])for(const aspd of [-50,0,250]) {
    const {b,u,hits}=make({dir});b.addBuff(u,{key:'test:aspd',mods:{aspd}});
    const e=enemy(b),z=enemy(b,{c:5.1}),air=enemy(b,{fly:true});
    const p=effectiveProfile(u);near(p.windup(b,u),.4/(u.s.aspd/100));
    assert.equal(p.attackVisual(b,u),dir==='DOWN'?'Attack_Down':'Attack');
    assert.equal(acquireTargets(b,u,p).length,dir==='RIGHT'?1:0);
    b.forceAttack(u,[e]);u.atkCd=1000;advance(b,1.1);
    const h=hits.find(h=>h.target===e);assert.equal(h.type,'phys');near(h.amount,u.s.atk-100);
    near(z.hp,100000);near(air.hp,100000);
  }
});
for(let rank=1;rank<=10;rank++)test(`S1 rank${rank}: immediate lowest-HP ratio exchange, source ATK and selected duration`,()=>{
  const {b,u,hits}=make({rank,allies:['char_123_fang','char_502_nblade']});
  const a=b.deployOperator('char_123_fang',4,4,'RIGHT'),z=b.deployOperator('char_502_nblade',3,5,'RIGHT');
  for(const x of [a,z]){assert.ok(x);x.atkCd=1000;x.skill.rule='NEVER';}
  u.hp=u.s.maxHp*.8;a.hp=a.s.maxHp*.1;z.hp=z.s.maxHp*.3;
  b.addBuff(a,{key:'test:heal-block',flags:{noHeal:true},mods:{healingTakenMul:0}});
  const hpA=a.s.maxHp;cast(b,u);near(u.hpRatio,.1);near(a.hp,hpA*.8);near(z.hpRatio,.3);
  near(u.s.atk,u.base.atk*(1+u.def.skill.bb.atk));assert.equal(hits.length,0);
  assert.equal(u.mem.regularFormVisual.clip,'Skill_1');assert.equal(u.s.flags.disarm,true);
  advance(b,1.1);assert.equal(u.mem.regularFormVisual.clip,'Idle');assert.equal(!!u.s.flags.disarm,false);
  advance(b,24);assert.equal(u.skill.active,false);near(u.s.atk,u.base.atk);near(u.hpRatio,.1);
});
test('S1 excludes owner, tokens, out-of-range and isolated operators; full HP is eligible and either result floors to1',()=>{
  const {b,u,hits}=make({allies:['char_123_fang','char_502_nblade']});
  const a=b.deployOperator('char_123_fang',4,4,'RIGHT'),z=b.deployOperator('char_502_nblade',3,5,'RIGHT');
  a.hp=a.s.maxHp*.001;z.hp=z.s.maxHp*.01;u.hp=u.s.maxHp*.9;
  b.addBuff(a,{key:'test:isolate',flags:{isolated:true}});z.kind='token';cast(b,u);near(u.hpRatio,.9);
  u.skill.end('test');z.kind='op';z.x=8;z.y=4;b.removeBuff(a,'test:isolate');a.hp=a.s.maxHp;
  u.hp=.01;cast(b,u);near(u.hpRatio,1);near(a.hp,1);assert.equal(hits.length,0);
});
for(let rank=1;rank<=10;rank++)test(`S2 rank${rank}: exact stats and HP floor, then forced substitute at selected skill finish`,()=>{
  const {b,u}=make({skill:1,rank});cast(b,u);const bb=u.def.skill.bb;
  near(u.s.atk,u.base.atk*(1+bb.atk));near(u.s.aspd,u.base.aspd+bb.attack_speed);
  b.loseHp(u,u.s.maxHp*3);near(u.hp,1);assert.equal(!!u.trait.dollSwitching,false);
  advance(b,u.def.skill.duration-.1);assert.equal(u.skill.active,true);
  advance(b,.2);assert.equal(u.skill.active,false);assert.equal(u.trait.dollSwitching,true);
  assert.equal(u.mem.regularFormVisual.clip,'Die');near(u.hp,u.s.maxHp);near(u.skill.spTotal,0);
  advance(b,2.1);assert.equal(u.trait.doll,true);near(u.s.aspd,u.base.aspd);near(u.s.atk,u.base.atk);
});
for(let rank=1;rank<=10;rank++)test(`S3 rank${rank}: additive HP, +1 attack time, literal extra-before-primary Physical hit`,()=>{
  const {b,u,hits}=make({skill:2,rank}),e=enemy(b);u.hp=u.s.maxHp*.5;cast(b,u);
  const bb=u.def.skill.bb;near(u.s.maxHp,u.base.maxHp*(1+.2+bb.max_hp));near(u.hpRatio,.5);
  near(u.s.atk,u.base.atk*(1+bb.atk));near(u.s.bat,2.2);
  advance(b,.4);shot(b,u);advance(b,.8);assert.equal(hits.length,0);advance(b,.1);
  const h=hits.filter(h=>h.target===e);assert.equal(h.length,2);
  near(h[0].amount,u.s.atk*bb['attack@atk_scale_ex']-100);near(h[1].amount,u.s.atk-100);
  assert.ok(h[0].dmg.tags.includes('ghost2:s3-extra'));assert.equal(h[0].dmg.isAttack,true);
  assert.equal(h[0].dmg.applyWay,'melee');near(u.hpRatio,.5);
  advance(b,25);assert.equal(u.skill.active,false);near(u.s.maxHp,u.base.maxHp*1.2);
});
test('S3 hits up to block count, including unblocked targets in range, with blocked priority and no flying victims',()=>{
  const {b,u}=make({skill:2}),e=enemy(b),z=enemy(b,{c:5.1}),a=enemy(b,{c:4.1,r:3.1}),air=enemy(b,{fly:true});
  u.blocking=[a];a.blockedBy=u;cast(b,u);advance(b,.4);
  const targets=acquireTargets(b,u,effectiveProfile(u));assert.equal(targets.length,2);assert.equal(targets[0],a);
  assert.ok(targets.includes(e)||targets.includes(z));assert.ok(!targets.includes(air));
  b.addBuff(u,{key:'test:block',mods:{blockCnt:1}});assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,3);
});
test('S3 HP comparison runs before primary damage, includes equality and rechecks source ratio for every recipient',()=>{
  const {b,u,hits}=make({skill:2}),e=enemy(b),z=enemy(b,{c:5.1});cast(b,u);advance(b,.4);
  u.hp=u.s.maxHp*.5;e.hp=e.s.maxHp*.5;z.hp=z.s.maxHp*.49;
  b.forceAttack(u,[e,z]);u.atkCd=1000;advance(b,1);
  assert.equal(hits.filter(h=>h.target===e).length,2);assert.equal(hits.filter(h=>h.target===z).length,1);
  assert.equal(costHits(hits).length,1);near(u.hpRatio,.47);
  hits.length=0;u.hp=u.s.maxHp*.5;e.hp=e.s.maxHp*.49;z.hp=z.s.maxHp*.48;
  b.forceAttack(u,[e,z]);u.atkCd=1000;advance(b,1);
  assert.equal(costHits(hits).length,1);assert.equal(hits.filter(h=>h.target===z).length,2);
});
test('S3 self cost is MAX HP per target and bypasses shield/reduction/dodge/SP without recursive damage',()=>{
  const {b,u,hits}=make({skill:2}),e=enemy(b),z=enemy(b,{c:5.1});cast(b,u);advance(b,.4);
  e.hp=e.s.maxHp*.1;z.hp=z.s.maxHp*.1;
  b.addBuff(u,{key:'test:shield',shield:99999,mods:{trueTakenMul:0,dmgTakenMul:0,dodgePhys:1}});
  u.skill.spType='hurt';const hp=u.hp;b.forceAttack(u,[e,z]);u.atkCd=1000;advance(b,1);
  near(hp-u.hp,u.s.maxHp*.06);near(u.findBuff('test:shield').shield,99999);near(u.skill.spTotal,0);
  assert.equal(costHits(hits).length,2);for(const h of costHits(hits)){assert.equal(h.dmg.noSp,true);assert.equal(h.type,'true');}
});
test('S3 fatal cost changes form once and cancels primary/remaining recipients; an extra hit killing its target skips primary',()=>{
  const {b,u,hits}=make({skill:2}),e=enemy(b),z=enemy(b,{c:5.1});cast(b,u);advance(b,.4);
  u.hp=u.s.maxHp*.02;e.hp=e.s.maxHp*.001;z.hp=z.s.maxHp*.001;
  b.forceAttack(u,[e,z]);u.atkCd=1000;advance(b,1);
  assert.equal(costHits(hits).length,1);assert.equal(u.trait.dollSwitching,true);
  assert.equal(hits.filter(h=>h.target===e||h.target===z).length,0);assert.equal(u.alive,true);
  const fresh=make({skill:2}),a=enemy(fresh.b,{hp:100});a.base.def=0;a.markDirty();
  cast(fresh.b,fresh.u);advance(fresh.b,.4);fresh.u.hp=1;shot(fresh.b,fresh.u);advance(fresh.b,1);
  assert.equal(fresh.hits.filter(h=>h.target===a).length,1);assert.equal(a.alive,false);
});
test('S3 uses actual Front/Down/Back events and mix-map end animation; restart cancels pending normal release',()=>{
  for(const [dir,hit] of [['RIGHT',.833],['DOWN',.733],['UP',.733],['LEFT',.833]]) {
    const {b,u,hits}=make({skill:2,dir}),e=enemy(b);b.forceAttack(u,[e]);u.atkCd=1000;
    cast(b,u);advance(b,.5);assert.equal(hits.length,0);
    near(effectiveProfile(u).windup(b,u),hit);b.forceAttack(u,[e]);u.atkCd=1000;advance(b,1);
    assert.ok(hits.length>0);u.skill.end('test');assert.equal(u.mem.regularFormVisual.clip,'Skill_3_End');
    advance(b,.4);assert.equal(u.mem.regularFormVisual.clip,'Idle');
  }
});
test('fatal normal damage clears timed buffs twice, preserves durable build/deck effects and immediately releases blocks',()=>{
  const {b,u}=make(),e=enemy(b);u.blocking=[e];e.blockedBy=u;
  b.addBuff(u,{key:'test:temporary',mods:{atkPct:1}});b.addBuff(u,{key:'test:durable',persist:true,mods:{defPct:.1}});
  b.applyStatus(u,'stun',{duration:30});b.loseHp(u,u.s.maxHp*2);
  assert.equal(u.alive,true);assert.equal(u.trait.dollSwitching,true);near(u.s.blockCnt,0);
  assert.equal(e.blockedBy,null);near(u.skill.spTotal,0);assert.equal(u.findBuff('test:temporary'),null);
  assert.ok(u.findBuff('test:durable'));assert.equal(!!u.s.flags.stun,false);near(u.s.maxHp,u.base.maxHp*1.2);
  b.addBuff(u,{key:'test:between',mods:{atkPct:1}});advance(b,1.1);assert.equal(u.findBuff('test:between'),null);
});
test('transition uses forced Front death/born clips and prevents control, attacks and SP before substitute entry',()=>{
  const {b,u}=make({dir:'UP'});b.loseHp(u,u.s.maxHp*2);assert.equal(u.mem.regularFormVisual.forceFront,true);
  advance(b,.9);assert.equal(!!u.trait.doll,false);near(u.skill.spTotal,0);
  for(const status of ['stun','freeze','sleep'])assert.equal(b.applyStatus(u,status,{duration:5}),false);
  assert.equal(b.forceAttack(u,[]),false);advance(b,.2);assert.equal(u.trait.doll,true);
  assert.equal(u.mem.regularFormVisual.clip,'Start_B');assert.equal(u.mem.regularFormVisual.forceFront,true);
  advance(b,1);assert.equal(u.trait.dollSwitching,false);assert.equal(u.mem.regularFormVisual.clip,'Idle_B');
  assert.equal(u.s.flags.noSp,true);near(u.s.blockCnt,0);
});
test('substitute never ordinary-attacks; ground aura follows all three promotion values and excludes air/stealth/sleep',()=>{
  for(const [elite,scale] of [[0,.2],[1,.3],[2,.4]]) {
    const {b,u,hits}=make({elite});doll(b,u);
    const e=enemy(b),air=enemy(b,{fly:true}),stealth=enemy(b,{c:4.7}),sleep=enemy(b,{c:4.6});
    b.addBuff(stealth,{key:'test:stealth',flags:{stealth:true}});b.applyStatus(sleep,'sleep',{duration:10});
    advance(b,.1);near(e.s.moveSpeed,1-scale);assert.equal(u.profile.canAttack(b,u),false);
    advance(b,.8);assert.equal(auraHits(hits).length,0);advance(b,.1);
    near(auraHits(hits)[0].amount,u.s.atk*scale*.5);near(air.hp,100000);near(stealth.hp,100000);near(sleep.hp,100000);
    const h=auraHits(hits)[0];assert.equal(h.dmg.isAttack,false);assert.equal(h.dmg.noSp,true);assert.equal(h.dmg.applyWay,'none');
  }
});
test('aura timers belong to each recipient, leave/reenter resets first pulse, current ATK is read at pulse and detach clears movement',()=>{
  const {b,u,hits}=make();doll(b,u);const e=enemy(b),z=enemy(b,{c:8});advance(b,.5);
  z.x=5;b._buildEnemyIndex();advance(b,.45);assert.equal(auraHits(hits).filter(h=>h.target===e).length,1);
  assert.equal(auraHits(hits).filter(h=>h.target===z).length,0);
  b.addBuff(u,{key:'test:atk',mods:{atkPct:1}});advance(b,.5);
  near(auraHits(hits).find(h=>h.target===z).amount,u.s.atk*.4*.5);
  e.x=8;b._buildEnemyIndex();advance(b,.1);near(e.s.moveSpeed,1);const count=auraHits(hits).length;
  e.x=5;b._buildEnemyIndex();advance(b,.8);assert.equal(auraHits(hits).filter(h=>h.target===e).length,1);
  advance(b,.2);assert.ok(auraHits(hits).length>count);b.retreat(u);near(e.s.moveSpeed,1);near(z.s.moveSpeed,1);
  const before=auraHits(hits).length;advance(b,5);assert.equal(auraHits(hits).length,before);
});
test('aura damage retains Arts mitigation and dodge but grants neither producer nor recipient defensive SP',()=>{
  const {b,u,hits}=make();doll(b,u);const e=enemy(b);let sp=0;e.skill={spType:'hurt',active:false,gainSp:()=>sp++};
  b.addBuff(e,{key:'test:dodge',mods:{dodgeArts:1}});advance(b,1.1);assert.equal(auraHits(hits).length,0);near(sp,0);
  b.removeBuff(e,'test:dodge');advance(b,1);assert.ok(auraHits(hits).length>0);near(sp,0);near(u.skill.spTotal,0);
  e.skill=null;
});
test('20-second form clock returns through Die_B and Start_2; fatal substitute returns early, stale timers never interrupt next cycle',()=>{
  const {b,u}=make();doll(b,u);assert.ok(u.skill.spec.formCountdown().remaining>18);
  const hud=skillHud(u.skill);assert.equal(hud.ready,false);assert.equal(hud.canActivate,false);
  assert.match(hud.text,/Substitute remaining/);assert.ok(hud.fraction>.9);
  advance(b,18.8);assert.equal(u.trait.doll,true);advance(b,.3);
  assert.equal(u.trait.doll,false);assert.equal(u.trait.dollSwitching,true);assert.equal(u.mem.regularFormVisual.clip,'Die_B');
  near(u.hp,u.s.maxHp);near(u.s.blockCnt,2);assert.equal(u.skill.spec.formCountdown(),null);
  advance(b,1);assert.equal(u.mem.regularFormVisual.clip,'Start_2');advance(b,1.1);
  assert.equal(u.trait.dollSwitching,false);doll(b,u);b.loseHp(u,u.s.maxHp*2);assert.equal(u.alive,true);
  assert.equal(u.trait.doll,false);advance(b,2.1);doll(b,u);advance(b,15);assert.equal(u.trait.doll,true);
});
test('all three skills reject substitute activation/SP; normal return restores range, Physical attack and charging',()=>{
  for(const skill of [0,1,2]) {
    const {b,u}=make({skill});doll(b,u);u.skill.setSpTotal(u.skill.spCost);
    assert.equal(b.activateOperator(ID),false);u.skill.setSpTotal(0);u.skill.gainSp(5,'gift');near(u.skill.spTotal,0);
    b.loseHp(u,u.s.maxHp*2);advance(b,2.1);advance(b,1);assert.ok(u.skill.spTotal>0);
    assert.deepEqual(u.rangeGrid,u.def.rangeGrid);assert.equal(u.profile.dmgType,'phys');cast(b,u);
  }
});
test('withdrawal during S2, either transition or substitute cannot resurrect, leave aura or affect later deployment',()=>{
  for(const elapsed of [null,.2,1.2,2.1]) {
    const {b,u}=make({skill:1});const e=enemy(b);cast(b,u);
    if(elapsed!=null){u.skill.end('test');advance(b,elapsed);}b.retreat(u);advance(b,80);
    assert.equal(u.deployed,false);assert.equal(u.mem.regularFormVisual,null);near(e.s.moveSpeed,1);
    b.getPlayer('arkpedia').dp=99;const next=b.deployOperator(ID,3,4,'UP');assert.ok(next);
    assert.equal(!!next.trait.doll,false);assert.equal(next.mem.regularFormVisual.clip,'Idle');near(next.s.blockCnt,2);
  }
});
test('E2 squad HP includes owner and benched/support Abyssal Hunters, potential5 upgrade, excludes unrelated allies and never duplicates',()=>{
  for(const [elite,potential,pct] of [[0,1,0],[1,1,0],[2,1,.2],[2,5,.23]]) {
    const builds=[ID,'char_263_skadi','char_002_amiya'].map(id=>({...defaultBuild(data.operators[id]),
      ...(id===ID?{elite,potential,level:data.operators[id].phases[elite].maxLevel,
        skillId:'skchr_ghost2_1',skillRank:Math.min(7,[4,7,10][elite])}:{})}));
    const records=Object.fromEntries(builds.map(build=>[build.id,recordFor(build,data)]));
    prepareSpecterAlterSquad(records);prepareSpecterAlterSquad(records);
    near(records[ID].arkpedia.modifiers.hpPct??0,pct);near(records.char_263_skadi.arkpedia.modifiers.hpPct??0,pct);
    near(records.char_002_amiya.arkpedia.modifiers.hpPct??0,0);
  }
});
test('maxed support Specter grants23percentHP before deployment and additive contribution is removed cleanly from reused records',()=>{
  const src=structuredClone(data);src.stage.geometry.waves[0].spawns=[];
  const b=new StandardBattle(src,{operators:[defaultBuild(src.operators.char_263_skadi)],
    support:{id:ID,skillId:'skchr_ghost2_1'}});b.autoFinish=false;b.setViewport('fullscreen-workspace');
  b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));b.addDp('arkpedia',99);
  const a=b.deployOperator('char_263_skadi',3,4,'RIGHT');assert.ok(a);near(a.s.maxHp,a.base.maxHp*1.23);
  assert.ok(!b.bench[ID].unit);
  const records={specter:recordFor({...defaultBuild(data.operators[ID]),elite:2,level:90},data),
    skadi:recordFor(defaultBuild(data.operators.char_263_skadi),data)};
  records.skadi.arkpedia.modifiers.hpPct=.3;prepareSpecterAlterSquad(records);near(records.skadi.arkpedia.modifiers.hpPct,.5);
  delete records.specter;prepareSpecterAlterSquad(records);near(records.skadi.arkpedia.modifiers.hpPct,.3);
});
