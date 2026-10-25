// SPDX-License-Identifier: GPL-3.0-or-later
import contract from '../../../data/candidates/arkpedia-ch17-muama-blink-contract.json' with {type:'json'};
import {observeEnemyMove} from '../movement-observer.js';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),root=e=>[Math.round(e.y),Math.round(e.x)];
export function installChapter17MuamaBlink(b,e,{combat,line}={}){
 const proof=contract.enemies[e?.defId],r=e?.def?.raw;
 if(!proof||r?.key!==e.defId||r.prefabKey!==e.defId||!same(r.talents,proof.record.talents)||!same(r.skills,proof.record.skills)||!same(r.abilities,proof.record.abilities))throw Error('Unreviewed Muama Blink contract');
 if(!combat?.valid()||!line?.valid()||e.mem.ch17MuamaCombat!==combat||e.mem.ch17MuamaLine!==line||Math.abs(e.deployedAt-b.time)>1e-9)throw Error('Muama Blink requires fresh matching combat and line actors');
 const life=e.deploySeq,old=e.mem.ch17MuamaBlink;if(old?.active&&old.ownerLife===life)throw Error('A deployment may own only one Muama Blink controller');if(old?.active)old.stop();
 const d=proof.defaults,handles=[];
 const state={active:true,ownerLife:life,cooldown:d.initialCooldown,pending:null,buff:null,refreshTask:null,root:root(e),
  valid:()=>state.active&&!b.finished&&combat.valid()&&line.valid()&&e.mem.ch17MuamaCombat===combat&&e.mem.ch17MuamaLine===line&&e.deploySeq===life,
  finish(q=state.pending){if(!q)return;if(state.pending===q)state.pending=null;if(combat.actionBusy===q)combat.actionBusy=null;const hold=q.hold;q.hold=null;b.removeBuff(e,hold);},
  stop(){
   if(!state.active)return;state.active=false;state.finish();if(line.extraActions.get(state)===action)line.extraActions.delete(state);
   const task=state.refreshTask;state.refreshTask=null;b.removeBuff(e,task?.buff);b.removeBuff(e,state.buff);state.buff=null;
   for(const h of handles)b.off(h);if(e.mem.ch17MuamaBlink===state)delete e.mem.ch17MuamaBlink;
  },
  next(){
   const route=e.route,index=route?.legIdx,leg=route?.legs[index];
   if(!leg||leg.t!=='move'||leg.final||!Number.isFinite(leg.r)||!Number.isFinite(leg.c))return null;
   return{route,index,leg,x:leg.c+(route.cursorOffset?.x??0),y:leg.r+(route.cursorOffset?.y??0)};
  },
  ready:()=>state.valid()&&state.cooldown<=1e-9&&!state.pending&&line.canAct({ignoreSilence:true}),
  cast(){
   if(!state.ready())return false;
   let buff;buff=b.addBuff(e,{key:d.buffKey,source:e,duration:d.duration,sourceStatusResistable:false,data:{nativeUnblockableImmune:true},admit:()=>state.valid(),
    onRemove(){if(state.buff===buff)state.buff=null;},onExpire(){if(state.buff===buff)state.buff=null;}});
   if(!buff||!state.valid()){b.removeBuff(e,buff);return false;}state.buff=buff;
   state.cooldown=d.cooldown;combat.cooldown=Math.max(e.s.interval,d.intro+d.outro);
   const target=state.next();
   if(target){
    const q={target,age:0,lastAt:b.time,moved:false,hold:null};state.pending=q;combat.actionBusy=q;
    q.hold=b.addBuff(e,{key:'ch17:muama-blink-state',source:e,persist:true,data:{nativeBlinkState:true},
     flags:{invulnerable:true,untargetable:true,unblockable:true,noDisplace:true,noMove:true,disarm:true},
     admit:()=>state.valid()&&state.pending===q,onRemove:()=>state.finish(q)});
    if(!q.hold||!state.valid()||state.pending!==q){state.finish(q);b.removeBuff(e,buff);return false;}b._unblock(e);
   }
   b.emit('ch17MuamaBlinkCast',{source:e,sourceLife:life,checkpoint:target?.index??null});return true;
  },
  scheduleRefresh(){
   if(!state.valid())return false;
   const old=state.refreshTask;state.refreshTask=null;b.removeBuff(e,old?.buff);
   const q={buff:null,fired:false};state.refreshTask=q;
   const clear=()=>{if(state.refreshTask===q)state.refreshTask=null;};
   q.buff=b.addBuff(e,{key:'enemy_muama_trriger_env',source:e,duration:d.refreshLifetime,sourceStatusResistable:false,interval:d.refreshDelay,
    admit:()=>state.valid()&&state.refreshTask===q,onRemove:clear,onExpire:clear,onTick(){
     if(q.fired||!state.valid()||state.refreshTask!==q)return;q.fired=true;
     if(combat.wall.refresh())b.emit('ch17MuamaFirewallRefreshed',{source:e,sourceLife:life,wallId:combat.wall.id});
    }});
   if(!q.buff||!state.valid()||state.refreshTask!==q){clear();b.removeBuff(e,q.buff);return false;}return true;
  },
 };
 const action={ready:state.ready,cast:state.cast};e.mem.ch17MuamaBlink=state;line.extraActions.set(state,action);
 handles.push(b.on('tick',({dt})=>{
  if(!state.valid()){state.stop();return;}
  if(!e.s.flags.stun)state.cooldown=Math.max(0,state.cooldown-dt);
  const q=state.pending;if(!q)return;
  if(combat.suspended||combat.actionBusy!==q||!e.buffs.includes(q.hold)){state.finish(q);return;}
  q.age+=Math.max(0,b.time-q.lastAt);q.lastAt=b.time;
  if(!q.moved&&q.age+1e-7>=d.intro){
   const t=q.target;
   if(e.route!==t.route||t.route.legIdx!==t.index||t.route.legs[t.index]!==t.leg||t.leg.t!=='move'||t.leg.final
    ||t.leg.c+(t.route.cursorOffset?.x??0)!==t.x||t.leg.r+(t.route.cursorOffset?.y??0)!==t.y){state.finish(q);return;}
   q.moved=true;const from={x:e.x,y:e.y};e.x=t.x;e.y=t.y;t.route.legIdx=t.index+1;t.route.pts=null;t.route.ptIdx=0;t.route.suffix=null;t.route.waitLeft=null;t.route.version=-1;
   observeEnemyMove(b,e,from,'muama-blink');if(!state.valid()||state.pending!==q)return;
   b.emit('ch17MuamaBlinkMoved',{source:e,sourceLife:life,checkpoint:t.index});
  }
  if(q.age+1e-7>=d.intro+d.outro)state.finish(q);
 },{owner:state,priority:75}),b.on('enemyMoved',({enemy,to})=>{
  if(enemy!==e||!state.valid()||to?.x!==e.x||to?.y!==e.y)return;
  const next=root(e);if(same(next,state.root))return;state.root=next;
  if(state.buff&&e.buffs.includes(state.buff))state.scheduleRefresh();
 },{owner:state}),b.on('death',({unit})=>{if(unit===e)state.stop();},{owner:state}),
 b.on('removed',({unit})=>{if(unit===e)state.stop();},{owner:state}),b.on('battleEnd',()=>state.stop(),{owner:state}));
 return state;
}
