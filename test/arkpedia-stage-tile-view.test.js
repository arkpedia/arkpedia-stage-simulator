// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import base from '../data/arkpedia-mvp.json' with {type:'json'};
import source from '../data/candidates/arkpedia-stage-17-14-source.json' with {type:'json'};
import {stageTileView} from '../public/arkpedia/stage-tile-view.js';
import {stage17_14MechanicsPlan} from '../shared/arkpedia/stage17-14-mechanics.js';

test('original stage tile palette and deployment affordances follow their source legend',()=>{
 const g={tileLegend:base.stage.geometry.tileLegend,tileGrid:[[0,1,2,3,4]]};
 const views=g.tileGrid[0].map((_,c)=>stageTileView(g,0,c));
 assert.deepEqual(views.map(v=>v.color),['#172329','#59666b','#35464b','#aa4b40','#377787']);
 assert.deepEqual(views.map(v=>v.interactive),[false,true,true,false,false]);
 assert.deepEqual(views.map(v=>v.raised),[true,true,false,false,false]);
});

test('17-14 interactive tiles and height labels match the actual engine terrain rather than geometry index',()=>{
 const g=source.geometry,p=stage17_14MechanicsPlan();
 for(let r=0;r<g.rows;r++)for(let c=0;c<g.cols;c++){
  const v=stageTileView(g,r,c),t=p.layout.stage.legend[p.layout.stage.rows[r][c]];
  assert.equal(v.interactive,t.build!=='NONE');assert.equal(v.raised,t.height==='HIGH');
 }
 assert.equal(g.tileGrid[3][6],4);assert.equal(stageTileView(g,3,6).interactive,true);assert.equal(stageTileView(g,3,6).raised,false);
 assert.equal(g.tileGrid[3][3],2);assert.equal(stageTileView(g,3,3).raised,true);
 assert.equal(g.tileGrid[5][3],6);assert.equal(stageTileView(g,5,3).interactive,true);
 assert.equal(stageTileView(g,1,1).interactive,false);assert.equal(stageTileView(g,1,1).raised,false);
});

test('reordering a stage legend leaves every tile appearance and input affordance unchanged',()=>{
 for(const original of [base.stage.geometry,source.geometry]){
  const changed=structuredClone(original),n=changed.tileLegend.length;changed.tileLegend.reverse();changed.tileGrid=changed.tileGrid.map(row=>row.map(i=>n-1-i));
  for(let r=0;r<original.rows;r++)for(let c=0;c<original.cols;c++)assert.deepEqual(stageTileView(changed,r,c),stageTileView(original,r,c));
 }
});

test('missing terrain metadata cannot silently become a legal placement button',()=>{
 for(const g of [{tileGrid:[[0]],tileLegend:[]},{tileGrid:[[99]],tileLegend:base.stage.geometry.tileLegend}])assert.throws(()=>stageTileView(g,0,0),/Missing stage tile legend/);
});
