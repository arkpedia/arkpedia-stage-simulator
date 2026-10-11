// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-blaze-igniting-prefabs.json' with {type:'json'};
import {bodyInKeys} from '../body.js';
import {canTargetEnemy} from '../targeting.js';
import {applyHpLoss,makeDamageInfo} from '../damage.js';
import {COLS} from '../constants.js';

export const BLAZE_IGNITING_S2_CONTRACT=Object.freeze({
  scope:'Selected-source S2 three-target attacks and burning ground tiles; public enablement has a separate runtime review',
  attack:'Natural manual SP, selected 35-second ATK/BAT/range mode, original capped Skill_2_Loop release, speed99 Arts shots and one 5%-Max-HP modifier-bypassing self hit per accepted attack command',
  field:'Ground tile recipients receive one nonstacking half-speed modifier, live-ATK Arts output and sourced FIRE injury derived from settled HP damage; leave, mode detach and battle end clear recipients',
  mapping:'The target root tile at projectile arrival maps DoTile selection; only low, ground-passable tiles under grounded inputs ignite. Fields last for the mode. Entry triggers immediately, then once per second; continuous occupancy across burning tiles retains one clock. Self cost follows all accepted births. Begin/End clips guard attacks, duration starts at activation, and downing ends this local mode.',
  limits:'Compiled DoTile selection/random shrink, callback and self-hit ordering, entry/terminal phase, mode detach/owner-removal linkage, duplicate-caster priority, skill interruption/revival restoration, original particles/audio, modules and Unity frame parity remain unverified',
  frameParity:false,
});
const ID='char_1040_blaze2',KEY='blaze2_s_2[on_tile]';
const live=t=>t?.alive&&t.deployed&&!t.hidden&&!t._removing;
const model=u=>evidence.models[ID][['UP','LEFT'].includes(u.dir)?'Back':'Front'];

export class BlazeIgnitingS2Tiles{
  constructor(core){this.core=core;this.b=core.b;this.u=core.u;this.record=core.record;this.transition=null;this.tiles=new Map();this.recipients=new Map();}
  active(){return this.core.valid()&&!this.core.reborn&&this.u.skill.active;}
  canCast(){return this.core.valid()&&!this.core.reborn&&this.u.canAct&&!this.u.s.flags.disarm&&!this.transition;}
  start(){
    const {b,u,core}=this;core.phase=null;u.atkCd=0;this.clear();
    this.transition={kind:'begin',ends:b.time+model(u).durations.Skill_2_Begin};core.visual('Skill_2_Begin');
    b.emit('blazeIgnitingS2Start',{owner:u});
  }
  end(reason){
    const {b,u,core}=this;core.phase=null;this.clear();
    if(core.valid()&&!core.reborn&&!['downed','owner-finish','death'].includes(reason)){
      this.transition={kind:'end',ends:b.time+model(u).durations.Skill_2_End};core.visual('Skill_2_End');
    }else this.transition=null;
    b.emit('blazeIgnitingS2End',{owner:u,reason});
  }
  interrupt(reason){if(this.u.skill.active)this.u.skill.end(reason);this.transition=null;this.clear();}
  selfCost(){
    const {b,u,core}=this,p=core.phase;
    if(!this.active()||p?.kind!=='s2-attack'||!p.accepted.size||p.costPaid)return;
    p.costPaid=true;
    // Native DamageViaMaxHpRatio skips modifier events and ignores SP. Keep
    // fatal/downing bookkeeping without routing this through ordinary shields.
    const amount=u.s.maxHp*this.record.bb['attack@hp_ratio'];
    applyHpLoss(b,u,u,amount,makeDamageInfo({amount,type:'true',isAttack:true,isSkill:true,noSp:true,
      applyWay:'none',tags:['blaze2:s2-self']}));
  }
  release(t,info){
    const {core,b,u}=this,p=core.phase;
    if(!this.active()||!u.canAct||u.s.flags.disarm||p?.kind!=='s2-attack'||p.accepted.has(t)
      ||p.epoch!==u.attackControlEpoch||p.targets.get(t)!==t.deploySeq||!core.eligible(t)
      ||b.time+1e-9<p.releaseAt)return false;
    p.accepted.add(t);const seq=t.deploySeq;
    const projectile=b.addProjectile({from:u,target:t,source:u,speed:99,maxAge:10,visual:'bolt',
      data:{arkpediaTrackedVisual:true,blazeIgnitingOwner:core,blazeIgnitingKind:'s2'},onHit:({target})=>{
        // Released projectiles remain sourced to the owner after removal; the
        // tile listener only exists while the original selected mode is active.
        if(b.finished||target!==t||t.deploySeq!==seq||!core.eligible(t))return;
        const grounded=!t.isFlying,row=Math.round(t.y),col=Math.round(t.x);
        b.dealDamage(u,t,makeDamageInfo({amount:u.s.atk*u.s.atkScaleMul,type:'arts',isAttack:true,isSkill:true,
          attackId:info.attackId??0,applyWay:'ranged',tags:['blaze2:s2-shot']}));
        if(grounded&&this.active())this.ignite(row,col);
      }});
    b.emit('blazeIgnitingProjectileBirth',{owner:u,target:t,projectile});return true;
  }
  ignite(row,col){
    const {b,u}=this,tile=b.grid.tile(row,col);
    if(!this.active()||!b.grid.inRect(row,col)||tile.height!=='LOW'||tile.pass!=='ALL')return;
    const key=row*COLS+col;if(this.tiles.has(key))return;
    const field={key,row,col,bornAt:b.time};this.tiles.set(key,field);
    b.emit('blazeIgnitingS2Tile',{owner:u,field});this.updateTiles();
  }
  eligible(t){return live(t)&&canTargetEnemy(this.u,t,{groundOnly:true})&&bodyInKeys(t,this.tiles);}
  detach(t){
    const r=this.recipients.get(t);this.recipients.delete(t);
    if(r)this.b.removeBuff(t,r.buff);
  }
  updateTiles(){
    const {b,u}=this;if(!this.active()){this.clear();return;}
    for(const [t,r]of this.recipients)if(!this.eligible(t)||t.deploySeq!==r.seq||t.findBuff(KEY)!==r.buff)this.detach(t);
    for(const t of [...b.enemies]){
      if(!this.active())break;
      if(!this.eligible(t))continue;
      let r=this.recipients.get(t);
      if(!r){
        // Default native on_tile has one stack and no independent source.
        // Duplicate-caster priority is held; never compound two slow modifiers.
        if(t.findBuff(KEY))continue;
        const buff=b.addBuff(t,{key:KEY,source:u,mods:{moveMul:1+this.record.bb.move_speed},
          data:{blazeIgnitingS2:this},onRemove:()=>this.recipients.delete(t)});
        r={buff,seq:t.deploySeq,nextAt:b.time};this.recipients.set(t,r);
      }
      if(b.time+1e-9>=r.nextAt){r.nextAt+=1;this.pulse(t,r);}
    }
  }
  pulse(t,r){
    const {b,u,record}=this;if(!this.active()||!this.eligible(t)||t.deploySeq!==r.seq)return;
    const actual=b.dealDamage(u,t,{amount:u.s.atk*record.bb.atk_scale,type:'arts',canDodge:false,
      isAttack:true,isSkill:true,applyWay:'none',tags:['blaze2:s2-tile']});
    if(actual>0&&live(t))b.dealDamage(u,t,{amount:actual*record.bb.element_damage_scale,type:'element',element:'burn',
      canDodge:false,isAttack:true,isSkill:true,applyWay:'none',tags:['blaze2:s2-injury']});
  }
  tick(){
    const {b,u,core}=this;
    this.updateTiles();
    if(!core.valid()||core.reborn)return true;
    if(this.transition){
      if(b.time+1e-9<this.transition.ends)return true;
      this.transition=null;core.phase=null;u.atkCd=0;
    }
    if(!this.active())return false;
    let p=core.phase;
    if(!u.canAct||u.s.flags.disarm||p&&p.epoch!==u.attackControlEpoch){core.phase=null;core.visual('Skill_2_Idle',1,true);return true;}
    if(p){
      if(!p.released&&b.time+1e-9>=p.releaseAt){
        p.released=true;const targets=[...p.targets].filter(([t,seq])=>t.deploySeq===seq&&core.eligible(t)).map(([t])=>t);
        if(targets.length)b.forceAttack(u,targets);
        if(!this.active()||core.phase!==p)return true;
      }
      if(b.time+1e-9<p.readyAt)return true;
      core.phase=null;
    }
    if(u.atkCd>1e-9)return true;
    const targets=core.targets().slice(0,this.record.bb['attack@max_target']);
    if(!targets.length){core.visual('Skill_2_Idle',1,true);return true;}
    const clip='Skill_2_Loop',speed=Math.min(1,(u.base.bat+this.record.bb.base_attack_time)/u.s.interval);
    core.phase={kind:'s2-attack',targets:new Map(targets.map(t=>[t,t.deploySeq])),epoch:u.attackControlEpoch,
      releaseAt:b.time+model(u).eventPayloads[clip].find(e=>e.name==='OnAttack').time/speed,
      readyAt:b.time+Math.max(u.s.interval,model(u).durations[clip]/speed),released:false,accepted:new Set(),costPaid:false};
    core.visual(clip,speed);u.atkCd=u.s.interval;return true;
  }
  clear(){for(const t of [...this.recipients.keys()])this.detach(t);this.tiles.clear();}
  ownerStop(){this.interrupt('owner-finish');}
}
