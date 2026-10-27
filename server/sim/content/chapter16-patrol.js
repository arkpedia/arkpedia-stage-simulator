// SPDX-License-Identifier: GPL-3.0-or-later
// Native Attack targets marked NEUTRAL units; Combat attacks the blocker.
import { canTargetAlly } from '../targeting.js';
import review from '../../../data/candidates/arkpedia-ch16-reviewed-patrol.json' with { type: 'json' };
import clocks from '../../../data/candidates/arkpedia-ch16-patrol-clock-contract.json' with { type: 'json' };
import { sourceAbilityDelta } from './arkpedia-slow-down.js';
import { captureEnemySource } from './enemy-source-view.js';
const live=u=>u?.alive&&u.deployed&&!u.hidden;
const controlled=e=>['stun','freeze','sleep','levitate','fear','disarm'].some(k=>e.s.flags[k])
  ||e.s.flags.noCombat&&!!e.blockedBy;
export function patrolCaptain(r) {
  if (r.key !== review.enemy.key || r.prefabKey !== review.enemy.prefabKey) throw Error('Unreviewed Patrol Captain identity');
  const clock=clocks.enemies[r.key];
  if(!clock)throw Error('Unreviewed Patrol Captain clock');
  for(const key of ['attack','combat']){
    const n=JSON.parse(clock.casts[key].originalJson),alias=clock.casts[key].alias;
    if(n._animKey!==(key==='attack'?'Attack_01':'Attack_02')||n._timeMode!==0||n._affectedBySlowDown!==1||n._maxAnimScale!==1
      ||n._selectTargetSource!==2||n._selectTargetTiming!==0||n._waitForAttackEvent!==1||n._interruptAbilityOnDetach!==0
      ||alias.animKey!==n._animKey||alias.animName!==(key==='attack'?'Attack':'Combat')||alias.speed!==1||alias.loop!==0||alias.ignoreMissing!==0)
      throw Error('Unreviewed Patrol Captain animation clock');
  }
  return {
    spawn(b, e, a) {
      e.profile.deferHit = true; e.base.rangeRadius = review.defaults.radius; e.markDirty();
      e.profile.attackCooldowns = { attack: 0, combat: 0 };
      e.profile.attackMode = () => {
        e.profile.melee = !!e.blockedBy;
        return e.blockedBy ? 'combat' : 'attack';
      };
      e.profile.canTarget = u => e.blockedBy ? u === e.blockedBy
        : u.alive && u.deployed && !u.hidden && u.profile?.neutral && !!u.findBuff('mark_neutral[effect]')
          && !u.isFlying && canTargetAlly(e, u, true)
          && Math.hypot(u.x - e.x, u.y - e.y) <= review.defaults.radius + (u.mem.ch16BodyRadius ?? .1) + 1e-9;
      const life=e.deploySeq,port={pending:null};a.active=true;a.ended=false;
      a.valid=()=>a.active&&!b.finished&&!b._endReq&&live(e)&&e.deploySeq===life&&e.profile.sourceAttack===port;
      port.finish=p=>{if(port.pending!==p)return;port.pending=null;b.removeBuff(e,p.hold);};
      port.begin=targets=>{
        if(!a.valid()||port.pending||controlled(e)||!targets.length||targets.some(t=>!live(t)))return false;
        const mode=e.profile.attackMode(),p={mode,targets:targets.map(unit=>({unit,life:unit.deploySeq})),epoch:e.attackControlEpoch,
          age:0,lastAt:b.time,rate:Math.min(1,e.base.bat/e.s.interval),released:false,attackId:++b._attackSeq};
        port.pending=p;e.lastAttackAt=b.time;e.atkCd=e.s.interval;e.profile.attackCooldowns[mode]=e.s.interval;e.stats.attacks++;
        p.hold=b.addBuff(e,{key:'ch16:patrol-ordinary',persist:true,flags:{noMove:true}});return true;
      };
      port.advance=p=>{
        const current=()=>a.valid()&&port.pending===p&&!controlled(e)&&e.attackControlEpoch===p.epoch;
        if(!current()){port.finish(p);return;}
        p.age+=sourceAbilityDelta(e,Math.max(0,b.time-p.lastAt),true)*p.rate;p.lastAt=b.time;
        const timing=clock.casts[p.mode];
        if(!p.released&&p.age+1e-7>=timing.hit){
          p.released=true;const targets=p.targets.filter(t=>live(t.unit)&&t.unit.deploySeq===t.life).map(t=>t.unit);
          for(const target of targets)b._ev(['atk',e.id,target.id,'none']);
          if(current())b.emit('attack',{attacker:e,targets,isSkill:false,profile:e.profile,attackId:p.attackId,patrolMode:p.mode});
        }
        if(!current()||p.age+1e-7>=timing.duration)port.finish(p);
      };
      a.ordinary=port;e.profile.sourceAttack=port;e.profile.attackCooldownAffectedBySlowDown=true;
      a.detach=()=>{a.active=false;if(port.pending)port.finish(port.pending);};
      b.on('removed',({unit})=>{if(unit===e)a.detach();});
      b.on('battleEnd',()=>{a.ended=true;a.detach();});
    },
    tick(b,e,a){if(!a.valid()){a.detach();return;}if(a.ordinary.pending)a.ordinary.advance(a.ordinary.pending);},
    attack(c, b, e, a) {
      if(!a.valid())return;
      const life=e.deploySeq,fallback=captureEnemySource(e);
      for (const target of c.targets) {
        const targetLife=target.deploySeq;
        const hit = (u, applyWay) => {
          if(a.ended||b.finished||b._endReq||!live(u)||u.deploySeq!==targetLife)return;
          const source=e.deploySeq===life?e:fallback;
          b.dealDamage(source, u, { amount: source.s.atk, type: 'phys', isAttack: true, attackId:c.attackId,
            canDodge: true, applyWay, tags: ['chapter16'] });
        };
        if (c.patrolMode==='combat') hit(target, 'melee');
        else b.addProjectile({ from: e, target, source: e, speed: review.defaults.projectileSpeed,
          maxAge: review.defaults.projectileLife, onHit: c => { if (c.target) hit(c.target, 'ranged'); } });
      }
    },
    death(c,b,e,a){a.detach();},
  };
}
