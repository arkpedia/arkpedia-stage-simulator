// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make,enemy,advance,near} from './helpers/mcgraf-s3-aura-fixture.js';
import {prepareMcGrafS3Aura,MCGRAF_S3_AURA_CONTRACT as CONTRACT} from '../server/sim/content/arkpedia-mcgraf-s3-aura.js';
const amount=f=>f.e.s.atk/1000;
const own=(f,e=f.e)=>e.buffs.filter(b=>b.source===f.t&&b.key.startsWith(f.aura.key));
function attach(f){const a=prepareMcGrafS3Aura(f.b,f.t,{contract:CONTRACT,barriers:f.resources});assert.equal(a.install(),true);return a;}
for(let rank=1;rank<=10;rank++)test(`McGraf S3 rank ${rank} hidden aura keeps its independent initial final ATK multiplier`,()=>{
 const f=make({rank});near(amount(f),.5);assert.equal(f.aura.value,-.5);assert.equal(f.aura.steps,0);assert.equal(own(f).length,2);
 f.b.addBuff(f.e,{key:'fixture:atk',mods:{atkPct:1,atkFlat:100}});near(f.e.s.atk,1100);assert.deepEqual(f.b.errors,[]);
});
test('McGraf aura waits the first source interval, decays by .025 and clamps at zero without becoming an ATK buff',()=>{
 const f=make();advance(f.b,.9);near(amount(f),.5);advance(f.b,.15);near(amount(f),.525);assert.equal(f.aura.steps,1);
 advance(f.b,18);near(amount(f),.975);advance(f.b,1);near(amount(f),1);assert.equal(f.aura.value,0);assert.equal(own(f).length,1);
 advance(f.b,5);near(amount(f),1);assert.equal(f.aura.value,0);assert.equal(f.aura.entries.size,1);
});
test('Aura age belongs to the token: a late entrant and a re-entry receive the already decayed value',()=>{
 const f=make();f.e.x=f.t.x+4;f.b._buildEnemyIndex();advance(f.b,5);near(amount(f),1);assert.equal(own(f).length,0);
 f.e.x=f.t.x+1;f.b._buildEnemyIndex();advance(f.b,.05);near(amount(f),.625);
 f.e.x=f.t.x+4;f.b._buildEnemyIndex();advance(f.b,3);near(amount(f),1);
 f.e.x=f.t.x+1;f.b._buildEnemyIndex();advance(f.b,.05);near(amount(f),.7);assert.equal(f.aura.steps,8);
});
test('Aura can begin with an empty range and newly spawned enemies read its current source value',()=>{
 const f=make({withEnemy:false});advance(f.b,4);const e=enemy(f,{x:f.t.x+1,y:f.t.y});e.base.atk=1000;e.markDirty();advance(f.b,.05);near(e.s.atk,600);assert.equal(f.aura.entries.size,1);
});
test('Exact world-time boundaries wait the first period and account for every elapsed decay step once',()=>{
 const f=make();f.b.time=.999999;f.aura.tick();near(amount(f),.5);f.b.time=1;f.aura.tick();near(amount(f),.525);
 f.aura.tick();near(amount(f),.525);f.b.time=17;f.aura.tick();near(amount(f),.925);assert.equal(f.aura.steps,17);
});
test('Preparing an aura early does not age it before the native affecting marker is accepted',()=>{
 const f=make({install:false});f.aura=prepareMcGrafS3Aura(f.b,f.t,{contract:CONTRACT,barriers:f.resources});advance(f.b,4);
 assert.equal(f.aura.install(),true);near(amount(f),.5);assert.equal(f.aura.steps,0);near(f.aura.bornAt,4);advance(f.b,1.05);near(amount(f),.525);
});
test('A rejected derived application retries on the next source interval, not every rendering tick',()=>{
 const f=make({install:false});let attempts=0;const hook=f.b.on('beforeBuff',c=>{if(c.buff.status==='weaken'){attempts++;c.cancel=true;}});f.aura=attach(f);
 advance(f.b,.9);assert.equal(attempts,1);near(amount(f),1);f.b.off(hook);advance(f.b,.15);near(amount(f),.525);
});
test('A dispelled derived child waits for the next interval while its independent parent mark remains',()=>{
 const f=make(),entry=f.aura.entries.get(f.e);f.b.removeBuff(f.e,entry.weak);advance(f.b,.9);near(amount(f),1);assert.equal(f.aura.entries.get(f.e),entry);
 advance(f.b,.15);near(amount(f),.525);assert.equal(own(f).length,2);
});
for(const mode of['ground','air','camou','stealth','revealed','target-free','sleep','hidden','invulnerable'])test(`McGraf S3 aura ${mode} recipient legality and missable derived ATK reduction`,()=>{
 const f=make({install:false});if(mode==='air')f.e.motion='FLY';
 if(mode==='hidden')f.e.hidden=true;
 const flags={camou:{camou:true},stealth:{stealth:true},revealed:{stealth:true,reveal:true},'target-free':{untargetable:true},sleep:{sleep:true},invulnerable:{invulnerable:true}}[mode];
 if(flags)f.b.addBuff(f.e,{key:'fixture:legality',flags});f.aura=attach(f);
 near(amount(f),['stealth','target-free','sleep','hidden','invulnerable'].includes(mode)?1:.5);assert.deepEqual(f.b.errors,[]);
});
test('Removing temporary invulnerability admits only the current decayed reduction',()=>{
 const f=make();f.b.addBuff(f.e,{key:'fixture:invuln',flags:{invulnerable:true}});advance(f.b,3);near(amount(f),1);assert.equal(own(f).length,1);
 f.b.removeBuff(f.e,'fixture:invuln');advance(f.b,.05);near(amount(f),.575);
});
test('Aura radius includes ground/air body edges, excludes outside bodies, and follows current token position',()=>{
 const f=make();f.e.x=f.t.x+1.5;f.b._buildEnemyIndex();advance(f.b,.05);near(amount(f),.5);
 f.e.x=f.t.x+1.51;f.b._buildEnemyIndex();advance(f.b,.05);near(amount(f),1);
 f.e.hitArea={w:2,h:1,dx:0,dy:0};advance(f.b,.05);near(amount(f),.5);
 f.t.x-=3;advance(f.b,.05);near(amount(f),1);
});
test('Native passive aura decay and membership continue through source stun, freeze, silence and disarm',()=>{
 const f=make();for(const status of['stun','freeze','silence','disarm'])f.b.applyStatus(f.t,status,{duration:10});
 f.b.applyStatus(f.u,'stun',{duration:10});advance(f.b,4.05);near(amount(f),.6);assert.equal(f.aura.steps,4);assert.deepEqual(f.b.errors,[]);
});
test('The source-owned reduction composes as named Weaken, keeps stronger/longer foreign effects, and never multiplies them',()=>{
 const f=make();f.b.applyStatus(f.e,'weaken',{source:f.u,value:.2,duration:30});near(amount(f),.5);
 advance(f.b,15);near(amount(f),.8);f.aura.stop();near(amount(f),.8);assert.ok(f.e.findBuff('weaken'));
});
test('A stronger foreign Weaken remains independently owned after the aura leaves',()=>{
 const f=make();f.b.applyStatus(f.e,'weaken',{source:f.u,value:.7,duration:10});near(amount(f),.3);f.aura.stop();near(amount(f),.3);assert.equal(own(f).length,0);
});
test('An expiring stronger foreign Weaken falls back to the current decayed source value',()=>{
 const f=make();f.b.applyStatus(f.e,'weaken',{source:f.u,value:.7,duration:2});advance(f.b,2.05);near(amount(f),.55);assert.equal(own(f).length,2);
});
for(const mode of['host-end','host-retreat','host-death','host-life','token-retreat','token-death','token-life','marker','battle-end','resource-stop'])test(`McGraf S3 ${mode} cleans its mark, derived reductions and hooks`,()=>{
 const f=make();if(mode==='host-end')f.u.skill.end('manual');if(mode==='host-retreat')f.b.retreat(f.u,{permanent:true});if(mode==='host-death')f.b.kill(f.u,null);
 if(mode==='host-life')f.u.deploySeq++;if(mode==='token-retreat')f.b.retreat(f.t,{permanent:true});if(mode==='token-death')f.b.kill(f.t,null);if(mode==='token-life')f.t.deploySeq++;
 if(mode==='marker')f.b.removeBuff(f.t,f.aura.marker);if(mode==='battle-end'){f.b.finished=true;f.b.emit('battleEnd',{});}if(mode==='resource-stop')f.resources.stop();
 if(!f.b.finished)advance(f.b,.05);near(amount(f),1);assert.equal(own(f).length,0);assert.equal(f.aura.stopped,true);assert.equal(f.aura.entries.size,0);assert.equal(f.aura.handles.length,0);assert.deepEqual(f.b.errors,[]);
});
test('The source skill duration ends the aura automatically',()=>{const f=make();advance(f.b,40.1);assert.equal(f.aura.stopped,true);assert.equal(own(f).length,0);near(amount(f),1);});
test('Target death cleans its exact life and a fresh enemy receives the current source strength',()=>{
 const f=make();advance(f.b,2);f.b.kill(f.e,null);assert.equal(f.aura.entries.size,0);const next=enemy(f,{x:f.t.x+1,y:f.t.y});next.base.atk=1000;next.markDirty();advance(f.b,.05);near(next.s.atk,550);assert.notEqual(next,f.e);
});
test('Removing one enemy mark removes its derived child; re-entry attaches one current mark without stacking',()=>{
 const f=make(),entry=f.aura.entries.get(f.e);f.b.removeBuff(f.e,entry.mark);near(amount(f),1);assert.equal(f.aura.entries.size,0);
 advance(f.b,1.05);near(amount(f),.525);assert.equal(own(f).length,2);assert.equal(f.aura.entries.size,1);
});
for(const phase of['marker','mark','derived'])for(const action of['cancel','stop','retire','life'])test(`Aura ${phase} admission ${action} cannot leave stale children`,()=>{
 const f=make({install:false});let fired=false;
 f.b.on('beforeBuff',c=>{const selected=phase==='marker'?c.unit===f.t:phase==='mark'?c.unit===f.e&&!c.buff.status:c.unit===f.e&&c.buff.status==='weaken';
  if(fired||!selected||!c.buff.key.startsWith('mcgraf:s3:'))return;fired=true;
  if(action==='cancel')c.cancel=true;if(action==='stop')f.t.mem.mcgrafS3Aura.stop();if(action==='retire')f.b.retreat(f.t,{permanent:true});if(action==='life')f.t.deploySeq++;
 });
 f.aura=prepareMcGrafS3Aura(f.b,f.t,{contract:CONTRACT,barriers:f.resources});f.aura.install();assert.equal(fired,true);near(amount(f),1);
 if(action!=='cancel'||phase==='marker'){assert.equal(f.aura.stopped,true);assert.equal(own(f).length,0);}else assert.ok(own(f).length<=1);
 assert.deepEqual(f.b.errors,[]);
});
test('Recursive ticks during a derived admission cannot duplicate marks or reduce decay twice',()=>{
 const f=make({install:false});let calls=0;f.b.on('beforeBuff',c=>{if(c.buff.status==='weaken'){calls++;f.t.mem.mcgrafS3Aura.tick();}});f.aura=attach(f);
 assert.equal(calls,1);near(amount(f),.5);assert.equal(own(f).length,2);assert.deepEqual(f.b.errors,[]);
});
for(const phase of['marker','mark','derived'])test(`Stopping and replacing an aura from a stale ${phase} callback cannot overwrite the newer controller`,()=>{
 const f=make({install:false});let once=false,next;
 f.b.on('beforeBuff',c=>{const selected=phase==='marker'?c.unit===f.t:phase==='mark'?c.unit===f.e&&!c.buff.status:c.unit===f.e&&c.buff.status==='weaken';if(once||!selected||!c.buff.key.startsWith('mcgraf:s3:'))return;once=true;f.t.mem.mcgrafS3Aura.stop();next=attach(f);});
 f.aura=prepareMcGrafS3Aura(f.b,f.t,{contract:CONTRACT,barriers:f.resources});f.aura.install();assert.equal(f.aura.stopped,true);assert.equal(next.active(),true);near(amount(f),.5);assert.equal(next.entries.size,1);assert.equal(f.e.buffs.filter(b=>b.status==='weaken').length,1);assert.deepEqual(f.b.errors,[]);
});
test('Aura refuses inactive host, foreign or unregistered token, unreviewed contract and duplicate installation',()=>{
 assert.throws(()=>make({active:false}));assert.throws(()=>make({contract:{}}));const f=make();assert.throws(()=>f.aura.install());assert.throws(()=>attach(f));
 f.aura.stop();const ownerId=f.t.ownerId;f.t.ownerId='foreign';assert.throws(()=>attach(f));f.t.ownerId=ownerId;f.resources.removeToken(f.t);assert.throws(()=>attach(f));assert.equal(f.b.regularSummons?.size??0,0);
});
