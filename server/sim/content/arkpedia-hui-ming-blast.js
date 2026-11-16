// SPDX-License-Identifier: GPL-3.0-or-later
import {huiMingOf} from './arkpedia-hui-ming.js';
/** Native 'Smarty' blast talents over the shared Hui-Ming account.
 *  - Killed while holding an attribute: the small blast.
 *  - A polled same-side aura over other holders of the family marker: an
 *    opposite-attribute neighbour inside the trigger radius is made to release
 *    its large blast at once and is killed one trigger interval later; inside
 *    the wider hint radius it only carries a derived warning marker.
 *  - A blast is a stationary projectile: it lands after its lifetime on ground
 *    allies around the release point, with one scale for recipients without an
 *    attribute, one for the blaster's attribute and one for the opposite. It
 *    uses the release-time ATK, is refused by a silenced source and does not
 *    ask the source's own output scales.
 *  - New blocks need a blocker holding one of the native marker pairs. */
const live=u=>!!u&&u.alive&&u.deployed&&!u.removed&&!u.hidden;
export function huiMingBlast(params){
 validate(params);const {markerKey,deathKey,boomKey,warnKey,interval,hintRadius,triggerRadius,killDelay,blastDelay,blockPairs,small,large}=params;
 const release=(b,e,shape,attribute)=>{
  if(e.s.flags.silence)return;
  const amount=e.s.atk,x=e.x,y=e.y;
  b.fx?.('explode',{x,y,r:shape.radius,kind:'enemyArea'});
  b.after(blastDelay,()=>{
   for(const unit of b.allies(null,{includeTargetableDevices:true})){
    // The native area ignores camouflage but not target-free or other unselectable states; ground recipients only.
    const f=unit.s.flags;
    if(!live(unit)||unit.isFlying||f.liftoff||f.untargetable||f.targetFree||f.sleep||unit.kind==='device'&&!unit.profile?.enemyTargetableDevice
     ||Math.hypot(unit.x-x,unit.y-y)>shape.radius+1e-9)continue;
    const theirs=huiMingOf(unit),scale=!theirs?shape.none:theirs===attribute?shape.same:shape.diff;
    b.dealDamage(e,unit,{amount:amount*scale,type:'arts',isAttack:false,isSkill:false,isSplash:true,applyWay:'none',skipSourceAtkScale:true,tags:['huiMingBlast']});
   }
  },{holdsBattle:true});
 };
 const clearMarks=(b,a)=>{const marks=a.marks;a.marks=new Map();for(const [unit,buff]of marks)if(unit.buffs.includes(buff))b.removeBuff(unit,buff);};
 return{
  spawn(b,e,a){
   if(e.profile.blockerBuffPairs)throw Error('Blocker buff pair condition already installed');
   e.profile.blockerBuffPairs=blockPairs.map(p=>({...p}));
   const life=e.deploySeq;a.life=life;a.state='idle';a.marks=new Map();a.next=b.time+interval;a.owned={};
   for(const key of [markerKey,deathKey]){const buff=b.addBuff(e,{key,source:e,refresh:'independent',maxStacks:Infinity,admit:u=>live(u)&&u.deploySeq===life});if(buff&&e.buffs.includes(buff))a.owned[key]=buff;}
   // Another holder's trigger aura reaches this unit through its own account.
   a.detonate=source=>{
    if(a.state!=='idle'||!live(e)||e.deploySeq!==life)return false;
    const attribute=huiMingOf(e);if(!attribute)return false;
    const buff=b.addBuff(e,{key:boomKey,source,refresh:'keep',admit:u=>live(u)&&u.deploySeq===life});
    if(!buff||!e.buffs.includes(buff)||!live(e))return false;
    a.state='large';e.mem.huiMingBlastMode=attribute==='yin'?3:4;release(b,e,large,attribute);
    b.after(killDelay,()=>{if(live(e)&&e.deploySeq===life&&e.buffs.includes(buff))b.kill(e,null);},{holdsBattle:true});
    return true;
   };
   e.mem.huiMingBlast={detonate:a.detonate,key:markerKey};
  },
  tick(b,e,a){
   if(!live(e)||e.deploySeq!==a.life||b.time+1e-9<a.next)return;
   a.next+=interval;
   const mine=huiMingOf(e),marker=a.owned[markerKey]&&e.buffs.includes(a.owned[markerKey]),seen=new Set();
   if(marker)for(const unit of b.units){
    if(unit===e||unit.side!==e.side||unit.kind!=='enemy'||!live(unit)||!unit.findBuff(markerKey))continue;
    const distance=Math.hypot(unit.x-e.x,unit.y-e.y),theirs=huiMingOf(unit),opposite=!!mine&&!!theirs&&mine!==theirs;
    if(opposite&&distance<=hintRadius+1e-9){
     seen.add(unit);
     if(!a.marks.has(unit)||!unit.buffs.includes(a.marks.get(unit))){const buff=b.addBuff(unit,{key:warnKey,source:e,refresh:'independent',maxStacks:Infinity});if(buff)a.marks.set(unit,buff);}
    }
    if(opposite&&distance<=triggerRadius+1e-9&&unit.mem.huiMingBlast?.key===markerKey)unit.mem.huiMingBlast.detonate(e);
    if(!live(e))break;
   }
   for(const [unit,buff]of [...a.marks])if(!seen.has(unit)||!live(e)){a.marks.delete(unit);if(unit.buffs.includes(buff))b.removeBuff(unit,buff);}
  },
  death(c,b,e,a){
   clearMarks(b,a);
   const attached=a.owned?.[deathKey]&&e.buffs.includes(a.owned[deathKey]),attribute=huiMingOf(e);
   if(c.reason==='killed'&&a.state==='idle'&&attached&&attribute&&e.deploySeq===a.life){a.state='small';e.mem.huiMingBlastMode=attribute==='yin'?1:2;release(b,e,small,attribute);}
   for(const buff of Object.values(a.owned??{}))if(e.buffs.includes(buff))b.removeBuff(e,buff);a.owned={};
  },
 };
}
function validate({markerKey,deathKey,boomKey,warnKey,interval,hintRadius,triggerRadius,killDelay,blastDelay,blockPairs,small,large}){
 const text=k=>typeof k==='string'&&!!k&&k.length<=256,positive=v=>Number.isFinite(v)&&v>0&&v<=1e3,shape=s=>!!s&&Object.keys(s).sort().join()==='diff,none,radius,same'&&positive(s.radius)&&[s.none,s.same,s.diff].every(v=>Number.isFinite(v)&&v>=0&&v<=1e3);
 const keys=[markerKey,deathKey,boomKey,warnKey];
 if(!keys.every(text)||new Set(keys).size!==4||![interval,hintRadius,triggerRadius,killDelay,blastDelay].every(positive)||triggerRadius>hintRadius||!shape(small)||!shape(large)
  ||!Array.isArray(blockPairs)||!blockPairs.length||blockPairs.length>16||blockPairs.some(p=>!p||Object.keys(p).sort().join()!=='blockeeBuffKey,blockerBuffKey'||!text(p.blockerBuffKey)||!text(p.blockeeBuffKey)))throw Error('Invalid Hui-Ming blast talent');
}
huiMingBlast.validate=validate;
