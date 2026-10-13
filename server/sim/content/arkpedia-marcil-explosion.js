// SPDX-License-Identifier: GPL-3.0-or-later
// Source-selected S3 diagnostic, deliberately absent from public registration.
import evidence from '../../../data/arkpedia-marcil-prefabs.json' with { type: 'json' };
import { MARCIL_ID, marcilSourceComponent as component } from './arkpedia-marcil-source.js';
import { MARCIL_MANA_CONTRACT, prepareMarcilMana } from './arkpedia-marcil-mana.js';
import { MarcilAttackController, bindMarcilCombat, verifyMarcilAttackSource } from './arkpedia-marcil-attacks.js';
import { absoluteRangeKeys, canTargetEnemy } from '../targeting.js';
import { rotateOffset } from '../dir.js';
import { bodyInKeys } from '../body.js';
import { makeDamageInfo } from '../damage.js';
import { COLS } from '../constants.js';

export const MARCIL_EXPLOSION_CONTRACT = Object.freeze({
  scope: 'Selected S3 main/extended chanting, cancel-to-release, source mana debits, original clips and separate damage/stun areas diagnostic',
  phases: 'Begin, selected main chant, selected extra chant, original Attack release event and End use local scheduler clocks. Manual extra-chant cancellation releases one explosion; natural completion permits repeated explosions. Centre selection is two forward tiles, shortened at the stage edge, retained at main-chant entry independently of ordinary attack range.',
  mana: 'Half-second main/extra checks require the selected initial cost. Only completed extra chanting marks mana for clearing on departure, including retreat. The first explosion spends skill_cost_min_sp; natural-completion repeats spend sp_cost_extra while affordable, bounded by selected trig_cnt. Each explosion samples ATK before its debit; an unaffordable remainder is retained.',
  area: 'Source x-1 selects blast damage and affected HIGH tiles. Each affected HIGH tile centres its own x-4 stun area; their union uses the shared body/target/status pipeline. Damage is Arts and can hit flying/camouflaged units; sleeping, untargetable and unrevealed stealth inputs are excluded. Stun recipient restrictions remain a local selector mapping.',
  limits: 'Native action chains and PRTS gameplay notes corroborate manual versus completed chanting, mana retention/departure and terrain-centred stun. Compiled Chant phase names, filterType twelve comparator, attack-hook and projectile reach/stop dispatch, transition frames, control interruption, range scale and same-frame callback ordering remain unresolved. PRTS excludes birth activation but the native root permits it; this diagnostic retains the root flag pending review. No permanent terrain mutation is evidenced. Native tile effects/audio, modules, played-stage approval, public registration and Unity frame parity remain held.',
  frameParity: false,
  terrainImplemented: false,
});

const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const due = (b, t) => b.time + 1e-9 >= t;
const grid = id => evidence.tables.ranges[id].grids.map(g => [g.row, g.col]);
const damageGrid = grid('x-1'), stunGrid = grid('x-4');
function actions(key, event) { return evidence.templates[key].eventToActions[event]; }
export function verifyMarcilExplosionSource() {
  verifyMarcilAttackSource();
  const root = component('-7137456302563982919'), chant = component('-8242775219312524871');
  const boom = component('7679756282659340729'), mark = component('8976121251535716793');
  if (root._canCastWithNoSp !== 1 || root._canCastDuringBorn !== 1 || root._canSilenced !== 0
    || root._allowSpRecoveryWhenAffecting !== 0 || chant._suspendableWhenMainChant !== 0
    || chant._suspendableWhenExtraChant !== 1 || boom._projectileKey !== 'projectile_chr_marcil_s3'
    || boom._damageType !== 2 || boom._useCachedAtkOnly !== 0 || boom._waitForAttackEvent !== 0
    || mark._projectileKey !== 'projectile_chr_marcil_s3_mark' || mark._waitForAttackEvent !== 1
    || component('8727007361050776817')._rangeId !== 'x-1'
    || component('4208424976692253937')._rangeId !== 'x-1'
    || component('-306559938176641807')._immediatelyReach !== 1
    || component('-6035414071436143375')._lifeTime !== .10000000149011612
    || component('-7954002355613030620')._managedBySource !== 1
    || component('-7954002355613030620')._lifeTime !== 30)
    throw Error('Unreviewed Marcille S3 native cast/projectile');
  for (const id of ['-7206664855618584135', '-4193721169173085767']) {
    const s = component(id);
    if (s._filterType !== 12 || s._limitTargetNum !== 1 || s._maxNum !== 1)
      throw Error('Unreviewed Marcille S3 tile selector');
  }
  const tileActions = JSON.parse(component('8370765684772869361')._actions.SerializedState);
  const tileSelector = component('8018860855038809329');
  const tileHit = component('8204060961734104305');
  const start = actions('marcil_s_3[boom]', 'ON_BUFF_START');
  const trigger = actions('marcil_s_3[boom]', 'ON_BUFF_TRIGGER')[0];
  if (tileSelector._options.heightType !== 1 || tileSelector._options.checkHeightType !== 1
    || tileSelector._limitTargetNum !== 0 || tileSelector._filterType !== 0
    || tileHit._selector.m_PathID !== '8018860855038809329' || tileHit._ignoreRangeScale !== 1
    || tileHit._onlyCheckHitWhenStop !== 1 || tileHit._onlyCheckHitWhenReachTarget !== 0
    || chant._buffsWhenExtraChantEnd[0].buffKey !== 'marcil_3_extra_chant'
    || tileActions[0]._rangeId !== 'x-4' || tileActions[0]._buffs[0].buffKey !== 'stun'
    || tileActions[1]._effectKey !== 'marcil_skill_03_range_03'
    || start[0]._abilityName !== 'Boom' || start[1]._spString !== 'skill_cost_min_sp'
    || start[1]._isMinis !== true || trigger._conditionNode._checkKey !== 'sp_cost_extra'
    || start[2]._buffKeys[0] !== 'marcil_3_extra_chant' || !start[3].$type.endsWith('IfNot, Assembly-CSharp')
    || start[4]._blackboardKey !== 'no_extra' || start[4]._value !== 1
    || !start[5].$type.endsWith('FinishBuff, Assembly-CSharp')
    || trigger._conditionNode._condType !== 'GE' || trigger._succeedNodes[1]._spString !== 'sp_cost_extra'
    || trigger._succeedNodes[1]._isMinis !== true
    || actions('marcil_3_extra_chant', 'ON_BUFF_FINISH')[2]._blackboardKey !== 'clearSp')
    throw Error('Unreviewed Marcille S3 mana/status actions');
  for (const m of [evidence.models[MARCIL_ID].Front, evidence.models[MARCIL_ID].Back]) {
    const event = m.eventPayloads.Skill_3_Attack;
    if (event.length !== 1 || event[0].name !== 'OnAttack' || event[0].time !== .4000000059604645
      || m.durations.Skill_3_Attack !== 1 || m.durations.Skill_3_Loop !== .667
      || m.durations.Skill_3_End !== 1.833)
      throw Error('Unreviewed Marcille S3 original clip');
  }
}

export class MarcilExplosionController extends MarcilAttackController {
  constructor(...args) { super(...args); this.marker = null; this.explosions = 0; }
  centre() {
    for (let distance = 2; distance >= 0; distance--) {
      const [r,c] = rotateOffset(0, distance, this.u.dir);
      const row = this.u.tileR + r, col = this.u.tileC + c;
      if (this.b.grid.inRect(row, col)) return { row, col, dir: this.u.dir };
    }
    return null;
  }
  canActivate() { return this.valid() && this.mode === 'ordinary' && this.u.canAct
    && !this.u.s.flags.disarm && !this.u.skill.active && !!this.centre(); }
  canCancel() { return this.valid() && this.mode === 's3-extra' && this.u.skill.active
    && this.u.canAct && !this.u.s.flags.disarm; }
  cancel() { if (!this.canCancel()) return false; this.beginVolley(false); return true; }
  start() {
    this.mode = 's3-main'; this.explosions = 0;
    this.phase = { kind: 's3', stage: 'begin', epoch: this.u.attackControlEpoch,
      nextCheck: this.b.time + .5, deadline: this.b.time + this.model().durations.Skill_3_Begin };
    this.visual('Skill_3_Begin');
  }
  clearMarker() {
    if (!this.marker) return;
    const marker = this.marker; this.marker = null;
    this.b.emit('marcilExplosionMarkerEnd', { unit: this.u, marker });
  }
  beginVolley(completedExtraChant) {
    if (!this.valid() || !this.u.skill.active || this.mode !== 's3-extra') return;
    this.mana.controller.markCompletedExtraChant(completedExtraChant);
    this.mode = 's3-volley';
    this.phase.repeatAllowed = completedExtraChant;
    this.phase.stage = 'release';
    this.phase.deadline = this.b.time + this.model().eventPayloads.Skill_3_Attack[0].time;
    this.visual('Skill_3_Attack');
  }
  areaKeys(range, centre = this.marker) {
    if (!centre) return [];
    const { row, col, dir } = centre;
    return absoluteRangeKeys(range, row, col, dir).filter(k => this.b.grid.inRect(Math.floor(k / COLS), k % COLS));
  }
  recipients(keys) {
    keys = new Set(keys);
    return this.b.enemies.filter(t => live(t) && canTargetEnemy(this.u, t, { canHitFly: true })
      && bodyInKeys(t, keys));
  }
  explode(cost) {
    if (!this.valid() || !this.u.skill.active || this.mode !== 's3-volley') return false;
    const amount = this.u.s.atk * this.u.s.atkScaleMul * this.record.bb.atk_scale;
    if (!this.mana.controller.consume(cost)) return false;
    // consume() may emit a buff-removal callback as the wallet crosses zero.
    if (!this.valid() || !this.u.skill.active || this.mode !== 's3-volley') return false;
    const index = ++this.explosions, marker = this.marker;
    const blastKeys = this.areaKeys(damageGrid);
    const highTiles = blastKeys.filter(k => this.b.grid.tiles[k].height === 'HIGH')
      .map(k => ({ row: Math.floor(k / COLS), col: k % COLS, dir: marker.dir }));
    const stunKeys = new Set(highTiles.flatMap(tile => this.areaKeys(stunGrid, tile)));
    const victims = this.recipients(blastKeys), stunned = this.recipients(stunKeys);
    const lives = new Map([...victims, ...stunned].map(t => [t, t.deploySeq]));
    for (const t of victims) {
      if (!this.valid() || !this.u.skill.active || this.marker !== marker) return false;
      if (live(t) && lives.get(t) === t.deploySeq) this.b.dealDamage(this.u, t, makeDamageInfo({ amount, type: 'arts',
        isAttack: true, isSkill: true, isSplash: true, applyWay: 'ranged',
        attackId: `marcil:s3:${this.seq}:${this.serial}:${index}`, tags: ['marcil:s3'] }));
    }
    for (const t of stunned) {
      if (!this.valid() || !this.u.skill.active || this.marker !== marker) return false;
      if (live(t) && lives.get(t) === t.deploySeq) this.b.applyStatus(t, 'stun', { source: this.u, duration: this.record.bb.stun });
    }
    if (!this.valid() || !this.u.skill.active || this.marker !== marker) return false;
    this.b.emit('marcilExplosion', { unit: this.u, index, marker, victims, stunned, highTiles, stunKeys: [...stunKeys], amount, cost,
      mana: this.wallet.value, projectileKey: 'projectile_chr_marcil_s3', terrainImplemented: false });
    return this.valid() && this.u.skill.active && this.marker === marker;
  }
  recover() {
    this.mode = 's3-recovery'; this.phase.stage = 'recovery';
    this.phase.deadline = this.b.time + this.model().durations.Skill_3_End;
    this.clearMarker();
    if (this.valid() && this.u.skill.active && this.mode === 's3-recovery') this.visual('Skill_3_End');
  }
  tick() {
    if (this.mode === 'ordinary') { super.tick(); return; }
    if (!this.valid()) {
      if (!this.stopped && this.u.alive && this.u.deployed && !this.u._removing
        && this.u.hidden && this.seq === this.u.deploySeq)
        this.u.skill.end('hidden');
      return;
    }
    const p = this.phase, { b, u } = this;
    if (!p || !u.canAct || u.s.flags.disarm || p.epoch !== u.attackControlEpoch) {
      u.skill.end('control'); return;
    }
    if (['s3-main', 's3-extra'].includes(this.mode) && due(b, p.nextCheck)) {
      p.nextCheck += .5;
      if (this.wallet.value < this.record.bb.skill_cost_min_sp) { u.skill.end('insufficient-mana'); return; }
    }
    if (!due(b, p.deadline)) return;
    if (p.stage === 'begin') {
      p.stage = 'main'; p.deadline += this.record.bb.chant_duration;
      this.marker = this.centre();
      if (!this.marker) { u.skill.end('invalid-centre'); return; }
      this.visual('Skill_3_Chant', 1, true);
      b.emit('marcilExplosionMarker', { unit: u, marker: this.marker, projectileKey: 'projectile_chr_marcil_s3_mark' });
    } else if (p.stage === 'main') {
      this.mode = 's3-extra'; p.stage = 'extra'; p.deadline += this.record.bb.extra_chant_duration;
      b.emit('marcilExtraChant', { unit: u, marker: this.marker });
    } else if (p.stage === 'extra') this.beginVolley(true);
    else if (p.stage === 'release' || p.stage === 'repeat') {
      const cost = p.stage === 'release' ? this.record.bb.skill_cost_min_sp : this.record.bb.sp_cost_extra;
      if (!this.explode(cost)) {
        if (this.valid() && u.skill.active && this.phase === p) this.recover();
        return;
      }
      if (this.phase !== p || !this.valid()) return;
      if (!p.repeatAllowed || this.wallet.value < this.record.bb.sp_cost_extra || this.explosions > this.record.bb.trig_cnt) this.recover();
      else { p.stage = 'repeat'; p.deadline += this.record.bb.interval; this.visual('Skill_3_Loop', 1, true); }
    } else if (p.stage === 'recovery') u.skill.end('complete');
  }
  end(reason) {
    // Retirement must observe completed extra chanting before clearing its mark.
    if (reason === 'death') { super.end(reason); return; }
    // End can run while hidden, when the live-owner resource API denies writes.
    // Only this same deployment may clear its phase mark; death uses stop().
    if (this.wallet.owner === this.u && this.seq === this.u.deploySeq) this.wallet.completedExtraChant = false;
    this.clearMarker(); super.end(reason);
  }
  install() {
    super.install();
    this.boundEnd = reason => reason === 'manual' ? this.cancel() : this.originalEnd.call(this.u.skill, reason);
    this.u.skill.end = this.boundEnd;
  }
  stop(reason) { super.stop(reason); this.clearMarker(); }
}

export function prepareMarcilExplosion(b, u, { contract } = {}) {
  if (contract !== MARCIL_EXPLOSION_CONTRACT) throw Error('Marcille S3 requires her explicit explosion contract');
  if (u.def.skill?.id !== 'skchr_marcil_3') throw Error('Marcille explosion requires selected S3');
  verifyMarcilExplosionSource();
  const mana = prepareMarcilMana(b, u, { contract: MARCIL_MANA_CONTRACT });
  const controller = new MarcilExplosionController(b, u, mana.record, mana); u.mem.marcilAttacks = controller;
  return bindMarcilCombat(mana, controller);
}
