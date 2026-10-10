// SPDX-License-Identifier: GPL-3.0-or-later
// Unregistered S1/S2 combat adapter. S3 and the public kit are still held.
import evidence from '../../../data/arkpedia-swire-alter-prefabs.json' with { type: 'json' };
import { SWIRE_ALTER_ID, SWIRE_ECONOMY_CONTRACT, selectedSwireEconomy,
  SwireCoinEconomy } from './arkpedia-swire-alter-economy.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyInKeys, bodyOnTile } from '../body.js';
import { COLS } from '../constants.js';
import { resolveHit } from '../ai.js';

export const SWIRE_BOMB_ID = 'token_10031_swire2_gdtrap';
export const SWIRE_PASSIVE_CONTRACT = Object.freeze({
  selection: 'S1 PRECAST recipient; S2 preferred pre-animation root tile with CAST legality check',
  cadence: 'one accepted composite action per source attack interval; uncapped original clip events',
  tokenAtk: 'owner ATK and attack-scale multiplier sampled at successful placement',
  agedToken: 'age mode captured on PRECAST; one accepted command with a delayed second receipt',
  withdrawal: 'withdraw after the final receipt; already born second receipt survives owner finish',
  limits: 'local dispatch, stat transfer and interruption policy; compiled native frame parity unverified',
  frameParity: false,
});
const flat = rows => Object.fromEntries(rows.map(r => [r.key, r.value]));
const same = (a, z) => JSON.stringify(a) === JSON.stringify(z);
const live = u => u?.alive && u.deployed && !u.hidden && !u._removing;
const grid = id => evidence.tables.ranges[id].grids.map(g => [g.row, g.col]);
const component = (group, id) => {
  const c = Object.values(evidence[group]).flatMap(rs => rs.flatMap(r => r.components))
    .find(c => c.pathId === id)?.data;
  if (!c) throw Error(`Missing Swire native component ${id}`);
  return c;
};
const allySelector = component('characters', '8128235924711153704');
const healAbility = component('characters', '-1464407450805657560');
const spawnAbility = component('characters', '3493383170212372520');
const tokenRoot = component('tokens', '6574921324621103369');
const agedAttack = component('tokens', '-330720896360414967');
const youngAttack = component('tokens', '7792456031847088393');
const bombModel = evidence.tokenModels[SWIRE_BOMB_ID].front;
const bombEvent = bombModel.eventPayloads.Attack.find(e => e.name === 'OnAttack').time;
const model = u => evidence.models[SWIRE_ALTER_ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const grounded = (u, e, ignoreCamou = false) => live(e) && !e.isFlying
  && canTargetEnemy(u, e, { canHitFly: false })
  && (ignoreCamou || !e.s.flags.camou || !!e.blockedBy);

function selectedPassive(u, contract) {
  if (contract !== SWIRE_PASSIVE_CONTRACT) throw Error('Swire passives require the reviewed local contract');
  if (u.def.charId !== SWIRE_ALTER_ID || u.mem.swireCoinEconomy)
    throw Error('Swire passives require a fresh original owner');
  const build = u.def.raw.arkpedia, r = selectedSwireEconomy(build), s = u.def.skill;
  const source = evidence.tables.skills[r.skillId].levels[build.skillRank - 1];
  if (r.index > 1 || s?.id !== build.skillId || s.skillType !== 'PASSIVE' || s.spType !== 'none'
    || s.spCost !== source.spData.spCost || s.initSp !== source.spData.initSp
    || s.maxCharges !== source.spData.maxChargeTime || s.duration !== source.duration
    || !same(s.bb, r.bb) || !same(s.rangeGrid, grid(source.rangeId))
    || !same(u.rangeGrid, grid(evidence.tables.character.phases[build.elite].rangeId)))
    throw Error('Incomplete Swire passive selected skill or range');
  if (allySelector._excludeOwner !== 0 || allySelector._maxNum !== 1 || allySelector._maxHpExcludeEqual !== 0
    || allySelector._maxHpRatio !== .699999988079071 || healAbility._maxAnimScale !== -1
    || spawnAbility._maxAnimScale !== -1 || spawnAbility._selectTargetTiming !== 1
    || tokenRoot._useRealBornTimeFromAnim !== 0 || tokenRoot._occupiedRemainingCharacterCnt !== 0
    || tokenRoot._notShowInDeck !== 1 || tokenRoot._clearProjectileWhenDead !== 0
    || youngAttack._attackType !== 1 || youngAttack._damageType !== 1
    || agedAttack._additionalTimes !== 1 || agedAttack._onlyFeedActiveBuffToFirstOne !== 1
    || agedAttack._waitAttackEventForAllAttacks !== 0 || agedAttack._triggerDelta <= 0)
    throw Error('Unreviewed Swire passive native source');
  if (r.index === 1) {
    const token = flat(evidence.tables.tokenSkills.sktok_swire2_gdtrap.levels[build.skillRank - 1].blackboard);
    if (token['attack@atk_scale'] !== r.bb.atk_scale || token['attack@sluggish'] !== r.bb.sluggish
      || token.duration_switch !== 3) throw Error('Unpaired Champagne Bomb rank');
    r.tokenBb = token;
  }
  return { ...r, build };
}

/** Automatic source token: no hand-deployed card, DP cost or deployment slot.
 * Token table stats remain intact; the owner snapshot is a separate damage
 * source. Native inheritance and callback ordering are explicit local mappings. */
export class SwireChampagneBombs {
  constructor(controller) {
    this.c = controller; this.b = controller.b; this.u = controller.u;
    this.tokens = new Set(); this.outputs = new Set();
    this.finishHook = this.b.on('battleEnd', () => { this.clear(); this.cancelOutputs(); });
  }
  legal(row, col) {
    if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
    const b = this.b, tile = b.grid.tile(row, col), occ = b._occ[row * COLS + col];
    return b.grid.inRect(row, col) && tile.height === 'LOW' && ['MELEE', 'ALL'].includes(tile.build)
      && b.grid.groundPassable(row, col) && !(occ?.alive && occ.deployed)
      && !b.tileReservation(row, col) && !b.downOn(row, col);
  }
  tiles() {
    return absoluteRangeKeys(grid('x-6'), this.u.tileR, this.u.tileC, this.u.dir)
      .map(k => ({ row: Math.floor(k / COLS), col: k % COLS }))
      .filter(t => this.legal(t.row, t.col));
  }
  select() {
    const tiles = this.tiles(), keys = new Set(tiles.map(t => t.row * COLS + t.col));
    if (!tiles.length) return null;
    const candidates = this.b.enemies.filter(e => grounded(this.u, e, true)
      && keys.has(Math.round(e.y) * COLS + Math.round(e.x)));
    sortEnemyTargets(this.b, this.u, candidates);
    if (candidates.length) return { row: Math.round(candidates[0].y), col: Math.round(candidates[0].x) };
    return tiles[Math.floor(this.b.rng() * tiles.length)];
  }
  place(tile) {
    const c = this.c, b = this.b, u = this.u;
    if (!c.valid() || !u.canAct || u.s.flags.disarm || c.wallet.coins < 1
      || !tile || !this.legal(tile.row, tile.col)) return null;
    const phase = evidence.tables.token.phases[c.record.build.elite];
    const def = { name: evidence.tables.token.name, profession: evidence.tables.token.profession,
      subProfessionId: evidence.tables.token.subProfessionId, position: evidence.tables.token.position,
      // These token keyframes are constant across level/promotion. Keep their
      // displayed ATK=100 separate from the local inherited damage snapshot.
      stats: { ...phase.attributesKeyFrames[0].data }, rangeGrid: grid(phase.rangeId),
      arkpedia: { ...c.record.build }, spine: SWIRE_BOMB_ID, avatar: SWIRE_BOMB_ID };
    const damageSnapshot = { atk: u.s.atk, atkScaleMul: u.s.atkScaleMul };
    const kit = { skill: null, trait: { noAttack: true }, install: (battle, t) => {
      t.kind = 'device'; t.deploymentSlotCost = 0;
      t.mem.swireBomb = { owner: u, damageSnapshot, aged: false };
      battle.addBuff(t, { key: 'swire2:device-category', persist: true, allowDead: true,
        flags: { untargetable: true, healFree: true, noSp: true } });
    } };
    const t = b.spawnToken(u, SWIRE_BOMB_ID, tile.row, tile.col, { def, kit, dir: 'RIGHT' });
    if (!t) return null;
    // Spawn and spending form one local transaction. A synchronous deployment
    // hook may invalidate the owner; do not leave an unfunded token behind.
    if (!live(t) || !c.wallet.spend()) {
      if (live(t)) b.retreat(t, { permanent: true, reason: 'swire-placement-cancelled' });
      return null;
    }
    this.tokens.add(t);
    t.mem.regularFormVisual = { clip: 'Start', loop: false, die: null };
    const seq = u.deploySeq, bornAt = b.time;
    let triggered = false;
    const watcher = b.every(b.dt, () => {
      if (!c.valid() || u.deploySeq !== seq || !live(t)) { watcher.cancel(); return; }
      if (triggered) return;
      const aged = b.time + 1e-9 >= bornAt + c.record.tokenBb.duration_switch;
      t.mem.swireBomb.aged = aged;
      if (b.time + 1e-9 >= bornAt + bombModel.durations.Start)
        t.mem.regularFormVisual = { clip: 'Idle', loop: true, die: null };
      // useRealBornTimeFromAnim=0: Start's graphic OnStart does not delay arming.
      const rows = b.enemies.filter(e => grounded(t, e) && bodyOnTile(e, t.tileR, t.tileC));
      sortEnemyTargets(b, t, rows);
      if (!rows.length) return;
      triggered = true; watcher.cancel();
      const target = rows[0], targetSeq = target.deploySeq, epoch = t.attackControlEpoch;
      t.mem.regularFormVisual = { clip: 'Attack', loop: false, die: null };
      b.emit('swireBombTrigger', { owner: u, token: t, target, aged });
      b.after(bombEvent, () => {
        // Only the first accepted birth requires a live token/owner. No new
        // victim is substituted when the captured PRECAST input becomes invalid.
        if (!c.valid() || u.deploySeq !== seq || !live(t) || !t.canAct || t.s.flags.disarm
          || t.attackControlEpoch !== epoch || target.deploySeq !== targetSeq
          || !grounded(t, target) || !bodyOnTile(target, t.tileR, t.tileC)) {
          this.withdraw(t, 'swire-bomb-cancelled'); return;
        }
        const command = { token: t, target, targetSeq, attackId: ++b._attackSeq,
          aged, damageSnapshot, cancelled: false, timer: null };
        this.outputs.add(command); t.stats.attacks++;
        this.hit(command, 0);
        b.emit('attack', { attacker: t, targets: [target], isSkill: true });
        t.skill.onAttackPerformed([target], true, true);
        // Age adds a distinct receipt after the native trigger delta, using
        // the same accepted input and attack identity, not a second selector.
        if (aged && !b.finished && !command.cancelled) command.timer = b.after(agedAttack._triggerDelta,
          () => { this.hit(command, 1); this.finish(command); });
        else this.finish(command);
      }, { owner: t });
    }, { owner: t });
    b.on('death', ({ unit }) => { if (unit === t) { watcher.cancel(); this.tokens.delete(t); } }, { owner: t });
    b.emit('swireBombBirth', { owner: u, token: t, tile: { ...tile }, coins: c.wallet.coins });
    return t;
  }
  hit(command, index) {
    const { b, u } = this, { target, targetSeq, token, damageSnapshot } = command;
    if (b.finished || command.cancelled || target.deploySeq !== targetSeq || !live(target)) return;
    // Supply the captured amount to the ordinary damage pipeline without
    // mutating source statistics. Credit, DEF/minimum damage, dodge, shields,
    // damage hooks and hurt-SP all retain the actual token as their source.
    b.dealDamage(token, target, { amount: damageSnapshot.atk * damageSnapshot.atkScaleMul
      * this.c.record.tokenBb['attack@atk_scale'] * token.s.atkScaleMul,
      type: 'phys', isAttack: true, isSkill: true, applyWay: 'melee', attackId: command.attackId });
    if (index === 0 && target.alive) b.applyStatus(target, 'sluggish',
      { source: token, duration: this.c.record.tokenBb['attack@sluggish'] });
    b.emit('swireBombHit', { owner: u, token, target, index, attackId: command.attackId });
  }
  finish(command) {
    this.outputs.delete(command); this.withdraw(command.token, 'swire-bomb-triggered'); this.releaseFinishHook();
  }
  withdraw(t, reason) {
    if (live(t)) this.b.retreat(t, { permanent: true, reason });
    this.tokens.delete(t);
  }
  clear() { for (const t of this.tokens) this.withdraw(t, 'owner-removed'); this.tokens.clear(); this.releaseFinishHook(); }
  cancelOutputs() {
    for (const c of this.outputs) { c.cancelled = true; c.timer?.cancel(); }
    this.outputs.clear(); this.releaseFinishHook();
  }
  releaseFinishHook() {
    if ((this.c.stopped || this.b.finished) && !this.outputs.size && this.finishHook) {
      this.b.off(this.finishHook); this.finishHook = null;
    }
  }
}

export class SwirePassiveController {
  constructor(b, u, record) {
    this.b = b; this.u = u; this.record = record; this.wallet = null; this.bombs = null;
    this.phase = null; this.stopped = false; this.handles = []; this.epoch = u.attackControlEpoch;
  }
  valid() { return !this.stopped && !this.b.finished && live(this.u) && this.wallet?.valid(); }
  visual(clip, speed = 1, loop = false) { this.u.mem.regularFormVisual = { clip, speed, loop }; }
  enemies() {
    const u = this.u, keys = new Set(absoluteRangeKeys(u.rangeGrid, u.tileR, u.tileC, u.dir));
    const rows = this.b.enemies.filter(e => canTargetEnemy(u, e, { canHitFly: e.blockedBy === u })
      && (!e.s.flags.camou || e.blockedBy === u) && (bodyInKeys(e, keys) || e.blockedBy === u));
    sortEnemyTargets(this.b, u, rows); return rows;
  }
  allies() {
    const u = this.u, keys = absoluteRangeKeys(grid('x-4'), u.tileR, u.tileC, u.dir);
    return this.b.injuredAlliesInKeys(keys, u).filter(a => !a.s.flags.healFree && !a.s.flags.untargetable
      && !a.s.flags.isolated && !a.s.flags.sleep && a.hpRatio <= allySelector._maxHpRatio);
  }
  fire(target, info) {
    const p = this.phase, u = this.u;
    if (!this.valid() || !u.canAct || u.s.flags.disarm || !p || p.kind === 'entrance' || p.accepted
      || p.seq !== u.deploySeq || p.epoch !== u.attackControlEpoch || this.b.time + 1e-9 < p.releaseAt
      || p.target !== target || target.deploySeq !== p.targetSeq) return false;
    if (p.kind === 'heal') {
      if (!this.allies().includes(target) || !this.wallet.spend()) return false;
      p.accepted = true;
      const healed = this.b.heal(u, target, u.s.atk * this.record.bb['attack@heal_scale']);
      this.b.emit('swireHeal', { owner: u, target, healed, attackId: info.attackId });
    } else if (p.kind === 'bomb') {
      const tile = this.bombs.legal(p.tile.row, p.tile.col) ? p.tile : this.bombs.select();
      if (!this.bombs.place(tile)) return false;
      p.accepted = true;
    } else {
      if (!this.enemies().includes(target)) return false;
      p.accepted = true;
      resolveHit(this.b, u, { dmgType: 'phys', atkScale: 1, hits: 1, applyWay: 'melee' }, target,
        { ...info, isSkill: false }, target.x, target.y);
    }
    return true;
  }
  tick() {
    const u = this.u, b = this.b;
    if (!this.valid()) { if (!b.finished && !this.stopped && u.deploySeq === 0) return; this.stop(); return; }
    let p = this.phase;
    if (p?.kind === 'entrance') {
      if (b.time + 1e-9 >= p.readyAt) { this.phase = null; this.visual('Idle', 1, true); }
      this.epoch = u.attackControlEpoch; return;
    }
    if (!u.canAct || u.s.flags.disarm || this.epoch !== u.attackControlEpoch) {
      this.phase = null; this.epoch = u.attackControlEpoch; this.visual('Idle', 1, true); return;
    }
    if (p) {
      if (!p.released && b.time + 1e-9 >= p.releaseAt) {
        p.released = true;
        if (p.target.deploySeq === p.targetSeq) b.forceAttack(u, [p.target]);
        if (!this.valid()) return;
      }
      if (b.time + 1e-9 < p.readyAt) return;
      this.phase = null;
    }
    if (u.atkCd > 1e-9) return;
    const ally = this.record.index === 0 && this.wallet.coins > 0 ? this.allies()[0] : null;
    const tile = this.record.index === 1 && this.wallet.coins > 0 ? this.bombs.select() : null;
    const target = ally ?? (tile ? u : this.enemies()[0]);
    if (!target) { this.visual('Idle', 1, true); return; }
    const kind = ally ? 'heal' : tile ? 'bomb' : 'attack';
    const clip = ally ? 'Skill_1' : tile ? 'Skill_2' : 'Attack', speed = u.base.bat / u.s.interval;
    const event = model(u).eventPayloads[clip].find(e => e.name === 'OnAttack').time / speed;
    this.visual(clip, speed);
    this.phase = { kind, target, targetSeq: target.deploySeq, tile, seq: u.deploySeq,
      epoch: u.attackControlEpoch, releaseAt: b.time + event, readyAt: b.time + Math.max(u.s.interval, event),
      released: false, accepted: false };
    u.atkCd = u.s.interval;
  }
  install() {
    if (this.handles.length || this.stopped) return;
    this.wallet = new SwireCoinEconomy(this.b, this.u, this.record.build, SWIRE_ECONOMY_CONTRACT);
    if (this.record.index === 1) this.bombs = new SwireChampagneBombs(this);
    const b = this.b, u = this.u;
    this.handles = [b.on('tick', () => this.tick(), { owner: u }),
      b.on('deploy', ({ unit }) => {
        if (unit !== u) return;
        this.visual('Start'); this.phase = { kind: 'entrance', readyAt: b.time + model(u).durations.Start };
        this.epoch = u.attackControlEpoch;
      }, { owner: u }), b.on('death', ({ unit }) => { if (unit === u) this.stop(); }, { owner: u }),
      b.on('battleEnd', () => this.stop(), { owner: u })];
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.phase = null; this.bombs?.clear(); this.wallet?.close();
    this.u.mem.regularFormVisual = null;
    for (const h of this.handles) this.b.off(h); this.handles = [];
    if (this.b.finished) this.bombs?.cancelOutputs();
  }
}

/** Private preparation seam only. Reject S3 rather than imply full support. */
export function prepareSwirePassives(b, u, { contract } = {}) {
  const record = selectedPassive(u, contract), controller = new SwirePassiveController(b, u, record);
  const kit = { trait: { noAttack: true, attackDrivenSkill: true, attack: 'melee', projectile: 'none',
    dmgType: 'phys', hits: 1, requiresAcceptedLaunch: true, attackVisual: 'none',
    launchAttack: (_b, _u, _p, t, info) => controller.fire(t, info) },
    skill: { id: record.skillId, name: u.def.skill.name, kind: 'passive', trigger: { rule: 'NEVER' } } };
  return { record, controller, kit };
}
