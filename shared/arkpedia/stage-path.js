// SPDX-License-Identifier: GPL-3.0-or-later
// Reproduce the geometry's ordered checkpoints, waits and teleports when a
// viewer export is absent. Distances here are stable point identifiers, not
// measured arc length; the stage adapter uses them to attach holds/breaks.
export function syntheticRoutePath(route, nativeRoute) {
  const points = [], holds = [], breaks = [], checkpointPoints = new Map();
  const pair = (position, offset = {}) => {
    if (![position?.col, position?.row, offset.x ?? 0, offset.y ?? 0].every(Number.isFinite))
      throw Error('Invalid synthetic route position/offset');
    return [position.col + (offset.x ?? 0), position.row + (offset.y ?? 0)];
  };
  const add = (point, teleport = false) => {
    const last = points.at(-1);
    if (teleport || !last || point[0] !== last[0] || point[1] !== last[1]) {
      points.push(point);
      if (teleport) breaks.push(points.length - 1);
    }
    return points.length - 1;
  };
  checkpointPoints.set(-1, add(pair(route.start)));
  for (const [index, checkpoint] of (route.checkpoints ?? []).entries()) {
    if (checkpoint.type && !['move', 'appear_at_pos'].includes(checkpoint.type))
      throw Error('Unsupported synthetic route checkpoint: ' + checkpoint.type);
    // The adapter validates an APPEAR against its native position. Offsetting
    // teleports needs a separate reviewed transport contract.
    if (checkpoint.type === 'appear_at_pos' && (checkpoint.reachOffset?.x || checkpoint.reachOffset?.y))
      throw Error('Unsupported synthetic teleport offset');
    checkpointPoints.set(index, add(pair(checkpoint.position, checkpoint.reachOffset), checkpoint.type === 'appear_at_pos'));
  }
  add(pair(route.end));
  // Geometry retains wait lengths but loses whether a wait followed
  // DISAPPEAR. Only the corresponding original checkpoints can restore that
  // distinction; an APPEAR point alone cannot identify a hidden hold.
  let nativeWaits;
  if (nativeRoute) {
    if(nativeRoute.motionMode?.toLowerCase()!==route.motion
      ||JSON.stringify(pair(nativeRoute.startPosition))!==JSON.stringify(pair(route.start))
      ||JSON.stringify(pair(nativeRoute.endPosition))!==JSON.stringify(pair(route.end)))
      throw Error('Native route endpoints/motion differ from geometry');
    nativeWaits=[];let checkpoint=-1,hidden=false;
    const raw=nativeRoute.checkpoints;
    if(!Array.isArray(raw)&&Object.keys(raw??{}).length)throw Error('Unsupported native route checkpoints');
    for(const p of Array.isArray(raw)?raw:[]){
      if(p.type==='DISAPPEAR'){
        if(hidden)throw Error('Unclosed native route disappearance');hidden=true;
      }else if(p.type==='WAIT_FOR_SECONDS'){
        nativeWaits.push({after_checkpoint:checkpoint,seconds:p.time,tunnel:hidden});
      }else if(p.type==='MOVE'||p.type==='APPEAR_AT_POS'){
        if(p.type==='MOVE'&&hidden)throw Error('Hidden native route move requires reappearance');
        const geometry=route.checkpoints?.[++checkpoint];
        if(!geometry||geometry.type!==(p.type==='MOVE'?'move':'appear_at_pos')
          ||JSON.stringify(pair(geometry.position,geometry.reachOffset))!==JSON.stringify(pair(p.position,p.reachOffset)))
          throw Error('Native route checkpoint differs from geometry at '+checkpoint+': '+JSON.stringify({geometry,native:p}));
        if(p.type==='APPEAR_AT_POS')hidden=false;
      }else throw Error('Unsupported native route checkpoint: '+p.type);
    }
    if(hidden||checkpoint+1!==(route.checkpoints??[]).length)throw Error('Unclosed native route disappearance/checkpoints');
    if(nativeWaits.length!==(route.waits??[]).length)throw Error('Native route waits differ from geometry');
  }
  for (const [i,wait] of (route.waits ?? []).entries()) {
    if (wait.type !== 'wait_for_seconds' || !Number.isInteger(wait.after_checkpoint)
      || !checkpointPoints.has(wait.after_checkpoint) || !Number.isFinite(wait.seconds) || wait.seconds < 0)
      throw Error('Unsupported synthetic route wait');
    const original=nativeWaits?.[i];
    if(original&&(original.after_checkpoint!==wait.after_checkpoint||original.seconds!==wait.seconds))
      throw Error('Native route waits differ from geometry');
    const at=checkpointPoints.get(wait.after_checkpoint);
    if(original?.tunnel){
      if(!breaks.includes(at+1))throw Error('Native hidden wait has no following teleport');
      const previous=holds.find(h=>h.tunnel&&h.at===at);
      if(previous)previous.seconds+=wait.seconds;
      else holds.push({at,seconds:wait.seconds,tunnel:true});
    }else holds.push({at,seconds:wait.seconds});
  }
  return { points, distances: points.map((_, at) => at), breaks, holds };
}

// Geometry deduplicates original routes, so its index is not the native route
// index. Every matching original must agree on hidden/visible wait semantics.
export function sourceBoundRoutePath(route,nativeRoutes){
  if(!Array.isArray(nativeRoutes))throw Error('Original route collection required');
  const paths=[];
  for(const original of nativeRoutes){
    try{paths.push(syntheticRoutePath(route,original));}catch{}
  }
  if(!paths.length)throw Error('No original route matches canonical geometry');
  if(paths.some(p=>JSON.stringify(p)!==JSON.stringify(paths[0])))throw Error('Ambiguous original route visibility/timing');
  return paths[0];
}
