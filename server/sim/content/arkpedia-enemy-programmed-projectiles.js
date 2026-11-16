// SPDX-License-Identifier: GPL-3.0-or-later
import {prepareBehaviorProgram,decodeBehaviorParameters} from '../../../shared/arkpedia/behavior-program.js';
import {ordinaryEnemyAttackSequence,validateEnemyAttackAnimation} from './arkpedia-enemy-attack-sequence.js';
import {projectileSingleAttack} from './arkpedia-enemy-projectiles.js';
const disableFlags=new Set(['silence','stun','freeze','levitate']);
/** A common native buff owns mode selection; each ordinary cast captures its
 * projectile mode. Switching does not retarget an already released projectile. */
export function programmedProjectileModes(params){
 const program=validate(params),{modes,initialMode,buffKey,disabledBy,groundOnly,blackboard={}}=params;
 const shots=modes.map(({animation,interruptOnDetach,...transport})=>projectileSingleAttack(transport));
 const sequence=ordinaryEnemyAttackSequence((_b,_e,a)=>({...modes[a.mode].animation,modeIndex:a.mode}),
  (b,e,target,cast)=>shots[cast.animation.modeIndex].attack({targets:[target],attackId:cast.attackId},b,e));
 const execute=(event,b,e,a)=>program.run(event,{battle:b,unit:e,target:e,source:e,blackboard,buffKey,modeService:a.modeService});
 const sync=(b,e,a)=>{
  if(e.deploySeq!==a.life)return;
  const enabled=e.alive&&e.deployed&&!!a.parent&&e.buffs.includes(a.parent)&&!disabledBy.some(flag=>e.s.flags[flag]);
  const was=a.enabled;a.enabled=enabled;
  if(was&&!enabled)execute('ON_BUFF_DISABLE',b,e,a);
 };
 return{...sequence,
  spawn(b,e,a){
   sequence.spawn(b,e,a);const prior=e.profile.canTarget;e.profile.canTarget=u=>(!groundOnly||u===e.blockedBy||!u.isFlying)&&(!prior||prior(u));a.life=e.deploySeq;a.mode=initialMode;a.enabled=false;a.ready=false;a.ended=false;
   const update=()=>{const animation=modes[a.mode].animation;e.def={...e.def,attackAnim:{dur:animation.duration,hit:animation.releases[0]}};e.mem.projectileModeIndex=a.mode;};
   a.modeService={get:actor=>{if(actor!==e)throw Error('Unbound projectile mode owner');return a.mode;},
    set:(actor,index)=>{if(actor!==e||!modes[index])throw Error('Invalid projectile mode target');if(e.deploySeq!==a.life||index===a.mode)return;
     if(modes[a.mode].interruptOnDetach)sequence.cancel(b,e,a);a.mode=index;update();}};
   update();
   a.parent=b.addBuff(e,{key:buffKey,source:e,onRemove:()=>{a.ended=true;if(a.ready)sync(b,e,a);}});
   a.ready=true;a.enabled=!!a.parent||a.ended;sync(b,e,a);
  },
  before(_c,b,e,a){sync(b,e,a);if(a.enabled)execute('ON_BEFORE_ATTACK',b,e,a);},
  tick(b,e,a,dt){sync(b,e,a);sequence.tick(b,e,a,dt);},
  status(c,b,e,a){sequence.status(c,b,e,a);sync(b,e,a);},
  death(c,b,e,a){sequence.death(c,b,e,a);sync(b,e,a);},
 };
}
function validate({program,programComponent,modes,initialMode,buffKey,disabledBy,groundOnly,blackboard={}}){
 if(programComponent!==undefined)throw Error('Unhydrated behaviour program component');
 if(!Array.isArray(modes)||!modes.length||modes.length>64||!Number.isSafeInteger(initialMode)||!modes[initialMode]
  ||typeof groundOnly!=='boolean'||typeof buffKey!=='string'||!buffKey||!Array.isArray(disabledBy)||new Set(disabledBy).size!==disabledBy.length||disabledBy.some(k=>!disableFlags.has(k)))throw Error('Invalid programmed projectile modes');
 for(const m of modes){validateEnemyAttackAnimation(m.animation);
  if(!['phys','arts','true'].includes(m.type)||!Number.isFinite(m.speed)||m.speed<=0||!Number.isFinite(m.lifetime)||m.lifetime<=0
   ||m.damageScale!==undefined&&(!Number.isFinite(m.damageScale)||m.damageScale<0)||typeof m.interruptOnDetach!=='boolean'||m.noAir!==undefined&&typeof m.noAir!=='boolean')throw Error('Invalid projectile mode transport');}
 const p=prepareBehaviorProgram(program);p.validateBlackboard(blackboard);
 if(p.requiredModeIndices.some(index=>!modes[index]))throw Error('Missing projectile mode');
 return p;
}
programmedProjectileModes.validate=validate;
programmedProjectileModes.decodeParameters=decodeBehaviorParameters;
