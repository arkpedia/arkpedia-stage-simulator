// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {battle, keys} from './helpers/ch17Harness.js';
import {chapter17Environment, registerChapter17Firewall} from '../server/sim/content/chapter17.js';
import {verifiedNative, verifiedChapter16FamilyGraph} from '../tools/arkpedia/enemy-support.mjs';
import {parseSkel} from '../tools/assets/skel.mjs';
const bytes=p=>readFileSync(new URL('../data/'+p,import.meta.url));
const read=p=>JSON.parse(bytes(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const family='candidates/arkpedia-ch17-firewall-boss',bosses=['enemy_1590_muama','enemy_1591_mutwin','enemy_1591_mutwin_2','enemy_1593_musnake'];
const graph=read(family+'-source.json'),native=read(family+'-native.json'),clock=read(family+'-animation-source.json');
const path=k=>'dyn/battle/prefabs/enemies/'+k+'.prefab';
function verifyGraph(g){return verifiedChapter16FamilyGraph(Buffer.from(JSON.stringify(g)),bytes('arkpedia-cn-native-source.json'),bytes('arkpedia-cn-enemy-native-source.json'),read('arkpedia-enemy-clock-source.json'));}
function fixture(options){const f=battle(keys[3]);f.e.atkCd=100;const env=chapter17Environment(f.b),broken=[];
 const wall=registerChapter17Firewall(f.b,f.e,{onBreak:index=>broken.push(index),...options});
 return{...f,env,wall,broken,expose:()=>env.expose({x:f.e.x-4,y:f.e.y})};}

test('all four firewall boss closures retain every indexed native component and original owner clock without granting support',()=>{
 const idx=read('arkpedia-enemy-clock-source.json');verifyGraph(graph);
 verifiedNative(native,idx.prefabs,sha(bytes('arkpedia-enemy-clock-source.json')),read('arkpedia-mvp.json').behaviors.source);
 assert.deepEqual(Object.keys(graph.prefabs).sort(),bosses.map(path).sort());
 assert.equal(Object.values(native.prefabs).flat().length,99);assert.equal(Object.keys(graph.projectiles).length,7);assert.equal(Object.keys(graph.templates).length,17);
 assert.equal(clock.source.graph.sha256,sha(bytes(family+'-source.json')));
 assert.deepEqual(Object.keys(clock.enemies).sort(),[...bosses].sort());
 const support=read('candidates/arkpedia-ch16-enemy-support.json');
 for(const key of bosses){const c=clock.enemies[key],raw=Buffer.from(c.base64,'base64');assert.equal(raw.length,c.bytes);assert.equal(sha(raw),c.sha256);assert.ok(parseSkel(raw).animations.length);
  assert.equal(sha(c.skeletonDataOriginalJson),c.skeletonDataSha256);
  const bindings=graph.prefabs[path(key)].map(r=>JSON.parse(r.originalJson)).filter(t=>t.skeletonDataAsset);
  assert.equal(bindings.length,1);assert.deepEqual(bindings[0].skeletonDataAsset,c.prefabBinding);assert.equal(support.enemies[key].policy,null);
 }
});
test('boss graph rejects changed indexed components and missing line or nested template dependencies',()=>{
 const changed=structuredClone(graph),entry=read('arkpedia-enemy-clock-source.json').prefabs[path(bosses[0])].clockComponents[0];
 const row=changed.prefabs[path(bosses[0])].find(r=>r.pathId===entry.pathId);row.originalJson+=' ';row.sha256=sha(row.originalJson);
 assert.throws(()=>verifyGraph(changed),/differs from indexed/);
 const projectile=structuredClone(graph);delete projectile.projectiles['dyn/battle/prefabs/[uc]projectiles/projectile_enemy_muama_line_h.prefab'];
 assert.throws(()=>verifyGraph(projectile),/projectile closure incomplete/);
 const template=structuredClone(graph);delete template.templates.enemy_muama_trriger_env;
 assert.throws(()=>verifyGraph(template),/template closure incomplete/);
});
test('retained boss contracts include deferred environment refresh, stun-linked fixed true damage and twin retirement/revival actions',()=>{
 const states=k=>JSON.parse(graph.templates[k].originalJson).eventToActions._items.map(e=>[e.key,JSON.parse(e.value.SerializedState)]);
 const line=states('enemy_muama_line_buff');assert.deepEqual(line.map(e=>e[0]),[0,2]);
 assert.equal(line[0][1][0]._isDerivedBuff,true);assert.equal(line[0][1][0]._finishDerivedBuffIfParentFinish,true);
 const damage=line[1][1][0];assert.equal(damage._damageType,'PURE');assert.equal(damage._damageKey,'value');assert.equal(damage._skipModifierEvent,false);
 const blink=states('enemy_muama_blink_buff')[0][1][0]._buff;
 assert.equal(blink.triggerInterval,.1);assert.equal(blink.waitFirstTriggerInterval,true);assert.equal(blink.triggerCnt,1);assert.equal(blink.lifeTime,.15);
 const trigger=states('enemy_muama_trriger_env')[0][1][0];assert.equal(trigger._envKey,'env_v073_mainline17_boss_ctrl');
 const heal=states('enemy_mutiwin_t[heal]')[0][1][0];assert.deepEqual(heal._conditionNode._buffKeys,['ally_alive']);
 assert.ok(heal._succeedNodes[0].$type.endsWith('+HealViaMaxHpRatio'));assert.equal(heal._failNodes[0]._skipReborn,true);
});
test('snake damage-step and final buttons are distinct from three-click firewall vulnerabilities',()=>{
 const state=(key,event)=>JSON.parse(JSON.parse(graph.templates[key].originalJson).eventToActions._items.find(e=>e.key===event).value.SerializedState);
 const step=state('enemy_musnake_hp_ratio_trigger',2),button=step.find(n=>n.$type.endsWith('+Mainline17CreateBossClickCounterButton'));
 assert.equal(button._requiredClickCount,10);assert.equal(button._duration,10);assert.equal(button._successBuffKey,'enemy_musnake_stun_buff');assert.equal(button._failedBuffKey,'enemy_musnake_heal_buff');
 const final=state('enemy_musnake_during_click',2)[0];assert.equal(final._requiredClickCount,15);assert.equal(final._duration,999999);
 assert.equal(final._successBuffKey,'enemy_musnake_kill_self_buff');assert.equal(final._failedBuffKey,final._successBuffKey);
 assert.equal(state('enemy_musnake_init_fire_button',1)[0]._createForAllWalls,true);
 const timeout=state('enemy_musnake_time_out',2),lp=timeout.find(n=>n.$type.endsWith('+ModifyLifePoint'));
 assert.equal(lp._blackboardKey,'value');assert.equal(lp._isReachExit,false);assert.equal(lp._isSub,false);
 const end=state('enemy_musnake_kill_self_buff',2).find(n=>n.$type.endsWith('+FinishCurrentWave'));assert.equal(end._finishAndSkip,true);
 const records=read('candidates/arkpedia-enemy-records.canonical.json').enemies.enemy_1593_musnake.levels[0];
 assert.equal(records.talents.bb['TimeOut.value'],-50);assert.equal(records.talents.bb['StepKill.hp_ratio'],.2);
});
test('counter exposure expires exactly at the deadline and a new exposure resets partial click progress',()=>{
 const f=fixture();f.expose();const side=f.wall.button.side.index;assert.equal(f.wall.click(side),true);
 f.expose();assert.equal(f.wall.button.clicks,0);assert.equal(f.wall.click(side),true);assert.deepEqual(f.broken,[]);
 f.b.time=f.wall.button.until;assert.equal(f.wall.click(side),false);assert.equal(f.wall.button,null);assert.deepEqual(f.broken,[]);
});
for(const retirement of ['death','removed','reuse','battleEnd'])test('firewall lifetime belongs to the owner deployment: '+retirement,()=>{
 const f=fixture();f.expose();const side=f.wall.button.side.index;
 if(retirement==='death')f.b.kill(f.e,null);
 if(retirement==='removed')f.b.emit('removed',{unit:f.e});
 if(retirement==='reuse')f.e.deploySeq++;
 if(retirement==='battleEnd')f.b.forceEnd();
 assert.equal(f.wall.click(side),false);assert.equal(f.wall.active,false);assert.equal(f.wall.button,null);assert.ok(!f.env.firewalls.includes(f.wall));
 f.expose();assert.equal(f.wall.button,null);assert.equal(f.wall.refresh(),false);assert.deepEqual(f.broken,[]);assert.deepEqual(f.b.errors,[]);
 assert.ok(!Object.values(f.b._hooks).flat().some(h=>h.owner===f.wall));
});
test('tick retires an invalid owner even without a click or exposure, preserving another wall',()=>{
 const f=fixture(),other=f.h.spawn(keys[3],{pos:[10,9]}),wall=registerChapter17Firewall(f.b,other);
 f.expose();f.e.deploySeq++;f.h.run(.04);assert.equal(f.wall.active,false);assert.ok(f.env.firewalls.includes(wall));assert.ok(wall.current());
 f.b.kill(other,null);assert.equal(f.env.firewalls.length,0);
});
test('refresh commits a new perimeter at the owner position and discards old damage/buttons',()=>{
 const f=fixture({width:7,height:4});f.expose();const side=f.wall.button.side.index;
 for(let i=0;i<3;i++)assert.equal(f.wall.click(side),true);assert.deepEqual(f.broken,[side]);
 f.expose();const old=f.wall.sides.map(s=>[s.x,s.y]);f.e.x+=2;f.e.y+=1;
 assert.deepEqual(f.wall.sides.map(s=>[s.x,s.y]),old);assert.equal(f.wall.refresh(),true);assert.equal(f.wall.button,null);
 assert.ok(f.wall.sides.every(s=>!s.broken));assert.deepEqual(f.wall.sides.map(s=>[s.x,s.y]),[[f.e.x,f.e.y-2],[f.e.x+3.5,f.e.y],[f.e.x,f.e.y+2],[f.e.x-3.5,f.e.y]]);
 f.expose();assert.equal(f.wall.button.clicks,0);assert.deepEqual(f.b.errors,[]);
});
test('completed click clears the button before a reentrant break callback or retirement',()=>{
 let f,attempt;f=fixture({onBreak:index=>{attempt=f.wall.click(index);f.wall.retire();}});f.expose();const side=f.wall.button.side.index;
 for(let i=0;i<3;i++)assert.equal(f.wall.click(side),true);assert.equal(attempt,false);assert.equal(f.wall.click(side),false);assert.equal(f.env.firewalls.length,0);assert.deepEqual(f.b.errors,[]);
});
test('fully broken walls have no button and exposure retains stable side order on ties',()=>{
 const f=fixture();for(let i=0;i<4;i++){f.env.expose(f.e);assert.equal(f.wall.button.side.index,i);for(let c=0;c<3;c++)assert.equal(f.wall.click(i),true);}
 f.expose();assert.equal(f.wall.button,null);assert.equal(f.wall.click(0),false);assert.deepEqual(f.broken,[0,1,2,3]);
});
