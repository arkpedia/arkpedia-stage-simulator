// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make,enemy,advance,until,near} from './helpers/cairn-resource-fixture.js';
for(let rank=1;rank<=10;rank++)test(`Cairn S1/rank ${rank} changes maximum HP without healing or manufacturing an attack`,()=>{
 const f=make({rank}),{b,u,resources:r}=f,max=u.s.maxHp;u.hp=max*.4;
 assert.equal(r.beginHp(),true);near(u.s.maxHp,max*(1+f.record.bb.max_hp));near(u.hp/u.s.maxHp,.4);
 r.beginHp();near(u.s.maxHp,max*(1+f.record.bb.max_hp));
 r.endHp();near(u.s.maxHp,max);near(u.hp,max*.4);assert.equal(f.attacks.length,0);assert.equal(f.hits.length,0);assert.deepEqual(b.errors,[]);
});
for(let rank=1;rank<=10;rank++)test(`Cairn S2/rank ${rank} grants a capped finite shield through shared damage absorption`,()=>{
 const f=make({skill:2,rank}),{b,u,resources:r}=f,amount=u.s.maxHp*f.record.bb.shield_hp_ratio;
 assert.equal(r.grantShield(),true);near(u.findBuff(r.shieldKey).shield,amount);
 const hp=u.hp;b.dealDamage(null,u,{amount:100,type:'true',canDodge:false});near(u.hp,hp);near(u.findBuff(r.shieldKey).shield,amount-100);
 assert.equal(r.grantShield(),true);near(u.findBuff(r.shieldKey).shield,amount);
 advance(b,9.9);assert.ok(u.findBuff(r.shieldKey));advance(b,.2);assert.equal(u.findBuff(r.shieldKey),null);near(u.hp,hp);
});
test('Cairn shield extension keeps a longer remainder and re-caps after maximum HP falls',()=>{
 const f=make({skill:2}),{b,u,resources:r}=f;b.addBuff(u,{key:'qa:hp',mods:{hpPct:1}});r.grantShield();
 const initial=u.findBuff(r.shieldKey);initial.timeLeft=20;b.removeBuff(u,'qa:hp');r.grantShield();
 near(initial.shield,u.s.maxHp*f.record.bb.shield_max_hp_ratio);near(initial.timeLeft,20);
 advance(b,10.1);assert.ok(u.findBuff(r.shieldKey));advance(b,10);assert.equal(u.findBuff(r.shieldKey),null);
});
test('Cairn S2 snapshots ATK on attachment and supplies ten delayed paired ticks without attacks',()=>{
 const f=make({skill:2}),{b,u,resources:r}=f,t=enemy(f,{x:8}),atk=u.s.atk;
 r.attachDot(t);b.addBuff(u,{key:'qa:atk',mods:{atkPct:1}});advance(b,.9);assert.equal(f.hits.length,0);
 advance(b,.15);let arts=f.hits.filter(h=>h.type==='arts'),ep=f.hits.filter(h=>h.type==='element');
 assert.equal(arts.length,1);assert.equal(ep.length,1);near(arts[0].amount,atk*f.record.bb.atk_scale);near(ep[0].amount,atk*f.record.bb.ep_damage_ratio);
 advance(b,9.1);arts=f.hits.filter(h=>h.type==='arts');ep=f.hits.filter(h=>h.type==='element');
 assert.equal(arts.length,10);assert.equal(ep.length,10);assert.equal(t.findBuff(r.dotKey),null);assert.equal(f.attacks.length,0);
});
test('Cairn S2 recipient effect persists outside range and after retreat; injury loses its source',()=>{
 const f=make({skill:2}),{b,u,resources:r}=f,t=enemy(f,{x:8}),seen=[];
 b.on('damaged',c=>{if(c.target===t)seen.push(c);});r.attachDot(t);b.retreat(u,{permanent:true});advance(b,2.1);
 assert.equal(r.stopped,true);assert.equal(seen.filter(h=>h.type==='arts').length,2);assert.equal(seen.filter(h=>h.type==='element').length,2);
 assert.ok(seen.filter(h=>h.type==='arts').every(h=>h.source===u));assert.ok(seen.filter(h=>h.type==='element').every(h=>h.source===null));
 assert.ok(t.findBuff(r.dotKey));assert.equal(u.findBuff(r.shieldKey),null);assert.equal(r.handles.length,0);
});
for(const mode of['shield','dodge','cancel'])test(`Cairn S2 ${mode} of Arts does not cancel separate neural injury`,()=>{
 const f=make({skill:2}),{b,resources:r}=f,t=enemy(f,{x:8});
 if(mode==='shield')b.addBuff(t,{key:'qa:shield',shield:100000});
 if(mode==='dodge')b.addBuff(t,{key:'qa:dodge',mods:{dodgeArts:1}});
 if(mode==='cancel')b.on('hit',c=>{if(c.target===t&&c.dmg.tags.includes('cairn:s2-dot'))c.cancel=true;});
 r.attachDot(t);advance(b,1.1);near(t.hp,t.s.maxHp);near(t.elem.neural,f.u.s.atk*f.record.bb.ep_damage_ratio);
});
test('Cairn shared DOT replacement keeps one recipient buff and captures the new ATK',()=>{
 const f=make({skill:2}),{b,u,resources:r}=f,t=enemy(f,{x:8}),base=u.s.atk;
 const old=r.attachDot(t);advance(b,.5);b.addBuff(u,{key:'qa:atk',mods:{atkPct:1}});const next=r.attachDot(t);
 assert.notEqual(old,next);assert.equal(t.buffs.filter(v=>v.key===r.dotKey).length,1);advance(b,.6);assert.equal(f.hits.length,0);
 advance(b,.5);near(f.hits.find(h=>h.type==='arts').amount,base*2*f.record.bb.atk_scale);
});
for(const elite of[0,1,2])for(const potential of[1,6])test(`Cairn E${elite}/P${potential} blocked talent delays a second and samples current ATK`,()=>{
 const f=make({elite,potential}),{b,u,resources:r}=f,t=enemy(f);
 until(f,()=>t.blockedBy===u,1);advance(b,.9);assert.equal(f.hits.length,0);
 b.addBuff(u,{key:'qa:atk',mods:{atkPct:1}});advance(b,.2);
 if(elite===0){assert.equal(f.hits.length,0);assert.equal(r.blocked.size,0);}
 else{const h=f.hits.filter(h=>h.dmg.tags.includes('cairn:talent-injury'));assert.equal(h.length,1);near(h[0].amount,u.s.atk*f.record.talentBb[0].ep_damage_ratio);}
});
test('Cairn block loss stops the derived talent and reblocking restarts its full delay',()=>{
 const f=make(),{b,u,resources:r}=f,t=enemy(f);until(f,()=>r.blocked.has(t),1);advance(b,.5);
 b.addBuff(t,{key:'qa:unblock',flags:{unblockable:true}});advance(b,.1);assert.equal(r.blocked.size,0);assert.equal(t.findBuff(r.talentKey),null);
 advance(b,1.1);assert.equal(f.hits.length,0);b.removeBuff(t,'qa:unblock');until(f,()=>r.blocked.has(t),1);advance(b,.9);assert.equal(f.hits.length,0);
 advance(b,.2);assert.equal(f.hits.length,1);assert.equal(t.blockedBy,u);
});
test('Cairn talent checks invincibility on initial block attachment, without retrying during that block',()=>{
 const f=make(),{b,u,resources:r}=f,t=enemy(f);b.addBuff(t,{key:'qa:invincible',flags:{invulnerable:true}});
 until(f,()=>r.blocked.has(t),1);assert.equal(r.blocked.get(t).child,false);b.removeBuff(t,'qa:invincible');advance(b,1.2);assert.equal(f.hits.length,0);
 b.addBuff(t,{key:'qa:unblock',flags:{unblockable:true}});advance(b,.1);b.removeBuff(t,'qa:unblock');until(f,()=>r.blocked.get(t)?.child,1);advance(b,1.1);assert.equal(f.hits.length,1);
});
test('Cairn talent observes only his blocked enemies and clears immediately after retirement',()=>{
 const f=make(),{b,u,resources:r}=f,t=enemy(f),other=enemy(f,{x:8});until(f,()=>r.blocked.has(t),1);
 advance(b,1.1);near(other.elem.neural,0);assert.ok(t.elem.neural>0);const value=t.elem.neural;
 b.retreat(u,{permanent:true});assert.equal(r.blocked.size,0);assert.equal(t.findBuff(r.talentKey),null);advance(b,2);near(t.elem.neural,value);
});
test('Cairn rejected resource attachments do not create shield/HP or talent output',()=>{
 const f=make(),{b,u,resources:r}=f;b.on('beforeBuff',c=>{if(c.buff.key.startsWith('cairn:'))c.cancel=true;});
 assert.equal(r.beginHp(),false);enemy(f);advance(b,2);assert.equal(f.hits.length,0);assert.equal(u.findBuff(r.hpKey),null);
 const g=make({skill:2});g.b.on('beforeBuff',c=>{if(c.buff.key===g.resources.shieldKey)c.cancel=true;});assert.equal(g.resources.grantShield(),false);
});
test('Cairn source-resource preparation rejects malformed contracts and altered source inputs',()=>{
 assert.throws(()=>make({contract:{}}));
 for(const mutate of[d=>d.stats.atk++,d=>d.skill.bb.buff_duration=12,d=>d.rangeGrid.push([1,0]),d=>d.skill.spCost++,d=>d.talents=[]])
  assert.throws(()=>make({skill:2,mutate}));
});
test('Cairn failed or reentrant DOT attachment never leaves an unaccepted recipient effect',()=>{
 const f=make({skill:2}),t=enemy(f,{x:8});f.b.on('beforeBuff',c=>{if(c.buff.key===f.resources.dotKey)c.cancel=true;});
 assert.equal(f.resources.attachDot(t),null);advance(f.b,2);assert.equal(f.hits.length,0);
 const g=make({skill:2}),z=enemy(g,{x:8});g.b.on('beforeBuff',c=>{if(c.buff.key===g.resources.dotKey)g.b.retreat(g.u,{permanent:true});});
 assert.equal(g.resources.attachDot(z),null);assert.equal(z.findBuff(g.resources.dotKey),null);advance(g.b,2);assert.equal(g.hits.length,0);
});
test('Cairn blocked talent is not disabled by silence; control that releases a block clears its child',()=>{
 const f=make(),{b,u,resources:r}=f,t=enemy(f);until(f,()=>r.blocked.has(t),1);b.applyStatus(u,'silence',{duration:2});advance(b,1.1);assert.equal(f.hits.length,1);
 b.applyStatus(u,'stun',{duration:2});advance(b,.1);assert.equal(t.blockedBy,null);assert.equal(t.findBuff(r.talentKey),null);const count=f.hits.length;
 advance(b,1);assert.equal(f.hits.length,count);
});
test('Cairn resource methods reject the wrong skill and an absent source',()=>{
 const f=make();assert.equal(f.resources.grantShield(),false);assert.equal(f.resources.attachDot(enemy(f)),null);
 const g=make({skill:2});assert.equal(g.resources.beginHp(),false);g.b.retreat(g.u,{permanent:true});assert.equal(g.resources.grantShield(),false);assert.equal(g.resources.attachDot(enemy(g)),null);
});
