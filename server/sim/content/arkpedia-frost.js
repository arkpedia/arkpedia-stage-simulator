// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-frost-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { canTargetEnemy } from '../targeting.js';
import { bodyInKeys } from '../body.js';
const ID = 'char_458_rfrost', TOKEN = 'token_10016_rfrost_mine';
const exists = u => u?.alive && u.deployed;
const live = u => exists(u) && !u.hidden;
const selectable = (u, e, p) => canTargetEnemy(u, e, p) && (!e.s.flags.camou || !!e.blockedBy);
const model = u => evidence.models[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const stateFor = (b, u) => {
  const state = b.regularSummons?.get(`summon:${ID}`);
  return state?.owner === u ? state : null;
};
function syncStock(b, u) {
  const state = stateFor(b, u), key = 'frost:stock-full';
  if (live(u) && state && state.stock >= state.record.stats.maxDeckStackCnt) {
    if (!u.findBuff(key)) b.addBuff(u, { key, flags: { noSp: true } });
  } else b.removeBuff(u, key);
}
function ordinary(b, u, p, e, info) {
  if (!selectable(u, e, p)) return;
  return b.addProjectile({ source: u, from: u, target: e, speed: 30, maxAge: 10,
    visual: 'arrow', data: { arkpediaTrackedVisual: true }, onHit: ({ target }) => {
      if (target && selectable(u, target, p)) resolveHit(b, u, p, target,
        { ...info, isProjectile: true }, target.x, target.y);
    } });
}
export function customizeFrostKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null;
  kit.trait = { attack: 'ranged', dmgType: 'phys', projectile: 'none', canHitFly: true,
    maxTargets: 1, maxTargetsByBlock: false, hitAllBlocked: false, hits: 1,
    hitsFn: null, dmgMul: null, splashRadius: 0, chain: null, rangeAoe: false,
    allInRange: false, install: null, retargetOnRelease: true, launchAttack: ordinary,
    canAttack: (_b, a) => !a.mem.frostBurst,
    attackVisual: 'Attack', windup: (_b, a) => model(a).hits.Attack[0] / (a.base.bat / a.s.interval) };
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
export function installFrost({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  b.on('tick', () => syncStock(b, u), { owner: u });
  b.on('death', ({ unit }) => { if (unit === u) b.removeBuff(u, 'frost:stock-full'); }, { owner: u });
}

// Native FireImmediately uses the literal Skill hit event for the first shot,
// then triggerDelta with waitAttackEventForAllAttacks=false. A new trap replaces
// an unfinished burst. Already released projectiles keep their own lifecycle.
function burst(b, u, target) {
  const p = { canHitFly: false };
  if (!live(u) || !u.canAct || u.s.flags.disarm || !selectable(u, target, p)
    || !bodyInKeys(target, u.rangeKeySet)) return;
  u.attackControlEpoch++; u.atkCd = u.s.interval;
  const cast = { seq: u.deploySeq, epoch: u.attackControlEpoch };
  u.mem.frostBurst = cast;
  const m = model(u), rate = Math.min(1, u.base.bat / u.s.interval);
  const delay = m.hits.Skill[0] / rate, bb = u.def.skill.bb;
  u.mem.regularFormVisual = { clip: 'Skill', loop: false, speed: rate };
  b._ev(['atk', u.id, target.id, 'none', { animation: 'Skill', windup: delay, projectile: 'tracked' }]);
  const finish = () => {
    if (u.mem.frostBurst !== cast) return;
    u.mem.frostBurst = null; u.mem.regularFormVisual = null;
  };
  for (let i = 0; i < bb.times; i++) b.after(delay + i * .05000000074505806, () => {
    if (u.mem.frostBurst !== cast) return;
    if (!live(u) || u.deploySeq !== cast.seq || u.attackControlEpoch !== cast.epoch
      || !u.canAct || u.s.flags.disarm) { finish(); return; }
    if (!selectable(u, target, p)) return;
    const info = { isSkill: true, isProjectile: true, attackId: ++b._attackSeq };
    b.addProjectile({ source: u, from: u, target, speed: 30, maxAge: 10,
      visual: 'arrow', data: { arkpediaTrackedVisual: true }, onHit: ({ target: e }) => {
        if (e && selectable(u, e, p)) b.dealDamage(u, e, {
          amount: u.s.atk * u.s.atkScaleMul * bb.atk_scale, type: 'phys',
          applyWay: 'ranged', isAttack: true, ...info });
      } });
    u.stats.attacks++; b.emit('attack', { attacker: u, targets: [target], ...info });
  }, { owner: u });
  b.after(m.durations.Skill / rate, finish, { owner: u });
}

/** Native one-use Welcome Mat. ATK transfer and same-frame action ordering are
 * explicitly bounded in retained evidence rather than claimed as frame parity. */
export function createFrostMat(b, state, row, col) {
  const u = state.owner, s = state.record.skill, bb = s?.bb, host = u.def.skill.bb;
  const second = s?.skillId === 'sktok_rfrost_2';
  if (state.record.id !== TOKEN || !bb || bb.cnt !== host.cnt || bb[second ? 'constraint' : 'stun'] !== host[second ? 'constraint' : 'stun']
    || bb.atk_scale !== (second ? host.trap_atk_scale : host.atk_scale)
    || second && (!Number.isSafeInteger(host.times) || host.times < 1))
    throw Error('Frost trap does not match its selected owner skill');
  const anim = evidence.tokenArtwork.models[TOKEN];
  const record = { ...state.record, stats: { ...state.record.stats, atk: u.s.atk * u.s.atkScaleMul } };
  const kit = { skill: null, trait: { noAttack: true, canAttack: () => false,
    dmgType: 'phys', attack: 'ranged', canHitFly: false }, install: (battle, t) => {
    t.kind = 'device'; t.deploymentSlotCost = 0;
    battle.addBuff(t, { key: 'frost:device', persist: true, allowDead: true,
      flags: { healFree: true, invulnerable: true, untargetable: true, noSp: true } });
    let born = Infinity, triggered = false, held = null;
    const visual = (clip, loop) => ({ clip, loop, die: 'Attack_End' });
    const dismiss = () => battle.retreat(t, { permanent: true, reason: 'frost-triggered' });
    battle.on('deploy', ({ unit }) => {
      if (unit !== t) return;
      born = battle.time + anim.durations.Start;
      t.mem.regularFormVisual = visual('Start', false);
    }, { owner: t });
    const watcher = battle.every(battle.dt, () => {
      if (!exists(t)) { watcher.cancel(); return; }
      if (!exists(u)) { battle.retreat(t, { permanent: true, reason: 'owner-removed' }); return; }
      if (held) {
        if (!live(held.target) || held.target.findBuff(held.key) !== held.buff) dismiss();
        return;
      }
      if (triggered || battle.time + 1e-9 < born) return;
      t.mem.regularFormVisual = visual('Idle', true);
      const targets = battle.enemies.filter(e => live(e) && selectable(t, e, { canHitFly: false })
        && bodyInKeys(e, t.rangeKeySet));
      targets.sort((a, z) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(z.x - t.x, z.y - t.y));
      const target = targets[0]; if (!target) return;
      triggered = true; t.mem.regularFormVisual = visual('Attack_Begin', false);
      const seq = t.deploySeq, epoch = t.attackControlEpoch;
      battle.after(anim.hits.Attack_Begin[0], () => {
        if (!exists(t) || !exists(u) || t.deploySeq !== seq) return;
        if (!t.canAct || t.attackControlEpoch !== epoch || !selectable(t, target, { canHitFly: false })) {
          dismiss(); return;
        }
        const info = { isSkill: true, isProjectile: false, attackId: ++battle._attackSeq };
        const key = `frost:trap:${t.id}`;
        battle.applyStatus(target, second ? 'root' : 'stun', { source: t, key, duration: bb[second ? 'constraint' : 'stun'] });
        const buff = target.findBuff(key);
        battle.dealDamage(t, target, { amount: record.stats.atk * bb.atk_scale,
          type: 'phys', applyWay: 'ranged', isAttack: true, ...info });
        t.stats.attacks++; battle.emit('attack', { attacker: t, targets: [target], ...info });
        if (second) burst(battle, u, target);
        if (buff && live(target)) {
          held = { target, key, buff }; t.mem.regularFormVisual = visual('Attack_Loop', true);
        } else dismiss();
      }, { owner: t });
    });
  } };
  return b.spawnToken(u, TOKEN, row, col, { dir: 'RIGHT', def: record, kit });
}
