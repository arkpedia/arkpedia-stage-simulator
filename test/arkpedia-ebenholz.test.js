// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-ebenholz-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, performAttack, acquireTargets } from '../server/sim/ai.js';
const ID='char_4046_ebnhlz',TOKEN='token_10024_ebnhlz_rcube';
const near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps,`${a} != ${z}`);
function advance(b,s){const end=b.time+s;while(b.time<end-1e-9)b.step();assert.deepEqual(b.errors,[]);}
function make({skill=0,rank=10,elite=2,potential=1,dir='RIGHT'}={}){
 const src=structuredClone(data);src.stage.geometry.waves[0].spawns=[];
 const op=src.operators[ID],build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,
 potential,skillId:op.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
 const b=new StandardBattle(src,{operators:[build]});b.autoFinish=false;b.setViewport('fullscreen-workspace');
 b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'HIGH',build:'ALL',pass:'ALL'}));b.getPlayer('arkpedia').dp=99;
 const u=b.deployOperator(ID,3,4,dir);assert.ok(u);u.profile.noAttack=true;u.atkCd=1000;u.skill.rule='NEVER';
 const hits=[];b.on('damaged',ctx=>hits.push({...ctx,time:b.time}));return{b,u,hits};
}
function enemy(b,{r=3,c=5,fly=false,hp=1000000,res=0,mass=0,rank='NORMAL'}={}){
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});Object.assign(e.base,{maxHp:hp,res,def:0,atk:100,massLevel:mass});
 e.def={...e.def,rank};e.markDirty();void e.s;e.hp=hp;if(fly)e.motion='FLY';
 b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function cast(b,u,delay=0){u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.activate('manual'),true);advance(b,delay);}
function fire(b,u,e){performAttack(b,u,effectiveProfile(u),[e]);}
const tagged=(hs,t)=>hs.filter(h=>h.dmg.tags.includes(t));
const tokens=b=>b.allyUnits.filter(a=>a.alive&&a.defId===TOKEN);
function onlyTiles(b,u,coords){const keys=new Set(coords.map(([r,c])=>r*21+c));for(const k of u.rangeKeys)if(!keys.has(k)){const t=b.grid.tile(Math.floor(k/21),k%21);if(t)t.build='NONE';}}
test('exact source ranks and original owner/remnant skeleton bytes are delivered',()=>{
 assert.equal(evidence.source.bundles.length,6);assert.equal(Object.keys(evidence.templates).length,7);
 assert.equal(evidence.frameParity,false);assert.equal(evidence.moduleSupport,false);
 for(const s of data.operators[ID].skills)assert.deepEqual(s.levels.map(({rangeGrid,...l})=>l),evidence.tables.skills[s.id].levels);
 assert.deepEqual(data.tokens[TOKEN].phases.map(p=>p.attributesKeyFrames),evidence.tables.token.phases.map(p=>p.attributesKeyFrames));
 for(const[id,face,hash]of[[ID,'front',evidence.officialSkeletonBindings[ID].Front.sha256],
 [ID,'back',evidence.officialSkeletonBindings[ID].Back.sha256],[TOKEN,'front',evidence.tokenSkeletonBinding.sha256],[TOKEN,'back',evidence.tokenSkeletonBinding.sha256]]){
  const path=data.sd.models[`operator/${id}/default/${face}`].skeleton.path;
  const raw=readFileSync(new URL('../../arkpedia-sd-assets/'+path,import.meta.url));assert.equal(createHash('sha256').update(raw).digest('hex'),hash);
 }
 near(evidence.tokenParsedModel.durations.Start,1);near(evidence.tokenParsedModel.hits.Attack[0],.433);
});
for(let rank=1;rank<=10;rank++)test(`S1 rank${rank}: shorter BAT/range, three charges retained into mode and per-shot isolated damage`,()=>{
 const{b,u,hits}=make({rank});advance(b,9.1);assert.equal(u.mem.ebnhlzStored,3);
 cast(b,u,.21);near(u.s.interval,3*u.skill.bb.base_attack_time);assert.deepEqual(u.skill.spec.targeting.rangeGrid,u.skill.def.rangeGrid);
 const e=enemy(b,{c:7});fire(b,u,e);advance(b,.8);assert.equal(tagged(hits,'ebnhlz:main').length,1);assert.equal(tagged(hits,'ebnhlz:stored').length,3);
 for(const h of tagged(hits,'ebnhlz:stored'))near(h.amount,u.base.atk*1.35*u.skill.bb['attack@atk_scale']);
 assert.equal(tagged(hits,'ebnhlz:isolated').length,4);assert.equal(u.mem.ebnhlzExtra,0);
 advance(b,u.skill.timeLeft+.2);near(u.s.interval,3);
});
for(let rank=1;rank<=10;rank++)test(`S2 rank${rank}: five original zero-slot devices and retained ground-only explosion with pull`,()=>{
 const{b,u,hits}=make({skill:1,rank});advance(b,12.1);assert.equal(u.mem.ebnhlzExtra,1);
 cast(b,u,.5);assert.equal(tokens(b).length,5);assert.equal(u.mem.ebnhlzStored+u.mem.ebnhlzExtra,0);assert.equal(b.deployedSlots(),1);
 const t=tokens(b)[0],e=enemy(b,{r:t.tileR,c:t.tileC}),fly=enemy(b,{r:t.tileR,c:t.tileC,fly:true});
 advance(b,2);const out=tagged(hits,'ebnhlz:remnant');assert.ok(out.some(h=>h.target===e));assert.ok(out.every(h=>h.target!==fly));
 for(const h of out)near(h.amount,u.base.atk*u.skill.bb.atk_scale);assert.equal(t.alive,false);
});
for(let rank=1;rank<=10;rank++)test(`S3 rank${rank}: elite-only selector, all four charges amplified and manual cancellation`,()=>{
 const{b,u,hits}=make({skill:2,rank});advance(b,12.1);cast(b,u);
 const low=enemy(b),high=enemy(b,{r:4,rank:'ELITE'});assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[high]);
 fire(b,u,high);advance(b,.6);assert.equal(tagged(hits,'ebnhlz:stored').length,4);
 const atk=u.base.atk*(1+u.skill.bb.atk);near(u.s.interval,3*100/(100+u.skill.bb.attack_speed));
 for(const h of tagged(hits,'ebnhlz:stored'))near(h.amount,atk*1.35*u.skill.bb.talent_scale_multiplier);
 assert.equal(hits.some(h=>h.target===low),false);assert.equal(b.activateOperator(ID),true);assert.equal(u.skill.active,false);near(u.s.interval,3);
});
test('E0 storage caps at three; E1/E2 gain one elite-only charge and selected stored scaling',()=>{
 for(const[elite,scale]of[[0,1],[1,1.2],[2,1.35]]){
 const{b,u,hits}=make({elite});advance(b,16);assert.equal(u.mem.ebnhlzStored,3);assert.equal(u.mem.ebnhlzExtra,elite?1:0);
 const low=enemy(b);fire(b,u,low);advance(b,.7);assert.equal(tagged(hits,'ebnhlz:stored').length,3);
 for(const h of tagged(hits,'ebnhlz:stored'))near(h.amount,u.base.atk*scale);assert.equal(u.mem.ebnhlzExtra,elite?1:0);
 const high=enemy(b,{rank:'BOSS'});fire(b,u,high);advance(b,.7);assert.equal(u.mem.ebnhlzExtra,0);
 }
});
test('charge clock pauses under control, resets when a target enters and respects S3 elite-only charging',()=>{
 const{b,u}=make({skill:2});advance(b,2);b.applyStatus(u,'stun',{duration:2});advance(b,2);assert.equal(u.mem.ebnhlzStored,0);
 advance(b,1.1);assert.equal(u.mem.ebnhlzStored,1);
 const e=enemy(b);advance(b,.2);near(u.mem.ebnhlzAcc,0);b.kill(e);advance(b,2);assert.equal(u.mem.ebnhlzStored,1);
 cast(b,u);enemy(b);advance(b,2);assert.ok(u.mem.ebnhlzStored>1);assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[]);
});
test('S1 fast storage remains capped and charge counts persist after skill expiration',()=>{
 const{b,u}=make();cast(b,u);advance(b,4);assert.equal(u.mem.ebnhlzStored,3);assert.equal(u.mem.ebnhlzExtra,1);
 advance(b,2);assert.equal(u.skill.active,false);assert.equal(u.mem.ebnhlzStored,3);assert.equal(u.mem.ebnhlzExtra,1);
});
test('missing or invalid release targets and interrupted windups never consume stored charges',()=>{
 const{b,u,hits}=make();advance(b,12.1);const e=enemy(b);fire(b,u,e);b.kill(e);advance(b,.5);
 assert.equal(hits.length,0);assert.equal(u.mem.ebnhlzStored,3);assert.equal(u.mem.ebnhlzExtra,1);
 const z=enemy(b);fire(b,u,z);advance(b,.1);b.applyStatus(u,'stun',{duration:1});advance(b,.5);
 assert.equal(hits.length,0);assert.equal(u.mem.ebnhlzStored,3);
});
test('switching S1/S3 interrupts an unfired attack without discarding its shared charge pool',()=>{
 for(const skill of[0,2]){const{b,u,hits}=make({skill});advance(b,12.1);const e=enemy(b,{c:6,rank:'BOSS'});
 fire(b,u,e);advance(b,.1);cast(b,u,.7);assert.equal(hits.length,0);assert.equal(u.mem.ebnhlzStored,3);assert.equal(u.mem.ebnhlzExtra,1);}
});
test('an emitted charged volley survives owner withdrawal; its captured isolation talent remains attached',()=>{
 const{b,u,hits}=make();advance(b,12.1);const e=enemy(b,{c:7,rank:'BOSS'});fire(b,u,e);advance(b,.41);
 assert.equal(b.projectiles.list.length,5);b.retreatOperator(ID);advance(b,.5);
 assert.equal(tagged(hits,'ebnhlz:stored').length,4);assert.equal(tagged(hits,'ebnhlz:isolated').length,5);assert.equal(u.mem.ebnhlzStored,0);
});
test('Appoggiatura checks current centres per shot, counts sleeping/air enemies and uses selected potential',()=>{
 for(const potential of[1,5]){const{b,u,hits}=make({potential});const e=enemy(b),z=enemy(b,{r:4});
 b.applyStatus(z,'sleep',{duration:4});fire(b,u,e);advance(b,.7);assert.equal(tagged(hits,'ebnhlz:isolated').length,0);
 z.x=6.11;z.y=3;b._buildEnemyIndex();fire(b,u,e);advance(b,.7);
 near(tagged(hits,'ebnhlz:isolated')[0].amount,u.base.atk*(potential===5?.17:.15));}
});
test('S2 waits without spending SP when no legal tile exists',()=>{
 const{b,u}=make({skill:1});onlyTiles(b,u,[]);u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.activate(),false);assert.equal(u.skill.ready,true);
 advance(b,1);assert.equal(tokens(b).length,0);assert.equal(u.skill.charges,1);
});
test('S2 with only two tiles consumes elite extra first and preserves unused normal charges',()=>{
 const{b,u}=make({skill:1});advance(b,12.1);onlyTiles(b,u,[[3,5],[4,5]]);cast(b,u,.5);
 assert.equal(tokens(b).length,2);assert.equal(u.mem.ebnhlzExtra,0);assert.equal(u.mem.ebnhlzStored,3);
});
test('S2 with one tile creates a free remnant without consuming any stored attack',()=>{
 const{b,u}=make({skill:1});advance(b,12.1);onlyTiles(b,u,[[3,5]]);cast(b,u,.5);
 assert.equal(tokens(b).length,1);assert.equal(u.mem.ebnhlzExtra,1);assert.equal(u.mem.ebnhlzStored,3);
});
test('S2 startup tiles are retained and an occupied input cannot cause a replacement placement',()=>{
 const{b,u}=make({skill:1});advance(b,12.1);onlyTiles(b,u,[[3,5],[4,5]]);cast(b,u);b.grid.tile(3,5).build='NONE';advance(b,.5);
 assert.equal(tokens(b).length,1);assert.equal(tokens(b)[0].tileR,4);assert.equal(u.mem.ebnhlzExtra,1);assert.equal(u.mem.ebnhlzStored,3);
});
test('S2 interrupted before release creates no token and preserves the charge pool',()=>{
 const{b,u}=make({skill:1});advance(b,12.1);cast(b,u);advance(b,.1);b.applyStatus(u,'stun',{duration:1});advance(b,1.1);
 assert.equal(tokens(b).length,0);assert.equal(u.mem.ebnhlzStored,3);assert.equal(u.mem.ebnhlzExtra,1);assert.equal(!!u.s.flags.noSp,false);
});
test('S2 selects ground enemy tiles first; original devices coexist between casts and expire',()=>{
 const{b,u}=make({skill:1});const e=enemy(b,{c:6});cast(b,u,.5);assert.equal(tokens(b)[0].tileC,6);assert.equal(tokens(b)[0].tileR,3);
 b.kill(e);advance(b,1);const first=tokens(b)[0];cast(b,u,.5);assert.ok(tokens(b).includes(first));assert.equal(tokens(b).length,2);
 advance(b,30);assert.equal(tokens(b).length,0);
});
test('remnant birth/fuse use native Start and explicit .93 delay rather than the .433 animation hit',()=>{
 const{b,u,hits}=make({skill:1});onlyTiles(b,u,[[3,5]]);cast(b,u,.5);const t=tokens(b)[0];enemy(b,{c:5});
 advance(b,.9);assert.equal(tagged(hits,'ebnhlz:remnant').length,0);advance(b,.2);assert.equal(t.mem.regularFormVisual.clip,'Attack');
 advance(b,.5);assert.equal(tagged(hits,'ebnhlz:remnant').length,0);advance(b,.5);assert.equal(tagged(hits,'ebnhlz:remnant').length,1);
});
test('remnant snapshot ATK survives owner buff expiration without inheriting owner talent damage',()=>{
 const{b,u,hits}=make({skill:1});onlyTiles(b,u,[[3,5]]);b.addBuff(u,{key:'test:atk',mods:{atkPct:1}});cast(b,u,.5);
 b.removeBuff(u,'test:atk');enemy(b,{c:5});advance(b,2);near(tagged(hits,'ebnhlz:remnant')[0].amount,u.base.atk*2*u.skill.bb.atk_scale);
 assert.equal(tagged(hits,'ebnhlz:isolated').length,0);
});
test('remnant keeps original INPUT victims: late entrants excluded, vanished enemies skipped',()=>{
 const{b,u,hits}=make({skill:1});onlyTiles(b,u,[[3,5]]);cast(b,u,.5);const a=enemy(b,{c:5});advance(b,1.1);
 const late=enemy(b,{c:5});b.kill(a);advance(b,1);assert.equal(tagged(hits,'ebnhlz:remnant').length,0);assert.equal(late.hp,late.s.maxHp);assert.equal(tokens(b).length,0);
});
test('owner retreat/death removes remnants immediately and cancels a triggered blast',()=>{
 for(const kill of[false,true]){const{b,u,hits}=make({skill:1});onlyTiles(b,u,[[3,5]]);cast(b,u,.5);enemy(b,{c:5});advance(b,1.1);
 if(kill)b.kill(u);else b.retreatOperator(ID);assert.equal(tokens(b).length,0);advance(b,1);assert.equal(tagged(hits,'ebnhlz:remnant').length,0);}
});
test('natural skill/SP flow casts S2 without enemies, forbids manual auto-skill UI activation and resumes recovery after clip',()=>{
 const{b,u}=make({skill:1});u.skill.rule='SP_FULL';advance(b,13.1);assert.equal(u.skill.activations,1);assert.equal(b.activateOperator(ID),false);
 advance(b,.4);assert.equal(tokens(b).length,5);near(u.skill.sp,0);advance(b,1);assert.ok(u.skill.sp>0);
});
test('real attack loop hits only one selected victim with separate charges, then normal attacks continue',()=>{
 const{b,u,hits}=make();advance(b,12.1);enemy(b);enemy(b,{r:4});u.profile.noAttack=false;u.atkCd=0;advance(b,.7);
 assert.equal(tagged(hits,'ebnhlz:main').length,1);assert.equal(tagged(hits,'ebnhlz:stored').length,3);
 assert.equal(new Set(hits.map(h=>h.target.id)).size,1);advance(b,3);assert.equal(tagged(hits,'ebnhlz:main').length,2);
});
test('remnant pull moves eligible light enemies towards its centre while flyers remain untouched',()=>{
 const{b,u,hits}=make({skill:1});onlyTiles(b,u,[[3,5]]);cast(b,u,.5);const e=enemy(b,{c:6}),fly=enemy(b,{c:6,fly:true});
 advance(b,2.7);assert.ok(e.x<5.7,`pull left target at ${e.x}`);assert.equal(fly.x,6);assert.equal(hits.filter(h=>h.target===fly).length,0);
});
test('aerial and sleeping nearby enemies prevent isolated damage without becoming remnant victims',()=>{
 const{b,u,hits}=make(),e=enemy(b),fly=enemy(b,{r:4,fly:true});fire(b,u,e);advance(b,.7);assert.equal(tagged(hits,'ebnhlz:isolated').length,0);
 b.kill(fly);b.addBuff(e,{key:'test:hidden',flags:{untargetable:true}});fire(b,u,e);advance(b,.7);assert.equal(tagged(hits,'ebnhlz:main').length,1);
});
test('an elite extra retained through manual S3 cancellation is saved when the next victim is normal',()=>{
 const{b,u,hits}=make({skill:2});advance(b,12.1);cast(b,u);assert.equal(b.activateOperator(ID),true);
 const e=enemy(b);fire(b,u,e);advance(b,.7);assert.equal(tagged(hits,'ebnhlz:stored').length,3);assert.equal(u.mem.ebnhlzExtra,1);
});
test('S2 cast animation/event respond to ASPD; freeze before release cancels even when it expires before that event',()=>{
 const{b,u}=make({skill:1});b.addBuff(u,{key:'test:speed',mods:{aspd:100}});cast(b,u,.3);assert.equal(tokens(b).length,1);
 const z=make({skill:1});cast(z.b,z.u);advance(z.b,.1);z.b.applyStatus(z.u,'stun',{duration:.05});advance(z.b,.5);assert.equal(tokens(z.b).length,0);
});
