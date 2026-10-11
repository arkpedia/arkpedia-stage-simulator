// SPDX-License-Identifier: GPL-3.0-or-later
// Linked Ray/Sandbeast controller. Selected builds use the complete kit.
// Serialized graphs remain in the
// source audit; phase clocks below are explicit executable contracts.
import evidence from '../../../data/arkpedia-ray-prefabs.json' with { type: 'json' };
import { RayMagazine, SandbeastMagazine } from './arkpedia-ray-magazine.js';
import { RayCombatLinks, RAY_ID, SANDBEAST_ID, SCOUT_MARK,
  rayCandidates, rayFireEvent } from './arkpedia-ray-combat.js';
import { bodyInKeys } from '../body.js';
const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const model = u => evidence.models[RAY_ID][['LEFT', 'UP'].includes(u.dir) ? 'Back' : 'Front'];
const speed = u => u.base.bat / u.s.interval;
const skillPrefix = (u, mode) => `Skill_${u.dir === 'DOWN' ? 'Down_' : ''}${mode}`;
const attackPrefix = u => u.dir === 'DOWN' ? 'Attack_Down' : 'Attack';
const reloadPrefix = (u, mode) => mode ? `${skillPrefix(u, mode)}_Reload`
  : u.dir === 'DOWN' ? 'Down_Reload' : 'Reload';

export class RayController {
  constructor(b, u, magazine, links) {
    this.battle = b; this.unit = u; this.magazine = magazine; this.links = links;
    this.mode = 0; this.phase = null; this.chain = false;
    this.controlEpoch = u.attackControlEpoch; this.stopped = false;
  }
  visual(clip, { loop = false, rate = 1 } = {}) {
    if (!Object.hasOwn(model(this.unit).durations, clip)) throw Error(`Missing original Ray clip: ${clip}`);
    this.unit.mem.regularFormVisual = { clip, loop, speed: rate };
  }
  idle() {
    this.visual(this.mode > 1 ? `${skillPrefix(this.unit, this.mode)}_Idle` : 'Idle', { loop: true });
  }
  invalidate() {
    this.phase = null; this.chain = false;
    this.magazine.cancelReload(this.battle.time);
  }
  switchMode(mode, { endAnimation = false } = {}) {
    if (this.stopped || !live(this.unit)) return;
    const outgoing = this.mode;
    this.invalidate(); this.mode = mode;
    this.magazine.setSkillMode(mode === 1 ? 0 : mode, this.battle.time);
    if (mode) {
      const clip = `${skillPrefix(this.unit, mode)}_Begin`, rate = speed(this.unit);
      this.visual(clip, { rate });
      this.phase = { kind: 'mode-begin', mode, rate,
        readyAt: this.battle.time + model(this.unit).durations[clip] / rate };
      // S1 owns a finite command clock; the generic runtime holds SP until the
      // controller's original Loop/End finish, rather than ending at birth.
      if (mode === 1) this.unit.skill.timeLeft = Infinity;
    } else if (endAnimation) {
      const clip = `${skillPrefix(this.unit, outgoing)}_End`, rate = speed(this.unit);
      this.visual(clip, { rate });
      this.phase = { kind: 'mode-end', readyAt: this.battle.time + model(this.unit).durations[clip] / rate };
    } else this.idle();
  }
  startLoop(rate = speed(this.unit)) {
    const event = rayFireEvent(this.unit, this.mode), now = this.battle.time;
    this.visual(event.clip, { loop: true, rate });
    this.phase = { kind: 'fire', mode: this.mode, rate, released: false,
      releaseAt: now + event.time / rate, readyAt: now + 1.6 / rate };
    this.chain = true;
    this.unit.atkCd = 1.6 / rate;
  }
  startFire({ breaking = false } = {}) {
    const u = this.unit, now = this.battle.time, rate = speed(u);
    if (breaking) {
      const br = this.magazine.breakForFire(now);
      if (!br) return;
      const clip = `${reloadPrefix(u, this.mode)}_Break`;
      this.visual(clip, { rate });
      this.phase = { kind: 'fire-begin', mode: this.mode, rate,
        readyAt: now + model(u).durations[clip] / rate };
    } else if (!this.chain && this.mode === 0) {
      const clip = `${attackPrefix(u)}_Begin`;
      this.visual(clip, { rate });
      this.phase = { kind: 'fire-begin', mode: 0, rate,
        readyAt: now + model(u).durations[clip] / rate };
    } else this.startLoop(rate);
  }
  startReload(first = true) {
    const u = this.unit, clip = `${reloadPrefix(u, this.mode)}_Begin`;
    const preDelay = first ? model(u).durations[clip] : 0;
    const reload = this.magazine.beginReload(this.battle.time, { preDelay });
    if (!reload) { this.phase = null; this.idle(); return; }
    this.chain = false;
    this.visual(first ? clip : `${reloadPrefix(u, this.mode)}_Loop`, { loop: !first });
    this.phase = { kind: first ? 'reload-begin' : 'reload', mode: this.mode,
      generation: reload.generation, readyAt: first ? this.battle.time + preDelay : reload.readyAt };
  }
  finishSpecial() {
    const clip = `${skillPrefix(this.unit, 1)}_End`, rate = this.phase.rate;
    this.visual(clip, { rate });
    this.phase = { kind: 'special-end', mode: 1,
      readyAt: this.battle.time + model(this.unit).durations[clip] / rate };
  }
  tick() {
    const b = this.battle, u = this.unit, m = this.magazine;
    if (this.stopped || !live(u)) return;
    // Observe an epoch even when short control has ended between scheduler ticks.
    if (!u.canAct || u.s.flags.disarm || this.controlEpoch !== u.attackControlEpoch) {
      this.controlEpoch = u.attackControlEpoch;
      this.invalidate();
      if (this.mode === 1) u.skill.end('control');
      this.idle(); return;
    }
    m.time(b.time); m.resetFlag(b.time, { attacking: this.phase?.kind === 'fire' });
    const p = this.phase, target = rayCandidates(b, u)[0];
    if (p?.kind.startsWith('reload') && target && m.canFire) {
      this.startFire({ breaking: true }); return;
    }
    if (p?.kind === 'fire') {
      if (!p.released && b.time + 1e-9 >= p.releaseAt) {
        p.released = true;
        // ForceAttack dispatches one accepted birth through the ordinary attack
        // hook/SP boundary; no attack occurs when the fresh selector is empty.
        if (target) b.forceAttack(u, [target]);
      }
      if (b.time + 1e-9 < p.readyAt) return;
      if (p.mode === 1) { this.finishSpecial(); return; }
      this.phase = null;
      if (target && m.canFire) { this.startLoop(); return; }
      if (m.bullets < m.capacity) { this.startReload(); return; }
      this.chain = false; this.idle(); return;
    }
    if (p) {
      if (b.time + 1e-9 < p.readyAt) return;
      if (p.kind === 'mode-begin' || p.kind === 'fire-begin') {
        if (this.mode === 3 && m.refillOnly) this.startReload();
        else this.startLoop(p.rate);
        return;
      }
      if (p.kind === 'reload-begin') {
        this.visual(`${reloadPrefix(u, this.mode)}_Loop`, { loop: true });
        this.phase = { ...p, kind: 'reload', readyAt: m.reload.readyAt }; return;
      }
      if (p.kind === 'reload') {
        m.finishReload(b.time, p.generation, { canAct: u.canAct });
        this.phase = null;
        if (m.bullets < m.capacity && (!target || !m.canFire)) this.startReload(false);
        else if (target && m.canFire) this.startFire({ breaking: true });
        else this.idle();
        return;
      }
      if (p.kind === 'special-end') { this.phase = null; u.skill.end('command-finish'); return; }
      if (p.kind === 'mode-end') { this.phase = null; this.idle(); return; }
    }
    if (this.mode === 3 && m.refillOnly) { this.startReload(); return; }
    if (target && m.canFire && u.atkCd <= 1e-9) this.startFire({ breaking: m.reloadFlag });
    else if (!target && m.bullets < m.capacity || target && !m.canFire) this.startReload();
  }
  stop() {
    this.stopped = true; this.phase = null;
    this.timer?.cancel(); this.links.remove();
  }
}

export function customizeRayKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== RAY_ID) return;
  const magazine = new RayMagazine({ elite: def.raw.arkpedia.elite, direction: u.dir });
  const links = new RayCombatLinks(b, u, { magazine,
    specialShift: (e, shot) => b.push(e, shot.force, { from: u,
      dir: { x: u.fwd[1], y: u.fwd[0] }, directionalReduction: 1,
      onFall: victim => { b.kill(victim, u); shot.onFall(); } }) });
  const controller = new RayController(b, u, magazine, links);
  Object.assign(u.mem, { rayMagazine: magazine, rayLinks: links, rayController: controller });
  kit.install = null;
  kit.trait = { noAttack: true, install: null, attack: 'ranged', projectile: 'arrow',
    dmgType: 'phys', canHitFly: true, maxTargets: 1, hits: 1, hitAllBlocked: false,
    attackDrivenSkill: true, requiresAcceptedLaunch: true, attackVisual: 'none',
    launchAttack: (_battle, _a, _p, target, info) => links.fire(target, { ...info, mode: controller.mode }) };
  const s = def.skill, mode = Number(s.id.at(-1));
  kit.skill = { id: s.id, name: s.name, kind: mode === 2 ? 'toggle' : 'duration',
    duration: mode === 1 ? 1.6 : s.duration,
    trigger: { rule: mode === 2 ? 'SP_FULL' : 'NEVER' },
    ...(mode === 1 ? { canActivate: () => !u.skill?.active && rayCandidates(b, u).length > 0 }
      : { targeting: { rangeGrid: s.rangeGrid } }),
    ...(mode === 2 ? { mods: { atkPct: s.bb.atk } } : {}),
    onStart: () => { controller.switchMode(mode); if (mode === 3) links.startThird(); },
    onEnd: () => { controller.switchMode(0, { endAnimation: mode > 1 }); if (mode === 3) links.finishThird(); },
  };
}

export function installRay({ battle: b, unit: u, def }) {
  if (def.charId !== RAY_ID) return;
  const controller = u.mem.rayController, links = u.mem.rayLinks;
  links.installDamageScale();
  controller.timer = b.every(b.dt, () => controller.tick(), { owner: u });
  b.on('deploy', ({ unit }) => {
    if (unit !== u || def.raw.arkpedia.elite === 0) return;
    const state = b.regularSummons?.get(`summon:${RAY_ID}`);
    if (state?.owner !== u || def.talents[0]?.tokenKey !== SANDBEAST_ID) throw Error('Missing Ray source stock');
    state.stock = 1;
  }, { owner: u });
  b.on('death', ({ unit }) => {
    if (unit !== u) return;
    controller.stop();
    for (const t of b.allyUnits) if (t.ownerUnit === u && t.defId === SANDBEAST_ID && live(t))
      b.retreat(t, { reason: 'owner-removed', permanent: true });
  }, { owner: u });
}

export function createSandbeast(b, state, row, col) {
  const u = state.owner, links = u.mem.rayLinks, r = state.record;
  if (!links || r.id !== SANDBEAST_ID || ![15, 25].includes(r.talents[0]?.bb.duration))
    throw Error('Missing complete Sandbeast source');
  const t = b.spawnToken(u, SANDBEAST_ID, row, col, { def: r, dir: 'RIGHT',
    kit: { trait: { noAttack: true, install: null }, skill: null,
      install: (battle, a) => {
        a.kind = 'device';
        battle.addBuff(a, { key: 'ray_sndbst:device', flags: { invulnerable: true, noHeal: true, noSp: true },
          persist: true, allowDead: true });
      } } });
  if (!t) return null;
  t.deploymentSlotCost = 0; t.mem.regularSummonCard = state.key;
  t.mem.rayMagazine = new SandbeastMagazine({ elite: r.arkpedia.elite, enabled: !!r.skill });
  t.mem.regularFormVisual = { clip: 'Start', loop: false };
  const key = `${SCOUT_MARK}:${t.id}`;
  let finished = false, clock = 0;
  const clear = () => { for (const e of b.enemies) b.removeBuff(e, key); };
  const sync = () => {
    for (const e of b.enemies) {
      const allowed = live(t) && t.mem.rayBorn && e.alive && !e.isFlying && bodyInKeys(e, t.rangeKeySet);
      if (!allowed) b.removeBuff(e, key);
      else if (!e.findBuff(key)) b.addBuff(e, { key, source: t, tags: [SCOUT_MARK] });
    }
  };
  // Card-buff ratio stays held by active S2, including a card already cooling.
  // Keep an unscaled remaining clock so removal of the holder restores it.
  const recharge = b.every(b.dt, () => {
    if (!finished || !live(u) || state.stock > 0) return;
    const ratio = u.skill.active && u.skill.id === 'skchr_ray_2' ? 1 + u.def.skill.bb.respawn_time : 1;
    clock = Math.max(0, clock - b.dt / ratio);
    state.readyAt = b.time + clock * ratio;
    if (clock <= 1e-9) { state.stock = 1; recharge.cancel(); }
  }, { owner: u });
  b.on('death', ({ unit }) => {
    if (unit !== t || finished) return;
    finished = true; clear(); links.detachScout(t);
    // Explicit execution contract: an absent native extra_add default is mapped
    // to zero here. It is not presented as a recovered serialized value.
    t.mem.rayMagazine.finish(links.magazine, { emptySeed: 0 });
    clock = r.stats.respawnTime;
    const ratio = u.skill.active && u.skill.id === 'skchr_ray_2' ? 1 + u.def.skill.bb.respawn_time : 1;
    state.readyAt = b.time + clock * ratio;
    if (!live(u)) recharge.cancel();
  }, { owner: t });
  const aura = b.every(b.dt, () => {
    if (!live(t)) { aura.cancel(); return; }
    sync();
  }, { owner: t });
  const original = evidence.models[SANDBEAST_ID].Original;
  b.after(original.eventPayloads.Start[0].time, () => {
    if (!live(t) || !live(u)) return;
    t.mem.rayBorn = true; links.attachScout(t); sync();
    b.after(r.talents[0].bb.duration, () => {
      if (live(t)) b.retreat(t, { reason: 'lifetime', permanent: true });
    }, { owner: t });
  }, { owner: t });
  b.after(original.durations.Start, () => {
    if (live(t)) t.mem.regularFormVisual = { clip: 'Idle', loop: true };
  }, { owner: t });
  return t;
}
