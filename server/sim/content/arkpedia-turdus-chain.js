// SPDX-License-Identifier: GPL-3.0-or-later
// Original moving chain transport. Public admission and native rendering are separate.
import e from '../../../data/arkpedia-native-operators/char_4224_turdus.json' with {type:'json'};
import {turdusNativeInputs,selectedTurdusInputs} from './arkpedia-turdus-source.js';
export const TURDUS_FREE='turdus[free_jump]',TURDUS_UP='turdus[atk_scale_up]';
export const TURDUS_CHAIN_CONTRACT=Object.freeze({
 scope:'Selected source speed-ten, ten-second independent heal chain with distinct free-bounce and carried attack-scale validators; not public admission',
 mapping:'One accepted source healing ability creates a finite moving chain. The original x-4 nine-cell selector searches around the last receiver, includes full-HP eligible allies, excludes already visited entities, and orders lowest HP ratio then latest deployment. Ordinary acquisition separately requires missing HP. A receiver with the accepted native atk_scale_up marker multiplies the current projectile scale by the selected producer talent value; that multiplication remains in later hops. A free_jump receiver adds one bounce and suppresses decay on the following hop, including when actual healing is zero. Its own arriving hop still has the preceding decay. Both native validators ignore marker source, so another genuinely marked Ukusik is eligible. Each receiver life is captured; an already-emitted receiver is not selected again. Source loss preserves finite born transport, with launch ATK/output-healing multiplier fallback; a later source life cannot supply new ATK. All chain hops retain one ten-second transport budget and one original attack receipt.',
 corroboration:'The original two validators and blackboard keys are retained. Firsthand ChainLightningHitBehaviour analysis and algebra at https://prts.wiki/w/话题:Zkfsc0tkcmgr7a8s (2026-08-28, authors 调零修罗 and Enko) corroborate carried scaling and next-hop suppression; this community analysis does not establish identical compiled-client provenance.',
 limits:'Numeric selector/filter and cached-versus-live ATK dispatch, target acquisition timing, renewed-life selection, segmented presentation of one native transport and tie order remain local mappings. Native effects/audio, modules, physical-device and game-frame/pixel parity and public art/data acceptance remain unverified.',frameParity:false,
});
const present=u=>u?.alive&&u.deployed&&!u._removing;
export function turdusHealable(b,u,t){return present(t)&&!t.hidden&&t.side==='ally'&&t.kind!=='device'&&!t.s.flags.untargetable&&!t.s.flags.healFree
 &&(t===u||!t.s.flags.noHeal&&!t.profile?.noHeal&&b.allySelectable(t,u));}
export function sortTurdusAllies(ts){return ts.sort((a,b)=>a.hp/a.s.maxHp-b.hp/b.s.maxHp||b.deploySeq-a.deploySeq||String(a.id).localeCompare(String(b.id)));}
export function verifyTurdusChains(){const n=turdusNativeInputs();
 for(const [key,chain,selector]of[['projectile_chr_turdus',n.chain,n.chainSelector],['projectile_chr_turdus_s2',n.s2Chain,n.s2ChainSelector]]){
  const components=e.projectiles[key].flatMap(r=>r.components),ds=components.map(c=>c.data),root=ds.find(d=>'_lifeTime'in d),motion=ds.find(d=>'_speed'in d),get=p=>components.find(c=>c.pathId===p.m_PathID)?.data;
  if(root._lifeTime!==10||root._maxHitNum!==1||root._managedBySource!==0||root._stopWhenSourceInvalid!==0||root._canHitSameTargetMultipleTimes!==0||motion._speed!==10||motion._moveType!==1||motion._delayToStart!==0
   ||chain._onlyCheckHitWhenReachTarget!==1||chain._exceptSource!==0||chain._useChainPrefix!==1||chain._atkScale!==0.8500000238418579
   ||selector._maxTarget!==2||selector._useChainPrefix!==1||selector._useAdditionalTargetCount!==1||selector._ignoreHealFree!==0||selector._filterType!==39)
   throw Error('Changed original Ukusik chain transport/selector');
  for(const [ref,marker]of[[selector._freeJumpValidator,TURDUS_FREE],[chain._freeJumpValidator,TURDUS_FREE],[chain._atkScaleUpValidator,TURDUS_UP]]){
   const v=get(ref);if(v?._buffs?.join()!==marker||v._filterBuffSource!==0||v._excludeKey!==0)throw Error('Changed original Ukusik chain marker validator');
  }
 }
 const trait=e.tables.character.trait.candidates[0].blackboard,bb=Object.fromEntries(trait.map(v=>[v.key,v.value]));
 if(bb['chain.max_target']!==3||bb['chain.atk_scale']!==.75||JSON.stringify(e.tables.ranges['x-4'].grids)!==JSON.stringify([{row:1,col:-1},{row:1,col:0},{row:1,col:1},{row:0,col:-1},{row:0,col:0},{row:0,col:1},{row:-1,col:-1},{row:-1,col:0},{row:-1,col:1}]))throw Error('Changed original Ukusik chain trait/range');
 return n;
}
export class TurdusChains{
 constructor(b,u,record,{contract,onRecipient=()=>{}}={}){
  if(contract!==TURDUS_CHAIN_CONTRACT)throw Error('Exact selected Ukusik chain contract required');verifyTurdusChains();const original=selectedTurdusInputs(u);if(JSON.stringify(record)!==JSON.stringify(original))throw Error('Changed selected Ukusik chain inputs');Object.assign(this,{b,u,record,onRecipient,flights:new Map(),chains:new Set(),watchers:[],marks:[],seq:null,ended:false});
 }
 installMarkers(){this.seq=this.u.deploySeq;if(!this.record.talents.length)return;
  for(const key of[TURDUS_FREE,TURDUS_UP]){const mark=this.b.addBuff(this.u,{key,source:this.u,persist:true});if(mark)this.marks.push(mark);
   if(!present(this.u)||this.u.deploySeq!==this.seq||this.b.finished){this.removeMarkers();break;}}
 }
 removeMarkers(){for(const mark of this.marks)if(this.u.findBuff(mark.key)===mark)this.b.removeBuff(this.u,mark);this.marks=[];}
 sourceAtk(ctx){return present(this.u)&&this.u.deploySeq===ctx.sourceLife?this.u.s.atk:ctx.atk;}
 launch(t,{s2=false,extra=0,attackId=null}={}){
  if(this.ended||this.b.finished||!present(this.u)||this.u.deploySeq!==this.seq||!turdusHealable(this.b,this.u,t))return false;
  if(!Number.isInteger(extra)||extra<0||extra>1)throw Error('Unreviewed Ukusik chain allowance');
  const ctx={sourceLife:this.seq,atk:this.u.s.atk,healingDealtMul:this.u.s.healingDealtMul,expires:this.b.time+10,remaining:2+extra,scale:1,skipDecay:false,visited:new Set(),s2,attackId};this.chains.add(ctx);this.send(ctx,this.u,t);return true;
 }
 next(ctx,at){if(ctx.remaining<=0)return null;const r=Math.round(at.y),c=Math.round(at.x),keys=new Set(e.tables.ranges['x-4'].grids.map(p=>`${r+p.row}:${c+p.col}`));
  return sortTurdusAllies(this.b.allyUnits.filter(t=>!ctx.visited.has(t)&&turdusHealable(this.b,this.u,t)&&keys.has(`${t.tileR}:${t.tileC}`)))[0]??null;
 }
 send(ctx,from,t){if(this.ended||this.b.finished||this.b.time+1e-7>=ctx.expires){this.finish(ctx);return;}
  const life=t.deploySeq;let projectile;
  projectile=this.b.addProjectile({from,target:t,source:this.u,speed:10,maxAge:Math.max(1e-7,ctx.expires-this.b.time),expireInPlace:true,visual:'orb',data:{arkpediaTrackedVisual:true,turdusChainOwner:this.u.id,turdusS2:ctx.s2},onHit:()=>{
   this.flights.delete(projectile);if(this.ended||this.b.finished||!present(t)||t.hidden||t.deploySeq!==life||t.side!=='ally'||Math.hypot(projectile.x-t.x,projectile.y-t.y)>1e-5){this.finish(ctx);return;}
   // Claim before any healing/resource callback so recursive work cannot repeat a receiver.
   ctx.visited.add(t);const free=!!t.findBuff(TURDUS_FREE),up=!!t.findBuff(TURDUS_UP);
   if(up)ctx.scale*=this.record.talentBb[0]?.['chain.atk_scale_2']??1;
   if(free){ctx.remaining++;ctx.skipDecay=true;}
   this.b.heal(this.u,t,this.sourceAtk(ctx)*ctx.scale,{isSkill:ctx.s2,isAttack:true,attackId:ctx.attackId,tags:['turdus:chain',...(ctx.s2?['turdus:s2']:[])],...(!(present(this.u)&&this.u.deploySeq===ctx.sourceLife)?{sourceHealingDealtMul:ctx.healingDealtMul}:{})});
   if(!this.ended&&!this.b.finished&&present(t)&&t.deploySeq===life&&ctx.s2)this.onRecipient(t,ctx);
   if(this.ended||this.b.finished||!present(t)||t.deploySeq!==life){this.finish(ctx);return;}
   const next=this.next(ctx,t);if(!next){this.finish(ctx);return;}
   ctx.remaining--;if(ctx.skipDecay)ctx.skipDecay=false;else ctx.scale*=.75;this.send(ctx,t,next);this.unwatch();
  }});this.flights.set(projectile,ctx);this.watch();
 }
 finish(ctx){this.chains.delete(ctx);for(const[p,c]of this.flights)if(c===ctx){this.b.removeProjectiles(x=>x===p);this.flights.delete(p);}this.unwatch();}
 watch(){if(this.watchers.length)return;this.watchers=[this.b.on('tick',()=>{for(const[p,ctx]of this.flights)if(!this.b.projectiles.list.includes(p)&&!this.b.projectiles.arriving.includes(p)){this.flights.delete(p);this.finish(ctx);}this.unwatch();}),this.b.on('battleEnd',()=>this.drain())];}
 unwatch(){if(this.flights.size||this.chains.size)return;for(const h of this.watchers)this.b.off(h);this.watchers=[];}
 drain(){this.ended=true;this.b.removeProjectiles(p=>this.flights.has(p));this.flights.clear();this.chains.clear();this.unwatch();this.removeMarkers();}
}
