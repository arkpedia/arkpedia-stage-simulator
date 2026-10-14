// SPDX-License-Identifier: GPL-3.0-or-later
// Source-selected S1/S2 diagnostics. S3 and public approval remain separate.
import evidence from '../../../data/arkpedia-necrass-prefabs.json' with { type: 'json' };
import { necrassSourceComponent as component } from './arkpedia-necrass-source.js';
import { necrassPresent as present } from './arkpedia-necrass.js';
import { NECRASS_SERVANT_CONTRACT, prepareNecrassServants } from './arkpedia-necrass-servants.js';
import { canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys } from '../body.js';

export const NECRASS_ACTIVE_SKILLS_CONTRACT = Object.freeze({
  scope: 'Source-selected Necrass S1 resummoning and S2 retained Sleep links/extra factory attempts; diagnostic only',
  mapping: 'S1 retains in-range owned servant lives at cast start, withdraws them at its original Skill_1 event and queues one factory attempt per normal servant or two per upgraded servant. An empty successful cast queues one attempt if no servants remain. S2 retains up to the selected target count, launches speed-100 links after the native 0.63-second predelay and limits each lifetime from projectile birth using hit_duration. Contact applies an infinity-lifetime Sleep composite removed with its link, unless Sleep-immune, and starts immediate then selected-interval Arts receipts using live owner ATK. Only owner output can hurt Sleep while S2 is active. A linked enemy killed while the owned composite remains queues selected additional attempts; ordinary in-range death dispatch remains independent. Both skills hold SP and ordinary owner attacks through their controlled cast/end clocks.',
  limits: 'S1 fixed event playback, captured ally selection, category/tile-queue ordering, original spell interruption, link travel/contact/lifetime phase, first-owner UNIQUE composite precedence, Sleep immunity with continuing damage, silence closing links, final-death bonus ordering and end-animation waits are explicit simulator mappings, not compiled Unity or battle-frame parity. S3 special servant/automatic skill, delivered artwork and public battle review remain held. Missing Back clips and native particles/shaders/audio are not substituted; modules remain unsupported.',
  frameParity: false,
});
const live = u => present(u) && !u.hidden;
const due = (b, t) => b.time + 1e-8 >= t;
const ownedComposites = new WeakMap();
let castSequence = 0;
const tpl = key => evidence.templates[key].eventToActions;

function verify() {
  const s1 = component('5073814702118516303'), s2 = component('1314689493534735288');
  const link = component('6944431263152053826'), hook = component('6331335116720208824');
  if (s1._animKey !== 'Skill_1' || s1._waitForAttackEvent !== 1 || s1._timeMode !== 1
    || s1._allowNoTarget !== 1 || s1._selectTargetTiming !== 0
    || s2._waitForAttackEvent !== 0 || s2._preDelay !== .6299999952316284
    || s2._projectileKey !== 'projectile_chr_necras_s2' || s2._waitForProjectileInvalid !== 1
    || s2._notClearProjectileWhenCastEnd !== 0 || s2._minPostDelayWhenProjectileInvalid !== .3330000042915344
    || link._getLifeTimeFromBB !== 1 || link._keepHitTarget !== 1 || link._isSilenceable !== 1
    || link._dontHitInvincibleTarget !== 1 || link._actionController._detachAllBuffsWhenStopped !== 1
    || component('8382651095960428098')._speed !== 100
    || hook._default.beginAnim !== 'Skill_2_Begin' || hook._default.endAnim !== 'Skill_2_End')
    throw Error('Unreviewed Necrass active native controllers');
  const resummon = tpl('necras_s_1').ON_BUFF_START[0];
  if (resummon._conditionNode._buffKeys[0] !== 'necras_t_1[upgrade]'
    || resummon._succeedNodes.length !== 2 || resummon._failNodes.length !== 1
    || tpl('necras_s_1').ON_BUFF_START[1]._switchToDeadState !== false
    || tpl('necras_s_2').ON_OWNER_FINISH[0]._stackCntKey !== 'additional_token_cnt'
    || tpl('necras_s_2[damage_sleep]').ON_OUTPUT_MODIFIER[0]._sharedFlagIndex !== 'DAMAGE_CAN_HURT_SLEEPING_ENTITY'
    || s2._activeBuffs[0].attributes.abnormalCombos.join(',') !== '0'
    || s2._activeBuffs[0].waitFirstTriggerInterval !== 0 || s2._activeBuffs[0].overrideType !== 2)
    throw Error('Unreviewed Necrass active templates');
  for (const id of ['-2101621998295206321', '-9118866959176795208']) {
    const c = component(id);
    if (c._canSilenced !== 0 || c._canCastDuringBorn !== 1 || c._allowSpRecoveryWhenAffecting !== 0)
      throw Error('Unreviewed Necrass active cast conditions');
  }
}

export class NecrassActiveSkills {
  constructor(core) {
    this.core = core; this.b = core.b; this.u = core.u; this.servants = core.servants;
    this.index = core.record.index; this.bb = core.record.bb;
    this.phase = null; this.links = new Map(); this.flights = new Set(); this.handles = []; this.stopped = false;
  }
  get controlsOwner() { return !!this.phase; }
  get hitsSleep() { return this.index === 1 && this.active(); }
  active() { return !this.stopped && this.core.valid() && live(this.u) && this.u.skill.active; }
  linkActive(l) { return this.active() && this.phase === l.cast && this.links.get(l.t) === l; }
  targets() {
    const keys = this.core.clock.keys();
    const ts = this.b.enemies.filter(t => live(t) && canTargetEnemy(this.u, t, { canHitFly: true })
      && (!t.s.flags.camou || !!t.blockedBy) && bodyInKeys(t, keys));
    sortEnemyTargets(this.b, this.u, ts); return ts.slice(0, this.bb.max_target);
  }
  servantTargets() {
    const keys = this.core.clock.keys();
    return this.servants.all().filter(t => live(t) && !t.s.flags.sleep && !t.s.flags.untargetable
      && !t.s.flags.isolated && bodyInKeys(t, keys));
  }
  canCast() { return !this.stopped && this.core.valid() && live(this.u) && this.u.canAct
    && !this.u.skill.active && !this.phase && (this.index === 0 || this.targets().length > 0); }
  spec() { return { kind: 'instant', attack: {}, completeOnAttack: false, silenceable: false,
    trigger: { rule: 'NEVER' }, flags: { noSp: true }, canActivate: () => this.canCast(),
    onStart: () => this.start(), onEnd: ({ reason }) => this.end(reason) }; }
  output({ source, dmg }) { if (this.hitsSleep && source === this.u) dmg.ignoreSleep = true; }
  start() {
    const now = this.b.time, clock = this.core.clock, model = clock.model();
    const targets = (this.index === 0 ? this.servantTargets() : this.targets()).map(t => ({ t, seq: t.deploySeq }));
    this.phase = { id: ++castSequence, stage: 'begin', targets, epoch: this.u.attackControlEpoch,
      startedAt: now, releaseAt: now + (this.index === 0 ? model.eventPayloads.Skill_1[0].time
        : component('1314689493534735288')._preDelay),
      endAt: this.index === 0 ? now + model.durations.Skill_1 : null, released: false };
    clock.phase = null; this.u.atkCd = 0;
    clock.visual(this.index === 0 ? 'Skill_1' : 'Skill_2_Begin');
  }
  resummon(p) {
    let affected = 0;
    for (const { t, seq } of p.targets) {
      if (!this.active() || this.phase !== p) return;
      if (!this.servants.owns(t) || t.deploySeq !== seq || !live(t)) continue;
      const attempts = this.servants.units.get(t).upgraded ? 2 : 1;
      // Original template creates non-derived factory buffs before Withdraw.
      this.servants.enqueue(attempts); affected++;
      this.b.retreat(t, { permanent: true, reason: 'necrass-s1-resummon' });
      if (!this.active() || this.phase !== p) return;
    }
    if (!affected && this.active() && this.phase === p && this.servants.all().length === 0) this.servants.enqueue();
  }
  launch(p) {
    p.stage = 'links';
    for (const { t, seq } of p.targets) {
      if (!this.active() || this.phase !== p) break;
      if (!live(t) || t.deploySeq !== seq) continue;
      const f = { t, seq, endsAt: this.b.time + this.bb.hit_duration, projectile: null };
      this.flights.add(f);
      f.projectile = this.b.addProjectile({ from: this.u, source: this.u, target: t, speed: 100,
        maxAge: this.bb.hit_duration, visual: 'none', data: { arkpediaTrackedVisual: true,
          projectileKey: 'projectile_chr_necras_s2', necrassCast: p.id },
        onHit: ({ target }) => {
          this.flights.delete(f);
          if (!this.active() || this.phase !== p || target !== t || !live(t) || t.deploySeq !== seq
            || due(this.b, f.endsAt) || this.u.s.flags.silence) return;
          const link = { t, seq, cast: p, endsAt: f.endsAt, next: this.b.time, buff: null };
          this.links.set(t, link); this.admit(link); this.hit(link);
        } });
    }
  }
  admit(l) {
    if (!this.linkActive(l) || !live(l.t) || l.t.deploySeq !== l.seq || l.buff || l.t.s.flags.invulnerable) return;
    const existing = ownedComposites.get(l.t);
    if (existing && existing.owner.linkActive(existing.link) && existing.link.seq === l.seq
      && (existing.admitting || l.t.buffs.includes(existing.link.buff))) return;
    const slot = { owner: this, link: l, admitting: true }; ownedComposites.set(l.t, slot);
    if (!l.t.def.immune?.has('sleep')) this.b.applyStatus(l.t, 'sleep', {
      key: 'necras_s_2', source: this.u, duration: Infinity });
    l.buff = l.t.findBuff('necras_s_2');
    if (!l.buff && this.linkActive(l) && live(l.t)) l.buff = this.b.addBuff(l.t, { key: 'necras_s_2', source: this.u });
    slot.admitting = false;
    if (!l.buff || !this.linkActive(l) || !live(l.t) || l.t.deploySeq !== l.seq || ownedComposites.get(l.t) !== slot) {
      this.drop(l); return;
    }
    const remove = l.buff.onRemove, expire = l.buff.onExpire;
    l.buff.onRemove = ctx => { if (ownedComposites.get(l.t) === slot) ownedComposites.delete(l.t); remove?.(ctx); };
    l.buff.onExpire = ctx => { if (ownedComposites.get(l.t) === slot) ownedComposites.delete(l.t); expire?.(ctx); };
  }
  hit(l) {
    if (!this.linkActive(l) || !live(l.t) || l.t.deploySeq !== l.seq || !l.buff || !l.t.buffs.includes(l.buff)
      || !due(this.b, l.next) || due(this.b, l.endsAt) || l.t.s.flags.invulnerable) return;
    l.next = this.b.time + this.bb.interval;
    this.b.dealDamage(this.u, l.t, { amount: this.u.s.atk * this.bb.atk_scale, type: 'arts',
      isAttack: true, isSkill: true, isProjectile: true, canDodge: true, ignoreSleep: true,
      applyWay: 'none', tags: ['necrass:s2-link'] });
  }
  drop(l) {
    if (this.links.get(l.t) === l) this.links.delete(l.t);
    if (ownedComposites.get(l.t)?.link === l) ownedComposites.delete(l.t);
    if (l.buff) { this.b.removeBuff(l.t, l.buff); l.buff = null; }
  }
  clear() {
    for (const l of [...this.links.values()]) this.drop(l);
    for (const f of this.flights) this.b.projectiles.remove(p => p === f.projectile);
    this.flights.clear();
  }
  tick() {
    const p = this.phase;
    if (!p) return;
    if (!this.active() || !this.u.canAct || p.epoch !== this.u.attackControlEpoch) {
      this.u.skill.end('interrupted'); return;
    }
    if (!p.released && due(this.b, p.releaseAt)) {
      p.released = true;
      if (this.index === 0) this.resummon(p); else this.launch(p);
    }
    if (!this.active() || this.phase !== p) return;
    if (this.index === 0) { if (due(this.b, p.endAt)) this.u.skill.end('cast'); return; }
    for (const f of this.flights) if (!live(f.t) || f.t.deploySeq !== f.seq || f.projectile?.removed || due(this.b, f.endsAt)) {
      this.b.projectiles.remove(q => q === f.projectile); this.flights.delete(f);
    }
    for (const l of [...this.links.values()]) {
      if (!live(l.t) || l.t.deploySeq !== l.seq || due(this.b, l.endsAt) || this.u.s.flags.silence
        || l.buff && !l.t.buffs.includes(l.buff)) { this.drop(l); continue; }
      if (!l.buff) { l.next = this.b.time; this.admit(l); }
      this.hit(l);
    }
    if (p.stage === 'links' && !this.flights.size && !this.links.size) {
      p.stage = 'end'; p.endAt = this.b.time + Math.max(this.core.clock.model().durations.Skill_2_End,
        component('1314689493534735288')._minPostDelayWhenProjectileInvalid);
      this.core.clock.visual('Skill_2_End');
    } else if (p.stage === 'links' && due(this.b, p.startedAt + this.core.clock.model().durations.Skill_2_Begin))
      this.core.clock.visual('Skill_2_Loop', 1, true);
    if (p.stage === 'end' && due(this.b, p.endAt)) this.u.skill.end('links-ended');
  }
  end() {
    this.phase = null; this.clear(); this.core.clock.phase = null;
    if (this.phase) return; // A removal callback may start a new cast.
    if (this.core.valid() && live(this.u)) this.core.clock.visual('Idle', 1, true);
  }
  install() {
    if (this.handles.length || this.stopped) throw Error('Necrass active skills cannot install twice or after retirement');
    this.handles = [this.b.on('death', ({ unit, reason }) => {
      const l = this.links.get(unit);
      if (!l || l.seq !== unit.deploySeq) return;
      if (reason === 'killed' && this.active() && l.buff && unit.buffs.includes(l.buff)
        && ownedComposites.get(unit)?.link === l) this.servants.enqueue(this.bb.additional_token_cnt);
      this.drop(l);
    }, { owner: this.u })];
  }
  stop() { if (this.stopped) return; this.stopped = true; this.u.skill?.end('retired');
    this.end(); for (const h of this.handles) this.b.off(h); this.handles = []; }
}

export function prepareNecrassActiveSkills(b, u, { contract } = {}) {
  if (contract !== NECRASS_ACTIVE_SKILLS_CONTRACT) throw Error('Necrass requires the reviewed active skills contract');
  if (!['skchr_necras_1', 'skchr_necras_2'].includes(u.def.skill?.id)) throw Error('Necrass S3 remains held');
  verify();
  const prepared = prepareNecrassServants(b, u, { contract: NECRASS_SERVANT_CONTRACT });
  const skills = new NecrassActiveSkills(prepared.controller); prepared.controller.skills = skills;
  prepared.kit.skill = skills.spec(); return { ...prepared, skills };
}
