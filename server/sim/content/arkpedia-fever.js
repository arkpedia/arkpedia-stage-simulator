// SPDX-License-Identifier: GPL-3.0-or-later
// Ave Mujica Fever (`env_033_fever`): one battle-wide gauge built from
// data/arkpedia-fever-source.json (official feverNeed/feverDuration, the term
// text and every member skill's Fever component).
//
// Read from data: gauge cap and duration; members; "AddFeverBySourceIfNotFull"
// (no gain while full or active); per skill tryJoinFeverOnSkillStart,
// continusCastWhenInFever, leaveFeverWhenSkillEnd, skipSkillStateTickJoinFever
// and the joined buffs' abnormal flags (1 = SP_RECOVER_STOPPED).
// Declared local mappings (not recovered native behaviour):
// - Only a reason==='manual' skill start at a full gauge starts Fever; the
//   official term says any member's manual cast does, and Sakiko's notes say a
//   full-charge auto release does not.
// - Starting Fever empties the gauge and joins every member on the field. A
//   member whose current skill is idle and not continuous-cast is started free
//   ("all members on the field keep releasing their current skill").
// - A joined member's skill timer is held for the Fever window and resumes
//   afterwards; continuous-cast skills are re-cast free whenever idle.
import source from '../../../data/arkpedia-fever-source.json' with {type: 'json'};
export const FEVER_SOURCE = source;
export const FEVER_MEMBERS = Object.freeze(Object.keys(source.members));
const SP_RECOVER_STOPPED = 1;
const live = u => !!u?.alive && u.deployed && !u.hidden;
export class FeverSystem {
  constructor(b) {
    if (b._aveMujicaFever) throw Error('One Fever system per battle');
    Object.assign(this, {b, value: 0, until: null, joined: new Map(), starts: 0});
    this.handles = [
      b.on('tick', () => this.tick()),
      b.on('skillStart', c => this.onSkillStart(c)),
      b.on('skillEnd', c => this.onSkillEnd(c)),
      b.on('removed', ({unit}) => this.leave(unit)),
      b.on('death', ({unit}) => this.leave(unit)),
      b.on('battleEnd', () => this.finish()),
    ];
  }
  get need() { return source.feverNeed; }
  get duration() { return source.feverDuration; }
  get active() { return this.until !== null; }
  get full() { return !this.active && this.value >= this.need; }
  get remaining() { return this.active ? Math.max(0, this.until - this.b.time) : 0; }
  isMember(u) { return u?.kind === 'op' && u.side === 'ally' && Object.hasOwn(source.members, u.defId); }
  members() { return this.b.allyUnits.filter(u => live(u) && this.isMember(u)); }
  /** AddFeverBySourceIfNotFull: only a live member adds, never while full or active. */
  add(from, amount) {
    if (!this.isMember(from) || !live(from) || this.active || !(amount > 0) || this.value >= this.need) return 0;
    const before = this.value;
    this.value = Math.min(this.need, this.value + amount);
    this.b.emit('fever', {source: from, before, value: this.value});
    return this.value - before;
  }
  onSkillStart({unit, skill, reason}) {
    if (!this.isMember(unit) || unit.skill !== skill || this.joined.has(unit)) return;
    const cfg = source.skills[skill.id];
    if (!cfg?._tryJoinFeverOnSkillStart) return;
    if (this.active) this.join(unit);
    else if (this.full && reason === 'manual') this.activate(unit);
  }
  activate(trigger) {
    this.until = this.b.time + this.duration; this.value = 0; this.starts++;
    this.b.emit('feverStart', {trigger, until: this.until});
    this.join(trigger);
    for (const m of this.members()) if (m !== trigger) this.join(m, {start: true});
  }
  join(u, {start = false} = {}) {
    const cfg = source.skills[u.skill?.id];
    if (!cfg || this.joined.has(u) || !live(u)) return false;
    const entry = {seq: u.deploySeq, skill: u.skill, cfg, buffs: []};
    this.joined.set(u, entry);
    if (cfg._skipSkillStateTickJoinFever) (u.skill.timerHolds ??= new Set()).add(this);
    for (const [i, buff] of cfg.buffs.entries()) if (buff.flags.includes(SP_RECOVER_STOPPED)) {
      const key = `fever:${u.id}:${entry.seq}:${i}:${buff.key}`;
      if (this.b.addBuff(u, {key, source: u, flags: {noSp: true}, data: {fever: this}})) entry.buffs.push(key);
    }
    if (start && !u.skill.active && !cfg._continusCastWhenInFever && u.canAct && !u.skill.silenceBlocked)
      u.skill.activate('fever', {free: true});
    return this.joined.has(u);
  }
  tick() {
    if (!this.active) return;
    for (const [u, e] of [...this.joined]) {
      if (!live(u) || u.deploySeq !== e.seq || u.skill !== e.skill) { this.leave(u); continue; }
      if (e.cfg._continusCastWhenInFever && !u.skill.active && u.canAct && !u.skill.silenceBlocked)
        u.skill.activate('fever', {free: true});
    }
    if (this.b.time >= this.until - 1e-9) this.finish();
  }
  onSkillEnd({unit, skill}) {
    const e = this.joined.get(unit);
    if (e && e.skill === skill && e.cfg._leaveFeverWhenSkillEnd) this.leave(unit);
  }
  leave(u) {
    const e = this.joined.get(u);
    if (!e) return;
    this.joined.delete(u);
    e.skill.timerHolds?.delete(this);
    for (const key of e.buffs) if (u.findBuff(key)) this.b.removeBuff(u, key);
  }
  finish() {
    if (!this.active) return;
    this.until = null;
    for (const u of [...this.joined.keys()]) this.leave(u);
    this.b.emit('feverEnd', {});
  }
}
/** The battle's single Fever system, created when a member first needs it. */
export function feverOf(b) { return b._aveMujicaFever ?? (b._aveMujicaFever = new FeverSystem(b)); }
