// SPDX-License-Identifier: GPL-3.0-or-later
import { dirVec, oppositeDir } from '../direction.js';
import { FLUX_REFLECTOR_PORTS } from './flux-reflector-ports.js';
/** A native two-entry reflector connects its openings in both directions.
 * Beams approaching the other faces do not enter this device's route. */
export function fluxReflectorTurns(direction) {
  const ports=FLUX_REFLECTOR_PORTS[direction];
  if(!ports)throw Error('Invalid Flux reflector direction');
  return {[oppositeDir(ports[0])]:ports[1],[oppositeDir(ports[1])]:ports[0]};
}
const key=(r,c)=>`${r},${c}`;
/** Retain unchanged beam prefixes and their creation order. A newly redirected
 * extension cannot take an intersection away from an already existing beam. */
export function traceMagicCircuits(previous, sources, redirectors, rows, cols, stops = new Set(), exclusions = new Set()) {
  const routes=new Map(), occupied=new Map(); let serial=previous?.serial ?? 0;
  const within=(r,c)=>r>=0 && c>=0 && r<rows && c<cols;
  const outgoing=(r,c,incoming)=>{
    const turn=redirectors.get(key(r,c));
    return typeof turn==='string'?turn:turn?.[incoming]??incoming;
  };
  const retained=[];
  for (const source of sources) {
    const old=previous?.routes.get(source.id), path=[];
    let r=source.row,c=source.col,dir=source.direction;
    if (old) for (const cell of old.path) {
      if(cell.row!==r || cell.col!==c || exclusions.has(key(r,c)))break;
      const nextDir=path.length ? outgoing(r,c,dir) : source.direction;
      const stopped=stops.has(key(r,c));
      path.push({...cell,direction:nextDir,stopped});
      if(stopped || cell.stopped || cell.direction!==nextDir)break;
      const [dr,dc]=dirVec(nextDir);r+=dr;c+=dc;dir=nextDir;
    }
    const route={...source,path}; routes.set(source.id,route);
    for(const cell of path)retained.push({route,cell});
  }
  // Original claims win even when the caller changes source enumeration order.
  retained.sort((a,b)=>a.cell.order-b.cell.order);
  for(const {route,cell} of retained) {
    if(!route.path.includes(cell))continue;
    const k=key(cell.row,cell.col);
    if(occupied.has(k))route.path.splice(route.path.indexOf(cell));
    else occupied.set(k,route.id);
  }
  const pending=[...routes.values()].sort((a,b)=>(a.path.at(-1)?.order ?? Infinity)-(b.path.at(-1)?.order ?? Infinity));
  for(const route of pending) {
    let r=route.row,c=route.col,dir=route.direction;
    const last=route.path.at(-1);
    if(last?.stopped)continue;
    if(last){const [dr,dc]=dirVec(last.direction);r=last.row+dr;c=last.col+dc;dir=last.direction;}
    while(within(r,c)&&!occupied.has(key(r,c))&&!exclusions.has(key(r,c))) {
      if(route.path.length)dir=outgoing(r,c,dir);
      const stopped=stops.has(key(r,c));
      route.path.push({row:r,col:c,direction:dir,order:++serial,stopped});occupied.set(key(r,c),route.id);
      if(stopped)break;
      const [dr,dc]=dirVec(dir);r+=dr;c+=dc;
    }
  }
  return {routes,occupied,serial};
}
