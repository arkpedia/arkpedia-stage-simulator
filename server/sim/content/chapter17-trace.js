// SPDX-License-Identifier: GPL-3.0-or-later
// Source-owned Leak Source selection; movement runs through the shared AI.
export function leakSourceTrace(b,e,{radius,searchPeriod,defaultSearchPeriod,eligible=()=>true,enabled=()=>true}){
  if(e.motion!=='FLY'||![radius,searchPeriod,defaultSearchPeriod].every(v=>Number.isFinite(v)&&v>0))
    throw Error('Reviewed flying trace parameters required');
  const life=e.deploySeq,state={enabled:true,ownerLife:life,target:null,targetLife:null,reachRadius:radius};
  if(e.profile.nativeFlyingTrace)throw Error('A deployment may own only one native trace cursor');
  e.profile.nativeFlyingTrace=state;let next=0,active=true;
  const valid=t=>t?.alive&&t.deployed&&!t.hidden&&t.defId==='enemy_10211_murad'&&eligible(t);
  return{
    state,
    refresh(force=false){
      if(!active||!e.alive||!e.deployed||e.deploySeq!==life)return;
      state.enabled=enabled();
      if(!state.enabled){state.target=null;state.targetLife=null;return;}
      if(state.target&&(!valid(state.target)||state.target.deploySeq!==state.targetLife)){state.target=null;state.targetLife=null;next=0;}
      if(!force&&b.time+1e-9<next)return;
      const targets=b.enemies.filter(valid).sort((a,z)=>Math.hypot(a.x-e.x,a.y-e.y)-Math.hypot(z.x-e.x,z.y-e.y)||a.spawnSeq-z.spawnSeq);
      state.target=targets[0]??null;state.targetLife=state.target?.deploySeq??null;
      next=b.time+(state.target?searchPeriod:defaultSearchPeriod);
    },
    stop(){active=false;state.enabled=false;state.target=null;if(e.profile.nativeFlyingTrace===state)delete e.profile.nativeFlyingTrace;},
  };
}
