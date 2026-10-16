// SPDX-License-Identifier: GPL-3.0-or-later
// Selected full S3 summon lifecycle. Public admission and native FX stay separate.
import {McGrafLifecycle} from './arkpedia-mcgraf-lifecycle.js';
import {mcgrafAttackKit,MCGRAF_S3_ATTACK_CONTRACT} from './arkpedia-mcnist-attacks.js';
import {MechanistS3Owner} from './arkpedia-mcnist-s3-owner.js';
import {prepareMcGrafS3Aura,MCGRAF_S3_AURA_CONTRACT} from './arkpedia-mcgraf-s3-aura.js';
import {selectedMcGrafBuild} from './arkpedia-mcgraf-source.js';
import {MCNIST_ID as ID,MCGRAF_ID as TOKEN,mechanistNativeInputs,mechanistSourceComponent} from './arkpedia-mcnist-source.js';
import {dirVec,isDir} from '../dir.js';
import {bodyKeys} from '../body.js';
import {canTargetEnemy} from '../targeting.js';
import {COLS} from '../constants.js';
import evidence from '../../../data/arkpedia-native-operators/char_4230_mcnist.json' with {type:'json'};
export const MCGRAF_S3_LIFECYCLE_CONTRACT=Object.freeze({
 scope:'Selected original McGraf S3 deployment, ordinary melee, charge transport, fresh replacement and source aura; no public admission',
 mapping:'One ten-DP chosen-facing low-ground zero-slot summon retains original independent stats, HealFree, lifetime, T2 barrier and ordinary melee. Accepted host S3 starts a charge if its current McGraf exists. Manual deployment during active S3 also charges; an automatic replacement does not recursively charge. The old token is removed without a death pose or rebirth, its tile freed, and a legally born projectile waits .25 seconds before travelling at speed twenty. Its direction and horizontal face select one of six original projectile aliases. Ground enemies stop the source tile ray; flying enemies do not, but the physical arrival burst can hit current ground/air bodies with the host coefficient. Arrival ends the two-second hidden-card/respawn-stop command, selects an available preceding low-ground melee tile and spawns a fresh full-HP source-linked token without DP or deployment-slot cost. New life resets original birth/lifetime and T2 barrier; the active host grants its separate decaying aura. A failed or vanished transport returns one cooling card. Born transport can finish after mode/source departure, but an invalid owner cannot receive a replacement. Owner/battle end remove current tokens/cards; independent finite flight cleanup survives owner hooks.',
 limits:'Native custom tile filter 46 and AssignMcgrafTile are mapped to a deployment-facing tile ray ending at the first legal ground-enemy tile, before high/impassable terrain or at the map edge; landing scans that ray backward for current legal free ground. Endpoint capture, body/tile overlap, source-filter selectability, alternate-landing order, command/card cooldown pause, skip-rebirth removal, birth/locate priority, live/cached damage transport, aura attachment and callback transactions remain local interpretations. Compiled native collision/selection, particles/audio, modules and original game-frame/pixel parity are unverified. No public roster approval.',frameParity:false,
});
const present=t=>t?.alive&&t.deployed&&!t._removing;
const type=n=>n.$type.split('+')[1].split(',')[0];
const variants=['projectile_chr_mcnist_s3_token','projectile_chr_mcnist_s3_token_right','projectile_chr_mcnist_s3_token_up','projectile_chr_mcnist_s3_token_up_right','projectile_chr_mcnist_s3_token_down','projectile_chr_mcnist_s3_token_down_right'];
export function mcgrafChargeVariant(dir,faceLeft){if(!isDir(dir)||typeof faceLeft!=='boolean')throw Error('Original cardinal direction and horizontal face required');return dir==='UP'?variants[faceLeft?2:3]:dir==='DOWN'?variants[faceLeft?4:5]:variants[faceLeft?0:1];}
function projectileInputs(key){const rows=evidence.projectiles[key].flatMap(r=>r.components.map(c=>c.data));return{root:rows.find(d=>'_lifeTime'in d),move:rows.find(d=>'_speed'in d),select:rows.find(d=>'_targetOptions'in d),area:rows.find(d=>'_onlyInputPos'in d),action:rows.find(d=>'_actions'in d)};}
function nativeVariant(node,bb){if(node._projectileKey)return node._projectileKey;
 const evalCondition=c=>{if(type(c)!=='FilterByBlackboardValue'||!['direction','faceLeft'].includes(c._blackboardKey))throw Error('Changed native charge direction condition');
  if(c._condType==='EQUALS')return bb[c._blackboardKey]===c._valueToCompare;if(c._condType==='GE')return bb[c._blackboardKey]>=c._valueToCompare;throw Error('Changed native charge comparison');};
 let ok;if(type(node)==='IfElse')ok=evalCondition(node._conditionNode);else if(type(node)==='IfConditions'){
  const values=node._conditionsNode.map(evalCondition);ok=node._isAnd?values.every(Boolean):values.some(Boolean);
 }else throw Error('Changed native charge direction branch');return nativeVariant((ok?node._succeedNodes:node._failNodes)[0],bb);
}
function verify(){const n=mechanistNativeInputs(),c=(key,id)=>mechanistSourceComponent('skills',key,id),selector=c('sktok_mcgraf','2893496192822870562'),emit=c('sktok_mcgraf','-527821534796250590'),
 take=n.templates.mcnist_s_3_projectile_token.eventToActions.ON_BUFF_START,command=n.templates.mcnist_s_3_projectile_trigger.eventToActions.ON_BUFF_TRIGGER[0]._buff;
 if(emit._metadata.namedAsAlias!=='EmitProjectile'||emit._selector.m_PathID!=='2893496192822870562'||selector._filterType!==46||selector._targetMotion!==1||selector._targetSide!==2
  ||selector._options.heightType!==0||selector._options.checkHeightType!==1||selector._excludeCamouflagCharacter!==0
  ||take[3]._finishDerivedBuffIfParentFinish!==false||type(take[4])!=='InstantKill'||take[4]._skipReborn!==true||take[4]._switchState!==false
  ||command.lifeTime!==2||command.durationKey!=='invalid'||command.blackboard[0].key!=='respawn_stopped'||command.blackboard[0].value!==1)throw Error('Changed native McGraf S3 charge/lifecycle graph');
 const hide=n.templates.mcnist_s_3_projectile.eventToActions.ON_BUFF_START[0]._succeedNodes;
 if(hide[0]._lifeType!=='UNTIL_NEXT_SPAWN'||hide[1]._isShow!==false||hide[4]._finishDerivedBuffIfParentFinish!==false
  ||n.templates.mcgraf_s_3_passive.eventToActions.ON_OWNER_LOCATE[0]._succeedNodes[0]._skillIndex!==2
  ||type(n.templates.mcgraf_s_3_passive.eventToActions.ON_OWNER_LOCATE[0]._succeedNodes[2])!=='CheckCharacterIsMannuallySpawned')throw Error('Changed native McGraf manual-locate/card handoff');
 const tree=n.templates.mcnist_s_3_projectile_real.eventToActions.ON_BUFF_START[0];
 for(const[direction,dir]of ['UP','RIGHT','DOWN','LEFT'].entries())for(const faceLeft of[true,false])if(nativeVariant(tree,{direction,faceLeft:faceLeft?1:0})!==mcgrafChargeVariant(dir,faceLeft))throw Error('Changed original charge direction/face aliases');
 for(const key of variants){const{root,move,select,area,action}=projectileInputs(key),damage=JSON.parse(action._actions.SerializedState)[0];
  if(root._lifeTime!==10||root._maxHitNum!==1||root._stopWhenSourceInvalid!==0||root._eliminatableStatus!==0||move._speed!==20||move._delayToStart!==.25
   ||select._targetOptions.targetMotion!==3||select._ignoreCamouflage!==1||area._onlyInputPos!==1||area._onlyCheckHitWhenReachTarget!==1
   ||type(damage)!=='AdvancedApplyDamage'||damage._damageType!=='PHYSICAL'||damage._applyWay!=='NONE'||damage._atkScaleVar!=='atk_scale')throw Error('Changed original charge movement/impact graph');
 }
 const commands=[];function walk(x){if(!x||typeof x!=='object')return;if(x._projectileKey&&x._abilityName==='EmitProjectile')commands.push(x);for(const v of Object.values(x))if(typeof v==='object')walk(v);}
 walk(n.templates.mcnist_s_3_projectile_real);
 if(commands.length!==6||new Set(commands.map(v=>v._projectileKey)).size!==6||commands.some(v=>!variants.includes(v._projectileKey)||v._ev!=='ON_HIT_TILE'
  ||type(v._actions[3])!=='AssignMcgrafTile'||v._actions[5]._respawnSameToken!==false||v._actions[5]._refreshTokenCardCooldown!==false||v._actions[5]._spawnTokenFromCards!==true||v._actions[5]._useDirectionFromSharedData!==true))throw Error('Changed native McGraf directional replacement commands');
}
export function prepareMcGrafS3Lifecycle(b,u,{contract,owner}={}){
 const resources=owner?.resources;
 if(contract!==MCGRAF_S3_LIFECYCLE_CONTRACT||!(owner instanceof MechanistS3Owner)||owner!==u.mem.mcnistAttacks||owner.b!==b||owner.u!==u||u.def.charId!==ID||u.deploySeq!==0
  ||u.mem.mcgrafLifecycle||resources!==u.mem.mcnistBarriers||!resources.handles.length||resources.stopped)throw Error('Fresh selected S3 owner with installed resources and explicit McGraf S3 lifecycle contract required');
 verify();const r=selectedMcGrafBuild(resources.record.build);if(r.ownerIndex!==2)throw Error('Selected original McGraf S3 required');
 const deck=new McGrafS3Lifecycle(b,u,resources,r,owner);u.mem.mcgrafLifecycle=deck;return deck;
}
export class McGrafS3Lifecycle extends McGrafLifecycle{
 constructor(b,u,barriers,record,owner){super(b,u,barriers,record,MCGRAF_S3_ATTACK_CONTRACT);Object.assign(this,{owner,flight:null,transports:new Set(),transportHandles:[],commandSeq:0,arrivals:0,bursts:0});
  Object.defineProperties(this.state,{hidden:{get:()=>!!this.flight&&!this.flight.commandEnded},respawnStopped:{get:()=>!!this.flight&&!this.flight.commandEnded}});
 }
 placementError(row,col){if(this.flight)return 'McGraf is charging.';return super.placementError(row,col);}
 place(row,col,dir='RIGHT'){const t=super.place(row,col,dir);if(this.owner.inMode()&&present(t))this.charge(t);return t;}
 route(t){const [dr,dc]=dirVec(t.dir),path=[];let row=t.tileR,col=t.tileC,reason='edge';
  while(this.b.grid.inRect(row,col)){
   const tile=this.b.grid.tile(row,col);
   if(tile.height!=='LOW'||tile.pass!=='ALL'||this.b.grid.isObstacle(row,col)){reason='terrain';break;}
   path.push({row,col});const key=row*COLS+col;
   if(this.b.enemies.some(e=>canTargetEnemy(t,e,{canHitFly:false})&&bodyKeys(e).includes(key))){reason='enemy';break;}
   row+=dr;col+=dc;
  }
  const last=path.at(-1)??{row:t.tileR,col:t.tileC};return{path,reason,to:{x:last.col,y:last.row}};
 }
 charge(t=this.point?.unit){const s=this.point;if(this.flight||!this.valid()||!this.owner.inMode()||!s||s.unit!==t||s.seq!==t.deploySeq||!present(t))return false;
  const route=this.route(t),visual=t.mem.regularVisualDirection??t.dir,faceLeft=visual==='LEFT'||!['LEFT','RIGHT'].includes(visual)&&t.dir==='LEFT',
   f={id:++this.commandSeq,sourceLife:this.u.deploySeq,sourceActivation:this.u.skill.activations,tokenLife:t.deploySeq,old:t,dir:t.dir,from:{x:t.x,y:t.y},...route,
    bornAt:this.b.time,commandUntil:this.b.time+2,commandEnded:false,handled:false,finished:false,projectile:null,birthAtk:this.u.s.atk*this.u.s.atkScaleMul,scale:this.barriers.record.bb.atk_scale};
  f.alias=mcgrafChargeVariant(f.dir,faceLeft);const native=projectileInputs(f.alias);this.flight=f;this.transports.add(f);s.finished=true;this.point=null;this.stock=0;this.readyAt=Infinity;
  f.projectile=this.b.addProjectile({from:f.from,to:f.to,source:this.u,startDelay:native.move._delayToStart,speed:native.move._speed,maxAge:native.root._lifeTime,visual:'bolt',data:{arkpediaTrackedVisual:true,mcnistOwner:this.u.id,mcgrafCharge:true,nativeProjectile:f.alias,nativeEffect:native.root._mainEffect},onHit:()=>this.arrive(f)});
  this.watchTransports();t.mem.regularDeathVisual={hide:true,duration:0};
  // Native InstantKill skips rebirth and state switching. The local permanent
  // removal sends the ordinary finish/death notification without a kill-veto.
  t.hp=0;this.b._remove(t,'mcgraf-charge',this.u,true);if(this.b.finished)this.finishTransport(f);return true;
 }
 endCommand(f){if(f.commandEnded)return;f.commandEnded=true;f.commandEndedAt=this.b.time;}
 landing(f){for(const at of [...f.path].reverse()){
   const t=this.b.grid.tile(at.row,at.col);if(t.height!=='LOW'||t.pass!=='ALL'||!['MELEE','ALL'].includes(t.build)||this.b.grid.isObstacle(at.row,at.col))continue;
   if(this.b.unitAt(at.row,at.col)||this.b.tileReservation(at.row,at.col)||this.b.downOn(at.row,at.col))continue;return at;
  }return null;
 }
 burst(f){const b=this.b,u=this.u,attackId=++b._attackSeq,targets=b.foesInRadius(f.to.x,f.to.y,this.barriers.record.bb.projectile_range).filter(t=>canTargetEnemy(u,t,{canHitFly:true})).map(t=>({t,life:t.deploySeq}));this.bursts++;
  for(const{t,life}of targets){if(b.finished)break;if(t.deploySeq!==life||!canTargetEnemy(u,t,{canHitFly:true}))continue;
   const atk=present(u)&&u.deploySeq===f.sourceLife?u.s.atk*u.s.atkScaleMul:f.birthAtk;
   b.dealDamage(u,t,{amount:atk*f.scale,type:'phys',isAttack:true,isSkill:true,isSplash:true,attackId,applyWay:'none',tags:['mcgraf:s3-charge']});
  }
 }
 spawnReplacement(f,at){const b=this.b;let token,created;this.placing=true;
  try{const combat=mcgrafAttackKit(b,this.u,this.barriers,{contract:MCGRAF_S3_ATTACK_CONTRACT});
   token=b.spawnToken(this.u,TOKEN,at.row,at.col,{dir:f.dir,def:this.def,kit:{trait:combat.trait,talents:[],skill:null,install:(_b,t)=>{
    created=t;t.deploymentSlotCost=0;t.mem.regularSummonCard=this.state.key;b.addBuff(t,{key:'mcgraf:heal-free',source:t,persist:true,allowDead:true,flags:{healFree:true}});this.barriers.registerToken(t);combat.install(b,t);
   }}});
   if(!token||!present(token)||!this.valid()||this.point||this.flight)throw Error('McGraf replacement admission failed');
   this.point={unit:token,seq:token.deploySeq,bornAt:b.time,expiresAt:b.time+this.record.skillOverlay.duration,finished:false,mode:'born'};this.stock=0;this.readyAt=Infinity;f.spawned=token;this.arrivals++;
   if(this.owner.inMode()){const aura=prepareMcGrafS3Aura(b,token,{contract:MCGRAF_S3_AURA_CONTRACT,barriers:this.barriers});aura.install();}return token;
  }catch(error){f.failure=String(error.message);token??=created;if(present(token))b._remove(token,'mcgraf-replacement-cancelled',null,true);else if(token){this.barriers.removeToken(token);b.offOwner(token);token.removed=true;}return null;
  }finally{this.placing=false;}
 }
 arrive(f){if(f.finished||f.handled||!this.transports.has(f))return;f.handled=true;
  try{if(this.b.finished)return;this.burst(f);this.endCommand(f);if(this.flight===f)this.flight=null;
   if(this.valid()&&this.u.deploySeq===f.sourceLife&&!this.point&&!this.flight){const at=this.landing(f);if(at)this.spawnReplacement(f,at);else f.failure='No available original charge-path tile';}
  }finally{this.finishTransport(f);}
 }
 finishTransport(f){if(f.finished)return;f.finished=true;this.endCommand(f);this.transports.delete(f);if(this.flight===f)this.flight=null;
  if(f.projectile)this.b.projectiles.remove(p=>p===f.projectile);
  if(this.valid()&&!this.point&&!this.flight&&!this.placing){this.stock=1;this.readyAt=f.commandEndedAt+this.record.stats.respawnTime;}
  if(!this.transports.size){for(const h of this.transportHandles)this.b.off(h);this.transportHandles=[];}
 }
 watchTransports(){if(this.transportHandles.length)return;this.transportHandles=[this.b.on('tick',()=>{for(const f of [...this.transports]){
   if(!f.commandEnded&&this.b.time+1e-8>=f.commandUntil)this.endCommand(f);
   if(f.projectile.removed||!this.b.projectiles.list.includes(f.projectile)&&!this.b.projectiles.arriving.includes(f.projectile))this.finishTransport(f);
  }}),this.b.on('battleEnd',()=>{for(const f of [...this.transports])this.finishTransport(f);})];
 }
 install(){super.install();this.handles.push(this.b.on('skillStart',({unit})=>{if(unit===this.u&&this.owner.inMode())this.charge();},{owner:this.u}));}
 stop(){if(this.stopped)return;for(const f of this.transports)this.endCommand(f);super.stop();}
}
