// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {aphrissaData as data} from './helpers/aphrissa-data.js';
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild} from '../shared/arkpedia/loadout.js';
import {APHRISSA_BEAM_STYLES as styles,validateAphrissaBeamTrack} from '../shared/arkpedia/aphrissa-beam-presentation.js';
import {aphrissaRayCells,APHRISSA_RAY_CONTRACT} from '../server/sim/content/arkpedia-aphrissa-ray.js';
const ID='char_4229_aphris',fixtures=[];
test.afterEach(()=>{for(const f of fixtures.splice(0)){f.c.stop();assert.deepEqual(f.b.errors,[]);}});
function make(skill=1){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 d.stage.geometry.rows=19;d.stage.geometry.cols=21;d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
 const b=new StandardBattle(d,{operators:[{...defaultBuild(d.operators[ID]),skillId:`skchr_aphris_${skill}`},defaultBuild(d.operators.char_122_beagle)]});
 b.autoFinish=false;b.setViewport('fullscreen-workspace');b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));b.getPlayer('arkpedia').dp=99;
 const u=b.deployOperator(ID,5,5,'RIGHT'),c=u.mem.aphrissaOwner,p=u.mem.aphrissaLinePresentation,f={b,u,c,p,hits:[]};fixtures.push(f);
 b.on('damaged',h=>{if(h.source===u)f.hits.push({time:b.time,target:h.target.id,amount:h.amount,tags:h.dmg.tags});});return f;
}
function advance(f,seconds){for(let n=0;n<Math.ceil(seconds/f.b.dt-1e-9);n++)f.b.step();}
function until(f,p,seconds=15){const end=f.b.time+seconds;while(!p()&&f.b.time<end)f.b.step();assert.ok(p(),'Missing source presentation at '+f.b.time);}
function enemy(f,row=5,col=6){const t=f.b.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(t.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});t.markDirty();void t.s;t.hp=1e9;f.b.addBuff(t,{key:'fixture:pin',flags:{noMove:true,disarm:true}});f.b._buildEnemyIndex();return t;}
function relay(f,row,col,dir){const t=f.b.spawnToken('arkpedia','token_10070_aphris_pc',row,col,{dir,def:f.c.deck.def,kit:{trait:{noAttack:true},talents:[],skill:{kind:'passive'}}});assert.ok(t);return t;}
function fill(f){f.u.skill.gainSp(f.u.skill.spCost,'fixture');}
function cast(f){fill(f);assert.equal(f.b.activateOperator(ID),true);}
test('ordinary shots capture the actual relay ray at the accepted marker and retain its finite source clock',()=>{
 const f=make(),t=relay(f,5,7,'UP');enemy(f);assert.deepEqual(f.p.snapshot(),[]);
 until(f,()=>f.p.snapshot().length>0);const [track]=f.p.snapshot();validateAphrissaBeamTrack(track);
 assert.equal(f.hits.length,1);assert.equal(track.mode,'normal');assert.equal(track.clip,styles.normal.clip.id);
 assert.equal(track.ownerId,f.u.id);assert.equal(track.ownerLife,f.u.deploySeq);
 assert.deepEqual(track.points.map(p=>[p.role,p.row,p.col]),[['start',5,5],['waypoint',5,7],['end',10,7]]);
 assert.equal(track.points[1].unitId,t.id);assert.equal(track.points[1].fixedHeight,.6499999761581421);
 t.dir='DOWN';assert.deepEqual(f.p.snapshot()[0].points,track.points);
 advance(f,styles.normal.clip.duration+.05);assert.deepEqual(f.p.snapshot(),[]);
});
test('captured ray cycles retain ordered repeated waypoints without duplicate damage cells',()=>{
 const f=make();relay(f,5,6,'RIGHT');relay(f,5,7,'LEFT');enemy(f);
 const ray=aphrissaRayCells(f.b,f.u,{contract:APHRISSA_RAY_CONTRACT,includePath:true});
 assert.equal(ray.cycle,true);assert.deepEqual(ray.path.map(p=>[p.row,p.col]),[[5,5],[5,6],[5,7],[5,6]]);
 assert.equal(new Set(ray.cells.map(c=>`${c.row},${c.col}`)).size,ray.cells.length);
 until(f,()=>f.p.snapshot().length>0);
 assert.deepEqual(f.p.snapshot()[0].points.map(p=>[p.row,p.col]),[[5,5],[5,6],[5,7],[5,6]]);
 assert.equal(f.hits.length,1);
});
test('removed relay lives cannot retain or resurrect an accepted finite beam',()=>{
 const f=make(),t=relay(f,5,7,'UP');enemy(f);until(f,()=>f.p.snapshot().length>0);
 f.b.retreat(t,{permanent:true});assert.deepEqual(f.p.snapshot(),[]);
 const replacement=relay(f,5,7,'UP');assert.notEqual(replacement.id,t.id);assert.deepEqual(f.p.snapshot(),[]);
 f.b.retreatOperator(ID);assert.equal(f.p.stopped,true);assert.equal(f.p.handles.length,0);assert.deepEqual(f.p.snapshot(),[]);
});
for(const skill of [1,3])test(`S${skill} accepted shots select the literal original beam without spending extra ammunition`,()=>{
 const f=make(skill);enemy(f);advance(f,1.1);
 if(skill===1){fill(f);until(f,()=>f.c.mode==='s1');}
 else{cast(f);until(f,()=>f.c.state?.stage==='active',4);}
 const mode=`s${skill}`;until(f,()=>f.p.snapshot().some(t=>t.mode===mode));const track=f.p.snapshot().find(t=>t.mode===mode);
 assert.equal(track.root,styles[mode].root);assert.equal(track.clip,styles[mode].clip.id);
 if(skill===3)assert.equal(f.u.skill.ammoLeft,19);
});
test('S2 shows its no-target beam, follows live operator turns, and samples its original End clip',()=>{
 const f=make(2);advance(f,1.1);cast(f);advance(f,.1);assert.deepEqual(f.p.snapshot(),[]);
 until(f,()=>f.p.snapshot().length>0);const [start]=f.p.snapshot();assert.equal(start.mode,'s2');assert.equal(f.u.stats.attacks,0);assert.equal(f.hits.length,0);
 const t=f.b.deployOperator('char_122_beagle',5,7,'UP');assert.ok(t);
 const [turned]=f.p.snapshot();assert.equal(turned.id,start.id);assert.equal(turned.startedAt,start.startedAt);
 assert.equal(turned.points[1].unitId,t.id);assert.deepEqual(turned.points.at(-1),{role:'end',row:f.b.grid.rect.r1,col:7});
 f.b.retreatOperator('char_122_beagle');const [straight]=f.p.snapshot();assert.equal(straight.id,start.id);assert.equal(straight.points.length,2);
 f.u.hidden=true;assert.deepEqual(f.p.snapshot(),[]);f.u.hidden=false;assert.equal(f.p.snapshot()[0].startedAt,start.startedAt);
 until(f,()=>!f.u.skill.active,9);const [end]=f.p.snapshot();assert.equal(end.stage,'end');assert.equal(end.clip,styles.s2.end.id);assert.equal(end.id,start.id);
 advance(f,styles.s2.end.duration+.05);assert.deepEqual(f.p.snapshot(),[]);assert.equal(f.u.stats.attacks,0);
});
for(const skill of [1,2,3])test(`S${skill} presentation observations leave actual damage, SP and ammo unchanged`,()=>{
 const run=enabled=>{const f=make(skill);enemy(f);if(!enabled)f.p.stop();advance(f,1.1);
  if(skill===1)fill(f);else cast(f);
  for(let n=0;n<360;n++){f.b.step();if(enabled){f.p.snapshot();f.p.snapshot();}}
  return{hits:f.hits,sp:f.u.skill.spTotal,ammo:f.u.skill.ammoLeft,attacks:f.u.stats.attacks,damage:f.u.stats.dmg,time:f.b.time};};
 assert.deepEqual(run(true),run(false));
});
