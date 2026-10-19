// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {aphrissaData as data} from './helpers/aphrissa-data.js';
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild} from '../shared/arkpedia/loadout.js';
import {APHRISSA_HIT_STYLES as styles,validateAphrissaHit,validateAphrissaHitSources} from '../shared/arkpedia/aphrissa-hit-presentation.js';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {makeDamageInfo} from '../server/sim/damage.js';
const ID='char_4229_aphris',fixtures=[];
test.afterEach(()=>{for(const f of fixtures.splice(0)){f.c.stop();assert.deepEqual(f.b.errors,[]);}});
function make(skill=1){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 d.stage.geometry.rows=19;d.stage.geometry.cols=21;d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
 const b=new StandardBattle(d,{operators:[{...defaultBuild(d.operators[ID]),skillId:`skchr_aphris_${skill}`},defaultBuild(d.operators.char_122_beagle)]});
 b.autoFinish=false;b.setViewport('fullscreen-workspace');b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));b.getPlayer('arkpedia').dp=99;
 const u=b.deployOperator(ID,5,5,'RIGHT'),c=u.mem.aphrissaOwner,p=u.mem.aphrissaHitPresentation,f={b,u,c,p,hits:[]};fixtures.push(f);
 b.on('damaged',h=>{if(h.source===u)f.hits.push({time:b.time,target:h.target.id,amount:h.amount,tags:h.dmg.tags});});return f;
}
function advance(f,seconds){for(let n=0;n<Math.ceil(seconds/f.b.dt-1e-9);n++)f.b.step();}
function until(f,p,seconds=15){const end=f.b.time+seconds;while(!p()&&f.b.time<end)f.b.step();assert.ok(p(),'Missing source presentation at '+f.b.time);}
function enemy(f,row=5,col=6){const t=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(t.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});t.markDirty();void t.s;t.hp=1e9;f.b.addBuff(t,{key:'fixture:pin',flags:{noMove:true,disarm:true}});f.b._buildEnemyIndex();return t;}
function relay(f,row,col,dir){const t=f.b.spawnToken('arkpedia','token_10070_aphris_pc',row,col,{dir,def:f.c.deck.def,kit:{trait:{noAttack:true},talents:[],skill:{kind:'passive'}}});assert.ok(t);return t;}
function fill(f){f.u.skill.gainSp(f.u.skill.spCost,'fixture');}
function cast(f){fill(f);assert.equal(f.b.activateOperator(ID),true);}
test('source hit prefabs are complete, clipless, nonlooping and bounded by the explicit retention window',async t=>{
 let pack,animations;
 try{pack=JSON.parse(gunzipSync(await readFile('.cache/arkpedia/aphrissa-source/effects/native-effects.bin')));
 animations=JSON.parse(await readFile('.cache/arkpedia/aphrissa-source/effects/native-animations.json','utf8'));}
 catch(e){if(e.code==='ENOENT')return t.skip('Original source cache unavailable');throw e;}
 const result=validateAphrissaHitSources(pack,animations);assert.deepEqual(result.map(r=>r.particles),[19,19,27]);
 for(const change of [d=>d._isLoop=1,d=>d._spawnLocation=0,d=>d._holdByOwner=1,d=>d._delayToFinish=0]){
  const p=structuredClone(pack);change(p.records[result[0].fx].data);assert.throws(()=>validateAphrissaHitSources(p,animations));
 }
 const p=structuredClone(pack),particle=Object.values(p.records).find(r=>r.type==='ParticleSystem'&&r.data.lengthInSec===3);
 particle.data.lengthInSec=30;assert.throws(()=>validateAphrissaHitSources(p,animations));
});
test('each staggered ordinary recipient gets its own damage receipt, timestamp and frozen target position',()=>{
 const f=make(),a=enemy(f),z=enemy(f,5,7);until(f,()=>f.p.snapshot().length>0);
 const [first]=f.p.snapshot();validateAphrissaHit(first);assert.equal(first.targetId,a.id);assert.equal(first.mode,'normal');
 assert.equal(first.startedAt,f.hits[0].time);assert.equal(first.root,styles.normal.root);assert.equal(f.p.snapshot().length,1);
 until(f,()=>f.p.snapshot().length===2,.3);const second=f.p.snapshot()[1];assert.equal(second.targetId,z.id);
 assert.equal(second.attackId,first.attackId);assert.ok(second.startedAt>first.startedAt);
 a.x+=.3;a.y+=.1;assert.deepEqual(f.p.snapshot()[0],first);
 f.b.kill(a,null);assert.deepEqual(f.p.snapshot()[0],first);
 const copied=f.p.snapshot();copied[0].x=999;assert.deepEqual(f.p.snapshot()[0],first);
 f.b.addBuff(f.u,{key:'fixture:stop',flags:{disarm:true}});advance(f,8.1);assert.deepEqual(f.p.snapshot(),[]);
});
for(const state of ['shield','zero','dodge','miss','cancel','final-cancel','immune'])test(`main delivery ${state} has the explicit receipt policy`,()=>{
 const f=make(),e=enemy(f);
 if(state==='shield')f.b.addBuff(e,{key:state,shield:1e9});
 if(state==='dodge')f.b.addBuff(e,{key:state,mods:{dodgeArts:1}});
 if(state==='miss')f.b.addBuff(f.u,{key:state,mods:{hitRateArts:-1}});
 if(state==='immune')f.b.addBuff(e,{key:state,flags:{invulnerable:true}});
 if(state==='cancel'||state==='zero')f.b.on('hit',h=>{if(h.source===f.u){if(state==='cancel')h.dmg.cancel=true;else h.dmg.amount=0;}});
 if(state==='final-cancel')f.b.on('damageFinal',h=>{if(h.source===f.u)h.cancel=true;});
 until(f,()=>f.u.stats.attacks>0);advance(f,.1);
 assert.equal(f.p.snapshot().length,['shield','zero'].includes(state)?1:0);
 if(state==='shield'||state==='zero')assert.equal(e.hp,1e9);
});
for(const skill of [1,2,3])test(`S${skill} main hits select their exact source root and ignore independent damage`,()=>{
 const f=make(skill),e=enemy(f);relay(f,5,7,'UP');advance(f,1.1);
 if(skill===1){fill(f);until(f,()=>f.c.mode==='s1');}else{cast(f);if(skill===3)until(f,()=>f.c.state?.stage==='active',4);}
 until(f,()=>f.p.snapshot().some(t=>t.mode===`s${skill}`));
 const records=f.p.snapshot().filter(t=>t.mode===`s${skill}`),main=f.hits.filter(h=>h.tags.includes(`aphrissa:s${skill}`));
 assert.equal(records.length,main.length);assert.ok(records.every(r=>r.root===styles[`s${skill}`].root));
 const before=f.p.snapshot();f.b.dealDamage(f.u,e,{amount:1,type:'arts',isAttack:true,attackId:records[0].attackId,tags:[`aphrissa:s${skill}`]});
 assert.deepEqual(f.p.snapshot(),before);
 if(skill===3)assert.ok(f.hits.length>main.length,'Independent S3 producer hits do not duplicate the main hit effect');
});
test('an empty S2 pulse does not fabricate target hit effects',()=>{
 const f=make(2);advance(f,1.1);cast(f);advance(f,1);assert.equal(f.u.stats.attacks,0);assert.deepEqual(f.p.snapshot(),[]);
});
test('lethal hits retain their accepted position; target replacements and forged nested receipts cannot take ownership',()=>{
 const f=make(),e=enemy(f);e.hp=1;
 f.b.on('damaged',h=>{if(h.source===f.u){f.p.receive({...h,dmg:makeDamageInfo(h.dmg)});f.p.receive(h);}});
 until(f,()=>f.p.snapshot().length>0);assert.equal(e.alive,false);const [hit]=f.p.snapshot();assert.equal(hit.targetId,e.id);assert.equal(hit.targetLife,e.deploySeq);
 e.deploySeq++;e.x+=2;assert.deepEqual(f.p.snapshot(),[hit]);
 f.u.hidden=true;assert.deepEqual(f.p.snapshot(),[]);f.u.hidden=false;assert.deepEqual(f.p.snapshot(),[hit]);
 f.b.retreatOperator(ID);assert.equal(f.p.stopped,true);assert.equal(f.p.handles.length,0);assert.deepEqual(f.p.snapshot(),[]);
});
for(const skill of [1,2,3])test(`S${skill} hit observations do not alter damage, attack receipts, SP or ammo`,()=>{
 const run=enabled=>{const f=make(skill);enemy(f);if(!enabled)f.p.stop();advance(f,1.1);if(skill===1)fill(f);else cast(f);
  for(let n=0;n<180;n++){f.b.step();if(enabled){f.p.snapshot();f.p.snapshot();}}
  return{hits:f.hits,sp:f.u.skill.spTotal,ammo:f.u.skill.ammoLeft,attacks:f.u.stats.attacks,damage:f.u.stats.dmg,time:f.b.time};};
 assert.deepEqual(run(true),run(false));
});
