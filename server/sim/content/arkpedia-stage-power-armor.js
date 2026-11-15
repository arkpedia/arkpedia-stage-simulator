// SPDX-License-Identifier: GPL-3.0-or-later
import {powerArmorDeviceDefinition} from '../../../shared/arkpedia/device-runtime.js';
import {stageDeviceAttributes} from '../../../shared/arkpedia/stage-character-attributes.js';
import {SkillRuntime} from '../skills.js';
import {auraSelectable} from '../targeting.js';
import {recordStageOutcome} from './arkpedia-stage-outcomes.js';

/** A placed enemy body owns SP; a branch owns the activated body's route.
 * Drivers use the ordinary kill/death path, including its rebirth interception. */
export class StagePowerArmor {
  constructor(b,entries=[]){
    this.battle=b;this.entries=[];
    for(const entry of entries){
      const spec=powerArmorDeviceDefinition(entry.key,entry.instance),stats=stageDeviceAttributes(b.stageCardRules,entry.key,spec);
      const action=b.stageBranches?.branches[spec.branchId]?.spawns.find(a=>a.order===spec.actionIndex);
      if(!action||action.count!==1||action.offset!==0)throw Error('Unsupported Power Armor branch action');
      const state={entry,spec,unit:null,activated:false,contacts:new Set()};
      const original=b.grid.tile(entry.row,entry.col);
      const initialize=unit=>{
        unit.def.profession='TRAP';unit.base.tauntLevel=spec.taunt;unit.deploymentSlotCost=0;
        unit.def.immune=new Set(['stun','frozen','silence','levitate','sleep']);
        b.addBuff(unit,{key:'lypa[car_mark]',persist:true});
        b.addBuff(unit,{key:'stage:powerArmorBody',persist:true,flags:{noMove:true}});
        unit.skill=new SkillRuntime(b,unit,{skillType:'AUTO'}, {
          id:'powerArmorActivation',kind:'toggle',spCost:spec.spCost,duration:spec.duration,trigger:'SP_FULL',
          canActivate:()=>!state.activated,
          onStart:()=>{
            state.activated=true;b.removeBuff(unit,'lypa[car_mark]');unit.def.immune=new Set();unit.markDirty();
            unit.mem.regularFormVisual={clip:'Start',loop:false,speed:1,playId:`powerArmor:${unit.id}`};
            state.timer=b.after(spec.duration,()=>{if(unit.alive)unit.skill.end('duration');},{owner:unit,holdsBattle:true});
          },
          onEnd:({reason})=>{
            if(reason!=='duration'||!unit.alive)return;
            b.stageBranches.summon(spec.branchId,spec.actionIndex,{hpRatio:unit.hpRatio});
            recordStageOutcome(b,unit,'actived_bell');b._remove(unit,'withdraw');
          },
        });
        b.on('death',event=>{
          if(event.unit!==unit)return;
          if(state.timer)state.timer.cancelled=true;
          b.grid.setTile(entry.row,entry.col,original);
          if(event.reason==='killed')recordStageOutcome(b,unit,'killed');
        },{owner:unit});
      };
      state.unit=b.spawnDevice(entry.key,entry.row,entry.col,{side:'enemy',name:entry.name,...stats,blockCnt:stats.block,initialize});
      if(!state.unit)throw Error('Occupied Power Armor tile');
      b.grid.setTile(entry.row,entry.col,{...original,build:'NONE'});this.entries.push(state);
    }
    if(this.entries.length)b.on('tick',()=>this.tick());
  }
  tick(){
    const b=this.battle;
    for(const state of this.entries){
      const {unit,spec}=state;if(!unit.alive||state.activated)continue;
      const inside=new Set(b.enemies.filter(e=>e!==unit&&e.findBuff('lypa[driver_mark]')&&auraSelectable(unit,e)
        &&Math.hypot(e.x-unit.x,e.y-unit.y)<=spec.radius+1e-9));
      for(const e of inside){
        if(state.contacts.has(e)||unit.skill.sp>=unit.skill.spCost||!unit.findBuff('lypa[car_mark]'))continue;
        b.kill(e,unit);
      }
      state.contacts=inside;
      if(unit.skill.ready)unit.skill.activate('powerArmor',{permissionAware:true});
    }
  }
}
