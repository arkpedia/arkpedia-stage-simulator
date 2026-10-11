// SPDX-License-Identifier: GPL-3.0-or-later
// Coldshot combat/controller adapter with selected source builds.
// Native numeric callbacks remain in the source record;
// the scheduling choices below are explicit local execution contracts.
import evidence from '../../../data/arkpedia-coldshot-prefabs.json' with { type: 'json' };
import { canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';
export const COLDSHOT_ID = 'char_4104_coldst';
const bb = rows => Object.fromEntries(rows.map(r => [r.key, r.value]));
const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const PROFILE = Object.freeze({ canHitFly: true });
const model = u => evidence.models[COLDSHOT_ID][['LEFT', 'UP'].includes(u.dir) ? 'Back' : 'Front'];

export function coldshotCandidates(b, u) {
  const rows = b.enemies.filter(e => canTargetEnemy(u, e, PROFILE)
    && (bodyInKeys(e, u.rangeKeySet) || e.blockedBy === u));
  sortEnemyTargets(b, u, rows);
  return rows.slice(0, 1);
}

/** One source magazine; neither skill activation nor a reload cancellation
 * replaces its stored rounds. The absent no-module extra_add is explicitly
 * mapped to zero, rather than presented as a recovered native default. */
export class ColdshotMagazine {
  constructor(elite) {
    if (![0, 1, 2].includes(elite)) throw Error('Invalid Coldshot promotion');
    const trait = bb(evidence.tables.character.trait.candidates[elite].blackboard);
    this.capacity = trait.value; this.bullets = this.capacity;
    this.removed = false;
    if (![4, 6, 8].includes(this.capacity) || trait.atk_scale !== 1.2)
      throw Error('Unreviewed Coldshot trait');
  }
  get ammoUi() { return { current: this.bullets, maximum: this.capacity }; }
  consume() {
    if (this.removed || this.bullets <= 0) return false;
    this.bullets--; return true;
  }
  refill() {
    if (this.removed || this.bullets >= this.capacity) return false;
    this.bullets++; return true;
  }
  remove() { this.removed = true; }
}

export class ColdshotController {
  constructor(b, u, magazine) {
    this.battle = b; this.unit = u; this.magazine = magazine;
    this.mode = 0; this.phase = null; this.reloadFlag = false;
    this.resetAt = null; this.chain = false; this.stopped = false;
    this.controlEpoch = u.attackControlEpoch;
    this.talent = u.def.talents.find(t => t.bb['attack@delay'] != null);
    this.talentEligibleAt = b.time + (this.talent?.bb['attack@delay'] ?? Infinity);
    this.nextTalentCheck = b.time + .02; this.talentReady = false;
    this.attackInvalid = false;
  }
  clip(part, suffix) {
    const down = this.unit.dir === 'DOWN';
    const prefix = this.mode === 2 ? `Skill_${down ? 'Down_' : ''}2${part === 'reload' ? '_Reload' : ''}`
      : part === 'reload' ? `Reload${down ? '_Down' : ''}` : `Attack${down ? '_Down' : ''}`;
    return `${prefix}_${suffix}`;
  }
  visual(clip, { loop = false, rate = 1 } = {}) {
    if (!Object.hasOwn(model(this.unit).durations, clip)) throw Error(`Missing original Coldshot clip: ${clip}`);
    this.unit.mem.regularFormVisual = { clip, loop, speed: rate };
  }
  idle() { this.visual('Idle', { loop: true }); }
  finishAttackState() {
    if (!this.attackInvalid) return;
    this.attackInvalid = false;
    this.talentReady = false;
    this.talentEligibleAt = this.battle.time + (this.talent?.bb['attack@delay'] ?? Infinity);
  }
  invalidate() {
    this.finishAttackState(); this.phase = null; this.chain = false;
    // Native flag-reset holder lasts .2 seconds and checks out-of-attack state.
    this.resetAt = this.reloadFlag ? this.battle.time + .2 : null;
  }
  switchMode(mode) {
    if (![0, 2].includes(mode)) throw Error('Invalid Coldshot mode');
    if (this.stopped) return;
    this.invalidate(); this.mode = mode; this.idle();
  }
  startFire({ breaking = false } = {}) {
    if (this.magazine.bullets <= 0) return;
    const u = this.unit, now = this.battle.time;
    const rate = model(u).durations[this.clip('fire', 'Loop')] / u.s.interval;
    const talentScale = this.talentReady ? this.talent.bb.atk_scale : 1;
    this.attackInvalid = true; this.talentReady = false;
    // The source validator is sampled before entering the cast-invalid state.
    // Its selected coefficient follows this born shot, not a later idle check.
    const prefix = breaking ? this.clip('reload', 'Break') : this.clip('fire', 'Begin');
    const begin = breaking || !this.chain;
    this.reloadFlag = breaking;
    this.resetAt = null;
    if (begin) {
      this.visual(prefix, { rate });
      this.phase = { kind: 'fire-begin', mode: this.mode, rate, talentScale,
        readyAt: now + model(u).durations[prefix] / rate };
    } else this.startLoop({ mode: this.mode, rate, talentScale });
    this.chain = true;
  }
  startLoop(state) {
    const clip = this.clip('fire', 'Loop'), m = model(this.unit), now = this.battle.time;
    const events = m.eventPayloads[clip];
    if (events?.length !== 1 || events[0].name !== 'OnAttack') throw Error('Unreviewed Coldshot fire event');
    this.visual(clip, { loop: true, rate: state.rate });
    this.phase = { ...state, kind: 'fire', released: false,
      releaseAt: now + events[0].time / state.rate,
      readyAt: now + m.durations[clip] / state.rate };
    this.unit.atkCd = m.durations[clip] / state.rate;
  }
  startReload(first = true) {
    if (this.magazine.bullets >= this.magazine.capacity) { this.phase = null; this.idle(); return; }
    this.finishAttackState(); this.chain = false; this.reloadFlag = true; this.resetAt = null;
    const clip = this.clip('reload', first ? 'Begin' : 'Loop');
    this.visual(clip, { loop: !first });
    if (first) this.phase = { kind: 'reload-begin', readyAt: this.battle.time + model(this.unit).durations[clip] };
    else this.startReloadLoop();
  }
  startReloadLoop() {
    const clip = this.clip('reload', 'Loop'), now = this.battle.time, m = model(this.unit);
    const event = m.eventPayloads[clip];
    if (event?.length !== 1 || event[0].name !== 'OnAttack') throw Error('Unreviewed Coldshot refill event');
    // Refilling at the literal reload event is a local mapping, not a decoded
    // numeric event5. The remaining fixed cooldown continues until completion.
    this.visual(clip, { loop: true });
    this.phase = { kind: 'reload', refilled: false,
      releaseAt: now + event[0].time, readyAt: now + m.durations[clip] };
  }
  fire(target, { attackId } = {}) {
    const b = this.battle, u = this.unit, p = this.phase;
    if (this.stopped || !live(u) || !u.canAct || u.s.flags.disarm || p?.kind !== 'fire'
      || p.born || b.time + 1e-9 < p.releaseAt || target?.side !== 'enemy'
      || !canTargetEnemy(u, target, PROFILE)
      || !bodyInKeys(target, u.rangeKeySet) && target.blockedBy !== u
      || !this.magazine.consume()) return false;
    p.born = true;
    const shot = { mode: p.mode, talentScale: p.talentScale, attackId, isSkill: u.skill.active,
      slow: p.mode === 2 ? u.def.skill.bb['attack@sluggish'] : 0 };
    this.finishAttackState();
    b.addProjectile({ from: u, source: u, target, speed: 15, maxAge: 10,
      visual: 'arrow', data: { arkpediaTrackedVisual: true }, onHit: ({ target: e }) => {
        if (e?.side !== 'enemy' || !canTargetEnemy(u, e, PROFILE)) return;
        let accepted = false;
        const hook = b.on('calculatedDamage', ctx => {
          if (ctx.source === u && ctx.target === e && ctx.dmg.attackId === shot.attackId
            && ctx.dmg.tags?.includes('coldshot:shot')) accepted = true;
        });
        try {
          b.dealDamage(u, e, { amount: u.s.atk * u.s.atkScaleMul * u.def.traitBb.atk_scale * shot.talentScale,
            type: 'phys', isAttack: true, isSkill: shot.isSkill,
            isProjectile: true, applyWay: 'ranged', attackId: shot.attackId, tags: ['coldshot:shot'] });
        } finally { b.off(hook); }
        if (live(e) && accepted && shot.slow > 0)
          b.applyStatus(e, 'slow', { source: u, duration: shot.slow, value: .8 });
      } });
    return true;
  }
  tick() {
    const b = this.battle, u = this.unit;
    if (this.stopped || !live(u)) return;
    if (!u.canAct || u.s.flags.disarm || this.controlEpoch !== u.attackControlEpoch) {
      this.controlEpoch = u.attackControlEpoch; this.invalidate(); this.idle(); return;
    }
    if (b.time + 1e-9 >= this.nextTalentCheck) {
      this.talentReady = !!this.talent && !this.attackInvalid && b.time + 1e-9 >= this.talentEligibleAt;
      this.nextTalentCheck = b.time + .02;
    }
    if (this.resetAt != null && b.time + 1e-9 >= this.resetAt && !this.attackInvalid) {
      this.reloadFlag = false; this.resetAt = null;
    }
    const p = this.phase, target = coldshotCandidates(b, u)[0];
    if (p?.kind.startsWith('reload') && target && this.magazine.bullets > 0) {
      this.startFire({ breaking: true }); return;
    }
    if (p?.kind === 'fire') {
      if (!p.released && b.time + 1e-9 >= p.releaseAt) {
        p.released = true;
        if (target) b.forceAttack(u, [target]);
        if (!p.born) this.finishAttackState();
      }
      if (b.time + 1e-9 < p.readyAt) return;
      this.phase = null;
      if (target && this.magazine.bullets > 0) this.startFire();
      else if (this.magazine.bullets < this.magazine.capacity) this.startReload();
      else { this.chain = false; this.idle(); }
      return;
    }
    if (p?.kind === 'reload' && !p.refilled && b.time + 1e-9 >= p.releaseAt) {
      p.refilled = true; this.magazine.refill();
      if (target && this.magazine.bullets > 0) { this.startFire({ breaking: true }); return; }
    }
    if (p) {
      if (b.time + 1e-9 < p.readyAt) return;
      if (p.kind === 'fire-begin') this.startLoop(p);
      else if (p.kind === 'reload-begin') this.startReloadLoop();
      else if (p.kind === 'reload') {
        this.phase = null;
        if (this.magazine.bullets < this.magazine.capacity) this.startReload(false);
        else { this.resetAt = b.time + .2; this.idle(); }
      }
      return;
    }
    if (target && this.magazine.bullets > 0 && u.atkCd <= 1e-9)
      this.startFire({ breaking: this.reloadFlag });
    else if (this.magazine.bullets < this.magazine.capacity && (!target || this.magazine.bullets === 0))
      this.startReload();
  }
  stop() {
    this.stopped = true; this.phase = null; this.attackInvalid = false;
    this.talentReady = false; this.magazine.remove(); this.timer?.cancel();
  }
}

export function customizeColdshotKit({ battle: b, id, def, unit: u, kit }) {
  if (id !== COLDSHOT_ID) return;
  const magazine = new ColdshotMagazine(def.raw.arkpedia.elite);
  const controller = new ColdshotController(b, u, magazine), s = def.skill;
  if (!['skcom_atk_up[3]', 'skchr_coldst_2'].includes(s.id) || !Number.isFinite(s.bb.atk)
    || !Number.isFinite(s.duration) || s.duration <= 0
    || def.traitBb.value !== magazine.capacity || def.traitBb.atk_scale !== 1.2
    || def.raw.arkpedia.elite > 0 && (!controller.talent
      || controller.talent.bb['attack@delay'] !== 2 || ![1.2, 1.23, 1.3, 1.33].includes(controller.talent.bb.atk_scale))
    || s.id === 'skchr_coldst_2' && (s.bb.reload_interval !== .8 || s.bb['attack@sluggish'] !== 1))
    throw Error('Missing complete Coldshot selected skill');
  Object.assign(u.mem, { coldshotMagazine: magazine, coldshotController: controller });
  kit.install = null;
  kit.trait = { noAttack: true, install: null, attack: 'ranged', projectile: 'arrow',
    dmgType: 'phys', canHitFly: true, maxTargets: 1, hits: 1, hitAllBlocked: false,
    attackDrivenSkill: true, requiresAcceptedLaunch: true, attackVisual: 'none',
    launchAttack: (_battle, _a, _p, target, info) => controller.fire(target, info) };
  kit.skill = { id: s.id, name: s.name, kind: 'duration', duration: s.duration,
    mods: { atkPct: s.bb.atk }, trigger: { rule: 'NEVER' },
    onStart: () => { if (s.id === 'skchr_coldst_2') controller.switchMode(2); },
    onEnd: () => { if (s.id === 'skchr_coldst_2') controller.switchMode(0); } };
}

export function installColdshot({ battle: b, unit: u, def }) {
  if (def.charId !== COLDSHOT_ID) return;
  const controller = u.mem.coldshotController;
  controller.timer = b.every(b.dt, () => controller.tick(), { owner: u });
  b.on('death', ({ unit }) => { if (unit === u) controller.stop(); }, { owner: u });
}
