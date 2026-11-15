// SPDX-License-Identifier: GPL-3.0-or-later
import { witherCasterChannel } from './arkpedia-enemy-wither-caster.js';
import { globalEnemyStatDebuff } from './arkpedia-enemy-global-debuff.js';
import { epochMark, dreadkazBirth } from './arkpedia-enemy-epoch.js';
import { ammoTheftAttack } from './arkpedia-enemy-ammo-theft.js';
import { heavyPowerArmor } from './arkpedia-enemy-heavy-power-armor.js';
import { dorothyTraps } from './arkpedia-enemy-dorothy.js';
import { markedEnemyDamageShare } from './arkpedia-enemy-damage-share.js';
import { powerArmorEngineer } from './arkpedia-enemy-power-armor-engineers.js';
import { powerArmorDriver, unblockedSanctuary } from './arkpedia-enemy-power-armor-drivers.js';
import { deathConversionAura } from './arkpedia-enemy-death-conversion.js';
import { blockedMeleeProjectileAttack } from './arkpedia-enemy-projectiles.js';
import { exhaustedFlame } from './arkpedia-enemy-exhausted-flame.js';
import { firelightSpecOps } from './arkpedia-enemy-firelight-specops.js';
import { cannoneer, flamecaller } from './arkpedia-enemy-firelight-ranged.js';
import { emberRebirth, burningReedsAttack } from './arkpedia-enemy-flamechaser.js';
// Regular-stage enemy feature runtime: applies the declarative features of
// shared/arkpedia/enemy-features.js to every spawned enemy. Spawn traits set
// flags or attack fields; ability features attach the shared Stronghold
// abilities (content/enemies.js) through its features-only dispatch, never its
// per-enemy kits.
import { fluxFieldCaster, crimsonFormation } from './arkpedia-enemy-flux-fields.js';
import { fluxSplashCaster, fluxViolinist } from './arkpedia-enemy-flux-casters.js';
import { fluxSaxophonist } from './arkpedia-enemy-flux-saxophone.js';
import { gertrude, gertrudeImage } from './arkpedia-enemy-gertrude.js';
import { fluxConditionalAttack, fluxColossus } from './arkpedia-enemy-magic-circuit.js';
import { beacon } from './arkpedia-enemy-beacon.js';
import { mutantSpider } from './arkpedia-enemy-spiders.js';
import { singleGrenadeInfantry } from './arkpedia-enemy-infantry.js';
import { burdenbeastSupplier } from './arkpedia-enemy-burdenbeast.js';
import { crowdDirectionalGuard } from './arkpedia-enemy-directional.js';
import { shamanDeath, whispererChannel } from './arkpedia-enemy-gramophones.js';
import { ratKing } from './arkpedia-enemy-ratking.js';
import { mudrock } from './arkpedia-enemy-mudrock.js';
import { brokenBlades, lampBearer, fragmentDeath, porcelainCaster } from './arkpedia-enemy-wine.js';
import { bladeKnight } from './arkpedia-enemy-stat-debuff.js';
import { knightPair } from './arkpedia-enemy-knights.js';
import { enemyFeature, recordFeatureIds } from '../../../shared/arkpedia/enemy-features.js';
import { installFeatureDispatch, attach, abOf, rebornAbility, featureAbilities, elem, hurt, areaAlliesInTiles } from './enemies.js';
import { periodicDamage } from '../damage.js';
import { unbalancedPeriodicDamage } from './arkpedia-enemy-shift.js';
import { oneShotHpBuff } from './arkpedia-enemy-hp-buff.js';
import { stumpShredder } from './arkpedia-enemy-shredders.js';
import { stageOutcomeCounter } from './arkpedia-stage-outcomes.js';
import { portalCardRemoval } from './arkpedia-enemy-portal.js';
import { visibilityAura } from './arkpedia-enemy-reveal.js';
import { reedsStealth } from './arkpedia-enemy-reeds.js';
import { mireWalker } from './arkpedia-enemy-mire.js';

const ABILITIES = Object.freeze({
  epochMark, dreadkazBirth, witherCasterChannel,
  ammoTheftAttack,
  globalEnemyStatDebuff,
  markedEnemyDamageShare,
  powerArmorDriver, unblockedSanctuary, powerArmorEngineer,
  dorothyTraps,
  heavyPowerArmor:p=>[heavyPowerArmor(p),stageOutcomeCounter({killedKey:'killed'})],
  blockedMeleeProjectileAttack:p=>[blockedMeleeProjectileAttack(p),...(p.killedKey?[stageOutcomeCounter({killedKey:p.killedKey})]:[])],
  deathConversionAura,
  cannoneer, flamecaller, firelightSpecOps, exhaustedFlame,
  emberRebirth, burningReedsAttack,
  reedsStealth,
  mireWalker,
  visibilityAura,
  portalCardRemoval,
  stageOutcomeCounter,
  stumpShredder,
  unbalancedPeriodicDamage,
  oneShotHpBuff,
  permanentStatusResistance: ({value}) => ({spawn(b,e){
    b.applyStatus(e,'resist',{key:'ab:permanentResistance',source:e,value});
  }}),
  beacon,
  fluxConditionalAttack,
  fluxColossus,
  fluxSplashCaster,
  fluxViolinist,
  fluxSaxophonist,
  gertrude,
  gertrudeImage,
  fluxFieldCaster,
  crimsonFormation,
  mutantSpider,
  singleGrenadeInfantry,
  porcelainCaster,
  brokenBlades,
  lampBearer,
  fragmentDeath,
  mudrock,
  ratKing,
  shamanDeath,
  whispererChannel,
  knightPair,
  crowdDirectionalGuard: p => p.supplier ? burdenbeastSupplier(p) : crowdDirectionalGuard(p),
  bladeKnight: p => bladeKnight(p, rebornAbility),
  stageSupplyDrop: ({ token, count, delay }) => ({
    death(c, b, e, a) {
      // Bare catalogue fixtures have no level-owned reward. Stage compilation
      // requires both parameters and a matching card before this can ship.
      if (c.reason !== 'killed' || !token || !count || a.released || e.s.flags.silence) return;
      a.released = true;
      b.after(delay, () => b.grantStageToken(token, count), { holdsBattle: true });
    },
  }),
  reborn: params => rebornAbility(params),
  ...featureAbilities,
  // 持续损失生命: `amount` HP every second, sourceless.
  periodicLoss: ({ amount }) => ({ iv: 1, tick(b, e) { if (amount > 0) b.dealDamage(null, e, periodicDamage(amount)); } }),
  swim: ({ atk }) => ({
    spawn(b, e) { e.mem.erosionImmune = true; },
    tick(b, e) {
      if (!(b.highTide?.active && b._isFlooded?.(e.tileR, e.tileC)) && !e.findBuff('buff_sea')) return;
      b.addBuff(e, { key: 'ab:swim', duration: 1.2, refresh: 'replace', visible: true, mods: { atkPct: atk }, flags: { stealth: true } });
    },
  }),

  pancho: () => ({
    spawn(b, e, a) {
      a.form = 1; a.f = 0; a.b = 0; a.w = 0; a.u = 0; a.whirl = 0;
      e.profile.noAttack = true;
    },
    tick(b, e, a, dt) {
      if (!e.alive) return;
      a.f += dt; a.b += dt; a.w += dt; a.u += dt; a.whirl += dt;
      if (a.f >= 20) { a.f = 0; const k = b.spawnEnemy('enemy_1162_magmot', { pos: [e.tileR, e.tileC] }); if (k) k.s.moveSpeed = 0.5; }
      if (a.b >= 17) { a.b = 0; b.spawnEnemy('enemy_1164_bmbmot_3', { pos: [e.tileR, e.tileC] }); }
      if (a.w >= 18) {
        a.w = 0;
        const t = b.allyUnits.filter(u => u.alive && u.deployed).sort((x, y) => y.s.maxHp - x.s.maxHp)[0];
        if (t) { hurt(b, e, t, e.s.atk * 0.2, 'arts'); elem(b, e, t, 'erosion', e.s.atk * 0.2); }
      }
      if (a.u >= 18) {
        a.u = 0;
        const t = b.allyUnits.filter(u => u.alive && u.deployed).sort((x, y) => y.s.def - x.s.def)[0];
        if (t) { hurt(b, e, t, e.s.atk * 0.5, 'phys'); b.addBuff(t, { key: 'pancho:defdown', duration: 10, mods: { defPct: -0.5 }, visible: true }); }
      }
      if (a.whirl >= 2 && a.form === 2) {
        a.whirl = 0;
        for (const u of areaAlliesInTiles(b, e, e.tileR, e.tileC, 'box', 1)) {
          if (u.alive) { hurt(b, e, u, e.s.atk, 'phys'); elem(b, e, u, 'erosion', e.s.atk * 0.3); }
        }
      }
    },
    killed(c, b, e, a) {
      if (a.form !== 1) return false;
      a.form = 2; e.base.maxHp = e.s.maxHp = 35000; e.base.atk = e.s.atk = 1200; e.base.def = e.s.def = 850;
      e.hp = 35000; e.profile.noAttack = true;
      b.addBuff(e, { key: 'pancho:form2', duration: 10, visible: true, flags: { invulnerable: true } });
      return true;
    },
  }),
  bmbmot: ({ scale, epRatio }) => ({
    death(c, b, e) {
      for (const u of areaAlliesInTiles(b, e, e.tileR, e.tileC, 'box', 1)) {
        if (!u.alive) continue;
        hurt(b, e, u, e.s.atk * scale, 'phys');
        if (epRatio > 0) elem(b, e, u, 'erosion', e.s.atk * epRatio);
      }
    },
  }),
  bleed: ({ ratio }) => ({ iv: 1, tick(b, e) { if (ratio > 0) b.dealDamage(null, e, periodicDamage(e.s.maxHp * ratio)); } }),
  almot: ({ life }) => ({
    spawn(b, e) { e.counted = false; },
    death(c, b, e) { if (life) b.life = Math.max(0, b.life + life); },
  }),
  crash: ({ scale, block }) => ({
    spawn(b, e) { e.blockWeight = Math.max(e.blockWeight ?? 1, block); },
    tick(b, e) {
      const u = e.blockedBy; if (!u || !u.alive || e.mem.crashAt === u.id) return;
      e.mem.crashAt = u.id; hurt(b, e, u, e.s.atk * scale, 'phys');
    },
  }),
  drown: ({ damage }) => ({ iv: 1, tick(b, e) { if ((e.elem?.erosion ?? 0) > 0) b.dealDamage(null, e, periodicDamage(damage)); } }),
  splashCorrosion: ({ ratio }) => ({
    dealt(c, b, e) {
      if (!c.dmg?.isAttack || !c.target) return;
      for (const u of areaAlliesInTiles(b, e, c.target.tileR, c.target.tileC, 'plus', 1)) {
        if (!u.alive || u === c.target) continue;
        hurt(b, e, u, c.dmg.amount ?? 0, c.dmg.type ?? 'phys');
        if (ratio > 0) elem(b, e, u, 'erosion', e.s.atk * ratio);
      }
    },
  }),
});

/** Apply one spawned enemy's feature traits and abilities (its record is `e.def.raw`). */
export function applyEnemyFeatures(battle, e) {
  const record = e.def?.raw;
  // Only compiled catalogue records (shared/arkpedia/enemy-records.js) carry features.
  if (!record?.abilities || !record.talents?.groups) return;
  const abilities = [];
  for (const id of recordFeatureIds(record)) {
    const f = enemyFeature(id);
    if (!f || f.matchesRecord && !f.matchesRecord(record)) continue;
    if (f.trait?.flags) battle.addBuff(e, { key: `feature:${id}`, persist: true, flags: { ...f.trait.flags } });
    if (f.trait?.maxTargets) e.profile.maxTargets = Math.max(e.profile.maxTargets ?? 1, f.trait.maxTargets);
    const ability = typeof f.ability === 'function' ? f.ability(record) : f.ability;
    if (ability) {
      const make = ABILITIES[ability.kind];
      if (!make) throw Error(`Unknown enemy feature ability: ${ability.kind}`);
      const made = make(ability.params(record), abOf(battle, e));
      abilities.push(...(Array.isArray(made) ? made : [made]));
    }
  }
  if (abilities.length) { installFeatureDispatch(battle); abOf(battle, e); attach(battle, e, abilities); }
}

/** Apply features to every enemy this battle spawns; the shared dispatch is installed only when an ability needs it. */
export function installEnemyFeatures(battle) {
  if (battle.regularEnemyFeatures) return;
  battle.regularEnemyFeatures = true;
  battle.on('enemySpawn', ({ enemy }) => applyEnemyFeatures(battle, enemy), { priority: 90 });
}
