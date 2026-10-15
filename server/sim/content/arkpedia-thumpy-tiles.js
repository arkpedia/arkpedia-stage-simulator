// SPDX-License-Identifier: GPL-3.0-or-later
// Captured selected field tiles; no simulated enemy or artificial attack target.
import e from '../../../data/arkpedia-native-operators/char_4235_thumpy.json' with {type:'json'};
import {thumpyNativeInputs} from './arkpedia-thumpy-source.js';
import {offsetTile} from '../dir.js';
export const THUMPY_TILE_CONTRACT=Object.freeze({
 mapping:'S2 maps traversalMode1 to breadth-first, starting with the valid feet tile and expanding through the native facing-relative forward/left/right offsets; valid neighboring seeds are a fallback when feet are invalid. Five selected cells include feet, giving four additional cells on open terrain. Invalid cells never expand. S3 independently filters the five fixed source 4-1 offsets. Both capture at the original release and preserve terrain.',
 limits:'The compiled traversal enum, seed fallback order, tile-type mask aliases and relative anchor dispatch remain local mappings; this helper does not certify native tile selection or admit public gameplay.',
 frameParity:false,
});
const valid=(b,r,c)=>b.grid.inRect(r,c)&&b.grid.groundPassable(r,c)&&b.grid.tile(r,c).height==='LOW'
 &&!['tile_hole','tile_empty','tile_forbidden'].includes(b.grid.tile(r,c).key);
export function thumpyFieldTiles(b,u,record,{contract}={}){
 if(contract!==THUMPY_TILE_CONTRACT||![1,2].includes(record.index))throw Error('Explicit selected Thumpy tile contract required');
 const n=thumpyNativeInputs(),s=n.glueSelector,offsets=s._spreadOffsetsRightBasis;
 if(s._traversalMode!==1||s._prioritizeFeetTile!==1||s._fallbackToOtherSeedOffsets!==1||s._expandThroughInvalidTiles!==0
  ||JSON.stringify(offsets)!==JSON.stringify([{row:0,col:1},{row:1,col:0},{row:-1,col:0}])||record.bb.max_cnt!==5
  ||JSON.stringify(e.tables.ranges['4-1'].grids)!==JSON.stringify(Array.from({length:5},(_,col)=>({row:0,col}))))throw Error('Changed Thumpy field selector');
 if(record.index===2)return e.tables.ranges['4-1'].grids.map(g=>offsetTile(u.tileR,u.tileC,g.row,g.col,u.dir)).filter(([r,c])=>valid(b,r,c));
 const out=[],queue=[],seen=new Set(),put=(r,c)=>{const k=`${r},${c}`;if(seen.has(k))return;seen.add(k);if(valid(b,r,c))queue.push([r,c]);};
 if(valid(b,u.tileR,u.tileC))put(u.tileR,u.tileC);else for(const g of offsets)put(...offsetTile(u.tileR,u.tileC,g.row,g.col,u.dir));
 while(queue.length&&out.length<record.bb.max_cnt){const tile=queue.shift();out.push(tile);for(const g of offsets)put(...offsetTile(...tile,g.row,g.col,u.dir));}
 return out;
}
