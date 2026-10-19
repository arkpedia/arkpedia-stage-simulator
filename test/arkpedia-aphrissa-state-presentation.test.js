// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import normal from '../data/arkpedia-mvp.json' with {type:'json'};
import models from '../data/arkpedia-aphrissa-review-models.json' with {type:'json'};
import {aphrissaReviewData} from '../tools/arkpedia/aphrissa-review-data.mjs';
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild} from '../shared/arkpedia/loadout.js';
import {APHRISSA_STATE_STYLES as styles,APHRISSA_STATE_DRAIN as drain,validateAphrissaStateSources} from '../shared/arkpedia/aphrissa-state-presentation.js';
import {createEffectPose} from '../shared/arkpedia/native-effect-pose.js';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
const ID='char_4229_aphris',data=await aphrissaReviewData(normal,models),fixtures=[];
test.afterEach(()=>{for(const f of fixtures.splice(0)){f.c.stop();assert.deepEqual(f.b.errors,[]);}});
function make(skill=1){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 d.stage.geometry.rows=19;d.stage.geometry.cols=21;d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
 const b=new StandardBattle(d,{operators:[{...defaultBuild(d.operators[ID]),skillId:`skchr_aphris_${skill}`},defaultBuild(d.operators.char_122_beagle)]});
 b.autoFinish=false;b.setViewport('fullscreen-workspace');b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));b.getPlayer('arkpedia').dp=99;
 const u=b.deployOperator(ID,5,5,'RIGHT'),c=u.mem.aphrissaOwner,p=u.mem.aphrissaStatePresentation,f={b,u,c,p,hits:[]};fixtures.push(f);
 b.on('damaged',h=>{if(h.source===u)f.hits.push({time:b.time,target:h.target.id,amount:h.amount,tags:h.dmg.tags});});return f;
}
function advance(f,seconds){for(let n=0;n<Math.ceil(seconds/f.b.dt-1e-9);n++)f.b.step();}
function until(f,p,seconds=15){const end=f.b.time+seconds;while(!p()&&f.b.time<end)f.b.step();assert.ok(p(),'Missing source presentation at '+f.b.time);}
function enemy(f,row=5,col=6){const t=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(t.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});t.markDirty();void t.s;t.hp=1e9;f.b.addBuff(t,{key:'fixture:pin',flags:{noMove:true,disarm:true}});f.b._buildEnemyIndex();return t;}
function relay(f,row,col,dir){const t=f.b.spawnToken('arkpedia','token_10070_aphris_pc',row,col,{dir,def:f.c.deck.def,kit:{trait:{noAttack:true},talents:[],skill:{kind:'passive'}}});assert.ok(t);return t;}
function fill(f){f.u.skill.gainSp(f.u.skill.spCost,'fixture');}
function cast(f){fill(f);assert.equal(f.b.activateOperator(ID),true);}
const CHARGE='aphris_sk3[charge-vfx]',WING='aphris_sk3[wing-vfx]',STATS='aphris_sk3[on_finish]',FINISH='aphris_sk3_finishvfx';
test('six original state roots keep their actual controllers, clips and mount/facing inputs',async t=>{
 let pack,animations;try{pack=JSON.parse(gunzipSync(await readFile('.cache/arkpedia/aphrissa-source/effects/native-effects.bin')));
  animations=JSON.parse(await readFile('.cache/arkpedia/aphrissa-source/effects/native-animations.json','utf8'));}
 catch(e){if(e.code==='ENOENT')return t.skip('Original source cache unavailable');throw e;}
 const result=validateAphrissaStateSources(pack,animations);assert.deepEqual(result.map(r=>r.renderers),[19,20,20,24,72,72]);
 const front=result.find(r=>r.root===styles.wing.root),pose=createEffectPose(pack,animations,styles.wing.root),original=JSON.stringify(pack);
 const [open,rotate]=front.clips,opening=new Set(pose.instances.find(i=>i.clip===open).bindings.map(b=>b.gameObject)),
  rotation=new Set(pose.instances.find(i=>i.clip===rotate).bindings.map(b=>b.gameObject));
 const onlyOpen=pose.sample(.35,open),onlyRotate=pose.sample(.35,rotate),both=pose.sample(.35,[open,rotate]);
 for(const [id,node]of both.nodes){if(opening.has(node.gameObject))assert.deepEqual(node,onlyOpen.nodes.get(id));
  if(rotation.has(node.gameObject))assert.deepEqual(node,onlyRotate.nodes.get(id));}
 assert.deepEqual(both.renderers,onlyOpen.renderers);
 assert.deepEqual(pose.sample(.35,[rotate,open]),both);pose.sample(3,[open,rotate]);assert.deepEqual(pose.sample(.35,[open,rotate]),both);
 assert.equal(JSON.stringify(pack),original);assert.throws(()=>pose.sample(.2,[open,open]),/clip set/);
 assert.throws(()=>pose.sample(.2,[]),/clip set/);assert.throws(()=>pose.sample(.2,[open,'foreign']),/outside/);
 const overlap=structuredClone(animations),instance=overlap.instances.find(i=>i.animation===pose.instances.find(i=>i.clip===rotate).animation);
 instance.bindings.push(structuredClone(pose.instances.find(i=>i.clip===open).bindings[0]));
 assert.throws(()=>createEffectPose(pack,overlap,styles.wing.root).sample(.2,[open,rotate]),/blending/);
 for(const edit of [d=>d._isLoop=0,d=>d._spawnLocation=0,d=>d._holdByOwner=0]){
  const changed=structuredClone(pack);edit(changed.records[result[1].effect].data);assert.throws(()=>validateAphrissaStateSources(changed,animations));}
});
test('S1 aura belongs to the independent accepted stat parent, not its mode/account',()=>{
 const f=make();advance(f,1.1);fill(f);until(f,()=>f.c.mode==='s1');const [aura]=f.p.snapshot();assert.equal(aura.kind,'s1');
 assert.equal(aura.startedAt,f.c.atkParent.startedAt);assert.equal(aura.activation,f.c.atkParent.activation);
 f.b.removeBuff(f.u,f.c.atkParent.buff);assert.deepEqual(f.p.snapshot(),[]);assert.equal(f.c.mode,'s1');assert.equal(f.u.skill.active,true);
});
test('S1 rejected stat parent never fabricates an aura for its accepted mode',()=>{
 const f=make();f.b.on('beforeBuff',h=>{if(h.buff.key==='aphris_sk1')h.cancel=true;});advance(f,1.1);fill(f);until(f,()=>f.c.mode==='s1');assert.deepEqual(f.p.snapshot(),[]);
});
test('S3 charge removal creates its separate original End clock; active aura and wings own distinct parents',()=>{
 const f=make(3);advance(f,1.1);cast(f);const [charge]=f.p.snapshot();assert.equal(charge.kind,'charge');assert.equal(charge.startedAt,f.b.time);
 advance(f,1);assert.equal(f.p.snapshot()[0].startedAt,charge.startedAt);until(f,()=>f.c.state?.stage==='active',4);
 const effects=f.p.snapshot();assert.deepEqual(effects.map(s=>s.kind).sort(),['active','charge','chargeEnd','wing']);
 const end=effects.find(s=>s.kind==='chargeEnd');assert.ok(end.startedAt>charge.startedAt);
 const copied=f.p.snapshot();copied[0].root='foreign';assert.notDeepEqual(f.p.snapshot(),copied);
 f.b.removeBuff(f.u,f.c.parents.get(STATS).buff);assert.equal(f.p.snapshot().some(t=>t.kind==='active'),false);assert.equal(f.p.snapshot().some(t=>t.kind==='wing'),true);
 f.b.removeBuff(f.u,f.c.parents.get(FINISH).buff);assert.equal(f.u.findBuff(WING),null);assert.equal(f.p.snapshot().find(t=>t.kind==='wing').finishedAt,f.b.time);
 advance(f,drain.wing+styles.chargeEnd.retention+.1);assert.deepEqual(f.p.snapshot(),[]);assert.equal(f.u.skill.active,true);
});
for(const key of [CHARGE,WING,STATS,FINISH])test(`S3 rejection of ${key} affects only its own original action path`,()=>{
 const f=make(3);f.b.on('beforeBuff',h=>{if(h.buff.key===key)h.cancel=true;});advance(f,1.1);cast(f);
 assert.equal(f.p.snapshot().some(t=>t.kind==='charge'),key!==CHARGE);until(f,()=>f.c.state?.stage==='active',4);
 const effects=f.p.snapshot();assert.equal(effects.some(t=>t.kind==='active'),key!==STATS);assert.equal(effects.some(t=>t.kind==='wing'),key!==WING);
 assert.equal(effects.some(t=>t.kind==='chargeEnd'),key!==CHARGE);assert.equal(f.u.skill.ammoLeft,20);
});
test('manual charge cancellation plays one End effect; hidden observation does not reset or duplicate its clock',()=>{
 const f=make(3);advance(f,1.1);cast(f);advance(f,.4);const record=f.c.parents.get(CHARGE);
 f.u.skill.end('manual');const effects=f.p.snapshot(),end=effects.find(t=>t.kind==='chargeEnd'),tail=effects.find(t=>t.kind==='charge');
 assert.equal(end.startedAt,f.b.time);assert.equal(tail.finishedAt,f.b.time);assert.ok(tail.startedAt<tail.finishedAt);
 f.p.onChargeRemoved(f.c,record);assert.deepEqual(f.p.snapshot(),effects);f.u.hidden=true;assert.deepEqual(f.p.snapshot(),[]);
 f.u.hidden=false;assert.deepEqual(f.p.snapshot(),effects);advance(f,styles.chargeEnd.retention+.1);
 assert.equal(f.p.snapshot().find(t=>t.kind==='chargeEnd').finishedAt,end.startedAt+styles.chargeEnd.retention);
 advance(f,drain.chargeEnd+.1);assert.deepEqual(f.p.snapshot(),[]);
});
test('owner replacement and retreat retire every state owner and callback',()=>{
 const f=make(3);advance(f,1.1);cast(f);assert.ok(f.p.snapshot().length);f.u.deploySeq++;assert.deepEqual(f.p.snapshot(),[]);
 assert.equal(f.p.stopped,true);assert.equal(f.p.handles.length,0);
 const swapped=make(3);advance(swapped,1.1);cast(swapped);swapped.u.mem.aphrissaOwner={};assert.deepEqual(swapped.p.snapshot(),[]);
 const g=make(3);advance(g,1.1);cast(g);g.b.retreatOperator(ID);assert.deepEqual(g.p.snapshot(),[]);assert.equal(g.p.handles.length,0);
});
for(const skill of [1,3])test(`S${skill} repeated state observations leave gameplay accounting unchanged`,()=>{
 const run=enabled=>{const f=make(skill);enemy(f);if(!enabled)f.p.stop();advance(f,1.1);if(skill===1)fill(f);else cast(f);
  for(let n=0;n<180;n++){f.b.step();if(enabled){f.p.snapshot();f.p.snapshot();}}
  return{hits:f.hits,sp:f.u.skill.spTotal,ammo:f.u.skill.ammoLeft,attacks:f.u.stats.attacks,damage:f.u.stats.dmg};};
 assert.deepEqual(run(true),run(false));
});
test('particle retirement retains the authored bound without rounding it to an earlier finish',()=>{
 const f=make(3);advance(f,1.1);cast(f);advance(f,.4);f.u.skill.end('manual');
 const tail=f.p.snapshot().find(t=>t.kind==='charge'),deadline=tail.finishedAt+drain.charge;
 f.b.time=deadline-1e-8;assert.ok(f.p.snapshot().some(t=>t.id===tail.id));
 f.b.time=deadline;assert.equal(f.p.snapshot().some(t=>t.id===tail.id),false);
});
