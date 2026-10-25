// SPDX-License-Identifier: GPL-3.0-or-later
// Original story Guardian clocks, marked-miner field and delayed HP loss.
import review from '../../../data/candidates/arkpedia-ch16-reviewed-story-guardian.json' with {type:'json'};
import {canTargetAlly,areaSelectable,sortAllyTargets} from '../targeting.js';
import {sourceAbilityDelta} from './arkpedia-slow-down.js';
const present=u=>u?.alive&&u.deployed;
const live=u=>present(u)&&!u.hidden;
const ground=u=>!u.isFlying&&!u.s.flags.liftoff;
const controlled=u=>['stun','freeze','sleep','levitate','fear','disarm'].some(k=>u.s.flags[k]);
const marked=u=>!!u.findBuff('enemy_mcreep_self_mark');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const FOG='gyegrd_a[exist]';

function guardianField(b){
  if(b.chapter16GuardianField)return b.chapter16GuardianField;
  const sources=new Set(),receipts=new Map();let refreshing=false,dirty=false;
  const valid=s=>present(s.owner)&&s.owner.deploySeq===s.life;
  const eligible=u=>live(u)&&ground(u)&&marked(u)&&!u.s.flags.untargetable&&!u.s.flags.sleep;
  const field=b.chapter16GuardianField={
    refresh(){
      if(refreshing){dirty=true;return;}refreshing=true;
      try{do{
        dirty=false;for(const s of sources)if(!valid(s))sources.delete(s);
        const provider=sources.values().next().value;
        for(const[u,old]of receipts)if(!provider||!eligible(u)||u.deploySeq!==old.life){
          receipts.delete(u);if(u.deploySeq===old.life)b.removeBuff(u,old.buff);
        }
        if(!provider)continue;
        for(const u of b.units){
          if(!valid(provider)){dirty=true;break;}
          if(!eligible(u))continue;
          const old=receipts.get(u);
          if(old&&u.buffs.includes(old.buff)&&old.buff.source===provider.owner)continue;
          const life=u.deploySeq,buff=b.addBuff(u,{key:FOG,source:provider.owner,persist:true});
          if(buff&&valid(provider)&&eligible(u)&&u.deploySeq===life&&u.buffs.includes(buff))receipts.set(u,{life,buff});
          else if(buff&&u.deploySeq===life)b.removeBuff(u,buff);
        }
      }while(dirty);}finally{refreshing=false;}
    },
    add(owner){const entry={owner,life:owner.deploySeq};sources.add(entry);field.refresh();return()=>{sources.delete(entry);field.refresh();};},
  };
  b.on('enemySpawn',()=>field.refresh());b.on('death',()=>field.refresh());b.on('removed',()=>field.refresh());
  b.on('tick',()=>field.refresh());b.on('battleEnd',()=>{sources.clear();field.refresh();});
  return field;
}

export function storyGuardian(r){
  const proof=review.enemies[r.key];
  if(!proof||r.prefabKey!==r.key||!same(r.talents.groups,proof.groups)||!same(r.talents.bb,proof.bb)
    ||!same(r.skills,proof.skills)||!same(r.abilities,proof.abilities))throw Error('Unreviewed story Guardian contract');
  const skill=r.skills[0],d=review.defaults;
  return{
    spawn(b,e,a){
      const life=e.deploySeq,valid=()=>a.active&&present(e)&&e.deploySeq===life;
      a.active=true;a.phase=null;a.normalCd=0;a.skillCd=skill.initCooldown;a.delay=null;a.core=null;a.delayDisabled=false;
      e.profile.noAttack=true;
      a.disposeFog=guardianField(b).add(e);
      a.disableDelay=()=>{
        if(a.delayDisabled||!valid())return;
        a.delayDisabled=true;
        // Native event25 is ON_BUFF_DISABLE. Expiry and explicit removal each
        // reach this once, while a rejected parent never installs a callback.
        const core=b.addBuff(e,{key:'dyegrd_t[delay_dot_core]',source:e,persist:true,flags:{noMove:true},interval:1,
          onTick:()=>{if(valid())b.dealDamage(e,e,{amount:e.s.maxHp*r.talents.bb['DelayBloodDot.hp_ratio'],
            type:'true',isAttack:false,canDodge:false,applyWay:'none',ignoreSelect:true,tags:['chapter16','guardian-self-dot']});}});
        if(core&&!valid())b.removeBuff(e,core);else a.core=core;
      };
      a.delay=b.addBuff(e,{key:'dyegrd_t[delay_dot]',source:e,duration:r.talents.bb['DelayBloodDot.delay_duration'],
        onExpire:a.disableDelay,onRemove:a.disableDelay});
      a.targets=()=>{
        const targets=b.units.filter(u=>u!==e&&live(u)&&ground(u)&&marked(u)&&canTargetAlly(e,u,true)
          &&Math.hypot(u.x-e.x,u.y-e.y)<=e.base.rangeRadius+(u.mem.ch16BodyRadius??.1)+1e-9);
        sortAllyTargets(e,targets);return targets;
      };
      a.finish=p=>{
        if(a.phase!==p)return;a.phase=null;b.removeBuff(e,p.hold);
        if(p.kind==='skill')a.skillCd=skill.cooldown;
      };
      a.begin=kind=>{
        if(!valid()||e.hidden||controlled(e)||a.phase||kind==='skill'&&e.s.flags.silence)return false;
        const target=a.targets()[0];if(!target)return false;
        const epoch=e.attackControlEpoch;
        if(kind==='normal'){
          const c={attacker:e,targets:[target],isSkill:false,profile:e.profile};b.emit('beforeAttack',c);
          if(!valid()||controlled(e)||e.attackControlEpoch!==epoch||c.targets?.[0]!==target)return false;
        }
        const p={kind,target,life:target.deploySeq,epoch,age:0,lastAt:b.time,hit:false,
          rate:kind==='skill'?1:Math.min(1,e.base.bat/e.s.interval),
          at:kind==='skill'?d.skillHit:d.normalHit,end:kind==='skill'?d.skillDuration:d.normalDuration};
        a.phase=p;p.hold=b.addBuff(e,{key:'ch16:guardian-cast',source:e,persist:true,flags:{noMove:true}});
        p.epoch=e.attackControlEpoch;
        if(kind==='normal'){a.normalCd=e.s.interval;p.attackId=++b._attackSeq;e.stats.attacks++;}
        b.emit('ch16GuardianCast',{source:e,kind,target});return true;
      };
      a.advance=p=>{
        if(!valid()||e.hidden||controlled(e)||e.attackControlEpoch!==p.epoch){a.finish(p);return;}
        p.age+=sourceAbilityDelta(e,Math.max(0,b.time-p.lastAt),true)*p.rate;p.lastAt=b.time;
        if(!p.hit&&p.age+1e-7>=p.at){
          p.hit=true;
          if(live(p.target)&&p.target.deploySeq===p.life){
            const victims=p.kind==='normal'?[p.target]:[...b.allyUnits,...b.enemies.filter(u=>u.profile?.neutral)]
              .filter(u=>live(u)&&ground(u)&&areaSelectable(e,u)
                &&Math.hypot(u.x-p.target.x,u.y-p.target.y)<=skill.bb.range_radius+(u.profile?.neutral?(u.mem.ch16BodyRadius??.1):.25)+1e-9);
            for(const u of new Set(victims)){
              if(!valid()||a.phase!==p||e.attackControlEpoch!==p.epoch)break;
              b.dealDamage(e,u,{amount:e.s.atk*(p.kind==='skill'?skill.bb.damage_scale:1),type:'phys',
                isAttack:p.kind==='normal',attackId:p.attackId,canDodge:p.kind==='normal',applyWay:p.kind==='normal'?'melee':'none',tags:['chapter16','guardian-'+p.kind]});
            }
            if(valid()&&a.phase===p){
              if(p.kind==='normal')b.emit('attack',{attacker:e,targets:[p.target],isSkill:false});
              b.emit('ch16GuardianHit',{source:e,kind:p.kind,target:p.target});
            }
          }
        }
        if(a.phase===p&&p.age+1e-7>=p.end)a.finish(p);
      };
      a.detach=()=>{
        if(!a.active)return;a.active=false;a.disposeFog();
        if(a.phase)a.finish(a.phase);
        if(a.delay)b.removeBuff(e,a.delay);if(a.core)b.removeBuff(e,a.core);
      };
      b.on('battleEnd',a.detach,{owner:e});b.on('removed',({unit})=>{if(unit===e)a.detach();},{owner:e});
    },
    tick(b,e,a,dt){
      if(!a.active)return;
      if(!e.s.flags.stun&&!e.hidden)a.normalCd=Math.max(0,a.normalCd-dt);
      if(!a.phase||a.phase.kind!=='skill')a.skillCd=Math.max(0,a.skillCd-sourceAbilityDelta(e,dt,true));
      if(a.phase)a.advance(a.phase);
      else if(!a.skillCd&&!e.s.flags.silence){if(!a.begin('skill')&&!a.normalCd)a.begin('normal');}
      else if(!a.normalCd)a.begin('normal');
    },
    death(c,b,e,a){a.detach();},
  };
}
