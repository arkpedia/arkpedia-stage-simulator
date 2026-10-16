// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make,enemy,near,advance} from './helpers/pedro-resource-fixture.js';
import {preparePedroResources,PEDRO_RESOURCE_CONTRACT} from '../server/sim/content/arkpedia-pedro-resources.js';
const S1='pedro:s1:trigger',S2='pedro:s2:protection',TAUNT='pedro:s2:taunt';
function ally(f,{x=6,y=5,kind='op',hp=10000}={}){
 const def=structuredClone(f.u.def);def.chessId=def.charId='fixture:ally';def.stats.maxHp=hp;def.stats.atk=0;
 const a=f.b._makeAlly(f.u.player,def,kind,y,x,{dir:'RIGHT'});f.b._setupUnit(a,{trait:{noAttack:true},talents:[],skill:{kind:'instant',trigger:{rule:'NEVER'}}});assert.ok(f.b._deploy(a,{initial:true,ignoreLimit:true,free:true}));return a;
}
function hit(f,t,{type='arts',amount=1,source=null,tags=[]}={}){return f.b.dealDamage(source,t,{amount,type,canDodge:false,tags});}
function mark(f,t){const ticket=f.resources.captureS1(t);assert.ok(ticket);assert.equal(f.resources.applyS1(ticket),true);return ticket;}
for(const mutation of[null,{...PEDRO_RESOURCE_CONTRACT},{}])test(`Pedro resource preparation rejects missing/copied contracts ${JSON.stringify(mutation)}`,()=>assert.throws(()=>make({contract:mutation})));
for(const mutate of[d=>d.stats.atk++,d=>d.skill.bb.atk_scale++,d=>d.skill.maxCharges++,d=>d.rangeGrid.pop(),d=>d.tags.push('foreign'),d=>d.talents[0].bb.atk++,d=>d.skill.spCost++])test('Pedro resource preparation rejects changed selected inputs',()=>assert.throws(()=>make({mutate})));
test('Pedro S1 consumes before one cached sourceless Arts response, without ordinary attack receipts',()=>{
 const f=make(),t=enemy(f),atk=f.u.s.atk;mark(f,t);const seen=[];f.b.on('damaged',c=>{if(c.dmg.tags.includes('pedro_s1_debuff_damage'))seen.push(c);});
 hit(f,t);near(t.s.maxHp-t.hp,1+atk*f.record.bb.debuff_atk_scale);assert.equal(t.findBuff(S1),null);assert.equal(seen.length,1);assert.equal(seen[0].source,null);assert.equal(seen[0].credit,f.u);assert.equal(seen[0].dmg.isAttack,false);assert.equal(f.attacks.length,0);
 hit(f,t);assert.equal(seen.length,1);
});
for(const type of['phys','true','elemental'])test(`Pedro ${type} does not consume the Arts trigger mark`,()=>{const f=make(),t=enemy(f);mark(f,t);hit(f,t,{type});assert.ok(t.findBuff(S1));});
test('Pedro S1 recursive modifier tags do not consume an existing mark',()=>{const f=make(),t=enemy(f);mark(f,t);hit(f,t,{tags:['pedro_s1_debuff_damage']});assert.ok(t.findBuff(S1));});
for(const mode of['shield','cancel','dodge','invincible'])test(`Pedro S1 accepted damage filtering respects ${mode}`,()=>{
 const f=make(),t=enemy(f);mark(f,t);
 if(mode==='shield')f.b.addBuff(t,{key:'fixture:shield',shield:1e9});
 if(mode==='cancel')f.b.on('hit',c=>{if(c.target===t)c.cancel=true;});
 if(mode==='dodge')f.b.addBuff(t,{key:'fixture:dodge',mods:{dodgeArts:1}});
 if(mode==='invincible')f.b.addBuff(t,{key:'fixture:invincible',flags:{invulnerable:true}});
 f.b.dealDamage(f.u,t,{amount:10,type:'arts',canDodge:mode==='dodge'});assert.equal(!!t.findBuff(S1),mode!=='shield');
});
test('Pedro S1 birth ticket captures ATK once and cannot be forged or replayed',()=>{
 const f=make(),t=enemy(f),atk=f.u.s.atk,ticket=f.resources.captureS1(t);f.b.addBuff(f.u,{key:'fixture:atk',mods:{atkPct:1}});
 assert.equal(f.resources.applyS1({...ticket}),false);assert.equal(f.resources.applyS1(ticket),true);assert.equal(f.resources.applyS1(ticket),false);hit(f,t);near(t.s.maxHp-t.hp,1+atk*f.record.bb.debuff_atk_scale);
});
test('Pedro S1 legally born tickets and marks survive source retreat with frozen damage',()=>{
 const f=make(),t=enemy(f),atk=f.u.s.atk,ticket=f.resources.captureS1(t);f.b.retreat(f.u,{permanent:true});assert.equal(f.resources.stopped,true);
 assert.equal(f.resources.applyS1(ticket),true);advance(f.b,1);hit(f,t);near(t.s.maxHp-t.hp,1+atk*f.record.bb.debuff_atk_scale);assert.equal(f.resources.field.marks.size,0);assert.equal(f.resources.field.handles.length,0);
});
for(const mode of['expiry','life','death','battleEnd'])test(`Pedro S1 pending ticket rejects ${mode} before mark admission`,()=>{
 const f=make(),t=enemy(f),ticket=f.resources.captureS1(t);
 if(mode==='expiry')advance(f.b,10.1);if(mode==='life')t.deploySeq++;if(mode==='death')f.b.kill(t,null);if(mode==='battleEnd')(f.b.finished=true,f.b.emit('battleEnd',{}));
 assert.equal(f.resources.applyS1(ticket),false);assert.equal(t.findBuff(S1),null);
});
test('Pedro S1 mark replacement and external removal retain no stale registry entry',()=>{const f=make(),t=enemy(f);mark(f,t);mark(f,t);assert.equal(f.resources.field.marks.size,1);f.b.removeBuff(t,S1);assert.equal(f.resources.field.marks.size,0);});
test('Pedro S1 rejected attachment never registers or reacts',()=>{const f=make(),t=enemy(f);f.b.on('beforeBuff',c=>{if(c.buff.key===S1)c.cancel=true;});assert.equal(f.resources.applyS1(f.resources.captureS1(t)),false);hit(f,t);near(t.s.maxHp-t.hp,1);assert.equal(f.resources.field.marks.size,0);});
test('Pedro S1 fatal incoming Arts damage cleans its mark without a second dead-target receipt',()=>{const f=make(),t=enemy(f,{hp:2});mark(f,t);let n=0;f.b.on('damaged',c=>{if(c.dmg.tags.includes('pedro_s1_debuff_damage'))n++;});hit(f,t,{amount:10});assert.equal(n,0);assert.equal(t.alive,false);assert.equal(t.findBuff(S1),null);assert.deepEqual(f.b.errors,[]);});
test('Pedro S2 stores its heal at attachment, waits for the inclusive threshold and applies eight-second taunt',()=>{
 const f=make({skill:2}),a=ally(f),amount=f.u.s.atk*f.record.bb.atk_scale;assert.equal(f.resources.protect(a),true);f.b.addBuff(f.u,{key:'fixture:atk',mods:{atkPct:1}});
 a.hp=a.s.maxHp*.5+1;advance(f.b,.3);assert.ok(a.findBuff(S2));a.hp=a.s.maxHp*.5;advance(f.b,.21);near(a.hp,a.s.maxHp*.5+amount);assert.equal(a.findBuff(S2),null);near(a.s.taunt,-1);assert.ok(a.findBuff(TAUNT));advance(f.b,8.1);near(a.s.taunt,0);
});
test('Pedro S2 protection lasts beyond eight seconds and survives source retreat/range exit',()=>{
 const f=make({skill:2}),a=ally(f),amount=f.u.s.atk*f.record.bb.atk_scale;f.resources.protect(a);f.b.retreat(f.u,{permanent:true});a.x=15;advance(f.b,30);assert.ok(a.findBuff(S2));a.hp=100;advance(f.b,.21);near(a.hp,100+amount);assert.ok(a.findBuff(TAUNT));assert.equal(f.resources.field.handles.length,0);
});
test('Pedro S2 heal is target-sourced and snapshots do not copy Pedro healing-dealt multipliers',()=>{
 const f=make({skill:2}),a=ally(f),amount=f.u.s.atk*f.record.bb.atk_scale;f.b.addBuff(f.u,{key:'fixture:provider',mods:{healingDealtMul:3}});f.resources.protect(a);f.b.addBuff(a,{key:'fixture:recipient',mods:{healingDealtMul:2,healingTakenMul:.5}});a.hp=100;const seen=[];f.b.on('heal',c=>seen.push(c));advance(f.b,.21);near(a.hp,100+amount);assert.equal(seen.length,1);assert.equal(seen[0].source,a);
});
for(const mode of['healFree'])test(`Pedro S2 consumes protection and applies taunt when ${mode} rejects healing`,()=>{
 const f=make({skill:2}),a=ally(f);f.resources.protect(a);f.b.addBuff(a,{key:'fixture:heal-free',flags:{[mode]:true}});a.hp=100;advance(f.b,.21);near(a.hp,100);assert.equal(a.findBuff(S2),null);assert.ok(a.findBuff(TAUNT));
});
test('Pedro S2 rejects weaker snapshots, replaces equal/stronger ones, and never stacks',()=>{
 const f=make({skill:2}),a=ally(f);f.resources.protect(a);const old=a.findBuff(S2);f.b.addBuff(f.u,{key:'fixture:atk',mods:{atkMul:.5}});assert.equal(f.resources.protect(a),false);assert.equal(a.findBuff(S2),old);f.b.removeBuff(f.u,'fixture:atk');assert.equal(f.resources.protect(a),true);assert.notEqual(a.findBuff(S2),old);assert.equal(f.resources.field.marks.size,1);
});
test('Pedro S2 rejected replacement preserves existing protection',()=>{const f=make({skill:2}),a=ally(f);f.resources.protect(a);const old=a.findBuff(S2);f.b.on('beforeBuff',c=>{if(c.buff.key===S2)c.cancel=true;});assert.equal(f.resources.protect(a),false);assert.equal(a.findBuff(S2),old);assert.equal(f.resources.field.marks.size,1);});
test('Pedro S2 consumed marker is gone before reentrant healing callbacks',()=>{
 const f=make({skill:2}),a=ally(f);f.resources.protect(a);a.hp=100;let n=0;f.b.on('heal',c=>{if(c.target===a){n++;assert.equal(a.findBuff(S2),null);advance(f.b,.3);}});advance(f.b,.21);assert.equal(n,1);
});
for(const mode of['remove','death','battleEnd'])test(`Pedro S2 cleans recipient protection on ${mode}`,()=>{
 const f=make({skill:2}),a=ally(f);f.resources.protect(a);if(mode==='remove')f.b.retreat(a,{permanent:true});if(mode==='death')f.b.kill(a,null);if(mode==='battleEnd')(f.b.finished=true,f.b.emit('battleEnd',{}));advance(f.b,.3);assert.equal(f.resources.field.marks.size,0);
});
test('Pedro S1 cannot create S2 protection and S2 cannot create S1 attack tickets',()=>{const a=make(),t=ally(a);assert.equal(a.resources.protect(t),false);const b=make({skill:2}),e=enemy(b);assert.equal(b.resources.captureS1(e),null);});
test('Pedro talent waits for two other accepted ordinary operators and removes only its own additive ATK',()=>{
 const f=make(),base=f.u.s.atk;const a=ally(f),z=ally(f,{x:7});advance(f.b,.21);near(f.u.s.atk,base*(1+f.record.talentBb[0].atk));assert.equal(f.resources.allyMarks.size,2);
 f.b.addBuff(f.u,{key:'fixture:external',mods:{atkPct:.2}});f.b.retreat(a,{permanent:true});advance(f.b,.21);near(f.u.s.atk,base*1.2);assert.equal(f.resources.allyMarks.size,1);assert.ok(z.findBuff(f.resources.allyKey));
});
for(const kind of['token','trap'])test(`Pedro talent excludes ${kind} entities`,()=>{const f=make(),base=f.u.s.atk;ally(f);ally(f,{x:7,kind});advance(f.b,.21);near(f.u.s.atk,base);assert.equal(f.resources.allyMarks.size,1);});
test('Pedro talent includes controlled, isolated, hidden and heal-free ordinary operators',()=>{
 const f=make(),base=f.u.s.atk,a=ally(f),z=ally(f,{x:7});f.b.addBuff(a,{key:'fixture:free',flags:{healFree:true,untargetable:true,isolated:true}});f.b.applyStatus(z,'stun',{duration:3});advance(f.b,.21);near(f.u.s.atk,base*1.1);assert.equal(f.resources.allyMarks.size,2);
});
test('Pedro talent follows current body range and does not count itself or distant allies',()=>{const f=make(),base=f.u.s.atk;ally(f);const z=ally(f,{x:15});advance(f.b,.21);near(f.u.s.atk,base);z.x=7;advance(f.b,.21);near(f.u.s.atk,base*1.1);z.x=15;advance(f.b,.21);near(f.u.s.atk,base);});
for(const rejected of['parent','ally','atk'])test(`Pedro talent ${rejected} rejection cannot fabricate a stat modifier`,()=>{
 const f=make({defer:true});f.b.on('beforeBuff',c=>{if(c.buff.key==={parent:f.resources.parentKey,ally:f.resources.allyKey,atk:f.resources.atkKey}[rejected])c.cancel=true;});f.deploy();const base=f.u.s.atk;ally(f);ally(f,{x:7});advance(f.b,.3);near(f.u.s.atk,base);
});
test('Pedro talent parent removal clears only owned ally/ATK state',()=>{const f=make();ally(f);const a=ally(f,{x:7});advance(f.b,.21);f.b.removeBuff(f.u,f.resources.parentKey);advance(f.b,.21);assert.equal(f.resources.allyMarks.size,0);assert.equal(f.u.findBuff(f.resources.atkKey),null);assert.equal(a.findBuff(f.resources.allyKey),null);});
for(const elite of[0,1,2])test(`Pedro E${elite} conditional talent preserves promotion-specific ownership`,()=>{const f=make({elite}),base=f.u.s.atk;ally(f);ally(f,{x:7});advance(f.b,.21);near(f.u.s.atk,base*(1+(f.record.talentBb[0]?.atk??0)));});
test('Pedro source removal during accepted talent ATK attachment leaves no orphan modifier',()=>{
 const f=make();ally(f);ally(f,{x:7});f.b.on('beforeBuff',c=>{if(c.buff.key===f.resources.atkKey)f.b.retreat(f.u,{permanent:true});});advance(f.b,.3);assert.equal(f.resources.stopped,true);assert.equal(f.u.findBuff(f.resources.atkKey),null);assert.equal(f.resources.allyMarks.size,0);assert.deepEqual(f.b.errors,[]);
});
test('Pedro reinstallation and preparation on deployed or already prepared owners are refused',()=>{const f=make();assert.throws(()=>f.resources.install());assert.throws(()=>preparePedroResources(f.b,f.u,{contract:PEDRO_RESOURCE_CONTRACT}));});

test('Pedro S2 normal healing is independent of the no-HP-recovery regeneration flag',()=>{const f=make({skill:2}),a=ally(f),amount=f.u.s.atk*f.record.bb.atk_scale;f.resources.protect(a);f.b.addBuff(a,{key:'fixture:no-regen',flags:{noHpRecovery:true}});a.hp=100;advance(f.b,.21);near(a.hp,100+amount);assert.ok(a.findBuff(TAUNT));});
for(let rank=1;rank<=10;rank++)for(const skill of[1,2])test(`Pedro S${skill} rank ${rank} uses its selected resource operands exactly once`,()=>{
 const f=make({skill,rank});if(skill===1){const t=enemy(f);mark(f,t);const hp=t.hp;hit(f,t);near(hp-t.hp,1+f.u.s.atk*f.record.bb.debuff_atk_scale);assert.equal(t.findBuff(S1),null);}
 else{const a=ally(f);assert.equal(f.resources.protect(a),true);a.hp=100;advance(f.b,.21);near(a.hp,100+f.u.s.atk*f.record.bb.atk_scale);assert.equal(a.findBuff(S2),null);}
 assert.equal(f.attacks.length,0);assert.deepEqual(f.b.errors,[]);
});
function provider(f){const def=structuredClone(f.u.def),u=f.b._makeAlly(f.u.player,def,'op',6,5,{dir:'RIGHT'});
 const r=preparePedroResources(f.b,u,{contract:PEDRO_RESOURCE_CONTRACT});f.b._setupUnit(u,{trait:{noAttack:true},talents:[],skill:{kind:'instant',trigger:{rule:'NEVER'}}});r.install();assert.ok(f.b._deploy(u,{initial:true,ignoreLimit:true,free:true}));return{u,r};}
test('Pedro independent source talents never remove each other’s marks or modifier',()=>{
 const f=make(),p=provider(f),a=ally(f);advance(f.b,.21);assert.equal(f.resources.allyMarks.size,2);assert.equal(p.r.allyMarks.size,2);assert.ok(f.u.findBuff(f.resources.atkKey));assert.ok(p.u.findBuff(p.r.atkKey));
 f.b.retreat(f.u,{permanent:true});advance(f.b,.21);assert.equal(p.r.allyMarks.size,1);assert.ok(a.findBuff(p.r.allyKey));assert.equal(a.findBuff(f.resources.allyKey),null);assert.deepEqual(f.b.errors,[]);
});
test('Pedro S1 replacement by another source retains one mark and credits its captured source',()=>{
 const f=make(),p=provider(f),t=enemy(f);f.b.addBuff(p.u,{key:'fixture:atk',mods:{atkPct:.5}});const ticket=p.r.captureS1(t);mark(f,t);assert.equal(p.r.applyS1(ticket),true);assert.equal(f.resources.field.marks.size,1);
 const seen=[];f.b.on('damaged',c=>{if(c.dmg.tags.includes('pedro_s1_debuff_damage'))seen.push(c);});hit(f,t);assert.equal(seen.length,1);assert.equal(seen[0].credit,p.u);near(seen[0].amount,ticket.cachedAtk*ticket.scale);
});
test('Pedro S2 multi-source comparison preserves stronger accepted snapshots after that source retreats',()=>{
 const f=make({skill:2}),p=provider(f),a=ally(f);f.b.addBuff(p.u,{key:'fixture:atk',mods:{atkPct:.5}});assert.equal(p.r.protect(a),true);const old=a.findBuff(S2),amount=old.data.pedro.amount;f.b.retreat(p.u,{permanent:true});assert.equal(f.resources.protect(a),false);assert.equal(a.findBuff(S2),old);a.hp=100;advance(f.b,.21);near(a.hp,100+amount);
});
for(const key of[S1,S2])test(`Pedro source removal during ${key} attachment keeps admitted recipient work alive`,()=>{
 const f=make({skill:key===S1?1:2}),t=key===S1?enemy(f):ally(f);f.b.on('beforeBuff',c=>{if(c.buff.key===key)f.b.retreat(f.u,{permanent:true});});
 if(key===S1){const ticket=f.resources.captureS1(t);assert.equal(f.resources.applyS1(ticket),true);hit(f,t);near(t.s.maxHp-t.hp,1+ticket.cachedAtk*ticket.scale);}
 else{const amount=f.u.s.atk*f.record.bb.atk_scale;assert.equal(f.resources.protect(t),true);t.hp=100;advance(f.b,.21);near(t.hp,100+amount);}
 assert.equal(f.resources.stopped,true);assert.equal(f.resources.field.marks.size,0);assert.equal(f.resources.field.handles.length,0);assert.deepEqual(f.b.errors,[]);
});
for(const key of[S1,S2])test(`Pedro recipient removal during ${key} admission cannot resurrect its resource`,()=>{
 const f=make({skill:key===S1?1:2}),t=key===S1?enemy(f):ally(f);f.b.on('beforeBuff',c=>{if(c.buff.key===key)f.b.kill(t,null);});
 assert.equal(key===S1?f.resources.applyS1(f.resources.captureS1(t)):f.resources.protect(t),false);assert.equal(t.findBuff(key),null);assert.equal(f.resources.field.marks.size,0);assert.deepEqual(f.b.errors,[]);
});
test('Pedro S2 recipient removed during healing callback does not receive an orphan taunt',()=>{
 const f=make({skill:2}),a=ally(f);f.resources.protect(a);a.hp=100;f.b.on('heal',c=>{if(c.target===a)f.b.retreat(a,{permanent:true});});advance(f.b,.21);assert.equal(a.findBuff(TAUNT),null);assert.equal(f.resources.field.marks.size,0);
});
test('Pedro consumed S1 mark leaves a newly attached reentrant mark intact',()=>{
 const f=make(),t=enemy(f);mark(f,t);let n=0;f.b.on('damaged',c=>{if(c.dmg.tags.includes('pedro_s1_debuff_damage')&&n++===0)mark(f,t);});hit(f,t);assert.ok(t.findBuff(S1));assert.equal(f.resources.field.marks.size,1);hit(f,t);assert.equal(n,2);assert.equal(t.findBuff(S1),null);
});
test('Pedro talent range changes are reflected after the source check interval',()=>{
 const f=make(),a=ally(f),z=ally(f,{x:7});advance(f.b,.21);assert.ok(f.u.findBuff(f.resources.atkKey));f.u.dir='LEFT';f.b._refreshRange(f.u);advance(f.b,.21);assert.equal(f.resources.allyMarks.size,0);assert.equal(f.u.findBuff(f.resources.atkKey),null);assert.equal(a.findBuff(f.resources.allyKey),null);assert.equal(z.findBuff(f.resources.allyKey),null);
});

test('Pedro S2 exact threshold and snapshot ordering do not round a slightly higher HP or weaker amount',()=>{
 const f=make({skill:2}),a=ally(f);f.resources.protect(a);const old=a.findBuff(S2);a.hp=a.s.maxHp*.5+1e-10;advance(f.b,.21);assert.equal(a.findBuff(S2),old);const atk=f.u.s.atk;f.u.base.atk-=1e-10;f.u.markDirty();assert.ok(f.u.s.atk<atk);assert.equal(f.resources.protect(a),false);assert.equal(a.findBuff(S2),old);
});
test('Pedro recipient life changes remove old-life marks instead of carrying them to a new deployment',()=>{
 for(const skill of[1,2]){const f=make({skill}),t=skill===1?enemy(f):ally(f);if(skill===1)mark(f,t);else f.resources.protect(t);t.deploySeq++;advance(f.b,.1);assert.equal(t.findBuff(skill===1?S1:S2),null);assert.equal(f.resources.field.marks.size,0);}
});

test('Pedro S2 source wait-first false triggers immediately when protection is attached at half HP',()=>{const f=make({skill:2}),a=ally(f),amount=f.u.s.atk*f.record.bb.atk_scale;a.hp=a.s.maxHp*.5;const time=f.b.time;assert.equal(f.resources.protect(a),true);near(a.hp,a.s.maxHp*.5+amount);near(f.b.time,time);assert.equal(a.findBuff(S2),null);assert.ok(a.findBuff(TAUNT));});
