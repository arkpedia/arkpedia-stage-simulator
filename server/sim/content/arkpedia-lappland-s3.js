// SPDX-License-Identifier: GPL-3.0-or-later
// Source-selected private S3 execution. Serialized inputs do not certify Unity FSM/frame parity.
import e from '../../../data/arkpedia-lappland-alter-prefabs.json' with {type:'json'};
import {bodyDist,hitRect} from '../body.js';
const all=Object.values({...e.characters,...e.skills,...e.projectiles}).flatMap(rs=>rs.flatMap(r=>r.components));
const c=id=>all.find(v=>v.pathId===id)?.data;
const ability=c('-661545081116982979'),movement=c('3248638574952362967');
const spread=c('-7339734723477589033'),chase=c('398906320185045975'),orbit=c('-8483330843134676009');
const managers=new WeakMap(),TAU=2*Math.PI,AREA='lappland:s3-area',TRACE='lappland:s3-trace',ATTACH='lappland:s3-attach';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const wrapped=a=>Math.atan2(Math.sin(a),Math.cos(a));
// Arrival geometry, angular turn-speed units and source-selection ties are
// deliberate regular-stage mappings. These constants are not decoded Unity code.
const ARRIVAL=.04;
function distanceAtSpeed(d,initial,acc,max,dt){
  const v=d.speed??initial,t=Math.min(dt,Math.max(0,(max-v)/acc));
  const distance=v*t+.5*acc*t*t+max*(dt-t);
  d.speed=Math.min(max,v+acc*dt);return distance;
}
function segmentReaches(t,a,z){
  const r=hitRect(t)??{x0:t.x-ARRIVAL,x1:t.x+ARRIVAL,y0:t.y-ARRIVAL,y1:t.y+ARRIVAL};
  let lo=0,hi=1;
  for(const [start,delta,min,max] of [[a.x,z.x-a.x,r.x0,r.x1],[a.y,z.y-a.y,r.y0,r.y1]]){
    if(Math.abs(delta)<1e-12){if(start<min||start>max)return false;continue;}
    const p=(min-start)/delta,q=(max-start)/delta;lo=Math.max(lo,Math.min(p,q));hi=Math.min(hi,Math.max(p,q));
    if(lo>hi)return false;
  }
  return true;
}
export function validateLapplandS3(){
  const meta=c('-648009180279112801'),root=c('8627108643924653015');
  if(ability._funnelActions.length!==4||ability._projectileInitRadius!==.5||ability._waitForAttackEvent!==0
    ||ability._clearProjectilesWhenDetached!==1||ability._allowNoTarget!==1
    ||meta._allowNoTarget!==1||meta._canCastDuringBorn!==1||meta._allowSpRecoveryWhenAffecting!==0
    ||!same(movement._movementTypes,[0,1,2,3])||!same(movement._periodTimeBBKeys,['times'])
    ||chase._addInertia!==1||chase._turnSpeed!==5||chase._speed!==2||chase._finalSpeed!==4
    ||orbit._radius!==1.25||orbit._speed!==1||orbit._initKeepLastDirection!==1
    ||root._actionController._detachBuffsWhenTargetLeave!==1||root._actionController._detachAllBuffsWhenStopped!==1
    ||c('-2596459332578790441')._hitTargetNoDamage!==1||c('81575916091905151')._waitFirstPeriod!==0
    ||c('8150517675280471167')._followTarget!==1||c('-6666744467211905921')._stopWhenSourceInvalid!==1
    ||c('7774322880865272125')._projectileKey!=='projectile_chr_whitw2_s3')
    throw Error('Unreviewed Lappland S3 native movement');
  for(const ref of ability._funnelActions){
    const aura=c(ref.m_PathID)._activeBuffs[0];
    if(aura.templateKey!=='whitw2_s3_t[slow_and_damage]'||aura.maxStackCnt!==1
      ||aura.independentCharacterSource!==0||aura.overrideType!==2||aura.waitFirstTriggerInterval!==0
      ||aura.triggerInterval!==1||aura.statusResistable!==2)
      throw Error('Unreviewed Lappland S3 shared area');
  }
}

// One battle-wide union preserves one recipient clock even under overlapping
// drones/owners. First surviving source owns the receipt; handoff keeps cadence.
// This overlap policy is explicit, not certified native override-map ordering.
class AreaManager{
  constructor(b){
    this.b=b;this.owners=new Set();this.states=new Map();this.marks=new Map();this.busy=false;this.ended=false;
    this.hooks=[b.on('tick',()=>this.sync(true),{priority:-10}),b.on('battleEnd',()=>this.finish())];
  }
  drop(t,s){if(this.states.get(t)===s)this.states.delete(t);if(s.buff)this.b.removeBuff(t,s.buff);}
  markers(){
    const needed=new Map();
    for(const owner of this.owners)if(owner.valid())for(const d of owner.drones){
      const t=d.target;if(!t||d.targetSeq!==t.deploySeq||!owner.owner.eligible(t)||!['chase','attach'].includes(d.phase))continue;
      let n=needed.get(t);if(!n){n={seq:t.deploySeq,trace:0,attach:0,owner};needed.set(t,n);}
      n[d.phase==='chase'?'trace':'attach']++;
    }
    for(const [t,s] of [...this.marks])if(!needed.has(t)||s.seq!==t.deploySeq){
      this.marks.delete(t);for(const buff of [s.trace,s.attach])if(buff)this.b.removeBuff(t,buff);
    }
    for(const [t,n] of needed){
      if(this.ended||!n.owner.valid()||n.seq!==t.deploySeq)continue;
      let s=this.marks.get(t);if(!s){s={seq:n.seq};this.marks.set(t,s);}
      for(const [type,key] of [['trace',TRACE],['attach',ATTACH]]){
        if(!n[type]){if(s[type])this.b.removeBuff(t,s[type]);s[type]=null;continue;}
        if(s[type]&&!t.buffs.includes(s[type]))s[type]=null;
        if(!s[type])s[type]=this.b.addBuff(t,{key,source:n.owner.u,duration:Infinity,maxStacks:100,
          stacks:type==='trace'?n.trace:1});
        else if(type==='trace'){s[type].stacks=n.trace;t.markDirty();}
        if(this.ended||!n.owner.valid()||n.seq!==t.deploySeq){
          for(const buff of [s.trace,s.attach])if(buff)this.b.removeBuff(t,buff);this.marks.delete(t);break;
        }
      }
    }
  }
  sync(damage=false){
    if(this.ended||this.busy)return;this.busy=true;
    try{
      this.markers();
      for(const t of this.b.enemies.slice()){
        if(this.ended)break;
        const owners=[...this.owners].filter(o=>o.valid()&&o.owner.eligible(t)&&o.contains(t));
        let s=this.states.get(t);
        if(s&&s.seq!==t.deploySeq){this.drop(t,s);s=null;}
        if(!owners.length){if(s)this.drop(t,s);continue;}
        if(!s){s={seq:t.deploySeq,owner:owners[0],nextAt:this.b.time,buff:null};this.states.set(t,s);}
        if(!owners.includes(s.owner)){if(s.buff)this.b.removeBuff(t,s.buff);s.buff=null;s.owner=owners[0];}
        const owner=s.owner,u=owner.u;
        if(!s.buff||!t.buffs.includes(s.buff)){
          s.buff=this.b.addBuff(t,{key:AREA,source:u,duration:Infinity,mods:{moveMul:1+owner.bb['attack@move_speed']}});
          if(owner.owner.silence&&owner.valid()&&this.states.get(t)===s&&t.deploySeq===s.seq)
            this.b.applyStatus(t,'silence',{duration:owner.owner.record.alpha['attack@silence_duration'],source:u});
        }
        if(this.ended||!owner.valid()||!owner.owner.eligible(t)||s.seq!==t.deploySeq||!owner.contains(t)){
          if(s.owner===owner)this.drop(t,s);
          else if(s.buff?.source===u){this.b.removeBuff(t,s.buff);s.buff=null;}
          continue;
        }
        if(!s.buff||!t.buffs.includes(s.buff))continue;
        if(damage&&this.b.time+1e-9>=s.nextAt){
          s.nextAt=this.b.time+1;
          this.b.emit('lapplandS3AreaTick',{owner:u,target:t});
          if(!this.ended&&owner.valid()&&this.states.get(t)===s&&s.seq===t.deploySeq&&owner.owner.eligible(t))
            this.b.dealDamage(u,t,{amount:u.s.atk*u.s.atkScaleMul*owner.bb['attack@magic_atk_scale'],
              type:'arts',isAttack:false,isSkill:false,applyWay:'none',tags:['lappland:s3-area']});
        }
      }
      for(const [t,s] of [...this.states])if(!this.b.enemies.includes(t))this.drop(t,s);
    }finally{this.busy=false;}
  }
  detach(owner){
    this.owners.delete(owner);
    if(!this.owners.size){this.finish();return;}
    if(!this.busy){this.sync(false);return;}
    // A receipt/buff callback may retire the selected source inside this tick.
    // Preserve the shared recipient clock when another live field still covers it.
    for(const [t,s] of [...this.states])if(s.owner===owner){
      const replacement=[...this.owners].find(o=>o.valid()&&o.owner.eligible(t)&&o.contains(t));
      if(!replacement){this.drop(t,s);continue;}
      const old=s.buff;s.buff=null;s.owner=replacement;if(old)this.b.removeBuff(t,old);
    }
  }
  finish(){
    if(this.ended)return;this.ended=true;this.owners.clear();
    // Removal callbacks may start a new cast/manager. Retire this identity first,
    // and never delete the replacement after its callbacks return.
    if(managers.get(this.b)===this)managers.delete(this.b);
    for(const [t,s] of [...this.states])this.drop(t,s);
    for(const [t,s] of this.marks)for(const buff of [s.trace,s.attach])if(buff)this.b.removeBuff(t,buff);
    this.marks.clear();for(const h of this.hooks)this.b.off(h);
  }
}

export class LapplandS3Drones{
  constructor(owner){this.owner=owner;this.b=owner.b;this.u=owner.u;this.bb=owner.record.bb;this.drones=[];this.running=false;this.epoch=0;this.manager=null;}
  valid(drone=null){return this.running&&this.owner.valid()&&this.u.skill.active&&this.epoch===this.owner.modeEpoch
    &&(!drone||drone.epoch===this.epoch&&this.drones.includes(drone));}
  start(){
    this.running=true;this.epoch=this.owner.modeEpoch;this.drones=[];
    let m=managers.get(this.b);if(!m){m=new AreaManager(this.b);managers.set(this.b,m);}
    this.manager=m;m.owners.add(this);this.add(this.owner.count());
  }
  add(count){
    const initialAngle=Math.atan2(this.u.fwd[0],this.u.fwd[1]),n=this.owner.count(),epoch=this.epoch,drones=this.drones;
    for(let i=0;i<count&&this.valid()&&epoch===this.epoch&&drones===this.drones;i++){
      const slot=this.drones.length,angle=initialAngle+TAU*slot/n;
      const d={slot,epoch,x:this.u.x+Math.cos(angle)*ability._projectileInitRadius,
        y:this.u.y+Math.sin(angle)*ability._projectileInitRadius,heading:angle,speed:spread._speed,
        age:0,phase:'spread',lastAt:this.b.time,target:null,targetSeq:null,nextAt:0,ramp:{target:null,seq:null,scale:0}};
      this.drones.push(d);this.b.emit('lapplandS3DroneBirth',{owner:this.u,drone:d});
    }
    if(this.valid()&&epoch===this.epoch&&drones===this.drones)this.u.mem.lapplandS3Drones=this.drones;
  }
  nearest(d){
    return this.b.enemies.filter(t=>this.owner.eligible(t)&&(!t.s.flags.camou||t.blockedBy))
      .sort((a,z)=>Math.hypot(a.x-d.x,a.y-d.y)-Math.hypot(z.x-d.x,z.y-d.y)
        ||Math.hypot(a.x-this.u.x,a.y-this.u.y)-Math.hypot(z.x-this.u.x,z.y-this.u.y))[0];
  }
  contains(t){return this.drones.some(d=>bodyDist(t,d.x,d.y)<=this.bb['attack@range_radius']+1e-9);}
  resetTarget(d){
    const attached=d.phase==='attach',x=d.lastTargetX,y=d.lastTargetY;
    d.target=null;d.targetSeq=null;d.phase='seek';d.orbit=null;
    if(attached){
      d.x=x+movement._randomOffsetMin.x+this.b.rng()*(movement._randomOffsetMax.x-movement._randomOffsetMin.x);
      d.y=y+movement._randomOffsetMin.y+this.b.rng()*(movement._randomOffsetMax.y-movement._randomOffsetMin.y);
      this.b.emit('lapplandS3Reappear',{owner:this.u,drone:d});
    }
  }
  attach(d){
    const t=d.target,seq=d.targetSeq;d.phase='attach';d.x=t.x;d.y=t.y;d.lastTargetX=t.x;d.lastTargetY=t.y;
    d.nextAt=this.b.time;this.b.emit('lapplandS3Attach',{owner:this.u,target:t,drone:d});
    if(this.valid(d)&&seq===t.deploySeq&&this.owner.eligible(t))
      this.b.applyStatus(t,'fear',{duration:this.bb['attack@fear'],source:this.u,sourceStatusResistable:true});
  }
  step(d,dt){
    if(!this.valid(d))return;
    if(d.phase==='spread'){
      const part=Math.min(dt,Math.max(0,this.bb['attack@times']-d.age));
      const length=distanceAtSpeed(d,spread._speed,spread._deltaSpeedPerSec,spread._finalSpeed,part);
      d.x+=Math.cos(d.heading)*length;d.y+=Math.sin(d.heading)*length;d.age+=part;dt-=part;
      if(d.age+1e-9<this.bb['attack@times'])return;d.phase='seek';
    }
    if(d.target&&(d.targetSeq!==d.target.deploySeq||!this.owner.eligible(d.target)))this.resetTarget(d);
    if(!this.valid(d))return;
    if(d.phase==='seek'||d.phase==='orbit'){
      const t=this.nearest(d);
      if(t){d.target=t;d.targetSeq=t.deploySeq;d.phase='chase';d.speed=chase._speed;d.orbit=null;
        this.b.emit('lapplandS3Trace',{owner:this.u,target:t,drone:d});
      }else{
        d.phase='orbit';
        if(!d.orbit)d.orbit={x:d.x-Math.sin(d.heading)*orbit._radius,y:d.y+Math.cos(d.heading)*orbit._radius};
        const angle=Math.atan2(d.y-d.orbit.y,d.x-d.orbit.x)+orbit._speed/orbit._radius*dt;
        d.x=d.orbit.x+orbit._radius*Math.cos(angle);d.y=d.orbit.y+orbit._radius*Math.sin(angle);
        d.heading=angle+Math.PI/2;return;
      }
    }
    if(!this.valid(d)||!this.owner.eligible(d.target)||d.targetSeq!==d.target.deploySeq)return;
    const t=d.target;
    if(d.phase==='chase'){
      const from={x:d.x,y:d.y},angle=Math.atan2(t.y-d.y,t.x-d.x),delta=wrapped(angle-d.heading);
      const turn=this.bb['attack@projectile_turn_speed']*dt;
      d.heading+=Math.max(-turn,Math.min(turn,delta));
      const length=distanceAtSpeed(d,chase._speed,chase._deltaSpeedPerSec,chase._finalSpeed,dt);
      d.x+=Math.cos(d.heading)*length;d.y+=Math.sin(d.heading)*length;
      if(bodyDist(t,from.x,from.y)>ARRIVAL&&!segmentReaches(t,from,d))return;
      this.attach(d);
    }
    if(!this.valid(d)||d.phase!=='attach'||!this.owner.eligible(t)||d.targetSeq!==t.deploySeq)return;
    d.x=t.x;d.y=t.y;d.lastTargetX=t.x;d.lastTargetY=t.y;
    if(this.b.time+1e-9<d.nextAt)return;
    d.nextAt=this.b.time+this.u.s.interval;
    const scale=this.owner.scale(d.ramp,t);this.b.emit('lapplandS3DroneStrike',{owner:this.u,target:t,drone:d,scale});
    if(this.valid(d)&&d.targetSeq===t.deploySeq&&this.owner.eligible(t))
      this.owner.receipt(t,scale,{isAttack:false,isSkill:false,applyWay:'none'},'s3-drone');
  }
  tick(){
    if(!this.valid())return;
    this.add(Math.max(0,this.owner.count()-this.drones.length));
    const drones=this.drones,epoch=this.epoch;
    for(const d of drones){
      if(!this.valid(d)||this.epoch!==epoch||this.drones!==drones)break;
      const dt=Math.max(0,this.b.time-d.lastAt);d.lastAt=this.b.time;this.step(d,dt);
    }
  }
  stop(){
    if(!this.running)return;this.running=false;this.drones=[];this.u.mem.lapplandS3Drones=null;
    const manager=this.manager;this.manager=null;manager?.detach(this);
  }
}
