// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {installChapter17MutwinCore as install} from '../server/sim/content/chapter17-mutwin-core.js';
import {installChapter17MutwinLifecycle,currentChapter17MutwinRoomFinishReceipt} from '../server/sim/content/chapter17-mutwin-lifecycle.js';
import {currentFatalDamageReceipt} from '../server/sim/damage.js';
import {mutwinLifecycleContract} from '../tools/arkpedia/mutwin-lifecycle-contract.mjs';
import {chapter17Environment,chapter17FirewallSnapshot as snapshot,clickChapter17Firewall as click} from '../server/sim/content/chapter17.js';
import {executeEnemyInstantKill,currentEnemyInstantKillReceipt} from '../server/sim/enemy-instant-kill.js';
import saga from '../data/arkpedia-saga-prefabs.json' with {type:'json'};
const bytes=p=>readFileSync(new URL('../'+p,import.meta.url)),read=p=>JSON.parse(bytes(p));
const contract=read('data/candidates/arkpedia-ch17-mutwin-lifecycle-contract.json'),keys=Object.keys(contract.enemies),records=read('data/candidates/arkpedia-enemy-records.canonical.json').enemies;
function fixture({pair=true,receiver}={}){
 const h=makeBattle({content:'none',autoFinish:false,timeLimit:1e6,defs:{enemies:Object.fromEntries(keys.map(k=>[k,records[k].levels[0]])),chess:{tw_op:chessRec({id:'tw_op',stats:{maxHp:50000,blockCnt:0,def:0}})}},units:[{chessId:'tw_op',row:10,col:2}]});
 h.b.start();for(const t of h.allies())t.profile.noAttack=true;const rooms=[],cores=[],twins=[];
 for(let i=0;i<(pair?2:1);i++){const e=h.spawn(keys[i],{pos:[10,6+i*2],route:{motion:'WALK',start:[10,6+i*2],end:[9,2],checkpoints:[{type:'MOVE',pos:[9,6+i*2]}]}});twins.push(e);cores.push(install(h.b,e,{finishRoom:r=>{rooms.push(r);receiver?.(r);}}));}
 return{h,b:h.b,e:twins[0],other:twins[1],core:cores[0],otherCore:cores[1],twins,cores,t:h.allies()[0],rooms};
}
function down(f,e=f.e){const before=e.hp;assert.equal(f.b.loseHp(e,1e6,{source:f.t}),before);assert.equal(e.alive,true);assert.equal(e.hp,1);return e.mem.ch17MutwinLifecycle;}
function fake(f,e=f.e){down(f,e);assert.equal(f.h.runUntil(()=>e.mem.ch17MutwinLifecycle?.phase==='fake',1),true);return e.mem.ch17MutwinLifecycle;}
const noErrors=f=>assert.deepEqual(f.b.errors,[]);

test('twin lifecycle source receipt reproduces mode hierarchy, retention list and literal partner/finish actions',async()=>{
 assert.deepEqual(await mutwinLifecycleContract(),contract);for(const s of Object.values(contract.sources))assert.equal(createHash('sha256').update(bytes(s.path)).digest('hex'),s.sha256);
 assert.equal(contract.enemies[keys[0]].camera.buffKey,'enemy_mutwin_move_camera');assert.equal(contract.enemies[keys[1]].camera,null);
 for(const key of keys)assert.equal(read('data/candidates/arkpedia-ch16-enemy-support.json').enemies[key].policy,null);
});
for(const index of [0,1])test(keys[index]+' enters its protected short rebirth and recovers from fake death while its counterpart stays active',()=>{
 const f=fixture(),e=f.twins[index],core=f.cores[index],state=down(f,e);assert.equal(state.phase,'reborn');assert.equal(f.b.killed,0);assert.ok(e.s.flags.invulnerable);assert.ok(e.s.flags.unblockable);
 f.h.step(2);assert.equal(state.phase,'reborn');f.h.runUntil(()=>state.phase==='fake',1);assert.equal(e.hp,1000);assert.ok(e.findBuff('ally_alive'));assert.ok(e.findBuff('enemy_mutiwin_t[heal]'));
 f.h.run(1.1);assert.equal(e.hp,3000);f.h.runUntil(()=>state.phase==='active',26);assert.equal(e.hp,50000);assert.equal(core.actions.combat.actionBusy,null);assert.equal(core.actions.blink.enabled,true);
 assert.ok(!e.findBuff('enemy_mutiwin_t[heal]'));assert.ok(!e.s.flags.invulnerable);assert.ok(e.s.flags.noMove);assert.equal(f.b.killed,0);assert.equal(f.rooms.length,0);noErrors(f);
});
test('a downed twin preserves native ATK layers and firewall parents but clears transient buffs and teleport immunity',()=>{
 const f=fixture();f.t.x=5;const c=f.core.actions.combat;c.begin();f.h.run(1);assert.equal(c.count,1);assert.equal(f.e.s.atk,700);
 f.b.addBuff(f.e,{key:'fixture-infinite-transient',persist:true,mods:{defFlat:500}});f.b.applyStatus(f.e,'silence',{duration:10});fake(f);
 assert.equal(f.e.s.atk,700);assert.equal(c.count,1);assert.ok(f.e.findBuff('enemy_muama_t'));assert.ok(f.e.findBuff('enemy_mutwin_t[damage_resistance]'));assert.ok(f.e.findBuff('enemy_mutwin_passiveBuff'));
 assert.ok(!f.e.findBuff('fixture-infinite-transient'));assert.ok(!f.e.s.flags.silence);assert.ok(!f.e.findBuff('immune_shu_blink'));assert.ok(!f.e.findBuff('immune_yu_blink'));assert.ok(c.wall.current());assert.ok(f.e.findBuff('enemy_mutwin_move_camera'));noErrors(f);
});
test('explicit native-durable buffs survive without treating every infinite simulator parent as durable',()=>{
 const f=fixture();f.b.addBuff(f.e,{key:'fixture-native-durable',persist:true,data:{nativeDurable:true},mods:{atkFlat:80}});fake(f);assert.ok(f.e.findBuff('fixture-native-durable'));assert.equal(f.e.s.atk,680);noErrors(f);
});
test('rebirth cancels unborn line/ordinary actions, resets skills and pauses only the mode-bound Blink cooldown',()=>{
 const f=fixture(),a=f.core.actions;f.t.x=3;a.line.cooldowns.HorizontalLineAttack=0;assert.equal(a.line.cast('HorizontalLineAttack'),true);down(f);
 assert.equal(a.line.pending,null);assert.equal(a.blink.pending,null);assert.equal(a.combat.pending,null);f.h.runUntil(()=>f.core.lifecycle.phase==='fake',1);
 assert.ok(a.line.cooldowns.HorizontalLineAttack>=39.96&&a.line.cooldowns.HorizontalLineAttack<=40);assert.ok(a.line.cooldowns.VerticalLine>=19.96&&a.line.cooldowns.VerticalLine<=20);assert.equal(a.blink.cooldown,20);assert.equal(a.blink.enabled,false);f.h.run(5);
 assert.ok(a.line.cooldowns.VerticalLine<15.1&&a.line.cooldowns.VerticalLine>14.8);assert.equal(a.blink.cooldown,20);assert.equal(a.combat.begin(),false);assert.equal(a.line.output.beams.size,0);noErrors(f);
});
test('real fatal physical damage accounts the full old HP before post-loss repair',()=>{
 const f=fixture();const dealt=f.b.dealDamage(f.t,f.e,{amount:1e7,type:'phys',canDodge:false});assert.equal(dealt,50000);assert.equal(f.e.hp,1);assert.equal(f.t.stats.dmg,50000);assert.equal(f.core.lifecycle.phase,'reborn');assert.equal(f.t.stats.kills,0);noErrors(f);
});
test('undeadable or prevented damage does not consume a fake-death transition',()=>{
 const f=fixture();f.b.addBuff(f.e,{key:'fixture-floor',persist:true,flags:{undeadable:true}});f.b.loseHp(f.e,1e6,{source:f.t});assert.equal(f.e.hp,1);assert.equal(f.core.lifecycle.phase,'active');assert.equal(f.core.lifecycle.rebirths,0);noErrors(f);
});
test('fabricated and replayed fatal events do not enter rebirth',()=>{
 const f=fixture();let captured,receipt;f.b.on('fatal',ctx=>{captured=ctx;receipt=currentFatalDamageReceipt(ctx,f.b);});
 f.b.emit('fatal',{unit:f.e,prevented:false,amount:1e9,before:f.e.hp});assert.equal(f.core.lifecycle.phase,'active');down(f);assert.ok(receipt);assert.equal(currentFatalDamageReceipt(captured,f.b),null);
 const count=f.core.lifecycle.rebirths;f.b.emit('fatal',captured);assert.equal(f.core.lifecycle.rebirths,count);noErrors(f);
});
test('a second twin entering rebirth immediately removes the first fake twin partner marker and forces its final death',()=>{
 const f=fixture();fake(f);const q=f.core.lifecycle.partner;assert.equal(q.owner,f.otherCore.lifecycle);assert.ok(f.other.buffs.includes(q.mark));down(f,f.other);
 assert.equal(f.e.alive,false);assert.equal(f.core.active,false);assert.equal(f.b.killed,1);assert.equal(f.rooms.length,1);assert.equal(f.otherCore.lifecycle.phase,'reborn');assert.ok(!f.other.findBuff('enemy_mutin_mark_alive'));
 f.h.run(1.3);assert.equal(f.other.alive,false);assert.equal(f.b.killed,2);assert.equal(f.rooms.length,1);assert.equal(f.t.stats.kills,0);noErrors(f);
});
test('a partner killed or removed while a twin is recovering forces that twin out without another rebirth',()=>{
 for(const reason of ['killed','expired']){
  const f=fixture();fake(f);if(reason==='killed')f.b.kill(f.other,f.t);else f.b._remove(f.other,reason);
  assert.equal(f.e.alive,false);assert.equal(f.rooms.length,1);assert.equal(f.core.lifecycle.rebirths,1);assert.equal(f.b.killed,reason==='killed'?2:1);noErrors(f);
 }
});
test('starting fake death without a qualifying partner follows the first delayed heal-parent failure',()=>{
 const f=fixture({pair:false}),state=fake(f);assert.equal(state.partner,null);f.h.step(20);assert.ok(f.e.alive);f.h.run(.5);assert.equal(f.e.alive,false);assert.equal(f.rooms.length,1);noErrors(f);
});
test('same-frame knockdowns do not let either recovering twin count the other as active',()=>{
 const f=fixture();down(f);down(f,f.other);f.h.run(1.3);assert.ok(f.twins.every(e=>!e.alive));assert.equal(f.b.killed,2);assert.equal(f.rooms.length,1);noErrors(f);
});
test('the real recovery heal honors output/input modifiers and heal-free without losing its world cadence',()=>{
 const f=fixture(),state=fake(f);f.b.addBuff(f.e,{key:'fixture-heal-mods',mods:{healingDealtMul:.5,healingTakenMul:.5,slowDownMul:.5}});f.h.run(1.1);assert.equal(f.e.hp,1500);
 f.b.addBuff(f.e,{key:'fixture-heal-free',flags:{healFree:true}});f.h.run(2);assert.equal(f.e.hp,1500);f.b.removeBuff(f.e,'fixture-heal-free');f.h.run(1);assert.equal(f.e.hp,2000);assert.equal(state.phase,'fake');noErrors(f);
});
test('losing only the derived ally_alive buff is handled by the heal parent rather than creating an immediate marker finish',()=>{
 const f=fixture();fake(f);const q=f.core.lifecycle.partner;f.b.removeBuff(f.e,q.child);assert.ok(f.e.alive);f.h.run(1.1);assert.equal(f.e.alive,false);assert.equal(f.rooms.length,1);noErrors(f);
});
test('the other twin Blink protection does not masquerade as fake death or detach an established partner marker',()=>{
 const f=fixture();fake(f);const other=f.otherCore.actions.blink;other.cooldown=0;f.otherCore.actions.combat.cooldown=0;assert.equal(other.cast(),true);f.h.run(3.6);
 assert.ok(f.e.alive);assert.ok(f.core.lifecycle.partner);assert.equal(f.core.lifecycle.phase,'fake');noErrors(f);
});
test('only the first twin sends one immutable native camera/branch receipt on actual retirement',()=>{
 const f=fixture();f.b.kill(f.other,f.t);assert.equal(f.rooms.length,0);f.b.kill(f.e,f.t);assert.equal(f.rooms.length,1);const r=f.rooms[0];
 assert.equal(r.source,f.e);assert.equal(r.sourceLife,f.e.deploySeq);assert.equal(r.room,'(0,6,0)');assert.equal(r.actions[0]._delay,2.5);assert.equal(r.actions[1]._branchId,'boss');assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.actions)&&Object.isFrozen(r.actions[0]._offset));
 f.b.emit('death',{unit:f.e});assert.equal(f.rooms.length,1);noErrors(f);
});
test('removing the actual native room parent runs its source finish once, while controller cleanup stays silent',()=>{
 const f=fixture();f.b.removeBuff(f.e,'enemy_mutwin_move_camera');assert.equal(f.rooms.length,1);f.b.kill(f.e,f.t);assert.equal(f.rooms.length,1);noErrors(f);
 const g=fixture();g.core.stop();assert.equal(g.rooms.length,0);assert.ok(g.e.alive);assert.equal(g.e.mem.ch17MutwinCore,undefined);noErrors(g);
});

for(const mode of ['death','parent'])test('room receipt authenticates only the live '+mode+' continuation and expires after return',()=>{
 let f,captured,verified;
 f=fixture({receiver:intent=>{
  captured=intent;verified=currentChapter17MutwinRoomFinishReceipt(intent,f.b);
  assert.equal(verified.source,f.e);assert.equal(verified.sourceLife,f.e.deploySeq);
  assert.equal(verified.battle,f.b);assert.equal(verified.room,'(0,6,0)');
  assert.equal(verified.actions,intent.actions);assert.ok(Object.isFrozen(verified));
  assert.equal(currentChapter17MutwinRoomFinishReceipt({...intent},f.b),null);
  assert.equal(currentChapter17MutwinRoomFinishReceipt(intent,{}),null);
 }});
 if(mode==='death')f.b.kill(f.e,f.t);else f.b.removeBuff(f.e,'enemy_mutwin_move_camera');
 assert.ok(verified);assert.equal(currentChapter17MutwinRoomFinishReceipt(captured,f.b),null);
 assert.equal(f.core.lifecycle.roomCommitted,true);
 assert.throws(()=>{f.core.lifecycle.roomCommitted=false;},TypeError);
 f.b.kill(f.e,f.t);assert.equal(f.rooms.length,1);noErrors(f);
});

test('forged death and copied room intents cannot authorize a room transition from a live twin',()=>{
 const f=fixture();assert.equal(f.core.lifecycle.room,undefined);
 const forged={source:f.e,sourceLife:f.e.deploySeq,room:'(0,6,0)',actions:contract.roomFinish};
 assert.equal(currentChapter17MutwinRoomFinishReceipt(forged,f.b),null);
 f.b.emit('death',{unit:f.e,reason:'killed'});
 assert.equal(f.rooms.length,0);assert.equal(f.e.alive,true);noErrors(f);
});

test('a throwing room receiver cannot leave an authenticated receipt or repeat a committed handoff',()=>{
 let captured,f;f=fixture({receiver:r=>{captured=r;assert.ok(currentChapter17MutwinRoomFinishReceipt(r,f.b));throw Error('room receiver failed');}});
 f.b.kill(f.e,f.t);assert.ok(captured);
 assert.equal(currentChapter17MutwinRoomFinishReceipt(captured,f.b),null);
 assert.equal(f.rooms.length,1);assert.equal(f.core.lifecycle.active,false);
 f.b.emit('death',{unit:f.e});assert.equal(f.rooms.length,1);
 assert.ok(f.b.errors.some(e=>JSON.stringify(e).includes('room receiver failed')));
});

test('a room receipt stops authenticating immediately when its source life changes inside the receiver',()=>{
 let captured,f;f=fixture({receiver:r=>{captured=r;assert.ok(currentChapter17MutwinRoomFinishReceipt(r,f.b));f.e.deploySeq++;assert.equal(currentChapter17MutwinRoomFinishReceipt(r,f.b),null);}});
 f.b.removeBuff(f.e,'enemy_mutwin_move_camera');
 assert.equal(f.rooms.length,1);assert.equal(currentChapter17MutwinRoomFinishReceipt(captured,f.b),null);noErrors(f);
});
test('HP loss during fake death can trigger another infinite rebirth without clearing the retained ATK record',()=>{
 const f=fixture(),state=fake(f);down(f);assert.equal(state.phase,'reborn');assert.equal(state.rebirths,2);f.h.runUntil(()=>state.phase==='fake',1);assert.equal(f.e.hp,1000);assert.ok(state.partner);noErrors(f);
});
test('battle end and source reuse clean exact partner children without firing an old room handoff',()=>{
 for(const mode of ['battleEnd','reuse']){
  const f=fixture();fake(f);const q=f.core.lifecycle.partner;if(mode==='battleEnd')f.b._finish('defeat');else{f.e.deploySeq++;f.h.run(.1);}
  assert.equal(f.core.active,false);assert.ok(!f.other.buffs.includes(q.mark));assert.ok(!f.e.buffs.includes(q.child));assert.ok(!f.e.findBuff('enemy_mutiwin_t[heal]'));assert.equal(f.rooms.length,0);noErrors(f);
 }
});
test('a second controller for one live prefab is refused without taking over an existing pair',()=>{
 const f=fixture(),e=f.h.spawn(keys[0],{pos:[9,8]});assert.throws(()=>install(f.b,e,{finishRoom:()=>{}}),/Multiple copies/);assert.ok(f.core.lifecycle.active);assert.ok(f.otherCore.lifecycle.active);assert.ok(!e.findBuff('enemy_mutwin_t[damage_resistance]'));noErrors(f);
});
test('missing room receiver or changed staged twin room data cannot grant lifecycle support',()=>{
 const f=fixture();assert.throws(()=>installChapter17MutwinLifecycle(f.b,f.e,{actions:f.core.actions}),/room\/branch/);assert.throws(()=>install(f.b,f.e),/only one/);
 const g=fixture({pair:false});g.core.stop();g.e.def={...g.e.def,raw:{...g.e.def.raw,talents:{...g.e.def.raw.talents,bbStr:{'DamageResistance.boss_room':'(0,10,0)'}}}};assert.throws(()=>install(g.b,g.e,{finishRoom:()=>{}}),/Unreviewed/);noErrors(g);
});
test('rebirth interrupts an unborn Blink and clears its temporary immunity without moving the source later',()=>{
 const f=fixture(),blink=f.core.actions.blink;blink.cooldown=0;assert.equal(blink.cast(),true);down(f);assert.equal(blink.pending,null);f.h.run(2.2);
 assert.equal(f.e.x,6);assert.equal(f.e.y,10);assert.equal(f.e.route.legIdx,0);assert.equal(f.core.lifecycle.phase,'fake');assert.equal(blink.enabled,false);assert.ok(!f.e.findBuff('enemy_mutwin_blink'));assert.ok(!f.e.s.flags.noDisplace);noErrors(f);
});
test('a born line continues across rebirth and samples current same-life ATK after transient buffs clear',()=>{
 const f=fixture();f.b.addBuff(f.e,{key:'fixture-temporary-atk',mods:{atkFlat:300}});const line=f.core.actions.line;line.cooldowns.HorizontalLineAttack=0;assert.equal(line.cast('HorizontalLineAttack'),true);
 f.h.run(3.15);assert.equal(line.output.beams.size,3);down(f);f.h.run(.4);assert.equal(f.t.hp,49400);assert.ok(f.t.findBuff('enemy_mutwin_line_buff'));f.h.run(1.1);assert.equal(f.t.hp,49200);noErrors(f);
});
test('rebirth preserves a broken firewall and never uses revival itself as a refresh event',()=>{
 const f=fixture();chapter17Environment(f.b).expose({x:10,y:10});const receipt=snapshot(f.b).find(r=>r.ownerId===f.e.id);for(let i=0;i<3;i++)assert.equal(click(f.b,receipt),true);
 const wall=f.core.actions.combat.wall,broken=wall.sides.map(s=>s.broken);assert.ok(broken.some(Boolean));fake(f);assert.deepEqual(wall.sides.map(s=>s.broken),broken);f.h.runUntil(()=>f.core.lifecycle.phase==='active',26);
 assert.deepEqual(wall.sides.map(s=>s.broken),broken);assert.equal(f.rooms.length,0);noErrors(f);
});
test('the recovery ratio follows current maximum HP and ordinary heal callbacks can keep the twin down',()=>{
 const f=fixture();fake(f);f.b.addBuff(f.e,{key:'fixture-hp',mods:{hpMul:2}});assert.equal(f.e.s.maxHp,100000);assert.equal(f.e.hp,2000);f.h.run(1.1);assert.equal(f.e.hp,6000);
 f.b.on('heal',c=>{if(c.target===f.e)c.amount=0;});f.h.run(2);assert.equal(f.e.hp,6000);assert.equal(f.core.lifecycle.phase,'fake');noErrors(f);
});
test('a late qualifying partner can establish the native marker before its first heal check',()=>{
 const f=fixture({pair:false});fake(f);f.h.run(.3);const other=f.h.spawn(keys[1],{pos:[10,8]});const core=install(f.b,other);
 assert.equal(f.core.lifecycle.partner.owner,core.lifecycle);f.h.run(.8);assert.equal(f.e.hp,3000);assert.ok(f.e.alive);noErrors(f);
});
test('rejected rebirth or fake-death state cannot leave a live unsupported recovery lease',()=>{
 for(const key of ['ch17:mutwin-reborn','enemy_mutiwin_t[heal]']){
  const f=fixture();f.b.on('beforeBuff',c=>{if(c.unit===f.e&&c.buff.key===key)c.cancel=true;});f.b.loseHp(f.e,1e6,{source:f.t});f.h.run(.3);
  assert.equal(f.e.alive,false);assert.equal(f.core.active,false);assert.equal(f.core.actions.combat.actionBusy,null);assert.equal(f.rooms.length,1);assert.ok(!f.other.findBuff('enemy_mutin_mark_alive'));noErrors(f);
 }
});
test('source removal during a real recovery heal cannot repair or mutate a replacement deployment',()=>{
 const f=fixture();fake(f);f.b.on('heal',c=>{if(c.target===f.e){f.e.deploySeq++;f.e.hp=40000;}});f.h.run(1.1);
 assert.equal(f.core.active,false);assert.equal(f.e.hp,40000);assert.ok(!f.e.findBuff('enemy_mutiwin_t[heal]'));assert.ok(!f.other.findBuff('enemy_mutin_mark_alive'));assert.equal(f.rooms.length,0);noErrors(f);
});
test('fatal receipt ownership cannot move a newly reused body into old-life rebirth',()=>{
 const f=fixture();let receipt;f.b.on('fatal',ctx=>{if(ctx.unit!==f.e)return;receipt=currentFatalDamageReceipt(ctx,f.b);f.e.deploySeq++;f.e.hp=40000;},{priority:200});
 assert.equal(f.b.loseHp(f.e,1e6,{source:f.t}),0);assert.ok(receipt);assert.equal(f.e.hp,40000);f.h.run(.1);assert.equal(f.core.active,false);assert.equal(f.rooms.length,0);noErrors(f);
});
test('multiple recovery cycles keep one fresh partner parent and reset each new rebirth cooldown',()=>{
 const f=fixture();for(let cycle=1;cycle<=3;cycle++){
  const state=fake(f);assert.equal(state.rebirths,cycle);assert.equal(f.other.buffs.filter(b=>b.key==='enemy_mutin_mark_alive').length,1);
  f.h.runUntil(()=>state.phase==='active',26);assert.ok(!f.other.findBuff('enemy_mutin_mark_alive'));assert.ok(!f.e.findBuff('ally_alive'));assert.equal(f.rooms.length,0);
 }noErrors(f);
});
test('replacing a retired partner controller cannot transfer an established marker to a new deployment',()=>{
 const f=fixture();fake(f);const old=f.core.lifecycle.partner;f.other.deploySeq++;f.other.deployedAt=f.b.time;const core=install(f.b,f.other);
 assert.equal(f.e.alive,false);assert.equal(f.rooms.length,1);assert.equal(old.active,false);assert.ok(core.lifecycle.active);assert.ok(!f.other.buffs.includes(old.mark));noErrors(f);
});
test('changed retention, partner validator, heal actions and canonical rebirth parameters fail verification',async()=>{
 for(const mode of ['retained','partner','heal','record'])await assert.rejects(mutwinLifecycleContract({read:async url=>{
  const raw=readFileSync(url),path=String(url);
  if(path.endsWith('arkpedia-ch17-firewall-boss-source.json')&&mode!=='record'){
   const g=JSON.parse(raw);if(mode==='heal')g.templates['enemy_mutiwin_t[heal]'].originalJson=g.templates['enemy_mutiwin_t[heal]'].originalJson.replace('HealViaMaxHpRatio','FixedValueDamage');else{
    const rows=g.prefabs['dyn/battle/prefabs/enemies/'+keys[0]+'.prefab'],row=rows.find(r=>mode==='retained'?'_buffsRetainedWhenReborn'in JSON.parse(r.originalJson):JSON.parse(r.originalJson)._targetId===keys[1]),c=JSON.parse(row.originalJson);
    if(mode==='retained')c._buffsRetainedWhenReborn.push('immune_shu_blink');else c._targetId=keys[0];row.originalJson=JSON.stringify(c);row.sha256=createHash('sha256').update(row.originalJson).digest('hex');
   }return Buffer.from(JSON.stringify(g));
  }
  if(mode==='record'&&path.endsWith('arkpedia-enemy-records.canonical.json')){const c=JSON.parse(raw);c.enemies[keys[0]].levels[0].talents.bb['Reborn.hp_ratio']=.5;return Buffer.from(JSON.stringify(c));}return raw;
 }}));
});
test('the native heal condition honors its literal source-agnostic ally_alive key while cleanup owns only its own child',()=>{
 const f=fixture();fake(f);const q=f.core.lifecycle.partner,foreign=f.b.addBuff(f.e,{key:'ally_alive',source:f.t,persist:true});assert.notEqual(foreign,q.child);
 f.h.run(1.1);assert.equal(f.e.hp,3000);assert.ok(f.e.alive);f.core.lifecycle.stop();assert.ok(f.e.buffs.includes(foreign));assert.ok(!f.other.buffs.includes(q.mark));noErrors(f);
});
test('a nested replay during the real fatal dispatch admits only one authenticated transition',()=>{
 const f=fixture();let nested=false;f.b.on('fatal',ctx=>{if(ctx.unit===f.e&&!nested){nested=true;f.b.emit('fatal',ctx);}},{priority:200});
 down(f);assert.equal(f.core.lifecycle.rebirths,1);assert.equal(f.core.lifecycle.phase,'reborn');noErrors(f);
});
test('rebirth protection is present before transient buff-removal callbacks can deal another hit',()=>{
 const f=fixture();let removed=false;f.b.addBuff(f.e,{key:'fixture-removal-hit',persist:true,onRemove(){removed=true;f.b.dealDamage(f.t,f.e,{amount:1e6,type:'true',canDodge:false});}});
 down(f);assert.equal(removed,true);assert.equal(f.core.lifecycle.phase,'reborn');assert.equal(f.e.hp,1);assert.equal(f.rooms.length,0);f.h.runUntil(()=>f.core.lifecycle.phase==='fake',1);assert.equal(f.e.hp,1000);noErrors(f);
});
test('a real nested knockdown during fake-mode admission cannot be mistaken for a failed new state',()=>{
 const f=fixture();let once=false;f.b.on('beforeBuff',c=>{if(c.unit===f.e&&c.buff.key==='enemy_mutiwin_t[heal]'&&!once){once=true;f.b.loseHp(f.e,1e6,{source:f.t});}});
 down(f);f.h.runUntil(()=>f.core.lifecycle.rebirths===2,1);assert.ok(f.e.alive);assert.equal(f.core.lifecycle.phase,'reborn');assert.equal(f.rooms.length,0);
 f.h.runUntil(()=>f.core.lifecycle.phase==='fake',1);assert.equal(f.e.hp,1000);assert.ok(f.e.findBuff('enemy_mutiwin_t[heal]'));noErrors(f);
});
test('whole-core replacement preserves the true profile baseline across source-life changes',()=>{
 for(const replaceProfile of [false,true]){
  const f=fixture(),e=f.other;e.deploySeq++;e.deployedAt=f.b.time;if(replaceProfile)e.profile={...e.profile,noAttack:true};
  const core=install(f.b,e);assert.equal(core.actions.combat.originalNoAttack,replaceProfile);f.otherCore.stop();assert.ok(e.profile.noAttack);core.stop();assert.equal(e.profile.noAttack,replaceProfile);noErrors(f);
 }
});
test('non-skipping native InstantKill enters rebirth without HP-damage credit and coalesces the short protected state',()=>{
 const f=fixture(),action=saga.templates.cripple.eventToActions.ON_BUFF_TRIGGER[2];
 assert.equal(executeEnemyInstantKill(f.b,{source:f.t,target:f.e,action}).status,'reborn');assert.equal(f.e.hp,1);assert.equal(f.core.lifecycle.rebirths,1);assert.equal(f.t.stats.dmg,0);assert.equal(f.t.stats.kills,0);
 assert.equal(executeEnemyInstantKill(f.b,{source:f.t,target:f.e,action}).status,'reborn');assert.equal(f.core.lifecycle.rebirths,1);assert.equal(f.e.hp,1);
 f.h.runUntil(()=>f.core.lifecycle.phase==='fake',1);assert.equal(f.e.hp,1000);assert.equal(f.rooms.length,0);noErrors(f);
});
test('forged native kill admissions cannot create rebirth, and a real skip flag bypasses it',()=>{
 const f=fixture();f.b.emit('enemyInstantKill',{unit:f.e,source:f.t,reborn:false});assert.equal(f.core.lifecycle.phase,'active');assert.equal(f.e.hp,50000);assert.equal(currentEnemyInstantKillReceipt({unit:f.e},f.b),null);
 executeEnemyInstantKill(f.b,{source:f.e,target:f.other,action:contract.markFinish[0]._succeedNodes[0]});assert.equal(f.e.alive,false);assert.ok(f.other.alive);assert.equal(f.rooms.length,1);noErrors(f);
});
