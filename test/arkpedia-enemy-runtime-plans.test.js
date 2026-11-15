// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import records from '../data/arkpedia-enemy-records.json' with {type:'json'};
import support from '../data/arkpedia-enemy-support.json' with {type:'json'};
import { compileEnemyRuntimePlan,withCompiledEnemyRuntime } from '../shared/arkpedia/enemy-runtime-compiler.js';
import { validateEnemyRuntimePlan,decodeEnemyRuntimeParameters } from '../shared/arkpedia/enemy-runtime-plan.js';
import { enemyRuntimeRecord } from '../shared/arkpedia/enemy-features.js';
import { installEnemyFeatures,ENEMY_FEATURE_ABILITY_KINDS } from '../server/sim/content/arkpedia-enemy-features.js';
import { applyCompiledEnemyFeatures } from '../server/sim/content/arkpedia-enemy-plan.js';
import { makeBattle,chessRec,enemyRec } from './helpers/battleHarness.js';
import { RegularDisplacement } from '../server/sim/regular-displacement.js';
const knownKinds=new Set(ENEMY_FEATURE_ABILITY_KINDS);
const supported=Object.entries(records.enemies).filter(([id])=>support.enemies[id].policy);
function definitions(id,level,compiled,out={}){
  if(out[id])return out;const row=structuredClone(records.enemies[id].levels[level]);
  out[id]=compiled?JSON.parse(JSON.stringify(withCompiledEnemyRuntime(row))):enemyRuntimeRecord(row);
  for(const child of support.enemies[id].spawns)definitions(child,0,compiled,out);return out;
}
function scenario(id,level,compiled){
  const op=chessRec({id:'plan_guard',stats:{maxHp:1e6,atk:0,def:0,blockCnt:10},skill:null});
  const h=makeBattle({content:'none',autoFinish:false,seed:7,timeLimit:60,defs:{enemies:definitions(id,level,compiled),chess:{[op.chessId]:op}},
    kits:{[op.chessId]:()=>({trait:{noAttack:true}})},units:[{chessId:op.chessId,row:9,col:6}],
    setup:b=>{b.regularDisplacement=new RegularDisplacement(b);installEnemyFeatures(b);}});
  h.b.start();h.b.spawnEnemy(id,{pos:[9,6],routeIndex:records.enemies[id].levels[level].stats.motion==='FLY'?2:0});
  h.run(2);return h;
}
test('every admitted database level compiles to deterministic JSON without mutating its source or losing unit properties',()=>{
  let levels=0;
  for(const[,entry]of supported)for(const row of Object.values(entry.levels)){
    const before=structuredClone(row),plan=compileEnemyRuntimePlan(row),wire=JSON.parse(JSON.stringify(plan));
    assert.deepEqual(row,before);assert.deepEqual(validateEnemyRuntimePlan(wire,{knownKinds}),plan);
    assert.deepEqual(compileEnemyRuntimePlan(row),plan);const decorated=withCompiledEnemyRuntime(row);
    const{runtimeFeatures,...original}=decorated;assert.deepEqual(original,enemyRuntimeRecord(row));assert.deepEqual(runtimeFeatures,plan);levels++;
  }
  assert.ok(levels>=771);
});
test('serialized plans preserve visible combat and derived stats across every supported enemy level',()=>{
  for(const[id,entry]of supported)for(const row of Object.values(entry.levels)){
    const legacy=scenario(id,row.level,false),compiled=scenario(id,row.level,true);
    assert.deepEqual(legacy.b.errors,[],`${id}@${row.level}: legacy errors`);assert.deepEqual(compiled.b.errors,[],`${id}@${row.level}: compiled errors`);
    assert.deepEqual(compiled.b.snapshot(),legacy.b.snapshot(),`${id}@${row.level}: snapshot`);
    const stats=b=>b.units.map(u=>({id:u.id,defId:u.defId,alive:u.alive,hp:u.hp,stats:u.s,damage:u.stats}));
    assert.deepEqual(stats(compiled.b),stats(legacy.b),`${id}@${row.level}: stats`);
  }
});
function bare(){const h=makeBattle({content:'none',autoFinish:false,defs:{enemies:{dummy:enemyRec({key:'dummy',speed:0})}}});h.b.start();return h;}
test('ability ordering and duplicate kinds survive; factories get independently owned parameter objects',()=>{
  const h=bare(),plan={schemaVersion:1,properties:{},entries:[
    {id:'native:first',trait:{flags:{noMove:true}},ability:{kind:'mutator',params:{state:{n:1}}}},
    {id:'native:second',ability:{kind:'mutator',params:{state:{n:2}}}},
  ]},calls=[];
  const factory=p=>({spawn(_b,e,a){a.initial=p.state.n;calls.push([e.id,p.state.n,e.s.flags.noMove]);p.state.n++;}});
  for(let i=0;i<2;i++){const e=h.b.spawnEnemy('dummy',{pos:[9,5]});applyCompiledEnemyFeatures(h.b,e,plan,()=>factory);
    assert.deepEqual(e.mem.ab.list.map(a=>a.initial),[1,2]);}
  assert.deepEqual(calls.map(x=>x.slice(1)),[[1,true],[2,true],[1,true],[2,true]]);
  assert.deepEqual(plan.entries.map(x=>x.ability.params.state.n),[1,2]);assert.deepEqual(h.b.errors,[]);
});
test('missing later implementations fail before any trait or ability mutates combat',()=>{
  const h=bare(),e=h.b.spawnEnemy('dummy',{pos:[9,5]});const plan={schemaVersion:1,properties:{},entries:[
    {id:'native:first',trait:{flags:{noMove:true}}},{id:'native:missing',ability:{kind:'missing',params:{}}},
  ]};assert.throws(()=>applyCompiledEnemyFeatures(h.b,e,plan,()=>undefined),/must be prepared: missing/);
  assert.equal(e.findBuff('feature:native:first'),null);assert.equal(e.mem.ab,undefined);
});
test('plan validation rejects executable values, non-finite numbers, exotic objects, unknown fields and wrong schema versions',()=>{
  const plan={schemaVersion:1,properties:{},entries:[{id:'native:test',ability:{kind:'known',params:{}}}]};
  for(const bad of[()=>1,Infinity,NaN,new Map(),undefined]){const p=structuredClone(plan);p.entries[0].ability.params.value=bad;assert.throws(()=>validateEnemyRuntimePlan(p));}
  for(const edit of[p=>p.schemaVersion=2,p=>p.extra=true,p=>p.properties.side='other',p=>p.entries[0].ability.kind='path/to/code',
    p=>p.entries[0].trait={flags:{noMove:1}},p=>p.entries[0].trait={maxTargets:0}]){const p=structuredClone(plan);edit(p);assert.throws(()=>validateEnemyRuntimePlan(p));}
  assert.throws(()=>validateEnemyRuntimePlan(plan,{knownKinds:new Set()}),/Unknown enemy runtime kind/);
});
test('an unrecognized handbook mechanic cannot be silently compiled into a partial plan',()=>{
  const r=structuredClone(records.enemies.enemy_1007_slime.levels[0]);r.abilities.push({text:'Unreviewed new mechanic',format:'NORMAL'});
  assert.throws(()=>compileEnemyRuntimePlan(r),/Unknown enemy runtime feature/);
});

test('stage-disabled Rat King timers survive JSON without becoming null or active timers',()=>{
  const row=structuredClone(records.enemies.enemy_1509_mousek.levels[0]);
  row.skills=row.skills.filter(s=>s.prefabKey!=='Mark');
  const plan=JSON.parse(JSON.stringify(compileEnemyRuntimePlan(row)));
  const params=plan.entries.find(e=>e.ability?.kind==='ratKing')?.ability.params;
  assert.ok(params);assert.deepEqual(params.markInitial,{$infinity:1});
  assert.equal(decodeEnemyRuntimeParameters(params).markInitial,Infinity);
  assert.equal(decodeEnemyRuntimeParameters({v:{$infinity:-1}}).v,-Infinity);
  for(const tag of[{$infinity:0},{$infinity:1,extra:true},{$infinity:'1'}]){
    const bad=structuredClone(plan);bad.entries.find(e=>e.ability).ability.params.bad=tag;
    assert.throws(()=>validateEnemyRuntimePlan(bad),/infinity/);
  }
});

test('configurable mode statistics leave compiled behavior parameters and feature selection unchanged',()=>{
  for(const[,entry]of supported)for(const row of Object.values(entry.levels)){
    const scaled=structuredClone(row);
    for(const key of ['maxHp','atk','def','moveSpeed'])scaled.stats[key]*=2;
    scaled.stats.res+=15;
    assert.deepEqual(compileEnemyRuntimePlan(scaled),compileEnemyRuntimePlan(row),`${row.key}@${row.level}`);
  }
});
