// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with{type:'json'};
import native from '../data/arkpedia-hui-ming-tile-source.json' with{type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild} from '../shared/arkpedia/loadout.js';
import {huiMingOf} from '../server/sim/content/arkpedia-hui-ming.js';
import {compileHuiMingTiles,hasHuiMingTiles,huiMingMarkParameters,validateHuiMingProgram,HUI_MING_TILE_KEYS} from '../shared/arkpedia/stage-hui-ming.js';
import {compileStageHuiMing,huiMingTilesReviewed} from '../tools/arkpedia/stage-hui-ming.mjs';
const bb=(dynamic=0)=>({'buff_yinyang[diff].atk_scale':1.4,'buff_yinyang[same].atk_scale':.6,dynamic});
// A cut of an original Hui-Ming stage's exported geometry: two mark forms, one switch and ordinary tiles.
const geometry=()=>({rows:3,cols:4,tileLegend:[
 {key:'tile_forbidden',height:'high',walkable:false,deployable:'none',flyable:true},
 {key:'tile_road',height:'low',walkable:true,deployable:'melee',flyable:true},
 {key:'tile_yinyang_switch',height:'low',walkable:true,deployable:'none',flyable:true},
 {key:'tile_yinyang_road',height:'low',walkable:true,deployable:'melee',flyable:true,blackboard:bb(0)},
 {key:'tile_yinyang_wall',height:'high',walkable:false,deployable:'ranged',flyable:true,blackboard:bb(1)}],
 tileGrid:[[0,0,4,0],[1,2,3,1],[0,0,0,0]]});
test('the retained tile prefabs and templates are the reviewed ones',()=>{
 assert.equal(huiMingTilesReviewed(),true);assert.deepEqual(Object.keys(native.prefabs).sort(),[...HUI_MING_TILE_KEYS].sort());
 for(const edit of[e=>e.prefabs.tile_yinyang_road.components[0].data._clearBuffsWhenLeft=1,e=>e.prefabs.tile_yinyang_wall.components[0].data._applyToEnemyWhenSwitchMode=1,e=>e.prefabs.tile_yinyang_road.components[0].data._dynamicBuffs.reverse(),
  e=>e.prefabs.tile_yinyang_switch.components[0].data._buffs[0].templateKey='empty',e=>e.prefabs.tile_yinyang_switch.components[0].data._targetOptions.targetMotion=3,e=>delete e.prefabs.tile_yinyang_wall,
  e=>e.templates.buff_yinyang_switch.eventToActions.ON_BUFF_START=[],e=>e.templates['buff_yinyang[log]'].eventToActions.ON_BUFF_START[0]._additionValue=2,e=>e.templates.extra={}]){
  const copy=structuredClone(native);edit(copy);assert.equal(huiMingTilesReviewed(copy),false,edit.toString());assert.throws(()=>compileStageHuiMing(geometry(),copy),/Unreviewed Hui-Ming tile source/);}
});
test('a stage geometry compiles to mark cells with their own mode and scales, and switch cells',()=>{
 assert.equal(hasHuiMingTiles(geometry()),true);
 assert.deepEqual(compileStageHuiMing(geometry()),{kind:'huiMing',marks:[{row:0,col:2,mode:1,same:.6,diff:1.4},{row:1,col:2,mode:0,same:.6,diff:1.4}],switches:[{row:1,col:1}],scanInterval:.1});
 const plain=geometry();plain.tileLegend=plain.tileLegend.slice(0,2);plain.tileGrid=[[0,0,0,0],[1,1,1,1],[0,0,0,0]];assert.equal(hasHuiMingTiles(plain),false);assert.equal(compileStageHuiMing(plain),null);assert.equal(compileHuiMingTiles(plain),null);
 validateHuiMingProgram(compileStageHuiMing(geometry()));
});
test('unknown tile blackboards, changed placement rules and malformed maps are refused, not ignored',()=>{
 for(const edit of[
  g=>g.tileLegend[3].blackboard.act49side_boss_level_tile_mark='right_hand',g=>delete g.tileLegend[3].blackboard.dynamic,g=>g.tileLegend[3].blackboard.dynamic=2,g=>g.tileLegend[4].blackboard['buff_yinyang[same].atk_scale']=-1,
  g=>delete g.tileLegend[4].blackboard,g=>g.tileLegend[3].deployable='ranged',g=>g.tileLegend[4].height='low',g=>g.tileLegend[3].walkable=false,g=>g.tileLegend[2].deployable='melee',g=>g.tileLegend[2].blackboard={dynamic:0},
  g=>g.tileLegend[3].effects=[{key:'x'}],g=>g.tileGrid.pop(),g=>g.tileGrid[0].push(0),g=>g.tileGrid[1][3]=9,
 ]){const g=geometry();edit(g);assert.throws(()=>compileStageHuiMing(g),/Hui-Ming|Unknown stage tile/,edit.toString());}
 assert.throws(()=>huiMingMarkParameters([]),/Unsupported Hui-Ming mark tile blackboard/);
 for(const bad of[null,{kind:'reeds'},{kind:'huiMing',marks:[],switches:[],scanInterval:.1},{kind:'huiMing',marks:[{}],switches:[],scanInterval:0},{kind:'huiMing',marks:[{}],switches:[],scanInterval:.1,extra:1}])assert.throws(()=>validateHuiMingProgram(bad),/Unsupported Hui-Ming tile program/);
});
test('a compiled stage installs the tile controller, and a deployed operator takes the mark attribute',()=>{
 const src=structuredClone(data);src.stage.geometry.waves[0].spawns=[];
 // The embedded default stage has a melee road tile at (3,4); mark it and add a switch on its lane.
 src.stage.huiMing={kind:'huiMing',marks:[{row:3,col:4,mode:1,same:.6,diff:1.4}],switches:[{row:3,col:6}],scanInterval:.1};
 const id=Object.keys(src.operators).find(k=>src.operators[k].position==='MELEE')??Object.keys(src.operators)[0],b=new StandardBattle(src,{operators:[defaultBuild(src.operators[id])]});
 assert.ok(b.stageHuiMing);assert.equal(b.stageHuiMing.modeAt(3,4),1);assert.equal(b.stageHuiMing.modeAt(3,5),null);
 b.autoFinish=false;b.setViewport('fullscreen-workspace');b.getPlayer('arkpedia').dp=80;const unit=b.deployOperator(id,3,4,'RIGHT');assert.ok(unit);for(let i=0;i<6;i++)b.step();
 assert.equal(huiMingOf(unit),'yang');assert.ok(unit.findBuff('buff_yinyang[same]')&&unit.findBuff('buff_yinyang[diff]'));assert.equal(b.stageHuiMing.flip(3,4),0);assert.equal(huiMingOf(unit),'yin');assert.deepEqual(b.errors,[]);
 const plain=new StandardBattle(structuredClone(data),{operators:[defaultBuild(data.operators[id])]});assert.equal(plain.stageHuiMing??null,null);
 const broken=structuredClone(src);broken.stage.huiMing.kind='other';assert.throws(()=>new StandardBattle(broken,{operators:[defaultBuild(src.operators[id])]}),/Unsupported Hui-Ming tile program/);
});
