// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make as barrierFixture,advance,near} from './helpers/mcnist-barrier-fixture.js';
import {prepareMcGrafLifecycle,MCGRAF_LIFECYCLE_CONTRACT as CONTRACT} from '../server/sim/content/arkpedia-mcgraf-lifecycle.js';
function make({defer=false,contract=CONTRACT,...opts}={}){const f=barrierFixture({...opts,defer:true});f.deck=prepareMcGrafLifecycle(f.b,f.u,{contract,barriers:f.resources});f.deck.install();if(!defer)f.deploy();return f;}
const place=f=>{f.u.player.dp=99;return f.deck.place(5,7);};
for(const elite of[1,2])for(const skill of[1,2])test(`McGraf E${elite} S${skill} lifecycle supplies one independently owned zero-slot summon`,()=>{
 const f=make({elite,skill}),dp=f.u.player.dp,t=f.deck.place(5,7,'LEFT');near(f.u.player.dp,dp-10);assert.equal(f.deck.stock,0);assert.equal(t.deploymentSlotCost,0);assert.equal(t.ownerUnit,f.u);assert.equal(t.dir,'LEFT');assert.equal(t.mem.regularModelFacing,'front');assert.equal(t.mem.regularFormVisual.clip,'Start');assert.equal(t.s.blockCnt,3);
 near(t.s.maxHp,elite===1?2660:3500);if(elite===2)near(t.buffs.find(b=>b.key.startsWith('mcnist:t2:')).shield,1050);else assert.equal(t.buffs.some(b=>b.key.startsWith('mcnist:t2:')),false);
 assert.equal(f.deck.state.config.noAttack,true);assert.equal(f.deck.own()[0],t);assert.equal(f.deck.placementError(5,8),'McGraf is already deployed.');assert.deepEqual(f.b.errors,[]);
});
for(const elite of[1,2])test(`McGraf E${elite} timeout uses its ${elite===1?20:30}-second source talent while Start only gates pose`,()=>{
 const f=make({elite}),t=place(f),duration=elite===1?20:30;advance(f.b,.9);assert.equal(t.mem.regularFormVisual.clip,'Start');advance(f.b,.2);assert.equal(t.mem.regularFormVisual.clip,'Idle');advance(f.b,duration-1.2);assert.equal(t.alive,true);advance(f.b,.2);assert.equal(t.deployed,false);assert.equal(f.deck.point,null);assert.equal(f.deck.stock,1);near(f.deck.readyAt,f.b.time+40-.1,.11);
});
test('McGraf independent redeployment starts on withdrawal, returns no DP, and permits a fresh source life after forty seconds',()=>{
 const f=make(),t=place(f),dp=f.u.player.dp;advance(f.b,2);f.deck.retreat(t);near(f.u.player.dp,dp);assert.equal(f.deck.stock,1);near(f.deck.readyAt,42);assert.match(f.deck.placementError(5,7),/redeploying/);advance(f.b,39.9);assert.match(f.deck.placementError(5,7),/redeploying/);advance(f.b,.1);const next=f.deck.place(5,7,'DOWN');assert.notEqual(t,next);assert.equal(next.mem.regularModelFacing,'front');near(next.buffs.find(b=>b.key.startsWith('mcnist:t2:')).shield,1050);
});
test('McGraf death restores one card once and stale removal cannot reset its new cooldown',()=>{
 const f=make(),t=place(f);f.b.kill(t,null);const ready=f.deck.readyAt;advance(f.b,1);f.b.emit('removed',{unit:t});near(f.deck.readyAt,ready);assert.equal(f.deck.stock,1);assert.equal(f.resources.tokens.size,0);
});
for(const mode of['retreat','death','life'])test(`Mechanist owner ${mode} kills only its linked McGraf and removes its deck`,()=>{
 const f=make(),t=place(f);if(mode==='retreat')f.b.retreat(f.u,{permanent:true});if(mode==='death')f.b.kill(f.u,null);if(mode==='life'){f.u.deploySeq++;advance(f.b,.1);}assert.equal(t.deployed,false);assert.equal(f.deck.stock,0);assert.equal(f.deck.stopped,true);assert.equal(f.deck.handles.length,0);assert.equal(f.b.regularSummons.has(f.deck.state.key),false);assert.equal(f.resources.tokens.size,0);
});
test('McGraf lifetime runs through silence/stun and owner hiding without cancelling the source card',()=>{
 const f=make(),t=place(f);f.u.hidden=true;f.b.applyStatus(f.u,'stun',{duration:40});f.b.applyStatus(t,'silence',{duration:40});advance(f.b,30.1);assert.equal(t.deployed,false);assert.equal(f.deck.stopped,false);assert.equal(f.deck.stock,1);
});
test('McGraf lifecycle may wait for the first owner deployment without disposing its fresh deck',()=>{
 const f=make({defer:true});advance(f.b,2);assert.equal(f.deck.stopped,false);assert.equal(f.deck.stock,0);f.deploy();assert.equal(f.deck.stock,1);assert.equal(f.deck.placementError(5,7),null);
});
for(const mode of['viewport','finished','dp','height','build','occupied','reservation','bounds'])test(`McGraf ${mode} placement rejection preserves card and DP`,()=>{
 const f=make();let row=5,col=7;if(mode==='viewport')f.b.setViewport('inline');if(mode==='finished')f.b.finished=true;if(mode==='dp')f.u.player.dp=9;
 if(mode==='height')f.b.grid.tile(row,col).height='HIGH';if(mode==='build')f.b.grid.tile(row,col).build='NONE';if(mode==='occupied'){row=f.u.tileR;col=f.u.tileC;}if(mode==='reservation')assert.ok(f.b.reserveTile(f.u,row,col,'qa:reserved'));if(mode==='bounds')row=-1;
 const dp=f.u.player.dp;assert.throws(()=>f.deck.place(row,col));near(f.u.player.dp,dp);assert.equal(f.deck.stock,1);assert.equal(f.deck.point,null);
});
test('McGraf allows low ground outside the host range and a full operator deployment limit',()=>{const f=make();f.b.unitLimit=1;assert.equal(f.deck.placementError(15,15),null);const t=f.deck.place(15,15);assert.ok(t);assert.equal(f.b.deployedSlots(),1);});
for(const mode of['owner-stop','owner-retreat','token-retreat','throw'])test(`McGraf failed ${mode} admission rolls back DP/card and all partial token resources`,()=>{
 const f=make(),dp=f.u.player.dp;f.b.on('beforeBuff',c=>{if(c.buff.key!=='mcgraf:heal-free')return;if(mode==='owner-stop')f.resources.stop();if(mode==='owner-retreat')f.b.retreat(f.u,{permanent:true});if(mode==='throw')throw Error('Diagnostic rejected setup');});
 if(mode==='token-retreat')f.b.on('deploy',({unit})=>{if(unit.ownerUnit===f.u)f.b.retreat(unit,{permanent:true});});
 if(mode==='throw'){
  // The shared hook dispatcher records callback errors and continues. An
  // explicit setup rejection is injected at the native spawn boundary instead.
  f.b.spawnToken=()=>{throw Error('Diagnostic rejected setup');};
 }
 assert.throws(()=>f.deck.place(5,7));near(f.u.player.dp,dp);assert.equal(f.deck.point,null);assert.equal(f.resources.tokens.size,0);assert.equal(f.b.allyUnits.some(t=>t.ownerUnit===f.u&&t.alive&&t.deployed),false);
 if(mode==='token-retreat'||mode==='throw')assert.equal(f.deck.stock,1);
});
test('McGraf rejects invalid direction before spending a card or DP',()=>{const f=make(),dp=f.u.player.dp;assert.throws(()=>f.deck.place(5,7,'NORTH'));near(f.u.player.dp,dp);assert.equal(f.deck.stock,1);});
test('McGraf ordinary healing respects its original HealFree while explicit bypass can restore HP',()=>{
 const f=make(),t=place(f);f.b.loseHp(t,100);const hp=t.hp;f.b.heal(f.u,t,100);near(t.hp,hp);f.b.heal(f.u,t,100,{ignoreHealFree:true});near(t.hp,hp+100);
});
test('McGraf battle end removes linked token, card and lifecycle hooks',()=>{const f=make(),t=place(f);f.b.finished=true;f.b.emit('battleEnd',{});assert.equal(t.deployed,false);assert.equal(f.deck.handles.length,0);assert.equal(f.resources.tokenHandles.length,0);assert.equal(f.b.regularSummons.size,0);});
test('McGraf refuses E0, S3 charge lifecycle and unreviewed contracts without admitting a public fallback',()=>{assert.throws(()=>make({elite:0}));assert.throws(()=>make({skill:3}));assert.throws(()=>make({contract:{}}));});

test('McGraf up-facing uses the original Back pose and explicitly hides its missing Back death clip',()=>{const f=make(),t=f.deck.place(5,7,'UP');assert.equal(t.mem.regularModelFacing,'back');assert.equal(t.mem.regularDeathVisual.hide,true);assert.equal(t.mem.regularDeathVisual.die,undefined);});
test('McGraf deck cleanup cannot remove another current deck by a reused public key',()=>{const f=make(),replacement={owner:{id:'replacement'}};f.b.regularSummons.set(f.deck.state.key,replacement);f.deck.stop();assert.equal(f.b.regularSummons.get(f.deck.state.key),replacement);});
