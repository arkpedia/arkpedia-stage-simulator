// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import evidence from '../data/arkpedia-enemy-native-abilities.json' with {type:'json'};
import {compileNativeBuffProgram} from '../shared/arkpedia/behavior-native-compiler.js';
import {prepareBehaviorProgram,decodeBehaviorParameters} from '../shared/arkpedia/behavior-program.js';
import {applyCompiledEnemyFeatures} from '../server/sim/content/arkpedia-enemy-plan.js';
import {chargedMeleeBuffProgram} from '../server/sim/content/arkpedia-enemy-charged-loss.js';
import {createEnemyRuntime} from '../server/sim/content/arkpedia-enemy-runtime.js';
import {packStage} from '../tools/arkpedia/stage-library.mjs';
import {createStageLibraryLoader} from '../shared/arkpedia/stage-library.js';
const compile=(key,templates=evidence.templates)=>compileNativeBuffProgram(key,k=>templates[k]);
const bleed=()=>compile('bldrat_t_1[blood]'),release=()=>compile('enemy_crgst[blocker]');
const node=(name,params={})=>({$type:`Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`,...params});
const template=(events)=>({templateKey:'fixture',effectKey:'',onEventPriority:'DEFAULT',eventToActions:events});
const unit=(keys=[])=>({alive:true,deployed:true,s:{flags:{}},findBuff:k=>keys.includes(k)});

test('native compiler produces shared child edges and discovers every required blackboard operand',()=>{
  const program=bleed(),runtime=prepareBehaviorProgram(program);
  assert.deepEqual(Object.keys(program.templates).sort(),['bldrat_t_1[blood]','blood_dec']);
  assert.deepEqual([...runtime.requiredBlackboard].sort(),['blood_duration','blood_value']);
  assert.ok(Object.isFrozen(program.templates.blood_dec.events.ON_BUFF_TRIGGER[0]));
  assert.deepEqual(runtime.validateBlackboard({blood_value:20,blood_duration:5}),{blood_value:20,blood_duration:5});
});
test('both branches compile even when an earlier condition would suppress their execution',()=>{
  const templates=structuredClone(evidence.templates);
  templates['enemy_crgst[blocker]'].eventToActions.ON_BUFF_TRIGGER[0]._succeedNodes=[node('ExecuteScript')];
  assert.throws(()=>compile('enemy_crgst[blocker]',templates),/action ExecuteScript/);
});
test('source flags, unknown fields, bindings and metadata cannot silently broaden the dialect',async t=>{
  const cases=[
    ts=>ts.blood_dec.eventToActions.ON_BUFF_TRIGGER[0]._ignoreForSp=false,
    ts=>ts.blood_dec.eventToActions.ON_BUFF_TRIGGER[0]._considerUnhurtable=true,
    ts=>ts.blood_dec.eventToActions.ON_BUFF_TRIGGER[0]._damageType='PHYSICAL',
    ts=>ts.blood_dec.eventToActions.ON_BUFF_TRIGGER[0].extra=1,
    ts=>ts.blood_dec.effectKey='unreviewed',
    ts=>ts.blood_dec.eventToActions.ON_BUFF_FINISH=[],
    ts=>ts['bldrat_t_1[blood]'].eventToActions.ON_AFTER_OUTPUT_DAMAGE[3]._isDerivedBuff=true,
    ts=>ts['bldrat_t_1[blood]'].eventToActions.ON_AFTER_OUTPUT_DAMAGE[3]._buff.blackboard=[{key:'damage',value:9}],
    ts=>ts['bldrat_t_1[blood]'].eventToActions.ON_AFTER_OUTPUT_DAMAGE[3]._buff.attributes.abnormalFlags=['STUNNED'],
    ts=>ts['bldrat_t_1[blood]'].eventToActions.ON_AFTER_OUTPUT_DAMAGE[0]._targetType='HOST',
    ts=>ts['bldrat_t_1[blood]'].eventToActions.ON_AFTER_OUTPUT_DAMAGE[1]._profession=['UNKNOWN'],
    ts=>ts['bldrat_t_1[blood]'].eventToActions.ON_AFTER_OUTPUT_DAMAGE[3]._buff.firstTriggerInterval=2,
  ];
  for(const[i,change]of cases.entries())await t.test(`refusal ${i+1}`,()=>{const ts=structuredClone(evidence.templates);change(ts);assert.throws(()=>compile('bldrat_t_1[blood]',ts));});
});
test('unbound/inactive IfNot, ambiguous predicate order and source template cycles are refused',()=>{
  assert.throws(()=>compile('fixture',{fixture:template({ON_BUFF_START:[node('IfNot')]})}),/unbound IfNot/);
  const ts=structuredClone(evidence.templates),nodes=ts['bldrat_t_1[blood]'].eventToActions.ON_AFTER_OUTPUT_DAMAGE;
  nodes.push(nodes.shift());assert.throws(()=>compile('bldrat_t_1[blood]',ts),/predicate after effect/);
  const cycle=structuredClone(evidence.templates);cycle['bldrat_t_1[blood]'].eventToActions.ON_AFTER_OUTPUT_DAMAGE[3]._buff.templateKey='bldrat_t_1[blood]';
  assert.throws(()=>compile('bldrat_t_1[blood]',cycle),/cycle/);
});
test('portable validation rejects unknown nodes, fields, child edges, cycles and nonfinite clocks',async t=>{
  const changes=[
    p=>p.templates.blood_dec.events.ON_BUFF_TRIGGER[0].op='eval',
    p=>p.templates.blood_dec.events.ON_BUFF_TRIGGER[0].code='1',
    p=>p.templates['bldrat_t_1[blood]'].events.ON_AFTER_OUTPUT_DAMAGE[0].yes[0].template='missing',
    p=>p.templates['bldrat_t_1[blood]'].events.ON_AFTER_OUTPUT_DAMAGE[0].yes[0].template=p.entry,
    p=>p.templates['bldrat_t_1[blood]'].events.ON_AFTER_OUTPUT_DAMAGE[0].yes[0].clock.interval=Infinity,
    p=>p.templates['bldrat_t_1[blood]'].events.ON_AFTER_OUTPUT_DAMAGE[0].no.push({op:'arbitrary'}),
    p=>p.templates.unreachable={events:{}},
  ];
  for(const[i,change]of changes.entries())await t.test(`invalid portable graph ${i+1}`,()=>{const p=structuredClone(bleed());change(p);assert.throws(()=>prepareBehaviorProgram(p));});
});
test('program validation bounds template and predicate recursion',()=>{
  const p=structuredClone(release());let n=p.templates[p.entry].events.ON_BUFF_TRIGGER[0];
  for(let i=0;i<18;i++){n.yes=[{op:'when',condition:{op:'buff',who:'owner',keys:['x'],all:true},yes:[],no:[]}];n=n.yes[0];}
  assert.throws(()=>prepareBehaviorProgram(p),/depth|budget/);
});
test('all numeric operands preflight before any earlier action mutates battle state',()=>{
  const graph={schemaVersion:1,entry:'f',templates:{f:{events:{ON_BUFF_START:[{op:'loss',key:'a'},{op:'loss',key:'b'}]}}}};
  const p=prepareBehaviorProgram(graph),calls=[],owner=unit();
  for(const blackboard of [{a:2},{a:2,b:NaN},{a:2,b:-1}])
    assert.throws(()=>p.run('ON_BUFF_START',{battle:{loseHp:(...args)=>calls.push(args)},unit:owner,blackboard}));
  assert.equal(calls.length,0);
  p.run('ON_BUFF_START',{battle:{loseHp:(...args)=>calls.push(args)},unit:owner,blackboard:{a:2,b:3}});
  assert.deepEqual(calls.map(c=>c[1]),[2,3]);
});
test('release graph resolves distinct owner/source markers and releases only the source',()=>{
  const p=prepareBehaviorProgram(release()),calls=[],battle={_unblock:u=>calls.push(u)};
  const owner=unit(),source=unit(['enemy_crgst[unblockable]']);
  p.run('ON_BUFF_TRIGGER',{battle,unit:owner,source});assert.deepEqual(calls,[source]);calls.length=0;
  p.run('ON_BUFF_TRIGGER',{battle,unit:unit(['env_act43side[shooting]']),source});assert.equal(calls.length,0);
  p.run('ON_BUFF_TRIGGER',{battle,unit:owner,source:unit()});assert.equal(calls.length,0);
});
test('IfNot negates only the preceding profession predicate while silence still suppresses payloads',()=>{
  const p=prepareBehaviorProgram(bleed()),owner=unit(),target=unit(),calls=[];
  const battle={addBuff:(u,b)=>{calls.push({u,b});return b;}};target.def={profession:'TANK'};
  p.run('ON_AFTER_OUTPUT_DAMAGE',{battle,unit:owner,target,blackboard:{blood_value:20,blood_duration:5}});assert.equal(calls.length,1);
  owner.s.flags.silence=true;p.run('ON_AFTER_OUTPUT_DAMAGE',{battle,unit:owner,target,blackboard:{blood_value:20,blood_duration:5}});assert.equal(calls.length,1);
  owner.s.flags.silence=false;target.kind='token';p.run('ON_AFTER_OUTPUT_DAMAGE',{battle,unit:owner,target,blackboard:{blood_value:20,blood_duration:5}});assert.equal(calls.length,1);
});
test('prepared snapshots resist caller edits and immutable programs are reused across spawned parameter copies',()=>{
  const program=structuredClone(release()),prepared=prepareBehaviorProgram(program);
  program.templates[program.entry].events.ON_BUFF_TRIGGER=[];
  assert.equal(prepared.graph.templates[prepared.graph.entry].events.ON_BUFF_TRIGGER.length,1);
  const params={program,blackboard:{x:1}},a=decodeBehaviorParameters(params),b=decodeBehaviorParameters(params);
  assert.equal(a.program,b.program);assert.equal(a.program,prepared.graph);a.blackboard.x=99;assert.equal(b.blackboard.x,1);
});
test('selected runtime rejects unhydrated/invalid programs and missing operands before battle construction',async()=>{
  const runtime=createEnemyRuntime(),record=params=>({key:'fixture',runtimeFeatures:{schemaVersion:1,properties:{},entries:[{id:'native:test',ability:{kind:'chargedMeleeBuffProgram',params}}]}});
  await assert.rejects(runtime.prepare({f:record({programComponent:'a'.repeat(64)})}),/Unhydrated/);
  await assert.rejects(runtime.prepare({f:record({program:bleed(),blackboard:{blood_duration:5}})}),/missing blackboard/);
  assert.throws(()=>runtime.assertPrepared({f:record({program:{},blackboard:{}})}),/behaviour program/);
});
test('stage programs are separate deduplicated components with retryable selected loads and old graph compatibility',async()=>{
  const objects=new Map(),program=bleed(),put=value=>{const bytes=JSON.stringify(value)+'\n',hash=createHash('sha256').update(bytes).digest('hex');objects.set(hash,bytes);return hash;};
  const enemy=(id,value)=>({key:id,stats:{atk:1},runtimeFeatures:{schemaVersion:1,properties:{},entries:[{id:'native:test',ability:{kind:'chargedMeleeBuffProgram',params:{program,blackboard:{blood_value:value,blood_duration:5}}}}]}});
  const stage={battle:{},geometry:{rows:2,cols:2},pathing:{paths:{}},enemies:{a:enemy('a',20),b:enemy('b',30)}};
  const bundle=packStage('fixture',stage,put),graph=JSON.parse(objects.get(bundle));
  const def=id=>JSON.parse(objects.get(graph.enemies[id].definition)),ref=def('a').runtimeFeatures.entries[0].ability.params.programComponent;
  assert.equal(ref,def('b').runtimeFeatures.entries[0].ability.params.programComponent);
  assert.equal(def('a').runtimeFeatures.entries[0].ability.params.program,undefined);
  let refuse=true;const requests=[];const loader=createStageLibraryLoader(async url=>{const hash=url.split('/').at(-1).slice(0,-5);requests.push(hash);return new Response(refuse&&hash===ref?'':objects.get(hash),{status:refuse&&hash===ref?404:200});});
  const entry={id:'fixture',availability:'available',bundle};await assert.rejects(loader.load(entry),/unavailable/);refuse=false;
  const loaded=await loader.load(entry),params=id=>loaded.enemies[id].runtimeFeatures.entries[0].ability.params;
  assert.equal(params('a').program,params('b').program);assert.deepEqual(params('a').program,program);
  assert.equal(params('a').programComponent,undefined);assert.equal(params('b').blackboard.blood_value,30);
  assert.equal(requests.filter(h=>h===ref).length,2,'one failed and one shared successful fetch');
  params('a').program.templates.blood_dec.events={};assert.deepEqual((await loader.load(entry)).enemies.a.runtimeFeatures.entries[0].ability.params.program,program);
  const old=structuredClone(stage);delete old.enemies.a.runtimeFeatures;delete old.enemies.b.runtimeFeatures;
  const oldBundle=packStage('old',old,put);assert.deepEqual(await loader.load({id:'old',availability:'available',bundle:oldBundle}),old);
});

test('fixed TARGET loss follows the event target while retaining the original source',()=>{
  const ts={fixture:template({ON_AFTER_OUTPUT_DAMAGE:structuredClone(evidence.templates.blood_dec.eventToActions.ON_BUFF_TRIGGER)})};
  const p=prepareBehaviorProgram(compile('fixture',ts)),owner=unit(),target=unit(),source=unit(),calls=[];
  p.run('ON_AFTER_OUTPUT_DAMAGE',{battle:{loseHp:(...args)=>calls.push(args)},unit:owner,target,source,blackboard:{blood_value:20}});
  assert.equal(calls.length,1);assert.equal(calls[0][0],target);assert.equal(calls[0][2].source,source);
});
test('a malformed later program fails before even an earlier trait attaches',()=>{
  let mutations=0;
  const plan={schemaVersion:1,properties:{},entries:[
    {id:'native:trait',trait:{flags:{noMove:true}}},
    {id:'native:program',ability:{kind:'chargedMeleeBuffProgram',params:{program:bleed(),blackboard:{blood_duration:5}}}},
  ]};
  assert.throws(()=>applyCompiledEnemyFeatures({addBuff:()=>mutations++},{},plan,()=>chargedMeleeBuffProgram),/missing blackboard/);
  assert.equal(mutations,0);
});

test('a compact acyclic graph cannot expand into an unbounded immediate action tree',()=>{
  const templates={};
  for(let i=0;i<14;i++)templates[`t${i}`]={events:{ON_BUFF_START:i===13?[{op:'release',who:'owner'}]:
    [0,1].map(()=>({op:'create',who:'owner',key:`child${i}`,template:`t${i+1}`,clock:null}))}};
  assert.throws(()=>prepareBehaviorProgram({schemaVersion:1,entry:'t0',templates}),/expanded step budget/);
});

test('longest shared-child path is bounded even if a shorter path visited that child first',()=>{
  const create=key=>({op:'create',who:'owner',key,template:key,clock:null}),templates={root:{events:{ON_BUFF_START:[create('shared0'),create('long0')]}}};
  for(let i=0;i<6;i++)templates[`shared${i}`]={events:{ON_BUFF_START:i<5?[create(`shared${i+1}`)]:[]}};
  for(let i=0;i<13;i++)templates[`long${i}`]={events:{ON_BUFF_START:[create(i<12?`long${i+1}`:'shared0')]}};
  assert.throws(()=>prepareBehaviorProgram({schemaVersion:1,entry:'root',templates}),/cycle\/depth/);
});
