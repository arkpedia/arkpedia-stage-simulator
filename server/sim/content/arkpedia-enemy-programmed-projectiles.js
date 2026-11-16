// SPDX-License-Identifier: GPL-3.0-or-later
import {prepareBehaviorProgram,decodeBehaviorParameters} from '../../../shared/arkpedia/behavior-program.js';
import {ordinaryEnemyAttackSequence,validateEnemyAttackAnimation} from './arkpedia-enemy-attack-sequence.js';
import {projectileSingleAttack,projectileTileAttack} from './arkpedia-enemy-projectiles.js';
const disableFlags=new Set(['silence','stun','freeze','levitate']);
/** A common native buff owns mode selection; each ordinary cast captures its
 * projectile mode. Switching does not retarget an already released projectile. */
export function programmedProjectileModes(params){
 const program=validate(params),{modes,initialMode,buffKey,disabledBy,groundOnly,triggerInterval,parentDuration,blackboard={}}=params;
 const shots=modes.map(({animation,interruptOnDetach,...transport})=>(transport.tileOffsets?projectileTileAttack:projectileSingleAttack)(transport));
 const sequence=ordinaryEnemyAttackSequence((_b,_e,a)=>({...modes[a.mode].animation,modeIndex:a.mode}),
  (b,e,target,cast)=>shots[cast.animation.modeIndex].attack({targets:[target],attackId:cast.attackId},b,e));
 const execute=(event,b,e,a)=>program.run(event,{battle:b,unit:e,target:e,source:e,blackboard,buffKey,modeService:a.modeService,derivedService:a.derivedService});
 const sync=(b,e,a)=>{
  if(e.deploySeq!==a.life)return;
  const enabled=e.alive&&e.deployed&&!!a.parent&&e.buffs.includes(a.parent)&&!disabledBy.some(flag=>e.s.flags[flag]);
  const was=a.enabled;a.enabled=enabled;
  if(was&&!enabled)execute('ON_BUFF_DISABLE',b,e,a);
 };
 return{...sequence,
  spawn(b,e,a){
   sequence.spawn(b,e,a);const prior=e.profile.canTarget;e.profile.canTarget=u=>(!groundOnly||u===e.blockedBy||!u.isFlying)&&(!prior||prior(u));a.life=e.deploySeq;a.mode=initialMode;a.enabled=false;a.ready=false;a.ended=false;a.modeMarker=null;
   const update=()=>{const animation=modes[a.mode].animation;e.def={...e.def,attackAnim:{dur:animation.duration,hit:animation.releases[0]}};e.mem.projectileModeIndex=a.mode;
    if(a.modeMarker)b.removeBuff(e,a.modeMarker);a.modeMarker=null;
    const key=modes[a.mode].markerKey;if(key){const buff=b.addBuff(e,{key,source:e,refresh:'independent',maxStacks:Infinity});if(buff){if(e.alive&&e.deployed&&e.deploySeq===a.life)a.modeMarker=buff;else b.removeBuff(e,buff);}}
   };
   a.modeService={get:actor=>{if(actor!==e)throw Error('Unbound projectile mode owner');return a.mode;},
    set:(actor,index)=>{if(actor!==e||!modes[index])throw Error('Invalid projectile mode target');if(e.deploySeq!==a.life||index===a.mode)return;
     if(modes[a.mode].interruptOnDetach)sequence.cancel(b,e,a);a.mode=index;update();}};
   update();a.markers=new Set();
   a.derivedService={create:key=>{
    if(e.deploySeq!==a.life||!a.enabled)return;
    let attached;attached=b.addBuff(e,{key,source:e,onRemove:()=>a.markers.delete(attached)});
    if(attached&&e.buffs.includes(attached))a.markers.add(attached);
   },clear:()=>{for(const marker of [...a.markers])b.removeBuff(e,marker);a.markers.clear();}};
   const finishParent=()=>{a.ended=true;if(a.ready)sync(b,e,a);a.derivedService.clear();};
   a.parent=b.addBuff(e,{key:buffKey,source:e,...(parentDuration===undefined?{}:{duration:parentDuration}),...(triggerInterval===undefined?{}:{interval:triggerInterval,onTick:()=>{sync(b,e,a);if(a.enabled)execute('ON_BUFF_TRIGGER',b,e,a);}}),onRemove:finishParent,onExpire:finishParent});
   a.ready=true;a.enabled=!!a.parent||a.ended;sync(b,e,a);
  },
  before(_c,b,e,a){sync(b,e,a);if(a.enabled)execute('ON_BEFORE_ATTACK',b,e,a);},
  tick(b,e,a,dt){sync(b,e,a);sequence.tick(b,e,a,dt);},
  status(c,b,e,a){sequence.status(c,b,e,a);sync(b,e,a);},
  death(c,b,e,a){sequence.death(c,b,e,a);sync(b,e,a);if(a.parent)b.removeBuff(e,a.parent);a.derivedService.clear();if(a.modeMarker)b.removeBuff(e,a.modeMarker);a.modeMarker=null;},
 };
}
function validate({program,programComponent,modes,initialMode,buffKey,disabledBy,groundOnly,triggerInterval,parentDuration,blackboard={}}){
 if(parentDuration!==undefined&&(!Number.isFinite(parentDuration)||parentDuration<=0))throw Error('Invalid mode program parent lifetime');
 if(triggerInterval!==undefined&&(!Number.isFinite(triggerInterval)||triggerInterval<=0))throw Error('Invalid mode program trigger clock');
 if(programComponent!==undefined)throw Error('Unhydrated behaviour program component');
 if(!Array.isArray(modes)||!modes.length||modes.length>64||!Number.isSafeInteger(initialMode)||!modes[initialMode]
  ||typeof groundOnly!=='boolean'||typeof buffKey!=='string'||!buffKey||!Array.isArray(disabledBy)||new Set(disabledBy).size!==disabledBy.length||disabledBy.some(k=>!disableFlags.has(k)))throw Error('Invalid programmed projectile modes');
 for(const m of modes){validateEnemyAttackAnimation(m.animation);
  if(m.markerKey!==undefined&&(typeof m.markerKey!=='string'||!m.markerKey||m.markerKey.length>256||m.markerKey===buffKey))throw Error('Invalid projectile mode marker');
  if(m.tileOffsets!==undefined&&(!Array.isArray(m.tileOffsets)||!m.tileOffsets.length||m.tileOffsets.length>64
   ||m.tileOffsets.some(t=>!t||Object.keys(t).sort().join()!=='col,row'||!Number.isSafeInteger(t.row)||!Number.isSafeInteger(t.col)||Math.abs(t.row)>16||Math.abs(t.col)>16)
   ||new Set(m.tileOffsets.map(t=>`${t.row},${t.col}`)).size!==m.tileOffsets.length))throw Error('Invalid projectile tile offsets');
  if(!['phys','arts','true'].includes(m.type)||!Number.isFinite(m.speed)||m.speed<=0||!Number.isFinite(m.lifetime)||m.lifetime<=0
   ||m.damageScale!==undefined&&(!Number.isFinite(m.damageScale)||m.damageScale<0)||typeof m.interruptOnDetach!=='boolean'||m.noAir!==undefined&&typeof m.noAir!=='boolean')throw Error('Invalid projectile mode transport');}
 const p=prepareBehaviorProgram(program);p.validateServices(['mode','derived']);p.validateBlackboard(blackboard);
 if(p.requiredModeIndices.some(index=>!modes[index]))throw Error('Missing projectile mode');
 return p;
}
programmedProjectileModes.validate=validate;
programmedProjectileModes.decodeParameters=decodeBehaviorParameters;
