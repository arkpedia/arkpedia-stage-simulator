// SPDX-License-Identifier: GPL-3.0-or-later
// Theresa (enemy_1554_lrtsia). Every number arrives in `p` from the reviewed contract
// (shared/arkpedia/enemy-theresa-features.js). Native modes: Default (form one), s1 (form
// two), s2 (form three) and Reborn (the first revive). She never attacks or moves.
import { summonCocoon, hasCocoon, cocoonCages, cocoonCount } from './arkpedia-enemy-cocoon-cage.js';
import { ALLY_COLLIDER_RADIUS } from '../constants.js';

const SOUL = 'enemy_1428_lrsoul', REVIVE = 'ab:lrtsiaRevive', FORM2 = 'enemy_lrtsia[p2_buff]', FORM3 = 'enemy_lrtsia[p3_invincable]';
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const live = u => u?.alive && u.deployed !== false && !u.hidden;
// professionMask 767: every profession but summons (TOKEN); devices are not operators.
const operator = u => live(u) && u.kind !== 'token' && u.kind !== 'device';
const tileOf = u => [Math.round(u.y), Math.round(u.x)];
const wrap = v => ((v % TAU) + TAU) % TAU;

/** EnemyLrtsiaSummonEnemyOnSurroundTiles eligibility (PRTS): not a pit, special tile, undeployable high ground, a cage or an obstacle. */
export function cocoonSpreadTile(b, row, col) {
  if (!b.grid.inRect(row, col) || hasCocoon(b, row, col) || b.grid.isObstacle(row, col)) return false;
  const t = b.grid.tile(row, col);
  return t.key !== 'tile_hole' && !t.special && !(t.height === 'HIGH' && t.build === 'NONE');
}
/** Weave Cocoon: every cage spreads to its four neighbouring tiles. */
export function spreadCocoons(b) {
  const from = [...cocoonCages(b).entries()].filter(([, cage]) => cage.alive).map(([k]) => k.split(',').map(Number));
  let made = 0;
  for (const [row, col] of from) for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]])
    if (cocoonSpreadTile(b, row + dr, col + dc) && summonCocoon(b, row + dr, col + dc)) made++;
  return made;
}

export function theresa(p) {
  validate(p);

  // --- <Eternal Dust>: motes orbit at `speed` deg/s; an operator they touch consumes them until their cooldown ends ---
  const makeRings = (b, spec) => spec.rings.map(r => ({ ...r, t0: b.time,
    motes: [...Array(r.visible).fill(true).map((_, i) => ({ visible: true, phase: TAU * i / r.visible, back: 0 })),
      ...Array(r.invisible).fill(false).map((_, i) => ({ visible: false, phase: TAU * i / r.invisible, back: 0 }))] }));
  // Counter-clockwise is counted in the battle's screen frame (rows grow downwards).
  const angleOf = (b, ring, m) => wrap(m.phase + (ring.clockwise ? -1 : 1) * ring.speed * DEG * (b.time - ring.t0));
  const dust = (b, e, a) => {
    for (const ring of a.rings ?? []) for (const m of ring.motes) {
      if (b.time < m.back) continue;
      const th = angleOf(b, ring, m), x = e.x + ring.radius * Math.cos(th), y = e.y - ring.radius * Math.sin(th);
      const hit = b.allies().find(u => operator(u) && Math.hypot(u.x - x, u.y - y) <= p.dust.collision + ALLY_COLLIDER_RADIUS);
      if (!hit) continue;
      m.back = b.time + (m.visible ? ring.visibleCooldown : ring.invisibleCooldown);
      if (m.visible) b.dealDamage(e, hit, { amount: e.s.atk * p.dust.atkScale, type: 'arts', applyWay: 'ranged', tags: ['lrtsiaDust'] });
    }
  };
  // EnemyLrtsiaCheckDamageBlocked: from a source at least the ring radius away, within `angle` deg behind a present
  // invisible mote (against its rotation); damage without a source is always cut. Form two checks ring one, then two.
  const shielded = (b, e, a, source) => {
    if (!a.rings?.length) return false;
    if (!source) return true;
    const d = Math.hypot(source.x - e.x, source.y - e.y), phi = wrap(Math.atan2(-(source.y - e.y), source.x - e.x));
    return a.rings.some(ring => d >= ring.radius - 1e-9 && ring.motes.some(m => !m.visible && b.time >= m.back
      && wrap(ring.clockwise ? phi - angleOf(b, ring, m) : angleOf(b, ring, m) - phi) <= a.shield.angle * DEG + 1e-9));
  };

  // --- Casts: one at a time, in order; each releases at its clip strike ---
  const enqueue = (a, kind) => { if (!a.queue.includes(kind) || kind === 'banish' || kind === 'forcedWeave') a.queue.push(kind); };
  const cancelCasts = (b, e, a) => { a.queue = []; a.cast = null; e.skillAnimUntil = b.time; };
  const castAnim = (a, kind) => kind === 'banish' ? p.banish.anim : kind === 'doom' ? p.doom[`p${a.form}`].anim
    : kind === 'forcedWeave' ? p.weave.p2.anim : p.weave[`p${a.form}`].anim;
  const release = (b, e, a, kind) => {
    if (kind === 'banish') {
      // SpawnLrcconTriggeredByHpLoss: ground operators within 1.5 whose tile has no cage.
      for (const u of b.allies()) if (operator(u) && !u.isFlying && Math.hypot(u.x - e.x, u.y - e.y) <= p.banish.radius + 1e-9) summonCocoon(b, ...tileOf(u));
    } else if (kind === 'doom') {
      // enemy_lrtsia[doom][core]: ModifyLifePoint by `value` (-100).
      if (Number.isFinite(b.life)) { b.life += p.doom[`p${a.form}`].value; if (b.life <= 0) b._finish?.('defeated'); }
    } else spreadCocoons(b);
  };
  const runCasts = (b, e, a, dt) => {
    if (!a.cast) {
      const kind = a.queue.shift();
      if (!kind) return;
      a.cast = { kind, elapsed: 0, released: false, anim: castAnim(a, kind) };
      if (kind === 'weave') a.weaveAt = b.time + p.weave[`p${a.form}`].cooldown; // the cooldown runs from the cast start
    }
    const c = a.cast;
    c.elapsed += dt;
    e.skillAnimUntil = b.time + Math.max(0, c.anim.dur - c.elapsed);
    if (!c.released && c.elapsed + 1e-9 >= c.anim.hit) { c.released = true; release(b, e, a, c.kind); }
    if (c.elapsed + 1e-9 >= c.anim.dur) a.cast = null;
  };

  // --- Forms ---
  const enterForm = (b, e, a, form) => {
    a.form = form; a.state = null; a.counter = 0; a.queue = []; a.cast = null;
    a.weaveAt = b.time + p.weave[`p${form}`].init;
    a.shield = form === 3 ? null : p.dust[`p${form}`];
    a.rings = a.shield ? makeRings(b, a.shield) : [];
  };
  const startRevive = (b, e, a, dur, phase) => {
    cancelCasts(b, e, a); a.rings = []; a.state = 'revive';
    e.hp = Math.min(1, e.s.maxHp);
    b.addBuff(e, { key: REVIVE, duration: dur, persist: true, visible: true,
      flags: { invulnerable: true, untargetable: true, unblockable: true, noMove: true } });
    phase(b, e, a);
  };

  return {
    spawn(b, e, a) {
      e.profile.noAttack = true; e.profile.cannotExit = false;
      b.addBuff(e, { key: 'enemy_lrtsia[immune]', persist: true, flags: { unblockable: true, noMove: true, selfBound: true, noDisplace: true } });
      enterForm(b, e, a, 1);
      a.lowHp = new Set();
      a.poll = b.every(p.lowHp.interval, () => {
        // SpawnLrccon: an operator at or below the HP ratio gets a cage on its tile, once per dip.
        if (!e.alive || a.form !== 1 || a.state) return;
        for (const u of b.allies()) {
          if (!u.alive || !u.deployed || u.kind === 'token' || u.kind === 'device') continue;
          if (u.hp / u.s.maxHp > p.lowHp.ratio) { a.lowHp.delete(u); continue; }
          if (a.lowHp.has(u)) continue;
          a.lowHp.add(u); summonCocoon(b, ...tileOf(u));
        }
      }, { owner: e });
    },
    hitIn(c, b, e, a) {
      if (a.state || !(c.dmg.amount > 0)) return;
      if (shielded(b, e, a, c.source)) { c.dmg.mul *= a.shield.scale; c.dmg.tags = [...(c.dmg.tags ?? []), 'lrtsiaShielded']; }
    },
    taken(c, b, e, a) {
      // hp_counter: damage taken, every `ratio` of max HP casts Banish (form one) or a forced Weave Cocoon (form two).
      if (a.state || a.form === 3 || !(c.amount > 0)) return;
      const ratio = a.form === 1 ? p.banish.ratio : p.weave.p2.ratio;
      a.counter += c.amount;
      while (a.counter + 1e-9 >= ratio * e.s.maxHp) { a.counter -= ratio * e.s.maxHp; enqueue(a, a.form === 1 ? 'banish' : 'forcedWeave'); }
    },
    killed(c, b, e, a) {
      if (a.state) return true;
      if (a.form === 1) {
        startRevive(b, e, a, p.revive1.dur, () => {
          b.after(p.revive1.healAt, () => { if (e.alive) e.hp = Math.max(e.hp, e.s.maxHp * p.revive1.hp); }, { owner: e });
          b.after(p.revive1.dur, () => {
            if (!e.alive) return;
            b.removeBuff(e, REVIVE);
            b.addBuff(e, { key: FORM2, persist: true, visible: true, mods: { hpPct: p.form2.hpPct, defFlat: p.form2.def, resFlat: p.form2.res } });
            b.stageWaveScheduler?.releaseCurrentWave(e);
            enterForm(b, e, a, 2);
          }, { owner: e });
        });
        return true;
      }
      if (a.form === 2) {
        startRevive(b, e, a, p.revive2.dur, () => {
          // enemy_lrtsia[block_wave_p3]: a scheduler-managed body holds the current wave.
          b.after(p.revive2.holdAt, () => {
            if (!e.alive) return;
            const holder = b.spawnEnemy(p.revive2.holder, { pos: tileOf(e), countInTotal: false });
            if (holder && b.stageWaveScheduler) b.stageWaveScheduler.track(holder);
            a.holder = holder;
          }, { owner: e });
          b.after(p.revive2.dur, () => {
            if (!e.alive) return;
            b.removeBuff(e, REVIVE);
            e.hp = Math.max(e.hp, e.s.maxHp * p.revive2.hp);
            b.addBuff(e, { key: FORM3, persist: true, visible: true, flags: { invulnerable: true } });
            enterForm(b, e, a, 3);
            b.after(p.win.delay, () => b._finish?.('cleared'), { owner: e });
          }, { owner: e });
        });
        return true;
      }
      return false;
    },
    tick(b, e, a, dt) {
      if (!e.alive) return;
      // CaptureSoul*: a Soul Maelstrom within reach heals her by its remaining HP and leaves (also while reviving).
      if (a.form !== 3) for (const soul of b.enemies) {
        if (!soul.alive || soul.defId !== SOUL || Math.hypot(soul.x - e.x, soul.y - e.y) > p.soul.radius + 1e-9) continue;
        const amount = soul.hp;
        b.kill(soul);
        e.hp = Math.min(e.s.maxHp, e.hp + amount);
      }
      if (a.state) return;
      dust(b, e, a);
      // Doom: enough cages on the field (forms one and two).
      const doom = p.doom[`p${a.form}`];
      if (doom && cocoonCount(b) >= doom.count && !a.queue.includes('doom') && a.cast?.kind !== 'doom') a.queue.unshift('doom');
      if (b.time + 1e-9 >= a.weaveAt && !a.queue.includes('weave') && a.cast?.kind !== 'weave') { enqueue(a, 'weave'); a.weaveAt = Infinity; }
      runCasts(b, e, a, dt);
    },
  };
}

function validate(p) {
  const pos = v => Number.isFinite(v) && v > 0, nn = v => Number.isFinite(v) && v >= 0;
  const anim = x => pos(x?.dur) && nn(x.hit) && x.hit <= x.dur;
  const ring = r => pos(r?.radius) && typeof r.clockwise === 'boolean' && pos(r.speed) && Number.isInteger(r.visible) && Number.isInteger(r.invisible)
    && pos(r.visibleCooldown) && pos(r.invisibleCooldown);
  const shield = s => Array.isArray(s?.rings) && s.rings.length > 0 && s.rings.every(ring) && s.scale >= 0 && s.scale <= 1 && pos(s.angle);
  const ok = pos(p?.dust?.collision) && pos(p.dust.atkScale) && shield(p.dust.p1) && shield(p.dust.p2) && pos(p.soul?.radius)
    && p.banish?.ratio > 0 && p.banish.ratio <= 1 && pos(p.banish.radius) && anim(p.banish.anim) && nn(p.lowHp?.ratio) && pos(p.lowHp.interval)
    && [1, 2, 3].every(i => nn(p.weave?.[`p${i}`]?.init) && nn(p.weave[`p${i}`].cooldown) && anim(p.weave[`p${i}`].anim)) && p.weave.p2.ratio > 0
    && [1, 2].every(i => Number.isInteger(p.doom?.[`p${i}`]?.count) && p.doom[`p${i}`].count > 0 && Number.isFinite(p.doom[`p${i}`].value) && anim(p.doom[`p${i}`].anim))
    && pos(p.revive1?.dur) && p.revive1.hp > 0 && p.revive1.hp <= 1 && nn(p.revive1.healAt) && p.revive1.healAt <= p.revive1.dur
    && nn(p.form2?.hpPct) && Number.isFinite(p.form2.def) && Number.isFinite(p.form2.res)
    && pos(p.revive2?.dur) && p.revive2.hp > 0 && p.revive2.hp <= 1 && nn(p.revive2.holdAt) && typeof p.revive2.holder === 'string' && pos(p.win?.delay);
  if (!ok) throw Error('Invalid Theresa parameters');
}
