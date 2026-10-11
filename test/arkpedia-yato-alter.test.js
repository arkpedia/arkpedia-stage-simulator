// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-yato-alter-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile } from '../server/sim/ai.js';
import { skillHud } from '../shared/arkpedia/skill-hud.js';
const ID='char_1029_yato2';
const near=(a,z,eps=1e-5)=>assert.ok(Math.abs(a-z)<eps,`${a} != ${z}`);
function advance(b,s){const end=b.time+s;while(b.time<end-1e-9)b.step();assert.deepEqual(b.errors,[]);}
function make({skill=0,rank=10,elite=2,potential=1,dir='RIGHT',r=3,c=4,deploy=true}={}){
 const src=structuredClone(data);src.stage.geometry.waves[0].spawns=[];
 const op=src.operators[ID],build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,
 potential,skillId:op.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
 const b=new StandardBattle(src,{operators:[build]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=99;
 b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 const hits=[];b.on('damaged',ctx=>hits.push({...ctx,time:b.time}));
 const place=()=>{const u=b.deployOperator(ID,r,c,dir);assert.ok(u);u.atkCd=1000;u.profile.noAttack=true;return u;};
 const u=deploy?place():null;return {b,u,hits,place};
}
function enemy(b,{r=3,c=5,fly=false,hp=100000}={}){
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});Object.assign(e.base,{maxHp:hp,atk:100,def:100,res:50,moveSpeed:1});
 e.markDirty();void e.s;e.hp=hp;if(fly)e.motion='FLY';b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
function shot(b,u,e){assert.equal(b.forceAttack(u,[e]),true);u.atkCd=1000;advance(b,1.05);}
const tagged=(hits,tag)=>hits.filter(h=>h.dmg.tags.includes(`yato2:${tag}:phys`));
test('retains all30 ranks, nine source templates and actual delivered Front/Back byte identities',()=>{
 assert.equal(evidence.frameParity,false);assert.equal(evidence.source.bundles.length,5);assert.equal(Object.keys(evidence.templates).length,9);
 for(const s of data.operators[ID].skills)assert.deepEqual(s.levels.map(({rangeGrid,...l})=>l),evidence.tables.skills[s.id].levels);
 for(const face of ['Front','Back']){
 const asset=data.sd.models[`operator/${ID}/default/${face.toLowerCase()}`].skeleton;
 const raw=readFileSync(new URL('../../arkpedia-sd-assets/'+asset.path,import.meta.url));
 assert.equal(createHash('sha256').update(raw).digest('hex'),evidence.officialSkeletonBindings[ID][face].sha256);
 }
});
for(let rank=1;rank<=10;rank++)test(`S1 rank${rank}: deployment activation, source ASPD and two-hit ordinary pair`,()=>{
 const {b,u,hits}=make({rank}),e=enemy(b);const atk=u.base.atk*1.13;
 near(u.s.atk,atk);near(u.s.aspd,100+u.def.skill.bb.attack_speed);
 assert.equal(u.skill.active,true);assert.equal(b.activateOperator(ID),false);assert.equal(u.mem.regularFormVisual.clip,'Start_1');
 advance(b,1.05);assert.equal(u.mem.regularFormVisual.clip,'Skill_Idle');shot(b,u,e);
 const phys=tagged(hits,'s1'),arts=hits.filter(h=>h.dmg.tags.includes('yato2:s1:arts'));
 assert.equal(phys.length,2);assert.equal(arts.length,2);for(const h of phys)near(h.amount,atk-100);
 for(const h of arts){near(h.amount,atk*.2*.5);assert.equal(h.dmg.noSp,true);}
 advance(b,20);assert.equal(u.skill.active,false);assert.equal(skillHud(u.skill),null);near(u.s.atk,atk);
 advance(b,10);near(u.s.atk,u.base.atk);
});
test('S1 third combo is per victim, retains input target and releases six pairs across two native clips',()=>{
 const {b,u,hits}=make(),e=enemy(b),z=enemy(b,{c:5.1});advance(b,1.05);
 shot(b,u,e);shot(b,u,z);shot(b,u,e);hits.length=0;
 assert.equal(b.forceAttack(u,[e]),true);u.atkCd=1000;advance(b,.45);assert.equal(tagged(hits,'s1').length,2);
 advance(b,.28);assert.equal(tagged(hits,'s1').length,4);advance(b,.3);assert.equal(tagged(hits,'s1').length,6);
 assert.ok(hits.every(h=>h.target===e));assert.equal(u.mem.yatoCounts.get(z),1);assert.equal(u.mem.yatoCounts.get(e),0);
 assert.equal(u.mem.regularFormVisual.clip,'Skill_Attack4');
});
test('normal hits after expiry are single-target ground Physical plus independent Arts, capped animation speed',()=>{
 const {b,u,hits}=make(),e=enemy(b),z=enemy(b,{c:5.1}),air=enemy(b,{fly:true});advance(b,21);
 b.addBuff(u,{key:'test:aspd',mods:{aspd:300}});const p=effectiveProfile(u);near(p.windup(b,u),.5);
 shot(b,u,e);assert.equal(hits.length,2);assert.ok(hits.every(h=>h.target===e));near(z.hp,100000);near(air.hp,100000);
 b.addBuff(u,{key:'test:slow',mods:{aspd:-350}});near(effectiveProfile(u).windup(b,u),1);
});
for(let rank=1;rank<=10;rank++)test(`S2 rank${rank}:16 fixed hit markers, native skill blackboard Arts scale applied once`,()=>{
 const {b,hits,place}=make({skill:1,rank,deploy:false}),e=enemy(b),z=enemy(b,{c:5.1}),air=enemy(b,{fly:true});const u=place();
 b.addBuff(u,{key:'test:aspd',mods:{aspd:300}});advance(b,1.39);assert.equal(hits.length,0);advance(b,.03);
 assert.equal(tagged(hits,'s2').length,2);advance(b,3.1);assert.equal(tagged(hits,'s2').length,32);
 const atk=u.base.atk*1.13,bb=u.def.skill.bb;
 for(const h of hits){near(h.amount,h.type==='phys'?atk*bb.atk_scale-100:atk*.2*bb.talent_scale*.5);assert.notEqual(h.target,air);}
 for(const target of [e,z])near(100000-target.hp,16*(atk*bb.atk_scale-100+atk*.2*bb.talent_scale*.5));
 assert.equal(u.skill.active,false);assert.equal(u.mem.regularFormVisual.clip,'Idle');assert.equal(skillHud(u.skill),null);
 const times=tagged(hits,'s2').filter(h=>h.target===e).map(h=>h.time);
 evidence.models[ID].Front.hits.Skill_2.forEach((t,i)=>near(times[i],1+t,.05));
});
test('S2 selector retains its START victims, allows damage, raises taunt and rejects stun/freeze/sleep',()=>{
 const {b,hits,place}=make({skill:1,deploy:false}),e=enemy(b);const u=place();
 assert.ok(u.s.taunt>=1);for(const status of ['stun','freeze','sleep'])assert.equal(b.applyStatus(u,status,{duration:10}),false);
 const hp=u.hp;b.dealDamage(e,u,{amount:100,type:'true'});near(u.hp,hp-100);advance(b,1.05);
 const late=enemy(b,{c:5.1});advance(b,3.4);assert.equal(tagged(hits,'s2').length,16);near(late.hp,100000);
 near(u.s.taunt,u.base.tauntLevel??0);assert.equal(b.applyStatus(u,'stun',{duration:1}),true);
});
for(let rank=1;rank<=10;rank++)test(`S3 rank${rank}: moving collision hits ground and air, extends distance and returns`,()=>{
 const {b,hits,place}=make({skill:2,rank,deploy:false}),e=enemy(b,{c:5.3}),air=enemy(b,{c:5.3,fly:true});const u=place();
 const hp=u.hp;b.dealDamage(e,u,{amount:100000,type:'true'});near(u.hp,hp);assert.equal(u.s.flags.noBlock,true);
 assert.equal(skillHud(u.skill).text,'Skill active');advance(b,1.05);assert.ok(u.mem.yatoDash);advance(b,1.3);
 const phys=tagged(hits,'s3');assert.ok(phys.some(h=>h.target===e));assert.ok(phys.some(h=>h.target===air));
 const atk=u.base.atk*1.13,bb=u.def.skill.bb;for(const h of hits)near(h.amount,h.type==='phys'?atk*bb.atk_scale-100:atk*.2*bb.atk_scale*.5);
 assert.equal(u.skill.active,false);near(u.s.blockCnt,1);assert.equal(!!u.s.flags.invulnerable,false);near(u.x,4);near(u.y,3);
});
test('S3 ends at actual stage edge rather than padded engine grid, honours all four facing vectors',()=>{
 for(const [dir,r,c,axis,sign] of [['RIGHT',3,7,'dx',1],['LEFT',3,1,'dx',-1],['UP',1,4,'dy',-1],['DOWN',4,4,'dy',1]]){
 const {b,u,hits}=make({skill:2,dir,r,c});advance(b,1.05);const d=u.mem.yatoDash;assert.ok(d);near(d[axis],sign);
 assert.ok(d.boundary<=5);const expected=axis==='dx'?(sign>0?b.regularMapSize.cols-.5-c:c+.5):(sign>0?b.regularMapSize.rows-.5-r:r+.5);
 near(d.boundary,Math.min(5,expected));advance(b,1.4);assert.equal(u.skill.active,false);assert.equal(hits.length,0);
 }
});
test('S3 collision excludes stealth/sleep, respects repeated distance gates and maximum distance',()=>{
 const {b,hits,place}=make({skill:2,deploy:false});const e=enemy(b,{c:5}),stealth=enemy(b,{c:5}),sleep=enemy(b,{c:5});
 b.addBuff(stealth,{key:'test:stealth',flags:{stealth:true}});b.applyStatus(sleep,'sleep',{duration:10});const u=place();
 advance(b,1.3);assert.ok(tagged(hits,'s3').filter(h=>h.target===e).length>=2);
 near(stealth.hp,100000);near(sleep.hp,100000);if(u.mem.yatoDash)assert.ok(u.mem.yatoDash.limit<=u.skill.bb.max_dist);
 advance(b,1);assert.equal(u.skill.active,false);
});
test('S3 immunity includes born/tail phases, other resistable statuses use native .001 duration floor',()=>{
 const {b,u}=make({skill:2});for(const t of [0,1.3]){
 if(t)advance(b,t);for(const status of ['stun','freeze','sleep'])assert.equal(b.applyStatus(u,status,{duration:10}),false);
 assert.equal(b.applyStatus(u,'cold',{duration:10}),true);near(u.findBuff('cold').timeLeft,.01);advance(b,.04);
 }
 advance(b,1);assert.equal(u.skill.active,false);assert.equal(b.applyStatus(u,'cold',{duration:10}),true);near(u.findBuff('cold').timeLeft,10);
});
test('potential and promotion talent choices use source values, not a hardcoded E2 boost',()=>{
 for(const elite of [0,1,2])for(const potential of [1,5]){
 const {b,u,hits}=make({elite,potential}),e=enemy(b);const atk=u.base.atk*(elite===2?(potential===5?1.16:1.13):1);
 near(u.s.atk,atk);advance(b,1);shot(b,u,e);near(hits.find(h=>h.type==='arts').amount,atk*[.06,.13,.2][elite]*.5);
 }
});
test('retreat cancels pending S1/S2/S3 receipts, erases target counters and rebirth starts a fresh deployment',()=>{
 for(const skill of [0,1,2]){
 const {b,u,hits}=make({skill}),e=enemy(b);advance(b,1.05);
 if(skill===0){shot(b,u,e);shot(b,u,e);assert.equal(b.forceAttack(u,[e]),true);u.atkCd=1000;advance(b,.38);}
 b.retreatOperator(ID);assert.equal(u.deployed,false);const count=hits.length;advance(b,10);assert.equal(hits.length,count);
 assert.equal(u.mem.yatoDash,null);assert.equal(u.mem.yatoCounts.size,0);advance(b,15);b.getPlayer('arkpedia').dp=99;
 const z=b.deployOperator(ID,3,4,'RIGHT');assert.ok(z);z.atkCd=1000;assert.equal(z.skill.active,true);assert.equal(z.mem.yatoCounts.size,0);
 }
});
test('S1 interruption after first combo pair cancels unfired pairs and expiry erases per-enemy marks',()=>{
 const {b,u,hits}=make(),e=enemy(b);advance(b,1.05);shot(b,u,e);shot(b,u,e);hits.length=0;
 b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.45);assert.equal(tagged(hits,'s1').length,2);
 b.applyStatus(u,'stun',{duration:2});advance(b,1);assert.equal(tagged(hits,'s1').length,2);
 advance(b,20);assert.equal(u.mem.yatoCounts.size,0);assert.equal(u.skill.active,false);
});
test('S1 complete composite animation returns to source idle unless another attack supersedes it',()=>{
 const {b,u}=make(),e=enemy(b);advance(b,1.05);shot(b,u,e);shot(b,u,e);shot(b,u,e);
 assert.equal(u.mem.regularFormVisual.clip,'Skill_Attack4');advance(b,.8);assert.equal(u.mem.regularFormVisual.clip,'Skill_Idle');
});
test('native Front and Back hit markers retain their maxAnimScale cap across every facing',()=>{
 for(const dir of ['UP','DOWN','LEFT','RIGHT']){
 const {b,u,hits}=make({dir}),e=enemy(b);advance(b,1.05);const m=evidence.models[ID][dir==='UP'?'Back':'Front'];
 shot(b,u,e);near(effectiveProfile(u).windup(b,u),m.hits.Skill_Attack1[0]);assert.equal(hits.length,4);
 b.addBuff(u,{key:'test:slow',mods:{aspd:-150}});near(effectiveProfile(u).windup(b,u),m.hits.Skill_Attack1[0]/.5);
 }
});
test('Physical and Arts are separate mitigation receipts; only Arts is flagged no-SP',()=>{
 const {b,u,hits}=make(),e=enemy(b);advance(b,21);
 b.addBuff(e,{key:'test:phys-dodge',mods:{dodgePhys:1}});shot(b,u,e);assert.equal(hits.length,1);assert.equal(hits[0].type,'arts');assert.equal(hits[0].dmg.noSp,true);
 b.removeBuff(e,'test:phys-dodge');shot(b,u,e);assert.equal(hits.at(-1).type,'phys');assert.equal(hits.at(-1).dmg.noSp,false);
});
test('S2 death removes taunt/talent and cancels all later animation receipts',()=>{
 const {b,hits,place}=make({skill:1,deploy:false});enemy(b);const u=place();advance(b,1.5);assert.ok(hits.length);
 b.kill(u);const count=hits.length;advance(b,5);assert.equal(hits.length,count);assert.equal(u.mem.yatoDeployment,null);
 assert.equal(u.findBuff(`yato2:archdemon:${u.id}`),null);assert.equal(u.findBuff(`yato2:taunt:${u.id}`),null);
});
test('S3 hit extensions stop at max5 with dense targets, preserving collision rather than deployment-tile damage',()=>{
 const {b,hits,place}=make({skill:2,c:2,deploy:false});
 const es=[];for(let i=0;i<20;i++)es.push(enemy(b,{c:2.5+i*.25}));const behind=enemy(b,{c:1});const u=place();
 advance(b,1.2);assert.ok(u.mem.yatoDash);near(u.mem.yatoDash.limit,5);near(u.mem.yatoDash.boundary,5);
 advance(b,1.3);assert.equal(u.skill.active,false);near(behind.hp,100000);assert.ok(hits.some(h=>h.target===es.at(-1)));
});
