// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make,enemy,cast,near,advance,until} from './helpers/snhunt-fixture.js';
import {applySourceCold} from '../server/sim/content/arkpedia-source-cold.js';
import {ammunitionHud,skillHud} from '../shared/arkpedia/skill-hud.js';
const arrows=f=>f.shots.filter(p=>p.data.projectileKey!=='projectile_chr_snhunt_animal');
test('source controller rejects missing contract and mutated input before installing seasonal hooks',()=>{
 assert.throws(()=>make({contract:null}));
 for(const mutate of[d=>d.stats.atk++,d=>d.traitBb.value++,d=>d.skill.bb.atk_scale++,d=>d.raw.arkpedia.skillId='other'])assert.throws(()=>make({mutate}));
});
for(const elite of[0,1,2])test(`E${elite} starts full, fires one legal target and consumes one round`,()=>{
 const f=make({elite}),e=enemy(f),other=enemy(f,{x:6.1});advance(f.b,.9);
 assert.equal(f.magazine.bullets,[4,6,8][elite]);assert.equal(f.shots.length,0);
 until(f,()=>f.hits.length>0,2);assert.equal(arrows(f).length,1);assert.equal(f.attacks.length,1);
 assert.equal(f.magazine.bullets,[3,5,7][elite]);near(100000-e.hp,f.u.s.atk*1.2);near(other.hp,100000);
 assert.equal(f.u.skill.spTotal,1);assert.equal(f.shots[0].speed,10);
});
for(const skill of[1,2])for(let rank=1;rank<=10;rank++)test(`S${skill} rank ${rank} retains selected scale, attack receipts and ammunition`,()=>{
 const f=make({skill,rank});advance(f.b,1.1);const e=enemy(f);cast(f);const ammo=f.magazine.bullets;
 until(f,()=>!f.u.skill.active,3);advance(f.b,.15);
 const kind=`snhunt:s${skill}`,hits=f.hits.filter(h=>h.dmg.tags?.includes(kind));
 assert.equal(hits.length,skill===1?1:2);const scale=skill===1?f.record.bb.atk_scale:f.record.bb.atk_scale_2;
 for(const h of hits)near(h.amount,f.u.s.atk*1.2*scale);
 assert.equal(f.magazine.bullets,ammo-(skill===1?1:0));assert.equal(f.attacks.length,skill===1?1:0);
 assert.equal(f.shots.filter(p=>p.data.projectileKey==='projectile_chr_snhunt_animal').length,1);
 const beast=f.hits.find(h=>h.dmg.tags?.includes('snhunt:beast'));near(beast.amount,f.u.s.atk*1.8);
 assert.equal(e.s.flags.cold,true);near(e.s.aspd,e.base.aspd-30);
 if(skill===2){const ss=arrows(f);assert.equal(ss.length,2);near(ss[1].time-ss[0].time,.18,f.b.dt+1e-6);}
});
test('fixed reload loop adds one round at completion, clamps capacity and clears reload flag',()=>{
 const f=make();for(let i=0;i<3;i++)f.magazine.consume();advance(f.b,1.1);assert.equal(f.magazine.bullets,5);
 until(f,()=>f.controller.phase?.kind==='reload',1);const start=f.b.time;
 advance(f.b,1.5);assert.equal(f.magazine.bullets,5);until(f,()=>f.magazine.bullets===6,1);near(f.b.time-start,1.6,f.b.dt+1e-6);
 advance(f.b,3.5);assert.equal(f.magazine.bullets,8);assert.equal(f.controller.reloadFlag,false);assert.equal(f.u.mem.regularFormVisual.clip,'Idle');
});
test('S2 casts with zero ammunition, keeps two charges and interrupts pending reload without an extra refill',()=>{
 const f=make({skill:2});while(f.magazine.consume());enemy(f);advance(f.b,1.3);assert.equal(f.controller.phase.kind,'reload');
 cast(f,2);assert.equal(f.u.skill.charges,1);until(f,()=>!f.u.skill.active,2);
 assert.equal(arrows(f).length,2);assert.equal(f.magazine.bullets,0);assert.equal(f.attacks.length,0);
});
test('S1 naturally charges from accepted ordinary releases and does not recover offensive SP from its powered arrow',()=>{
 const f=make({elite:0}),e=enemy(f);until(f,()=>f.shots.some(p=>p.data.projectileKey==='projectile_chr_snhunt_01'),30);
 assert.equal(arrows(f).length,f.u.skill.spCost+1);assert.equal(f.u.skill.spTotal,0);assert.equal(f.hits.some(h=>h.dmg.tags?.includes('snhunt:beast')),false);
 assert.ok(e.hp>0);
});
test('external forced attack cannot bypass the source release gate',()=>{
 const f=make(),e=enemy(f);f.b.forceAttack(f.u,[e]);assert.equal(f.shots.length,0);assert.equal(f.magazine.bullets,8);assert.equal(f.attacks.length,0);
});
for(const dir of['RIGHT','LEFT','UP','DOWN'])test(`${dir} uses original facing family and uncapped firing speed, while reload stays fixed`,()=>{
 const f=make({dir}),x=5+(dir==='RIGHT'?1:dir==='LEFT'?-1:0),y=5+(dir==='UP'?1:dir==='DOWN'?-1:0);
 f.b.addBuff(f.u,{key:'fixture:fast',mods:{aspd:200}});enemy(f,{x,y});until(f,()=>arrows(f).length===1,3);
 assert.equal(f.u.mem.regularFormVisual.clip,dir==='DOWN'?'Attack_Down_Loop':'Attack_Loop');near(f.u.mem.regularFormVisual.speed,3);
 assert.equal(f.controller.model().durations.Attack_Down_Loop!=null,dir!=='UP');
 const g=make({dir});g.b.addBuff(g.u,{key:'fixture:fast',mods:{aspd:200}});g.magazine.consume();
 until(g,()=>g.controller.phase?.kind==='reload',3);near(g.u.mem.regularFormVisual.speed,1);
 const t=g.b.time;until(g,()=>g.magazine.bullets===8,3);near(g.b.time-t,1.6,g.b.dt+1e-6);
});
test('a target returning during reload breaks only with existing ammunition, preserving partial refill',()=>{
 const f=make();f.magazine.consume();until(f,()=>f.controller.phase?.kind==='reload',3);enemy(f);advance(f.b,f.b.dt);
 assert.equal(f.u.mem.regularFormVisual.clip,'Reload_Break');assert.equal(f.magazine.bullets,7);
 until(f,()=>arrows(f).length===1,1);assert.equal(f.magazine.bullets,6);
 const g=make();while(g.magazine.consume());enemy(g);advance(g.b,2.7);assert.equal(g.magazine.bullets,0);assert.equal(arrows(g).length,0);
 until(g,()=>arrows(g).length===1,1);assert.equal(g.magazine.bullets,0);
});
test('S1 lost target before arrow release refunds SP and does not consume ammunition; its born beast still finishes',()=>{
 const f=make();advance(f.b,1.1);const e=enemy(f);cast(f);e.x=15;f.b._buildEnemyIndex();advance(f.b,.3);
 assert.equal(arrows(f).length,0);assert.equal(f.magazine.bullets,8);assert.equal(f.u.skill.spTotal,f.u.skill.spCost);
 assert.equal(f.attacks.length,0);assert.equal(f.hits.filter(h=>h.dmg.tags.includes('snhunt:beast')).length,1);
 assert.equal(e.s.flags.cold,true);
});
test('S2 selects each arrow separately and uses the impact-time TRAP/stationary predicate',()=>{
 for(const trap of[false,true]){
  const f=make({skill:2});advance(f.b,1.1);const e=enemy(f),other=enemy(f,{x:6.2});cast(f);
  until(f,()=>arrows(f).length===1,1);e.hidden=true;f.b._buildEnemyIndex();
  until(f,()=>arrows(f).length===2,1);assert.equal(arrows(f)[1].target,other);
  f.b.removeBuff(other,'fixture:pin');other.base.moveSpeed=.1;other.markDirty();
  other.def={...other.def,profession:trap?'TRAP':'WARRIOR'};
  other.route={legs:[{t:'move',r:5,c:10,final:true}],legIdx:0,pts:null};
  until(f,()=>f.hits.some(h=>h.target===other),1);assert.equal(other.moving,true);
  const hit=f.hits.find(h=>h.target===other);near(hit.amount,f.u.s.atk*1.2*(trap?2.6:2.2));
 }
});
for(const status of['stun','disarm'])test(`${status} cancels pending S2 arrows but preserves the born beast`,()=>{
 const f=make({skill:2});advance(f.b,1.1);const e=enemy(f);cast(f);
 if(status==='stun')f.b.applyStatus(f.u,'stun',{duration:.5});else f.b.addBuff(f.u,{key:'fixture:disarm',flags:{disarm:true}});
 advance(f.b,.3);assert.equal(arrows(f).length,0);assert.equal(f.u.skill.active,false);assert.equal(f.magazine.bullets,8);
 assert.equal(e.s.flags.cold,true);assert.equal(f.hits.length,1);
});
test('beast Cold is not damage-missable; dodge and barrier preserve Cold, while status rejection still applies',()=>{
 for(const kind of['dodge','barrier','status-rejected']){
  const f=make({skill:2});advance(f.b,1.1);const e=enemy(f);
  if(kind==='dodge')f.b.addBuff(e,{key:'fixture:dodge',mods:{dodgePhys:1}});
  if(kind==='barrier')f.b.addBuff(e,{key:'fixture:shield',shield:100000});
  if(kind==='status-rejected')f.b.on('beforeStatus',c=>{if(c.target===e&&c.status==='cold')c.cancel=true;});
  cast(f);advance(f.b,.1);assert.equal(!!e.s.flags.cold,kind!=='status-rejected',kind);
  if(kind!=='status-rejected')near(e.hp,100000);
 }
});
test('beast Cold shares single-use pairing credits, resistance and one ASPD penalty with other source producers',()=>{
 const f=make({skill:2});advance(f.b,1.1);const e=enemy(f);f.b.applyStatus(e,'resist',{value:.5});
 applySourceCold(f.b,f.u,e,8);cast(f);advance(f.b,.1);
 assert.equal(e.s.flags.freeze,true);near(e.s.aspd,e.base.aspd);assert.ok(e.findBuff('freeze').timeLeft>3.8);
 assert.equal(e.buffs.filter(b=>b.status==='cold'&&b.data.gnosisPaired).length,2);
 f.b.removeBuff(e,'freeze');applySourceCold(f.b,f.u,e,3);assert.equal(!!e.s.flags.freeze,false);
 near(e.s.aspd,e.base.aspd-30);applySourceCold(f.b,f.u,e,3);assert.equal(e.s.flags.freeze,true);
 f.b.retreat(f.u,{permanent:true});advance(f.b,5);near(e.s.aspd,e.base.aspd);assert.equal(e.buffs.some(b=>b.status==='cold'),false);
 assert.equal(f.b._sourceColdLayers.handles.length,0);
});
test('Freeze immunity retains Cold without stacking ASPD; expired Snow-only Cold restores speed after source retirement',()=>{
 const f=make({skill:2});advance(f.b,1.1);const e=enemy(f);e.def.immune.add('frozen');
 applySourceCold(f.b,f.u,e,1);cast(f);advance(f.b,.1);assert.equal(!!e.s.flags.freeze,false);near(e.s.aspd,e.base.aspd-30);
 f.b.retreat(f.u,{permanent:true});advance(f.b,3.1);near(e.s.aspd,e.base.aspd);assert.equal(f.b._sourceColdLayers.targets.size,0);
});
test('born arrows survive source retirement with launch snapshot and do not inherit the retired actor’s later stats',()=>{
 const f=make({elite:0}),e=enemy(f,{x:7.8});until(f,()=>arrows(f).length===1,3);const atk=f.u.s.atk;
 f.b.retreat(f.u,{permanent:true});f.u.base.atk=1;f.u.markDirty();advance(f.b,.5);
 near(100000-e.hp,atk*1.2);assert.equal(f.magazine.removed,true);assert.equal(f.magazine.bullets,3);
 assert.equal(f.controller.projectiles.flights.size,0);assert.equal(f.controller.handles.length,0);
});
test('born arrows use current same-life source stats and ignore later range exit, but never hit a replacement target life',()=>{
 const f=make({elite:0}),e=enemy(f,{x:7.8});until(f,()=>arrows(f).length===1,3);
 f.b.addBuff(f.u,{key:'fixture:atk',mods:{atkPct:1}});e.x=10;f.b._buildEnemyIndex();advance(f.b,.6);near(100000-e.hp,f.u.s.atk*1.2);
 const g=make({elite:0}),t=enemy(g,{x:7.8});until(g,()=>arrows(g).length===1,3);t.deploySeq++;advance(g.b,.5);near(t.hp,100000);
 advance(g.b,10.1);assert.equal(g.controller.projectiles.flights.size,0);
});
test('source magazine HUD stays distinct from SP and manual S2 can activate during birth',()=>{
 const f=make({skill:2}),e=enemy(f);assert.equal(f.controller.phase.kind,'born');
 cast(f);assert.equal(f.u.skill.active,true);assert.equal(skillHud(f.u.skill).canActivate,false);
 assert.deepEqual(ammunitionHud(f.u),{current:8,maximum:8,text:'8 / 8 ammunition'});
 until(f,()=>arrows(f).length===2,2);assert.ok(e.hp<100000);assert.equal(ammunitionHud(f.u).current,8);
 f.b.retreat(f.u,{permanent:true});advance(f.b,1);assert.equal(f.magazine.removed,true);
});
