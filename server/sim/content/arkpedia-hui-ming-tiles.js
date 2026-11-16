// SPDX-License-Identifier: GPL-3.0-or-later
import {setHuiMing,switchHuiMing,attachHuiMingScales,huiMingOf} from './arkpedia-hui-ming.js';
import {recordStageDelta} from './arkpedia-stage-outcomes.js';
/** Native Hui-Ming tiles over the shared attribute account.
 *  - A mark tile (`tile_yinyang_road` / `tile_yinyang_wall`) is a dynamic buff
 *    tile with two modes, yin (0) and yang (1). A ground ally standing on it
 *    holds the mode's attribute, the same/opposite output scales from the
 *    tile's blackboard and one result-log entry. Buffs are not cleared on
 *    leaving. Flipping the mode replaces the occupant's attribute.
 *  - A switch tile (`tile_yinyang_switch`) starts `buff_yinyang_switch` on a
 *    ground enemy each time it enters: an existing attribute is swapped.
 * The controller belongs to the battle; stage compilation supplies the tiles. */
const live=u=>!!u&&u.alive&&u.deployed&&!u.removed&&!u.hidden;
const key=(row,col)=>`${row},${col}`,attribute=mode=>mode===0?'yin':'yang';
export const HUI_MING_TILE_SCALE_KEYS=Object.freeze({sameKey:'buff_yinyang[same]',diffKey:'buff_yinyang[diff]'});
export function installHuiMingTiles(b,{marks=[],switches=[],interval=.1,logKey='locate_on_tile_yinyang'}={}){
 validate({marks,switches,interval,logKey});
 if(b.stageHuiMing)throw Error('Hui-Ming tiles already installed');
 const tiles=new Map(marks.map(t=>[key(t.row,t.col),{...t,mode:t.mode}])),gates=new Set(switches.map(t=>key(t.row,t.col)));
 const held=new WeakMap(),entered=new WeakMap();
 const occupants=tile=>b.units.filter(u=>u.side==='ally'&&u.kind!=='device'&&live(u)&&!u.isFlying&&u.tileR===tile.row&&u.tileC===tile.col);
 const settle=(unit,tile)=>{
  let state=held.get(unit);
  if(!state||state.life!==unit.deploySeq){
   state={life:unit.deploySeq,scales:attachHuiMingScales(b,unit,{same:tile.same,diff:tile.diff,...HUI_MING_TILE_SCALE_KEYS}),mode:null};held.set(unit,state);
   recordStageDelta(b,unit,logKey,1);
  }
  if(state.mode!==tile.mode||huiMingOf(unit)!==attribute(tile.mode)){state.mode=tile.mode;setHuiMing(b,unit,attribute(tile.mode),{source:unit});}
 };
 const scan=()=>{
  for(const tile of tiles.values())for(const unit of occupants(tile))settle(unit,tile);
  if(gates.size)for(const unit of b.units){
   if(unit.side!=='enemy'||unit.kind!=='enemy'||!live(unit)){continue;}
   // Routed bodies are read by position: their root tile is the nearest cell.
   const here=unit.isFlying?null:key(Math.round(unit.y),Math.round(unit.x)),before=entered.get(unit);
   if(before?.life===unit.deploySeq&&before.at===here)continue;
   entered.set(unit,{life:unit.deploySeq,at:here});
   if(here&&gates.has(here))switchHuiMing(b,unit,{source:unit});
  }
 };
 const timer=b.every(interval,scan,{immediate:true});
 const controller={
  modeAt:(row,col)=>tiles.get(key(row,col))?.mode??null,
  /** Native SwitchDynamicBuffTileMode FLIP_BOOL on one tile. Returns the new mode, or null off a mark tile. */
  flip(row,col){const tile=tiles.get(key(row,col));if(!tile)return null;tile.mode=tile.mode===0?1:0;for(const unit of occupants(tile))settle(unit,tile);return tile.mode;},
  flipUnder(unit){return live(unit)?controller.flip(unit.tileR,unit.tileC):null;},
  resultTiles:()=>[...tiles.values()].map(t=>({row:t.row,col:t.col,mode:t.mode})),
  uninstall(){timer.cancel();if(b.stageHuiMing===controller)b.stageHuiMing=null;},
 };
 b.stageHuiMing=controller;return controller;
}
/** The on-hit tile action of an attack: flips the mark tile under its recipient, if it stands on one. */
export const flipHuiMingTileUnder=(b,unit)=>b.stageHuiMing?b.stageHuiMing.flipUnder(unit):null;
function validate({marks,switches,interval,logKey}){
 const cell=t=>!!t&&Number.isSafeInteger(t.row)&&Number.isSafeInteger(t.col)&&t.row>=0&&t.col>=0&&t.row<1024&&t.col<1024;
 if(!Array.isArray(marks)||!Array.isArray(switches)||marks.length+switches.length<1||marks.length>4096||switches.length>4096
  ||marks.some(t=>!cell(t)||Object.keys(t).sort().join()!=='col,diff,mode,row,same'||![0,1].includes(t.mode)||![t.same,t.diff].every(v=>Number.isFinite(v)&&v>=0&&v<=1e3))
  ||switches.some(t=>!cell(t)||Object.keys(t).sort().join()!=='col,row')
  ||new Set([...marks,...switches].map(t=>key(t.row,t.col))).size!==marks.length+switches.length
  ||!Number.isFinite(interval)||interval<=0||interval>10||typeof logKey!=='string'||!logKey)throw Error('Invalid Hui-Ming tiles');
}
installHuiMingTiles.validate=validate;
