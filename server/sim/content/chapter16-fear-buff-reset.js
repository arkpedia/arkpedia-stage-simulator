// SPDX-License-Identifier: GPL-3.0-or-later
// Orchestrate the retained default Buff.Reset branches. Callers bind the
// concrete phase receivers and native context effects; no stage admission.
export function fearProjectileResetBuff({buff,readData,readTemplate,readConfig,resetContext,resetBlackboard,resetLifetime,
 resetTriggers,loadAttributes,loadActions,calculatePriority,resetOverride,initializeStatus,initializeFinalFlags,isActive}){
 if(!buff||[readData,readTemplate,readConfig,resetContext,resetBlackboard,resetLifetime,resetTriggers,loadAttributes,
  loadActions,calculatePriority,resetOverride,initializeStatus,initializeFinalFlags,isActive].some(fn=>typeof fn!=='function'))
  throw new TypeError('Fear buff reset requires native configuration, phase and lifecycle callers');
 let running=false;const cancelled=Symbol('cancelled');
 const boolean=value=>{if(typeof value!=='boolean')throw new TypeError('Fear buff reset requires native Boolean fields');return value;};
 const nonnull=value=>{if(value==null)throw new TypeError('Fear buff reset dereferenced a null native object');return value;};
 const check=()=>{if(!boolean(isActive()))throw cancelled;};
 const invoke=(fn,...args)=>{const value=fn(...args);check();return value;};
 return Object.freeze({
  run(){
   if(running)return null;running=true;
   try{
    check();invoke(resetContext);
    const blackboard=invoke(resetBlackboard);
    if(!blackboard||typeof blackboard.durationKey!=='string')throw new TypeError('Fear buff reset requires its captured blackboard duration key');
    invoke(resetLifetime,blackboard.durationKey);invoke(resetTriggers);
    // Native reads config.data before committing stack=1, but does not
    // dereference data until after that write.
    const data=invoke(readData);buff.m_stackCnt=1;check();nonnull(data);
    buff.m_refreshRemainingTimeWhenStackMax=boolean(data.refreshRemainingTimeWhenStackMax);check();
    buff.m_clearAllStackCntWhenTimeUp=boolean(data.clearAllStackCntWhenTimeUp);check();
    invoke(loadAttributes,data.attributes,1);
    const template=nonnull(invoke(readTemplate));invoke(loadActions,template.eventToActions);
    const current=nonnull(invoke(readConfig));
    // BuffConfig is passed by value here; preserve its two references even if
    // the caller replaces config fields while calculating priority.
    const snapshot=Object.freeze({template:current.template,data:current.data});check();
    const priority=invoke(calculatePriority,snapshot);
    if(!Number.isInteger(priority)||priority<-(2**31)||priority>=2**31)throw new TypeError('Fear buff reset requires native Int32 priority');
    buff.priority=priority;check();
    invoke(resetOverride);invoke(initializeStatus);invoke(initializeFinalFlags);
    return Object.freeze({durationKey:blackboard.durationKey});
   }catch(error){if(error===cancelled)return null;throw error;}finally{running=false;}
  },
 });
}
