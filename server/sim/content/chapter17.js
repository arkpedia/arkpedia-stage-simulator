// SPDX-License-Identifier: GPL-3.0-or-later
// Native-backed chapter 17 controllers. No controller promotes a stage.
import { COLS } from '../constants.js';
import { canTargetAlly, areaSelectable, aggroCmp } from '../targeting.js';
const live = u => u?.alive && u.deployed && !u.hidden;
const sameLife = (u, seq) => live(u) && u.deploySeq === seq;
const sk = (r, key) => r.skills.find(s => s.prefabKey === key);
const bb = (r, group, key) => r.talents.bb[`${group}.${key}`];
const controlled = e => e.s.flags.stun || e.s.flags.sleep || e.s.flags.levitate || e.s.flags.disarm;
const dist = (a, z) => Math.hypot(a.x - z.x, a.y - z.y);
const opponents = (b, x, y, radius) => [...b.alliesInRadius(x, y, radius),
  ...b.enemies.filter(u => live(u) && u.profile?.neutral && Math.hypot(u.x-x, u.y-y) <= radius)];
const ops = b => b.allyUnits.filter(u => live(u) && u.kind === 'op');
const hit = (b, s, t, amount, type = 'true', extra = {}) => b.dealDamage(s, t, { amount, type, isAttack: true, canDodge: false, tags: ['chapter17'], ...extra });
const lock = (b, e, key) => b.addBuff(e, { key, persist: true, flags: { noMove: true, disarm: true } });
const intrinsicControl = e => e.s.flags.stun || e.s.flags.sleep || e.s.flags.levitate;

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
      for (let r = source ? source.tileR - 1 : rect.r0; r <= (source ? source.tileR + 1 : rect.r1); r++)
        for (let c = source ? source.tileC - 1 : rect.c0; c <= (source ? source.tileC + 1 : rect.c1); c++) {
          const tile = b.grid.tile(r, c);
          if (b.grid.inRect(r, c) && tile.height === 'LOW' && tile.build !== 'NONE' && tile.pass === 'ALL'
            && !b._occ[r * COLS + c]?.alive && !b.grid.obstacle[r * COLS + c]
            && !b.enemies.some(u => u.alive && u.mem.ch16Leak && u.tileR === r && u.tileC === c)) out.push([r, c]);
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
      if (child) child.route = { legs: [{ t: 'wait', time: 1e9 }], legIdx: 0, pts: null, ptIdx: 0, suffix: null, version: -1, waitLeft: null };
      return child;
    },
    expose(source) {
      for (const wall of env.firewalls) if (wall.owner.alive) {
        const sides = wall.sides.filter(s => !s.broken).sort((a, z) => dist(a, source) - dist(z, source) || a.index - z.index);
        if (sides.length) wall.button = { side: sides[0], until: b.time + wall.duration, clicks: 0 };
      }
      b.emit('firewallVulnerability', { source });
    },
  };
  b.on('tick', ({ dt }) => {
    for (const marker of env.rifts) if (marker.alive && marker.nativeMarker) {
      marker.sp = Math.min(marker.spCost, marker.sp + dt);
      if (marker.sp >= marker.spCost - 1e-9 && env.summon()) { marker.sp = 0; marker.cycle++; }
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
    const marker = { nativeMarker: true, cycle: 0, alive: true, x: d.col, y: d.row, tileR: d.row, tileC: d.col, sp: d.initSp ?? 0,
      spCost: d.spCost ?? 55, s: { taunt: 0 }, deploySeq: env.rifts.length + 1,
      gainSp(n) { this.sp = Math.min(this.spCost, this.sp + n); } };
    env.rifts.push(marker);
  }
  return env;
}

// DEFAULT, maxStackCnt=1, independentCharacterSource=false: a single named
// pollution buff. A new application replaces it; sources never add DOT clocks.
export function applyPollution(b, source, target, p) {
  const d = Math.abs(target.tileR - source.tileR) + Math.abs(target.tileC - source.tileC);
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
  return { death(c, b, e) { if (c.reason === 'killed') for (let i = 0; i < bb(r, 'DeadSummon', 'max_cnt'); i++) chapter17Environment(b).summon(e); } };
}

export function chargeRift(r) {
  const s = sk(r, 'ChargeRift');
  const end = (b, e, a) => { a.target = null; b.removeBuff(e, 'ch16:charge'); b.removeBuff(e, 'ch17:charge-def'); a.left = s.cooldown; };
  return {
    spawn(b, e, a) { a.left = s.initCooldown; a.pulse = 0; e.profile.canTarget = u => !u.isFlying && !u.s.flags.liftoff; e.profile.deferHit = true; },
    tick(b, e, a, dt) {
      if (a.target) {
        if (!a.target.alive || a.target.cycle !== a.cycle || a.target.sp >= a.target.spCost || intrinsicControl(e) || e.actionControlEpoch !== a.epoch) { end(b, e, a); return; }
        a.elapsed += dt;
        // Projectile speed10, followed by native one-second repeat hits.
        while (a.elapsed + 1e-9 >= a.next && a.next < s.bb.duration - 1e-9) { a.target.gainSp(s.bb.sp, e); a.next += 1; }
        if (a.elapsed >= s.bb.duration - 1e-9 || a.target.sp >= a.target.spCost) end(b, e, a);
        return;
      }
      a.left -= dt;
      if (a.left > 1e-9 || controlled(e)) return;
      a.target = chapter17Environment(b).rifts.filter(t => t.alive && t.sp < t.spCost && dist(e, t) <= r.stats.rangeRadius).sort(aggroCmp)[0];
      if (a.target) { lock(b, e, 'ch16:charge'); b.addBuff(e, { key: 'ch17:charge-def', persist: true, mods: { defPct: s.bb.def } });
        a.cycle = a.target.cycle; a.elapsed = 0; a.next = dist(e, a.target) / 10; void e.s; a.epoch = e.actionControlEpoch; }
    },
    attack(c, b, e) {
      for (const target of c.targets) b.addProjectile({ from: e, target, speed: 10, source: e, maxAge: 10,
        onHit: c => { if (c.target) hit(b, e, c.target, e.s.atk, 'arts', { canDodge: true }); } });
    },
    death(c, b, e, a) { end(b, e, a); },
  };
}

function updateTheft(b, target) {
  const entries = target.mem.ch17Theft;
  let best = 0;
  for (const [source, data] of entries ?? []) {
    if (!source.alive || target.deploySeq !== data.seq) { entries.delete(source); continue; }
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
  const old = entries.get(e), value = (old?.seq === target.deploySeq ? old.value : 0) + take;
  entries.set(e, { seq: target.deploySeq, value }); a.stolen.add(target); a.totalStolen = total + take;
  updateTheft(b, target);
  b.addBuff(e, { key: 'ch16:stolen', persist: true, refresh: 'replace', mods: { atkFinalFlat: a.totalStolen } });
}
function shield(b, e, r) {
  e.mem.ch16Shield = true;
  b.addBuff(e, { key: 'ch16:shield', persist: true, refresh: 'replace', mods: { defPct: bb(r, 'Shiled', 'def'), resFlat: bb(r, 'Shiled', 'magic_resistance') } });
}
export function warCaster(r) {
  const s = sk(r, 'LockDamage');
  const end = (b, e, a) => { a.target = null; b.removeBuff(e, 'ch16:lock'); a.left = s.cooldown; };
  return {
    spawn(b, e, a) {
      shield(b, e, r); a.left = s.initCooldown; a.stolen = new Set(); e.profile.deferHit = true;
      e.mem.ch16RestoreShield = () => {
        // Native enemy_muwiz_t checks !CheckEnemySkillAffecting before its
        // forced GetShield. It ignores cooldown, but does not replace LockDamage.
        if (!e.mem.ch16Shield && !a.target && !intrinsicControl(e)) { shield(b, e, r); e.atkCd = e.s.interval; }
      };
      b.on('death', ({ unit }) => {
        if (unit === e) for (const target of a.stolen) { target.mem.ch17Theft?.delete(e); updateTheft(b, target); }
        else if (a.stolen.has(unit)) { unit.mem.ch17Theft?.clear(); b.removeBuff(unit, 'ch17:stolen-atk'); }
      }, { owner: e });
    },
    hitIn(c, b, e) {
      if (!e.mem.ch16Shield || !['phys', 'arts'].includes(c.dmg.type)) return;
      if (c.dmg.amount < bb(r, 'Shiled', 'max_damage')) c.cancel = true;
      else { e.mem.ch16Shield = false; b.removeBuff(e, 'ch16:shield'); }
    },
    attack(c, b, e) {
      for (const target of c.targets) b.addProjectile({ from: e, target, speed: 8, source: e, maxAge: 10,
        onHit(c) {
          for (const u of opponents(b, c.x, c.y, 1)) if (areaSelectable(e, u)) hit(b, e, u, e.s.atk, 'arts', { canDodge: true });
        } });
    },
    tick(b, e, a, dt) {
      if (a.target) {
        if (!sameLife(a.target, a.seq) || intrinsicControl(e) || e.actionControlEpoch !== a.epoch) { end(b, e, a); return; }
        a.elapsed += dt;
        while (a.elapsed >= a.next - 1e-9 && a.next < s.bb.hit_duration - 1e-9) {
          const target = a.target, before = target.hp;
          hit(b, e, target, e.s.atk * s.bb.atk_scale, 'arts', { isAttack: false, tags: ['chapter17', 'dot', 'periodic'] });
          if (target.hp < before && target.alive) stealAttack(b, e, a, target, r);
          a.next += 1;
        }
        if (a.elapsed >= s.bb.hit_duration - 1e-9) end(b, e, a);
        return;
      }
      a.left -= dt;
      if (a.left > 1e-9 || controlled(e)) return;
      a.target = b.alliesInRadius(e.x, e.y, r.stats.rangeRadius).filter(u => !u.isFlying && !u.s.flags.liftoff && canTargetAlly(e, u, true)).sort(aggroCmp)[0];
      if (a.target) { lock(b, e, 'ch16:lock'); a.seq = a.target.deploySeq; a.elapsed = 0; a.next = dist(e, a.target) / 10; void e.s; a.epoch = e.actionControlEpoch; }
    },
    death(c, b, e, a) { end(b, e, a); },
  };
}
export function pollute(b, target) {
  const r = target.def?.raw;
  if (r?.prefabKey === 'enemy_10206_muveg') target.mem.ch16PollutedUntil = b.time + bb(r, 'MuradPollut', 'duration');
  target.mem.ch16RestoreShield?.();
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
      if (a.target && (!sameLife(a.target, a.seq) || Math.abs(a.target.tileR - e.tileR) + Math.abs(a.target.tileC - e.tileC) > 1)) release(b, e, a);
      a.scan += dt;
      if (!a.target && a.scan >= 0.1 - 1e-9) {
        a.scan %= 0.1;
        a.target = ops(b).filter(u => u.def.profession !== 'NONE' && Math.abs(u.tileR - e.tileR) + Math.abs(u.tileC - e.tileC) <= 1)
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
export function registerChapter17Firewall(b, owner, { width = 3, height = 3, duration = 5, clicks = 3, onBreak = () => {} } = {}) {
  const wall = { owner, duration, requiredClicks: clicks, button: null,
    sides: [[0, -height / 2], [width / 2, 0], [0, height / 2], [-width / 2, 0]]
      .map(([dx, dy], index) => ({ index, x: owner.x + dx, y: owner.y + dy, broken: false })),
    click(index) {
      const button = wall.button;
      if (!owner.alive || !button || button.side.index !== index || b.time >= button.until) return false;
      if (++button.clicks >= clicks) { button.side.broken = true; wall.button = null; onBreak(index); }
      return true;
    },
  };
  chapter17Environment(b).firewalls.push(wall);
  return wall;
}
