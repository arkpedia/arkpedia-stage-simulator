// SPDX-License-Identifier: GPL-3.0-or-later
// 12-20's 'Damazti Cluster' (enemy_1542_wdslm) and its Isomorphic Fragments (_2, _3), the decoy fragment (_4) and the
// Deconstructed Distortion (enemy_1323_wdbshd). Every number arrives in `p` from shared/arkpedia/enemy-damazti-features.js,
// which also documents the native evidence and the PRTS readings behind each rule.
//
// The host and the fragments are one group (standRegisterList):
// - while any member is still disguised (identification not complete), every member is INVINCIBLE (invincibleStack);
// - each hit on a member sets every other member to its HP ratio (splitDamage), so a hit on any body drains the pool;
// - every member takes (1 - resistance x live fragments) Physical and Arts damage (reduceDamage, additive);
// - a member reaching 0 HP knocks the others out with it (syncReborn): in the first form each revives for 30 s; with no
//   revive left (and on any other finish: a leak) the rest of the group finishes with it (killAll, skipReborn).
import { norportIdentity } from './arkpedia-enemy-norport-identity.js';
import { setForm, rebirthCleanse } from './arkpedia-enemy-forms.js';
import { aggroCmp, canTargetAlly } from '../targeting.js';
import { PROFESSION_BITS } from '../../../shared/arkpedia/stage-card-rules.js';

const GROUP_INV = 'enemy_wdslm[invincibleStack]', SUMMON_INV = 'enemy_wdslm[summonInvincible]', HALF_INV = 'enemy_wdslm[P2halfHpInvincible]',
  REBORN_INV = 'enemy_wdslm[rebornInvincible]', REDUCE = 'enemy_wdslm[reduceDamage]', IMMUNE = 'enemy_wdslm[immune]',
  REBORN = 'ab:wdslmReborn', CAST = 'ab:wdslmCast', MARK = 'enemy_wdslm[dieAndSummon]', DECOY = 'enemy_wdslmFakeSTD[Invincible]',
  LOSS = 'enemy_wdsdw[loss_hp]';
const OPERATOR_MASK = 639; // every operator class; no tokens, no traps
const live = u => !!u?.alive && !u.hidden && u.deployed !== false;
const tileOf = u => [Math.round(u.y), Math.round(u.x)];
const DISGUISED = new Set(['disguised', 'switching']);

const groupMembers = g => [...g.members].filter(u => u.alive);
const formOf = u => u.mem.damazti?.form;

/** Group state shared by every member (it lives on the host; fragments hold a reference). */
function refreshGroup(b, g) {
  const alive = groupMembers(g);
  const disguised = alive.some(u => DISGUISED.has(formOf(u)));
  const fragments = alive.filter(u => u !== g.host).length;
  const mul = Math.max(0, 1 - g.resistance * fragments);
  const half = b.time < g.halfInvUntil - 1e-9;
  for (const u of alive) {
    if (disguised) { if (!u.findBuff(GROUP_INV)) b.addBuff(u, { key: GROUP_INV, persist: true, visible: true, flags: { invulnerable: true } }); }
    else b.removeBuff(u, GROUP_INV);
    if (half) { if (!u.findBuff(HALF_INV)) b.addBuff(u, { key: HALF_INV, persist: true, visible: true, flags: { invulnerable: true } }); }
    else b.removeBuff(u, HALF_INV);
    const cur = u.findBuff(REDUCE);
    if (cur?.data?.n === fragments) continue;
    if (cur) b.removeBuff(u, REDUCE);
    if (fragments) b.addBuff(u, { key: REDUCE, persist: true, visible: true, data: { n: fragments }, mods: { physTakenMul: mul, artsTakenMul: mul } });
  }
}

export function damaztiCluster(p) {
  validate(p);
  const host = p.role === 'host';
  const identity = p.identity ? norportIdentity({ ...p.identity, kind: 'spy', handoff: true }, { onReveal: (b, e) => enterFirst(b, e, e.mem.damazti) }) : null;

  // --- casts (sync attack, Lifeline Burst): held in place and disarmed for the clip ---
  const finishCast = (b, e, a) => {
    if (!a.cast) return;
    a.cast = null; e.skillAnimUntil = b.time; b.removeBuff(e, CAST);
    e.profile.noAttack = a.form !== 'p1' && a.form !== 'p2';
  };
  const startCast = (b, e, a, cast) => {
    finishCast(b, e, a);
    a.casts = (a.casts ?? 0) + 1;
    a.cast = { elapsed: 0, released: false, n: a.casts, ...cast };
    e.profile.noAttack = true; e.skillAnimUntil = b.time + cast.dur; e.atkCd = Math.max(e.atkCd ?? 0, 0);
    b.addBuff(e, { key: CAST, persist: true, flags: { noMove: true, disarm: true } });
  };

  // Sync attack (次生迭代): one ally anywhere, blocking ignored; taunt first, then the latest deployed.
  const syncTarget = (b, e) => b.allies().filter(u => live(u) && !u.isFlying && canTargetAlly(e, u, true))
    .sort((x, y) => aggroCmp(x, y))[0] ?? null;
  const startSync = (b, e, a, form) => {
    const target = syncTarget(b, e);
    if (!target) return false;
    const s = form === 'p1' ? p.sync.p1 : p.sync.p2;
    startCast(b, e, a, { kind: 'sync', clip: p.clips.sync, dur: s.dur, hit: s.hit, release: (b2, e2) => {
      if (live(target)) b2.dealDamage(e2, target, { amount: e2.s.atk * s.scale, type: 'phys', isSkill: true, applyWay: 'ranged', tags: ['wdslmSync'] });
    } });
    return true;
  };

  // Lifeline Burst (命脉勃发): the tile of every ally on the field is locked at the cast start; at OnAttack each lock hits
  // its tile and the 4 adjacent ones (every ally there) and summons a Distortion on it.
  const burstTargets = b => b.allies().filter(u => live(u) && u.kind !== 'device' && !u.isFlying
    && !u.s.flags.untargetable && !u.s.flags.stealth && !u.s.flags.camou);
  const startBurst = (b, e, a) => {
    if (!p.burst.lock) { startCast(b, e, a, { kind: 'burst', clip: p.clips.burst, dur: p.burst.dur, hit: Infinity }); return true; }
    const tiles = [...new Map(burstTargets(b).map(u => { const t = tileOf(u); return [t.join(), t]; })).values()];
    if (!tiles.length) return false;
    for (const [r, c] of tiles) b.fx?.('telegraph', { x: c, y: r, r: 1, dur: p.burst.hit, kind: 'wdslmLifeline' });
    startCast(b, e, a, { kind: 'burst', clip: p.clips.burst, dur: p.burst.dur, hit: p.burst.hit, release: (b2, e2) => {
      for (const [r, c] of tiles) {
        const area = new Set(p.burst.area.map(([dr, dc]) => `${r + dr},${c + dc}`));
        for (const u of b2.allies()) if (live(u) && u.kind !== 'device' && area.has(tileOf(u).join()))
          b2.dealDamage(e2, u, { amount: p.burst.damage, type: 'arts', isSkill: true, applyWay: 'none', tags: ['wdslmLifeline'] });
        // "以自身路径": the Distortion takes the host's own route from the locked tile, flying.
        const end = e2.route?.legs?.at(-1) ?? null;
        b2.spawnEnemy(p.burst.summon, { pos: [r, c], route: { motion: 'FLY', start: [r, c], end: end ? [end.r, end.c] : [r, c] },
          countInTotal: false, ownerPlayerId: e2.ownerId });
      }
    } });
    return true;
  };
  // The host's casts force every fragment that has the same skill in its current form (interrupting it).
  const forceStands = (b, e, kind, form) => {
    const g = e.mem.damaztiGroup;
    if (!g) return;
    for (const u of groupMembers(g)) {
      const s = u.mem.damazti;
      if (u === e || !s || s.form !== form || !e.alive) continue;
      if (kind === 'sync') s.forceSync(b, u, form); else s.forceBurst(b, u);
    }
  };

  // --- forms ---
  function enterFirst(b, e, a) {
    a.form = 'p1';
    e.profile.noAttack = false; e.atkCd = 0;
    e.def = { ...e.def, attackAnim: p.attack };
    a.left = { sync: p.sync.p1.initial };
    if (e.mem.damaztiGroup) refreshGroup(b, e.mem.damaztiGroup);
  }
  function enterReborn(b, e, a) {
    finishCast(b, e, a);
    a.form = 'reborn'; a.rebornAt = b.time; a.dotAt = b.time + p.reborn.first;
    rebirthCleanse(b, e);
    for (const k of [SUMMON_INV, GROUP_INV, HALF_INV]) b.removeBuff(e, k);
    e.hp = Math.min(1, e.s.maxHp); e.profile.noAttack = true;
    b.addBuff(e, { key: REBORN, persist: true, visible: true, flags: { invulnerable: true, untargetable: true, unblockable: true, noMove: true } });
    b._unblock?.(e);
    setForm(b, e, 'reborn', 'telegraph', { r: p.reborn.radius, dur: p.reborn.duration, kind: 'reborn' });
  }
  function enterSecond(b, e, a) {
    a.form = 'p2';
    b.removeBuff(e, REBORN);
    e.hp = e.s.maxHp * p.reborn.hpRatio;
    e.profile.noAttack = false; e.atkCd = 0;
    if (e.route) e.route.pts = null;
    b.addBuff(e, { key: REBORN_INV, duration: p.reborn.invincible, visible: true, flags: { invulnerable: true } });
    a.left = { sync: p.sync.p2.initial, burst: p.burst.initial };
    setForm(b, e, 'form2', 'revive', { kind: 'reborn' });
    // The host's revive carries finish_current_wave_when_buff_finish: the wave is released when it ends (PRTS).
    if (host) b.stageWaveScheduler?.releaseCurrentWave(e);
    if (e.mem.damaztiGroup) refreshGroup(b, e.mem.damaztiGroup);
  }

  // --- the half-HP summon (潜伏解除, second form, once) ---
  const standsAlone = (b, op) => !b.allies().some(u => u !== op && live(u) && u.kind === 'op'
    && Math.abs(Math.round(u.y) - Math.round(op.y)) <= 1 && Math.abs(Math.round(u.x) - Math.round(op.x)) <= 1);
  const markTarget = (b, e) => b.allies().filter(u => u.kind === 'op' && live(u) && canTargetAlly(e, u, true)
    && (OPERATOR_MASK & (PROFESSION_BITS[u.def.profession ?? u.def.raw?.profession] ?? 0)) !== 0)
    .sort((x, y) => (standsAlone(b, y) ? 1 : 0) - (standsAlone(b, x) ? 1 : 0) || y.id - x.id)[0] ?? null;
  const mark = (b, e, a, op) => {
    const g = e.mem.damaztiGroup;
    a.halfDone = true; a.halfFlag = false;
    if (g) { g.halfInvUntil = b.time + p.half.invincible; refreshGroup(b, g); }
    const m = { op, tile: tileOf(op), done: false };
    b.addBuff(op, { key: MARK, duration: p.half.mark, visible: true });
    const finish = () => {
      if (m.done) return; m.done = true; b.off?.(watch);
      // CreateDeckBuff UNDEPLOYABLE (ALL_THE_TIME): the card is gone for the battle, whichever way the operator left.
      const entry = b.bench?.[op.defId];
      if (entry) { entry.removedFromDeck = true; entry.readyAt = Infinity; }
      op.mem.regularCardRemoved = true;
      b.spawnEnemy(p.half.decoy, { pos: m.tile, route: { motion: 'FLY', start: m.tile, end: m.tile, steps: [{ t: 'wait', s: 99999 }] },
        countInTotal: false, ownerPlayerId: e.ownerId });
      if (op.alive) b.kill(op, null);
    };
    const watch = b.on('tick', () => { if (op.alive) m.tile = tileOf(op); else finish(); });
    b.after(p.half.mark, finish);
  };

  // --- the group ---
  const killGroup = (b, e, revive) => {
    const g = e.mem.damaztiGroup;
    if (!g || g.syncing) return;
    g.syncing = true;
    try {
      for (const u of groupMembers(g)) {
        if (u === e || (revive && formOf(u) === 'reborn')) continue;
        // skipReborn: a member already in its revive is finished as well.
        if (!revive) u.mem.damaztiNoReborn = true;
        b.kill(u, null);
      }
    } finally { g.syncing = false; }
  };

  return {
    spawn(b, e, a) {
      e.mem.damazti = a;
      a.damazti = true; a.role = p.role; a.form = identity ? 'disguised' : 'p2'; a.cast = null; a.casts = 0;
      a.halfDone = false; a.halfFlag = false; a.summoned = false; a.left = {};
      a.forceSync = (b2, u, form) => { if (u.alive && formOf(u) === form) startSync(b2, u, a, form); };
      a.forceBurst = (b2, u) => { if (u.alive && formOf(u) === 'p2') startBurst(b2, u, a); };
      // Immune: UNBALANCE_IMMUNE plus the record's immunities and Disarm (PRTS: 失衡免疫，缴械免疫).
      e.def = { ...e.def, immune: new Set([...(e.def.immune ?? []), 'disarm']) };
      b.addBuff(e, { key: IMMUNE, persist: true, flags: { noDisplace: true } });
      if (host) e.mem.damaztiGroup = { host: e, members: new Set([e]), resistance: p.resistance, halfInvUntil: -Infinity, syncing: false };
      else {
        // registerSelf: join the live host (found by its id) and take its HP ratio.
        const h = b.enemies.find(u => u.alive && u.mem.damaztiGroup?.host === u);
        if (h) {
          const g = h.mem.damaztiGroup; g.members.add(e); e.mem.damaztiGroup = g;
          if (h.hp > 0 && formOf(h) !== 'reborn') e.hp = e.s.maxHp * h.hp / h.s.maxHp;
        }
      }
      if (identity) { a.ident = {}; identity.spawn(b, e, a.ident); }
      else { e.profile.noAttack = false; e.def = { ...e.def, attackAnim: p.attack }; a.left = { sync: Infinity, burst: Infinity }; }
      if (e.mem.damaztiGroup) refreshGroup(b, e.mem.damaztiGroup);
      e.mem.regularFormVisual = visual(b, e, a);
    },
    tick(b, e, a, dt) {
      if (!e.alive) return;
      const g = e.mem.damaztiGroup;
      if (DISGUISED.has(a.form)) {
        const before = a.ident.state;
        identity.tick(b, e, a.ident, dt);
        if (a.ident.state === 'switching') a.form = 'switching';
        if (before !== a.ident.state && g) refreshGroup(b, g);
        if (DISGUISED.has(a.form)) return;
      }
      if (host && g) refreshGroup(b, g);
      if (a.form === 'reborn') {
        if (b.time + 1e-9 >= a.dotAt) {
          a.dotAt += p.reborn.interval;
          // auraDotDamage: 100 sourceless Arts every second to each selectable ally within the radius (not while
          // that ally is camouflaged or invisible).
          for (const u of b.allies()) if (live(u) && u.kind !== 'device' && !u.s.flags.untargetable && !u.s.flags.stealth && !u.s.flags.camou
            && Math.hypot(u.x - e.x, u.y - e.y) <= p.reborn.radius + 1e-9)
            b.dealDamage(e, u, { amount: p.reborn.dot, type: 'arts', sourceless: true, applyWay: 'none', tags: ['wdslmRebornDot'] });
        }
        if (b.time + 1e-9 >= a.rebornAt + p.reborn.duration) enterSecond(b, e, a);
        e.mem.regularFormVisual = visual(b, e, a);
        return;
      }
      // Skill cooldowns run from the cast start, through other casts.
      if (host) for (const k of Object.keys(a.left)) a.left[k] -= dt;
      if (a.cast) {
        const c = a.cast;
        c.elapsed += dt * e.s.slowDownRate;
        if (!c.released && c.elapsed + 1e-9 >= c.hit) { c.released = true; c.release?.(b, e, a); }
        e.skillAnimUntil = b.time + Math.max(0, c.dur - c.elapsed);
        if (c.elapsed + 1e-9 >= c.dur) finishCast(b, e, a);
        e.mem.regularFormVisual = visual(b, e, a);
        return;
      }
      if (host) {
        // P2HPRatioChecker (every 0.1 s, second form): below the ratio once, the half-HP summon arms.
        if (a.form === 'p2' && !a.halfDone && e.hp / e.s.maxHp < p.half.ratio - 1e-12) a.halfFlag = true;
        if (e.canAct) {
          if (a.form === 'p2' && a.halfFlag) {
            const op = markTarget(b, e);
            if (op) mark(b, e, a, op);
          } else if (a.form === 'p2' && a.left.burst <= 1e-9 && burstTargets(b).length) {
            a.left.burst = p.burst.cooldown; startBurst(b, e, a); forceStands(b, e, 'burst', 'p2');
          } else if (a.left.sync <= 1e-9 && syncTarget(b, e)) {
            const s = a.form === 'p1' ? p.sync.p1 : p.sync.p2;
            a.left.sync = s.cooldown; startSync(b, e, a, a.form); forceStands(b, e, 'sync', a.form);
          }
        }
      }
      e.mem.regularFormVisual = visual(b, e, a);
    },
    taken(c, b, e, a) {
      const g = e.mem.damaztiGroup;
      if (!e.alive || !(e.hp > 0) || a.form === 'reborn') return;
      // splitDamage: every other member takes this member's HP ratio.
      if (g && !g.syncing) {
        const ratio = e.hp / e.s.maxHp;
        for (const u of groupMembers(g)) if (u !== e && formOf(u) !== 'reborn' && u.hp > 0) u.hp = u.s.maxHp * ratio;
      }
      // P1SummonStand: the first time the host's HP falls below the ratio in the first form, the branch's fragment
      // arrives on its preset route and the whole group is INVINCIBLE for a moment.
      if (host && a.form === 'p1' && !a.summoned && e.hp / e.s.maxHp < p.summon.ratio - 1e-12) {
        a.summoned = true;
        const s = b.stageBranches?.branches?.[p.summon.branch] ? b.stageBranches.summon(p.summon.branch, p.summon.action) : null;
        for (const u of g ? groupMembers(g) : [e]) b.addBuff(u, { key: SUMMON_INV, duration: p.summon.invincible, visible: true, flags: { invulnerable: true } });
        if (s && g) refreshGroup(b, g);
      }
    },
    killed(c, b, e, a) {
      if (e.mem.damaztiNoReborn || !p.reborn.available || a.form !== 'p1' || a.reborn) return false;
      // syncReborn: the first knock-out takes the whole group into its revive.
      a.reborn = true;
      enterReborn(b, e, a);
      killGroup(b, e, true);
      return true;
    },
    death(c, b, e, a) {
      finishCast(b, e, a);
      const g = e.mem.damaztiGroup;
      if (!g) return;
      // killAll: a finished member (killed for good, or leaked) takes the rest of the group with it, without revives.
      killGroup(b, e, false);
      g.members.delete(e);
      refreshGroup(b, g);
    },
  };

  function visual(b, e, a) {
    if (DISGUISED.has(a.form)) return e.mem.regularFormVisual;
    if (a.form === 'reborn') {
      const t = b.time - a.rebornAt, left = a.rebornAt + p.reborn.duration - b.time;
      const clip = t < p.clips.rebornBegin ? '2_Die_Begin' : left <= p.clips.rebornEnd ? '2_Die_End' : '2_Die_Loop';
      return { clip, loop: clip === '2_Die_Loop', playId: `${clip}:${e.id}:${a.rebornAt}`, die: '2_Die_2' };
    }
    if (a.cast) return { clip: a.cast.clip, loop: false, playId: `${a.cast.clip}:${e.id}:${a.cast.n}`, die: '2_Die_2' };
    return { clip: e.moving ? '2_Move' : '2_Idle', move: '2_Move', attack: '2_Attack', die: '2_Die_2', loop: true, replace: true };
  }
}

/** The decoy fragment (_4, PRTS 同构碎片3): invincible, motionless, no attack; `p.delay` s after it appears the
 * branch's fragment (_3) comes on its preset route if a host still lives, then it leaves. */
export function damaztiDecoy(p) {
  if (!p || !(p.delay > 0) || typeof p.branch !== 'string' || !Number.isInteger(p.action) || typeof p.host !== 'string') throw Error('Invalid decoy parameters');
  return {
    spawn(b, e, a) {
      e.profile.noAttack = true;
      b.addBuff(e, { key: DECOY, persist: true, visible: true, flags: { invulnerable: true, noMove: true, noDisplace: true } });
      e.mem.regularFormVisual = { clip: '2_Idle', move: '2_Idle', die: '2_Die_Begin', loop: true, replace: true };
      b.after(p.delay, () => {
        if (!e.alive) return;
        if (b.enemies.some(u => u.alive && u.defId === p.host) && b.stageBranches?.branches?.[p.branch]) b.stageBranches.summon(p.branch, p.action);
        b.kill(e, null);
      }, { owner: e });
    },
  };
}

/** The Deconstructed Distortion: loses `p.loss` HP every second (PURE, first after 1 s). Its Corrosion comes from the
 * stage rune (apply_elemental_damage), not from the enemy. */
export function distortionDecay(p) {
  if (!p || !(p.loss > 0) || !(p.interval > 0)) throw Error('Invalid Distortion parameters');
  return {
    spawn(b, e, a) { a.lossAt = b.time + p.interval; },
    tick(b, e, a) {
      while (e.alive && b.time + 1e-9 >= a.lossAt) {
        a.lossAt += p.interval;
        b.dealDamage(e, e, { amount: p.loss, type: 'true', canDodge: false, applyWay: 'none', tags: [LOSS] });
      }
    },
  };
}

function validate(p) {
  const pos = v => Number.isFinite(v) && v > 0, nn = v => Number.isFinite(v) && v >= 0;
  const clip = c => pos(c?.dur) && nn(c.hit) && c.hit <= c.dur;
  // A fragment's skills only run when the host forces them (cooldown 0 in its record).
  const sync = s => clip(s) && pos(s.scale) && (p?.role === 'host' ? pos(s.cooldown) : s.cooldown === 0) && nn(s.initial);
  const ok = ['host', 'stand'].includes(p?.role) && pos(p.resistance) && p.resistance < 1 && clip(p.attack)
    && sync(p.sync?.p1) && sync(p.sync.p2) && pos(p.burst?.dur) && typeof p.burst.lock === 'boolean'
    && (!p.burst.lock || (clip({ dur: p.burst.dur, hit: p.burst.hit }) && pos(p.burst.damage) && pos(p.burst.cooldown) && nn(p.burst.initial)
      && Array.isArray(p.burst.area) && p.burst.area.length === 5 && typeof p.burst.summon === 'string'))
    && typeof p.reborn?.available === 'boolean'
    && (!p.reborn.available || (pos(p.reborn.duration) && pos(p.reborn.dot) && pos(p.reborn.radius) && pos(p.reborn.interval)
      && nn(p.reborn.first) && pos(p.reborn.invincible) && p.reborn.hpRatio > 0 && p.reborn.hpRatio <= 1))
    && (p.role !== 'host' || (pos(p.summon?.ratio) && p.summon.ratio < 1 && typeof p.summon.branch === 'string' && Number.isInteger(p.summon.action)
      && pos(p.summon.invincible) && pos(p.half?.ratio) && p.half.ratio < 1 && pos(p.half.mark) && pos(p.half.invincible) && typeof p.half.decoy === 'string'))
    && (p.identity == null || (pos(p.identity.switchDur) && !!p.identity.detect && !!p.identity.clips))
    && pos(p.clips?.rebornBegin) && pos(p.clips.rebornEnd) && typeof p.clips.sync === 'string' && typeof p.clips.burst === 'string';
  if (!ok) throw Error('Invalid Damazti Cluster parameters');
}
