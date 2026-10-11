// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {webglEffectProgram,selectEffectProgram,effectUniformDeclarations} from '../shared/arkpedia/native-effect-shader.js';
import {effectMeshColors} from '../shared/arkpedia/native-effect-mesh.js';
import {createEffectPose} from '../shared/arkpedia/native-effect-pose.js';
import meta from '../data/arkpedia-lappland-effect-shaders.json' with {type:'json'};
import mvp from '../data/arkpedia-mvp.json' with {type:'json'};

const stage=`#define UNITY_LOCATION(x) layout(location = x)
#define UNITY_BINDING(x) layout(binding = x, std140)
UNITY_LOCATION(0) uniform vec4 _TintColor;
void main(){ gl_Position = _TintColor * 2.0; }
`;
const source=`#ifdef VERTEX\n#version 300 es\n${stage}\n#endif\n#ifdef FRAGMENT\n#version 300 es\n${stage}\n#endif\n`;
test('WebGL port changes only native stage wrappers and binding macros',()=>{
  const p=webglEffectProgram(source);
  const expected=stage.replace(' layout(location = x)','').replace('binding = x, ','');
  assert.equal(p.vertex,expected);assert.equal(p.fragment,expected+'\n');
  for(const changed of [source.replace('300 es','100'),source+'\0',source.replace('UNITY_LOCATION(x) layout(location = x)','BROKEN')]){
    assert.throws(()=>webglEffectProgram(changed));
  }
});
test('shader keyword variants require one exact native match',()=>{
  const a={keywords:[]},b={keywords:['SECOND','FIRST']},shader={programs:{a,b}};
  assert.equal(selectEffectProgram(shader,[]),a);
  assert.equal(selectEffectProgram(shader,['FIRST','SECOND','FIRST']),b);
  assert.throws(()=>selectEffectProgram(shader,['FIRST']));
  assert.throws(()=>selectEffectProgram({programs:{a,also:a}},[]));
});

test('native integer branches and matrix arrays cannot be silently omitted',()=>{
  const port={vertex:'uniform highp vec4 hlslcc_mtx4x4unity_MatrixVP[4];\nuniform int _ToggleUseDissolve;',
    fragment:'uniform mediump int _ToggleUseDissolve;\nuniform mediump sampler2D _MainTex;'};
  assert.deepEqual(effectUniformDeclarations(port),[
    {type:'vec4',name:'hlslcc_mtx4x4unity_MatrixVP',count:4},
    {type:'int',name:'_ToggleUseDissolve',count:null},{type:'sampler2D',name:'_MainTex',count:null}]);
  assert.throws(()=>effectUniformDeclarations({vertex:'uniform mat4 _Matrix;',fragment:''}),/Unsupported/);
  assert.throws(()=>effectUniformDeclarations({vertex:'uniform int _Toggle;',fragment:'uniform float _Toggle;'}),/Conflicting/);
});

test('source UNorm8 colors normalize RGB and alpha once before particle tint',()=>{
  const mesh={positions:[[0,0,0],[1,0,0]],colors:[[255,128,0,102],[32,255,255,0]],
    vertexChannels:[{},{},{},{dimension:4,format:2}]};
  const original=structuredClone(mesh);
  assert.deepEqual(effectMeshColors(mesh),[1,128/255,0,.4,32/255,1,1,0]);
  assert.deepEqual(effectMeshColors(mesh,[.5,1,2,.25]),[.5,128/255,0,.1,16/255,1,2,0]);
  assert.deepEqual(mesh,original);
  const floating={...mesh,colors:[[1,.5,0,.4],[.2,1,1,0]],vertexChannels:[{},{},{},{dimension:4,format:0}]};
  assert.deepEqual(effectMeshColors(floating),floating.colors.flat());
  for(const format of [3,6])assert.throws(()=>effectMeshColors({...mesh,vertexChannels:[{},{},{},{dimension:4,format}]}),/Unsupported/);
  assert.throws(()=>effectMeshColors({...mesh,colors:[[256,0,0,0],[0,0,0,0]]}),/UNorm8/);
  assert.throws(()=>effectMeshColors({...mesh,vertexChannels:[]}),/descriptor/);
  assert.deepEqual(effectMeshColors({...mesh,colors:null,vertexChannels:[{},{},{},{dimension:0,format:0}]}),[1,1,1,1,1,1,1,1]);
});

function fixture(){
  const records={};
  const ref=(field,target)=>({field,target});
  const add=(id,type,data,references=[])=>records[id]={type,data,references};
  const transform={m_LocalPosition:{x:0,y:0,z:0},m_LocalRotation:{x:0,y:0,z:0,w:1},m_LocalScale:{x:1,y:1,z:1}};
  add('root','GameObject',{m_Name:'root',m_IsActive:true},[ref('component','tr'),ref('component','animator')]);
  add('tr','Transform',transform,[ref('m_GameObject','root'),ref('m_Children','ta'),ref('m_Children','tb')]);
  for(const id of ['a','b']){
    add(id,'GameObject',{m_Name:id,m_IsActive:true},[ref('component','t'+id),ref('component','r'+id)]);
    add('t'+id,'Transform',structuredClone(transform),[ref('m_GameObject',id)]);
    add('r'+id,'MeshRenderer',{m_Enabled:true},[ref('m_Materials','mat')]);
  }
  add('animator','Animator',{},[ref('m_GameObject','root')]);
  add('mat','Material',{m_SavedProperties:{m_Floats:[['_Amount',.2]],m_Colors:[['_TintColor',{r:1,g:1,b:1,a:1}]],
    m_TexEnvs:[['_MainTex',{m_Scale:{x:1,y:1},m_Offset:{x:0,y:0}}]]}});
  const channels=[0,1,2,3,90,.8,.4,.25].map(value=>({kind:'constant',value}));
  const clip={start:0,stop:2,loop:false,channels,bindings:[{offset:0,size:1},{offset:1,size:3},{offset:4,size:1},{offset:5,size:1},{offset:6,size:1},{offset:7,size:1}]};
  const animations={clips:{clip},instances:[{animator:'animator',clip:'clip',bindings:[
    {gameObject:'root',component:'root',property:'m_IsActive'},
    {gameObject:'a',component:'ta',property:'m_LocalPosition'},
    {gameObject:'a',component:'ra',property:'material._Amount'},
    {gameObject:'a',component:'ra',property:'material._TintColor.a'},
    {gameObject:'a',component:'ra',property:'material._MainTex_ST.z'},
    {gameObject:'a',component:'a',property:'m_IsActive'}]}]};
  return {pack:{records,roots:{effect:'root'}},animations};
}
test('explicit poses isolate shared material instances, reset on scrub, and propagate parent activation',()=>{
  const {pack,animations}=fixture(),before=structuredClone({pack,animations}),pose=createEffectPose(pack,animations,'effect');
  const state=pose.sample(1,'clip');
  assert.deepEqual(state.nodes.get('ta').position,[1,2,3]);
  assert.equal(state.nodes.get('ta').active,true);assert.equal(state.nodes.get('ta').visible,false);
  assert.equal(state.nodes.get('tb').visible,false);
  assert.equal(state.renderers.get('ra').materials[0].properties._Amount,90);
  assert.equal(state.renderers.get('ra').materials[0].properties._TintColor[3],.8);
  assert.deepEqual(state.renderers.get('ra').materials[0].properties._MainTex_ST,[1,1,.4,0]);
  assert.equal(state.renderers.get('rb').materials[0].properties._Amount,.2);
  state.renderers.get('ra').materials[0].properties._Amount=999;
  assert.equal(pose.sample(0,'clip').renderers.get('ra').materials[0].properties._Amount,90);
  const reset=pose.sample(0);
  assert.equal(reset.nodes.get('ta').visible,true);assert.deepEqual(reset.nodes.get('ta').position,[0,0,0]);
  assert.equal(reset.renderers.get('ra').materials[0].properties._Amount,.2);
  assert.deepEqual({pack,animations},before);
  assert.throws(()=>pose.sample(0,'other'),/outside/);
});
test('pose rejects ambiguous hierarchies and unresolved animated properties',()=>{
  const f=fixture();f.pack.records.tr.references.push({field:'m_Children',target:'ta'});
  assert.throws(()=>createEffectPose(f.pack,f.animations,'effect'),/Ambiguous/);
  const g=fixture();g.animations.instances[0].bindings[2].property='material._Unknown';
  assert.throws(()=>createEffectPose(g.pack,g.animations,'effect').sample(0,'clip'),/Missing animated/);
});
test('shader recovery does not prematurely enable battle support or claim frame parity',()=>{
  assert.deepEqual(meta.counts,{shaders:12,programs:23});
  assert.equal(Object.keys(meta.shaders).length,12);
  assert.equal(Object.values(meta.shaders).reduce((n,s)=>n+Object.keys(s.programs).length,0),23);
  assert.deepEqual(meta.scope,{nativeSourceOnly:true,rendererVerified:false,compiledFrameParity:false,enabledOperators:[]});
  assert.equal(Object.hasOwn(mvp.operators,'char_1038_whitw2'),false);
});
