// SPDX-License-Identifier: GPL-3.0-or-later
// Candidate chapter 16/17 controllers. Parameters come from canonical enemy
// records; native actions are retained in arkpedia-ch16-action-source.json.
import { COLS } from '../constants.js';
import { canTargetAlly, areaSelectable } from '../targeting.js';

const living = u => u?.alive && u.deployed && !u.hidden;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const skill = (r, key) => r.skills.find(s => s.prefabKey === key);
const bb = (r, group, key) => r.talents.bb[`${group}.${key}`];
const flag = (b, e, key, flags, duration) => b.addBuff(e, { key, flags, duration, persist: duration == null, refresh: 'replace' });
const damage = (b, source, target, amount, type = 'true') => b.dealDamage(source, target, { amount, type, canDodge: false, tags: ['chapter16'] });
const operators = b => b.allyUnits.filter(u => living(u) && u.kind === 'op');

/** Map systems own markers and shadow tiles, rather than fabricating devices. */
export function chapter16Environment(b) {
  return b.chapter16 ??= { rifts: [], shadowSuppressedUntil: new Map(),
    summonTiles(source) {
      const out = [];
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const r = source.tileR + dr, c = source.tileC + dc, tile = b.grid.tile(r, c);
        if (b.grid.inRect(r, c) && tile.build !== 'NONE' && tile.pass === 'ALL'
          && !b.enemies.some(u => u.alive && u.mem.ch16Leak && u.tileR === r && u.tileC === c)) out.push([r, c]);
      }
      return out;
    },
  };
}

export function miner(r) {
  return {
    spawn(b, e, a) {
      e.profile.friendly = true; e.profile.neutral = true; e.profile.noAttack = true;
      b.addBuff(e, { key: 'ch16:neutral-taunt', persist: true, mods: { taunt: -1 } });
      b.on('elementHit', c => { if (c.target === e) c.cancel = true; }, { owner: e });
      flag(b, e, 'ch16:neutral', { unblockable: true });
      a.heal = 0; a.scan = 0; a.fear = null;
    },
    tick(b, e, a, dt) {
      a.heal += dt; a.scan += dt;
      if (a.heal >= 1 - 1e-9) {
        a.heal -= 1;
        for (const medic of operators(b)) {
          if (medic.def.profession !== 'MEDIC') continue;
          if (medic.rangeChanged) b._refreshRange(medic);
          if (medic.rangeKeys?.includes(e.tileR * COLS + e.tileC))
            b.heal(medic, e, medic.s.atk * bb(r, 'GetHeal', 'heal_scale'));
        }
      }
      if (a.scan >= 0.3 - 1e-9) {
        a.scan -= 0.3;
        if (e.s.flags.fear) { if (a.fear == null) a.fear = 0; }
        else a.fear = null;
        if (!e.s.flags.fear && !e.findBuff('gyegrd_a[exist]')) {
          const env = chapter16Environment(b);
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            const key = (e.tileR + dr) * COLS + e.tileC + dc;
            env.shadowSuppressedUntil.set(key, b.time + bb(r, 'TileEscapeShadowManager', 'times'));
          }
        }
      }
      if (a.fear != null) {
        a.fear += dt;
        if (a.fear >= 1 - 1e-9) {
          a.fear -= 1;
          if (e.hp < e.s.maxHp) damage(b, e, e, bb(r, 'FearLoseBlood', 'value'));
        }
      }
    },
  };
}

export function reverseDamage(r) {
  return {
    spawn(b, e) { e.mem.ch16PollutedUntil = 0; e.profile.deferHit = true; },
    attack(c, b, e) {
      for (const t of c.targets) {
        const seq = t.deploySeq;
        b.after(0.7, () => {
          if (living(t) && t.deploySeq === seq) damage(b, e, t, e.s.atk, 'phys');
        });
      }
    },
    hitIn(c, b, e) {
      const source = c.source;
      if (!living(source) || source.side !== 'ally' || !(c.dmg.amount > 0) || c.dmg.type === 'element') return;
      const boosted = b.time < e.mem.ch16PollutedUntil;
      const targets = boosted ? b.alliesInRadius(source.x, source.y, bb(r, 'ReverseDamage', 'range_radius'))
        .filter(u => areaSelectable(e, u)).sort((a, z) => distance(a, source) - distance(z, source) || a.id - z.id)
        .slice(0, bb(r, 'ReverseDamage', 'max_target')) : [source];
      for (const t of targets) damage(b, null, t, bb(r, 'ReverseDamage', boosted ? 'high_atk_value' : 'atk_value'), 'phys');
    },
  };
}

export function deadSummon(r) {
  return {
    death(c, b, e) {
      // Mainline17: buildable AND ground-passable tiles in x-4. Existing Leak
      // Sources exclude occupied tiles; operator occupancy does not.
      const env = chapter16Environment(b);
      const tiles = env.summonTiles?.(e, 'x-4') ?? [];
      for (let i = 0; i < bb(r, 'DeadSummon', 'max_cnt') && tiles.length; i++) {
        const at = Math.floor(b.rng() * tiles.length);
        b.spawnEnemy('enemy_10211_murad', { pos: tiles.splice(at, 1)[0] });
      }
    },
  };
}

export function chargeRift(r) {
  const s = skill(r, 'ChargeRift');
  return {
    spawn(b, e, a) { a.left = s.initCooldown; a.pulse = 0; },
    tick(b, e, a, dt) {
      a.left -= dt;
      if (a.target && (!a.target.alive || a.target.sp >= a.target.spCost || b.time > a.end + 1e-9 || e.s.flags.stun)) {
        a.target = null; b.removeBuff(e, 'ch16:charge'); a.left = s.cooldown;
      }
      if (!a.target && a.left <= 1e-9 && !e.s.flags.stun) {
        a.target = chapter16Environment(b).rifts.find(t => t.alive && t.sp < t.spCost && distance(e, t) <= r.stats.rangeRadius);
        if (a.target) { a.end = b.time + s.bb.duration; a.pulse = 0; b.addBuff(e, { key: 'ch16:charge', persist: true, mods: { defPct: s.bb.def }, flags: { noMove: true, disarm: true } }); }
      }
      if (a.target) {
        a.pulse += dt;
        if (a.pulse >= 1 - 1e-9) { a.pulse -= 1; a.target.gainSp(s.bb.sp, e); }
      }
    },
  };
}

function shield(b, e, r) {
  e.mem.ch16Shield = true;
  b.addBuff(e, { key: 'ch16:shield', persist: true, refresh: 'replace', mods: { defPct: bb(r, 'Shiled', 'def'), resFlat: bb(r, 'Shiled', 'magic_resistance') } });
}

export function warCaster(r) {
  const lock = skill(r, 'LockDamage'), get = skill(r, 'GetShield');
  return {
    spawn(b, e, a) {
      shield(b, e, r); a.left = lock.initCooldown; a.shieldLeft = get.initCooldown; a.stolen = new Map();
      e.mem.ch16RestoreShield = () => {
        if (!e.mem.ch16Shield && a.shieldLeft <= 0) { shield(b, e, r); a.shieldLeft = get.cooldown; a.target = null; b.removeBuff(e, 'ch16:lock'); }
      };
      b.on('death', ({ unit }) => {
        if (unit !== e) return;
        for (const u of a.stolen.keys()) b.removeBuff(u, `ch16:steal:${e.id}`);
      }, { owner: e });
    },
    hitIn(c, b, e) {
      if (!e.mem.ch16Shield || !['phys', 'arts'].includes(c.dmg.type)) return;
      if (c.dmg.amount < bb(r, 'Shiled', 'max_damage')) c.cancel = true;
      else { e.mem.ch16Shield = false; b.removeBuff(e, 'ch16:shield'); }
    },
    dealt(c, b, e) {
      if (c.dmg.tags?.includes('chapter16')) return;
      for (const u of b.alliesInRadius(c.target.x, c.target.y, 1))
        if (u !== c.target && areaSelectable(e, u)) damage(b, e, u, e.s.atk, 'arts');
    },
    tick(b, e, a, dt) {
      a.left -= dt; a.shieldLeft -= dt;
      if (a.target && (!living(a.target) || b.time > a.end + 1e-9 || a.target.deploySeq !== a.targetSeq || e.s.flags.stun)) {
        a.target = null; b.removeBuff(e, 'ch16:lock');
      }
      if (!a.target && a.left <= 1e-9 && !e.s.flags.stun) {
        a.target = b.alliesInRadius(e.x, e.y, r.stats.rangeRadius).filter(u => canTargetAlly(e, u, true)).sort((x, y) => y.deploySeq - x.deploySeq)[0];
        if (a.target) {
          a.targetSeq = a.target.deploySeq; a.end = b.time + lock.bb.hit_duration; a.pulse = 0; a.left = lock.cooldown;
          flag(b, e, 'ch16:lock', { noMove: true, disarm: true }, lock.bb.hit_duration);
        }
      }
      if (!a.target) return;
      a.pulse += dt;
      if (a.pulse < 1 - 1e-9) return;
      a.pulse -= 1;
      const t = a.target, before = t.hp;
      damage(b, e, t, e.s.atk * lock.bb.atk_scale, 'arts');
      if (t.hp >= before || !t.alive) return;
      const total = [...a.stolen.values()].reduce((x, y) => x + y, 0);
      const take = Math.max(0, Math.min(bb(r, 'StealAtk', 'steal_atk'), t.s.atk - 1, bb(r, 'StealAtk', 'steal_atk_max') - total));
      if (!take) return;
      a.stolen.set(t, (a.stolen.get(t) ?? 0) + take);
      b.addBuff(t, { key: `ch16:steal:${e.id}`, persist: true, refresh: 'replace', mods: { atkFinalFlat: -a.stolen.get(t) } });
      b.addBuff(e, { key: 'ch16:stolen', persist: true, refresh: 'replace', mods: { atkFinalFlat: total + take } });
    },
  };
}

export function pollute(b, target) {
  const r = target.def?.raw;
  if (r?.prefabKey === 'enemy_10206_muveg') target.mem.ch16PollutedUntil = b.time + bb(r, 'MuradPollut', 'duration');
  target.mem.ch16RestoreShield?.();
}

/** Swept point/segment collision, so a fast beam cannot tunnel between ticks. */
export function beamIntersection(x, y, nx, ny, target, radius = 0.6) {
  const dx = nx - x, dy = ny - y, d2 = dx * dx + dy * dy;
  const along = d2 ? Math.max(0, Math.min(1, ((target.x - x) * dx + (target.y - y) * dy) / d2)) : 0;
  return Math.hypot(target.x - x - along * dx, target.y - y - along * dy) <= radius ? along : null;
}

export function leakSource(r) {
  const hidden = skill(r, 'HideRoundLaser'), visible = skill(r, 'RoundLaser'), level = skill(r, 'LevelUp');
  return {
    spawn(b, e, a) {
      flag(b, e, 'ch16:source', { invulnerable: true, untargetable: true, unblockable: true, noMove: true });
      e.profile.noAttack = true;
      a.sp = r.sp.initSp; a.left = hidden.initCooldown; a.beams = []; a.dots = new Map();
      e.mem.ch16Leak = a;
    },
    tick(b, e, a, dt) {
      a.sp = Math.min(level.spCost, a.sp + r.sp.increment * dt);
      if (!a.levelled && a.sp >= level.spCost - 1e-9) {
        a.levelled = true; a.exit = b.time + level.bb.duration; a.left = visible.initCooldown;
        b.addBuff(e, { key: 'ch16:level', persist: true, mods: { atkPct: level.bb.atk } });
      }
      if (a.exit && b.time >= a.exit) { b.kill(e, null); return; }
      if (a.target && (!living(a.target) || Math.abs(a.target.tileR - e.tileR) + Math.abs(a.target.tileC - e.tileC) > 1)) {
        b.removeBuff(a.target, `ch16:bind:${e.id}`); a.target = null;
      }
      if (!a.target) {
        a.target = operators(b).filter(u => Math.abs(u.tileR - e.tileR) + Math.abs(u.tileC - e.tileC) <= 1)
          .sort((x, y) => x.deploySeq - y.deploySeq)[0];
        if (a.target) { a.bound = 0; a.pulse = 0; flag(b, a.target, `ch16:bind:${e.id}`, { stun: true }, bb(r, 'CheckAppear', 'enemy_murad_check_appear.duration')); }
      }
      if (a.target) {
        a.bound += dt; a.pulse += dt;
        if (a.pulse >= 1 - 1e-9) { a.pulse -= 1; damage(b, e, a.target, e.s.atk * bb(r, 'CheckAppear', 'atk_scale')); }
        if (a.bound >= bb(r, 'CheckAppear', 'enemy_murad_check_appear.interval') - 1e-9) {
          for (const u of operators(b)) u.skill?.gainSp(bb(r, 'CheckAppear', 'enemy_murad_check_appear.sp'));
          b.removeBuff(a.target, `ch16:bind:${e.id}`);
          b.emit('firewallVulnerability', { source: e, target: a.target }); b.kill(e, null); return;
        }
      } else {
        a.left -= dt;
        if (a.left <= 1e-9) {
          const s = a.levelled ? visible : hidden; a.left = s.cooldown;
          for (let i = 0; i < s.bb.projectileNum; i++) {
            const angle = Math.PI + i * Math.PI / 4;
            a.beams.push({ x: e.x, y: e.y, dx: Math.cos(angle), dy: Math.sin(angle), life: a.levelled ? 1.1 : 1.3, revealed: !!a.levelled });
          }
        }
      }
      for (const beam of a.beams) {
        const nx = beam.x + beam.dx * 6 * dt, ny = beam.y + beam.dy * 6 * dt;
        const targets = [...b.allies(), ...b.enemies.filter(u => u !== e && u.alive && u.motion !== 'FLY' && !u.mem.ch16Leak)];
        const hits = targets.filter(t => t.kind !== 'token' && t.kind !== 'device' && !t.s.flags.liftoff)
          .map(t => ({ t, at: beamIntersection(beam.x, beam.y, nx, ny, t) })).filter(h => h.at != null).sort((x, y) => x.at - y.at || x.t.id - y.t.id);
        if (hits.length) {
          const t = hits[0].t; beam.life = 0;
          if (t.side === 'enemy') pollute(b, t);
          else if (beam.revealed) damage(b, e, t, e.s.atk * visible.bb.atk_scale);
          else {
            const d = Math.abs(t.tileR - e.tileR) + Math.abs(t.tileC - e.tileC), p = hidden.bb;
            const q = Math.max(0, Math.min(1, (d - p.min_distance) / (p.max_distance - p.min_distance)));
            a.dots.set(t, { until: b.time + p.dot_duration, left: d <= 1 ? p.interval : p.max_interval * q,
              interval: d <= 1 ? p.interval : p.max_interval * q, scale: d >= p.max_distance ? p.atk_scale : p.max_atk_scale * (1 - q) });
          }
        }
        beam.x = nx; beam.y = ny; beam.life -= dt;
      }
      a.beams = a.beams.filter(p => p.life > 0);
      for (const [t, dot] of a.dots) {
        if (!living(t) || b.time > dot.until) { a.dots.delete(t); continue; }
        dot.left -= dt;
        if (dot.left <= 1e-9) { dot.left += dot.interval; damage(b, e, t, e.s.atk * dot.scale); }
      }
    },
    death(c, b, e, a) { if (a.target) b.removeBuff(a.target, `ch16:bind:${e.id}`); },
  };
}

export const chapter16Abilities = { ch16Miner: miner, ch16ReverseDamage: reverseDamage, ch16DeadSummon: deadSummon,
  ch16ChargeRift: chargeRift, ch16WarCaster: warCaster, ch16LeakSource: leakSource };
