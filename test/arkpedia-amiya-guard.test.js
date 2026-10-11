// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-amiya-guard-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild, catalogueFor } from '../shared/arkpedia/loadout.js';
import { prepareSquad } from '../shared/arkpedia/squad.js';
import { compileReviewedOperators } from '../tools/arkpedia/operator-source.mjs';
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
import { dirVec } from '../server/sim/dir.js';
const ID='char_1001_amiya2',near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps,`${a} != ${z}`);
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function make({skill=0,rank=10,elite=2,potential=1,companions=[]}={}){
 const src=structuredClone(data),op=src.operators[ID];src.stage.geometry.waves[0].spawns=[];src.stage.battle.dp_per_second=0;
 const build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,potential,skillId:op.skills[skill].id,skillRank:Math.min(rank,elite===0?4:elite===1?7:10)};
 const extra=companions.map(id=>({...defaultBuild(src.operators[id]),elite:0,level:1,skillId:src.operators[id].skills[0].id,skillRank:1}));
 const b=new StandardBattle(src,{operators:[build,...extra]});b.autoFinish=false;b.setViewport('fullscreen-workspace');
 b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 const hits=[];b.on('damaged',ctx=>hits.push(ctx));
 const deploy=(id=ID,r=3,c=4,dir='RIGHT')=>{b.getPlayer('arkpedia').dp=90;const u=b.deployOperator(id,r,c,dir);assert.ok(u);u.atkCd=1000;u.skill.rule='NEVER';return u;};
 return{b,deploy,hits};
}
function enemy(b,{r=3,c=5,def=0,res=0,fly=false,hp=100000}={}){
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});Object.assign(e.base,{maxHp:hp,def,res,moveSpeed:0,massLevel:10});e.markDirty();void e.s;e.hp=hp;
 if(fly)e.motion='FLY';b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function cast(b,u){u.skill.setSpTotal(u.skill.spCost);assert.equal(b.activateOperator(ID),true);}
function shot(b,u,e){assert.equal(b.forceAttack(u,[e]),true);u.atkCd=1000;}
const out=(hits,u)=>hits.filter(h=>h.source===u);

test('Guard is compiled from Global patch data with literal source skills and form identity',()=>{
 const op=data.operators[ID];assert.equal(op.sourceName,'Amiya');assert.equal(op.name,'Amiya (Guard)');
 assert.equal(op.formOf,'char_002_amiya');assert.equal(op.profession,'WARRIOR');
 assert.deepEqual(op.formUnlock,evidence.tables.unlockConds[ID]);
 assert.equal(data.operatorSourceChannels?.[ID] ?? 'global','global');
 for(const s of op.skills)assert.deepEqual(s.levels,evidence.tables.skills[s.id].levels.map(l=>l.rangeId?{...l,rangeGrid:evidence.tables.ranges[l.rangeId].grids.map(p=>[p.row,p.col])}:l));
 const global={characters:{},skills:evidence.tables.skills,ranges:evidence.tables.ranges,
  forms:{patchChars:{[ID]:evidence.tables.character},infos:{char_002_amiya:evidence.tables.formInfo},unlockConds:evidence.tables.unlockConds,patchDetailInfoList:evidence.tables.patchDetailInfoList}};
 const registry={[ID]:REGULAR_OPERATORS[ID]};assert.deepEqual(compileReviewedOperators({registry,global})[ID],op);
 assert.throws(()=>compileReviewedOperators({registry,global:{...global,forms:null}}),/alternate-form/);
 assert.throws(()=>compileReviewedOperators({registry,global:{...global,characters:{[ID]:evidence.tables.character}}}),/Conflicting/);
 assert.throws(()=>compileReviewedOperators({registry:{[ID]:{...registry[ID],sourceChannel:'cn'}},global,cn:global}),/channel/);
});
test('Caster/Guard cannot coexist in squad or maxed support',()=>{
 const catalogue=catalogueFor(data),guard=defaultBuild(data.operators[ID]),caster=defaultBuild(data.operators.char_002_amiya);
 assert.throws(()=>prepareSquad({operators:[guard,caster]},catalogue),/one form/);
 assert.throws(()=>prepareSquad({operators:[caster],support:{id:ID,skillId:guard.skillId}},catalogue),/one form/);
 assert.equal(prepareSquad({operators:[guard]},catalogue).operators.length,1);
});
test('selected E0/E1/E2 aura adds correct ATK/DEF percentages to self and allies, without potential invention',()=>{
 for(const[elite,potential,pct]of [[0,1,0],[1,1,.04],[2,1,.07],[2,6,.07]]){
  const{b,deploy}=make({elite,potential,companions:['char_208_melan']}),u=deploy(),a=deploy('char_208_melan',2,2);
  near(u.s.atk,u.base.atk*(1+pct));near(u.s.def,u.base.def*(1+pct));near(a.s.atk,a.base.atk*(1+pct));
  b.addBuff(a,{key:'other:atk',mods:{atkPct:.2}});near(a.s.atk,a.base.atk*(1+pct+.2));
  b.retreatOperator(ID);near(a.s.atk,a.base.atk*1.2);assert.equal(a.findBuff('amiya2:aura'),null);
 }
});
test('aura doubles immediately during skill, reaches late allies, resumes base on finish and clears battle end',()=>{
 const{b,deploy}=make({companions:['char_208_melan']}),u=deploy();cast(b,u);near(u.s.def,u.base.def*1.14);
 const a=deploy('char_208_melan',2,2);near(a.s.atk,a.base.atk*1.14);
 u.skill.end('test');near(a.s.atk,a.base.atk*1.07);near(u.s.def,u.base.def*1.07);
 b.emit('battleEnd',{});assert.equal(a.findBuff('amiya2:aura'),null);assert.equal(u.findBuff('amiya2:aura'),null);
});
test('normal attack has one ground victim and one Arts receipt at the original release event',()=>{
 const{b,deploy,hits}=make({elite:0}),u=deploy(),e=enemy(b,{res:20,def:10000}),other=enemy(b,{c:5.1}),air=enemy(b,{fly:true,c:4.5});
 assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[e]);shot(b,u,e);advance(b,.53);assert.equal(out(hits,u).length,0);advance(b,.1);
 assert.equal(out(hits,u).length,1);near(out(hits,u)[0].hpLoss,u.s.atk*.8);near(other.hp,100000);near(air.hp,100000);
});
test('S1 every rank uses selected ATK, Arts dodge and two independently mitigated original events',()=>{
 for(let rank=1;rank<=10;rank++){
  const{b,deploy,hits}=make({rank}),u=deploy(),e=enemy(b,{res:30}),bb=u.def.skill.bb;cast(b,u);
  near(u.s.atk,u.base.atk*(1+.14+bb.atk));near(u.s.dodgeArts,bb.prob);near(u.s.dodgePhys,0);
  shot(b,u,e);advance(b,.33);assert.equal(out(hits,u).length,0);advance(b,.1);assert.equal(out(hits,u).length,1);
  advance(b,.4);assert.equal(out(hits,u).length,2);for(const h of out(hits,u)){assert.equal(h.target,e);near(h.hpLoss,u.s.atk*.7);}
  u.skill.end('test');near(u.s.atk,u.base.atk*1.07);near(u.s.dodgeArts,0);
 }
});
test('S1 dodges Arts only; True and Physical damage remain accepted',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b);cast(b,u);b.rng=()=>0;
 const hp=u.hp;b.dealDamage(e,u,{amount:500,type:'arts',isAttack:true});near(u.hp,hp);
 b.dealDamage(e,u,{amount:500,type:'true'});near(u.hp,hp-500);
 b.dealDamage(e,u,{amount:500,type:'phys'});assert.ok(u.hp<hp-500);
});
test('S1 second strike never retargets dead victims and cancels after control, retreat or mode change',()=>{
 for(const reason of ['dead-target','control','retreat','end']){
  const{b,deploy,hits}=make(),u=deploy(),e=enemy(b),other=enemy(b,{c:5.1});cast(b,u);shot(b,u,e);advance(b,.43);
  if(reason==='dead-target')b.kill(e,null);else if(reason==='control')b.applyStatus(u,'stun',{duration:.01});else if(reason==='retreat')b.retreatOperator(ID);else u.skill.end('test');
  u.atkCd=1000;advance(b,.4);assert.equal(out(hits,u).length,1);near(other.hp,100000);
 }
});
test('ordinary and S1 animation playback are uncapped in all four facings',()=>{
 for(const dir of ['UP','RIGHT','DOWN','LEFT'])for(const active of [false,true]){
  const{b,deploy,hits}=make(),u=deploy(ID,3,4,dir),[dr,dc]=dirVec(dir),e=enemy(b,{r:3+dr,c:4+dc});
  b.addBuff(u,{key:'test:speed',mods:{aspd:200}});if(active)cast(b,u);shot(b,u,e);advance(b,.3);
  assert.equal(out(hits,u).length,active?2:1);near(effectiveProfile(u).windup(b,u), (active?.3666666746:.5666666627)/3);
 }
});
test('S2 every rank emits nine Arts receipts and one separate delayed True receipt; no eleventh hit',()=>{
 for(let rank=1;rank<=10;rank++){
  const{b,deploy,hits}=make({skill:1,rank}),u=deploy(),e=enemy(b,{res:30,def:9999});cast(b,u);
  advance(b,.55);assert.equal(out(hits,u).length,0);advance(b,.1);assert.equal(out(hits,u).length,1);
  advance(b,1.4);assert.equal(out(hits,u).length,9);advance(b,.5);assert.equal(out(hits,u).length,9);
  advance(b,.25);assert.equal(out(hits,u).length,10);assert.equal(out(hits,u).at(-1).type,'true');
  near(out(hits,u).at(-1).hpLoss,u.s.atk*u.def.skill.bb.atk_scale_2);
  for(const h of out(hits,u).slice(0,9))near(h.hpLoss,u.s.atk*u.def.skill.bb.atk_scale*.7);
  advance(b,1);assert.equal(out(hits,u).filter(h=>h.dmg.tags.includes('amiya2:slash')).length,10);assert.equal(u.mem.amiyaCast,null);assert.equal(u.skill.active,true);
 }
});
test('S2 requires lowest-current-HP legal ground target in its rotated skill range without spending on invalid cast',()=>{
 for(const dir of ['UP','RIGHT','DOWN','LEFT']){
  const{b,deploy,hits}=make({skill:1}),u=deploy(ID,3,4,dir),[dr,dc]=dirVec(dir),air=enemy(b,{r:3+dr,c:4+dc,fly:true,hp:1});
  u.skill.setSpTotal(20);assert.equal(b.activateOperator(ID),false);near(u.skill.spTotal,20);assert.equal(b.bench[ID].amiyaSecondUsed,undefined);
  const high=enemy(b,{r:3+dr,c:4+dc,hp:100000}),low=enemy(b,{r:3+dr,c:4+dc,hp:90000});
  const hidden=enemy(b,{r:3+dr,c:4+dc,hp:2});b.addBuff(hidden,{key:'test:stealth',flags:{stealth:true}});
  assert.equal(b.activateOperator(ID),true);advance(b,.7);assert.equal(out(hits,u)[0].target,low);near(high.hp,100000);near(air.hp,1);near(hidden.hp,2);
 }
});
test('S2 kill stacks retarget, cap at three and feed the delayed final damage before reverting at skill end',()=>{
 const{b,deploy,hits}=make({skill:1}),u=deploy(),victims=Array.from({length:4},()=>enemy(b,{hp:1})),survivor=enemy(b);
 const base=u.base.atk;cast(b,u);advance(b,1.5);assert.ok(victims.every(e=>!e.alive));
 near(u.s.atk,base*(1+.14+1.2));near(u.s.res,80);assert.equal(u.mem.amiyaCast.kills,3);
 advance(b,1.9);near(out(hits,u).filter(h=>h.dmg.tags.includes('amiya2:final')).at(-1).hpLoss,u.s.atk*4.4);assert.equal(u.mem.amiyaCast,null);
 u.skill.end('test');near(u.s.atk,base*1.07);near(u.s.res,20);assert.equal(u.findBuff('amiya2:kill'),null);
});
test('S2 cast is invulnerable, untargetable, nonblocking and immune to stun/freeze/silence only during the sequence',()=>{
 const{b,deploy}=make({skill:1}),u=deploy(),e=enemy(b);cast(b,u);
 assert.equal(u.s.flags.noBlock,true);assert.equal(u.s.flags.untargetable,true);
 b.dealDamage(e,u,{amount:100000,type:'true'});near(u.hp,u.s.maxHp);
 for(const status of ['stun','freeze','silence']){b.applyStatus(u,status,{duration:2});assert.equal(!!u.s.flags[status],false);}
 advance(b,3.4);assert.equal(u.mem.amiyaCast,null);assert.equal(!!u.s.flags.invulnerable,false);
 b.applyStatus(u,'stun',{duration:2});assert.equal(u.s.flags.stun,true);
});
test('S2 once-per-battle exhaustion survives retreat/redeployment and allows a fresh battle',()=>{
 const{b,deploy}=make({skill:1}),u=deploy();enemy(b);cast(b,u);advance(b,3.4);u.skill.end('test');
 u.skill.setSpTotal(20);assert.equal(b.activateOperator(ID),false);assert.equal(u.skill.exhausted,true);
 b.retreatOperator(ID);advance(b,71);const next=deploy();next.skill.setSpTotal(20);assert.equal(b.activateOperator(ID),false);assert.equal(next.skill.exhausted,true);
 const fresh=make({skill:1}),f=fresh.deploy();enemy(fresh.b);cast(fresh.b,f);assert.equal(f.skill.active,true);
});
test('post-cast ordinary attacks use original S2-loop events and True damage until duration finishes',()=>{
 const{b,deploy,hits}=make({skill:1}),u=deploy(),e=enemy(b,{res:90,def:10000});cast(b,u);advance(b,3.4);
 b.addBuff(u,{key:'test:cancel-pending',flags:{disarm:true}});b.removeBuff(u,'test:cancel-pending');u.atkCd=1000;hits.length=0;shot(b,u,e);advance(b,.5);assert.equal(out(hits,u).length,1);assert.equal(out(hits,u)[0].type,'true');near(out(hits,u)[0].hpLoss,u.s.atk);
 u.skill.end('test');u.atkCd=1000;hits.length=0;shot(b,u,e);advance(b,.6);assert.equal(out(hits,u)[0].type,'arts');near(out(hits,u)[0].hpLoss,u.s.atk*.1);
});
test('S2 final delay preserves chosen victim identity and never substitutes another after its death',()=>{
 const{b,deploy,hits}=make({skill:1}),u=deploy(),e=enemy(b,{hp:90000}),other=enemy(b);cast(b,u);advance(b,2.5);
 b.kill(e,null);advance(b,.5);assert.equal(out(hits,u).length,9);near(other.hp,100000);
});
test('S2 natural duration includes the cast and clears all owned state and aura doubling',()=>{
 const{b,deploy}=make({skill:1}),u=deploy();enemy(b);cast(b,u);advance(b,34.8);assert.equal(u.skill.active,true);
 advance(b,.3);assert.equal(u.skill.active,false);assert.equal(u.mem.regularFormVisual,null);near(u.s.atk,u.base.atk*1.07);
});
test('source retreat before a payload or final delayed damage cancels every remaining cast callback',()=>{
 for(const time of [.2,2.5]){
  const{b,deploy,hits}=make({skill:1,companions:['char_208_melan']}),u=deploy(),a=deploy('char_208_melan',2,2);enemy(b);cast(b,u);advance(b,time);
  const n=out(hits,u).length;b.retreatOperator(ID);advance(b,4);assert.equal(out(hits,u).length,n);assert.equal(u.mem.amiyaCast,null);assert.equal(a.findBuff('amiya2:aura'),null);
 }
});

test('S2 native max-animation-scale preserves its cast clock under external ASPD',()=>{
 const{b,deploy,hits}=make({skill:1}),u=deploy();enemy(b);b.addBuff(u,{key:'test:aspd',mods:{aspd:200}});cast(b,u);
 advance(b,.55);assert.equal(out(hits,u).length,0);advance(b,.15);assert.equal(out(hits,u).length,1);
 assert.equal(u.mem.regularFormVisual.speed,1);advance(b,2.3);
 assert.equal(out(hits,u).filter(h=>h.dmg.tags.includes('amiya2:slash')).length,10);
});
test('death before final receipt cancels timers without restoring S2 availability on redeployment',()=>{
 const{b,deploy,hits}=make({skill:1}),u=deploy();enemy(b);cast(b,u);advance(b,2.5);
 const n=out(hits,u).length;b.kill(u,null);advance(b,3);assert.equal(out(hits,u).length,n);
 assert.equal(u.mem.amiyaCast,null);assert.equal(u.findBuff('amiya2:kill'),null);
 advance(b,71);const next=deploy();next.skill.setSpTotal(20);assert.equal(b.activateOperator(ID),false);
});
test('unrelated kills and post-cast kills cannot add Guard attack-state bonuses',()=>{
 const{b,deploy}=make({skill:1,companions:['char_208_melan']}),u=deploy(),a=deploy('char_208_melan',2,2),e=enemy(b);cast(b,u);
 b.kill(enemy(b),a);assert.equal(u.findBuff('amiya2:kill'),null);advance(b,3.4);
 b.kill(e,u);assert.equal(u.findBuff('amiya2:kill'),null);
});
