// SPDX-License-Identifier: GPL-3.0-or-later
// Finite source S2 healing payloads; skill clocks/accounts compose this component.
import e from '../../../data/arkpedia-native-operators/char_4222_taraxa.json' with {type:'json'};
import {selectedTaraxaInputs,taraxaNativeInputs,taraxaSourceComponent,TARAXA_ID as ID} from './arkpedia-taraxa-source.js';
import {taraxaHealable,sortTaraxaRecipients} from './arkpedia-taraxa-ordinary.js';
import {taraxaAirBlocking} from './arkpedia-taraxa-aura.js';
import {COLS} from '../constants.js';
export const TARAXA_S2_HEALS_CONTRACT=Object.freeze({
 scope:'Selected Taraxacum S2 primary, air-block-condition secondary and primary-only splash payloads; no account/attack controller or public admission.',
 mapping:'Original filter75 maps to injured air-blocking recipients first, then ordinary lowest HP ratio/latest deployment; filter3 maps to lowest HP ratio/latest deployment, including full HP for emitted secondary/splash selectors. Native CheckBlockModeFLY maps only to ally liftoff, not FLY motion. One source primary release emits independent speed-ten/ten-second main transport. If its retained primary is air blocking and the separately accepted second-heal passive is present, one other current legal ally in owner range receives an independent speed-ten transport with no additional attack receipt. Primary arrival heals and independently admits its original instant splash buff, even if actual primary healing is zero. The buff emits up to selected splash_num speed-five/ten-second homing payloads from that recipient through its current original x-4 nine-cell grid, excluding the primary entity. Secondary has no active splash buff; the splash projectile explicitly disables buff delivery and cannot recurse. Matching source life supplies live ATK/attack scale/output healing. Retired/replaced source uses each emitted payload snapshot; children retain the last matching parent-impact attributes after source retirement. Recipient life, normal incoming modifiers, heal-free checks and callbacks remain active.',
 limitations:'Numeric selector aliases, full-HP emission, release/arrival ordering, attribute dispatch after source loss, ability lookup after mode exit and receiver-centred range/ties are explicit local mappings. Native parabolic raise-height-one art maps to two-dimensional homing transport here. No compiled methods, effects/audio, Unity/game-frame parity, module or public delivery claims.',frameParity:false,
});
const present=t=>t?.alive&&t.deployed&&!t.removed&&!t._removing;
const retained=t=>present(t)&&!t.hidden&&t.side==='ally';
export function verifyTaraxaS2Heals(n=taraxaNativeInputs()){
 const c=id=>taraxaSourceComponent('characters',ID,id),main=c('5064085090217097404'),second=c('-8824842318984447812'),splash=c('-8560662727063635780');
 for(const [s,filter,num]of[[main,75,1],[second,3,1],[splash,3,2]])
  if(s._postFilter!==filter||s._maxNum!==num||s._targetSide!==1||s._ignoreHealFree!==0||s._excludeOwner!==0)
   throw Error('Changed original Taraxacum S2 selectors');
 if(splash._maxTargetKey!=='splash_num'||c('-3822270150983354180')._rangeId!=='x-4'
  ||JSON.stringify(e.tables.ranges['x-4'].grids)!==JSON.stringify([{row:1,col:-1},{row:1,col:0},{row:1,col:1},{row:0,col:-1},{row:0,col:0},{row:0,col:1},{row:-1,col:-1},{row:-1,col:0},{row:-1,col:1}]))
  throw Error('Changed original Taraxacum S2 splash grid');
 const secondActions=n.templates['taraxa_s2[second_heal]'].eventToActions.ON_ABILITY_CAST_ON_TARGET,emit=n.templates['taraxa_s2[splash]'].eventToActions.ON_BUFF_START[0];
 if(secondActions[0]._blockMode!=='FLY'||secondActions[0]._targetType!=='TARGET'||secondActions[1]._abilityName!=='SecondSelector'
  ||secondActions[1]._excludeTarget!==true||secondActions[1]._excludeTargetType!=='TARGET'
  ||secondActions[1]._projectileKey!=='projectile_chr_taraxa_s2_1'||secondActions[1]._overwriteBuffs!==false
  ||emit._abilityName!=='SplashSelector'||emit._projectileKey!=='projectile_chr_taraxa_s2_2'||emit._excludeTarget!==true
  ||emit._excludeTargetType!=='BUFF_OWNER'||emit._startPointTarget!=='BUFF_OWNER'||emit._hookStartPoint!==true)
  throw Error('Changed original Taraxacum S2 emission templates');
 if(n.modes[5].abilities[0]._activeBuffs.length!==0||n.modes[5].attack._activeBuffs[0]?.buffKey!=='taraxa_s2[splash]'
  ||c('8114612629470640316')._buffs[0]?.buffKey!=='taraxa_s2[second_heal]')throw Error('Changed original Taraxacum S2 passive/active buffs');
 for(const[key,speed,dontBuff]of[['projectile_chr_taraxa_s2_1',10,0],['projectile_chr_taraxa_s2_2',5,1]]){
  const ds=n.projectiles[key].flatMap(r=>r.components.map(c=>c.data)),root=ds.find(d=>d._lifeTime!=null),move=ds.find(d=>d._speed!=null);
  if(root._lifeTime!==10||root._managedBySource!==0||root._stopWhenSourceInvalid!==0||root._alwaysHitTraceTargetInTheEnd!==1
   ||root._canHitSameTargetMultipleTimes!==0||root._maxHitNum!==1||root._actionController._dontAddBuffs!==dontBuff||move._speed!==speed)throw Error('Changed original Taraxacum S2 transport');
  if(dontBuff){const action=JSON.parse(ds.find(d=>d._overwriteActions===1)._actions.SerializedState)[0];
   if(move._raiseHeight!==1||action._healScaleKey!=='heal_scale_2'||action._ignoreHealFree!==false)
    throw Error('Changed original Taraxacum S2 splash healing');}
 }
}
export class TaraxaSkillTwoHeals{
 constructor(b,u,{contract}={}){
  if(contract!==TARAXA_S2_HEALS_CONTRACT||u.deploySeq!==0||u.def.charId!==ID||selectedTaraxaInputs(u).index!==1)
   throw Error('Fresh original selected Taraxacum S2 and exact healing contract required');
  verifyTaraxaS2Heals();this.b=b;this.u=u;this.record=selectedTaraxaInputs(u);this.seq=null;
  this.flights=new Map();this.watchers=[];this.ended=false;this.serial=0;
 }
 bind(){if(this.seq!==null||!present(this.u))throw Error('S2 payload binds one living deployment life');this.seq=this.u.deploySeq;}
 liveSource(ctx){return present(this.u)&&this.u.deploySeq===ctx.sourceLife;}
 values(ctx){return this.liveSource(ctx)?{...ctx,atk:this.u.s.atk*this.u.s.atkScaleMul,healingDealtMul:this.u.s.healingDealtMul}:ctx;}
 ownerRecipients(){if(this.b.rangeChanged(this.u))this.b._refreshRange(this.u);
  return this.b.allyUnits.filter(t=>taraxaHealable(this.b,this.u,t)&&this.u.rangeKeySet.has(t.tileR*COLS+t.tileC));}
 primary(){const ts=this.ownerRecipients().filter(t=>t.hp<t.s.maxHp-1e-8);
  return sortTaraxaRecipients(ts).sort((a,b)=>Number(taraxaAirBlocking(b))-Number(taraxaAirBlocking(a)))[0]??null;}
 secondary(primary){return sortTaraxaRecipients(this.ownerRecipients().filter(t=>t!==primary))[0]??null;}
 splashRecipients(at){const keys=new Set(e.tables.ranges['x-4'].grids.map(p=>`${Math.round(at.y)+p.row}:${Math.round(at.x)+p.col}`));
  return sortTaraxaRecipients(this.b.allyUnits.filter(t=>t!==at&&taraxaHealable(this.b,this.u,t)&&keys.has(`${t.tileR}:${t.tileC}`)))
   .slice(0,this.record.bb['attack@splash_num']);}
 launch(primary,{attackId=null,secondary=false}={}){
  if(this.ended||this.b.finished||!present(this.u)||this.u.deploySeq!==this.seq||!retained(primary))return false;
  const ctx={sourceLife:this.seq,atk:this.u.s.atk*this.u.s.atkScaleMul,healingDealtMul:this.u.s.healingDealtMul,attackId};
  // Resolve the separate recipient before any future projectile/healing callback.
  const other=secondary&&taraxaAirBlocking(primary)?this.secondary(primary):null;
  this.send(this.u,primary,ctx,'primary');
  if(other&&!this.ended&&!this.b.finished)this.send(this.u,other,ctx,'secondary');
  return true;
 }
 send(from,target,ctx,kind){if(this.ended||this.b.finished||!retained(target))return;
  const life=target.deploySeq;let projectile,claimed=false;
  projectile=this.b.addProjectile({from,target,source:this.u,speed:kind==='splash'?5:10,maxAge:10,visual:'orb',
   data:{arkpediaTrackedVisual:true,taraxaS2:kind},onHit:()=>{
    if(claimed)return;claimed=true;this.flights.delete(projectile);
    if(this.ended||this.b.finished||target.deploySeq!==life||!retained(target)){this.unwatch();return;}
    const attrs=this.values(ctx),scale=this.record.bb[kind==='splash'?'attack@heal_scale_2':'attack@heal_scale'];
    this.b.heal(this.u,target,attrs.atk*scale,{isSkill:true,isAttack:kind==='primary',isProjectile:true,attackId:ctx.attackId,
     tags:[`taraxa:s2-${kind}`],...(!this.liveSource(ctx)?{sourceHealingDealtMul:attrs.healingDealtMul}:{})});
    if(kind==='primary'&&!this.ended&&!this.b.finished&&target.deploySeq===life&&retained(target))this.splash(target,attrs,life);
    this.unwatch();
   }});
  this.flights.set(projectile,{target,life,kind,ctx});this.watch();
 }
 splash(target,ctx,life){
  const token={owner:this,finished:false},key=`taraxa_s2[splash]:${this.seq}:${++this.serial}`;
  const buff=this.b.addBuff(target,{key,source:this.u,data:{taraxaSplash:token},onRemove:()=>{token.finished=true;}});
  if(buff?.data?.taraxaSplash!==token)return;
  const accepted=!token.finished&&target.buffs.includes(buff)&&!this.ended&&!this.b.finished&&target.deploySeq===life&&retained(target);
  if(accepted){const recipients=this.splashRecipients(target);
   for(const t of recipients){if(token.finished||this.ended||this.b.finished||target.deploySeq!==life||!retained(target))break;
    this.send(target,t,ctx,'splash');}}
  if(target.buffs.includes(buff)&&buff.data?.taraxaSplash===token)this.b.removeBuff(target,buff);
 }
 watch(){if(this.watchers.length||!this.flights.size)return;
  this.watchers=[this.b.on('tick',()=>{for(const p of this.flights.keys())if(!this.b.projectiles.list.includes(p)&&!this.b.projectiles.arriving.includes(p))this.flights.delete(p);this.unwatch();}),
   this.b.on('battleEnd',()=>this.drain())];}
 unwatch(){if(this.flights.size)return;for(const h of this.watchers)this.b.off(h);this.watchers=[];}
 drain(){this.ended=true;this.b.removeProjectiles(p=>this.flights.has(p));this.flights.clear();this.unwatch();}
}
