// SPDX-License-Identifier: GPL-3.0-or-later
import evidence from '../../../data/arkpedia-necrass-prefabs.json' with { type: 'json' };
import { necrassSourceComponent as component } from './arkpedia-necrass-source.js';
import { NECRASS_CORE_CONTRACT, NecrassAttackClock, necrassPresent as present, prepareNecrassCore }
  from './arkpedia-necrass.js';
import { NecrassServants } from './arkpedia-necrass-servants.js';
import { absoluteRangeKeys, canTargetEnemy } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { flattenBlackboard as flat } from '../simdata.js';

export const NECRASS_S3_CONTRACT = Object.freeze({
  scope: 'Necrass selected S3 special-servant factory, owner volley, consumption/upgrades and dragon automatic skill; diagnostic only',
  mapping: 'The first owned servant becomes the source dragon form, keeping heal-free but replacing the ordinary no-recovery restriction. Dragon loss clears the host marker so a later birth can become special. Source talent-four percentage stats, RES, BAT and block apply once. Ordinary capped Rekindle upgrades exclude the dragon. S3 holds the owner attack/SP clock and changes range, then releases the selected count of Arts area strikes, consuming one eligible non-dragon after each. An upgraded sacrifice delivers a second upgrade after the original 0.1-second interval. Six selected effective upgrades cap stats; each group of three adds block/range. Healing uses the localized skill description\'s dragon-max-HP ratio and participates in heal modifiers. Only the dragon can use the source 15-SP/eight-second automatic mode, with capped ordinary Arts attacks and fixed one-second ground-area flame receipts.',
  limits: 'Source begin-completion/loop attachment phase, captured versus release-time searches, numeric post-filter and min-zero automatic trigger interpretation, effective six-stack versus serialized nine-stack precedence, modifier/healing-source identity, shared-engine HP-ratio preservation, heal-at-cap, interruption/resume and end-clock order are explicit simulator policies, not compiled Unity/battle-frame parity. Automatic activation maps the native minTargetNum-zero trigger to SP-full, including empty range. Flame first release maps the original begin duration plus loop event, then native triggerDelta. The kill-checker/kill-mark records are retained, but their compiled interaction with deferred factory dispatch is not certified. Delivered artwork/public battle review, modules and native particles/shaders/audio remain held; missing clips/effects are not substituted.',
  frameParity: false,
});
const TOKEN = 'token_10043_necras_skeltn';
const DRAGON = 'necras_t_4[dragon]', MARK = 'nectas_t_4[has_dragon]';
const live = u => present(u) && !u.hidden;
const due = (b, t) => b.time + 1e-8 >= t;
const grid = id => evidence.tables.ranges[id].grids.map(g => [g.row, g.col]);

function verify() {
  const a = component('8469424609932752988'), root = component('1991942048907629250');
  const d = component('-2236926111745489097'), flame = component('7714322433933395767');
  const upgrade = component('-3088953078403090340')._activeBuffs[0];
  const common = component('-6913750601605429449')._buffs;
  if (a._animKey !== 'Skill_3_Loop' || a._selectTargetTiming !== 1 || a._allowNoTarget !== 1
    || a._projectileKey !== 'projectile_chr_necras_s3' || a._damageType !== 2
    || component('-3834864011557555110')._immediatelyReach !== 1
    || root._beginAnim !== 'Skill_3_Begin' || root._uninterruptibleOnAbilityPredelay !== 1
    || d._animKey !== 'Attack' || d._damageType !== 2 || flame._triggerDelta !== 1
    || flame._damageType !== 2 || upgrade.maxStackCnt !== 9
    || component('2925313330925867565')._minTargetNum !== 0
    || common[0].attributes.abnormalFlags.join(',') !== '12,1'
    || common[1].attributes.abnormalFlags.join(',') !== '7') throw Error('Unreviewed Necrass S3 controllers');
  const t4 = evidence.templates.necras_t_4.eventToActions.ON_BUFF_START[0];
  const consume = evidence.templates.necras_s_3.eventToActions.ON_BUFF_START[0];
  const steps = evidence.templates.necras_upgrade_dragon.eventToActions.ON_BUFF_START;
  if (t4._conditionNode._buffKeys[0] !== MARK || t4._failNodes[0]._buff.buffKey !== DRAGON
    || consume._succeedNodes[2]._buff.triggerInterval !== .10000000149011612
    || consume._succeedNodes[3]._switchToDeadState !== true
    || steps[2]._skipModifierEvent !== false || steps[4]._maxValueKey !== 'max_stack_cnt'
    || steps[6]._dividedParamKey !== 'three' || steps[6]._finalFloor !== true)
    throw Error('Unreviewed Necrass S3 templates');
}

class DragonClock extends NecrassAttackClock {
  constructor(deck, u, special) { super(deck.core, u, { token: true }); this.deck = deck; this.special = special; this.flames = null; }
  clip(type) { return this.special ? { born: 'Start', idle: 'Idle', attack: 'Attack', die: 'Die' }[type] : super.clip(type); }
  flameClip(type) { const prefix = this.u.dir === 'DOWN' ? 'Skill_Down_' : 'Skill_';
    return prefix + { begin: 'Begin', loop: 'Loop', end: 'End' }[type]; }
  startFlames() {
    this.phase = null; this.faceDirection = this.u.dir;
    const m = this.model(), begin = this.flameClip('begin'), loop = this.flameClip('loop');
    this.flames = { next: this.b.time + m.durations[begin] + m.eventPayloads[loop][0].time,
      epoch: this.u.attackControlEpoch, beganAt: this.b.time };
    this.visual(begin);
  }
  endFlames() {
    this.flames = null; this.phase = null;
    if (this.valid() && live(this.u)) {
      const clip = this.flameClip('end'); this.visual(clip);
      this.phase = { kind: 'born', readyAt: this.b.time + this.model().durations[clip] };
    }
  }
  release(t, info) {
    if (!this.flames || !this.u.skill.active) return super.release(t, info);
    const f = this.flames;
    if (!f.allowing || !this.valid() || !live(this.u) || !this.u.canAct || !live(t)
      || f.epoch !== this.u.attackControlEpoch || f.inputs?.get(t) !== t.deploySeq || f.accepted.has(t)
      || !canTargetEnemy(this.u, t, { canHitFly: false }) || t.s.flags.camou && !t.blockedBy) return false;
    f.accepted.add(t);
    this.b.dealDamage(this.u, t, { amount: this.u.s.atk * this.u.s.atkScaleMul * this.u.skill.bb['attack@atk_scale'],
      type: 'arts', isAttack: true, isSkill: true, applyWay: 'melee', attackId: info.attackId,
      tags: ['necrass:dragon-flame'] });
    return true;
  }
  tick() {
    if (!this.special || !this.u.skill.active) { super.tick(); return; }
    const f = this.flames;
    if (!f || !this.valid()) return;
    if (!live(this.u) || !this.u.canAct || f.epoch !== this.u.attackControlEpoch) {
      // Keep the selected duration, but discard this interrupted release.
      f.next = this.b.time + 1; f.epoch = this.u.attackControlEpoch; return;
    }
    if (due(this.b, f.next)) {
      f.next += 1;
      const keys = this.keys();
      const targets = this.b.enemies.filter(t => live(t) && canTargetEnemy(this.u, t, { canHitFly: false })
        && (!t.s.flags.camou || !!t.blockedBy) && bodyInKeys(t, keys));
      f.inputs = new Map(targets.map(t => [t, t.deploySeq])); f.accepted = new Set(); f.allowing = true;
      try { if (targets.length) this.b.forceAttack(this.u, targets); }
      finally { f.allowing = false; f.inputs = null; }
    }
    if (this.flames !== f || !this.valid() || !this.u.skill.active) return;
    if (this.b.time >= f.beganAt + this.model().durations[this.flameClip('begin')])
      this.visual(this.flameClip('loop'), 1, true);
  }
  stop() { this.flames = null; super.stop(); }
}

export class NecrassDragonServants extends NecrassServants {
  constructor(core) { super(core); this.dragon = null; this.reserved = false; this.roles = []; this.delayed = [];
    this.t4 = flat(core.record.talents.find(t => t.prefabKey === '4').blackboard); }
  create(r, c) {
    const special = !this.owns(this.dragon) && !this.reserved;
    if (special) this.reserved = true;
    this.roles.push(special);
    try { return super.create(r, c); }
    finally { this.roles.pop(); if (special) this.reserved = false; }
  }
  tokenClock(t) { return new DragonClock(this, t, this.roles.at(-1)); }
  tokenSkill(get) {
    return { kind: 'duration', attack: {}, duration: this.core.record.tokenRecords[TOKEN].skill.duration,
      trigger: { rule: 'SP_FULL' }, silenceable: false,
      targeting: { rangeGrid: grid(this.core.record.tokenRecords[TOKEN].skill.rangeId) },
      canActivate: () => { const t = get(); return this.valid() && this.owns(t) && this.units.get(t).special
        && live(t) && t.canAct && !t.skill.active; },
      onStart: () => get().mem.necrassServantClock.startFlames(),
      onEnd: () => get()?.mem.necrassServantClock.endFlames() };
  }
  created(t) {
    const s = this.units.get(t); s.special = this.roles.at(-1); s.upgrades = 0;
    if (!s.special) return;
    this.dragon = t; t.mem.necrassForm = 'dragon';
    this.b.removeBuff(t, 'skeltn_block_skill');
    this.b.addBuff(this.u, { key: MARK, source: t });
    this.b.addBuff(t, { key: DRAGON, source: this.u, mods: { hpPct: this.t4.max_hp,
      atkPct: this.t4.atk, defPct: this.t4.def, resFlat: this.t4.magic_resistance,
      batFlat: this.t4.base_attack_time, blockCnt: this.t4.block_cnt } });
    void t.s;
  }
  upgradeCandidates(keys) { return super.upgradeCandidates(keys).filter(t => !this.units.get(t).special); }
  inRangeDragon() { return this.owns(this.dragon) && live(this.dragon)
    && bodyInKeys(this.dragon, this.core.clock.keys()) ? this.dragon : null; }
  upgradeDragon() {
    const t = this.inRangeDragon(); if (!this.valid() || !t) return false;
    const s = this.units.get(t), bb = this.core.record.bb;
    s.upgrades = Math.min(bb['attack@max_stack_cnt'], s.upgrades + 1);
    this.b.removeBuff(t, 'necras_upgrade_dragon');
    this.b.addBuff(t, { key: 'necras_upgrade_dragon', source: this.u, mods: {
      hpPct: s.upgrades * bb['attack@max_hp'], atkPct: s.upgrades * bb['attack@atk'],
      defPct: s.upgrades * bb['attack@def'], resFlat: s.upgrades * bb['attack@magic_resistance'],
      blockCnt: Math.floor(s.upgrades / 3) * bb['attack@block_cnt'],
      rangeExtend: Math.floor(s.upgrades / 3) * bb['attack@ability_range_forward_extend'] } });
    if (!this.valid() || !this.owns(t)) return false;
    // Localized original skill specifies the special servant's HP ratio.
    this.b.heal(this.u, t, t.s.maxHp * bb['attack@hp_ratio'], { ignoreHealFree: true });
    return true;
  }
  sacrifice() {
    if (!this.valid()) return null;
    const keys = this.core.clock.keys();
    const t = this.all().filter(t => !this.units.get(t).special && live(t) && bodyInKeys(t, keys))
      .sort((a, z) => a.id - z.id)[0];
    if (!t) return null;
    const doubled = this.units.get(t).upgraded;
    this.upgradeDragon();
    if (!this.valid() || !this.owns(t)) return null;
    if (doubled) this.delayed.push({ at: this.b.time + .10000000149011612 });
    this.b.retreat(t, { permanent: true, reason: 'necrass-s3-consumed' });
    return t;
  }
  install() {
    super.install(); this.handles.push(this.b.on('death', ({ unit }) => {
      if (unit !== this.dragon) return;
      this.dragon = null; this.b.removeBuff(this.u, MARK);
    }, { owner: this.u }));
  }
  tick() {
    super.tick();
    while (this.valid() && this.delayed.length && due(this.b, this.delayed[0].at)) {
      this.delayed.shift(); this.upgradeDragon();
    }
  }
  stop() { this.delayed.length = 0; super.stop(); this.dragon = null; }
}

export class NecrassS3Skills {
  constructor(core) { this.core = core; this.b = core.b; this.u = core.u; this.deck = core.servants;
    this.bb = core.record.bb; this.phase = null; this.stopped = false; }
  get controlsOwner() { return !!this.phase; }
  active() { return !this.stopped && this.core.valid() && live(this.u) && this.u.skill.active; }
  output() {}
  install() {}
  canCast() { return !this.stopped && this.core.valid() && live(this.u) && this.u.canAct && !this.phase && !this.u.skill.active; }
  spec() { return { kind: 'instant', attack: {}, completeOnAttack: false, silenceable: false,
    trigger: { rule: 'NEVER' }, flags: { noSp: true }, targeting: { rangeGrid: this.core.record.skillRangeGrid },
    canActivate: () => this.canCast(), onStart: () => this.start(), onEnd: () => this.end() }; }
  start() {
    const clock = this.core.clock; clock.phase = null; clock.faceDirection = this.u.dir; this.u.atkCd = 0;
    this.phase = { stage: 'begin', next: this.b.time + clock.model().durations.Skill_3_Begin,
      count: 0, release: null, endAt: null, epoch: this.u.attackControlEpoch };
    clock.visual('Skill_3_Begin');
  }
  strike(p) {
    const keys = this.core.clock.keys();
    const targets = this.b.enemies.filter(t => live(t) && canTargetEnemy(this.u, t, { canHitFly: true })
      && (!t.s.flags.camou || !!t.blockedBy) && bodyInKeys(t, keys)).map(t => ({ t, seq: t.deploySeq }));
    p.count++;
    p.inputs = new Map(targets.map(({ t, seq }) => [t, seq])); p.accepted = new Set(); p.allowing = true;
    try { if (targets.length) this.b.forceAttack(this.u, targets.map(v => v.t)); }
    finally { p.allowing = false; p.inputs = null; }
    if (this.active() && this.phase === p && this.u.canAct && p.epoch === this.u.attackControlEpoch) this.deck.sacrifice();
  }
  release(t, info) {
    const p = this.phase;
    if (!p) return this.core.clock.ordinaryRelease(t, info);
    if (!p.allowing || !this.active() || !this.u.canAct || !live(t)
      || p.epoch !== this.u.attackControlEpoch || p.inputs?.get(t) !== t.deploySeq || p.accepted.has(t)
      || !canTargetEnemy(this.u, t, { canHitFly: true }) || t.s.flags.camou && !t.blockedBy) return false;
    p.accepted.add(t);
    this.b.dealDamage(this.u, t, { amount: this.u.s.atk * this.u.s.atkScaleMul * this.bb['attack@atk_scale'],
      type: 'arts', isAttack: true, isSkill: true, isProjectile: true, applyWay: 'ranged',
      attackId: info.attackId, tags: ['necrass:s3-volley'] });
    return true;
  }
  tick() {
    const p = this.phase; if (!p) return;
    if (!this.active()) { this.u.skill.end('retired'); return; }
    const clock = this.core.clock, m = clock.model();
    if (p.stage === 'begin') {
      if (!due(this.b, p.next)) return;
      p.stage = 'volley'; p.next = this.b.time; p.epoch = this.u.attackControlEpoch;
    }
    if (!this.u.canAct || p.epoch !== this.u.attackControlEpoch) {
      p.release = null; p.epoch = this.u.attackControlEpoch; clock.visual('Skill_3_Idle', 1, true); return;
    }
    if (p.stage === 'end') { if (due(this.b, p.endAt)) this.u.skill.end('volley'); return; }
    if (p.release != null && due(this.b, p.release)) {
      p.release = null; this.strike(p);
      if (!this.active() || this.phase !== p) return;
      if (p.count >= this.bb['attack@necras_s_3[attack_cnt].max_stack_cnt']) {
        p.stage = 'end'; p.endAt = this.b.time + m.durations.Skill_3_End; clock.visual('Skill_3_End'); return;
      }
    }
    if (p.release == null && due(this.b, p.next)) {
      const speed = Math.min(1, this.u.base.bat / this.u.s.interval);
      p.release = this.b.time + m.eventPayloads.Skill_3_Loop[0].time / speed;
      p.next = this.b.time + Math.max(this.u.s.interval, m.eventPayloads.Skill_3_Loop[0].time / speed);
      clock.visual('Skill_3_Loop', speed);
    }
  }
  end() { this.phase = null; this.core.clock.phase = null;
    if (this.core.valid() && live(this.u)) this.core.clock.visual('Idle', 1, true); }
  stop() { if (this.stopped) return; this.stopped = true; this.u.skill?.end('retired'); this.end(); }
}

export function prepareNecrassS3(b, u, { contract } = {}) {
  if (contract !== NECRASS_S3_CONTRACT) throw Error('Necrass requires the reviewed S3 contract');
  if (u.def.skill?.id !== 'skchr_necras_3') throw Error('Necrass S3 requires its original selected skill');
  verify();
  const prepared = prepareNecrassCore(b, u, { contract: NECRASS_CORE_CONTRACT });
  const deck = new NecrassDragonServants(prepared.controller); prepared.controller.servants = deck;
  const skills = new NecrassS3Skills(prepared.controller); prepared.controller.skills = skills;
  prepared.kit.skill = skills.spec(); return { ...prepared, servants: deck, skills };
}
