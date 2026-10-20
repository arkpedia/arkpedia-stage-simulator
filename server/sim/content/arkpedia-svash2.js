// SPDX-License-Identifier: GPL-3.0-or-later
// SilverAsh the Reignfrost (char_1045_svash2), Tactician Vanguard, and his
// Eye of the Snowstorm card (token_10057_svash2_eagle1/2/3, the selected
// skill's overrideTokenKey).
// Source: data/arkpedia-native-operators/char_1045_svash2.json.
//
// From data: talent 1 (svash2_t_1, ON_OWNER_BORN SortDeck): while he is
// deployed the Eye is in the deck and the deck is sorted by deployment cost;
// he and the operators left of the Eye gain `sp` SP on deployment
// (svash2_t_1[sp]) and their next redeployment time x respawn_time
// ([resp] card buff, ratio). Talent 2 (svash2_t_2, Global with tag kjerag,
// selfOption 2): other Kjerag operators are immune to freezing, gain DEF `def`
// and hp_recovery_per_sec_by_max_hp_ratio of max HP a second, doubled
// ([buff_double]) once he has been deployed for `interval` s.
// The card nearest the Eye (svash2_s_1[deck] selectors: next to the right among
// Guard/Sniper/Caster, else next to the right, else next to the left) is the
// skills' "nearest" card.
// S1 (auto): `cost` DP; the nearest card costs svash2_s_1[deck].cost less and
// its next deployment gains a barrier of svash2_s_1[deck].shield x his max HP.
// S2 (manual, 2 charges): up to max_target enemies in range 3-7 take atk_scale
// x ATK Physical, cold for `cold` s and lose stealth for as long
// (svash2_s_2[signal]); the nearest card costs `cost` less; every operator
// card left of the Eye stores one cast (max_stack_cnt): on its deployment it
// casts the same area with its own ATK, 1 s after deployment and 0.4 s apart
// (svash2_s_2[build_set], AOEDamage over range_id, no source).
// S3 (manual, `duration`): range 3-1, enemies in range lose stealth, each attack
// strikes every enemy in range for bird_atk_scale x ATK Physical with
// damage_scale damage taken for weak[limit] s (svash2_s_3[bird_on_self]);
// svash2_s_3[start_cost].cost DP at once, then svash2_s_3[cost].cost every
// svash2_s_3[cost].interval s; the first S3 of a battle swaps the base cost of
// the costliest card (Guard/Sniper/Caster first) and the cheapest card until
// their next deployment (svash2_s_3[sort_once], [deck_build]). The Eye is
// deployable during S3 (eagle_valid): the first operator deployed in S3 takes
// the Eye, and the Eye card moves it onto another deployed operator; on his
// attack rhythm it strikes enemies in that operator's 3-1 range the same way
// (BirdAttack_Ally, [summon_bird]).
// Declared local mappings:
// - While he is deployed the deck stays sorted by current card cost, stable by
//   the original deck order, with the Eye after cards of equal cost.
// - "Left of the Eye" is read from the sorted deck at the moment an operator
//   is deployed; deployed operators are not deck cards.
// - Moving the Eye with its card costs no DP (its cost is refunded).
// - S3's line strike hits every enemy in the 3-1 grid of the striker's facing.
import evidence from '../../../data/arkpedia-native-operators/char_1045_svash2.json' with {type: 'json'};
import review from '../../../data/arkpedia-svash2-runtime-review.json' with {type: 'json'};
import {selectedCNSourceBuild} from './arkpedia-selected-cn-source.js';
import {normalizeChess} from '../simdata.js';
import {absoluteRangeKeys} from '../targeting.js';
import {canDeployInViewport} from '../../../shared/arkpedia/squad.js';
export const SVASH2_ID = 'char_1045_svash2';
export const SVASH2_SKILLS = Object.freeze(['skchr_svash2_1', 'skchr_svash2_2', 'skchr_svash2_3']);
export const SVASH2_EYES = Object.freeze(evidence.tables.character.skills.map(s => s.overrideTokenKey));
export const selectedSvash2Build = build => selectedCNSourceBuild(evidence, SVASH2_ID, build);
const ID = SVASH2_ID, CARD = `summon:${ID}`, live = u => !!u?.alive && u.deployed && !u.hidden;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const grid = id => evidence.tables.ranges[id].grids.map(g => [g.row, g.col]);
const S2_GRID = grid('3-7'), S3_GRID = grid('3-1');
// svash2_s_2[build_set]: the first deploy cast after 1 s, then 0.4 s apart.
const buildSet = evidence.templates['svash2_s_2[build_set]'].eventToActions.ON_BUFF_START[0]._defaultSettings;
const CAST_FIRST = buildSet.find(v => v._key === 'first')?._val ?? buildSet.find(v => v.key === 'first')?.val;
const CAST_NEXT = buildSet.find(v => v._key === 'next')?._val ?? buildSet.find(v => v.key === 'next')?.val;
if (!(Math.abs(CAST_FIRST - 1) < 1e-6 && Math.abs(CAST_NEXT - .4) < 1e-6) || !same(SVASH2_EYES, ['token_10057_svash2_eagle1', 'token_10057_svash2_eagle2', 'token_10057_svash2_eagle3']))
  throw Error('Unreviewed SilverAsh the Reignfrost deploy cast timing or Eye tokens');
const PREFERRED = new Set(['WARRIOR', 'SNIPER', 'CASTER']);
function reviewed(b) {
  const approved = same(review.enabledOperators, [ID]) && review.verification.browser.status === 'passed';
  const candidate = b.regularReviewCandidates?.includes(ID) && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !candidate) || review.frameParity !== false || review.moduleSupport !== false
    || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-svash2-eye-v1')
    throw Error('Missing SilverAsh the Reignfrost runtime review or explicit held browser candidate');
}
export function selectedSvash2Inputs(unit) {
  const skill = unit.def.skill, build = unit.def.raw.arkpedia;
  if (!skill) throw Error('Incomplete original selected SilverAsh the Reignfrost inputs');
  const s = selectedSvash2Build({...build, skillId: skill.id});
  if (unit.def.charId !== ID || !same(unit.def.stats, normalizeChess({stats: s.stats}).stats) || !same(unit.rangeGrid, s.rangeGrid)
    || !same(unit.def.talents.map(t => t.bb), s.talentBb) || !same(skill.bb, s.bb) || skill.spCost !== s.source.spData.spCost)
    throw Error('Incomplete original selected SilverAsh the Reignfrost inputs');
  return s;
}
const model = u => evidence.models[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => u.base.bat / u.s.interval;
const talent = (u, key) => u.def.talents.find(t => t.bb[key] != null)?.bb;
function eyeRecord(b, build, token) {
  const source = b.data.raw.tokens?.[token], phase = source?.phases?.[build.elite];
  if (!source || source.id !== token || !phase) throw Error('Missing reviewed Eye of the Snowstorm source');
  const low = phase.attributesKeyFrames[0], high = phase.attributesKeyFrames.at(-1);
  const ratio = high.level === low.level ? 0 : (build.level - low.level) / (high.level - low.level);
  const stats = Object.fromEntries(Object.entries(low.data).filter(([, v]) => typeof v === 'number')
    .map(([k, v]) => [k, v + ((high.data[k] ?? v) - v) * ratio]));
  for (const k of ['maxHp', 'atk', 'def']) stats[k] = Math.round(stats[k]);
  return {id: token, name: source.name, profession: source.profession, subProfessionId: source.subProfessionId, position: source.position,
    stats, rangeGrid: phase.rangeGrid, dmgType: 'phys', attackKind: 'melee', canHitFly: false, abnormal: [], talents: [], skill: null,
    arkpedia: {elite: build.elite, level: build.level, potential: build.potential}};
}
export class Svash2Owner {
  constructor(b, u) {
    Object.assign(this, {b, u, record: selectedSvash2Inputs(u), seq: null, handles: [], since: 0, kjerag: new Map(), marked: new Set(),
      casts: new Map(), shields: new Map(), swapped: false, eyeHolder: null, eyeMarker: null, nextStrike: 0, nextCost: 0});
  }
  valid() { return live(this.u) && this.u.deploySeq === this.seq && this.u.mem.svash2Owner === this; }
  n() { return this.u.skill?.active ? SVASH2_SKILLS.indexOf(this.u.skill.id) + 1 : 0; }
  // Deck cards: operators not on the field, the summon cards, and the Eye.
  cardCost(id) {
    const {b} = this;
    if (id.startsWith('summon:')) return b.regularSummons.get(id)?.record.stats.cost ?? Infinity;
    return b.cost(id);
  }
  deck() {
    const {b} = this;
    if (!this.valid()) return null;
    const ops = Object.keys(b.bench).filter(id => !b.bench[id].unit?.alive && !b.bench[id].hidden);
    const summons = [...(b.regularSummons?.keys() ?? [])].filter(k => k !== CARD);
    const ids = [...ops, ...summons];
    const rows = ids.map((id, i) => ({id, i, cost: this.cardCost(id), eye: false}));
    rows.push({id: CARD, i: Infinity, cost: this.deckState.record.stats.cost, eye: true});
    rows.sort((p, q) => p.cost - q.cost || (p.eye - q.eye) || p.i - q.i);
    return rows.map(r => r.id);
  }
  order() {
    const deck = this.deck();
    if (!deck) return null;
    const deployed = Object.keys(this.b.bench).filter(id => !deck.includes(id));
    return [...deck, ...deployed];
  }
  profession(id) { return this.b.data.getChess(id)?.raw?.profession ?? this.b.data.getChess(id)?.profession; }
  leftOfEye() { const d = this.deck() ?? [], i = d.indexOf(CARD); return i < 0 ? [] : d.slice(0, i).filter(id => !id.startsWith('summon:')); }
  // svash2_s_1[deck] selectors.
  nearest() {
    const d = this.deck() ?? [], i = d.indexOf(CARD);
    if (i < 0) return null;
    const ops = id => !id.startsWith('summon:') && id !== ID;
    const right = d.slice(i + 1).filter(ops), left = d.slice(0, i).filter(ops).reverse();
    return right.find(id => PREFERRED.has(this.profession(id))) ?? right[0] ?? left[0] ?? null;
  }
  discount(amount) {
    const id = this.nearest(), entry = id && this.b.bench[id];
    if (!entry) return null;
    entry.costDelta = (entry.costDelta ?? 0) - amount;
    return id;
  }
  // Talent 2 aura for other Kjerag operators.
  kjeragTick() {
    const {b, u} = this, t2 = talent(u, 'hp_recovery_per_sec_by_max_hp_ratio'), key = `svash2:t2:${u.id}`;
    const on = !!t2 && this.valid(), double = on && b.time + 1e-9 >= this.since + t2.interval ? 2 : 1;
    const want = on ? b.allyUnits.filter(a => live(a) && a.kind === 'op' && a !== u && b.regularNations?.[a.defId] === 'kjerag') : [];
    for (const [a, k] of [...this.kjerag]) if (!want.includes(a) || k !== double) { if (a.alive) b.removeBuff(a, key); this.kjerag.delete(a); }
    for (const a of want) if (!this.kjerag.has(a)) {
      b.addBuff(a, {key, source: u, mods: {defFlat: t2.def * double, hpRegenRatio: t2.hp_recovery_per_sec_by_max_hp_ratio * double}});
      this.kjerag.set(a, double);
    }
  }
  // An operator deploys: talent 1 SP and the S1 barrier / S2 casts stored on its card.
  deployed(unit, move) {
    const {b, u} = this;
    if (unit === u) {
      if (move) { this.seq = u.deploySeq; return; }
      this.seq = u.deploySeq; this.since = b.time;
      const t1 = talent(u, 'respawn_time');
      if (t1) { u.skill?.gainSp(t1.sp, 'svash2:t1'); this.marked.add(ID); }
      return;
    }
    if (move || unit.kind !== 'op' || !b.bench[unit.defId] || unit.ownerId !== u.ownerId) return;
    const id = unit.defId, t1 = talent(u, 'respawn_time');
    if (this.valid() && t1 && this.lastLeft?.includes(id)) { unit.skill?.gainSp(t1.sp, 'svash2:t1'); this.marked.add(id); }
    const shield = this.shields.get(id);
    if (shield) { this.shields.delete(id); b.addBuff(unit, {key: `svash2:s1:barrier:${u.id}`, source: u, shield}); }
    const casts = this.casts.get(id);
    if (casts) {
      this.casts.delete(id);
      for (let k = 0; k < casts.count; k++) b.after(CAST_FIRST + CAST_NEXT * k, () => { if (live(unit)) this.area(unit, unit.s.atk, casts.bb, true); }, {owner: unit});
    }
    if (this.n() === 3 && !this.eyeHolder) this.moveEye(unit);
  }
  // Talent 1 [resp]: a marked operator's next redeployment time x respawn_time.
  left(unit) {
    const {b, u} = this, t1 = talent(u, 'respawn_time'), id = unit.defId, entry = b.bench[id];
    if (!t1 || !this.marked.has(id) || entry?.unit !== unit) return;
    this.marked.delete(id);
    if (Number.isFinite(entry.readyAt) && entry.readyAt > b.time) entry.readyAt = b.time + (entry.readyAt - b.time) * t1.respawn_time;
  }
  enemiesIn(keys) {
    const out = [];
    for (const k of keys) for (const e of this.b._eb[k] ?? []) if (live(e) && !out.includes(e)) out.push(e);
    return out;
  }
  // S2 area (his cast and the stored deploy casts, which have no source).
  area(src, atk, bb, sourceless) {
    const {b, u} = this, keys = absoluteRangeKeys(S2_GRID, src.tileR, src.tileC, src.dir);
    const targets = this.enemiesIn(keys).sort((p, q) => (q.aggroSeq ?? 0) - (p.aggroSeq ?? 0)).slice(0, bb.max_target);
    for (const e of targets) {
      b.addBuff(e, {key: `svash2:s2:reveal:${u.id}`, source: u, duration: bb.cold, flags: {stealthOff: true}});
      b.dealDamage(sourceless ? null : src, e, {amount: atk * bb.atk_scale, type: 'phys', applyWay: 'melee', isSkill: true, sourceless, tags: ['svash2', 'svash2:s2']});
      if (e.alive) b.applyStatus(e, 'cold', {source: u, duration: bb.cold});
    }
    return targets;
  }
  // S3 strike over the 3-1 grid of the striker.
  strike(src) {
    const {b, u} = this, bb = u.skill.bb, keys = absoluteRangeKeys(S3_GRID, src.tileR, src.tileC, src.dir), atk = u.s.atk;
    const targets = this.enemiesIn(keys);
    for (const e of targets) {
      b.dealDamage(u, e, {amount: atk * bb.bird_atk_scale, type: 'phys', applyWay: 'melee', isSkill: true, isAttack: src === u, tags: ['svash2', src === u ? 'svash2:s3' : 'svash2:eye']});
      if (e.alive) b.addBuff(e, {key: `svash2:s3:weak:${u.id}`, source: u, duration: bb['weak[limit]'], refresh: 'replace', mods: {dmgTakenMul: bb.damage_scale}});
    }
    return targets;
  }
  s3Tick() {
    const {b, u} = this;
    if (this.n() !== 3 || !this.valid()) return;
    const bb = u.skill.bb;
    for (const e of this.enemiesIn(absoluteRangeKeys(S3_GRID, u.tileR, u.tileC, u.dir)))
      if (!e.findBuff(`svash2:s3:reveal:${u.id}`)) b.addBuff(e, {key: `svash2:s3:reveal:${u.id}`, source: u, duration: .2, flags: {stealthOff: true}});
      else e.findBuff(`svash2:s3:reveal:${u.id}`).timeLeft = .2;
    if (b.time + 1e-9 >= this.nextCost) { this.nextCost += bb['svash2_s_3[cost].interval']; b.addDp(u.ownerId, bb['svash2_s_3[cost].cost']); }
    const holder = this.eyeHolder;
    if (holder && !live(holder)) this.moveEye(null);
    if (this.eyeMarker && live(this.eyeHolder)) { this.eyeMarker.x = this.eyeHolder.x; this.eyeMarker.y = this.eyeHolder.y - .45; }
    // BirdAttack_Ally follows his attack rhythm.
    if (this.eyeHolder && b.time + 1e-9 >= this.nextStrike && this.enemiesIn(absoluteRangeKeys(S3_GRID, this.eyeHolder.tileR, this.eyeHolder.tileC, this.eyeHolder.dir)).length) {
      this.nextStrike = b.time + u.s.interval; this.strike(this.eyeHolder);
    }
  }
  moveEye(unit) {
    const {b} = this;
    this.eyeHolder = unit;
    if (unit && !this.eyeMarker) (b.regularVisualProjectiles ??= new Set()).add(this.eyeMarker = {x: unit.x, y: unit.y - .45, color: 0xd9f2ff});
    if (!unit && this.eyeMarker) { b.regularVisualProjectiles?.delete(this.eyeMarker); this.eyeMarker = null; }
  }
  // svash2_s_3[sort_once]: swap the base cost of the costliest and cheapest cards, once per battle.
  swap() {
    const {b} = this;
    if (b.regularSvash2Swapped) return;
    b.regularSvash2Swapped = true;
    const cards = (this.deck() ?? []).filter(id => !id.startsWith('summon:') && id !== ID);
    if (cards.length < 2) return;
    const base = id => b.bench[id].baseCost ?? b.data.getChess(id).stats.cost;
    const top = list => list.reduce((x, y) => base(y) > base(x) ? y : x, list[0]);
    const high = top(cards.filter(id => PREFERRED.has(this.profession(id)))) ?? top(cards);
    const rest = cards.filter(id => id !== high), low = rest.reduce((x, y) => base(y) < base(x) ? y : x, rest[0]);
    const [hb, lb] = [base(high), base(low)];
    b.bench[high].baseCost = lb; b.bench[low].baseCost = hb;
    this.swappedCards = [high, low];
  }
  installDeck() {
    const {b, u} = this, owner = this, token = SVASH2_EYES[SVASH2_SKILLS.indexOf(u.def.skill.id)];
    b.regularSummons ??= new Map();
    const state = {key: CARD, ownerId: ID, tokenId: token, owner: u, record: eyeRecord(b, u.def.raw.arkpedia, token),
      config: {tokenId: token, chooseFacing: false, fixedRotation: true, deploymentSlotCost: 0, refundRatio: 0, deckMarker: true, targetsAlly: true},
      get stock() { return owner.n() === 3 ? 1 : 0; },
      get readyAt() { return 0; },
      deck: {own: () => [], placementError: (r, c) => owner.eyeError(r, c), place: (r, c) => owner.placeEye(r, c),
        retreat: () => { throw Error('The Eye of the Snowstorm cannot be retreated.'); }}};
    b.regularSummons.set(CARD, state); this.deckState = state;
  }
  eyeError(r, c) {
    const {b} = this;
    if (!canDeployInViewport(b.viewport)) return 'Open the fullscreen workspace to deploy.';
    if (b.finished) return 'Battle has ended.';
    if (!this.valid() || this.n() !== 3) return 'The Eye of the Snowstorm is deployable only during Castled King.';
    const a = b.unitAt(r, c);
    if (!live(a) || a.kind !== 'op') return 'Choose a deployed operator.';
    if (a === this.eyeHolder) return 'The Eye is already there.';
    return null;
  }
  placeEye(r, c) {
    const error = this.eyeError(r, c); if (error) throw Error(error);
    this.moveEye(this.b.unitAt(r, c));
    return this.eyeHolder;
  }
  install() {
    const {b, u} = this;
    u.mem.svash2Owner = this;
    this.installDeck();
    b.regularDeckOrder = () => (this.valid() ? this.order() : null);
    this.handles = [
      b.on('deploy', ({unit, move}) => this.deployed(unit, move), {owner: u}),
      b.on('tick', () => { this.lastLeft = this.leftOfEye(); this.kjeragTick(); this.s3Tick(); }, {owner: u}),
      b.on('beforeStatus', ctx => { if (ctx.status === 'freeze' && this.kjerag.has(ctx.target)) ctx.cancel = true; }, {owner: u}),
      b.on('death', ({unit}) => { if (unit === u) this.stop(); else if (unit?.kind === 'op') this.left(unit); }, {owner: u}),
      b.on('battleEnd', () => this.stop(), {owner: u}),
    ];
  }
  stop() {
    const {b, u} = this;
    for (const a of this.kjerag.keys()) if (a.alive) b.removeBuff(a, `svash2:t2:${u.id}`);
    this.kjerag.clear(); this.moveEye(null);
  }
}
export function customizeSvash2Kit({battle: b, id, unit: u, kit}) {
  if (id !== ID) return;
  reviewed(b);
  if (!SVASH2_SKILLS.includes(u.def.skill?.id)) throw Error('Missing original selected SilverAsh the Reignfrost skill');
  const owner = new Svash2Owner(b, u), s = u.def.skill, n = SVASH2_SKILLS.indexOf(s.id) + 1;
  u.mem.svash2Prepared = owner;
  kit.talents = [];
  // AttackA/B/C: three alternating slashes.
  let swing = 0;
  const clips = ['Attack_A', 'Attack_B', 'Attack_C'];
  kit.trait = {...kit.trait, dmgType: 'phys', attack: 'melee', windup: (_b, a) => model(a).hits?.[clips[swing % 3]]?.[0] / rate(a) || 0,
    attackVisual: () => clips[swing % 3], afterAttack: () => { swing++; }};
  if (n === 1) kit.skill = {id: s.id, name: s.name, kind: 'instant', trigger: 'SP_FULL',
    onStart: () => {
      b.addDp(u.ownerId, s.bb.cost);
      const card = owner.discount(s.bb['svash2_s_1[deck].cost']);
      if (card) owner.shields.set(card, u.s.maxHp * s.bb['svash2_s_1[deck].shield']);
    }};
  else if (n === 2) kit.skill = {id: s.id, name: s.name, kind: 'charges', trigger: 'NEVER',
    onStart: () => {
      owner.area(u, u.s.atk, s.bb, false);
      owner.discount(s.bb.cost);
      for (const card of owner.leftOfEye()) {
        const c = owner.casts.get(card) ?? {count: 0, bb: s.bb};
        c.count = Math.min(s.bb.max_stack_cnt, c.count + 1); owner.casts.set(card, c);
      }
    }};
  else kit.skill = {id: s.id, name: s.name, kind: 'duration', trigger: 'NEVER', duration: s.duration,
    targeting: {rangeGrid: owner.record.skillRangeGrid},
    attack: {launchAttack: () => { owner.strike(u); return true; }, requiresAcceptedLaunch: true, attackVisual: () => 'Skill_3_Combat',
      windup: (_b, a) => model(a).hits?.Skill_3_Combat?.[0] / rate(a) || 0},
    onStart: () => {
      u.mem.regularFormVisual = {clip: 'Skill_3_Idle', loop: true, attack: 'Skill_3_Combat'};
      b.addDp(u.ownerId, s.bb['svash2_s_3[start_cost].cost']);
      owner.nextCost = b.time + s.bb['svash2_s_3[cost].interval']; owner.nextStrike = b.time;
      owner.swap();
    },
    onEnd: () => { u.mem.regularFormVisual = null; owner.moveEye(null); }};
}
export function installSvash2({battle: b, unit: u, def}) {
  if (def.charId !== ID) return;
  reviewed(b);
  const owner = u.mem.svash2Prepared;
  if (!owner) throw Error('Missing selected SilverAsh the Reignfrost owner');
  delete u.mem.svash2Prepared; owner.install();
}
