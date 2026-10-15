// SPDX-License-Identifier: GPL-3.0-or-later
// Selected native S3 respawn/return and combat. Public registration is separate.
import e from '../../../data/arkpedia-mon3tr-prefabs.json' with { type: 'json' };
import { MON3TR_ID as ID, mon3trSourceComponent as component } from './arkpedia-mon3tr-source.js';
import { prepareMon3trHealing, MON3TR_HEALING_CONTRACT } from './arkpedia-mon3tr-healing.js';
import { sourceMoveRespawn } from './arkpedia-source-move.js';
import { canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { COLS } from '../constants.js';

export const MON3TR_S3_CONTRACT = Object.freeze({
  scope: 'Diagnostic selected S3 Reconstruction withdrawal, source respawn, protected origin, True multi-target attacks, immediate self-chain healing and return',
  mapping: 'A valid normal Reconstruction is required. It withdraws before the source Begin pose; after that clip the owner respawns at its tile, preserves HP ratio and selected skill deadline, and creates an invisible zero-slot protected origin marker. Native Front ReStart/Loop/Idle/End and original return Back clips are used. The selected flat HP, ATK, block and base-interval values apply in the reborn mode. Eight-HP pure loss uses the native tenth-second clock. Each accepted attack account hits up to current block count ground targets, including unblocked targets in the original x-4 range, then emits one immediately-reaching self-healing chain. Self is a free jump. End or lethal HP loss returns to the protected origin with a one-second HP floor; a newly deployed normal Reconstruction outside the restored range withdraws with immediate card availability.',
  limits: 'Begin/End clip gates, skill-progress carry, resident-buff carry/rebuild, lethal one-HP repair, marker admission, attack input retention and damage/healing order are explicit local policies. They are checked against serialized source, not recovered compiled FSM or Unity frame parity. Unavailable return tiles fail closed and never displace or revive another deployment. Modules, native particles/audio and public approval remain separate.',
  frameParity: false,
});
const TOKEN = 'token_10050_monstr_prosts', MODE = 'mon3tr:s3-mode', LOCK = 'mon3tr:s3-transition';
const HOME = 'mon3tr:s3-origin', GRACE = 'mon3tr:s3-return-grace';
const present = u => u?.alive && u.deployed && !u._removing;
const live = u => present(u) && !u.hidden;
const due = (b, at) => b.time + 1e-8 >= at;
const front = e.models[ID].Front;
const attackProfile = Object.freeze({ groundOnly: true, canHitFly: false });
function verify() {
  const ctrl = component('1657737257676205052'), atk = component('3674771140734576616');
  const selector = component('3149681640882464744');
  const bleed = component('267648895035992040')._buffs.find(v => v.buffKey === 'monstr_s_3[bleeding]');
  const returns = JSON.parse(component('2981474547507620860')._actions.SerializedState)[2];
  const mover = e.projectiles.projectile_chr_monstr_s3.flatMap(r => r.components).find(r => '_immediatelyReach' in r.data)?.data;
  if (ctrl._canSilenced !== 0 || ctrl._allowSpRecoveryWhenAffecting !== 0 || ctrl._onlyAvailableWhenTokenValid !== 1
    || ctrl._defaultModeIndex !== 2 || ctrl._attackBlackboardModeIndex !== 4 || ctrl._rangeIdModeIndex !== 4
    || atk._damageType !== 3 || atk._waitForAttackEvent !== 1 || atk._animKey !== 'Skill_3_Loop'
    || selector._limitedMaxTargetNumToBlockedCnt !== 1 || selector._targetMotion !== 1
    || bleed.triggerInterval !== .10000000149011612 || bleed.waitFirstTriggerInterval !== 0
    || !mover?._immediatelyReach || returns._conditionNode._ignoreAdvancedBuildableMask !== true
    || returns._failNodes[0].$type !== 'Torappu.Battle.Action.Nodes+InstantKill'
    || returns._succeedNodes[3]._buff.lifeTime !== 1
    || !e.templates['monstr_s_3[reborned_passive]'].eventToActions.ON_BUFF_START.some(n => n._FroceFaceFront === true))
    throw Error('Unreviewed Mon3tr S3 source');
}

export class Mon3trS3Controller {
  constructor(core) {
    this.core = core; this.b = core.b; this.u = core.u; this.record = core.record;
    this.state = null; this.stopped = false; this.handles = [];
  }
  valid(s = this.state) { return !this.stopped && s && this.state === s && this.core.valid() && present(this.u); }
  selfFreeJump() { return this.valid() && this.state.mode === 'combat'; }
  idleClip() { return this.state?.front ? 'Skill_3_Idle' : 'Idle'; }
  targets() { return undefined; } // Normal healing before/after the selected mode.
  attackConfig() { return {}; }
  canCast() {
    const deck = this.core.deck;
    return !this.stopped && !this.state && this.core.valid() && live(this.u) && this.u.canAct
      && !this.u.s.flags.disarm && !this.u.skill.active && !!deck?.valid(deck.point);
  }
  spec() {
    return { kind: 'duration', silenceable: false, trigger: { rule: 'NEVER' }, flags: { noSp: true },
      attack: {}, targeting: { rangeGrid: this.record.skillRangeGrid, noRangeExtend: true },
      canActivate: () => this.canCast(), onStart: () => this.start(), onEnd: ({ reason }) => this.end(reason) };
  }
  modeBuff() {
    const bb = this.record.bb;
    return { key: MODE, source: this.u, mods: { atkPct: bb.atk, hpFlat: bb.max_hp,
      blockCnt: bb.block_cnt, batFlat: bb.base_attack_time }, flags: { noSp: true } };
  }
  policy(active) {
    // Native respawn carries shared HP/skill progress and reconstructs mode
    // abilities. Keep only named reviewed gifts/deck residents, not every buff.
    const carry = this.u.buffs.filter(v => v.tags.includes('mon3tr:coordination-source')
      || v.key === 'mon3tr:coordination-effect' || ['skadi:deck', 'silverash:deck', this.u.skill._buffKey].includes(v.key));
    return { checkBuild: false, clearSp: true, carryBuffKeys: carry.map(v => v.key),
      rebuildBuffs: active ? [this.modeBuff(), { key: 'monstr[free_jump]', source: this.u }]
        : [{ key: GRACE, duration: 1, flags: { undeadable: true } }] };
  }
  pose(clip, loop = false, speed = 1) { this.core.visual(clip, speed, loop); }
  start() {
    const { b, u, core } = this, point = core.deck.point;
    const s = this.state = { mode: 'begin', home: [u.tileR, u.tileC], destination: [point.unit.tileR, point.unit.tileC],
      pointSeq: point.seq, originalDir: u.dir, front: false, marker: null, markerSeq: null,
      readyAt: b.time + core.model().durations.Skill_3_Begin, attack: null, nextLoss: Infinity };
    core.phase = null;
    core.deck.finish(point, { remove: true, reason: 's3-move' });
    if (!this.valid(s)) return;
    b.addBuff(u, { key: LOCK, flags: { noSp: true } });
    if (this.valid(s)) this.pose('Skill_3_Begin');
  }
  refund(s) {
    if (!this.valid(s)) return;
    s.failed = true; this.u.skill.end('move-refused');
    if (!this.core.valid() || !live(this.u)) return;
    this.u.skill.setSpTotal(this.u.skill.spCost); this.b.removeBuff(this.u, LOCK);
    this.state = null; this.core.phase = null; this.core.idle();
  }
  move(s) {
    const { b, u, core } = this;
    if (!this.valid(s) || !u.skill.active) return;
    if (!sourceMoveRespawn(b, u, ...s.destination, this.policy(true))) { this.refund(s); return; }
    if (!this.valid(s) || !u.skill.active) return; // Callback removal is final.
    s.front = true; s.mode = 'reborn'; s.readyAt = b.time + front.durations.Skill_3_ReStart;
    s.nextLoss = b.time; this.pose('Skill_3_ReStart');
    const marker = b.spawnToken(u, TOKEN, ...s.home, { def: core.deck.record, dir: s.originalDir,
      kit: { talents: [], skill: { kind: 'passive' }, trait: { noAttack: true, noBlock: true },
        install: (_b, token) => {
          token.deploymentSlotCost = 0; token.mem.regularHideHp = true;
          token.mem.regularFormVisual = { clip: 'Skill_3', loop: false, speed: 1 };
          token.mem.regularDeathVisual = { hide: true };
          b.addBuff(token, { key: HOME, source: u, persist: true, allowDead: true,
            flags: { invuln: true, isolated: true, untargetable: true, noMove: true, unblockable: true, healFree: true } });
        } } });
    if (!this.valid(s)) {
      if (present(marker)) b._remove(marker, 'mon3tr-marker-cancelled', null, true);
      return;
    }
    s.marker = marker; s.markerSeq = marker?.deploySeq;
    if (!live(marker)) { b.kill(u); return; }
  }
  enemyTargets() {
    const { b, u } = this;
    return sortEnemyTargets(b, u, b.enemiesInKeys([...u.rangeKeySet], u, attackProfile)).slice(0, u.s.blockCnt);
  }
  release(target, info) {
    const s = this.state, p = s?.attack, { b, u } = this;
    if (!this.valid(s) || s.mode !== 'combat' || !this.core.accepting || !u.canAct || u.s.flags.disarm || !p
      || p.epoch !== u.attackControlEpoch || !due(b, p.releaseAt) || p.releasedTargets.has(target)
      || p.inputs.get(target) !== target.deploySeq || !canTargetEnemy(u, target, attackProfile)) return false;
    p.releasedTargets.add(target); p.accepted = true;
    b.dealDamage(u, target, { amount: u.s.atk * u.s.atkScaleMul, type: 'true', isAttack: true, isSkill: true,
      attackId: info.attackId, applyWay: 'melee', tags: ['mon3tr:s3'] });
    return true;
  }
  tick() {
    const s = this.state, { b, u, core } = this;
    if (!this.valid(s)) return;
    if (s.mode === 'begin') { if (due(b, s.readyAt)) this.move(s); return; }
    if (s.mode === 'ending') { if (due(b, s.readyAt)) this.returnHome(s); return; }
    while (this.valid(s) && u.skill.active && due(b, s.nextLoss)) {
      s.nextLoss += .10000000149011612;
      b.loseHp(u, Math.fround(this.record.bb.damage_per_second * .10000000149011612),
        { source: u, silent: true, tags: ['mon3tr:s3-hp-loss'] });
    }
    if (!this.valid(s) || !u.skill.active || s.mode === 'ending') return;
    if (s.mode === 'reborn') { if (!due(b, s.readyAt)) return; s.mode = 'combat'; }
    let p = s.attack;
    if (!u.canAct || u.s.flags.disarm || p && p.epoch !== u.attackControlEpoch) {
      s.attack = null; this.pose('Skill_3_Idle', true); return;
    }
    if (p) {
      if (!p.released && due(b, p.releaseAt)) {
        p.released = true; core.accepting = true;
        try { b.forceAttack(u, [...p.inputs].filter(([a, seq]) => a.deploySeq === seq).map(([a]) => a)); }
        finally { core.accepting = false; }
        if (p.accepted && this.valid(s) && s.mode === 'combat')
          core.chain(u, { amount: u.s.atk * u.s.atkScaleMul * this.record.bb['attack@heal_scale'], tag: 's3', immediate: true });
      }
      if (!this.valid(s) || s.mode !== 'combat' || !due(b, p.readyAt)) return;
      s.attack = null;
    }
    if (u.atkCd > 1e-9) return;
    const targets = this.enemyTargets();
    if (!targets.length) { if (u.mem.regularFormVisual?.clip !== 'Skill_3_Idle') this.pose('Skill_3_Idle', true); return; }
    const speed = Math.min(1, u.s.bat / u.s.interval), release = front.eventPayloads.Skill_3_Loop[0].time / speed;
    const cadence = Math.max(release, u.s.interval);
    s.attack = { inputs: new Map(targets.map(a => [a, a.deploySeq])), releasedTargets: new Set(), accepted: false,
      epoch: u.attackControlEpoch, released: false, releaseAt: b.time + release, readyAt: b.time + cadence };
    u.atkCd = cadence; this.pose('Skill_3_Loop', false, speed);
  }
  end(reason) {
    const s = this.state;
    if (!s || s.failed || this.stopped || !this.core.valid() || !present(this.u) || reason === 'death') return;
    if (s.mode === 'begin') { this.b.removeBuff(this.u, LOCK); this.state = null; this.core.phase = null; this.core.idle(); return; }
    s.mode = 'ending'; s.attack = null; s.readyAt = this.b.time + front.durations.Skill_3_End;
    this.b.addBuff(this.u, { key: LOCK, flags: { noSp: true,
      ...(s.lethal ? { undeadable: true, untargetable: true, healFree: true, unblockable: true } : {}) } });
    if (this.valid(s)) this.pose('Skill_3_End');
  }
  returnHome(s) {
    const { b, u, core } = this;
    if (!this.valid(s)) return;
    if (!live(s.marker) || s.marker.deploySeq !== s.markerSeq) { b.kill(u); return; }
    this.removeMarker(s);
    if (!this.valid(s)) return;
    if (!sourceMoveRespawn(b, u, ...s.home, { ...this.policy(false), allowInPlace: true })) { b.kill(u); return; }
    if (!this.valid(s)) return;
    s.front = false; delete u.mem.regularModelFacing;
    this.state = null; core.phase = { kind: 'born', readyAt: b.time + core.model().durations.Skill_3_Back };
    core.visual('Skill_3_Back');
    // The restored native mode removes a normal point outside the base range
    // with a zero remaining-card cooldown; it never consumes or refunds DP.
    const point = core.deck.point;
    if (core.deck.valid(point) && !u.rangeKeySet.has(point.unit.tileR * COLS + point.unit.tileC)) {
      core.deck.finish(point, { remove: true, reason: 's3-outside-restored-range' });
      if (core.valid()) { core.deck.stock = 1; core.deck.readyAt = b.time; }
    }
  }
  removeMarker(s) {
    const marker = s.marker; s.marker = null;
    if (present(marker)) { marker.mem.regularDeathVisual = { hide: true }; this.b._remove(marker, 'mon3tr-origin-finished', null, true); }
  }
  install() {
    const { b, u, core } = this;
    this.handles = [b.on('sourceMoveBorn', ({ unit }) => { if (unit === u && present(u)) core.seq = u.deploySeq; }, { owner: u }),
      b.on('fatal', ctx => {
        const s = this.state;
        if (ctx.unit !== u || !this.valid(s) || !u.skill.active || !['reborn', 'combat'].includes(s.mode)) return;
        ctx.prevented = true; u.hp = 1; s.lethal = true; u.skill.end('lethal-return');
      }, { owner: u, priority: Number.MAX_SAFE_INTEGER })];
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; if (this.state) this.removeMarker(this.state); this.state = null;
    for (const h of this.handles) this.b.off(h); this.handles = [];
    delete this.u.mem.regularModelFacing;
  }
}
export function prepareMon3trS3(b, u, { contract } = {}) {
  if (contract !== MON3TR_S3_CONTRACT || u.def.skill?.id !== 'skchr_monstr_3')
    throw Error('Mon3tr S3 requires its reviewed selected-skill contract');
  verify();
  const p = prepareMon3trHealing(b, u, { contract: MON3TR_HEALING_CONTRACT }), core = p.controller;
  const skills = new Mon3trS3Controller(core); core.ownerSkills = skills; p.kit.skill = skills.spec();
  const tick = core.tick.bind(core), model = core.model.bind(core), visual = core.visual.bind(core), install = core.install.bind(core);
  core.tick = () => skills.state ? skills.tick() : tick();
  core.model = () => skills.state?.front ? front : model();
  core.visual = (...args) => { visual(...args); if (skills.state?.front) {
    u.mem.regularModelFacing = 'front'; u.mem.regularVisualDirection = 'RIGHT';
  } };
  core.install = () => { install(); skills.install(); };
  const launch = p.kit.trait.launchAttack;
  p.kit.trait.launchAttack = (_b, _u, _prof, target, info) => skills.state ? skills.release(target, info) : launch(_b, _u, _prof, target);
  return { ...p, skills };
}
