// SPDX-License-Identifier: GPL-3.0-or-later
import contract from '../../../data/candidates/arkpedia-ch17-snake-firewall-contract.json' with {type:'json'};
import {registerChapter17Firewall,chapter17FirewallBounds as bounds,crossedChapter17FirewallSides} from './chapter17.js';
export {crossedChapter17FirewallSides} from './chapter17.js';
const EPS=1e-9,same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

export function installChapter17SnakeFirewall(b,e){
 const r=e?.def?.raw,p=contract.record;
 if(e?.defId!==contract.enemy||r?.key!==contract.enemy||r.prefabKey!==contract.enemy||!same(r.talents?.groups,p.groups)
  ||!same(r.talents?.bb,p.bb)||!same(r.skills,p.skills)||!same(r.abilities,p.abilities))throw Error('Unreviewed snake firewall contract');
 if(b.finished||!e.alive||!e.deployed||!Number.isFinite(e.deployedAt)||Math.abs(e.deployedAt-b.time)>EPS)
  throw Error('Snake firewall must attach to a fresh live deployment');
 const life=e.deploySeq,old=e.mem.ch17SnakeFirewall,handles=[],area=Object.freeze({...contract.body});
 if(old?.active&&old.ownerLife===life)throw Error('A deployment may own only one snake firewall');if(old?.active)old.stop();
 const oldArea=e.hitArea;
 const state={active:true,ownerLife:life,wall:null,parent:null,init:null,area,
  valid:()=>state.active&&!b.finished&&e.alive&&e.deployed&&e.deploySeq===life&&state.wall?.current()&&e.buffs.includes(state.parent),
  stop(){
   if(!state.active)return;state.active=false;state.wall?.retire();
   if(b._takenMultipliers?.get(state)===state.multiplier)b._takenMultipliers.delete(state);
   b.removeBuff(e,state.parent);b.removeBuff(e,state.init?.buff);for(const h of handles)b.off(h);
   if(e.hitArea===area){e.hitArea=oldArea;b._buildEnemyIndex();}
   if(e.mem.ch17SnakeFirewall===state)delete e.mem.ch17SnakeFirewall;
  },
  blocksDeployment(row,col){
   if(!state.valid()){state.stop();return false;}
   const r=bounds(state.wall);return col>r.x0+EPS&&col<r.x1-EPS&&row>r.y0+EPS&&row<r.y1-EPS;
  },
  multiplier(source,target,dmg){
   if(!state.valid()){state.stop();return 1;}
   return target===e&&['phys','arts'].includes(dmg.type)&&crossedChapter17FirewallSides(state.wall,source,e).length
    ?1-contract.defaults.resistance:1;
  },
 };
 e.mem.ch17SnakeFirewall=state;
 try{
  state.wall=registerChapter17Firewall(b,e,{width:contract.defaults.width,height:contract.defaults.height,
   duration:contract.defaults.duration,clicks:contract.defaults.clicks,onRetire:()=>state.stop()});
  state.wall.blocksDeployment=state.blocksDeployment;
  state.parent=b.addBuff(e,{key:contract.parent.buffKey,source:e,persist:true,flags:{noMove:true},onRemove:()=>state.stop()});
  if(!state.parent||!state.valid())throw Error('Snake firewall parent admission failed');
  e.hitArea=area;b._buildEnemyIndex();
  b._takenMultipliers??=new Map();b._takenMultipliers.set(state,state.multiplier);
  const q={buff:null,fired:false};state.init=q;
  const fire=()=>{
   if(q.fired||!state.valid())return;q.fired=true;
   state.wall.expose(e,{allSides:true,sideIndices:contract.defaults.initialSides});
  };
  q.buff=b.addBuff(e,{key:contract.init.buffKey,source:e,duration:contract.defaults.initialDelay,sourceStatusResistable:false,
   onExpire:fire,onRemove:fire});
  if(!q.buff||!state.valid())throw Error('Snake firewall initial vulnerability admission failed');
  handles.push(b.on('tick',()=>{if(!state.valid())state.stop();},{owner:state}),
   b.on('death',({unit})=>{if(unit===e)state.stop();},{owner:state}),b.on('removed',({unit})=>{if(unit===e)state.stop();},{owner:state}),
   b.on('battleEnd',()=>state.stop(),{owner:state}));
  return state;
 }catch(error){state.stop();throw error;}
}
