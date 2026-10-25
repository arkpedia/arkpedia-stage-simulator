// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {observeEnemyMove} from '../server/sim/movement-observer.js';
import {installChapter17MuamaCombat} from '../server/sim/content/chapter17-muama-combat.js';
import {installChapter17MuamaLine} from '../server/sim/content/chapter17-muama-line.js';
import {installChapter17MuamaBlink as install} from '../server/sim/content/chapter17-muama-blink.js';
import {installChapter17MuamaActions} from '../server/sim/content/chapter17-muama-actions.js';
import {chapter17Environment,chapter17FirewallSnapshot as snapshot,clickChapter17Firewall as click,chapter17FirewallBounds as bounds} from '../server/sim/content/chapter17.js';
import {muamaBlinkContract} from '../tools/arkpedia/muama-blink-contract.mjs';
const bytes=p=>readFileSync(new URL('../'+p,import.meta.url)),read=p=>JSON.parse(bytes(p));
const contract=read('data/candidates/arkpedia-ch17-muama-blink-contract.json'),keys=Object.keys(contract.enemies),records=read('data/candidates/arkpedia-enemy-records.canonical.json').enemies;
function fixture({key=keys[0],checkpoints=[{type:'MOVE',pos:[10,4]},{type:'MOVE',pos:[9,4]}],end=[9,2],start=[10,6],allyPos=[10,2],rect,beforeInstall}={}){
 const h=makeBattle({content:'none',autoFinish:false,timeLimit:1e6,rect,defs:{enemies:Object.fromEntries(keys.map(k=>[k,records[k].levels[0]])),chess:{blink_op:chessRec({id:'blink_op',stats:{maxHp:20000,blockCnt:0,def:0}})}},units:[{chessId:'blink_op',row:allyPos[0],col:allyPos[1]}]});
 h.b.start();for(const t of h.allies())t.profile.noAttack=true;
 const e=h.spawn(key,{pos:start,route:{motion:'WALK',start,end,checkpoints}}),combat=installChapter17MuamaCombat(h.b,e),line=installChapter17MuamaLine(h.b,e,{combat});
 beforeInstall?.(h.b,e);const blink=install(h.b,e,{combat,line}),events=[];
 for(const name of ['ch17MuamaBlinkCast','ch17MuamaBlinkMoved','ch17MuamaFirewallRefreshed'])h.b.on(name,c=>events.push({name,time:h.b.time,...c}));
 return{h,b:h.b,e,combat,line,blink,t:h.allies()[0],events};
}
function cast(f){f.combat.interrupt();f.combat.cooldown=0;f.blink.cooldown=0;assert.equal(f.blink.cast(),true);}
function move(f,x,y=f.e.y){const from={x:f.e.x,y:f.e.y};f.e.x=x;f.e.y=y;observeEnemyMove(f.b,f.e,from,'fixture-native-move');}
function breakSide(f){chapter17Environment(f.b).expose({x:9,y:10});const input=snapshot(f.b)[0];for(let i=0;i<3;i++)assert.equal(click(f.b,input),true);return input;}
const noErrors=f=>assert.deepEqual(f.b.errors,[]);

test('Blink receipt reproduces exact native actions, root event alias and prefab-bound intro/outro',async()=>{
 assert.deepEqual(await muamaBlinkContract(),contract);for(const s of Object.values(contract.sources))assert.equal(createHash('sha256').update(bytes(s.path)).digest('hex'),s.sha256);
 for(const key of keys){assert.equal(contract.enemies[key].defaults.intro,2);assert.equal(contract.enemies[key].defaults.outro,1.5);assert.equal(read('data/candidates/arkpedia-ch16-enemy-support.json').enemies[key].policy,null);}
});
for(const key of keys)test(key+' jumps to its actual next checkpoint after the intro and holds protection until the outro completes',()=>{
 const f=fixture({key});cast(f);assert.ok(f.e.s.flags.invulnerable);assert.ok(f.e.s.flags.unblockable);assert.ok(f.e.s.flags.noDisplace);assert.ok(f.e.s.flags.untargetable);
 f.h.run(1.95);assert.deepEqual([f.e.y,f.e.x],[10,6]);assert.equal(f.e.route.legIdx,0);f.h.run(.1);
 assert.deepEqual([f.e.y,f.e.x],[10,4]);assert.equal(f.e.route.legIdx,1);assert.ok(f.e.s.flags.invulnerable);f.h.run(1.5);
 assert.equal(f.blink.pending,null);assert.equal(f.combat.actionBusy,null);assert.ok(!f.e.s.flags.invulnerable);assert.ok(f.e.s.flags.noMove);assert.ok(f.e.findBuff(contract.enemies[key].defaults.buffKey));noErrors(f);
});
test('automatic Blink uses canonical initial cooldown without needing an allied target',()=>{
 const f=fixture();f.t.hidden=true;f.h.run(29.95);assert.equal(f.blink.pending,null);f.h.run(.1);assert.ok(f.blink.pending);assert.ok(f.blink.cooldown>59.8);f.h.run(2.1);
 assert.equal(f.e.x,4);assert.equal(f.line.pending,null);assert.equal(f.e.stats.attacks,0);noErrors(f);
});
test('the instant skill cooldown starts before its separately owned state finishes',()=>{
 const f=fixture();cast(f);f.h.run(3.6);assert.ok(f.blink.cooldown>56&&f.blink.cooldown<56.5);assert.ok(f.combat.cooldown>2&&f.combat.cooldown<2.5);noErrors(f);
});
test('silence blocks line admission while the shared scheduler can still admit Blink',()=>{
 const f=fixture();f.b.applyStatus(f.e,'silence',{duration:50});f.blink.cooldown=0;f.line.cooldowns.HorizontalLineAttack=0;f.h.run(.05);
 assert.ok(f.blink.pending);assert.equal(f.line.pending,null);noErrors(f);
});
test('a normal attack already in progress prevents Blink from stealing its animation',()=>{
 const f=fixture();f.t.x=5;f.combat.begin();f.blink.cooldown=0;assert.equal(f.blink.cast(),false);f.h.run(2.1);assert.equal(f.blink.pending,null);
 f.h.run(4.1);assert.ok(f.blink.pending);assert.equal(f.e.stats.attacks,1);noErrors(f);
});
test('the source immunity suppresses existing and newly added unblockable parents without erasing them',()=>{
 const f=fixture();const old=f.b.addBuff(f.e,{key:'fixture-old-unblockable',persist:true,flags:{unblockable:true}});cast(f);f.h.run(3.6);
 assert.ok(!f.e.s.flags.unblockable);assert.ok(f.e.buffs.includes(old));const newer=f.b.addBuff(f.e,{key:'fixture-new-unblockable',persist:true,flags:{unblockable:true}});
 assert.ok(!f.e.s.flags.unblockable);f.h.run(1.5);assert.ok(f.e.s.flags.unblockable);assert.ok(f.e.buffs.includes(old));assert.ok(f.e.buffs.includes(newer));noErrors(f);
});
test('Blink state protection prevents damage and displacement through the full intro/outro',()=>{
 const f=fixture();cast(f);const hp=f.e.hp;assert.equal(f.b.dealDamage(f.t,f.e,{amount:50000,type:'true',ignoreSelect:true,canDodge:false}),0);assert.equal(f.e.hp,hp);assert.equal(f.b._displaceable(f.e),false);
 f.h.run(2.5);assert.equal(f.b.dealDamage(f.t,f.e,{amount:50000,type:'true',ignoreSelect:true,canDodge:false}),0);assert.equal(f.e.hp,hp);noErrors(f);
});
test('firewall refresh waits the native root trigger delay and resets old click receipts and broken sides',()=>{
 const f=fixture(),old=breakSide(f);assert.ok(f.combat.wall.sides.some(s=>s.broken));cast(f);assert.equal(f.h.runUntil(()=>f.blink.pending?.moved,3),true);
 assert.equal(f.e.x,4);assert.ok(f.combat.wall.sides.some(s=>s.broken));assert.equal((bounds(f.combat.wall).x0+bounds(f.combat.wall).x1)/2,6);
 f.h.step(2);assert.ok(f.combat.wall.sides.some(s=>s.broken));f.h.step(1);assert.ok(f.combat.wall.sides.every(s=>!s.broken));
 assert.equal((bounds(f.combat.wall).x0+bounds(f.combat.wall).x1)/2,4);assert.equal(click(f.b,old),false);assert.equal(f.events.filter(c=>c.name==='ch17MuamaFirewallRefreshed').length,1);noErrors(f);
});
test('non-derived refresh survives expiration of its five-second root-listening parent',()=>{
 const f=fixture();cast(f);f.h.run(4.95);breakSide(f);move(f,3);assert.ok(f.blink.refreshTask);f.h.run(.05);
 assert.equal(f.blink.buff,null);assert.ok(f.combat.wall.sides.some(s=>s.broken));f.h.run(.05);assert.ok(f.combat.wall.sides.every(s=>!s.broken));assert.equal(f.e.x,3);noErrors(f);
});
test('root refresh coalesces the single native named trigger and same-tile movement does not reset it',()=>{
 const f=fixture();cast(f);f.h.run(3.6);const count=()=>f.events.filter(c=>c.name==='ch17MuamaFirewallRefreshed').length,start=count();
 move(f,3);f.h.run(.05);move(f,2);f.h.run(.05);assert.equal(count(),start);move(f,2.1);f.h.run(.05);assert.equal(count(),start+1);assert.equal(f.e.buffs.filter(b=>b.key==='enemy_muama_trriger_env').length,1);
 f.h.run(.1);assert.equal(f.blink.refreshTask,null);noErrors(f);
});
test('movement after the source parent expires leaves firewall placement unchanged',()=>{
 const f=fixture();cast(f);f.h.run(5.1);const wall=bounds(f.combat.wall);move(f,3);f.h.run(.2);assert.deepEqual(bounds(f.combat.wall),wall);assert.equal(f.blink.refreshTask,null);noErrors(f);
});
test('a forged movement callback with no actual root change cannot manufacture a refresh',()=>{
 const f=fixture();cast(f);breakSide(f);f.b.emit('enemyMoved',{enemy:f.e,from:{x:1,y:1},to:{x:6,y:10}});f.h.run(.2);
 assert.ok(f.combat.wall.sides.some(s=>s.broken));assert.equal(f.blink.refreshTask,null);noErrors(f);
});
test('the last checkpoint cannot leak the actor before its full outro finishes',()=>{
 const f=fixture({checkpoints:[{type:'MOVE',pos:[10,4]}],end:[10,4]});f.e.route.visitEveryCheckPoint=true;f.e.route.goal={x:4,y:10};cast(f);f.h.run(3.45);
 assert.ok(f.e.alive);assert.equal(f.blink.pending?.moved,true);f.h.run(.15);assert.equal(f.e.alive,false);assert.equal(f.blink.active,false);noErrors(f);
});
test('no remaining checkpoint does not substitute the final goal or create a Blink state',()=>{
 const f=fixture({checkpoints:[]});cast(f);assert.equal(f.blink.pending,null);assert.ok(f.blink.buff);assert.ok(!f.e.s.flags.invulnerable);f.h.run(4);
 assert.deepEqual([f.e.y,f.e.x],[10,6]);assert.equal(f.e.route.legIdx,0);assert.equal(f.combat.actionBusy,null);noErrors(f);
});
for(const mode of ['route','index','coordinate','offset'])test('a changed '+mode+' invalidates the captured cursor before relocation',()=>{
 const f=fixture();cast(f);if(mode==='route')f.e.route={...f.e.route};if(mode==='index')f.e.route.legIdx++;if(mode==='coordinate')f.e.route.legs[0].c=3;if(mode==='offset')f.e.route.cursorOffset={x:1,y:0};
 f.h.run(2.1);assert.deepEqual([f.e.y,f.e.x],[10,6]);assert.equal(f.blink.pending,null);assert.equal(f.combat.actionBusy,null);assert.ok(!f.e.s.flags.invulnerable);noErrors(f);
});
test('checkpoint cursor offsets survive relocation and old path planning caches are discarded',()=>{
 const f=fixture();f.e.route.cursorOffset={x:.25,y:.1};f.e.route.pts=[{x:99,y:99}];f.e.route.suffix=['stale'];cast(f);f.h.run(2.1);
 assert.deepEqual([f.e.y,f.e.x],[10.1,4.25]);assert.equal(f.e.route.legIdx,1);assert.equal(f.e.route.pts,null);assert.equal(f.e.route.suffix,null);noErrors(f);
});
for(const mode of ['death','reuse','stop','line-stop','battleEnd'])test('source '+mode+' cancels unborn movement and releases its exact state resources',()=>{
 const f=fixture();cast(f);f.h.run(.5);if(mode==='death')f.b.kill(f.e,null);if(mode==='reuse'){f.e.deploySeq++;f.b.addBuff(f.e,{key:'fixture-new-life-stationary',persist:true,flags:{noMove:true}});}if(mode==='stop')f.blink.stop();if(mode==='line-stop')f.line.stop();if(mode==='battleEnd')f.b._finish('defeat');
 f.h.run(2);assert.equal(f.blink.active,false);assert.equal(f.combat.actionBusy,null);assert.ok(!f.e.findBuff('ch17:muama-blink-state'));assert.equal(f.blink.refreshTask,null);assert.deepEqual([f.e.y,f.e.x],[10,6]);noErrors(f);
});
test('source reuse after arrival cannot send an old delayed refresh to the new deployment',()=>{
 const f=fixture();cast(f);f.h.runUntil(()=>f.blink.pending?.moved,3);assert.ok(f.blink.refreshTask);f.e.deploySeq++;f.h.run(.15);assert.equal(f.blink.active,false);assert.equal(f.events.filter(c=>c.name==='ch17MuamaFirewallRefreshed').length,0);noErrors(f);
});
test('rejected source buff or protection leaves no stale action lock or relocation',()=>{
 for(const key of ['enemy_muama_blink','ch17:muama-blink-state']){
  const f=fixture();f.b.on('beforeBuff',c=>{if(c.buff.key===key)c.cancel=true;});f.blink.cooldown=0;assert.equal(f.blink.cast(),false);assert.equal(f.combat.actionBusy,null);f.h.run(2.2);assert.deepEqual([f.e.y,f.e.x],[10,6]);assert.ok(!f.e.s.flags.invulnerable);noErrors(f);
 }
});
test('fresh deployment and exact records are required without broadening staged room overrides',()=>{
 const f=fixture();assert.throws(()=>install(f.b,f.e,{combat:f.combat,line:f.line}),/only one/);f.blink.stop();f.e.def={...f.e.def,raw:{...f.e.def.raw,talents:{...f.e.def.raw.talents,bbStr:{DamageResistance:{boss_room:'(0,10,0)'}}}}};
 assert.throws(()=>install(f.b,f.e,{combat:f.combat,line:f.line}),/Unreviewed/);noErrors(f);
});
test('all three retained 17-18 boss routes preserve their actual checkpoint order in the canonical rectangle',()=>{
 const source=read('data/candidates/arkpedia-stage-17-18-source.json'),lock=read('data/arkpedia-canonical-stage-17-18.lock.json');assert.deepEqual(source.inputs,lock.files);assert.equal(source.admitted,false);
 for(const[key,rawIndex,index]of [[keys[0],0,0],[keys[1],19,12],[keys[2],20,13]]){
  const raw=source.rawLevel.routes[rawIndex],geometry=source.geometry.routes[index],checkpoints=raw.checkpoints.map(cp=>{assert.equal(cp.type,'MOVE');assert.deepEqual(cp.reachOffset,{x:0,y:0});return{type:'MOVE',pos:[cp.position.row,cp.position.col]};});
  assert.deepEqual(checkpoints.map(cp=>cp.pos),geometry.checkpoints.map(cp=>[cp.position.row,cp.position.col]));
  const f=fixture({key,rect:{r0:0,r1:16,c0:0,c1:10},start:[raw.startPosition.row,raw.startPosition.col],end:[raw.endPosition.row,raw.endPosition.col],checkpoints});f.t.hidden=true;
  for(let i=0;i<checkpoints.length;i++){cast(f);f.h.run(3.6);assert.deepEqual([f.e.y,f.e.x],checkpoints[i].pos);assert.equal(f.e.route.legIdx,i+1);assert.ok(f.combat.wall.sides.every(s=>!s.broken));}
  assert.equal(f.blink.next(),null);noErrors(f);
 }
});
test('fresh source controllers retain their own protection when an older deployment retires',()=>{
 const f=fixture();cast(f);f.h.run(.4);f.e.deploySeq++;f.e.deployedAt=f.b.time;
 const combat=installChapter17MuamaCombat(f.b,f.e),line=installChapter17MuamaLine(f.b,f.e,{combat}),blink=install(f.b,f.e,{combat,line});blink.cooldown=0;assert.equal(blink.cast(),true);const q=blink.pending;
 f.blink.stop();assert.equal(combat.actionBusy,q);assert.equal(f.e.mem.ch17MuamaBlink,blink);assert.ok(f.e.s.flags.invulnerable);f.h.run(2.1);assert.equal(f.e.x,4);assert.equal(f.e.route.legIdx,1);noErrors(f);
});
test('changed original clocks, delayed actions and root event aliases fail source verification',async()=>{
 for(const mode of ['clock','root-action','event'])await assert.rejects(muamaBlinkContract({read:async url=>{
  const raw=readFileSync(url),path=String(url);
  if(mode==='clock'&&path.endsWith('arkpedia-ch17-firewall-boss-animation-source.json')){const c=JSON.parse(raw);c.enemies[keys[0]].base64='AA==';return Buffer.from(JSON.stringify(c));}
  if(mode==='event'&&path.endsWith('arkpedia-firewall-boss-event-alias-source.json')){const c=JSON.parse(raw);c.events['44'].name='ON_START';return Buffer.from(JSON.stringify(c));}
  if(mode==='root-action'&&path.endsWith('arkpedia-ch17-firewall-boss-source.json')){const c=JSON.parse(raw);c.templates.enemy_muama_trriger_env.originalJson=c.templates.enemy_muama_trriger_env.originalJson.replace('env_v073_mainline17_boss_ctrl','wrong-environment');return Buffer.from(JSON.stringify(c));}
  return raw;
 }}));
});
test('unblockable immunity permits real blocking after the protected outro, and its expiration releases the blocker',()=>{
 const f=fixture({checkpoints:[{type:'MOVE',pos:[9,3]}],allyPos:[9,3]});f.t.base.blockCnt=3;f.t.ground=true;f.t.markDirty();
 f.b.addBuff(f.e,{key:'fixture-unblockable',persist:true,flags:{unblockable:true}});cast(f);f.h.run(3.6);
 assert.equal(f.e.blockedBy,f.t);assert.ok(f.e.findBuff('fixture-unblockable'));f.h.run(1.5);assert.equal(f.e.blockedBy,null);assert.ok(f.e.s.flags.unblockable);noErrors(f);
});
test('action composition installs all three actors and retires them together if one part is removed',()=>{
 const f=fixture();f.blink.stop();f.line.stop();f.combat.stop();const actions=installChapter17MuamaActions(f.b,f.e);
 assert.ok(actions.combat.active&&actions.line.active&&actions.blink.active);assert.throws(()=>installChapter17MuamaActions(f.b,f.e),/only one/);
 actions.blink.cooldown=0;assert.equal(actions.blink.cast(),true);actions.line.stop();f.h.run(.1);
 assert.equal(actions.active,false);assert.equal(actions.combat.active,false);assert.equal(actions.blink.active,false);assert.ok(!f.e.s.flags.invulnerable);assert.equal(f.e.mem.ch17MuamaActions,undefined);noErrors(f);
});
test('failed composition does not steal or retire an already owned combat actor',()=>{
 const f=fixture();assert.throws(()=>installChapter17MuamaActions(f.b,f.e),/only one/);assert.ok(f.combat.active);assert.ok(f.line.active);assert.ok(f.blink.active);assert.equal(f.e.mem.ch17MuamaActions,undefined);noErrors(f);
});
test('composition rolls back its own wall and ordinary override when an existing line actor blocks admission',()=>{
 const f=fixture();f.blink.stop();f.combat.stop();assert.ok(f.line.active);
 assert.throws(()=>installChapter17MuamaActions(f.b,f.e),/only one/);assert.equal(f.e.mem.ch17MuamaCombat,undefined);assert.ok(!f.e.profile.noAttack);assert.ok(!f.e.findBuff('enemy_muama_t[damage_resistance]'));assert.equal(f.e.mem.ch17MuamaActions,undefined);noErrors(f);
});
