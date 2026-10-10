// SPDX-License-Identifier: GPL-3.0-or-later
// Unregistered source-fed controller. Local scheduling contracts remain
// explicit until selected public builds and browser combat have been reviewed.
import evidence from '../../../data/arkpedia-lemuen-prefabs.json' with { type: 'json' };
import { LEMUEN_ID, LemuenCombatLinks } from './arkpedia-lemuen-links.js';
import { LemuenAmmunition, LemuenTalentLinks, lemuenCandidates, lemuenWanted } from './arkpedia-lemuen-resources.js';
import { LemuenAiming, LemuenBombardment } from './arkpedia-lemuen-casts.js';
import { canTargetEnemy } from '../targeting.js';
import { bodyInKeys } from '../body.js';

const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const profile = Object.freeze({ canHitFly: true });
const targetable = (u, e) => live(e) && canTargetEnemy(u, e, profile) && (!e.s.flags.camou || e.blockedBy);
const model = u => evidence.models[LEMUEN_ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const component = id => evidence.characters[LEMUEN_ID].flatMap(r => r.components).find(c => c.pathId === id)?.data;
const ordinary = component('-8402605109158421989'), volley = component('-5932394946072290789');
const aim = component('-3206290821302134245'), mark = component('-3762993244653430245');
const finishKey = u => `lemuen:${u.id}:finish-sp`;
const validContract = c => c?.phasePolicy === 'source-clips-local-v1'
  && c.s2AimStart === 'after-begin-clip' && c.s3FirstMark === 'begin-plus-predelay'
  && c.normalPost === 'max-interval-invalid-plus-minimum'
  && c.s2Post === 'invalid-plus-minimum-and-clip'
  && typeof c.reviewNote === 'string' && !!c.reviewNote.trim();

export class LemuenController {
  constructor(b, u, links, ammo, talents, contracts) {
    if (!validContract(contracts?.controller)) throw Error('Lemuen controller requires explicit reviewed phase contracts');
    this.b = b; this.u = u; this.links = links; this.ammo = ammo; this.talents = talents;
    this.contracts = contracts; this.skill = ammo.skill; this.mode = 0; this.phase = null;
    this.stopped = false; this.chain = false; this.command = 0; this.controlEpoch = u.attackControlEpoch;
    if (ordinary._minPostDelayWhenProjectileInvalid !== .44999998807907104
      || volley._minPostDelayWhenProjectileInvalid !== ordinary._minPostDelayWhenProjectileInvalid
      || aim._minPostDelayWhenProjectileInvalid !== 1.2000000476837158
      || !aim._waitForAnimEndWhenProjectileInvalid || mark._preDelay !== .10000000149011612)
      throw Error('Unreviewed Lemuen phase source');
    // Validate the selected cast contracts before installing anything.
    if (this.skill === 2) this.aiming = new LemuenAiming(b, u, links, ammo, contracts.aiming);
    if (this.skill === 3) this.bombardment = new LemuenBombardment(b, u, links, ammo, contracts.bombardment);
  }
  visual(clip, { speed = 1, loop = false } = {}) {
    if (!Object.hasOwn(model(this.u).durations, clip)) throw Error(`Missing original Lemuen clip: ${clip}`);
    this.u.mem.regularFormVisual = { clip, speed, loop };
  }
  idle() { this.visual(this.mode ? `Skill_${this.mode}_Idle` : 'Idle', { loop: true }); }
  syncAmmo() {
    if (this.u.skill?.active) {
      this.u.skill.ammoLeft = this.ammo.current;
      this.u.skill.ammoMax = Math.max(this.ammo.maximum, this.ammo.current);
    }
  }
  candidates(count = 1) { return lemuenCandidates(this.b, this.u, this.talents, count === Infinity ? Math.max(1, this.b.enemies.length) : count); }
  fallback() {
    return this.candidates(Infinity).filter(e => bodyInKeys(e, this.u.rangeKeySet) || e.blockedBy === this.u).slice(0, 1);
  }
  canCast() {
    const u = this.u;
    return !this.stopped && live(u) && u.canAct && !u.s.flags.silence
      && !u.s.flags.noSp && !u.skill?.active && !['entrance', 'skill-end'].includes(this.phase?.kind)
      && (this.skill !== 3 || !!this.candidates()[0]);
  }
  startSkill() {
    const { b, u } = this;
    this.aiming?.cancel('mode-change'); this.phase = null; this.chain = false;
    if (!this.ammo.begin()) throw Error('Lemuen cast already owns ammunition');
    this.syncAmmo(); u.atkCd = 0; this.mode = this.skill;
    if (this.skill === 2) {
      this.aiming = new LemuenAiming(b, u, this.links, this.ammo, this.contracts.aiming);
      this.idle(); return;
    }
    if (this.skill === 3)
      this.bombardment = new LemuenBombardment(b, u, this.links, this.ammo, this.contracts.bombardment);
    if (this.skill === 3) this.bombardment.install();
    const clip = `Skill_${this.skill}_Begin`;
    this.visual(clip);
    this.phase = { kind: 'skill-begin', readyAt: b.time + model(u).durations[clip] };
  }
  endSkill(reason) {
    const { b, u } = this, oldMode = this.mode, completedAim = this.phase;
    this.aiming?.cancel(reason); this.phase = null; this.chain = false; this.mode = 0;
    const finish = live(u) && !this.stopped;
    if (this.skill === 3) {
      if (finish) this.bombardment.release(); else this.bombardment.stop();
    }
    this.ammo.end();
    if (!finish) return;
    // The final aimed attack already completed its End clip and projectile
    // post-delay. Native mode reset must not play the same End a second time.
    if (this.skill === 2 && reason === 'ammo' && completedAim?.kind === 'aim-end') {
      this.idle(); u.atkCd = 0; return;
    }
    // SkillRuntime marks the skill inactive before onEnd. A separate hold
    // prevents any SP source/new command from bypassing the original End clip.
    b.addBuff(u, { key: finishKey(u), source: u, flags: { noSp: true } });
    const clip = `Skill_${oldMode || this.skill}_End`;
    this.visual(clip);
    this.phase = { kind: 'skill-end', readyAt: b.time + model(u).durations[clip] };
    u.atkCd = 0;
  }
  attackSpeed() {
    const speed = this.u.base.bat / this.u.s.interval;
    // The S2 ordinary fallback has native maxAnimScale1; default and S1
    // clocks have no positive cap. This does not decode numeric timeMode0.
    return this.mode === 2 ? Math.min(1, speed) : speed;
  }
  normalClip(part) {
    if (this.mode === 1) return this.u.dir === 'DOWN' && part === 'Loop' ? 'Skill_Down_1_Loop' : `Skill_1_${part}`;
    return `Attack${this.u.dir === 'DOWN' ? '_Down' : ''}_${part}`;
  }
  startOrdinary() {
    const { b, u } = this, targets = this.mode === 2 ? this.fallback() : this.candidates(this.mode === 1 ? 2 : 1);
    if (!targets.length) { this.chain = false; return; }
    const speed = this.attackSpeed();
    const p = { targets, lives: targets.map(e => e.deploySeq), mode: this.mode === 1 ? 1 : 0,
      kind: 'attack', speed, startedAt: b.time, released: false, projectiles: [] };
    if (!this.chain && this.mode !== 1) {
      const clip = this.normalClip('Begin'); this.visual(clip, { speed });
      this.phase = { ...p, kind: 'attack-begin', readyAt: b.time + model(u).durations[clip] / speed };
    } else this.startLoop(p);
    this.chain = true;
  }
  startLoop(p) {
    const clip = this.normalClip('Loop'), m = model(this.u), event = m.eventPayloads[clip];
    if (event?.length !== 1 || event[0].name !== 'OnAttack') throw Error('Unreviewed Lemuen ordinary event');
    this.visual(clip, { speed: p.speed });
    this.phase = { ...p, kind: 'attack', releaseAt: this.b.time + event[0].time / p.speed,
      intervalAt: this.b.time + this.u.s.interval };
    this.u.atkCd = this.u.s.interval;
  }
  fire(e, { attackId }) {
    const { b, u } = this, p = this.phase;
    if (this.stopped || !live(u) || !u.canAct || u.s.flags.disarm || !targetable(u, e)) return false;
    if (p?.kind === 'aim-end') {
      if (p.recorded || p.result.target !== e || !p.result.born) return false;
      p.recorded = true; return true; // Aiming already created the one cached shot.
    }
    if (p?.kind !== 'attack' || !p.released || !p.targets.includes(e) || p.born?.has(e)
      || p.lives[p.targets.indexOf(e)] !== e.deploySeq) return false;
    if (p.mode === 1 && !this.ammo.accepted.has(attackId) && !this.ammo.consume(attackId)) return false;
    const shot = this.links.launch(e, attackId, p.mode, { selected: u.def.skill.bb });
    if (!shot) return false;
    (p.born ??= new Set()).add(e); p.projectiles.push(shot); this.syncAmmo();
    return true;
  }
  flying(projectiles) { return projectiles.some(p => !p.removed && this.b.projectiles.list.includes(p)); }
  finishAttack(p, minimum, extraAt = -Infinity) {
    if (this.flying(p.projectiles)) return false;
    p.invalidAt ??= this.b.time;
    return this.b.time + 1e-9 >= Math.max(p.intervalAt ?? -Infinity, p.invalidAt + minimum, extraAt);
  }
  startAim(e) {
    const { b, u } = this;
    this.chain = false; this.visual('Skill_2_Begin');
    this.phase = { kind: 'aim-begin', target: e, life: e.deploySeq,
      readyAt: b.time + model(u).durations.Skill_2_Begin,
      attackId: `lemuen:${u.id}:aim:${++this.command}` };
  }
  finishAim() {
    const { b, u } = this, result = this.aiming.result;
    this.visual('Skill_2_End');
    const p = this.phase = { kind: 'aim-end', result, projectiles: result.projectile ? [result.projectile] : [],
      clipEnd: b.time + model(u).durations.Skill_2_End };
    if (result.born && targetable(u, result.target)) b.forceAttack(u, [result.target], { noAmmo: true });
    this.syncAmmo();
    return p;
  }
  interrupt() {
    this.aiming?.cancel('interrupted'); this.phase = null; this.chain = false;
    if (this.u.skill.active && this.ammo.current === 0) this.u.skill.end('ammo-interrupted');
    else this.idle();
  }
  tick() {
    const { b, u } = this;
    if (this.stopped) return;
    if (!live(u)) { this.stop(); return; }
    this.syncAmmo();
    const p = this.phase;
    if (['entrance', 'skill-begin', 'skill-end'].includes(p?.kind)) {
      // Source activation predelay is uninterruptible. End hold likewise owns
      // a committed local finish phase; control cannot start a new cast.
      if (b.time + 1e-9 >= p.readyAt) {
        if (p.kind === 'skill-end') b.removeBuff(u, finishKey(u));
        this.phase = null; this.idle();
      }
      this.controlEpoch = u.attackControlEpoch; return;
    }
    const blocked = !u.canAct || u.s.flags.disarm || this.controlEpoch !== u.attackControlEpoch;
    if (blocked) {
      this.controlEpoch = u.attackControlEpoch;
      const finalBorn = u.skill.active && this.ammo.current === 0 && p?.projectiles?.length;
      // Control cannot discard the final already born shot's finish clock.
      // Its projectile/post-delay continues; no new attack can begin here.
      if (!finalBorn) { this.interrupt(); return; }
    }
    if (p?.kind === 'aim-begin') {
      if (b.time + 1e-9 < p.readyAt) return;
      if (p.target.deploySeq !== p.life || !this.aiming.begin(p.target, p.attackId)) {
        this.phase = null; this.idle(); return;
      }
      this.phase = { kind: 'aim' }; this.visual('Skill_2_Idle', { loop: true });
      if (!this.aiming.busy) this.finishAim();
      this.syncAmmo(); return;
    }
    if (p?.kind === 'aim') {
      this.aiming.tick(); if (!this.aiming.busy) this.finishAim(); return;
    }
    if (p?.kind === 'aim-end') {
      if (!this.finishAttack(p, aim._minPostDelayWhenProjectileInvalid, p.clipEnd)) return;
      if (this.ammo.current === 0) { u.skill.end('ammo'); return; }
      this.phase = null; this.idle();
    } else if (p?.kind === 'attack-begin') {
      if (b.time + 1e-9 >= p.readyAt) this.startLoop(p);
      return;
    } else if (p?.kind === 'attack') {
      if (!p.released && b.time + 1e-9 >= p.releaseAt) {
        p.released = true;
        const targets = p.targets.filter((e, i) => e.deploySeq === p.lives[i] && targetable(u, e));
        if (targets.length) b.forceAttack(u, targets, { noAmmo: true });
      }
      if (!p.released || !this.finishAttack(p, ordinary._minPostDelayWhenProjectileInvalid)) return;
      this.phase = null; u.atkCd = 0;
      if (p.mode === 1 && this.ammo.current === 0) { u.skill.end('ammo'); return; }
      this.idle();
    } else if (p?.kind === 'mark') {
      if (b.time + 1e-9 < p.releaseAt) return;
      const e = this.candidates()[0];
      if (e) this.bombardment.mark(e, `lemuen:${u.id}:mark:${++this.command}`);
      this.syncAmmo(); this.phase = null;
      this.nextMarkAt = p.startedAt + u.def.skill.bb['attack@aim_interval'];
      if (this.ammo.current === 0) { u.skill.end('ammo'); return; }
    }
    if (this.phase || blocked) return;
    if (this.mode === 3) {
      this.bombardment.sync();
      if (b.time + 1e-9 >= (this.nextMarkAt ?? b.time) && this.candidates()[0])
        this.phase = { kind: 'mark', startedAt: b.time, releaseAt: b.time + mark._preDelay };
      return;
    }
    if (this.mode === 2) {
      const e = this.candidates(Infinity).find(e => lemuenWanted(b, e));
      if (e) { this.startAim(e); return; }
    }
    // S1 is automatic and attack-recovered. A ready command starts immediately
    // (allowNoTarget1), even if its preceding ordinary victim has disappeared.
    if (this.skill === 1 && this.mode === 0 && u.skill.ready && this.canCast()) {
      u.skill.activate('SP_FULL'); return;
    }
    if (u.atkCd <= 1e-9) this.startOrdinary();
  }
  install() {
    if (this.timer || this.stopped) return;
    this.visual('Start');
    this.phase = { kind: 'entrance', readyAt: this.b.time + model(this.u).durations.Start };
    this.timer = this.b.every(this.b.dt, () => this.tick(), { owner: this.u });
    this.deathHook = this.b.on('death', ({ unit }) => { if (unit === this.u) this.stop(); });
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.phase = null; this.timer?.cancel(); this.aiming?.stop(); this.bombardment?.stop();
    this.talents.stop(); this.ammo.remove();
    this.u.skill?.end('owner-finish'); this.b.removeBuff(this.u, finishKey(this.u));
    this.u.mem.regularFormVisual = null;
    if (this.deathHook) this.b.off(this.deathHook);
  }
}

export function prepareLemuenKit(b, u, { contracts } = {}) {
  if (u.def.charId !== LEMUEN_ID) throw Error('Lemuen controller requires Lemuen source data');
  const s = u.def.skill, rank = u.def.raw.arkpedia?.skillRank;
  const selected = Number.isInteger(rank) && rank >= 1 && rank <= 10
    ? evidence.tables.skills[s.id]?.levels[rank - 1] : null;
  const n = Number(s.id.at(-1)), values = selected && Object.fromEntries(selected.blackboard.map(r => [r.key, r.value]));
  if (!selected || s.id !== `skchr_lemuen_${n}` || ![1, 2, 3].includes(n)
    || s.duration !== -1 || selected.durationType !== 'AMMO'
    || s.spType !== (n === 1 ? 'attack' : 'time') || s.skillType !== selected.skillType
    || s.spCost !== selected.spData.spCost || s.initSp !== selected.spData.initSp
    || s.maxCharges !== selected.spData.maxChargeTime
    || Object.keys(s.bb).length !== Object.keys(values).length
    || Object.entries(values).some(([k, v]) => s.bb[k] !== v)
    || (s.rangeGrid ?? []).length) throw Error('Incomplete Lemuen selected source skill');
  if (!validContract(contracts?.controller)) throw Error('Lemuen controller requires explicit reviewed phase contracts');
  const ammo = new LemuenAmmunition(n, rank), links = new LemuenCombatLinks(b, u);
  const talents = new LemuenTalentLinks(b, u, ammo, contracts.wanted);
  let controller;
  try { controller = new LemuenController(b, u, links, ammo, talents, contracts); }
  catch (error) { talents.stop(); ammo.remove(); throw error; }
  Object.assign(u.mem, { lemuenController: controller, lemuenAmmunition: ammo });
  const kit = {
    trait: { noAttack: true, attackDrivenSkill: true, attack: 'ranged', dmgType: 'phys',
      canHitFly: true, projectile: 'arrow', maxTargets: 1, hits: 1, attackVisual: 'none',
      requiresAcceptedLaunch: true, launchAttack: (_b, _u, _p, e, info) => controller.fire(e, info) },
    skill: { id: s.id, name: s.name, kind: 'ammo', ammo: ammo.base, duration: 0,
      trigger: { rule: 'NEVER' }, manualCancel: true,
      canManualCancel: () => !['entrance', 'skill-begin'].includes(controller.phase?.kind),
      canActivate: () => controller.canCast(), onAttack: ctx => { ctx.noAmmo = true; },
      ...(n === 2 ? { mods: { atkPct: s.bb.atk, aspd: s.bb.attack_speed } } : {}),
      onStart: () => { controller.nextMarkAt = null; controller.startSkill(); },
      onEnd: ({ reason }) => controller.endSkill(reason) },
  };
  return { kit, controller, links, ammo, talents };
}
