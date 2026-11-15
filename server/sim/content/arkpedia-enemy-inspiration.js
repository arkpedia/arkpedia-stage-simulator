// SPDX-License-Identifier: GPL-3.0-or-later
import {OwnedStageAura} from './arkpedia-stage-auras.js';
const MARKER='enemy_9D0_talent_strength';
/** One independent stat grant per source plus one shared named marker. Losing
 * a source removes only its grant; the marker falls back to surviving owners. */
export function statMarkerAura({markerKey,attributeKey,mods}){
  validateAura({markerKey,attributeKey,mods});
  const clear=a=>{a.attributes.clear();a.marker.clear();};
  const update=(b,e,a)=>{
    const recipients=e.alive&&e.deployed&&!e.removed?b.enemies.filter(u=>u.alive&&u.deployed&&!u.hidden&&!u.removed
      &&u.side===e.side&&!u.s.flags.untargetable&&!u.s.flags.isolated&&!u.s.flags.sleep):[];
    a.attributes.update(recipients);a.marker.update(recipients);
  };
  return{
    spawn(b,e,a){
      a.attributes=new OwnedStageAura(b,e,{key:attributeKey,mods,stackable:true});
      a.marker=new OwnedStageAura(b,e,{key:markerKey,strength:1});update(b,e,a);
      b.on('enemySpawn',()=>update(b,e,a),{owner:e});
      b.on('removed',({unit})=>{if(unit===e)clear(a);},{owner:e});
    },
    tick:update,death(_c,_b,_e,a){clear(a);},
  };
}
/** A buff-owned native listener clock keeps polling while its owner is under
 * control. The resulting modifier is one persistent owned instance, not a
 * short buff refreshed every frame or one instance per granting Herald. */
export function markerStatBonus({markerKey,bonusKey,mods,interval}){
  validateBonus({markerKey,bonusKey,mods,interval});
  return{
    spawn(b,e,a){
      const check=()=>{
        if(!e.alive||!e.deployed)return;
        if(e.findBuff(markerKey)){
          if(!a.bonus||!e.buffs.includes(a.bonus))a.bonus=b.addBuff(e,{key:bonusKey,source:e,mods});
        }
        if(!e.findBuff(markerKey)&&a.bonus){b.removeBuff(e,a.bonus);a.bonus=null;}
      };
      b.addBuff(e,{key:`${bonusKey}[listener]`,source:e,interval,onTick:check});
    },
  };
}
/** Historical pinned plans retain their old private marker spelling; the live
 * native producer also reaches these consumers while those plans stay loaded. */
export function strengthAura(p){
  return p.mode==='inspired'?{
    tick(b,e){if(e.findBuff(MARKER)||e.findBuff('ab:inspired'))b.addBuff(e,{key:'ab:inspiredMove',duration:.7,visible:true,
      mods:{moveMul:1+(p.move??0),atkPct:p.atkPct??0,aspd:p.aspd??0}});},
  }:{tick(b,e){for(const u of b.enemies)if(u.alive)b.addBuff(u,{key:`ab:strength:${e.id}`,duration:.7,visible:true,mods:{atkPct:p.atkPct,defFlat:p.defFlat}});}};
}
export function inspiredTargets({base,inspired}){
  return{tick(_b,e){e.profile.maxTargets=e.findBuff(MARKER)||e.findBuff('ab:inspired')?inspired:base;}};
}

function validateMods(mods){
  if(!mods||typeof mods!=='object'||Array.isArray(mods)||!Object.keys(mods).length
    ||Object.entries(mods).some(([k,v])=>!['atkPct','defFlat','movePct','aspd'].includes(k)||!Number.isFinite(v)))
    throw Error('Invalid Inspiration stat modifiers');
}
function validateAura({markerKey,attributeKey,mods}){
  if(![markerKey,attributeKey].every(k=>typeof k==='string'&&k)||markerKey===attributeKey)throw Error('Invalid stat marker aura');
  validateMods(mods);
}
statMarkerAura.validate=validateAura;
function validateBonus({markerKey,bonusKey,mods,interval}){
  validateMods(mods);
  if(![markerKey,bonusKey].every(k=>typeof k==='string'&&k)||markerKey===bonusKey||!Number.isFinite(interval)||interval<=0)
    throw Error('Invalid marker stat bonus');
}
markerStatBonus.validate=validateBonus;
