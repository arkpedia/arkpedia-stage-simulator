import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { sampleCurve, sampleColor, createParticleBurst, validateParticlePack, skillBurstKey, unityToBoard } from '../shared/arkpedia/particles.js';
import pack from './fixtures/arkpedia-dp-effect.json' with {type:'json'};
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import evidence from '../data/arkpedia-skill-prefabs.json' with {type:'json'};
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);

test('particle fixtures match the immutable asset pack and original skill prefab bindings', async()=>{
  const bytes=await readFile(new URL('./fixtures/arkpedia-dp-effect.json',import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),data.skillEffects.pack.sha256);
  assert.equal(bytes.length,data.skillEffects.pack.bytes);
  for (const binding of Object.values(data.skillEffects.bindings))
    assert.ok(evidence.prefabs[binding.prefabId].effectKeys.includes(pack.key));
  assert.equal(pack.source.version,evidence.source.version);
  assert.deepEqual(pack.source.bundles[0],evidence.source.bundles.at(-1));
  assert.equal(pack.scope.implemented,'activation-burst');
  assert.ok(pack.scope.deferred[0].includes('flight'));
});

test('curves preserve source Hermite tangents, multiplier and constant ranges',()=>{
  const curve={mode:1,value:2,min:0,keys:[[0,0,0,0],[1,1,0,0]]};
  near(sampleCurve(curve,.25),.3125);
  near(sampleCurve(curve,.5),1);
  near(sampleCurve(curve,-1),0); near(sampleCurve(curve,2),2);
  near(sampleCurve({mode:3,min:.45,value:.55},0,.25),.475);
  const source=pack.emitters.find(e=>e.id==='andi').sizeOverLife;
  near(sampleCurve(source,source.keys[1][0]),source.keys[1][1]*source.value);
});

test('colour and alpha timelines are independent and preserve authored key counts',()=>{
  const gradient={mode:1,rgb:[[.2,1,0,0],[.8,0,0,1]],alpha:[[0,0],[.4,1],[1,0]]};
  assert.deepEqual(sampleColor(gradient,0),[1,0,0,0]);
  const value=sampleColor(gradient,.5);
  near(value[0],.5);near(value[2],.5);near(value[3],5/6);
  const spark=pack.emitters.find(e=>e.id==='xingdian').colorOverLife;
  assert.equal(spark.rgb.length,2);assert.equal(spark.alpha.length,5);
  const end=sampleColor(spark,1);
  assert.deepEqual(end.slice(0,3),spark.rgb.at(-1).slice(1));
  assert.equal(end[3],0);
});

test('source burst counts, lifetimes and birth sub-emission remain bounded and deterministic',()=>{
  const a=createParticleBurst(pack,123),b=createParticleBurst(pack,123);
  assert.equal(a.sample(0).length,8); // Five sparks, one local glow, flash and point.
  assert.equal(a.sample(0).filter(p=>p.emitter==='andi_11').length,0);
  assert.equal(a.sample(.11).filter(p=>p.emitter==='andi_11').length,5);
  assert.deepEqual(a.sample(.23),b.sample(.23));
  assert.notDeepEqual(a.sample(.23),createParticleBurst(pack,124).sample(.23));
  assert.deepEqual(a.sample(a.duration),[]);
  assert.deepEqual(a.sample(-1),[]);
  assert.deepEqual(a.sample(.23),a.sample(.23)); // A frozen clock changes nothing.
  assert.deepEqual(unityToBoard([1,2,3]),[1,3,2]);
  for (let time=0;time<1;time+=1/120) for (const p of a.sample(time)) {
    assert.ok(p.size>=0);assert.ok([...p.position,...p.color,p.size,p.rotation].every(Number.isFinite));
  }
});

test('new unsupported renderer/curve/shape/sub-emitter data fails closed',()=>{
  for (const change of [p=>p.emitters[0].alignment=4, p=>p.emitters[0].lifetime.mode=2,
    p=>p.emitters[0].shape.type=5, p=>p.emitters[0].birthEmitter='xingdian',
    p=>p.emitters[0].rate.value=10000, p=>p.emitters[0].transform.scale[0]=2,
    p=>p.emitters[0].sizeOverLife.keys[1][0]=0,
    p=>p.emitters[0].material.texture='missing']) {
    const bad=structuredClone(pack);change(bad);
    assert.throws(()=>validateParticlePack(bad),/Unsupported/);
  }
});

test('only actual Fang and Vanilla skill activations resolve the reviewed effect',()=>{
  for(const id of ['char_123_fang','char_240_wyvern','char_209_ardign']) {
    const b=new StandardBattle(data,{operators:[defaultBuild(data.operators[id])]});
    b.setViewport('fullscreen-workspace');b.addDp('arkpedia',40);
    const u=b.deployOperator(id,2,7,'RIGHT');
    assert.equal(skillBurstKey(u,data.skillEffects.bindings),id==='char_209_ardign'?null:pack.key);
    const original=u.skill.id;u.skill.id='other';
    assert.equal(skillBurstKey(u,data.skillEffects.bindings),null);u.skill.id=original;
    u.side='enemy';assert.equal(skillBurstKey(u,data.skillEffects.bindings),null);
  }
});

class FakeMesh {
  constructor(texture,vertices){this.vertices=vertices;this.destroyed=false;}
  destroy(){this.destroyed=true;}
}
globalThis.PIXI={SimpleMesh:FakeMesh,BLEND_MODES:{ADD:1,NORMAL:0}};
const src=(await readFile(new URL('../public/arkpedia/particles.js',import.meta.url),'utf8'))
  .replaceAll("'/shared/arkpedia/",`'${new URL('../shared/arkpedia/',import.meta.url).href}`);
const {SkillParticleLayer}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));

test('render lifecycle deduplicates activation, freezes with clock, expires and disposes',()=>{
  const stage={children:[],addChild(m){this.children.push(m);}};
  let disposed=false;
  const layer=new SkillParticleLayer(stage,{pack,textures:{star_02:{},star_15:{}},bindings:data.skillEffects.bindings,dispose(){disposed=true;}});
  const projection={project(x,y,z){return {x:x*100,y:(y-z)*100,s:100};}};
  const unit={id:'op:1',defId:'char_123_fang',side:'ally',x:2,y:3,
    skill:{id:'skcom_charge_cost[1]',lastStart:20,activations:1}};
  layer.trigger(unit,20);layer.trigger(unit,20);
  assert.equal(layer.instances.length,1);
  layer.render(20.08,projection,()=>0);
  const before=stage.children.map(m=>[...m.vertices,m.alpha,m.tint]);
  layer.render(20.08,projection,()=>0);
  assert.deepEqual(stage.children.map(m=>[...m.vertices,m.alpha,m.tint]),before);
  layer.render(21,projection,()=>0);
  assert.equal(layer.instances.length,0);assert.ok(stage.children.every(m=>m.destroyed));
  layer.trigger(unit,21);assert.equal(layer.instances.length,0);
  unit.skill.activations++;unit.skill.lastStart=25;layer.trigger(unit,25);
  assert.equal(layer.instances.length,1);
  layer.render(25.2,projection,()=>0);layer.dispose();
  assert.equal(layer.instances.length,0);assert.ok(disposed);
  assert.ok(stage.children.every(m=>m.destroyed));
});
