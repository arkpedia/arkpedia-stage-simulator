// SPDX-License-Identifier: GPL-3.0-or-later
// Native-backed chapter 17 controllers. No controller promotes a stage.
import { COLS } from '../constants.js';
import { canTargetAlly, areaSelectable, aggroCmp } from '../targeting.js';
import markerReview from '../../../data/candidates/arkpedia-ch17-reviewed-marker.json' with { type: 'json' };
import {captureEnemySource} from './enemy-source-view.js';
import {isCurrentTargetModifierReceipt} from '../damage.js';
const live = u => u?.alive && u.deployed && !u.hidden;
const sameLife = (u, seq) => live(u) && u.deploySeq === seq;
const sk = (r, key) => r.skills.find(s => s.prefabKey === key);
const bb = (r, group, key) => r.talents.bb[`${group}.${key}`];
const controlled = e => e.s.flags.stun || e.s.flags.freeze || e.s.flags.sleep || e.s.flags.levitate || e.s.flags.disarm;
const dist = (a, z) => Math.hypot(a.x - z.x, a.y - z.y);
const positionTile = u => [Math.round(u.y ?? u.tileR), Math.round(u.x ?? u.tileC)];
const tileDistance = (a, z) => {
  const [ar, ac] = positionTile(a), [zr, zc] = positionTile(z);
  return Math.abs(ar - zr) + Math.abs(ac - zc);
};
const opponents = (b, x, y, radius) => [...b.alliesInRadius(x, y, radius),
  ...b.enemies.filter(u => live(u) && u.profile?.neutral && Math.hypot(u.x-x, u.y-y) <= radius)];
const ops = b => b.allyUnits.filter(u => live(u) && u.kind === 'op');
const hit = (b, s, t, amount, type = 'true', extra = {}) => b.dealDamage(s, t, { amount, type, isAttack: true, canDodge: false, tags: ['chapter17'], ...extra });
const lock = (b, e, key) => b.addBuff(e, { key, persist: true, flags: { noMove: true, disarm: true } });
const intrinsicControl = e => e.s.flags.stun || e.s.flags.freeze || e.s.flags.sleep || e.s.flags.levitate;

/** First contact with a circle, rather than distance to the segment's closest point. */
export function beamIntersection(x, y, nx, ny, target, radius = 0.6) {
  const dx = nx - x, dy = ny - y, ox = x - target.x, oy = y - target.y;
  const c = ox * ox + oy * oy - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy, q = ox * dx + oy * dy, discriminant = q * q - a * c;
  if (!a || discriminant < 0) return null;
  const t = (-q - Math.sqrt(discriminant)) / a;
  return t >= 0 && t <= 1 ? t : null;
}

export function chapter17Environment(b) {
  if (b.chapter16) return b.chapter16;
  const env = b.chapter16 = { rifts: [], beams: [], firewalls: [], shadowSuppressedUntil: new Map(),
    summonTiles(source = null) {
      const out = [];
      const rect = b.rect;
      const [sr, sc] = source ? positionTile(source) : [0, 0];
      for (let r = source ? sr - 1 : rect.r0; r <= (source ? sr + 1 : rect.r1); r++)
        for (let c = source ? sc - 1 : rect.c0; c <= (source ? sc + 1 : rect.c1); c++) {
          const tile = b.grid.tile(r, c);
          if (b.grid.inRect(r, c) && tile.height === 'LOW' && tile.build !== 'NONE' && tile.pass === 'ALL'
            && !b._occ[r * COLS + c]?.alive && !b.grid.obstacle[r * COLS + c]
            && !b.enemies.some(u => u.alive && u.mem.ch16Leak && positionTile(u)[0] === r && positionTile(u)[1] === c)) out.push([r, c]);
        }
      return out;
    },
    summon(source = null) {
      const tiles = env.summonTiles(source);
      if (!tiles.length) return null;
      if (!b.data.getEnemy('enemy_10211_murad')) throw Error('Missing canonical Leak Source dependency');
      const child = b.spawnEnemy('enemy_10211_murad', { pos: b.rng.pick(tiles), countInTotal: false });
      // The native environment creates a static, harmless summon, not a walker
      // with the stage's route 0 (which could leak before its own lifetime ends).
      if (child) {
        child.route = { legs: [{ t: 'wait', time: 1e9 }], legIdx: 0, pts: null, ptIdx: 0, suffix: null, version: -1, waitLeft: null };
        child.holdsBattle = false; // Native environment _unharmful=1, separate from the display count.
      }
      return child;
    },
    expose(source, { allSides = false } = {}) {
      for (const wall of [...env.firewalls]) {
        wall.expose(source, { allSides });
      }
      b.emit('firewallVulnerability', { source, allSides });
    },
  };
  b.on('tick', ({ dt }) => {
    for (const wall of [...env.firewalls]) {
      wall.prune();
    }
    for (const marker of env.rifts) if (marker.alive && marker.nativeMarker) {
      marker.sp = Math.min(marker.spCost, marker.sp + dt * marker.spRecovery);
      marker.scan += dt;
      if (marker.scan < markerReview.defaults.retryInterval - 1e-9) continue;
      marker.scan %= markerReview.defaults.retryInterval;
      if (marker.sp < marker.spCost - 1e-9 || marker.resolving || b.time < marker.nextSummonAt - 1e-9) continue;
      // trap_rift_t first requests the environment spawn; its successful
      // result grants the flag required by the AUTO skill's trigger selector.
      // An unsuccessful request cannot consume SP or start the one-second flag.
      marker.resolving = true;
      try {
        if (env.summon()) {
          marker.sp = 0; marker.cycle++;
          marker.nextSummonAt = b.time + markerReview.defaults.summonFlagDuration;
        }
      } finally { marker.resolving = false; }
    }
    for (const beam of env.beams) {
      const dt0 = Math.min(dt, beam.life), nx = beam.x + beam.dx * 6 * dt0, ny = beam.y + beam.dy * 6 * dt0;
      const targets = [...b.allies(), ...b.enemies.filter(u => live(u) && u !== beam.source && !u.mem.ch16Leak && u.motion !== 'FLY'
        && !/^enemy_1593_musnake/.test(u.defId) && !u.mem.stageUnitDevice)];
      const hits = targets.filter(t => t.kind !== 'token' && t.kind !== 'device' && !t.s.flags.liftoff)
        .map(t => ({ t, at: beamIntersection(beam.x, beam.y, nx, ny, t) }))
        .filter(h => h.at != null).sort((a, z) => a.at - z.at || a.t.id - z.t.id);
      if (hits.length) {
        const t = hits[0].t; beam.life = 0;
        if (t.side === 'enemy') pollute(b, t);
        else if (beam.revealed) hit(b, beam.source, t, beam.source.s.atk * beam.params.atk_scale);
        else applyPollution(b, beam.source, t, beam.params);
      }
      beam.x = nx; beam.y = ny; beam.life -= dt0;
    }
    env.beams = env.beams.filter(p => p.life > 1e-9);
  }, { priority: 100 });
  return env;
}

/** Runtime devices use the same SP/placement path as ChargeRift and death summons. */
export function installChapter17Devices(b, devices) {
  if (!devices.some(d => d.key === 'trap_329_rift')) return null;
  const env = chapter17Environment(b);
  for (const d of devices) if (d.key === 'trap_329_rift') {
    const defaults = markerReview.defaults;
    const sp = d.initSp ?? defaults.initSp, spCost = d.spCost ?? defaults.spCost;
    if (![sp, spCost].every(Number.isFinite) || sp < 0 || spCost <= 0 || sp > spCost) throw Error('Invalid native Leak Marker SP');
    const marker = { nativeMarker: true, cycle: 0, alive: true, deployed: true, side: 'enemy', kind: 'device',
      x: d.col, y: d.row, tileR: d.row, tileC: d.col, sp, spCost,
      spRecovery: defaults.spPerSecond, scan: 0, nextSummonAt: 0, resolving: false,
      s: { taunt: 0 }, deploySeq: env.rifts.length + 1,
      gainSp(n) { this.sp = Math.min(this.spCost, this.sp + n); } };
    env.rifts.push(marker);
  }
  return env;
}

// DEFAULT, maxStackCnt=1, independentCharacterSource=false: a single named
// pollution buff. A new application replaces it; sources never add DOT clocks.
export function applyPollution(b, source, target, p) {
  const d = tileDistance(target, source);
  const q = Math.max(0, Math.min(1, (d - p.min_distance) / (p.max_distance - p.min_distance)));
  const interval = d <= 1 ? p.interval : p.max_interval * q;
  const scale = d >= p.max_distance ? p.atk_scale : p.max_atk_scale * (1 - q);
  const seq = target.deploySeq;
  b.addBuff(target, { key: 'ch17:pollution', source, duration: p.dot_duration, refresh: 'replace', interval,
    onTick() { if (sameLife(target, seq) && !target.s.flags.liftoff) hit(b, source, target, source.s.atk * scale); } });
}

export function reverseDamage(r) {
  return {
    spawn(b, e) { e.mem.ch16PollutedUntil = 0; e.profile.deferHit = true; },
    attack(c, b, e) {
      for (const t of c.targets) {
        const seq = t.deploySeq;
        b.after(0.7, () => { if (sameLife(t, seq)) hit(b, e, t, e.s.atk, 'phys'); });
      }
    },
    hitIn(c, b, e) {
      const s = c.source;
      if (!s || s === e || !s.alive || !(c.dmg.amount > 0) || c.dmg.type === 'element') return;
      const boosted = b.time < e.mem.ch16PollutedUntil;
      const targets = boosted ? opponents(b, s.x, s.y, bb(r, 'ReverseDamage', 'range_radius')).filter(u => areaSelectable(e, u))
        .sort((a, z) => dist(a, s) - dist(z, s) || a.id - z.id).slice(0, bb(r, 'ReverseDamage', 'max_target')) : [s];
      for (const t of targets) hit(b, null, t, bb(r, 'ReverseDamage', boosted ? 'high_atk_value' : 'atk_value'), 'phys',
        { isAttack: boosted, tags: boosted ? ['chapter17'] : ['chapter17', 'dot', 'periodic'] });
    },
  };
}

export function deadSummon(r) {
  return {
    spawn(b,e,a){
      a.active=true;a.life=e.deploySeq;
      b.on('battleEnd',()=>{a.active=false;},{owner:e});
      b.on('removed',({unit})=>{if(unit===e)a.active=false;},{owner:e});
    },
    death(c,b,e,a){
      if(!a.active||a.life!==e.deploySeq)return;a.active=false;
      if(c.reason==='killed')for(let i=0;i<bb(r,'DeadSummon','max_cnt');i++)chapter17Environment(b).summon(e);
    },
  };
}

export function chargeRift(r) {
  const s = sk(r, 'ChargeRift');
  const end = (b, e, a) => { a.target = null; b.removeBuff(e, 'ch16:charge'); b.removeBuff(e, 'ch17:charge-def'); a.left = s.cooldown; };
  return {
    spawn(b, e, a) {
      a.active=true;a.life=e.deploySeq;a.left=s.initCooldown;a.pulse=0;
      a.retire=()=>{if(!a.active)return;a.active=false;end(b,e,a);};
      e.profile.canTarget=u=>!u.isFlying&&!u.s.flags.liftoff;e.profile.deferHit=true;
      b.on('battleEnd',a.retire,{owner:e});b.on('removed',({unit})=>{if(unit===e)a.retire();},{owner:e});
    },
    tick(b, e, a, dt) {
      if(!a.active)return;
      if(!e.alive||!e.deployed||e.deploySeq!==a.life){a.retire();return;}
      if (a.target) {
        if (e.hidden || !a.target.alive || a.target.cycle !== a.cycle || a.target.sp >= a.target.spCost || intrinsicControl(e) || e.actionControlEpoch !== a.epoch
          ||e.s.flags.silence||e.silenceEpoch!==a.silenceEpoch) { end(b, e, a); return; }
        a.elapsed += dt;
        // Projectile speed10, followed by native one-second repeat hits.
        while (a.elapsed + 1e-9 >= a.next && a.next < s.bb.duration - 1e-9) {
          const marker=a.target;marker.gainSp(s.bb.sp,e);a.next+=1;
          if(!a.active||a.target!==marker)return;
          if(!e.alive||!e.deployed||e.deploySeq!==a.life){a.retire();return;}
          if(!marker.alive||marker.cycle!==a.cycle||marker.sp>=marker.spCost){end(b,e,a);return;}
        }
        if (a.elapsed >= s.bb.duration - 1e-9 || a.target.sp >= a.target.spCost) end(b, e, a);
        return;
      }
      a.left -= dt;
      if (a.left > 1e-9 || e.hidden || controlled(e) || e.s.flags.silence) return;
      a.target = chapter17Environment(b).rifts.filter(t => t.alive && t.sp < t.spCost && dist(e, t) <= r.stats.rangeRadius).sort(aggroCmp)[0];
      if (a.target) { lock(b, e, 'ch16:charge'); b.addBuff(e, { key: 'ch17:charge-def', persist: true, mods: { defPct: s.bb.def } });
        a.cycle = a.target.cycle; a.elapsed = 0; a.next = dist(e, a.target) / 10; void e.s; a.epoch = e.actionControlEpoch;a.silenceEpoch=e.silenceEpoch; }
    },
    attack(c, b, e) {
      const life=e.deploySeq,snapshot=captureEnemySource(e);
      for (const target of c.targets) b.addProjectile({ from: e, target, speed: 10, source: e, maxAge: 10,
        onHit: c => { if(c.target){const source=e.deploySeq===life?e:snapshot;hit(b,source,c.target,source.s.atk,'arts',{canDodge:true});} } });
    },
    death(c, b, e, a) { a.retire(); },
  };
}

function updateTheft(b, target) {
  const entries = target.mem.ch17Theft;
  let best = 0;
  for (const [source, data] of entries ?? []) {
    if (!source.alive || source.deploySeq!==data.sourceLife || target.deploySeq !== data.seq) { entries.delete(source); continue; }
    best = Math.max(best, data.value);
  }
  if (best) b.addBuff(target, { key: 'ch17:stolen-atk', persist: true, refresh: 'replace', mods: { atkFinalFlat: -best } });
  else b.removeBuff(target, 'ch17:stolen-atk');
}
export function stealAttack(b, e, a, target, r) {
  const total = a.totalStolen ?? 0;
  const take = Math.max(0, Math.min(bb(r, 'StealAtk', 'steal_atk'), target.s.atk - 1, bb(r, 'StealAtk', 'steal_atk_max') - total));
  if (!take) return;
  const entries = target.mem.ch17Theft ??= new Map();
  const old = entries.get(e), value = (old?.seq === target.deploySeq && old.sourceLife===e.deploySeq ? old.value : 0) + take;
  entries.set(e, { seq: target.deploySeq, sourceLife:e.deploySeq, value }); a.stolen.add(target); a.totalStolen = total + take;
  updateTheft(b, target);
  a.stolenBuff=b.addBuff(e, { key: 'ch16:stolen', persist: true, refresh: 'replace', mods: { atkFinalFlat: a.totalStolen } });
}
function shield(b, e, r) {
  e.mem.ch16Shield = true;
  return b.addBuff(e, { key: 'ch16:shield', persist: true, refresh: 'replace', mods: { defPct: bb(r, 'Shiled', 'def'), resFlat: bb(r, 'Shiled', 'magic_resistance') } });
}
export function warCaster(r) {
  const s = sk(r, 'LockDamage'),leave=sk(r,'Leave');
  const end = (b, e, a) => { a.target = null; b.removeBuff(e,a.hold);a.hold=null;a.left = s.cooldown; };
  return {
    spawn(b, e, a) {
      a.active=true;a.life=e.deploySeq;a.born=b.time;a.leaveUsed=false;
      a.valid=()=>a.active&&e.alive&&e.deployed&&e.deploySeq===a.life;
      a.left = s.initCooldown; a.stolen = new Set(); e.profile.deferHit = true;
      a.retire=()=>{
        if(!a.active)return;a.active=false;end(b,e,a);
        for(const target of a.stolen){if(target.mem.ch17Theft?.get(e)?.sourceLife===a.life)target.mem.ch17Theft.delete(e);updateTheft(b,target);}
        a.stolen.clear();b.removeBuff(e,a.stolenBuff);b.removeBuff(e,a.shieldBuff);
        if(e.mem.ch16RestoreShield===a.restore)delete e.mem.ch16RestoreShield;
        if(e.deploySeq===a.life)e.mem.ch16Shield=false;
      };
      a.restore = () => {
        // Native enemy_muwiz_t checks !CheckEnemySkillAffecting before its
        // forced GetShield. It ignores cooldown, but does not replace LockDamage.
        if (a.valid()&&!e.hidden&&!e.mem.ch16Shield&&!a.target&&!intrinsicControl(e)) { a.shieldBuff=shield(b,e,r);e.atkCd=e.s.interval; }
      };
      e.mem.ch16RestoreShield=a.restore;
      b.on('death', ({ unit }) => {
        if (unit === e) a.retire();
        else if (a.stolen.has(unit)) { unit.mem.ch17Theft?.clear(); b.removeBuff(unit, 'ch17:stolen-atk'); }
      }, { owner: e });
      b.on('removed',({unit})=>{if(unit===e)a.retire();},{owner:e});b.on('battleEnd',a.retire,{owner:e});
      b.on('beforeTargetModifier',c=>{
        if(isCurrentTargetModifierReceipt(c)&&c.outcome==='accepted'&&c.source===e&&a.valid()&&!e.hidden
          &&a.target&&sameLife(a.target,a.seq)&&!intrinsicControl(e)&&!e.s.flags.silence
          &&a.epoch===e.actionControlEpoch&&a.silenceEpoch===e.silenceEpoch&&c.target.deploySeq===c.targetLife)
          stealAttack(b,e,a,c.target,r);
      },{owner:e});
      a.shieldBuff=shield(b,e,r);if(!a.valid())b.removeBuff(e,a.shieldBuff);
    },
    hitIn(c, b, e) {
      if (!e.mem.ch16Shield || !['phys', 'arts'].includes(c.dmg.type)) return;
      if (c.dmg.amount < bb(r, 'Shiled', 'max_damage')) c.cancel = true;
      else { e.mem.ch16Shield = false; b.removeBuff(e, 'ch16:shield'); }
    },
    attack(c, b, e) {
      const life=e.deploySeq,snapshot=captureEnemySource(e);
      for (const target of c.targets) b.addProjectile({ from: e, target, speed: 8, source: e, maxAge: 10,
        onHit(c) {
          const source=e.deploySeq===life?e:snapshot;
          const targets=opponents(b,c.x,c.y,1).filter(u=>areaSelectable(source,u)).map(u=>[u,u.deploySeq]);
          for(const[u,seq]of targets){const current=e.deploySeq===life?e:snapshot;if(sameLife(u,seq)&&areaSelectable(current,u))hit(b,current,u,current.s.atk,'arts',{canDodge:true});}
        } });
    },
    tick(b, e, a, dt) {
      if(!a.active)return;
      if(!a.valid()){a.retire();return;}
      // The priority-one no-target Leave spell is one-shot and ignores silence.
      // Its native instant-kill action does not mark a route exit or lose LP.
      if(leave&&!a.leaveUsed&&b.time-a.born>=leave.initCooldown-1e-8&&!e.hidden&&!intrinsicControl(e)){
        a.leaveUsed=true;end(b,e,a);e.mem.ch17WarCasterLeave=true;b.kill(e,e);
        b.emit('ch17WarCasterLeave',{source:e,sourceLife:a.life,age:b.time-a.born});return;
      }
      if (a.target) {
        if (e.hidden||!sameLife(a.target, a.seq) || intrinsicControl(e) || e.actionControlEpoch !== a.epoch
          ||e.s.flags.silence||e.silenceEpoch!==a.silenceEpoch) { end(b, e, a); return; }
        a.elapsed += dt;
        while (a.elapsed >= a.next - 1e-9 && a.next < s.bb.hit_duration - 1e-9) {
          const target = a.target;
          hit(b, e, target, e.s.atk * s.bb.atk_scale, 'arts', { isAttack: false, tags: ['chapter17', 'dot', 'periodic'] });
          a.next += 1;
          if(!a.active||a.target!==target)return;
          if(!a.valid()){a.retire();return;}
          if(!sameLife(target,a.seq)){end(b,e,a);return;}
        }
        if (a.elapsed >= s.bb.hit_duration - 1e-9) end(b, e, a);
        return;
      }
      a.left -= dt;
      if (a.left > 1e-9 || e.hidden||controlled(e)||e.s.flags.silence) return;
      a.target = b.alliesInRadius(e.x, e.y, r.stats.rangeRadius).filter(u => !u.isFlying && !u.s.flags.liftoff && canTargetAlly(e, u, true)).sort(aggroCmp)[0];
      if (a.target) {
        const target=a.target,seq=target.deploySeq,hold=lock(b,e,'ch16:lock');a.hold=hold;
        if(!hold||!a.valid()||a.target!==target||!sameLife(target,seq)){b.removeBuff(e,hold);if(a.active)end(b,e,a);return;}
        a.seq=seq;a.elapsed=0;a.next=dist(e,target)/10;void e.s;a.epoch=e.actionControlEpoch;a.silenceEpoch=e.silenceEpoch;
      }
    },
    death(c, b, e, a) { a.retire(); },
  };
}
export function pollute(b, target) {
  const r = target.def?.raw;
  if (r?.prefabKey === 'enemy_10206_muveg') target.mem.ch16PollutedUntil = b.time + bb(r, 'MuradPollut', 'duration');
  target.mem.ch16RestoreShield?.();
  target.mem.ch17PollutionReaction?.();
}

export function leakSource(r) {
  const hidden = sk(r, 'HideRoundLaser'), visible = sk(r, 'RoundLaser'), level = sk(r, 'LevelUp');
  const release = (b, e, a) => {
    if (a.target) b.removeBuff(a.target, `ch16:bind:${e.id}`);
    a.target = null; a.left = (a.levelled ? visible : hidden).initCooldown;
    e.mem.ch17Visible = !!a.levelled; e.mem.regularHidden = !a.levelled;
  };
  return {
    spawn(b, e, a) {
      b.addBuff(e, { key: 'ch16:source', persist: true, flags: { invulnerable: true, untargetable: true, unblockable: true, noMove: true, noDisplace: true } });
      e.profile.noAttack = true; a.sp = r.sp.initSp; a.left = hidden.initCooldown; a.scan = 0;
      e.mem.ch16Leak = a; e.mem.regularHidden = true; chapter17Environment(b);
    },
    tick(b, e, a, dt) {
      a.sp = Math.min(level.spCost, a.sp + r.sp.increment * dt);
      if (!a.levelled && a.sp >= level.spCost - 1e-9) {
        a.levelled = true; a.exit = b.time + level.bb.duration; a.left = visible.initCooldown;
        b.addBuff(e, { key: 'ch16:level', persist: true, mods: { atkPct: level.bb.atk } });
      }
      if (a.exit && b.time >= a.exit - 1e-9) { b.kill(e, null); return; }
      if (a.target && (!sameLife(a.target, a.seq) || tileDistance(a.target, e) > 1)) release(b, e, a);
      a.scan += dt;
      if (!a.target && a.scan >= 0.1 - 1e-9) {
        a.scan %= 0.1;
        a.target = ops(b).filter(u => u.def.profession !== 'NONE' && tileDistance(u, e) <= 1)
          .sort((x, y) => x.deploySeq - y.deploySeq)[0];
        if (a.target) {
          a.seq = a.target.deploySeq; a.bound = 0; a.pulse = 0;
          b.addBuff(a.target, { key: `ch16:bind:${e.id}`, source: e, persist: false, flags: a.target.def.immune?.has('stun') ? {} : { stun: true, noBlock: true } });
        }
      }
      e.mem.ch17Visible = !!(a.levelled || a.target); e.mem.regularHidden = !e.mem.ch17Visible;
      if (a.target) {
        a.bound += dt; a.pulse += dt;
        if (a.pulse >= 1 - 1e-9) { a.pulse -= 1; hit(b, e, a.target, e.s.atk * bb(r, 'CheckAppear', 'atk_scale')); }
        if (a.bound >= bb(r, 'CheckAppear', 'enemy_murad_check_appear.interval') - 1e-9) {
          for (const u of ops(b)) if (u.def.profession !== 'NONE') u.skill?.gainSp(bb(r, 'CheckAppear', 'enemy_murad_check_appear.sp'), 'chapter17-counter');
          release(b, e, a); chapter17Environment(b).expose(e); b.kill(e, null);
        }
        return;
      }
      a.left -= dt;
      if (a.left <= 1e-9) {
        const s = a.levelled ? visible : hidden; a.left = s.cooldown;
        for (let i = 0; i < s.bb.projectileNum; i++) {
          const angle = Math.PI + (s.bb.startAngle + i * (s.bb.endAngle - s.bb.startAngle) / (s.bb.projectileNum - 1)) * Math.PI / 180;
          chapter17Environment(b).beams.push({ source: e, params: s.bb, x: e.x, y: e.y, dx: Math.cos(angle), dy: Math.sin(angle),
            life: a.levelled ? 1.1 : 1.3, revealed: !!a.levelled });
        }
      }
    },
    death(c, b, e, a) { release(b, e, a); },
  };
}

/** Integration port for native boss firewall controllers. It intentionally does
 * not approve or implement the bosses' attacks/rebirth/phase transitions. */
export function registerChapter17Firewall(b, owner, { width = 3, height = 3, duration = 5, clicks = 3, onBreak = () => {}, onRetire = () => {} } = {}) {
  if (![width,height,duration].every(n=>Number.isFinite(n)&&n>0)||!Number.isSafeInteger(clicks)||clicks<1||typeof onBreak!=='function'||typeof onRetire!=='function')
    throw Error('Invalid firewall perimeter or click contract');
  const env = chapter17Environment(b), life = owner.deploySeq, handles = [];
  const buttons=new Map();let generation=0,preferredSide=null;
  const wall = { owner, ownerLife: life, id:env.nextFirewallId=(env.nextFirewallId??0)+1,
    duration, requiredClicks: clicks, active: true, sides: [],
    // Compatibility view for callers that expose one side. Mechanical inputs
    // and snapshots below enumerate all simultaneously active side buttons.
    get button(){wall.prune();return buttons.get(preferredSide)??buttons.values().next().value??null;},
    current: () => wall.active && !b.finished && owner.alive && owner.deployed && owner.deploySeq === life,
    retire() {
      if (!wall.active) return;
      wall.active = false; buttons.clear();
      const index = env.firewalls.indexOf(wall);
      if (index >= 0) env.firewalls.splice(index, 1);
      for (const handle of handles) b.off(handle);
      onRetire();
    },
    prune(){
      if(!wall.current()){wall.retire();return false;}
      for(const[index,button]of buttons)if(b.time>=button.until)buttons.delete(index);
      return true;
    },
    expose(source,{allSides=false,sideIndices=null}={}){
      if(sideIndices!==null&&(!Array.isArray(sideIndices)||sideIndices.some(i=>!Number.isSafeInteger(i)||i<0||i>3)))
        throw Error('Invalid firewall side selection');
      if(!wall.prune())return 0;
      const sides=wall.sides.filter(s=>!s.broken&&(sideIndices===null||sideIndices.includes(s.index)));
      if(!allSides)sides.sort((a,z)=>dist(a,source)-dist(z,source)||a.index-z.index);
      const selected=allSides?sides:sides.slice(0,1),exposureId=++generation;
      for(const side of selected)buttons.set(side.index,{side,until:b.time+duration,clicks:0,exposureId});
      preferredSide=selected[0]?.index??null;return selected.length;
    },
    snapshot(){
      if(!wall.prune())return[];
      return[...buttons.values()].map(button=>({ownerId:owner.id,ownerLife:life,wallId:wall.id,side:button.side.index,
        exposureId:button.exposureId,clicks:button.clicks,required:clicks,remaining:Math.max(0,button.until-b.time)}));
    },
    // The caller commits this at the native environment-refresh action after a
    // Blink; moving the owner alone must not prematurely move the old firewall.
    refresh() {
      if (!wall.current()) { wall.retire(); return false; }
      buttons.clear();generation++;preferredSide=null;
      wall.sides = [[0, -height / 2], [width / 2, 0], [0, height / 2], [-width / 2, 0]]
        .map(([dx, dy], index) => ({ index, x: owner.x + dx, y: owner.y + dy, broken: false }));
      return true;
    },
    click(index,input=null) {
      if(!wall.prune())return false;
      const button=buttons.get(index);if(!button)return false;
      if(input&&(input.ownerId!==owner.id||input.ownerLife!==life||input.wallId!==wall.id
        ||input.side!==index||input.exposureId!==button.exposureId))return false;
      if (++button.clicks >= clicks) { button.side.broken = true; buttons.delete(index); onBreak(index); }
      return true;
    },
  };
  if (!wall.refresh()) return wall;
  env.firewalls.push(wall);
  handles.push(b.on('death', ({ unit }) => { if (unit === owner) wall.retire(); }, { owner: wall }),
    b.on('removed', ({ unit }) => { if (unit === owner) wall.retire(); }, { owner: wall }),
    b.on('battleEnd', () => wall.retire(), { owner: wall }));
  return wall;
}

/** Mechanical input adapter for future stage controls. Legacy direct
 * click(index) remains an internal integration port only. */
export function clickChapter17Firewall(b,input){
  if(!input||!['ownerId','ownerLife','wallId','exposureId','side'].every(k=>Number.isSafeInteger(input[k]))||input.side<0||input.side>3)return false;
  for(const wall of [...(b.chapter16?.firewalls??[])])if(wall.id===input.wallId)return wall.click(input.side,input);
  return false;
}
export function chapter17FirewallSnapshot(b){
  return[...(b.chapter16?.firewalls??[])].flatMap(wall=>wall.snapshot());
}

/** Only an installed source-bound controller may supply a placement checker.
 * The older interaction-only port never bans deployment on its own. */
export function chapter17FirewallBlocksDeployment(b,row,col){
  if(!Number.isSafeInteger(row)||!Number.isSafeInteger(col))return false;
  return [...(b.chapter16?.firewalls??[])].some(wall=>wall.blocksDeployment?.(row,col)===true);
}
