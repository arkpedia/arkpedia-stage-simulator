// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make,enemy,advance,near,until} from './helpers/mcgraf-s3-lifecycle-fixture.js';
import {mcgrafChargeVariant,MCGRAF_S3_LIFECYCLE_CONTRACT as CONTRACT} from '../server/sim/content/arkpedia-mcgraf-s3-lifecycle.js';
const cast=f=>{f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.u.skill.activate('fixture'),true);};
const chargeHits=f=>f.hits.filter(h=>h.dmg.tags?.includes('mcgraf:s3-charge'));
const arrive=f=>until(f,()=>f.deck.arrivals===1,3);
for(let rank=1;rank<=10;rank++)test(`Selected S3 rank ${rank} charge removes the old McGraf and creates one fresh life with selected owner physical damage`,()=>{
 const f=make({rank}),t=f.deck.place(5,9),e=enemy(f,{x:12,y:5}),dp=f.u.player.dp;t.hp=123;t.buffs.find(b=>b.shield>0).shield=5;advance(f.b,2);cast(f);
 assert.equal(t.alive,false);assert.equal(t.hp,0);assert.equal(f.deck.point,null);assert.equal(f.deck.stock,0);assert.equal(f.b.unitAt(5,9),null);assert.equal(f.deck.state.hidden,true);assert.equal(f.deck.state.respawnStopped,true);assert.equal(t.mem.regularDeathVisual.hide,true);
 const flight=f.deck.flight;assert.equal(flight.alias,'projectile_chr_mcnist_s3_token_right');assert.equal(flight.projectile.startDelay,.25);assert.equal(flight.projectile.speed,20);assert.equal(flight.reason,'enemy');
 advance(f.b,.2);near(flight.projectile.x,9);assert.equal(chargeHits(f).length,0);arrive(f);const next=f.deck.point.unit;
 assert.notEqual(next,t);assert.notEqual(next.deploySeq,t.deploySeq);near(next.hp,3500);near(next.s.atk,600);near(next.buffs.find(b=>b.key.startsWith('mcnist:t2:')).shield,1050);near(f.deck.point.expiresAt-f.deck.point.bornAt,30);
 assert.equal(next.dir,'RIGHT');assert.equal(next.deploymentSlotCost,0);assert.equal(next.s.flags.healFree,true);assert.equal(next.mem.mcgrafS3Aura.active(),true);assert.equal(next.mem.regularFormVisual.clip,'Start');assert.equal(f.deck.transports.size,0);assert.equal(f.deck.transportHandles.length,0);
 near(f.u.player.dp,dp);assert.equal(chargeHits(f).length,1);near(chargeHits(f)[0].amount,f.u.s.atk*3);assert.equal(chargeHits(f)[0].dmg.applyWay,'none');assert.equal(e.hp<e.s.maxHp,true);assert.deepEqual(f.b.errors,[]);
});
test('An active S3 manual deployment charges once while its automatic replacement does not loop',()=>{
 const f=make();cast(f);assert.equal(f.deck.flight,null);const dp=f.u.player.dp,t=f.deck.place(5,9);assert.equal(t.alive,false);near(f.u.player.dp,dp-10);arrive(f);advance(f.b,1.1);assert.equal(f.deck.commandSeq,1);assert.equal(f.deck.arrivals,1);assert.equal(f.deck.own().length,1);assert.equal(f.deck.flight,null);
});
test('Inactive S3 McGraf uses the original ordinary one-target melee clock and source lifetime',()=>{
 const f=make(),t=f.deck.place(5,9),e=enemy(f,{x:9.2,y:5}),hits=[];f.b.on('damaged',c=>{if(c.source===t)hits.push(c);});until(f,()=>hits.length===1,3);
 assert.equal(hits[0].dmg.type,'phys');near(hits[0].amount,t.s.atk);assert.equal(t.mem.mcgrafAttacks.phase.releaseAge,.699999988079071);assert.equal(f.deck.flight,null);assert.equal(e.hp<e.s.maxHp,true);advance(f.b,30);assert.equal(t.alive,false);assert.equal(f.deck.stock,1);assert.equal(f.deck.flight,null);
});
for(const dir of['UP','DOWN','LEFT','RIGHT'])for(const faceLeft of[true,false])test(`Native ${dir} charge and ${faceLeft?'left':'right'} face select the original directional alias and retain deployment direction`,()=>{
 const f=make(),t=f.deck.place(5,9,dir);t.mem.regularVisualDirection=faceLeft?'LEFT':'RIGHT';cast(f);assert.equal(f.deck.flight.alias,mcgrafChargeVariant(dir,faceLeft));arrive(f);assert.equal(f.deck.point.unit.dir,dir);assert.equal(f.deck.commandSeq,1);
});
test('A ground enemy stops the native tile ray while a flying enemy only participates in the arrival area',()=>{
 const f=make();f.deck.place(5,9);const fly=enemy(f,{x:11,y:5,fly:true}),ground=enemy(f,{x:12,y:5}),past=enemy(f,{x:14,y:5});cast(f);assert.deepEqual(f.deck.flight.to,{x:12,y:5});arrive(f);
 assert.ok(chargeHits(f).some(h=>h.target===fly));assert.ok(chargeHits(f).some(h=>h.target===ground));assert.equal(chargeHits(f).some(h=>h.target===past),false);
});
test('A high tile stops charge on the preceding low tile and can be closer than a ground enemy',()=>{
 const f=make();f.deck.place(5,9);f.b.grid.tile(5,12).height='HIGH';enemy(f,{x:14,y:5});cast(f);assert.deepEqual(f.deck.flight.to,{x:11,y:5});assert.equal(f.deck.flight.reason,'terrain');arrive(f);assert.equal(f.deck.point.unit.tileC,11);
});
for(const terrain of['hole','obstacle'])test(`Native charge local ${terrain} boundary cannot place a replacement in impassable terrain`,()=>{
 const f=make();f.deck.place(5,9);if(terrain==='hole'){f.b.grid.tile(5,12).pass='NONE';f.b.grid.tile(5,12).build='NONE';}else f.b.grid.setObstacle(5,12,true,'block');cast(f);assert.deepEqual(f.deck.flight.to,{x:11,y:5});arrive(f);assert.equal(f.deck.point.unit.tileC,11);
});
test('A source token already blocking a nearby enemy can charge to its current tile after the original start delay',()=>{
 const f=make();const t=f.deck.place(5,9);enemy(f,{x:9.2,y:5});advance(f.b,.1);assert.equal(t.blocking.length,1);cast(f);assert.deepEqual(f.deck.flight.to,{x:9,y:5});advance(f.b,.2);assert.equal(f.deck.arrivals,0);arrive(f);assert.equal(f.deck.point.unit.tileC,9);
});
test('Arrival rechecks occupied tiles and chooses a preceding available tile without moving the other ally',()=>{
 const f=make();f.deck.place(5,9);enemy(f,{x:12,y:5});cast(f);const blocker=f.b.spawnDevice('fixture',5,12,{hp:10000});arrive(f);assert.equal(f.b.unitAt(5,12),blocker);assert.equal(f.deck.point.unit.tileC,11);
});
test('Current reservations and terrain changes are checked at arrival and cannot be overwritten',()=>{
 const f=make();f.deck.place(5,9);enemy(f,{x:12,y:5});cast(f);assert.equal(f.b.reserveTile(f.u,5,12,'fixture'),true);f.b.grid.tile(5,11).build='NONE';arrive(f);assert.equal(f.deck.point.unit.tileC,10);assert.equal(f.b.tileReservation(5,12).owner,f.u);
});
test('Failed landing returns one independently cooling card and never creates a partial extra token',()=>{
 const f=make();f.deck.place(5,9);enemy(f,{x:12,y:5});cast(f);const flight=f.deck.flight;for(const at of flight.path)f.b.grid.tile(at.row,at.col).build='NONE';advance(f.b,1);
 assert.equal(f.deck.point,null);assert.equal(f.deck.stock,1);assert.equal(f.deck.transports.size,0);assert.equal(f.deck.transportHandles.length,0);near(f.deck.readyAt,flight.commandEndedAt+40);assert.match(flight.failure,/available/);assert.deepEqual(f.b.errors,[]);
});
test('Ending the owner mode during flight does not cancel the born charge or grant an inactive aura',()=>{
 const f=make();f.deck.place(5,9);enemy(f,{x:12,y:5});cast(f);f.u.skill.end('fixture');arrive(f);assert.equal(chargeHits(f).length,1);assert.equal(f.deck.point.unit.mem.mcgrafS3Aura,undefined);assert.equal(f.deck.point.unit.alive,true);
});
for(const mode of['retreat','death','life'])test(`Owner ${mode} during a legally born charge leaves only finite transport and cannot respawn an orphan`,()=>{
 const f=make();f.deck.place(5,9);enemy(f,{x:12,y:5});cast(f);const atk=f.u.s.atk;if(mode==='retreat')f.b.retreat(f.u,{permanent:true});if(mode==='death')f.b.kill(f.u,null);if(mode==='life')f.u.deploySeq++;
 advance(f.b,1);assert.equal(chargeHits(f).length,1);near(chargeHits(f)[0].amount,atk*3);assert.equal(f.deck.stopped,true);assert.equal(f.deck.point,null);assert.equal(f.deck.stock,0);assert.equal(f.deck.transports.size,0);assert.equal(f.deck.transportHandles.length,0);assert.equal(f.resources.tokens.size,0);
});
test('Battle end removes pending charge transport and every independent flight watcher immediately',()=>{
 const f=make();f.deck.place(5,9);cast(f);f.b.finished=true;f.b.emit('battleEnd',{});assert.equal(f.deck.stopped,true);assert.equal(f.deck.transports.size,0);assert.equal(f.deck.transportHandles.length,0);assert.equal(f.deck.flight,null);assert.equal(f.b.projectiles.list.length,0);assert.equal(f.b.regularSummons.size,0);
});
test('A missing projectile cannot strand a hidden card or leak independent watchers',()=>{
 const f=make();f.deck.place(5,9);cast(f);const flight=f.deck.flight;f.b.projectiles.remove(p=>p===flight.projectile);advance(f.b,.1);assert.equal(f.deck.flight,null);assert.equal(f.deck.stock,1);assert.equal(f.deck.state.hidden,false);assert.equal(f.deck.transportHandles.length,0);assert.equal(chargeHits(f).length,0);
});
test('The original two-second command expires independently of a slowed born projectile',()=>{
 const f=make();f.deck.place(5,9);f.b.projectiles.registerSpeedAura({owner:f.u,contains:p=>p.data?.mcgrafCharge===true,scale:.05});cast(f);advance(f.b,2.1);assert.ok(f.deck.flight);assert.equal(f.deck.state.hidden,false);assert.equal(f.deck.state.respawnStopped,false);assert.match(f.deck.placementError(5,9),/charging/);until(f,()=>f.deck.arrivals===1,11);assert.equal(f.deck.transports.size,0);
});
for(const mode of['reject-token','owner-stop','throw'])test(`Replacement ${mode} admission cleans partial token state and retains the correct card`,()=>{
 const f=make();const old=f.deck.place(5,9);enemy(f,{x:12,y:5});cast(f);
 if(mode==='reject-token')f.b.on('deploy',({unit})=>{if(unit.ownerUnit===f.u&&unit!==old)f.b.retreat(unit,{permanent:true});});
 if(mode==='owner-stop')f.b.on('beforeBuff',c=>{if(c.unit.ownerUnit===f.u&&c.unit!==old&&c.buff.key==='mcgraf:heal-free')f.deck.stop();});
 if(mode==='throw')f.b.spawnToken=()=>{throw Error('Fixture rejected replacement');};
 advance(f.b,1);assert.equal(f.deck.point,null);assert.equal(f.resources.tokens.size,0);assert.equal(f.deck.transports.size,0);assert.equal(f.deck.transportHandles.length,0);assert.equal(f.b.allyUnits.filter(t=>t.ownerUnit===f.u&&t.alive&&t.deployed).length,0);assert.deepEqual(f.b.errors,[]);assert.equal(f.deck.stock,mode==='owner-stop'?0:1);
});
test('An expired replacement starts its own thirty-second lifetime and a single forty-second redeploy timer',()=>{
 const f=make();f.deck.place(5,9);advance(f.b,20);cast(f);arrive(f);const next=f.deck.point.unit,born=f.deck.point.bornAt;advance(f.b,29);assert.equal(next.alive,true);advance(f.b,1.1);assert.equal(next.alive,false);assert.equal(f.deck.stock,1);near(f.deck.readyAt,born+70,.1);assert.equal(f.deck.commandSeq,1);
});
test('A source charge cannot be duplicated by external calls while the current original token is absent',()=>{
 const f=make(),t=f.deck.place(5,9);cast(f);assert.equal(f.deck.charge(t),false);assert.equal(f.deck.charge(),false);assert.throws(()=>f.deck.place(5,10));assert.equal(f.deck.commandSeq,1);arrive(f);assert.equal(f.deck.arrivals,1);
});
test('S3 lifecycle refuses cloned contracts, other owner skills, old existing bindings and invalid directions',()=>{
 assert.throws(()=>make({contract:{...CONTRACT}}));assert.throws(()=>make({skill:2}));const f=make();assert.throws(()=>f.deck.place(5,9,'NORTH'));for(const dir of['bad',null])assert.throws(()=>mcgrafChargeVariant(dir,false));assert.throws(()=>mcgrafChargeVariant('UP',1));assert.equal(f.deck.stock,1);
});
test('Replacement respects selected P5 barrier ratio while token stats stay independent of owner trust and potential',()=>{
 const f=make({potential:6,trust:200}),t=f.deck.place(5,9);cast(f);arrive(f);const next=f.deck.point.unit;assert.notEqual(next,t);near(next.s.atk,600);near(next.s.def,550);near(next.buffs.find(b=>b.key.startsWith('mcnist:t2:')).shield,1400);near(next.s.maxHp,3500);
});
for(const flag of['camou','stealth','untargetable','sleep'])test(`Charge ${flag} ground stop/impact selection does not silently use the ordinary ranged selector`,()=>{
 const f=make();f.deck.place(5,9);const nearEnemy=enemy(f,{x:11,y:5}),far=enemy(f,{x:13,y:5});f.b.addBuff(nearEnemy,{key:'fixture:flags',flags:{[flag]:true}});cast(f);
 assert.deepEqual(f.deck.flight.to,{x:flag==='camou'?11:13,y:5});arrive(f);assert.equal(chargeHits(f).some(h=>h.target===nearEnemy),flag==='camou');if(flag!=='camou')assert.ok(chargeHits(f).some(h=>h.target===far));
});
test('Charge damage is selected at arrival, so an old stopping enemy can leave while a different nearby enemy enters',()=>{
 const f=make();f.deck.place(5,9);const old=enemy(f,{x:12,y:5});cast(f);old.x=16;const next=enemy(f,{x:12.5,y:5});arrive(f);assert.equal(chargeHits(f).some(h=>h.target===old),false);assert.ok(chargeHits(f).some(h=>h.target===next));assert.equal(f.deck.point.unit.tileC,12);
});
test('Charge uses live same-life host ATK on impact and a single shared damage identity without an ordinary attack event',()=>{
 const f=make();f.deck.place(5,9);enemy(f,{x:12,y:5});enemy(f,{x:12.5,y:5});cast(f);const atk=f.u.s.atk;f.b.addBuff(f.u,{key:'fixture:atk',mods:{atkMul:2}});arrive(f);
 assert.equal(chargeHits(f).length,2);for(const h of chargeHits(f))near(h.amount,atk*2*3);assert.equal(new Set(chargeHits(f).map(h=>h.dmg.attackId)).size,1);assert.equal(f.attacks.length,0);
});
test('A dodged physical charge still lands a fresh McGraf and its independent non-damage aura',()=>{
 const f=make();f.deck.place(5,9);const e=enemy(f,{x:12,y:5});f.b.addBuff(e,{key:'fixture:dodge',mods:{dodgePhys:1}});cast(f);arrive(f);near(e.hp,e.s.maxHp);assert.equal(f.deck.point.unit.alive,true);assert.equal(f.deck.point.unit.mem.mcgrafS3Aura.active(),true);
});
test('Charge burst rechecks each captured victim life after earlier damage callbacks',()=>{
 const f=make();f.deck.place(5,9);const a=enemy(f,{x:12,y:5}),z=enemy(f,{x:12.5,y:5});cast(f);f.b.on('damaged',c=>{if(c.target===a&&c.dmg.tags?.includes('mcgraf:s3-charge'))z.deploySeq++;});arrive(f);assert.equal(chargeHits(f).length,1);near(z.hp,z.s.maxHp);
});
test('Killing the owner during arrival damage prevents the replacement and preserves finite already accepted area damage',()=>{
 const f=make();f.deck.place(5,9);const a=enemy(f,{x:12,y:5});enemy(f,{x:12.5,y:5});cast(f);const atk=f.u.s.atk;
 f.b.on('damaged',c=>{if(c.target===a&&c.dmg.tags?.includes('mcgraf:s3-charge'))f.b.kill(f.u,null);});advance(f.b,1);assert.equal(chargeHits(f).length,2);for(const h of chargeHits(f))near(h.amount,atk*3);assert.equal(f.deck.arrivals,0);assert.equal(f.deck.point,null);assert.equal(f.deck.stock,0);assert.equal(f.deck.transportHandles.length,0);
});
test('A new activation during replacement aura admission can start another charge without old cleanup deleting its new flight',()=>{
 const f=make();const old=f.deck.place(5,9);enemy(f,{x:12,y:5});cast(f);const first=f.deck.flight;let once=false;
 f.b.on('beforeBuff',c=>{if(once||c.unit.ownerUnit!==f.u||c.unit===old||!c.buff.key.startsWith('mcgraf:s3:'))return;once=true;f.u.skill.end('fixture');cast(f);});
 until(f,()=>f.deck.commandSeq===2,3);assert.equal(once,true);assert.equal(first.finished,true);assert.equal(f.deck.transports.size,1);until(f,()=>f.deck.arrivals===2,3);const current=f.deck.point.unit;
 assert.equal(current.alive,true);assert.equal(f.deck.transports.size,0);assert.equal(f.deck.transportHandles.length,0);f.deck.arrive(first);assert.equal(f.deck.point.unit,current);assert.equal(f.deck.stock,0);assert.deepEqual(f.b.errors,[]);
});
test('A rejected manual placement retains its card/DP and never starts an unowned charge',()=>{
 const f=make();cast(f);const dp=f.u.player.dp;f.b.on('deploy',({unit})=>{if(unit.ownerUnit===f.u)f.b.retreat(unit,{permanent:true});});assert.throws(()=>f.deck.place(5,9));near(f.u.player.dp,dp);assert.equal(f.deck.commandSeq,0);assert.equal(f.deck.transports.size,0);assert.equal(f.resources.tokens.size,0);assert.equal(f.deck.stock,1);
});
