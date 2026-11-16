// SPDX-License-Identifier: GPL-3.0-or-later
// Portable, bounded combat programs. No source templates or executable code.
import {environmentConditionMask,singleEnvironmentCondition} from './environment-conditions.js';
import {decodeEnemyRuntimeParameters} from './enemy-runtime-plan.js';
const EVENTS=new Set(['ON_BUFF_START','ON_BUFF_TRIGGER','ON_AFTER_OUTPUT_DAMAGE','ON_BEFORE_ATTACK','ON_BUFF_DISABLE']);
const BINDINGS=new Set(['owner','source','target']);
const cache=new WeakMap();
function fail(label){throw Error(`Invalid behaviour program: ${label}`);}
function object(v){return v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));}
function fields(v,keys){if(!object(v)||Object.keys(v).sort().join()!==keys.split(' ').sort().join())fail('fields');}
function string(v){if(typeof v!=='string'||!v||v.length>256)fail('key');}
function binding(v){if(!BINDINGS.has(v))fail('binding');}
function finite(v,min=0){if(!Number.isFinite(v)||v<min)fail('number');}
function freeze(v){if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
/** Validate the entire graph, including inactive branches and all child edges,
 * then retain a frozen snapshot so callers cannot mutate an admitted program. */
export function prepareBehaviorProgram(input){
  if(input&&cache.has(input))return cache.get(input);
  fields(input,'schemaVersion entry templates');if(input.schemaVersion!==1)fail('version');string(input.entry);
  if(!object(input.templates))fail('templates');
  const keys=Object.keys(input.templates);if(!keys.length||keys.length>64)fail('template count');
  let count=0;const required=new Map(),optional=new Set(),edges=new Map(),modeBindings=new Set(),modeIndices=new Set(),eventRequirements=new Map();
  let currentTemplate,currentEvent;
  const requirements=()=>{if(!eventRequirements.has(currentEvent))eventRequirements.set(currentEvent,{modes:new Set(),environment:new Set()});return eventRequirements.get(currentEvent);};
  const modeIndex=n=>{if(!Number.isSafeInteger(n)||n<0||n>63)fail('mode index');modeIndices.add(n);};
  const rootBinding=who=>{binding(who);if(currentTemplate!==input.entry)fail('mode/environment child binding');};
  const operand=(key,positive=false)=>{string(key);required.set(key,positive||required.get(key)||false);};
  const visit=(nodes,refs,depth=0)=>{
    if(!Array.isArray(nodes)||depth>16)fail('depth/list');
    for(const n of nodes){
      if(++count>1024)fail('node budget');
      switch(n?.op){
        case 'when':fields(n,'op condition yes no');condition(n.condition,depth+1);visit(n.yes,refs,depth+1);visit(n.no,refs,depth+1);break;
        case 'release':fields(n,'op who');binding(n.who);break;
        case 'switchMode':fields(n,'op who index');rootBinding(n.who);modeIndex(n.index);modeBindings.add(n.who);requirements().modes.add(n.who);break;
        case 'kill':fields(n,'op who');if(n.who!=='source')fail('kill binding');break;
        case 'damage':fields(n,'op type scaleKey defaultScale');if(!['phys','arts','true'].includes(n.type))fail('damage type');string(n.scaleKey);finite(n.defaultScale);optional.add(n.scaleKey);break;
        case 'loss':fields(n,'op key');operand(n.key);break;
        case 'create':
          fields(n,'op who key template clock');binding(n.who);string(n.key);string(n.template);refs.add(n.template);
          if(n.clock===null)break;
          fields(n.clock,'duration interval firstDelay');operand(n.clock.duration,true);finite(n.clock.interval,Number.MIN_VALUE);finite(n.clock.firstDelay);
          if(n.clock.firstDelay>n.clock.interval)fail('first pulse');break;
        default:fail('opcode');
      }
    }
  };
  const condition=(n,depth)=>{
    if(!object(n)||++count>1024||depth>16)fail('condition budget');
    switch(n.op){
      case 'mode':fields(n,'op who index');rootBinding(n.who);modeIndex(n.index);modeBindings.add(n.who);requirements().modes.add(n.who);break;
      case 'environmentMask':fields(n,'op who mask');rootBinding(n.who);if(!singleEnvironmentCondition(n.mask))fail('environment mask');requirements().environment.add(n.who);break;
      case 'all':fields(n,'op terms');if(!Array.isArray(n.terms)||!n.terms.length)fail('terms');n.terms.forEach(x=>condition(x,depth+1));break;
      case 'not':fields(n,'op value');condition(n.value,depth+1);break;
      case 'buff':fields(n,'op who keys all');binding(n.who);if(typeof n.all!=='boolean'||!Array.isArray(n.keys)||!n.keys.length||n.keys.length>64)fail('buff keys');n.keys.forEach(string);break;
      case 'silenced':fields(n,'op who unset');binding(n.who);if(typeof n.unset!=='boolean')fail('silence');break;
      case 'profession':fields(n,'op who values');binding(n.who);if(!Array.isArray(n.values)||!n.values.length||n.values.length>64||n.values.some(x=>!['PIONEER','WARRIOR','TANK','SNIPER','CASTER','MEDIC','SUPPORT','SPECIAL','TOKEN','TRAP'].includes(x)))fail('profession');break;
      default:fail('predicate');
    }
  };
  for(const key of keys){currentTemplate=key;string(key);const t=input.templates[key];fields(t,'events');if(!object(t.events))fail('events');const refs=new Set();edges.set(key,refs);
    for(const[event,nodes]of Object.entries(t.events)){currentEvent=event;if(!EVENTS.has(event))fail('event');visit(nodes,refs);}
  }
  const seen=new Set(),active=new Set(),heights=new Map();
  const walk=key=>{
    if(!Object.hasOwn(input.templates,key))fail('missing child');if(active.has(key))fail('cycle/depth');
    if(heights.has(key))return heights.get(key);
    active.add(key);let height=0;
    for(const child of edges.get(key))height=Math.max(height,1+walk(child));
    if(height>16)fail('cycle/depth');
    active.delete(key);seen.add(key);heights.set(key,height);return height;
  };
  walk(input.entry);if(seen.size!==keys.length)fail('unreachable template');
  // A small DAG can expand exponentially through repeated immediate child
  // calls. Bound the worst synchronous path before any combat mutation.
  const costs=new Map();
  const predicateCost=n=>1+(n.op==='all'?n.terms.reduce((s,x)=>s+predicateCost(x),0):n.op==='not'?predicateCost(n.value):0);
  const listCost=nodes=>{
    let cost=0;for(const n of nodes){
      cost+=1;
      if(n.op==='when')cost+=predicateCost(n.condition)+Math.max(listCost(n.yes),listCost(n.no));
      if(n.op==='create')cost+=eventCost(n.template,'ON_BUFF_START');
      if(cost>4096)fail('expanded step budget');
    }return cost;
  };
  const eventCost=(key,event)=>{
    if(!costs.has(key))costs.set(key,new Map());const byEvent=costs.get(key);
    if(!byEvent.has(event))byEvent.set(event,listCost(input.templates[key].events[event]??[]));
    return byEvent.get(event);
  };
  for(const key of keys)for(const event of EVENTS)eventCost(key,event);
  const graph=freeze(structuredClone(input));
  const validateBlackboard=bb=>{
    if(!object(bb))fail('blackboard');const result={};
    for(const[key,positive]of required){if(!Object.hasOwn(bb,key))fail(`missing blackboard ${key}`);finite(bb[key],positive?Number.MIN_VALUE:0);Object.defineProperty(result,key,{value:bb[key],enumerable:true});}
    for(const key of optional)if(!required.has(key)&&Object.hasOwn(bb,key)){finite(bb[key]);Object.defineProperty(result,key,{value:bb[key],enumerable:true});}
    return Object.freeze(result);
  };
  const predicate=(n,c)=>{
    const u=c[n.who];
    switch(n.op){
      case 'mode':return c.modeService.get(u)===n.index;
      case 'environmentMask':return (environmentConditionMask(c.battle,u)&n.mask)!==0;
      case 'all':return n.terms.every(x=>predicate(x,c));
      case 'not':return !predicate(n.value,c);
      case 'buff':return !!u&&(n.all?n.keys.every(k=>!!u.findBuff(k)):n.keys.some(k=>!!u.findBuff(k)));
      case 'silenced':return !!u&&(n.unset?!u.s.flags.silence:!!u.s.flags.silence);
      case 'profession':{if(!u)return false;const p=u.kind==='token'?'TOKEN':u.kind==='device'?'TRAP':u.def?.profession??u.def?.raw?.profession;return n.values.includes(p);}
    }
  };
  const runNodes=(nodes,c)=>{
    for(const n of nodes){
      if(n.op==='when'){runNodes(predicate(n.condition,c)?n.yes:n.no,c);continue;}
      if(n.op==='switchMode'){c.modeService.set(c[n.who],n.index);continue;}
      if(n.op==='release'){const u=c[n.who];if(u?.alive&&u.deployed)c.battle._unblock(u);continue;}
      if(n.op==='loss'){if(c.target?.alive&&c.target.deployed)c.battle.loseHp(c.target,c.blackboard[n.key],{source:c.source,tags:[c.buffKey,'dot']});continue;}
      if(n.op==='damage'){if(c.source?.alive&&c.source.deployed&&c.source.deploySeq===c.sourceLife&&c.target?.alive&&c.target.deployed&&c.target.deploySeq===c.targetLife)c.battle.dealDamage(c.source,c.target,{amount:c.source.s.atk*(c.blackboard[n.scaleKey]??n.defaultScale),type:n.type,isAttack:true,isSkill:false,applyWay:'all',canDodge:c.damageMissable,tags:[c.buffKey]});continue;}
      if(n.op==='kill'){const u=c[n.who];if(u?.alive&&u.deployed&&u.deploySeq===c.sourceLife)c.battle.kill(u,c.source);continue;}
      const owner=c[n.who];if(!owner?.alive||!owner.deployed)continue;
      const child={...c,owner,target:owner,targetLife:owner.deploySeq,buffKey:n.key};
      const fire=event=>runNodes(graph.templates[n.template].events[event]??[],child);
      if(n.clock===null){fire('ON_BUFF_START');continue;}
      const prior=owner.findBuff(n.key);
      const attached=c.battle.addBuff(owner,{key:n.key,source:c.source,duration:c.blackboard[n.clock.duration],refresh:'extend',
        interval:n.clock.interval,firstTickDelay:n.clock.firstDelay,visible:true,sourceStatusResistable:false,
        onTick:()=>fire('ON_BUFF_TRIGGER')});
      if(attached&&attached!==prior)fire('ON_BUFF_START');
    }
  };
  const prepared=Object.freeze({graph,requiredBlackboard:Object.freeze([...required.keys()]),requiredModeIndices:Object.freeze([...modeIndices].sort((a,b)=>a-b)),requiredModeBindings:Object.freeze([...modeBindings]),validateBlackboard,
    run(event,{battle,unit,source=unit,target=unit,blackboard={},buffKey=graph.entry,damageMissable=true,modeService=null}){
      if(!EVENTS.has(event))fail('event');
      const bb=validateBlackboard(blackboard);
      if(!battle||!unit||!source)fail('owner/source');
      if(typeof damageMissable!=='boolean')fail('missability');
      const context={battle,owner:unit,source,target,blackboard:bb,buffKey,damageMissable,modeService,sourceLife:source.deploySeq,targetLife:target?.deploySeq};
      const needs=eventRequirements.get(event);
      if(needs?.modes.size){
        if(!modeService||typeof modeService.get!=='function'||typeof modeService.set!=='function')fail('mode service');
        for(const who of needs.modes){const actor=context[who],index=actor&&modeService.get(actor);if(!actor||!Number.isSafeInteger(index)||index<0||index>63)fail('current mode');}
      }
      for(const who of needs?.environment??[]){if(!context[who])fail('environment owner');environmentConditionMask(battle,context[who]);}
      runNodes(graph.templates[graph.entry].events[event]??[],context);
    }});
  cache.set(input,prepared);cache.set(graph,prepared);return prepared;
}

/** Only reviewed factories opt into immutable shared program snapshots; all
 * other parameters still get independent copies for each spawned unit. */
export function decodeBehaviorParameters(params){
  const {program,...rest}=params;
  if(Object.hasOwn(rest,'programComponent'))fail('unhydrated component');
  return {...decodeEnemyRuntimeParameters(rest),...(program?{program:prepareBehaviorProgram(program).graph}:{})};
}
