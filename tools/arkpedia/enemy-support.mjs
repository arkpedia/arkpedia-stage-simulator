// SPDX-License-Identifier: GPL-3.0-or-later
// Derive data/arkpedia-enemy-support.json from the committed enemy catalogue
// and native timing index (shared/arkpedia/enemy-support.js), plus the retained
// native ability evidence, each component of which must hash to the index.
//   node tools/arkpedia/enemy-support.mjs [--check]
import { readFile } from 'node:fs/promises';
import { writeJSONAtomic } from './write-json.mjs';
import { checkDeviceRuntime } from './device-runtime.mjs';
import { createHash } from 'node:crypto';
import { deriveEnemySupport } from '../../shared/arkpedia/enemy-support.js';
import nativeSource from '../../data/arkpedia-cn-native-source.json' with { type: 'json' };
const root = new URL('../../', import.meta.url), OUT = new URL('data/arkpedia-enemy-support.json', root), REGISTRY = new URL('data/arkpedia-regular-enemies.json', root);
const sha = b => createHash('sha256').update(b).digest('hex');
/** Shared talent/handbook names can collide. An addition must not silently
 * unregister previously admitted enemies. Intentional withdrawals use the
 * explicit --allow-removals maintenance flag after reviewing the listed IDs. */
export function assertPreservedEnemySupport(previous, next) {
  const removed = Object.entries(previous.enemies ?? {}).filter(([, row]) => row.policy)
    .map(([id]) => id).filter(id => !next.enemies[id]?.policy).sort();
  if (removed.length) throw Error(`Enemy support would remove ${removed.length} registered records: ${removed.join(', ')}. Fix the regression, or use --allow-removals for an intentional withdrawal.`);
}
/** The evidence, refused unless every indexed component hashes to the index entry it names, every referenced one to
 * its own recorded digest, and its templates come from the pinned buff_template_data. */
export function verifiedNative(evidence, prefabs, indexSha, templatePin) {
  if (evidence.source.sha256 !== indexSha) throw Error('Native ability evidence was extracted from another timing index');
  if (JSON.stringify(evidence.source.templates) !== JSON.stringify(templatePin)) throw Error('Native ability evidence names another template source');
  const projectilePin = nativeSource.bundles.find(row => row.path === 'battle/prefabs/[uc]projectiles.ab');
  if (JSON.stringify(evidence.source.projectiles) !== JSON.stringify(projectilePin)) throw Error('Native projectile evidence names another source');
  const database = evidence.source.buffDatabase;
  if (database?.commit !== nativeSource.source.commit || database?.gitBlob !== 'b588d86b514d61c0025c0d9534f2a4e548aae302'
    || database.sha256 !== '836e1fa34398d7abcbbff7d044d7fc0e425bf628a71017c6dd05a96c4fbb79ec')
    throw Error('Native enemy status database names another source');
  for (const rows of Object.values(evidence.projectiles ?? {})) for (const row of rows)
    if (sha(row.originalJson) !== row.sha256) throw Error('Native projectile evidence digest mismatch');
  for (const [path, comps] of Object.entries(evidence.prefabs)) for (const c of comps) {
    const entry = c.referenced ? null : prefabs[path]?.clockComponents.find(x => x.pathId === c.pathId);
    const ok = c.referenced ? sha(c.originalJson) === c.sha256 && prefabs[path]
      : entry && entry.objectName === c.objectName && sha(c.originalJson) === entry.originalDataSha256;
    if (!ok) throw Error(`Native ability evidence does not match the timing index: ${path} ${c.pathId}`);
    if (c.ancestors && (!entry || JSON.stringify(c.ancestors) !== JSON.stringify(entry.ancestors)))
      throw Error(`Native ability hierarchy does not match the timing index: ${path} ${c.pathId}`);
  }
  return evidence;
}
export async function buildEnemySupport() {
  await checkDeviceRuntime();
  const recordsRaw = await readFile(new URL('data/arkpedia-enemy-records.json', root)), indexRaw = await readFile(new URL('data/arkpedia-enemy-clock-source.json', root));
  const nativeRaw = await readFile(new URL('data/arkpedia-enemy-native-abilities.json', root));
  const records = JSON.parse(recordsRaw), prefabs = JSON.parse(indexRaw).prefabs, native = verifiedNative(JSON.parse(nativeRaw), prefabs, sha(indexRaw), JSON.parse(await readFile(new URL('data/arkpedia-mvp.json', root))).behaviors.source);
  const enemies = deriveEnemySupport(records.enemies, prefabs, native);
  const supported = Object.values(enemies).filter(e => e.policy).length;
  return { schemaVersion: 1,
    scope: 'Derived regular-stage admission from reviewed record and native-feature predicates. Includes basic stat-only enemies and implemented features; see each decision and its documented limits. Not a certificate of client-frame or visual parity.',
    source: { records: { path: 'data/arkpedia-enemy-records.json', sha256: sha(recordsRaw) }, nativeTimingIndex: { path: 'data/arkpedia-enemy-clock-source.json', sha256: sha(indexRaw) },
      nativeAbilities: { path: 'data/arkpedia-enemy-native-abilities.json', sha256: sha(nativeRaw) },
      environmentNativeSource: { path: 'data/arkpedia-environment-native-source.json', sha256: sha(await readFile(new URL('data/arkpedia-environment-native-source.json', root))) },
      saintStatueAnimations: { path: 'data/arkpedia-saint-statues-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-saint-statues-animations.json', root))) },
      isChestAnimations: { path: 'data/arkpedia-is-chests-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-is-chests-animations.json', root))) },
      jesseltonAnimations: { path: 'data/arkpedia-jesselton-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-jesselton-animations.json', root))) },
      prisonerLeaderAnimations: { path: 'data/arkpedia-prisoner-leaders-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-prisoner-leaders-animations.json', root))) },
      sniperPrisonerAnimations: { path: 'data/arkpedia-sniper-prisoner-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-sniper-prisoner-animations.json', root))) },
      epochGuardAnimations: { path: 'data/arkpedia-epoch-guard-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-epoch-guard-animations.json', root))) },
      devourAnimations: { path: 'data/arkpedia-devour-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-devour-animations.json', root))) },
      theresisAnimations: { path: 'data/arkpedia-theresis-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-theresis-animations.json', root))) },
      steamTankAnimations: { path: 'data/arkpedia-steam-tank-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-steam-tank-animations.json', root))) },
      witherTankAnimations: { path: 'data/arkpedia-wither-tank-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-wither-tank-animations.json', root))) },
      witherCasterAnimations: { path: 'data/arkpedia-wither-caster-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-wither-caster-animations.json', root))) },
      prayerAnimations: { path: 'data/arkpedia-prayer-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-prayer-animations.json', root))) },
      shredderAnimations: { path: 'data/arkpedia-shredder-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-shredder-animations.json', root))) },
      deviceNativeSource: { path: 'data/arkpedia-device-native-source.json', sha256: sha(await readFile(new URL('data/arkpedia-device-native-source.json', root))) },
      deviceRuntime: { path: 'data/arkpedia-device-runtime.json', sha256: sha(await readFile(new URL('data/arkpedia-device-runtime.json', root))) },
      whispererAnimations: { path: 'data/arkpedia-whisperer-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-whisperer-animations.json', root))) },
      ratKingAnimations: { path: 'data/arkpedia-ratking-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-ratking-animations.json', root))) },
      spiderAnimations: { path: 'data/arkpedia-spider-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-spider-animations.json', root))) },
      fluxFieldAnimations: { path: 'data/arkpedia-flux-field-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-flux-field-animations.json', root))) },
      fluxSaxophoneAnimations: { path: 'data/arkpedia-flux-saxophone-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-flux-saxophone-animations.json', root))) },
      gertrudeAnimations: { path: 'data/arkpedia-gertrude-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-gertrude-animations.json', root))) },
      magicCircuitAnimations: { path: 'data/arkpedia-magic-circuit-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-magic-circuit-animations.json', root))) },
      infantryAnimations: { path: 'data/arkpedia-infantry-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-infantry-animations.json', root))) },
      mudrockAnimations: { path: 'data/arkpedia-mudrock-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-mudrock-animations.json', root))) },
      wineAnimations: { path: 'data/arkpedia-wine-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-wine-animations.json', root))) },
      fattyAnimations: { path: 'data/arkpedia-fatty-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-fatty-animations.json', root))) },
      bladeAnimations: { path: 'data/arkpedia-blade-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-blade-animations.json', root))) },
      knightAnimations: { path: 'data/arkpedia-knight-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-knight-animations.json', root))) },
      energySiphonContract: { path: 'shared/arkpedia/enemy-energy-siphon-contract.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-energy-siphon-contract.js', root))) },
      energySiphonAnimations: { path: 'data/arkpedia-energy-siphons-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-energy-siphons-animations.json', root))) },
      radioactiveFeatures: { path: 'shared/arkpedia/enemy-radioactive-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-radioactive-features.js', root))) },
      radioactiveAnimations: { path: 'data/arkpedia-radioactive-slugs-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-radioactive-slugs-animations.json', root))) },
      blockerFeatures: { path: 'shared/arkpedia/enemy-blocker-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-blocker-features.js', root))) },
      energyGrantContract: { path: 'shared/arkpedia/enemy-energy-grant-contract.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-energy-grant-contract.js', root))) },
      energyGunnerContract: { path: 'shared/arkpedia/enemy-energy-gunner-contract.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-energy-gunner-contract.js', root))) },
      energyGunnerAnimations: { path: 'data/arkpedia-energy-gunners-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-energy-gunners-animations.json', root))) },
      deviceSpSelector: { path: 'shared/arkpedia/enemy-device-sp-selector-contract.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-device-sp-selector-contract.js', root))) },
      talentBindingContract: { path: 'shared/arkpedia/enemy-talent-binding-contract.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-talent-binding-contract.js', root))) },
      routeSummonContract: { path: 'shared/arkpedia/enemy-route-summon-contract.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-route-summon-contract.js', root))) },
      huiMingFeatures: { path: 'shared/arkpedia/enemy-hui-ming-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-hui-ming-features.js', root))) },
      huiMingAnimations: { path: 'data/arkpedia-hui-ming-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-hui-ming-animations.json', root))) },
      fatherAgenirFeatures: { path: 'shared/arkpedia/enemy-father-agenir-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-father-agenir-features.js', root))) },
      fatherAgenirAnimations: { path: 'data/arkpedia-father-agenir-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-father-agenir-animations.json', root))) },
      rapidCrossbowmanFeatures: { path: 'shared/arkpedia/enemy-rapid-crossbowman-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-rapid-crossbowman-features.js', root))) },
      rapidCrossbowmanAnimations: { path: 'data/arkpedia-rapid-crossbowmen-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-rapid-crossbowmen-animations.json', root))) },
      crossbowmanAmbusherFeatures: { path: 'shared/arkpedia/enemy-crossbowman-ambusher-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-crossbowman-ambusher-features.js', root))) },
      crossbowmanAmbusherAnimations: { path: 'data/arkpedia-crossbowman-ambushers-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-crossbowman-ambushers-animations.json', root))) },
      straightShotFeatures: { path: 'shared/arkpedia/enemy-straight-shot-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-straight-shot-features.js', root))) },
      mateoGuardFeatures: { path: 'shared/arkpedia/enemy-mateo-guard-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-mateo-guard-features.js', root))) },
      mateoGuardAnimations: { path: 'data/arkpedia-mateo-guards-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-mateo-guards-animations.json', root))) },
      shanhaizhongAssassinFeatures: { path: 'shared/arkpedia/enemy-shanhaizhong-assassin-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-shanhaizhong-assassin-features.js', root))) },
      shanhaizhongAssassinAnimations: { path: 'data/arkpedia-shanhaizhong-assassins-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-shanhaizhong-assassins-animations.json', root))) },
      novaKnightFeatures: { path: 'shared/arkpedia/enemy-nova-knight-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-nova-knight-features.js', root))) },
      novaKnightAnimations: { path: 'data/arkpedia-nova-knights-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-nova-knights-animations.json', root))) },
      dylnppFeatures: { path: 'shared/arkpedia/enemy-dylnpp-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-dylnpp-features.js', root))) },
      dylnppAnimations: { path: 'data/arkpedia-dylnpp-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-dylnpp-animations.json', root))) },
      direswineFeatures: { path: 'shared/arkpedia/enemy-direswine-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-direswine-features.js', root))) },
      direswineAnimations: { path: 'data/arkpedia-direswine-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-direswine-animations.json', root))) },
      emperorsBladeFeatures: { path: 'shared/arkpedia/enemy-emperors-blade-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-emperors-blade-features.js', root))) },
      emperorsBladeAnimations: { path: 'data/arkpedia-emperors-blade-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-emperors-blade-animations.json', root))) },
      andoainFeatures: { path: 'shared/arkpedia/enemy-andoain-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-andoain-features.js', root))) },
      andoainAnimations: { path: 'data/arkpedia-andoain-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-andoain-animations.json', root))) },
      theLeaderFeatures: { path: 'shared/arkpedia/enemy-the-leader-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-the-leader-features.js', root))) },
      theLeaderAnimations: { path: 'data/arkpedia-the-leader-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-the-leader-animations.json', root))) },
      mandragoraFeatures: { path: 'shared/arkpedia/enemy-mandragora-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-mandragora-features.js', root))) },
      mandragoraAnimations: { path: 'data/arkpedia-mandragora-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-mandragora-animations.json', root))) },
      awakenBossFeatures: { path: 'shared/arkpedia/enemy-awaken-boss-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-awaken-boss-features.js', root))) },
      awakenAnimations: { path: 'data/arkpedia-awaken-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-awaken-animations.json', root))) },
      mephistoFeatures: { path: 'shared/arkpedia/enemy-mephisto-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-mephisto-features.js', root))) },
      mephistoAnimations: { path: 'data/arkpedia-mephisto-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-mephisto-animations.json', root))) },
      bigUglyThingAnimations: { path: 'data/arkpedia-big-ugly-thing-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-big-ugly-thing-animations.json', root))) },
      bigUglyThingFeatures: { path: 'shared/arkpedia/enemy-big-ugly-thing-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-big-ugly-thing-features.js', root))) },
      manfredAnimations: { path: 'data/arkpedia-manfred-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-manfred-animations.json', root))) },
      manfredFeatures: { path: 'shared/arkpedia/enemy-manfred-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-manfred-features.js', root))) },
      cocoonCageFeatures: { path: 'shared/arkpedia/enemy-cocoon-cage-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-cocoon-cage-features.js', root))) },
      icefieldArtsFeatures: { path: 'shared/arkpedia/enemy-icefield-arts-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-icefield-arts-features.js', root))) },
      icefieldArtsAnimations: { path: 'data/arkpedia-icefield-arts-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-icefield-arts-animations.json', root))) },
      famigliaLimoFeatures: { path: 'shared/arkpedia/enemy-famiglia-limo-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-famiglia-limo-features.js', root))) },
      famigliaLimoAnimations: { path: 'data/arkpedia-famiglia-limos-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-famiglia-limos-animations.json', root))) },
      famigliaCasterFeatures: { path: 'shared/arkpedia/enemy-famiglia-caster-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-famiglia-caster-features.js', root))) },
      famigliaCasterAnimations: { path: 'data/arkpedia-famiglia-casters-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-famiglia-casters-animations.json', root))) },
      famigliaCapoFeatures: { path: 'shared/arkpedia/enemy-famiglia-capo-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-famiglia-capo-features.js', root))) },
      famigliaCapoAnimations: { path: 'data/arkpedia-famiglia-capos-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-famiglia-capos-animations.json', root))) },
      famigliaSilencerFeatures: { path: 'shared/arkpedia/enemy-famiglia-silencer-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-famiglia-silencer-features.js', root))) },
      famigliaSilencerAnimations: { path: 'data/arkpedia-famiglia-silencers-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-famiglia-silencers-animations.json', root))) },
      famigliaCrossbowFeatures: { path: 'shared/arkpedia/enemy-famiglia-crossbow-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-famiglia-crossbow-features.js', root))) },
      famigliaCrossbowAnimations: { path: 'data/arkpedia-famiglia-crossbows-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-famiglia-crossbows-animations.json', root))) },
      famigliaBasicFeatures: { path: 'shared/arkpedia/enemy-famiglia-basic-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-famiglia-basic-features.js', root))) },
      famigliaBasicAnimations: { path: 'data/arkpedia-famiglia-basics-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-famiglia-basics-animations.json', root))) },
      energyFeatures: { path: 'shared/arkpedia/enemy-energy-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-energy-features.js', root))) },
      energyGrenadierAnimations: { path: 'data/arkpedia-energy-grenadiers-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-energy-grenadiers-animations.json', root))) },
      energyAnimations: { path: 'data/arkpedia-energy-basics-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-energy-basics-animations.json', root))) },
      funliveCasterFeatures: { path: 'shared/arkpedia/enemy-funlive-caster-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-funlive-caster-features.js', root))) },
      funliveCasterAnimations: { path: 'data/arkpedia-funlive-caster-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-funlive-caster-animations.json', root))) },
      modeProgramContract: { path: 'shared/arkpedia/enemy-mode-program-contract.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-mode-program-contract.js', root))) },
      blightArcherFeatures: { path: 'shared/arkpedia/enemy-blight-archer-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-blight-archer-features.js', root))) },
      blightArcherAnimations: { path: 'data/arkpedia-blight-archers-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-blight-archers-animations.json', root))) },
      nightArcherFeatures: { path: 'shared/arkpedia/enemy-night-archer-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-night-archer-features.js', root))) },
      nightArcherAnimations: { path: 'data/arkpedia-night-archers-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-night-archers-animations.json', root))) },
      ordinaryProjectileContract: { path: 'shared/arkpedia/enemy-ordinary-projectile-contract.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-ordinary-projectile-contract.js', root))) },
      cosmeticMarkerContract: { path: 'shared/arkpedia/enemy-cosmetic-marker-contract.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-cosmetic-marker-contract.js', root))) },
      environmentConditions: { path: 'shared/arkpedia/environment-conditions.js', sha256: sha(await readFile(new URL('shared/arkpedia/environment-conditions.js', root))) },
      silvernwhiteFeatures: { path: 'shared/arkpedia/enemy-silvernwhite-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-silvernwhite-features.js', root))) },
      ordinaryBodyContract: { path: 'shared/arkpedia/enemy-ordinary-body-contract.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-ordinary-body-contract.js', root))) },
      redmarkFeatures: { path: 'shared/arkpedia/enemy-redmark-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-redmark-features.js', root))) },
      markedTargetContract: { path: 'shared/arkpedia/enemy-marked-target-contract.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-marked-target-contract.js', root))) },
      redmarkAnimations: { path: 'data/arkpedia-redmark-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-redmark-animations.json', root))) },
      expletiveFeatures: { path: 'shared/arkpedia/enemy-expletive-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-expletive-features.js', root))) },
      expletiveAnimations: { path: 'data/arkpedia-expletives-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-expletives-animations.json', root))) },
      nightCrawlerFeatures: { path: 'shared/arkpedia/enemy-night-crawler-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-night-crawler-features.js', root))) },
      weaksauceFeatures: { path: 'shared/arkpedia/enemy-weaksauce-features.js', sha256: sha(await readFile(new URL('shared/arkpedia/enemy-weaksauce-features.js', root))) },
      treeShieldAnimations: { path: 'data/arkpedia-tree-shield-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-tree-shield-animations.json', root))) },
      siegebreakerAnimations: { path: 'data/arkpedia-siegebreaker-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-siegebreaker-animations.json', root))) },
      gnawbeastAnimations: { path: 'data/arkpedia-gnawbeasts-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-gnawbeasts-animations.json', root))) },
      snackAnimations: { path: 'data/arkpedia-snack-animations.json', sha256: sha(await readFile(new URL('data/arkpedia-snack-animations.json', root))) } },
    summary: { enemies: Object.keys(enemies).length, supported, unsupported: Object.keys(enemies).length - supported },
    enemies };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const support = await buildEnemySupport(), text = JSON.stringify(support) + '\n';
  // The compact registry the battle and app load: supported id -> policy.
  const registry = JSON.stringify({ schemaVersion: 1, source: 'data/arkpedia-enemy-support.json',
    enemies: Object.fromEntries(Object.entries(support.enemies).filter(([, e]) => e.policy).map(([id, e]) => [id, e.policy])),
    spawns: Object.fromEntries(Object.entries(support.enemies).filter(([, e]) => e.policy && e.spawns.length).map(([id, e]) => [id, e.spawns])) }, null, 1) + '\n';
  if (process.argv.includes('--check')) {
    if (await readFile(OUT, 'utf8') !== text || await readFile(REGISTRY, 'utf8') !== registry) { console.error('Enemy support files are stale'); process.exit(1); }
    console.log('Enemy support matches the catalogue and timing index');
  } else {
    if (!process.argv.includes('--allow-removals')) {
      let previous;
      try { previous = JSON.parse(await readFile(OUT, 'utf8')); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (previous) assertPreservedEnemySupport(previous, support);
    }
    // Validate before publication, then replace complete files; the compact
    // runtime registry is the final publication step.
    await writeJSONAtomic(OUT, support, {space:0});
    await writeJSONAtomic(REGISTRY, JSON.parse(registry), {space:1});
    console.log(`Wrote ${text.length} + ${registry.length} bytes`);
  }
}
