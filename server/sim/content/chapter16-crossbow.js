// SPDX-License-Identifier: GPL-3.0-or-later
// Candidate mobile crossbowman controller. Retained-source review is separate
// from this implementation; importing it never admits an enemy or stage.
import clocks from '../../../data/candidates/arkpedia-ch16-crossbow-clock-contract.json' with { type: 'json' };
import { sourceAbilityDelta } from './arkpedia-slow-down.js';
import { captureEnemySource } from './enemy-source-view.js';
const live = u => u?.alive && u.deployed && !u.hidden;
const controlled = e => ['stun','freeze','sleep','levitate','fear','disarm'].some(k => e.s.flags[k])
  || e.s.flags.noCombat && !!e.blockedBy;
// The test-only contract uses centers for direct radius queries, separately
// from the weapon collision selector. Original collider-edge parity is unverified.
export function mobileCrossbow(r) {
  const clock=clocks.enemies[r.key];
  if(!clock||r.prefabKey!==r.key)throw Error('Unreviewed crossbow clock identity');
  for(const key of ['attack','combat']){
    const n=JSON.parse(clock.casts[key].originalJson);
    if(n._animKey!==(key==='attack'?'Attack':'Skill')||n._timeMode!==0||n._affectedBySlowDown!==1||n._maxAnimScale!==1
      ||n._selectTargetSource!==2||n._selectTargetTiming!==0||n._waitForAttackEvent!==1||n._damageType!==1||n._attackType!==1)
      throw Error('Unreviewed crossbow cast clock');
  }
  const bb = r.talents.bb, prefix = 'ExtraPowerListener.';
  const radius = bb[prefix + 'radius_1'], orderedRadius = bb[prefix + 'radius_2'];
  const scale = bb[prefix + 'attack@atk_scale_2'];
  if (![radius, orderedRadius, scale].every(v => Number.isFinite(v) && v > 0)) throw Error('Invalid native crossbowman parameters');
  return {
    spawn(b, e, a) {
      a.scan = 0; a.ranged = false;
      e.profile.melee = true; e.profile.deferHit = true;
      e.profile.attackCooldowns = { attack: 0, combat: 0 };
      e.profile.attackMode = () => {
        e.profile.melee = !!e.blockedBy;
        return e.blockedBy ? 'combat' : 'attack';
      };
      e.profile.canTarget = u => (e.blockedBy ? u === e.blockedBy : a.ranged) && !u.isFlying && !u.s.flags.liftoff;
      b.addBuff(e, { key: 'enemy_field_army_self_mark', persist: true });
      const life=e.deploySeq,port={pending:null};a.active=true;a.ended=false;
      a.valid=()=>a.active&&!b.finished&&!b._endReq&&live(e)&&e.deploySeq===life&&e.profile.sourceAttack===port;
      port.finish=p=>{if(port.pending!==p)return;port.pending=null;b.removeBuff(e,p.hold);};
      port.begin=targets=>{
        if(!a.valid()||port.pending||controlled(e)||!targets.length||targets.some(t=>!live(t)))return false;
        const mode=e.profile.attackMode();
        if(mode==='attack'&&!a.ranged)return false;
        const p={mode,targets:targets.map(unit=>({unit,life:unit.deploySeq})),epoch:e.attackControlEpoch,
          age:0,lastAt:b.time,rate:Math.min(1,e.base.bat/e.s.interval),released:false,attackId:++b._attackSeq};
        port.pending=p;e.lastAttackAt=b.time;e.atkCd=e.s.interval;e.profile.attackCooldowns[mode]=e.s.interval;e.stats.attacks++;
        p.hold=b.addBuff(e,{key:'ch16:crossbow-ordinary',persist:true,flags:{noMove:true}});return true;
      };
      port.advance=p=>{
        const current=()=>a.valid()&&port.pending===p&&!controlled(e)&&e.attackControlEpoch===p.epoch;
        if(!current()){port.finish(p);return;}
        p.age+=sourceAbilityDelta(e,Math.max(0,b.time-p.lastAt),true)*p.rate;p.lastAt=b.time;
        const timing=clock.casts[p.mode];
        if(!p.released&&p.age+1e-7>=timing.hit){
          p.released=true;
          const targets=p.targets.filter(t=>live(t.unit)&&t.unit.deploySeq===t.life).map(t=>t.unit);
          for(const target of targets)b._ev(['atk',e.id,target.id,'none']);
          if(current())b.emit('attack',{attacker:e,targets,isSkill:false,profile:e.profile,attackId:p.attackId,crossbowMode:p.mode});
        }
        if(!current()||p.age+1e-7>=timing.duration)port.finish(p);
      };
      a.ordinary=port;e.profile.sourceAttack=port;e.profile.attackCooldownAffectedBySlowDown=true;
      a.detach=()=>{a.active=false;if(port.pending)port.finish(port.pending);};
      b.on('removed',({unit})=>{if(unit===e)a.detach();});
      b.on('battleEnd',()=>{a.ended=true;a.detach();});
    },
    tick(b, e, a, dt) {
      if(!a.valid()){a.detach();return;}
      if(a.ordinary.pending)a.ordinary.advance(a.ordinary.pending);
      a.scan += dt;
      while (a.scan >= .1 - 1e-9) {
        a.scan -= .1;
        const ordered = !!e.findBuff('enemy_uacomd_extra_power');
        const reach = ordered ? orderedRadius : radius;
        // ALLY is the absolute player side, not the enemy owner's side.
        // The second native query separately names marked NEUTRAL miners.
        a.ranged = ![...b.allyUnits, ...b.enemies.filter(u => u.profile?.neutral && u.findBuff('enemy_mcreep_self_mark'))]
          .some(u => live(u)
          && Math.hypot(u.x - e.x, u.y - e.y) <= reach + 1e-9);
        if (ordered && !e.findBuff('uacomd_t[extra_effect]')) b.addBuff(e, { key: 'uacomd_t[extra_effect]', persist: true });
        else if (!ordered) b.removeBuff(e, 'uacomd_t[extra_effect]');
        if (a.ranged && !e.findBuff('uasnip_no_ally_nearby_able_attack'))
          b.addBuff(e, { key: 'uasnip_no_ally_nearby_able_attack', persist: true });
        else if (!a.ranged) b.removeBuff(e, 'uasnip_no_ally_nearby_able_attack');
      }
    },
    attack(c, b, e, a) {
      if(!a.valid())return;
      const life=e.deploySeq,fallback=captureEnemySource(e);
      for (const target of c.targets) {
        const targetLife=target.deploySeq;
        const hit = (t, factor, applyWay) => {
          if(a.ended||b.finished||b._endReq||!live(t)||t.deploySeq!==targetLife)return;
          const source=e.deploySeq===life?e:fallback;
          b.dealDamage(source, t, { amount: source.s.atk * factor,
            type: 'phys', isAttack: true, attackId:c.attackId, canDodge: true, applyWay, tags: ['chapter16'] });
        };
        if (c.crossbowMode==='combat') hit(target, 1, 'melee');
        else b.addProjectile({ from: e, target, source: e, speed: 10, maxAge: 10,
          onHit: c => { if (c.target) hit(c.target, scale, 'ranged'); } });
      }
    },
    death(c,b,e,a){a.detach();},
  };
}
