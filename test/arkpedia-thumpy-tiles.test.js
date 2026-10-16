// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make} from './helpers/thumpy-fixture.js';
import {thumpyFieldTiles,THUMPY_TILE_CONTRACT as contract} from '../server/sim/content/arkpedia-thumpy-tiles.js';
import {offsetTile} from '../server/sim/dir.js';
const field=f=>thumpyFieldTiles(f.b,f.u,f.record,{contract});
function change(f,r,c,values){const k=r*f.b.grid.cols+c;f.b.grid.tiles[k]={...f.b.grid.tile(r,c),...values};}
for(const dir of['UP','DOWN','LEFT','RIGHT']){
 test(`Thumpy S2 ${dir} preserves feet-first forward/side flood order`,()=>{
  const f=make({skill:2,dir});assert.deepEqual(field(f),[[0,0],[0,1],[1,0],[-1,0],[0,2]].map(p=>offsetTile(5,5,...p,dir)));
 });
 test(`Thumpy S3 ${dir} preserves the five fixed original line offsets`,()=>{
  const f=make({skill:3,dir});assert.deepEqual(field(f),Array.from({length:5},(_,i)=>offsetTile(5,5,0,i,dir)));
 });
}
test('Thumpy glue cannot expand through an invalid tile but can use valid side routes',()=>{
 const f=make({skill:2});change(f,5,6,{height:'HIGH'});assert.deepEqual(field(f),[[5,5],[6,5],[4,5],[6,6],[7,5]]);
});
test('Thumpy glue uses valid neighboring seeds only when its feet are invalid',()=>{
 const f=make({skill:2});change(f,5,5,{height:'HIGH'});assert.deepEqual(field(f),[[5,6],[6,5],[4,5],[5,7],[6,6]]);
});
test('Thumpy conveyor filters fixed cells independently instead of flooding or inventing replacement tiles',()=>{
 const f=make({skill:3});change(f,5,6,{height:'HIGH'});change(f,5,8,{key:'tile_hole'});assert.deepEqual(field(f),[[5,5],[5,7],[5,9]]);
});
test('Thumpy fields clip at actual grid bounds, accept an empty selection and never alter terrain',()=>{
 for(const skill of[2,3]){const f=make({skill}),before=structuredClone(f.b.grid.tiles);f.u.tileR=f.b.grid.rect.r1;f.u.tileC=f.b.grid.rect.c1;field(f);assert.deepEqual(f.b.grid.tiles,before);}
 const f=make({skill:2});for(let r=0;r<f.b.grid.rows;r++)for(let c=0;c<f.b.grid.cols;c++)change(f,r,c,{height:'HIGH'});assert.deepEqual(field(f),[]);
});
test('Thumpy tile helper requires its explicit contract and a selected area skill',()=>{
 const f=make({skill:1});assert.throws(()=>field(f));assert.throws(()=>thumpyFieldTiles(f.b,f.u,{index:1,bb:{max_cnt:5}},{}));
});
