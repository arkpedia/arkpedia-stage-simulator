// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make,enemy,cast,advance,near,until} from './helpers/pedro-fixture.js';
import {PEDRO_CONTRACT} from '../server/sim/content/arkpedia-pedro.js';
import {skillHud} from '../shared/arkpedia/skill-hud.js';
const target=(f,o={})=>enemy(f,{x:6,y:5,...o});
const born=f=>advance(f.b,1.01);
const wait=(f,fn,limit=30)=>until(f,fn,limit);
function ally(f,{x=7,y=5,hp=10000}={}){
 const def=structuredClone(f.u.def);def.chessId=def.charId='fixture:ally';def.stats.maxHp=hp;def.stats.atk=0;
 const a=f.b._makeAlly(f.u.player,def,'op',y,x,{dir:'RIGHT'});f.b._setupUnit(a,{trait:{noAttack:true},talents:[],skill:{kind:'instant',trigger:{rule:'NEVER'}}});assert.ok(f.b._deploy(a,{initial:true,ignoreLimit:true,free:true}));return a;
}
for(const contract of[null,{}, {...PEDRO_CONTRACT}])test('Pedro requires the exact independently reviewed controller contract',()=>assert.throws(()=>make({contract})));
for(const dir of['UP','DOWN','LEFT','RIGHT'])test(`Pedro ${dir} ordinary source marker retains one-target Arts attacks and original facing`,()=>{
 const f=make({dir}),o={UP:{x:5,y:6},DOWN:{x:5,y:4},LEFT:{x:4,y:5},RIGHT:{x:6,y:5}}[dir];target(f,o);wait(f,()=>f.attacks.length>0,4);
 assert.equal(f.attacks[0].targets.length,1);assert.equal(f.u.mem.regularFormVisual.clip,dir==='DOWN'?'Attack_Down':'Attack');assert.equal(f.u.mem.regularVisualDirection,dir);wait(f,()=>f.hits.length>0,2);assert.equal(f.hits[0].type,'arts');assert.equal(f.hits[0].dmg.isSkill,false);assert.equal(f.u.skill.spTotal,1);assert.deepEqual(f.b.errors,[]);
});
for(let rank=1;rank<=10;rank++)test(`Pedro S1 rank ${rank} naturally earns offensive SP and makes one two-target skill receipt`,()=>{
 const f=make({rank}),a=target(f),z=target(f,{x:7});wait(f,()=>f.u.skill.activations>0,30);wait(f,()=>f.attacks.some(a=>a.isSkill),4);
 const receipt=f.attacks.find(a=>a.isSkill);assert.equal(receipt.targets.length,2);assert.equal(f.u.skill.spTotal,0);assert.ok(f.u.skill.active);assert.equal(f.u.mem.regularFormVisual.clip,'Skill_1');
 wait(f,()=>a.findBuff('pedro:s1:trigger')&&z.findBuff('pedro:s1:trigger'),2);const hits=f.hits.filter(x=>x.dmg.isSkill);assert.equal(hits.length,2);near(hits[0].amount,f.u.s.atk*f.record.bb.atk_scale);near(hits[1].amount,f.u.s.atk*f.record.bb.atk_scale);
 assert.equal(hits[0].dmg.attackId,hits[1].dmg.attackId);assert.equal(f.u.skill.activations,1);assert.deepEqual(f.b.errors,[]);
});
for(let rank=1;rank<=10;rank++)test(`Pedro S2 rank ${rank} uses two charges, original marker and selected protection rather than direct healing`,()=>{
 const f=make({skill:2,rank}),a=ally(f),z=ally(f,{x:6});born(f);f.u.skill.setSpTotal(f.u.skill.spCost*2);assert.equal(f.u.skill.charges,2);assert.equal(skillHud(f.u.skill).canActivate,true);const before=f.u.skill.spTotal;assert.equal(f.u.skill.activate('fixture'),true);near(f.u.skill.spTotal,before-f.u.skill.spCost);
 const start=f.b.time;advance(f.b,.7);assert.equal(a.findBuff('pedro:s2:protection'),null);wait(f,()=>!!a.findBuff('pedro:s2:protection'),1);assert.ok(f.b.time-start>=.7333333492279053-1e-7);assert.ok(z.findBuff('pedro:s2:protection'));assert.ok(f.u.findBuff('pedro:s2:protection'));assert.equal(f.attacks.length,0);
 wait(f,()=>!f.u.skill.active,3);assert.equal(f.u.skill.charges,1);assert.equal(f.u.mem.regularFormVisual.clip,'Idle');assert.deepEqual(f.b.errors,[]);
});
test('Pedro Start reserves its original one second before an ordinary attack can begin',()=>{const f=make();target(f);advance(f.b,.99);assert.equal(f.controller.phase.kind,'born');assert.equal(f.attacks.length,0);advance(f.b,.65);assert.equal(f.attacks.length,1);});
test('Pedro S2 may cast during birth without fabricating a separate skill Begin',()=>{const f=make({skill:2});cast(f);assert.equal(f.controller.phase.kind,'s2');assert.equal(f.u.mem.regularFormVisual.clip,'Skill_2');advance(f.b,.8);assert.ok(f.u.findBuff('pedro:s2:protection'));assert.equal(f.attacks.length,0);});
for(const aspd of[50,100,200])test(`Pedro S2 fixed hit clock is independent of ${aspd} ASPD`,()=>{
 const f=make({skill:2});born(f);f.b.addBuff(f.u,{key:'fixture:aspd',mods:{aspd:aspd-100}});cast(f);advance(f.b,.7);assert.equal(f.u.findBuff('pedro:s2:protection'),null);advance(f.b,.07);assert.ok(f.u.findBuff('pedro:s2:protection'));near(f.u.mem.regularFormVisual.speed,1);
});
for(const aspd of[50,200])test(`Pedro ordinary marker caps source playback under ${aspd} ASPD while cooldown stays independent`,()=>{
 const f=make();target(f);f.b.addBuff(f.u,{key:'fixture:aspd',mods:{aspd:aspd-100}});born(f);const p=f.controller.phase;assert.equal(p.kind,'attack');const speed=Math.min(1,aspd/100);near(f.u.mem.regularFormVisual.speed,speed);near(p.releaseAt-(p.until-f.u.s.interval),.6000000238418579/speed);
});
test('Pedro S2 fixed elapsed clock responds once to live native slow-down',()=>{
 const f=make({skill:2});born(f);cast(f);f.b.addBuff(f.u,{key:'fixture:slow-down',mods:{slowDownMul:.5}});advance(f.b,1.3);assert.equal(f.u.findBuff('pedro:s2:protection'),null);near(f.u.mem.regularFormVisual.speed,.5);advance(f.b,.2);assert.ok(f.u.findBuff('pedro:s2:protection'));f.b.removeBuff(f.u,'fixture:slow-down');wait(f,()=>!f.u.skill.active,3);assert.deepEqual(f.b.errors,[]);
});
test('Pedro S1 selection prefers unmarked legal enemies and retains at most two captured inputs',()=>{
 const f=make(),a=target(f),z=target(f,{x:7}),q=target(f,{x:8});born(f);f.resources.applyS1(f.resources.captureS1(a));f.controller.phase=null;f.u.atkCd=0;cast(f);assert.deepEqual(new Set(f.controller.phase.inputs.map(x=>x.target)),new Set([z,q]));
});
test('Pedro S2 selection prefers unprotected allies then lower current HP ratio, including its owner',()=>{
 const f=make({skill:2}),a=ally(f),z=ally(f,{x:6}),q=ally(f,{x:8});born(f);f.resources.protect(a);q.hp=q.s.maxHp*.6;z.hp=z.s.maxHp*.8;cast(f);assert.deepEqual(f.controller.phase.inputs.map(x=>x.target),[q,z,f.u]);
});
for(const control of['stun','freeze','disarm'])test(`Pedro ${control} before ordinary marker cancels pending work without resetting positive cooldown`,()=>{
 const f=make();target(f);born(f);const cd=f.u.atkCd;if(control==='disarm')f.b.addBuff(f.u,{key:'fixture:disarm',flags:{disarm:true}});else f.b.applyStatus(f.u,control,{duration:1});advance(f.b,.1);assert.equal(f.attacks.length,0);assert.ok(f.u.atkCd>0&&f.u.atkCd<=cd);assert.equal(f.controller.phase,null);
});
for(const control of['stun','freeze'])test(`Pedro S2 interrupted by ${control} does not create unlaunched protection`,()=>{const f=make({skill:2});born(f);cast(f);f.b.applyStatus(f.u,control,{duration:1});advance(f.b,.1);assert.equal(f.u.skill.active,false);assert.equal(f.u.findBuff('pedro:s2:protection'),null);});
test('Pedro conservative S2 interruption mapping rejects work after an accepted disarm epoch',()=>{const f=make({skill:2});born(f);cast(f);f.b.addBuff(f.u,{key:'fixture:disarm',flags:{disarm:true}});advance(f.b,.8);assert.equal(f.u.findBuff('pedro:s2:protection'),null);assert.equal(f.u.skill.active,false);assert.equal(f.attacks.length,0);});
test('Pedro S1 complete captured target loss refunds the charge without a phantom attack',()=>{
 const f=make(),t=target(f);born(f);f.controller.phase=null;f.u.atkCd=0;cast(f);f.b.kill(t,null);advance(f.b,2.2);assert.equal(f.attacks.length,0);assert.equal(f.u.skill.ready,true);assert.equal(f.u.skill.active,false);
});
test('Pedro S1 one lost target is omitted without replacing it with a third enemy',()=>{
 const f=make(),a=target(f),z=target(f,{x:7});born(f);f.controller.phase=null;f.u.atkCd=0;cast(f);f.b.kill(a,null);const q=target(f,{x:8});wait(f,()=>f.attacks.length>0,2);assert.deepEqual(f.attacks[0].targets,[z]);assert.ok(!f.attacks[0].targets.includes(q));
});
for(const mode of['veto','duplicate','substitute'])test(`Pedro beforeAttack ${mode} cannot fabricate projectile work`,()=>{
 const f=make(),a=target(f),z=target(f,{x:7});born(f);f.b.on('beforeAttack',c=>{if(c.attacker!==f.u)return;if(mode==='veto')c.cancel=true;else if(mode==='duplicate')c.targets=[a,a];else c.targets=[z];});advance(f.b,.8);assert.equal(f.attacks.length,0);assert.equal(f.hits.length,0);assert.equal(f.controller.flights.size,0);
});
test('Pedro recursive beforeAttack callback serializes one ordinary receipt',()=>{
 const f=make(),t=target(f);let n=0;f.b.on('beforeAttack',c=>{if(c.attacker===f.u){n++;f.b.forceAttack(f.u,[t]);}});wait(f,()=>f.attacks.length>0,4);assert.equal(n,1);assert.equal(f.attacks.length,1);
});
test('Pedro source loss after launch preserves a born shot but before launch cancels it',()=>{
 for(const after of[false,true]){const f=make(),t=target(f,{x:8});if(after)wait(f,()=>f.attacks.length>0,4);else born(f);const hp=t.hp;f.b.retreat(f.u,{permanent:true});advance(f.b,1);assert.equal(t.hp<hp,after);assert.equal(f.controller.handles.length,0);assert.equal(f.controller.phase,null);assert.equal(f.controller.stopped,true);assert.deepEqual(f.b.errors,[]);}
});
test('Pedro born ordinary shot uses current source ATK until retreat, then the birth snapshot',()=>{
 for(const retreat of[false,true]){const f=make(),t=target(f,{x:8}),atk=f.u.s.atk;wait(f,()=>f.attacks.length>0,4);f.b.addBuff(f.u,{key:'fixture:atk',mods:{atkPct:1}});if(retreat)f.b.retreat(f.u,{permanent:true});wait(f,()=>f.hits.length>0,2);near(f.hits[0].amount,atk*(retreat?1:2));}
});
test('Pedro S2 preserves an ordinary positive cooldown when replacing its windup',()=>{
 const f=make({skill:2});target(f);born(f);const cd=f.u.atkCd;cast(f);near(f.u.atkCd,cd);assert.equal(f.controller.phase.kind,'s2');assert.equal(f.attacks.length,0);advance(f.b,.8);assert.equal(f.attacks.length,0);
});
test('Pedro S2 input loss omits that life and never replaces it at the marker',()=>{
 const f=make({skill:2}),a=ally(f);born(f);cast(f);f.b.retreat(a,{permanent:true});const z=ally(f);advance(f.b,.8);assert.equal(z.findBuff('pedro:s2:protection'),null);assert.ok(f.u.findBuff('pedro:s2:protection'));
});
test('Pedro source removal in the post-launch attack callback preserves the already born shot',()=>{const f=make();target(f);f.b.on('attack',c=>{if(c.attacker===f.u)f.b.retreat(f.u,{permanent:true});});advance(f.b,2);assert.equal(f.hits.length,1);assert.equal(f.controller.flights.size,0);assert.equal(f.controller.handles.length,0);assert.deepEqual(f.b.errors,[]);});
test('Pedro battle end clears launched flights and held controller resources',()=>{const f=make();target(f,{x:8});wait(f,()=>f.controller.flights.size>0,4);f.b.finished=true;f.b.emit('battleEnd',{});assert.equal(f.controller.flights.size,0);assert.equal(f.b.projectiles.list.filter(p=>p.data?.pedroOwner).length,0);assert.equal(f.controller.handles.length,0);assert.equal(f.resources.field.handles.length,0);});
for(const skill of[1,2])for(const dir of['UP','DOWN'])test(`Pedro S${skill} ${dir} uses only the literal original hit and facing clip`,()=>{
 const f=make({skill,dir}),p=dir==='UP'?{x:5,y:6}:{x:5,y:4};if(skill===1)target(f,p);else ally(f,p);born(f);f.controller.phase=null;f.u.atkCd=0;cast(f);
 assert.equal(f.u.mem.regularFormVisual.clip,dir==='DOWN'?`Skill_Down_${skill}`:`Skill_${skill}`);assert.equal(f.u.mem.regularVisualDirection,dir);assert.deepEqual(f.b.errors,[]);
});
for(const skill of[1,2])test(`Pedro S${skill} source canSilenced zero does not invent a silence restriction`,()=>{
 const f=make({skill});if(skill===1)target(f);born(f);f.controller.phase=null;f.u.atkCd=0;f.b.applyStatus(f.u,'silence',{duration:5});cast(f);advance(f.b,.8);if(skill===1)assert.equal(f.attacks.length,1);else assert.ok(f.u.findBuff('pedro:s2:protection'));assert.deepEqual(f.b.errors,[]);
});
for(const skill of[1,2])test(`Pedro S${skill} short accepted stun expiring between ticks still cancels a pending cast`,()=>{
 const f=make({skill});if(skill===1)target(f);born(f);f.controller.phase=null;f.u.atkCd=0;cast(f);f.b.applyStatus(f.u,'stun',{duration:.001});advance(f.b,.8);assert.equal(f.u.skill.active,false);assert.equal(f.attacks.length,0);assert.equal(f.u.findBuff('pedro:s2:protection'),null);
});
test('Pedro S2 manual charge use locks time SP only during its original cast clip',()=>{
 const f=make({skill:2});born(f);f.u.skill.setSpTotal(f.u.skill.spCost*2);f.u.skill.activate('fixture');const sp=f.u.skill.spTotal;advance(f.b,1);near(f.u.skill.spTotal,sp);wait(f,()=>!f.u.skill.active,2);const end=f.u.skill.spTotal;advance(f.b,1);assert.ok(f.u.skill.spTotal>end);assert.equal(f.u.skill.charges,1);
});
test('Pedro S1 idle time earns no offensive SP and no target spends no ready charge',()=>{const f=make();advance(f.b,10);near(f.u.skill.spTotal,0);f.u.skill.setSpTotal(f.u.skill.spCost);advance(f.b,5);assert.equal(f.u.skill.activations,0);assert.equal(f.u.skill.ready,true);});
test('Pedro S1 control interruption does not invent the all-targets-dead SP refund',()=>{
 const f=make();target(f);born(f);f.controller.phase=null;f.u.atkCd=0;cast(f);f.b.applyStatus(f.u,'stun',{duration:1});advance(f.b,.1);assert.equal(f.u.skill.active,false);assert.equal(f.u.skill.spTotal,0);assert.equal(f.attacks.length,0);
});
test('Pedro S1 newly attached mark does not recursively consume itself on the direct skill hit',()=>{
 const f=make(),a=target(f);born(f);f.controller.phase=null;f.u.atkCd=0;cast(f);wait(f,()=>!!a.findBuff('pedro:s1:trigger'),2);assert.equal(f.hits.length,1);near(f.hits[0].amount,f.u.s.atk*f.record.bb.atk_scale);
 const hp=a.hp;f.b.dealDamage(null,a,{amount:1,type:'arts',canDodge:false});near(hp-a.hp,1+f.u.s.atk*f.record.bb.debuff_atk_scale);assert.equal(a.findBuff('pedro:s1:trigger'),null);
});
test('Pedro a captured target may leave range before release without replacing or cancelling its retained life',()=>{
 const f=make(),a=target(f);born(f);a.x=15;f.b._buildEnemyIndex();wait(f,()=>f.attacks.length>0,2);assert.deepEqual(f.attacks[0].targets,[a]);wait(f,()=>f.hits.length>0,2);assert.deepEqual(f.b.errors,[]);
});
test('Pedro direct projectile target-life changes prevent wrong-life damage or mark attachment',()=>{
 const f=make(),a=target(f,{x:8});wait(f,()=>f.attacks.length>0,4);a.deploySeq++;advance(f.b,1);assert.equal(f.hits.length,0);assert.equal(a.findBuff('pedro:s1:trigger'),null);
});
test('Pedro beforeAttack owner removal cancels all births and attack SP',()=>{const f=make();target(f);f.b.on('beforeAttack',c=>{if(c.attacker===f.u)f.b.retreat(f.u,{permanent:true});});advance(f.b,2);assert.equal(f.hits.length,0);assert.equal(f.attacks.length,0);assert.equal(f.controller.flights.size,0);assert.deepEqual(f.b.errors,[]);});
test('Pedro S2 born protection survives natural cast finish and owner removal',()=>{const f=make({skill:2}),a=ally(f);born(f);cast(f);wait(f,()=>!!a.findBuff('pedro:s2:protection'),2);wait(f,()=>!f.u.skill.active,3);const amount=a.findBuff('pedro:s2:protection').data.pedro.amount;f.b.retreat(f.u,{permanent:true});a.hp=100;advance(f.b,.21);near(a.hp,100+amount);assert.ok(a.findBuff('pedro:s2:taunt'));});
test('Pedro controller cleanup is idempotent and does not admit forced attacks after stop',()=>{const f=make(),t=target(f);born(f);f.controller.stop();f.controller.stop();assert.equal(f.b.forceAttack(f.u,[t]),false);assert.throws(()=>f.controller.install());assert.equal(f.controller.handles.length,0);assert.deepEqual(f.b.errors,[]);});

test('Pedro independent flight watcher survives source retreat and cancels born work on later battle end',()=>{
 const f=make(),a=target(f,{x:8});wait(f,()=>f.controller.flights.size>0,4);f.b.retreat(f.u,{permanent:true});assert.equal(f.controller.flights.size,1);assert.equal(f.controller.flightHandles.length,2);f.b.finished=true;f.b.emit('battleEnd',{});assert.equal(f.controller.flights.size,0);assert.equal(f.controller.flightHandles.length,0);assert.equal(f.b.projectiles.list.filter(p=>p.data?.pedroOwner).length,0);near(a.hp,a.s.maxHp);
});
test('Pedro independent flight watcher retires after a lost target invalidates its final projectile',()=>{
 const f=make(),a=target(f,{x:8});wait(f,()=>f.controller.flights.size>0,4);f.b.retreat(f.u,{permanent:true});f.b.kill(a,null);advance(f.b,10.1);assert.equal(f.controller.flights.size,0);assert.equal(f.controller.flightHandles.length,0);assert.equal(f.resources.field.tickets.size,0);assert.equal(f.resources.field.handles.length,0);
});
