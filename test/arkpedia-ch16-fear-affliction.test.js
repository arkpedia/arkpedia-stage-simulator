// SPDX-License-Identifier: GPL-3.0-or-later
// Internal native action receiver; no fear enemy/stage admission follows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { makeBattle, enemyRec } from './helpers/battleHarness.js';
import { compileStageLocalEnemy } from '../shared/arkpedia/enemy-records.js';
import { fearProjectileAfflictions } from '../server/sim/content/chapter16-fear-affliction.js';
import {applyFearProjectileImpact,fearProjectileDamageAction,fearProjectileSourceReference,fearProjectileEntityReference} from '../server/sim/content/chapter16-fear-impact.js';
import {fearProjectileHitLedger} from '../server/sim/content/chapter16-fear-delivery.js';
import {fearProjectileLifetime} from '../server/sim/content/chapter16-fear-clock.js';
import {fearProjectileAreaDelivery} from '../server/sim/content/chapter16-fear-area.js';
import {fearProjectileFlight} from '../server/sim/content/chapter16-fear-flight.js';
import {fearProjectileArrivalLayerMask} from '../server/sim/content/chapter16-fear-layers.js';
import {fearProjectileAttackWait,fearProjectileWaitFrameCount} from '../server/sim/content/chapter16-fear-cast-wait.js';
import {fearProjectileSpell} from '../server/sim/content/chapter16-fear-spell.js';
import {fearProjectileSelfDeath,fearProjectileSuicide,fearProjectileSelfDeathActivation,fearProjectileModeFsmRestart,fearProjectileModeSwitch,fearProjectileCollectModeAbilities,fearProjectileModeEffects} from '../server/sim/content/chapter16-fear-self-death.js';
import {fearProjectileTargetVerifier,fearProjectileSourceMotion} from '../server/sim/content/chapter16-fear-targets.js';
import {fearProjectileReached,fearProjectileMotionStep,fearProjectileMountReference,fearProjectileTraceMotion} from '../server/sim/content/chapter16-fear-movement.js';
import { battle as minerBattle, keys as minerKeys } from './helpers/ch17Harness.js';
import { chapter16Shadow } from '../server/sim/content/chapter16-shadow.js';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const parentKey='feawpj_a[mcreep_fear]';
const fpOne=1n<<32n;
test('original fear modes initialize general before shared combat/attack and retain one shared ranged ability',()=>{
 const source=read('data/candidates/arkpedia-windows-fear-self-death-source.json'),graph=source.modeSwitch.graph;
 const resolve=ref=>ref.m_PathID==='0'?null:ref.m_PathID;
 const collect=role=>{
  const native=JSON.parse(graph[role].component.originalJson);
  return fearProjectileCollectModeAbilities({generalAbilities:native._generalAbilities.map(resolve),combat:resolve(native._combat),
   attack:resolve(native._attack),isValid:x=>x!==null,equals:(a,b)=>a===b});
 };
 assert.deepEqual(collect('mode0'),['-5760848500668714718','4729572091462136098']);
 assert.deepEqual(collect('mode1'),['-5930072227765702366']);
});

test('mode initialization uses swap-last removal and advances past the swapped entry exactly as the native loop does',()=>{
 const a={},b={},c={};
 const collect=generalAbilities=>fearProjectileCollectModeAbilities({generalAbilities,combat:null,attack:null,isValid:x=>x!==null,equals:(x,y)=>x===y});
 assert.deepEqual(collect([a,a,b,c]),[a,c,b]);
 assert.deepEqual(collect([a,a,a]),[a,a],'the swapped element is not rechecked at the same index');
});

test('mode initialization rejects invalid entries and delegates equality without substituting JavaScript reference equality',()=>{
 const a={id:1},duplicate={id:1},invalid={invalid:true},calls=[];
 const list=fearProjectileCollectModeAbilities({generalAbilities:[invalid,a],combat:duplicate,attack:null,
  isValid:x=>x!==null&&!x.invalid,equals:(left,right)=>{calls.push([left,right]);return left.id===right.id;}});
 assert.deepEqual(list,[a]);assert.deepEqual(calls,[[a,duplicate]]);
 assert.throws(()=>fearProjectileCollectModeAbilities({generalAbilities:[],combat:null,attack:null,isValid:()=>1,equals:()=>true}),/Boolean/);
});

function modeEffectsFixture(operation,overrides={}){
 const f=fixture(),mode={},events=[],talents=[{id:'valid',valid:true,attached:operation==='inactivate'},
  {id:'invalid',valid:false,attached:true},{id:'unchanged',valid:true,attached:operation!=='inactivate'}],dynamic=['dynamic1','dynamic2'];
 const callers={owner:f.source,mode,operation,readTalents:()=>talents,readDynamicAbilities:()=>dynamic,
  isTalentValid:t=>t.valid,isTalentAttached:t=>t.attached,
  attachTalent:(t,owner)=>{assert.equal(owner,f.source);events.push('talent+'+t.id);t.attached=true;},
  detachTalent:t=>{events.push('talent-'+t.id);t.attached=false;},
  attachAbility:(a,owner)=>{assert.equal(owner,f.source);events.push('ability+'+a);},
  detachAbility:a=>events.push('ability-'+a),...overrides};
 return{...f,mode,events,talents,dynamic,callers};
}

for(const operation of ['activate','inactivate'])test('mode '+operation+' applies eligible talent effects before dynamic ability effects',()=>{
 const f=modeEffectsFixture(operation),effects=fearProjectileModeEffects(f.b,f.callers),sign=operation==='activate'?'+':'-';
 assert.equal(effects.run(),true);assert.equal(effects.run(),null);
 assert.deepEqual(f.events,['talent'+sign+'valid','ability'+sign+'dynamic1','ability'+sign+'dynamic2']);
 assert.deepEqual(f.b.errors,[]);
});

test('initial mode activation skips talent predicates and still attaches dynamic abilities',()=>{
 const unexpected=()=>{throw Error('initial talent scan');};
 const f=modeEffectsFixture('activate',{isInit:true,readTalents:unexpected,isTalentValid:unexpected,isTalentAttached:unexpected});
 assert.equal(fearProjectileModeEffects(f.b,f.callers).run(),true);assert.deepEqual(f.events,['ability+dynamic1','ability+dynamic2']);
});

test('mode activation rereads the talent entry after validity and attachment predicates',()=>{
 const f=modeEffectsFixture('activate'),original=f.talents[0],middle={id:'middle',valid:true,attached:false},last={id:'last',valid:true,attached:false};
 f.talents.splice(1);f.dynamic.length=0;
 f.callers.isTalentValid=t=>{assert.equal(t,original);f.talents[0]=middle;return true;};
 f.callers.isTalentAttached=t=>{assert.equal(t,middle);f.talents[0]=last;return false;};
 assert.equal(fearProjectileModeEffects(f.b,f.callers).run(),true);assert.deepEqual(f.events,['talent+last']);
});

test('mode inactivation keeps its captured talent entry through validity and attachment predicates',()=>{
 const f=modeEffectsFixture('inactivate'),original=f.talents[0],other={id:'other',valid:true,attached:true};
 f.talents.splice(1);f.dynamic.length=0;
 f.callers.isTalentValid=t=>{assert.equal(t,original);f.talents[0]=other;return true;};
 f.callers.isTalentAttached=t=>{assert.equal(t,original);return true;};
 assert.equal(fearProjectileModeEffects(f.b,f.callers).run(),true);assert.deepEqual(f.events,['talent-valid']);assert.equal(other.attached,true);
});

test('dynamic ability callbacks observe collection growth without filtering entries through talent validity',()=>{
 const f=modeEffectsFixture('activate');f.talents.length=0;f.dynamic.splice(1);
 f.callers.attachAbility=a=>{f.events.push(a);if(a==='dynamic1')f.dynamic.push('appended');};
 assert.equal(fearProjectileModeEffects(f.b,f.callers).run(),true);assert.deepEqual(f.events,['dynamic1','appended']);
});

for(const operation of ['activate','inactivate'])for(const boundary of ['reuse','battleEnd','recursive'])
 test('mode '+operation+' handles '+boundary+' during talent effects before reaching dynamic abilities',()=>{
  const f=modeEffectsFixture(operation);let effects;
  const effect=()=>{if(boundary==='reuse')f.source.deploySeq++;else if(boundary==='battleEnd')f.b.emit('battleEnd',{});else assert.equal(effects.run(),null);};
  f.callers[operation==='activate'?'attachTalent':'detachTalent']=effect;
  effects=fearProjectileModeEffects(f.b,f.callers);assert.equal(effects.run(),boundary==='recursive'?true:null);
  assert.equal(f.events.some(e=>e.startsWith('ability')),boundary==='recursive');assert.deepEqual(f.b.errors,[]);
 });

function modeFixture(overrides={}){
 const f=fixture(),events=[],old={abilities:['attack','attack',null,'general']},next={abilities:['empty']};
 let current=old;
 const pose={x:1,y:0};
 const callers={owner:f.source,nextMode:next,readCurrentMode:()=>current,sameMode:(a,b)=>a===b,isModeValid:x=>x!=null,
  readFacing:()=>pose,readBodyDirection:()=>pose,readAbilities:mode=>mode.abilities,
  detachAbility:a=>events.push('detach:'+a),onInactivate:()=>events.push('inactive'),
  setModeActive:(mode,value)=>events.push((mode===old?'old':'new')+':'+value),
  writeCurrentMode:(_owner,mode)=>{current=mode;events.push('write');},readStartIniting:()=>true,
  attachAbility:(a,owner)=>{assert.equal(owner,f.source);events.push('attach:'+a);},
  onActivate:(mode,last,options)=>{assert.equal(mode,next);assert.equal(last,old);assert.deepEqual(options,{isInit:false});events.push('activate');},
  onSwitchMode:(_owner,mode,last,options)=>{assert.equal(mode,next);assert.equal(last,old);assert.deepEqual(options,{restartFSM:true});events.push('notify');pose.x=0;},
  faceTo:(_owner,value,options)=>{assert.deepEqual(value,{x:1,y:0});assert.deepEqual(options,{force:true});events.push('face');},
  setBodyDirection:(_owner,value,options)=>{assert.deepEqual(value,{x:1,y:0});assert.deepEqual(options,{force:true});events.push('direction');},...overrides};
 return{...f,events,old,next,callers,get current(){return current;},set current(value){current=value;}};
}

test('mode handoff composes static, talent and dynamic effects before notification without attaching new static abilities outside startIniting',()=>{
 const f=modeFixture({readStartIniting:()=>false});
 f.old.abilities=['old-static'];f.next.abilities=['new-static'];
 f.old.talents=[{id:'old-talent',attached:true}];f.next.talents=[{id:'new-talent',attached:false}];
 f.old.dynamic=['old-dynamic'];f.next.dynamic=['new-dynamic'];
 const effects=(mode,operation)=>fearProjectileModeEffects(f.b,{owner:f.source,mode,operation,
  readTalents:m=>m.talents,readDynamicAbilities:m=>m.dynamic,isTalentValid:()=>true,isTalentAttached:t=>t.attached,
  attachTalent:t=>{t.attached=true;f.events.push('talent+'+t.id);},detachTalent:t=>{t.attached=false;f.events.push('talent-'+t.id);},
  attachAbility:a=>f.events.push('dynamic+'+a),detachAbility:a=>f.events.push('dynamic-'+a)}).run();
 f.callers.onInactivate=mode=>effects(mode,'inactivate');f.callers.onActivate=mode=>effects(mode,'activate');
 assert.equal(fearProjectileModeSwitch(f.b,f.callers).run(),true);
 assert.deepEqual(f.events,['detach:old-static','talent-old-talent','dynamic-old-dynamic','old:false','write','new:true',
  'talent+new-talent','dynamic+new-dynamic','notify','face','direction']);
 assert.equal(f.old.talents[0].attached,false);assert.equal(f.next.talents[0].attached,true);
});

test('null dynamic ability entries fail rather than silently passing a validity filter',()=>{
 const f=modeEffectsFixture('activate');f.talents.length=0;f.dynamic.splice(0,2,null);
 const effects=fearProjectileModeEffects(f.b,f.callers);
 assert.throws(()=>effects.run(),/cannot be null/);assert.equal(effects.run(),null);assert.deepEqual(f.events,[]);
});

test('mode handoff detaches duplicate ability entries before inactivation and preserves captured pose through notification',()=>{
 const f=modeFixture(),handoff=fearProjectileModeSwitch(f.b,f.callers);
 assert.equal(handoff.run(),true);assert.equal(handoff.run(),null);assert.equal(f.current,f.next);
 assert.deepEqual(f.events,['detach:attack','detach:attack','detach:general','inactive','old:false','write','new:true','attach:empty','activate','notify','face','direction']);
 assert.deepEqual(f.b.errors,[]);
});

test('mode attachment uses startIniting, while activation and notification still run when that gate is false',()=>{
 const f=modeFixture({readStartIniting:()=>false});
 assert.equal(fearProjectileModeSwitch(f.b,f.callers).run(),true);
 assert.equal(f.events.some(e=>e.startsWith('attach:')),false);assert.ok(f.events.includes('activate'));assert.ok(f.events.includes('notify'));
});

test('same-mode nonforced switch returns false before pose reads or mode effects',()=>{
 const f=modeFixture();f.current=f.next;f.callers.readFacing=()=>{throw Error('no pose read');};
 assert.equal(fearProjectileModeSwitch(f.b,f.callers).run(),false);assert.deepEqual(f.events,[]);
});

test('inactivation may change currentMode before native lastMode is sampled for activation and notification',()=>{
 const f=modeFixture(),replacement={abilities:[]};
 f.callers.onInactivate=()=>{f.current=replacement;};
 f.callers.onActivate=(_mode,last)=>assert.equal(last,replacement);
 f.callers.onSwitchMode=(_owner,_mode,last)=>assert.equal(last,replacement);
 assert.equal(fearProjectileModeSwitch(f.b,f.callers).run(),true);assert.equal(f.current,f.next);
});

test('mode is sampled after pose reads before inactivation, rather than using the earlier equality-check value',()=>{
 const f=modeFixture(),replacement={abilities:['changed']};
 f.callers.readBodyDirection=()=>{f.current=replacement;return{x:1,y:0};};
 f.callers.onInactivate=mode=>assert.equal(mode,replacement);
 f.callers.onActivate=(_mode,last)=>assert.equal(last,replacement);
 f.callers.onSwitchMode=(_owner,_mode,last)=>assert.equal(last,replacement);
 assert.equal(fearProjectileModeSwitch(f.b,f.callers).run(),true);
 assert.deepEqual(f.events.slice(0,2),['detach:changed','new:false']);
});

test('self-death composes mode detachment and saved-state restart before immunity and zero HP',()=>{
 const f=modeFixture({readStartIniting:()=>false});let state=12;
 const restart=fearProjectileModeFsmRestart(f.b,{owner:f.source,isRunning:()=>true,readState:()=>state,
  stop:()=>{f.events.push('stop');state=-1;},start:(_owner,saved)=>{f.events.push('start');state=saved;}});
 f.callers.onSwitchMode=()=>restart.run();
 const handoff=fearProjectileModeSwitch(f.b,f.callers);
 const suicide=fearProjectileSuicide(f.b,{target:f.source,readAlive:()=>f.source.alive,
  markSuicide:()=>f.events.push('suicide'),setHpInternal:()=>{f.events.push('zero HP');f.source.alive=false;}});
 const activation=fearProjectileSelfDeathActivation(f.b,{owner:f.source,readAbnormalFlag:()=>false,readAbnormalCombo:()=>false,
  switchMode:()=>handoff.run(),createImmunityBuff:()=>{f.events.push('immunity');return true;},instantKill:()=>suicide.run()});
 assert.equal(activation.run(),false);assert.equal(state,12);assert.equal(f.current,f.next);assert.equal(f.source.alive,false);
 assert.deepEqual(f.events,['detach:attack','detach:attack','detach:general','inactive','old:false','write','new:true','activate','stop','start','face','direction','immunity','suicide','zero HP']);
});

test('mode ability iteration observes appended entries rather than snapshotting or deduplicating the initialized array',()=>{
 const f=modeFixture();f.old.abilities=['first'];
 f.callers.detachAbility=a=>{f.events.push('detach:'+a);if(a==='first')f.old.abilities.push('appended');};
 assert.equal(fearProjectileModeSwitch(f.b,f.callers).run(),true);
 assert.deepEqual(f.events.slice(0,2),['detach:first','detach:appended']);
});

for(const point of ['detachAbility','onInactivate','writeCurrentMode','attachAbility','onActivate','onSwitchMode','faceTo'])
 for(const boundary of ['reuse','battleEnd'])test('mode switch stops at '+point+' on '+boundary,()=>{
  const f=modeFixture();f.callers[point]=()=>{if(boundary==='reuse')f.source.deploySeq++;else f.b.emit('battleEnd',{});};
  const handoff=fearProjectileModeSwitch(f.b,f.callers);
  assert.equal(handoff.run(),null);assert.equal(handoff.run(),null);assert.equal(f.events.includes('direction'),false);assert.deepEqual(f.b.errors,[]);
 });

test('mode handoff rejects reentry during detachment without losing the original transition',()=>{
 const f=modeFixture();let handoff;f.callers.detachAbility=()=>assert.equal(handoff.run(),null);
 handoff=fearProjectileModeSwitch(f.b,f.callers);assert.equal(handoff.run(),true);assert.equal(f.events.at(-1),'direction');
});

test('mode restart preserves the state captured before Stop changes the state machine',()=>{
 const f=fixture(),events=[];let state=42,running=true;
 const restart=fearProjectileModeFsmRestart(f.b,{owner:f.source,isRunning:()=>running,readState:()=>state,
  stop:owner=>{assert.equal(owner,f.source);events.push('stop:'+state);state=-1;running=false;},
  start:(owner,saved)=>{assert.equal(owner,f.source);events.push('start:'+saved);state=saved;running=true;}});
 assert.equal(restart.run(),true);assert.equal(state,42);assert.equal(running,true);
 assert.deepEqual(events,['stop:42','start:42']);assert.equal(restart.run(),null);
});

test('mode restart does not start a stopped state machine or read an arbitrary default state',()=>{
 const f=fixture();const unexpected=()=>{throw Error('stopped FSM');};
 const restart=fearProjectileModeFsmRestart(f.b,{owner:f.source,isRunning:()=>false,readState:unexpected,stop:unexpected,start:unexpected});
 assert.equal(restart.run(),false);assert.equal(restart.run(),null);
});

for(const boundary of ['reuse','battleEnd','recursive'])test('mode FSM restart guards '+boundary+' while stopping',()=>{
 const f=fixture();let starts=0,restart;
 restart=fearProjectileModeFsmRestart(f.b,{owner:f.source,isRunning:()=>true,readState:()=>7,
  stop:()=>{if(boundary==='reuse')f.source.deploySeq++;else if(boundary==='battleEnd')f.b.emit('battleEnd',{});
   else assert.equal(restart.run(),null);},start:()=>starts++});
 assert.equal(restart.run(),boundary==='recursive'?true:null);assert.equal(starts,boundary==='recursive'?1:0);
 assert.deepEqual(f.b.errors,[]);
});

test('selected mode restart can precede immunity and suicide without changing its saved FSM state',()=>{
 const f=fixture(),events=[];let state=12;
 const restart=fearProjectileModeFsmRestart(f.b,{owner:f.source,isRunning:()=>true,readState:()=>state,
  stop:()=>{events.push('stop');state=-1;},start:(_owner,saved)=>{events.push('start');state=saved;}});
 const activation=fearProjectileSelfDeathActivation(f.b,{owner:f.source,readAbnormalFlag:()=>false,readAbnormalCombo:()=>false,
  switchMode:()=>{events.push('mode1');restart.run();return true;},
  createImmunityBuff:()=>{events.push('immunity');return true;},instantKill:()=>{events.push('suicide');return false;}});
 assert.equal(activation.run(),false);assert.equal(state,12);assert.deepEqual(events,['mode1','stop','start','immunity','suicide']);
});

test('native self-death activation binds TARGET and BUFF_OWNER to the owner despite an incoming different target',()=>{
 const f=fixture(),events=[];
 const activation=fearProjectileSelfDeathActivation(f.b,{owner:f.source,target:f.target,buffOwner:f.target,
  readAbnormalFlag:unit=>{assert.equal(unit,f.source);return false;},readAbnormalCombo:unit=>{assert.equal(unit,f.source);return false;},
  switchMode:unit=>{assert.equal(unit,f.source);events.push('mode1');return true;},
  createImmunityBuff:unit=>{assert.equal(unit,f.source);events.push('immunity');return true;},
  instantKill:unit=>{assert.equal(unit,f.source);events.push('suicide');return false;}});
 assert.equal(activation.run(),false);assert.equal(activation.run(),null);assert.deepEqual(events,['mode1','immunity','suicide']);
 assert.equal(f.target.alive,true);
});

test('activation binds its original owner life and never redirects the action chain to a reused body',()=>{
 const f=fixture();let callbacks=0;
 const activation=fearProjectileSelfDeathActivation(f.b,{owner:f.source,readAbnormalFlag:()=>{callbacks++;return false;},
  readAbnormalCombo:()=>false,switchMode:()=>true,createImmunityBuff:()=>true,instantKill:()=>true});
 f.source.deploySeq++;assert.equal(activation.run(),null);assert.equal(callbacks,0);
});

test('selected InstantKill marks suicide before forced zero HP and returns the post-action alive state',()=>{
 const f=fixture(),events=[];
 const suicide=fearProjectileSuicide(f.b,{target:f.source,readAlive:unit=>{events.push('alive');return unit.alive;},
  markSuicide:unit=>{assert.equal(unit,f.source);events.push('suicide');},
  setHpInternal:(unit,options)=>{
   assert.equal(unit,f.source);assert.deepEqual(options,{valueRaw:0n,force:true,noSource:false,skipReborn:false});
   events.push('zero HP');unit.alive=false;
  }});
 assert.equal(suicide.run(),false);assert.deepEqual(events,['alive','suicide','zero HP','alive']);assert.equal(suicide.run(),null);
});

test('already non-alive suicide target receives no mark or HP write but preserves final alive query',()=>{
 const f=fixture();f.source.alive=false;let reads=0;
 const suicide=fearProjectileSuicide(f.b,{target:f.source,readAlive:()=>{reads++;return false;},
  markSuicide:()=>{throw Error('dead target');},setHpInternal:()=>{throw Error('dead target');}});
 assert.equal(suicide.run(),false);assert.equal(reads,2);
});

for(const boundary of ['reuse','battleEnd','recursive'])test('suicide primitive guards '+boundary+' while marking its target',()=>{
 const f=fixture();let writes=0,suicide;
 suicide=fearProjectileSuicide(f.b,{target:f.source,readAlive:()=>true,markSuicide:()=>{
  if(boundary==='reuse')f.source.deploySeq++;else if(boundary==='battleEnd')f.b.emit('battleEnd',{});
  else assert.equal(suicide.run(),null);
 },setHpInternal:()=>writes++});
 assert.equal(suicide.run(),boundary==='recursive'?true:null);assert.equal(writes,boundary==='recursive'?1:0);
 assert.deepEqual(f.b.errors,[]);
});

test('self-death chain retains false native return after zero-HP death rather than treating it as a failed action',()=>{
 const f=fixture(),events=[];
 const suicide=fearProjectileSuicide(f.b,{target:f.source,readAlive:unit=>unit.alive,
  markSuicide:()=>events.push('suicide'),setHpInternal:unit=>{events.push('zero HP');unit.alive=false;}});
 const action=fearProjectileSelfDeath(f.b,{buffOwner:f.source,target:f.source,readAbnormalFlag:()=>false,
  readAbnormalCombo:()=>false,switchMode:()=>{events.push('mode1');return true;},
  createImmunityBuff:()=>{events.push('immunity');return true;},instantKill:()=>suicide.run()});
 assert.equal(action.run(),false);assert.equal(f.source.alive,false);assert.deepEqual(events,['mode1','immunity','suicide','zero HP']);
});

function selfDeathFixture(overrides={}){
 const f=fixture(),events=[];
 const action=fearProjectileSelfDeath(f.b,{buffOwner:f.source,target:f.source,
  readAbnormalFlag:(_unit,flag)=>{events.push(flag);return false;},
  readAbnormalCombo:(_unit,combo)=>{events.push(combo);return false;},
  switchMode:(_unit,options)=>{events.push(options);return true;},
  createImmunityBuff:()=>{events.push('immunity');return true;},instantKill:(_unit,options)=>{events.push(options);return true;},...overrides});
 return{...f,action,events};
}

test('self-death action order switches mode then creates immunity before invoking explicit kill semantics',()=>{
 const f=selfDeathFixture();assert.equal(f.action.run(),true);
 assert.deepEqual(f.events.slice(0,4),['LEVITATE','FROZEN','STUNNED','SLEEPING']);
 assert.deepEqual(f.events[4],{modeIndex:1,loadModeFromBlackboard:false,restoreDefault:false,restartFSM:true});
 assert.equal(f.events[5],'immunity');assert.deepEqual(f.events[6],{killSource:false,noSource:false,
  withdrawIfRallyPoint:false,resultIfInRallyPointMode:false,skipReborn:false,noReason:false,markReachExit:false,switchState:false});
 assert.equal(f.action.run(),null);
});

for(const flag of ['LEVITATE','FROZEN','STUNNED','SLEEPING'])test('failed '+flag+' unset check stops before mode switch and never reaches AlwaysNext',()=>{
 const f=selfDeathFixture({readAbnormalFlag:(_unit,key)=>key===flag,readAbnormalCombo:(_unit,key)=>key===flag});
 assert.equal(f.action.run(),false);assert.deepEqual(f.events,[]);
});

test('a failed mode switch stops before immunity and kill',()=>{
 const f=selfDeathFixture({switchMode:()=>false});assert.equal(f.action.run(),false);
 assert.deepEqual(f.events,['LEVITATE','FROZEN','STUNNED','SLEEPING']);
});

test('AlwaysNext after immunity creation permits kill even when that creation fails',()=>{
 const f=selfDeathFixture({createImmunityBuff:()=>{f.events.push('rejected immunity');return false;}});
 assert.equal(f.action.run(),true);assert.equal(f.events[5],'rejected immunity');assert.equal(f.events[6].killSource,false);
});

test('self-death action preserves separate BUFF_OWNER and TARGET contexts',()=>{
 const f=fixture(),events=[];
 const action=fearProjectileSelfDeath(f.b,{buffOwner:f.source,target:f.target,
  readAbnormalFlag:unit=>{assert.equal(unit,f.source);return false;},
  readAbnormalCombo:unit=>{assert.equal(unit,f.source);return false;},
  switchMode:unit=>{assert.equal(unit,f.target);events.push('mode');return true;},
  createImmunityBuff:unit=>{assert.equal(unit,f.source);events.push('immunity');return true;},
  instantKill:unit=>{assert.equal(unit,f.target);events.push('kill');return true;}});
 assert.equal(action.run(),true);assert.deepEqual(events,['mode','immunity','kill']);
});

for(const boundary of ['reuse','battleEnd','recursive'])test('self-death action guards '+boundary+' during mode switching',()=>{
 let f;f=selfDeathFixture({switchMode:()=>{
  if(boundary==='reuse')f.source.deploySeq++;else if(boundary==='battleEnd')f.b.emit('battleEnd',{});
  else assert.equal(f.action.run(),null);return true;
 }});
 assert.equal(f.action.run(),boundary==='recursive'?true:null);
 assert.equal(f.events.includes('immunity'),boundary==='recursive');assert.deepEqual(f.b.errors,[]);
});

function spellFixture(overrides={}){
 const f=fixture(),events=[];
 const spell=fearProjectileSpell(f.b,{owner:f.source,onSpellStart:()=>{events.push('start');return true;},
  isCasting:()=>{events.push('casting');return true;},emitSpellEnd:({event,spellCount})=>{
   assert.equal(event,5);assert.equal(spellCount,1);events.push('end');},
  mayBeginPostDelay:()=>{events.push('canPost');return true;},beginPostDelay:()=>events.push('post'),...overrides});
 return{...f,spell,events};
}

test('single-spell continuation launches before event5 and checks post-delay afterward',()=>{
 const f=spellFixture();assert.deepEqual(f.spell.run(),{started:true,spellEnd:true,postDelay:true});
 assert.deepEqual(f.events,['start','casting','end','canPost','post']);assert.equal(f.spell.run(),null);
});

for(const [key,expected]of [['onSpellStart',{started:false,spellEnd:false,postDelay:false}],
 ['isCasting',{started:true,spellEnd:false,postDelay:false}],['mayBeginPostDelay',{started:true,spellEnd:true,postDelay:false}]])
test('spell continuation preserves the false '+key+' gate',()=>{
 const f=spellFixture({[key]:()=>false});assert.deepEqual(f.spell.run(),expected);
 assert.equal(f.events.includes('post'),false);if(key!=='mayBeginPostDelay')assert.equal(f.events.includes('end'),false);
});

test('event5 owner removal prevents post-delay without suppressing the completed spell event',()=>{
 let f;f=spellFixture({emitSpellEnd:()=>{f.events.push('end');f.b.kill(f.source,null);}});
 assert.deepEqual(f.spell.run(),{started:true,spellEnd:true,postDelay:false});
 assert.deepEqual(f.events,['start','casting','end']);assert.equal(f.spell.run(),null);assert.deepEqual(f.b.errors,[]);
});

test('recursive spell continuations cannot duplicate launch or spell-end callbacks',()=>{
 let f;f=spellFixture({onSpellStart:()=>{assert.equal(f.spell.run(),null);f.events.push('start');return true;},
  emitSpellEnd:()=>{assert.equal(f.spell.run(),null);f.events.push('end');}});
 f.spell.run();assert.deepEqual(f.events,['start','casting','end','canPost','post']);
});

test('owner reuse while testing casting prevents spell-end and post-delay for the replacement',()=>{
 let f;f=spellFixture({isCasting:()=>{f.source.deploySeq++;return true;}});
 assert.equal(f.spell.run(),null);assert.deepEqual(f.events,['start']);
});

test('bounded wait, initialized modes, event5 self-death and independent flight compose without canceling born damage',()=>{
 const f=modeFixture({readStartIniting:()=>false});f.source.base.atk=175;f.source.markDirty();f.target.nativeUid=1;
 const graph=read('data/candidates/arkpedia-windows-fear-self-death-source.json').modeSwitch.graph;
 for(const [role,mode]of [['mode0',f.old],['mode1',f.next]]){
  const native=JSON.parse(graph[role].component.originalJson),resolve=ref=>ref.m_PathID==='0'?null:ref.m_PathID;
  mode.abilities=fearProjectileCollectModeAbilities({generalAbilities:native._generalAbilities.map(resolve),combat:resolve(native._combat),
   attack:resolve(native._attack),isValid:x=>x!==null,equals:(a,b)=>a===b});
 }
 let state=12,casting=true;
 const restart=fearProjectileModeFsmRestart(f.b,{owner:f.source,isRunning:()=>true,readState:()=>state,
  stop:()=>{state=-1;},start:(_owner,saved)=>{state=saved;}});
 const detached=[];f.callers.detachAbility=ability=>{detached.push(ability);casting=false;};
 f.callers.onSwitchMode=()=>restart.run();
 const handoff=fearProjectileModeSwitch(f.b,f.callers);
 const suicide=fearProjectileSuicide(f.b,{target:f.source,readAlive:()=>f.source.alive,markSuicide:()=>{},
  setHpInternal:()=>f.b.kill(f.source,null)});
 const activation=fearProjectileSelfDeathActivation(f.b,{owner:f.source,readAbnormalFlag:()=>false,readAbnormalCombo:()=>false,
  switchMode:()=>handoff.run(),createImmunityBuff:()=>true,instantKill:()=>suicide.run()});
 const source=fearProjectileSourceReference(f.b,f.source),damage=fearProjectileDamageAction(f.b,source),events=[];
 let flight;
 const spell=fearProjectileSpell(f.b,{owner:f.source,onSpellStart:()=>{
  events.push('birth');flight=fearProjectileFlight(f.b,{from:{x:0,y:0,z:0},initialTarget:{x:1,y:0,z:0},
   resolveTargetPosition:()=>null,resolveTraceTarget:()=>f.target,
   area:{queryOverlaps:()=>[f.target],resolveEntity:u=>u,readUid:u=>u.nativeUid,isCandidate:()=>true,
    verifyTarget:()=>true,deterministic:true,resolveSource:source.resolveSource,onSelected:()=>{}},
   runHit:({target})=>applyFearProjectileImpact(f.b,{source:f.source,target,applyAttachments:()=>{},runActions:damage}),
   onStopped:()=>{},scheduleCompletion:()=>()=>{}});return true;
 },isCasting:()=>casting,emitSpellEnd:()=>{events.push('event5');assert.equal(activation.run(),null);},
 mayBeginPostDelay:()=>{throw Error('removed owner');},beginPostDelay:()=>{throw Error('removed owner');}});
 const wait=fearProjectileAttackWait(f.b,{owner:f.source,cachedDurationRaw:fpOne,readDeltaPlayTime:()=>1,
  isCastActive:()=>true,subscribeAttackEvent:()=>()=>{},onReady:()=>spell.run()});
 wait.resume();assert.equal(flight,undefined);wait.resume();assert.deepEqual(events,['birth','event5']);
 assert.equal(state,12);assert.equal(casting,false);assert.equal(f.current,f.next);
 assert.deepEqual(detached,['-5760848500668714718','4729572091462136098']);
 const hp=f.target.hp;flight.advance(fpOne/10n,fpOne);assert.equal(hp-f.target.hp,175);
 assert.ok(f.target.findBuff(parentKey));assert.equal(wait.resume(),null);assert.equal(spell.run(),null);
 flight.release();source.release();assert.deepEqual(f.b.errors,[]);
});

test('cast wait frame conversion rounds FP quotient ties to even and clamps to one',()=>{
 for(const [raw,expected]of [[fpOne,1],[3n*fpOne/2n,2],[5n*fpOne/2n,2],[7n*fpOne/2n,4],
  [0n,1],[-5n*fpOne/2n,1]])assert.equal(fearProjectileWaitFrameCount(raw,1),expected);
 assert.equal(fearProjectileWaitFrameCount(fpOne,1/30),30);
 assert.equal(fearProjectileWaitFrameCount(3n*fpOne,1/30),90);
 assert.equal(fearProjectileWaitFrameCount(fpOne,.25),4);
 assert.equal(fearProjectileWaitFrameCount(fpOne,0),1);
 assert.equal(fearProjectileWaitFrameCount(fpOne,Number.MIN_VALUE),1);
});

test('FP division raw rounding can change a later halfway frame decision',()=>{
 assert.equal(fearProjectileWaitFrameCount(5n*fpOne,2),2);
 assert.equal(fearProjectileWaitFrameCount(5n*fpOne+1n,2),3);
 assert.equal(fearProjectileWaitFrameCount(5n*fpOne-1n,2),2);
 // One division overflow result rounds through signed64 and low32 conversion.
 assert.equal(fearProjectileWaitFrameCount((1n<<63n)-1n,2**-32),1);
 for(const raw of [1,1n<<63n,-(1n<<63n)-1n])assert.throws(()=>fearProjectileWaitFrameCount(raw,.1),/Q32.32/);
 for(const delta of [NaN,Infinity,2**31])assert.throws(()=>fearProjectileWaitFrameCount(fpOne,delta),/deltaPlayTime/);
});

test('computed native count drives timeout without using the visual clip duration',()=>{
 const count=fearProjectileWaitFrameCount(fpOne,.25),f=castWaitFixture({frameCount:count});
 assert.equal(count,4);assert.equal(f.wait.resume().waiting,true);
 for(let i=1;i<count;i++)assert.equal(f.wait.resume().waiting,true);
 assert.deepEqual(f.wait.resume(),{waiting:false,cause:'timeout'});assert.equal(f.wait.framesWaited,4);
});

function castWaitFixture({frameCount=3,...overrides}={}){
 const f=fixture(),events=[];let receive=()=>{},unsubscribed=0;
 const wait=fearProjectileAttackWait(f.b,{owner:f.source,cachedDurationRaw:BigInt(frameCount)*fpOne,readDeltaPlayTime:()=>1,isCastActive:()=>true,
  subscribeAttackEvent:({owner,event,onEvent})=>{
   assert.equal(owner,f.source);assert.equal(event,19);receive=onEvent;events.push('subscribe');
   return()=>{unsubscribed++;events.push('unsubscribe');};
  },onReady:({cause})=>events.push(cause),...overrides});
 return{...f,events,wait,receive:()=>receive(),get unsubscribed(){return unsubscribed;}};
}

test('cast wait samples deltaPlayTime once at first resume and freezes its native frame limit',()=>{
 let delta=.25,reads=0,duration=3n*fpOne;
 const f=castWaitFixture({cachedDurationRaw:duration,readDeltaPlayTime:()=>{reads++;return delta;}});
 assert.equal(reads,0);duration=99n*fpOne;delta=2;
 assert.deepEqual(f.wait.resume(),{waiting:true,index:0,frameCount:2});assert.equal(reads,1);
 delta=.01;assert.deepEqual(f.wait.resume(),{waiting:true,index:1,frameCount:2});
 assert.deepEqual(f.wait.resume(),{waiting:false,cause:'timeout'});assert.equal(reads,1);
});

test('attack registration precedes timing sampling and an event during sampling still yields',()=>{
 let f,reads=0;f=castWaitFixture({readDeltaPlayTime:()=>{
  assert.deepEqual(f.events,['subscribe']);f.receive();reads++;
  assert.equal(f.wait.resume(),null);return .1;
 }});
 assert.deepEqual(f.wait.resume(),{waiting:true,index:0,frameCount:30});
 assert.deepEqual(f.wait.resume(),{waiting:false,cause:'event'});assert.equal(reads,1);
 assert.deepEqual(f.events,['subscribe','unsubscribe','event']);
});

test('cancellation during native timing sampling removes the attack subscription without readiness',()=>{
 let f;f=castWaitFixture({readDeltaPlayTime:()=>{f.b.emit('battleEnd',{});return NaN;}});
 assert.equal(f.wait.resume(),null);assert.equal(f.wait.resume(),null);assert.equal(f.unsubscribed,1);
 assert.deepEqual(f.events,['subscribe','unsubscribe']);assert.deepEqual(f.b.errors,[]);
});

test('invalid sampled timing closes the wait and cannot leave a live attack-event handler',()=>{
 const f=castWaitFixture({readDeltaPlayTime:()=>Infinity});
 assert.throws(()=>f.wait.resume(),/deltaPlayTime/);assert.equal(f.unsubscribed,1);
 f.receive();assert.equal(f.wait.resume(),null);assert.deepEqual(f.events,['subscribe','unsubscribe']);
});

test('event-free selected cast reaches its bounded wait limit without inventing an attack event',()=>{
 const f=castWaitFixture();assert.deepEqual(f.wait.resume(),{waiting:true,index:0,frameCount:3});
 assert.deepEqual(f.wait.resume(),{waiting:true,index:1,frameCount:3});
 assert.deepEqual(f.wait.resume(),{waiting:true,index:2,frameCount:3});
 assert.deepEqual(f.wait.resume(),{waiting:false,cause:'timeout'});
 assert.deepEqual(f.events,['subscribe','unsubscribe','timeout']);assert.equal(f.wait.resume(),null);
 assert.equal(f.unsubscribed,1);
});

test('attack event releases the wait on resumption and unsubscribes before readiness',()=>{
 const f=castWaitFixture();f.wait.resume();f.receive();f.receive();
 assert.deepEqual(f.wait.resume(),{waiting:false,cause:'event'});f.receive();assert.equal(f.wait.resume(),null);
 assert.deepEqual(f.events,['subscribe','unsubscribe','event']);assert.equal(f.wait.framesWaited,0);
});

test('event received during subscription still yields before the bounded wait can finish',()=>{
 let unsubscribed=0;const f=castWaitFixture({frameCount:1,subscribeAttackEvent:({onEvent})=>{onEvent();return()=>unsubscribed++;}});
 assert.equal(f.wait.resume().waiting,true);assert.deepEqual(f.events,[]);
 assert.deepEqual(f.wait.resume(),{waiting:false,cause:'event'});assert.equal(unsubscribed,1);
});

test('selected target death does not cancel the wait or fabricate readiness before timeout',()=>{
 const f=castWaitFixture({frameCount:1});f.wait.resume();f.b.kill(f.target,null);
 assert.deepEqual(f.wait.resume(),{waiting:false,cause:'timeout'});assert.deepEqual(f.events,['subscribe','unsubscribe','timeout']);
});

for(const boundary of ['ownerReuse','ownerRemoval','battleEnd','castInactive'])test('cast wait cancels on '+boundary+' without launch readiness',()=>{
 let active=true;const f=castWaitFixture({isCastActive:()=>active});f.wait.resume();
 if(boundary==='ownerReuse')f.source.deploySeq++;
 else if(boundary==='ownerRemoval')f.b.emit('removed',{unit:f.source});
 else if(boundary==='battleEnd')f.b.emit('battleEnd',{});else active=false;
 assert.equal(f.wait.resume(),null);f.receive();assert.equal(f.wait.resume(),null);
 assert.equal(f.unsubscribed,1);assert.deepEqual(f.events,['subscribe','unsubscribe']);assert.deepEqual(f.b.errors,[]);
});

test('reentrant cast resumes cannot skip the initial yield or duplicate readiness',()=>{
 let f;f=castWaitFixture({frameCount:1,isCastActive:()=>{assert.equal(f.wait.resume(),null);return true;},
  onReady:()=>{assert.equal(f.wait.resume(),null);f.events.push('ready');}});
 f.wait.resume();f.wait.resume();assert.deepEqual(f.events,['subscribe','unsubscribe','ready']);
});

test('battle end inside event subscription immediately disposes the returned registration',()=>{
 let f,disposed=0;f=castWaitFixture({subscribeAttackEvent:()=>{f.b.emit('battleEnd',{});return()=>disposed++;}});
 assert.equal(f.wait.resume(),null);assert.equal(disposed,1);assert.equal(f.wait.resume(),null);assert.deepEqual(f.events,[]);
});

test('bounded cast readiness can create one independent flight which survives later owner removal',()=>{
 const f=fixture();f.source.base.atk=175;f.source.markDirty();f.target.nativeUid=1;
 const source=fearProjectileSourceReference(f.b,f.source),damage=fearProjectileDamageAction(f.b,source);
 let flight,births=0;
 const wait=fearProjectileAttackWait(f.b,{owner:f.source,cachedDurationRaw:fpOne,readDeltaPlayTime:()=>1,isCastActive:()=>true,
  subscribeAttackEvent:()=>()=>{},onReady:()=>{
   births++;
   flight=fearProjectileFlight(f.b,{from:{x:0,y:0,z:0},initialTarget:{x:1,y:0,z:0},
    resolveTargetPosition:()=>null,resolveTraceTarget:()=>f.target,
    area:{queryOverlaps:()=>[f.target],resolveEntity:u=>u,readUid:u=>u.nativeUid,
     isCandidate:()=>true,verifyTarget:()=>true,deterministic:true,resolveSource:source.resolveSource,onSelected:()=>{}},
    runHit:({target})=>applyFearProjectileImpact(f.b,{source:f.source,target,applyAttachments:()=>{},runActions:damage}),
    onStopped:()=>{},scheduleCompletion:()=>()=>{}});
  }});
 wait.resume();assert.equal(flight,undefined);wait.resume();assert.equal(births,1);
 f.b.kill(f.source,null);const hp=f.target.hp;flight.advance(fpOne/10n,fpOne);
 assert.equal(hp-f.target.hp,175);assert.ok(f.target.findBuff(parentKey));assert.equal(wait.resume(),null);
 assert.equal(births,1);flight.release();source.release();assert.deepEqual(f.b.errors,[]);
});

test('enemy arrival query includes the configured ally and neutral layers',()=>{
 const layerIndices={ALLY:8,ENEMY:9,NEUTRAL:28};
 assert.deepEqual(fearProjectileArrivalLayerMask({sourceSide:2,layerIndices}),{sideMask:5,layerMask:(1<<8)|(1<<28)});
 for(const sourceSide of [0,1,4])assert.deepEqual(fearProjectileArrivalLayerMask({sourceSide,layerIndices}),{sideMask:2,layerMask:1<<9});
 // Opposite-side lookup tests equality with single bits, not set membership.
 for(const sourceSide of [3,5,6,7,8,-1])assert.deepEqual(fearProjectileArrivalLayerMask({sourceSide,layerIndices}),{sideMask:0,layerMask:0});
});

test('arrival mask uses supplied layer layout and signed Int32 bit shifts',()=>{
 assert.deepEqual(fearProjectileArrivalLayerMask({sourceSide:2,layerIndices:{ALLY:31,ENEMY:1,NEUTRAL:0}}),
  {sideMask:5,layerMask:-2147483647});
 for(const layerIndices of [undefined,{ALLY:-1,ENEMY:9,NEUTRAL:28},{ALLY:8,ENEMY:32,NEUTRAL:28}])
  assert.throws(()=>fearProjectileArrivalLayerMask({sourceSide:2,layerIndices}),/actual named/);
 assert.throws(()=>fearProjectileArrivalLayerMask({sourceSide:undefined,layerIndices:{ALLY:8,ENEMY:9,NEUTRAL:28}}),/native Int32/);
});

test('selected arrival mask reproduces original Windows ally and neutral layer bits',()=>{
 const settings=read('data/candidates/arkpedia-windows-physics-settings-source.json');
 assert.deepEqual(fearProjectileArrivalLayerMask({sourceSide:2,layerIndices:settings.layerIndices}),
  {sideMask:5,layerMask:268436480});
 const owner=read('data/candidates/arkpedia-windows-fear-area-source.json').minerColliderOwnership;
 assert.equal(JSON.parse(owner.geometry.root.originalJson).m_Layer,settings.layerIndices.NEUTRAL);
 assert.equal(JSON.parse(owner.geometry.collisionHolder.originalJson).m_Layer,settings.layerIndices.ENEMY_COLLIDER);
 // Matching static indices do not establish CN runtime settings or world size.
 assert.equal(settings.crossVersionParity,false);assert.equal(owner.physicsOverlapParity,false);
});

test('arrival area query can use the explicit layer mask without losing neutral recipients',()=>{
 const f=fixture(),layerIndices={ALLY:8,ENEMY:9,NEUTRAL:28};f.target.nativeUid=1;
 const {layerMask}=fearProjectileArrivalLayerMask({sourceSide:2,layerIndices});
 const other={nativeUid:2,deploySeq:2},enemy={nativeUid:3,deploySeq:3},hits=[];
 const colliders=[{unit:f.target,layer:28},{unit:other,layer:8},{unit:enemy,layer:9}];
 const area=areaFixture(f,[],{queryOverlaps:()=>colliders.filter(c=>((1<<c.layer)&layerMask)!==0),
  hitTarget:unit=>{hits.push(unit);return true;}});
 assert.deepEqual(area.deliver(),{selected:2,attempted:2,hits:2});assert.deepEqual(hits,[f.target,other]);
});

test('source motion uses current native motion while alive-or-dying and captured motion afterward',()=>{
 const f=fixture(),ref=fearProjectileEntityReference(f.b,f.source);let motion=1,valid=true;
 const snapshot=fearProjectileSourceMotion(f.b,{source:f.source,resolveSource:ref.resolveEntity,
  readMotionMode:()=>motion,isValidAndAliveOrDying:()=>valid});
 assert.equal(snapshot.capturedMotionMode,1);motion=0;assert.equal(snapshot.readSourceMotionMode(),0);
 // Merely setting local alive=false does not substitute for the native predicate.
 f.source.alive=false;assert.equal(snapshot.readSourceMotionMode(),0);
 valid=false;assert.equal(snapshot.readSourceMotionMode(),1);motion=2;assert.equal(snapshot.readSourceMotionMode(),1);
 f.source.deploySeq++;assert.equal(snapshot.readSourceMotionMode(),1);ref.release();snapshot.release();
});

test('missing source snapshot yields native fallback motion2 without reading another entity',()=>{
 const f=fixture();const snapshot=fearProjectileSourceMotion(f.b,{source:null,resolveSource:()=>null,
  readMotionMode:()=>{throw Error('no source');},isValidAndAliveOrDying:()=>{throw Error('no source');}});
 assert.equal(snapshot.readSourceMotionMode(),2);snapshot.release();assert.equal(snapshot.readSourceMotionMode(),null);
});

for(const boundary of ['reuse','removed','battleEnd'])test('source motion lookup rejects '+boundary+' during the native motion read',()=>{
 const f=fixture(),ref=fearProjectileEntityReference(f.b,f.source);let armed=false;
 const snapshot=fearProjectileSourceMotion(f.b,{source:f.source,resolveSource:ref.resolveEntity,
  isValidAndAliveOrDying:()=>true,readMotionMode:()=>{
   if(armed){if(boundary==='reuse')f.source.deploySeq++;else if(boundary==='removed')f.b.emit('removed',{unit:f.source});else f.b.emit('battleEnd',{});}
   return armed?0:1;
  }});
 armed=true;assert.equal(snapshot.readSourceMotionMode(),null);
 assert.equal(snapshot.readSourceMotionMode(),boundary==='battleEnd'?null:1);snapshot.release();ref.release();assert.deepEqual(f.b.errors,[]);
});

test('source motion cannot use a replacement resolved between validity and the live read',()=>{
 const f=fixture();let replacement=false,reads=0;
 const snapshot=fearProjectileSourceMotion(f.b,{source:f.source,resolveSource:()=>replacement?f.target:f.source,
  readMotionMode:()=>{reads++;return 1;},isValidAndAliveOrDying:()=>{replacement=true;return true;}});
 assert.equal(snapshot.readSourceMotionMode(),null);assert.equal(reads,1);
 assert.equal(snapshot.readSourceMotionMode(),1);snapshot.release();
});

test('arrival eligibility consumes the source motion snapshot after its source becomes invalid',()=>{
 const f=fixture();let motion=1,valid=true,seen=[];
 const snapshot=fearProjectileSourceMotion(f.b,{source:f.source,resolveSource:()=>f.source,
  readMotionMode:()=>motion,isValidAndAliveOrDying:()=>valid});
 const verifier=fearProjectileTargetVerifier(f.b,{sourceSide:2,readMotionMode:()=>0,readCategory:()=>1,readSide:()=>1,
  isTargetFree:()=>false,isAllyTargetFree:()=>false,readSourceMotionMode:snapshot.readSourceMotionMode,
  isStillMotionTargetFree:(_target,{sourceMotion})=>{seen.push(sourceMotion);return sourceMotion!==0;}});
 motion=0;assert.equal(verifier.verifyTarget(f.target),true);
 valid=false;assert.equal(verifier.verifyTarget(f.target),false);assert.deepEqual(seen,[0,1]);
 verifier.release();snapshot.release();
});

function targetVerifierFixture(overrides={}){
 const f=fixture(),calls=[];
 const verifier=fearProjectileTargetVerifier(f.b,{sourceSide:2,
  readMotionMode:()=>{calls.push('motion');return 0;},readCategory:()=>{calls.push('category');return 1;},
  readSide:()=>{calls.push('side');return 1;},isTargetFree:()=>{calls.push('free');return false;},
  isAllyTargetFree:()=>{calls.push('allyFree');return false;},
  readSourceMotionMode:()=>{calls.push('sourceMotion');return 1;},
  isStillMotionTargetFree:(_target,args)=>{calls.push(args);return false;},...overrides});
 return{...f,verifier,calls};
}

test('selected arrival verifier evaluates motion/category then source-relative target-free rules',()=>{
 const f=targetVerifierFixture();assert.equal(f.verifier.verifyTarget(f.target),true);
 assert.deepEqual(f.calls,['motion','category','side','free','sourceMotion',{flags:44,combo:2,sourceMotion:1},'allyFree']);
 f.verifier.release();assert.equal(f.verifier.verifyTarget(f.target),false);
});
for(const [key,value]of [['readMotionMode',1],['readMotionMode',2],['readCategory',0],['isTargetFree',true],['isStillMotionTargetFree',true]])
test('selected arrival verifier rejects '+key+'='+value,()=>{
 const f=targetVerifierFixture({[key]:()=>value});assert.equal(f.verifier.verifyTarget(f.target),false);f.verifier.release();
});

test('ally-target-free rejects the same side but does not reject another side',()=>{
 const same=targetVerifierFixture({readSide:()=>2,isAllyTargetFree:()=>true});
 assert.equal(same.verifier.verifyTarget(same.target),false);
 assert.equal(same.calls.includes('free'),false);assert.equal(same.calls.includes('sourceMotion'),false);same.verifier.release();
 const other=targetVerifierFixture({isAllyTargetFree:()=>true});assert.equal(other.verifier.verifyTarget(other.target),true);other.verifier.release();
});

test('native source-side zero skips source-relative advanced free gates',()=>{
 const f=targetVerifierFixture({sourceSide:0,isTargetFree:()=>{throw Error('unreached');},
  isAllyTargetFree:()=>{throw Error('unreached');}});
 assert.equal(f.verifier.verifyTarget(f.target),true);assert.deepEqual(f.calls,['motion','category']);f.verifier.release();
});

test('target verifier rejects missing native state values instead of treating them as targetable',()=>{
 for(const key of ['readMotionMode','readCategory','readSide','readSourceMotionMode','isTargetFree','isAllyTargetFree','isStillMotionTargetFree']){
  const f=targetVerifierFixture({[key]:()=>undefined});assert.throws(()=>f.verifier.verifyTarget(f.target),/native/);f.verifier.release();
 }
});

for(const boundary of ['reuse','battleEnd','recursive'])test('target verification guards '+boundary+' during a native reader',()=>{
 let f;f=targetVerifierFixture({isTargetFree:()=>{
  if(boundary==='reuse')f.target.deploySeq++;
  else if(boundary==='battleEnd')f.b.emit('battleEnd',{});
  else assert.equal(f.verifier.verifyTarget(f.target),false);
  return false;
 }});
 assert.equal(f.verifier.verifyTarget(f.target),boundary==='recursive');f.verifier.release();assert.deepEqual(f.b.errors,[]);
});

test('area delivery uses the selected verifier after source retirement without skipping its captured side rules',()=>{
 let blocked=false;const f=targetVerifierFixture({isTargetFree:()=>blocked});f.target.nativeUid=1;
 f.b.kill(f.source,null);let hits=0;
 const area=areaFixture(f,[f.target],{verifyTarget:f.verifier.verifyTarget,resolveSource:()=>null,
  hitTarget:()=>{hits++;return true;}});
 blocked=true;assert.deepEqual(area.deliver(),{selected:0,attempted:0,hits:0});assert.equal(hits,0);
 assert.equal(f.verifier.verifyTarget(f.target),false);blocked=false;assert.equal(f.verifier.verifyTarget(f.target),true);
 f.verifier.release();
});

function flightFixture(overrides={}){
 const f=fixture(),events=[];let completion=null,cancellations=0;
 f.target.nativeUid=1;
 const options={from:{x:0,y:0,z:0},initialTarget:{x:1,y:0,z:0},
  resolveTargetPosition:()=>{events.push('position');return{x:1,y:0,z:0};},resolveTraceTarget:()=>f.target,
  area:{queryOverlaps:()=>{events.push('query');return[f.target];},resolveEntity:u=>u,readUid:u=>u.nativeUid,
   isCandidate:()=>true,verifyTarget:()=>true,deterministic:true,resolveSource:()=>f.source,
   onSelected:()=>events.push('selected')},
  runHit:({forced})=>events.push(forced?'forced':'hit'),onStopped:()=>events.push('stop'),
  scheduleCompletion:callback=>{events.push('schedule');completion=callback;return()=>{cancellations++;};},...overrides};
 const flight=fearProjectileFlight(f.b,options);
 return{...f,flight,events,complete:()=>completion?.(),get cancellations(){return cancellations;}};
}

test('flight composes movement, one arrival and trace clearing before deferred completion',()=>{
 const f=flightFixture(),result=f.flight.advance(fpOne/10n,fpOne);
 assert.deepEqual(result.motion,{x:1,y:0,z:0,reached:true});
 assert.deepEqual(result.delivery,{selected:1,attempted:1,hits:1});
 assert.deepEqual(f.events,['position','query','selected','hit','schedule']);
 assert.equal(f.flight.ended,false);assert.equal(f.flight.reached,true);assert.equal(f.flight.traceCleared,true);
 assert.equal(f.flight.elapsedRaw,10n*fpOne);assert.equal(f.flight.count,1);
 assert.equal(f.complete(),true);assert.equal(f.complete(),false);assert.equal(f.flight.stop(),false);
 assert.equal(f.cancellations,1);assert.deepEqual(f.events,['position','query','selected','hit','schedule','stop']);
});

test('arrival lifetime reset lets the next expiry win without another area or forced trace hit',()=>{
 const f=flightFixture();f.flight.advance(fpOne/10n,fpOne);
 assert.equal(f.flight.advance(0n,fpOne).expired,true);assert.equal(f.flight.ended,true);
 assert.equal(f.complete(),false);assert.equal(f.flight.count,1);assert.equal(f.cancellations,1);
 assert.equal(f.events.filter(e=>e==='query').length,1);assert.equal(f.events.includes('forced'),false);
});

test('flight expiry precedes movement and forces only the saved trace recipient',()=>{
 const f=flightFixture();const result=f.flight.advance(10n*fpOne,fpOne);
 assert.equal(result.expired,true);assert.equal(f.flight.reached,false);assert.equal(f.flight.traceCleared,false);
 assert.deepEqual(f.events,['forced','stop']);assert.deepEqual(f.flight.position,{x:0,y:0,z:0});
 assert.equal(f.flight.advance(fpOne,fpOne),null);assert.equal(f.flight.count,1);
});

test('eliminating a flight suppresses terminal damage and does not synthesize arrival',()=>{
 const f=flightFixture();assert.equal(f.flight.stop({eliminated:true}),true);
 assert.deepEqual(f.events,['stop']);assert.equal(f.flight.count,0);assert.equal(f.flight.ended,true);
});

test('battle end cancels pending flight completion and all later callbacks',()=>{
 const f=flightFixture();f.flight.advance(fpOne/10n,fpOne);f.b.emit('battleEnd',{});
 assert.equal(f.cancellations,1);assert.equal(f.complete(),false);assert.equal(f.flight.advance(fpOne,fpOne),null);
 assert.equal(f.events.includes('stop'),false);assert.equal(f.flight.ended,true);assert.deepEqual(f.b.errors,[]);
});

test('flight cancellation from the area query prevents hits, trace clearing and completion scheduling',()=>{
 const f=flightFixture();
 f.flight.release();assert.equal(f.flight.advance(fpOne/10n,fpOne),null);assert.deepEqual(f.events,[]);
 const g=fixture(),events=[];g.target.nativeUid=1;
 const flight=fearProjectileFlight(g.b,{from:{x:0,y:0,z:0},initialTarget:{x:1,y:0,z:0},
  resolveTargetPosition:()=>null,resolveTraceTarget:()=>g.target,
  area:{queryOverlaps:()=>{g.b.emit('battleEnd',{});return[g.target];},resolveEntity:u=>u,
   readUid:u=>u.nativeUid,isCandidate:()=>true,verifyTarget:()=>true,deterministic:true,
   resolveSource:()=>g.source,onSelected:()=>events.push('selected')},
  runHit:()=>events.push('hit'),onStopped:()=>events.push('stop'),scheduleCompletion:()=>{events.push('schedule');return()=>{};}});
 flight.advance(fpOne/10n,fpOne);assert.deepEqual(events,[]);assert.equal(flight.traceCleared,false);assert.equal(flight.ended,true);
});

test('recursive flight advancement and stopping cannot duplicate arrival or final output',()=>{
 let f;f=flightFixture({runHit:()=>{
  f.events.push('hit');assert.equal(f.flight.advance(fpOne,fpOne),null);
  assert.equal(f.flight.stop(),true);assert.equal(f.flight.stop(),false);
 }});
 f.flight.advance(fpOne/10n,fpOne);
 assert.deepEqual(f.events,['position','query','selected','hit','stop']);
 assert.equal(f.flight.count,1);assert.equal(f.flight.ended,true);assert.equal(f.flight.traceCleared,false);
});

test('selected flight rejects a same-stack completion scheduler and closes its lifecycle',()=>{
 const f=flightFixture({scheduleCompletion:callback=>{callback();return()=>{};}});
 assert.throws(()=>f.flight.advance(fpOne/10n,fpOne),/must defer/);
 assert.equal(f.flight.ended,true);assert.equal(f.flight.advance(fpOne,fpOne),null);assert.equal(f.events.includes('stop'),false);
});

test('native lifetime ensure sets signed remaining time without same-stack expiry',()=>{
 let expires=0;const clock=fearProjectileLifetime({isBattleActive:()=>true,onExpire:()=>expires++});
 clock.advance(fpOne,fpOne);assert.equal(clock.ensureLifeTime(2n*fpOne),true);
 assert.equal(clock.elapsedRaw,8n*fpOne);assert.equal(clock.advance(fpOne,fpOne).expired,false);
 assert.equal(clock.ensureLifeTime(0n),true);assert.equal(expires,0);
 assert.equal(clock.advance(0n,0n).expired,true);assert.equal(expires,1);assert.equal(clock.ensureLifeTime(fpOne),false);
 const wrap=fearProjectileLifetime({isBattleActive:()=>true,onExpire:()=>{}});
 wrap.ensureLifeTime(-(1n<<63n));assert.equal(wrap.elapsedRaw,BigInt.asIntN(64,10n*fpOne+(1n<<63n)));
});

test('flight arrival still afflicts and damages once after its launch source retires',()=>{
 const f=fixture();f.source.base.atk=175;f.source.markDirty();f.target.nativeUid=1;
 const source=fearProjectileSourceReference(f.b,f.source),trace=fearProjectileEntityReference(f.b,f.target);
 const damage=fearProjectileDamageAction(f.b,source);let completion,notifications=0;
 const flight=fearProjectileFlight(f.b,{from:{x:0,y:0,z:0},initialTarget:{x:1,y:0,z:0},
  resolveTargetPosition:()=>null,resolveTraceTarget:trace.resolveEntity,
  area:{queryOverlaps:()=>[f.target,f.target],resolveEntity:u=>u,readUid:u=>u.nativeUid,
   isCandidate:()=>true,verifyTarget:()=>true,deterministic:true,resolveSource:source.resolveSource,
   onSelected:()=>notifications++},
  runHit:({target})=>applyFearProjectileImpact(f.b,{source:f.source,target,applyAttachments:()=>{},runActions:damage}),
  onStopped:()=>{},scheduleCompletion:callback=>{completion=callback;return()=>{};}});
 f.b.kill(f.source,null);const hp=f.target.hp;
 flight.advance(fpOne/10n,fpOne);assert.equal(hp-f.target.hp,175);assert.ok(f.target.findBuff(parentKey));
 assert.equal(notifications,0);completion();assert.equal(flight.count,1);assert.equal(hp-f.target.hp,175);
 source.release();trace.release();assert.deepEqual(f.b.errors,[]);
});

test('lost trace reference preserves last position but cannot force-hit a recycled target',()=>{
 const f=fixture(),trace=fearProjectileEntityReference(f.b,f.target),mount=fearProjectileMountReference(f.b,f.target,()=>({x:1000,y:0,z:0}));
 let hits=0;const flight=fearProjectileFlight(f.b,{from:{x:0,y:0,z:0},initialTarget:{x:1000,y:0,z:0},
  resolveTargetPosition:mount.resolvePosition,resolveTraceTarget:trace.resolveEntity,
  area:{queryOverlaps:()=>[],resolveEntity:u=>u,readUid:()=>1,isCandidate:()=>true,
   verifyTarget:()=>true,deterministic:true,resolveSource:()=>null,onSelected:()=>{}},
  runHit:()=>hits++,onStopped:()=>{},scheduleCompletion:()=>()=>{}});
 f.target.deploySeq++;const step=flight.advance(fpOne,fpOne);assert.equal(step.motion.x,10);
 assert.equal(flight.advance(9n*fpOne,fpOne).expired,true);assert.equal(hits,0);
 trace.release();mount.release();assert.deepEqual(f.b.errors,[]);
});

test('lifetime ensure rejects reentrant clock mutations through the lifecycle reader',()=>{
 let clock;clock=fearProjectileLifetime({isBattleActive:()=>{
  assert.equal(clock.ensureLifeTime(0n),false);assert.equal(clock.advance(fpOne,fpOne),null);return true;
 },onExpire:()=>{}});
 assert.equal(clock.ensureLifeTime(fpOne),true);assert.equal(clock.elapsedRaw,9n*fpOne);
});
function areaFixture(f,units,overrides={}){
 return fearProjectileAreaDelivery(f.b,{queryOverlaps:()=>units.map(unit=>({unit})),resolveEntity:c=>c.unit,
  readUid:u=>u.nativeUid,isCandidate:()=>true,verifyTarget:()=>true,deterministic:true,
  resolveSource:()=>f.source,onSelected:()=>{},hitTarget:()=>true,...overrides});
}
test('area query deduplicates collider entities and truncates physics order before UID sorting',()=>{
 const f=fixture(),units=Array.from({length:130},(_,i)=>({nativeUid:500-i,deploySeq:i}));
 const colliders=units.flatMap(u=>[u,u]);const hits=[],selected=[];let verifies=0;
 const area=areaFixture(f,colliders,{verifyTarget:()=>{verifies++;return true;},
  onSelected:e=>selected.push(e.count),hitTarget:u=>{hits.push(u.nativeUid);return true;}});
 assert.deepEqual(area.deliver(),{selected:128,attempted:128,hits:128});
 assert.equal(verifies,128);assert.deepEqual(selected,[128]);
 assert.deepEqual(hits,units.slice(0,128).map(u=>u.nativeUid).sort((a,b)=>a-b));
 assert.equal(hits.includes(371),false);assert.equal(hits.includes(372),false);assert.equal(area.deliver(),null);
});

test('non-deterministic area dispatch keeps supplied collider order',()=>{
 const f=fixture(),hits=[],units=[3,1,2].map(id=>({nativeUid:id,deploySeq:id}));
 const area=areaFixture(f,units,{deterministic:false,hitTarget:u=>{hits.push(u.nativeUid);return true;}});
 area.deliver();assert.deepEqual(hits,[3,1,2]);
});

test('area admits an identity only after validity and target-option verification',()=>{
 const f=fixture(),rejected={nativeUid:1,deploySeq:1},retry={nativeUid:2,deploySeq:2},hits=[];let verifies=0;
 const area=areaFixture(f,[rejected,retry,retry],{isCandidate:u=>u!==rejected,
  verifyTarget:()=>++verifies===2,hitTarget:u=>{hits.push(u.nativeUid);return true;}});
 assert.deepEqual(area.deliver(),{selected:1,attempted:1,hits:1});assert.equal(verifies,2);assert.deepEqual(hits,[2]);
});

test('source notification precedes hits and cannot redirect captured recipients to recycled lives',()=>{
 const f=fixture(),units=[1,2].map(id=>({nativeUid:id,deploySeq:id})),events=[];
 const area=areaFixture(f,units,{onSelected:({count})=>{events.push('selected:'+count);units[0].deploySeq++;units[0].nativeUid=99;},
  hitTarget:u=>{events.push('hit:'+u.nativeUid);return true;}});
 assert.deepEqual(area.deliver(),{selected:2,attempted:1,hits:1});assert.deepEqual(events,['selected:2','hit:2']);
});

test('area still dispatches found targets after the born source reference retires',()=>{
 const f=fixture(),u={nativeUid:1,deploySeq:1};let notified=0,hits=0;
 const area=areaFixture(f,[u],{resolveSource:()=>null,onSelected:()=>notified++,hitTarget:()=>{hits++;return true;}});
 area.deliver();assert.equal(notified,0);assert.equal(hits,1);
});

test('battle end while stabilizing a query result prevents later collider and hit callbacks',()=>{
 const f=fixture(),units=[1,2].map(id=>({nativeUid:id,deploySeq:id}));let reads=0,resolves=0,hits=0;
 const area=areaFixture(f,units,{resolveEntity:c=>{resolves++;return c.unit;},
  readUid:u=>{if(++reads===2)f.b.emit('battleEnd',{});return u.nativeUid;},hitTarget:()=>{hits++;return true;}});
 assert.equal(area.deliver(),null);assert.equal(resolves,1);assert.equal(hits,0);assert.deepEqual(f.b.errors,[]);
});

test('reentrant area calls cannot repeat the selected notification or impacts',()=>{
 const f=fixture(),u={nativeUid:1,deploySeq:1};let area,hits=0,notified=0;
 area=areaFixture(f,[u],{onSelected:()=>{notified++;assert.equal(area.deliver(),null);},
  hitTarget:()=>{hits++;assert.equal(area.deliver(),null);return true;}});
 area.deliver();assert.equal(hits,1);assert.equal(notified,1);
});

test('area-to-ledger composition applies one affliction/damage receipt despite duplicate colliders and stop',()=>{
 const f=fixture();f.target.nativeUid=123;f.source.base.atk=175;f.source.markDirty();
 const source=fearProjectileSourceReference(f.b,f.source),target=fearProjectileEntityReference(f.b,f.target);
 const damage=fearProjectileDamageAction(f.b,source);
 const ledger=fearProjectileHitLedger(f.b,{resolveTraceTarget:target.resolveEntity,
  runHit:({target})=>applyFearProjectileImpact(f.b,{source:f.source,target,applyAttachments:()=>{},runActions:damage}),onStopped:()=>{}});
 const area=areaFixture(f,[f.target,f.target],{resolveSource:source.resolveSource,hitTarget:ledger.hit});
 f.b.kill(f.source,null);const hp=f.target.hp;
 assert.deepEqual(area.deliver(),{selected:1,attempted:1,hits:1});ledger.stop();
 assert.equal(hp-f.target.hp,175);assert.equal(ledger.count,1);assert.ok(f.target.findBuff(parentKey));
 assert.deepEqual(f.b.errors,[]);source.release();target.release();
});

test('native clock expires at the Q32.32 boundary rather than rounded float seconds',()=>{
 let expires=0;const clock=fearProjectileLifetime({isBattleActive:()=>true,onExpire:()=>expires++});
 assert.equal(clock.elapsedRaw,0n);
 assert.equal(clock.advance(5n*fpOne-1n,fpOne).expired,false);
 assert.equal(clock.advance(5n*fpOne,fpOne).expired,false);
 assert.equal(clock.elapsedRaw,10n*fpOne-1n);assert.equal(expires,0);
 const final=clock.advance(1n,fpOne);assert.equal(final.expired,true);assert.equal(expires,1);
 assert.equal(final.elapsedRaw,10n*fpOne);assert.equal('effectiveDt' in final,false);
 assert.equal(clock.advance(fpOne,fpOne),null);assert.equal(expires,1);
});

test('movement scale affects lifetime and motion delta through fixed-point multiplication',()=>{
 const clock=fearProjectileLifetime({isBattleActive:()=>true,onExpire:()=>{}});
 const paused=clock.advance(fpOne,0n);assert.equal(paused.elapsedRaw,0n);assert.equal(paused.effectiveDt,0);
 const slow=clock.advance(fpOne,fpOne/2n);assert.equal(slow.elapsedRaw,fpOne/2n);assert.equal(slow.effectiveDt,.5);
 for(let i=0;i<9;i++)assert.equal(clock.advance(fpOne,fpOne).expired,false);
 assert.equal(clock.advance(fpOne,fpOne/2n).expired,true);
});

test('Q32.32 multiply truncates fractional raw bits and wraps signed64 arithmetic',()=>{
 const clock=fearProjectileLifetime({isBattleActive:()=>true,onExpire:()=>{}});
 assert.equal(clock.advance(1n,fpOne/2n).deltaRaw,0n);
 const wrapped=clock.advance((1n<<63n)-1n,2n*fpOne);
 assert.equal(wrapped.deltaRaw,-2n);assert.equal(wrapped.elapsedRaw,-2n);
 assert.equal(wrapped.effectiveDt,-(2**-31));clock.release();
});

test('raw signed64 to float32 conversion avoids double rounding at a halfway boundary',()=>{
 const clock=fearProjectileLifetime({isBattleActive:()=>true,onExpire:()=>{}});
 const raw=-((1n<<62n)+(1n<<38n)+1n),step=clock.advance(raw,fpOne);
 assert.equal(step.effectiveDt,-1073741952);
 assert.notEqual(step.effectiveDt,Math.fround(Number(raw)*2**-32));clock.release();
});

test('clock rejects non-raw inputs and prevents recursive or post-end expiry callbacks',()=>{
 let clock,active=true,recursive,expires=0;
 clock=fearProjectileLifetime({isBattleActive:()=>{recursive=clock.advance(fpOne,fpOne);return active;},
  onExpire:()=>{expires++;assert.equal(clock.advance(fpOne,fpOne),null);}});
 assert.throws(()=>clock.advance(1,fpOne),/Q32/);assert.throws(()=>clock.advance(1n<<63n,fpOne),/Q32/);
 assert.equal(clock.advance(10n*fpOne,fpOne).expired,true);assert.equal(recursive,null);assert.equal(expires,1);
 active=false;assert.equal(clock.advance(fpOne,fpOne),null);
});

test('clock lifecycle cancellation is permanent and expiry exceptions cannot repeat stop dispatch',()=>{
 let active=false,expires=0;
 const cancelled=fearProjectileLifetime({isBattleActive:()=>active,onExpire:()=>expires++});
 assert.equal(cancelled.advance(fpOne,fpOne),null);active=true;
 assert.equal(cancelled.advance(10n*fpOne,fpOne),null);assert.equal(cancelled.elapsedRaw,0n);
 const failed=fearProjectileLifetime({isBattleActive:()=>true,onExpire:()=>{expires++;throw Error('stop callback');}});
 assert.throws(()=>failed.advance(10n*fpOne,fpOne),/stop callback/);
 assert.equal(failed.advance(fpOne,fpOne),null);assert.equal(expires,1);
});

test('lifetime expiry stops before movement and applies only the final saved-target hit',()=>{
 const f=fixture();f.source.base.atk=125;f.source.markDirty();
 const source=fearProjectileSourceReference(f.b,f.source),target=fearProjectileEntityReference(f.b,f.target);
 const damage=fearProjectileDamageAction(f.b,source);let moves=0,arrivals=0,stops=0;
 const ledger=fearProjectileHitLedger(f.b,{resolveTraceTarget:target.resolveEntity,
  runHit:({target})=>applyFearProjectileImpact(f.b,{source:f.source,target,applyAttachments:()=>{},runActions:damage}),
  onStopped:()=>stops++});
 const trace=fearProjectileTraceMotion({from:{x:0,y:0,z:1},initialTarget:{x:1000,y:0,z:1},
  resolveTargetPosition:()=>null,isBattleActive:source.isBattleActive});
 const clock=fearProjectileLifetime({isBattleActive:source.isBattleActive,onExpire:()=>ledger.stop()});
 f.b.kill(f.source,null);const hp=f.target.hp;
 for(let i=0;i<10;i++){
  const step=clock.advance(fpOne,fpOne);
  if(!step.expired){moves++;if(trace.advance(step.effectiveDt)?.reached)arrivals++;}
 }
 assert.equal(moves,9);assert.equal(arrivals,0);assert.equal(stops,1);assert.equal(ledger.count,1);
 assert.equal(trace.position.x,90);assert.equal(hp-f.target.hp,125);assert.deepEqual(f.b.errors,[]);
 trace.release();target.release();source.release();
});

test('forced trace hit bypasses the 128 normal-hit cap once without an area-arrival dispatch',()=>{
 const f=fixture(),trace={deploySeq:999},hits=[];let stops=0;
 const ledger=fearProjectileHitLedger(f.b,{runHit:event=>hits.push(event),resolveTraceTarget:()=>trace,onStopped:()=>stops++});
 for(let i=0;i<128;i++)assert.equal(ledger.hit({deploySeq:i}),true);
 assert.equal(ledger.count,128);assert.equal(ledger.stop(),true);
 assert.equal(ledger.count,129);assert.equal(hits.at(-1).target,trace);assert.equal(hits.at(-1).forced,true);
 assert.equal(stops,1);assert.equal(ledger.stop(),false);assert.equal(ledger.hitTraceTarget(),false);
});

test('normal cap rejection still reserves an identity before the forced-hit path checks it',()=>{
 const f=fixture(),trace={deploySeq:999};let hits=0;
 const ledger=fearProjectileHitLedger(f.b,{runHit:()=>hits++,resolveTraceTarget:()=>trace,onStopped:()=>{}});
 for(let i=0;i<128;i++)ledger.hit({deploySeq:i});
 assert.equal(ledger.hit(trace),false);assert.equal(ledger.hitTraceTarget(),false);
 assert.equal(ledger.hasHitTraceTarget,true);assert.equal(ledger.count,128);assert.equal(hits,128);
 ledger.stop();
});

test('hit reservation precedes callbacks while the hit count increments after they return',()=>{
 const f=fixture(),target={deploySeq:1};let ledger,recursive,countDuring;
 ledger=fearProjectileHitLedger(f.b,{runHit:()=>{countDuring=ledger.count;recursive=ledger.hit(target);},
  resolveTraceTarget:()=>target,onStopped:()=>{}});
 assert.equal(ledger.hit(target),true);assert.equal(recursive,false);assert.equal(countDuring,0);assert.equal(ledger.count,1);
 assert.equal(ledger.hitTraceTarget(),false,'normal arrival must not be repeated as a terminal trace hit');
 target.deploySeq++;assert.equal(ledger.hit(target),true,'a replacement UID is a different normal-hit identity');
 assert.equal(ledger.count,2);ledger.release();
});

test('recursive stop from a hit callback cannot repeat final trace damage or stop actions',()=>{
 const f=fixture();let ledger,hits=0,stops=0;
 ledger=fearProjectileHitLedger(f.b,{runHit:()=>{hits++;ledger.stop();},resolveTraceTarget:()=>f.target,onStopped:()=>stops++});
 assert.equal(ledger.stop(),true);assert.equal(hits,1);assert.equal(stops,1);assert.equal(ledger.count,1);
});

test('eliminated projectiles run stop actions without inventing a final hit',()=>{
 const f=fixture();let hits=0,stops=0;
 const ledger=fearProjectileHitLedger(f.b,{runHit:()=>hits++,resolveTraceTarget:()=>f.target,onStopped:()=>stops++});
 ledger.stop({eliminated:true});assert.equal(hits,0);assert.equal(stops,1);assert.equal(ledger.hasHitTraceTarget,false);
});

test('battle end during trace resolution prevents both final damage and late stop actions',()=>{
 const f=fixture();let hits=0,stops=0;
 const ledger=fearProjectileHitLedger(f.b,{runHit:()=>hits++,resolveTraceTarget:()=>{f.b.emit('battleEnd',{});return f.target;},onStopped:()=>stops++});
 ledger.stop();assert.equal(hits,0);assert.equal(stops,0);assert.equal(ledger.count,0);assert.equal(ledger.hasHitTraceTarget,false);
});

test('terminal impact uses the live trace identity and cached source damage after source removal',()=>{
 const f=fixture();f.source.base.atk=125;f.source.markDirty();
 const source=fearProjectileSourceReference(f.b,f.source),target=fearProjectileEntityReference(f.b,f.target);
 const damage=fearProjectileDamageAction(f.b,source);let stopped=0;
 const ledger=fearProjectileHitLedger(f.b,{resolveTraceTarget:target.resolveEntity,
  runHit:({target})=>applyFearProjectileImpact(f.b,{source:f.source,target,applyAttachments:()=>{},runActions:damage}),
  onStopped:()=>{stopped++;target.release();source.release();}});
 f.b.kill(f.source,null);const hp=f.target.hp;ledger.stop();
 assert.equal(hp-f.target.hp,125);assert.ok(f.target.findBuff(parentKey));assert.equal(stopped,1);
 assert.equal(ledger.count,1);assert.deepEqual(f.b.errors,[]);
});

test('terminal impact never follows a recycled trace body',()=>{
 const f=fixture(),target=fearProjectileEntityReference(f.b,f.target);let hits=0;
 const ledger=fearProjectileHitLedger(f.b,{resolveTraceTarget:target.resolveEntity,runHit:()=>hits++,onStopped:target.release});
 f.target.deploySeq++;ledger.stop();assert.equal(hits,0);assert.equal(ledger.hasHitTraceTarget,false);
});

test('mount reference follows the same unretired entity life and copies supplied 3D coordinates',()=>{
 const f=fixture();let mount={x:1,y:2,z:3},reads=0;
 const ref=fearProjectileMountReference(f.b,f.target,()=>{reads++;return mount;});
 const first=ref.resolvePosition();assert.deepEqual(first,mount);first.x=999;
 f.target.hidden=true;f.target.alive=false;f.target.deployed=false;mount={x:4,y:5,z:6};
 assert.deepEqual(ref.resolvePosition(),mount,'visibility/combat flags do not replace ObjectPtr validity');
 f.target.deploySeq++;assert.equal(ref.resolvePosition(),null);assert.equal(reads,2);
 ref.release();assert.equal(ref.isBattleActive(),false);
});

for(const retire of ['removed','reuse','battleEnd'])test('mount reader '+retire+' reentrancy cannot return replacement coordinates',()=>{
 const f=fixture();const ref=fearProjectileMountReference(f.b,f.target,()=>{
  if(retire==='removed')f.b.kill(f.target,null);
  else if(retire==='reuse')f.target.deploySeq++;
  else f.b.emit('battleEnd',{});
  return undefined;
 });
 assert.equal(ref.resolvePosition(),null);assert.deepEqual(f.b.errors,[]);ref.release();
});

test('trace motion retains the last 3D destination after native reference retirement',()=>{
 const f=fixture();let mount={x:5,y:0,z:0};
 const ref=fearProjectileMountReference(f.b,f.target,()=>mount);
 const trace=fearProjectileTraceMotion({from:{x:0,y:0,z:0},initialTarget:ref.resolvePosition(),
  resolveTargetPosition:ref.resolvePosition,isBattleActive:ref.isBattleActive});
 assert.deepEqual(trace.advance(.1),{x:1,y:0,z:0,reached:false});
 mount={x:1,y:5,z:0};assert.deepEqual(trace.advance(.1),{x:1,y:1,z:0,reached:false});
 f.b.kill(f.target,null);f.target.deploySeq++;mount={x:999,y:999,z:999};
 assert.deepEqual(trace.advance(.1),{x:1,y:2,z:0,reached:false});
 assert.deepEqual(trace.destination,{x:1,y:5,z:0});
 const copy=trace.destination;copy.z=999;assert.equal(trace.destination.z,0);
 assert.equal(trace.advance(.3).reached,true);assert.equal(trace.advance(.1),null);
 trace.release();ref.release();
});

test('trace motion rejects recursive advancement and permanently retires on lifecycle end',()=>{
 let active=true,trace,recursive;
 trace=fearProjectileTraceMotion({from:{x:0,y:0,z:0},initialTarget:{x:5,y:0,z:0},
  resolveTargetPosition:()=>{recursive=trace.advance(.2);return{x:5,y:0,z:0};},isBattleActive:()=>active});
 assert.deepEqual(trace.advance(.1),{x:1,y:0,z:0,reached:false});assert.equal(recursive,null);
 active=false;assert.equal(trace.advance(.1),null);active=true;assert.equal(trace.advance(.1),null);
 assert.equal(trace.position.x,1);
});

test('trace release while resolving coordinates prevents a late movement commit',()=>{
 let trace;trace=fearProjectileTraceMotion({from:{x:0,y:0,z:0},initialTarget:{x:5,y:0,z:0},
  resolveTargetPosition:()=>{trace.release();return{x:999,y:0,z:0};},isBattleActive:()=>true});
 assert.equal(trace.advance(.1),null);assert.deepEqual(trace.position,{x:0,y:0,z:0});
});

test('trace lifecycle resolver cannot recursively advance before the position read',()=>{
 let trace,recursive,reads=0;
 trace=fearProjectileTraceMotion({from:{x:0,y:0,z:0},initialTarget:{x:5,y:0,z:0},
  resolveTargetPosition:()=>{reads++;return null;},isBattleActive:()=>{recursive=trace.advance(.2);return true;}});
 assert.deepEqual(trace.advance(.1),{x:1,y:0,z:0,reached:false});assert.equal(recursive,null);assert.equal(reads,1);
 trace.release();
});

test('battle end from a mount reader cancels shared-system movement before arrival',()=>{
 const f=fixture();let end=false,hits=0;
 const mount=fearProjectileMountReference(f.b,f.target,u=>{
  if(end){f.b.emit('battleEnd',{});return undefined;}
  return{x:u.x,y:u.y,z:.2};
 });
 const trace=fearProjectileTraceMotion({from:{x:f.source.x,y:f.source.y,z:.2},initialTarget:mount.resolvePosition(),
  resolveTargetPosition:mount.resolvePosition,isBattleActive:mount.isBattleActive});
 const initial=trace.position;
 f.b.addProjectile({from:initial,to:trace.destination,maxAge:10,advanceMotion:({dt})=>trace.advance(dt),onHit:()=>hits++});
 end=true;f.b.projectiles.update(.2);
 assert.equal(hits,0);assert.deepEqual(trace.position,initial);assert.equal(f.b.projectiles.list.length,0);
 assert.deepEqual(f.b.errors,[]);trace.release();mount.release();
});

test('shared projectile system carries reviewed trace motion and cached impact after source removal',()=>{
 const f=fixture();f.source.base.atk=200;f.source.markDirty();
 const sourceRef=fearProjectileSourceReference(f.b,f.source);
 const mount=fearProjectileMountReference(f.b,f.target,u=>({x:u.x,y:u.y,z:.2}));
 const trace=fearProjectileTraceMotion({from:{x:f.source.x,y:f.source.y,z:.2},initialTarget:mount.resolvePosition(),
  resolveTargetPosition:mount.resolvePosition,isBattleActive:sourceRef.isBattleActive});
 const damage=fearProjectileDamageAction(f.b,sourceRef);let hits=0;
 f.b.addProjectile({from:trace.position,to:trace.destination,source:f.source,maxAge:10,
  advanceMotion:({dt})=>trace.advance(dt),onHit:()=>{
   hits++;applyFearProjectileImpact(f.b,{source:f.source,target:f.target,applyAttachments:()=>{},runActions:damage});
   mount.release();trace.release();sourceRef.release();
  }});
 f.b.kill(f.source,null);const hp=f.target.hp;f.h.run(.3);
 assert.equal(hits,1);assert.equal(hp-f.target.hp,200);assert.ok(f.target.findBuff(parentKey));
 assert.equal(f.b.projectiles.list.length,0);f.h.run(.2);assert.equal(hits,1);assert.deepEqual(f.b.errors,[]);
});

test('selected speed-10 motion advances in three dimensions and snaps without overshoot',()=>{
 const origin={x:0,y:0,z:0};
 for(const axis of ['x','y','z']){
  const target={...origin,[axis]:5};
  assert.deepEqual(fearProjectileMotionStep(origin,target,.1),{...origin,[axis]:1,reached:false});
  assert.deepEqual(fearProjectileMotionStep(origin,target,1),{...target,reached:true});
  assert.deepEqual(target,{...origin,[axis]:5});
 }
 const diagonal=fearProjectileMotionStep(origin,{x:3,y:4,z:0},.1);
 assert.equal(diagonal.x,Math.fround(.6));
 // Native component*delta then *speed rounds twice: this is one ULP above
 // float32(0.8), which a combined distance multiplier would incorrectly return.
 assert.equal(diagonal.y,.8000000715255737);assert.equal(diagonal.z,0);
 assert.equal(diagonal.reached,false);assert.deepEqual(origin,{x:0,y:0,z:0});
});

test('motion uses the supplied current 3D destination and arrival tolerance after movement',()=>{
 const first=fearProjectileMotionStep({x:0,y:0,z:0},{x:5,y:0,z:0},.1);
 const second=fearProjectileMotionStep(first,{x:1,y:0,z:5},.1);
 assert.deepEqual(second,{x:1,y:0,z:1,reached:false});
 assert.deepEqual(fearProjectileMotionStep({x:0,y:0,z:0},{x:.09,y:0,z:0},0),{x:0,y:0,z:0,reached:true});
 assert.deepEqual(fearProjectileMotionStep({x:0,y:0,z:0},{x:0,y:0,z:0},0),{x:0,y:0,z:0,reached:true});
 for(const delta of [-1,NaN,Infinity])assert.throws(()=>fearProjectileMotionStep(first,second,delta));
 assert.throws(()=>fearProjectileMotionStep({x:0,y:0},{x:1,y:1,z:0},.1),/3D/);
});

test('native arrival includes the float32 0.1 boundary and checks all three mount-point axes',()=>{
 const zero={x:0,y:0,z:0},radius=Math.fround(.1),outside=Math.fround(radius+2**-27);
 const source=read('data/candidates/arkpedia-windows-fear-movement-source.json');
 assert.equal(source.arrivalTolerance.float32,radius);assert.equal(source.arrivalTolerance.dimensions,3);
 for(const axis of ['x','y','z']){
  assert.equal(fearProjectileReached(zero,{...zero,[axis]:radius}),true,axis+' inclusive');
  assert.equal(fearProjectileReached(zero,{...zero,[axis]:outside}),false,axis+' outside');
 }
 assert.equal(fearProjectileReached(zero,{x:.06,y:.06,z:.06}),false,'3D distance exceeds radius despite each axis fitting');
 assert.equal(fearProjectileReached({x:12,y:-3,z:4},{x:12.05,y:-3.05,z:4}),true);
 assert.equal(fearProjectileReached(zero,{x:0,y:0}),false,'missing mount-point height is not silently flattened');
 for(const value of [NaN,Infinity,-Infinity])assert.equal(fearProjectileReached(zero,{x:0,y:0,z:value}),false);
 assert.equal(fearProjectileReached(null,zero),false);
});
function fixture({marked=true,full=false,local=false}={}){
 const ref=read('data/candidates/arkpedia-stage-16-9-source.json').rawLevel.enemyDbRefs.find(r=>r.useDb===false);
 const targetRec=local?compileStageLocalEnemy(ref,{damageType:'PHYSIC'}):enemyRec({key:'recipient',maxHp:1000,atk:0,moveSpeed:0});
 const h=makeBattle({content:'generic',autoFinish:false,defs:{enemies:{source:enemyRec({key:'source',atk:0,moveSpeed:0}),[targetRec.key]:targetRec}}});
 h.b.start();const source=h.spawn('source',{pos:[10,6]}),target=h.spawn(targetRec.key,{pos:[10,7]});
 for(const u of [source,target]){u.profile.noAttack=true;u.base.moveSpeed=0;u.markDirty();}
 if(marked)h.b.addBuff(target,{key:'enemy_mcreep_self_mark',persist:true});
 target.hp=full?target.s.maxHp:target.s.maxHp/2;
 return{h,b:h.b,source,target,manager:fearProjectileAfflictions(h.b)};
}
function apply(f){const p=f.manager.apply(f.source,f.target);assert.ok(p);return p;}
function assertClean(f){assert.equal(f.target.findBuff(parentKey),null);assert.equal(f.target.buffs.some(b=>b.key.startsWith('ch16:fearpj:')),false);assert.deepEqual(f.b.errors,[]);}

test('born source reference captures preprocessing ATK but resolves later same-life ATK',()=>{
 const f=fixture();f.source.base.atk=200;f.source.markDirty();const ref=fearProjectileSourceReference(f.b,f.source);
 f.source.base.atk=325;f.source.markDirty();const hp=f.target.hp;
 fearProjectileDamageAction(f.b,ref)({target:f.target});assert.equal(ref.cachedAtk,200);assert.equal(hp-f.target.hp,325);
 ref.release();assert.equal(ref.resolveSource(),null);assert.deepEqual(f.b.errors,[]);
});

test('dead or inactive but unretired source keeps its same-life reference until removal',()=>{
 const f=fixture(),ref=fearProjectileSourceReference(f.b,f.source);
 f.source.alive=false;f.source.deployed=false;f.b.emit('death',{unit:f.source});
 assert.equal(ref.resolveSource(),f.source);f.b.emit('removed',{unit:f.source});assert.equal(ref.resolveSource(),null);
});

for(const retire of ['removed','reuse','battleEnd'])test('source reference '+retire+' preserves cached damage and rejects replacement stats',()=>{
 const f=fixture();f.source.base.atk=210;f.source.markDirty();const ref=fearProjectileSourceReference(f.b,f.source);
 if(retire==='removed')f.b.kill(f.source,null);else if(retire==='reuse')f.source.deploySeq++;else f.b.emit('battleEnd',{});
 f.source.base.atk=9999;f.source.markDirty();assert.equal(ref.resolveSource(),null);assert.equal(ref.cachedAtk,210);
 const hp=f.target.hp;fearProjectileDamageAction(f.b,ref)({target:f.target});
 assert.equal(hp-f.target.hp,retire==='battleEnd'?0:210);assert.deepEqual(f.b.errors,[]);
});

for(const retiredFirst of [false,true])test('source reference prevents post-battle cached output without affliction manager, retired='+retiredFirst,()=>{
 const h=makeBattle({content:'generic',autoFinish:false,defs:{enemies:{source:enemyRec({key:'source',atk:200,moveSpeed:0}),target:enemyRec({key:'target',maxHp:1000,moveSpeed:0})}}});
 h.b.start();const source=h.spawn('source',{pos:[10,6]}),target=h.spawn('target',{pos:[10,7]});
 const ref=fearProjectileSourceReference(h.b,source);assert.equal(h.b.chapter16FearAfflictions,undefined);
 if(retiredFirst)h.b.kill(source,null);
 h.b.emit('battleEnd',{});const hp=target.hp;fearProjectileDamageAction(h.b,ref)({target});
 assert.equal(target.hp,hp);assert.equal(ref.isBattleActive(),false);
});

test('impact damage reads the resolved source ATK after buff and attachment callbacks',()=>{
 const f=fixture(),hp=f.target.hp,damage=fearProjectileDamageAction(f.b,{cachedAtk:200,resolveSource:()=>f.source});
 applyFearProjectileImpact(f.b,{source:f.source,target:f.target,
  applyAttachments:()=>{f.b.addBuff(f.source,{key:'impact-atk',persist:true,mods:{atkFlat:350}});},runActions:damage});
 assert.equal(hp-f.target.hp,350);assert.deepEqual(f.b.errors,[]);
});

test('missing source reference uses the supplied preprocessed ATK without transferring damage credit',()=>{
 const f=fixture(),hp=f.target.hp,packets=[];
 f.b.on('damaged',c=>{if(c.target===f.target)packets.push(c);});
 const damage=fearProjectileDamageAction(f.b,{cachedAtk:225,resolveSource:()=>null});
 applyFearProjectileImpact(f.b,{source:f.source,target:f.target,applyAttachments:()=>{},runActions:damage});
 assert.equal(hp-f.target.hp,225);assert.equal(packets.length,1);assert.equal(packets[0].source,null);
 assert.deepEqual(f.b.errors,[]);
});

test('source alive flag alone does not override an explicit native-reference resolver',()=>{
 const f=fixture(),hp=f.target.hp;f.source.base.atk=175;f.source.markDirty();f.b.kill(f.source,null);
 const amount=f.source.s.atk,damage=fearProjectileDamageAction(f.b,{cachedAtk:999,resolveSource:()=>f.source});
 applyFearProjectileImpact(f.b,{source:f.source,target:f.target,applyAttachments:()=>{},runActions:damage});
 assert.equal(hp-f.target.hp,amount);assert.deepEqual(f.b.errors,[]);
});

test('reentrant source resolution cannot damage a replacement recipient life',()=>{
 const f=fixture(),hp=f.target.hp;
 const damage=fearProjectileDamageAction(f.b,{cachedAtk:225,resolveSource:()=>{f.target.deploySeq++;return null;}});
 damage({target:f.target});assert.equal(f.target.hp,hp);
 for(const cachedAtk of [-1,NaN,Infinity])assert.throws(()=>fearProjectileDamageAction(f.b,{cachedAtk,resolveSource:()=>null}),/requires/);
});

test('an ended battle rejects damage before invoking a source resolver',()=>{
 const f=fixture();f.b.emit('battleEnd',{});let calls=0;
 fearProjectileDamageAction(f.b,{cachedAtk:200,resolveSource:()=>{calls++;return f.source;}})({target:f.target});
 assert.equal(calls,0);assert.deepEqual(f.b.errors,[]);
});

test('impact runs the caller attachments and damage actions after Fear/Disarm admission',()=>{
 const f=fixture(),order=[],hp=f.target.hp;
 const ok=applyFearProjectileImpact(f.b,{source:f.source,target:f.target,
  applyAttachments:({target})=>{assert.equal(target.s.flags.disarm,true);assert.equal(target.s.flags.fear,true);order.push('attachments');},
  runActions:({source,target})=>{assert.equal(target.s.flags.disarm,true);order.push('damage');f.b.dealDamage(source,target,{amount:100,type:'arts',canDodge:false});}});
 assert.equal(ok,true);assert.deepEqual(order,['attachments','damage']);assert.equal(f.target.hp,hp-100);
 assert.deepEqual(f.b.errors,[]);
});

test('unmarked impact recipients still receive caller actions after the parent finishes',()=>{
 const f=fixture({marked:false});let count=0;
 assert.equal(applyFearProjectileImpact(f.b,{source:f.source,target:f.target,
  applyAttachments:()=>{count++;},runActions:()=>{count++;}}),true);
 assert.equal(count,2);assertClean(f);
});

for(const event of ['death','reuse','battleEnd'])test('impact '+event+' during buff admission prevents later output for that recipient life',()=>{
 const f=fixture();let calls=0;
 f.b.on('beforeBuff',c=>{if(c.unit!==f.target||c.buff.key!==parentKey)return;
  if(event==='death')f.b.kill(f.target,null);else if(event==='reuse')f.target.deploySeq++;else f.b.emit('battleEnd',{});});
 assert.equal(applyFearProjectileImpact(f.b,{source:f.source,target:f.target,
  applyAttachments:()=>calls++,runActions:()=>calls++}),false);
 assert.equal(calls,0);
});

test('impact revalidates the recipient after attachment callbacks before running damage actions',()=>{
 const f=fixture();let calls=0;
 assert.equal(applyFearProjectileImpact(f.b,{source:f.source,target:f.target,
  applyAttachments:()=>{f.target.deploySeq++;},runActions:()=>calls++}),false);
 assert.equal(calls,0);
});

test('a completed battle rejects later impacts even when the caller still holds live object references',()=>{
 const f=fixture();f.b.emit('battleEnd',{});let calls=0;
 assert.equal(applyFearProjectileImpact(f.b,{source:f.source,target:f.target,
  applyAttachments:()=>calls++,runActions:()=>calls++}),false);
 assert.equal(calls,0);assertClean(f);
});

test('born impact accepts an explicitly retained dead source and does not choose its damage packet',()=>{
 const f=fixture();f.b.kill(f.source,null);let actionSource;
 assert.equal(applyFearProjectileImpact(f.b,{source:f.source,target:f.target,
  applyAttachments:()=>{},runActions:({source})=>{actionSource=source;}}),true);
 assert.equal(actionSource,f.source);assert.equal(f.target.s.flags.disarm,true);
 assert.throws(()=>applyFearProjectileImpact(f.b,{source:f.source,target:f.target,runActions:()=>{}}),/explicit/);
});
test('affliction producer reproduces native graph, alias receipt and exact derived-buff action contract',()=>{
 const c=read('data/candidates/arkpedia-ch16-fear-affliction-contract.json');assert.equal(c.testOnly,true);assert.equal(c.frameParity,false);
 for(const row of Object.values(c.sources))assert.equal(createHash('sha256').update(readFileSync(new URL('../'+row.path,import.meta.url))).digest('hex'),row.sha256);
 assert.equal(c.defaults.interval,.5);assert.equal(c.defaults.fearDuration,999999);
 execFileSync(process.execPath,['tools/arkpedia/fear-affliction-contract.mjs','--check'],{stdio:'pipe'});
 assert.equal(read('data/candidates/arkpedia-ch16-enemy-support.json').enemies.enemy_10128_fearpj.policy,null);
 assert.equal(read('data/arkpedia-stages.json').stages.some(s=>s.code==='16-9'),false);
});
test('unmarked recipients finish the parent without fear or disarm',()=>{
 const f=fixture({marked:false});assert.equal(f.manager.apply(f.source,f.target),null);
 assert.equal(!!f.target.s.flags.fear,false);assert.equal(!!f.target.s.flags.disarm,false);assertClean(f);
});
test('marked injured recipient retains derived fear/disarm until the first full-HP sampled trigger',()=>{
 const f=fixture(),p=apply(f);assert.equal(p.children.length,2);assert.equal(f.target.s.flags.fear,true);assert.equal(f.target.s.flags.disarm,true);
 f.h.run(.3);f.b.heal(f.source,f.target,1e6);assert.equal(f.target.hp,f.target.s.maxHp);f.h.run(.1);assert.equal(p.active,true);
 f.h.run(.11);assert.equal(p.active,false);assert.equal(!!f.target.s.flags.fear,false);assert.equal(!!f.target.s.flags.disarm,false);assertClean(f);
});
test('initial full HP still waits for the first half-second parent trigger',()=>{
 const f=fixture({full:true}),p=apply(f);f.h.run(.4);assert.equal(p.active,true);f.h.run(.11);assert.equal(p.active,false);assertClean(f);
});
test('the literal16-9 miner rejects Fear through its actual immunity while derived Disarm remains owned',()=>{
 const f=fixture({local:true}),p=apply(f);assert.ok(f.target.def.immune.has('feared'));
 assert.equal(!!f.target.s.flags.fear,false);assert.equal(f.target.s.flags.disarm,true);assert.equal(p.children.length,1);
 f.b.heal(f.source,f.target,1e6);f.h.run(.51);assert.equal(!!f.target.s.flags.disarm,false);assertClean(f);
});
test('finishing one parent preserves unrelated fear and disarm status owners',()=>{
 const f=fixture();f.b.applyStatus(f.target,'fear',{key:'other-fear',duration:30,source:f.source});
 const other=f.b.addBuff(f.target,{key:'other-disarm',persist:true,flags:{disarm:true}}),p=apply(f);
 f.manager.finish(p);assertClean(f);assert.ok(f.target.findBuff('other-fear'));assert.ok(f.target.buffs.includes(other));
 assert.equal(f.target.s.flags.fear,true);assert.equal(f.target.s.flags.disarm,true);
});
test('parent replacement retires only its old children and resets its own half-second trigger',()=>{
 const f=fixture(),old=apply(f);f.h.run(.3);const next=apply(f);
 assert.equal(old.active,false);assert.ok(old.children.length===0);assert.equal(next.active,true);
 assert.equal(f.target.buffs.filter(b=>b.key===parentKey).length,1);assert.equal(f.target.buffs.filter(b=>b.key.startsWith('ch16:fearpj:')).length,2);
 f.b.heal(f.source,f.target,1e6);f.h.run(.3);assert.equal(next.active,true);f.h.run(.21);assert.equal(next.active,false);assertClean(f);
});
test('removing the miner mark after activation does not invent a periodic marker check',()=>{
 const f=fixture(),p=apply(f);f.b.removeBuff(f.target,'enemy_mcreep_self_mark');f.h.run(1.1);
 assert.equal(p.active,true);assert.equal(f.target.s.flags.fear,true);f.manager.finish(p);assertClean(f);
});
for(const control of ['stun','silence','freeze','sleep','levitate'])test('parent full-HP check is not paused by recipient '+control,()=>{
 const f=fixture(),p=apply(f);f.b.addBuff(f.target,{key:'control',persist:true,flags:{[control]:true}});
 f.target.hp=f.target.s.maxHp;f.h.run(.51);assert.equal(p.active,false);assertClean(f);
});
for(const invalid of ['sourceDeath','sourceReuse','recipientDeath','recipientReuse','recipientRemoved','battleEnd','parentRemoved','parentReplaced'])
test('derived ownership handles '+invalid+' without donating children or removing replacements',()=>{
 const f=fixture(),p=apply(f),original=p.source;
 if(invalid==='sourceDeath')f.b.kill(f.source,null);
 else if(invalid==='sourceReuse'){f.source.deploySeq++;f.source.stats={...f.source.stats};}
 else if(invalid==='recipientDeath')f.b.kill(f.target,null);
 else if(invalid==='recipientReuse')f.target.deploySeq++;
 else if(invalid==='recipientRemoved'){f.target.deployed=false;f.b.emit('removed',{unit:f.target});}
 else if(invalid==='battleEnd')f.b.emit('battleEnd',{});
 else if(invalid==='parentRemoved')f.b.removeBuff(f.target,p.parent);
 else f.b.addBuff(f.target,{key:parentKey,persist:true});
 f.h.run(.6);
 if(invalid.startsWith('source')){
  assert.equal(p.active,true);assert.equal(p.source,original);assert.notEqual(p.source,f.source);assert.equal(f.target.s.flags.disarm,true);f.manager.finish(p);assertClean(f);
 }else{
  assert.equal(p.active,false);
  if(invalid==='parentReplaced'){assert.ok(f.target.findBuff(parentKey));assert.equal(f.target.buffs.some(b=>b.key.startsWith('ch16:fearpj:')),false);}
  else assertClean(f);
 }
 assert.deepEqual(f.b.errors,[]);
});
for(const reject of ['parent','fear','disarm'])test('rejected '+reject+' never creates orphan derived output',()=>{
 const f=fixture();f.b.on('beforeBuff',c=>{if(reject==='parent'?c.buff.key===parentKey:c.buff.key.startsWith(`ch16:fearpj:${reject}:`))c.cancel=true;});
 const p=f.manager.apply(f.source,f.target);
 if(reject==='parent'){assert.equal(p,null);assertClean(f);}else{assert.ok(p);assert.equal(p.children.length,1);f.manager.finish(p);assertClean(f);}
});
for(const at of ['beforeStatus','statusApplied','disarmBeforeBuff'])test('reentrant parent finish at '+at+' leaves no orphan child',()=>{
 const f=fixture();const stop=()=>f.b.removeBuff(f.target,parentKey);
 if(at==='disarmBeforeBuff')f.b.on('beforeBuff',c=>{if(c.buff.key.startsWith('ch16:fearpj:disarm:'))stop();});
 else f.b.on(at,c=>{if(c.target===f.target&&c.status==='fear')stop();});
 assert.equal(f.manager.apply(f.source,f.target),null);assertClean(f);
});
test('reentrant application while retiring old children preserves the newer parent without orphan statuses',()=>{
 const f=fixture(),old=apply(f);let newer;
 old.children[0].onRemove=()=>{newer=f.manager.apply(f.source,f.target);};
 assert.equal(f.manager.apply(f.source,f.target),null);
 assert.ok(newer?.active);assert.equal(f.target.buffs.filter(b=>b.key===parentKey).length,1);
 assert.equal(f.target.buffs.filter(b=>b.key.startsWith('ch16:fearpj:')).length,2);
 f.manager.finish(newer);assertClean(f);
});
test('recipient replacement during old-child cleanup refuses the pending new application',()=>{
 const f=fixture(),old=apply(f);old.children[0].onRemove=()=>{f.target.deploySeq++;};
 assert.equal(f.manager.apply(f.source,f.target),null);assertClean(f);
});
test('almost-full HP never finishes the literal full-HP recovery check',()=>{
 const f=fixture(),p=apply(f);f.target.hp=f.target.s.maxHp-.01;f.h.run(1.1);
 assert.equal(p.active,true);f.manager.finish(p);assertClean(f);
});
test('source replacement during old-child cleanup cannot donate replacement stats or credit',()=>{
 const f=fixture(),old=apply(f),stats=f.source.stats,atk=f.source.s.atk;
 old.children[0].onRemove=()=>{f.source.deploySeq++;f.source.stats={...stats};f.source.base.atk=99999;f.source.markDirty();};
 const next=apply(f);assert.equal(next.source.stats,stats);assert.equal(next.source.s.atk,atk);
 f.manager.finish(next);assertClean(f);
});
test('actual miner fear-loss and shadow suppression recover after the owned parent clears at full HP',()=>{
 const{h,b,e}=minerBattle(minerKeys[0],[{stats:{atk:0}}]);h.run(.31);
 const env=chapter16Shadow(b),tile=10*21+6,prior=env.shadowSuppressedUntil.get(tile);e.hp=2000;
 const p=fearProjectileAfflictions(b).apply(h.allies()[0],e);assert.ok(p);
 h.run(1.4);assert.equal(e.hp,1800);assert.equal(env.shadowSuppressedUntil.get(tile),prior);
 b.heal(h.allies()[0],e,1e6);h.run(.6);assert.equal(p.active,false);assert.equal(e.hp,e.s.maxHp);
 assert.ok(env.shadowSuppressedUntil.get(tile)>prior);assert.equal(!!e.s.flags.fear,false);assert.equal(!!e.s.flags.disarm,false);
 h.run(1.1);assert.equal(e.hp,e.s.maxHp);assert.deepEqual(b.errors,[]);
});
test('a hidden recipient keeps its parent clock and can recover at full HP without being selectable',()=>{
 const f=fixture(),p=apply(f);f.target.hidden=true;f.h.run(.6);assert.equal(p.active,true);
 f.target.hp=f.target.s.maxHp;f.h.run(.41);assert.equal(p.active,false);assertClean(f);
});
