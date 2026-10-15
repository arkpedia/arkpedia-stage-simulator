// SPDX-License-Identifier: GPL-3.0-or-later
import e from '../../../data/arkpedia-native-operators/char_4196_reckpr.json' with { type: 'json' };
import { RECKPR_ID as ID, selectedReckprBuild, reckprNativeInputs } from './arkpedia-reckpr-source.js';
import { normalizeChess, normSpType } from '../simdata.js';
import { bodyInKeys } from '../body.js';
import { GEO } from '../../../shared/constants.js';
import { isHpLoss } from '../damage.js';
export const RECKPR_CONTRACT = Object.freeze({
  scope: 'Selected original Record Keeper healing, charged dual-target S1, S2 reactive healing and skill-start talent; no public admission',
  mapping: 'Original ally selector uses wounded HP ratio and deployment-order ties; target inputs are captured at cast start. Native OnAttack emits independent speed-ten healing projectiles. Current ATK/healing modifiers are sampled at impact, while the selected S1 scale and S2 recipient effect travel with the shot. Eligible character skill starts in the owner root-tile range refresh one self ASPD buff, then grant selected forced S1 or ordinary S2 SP. Nonfatal accepted damage activates S2 fixed-value healing, including an absorbed hit; injury fill and scripted HP loss do not.',
  limits: 'Native character/category/self-option aliases, equal-HP tie sorting, root-tile geometry, fixed-tick/FSM/cooldown dispatch and all-input-dead S1 refund ordering are explicit simulator mappings. Windup speed is sampled at cast start. Birth is represented by the full source Start clip; the compiled native Born duration is not recovered. Native overrideType3 priority across multiple Record Keepers, compiled zero-HP event ordering and forced-SP gain-hook semantics remain unverified. Public card/art/browser admission, modules, native particles/audio and original frame/pixel parity are separate unfinished work.',
  frameParity: false,
});
const present = a => a?.alive && a.deployed && !a._removing;
const live = a => present(a) && !a.hidden;
const same = (a, z) => JSON.stringify(a) === JSON.stringify(z);
const due = (b, at) => b.time + 1e-8 >= at;
function selected(u, contract) {
  if (contract !== RECKPR_CONTRACT || u.def.charId !== ID || u.deploySeq !== 0 || u.mem.reckpr)
    throw Error('Record Keeper requires a fresh selected owner and explicit source contract');
  const build = { ...u.def.raw.arkpedia, skillId: u.def.skill?.id }, r = selectedReckprBuild(build), s = u.def.skill;
  if (u.def.raw.arkpedia.skillId != null && u.def.raw.arkpedia.skillId !== build.skillId
    || !same(u.def.stats, normalizeChess({ stats: r.stats }).stats) || !same(u.rangeGrid, r.rangeGrid)
    || !same(u.def.tags, r.tags) || !same(u.def.talents.map(t => t.bb), r.talentBb)
    || !same(s.bb, r.bb) || s.skillType !== r.source.skillType || s.durationType !== r.source.durationType
    || s.spType !== normSpType(r.source.spData.spType) || s.spCost !== r.source.spData.spCost
    || s.initSp !== r.source.spData.initSp || s.maxCharges !== r.source.spData.maxChargeTime
    || s.duration !== r.source.duration || !same(s.rangeGrid ?? [], r.skillRangeGrid)) throw Error('Incomplete Record Keeper source selection');
  const n = reckprNativeInputs(), grant = n.talentActions.at(-1);
  if (n.ordinary._animKey !== 'Attack' || n.ordinary._maxAnimScale !== -1 || n.ordinary._useCachedAtkOnly !== 0
    || n.s1._maxAnimScale !== 1 || n.s1Root._recoverSpIfTargetDead !== 1 || n.s1Root._allowSpRecoveryWhenAffecting !== 0
    || n.s2._animKey !== 'Skill_Loop' || n.s2._maxAnimScale !== -1 || n.s2._useCachedAtkOnly !== 0
    || n.s2Root._beginAnim !== 'Skill_Begin' || n.s2Root._attackBlackboardModeIndex !== 1
    || n.talent._selfOption !== 1 || n.talent._removeBuffWhenAbilityDetached !== 1
    || n.talentActions[2]._checkRadius !== false || n.talentActions[2]._autoRange !== true
    || grant._conditionNode._skillIndex !== 1 || grant._succeedNodes[0]._forceFlag !== false
    || grant._failNodes[0]._forceFlag !== true || n.reactiveActions[1]._sourceType !== 'BUFF_SOURCE'
    || n.s2._activeBuffs[0].independentCharacterSource !== 1
    || n.shots.length !== 3 || n.shots.some(v => v.motion._speed !== 10 || v.projectile._stopWhenSourceInvalid !== 0
      || v.projectile._lifeTime !== 10 || v.projectile._maxHitNum !== 1 || v.projectile._managedBySource !== 0)) throw Error('Unreviewed Record Keeper native inputs');
  return r;
}
export class ReckprController {
  constructor(b, u, record) {
    this.b = b; this.u = u; this.record = record; this.seq = null; this.phase = null; this.facing = u.dir;
    this.handles = []; this.stopped = false; this.accepting = false; this.admittingS1 = false; this.visualSeq = 0;
    this.reactiveBuffs = new Map();
  }
  valid() { return !this.stopped && !this.b.finished && present(this.u) && this.seq === this.u.deploySeq; }
  model() { return e.models[ID][this.facing === 'UP' ? 'Back' : 'Front']; }
  visual(clip, speed = 1, loop = false) {
    if (this.model().durations[clip] == null) throw Error('Missing original Record Keeper clip: ' + clip);
    this.u.mem.regularVisualDirection = this.facing;
    this.u.mem.regularFormVisual = { clip, speed, loop, ...(!loop ? { playId: `reckpr:${this.u.deploySeq}:${++this.visualSeq}` } : {}) };
  }
  s2() { return this.record.index === 1 && this.u.skill.active; }
  idle() { this.facing = this.u.dir; this.visual(this.s2() ? 'Skill_Idle' : 'Idle', 1, true); }
  healable(a) { return live(a) && a.kind !== 'device' && a.side === 'ally' && !a.s.flags.untargetable
    && !a.s.flags.healFree && this.b.allySelectable(a, this.u) && (a === this.u || !(a.s.flags.noHeal || a.profile?.noHeal)); }
  targets(count = 1) {
    if (this.b.rangeChanged(this.u)) this.b._refreshRange(this.u);
    return this.b.allyUnits.filter(a => this.healable(a) && a.hp < a.s.maxHp - .01 && bodyInKeys(a, this.u.rangeKeySet))
      .sort((a, z) => a.hpRatio - z.hpRatio || a.deploySeq - z.deploySeq || String(a.id).localeCompare(String(z.id))).slice(0, count);
  }
  face(a) { const x = a.x - this.u.x, y = a.y - this.u.y;
    if (Math.hypot(x, y) > 1e-8) this.facing = Math.abs(y) > Math.abs(x) ? y > 0 ? 'UP' : 'DOWN' : x < 0 ? 'LEFT' : 'RIGHT'; }
  talent(caster) {
    const t = this.record.talentBb[0];
    if (!t || !this.valid() || !live(this.u) || !live(caster) || caster.kind !== 'op'
      || caster.s.flags.untargetable || !this.b.allySelectable(caster, this.u)) return;
    if (this.b.rangeChanged(this.u)) this.b._refreshRange(this.u);
    if (!this.u.rangeKeySet.has(Math.round(caster.y) * GEO.COLS + Math.round(caster.x))) return;
    this.b.addBuff(this.u, { key: `reckpr:talent:${this.u.id}`, source: this.u, duration: t.duration,
      mods: { aspd: t.attack_speed }, refresh: 'replace' });
    if (!this.valid() || !live(this.u) || !this.b.rng.chance(t.prob)) return;
    if (this.record.index === 0) this.u.skill.gainSp(t.sp, 'init', true);
    else this.u.skill.gainSp(t.sp, 'reckpr:talent');
  }
  attachReactive(target) {
    const { b, u, record: r } = this, key = `reckpr:s2:${u.id}`, seq = target.deploySeq;
    const entry = { target, buff: null, hook: null };
    const cleanup = () => { if (entry.hook) b.off(entry.hook); this.reactiveBuffs.delete(entry.buff); };
    const buff = b.addBuff(target, { key, source: u, duration: r.bb['attack@buff_duration'], refresh: 'extend',
      data: { reckprReactiveHeal: r.bb['attack@fixed_heal_value'] }, onRemove: cleanup, onExpire: cleanup });
    if (!buff) return;
    if (!present(target) || target.deploySeq !== seq || target.findBuff(key) !== buff || b.finished) {
      if (target.findBuff(key) === buff) b.removeBuff(target, buff); return;
    }
    if (this.reactiveBuffs.has(buff)) return; // Same-source refresh retains one original listener.
    entry.buff = buff; this.reactiveBuffs.set(buff, entry);
    entry.hook = b.on('damaged', ({ target: a, dmg }) => {
      if (a !== target || a.deploySeq !== seq || !present(a) || !(a.hp > 0) || !dmg || isHpLoss(dmg)
        || dmg.type === 'element' || a.findBuff(key) !== buff || b.finished) return;
      b.heal(u, a, r.bb['attack@fixed_heal_value'], { tags: ['reckpr:reactive'] });
    }, { owner: target });
  }

  admissible(targets) {
    const p = this.phase;
    return this.accepting && this.valid() && live(this.u) && this.u.canAct && !this.u.s.flags.disarm
      && p?.kind === 'attack' && !p.accepted && due(this.b, p.releaseAt) && p.epoch === this.u.attackControlEpoch
      && targets.length > 0 && new Set(targets).size === targets.length
      && targets.every(a => this.healable(a) && p.inputs.some(v => v.unit === a && v.seq === a.deploySeq));
  }
  release(targets) {
    if (!this.admissible(targets)) return false;
    const p = this.phase; p.accepted = true;
    for (const target of targets) {
      if (!this.valid()) break;
      const seq = target.deploySeq;
      this.b.addProjectile({ from: this.u, source: this.u, target, speed: 10, maxAge: 10, visual: 'orb',
        data: { arkpediaTrackedVisual: true, nativeKey: `projectile_chr_reckpr${p.s1 ? '_s1' : p.s2 ? '_s2' : ''}` },
        onHit: ({ target: a }) => {
          if (this.b.finished || a?.deploySeq !== seq || !this.healable(a)) return;
          if (p.s2) this.attachReactive(a);
          this.b.heal(this.u, a, this.u.s.atk * this.u.s.atkScaleMul * (p.s1 ? this.record.bb.heal_scale : 1));
        } });
    }
    return true;
  }
  refundS1() {
    if (!this.u.skill.pending) return;
    this.u.skill.end('target-lost'); this.u.skill.gainSp(this.u.skill.spCost, 'init', true);
  }
  beginS2() { this.phase = { kind: 'begin', until: this.b.time + this.model().durations.Skill_Begin }; this.visual('Skill_Begin'); }
  endS2() { if (this.valid()) { this.phase = null; this.idle(); } }
  tick() {
    if (!this.valid()) return;
    const { b, u } = this; let p = this.phase;
    if (!live(u) || !u.canAct || u.s.flags.disarm || p?.kind === 'attack' && p.epoch !== u.attackControlEpoch) {
      this.phase = null; this.idle(); return;
    }
    if (p?.kind === 'born' || p?.kind === 'begin') { if (!due(b, p.until)) return; this.phase = p = null; }
    if (p) {
      if (!p.released && due(b, p.releaseAt)) {
        p.released = true;
        const targets = p.inputs.filter(v => v.unit.deploySeq === v.seq && this.healable(v.unit)).map(v => v.unit);
        if (!targets.length && p.s1) this.refundS1();
        this.accepting = true;
        try { if (targets.length) b.forceAttack(u, targets); } finally { this.accepting = false; }
      }
      if (!this.valid() || this.phase !== p || !due(b, p.until)) return;
      this.phase = null;
    }
    if (u.atkCd > 1e-9) return;
    let targets = this.targets(); if (!targets.length) { this.idle(); return; }
    if (this.record.index === 0 && u.skill.ready && !u.skill.pending && !u.skill.silenceBlocked) {
      this.admittingS1 = true; try { u.skill.activate('DEFAULT'); } finally { this.admittingS1 = false; }
    }
    const s1 = this.record.index === 0 && u.skill.pending, s2 = this.s2();
    if (s1) targets = this.targets(this.record.bb.max_target);
    if (!targets.length || !this.valid() || !u.canAct || u.s.flags.disarm) return;
    this.face(targets[0]); const clip = s2 ? 'Skill_Loop' : 'Attack';
    const speed = Math.min(s1 ? 1 : Infinity, u.base.bat / u.s.interval);
    const release = this.model().eventPayloads[clip].find(v => v.name === 'OnAttack').time / speed;
    const period = Math.max(u.s.interval, release);
    this.phase = { kind: 'attack', startedAt: b.time, inputs: targets.map(unit => ({ unit, seq: unit.deploySeq })), s1, s2,
      releaseAt: b.time + release, until: b.time + period, epoch: u.attackControlEpoch, accepted: false, released: false };
    u.atkCd = period; this.visual(clip, speed);
  }
  install() {
    if (this.handles.length || this.stopped) throw Error('Record Keeper cannot be reinstalled');
    this.handles = [this.b.on('deploy', ({ unit, move }) => {
      if (unit !== this.u || move) return;
      this.seq = unit.deploySeq; this.facing = unit.dir;
      const until = this.b.time + this.model().durations.Start; unit.mem.regularBornUntil = until;
      this.phase = { kind: 'born', until }; this.visual('Start');
    }, { owner: this.u }), this.b.on('tick', () => {
      if (this.seq !== null && !this.valid()) this.stop(); else this.tick();
    }, { owner: this.u }), this.b.on('skillStart', ({ unit }) => this.talent(unit), { owner: this.u }),
    this.b.on('death', ({ unit }) => { if (unit === this.u) this.stop(); }, { owner: this.u })];
    // Applied recipient buffs and already emitted projectiles outlive the owner.
    this.endHandle = this.b.on('battleEnd', () => {
      this.stop(); for (const [buff, entry] of [...this.reactiveBuffs]) this.b.removeBuff(entry.target, buff);
      this.b.off(this.endHandle);
    });
  }
  stop() { if (this.stopped) return; this.stopped = true; this.phase = null;
    for (const h of this.handles) this.b.off(h); this.handles = [];
    delete this.u.mem.regularFormVisual; delete this.u.mem.regularVisualDirection;
  }
}
export function prepareReckpr(b, u, { contract } = {}) {
  const record = selected(u, contract), controller = new ReckprController(b, u, record); u.mem.reckpr = controller;
  const skill = record.index === 0 ? { kind: 'charges', silenceable: false, flags: { noSp: true }, trigger: { rule: 'NEVER' }, heal: true, attack: {},
    canActivate: () => controller.admittingS1 && controller.valid() && live(u) && u.canAct && !u.s.flags.disarm && controller.targets().length > 0 }
    : { kind: 'duration', silenceable: false, duration: record.source.duration, trigger: { rule: 'NEVER' }, mods: { atkPct: record.bb.atk },
      canActivate: () => controller.valid() && live(u) && u.canAct && !u.s.flags.disarm,
      onStart: () => controller.beginS2(), onEnd: () => controller.endS2() };
  return { record, controller, kit: { talents: [], install: null, skill,
    trait: { noAttack: true, attackDrivenSkill: true, heal: { mode: 'single' }, attack: 'ranged', dmgType: 'heal',
      projectile: 'none', windup: 0, requiresAcceptedLaunch: true,
      acceptAreaAttack: (_b, _u, _p, targets) => controller.admissible(targets),
      launchAreaAttack: (_b, _u, _p, targets) => controller.release(targets) } } };
}
