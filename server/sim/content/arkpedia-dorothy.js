// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-dorothy-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { canTargetEnemy } from '../targeting.js';
import { bodyInKeys, bodyInRadius } from '../body.js';
const ID = 'char_4048_doroth', TOKEN = 'token_10025_doroth_recttp';
const exists = u => u?.alive && u.deployed;
const live = u => exists(u) && !u.hidden;
const selectable = (u, e, p = { canHitFly: false }) => live(e)
  && canTargetEnemy(u, e, p) && (!e.s.flags.camou || !!e.blockedBy);
const stateFor = (b, u) => {
  const state = b.regularSummons?.get(`summon:${ID}`);
  return state?.owner === u ? state : null;
};
const maxed = u => !!u.def.talents[1] && u.mem.dorothyStacks >= u.def.talents[1].bb.max_stack_cnt;
const attackClip = u => maxed(u) ? 'Attack_2' : 'Attack';
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
function syncStock(b, u) {
  const state = stateFor(b, u), key = 'dorothy:stock-full';
  if (live(u) && state && state.stock >= state.record.stats.maxDeckStackCnt) {
    if (!u.findBuff(key)) b.addBuff(u, { key, flags: { noSp: true } });
  } else b.removeBuff(u, key);
}
function ordinary(b, u, p, e, info) {
  if (!selectable(u, e, p)) return;
  return b.addProjectile({ source: u, from: u, target: e, speed: 10, maxAge: 10,
    visual: 'arrow', data: { arkpediaTrackedVisual: true }, onHit: ({ target }) => {
      if (target && selectable(u, target, p)) resolveHit(b, u, p, target,
        { ...info, isProjectile: true }, target.x, target.y);
    } });
}
function dreamer(b, u) {
  const bb = u.def.talents[1]?.bb;
  if (!exists(u) || !bb) return;
  u.mem.dorothyStacks = Math.min(bb.max_stack_cnt, (u.mem.dorothyStacks ?? 0) + 1);
  b.addBuff(u, { key: 'dorothy:dreamer', source: u,
    mods: { atkPct: bb.atk * u.mem.dorothyStacks } });
}
export function customizeDorothyKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null;
  kit.trait = { attack: 'ranged', dmgType: 'phys', projectile: 'none', canHitFly: true,
    maxTargets: 1, maxTargetsByBlock: false, hitAllBlocked: false, hits: 1,
    hitsFn: null, dmgMul: null, splashRadius: 0, chain: null, rangeAoe: false,
    allInRange: false, install: null, retargetOnRelease: true, launchAttack: ordinary,
    attackVisual: (_b, a) => attackClip(a), windup: (_b, a) => model(a).hits[attackClip(a)][0]
      / Math.min(1, a.base.bat / a.s.interval) };
  const s = def.skill;
  kit.skill = { id: s.id, name: s.name, kind: 'instant', trigger: 'SP_FULL',
    canActivate: () => { const state = stateFor(b, u);
      return !!(state && live(u) && state.stock < state.record.stats.maxDeckStackCnt); },
    onStart: () => { const state = stateFor(b, u);
      if (!state) return;
      state.stock = Math.min(state.record.stats.maxDeckStackCnt, state.stock + s.bb.cnt);
      syncStock(b, u);
    } };
  u.mem.summonSkillSync = () => syncStock(b, u);
}
export function installDorothy({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  b.on('deploy', ({ unit }) => {
    if (unit !== u) return;
    u.mem.dorothyStacks = 0;
    const state = stateFor(b, u), count = def.talents[0].bb['attack@max_cnt'];
    if (!state || !count) return;
    // Native SpawnTokens is random within range. Free traps neither spend DP
    // nor consume stored cards in this bounded contract; native accounting is
    // not frame certified. RefreshTokenCardCooldown starts the five-second clock.
    const choices = [...u.rangeKeySet].filter(key => {
      const row = Math.floor(key / 21), col = key % 21;
      return b.grid.inRect(row, col) && ['MELEE', 'ALL'].includes(b.grid.tile(row, col).build)
        && !b.allyUnits.some(a => exists(a) && a.tileR === row && a.tileC === col)
        && !b.enemies.some(e => exists(e) && e.motion !== 'FLY'
          && Math.round(e.y) === row && Math.round(e.x) === col);
    });
    for (let i = 0; i < count && choices.length; i++) {
      const key = choices.splice(Math.floor(b.rng() * choices.length), 1)[0];
      const t = createDorothyResonator(b, state, Math.floor(key / 21), key % 21);
      if (t) { t.mem.regularSummonCard = state.key; state.readyAt = b.time + state.record.stats.respawnTime; }
    }
  }, { owner: u });
  b.on('tick', () => {
    syncStock(b, u);
    // Attack visuals retain the clip chosen at launch. The idle mode changes
    // independently once the native Dreamer stack limit has been reached.
    if (maxed(u)) u.mem.regularFormVisual = { clip: 'Idle_2', loop: true };
  }, { owner: u });
  b.on('death', ({ unit }) => {
    if (unit !== u) return;
    b.removeBuff(u, 'dorothy:stock-full'); b.removeBuff(u, 'dorothy:dreamer');
    u.mem.regularFormVisual = null;
  }, { owner: u });
}

/** Native Resonator, with explicit bounded dispatch: explosion on its first
 * OnAttack, S3 neighbour marking on the second, one pending 2s table interval.
 * Placement samples owner ATK. These choices are not Unity frame parity. */
export function createDorothyResonator(b, state, row, col) {
  const u = state.owner, s = state.record.skill, bb = s?.bb;
  if (state.record.id !== TOKEN || !bb || Object.keys(bb).some(k => bb[k] !== u.def.skill.bb[k]))
    throw Error('Dorothy Resonator does not match its selected owner skill');
  const variant = Number(s.skillId.at(-1)), anim = evidence.tokenModels[TOKEN].front;
  const record = { ...state.record, stats: { ...state.record.stats, atk: u.s.atk * u.s.atkScaleMul } };
  const kit = { skill: null, trait: { noAttack: true, canAttack: () => false,
    dmgType: 'phys', attack: 'ranged', canHitFly: false },
    install: (battle, t) => {
      t.kind = 'device'; t.deploymentSlotCost = 0;
      battle.addBuff(t, { key: 'dorothy:device', persist: true, allowDead: true,
        flags: { healFree: true, invulnerable: true, untargetable: true, noSp: true } });
      let armedAt = Infinity, triggered = false, pending = null;
      const cross = new Set((s.rangeGrid ?? []).map(([r, c]) => (row + r) * 21 + col + c));
      const valid = () => exists(t) && exists(u);
      const trigger = target => {
        if (!valid() || triggered || battle.time + 1e-9 < armedAt) return false;
        triggered = true; pending?.cancel(); pending = null;
        t.mem.dorothyChainAt = null; t.mem.regularFormVisual = { clip: 'Attack', loop: false, die: 'Die' };
        dreamer(battle, u); // native withdraw-buff start, even if the victim later disappears
        const impact = () => {
          if (!valid()) return;
          const victims = variant === 1 ? (target && selectable(t, target) ? [target] : [])
            : battle.enemies.filter(e => selectable(t, e) && (variant === 2
              ? bodyInRadius(e, t.x, t.y, 1.2000000476837158) : bodyInKeys(e, cross)));
          const info = { isSkill: true, isProjectile: false, attackId: ++battle._attackSeq };
          for (const e of victims) {
            // Control/debuff before damage is a bounded intra-frame convention.
            if (variant === 1) battle.addBuff(e, { key: 'dorothy:def-down', source: t,
              duration: bb.duration, mods: { defPct: bb.def } });
            else if (variant === 2) battle.applyStatus(e, 'root', { source: t,
              duration: victims.length === 1 ? bb.duration_2 : bb.duration });
            else battle.applyStatus(e, 'sluggish', { source: t, duration: bb.sluggish });
            battle.dealDamage(t, e, { amount: record.stats.atk * bb.atk_scale,
              type: variant === 3 ? 'arts' : 'phys', applyWay: 'ranged', isAttack: true, ...info });
          }
          t.stats.attacks++; battle.emit('attack', { attacker: t, targets: victims, ...info });
        };
        const first = anim.eventPayloads.Attack[0].time, last = anim.eventPayloads.Attack[1].time;
        battle.after(first, impact, { owner: t });
        battle.after(last, () => {
          if (!valid()) return;
          if (variant === 3) for (const neighbour of battle.allyUnits) {
            if (neighbour !== t && neighbour.defId === TOKEN && neighbour.ownerUnit === u
              && exists(neighbour) && bodyInKeys(neighbour, cross)) neighbour.mem.dorothyChain?.(bb.interval);
          }
          battle.retreat(t, { permanent: true, reason: 'dorothy-triggered' });
        }, { owner: t });
        return true;
      };
      t.mem.dorothyChain = interval => {
        if (!valid() || triggered) return;
        // Native DEFAULT/non-stack trigger buff: repeated marks refresh one
        // countdown, never add explosions. Parent removal does not cancel it.
        pending?.cancel(); t.mem.dorothyChainAt = battle.time + interval;
        pending = battle.after(interval, () => { pending = null; trigger(null); }, { owner: t });
      };
      battle.on('deploy', ({ unit }) => {
        if (unit !== t) return;
        armedAt = battle.time + anim.durations.Start;
        t.mem.regularFormVisual = { clip: 'Start', loop: false, die: 'Die' };
      }, { owner: t });
      const watcher = battle.every(battle.dt, () => {
        if (!exists(t)) { pending?.cancel(); watcher.cancel(); return; }
        if (!exists(u)) { battle.retreat(t, { permanent: true, reason: 'owner-removed' }); return; }
        if (triggered || battle.time + 1e-9 < armedAt) return;
        t.mem.regularFormVisual = { clip: 'Idle', loop: true, die: 'Die' };
        const targets = battle.enemies.filter(e => selectable(t, e) && bodyInKeys(e, t.rangeKeySet));
        targets.sort((a, z) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(z.x - t.x, z.y - t.y));
        if (targets[0]) trigger(targets[0]);
      });
    } };
  return b.spawnToken(u, TOKEN, row, col, { dir: 'RIGHT', def: record, kit });
}
