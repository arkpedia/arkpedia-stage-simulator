// SPDX-License-Identifier: GPL-3.0-or-later
// Original objects, all source ranks and native event/facing bytes are retained
// in data/arkpedia-sand-reckoner-prefabs.json. Compiled frame order is unverified.
import evidence from '../../../data/arkpedia-sand-reckoner-prefabs.json' with { type: 'json' };

const ID = 'char_4140_lasher', TOKEN = 'token_10036_lasher_mcbird';
const live = u => u?.alive && u.deployed && !u.hidden;
const own = (b, u) => b.allyUnits.filter(t => t.ownerUnit === u && t.defId === TOKEN && t.alive && t.deployed);
const model = u => evidence.models[u.defId][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const mode = u => u.defId === ID ? u.skill.active ? Number(u.skill.id.at(-1)) : 0 : u.mem.lasherMode ?? 0;
const clip = u => u.defId === TOKEN ? mode(u) === 2 ? 'Skill' : 'Attack'
  : mode(u) ? `Skill_${mode(u)}_Loop` : 'Attack';
const rate = u => Math.min(1, model(u).durations[clip(u)] / u.s.interval);
const key = u => `lasher:mode:${u.id}`;

function sync(b, u) {
  for (const t of own(b, u)) {
    const selected = live(u) && live(t) && !t.s.flags.untargetable && b.allySelectable(t, u) ? mode(u) : 0;
    const old = t.mem.lasherMode ?? 0;
    if (selected !== old) {
      b.removeBuff(t, key(u));
      t.mem.lasherMode = selected;
      if (selected) b.addBuff(t, { key: key(u), source: u,
        mods: selected === 1 ? { aspd: u.skill.bb.attack_speed } : { atkPct: u.skill.bb.atk } });
      // Native S2 switch_mode_restart_fsm discards the old attack phase.
      if (selected === 2 || old === 2) {
        t.mem.lasherAttackEpoch = (t.mem.lasherAttackEpoch ?? 0) + 1;
        t.atkCd = 0;
      }
    }
    t.profile.priority = selected === 2 ? 'heaviest' : null;
  }
}

function installMachineBonus(b, unit, value) {
  b.on('outputDamage', ({ source, target, dmg }) => {
    if (source === unit && target?.tags?.has('machine') && ['phys', 'arts'].includes(dmg.type))
      dmg.mul *= value;
  }, { owner: unit });
}

function launch(b, u, _profile, target, info) {
  const selected = mode(u), slow = u.defId === TOKEN && selected === 2 ? u.ownerUnit.skill.bb.sluggish : 0;
  const hit = victim => {
    if (!victim?.alive) return;
    b.dealDamage(u, victim, { amount: u.s.atk * u.s.atkScaleMul, type: 'arts',
      isAttack: true, isSkill: selected !== 0, isProjectile: u.defId === TOKEN || selected !== 0,
      applyWay: 'ranged', attackId: info.attackId });
    // Sluggish belongs to the emitted S2 token projectile, so an in-flight
    // round retains its selected debuff after its summoner's skill ends.
    if (slow && victim.alive) b.applyStatus(victim, 'sluggish', { source: u, duration: slow });
  };
  if (u.defId === ID && !selected) hit(target); // native normal attack has no projectile
  else b.addProjectile({ from: u, target, source: u, speed: 10, visual: 'bolt',
    data: { arkpediaTrackedVisual: true }, onHit: ({ target: victim }) => hit(victim) });
}

function trait() {
  return { attack: 'ranged', dmgType: 'arts', projectile: 'bolt', projectileSpeed: 10,
    canHitFly: true, maxTargets: 1, hitAllBlocked: false, hits: 1, install: null,
    retargetOnRelease: false, interruptOnSkillChange: true, launchAttack: launch,
    attackVisual: (_b, u) => clip(u),
    windup: (_b, u) => model(u).hits[clip(u)][0] / rate(u) };
}

function transition(b, u, ending = false) {
  const selected = Number(u.skill.id.at(-1)), name = `Skill_${selected}_${ending ? 'End' : 'Begin'}`;
  const duration = model(u).durations[name], seq = u.deploySeq, activation = u.skill.activations;
  u.mem.regularFormVisual = { clip: name, loop: false };
  b.addBuff(u, { key: 'lasher:transition', duration, flags: { disarm: true } });
  b.after(duration, () => {
    if (u.deploySeq === seq && u.skill.activations === activation)
      u.mem.regularFormVisual = ending ? null : { clip: `Skill_${selected}_Idle`, loop: true };
  }, { owner: u });
}

export function customizeSandReckonerKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.trait = trait();
  const s = def.skill, first = s.id.endsWith('_1');
  kit.skill = { id: s.id, name: s.name, kind: 'duration', duration: s.duration,
    ...(first ? { trigger: 'SP_FULL', mods: { aspd: s.bb.attack_speed } } : {}),
    onStart: () => {
      if (!first) {
        const state = b.regularSummons?.get(`summon:${ID}`);
        if (state?.owner === u) state.stock = Math.min(state.record.stats.maxDeckStackCnt, state.stock + s.bb.cnt);
      }
      sync(b, u); transition(b, u);
    },
    onTick: () => sync(b, u),
    onEnd: () => { sync(b, u); if (live(u)) transition(b, u, true); },
  };
  u.mem.summonSkillSync = () => sync(b, u);
}

export function installSandReckoner({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  installMachineBonus(b, u, def.talents[0].bb.damage_scale);
  b.every(b.dt, () => sync(b, u), { owner: u });
  b.on('deploy', () => { if (live(u)) sync(b, u); }, { owner: u });
  b.on('death', ({ unit }) => { if (unit === u) {
    u.mem.regularFormVisual = null;
    for (const t of own(b, u)) { b.removeBuff(t, key(u)); t.mem.lasherMode = 0; }
  } }, { owner: u });
}

export function createClockworkFowlbeast(b, state, row, col, dir) {
  if (state.record.id !== TOKEN) throw Error('Missing reviewed Clockwork Fowlbeast source');
  const p = trait();
  p.interruptOnSkillChange = false; // token has no independent skill runtime
  p.priority = null;
  p.attackEpoch = (_b, t) => t.mem.lasherAttackEpoch ?? 0;
  return b.spawnToken(state.owner, TOKEN, row, col, { dir, def: state.record, kit: { skill: null,
    trait: p, install: (battle, t) => {
      battle.addBuff(t, { key: 'lasher:heal-free', flags: { healFree: true }, persist: true, allowDead: true });
      installMachineBonus(battle, t, state.owner.def.talents[0].bb.damage_scale);
      battle.on('deploy', ({ unit }) => { if (unit === t) sync(battle, state.owner); }, { owner: t });
    } } });
}
