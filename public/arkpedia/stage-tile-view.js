// SPDX-License-Identifier: GPL-3.0-or-later
// Geometry indices are local to each level. Terrain and input affordances use
// the same source legend fields as the engine adapter.
export function stageTileView(geometry,row,col){
 const tile=geometry.tileLegend?.[geometry.tileGrid[row]?.[col]];
 if(!tile)throw Error('Missing stage tile legend at '+row+','+col);
 const raised=String(tile.height).toLowerCase()==='high',interactive=['melee','ranged','all'].includes(String(tile.deployable).toLowerCase());
 const key=String(tile.key??'');
 const color=key.includes('start')?'#aa4b40':key.includes('end')?'#377787':interactive?(raised?'#59666b':'#35464b'):tile.walkable?'#35464b':'#172329';
 return{raised,interactive,color,height:raised?0.38:0};
}
