// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../../data/candidates/arkpedia-ch17-reviewed-flyer.json' with {type:'json'};
import {leakSourceTrace} from './chapter17-trace.js';
import {sourceAbilityDelta} from './arkpedia-slow-down.js';
import {areaSelectable} from '../targeting.js';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const live=e=>e?.alive&&e.deployed&&!e.hidden;
const controlled=e=>['stun','freeze','sleep','levitate','fear'].some(k=>e.s.flags[k]);
const d=review.defaults;
function bursts(b){
  if(b.ch17FlyerBursts)return b.ch17FlyerBursts;
  const state=b.ch17FlyerBursts={active:true,tasks:new Set()};
  b.on('battleEnd',()=>{state.active=false;for(const task of state.tasks)task.cancel();state.tasks.clear();});
  return state;
}
export function pollutionFlyer(r){
  const proof=review.enemies[r.key];
  if(!proof||r.prefabKey!==r.key||!same(r.talents.groups,proof.groups)||!same(r.talents.bb,proof.bb)
    ||!same(r.skills,proof.skills)||!same(r.abilities,proof.abilities))throw Error('Unreviewed pollution Flyer contract');
  return{
    spawn(b,e,a){
      const life=e.deploySeq,valid=()=>a.active&&e.alive&&e.deployed&&e.deploySeq===life;
      a.active=true;a.mode=0;a.phase=null;a.deathLife=null;e.profile.noAttack=true;
      const consumed=t=>t.buffs.some(buff=>buff.key==='enemy_mufly_reached'&&buff.source===e&&buff.data?.flyerSourceLife===life);
      a.trace=leakSourceTrace(b,e,{radius:d.contactRadius,searchPeriod:d.searchPeriod,defaultSearchPeriod:d.defaultSearchPeriod,
        eligible:t=>!consumed(t),enabled:()=>a.mode<2});
      a.trace.refresh(true);bursts(b);
      a.finish=p=>{if(a.phase!==p)return;a.phase=null;b.removeBuff(e,p.hold);};
      a.begin=target=>{
        if(!valid()||!live(target)||controlled(e)||a.phase||a.mode>=2||consumed(target))return false;
        const mark=b.addBuff(target,{key:'enemy_mufly_reached',source:e,persist:true,refresh:'independent',maxStacks:2147483647,
          data:{flyerSourceLife:life}});
        if(!mark||!valid()||!live(target))return false;
        const p={mode:a.mode,target,targetLife:target.deploySeq,age:0,lastAt:b.time,epoch:e.actionControlEpoch};
        a.phase=p;p.hold=b.addBuff(e,{key:'ch17:flyer-change',source:e,persist:true,flags:{noMove:true}});p.epoch=e.actionControlEpoch;
        b.emit('ch17FlyerChangeStart',{source:e,target,mode:a.mode});return true;
      };
      a.advance=p=>{
        if(!valid()||e.hidden||controlled(e)||p.epoch!==e.actionControlEpoch){a.finish(p);return;}
        p.age+=sourceAbilityDelta(e,Math.max(0,b.time-p.lastAt),true);p.lastAt=b.time;
        if(p.age+1e-7<d.changeHit)return;
        // Buff-on-spell switches mode with restartFSM=true at the original
        // marker. The old ability is detached rather than holding its tail.
        a.mode=p.mode+1;e.mem.ch17FlyerMode=a.mode;a.finish(p);a.trace.refresh(true);
        b.emit('ch17FlyerChanged',{source:e,mode:a.mode});
      };
      const protectsStun=()=>valid()&&!!a.phase;
      b.on('beforeStatus',c=>{if(c.target===e&&c.status==='stun'&&protectsStun())c.cancel=true;},{owner:e,priority:1000});
      b.on('beforeBuff',c=>{
        const f=c.buff.flags;if(c.unit===e&&protectsStun()&&(c.buff.status==='stun'||f?.stun&&!f.freeze&&!f.sleep&&!f.levitate))c.cancel=true;
      },{owner:e,priority:1000});
      a.detach=()=>{
        if(!a.active)return;a.active=false;if(a.phase)a.finish(a.phase);a.trace.stop();
      };
      b.on('battleEnd',a.detach,{owner:e});b.on('removed',({unit})=>{if(unit===e)a.detach();},{owner:e});
    },
    tick(b,e,a){
      if(!a.active)return;
      if(a.phase){a.advance(a.phase);return;}
      a.trace.refresh();const t=a.trace.state.target;
      if(t&&live(e)&&live(t)&&Math.hypot(t.x-e.x,t.y-e.y)<=d.contactRadius+1e-8)a.begin(t);
    },
    death(c,b,e,a){
      const mode=a.mode,life=e.deploySeq,x=e.x,y=e.y,atk=e.s.atk;
      const emit=c.reason==='killed'&&!e.s.flags.silence&&a.deathLife!==life;
      a.deathLife=life;a.detach();if(!emit)return;
      const state=bursts(b),scale=r.talents.bb[['DefaultBoom.atk_scale','S1Boom.atk_scale','S2Boom.atk_scale'][mode]];
      let task;task=b.after(d.blastLifetime,()=>{
        state.tasks.delete(task);if(!state.active)return;
        const currentAtk=e.deploySeq===life?e.s.atk:atk;
        const targets=[...b.allyUnits,...b.enemies.filter(u=>u.profile?.neutral)].filter(u=>live(u)&&!u.isFlying&&areaSelectable(e,u)
          &&Math.hypot(u.x-x,u.y-y)<=d.blastRadius+(u.profile?.neutral?(u.mem.ch16BodyRadius??.1):.25)+1e-9);
        for(const u of new Set(targets)){
          if(!state.active)break;
          b.dealDamage(e,u,{amount:currentAtk*scale,type:'phys',isAttack:false,canDodge:false,applyWay:'none',tags:['chapter17','flyer-blast']});
        }
        b.emit('ch17FlyerBlast',{source:e,mode,scale,x,y,targets});
      },{holdsBattle:true});state.tasks.add(task);
    },
  };
}
