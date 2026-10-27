// SPDX-License-Identifier: GPL-3.0-or-later
// Literal ordinary-miner actions; local talent attachment remains a separate gate.
import contract from '../../../data/candidates/arkpedia-ch16-miner-listener-contract.json' with {type:'json'};
import {chapter16Shadow} from './chapter16-shadow.js';
const epsilon=1e-7;
// CheckContainsBuff names the native buff, rather than testing a raw abnormal
// flag. Shared owned Fear applications retain that identity in `status`.
const hasFear=e=>e.buffs.some(buff=>buff.key==='fear'||buff.status==='fear'||buff.data?.nativeBuffKey==='fear');
export function minerListeners(record){
 const value=record.talents.bb['FearLoseBlood.value'],duration=record.talents.bb['TileEscapeShadowManager.times'];
 if(record.key!=='enemy_3010_mcreep'||record.prefabKey!==record.key||!Number.isFinite(value)||value<0||!(duration>0))
  throw Error('Unreviewed ordinary miner listener parameters');
 return{
  spawn(b,e,a){
   const life=e.deploySeq;a.active=true;a.blood=null;a.handles=[];e.mem.ch16MinerListeners=a;
   const valid=()=>a.active&&!b.finished&&!b._endReq&&e.alive&&e.deployed&&e.deploySeq===life&&e.mem.ch16MinerListeners===a;
   a.valid=valid;
   a.detach=()=>{
    if(!a.active)return;a.active=false;
    for(const buff of [a.listener,a.shadow,a.blood?.buff])if(buff)b.removeBuff(e,buff);
    a.listener=null;a.shadow=null;a.blood=null;
    for(const handle of a.handles)b.off(handle);a.handles=[];
   };
   a.handles.push(b.on('removed',({unit})=>{if(unit===e)a.detach();},{owner:e}),b.on('battleEnd',a.detach,{owner:e}));
   const root=key=>b.addBuff(e,{key,persist:true,source:e,admit:valid});
   a.listener=root(contract.listener.buff.buffKey);a.shadow=root(contract.shadow.buff.buffKey);
   a.nextListener=b.time+contract.listener.buff.triggerInterval;a.nextShadow=b.time+contract.shadow.buff.triggerInterval;
   a.createBlood=()=>{
    const p={buff:null,next:b.time+contract.blood.firstTriggerInterval};a.blood=p;
    p.buff=b.addBuff(e,{key:contract.blood.buffKey,persist:true,source:e,
     admit:()=>valid()&&a.blood===p,
     onRemove:()=>{if(a.blood===p)a.blood=null;}});
    if(!p.buff||!valid()||a.blood!==p){if(p.buff)b.removeBuff(e,p.buff);if(a.blood===p)a.blood=null;}
   };
   if(!valid())a.detach();
  },
  tick(b,e,a){
   if(!a.valid()){a.detach();return;}
   const owns=buff=>buff&&e.findBuff(buff.key)===buff;
   if(owns(a.listener))while(b.time+epsilon>=a.nextListener&&a.valid()&&owns(a.listener)){
    a.nextListener+=contract.listener.buff.triggerInterval;
    if(hasFear(e)){if(!e.findBuff(contract.blood.buffKey))a.createBlood();}
    else b.removeBuff(e,contract.blood.buffKey);
   }
   if(owns(a.shadow))while(b.time+epsilon>=a.nextShadow&&a.valid()&&owns(a.shadow)){
    a.nextShadow+=contract.shadow.buff.triggerInterval;
    if(e.findBuff(contract.mapping.guardianKey)){
     // Native FinishBuff ends this root, rather than pausing its output.
     b.removeBuff(e,a.shadow);a.shadow=null;break;
    }
    if(!hasFear(e)){
     const env=chapter16Shadow(b),row=Math.round(e.y),col=Math.round(e.x);
     for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)env.suppressShadow(row+dr,col+dc,duration);
    }
   }
   const p=a.blood;
   if(p&&!owns(p.buff)){if(a.blood===p)a.blood=null;return;}
   while(p&&a.blood===p&&a.valid()&&owns(p.buff)&&b.time+epsilon>=p.next){
    p.next+=contract.blood.triggerInterval;
    // Full HP skips damage without finishing/resetting this independent child.
    if(e.hp/e.s.maxHp!==1)b.dealDamage(e,e,{amount:value,type:'true',canDodge:false,tags:['chapter16','miner-fear-blood']});
   }
  },
  death(c,b,e,a){a.detach();},
 };
}
