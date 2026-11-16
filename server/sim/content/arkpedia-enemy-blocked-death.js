// SPDX-License-Identifier: GPL-3.0-or-later
import {scatterFragments} from './arkpedia-enemy-summons.js';
import {recordStageOutcome,stageOutcomeCounter} from './arkpedia-stage-outcomes.js';
/** A native before-HP-zero mode owns its instant summon passive. Capture the
 * blocker while it still exists; normal removal subsequently releases it. */
export function blockedDeathSummons(params){
 validate(params);const{key,cnt,parentKey,logKey,unblockedLogKey,blockedDieClip,defaultDieClip,delay,radius}=params;
 return[{
  spawn(b,e,a){a.life=e.deploySeq;a.entered=false;a.mode=0;a.parent=b.addBuff(e,{key:parentKey,source:e,refresh:'independent',maxStacks:Infinity,admit:u=>u.alive&&u.deployed&&u.deploySeq===a.life});
   // The ordinary attack component may finish its pending cast during death.
   // Apply the mode's native death-clip replacement after that common cleanup.
   b.on('death',c=>{if(c.unit===e&&c.reason==='killed'&&e.deploySeq===a.life)e.mem.regularFormVisual={clip:a.mode===1?blockedDieClip:defaultDieClip,die:a.mode===1?blockedDieClip:defaultDieClip,loop:false,speed:1,playId:`blockedDeath:${e.id}:${a.life}`};},{owner:e,priority:-100});
  },
  killed(_c,b,e,a){
   if(e.hp>0||e.mem.deathByFall||e.deploySeq!==a.life||!a.parent||!e.buffs.includes(a.parent)||a.entered)return;
   if(!e.blockedBy){recordStageOutcome(b,e,unblockedLogKey);return;}
   a.mode=1;a.entered=true;
   // The mode's instant passive checks Silence before asking the scheduler.
   // Once queued, these source-owned children survive removal of their host.
   if(!e.s.flags.silence)scatterFragments(b,e,key,cnt,{delay,radius,randomDelay:false,groundOnly:true});
  },
  death(_c,b,e,a){if(a.parent)b.removeBuff(e,a.parent);a.parent=null;},
 },stageOutcomeCounter({killedKey:'killed',buffKey:logKey})];
}
function validate({key,cnt,parentKey,logKey,unblockedLogKey,blockedDieClip,defaultDieClip,delay,radius}){
 if(typeof key!=='string'||!/^enemy_[a-z0-9_]+$/i.test(key)||!Number.isSafeInteger(cnt)||cnt<1||cnt>20
  ||[parentKey,logKey,unblockedLogKey,blockedDieClip,defaultDieClip].some(k=>typeof k!=='string'||!k||k.length>256)||parentKey===logKey
  ||!Number.isFinite(delay)||delay<0||delay>128||!Number.isFinite(radius)||radius<0||radius>16)throw Error('Invalid blocked death summons');
}
blockedDeathSummons.validate=validate;
