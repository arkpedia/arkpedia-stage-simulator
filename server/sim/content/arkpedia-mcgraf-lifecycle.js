// SPDX-License-Identifier: GPL-3.0-or-later
// Diagnostic S1/S2 summon lifecycle. Attack and skill adapters are separate gates.
import {selectedMcGrafBuild} from './arkpedia-mcgraf-source.js';
import {MCNIST_ID as ID,MCGRAF_ID as TOKEN,mechanistNativeInputs,mechanistSourceComponent} from './arkpedia-mcnist-source.js';
import {normalizeToken} from '../simdata.js';
import {canSpendDp} from './arkpedia-dp-budget.js';
import {canDeployInViewport} from '../../../shared/arkpedia/squad.js';
import clocks from '../../../data/arkpedia-mcnist-clocks.json' with {type:'json'};
export const MCGRAF_LIFECYCLE_CONTRACT=Object.freeze({
 scope:'Selected S1/S2 original McGraf deployment card, independent stats, lifetime and deployment barriers; diagnostic only',
 mapping:'One ten-DP low-ground token with chosen facing, no host-range restriction, no slot cost and no withdrawal refund. Birth consumes the only card. Removal replenishes it after the source forty-second independent redeployment timer. Owner retirement kills the linked token and removes the card. The selected token talent transfers twenty/thirty-second skill duration. Timeout counts from accepted deployment; Start completion changes only the visual pose. Native passive HealFree is retained. Control does not pause this lifetime. Selected E2 barriers compose through their separately reviewed controller.',
 limits:'The missing cnt operand in RechargeToken maps to one card using maxDeployCount and the owner talent description; compiled recharge defaults, born/skill-start dispatch, native card timing, timeout priority and transactional refund ordering remain local policies. S3 charge/mark postponement is refused here. Ordinary attacks, owner S1/S2 effects, modules, native effects/audio and game-frame parity remain unverified. No public roster or summon approval.',
 frameParity:false,
});
const present=t=>t?.alive&&t.deployed&&!t._removing;
const due=(b,t)=>b.time+1e-8>=t;
export function prepareMcGrafLifecycle(b,u,{contract,barriers}={}){
 if(contract!==MCGRAF_LIFECYCLE_CONTRACT||u.def.charId!==ID||u.deploySeq!==0||u.mem.mcgrafLifecycle||barriers!==u.mem.mcnistBarriers
  ||barriers?.u!==u||barriers.b!==b||!barriers.handles.length||barriers.stopped)throw Error('Fresh Mechanist with installed selected barriers and explicit McGraf lifecycle contract required');
 const r=selectedMcGrafBuild(barriers.record.build);
 if(r.ownerIndex===2)throw Error('McGraf S3 requires a reviewed charge/mark lifecycle adapter');
 const n=mechanistNativeInputs().templates,passive=mechanistSourceComponent('tokens',TOKEN,'5608835379773326643')._buffs;
 if(n['charge_token[born]'].eventToActions.ON_OWNER_BORN[0]._cntKey!=='cnt'
  ||n['charge_token[finish]'].eventToActions.ON_OWNER_FINISH[0]._rechargeTiming!=='ON_FINISH'
  ||n.die_to_kill_token.eventToActions.ON_OWNER_FINISH[0]._checkContainsBuff!==false
  ||n.mcgraf_t_suicide.eventToActions.ON_BUFF_FINISH[0]._buffKeys[0]!=='mcnist_e_002_token_mark'
  ||n.mcgraf_t_suicide.eventToActions.ON_BUFF_FINISH[2]._switchToDeadState!==true
  ||passive[1].attributes.abnormalFlags.join(',')!=='7'||passive[0].templateKey!=='charge_token[finish]'
  ||r.stats.maxDeployCount!==1||r.stats.maxDeckStackCnt!==0)throw Error('Changed original McGraf lifecycle graph');
 const deck=new McGrafLifecycle(b,u,barriers,r);u.mem.mcgrafLifecycle=deck;return deck;
}
export class McGrafLifecycle{
 constructor(b,u,barriers,record){
  Object.assign(this,{b,u,barriers,record,point:null,stock:0,readyAt:Infinity,placing:false,stopped:false,handles:[]});
  const def=normalizeToken(TOKEN,{name:record.source.appellation,position:record.source.position,profession:record.source.profession,
   stats:record.stats,rangeGrid:record.rangeGrid,talents:record.talents,arkpedia:{...record.build},skill:null});
  this.def=def;const d=this;
  this.state={key:`summon:${ID}`,ownerId:ID,owner:u,tokenId:TOKEN,record:def,deck:this,
   config:Object.freeze({deploymentSlotCost:0,chooseFacing:true,refundRatio:0,healFree:true,noAttack:true}),
   get stock(){return d.stock;},get readyAt(){return d.readyAt;}};
 }
 valid(){return !this.stopped&&this.barriers.valid()&&present(this.u);}
 own(){return present(this.point?.unit)&&!this.point.finished?[this.point.unit]:[];}
 placementError(row,col){const b=this.b;
  if(!canDeployInViewport(b.viewport))return 'Open the fullscreen workspace to deploy.';
  if(b.finished)return 'Battle has ended.';
  if(!this.valid()||this.u.hidden)return 'Deploy Mechanist first.';
  if(this.placing||this.stock<1||this.own().length)return 'McGraf is already deployed.';
  if(!due(b,this.readyAt))return 'McGraf is still redeploying.';
  if(!Number.isInteger(row)||!Number.isInteger(col)||!b.grid.inRect(row,col))return 'Select a tile on the map.';
  const tile=b.grid.tile(row,col);
  if(tile.height!=='LOW'||!['MELEE','ALL'].includes(tile.build)||b.grid.isObstacle(row,col))return 'Choose a low-ground deployment tile.';
  if(b.unitAt(row,col)||b.tileReservation(row,col)||b.downOn(row,col))return 'Tile is occupied or reserved.';
  if(!canSpendDp(b,this.u.ownerId,this.record.stats.cost))return 'Not enough DP.';
  return null;
 }
 visual(s,clip,loop=false){const back=s.unit.dir==='UP';s.unit.mem.regularModelFacing=back?'back':'front';
  s.unit.mem.regularFormVisual={clip,loop,speed:1};
  // Back has no death clip. Hide that departure rather than asking the actor
  // to play a missing clip or claiming an unsupported death-facing switch.
  s.unit.mem.regularDeathVisual=back?{hide:true,duration:1}:{clip:'Die',die:'Die',duration:clocks.tokens[TOKEN].models.Front.exactDurations.Die};
 }
 place(row,col,dir='RIGHT'){
  const error=this.placementError(row,col);if(error)throw Error(error);
  if(!['UP','DOWN','LEFT','RIGHT'].includes(dir))throw Error('Choose a facing direction.');
  const b=this.b,paid=this.record.stats.cost,oldReady=this.readyAt;this.placing=true;this.stock=0;b.addDp(this.u.ownerId,-paid);let token,created;
  try{
   token=b.spawnToken(this.u,TOKEN,row,col,{dir,def:this.def,kit:{trait:{noAttack:true},talents:[],skill:null,
    install:(_b,t)=>{created=t;t.deploymentSlotCost=0;t.mem.regularSummonCard=this.state.key;
     b.addBuff(t,{key:'mcgraf:heal-free',source:t,persist:true,allowDead:true,flags:{healFree:true}});this.barriers.registerToken(t);}}});
   if(!token||!present(token)||!this.valid())throw Error('McGraf deployment failed.');
   this.point={unit:token,seq:token.deploySeq,bornAt:b.time,expiresAt:b.time+this.record.skillOverlay.duration,finished:false,mode:'born'};
   this.readyAt=Infinity;this.visual(this.point,'Start');return token;
  }catch(e){token??=created;if(present(token))b._remove(token,'mcgraf-placement-cancelled',null,true);else if(token){this.barriers.removeToken(token);b.offOwner(token);token.removed=true;}b.addDp(this.u.ownerId,paid);
   if(this.valid()){this.stock=1;this.readyAt=oldReady;}throw e;
  }finally{this.placing=false;}
 }
 finish(s,{remove=false,reason='removed'}={}){
  if(!s||s.finished)return;s.finished=true;if(this.point===s)this.point=null;
  if(this.valid()){this.stock=1;this.readyAt=this.b.time+this.record.stats.respawnTime;}
  if(remove&&present(s.unit)&&s.unit.deploySeq===s.seq)this.b._remove(s.unit,`mcgraf-${reason}`,null,true);
 }
 retreat(t){if(!canDeployInViewport(this.b.viewport)||this.b.finished||!this.valid()||this.point?.unit!==t||!present(t)||t.deploySeq!==this.point.seq)throw Error('Select the current McGraf in fullscreen.');
  this.finish(this.point,{remove:true,reason:'withdrawal'});return true;
 }
 tick(){if(this.barriers.seq===null&&!this.barriers.stopped&&!this.b.finished)return;if(!this.valid()){this.stop();return;}const s=this.point;if(!s)return;
  if(!present(s.unit)||s.unit.deploySeq!==s.seq){this.finish(s);return;}
  if(due(this.b,s.expiresAt)){this.finish(s,{remove:true,reason:'expired'});return;}
  if(s.mode==='born'&&due(this.b,s.bornAt+clocks.tokens[TOKEN].models.Front.exactDurations.Start)){s.mode='idle';this.visual(s,'Idle',true);}
 }
 install(){if(this.stopped||this.handles.length)throw Error('McGraf lifecycle cannot be reinstalled');
  const map=this.b.regularSummons??=new Map();if(map.has(this.state.key))throw Error('A current Mechanist summon deck already exists');map.set(this.state.key,this.state);
  const b=this.b,u=this.u;this.handles=[b.on('deploy',({unit,move})=>{if(unit===u&&!move){this.stock=1;this.readyAt=b.time;}},{owner:u}),
   b.on('tick',()=>this.tick(),{owner:u}),b.on('death',({unit})=>{if(unit===u)this.stop();else if(unit===this.point?.unit)this.finish(this.point);},{owner:u}),
   b.on('removed',({unit})=>{if(unit===u)this.stop();else if(unit===this.point?.unit)this.finish(this.point);},{owner:u}),b.on('battleEnd',()=>this.stop(),{owner:u})];
 }
 stop(){if(this.stopped)return;this.stopped=true;this.stock=0;this.readyAt=Infinity;this.finish(this.point,{remove:true,reason:'owner-finished'});
  if(this.b.regularSummons?.get(this.state.key)===this.state)this.b.regularSummons.delete(this.state.key);for(const h of this.handles)this.b.off(h);this.handles=[];
 }
}
