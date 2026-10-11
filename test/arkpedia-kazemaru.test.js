// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-kazemaru-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { regularTokenIdsFor, REGULAR_SUMMONS } from '../shared/arkpedia/summons.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
const ID='char_4016_kazema', TOKEN='token_10022_kazema_shadow';
const near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps,`${a} != ${z}`);
function advance(b,s) {for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function make({skill=0,rank=10,elite=2,potential=1,trust=0,level,dir='RIGHT'}={}) {
  const src=structuredClone(data);src.stage.geometry.waves[0].spawns=[];
  const op=src.operators[ID],build={...defaultBuild(op),elite,level:level??op.phases[elite].maxLevel,
    potential,trust,skillId:op.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
  const b=new StandardBattle(src,{operators:[build]});b.autoFinish=false;
  b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=80;
  b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
  const u=b.deployOperator(ID,3,4,dir);u.atkCd=1000;u.skill.rule='NEVER';
  const hits=[];b.on('damaged',c=>hits.push(c));return {b,u,hits};
}
function enemy(b,{r=3,c=5,fly=false}={}) {
  const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});
  Object.assign(e.base,{maxHp:100000,def:100,res:50,moveSpeed:0});e.markDirty();void e.s;e.hp=100000;
  if(fly)e.motion='FLY';b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function cast(b,u) {
  u.skill.setSpTotal(u.skill.spCost);
  assert.equal(u.skill.manual ? b.activateOperator(ID) : u.skill.activate(),true);
}
function doll(b,u) {b.loseHp(u,u.s.maxHp*2);advance(b,2.2);u.atkCd=1000;assert.equal(u.trait.doll,true);}
const shadow=b=>b.allyUnits.find(u=>u.defId===TOKEN&&u.alive);

test('Kazemaru retains all20 original ranks, six bundles, native templates and four original facing byte identities',()=>{
  assert.equal(evidence.frameParity,false);assert.equal(evidence.source.bundles.length,6);
  assert.equal(Object.keys(evidence.templates).length,10);
  for(const s of data.operators[ID].skills)assert.deepEqual(s.levels,evidence.tables.skills[s.id].levels);
  for(const id of [ID,TOKEN])for(const face of ['Front','Back']) {
    const asset=data.sd.models[`operator/${id}/default/${face.toLowerCase()}`].skeleton;
    const raw=readFileSync(new URL('../../arkpedia-sd-assets/'+asset.path,import.meta.url));
    assert.equal(createHash('sha256').update(raw).digest('hex'),evidence.models[id][face].sha256);
  }
  assert.deepEqual(regularTokenIdsFor([ID]),[TOKEN]);assert.equal(REGULAR_SUMMONS[ID],undefined);
  assert.equal(evidence.templates['kazema_standin[damage]'].eventToActions.ON_BUFF_FINISH[0]._targetOptions.targetMotion,'WALK_ONLY');
});
test('normal and S2 attacks use one Physical ground target and uncapped original .433 clock in all directions',()=>{
  for(const dir of ['UP','DOWN','LEFT','RIGHT'])for(const aspd of [-50,0,200]) {
    const {b,u,hits}=make({dir}),e=enemy(b),z=enemy(b,{c:5.1});
    b.addBuff(u,{key:'test:aspd',mods:{aspd}});const p=effectiveProfile(u);
    near(p.windup(b,u),.433/(u.s.aspd/100));assert.equal(acquireTargets(b,u,p).length,dir==='RIGHT'?1:0);
    b.forceAttack(u,[e]);u.atkCd=1000;advance(b,1.1);near(hits.find(h=>h.target===e).amount,u.s.atk-100);near(z.hp,100000);
    assert.equal(u.mem.regularFormVisual.clip,'Idle');assert.equal(p.splashRadius,0);
  }
});
test('S1 all10 ranks uses source next-attack scale and exactly ten percent MAX HP once on accepted output',()=>{
  for(let rank=1;rank<=10;rank++) {
    const {b,u,hits}=make({rank}),e=enemy(b),bb=u.def.skill.bb;
    u.hp=u.s.maxHp*.4;const hp=u.hp;cast(b,u);near(hp,u.hp);
    b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.7);
    near(hits.find(h=>h.target===e).amount,u.s.atk*bb.atk_scale-100);
    near(hp-u.hp,u.s.maxHp*bb.hp_ratio);assert.equal(u.skill.active,false);
    assert.equal(hits.filter(h=>h.dmg.tags.includes('kazemaru:s1-cost')).length,1);
    const hp2=u.hp;b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.7);near(u.hp,hp2);near(u.skill.spTotal,1);
  }
});
test('S1 self cost bypasses shields and modifiers, has PURE/NORMAL metadata and grants no SP',()=>{
  const {b,u,hits}=make(),e=enemy(b);cast(b,u);
  b.addBuff(u,{key:'test:shield',shield:9999,mods:{trueTakenMul:0,dmgTakenMul:0}});
  u.skill.spType='hurt';const hp=u.hp;b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.7);
  near(hp-u.hp,u.s.maxHp*.1);near(u.findBuff('test:shield').shield,9999);near(u.skill.spTotal,0);
  const cost=hits.find(h=>h.dmg.tags.includes('kazemaru:s1-cost'));
  assert.equal(cost.type,'true');assert.equal(cost.dmg.noSp,true);assert.equal(cost.dmg.tags.includes('hpLoss'),false);
});
test('shield-zero S1 output costs HP; dodge, cancellation and interrupted windup do not',()=>{
  for(const mode of ['shield','dodge','cancel','interrupt']) {
    const {b,u}=make(),e=enemy(b);cast(b,u);
    if(mode==='shield')b.addBuff(e,{key:'test:shield',shield:99999});
    if(mode==='dodge')b.addBuff(e,{key:'test:dodge',mods:{dodgePhys:1}});
    if(mode==='cancel')b.on('hit',c=>{if(c.target===e)c.dmg.cancel=true;});
    const hp=u.hp;b.forceAttack(u,[e]);u.atkCd=1000;
    if(mode==='interrupt')b.applyStatus(u,'stun',{duration:2});
    advance(b,.7);near(hp-u.hp,mode==='shield'?u.s.maxHp*.1:0);
  }
});
test('S1 lethal cost triggers exactly one substitute transition without removal or stray offensive SP',()=>{
  const {b,u,hits}=make(),e=enemy(b);u.hp=u.s.maxHp*.05;cast(b,u);
  b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.7);
  assert.equal(u.alive,true);assert.equal(u.trait.dollSwitching,true);assert.equal(u.skill.active,false);
  near(u.skill.spTotal,0);assert.equal(hits.filter(h=>h.dmg.tags.includes('kazemaru:s1-cost')).length,1);
  near(u.hp,u.s.maxHp);
});
test('S1 automatically casts on the next eligible attack when offensive SP is full, with no manual skill button',()=>{
  const {b,u,hits}=make(),e=enemy(b);u.skill.rule='DEFAULT';u.skill.setSpTotal(u.skill.spCost);u.atkCd=0;
  assert.equal(b.activateOperator(ID),false);advance(b,.7);u.atkCd=1000;
  assert.equal(u.skill.activations,1);near(hits.find(h=>h.target===e).amount,u.s.atk*3.5-100);
  assert.equal(hits.filter(h=>h.dmg.tags.includes('kazemaru:s1-cost')).length,1);
});
test('S2 all10 ranks halves CURRENT HP and buffs separate token ATK without DP or deployment slot',()=>{
  for(let rank=1;rank<=10;rank++) {
    const {b,u}=make({skill:1,rank}),bb=u.def.skill.bb;
    u.hp=u.s.maxHp*.3;const hp=u.hp,dp=b.dp;cast(b,u);const t=shadow(b);
    assert.ok(t);near(u.hp,hp*(1-bb.hp_ratio));near(u.s.atk,u.base.atk*(1+bb.atk));
    near(t.s.atk,t.base.atk*(1+bb.atk));near(t.base.atk,772);near(t.s.blockCnt,0);
    near(b.dp,dp);assert.equal(b.deployedSlots(),1);assert.equal(t.deploymentSlotCost,0);
    assert.equal(u.mem.regularFormVisual.attack,'Skill2');
    advance(b,1.1);t.atkCd=1000;u.atkCd=1000;advance(b,20);
    assert.equal(t.alive,false);assert.equal(u.skill.active,false);near(u.s.atk,u.base.atk);
  }
});
test('S2 cost is undeadable at one HP, ignores shields and never charges defensive SP',()=>{
  const {b,u,hits}=make({skill:1});u.hp=1;u.skill.spType='hurt';
  b.addBuff(u,{key:'test:shield',shield:9999});cast(b,u);near(u.hp,1);near(u.skill.spTotal,0);
  assert.equal(!!u.trait.dollSwitching,false);near(u.findBuff('test:shield').shield,9999);
  near(hits.find(h=>h.dmg.tags.includes('kazemaru:s2-cost')).amount,0);
});
test('shadow source stats interpolate owner level and use its own promotion/potential talent, never owner trust/stat buffs',()=>{
  for(const [elite,potential,level] of [[1,1,1],[1,5,35],[1,6,70],[2,1,1],[2,5,40],[2,6,80]]) {
    const {b,u}=make({skill:1,elite,potential,level,trust:100});
    b.addBuff(u,{key:'test:owner-bonus',persist:true,mods:{atkPct:2,hpPct:1,defPct:1}});cast(b,u);const t=shadow(b);
    const phase=data.tokens[TOKEN].phases[elite],low=phase.attributesKeyFrames[0],high=phase.attributesKeyFrames.at(-1);
    const ratio=(level-low.level)/(high.level-low.level);
    for(const k of ['maxHp','atk','def'])near(t.base[k],Math.round(low.data[k]+(high.data[k]-low.data[k])*ratio));
    near(t.def.talents[0].bb.damage_scale,[1.5,2.25,2.7][elite]+(potential>=5?.05:0));
    assert.notEqual(t.s.maxHp,u.s.maxHp);
  }
});
test('shadow cannot attack during original Start; its delayed entrance is Arts ground-only and normal attacks are Physical ground-only',()=>{
  const {b,u,hits}=make({skill:1});cast(b,u);const t=shadow(b),e=enemy(b,{r:t.tileR,c:t.tileC}),f=enemy(b,{r:t.tileR,c:t.tileC,fly:true});
  u.atkCd=1000;assert.equal(t.s.flags.disarm,true);advance(b,.4);near(e.hp,100000);
  assert.equal(t.stats.attacks,0);
  advance(b,.15);const burst=hits.filter(h=>h.dmg.tags.includes('kazemaru:entrance'));
  assert.equal(burst.length,1);assert.equal(burst[0].source,t);near(burst[0].amount,t.s.atk*2.7*.5);near(f.hp,100000);
  advance(b,1.1);t.atkCd=1000;const hp=e.hp;
  assert.equal(acquireTargets(b,t,effectiveProfile(t)).includes(f),false);
  b.forceAttack(t,[e]);t.atkCd=1000;advance(b,.7);near(hp-e.hp,t.s.atk-100);near(f.hp,100000);
});
test('shadow spawning rejects occupied, ranged, unbuildable and impassable surrounding tiles; no space still activates S2',()=>{
  for(const mode of ['ranged','unbuildable','impassable','occupied']) {
    const {b,u}=make({skill:1});
    for(let r=u.tileR-1;r<=u.tileR+1;r++)for(let c=u.tileC-1;c<=u.tileC+1;c++) {
      if(r===u.tileR&&c===u.tileC)continue;
      b.grid.tiles[r*b.grid.cols+c]={...b.grid.tile(r,c),
        build:mode==='ranged'?'RANGED':mode==='unbuildable'?'NONE':'MELEE',
        pass:mode==='impassable'?'NONE':'ALL'};
      if(mode==='occupied')b.spawnDevice('test:occupant',r,c);
    }
    const hp=u.hp;cast(b,u);assert.equal(shadow(b),undefined);near(u.hp,hp*.5);assert.equal(u.skill.active,true);
  }
});
test('one legal surrounding tile receives the shadow; its attack facing follows the target rather than owner direction',()=>{
  const {b,u}=make({skill:1,dir:'DOWN'});
  for(let r=u.tileR-1;r<=u.tileR+1;r++)for(let c=u.tileC-1;c<=u.tileC+1;c++)
    if(r!==u.tileR||c!==u.tileC)b.grid.tiles[r*b.grid.cols+c]={...b.grid.tile(r,c),build:r===4&&c===4?'MELEE':'NONE'};
  cast(b,u);const t=shadow(b);assert.deepEqual([t.tileR,t.tileC],[4,4]);assert.equal(t.dir,'RIGHT');
  advance(b,1.1);t.atkCd=1000;u.atkCd=1000;const e=enemy(b,{r:5,c:4});b.forceAttack(t,[e]);t.atkCd=1000;
  assert.equal(t.dir,'UP');advance(b,.7);assert.ok(e.hp<100000);
});
test('shadow is healable/targetable and its death cannot trigger the owner substitute',()=>{
  const {b,u}=make({skill:1});cast(b,u);const t=shadow(b);advance(b,1.1);u.atkCd=1000;t.atkCd=1000;
  const hp=t.hp;b.dealDamage(null,t,{amount:100,type:'true',noSp:true});near(t.hp,hp-100);
  b.heal(u,t,100);near(t.hp,hp);b.loseHp(t,t.s.maxHp*2);assert.equal(t.alive,false);
  assert.equal(u.trait.doll,false);assert.equal(u.skill.active,true);near(u.hp,u.s.maxHp*.5);
});
test('S2 finish, forced interruption, owner fatal damage and retreat remove all shadows, including unborn ones',()=>{
  for(const reason of ['end','interrupt','fatal','retreat']) {
    const {b,u,hits}=make({skill:1});cast(b,u);const t=shadow(b),e=enemy(b,{r:t.tileR,c:t.tileC});
    if(reason==='end')advance(b,21);
    if(reason==='interrupt')u.skill.end('test');
    if(reason==='fatal')b.loseHp(u,u.s.maxHp*2);
    if(reason==='retreat')b.retreat(u);
    assert.equal(t.alive,false);const count=hits.filter(h=>h.source===t).length;advance(b,2);
    assert.equal(hits.filter(h=>h.source===t).length,count);
    assert.equal(hits.filter(h=>h.source===t&&h.dmg.tags.includes('kazemaru:entrance')).length,reason==='end'?1:0);
  }
});
test('fatal normal mode clears timed buffs and SP, preserves durable stats, releases blocked enemies and uses Front outgoing death',()=>{
  const {b,u}=make({skill:1,dir:'UP'}),e=enemy(b);cast(b,u);
  u.blocking.push(e);e.blockedBy=u;b.addBuff(u,{key:'test:temp',mods:{atkPct:1}});
  b.addBuff(u,{key:'test:durable',persist:true,mods:{defPct:.1}});b.applyStatus(u,'stun',{duration:30});
  b.loseHp(u,u.s.maxHp*2);assert.equal(u.alive,true);assert.equal(u.trait.dollSwitching,true);near(u.s.blockCnt,0);
  assert.equal(e.blockedBy,null);assert.equal(u.findBuff('test:temp'),null);assert.ok(u.findBuff('test:durable'));
  assert.equal(!!u.s.flags.stun,false);near(u.skill.spTotal,0);assert.equal(u.skill.active,false);
  assert.equal(u.mem.regularFormVisual.clip,'Die_2');assert.equal(u.mem.regularFormVisual.forceFront,true);
});
test('substitute original entrance pulse follows promotion/potential, hits all nearby ground enemies and excludes air/stealth',()=>{
  for(const [elite,potential] of [[0,1],[0,5],[1,1],[1,5],[2,1],[2,5]]) {
    const {b,u,hits}=make({elite,potential}),e=enemy(b),z=enemy(b,{r:4,c:4}),f=enemy(b,{fly:true}),s=enemy(b,{r:2,c:4});
    b.addBuff(s,{key:'test:stealth',flags:{stealth:true}});b.loseHp(u,u.s.maxHp*2);advance(b,1.2);
    assert.equal(hits.some(h=>h.dmg.tags.includes('kazemaru:entrance')),false);advance(b,.2);
    const burst=hits.filter(h=>h.dmg.tags.includes('kazemaru:entrance'));assert.equal(burst.length,2);
    for(const t of [e,z])near(burst.find(h=>h.target===t).amount,u.s.atk*u.def.talents[0].bb.damage_scale*.5);
    near(f.hp,100000);near(s.hp,100000);
  }
});
test('substitute uses Physical single-target melee against air or ground, own stats, zero block and no Bena resistance',()=>{
  for(const dir of ['UP','DOWN','LEFT','RIGHT'])for(const fly of [false,true]) {
    const {b,u,hits}=make({dir,trust:100});const atk=u.s.atk,hp=u.s.maxHp;doll(b,u);
    near(u.s.atk,atk);near(u.s.maxHp,hp);near(u.s.blockCnt,0);assert.equal(u.s.flags.noSp,true);
    const e=enemy(b,{fly}),z=enemy(b,{c:5.1});b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.7);
    const hit=hits.find(h=>h.target===e);assert.equal(hit.type,'phys');near(hit.amount,atk-100);near(z.hp,100000);
    near(u.s.sanctuary??0,0);const before=u.hp;b.dealDamage(null,u,{amount:1000,type:'arts',noSp:true});near(before-u.hp,1000*(1-u.s.res/100));
  }
});
test('substitute cannot cast either skill or receive SP; twenty seconds after birth completion returns through Die_B/Start',()=>{
  for(const skill of [0,1]) {
    const {b,u}=make({skill});doll(b,u);u.skill.setSpTotal(u.skill.spCost);assert.equal(b.activateOperator(ID),false);
    u.skill.setSpTotal(0);u.skill.gainSp(5,'gift');near(u.skill.spTotal,0);
    advance(b,19.5);assert.equal(u.trait.dollSwitching,false);advance(b,.5);assert.equal(u.trait.dollSwitching,true);
    assert.equal(u.mem.regularFormVisual.clip,'Die_B');near(u.s.blockCnt,0);near(u.hp,u.s.maxHp);
    advance(b,2.2);assert.equal(u.trait.doll,false);assert.equal(u.trait.dollSwitching,false);
    assert.equal(u.mem.regularFormVisual.clip,'Idle');near(u.s.blockCnt,2);assert.equal(!!u.s.flags.noSp,false);
    assert.deepEqual(u.rangeGrid,u.def.rangeGrid);cast(b,u);
  }
});
test('fatal substitute returns alive and old timer cannot interrupt a new substitute cycle',()=>{
  const {b,u}=make();doll(b,u);b.loseHp(u,u.s.maxHp*2);advance(b,2.2);
  assert.equal(u.alive,true);assert.equal(u.trait.doll,false);doll(b,u);advance(b,15);
  assert.equal(u.trait.doll,true);assert.equal(u.trait.dollSwitching,false);
});
test('withdrawal during transitions cancels pending entrance/timer and redeployment restores normal mode',()=>{
  for(const elapsed of [.2,1.2,2.2]) {
    const {b,u,hits}=make();b.loseHp(u,u.s.maxHp*2);advance(b,elapsed);b.retreat(u);
    const e=enemy(b);advance(b,30);near(e.hp,100000);assert.equal(u.deployed,false);
    assert.equal(u.mem.regularFormVisual,null);assert.equal(u.form,null);assert.equal(u.trait.doll,false);
    assert.equal(hits.some(h=>h.target===e),false);
    advance(b,40);b.getPlayer('arkpedia').dp=80;const v=b.deployOperator(ID,3,4,'RIGHT');
    assert.equal(v.trait.doll,false);assert.equal(v.trait.dollSwitching,false);assert.equal(v.mem.regularFormVisual.clip,'Idle');
    assert.equal(!!v.s.flags.noSp,false);near(v.s.blockCnt,2);
  }
});
