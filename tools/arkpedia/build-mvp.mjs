// SPDX-License-Identifier: GPL-3.0-or-later
// Compact, pinned public data for the first regular-stage slice. No private app source is used.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { REGULAR_OPERATORS, assertRegularOperator } from "../../shared/arkpedia/operators.js";
import { assertRegularEnemies } from "../../shared/arkpedia/enemies.js";
import { compileReviewedOperators, operatorChannel } from "./operator-source.mjs";
import { writeJSONAtomic } from "./write-json.mjs";
import { isDeepStrictEqual } from "node:util";
import { verifyAphrissaArtwork, APHRISSA_TOKEN } from "./aphrissa-artwork.mjs";
import { APHRISSA_PREPARED_ROOTS } from "../../public/arkpedia/aphrissa-roots.js";
import { compileBuffTemplate } from "../../shared/arkpedia/behavior.js";
const cache = new URL("../../.cache/arkpedia/", import.meta.url);
await mkdir(cache, { recursive: true });
const paths = {
  character_table: [
    "Kengxxiao/ArknightsGameData_YoStar",
    "en_US/gamedata/excel/character_table.json",
  ],
  skill_table: [
    "Kengxxiao/ArknightsGameData_YoStar",
    "en_US/gamedata/excel/skill_table.json",
  ],
  range_table: [
    "Kengxxiao/ArknightsGameData_YoStar",
    "en_US/gamedata/excel/range_table.json",
  ],
  enemy_database: [
    "Kengxxiao/ArknightsGameData_YoStar",
    "en_US/gamedata/levels/enemydata/enemy_database.json",
  ],
  stage: ["arkpedia/arkpedia-data", "source/data/stages/0-1.json"],
  geometry: ["arkpedia/arkpedia-data", "source/data/stage-geometry/0-1.json"],
  buff_template_data: ["Kengxxiao/ArknightsGameData_YoStar", "en_US/gamedata/battle/buff_template_data.json"],
  original_level: ["Kengxxiao/ArknightsGameData_YoStar", "en_US/gamedata/levels/obt/main/level_main_00-01.json"],
  char_patch_table: ["Kengxxiao/ArknightsGameData_YoStar", "en_US/gamedata/excel/char_patch_table.json"],
};
if (process.argv.includes("--refresh")) {
  const pins = {};
  for (const repo of new Set([
    ...Object.values(paths).map(([r]) => r),
    "arkpedia/arkpedia-image-assets",
    "arkpedia/arkpedia-skin-assets",
  ]))
    pins[repo] = execFileSync("gh", ["api", `repos/${repo}/commits/main`, "--jq", ".sha"], {
        encoding: "utf8",
      }).trim();
  for (const [key, [repo, path]] of Object.entries(paths)) {
    const response = await fetch(
      `https://raw.githubusercontent.com/${repo}/${pins[repo]}/${path}`,
    );
    if (!response.ok)
      throw new Error(`Source unavailable: ${key} (${response.status})`);
    await writeFile(new URL(`${key}.json`, cache), await response.text());
  }
  await writeFile(new URL("pins.json", cache), JSON.stringify(pins));
}
const read = async (name) =>
  JSON.parse(await readFile(new URL(`${name}.json`, cache), "utf8"));
const [characters, skills, ranges, enemies, stage, geometry, buffTemplates, originalLevel, forms, pins] =
  await Promise.all(Object.keys(paths).concat("pins").map(read));
if (originalLevel.mapData.tags != null && (!Array.isArray(originalLevel.mapData.tags)
  || originalLevel.mapData.tags.some(tag => typeof tag !== 'string'))) throw Error('Unsupported source map tags');
const candidateClosur = process.argv.includes('--review-candidate-closur');
const candidateReckpr = process.argv.includes('--review-candidate-reckpr');
const candidateBranch = process.argv.includes('--review-candidate-branch');
const candidateVarkis = process.argv.includes('--review-candidate-varkis');
const candidateSnhunt = process.argv.includes('--review-candidate-snhunt');
const candidateKichi = process.argv.includes('--review-candidate-kichi');
const candidateCairn = process.argv.includes('--review-candidate-cairn');
const candidatePedro = process.argv.includes('--review-candidate-pedro');
const candidateMcnist = process.argv.includes('--review-candidate-mcnist');
const candidateGallus = process.argv.includes('--review-candidate-gallus');
const candidateKoromaru = process.argv.includes('--review-candidate-koromaru');
const candidateRecon = process.argv.includes('--review-candidate-recon');
const candidateJu = process.argv.includes('--review-candidate-ju');
const candidateTaraxa = process.argv.includes('--review-candidate-taraxa');
const candidateBotany = process.argv.includes('--review-candidate-botany');
const candidateSkybox = process.argv.includes('--review-candidate-skybox');
const candidateAegis = process.argv.includes('--review-candidate-aegis');
const candidateYukari = process.argv.includes('--review-candidate-yukari');
const candidateMakoto = process.argv.includes('--review-candidate-makoto');
const candidateAphrissa = process.argv.includes('--review-candidate-aphrissa');
const candidateHadiya = process.argv.includes('--review-candidate-hadiya');
// Generic admission (checkCnOwnerReview): --review-candidate-id=<charId>.
const candidateGeneric = process.argv.find(a => a.startsWith('--review-candidate-id='))?.slice('--review-candidate-id='.length) ?? null;
// charId -> data slug for operators admitted through checkCnOwnerReview.
const CN_OWNER_REVIEWS = Object.freeze({char_4185_amoris: {slug: 'amoris', policy: 'source-cn-amoris-continuous-splash-fever-v1'},
  char_4186_tmoris: {slug: 'tmoris', policy: 'source-cn-tmoris-stalker-sluggish-fear-fever-v1'},
  char_4184_dolris: {slug: 'dolris', policy: 'source-cn-dolris-bard-inspire-fever-v1'}});
const candidateTurdus = process.argv.includes('--review-candidate-turdus');
const candidateTmslot = process.argv.includes('--review-candidate-tmslot');
const candidateThumpy = process.argv.includes('--review-candidate-thumpy');
const candidateTanya = process.argv.includes('--review-candidate-tanya');
if ([!!candidateGeneric,candidateHadiya,candidateAphrissa,candidateMakoto,candidateYukari,candidateAegis,candidateSkybox,candidateBotany,candidateTaraxa,candidateJu,candidateTurdus,candidateRecon,candidateKoromaru,candidateGallus,candidateMcnist,candidatePedro,candidateTmslot,candidateThumpy,candidateClosur,candidateReckpr,candidateBranch,candidateVarkis,candidateSnhunt,candidateKichi,candidateCairn,candidateTanya].filter(Boolean).length>1) throw Error('Review one candidate snapshot at a time');
const ids = Object.keys(REGULAR_OPERATORS);
if (ids.includes('char_4179_monstr')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-mon3tr-runtime-review.json', import.meta.url)));
  for (const [name, key] of [['prefabs', 'sourceFoundationSha256'], ['device-art', 'deviceArtworkSha256']]) {
    const bytes = await readFile(new URL(`../../data/arkpedia-mon3tr-${name}.json`, import.meta.url));
    if (createHash('sha256').update(bytes).digest('hex') !== review[key]) throw Error('Changed Mon3tr source/artwork receipt');
  }
  const evidence = JSON.parse(await readFile(new URL('../../data/arkpedia-mon3tr-prefabs.json', import.meta.url)));
  if (JSON.stringify(review.enabledOperators) !== JSON.stringify(['char_4179_monstr']) || review.frameParity !== false
    || review.nativeParticleSupport !== false || review.moduleSupport !== false || review.nativePixelParity !== false
    || evidence.source.commit !== pins[paths.character_table[0]]) throw Error('Mon3tr lacks pinned selected public review');
}
if (ids.includes('char_4147_mitm')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-mitm-runtime-review.json', import.meta.url)));
  const foundation = await readFile(new URL('../../data/arkpedia-mitm-prefabs.json', import.meta.url));
  const artwork = await readFile(new URL('../../data/arkpedia-mitm-device-art.json', import.meta.url));
  const evidence = JSON.parse(foundation), art = JSON.parse(artwork);
  if (JSON.stringify(review.enabledOperators) !== JSON.stringify(['char_4147_mitm']) || review.frameParity !== false
    || review.sourceFoundationSha256 !== createHash('sha256').update(foundation).digest('hex')
    || review.deviceArtworkSha256 !== createHash('sha256').update(artwork).digest('hex')
    || art.foundation.sha256 !== review.sourceFoundationSha256
    || evidence.source.commit !== pins[paths.character_table[0]])
    throw Error('Mitm public review differs from its pinned native source/artwork');
}
if (ids.includes('char_4072_ironmn')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-stainless-runtime-review.json', import.meta.url)));
  const foundation = await readFile(new URL('../../data/arkpedia-stainless-prefabs.json', import.meta.url));
  const artwork = await readFile(new URL('../../data/arkpedia-stainless-device-art.json', import.meta.url));
  const evidence = JSON.parse(foundation);
  if (JSON.stringify(review.enabledOperators) !== JSON.stringify(['char_4072_ironmn']) || review.frameParity !== false
    || review.sourceFoundationSha256 !== createHash('sha256').update(foundation).digest('hex')
    || review.deviceArtworkSha256 !== createHash('sha256').update(artwork).digest('hex')
    || evidence.source.commit !== pins[paths.character_table[0]])
    throw Error('Stainless public review differs from its pinned native source/artwork');
}
if (ids.includes('char_2026_yu')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-yu-runtime-review.json', import.meta.url)));
  const foundation = await readFile(new URL('../../data/arkpedia-yu-prefabs.json', import.meta.url));
  const evidence = JSON.parse(foundation);
  if (JSON.stringify(review.enabledOperators) !== JSON.stringify(['char_2026_yu']) || review.frameParity !== false
    || review.sourceFoundationSha256 !== createHash('sha256').update(foundation).digest('hex')
    || evidence.source.commit !== pins[paths.character_table[0]])
    throw Error('Yu public runtime review differs from its pinned native source');
}
if (ids.includes('char_2025_shu')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-shu-runtime-review.json', import.meta.url)));
  const foundation = await readFile(new URL('../../data/arkpedia-shu-prefabs.json', import.meta.url));
  const evidence = JSON.parse(foundation);
  if (!review.enabledOperators.includes('char_2025_shu') || review.frameParity !== false
    || review.sourceFoundationSha256 !== createHash('sha256').update(foundation).digest('hex')
    || evidence.source.commit !== pins[paths.character_table[0]])
    throw Error('Shu public runtime review differs from its pinned native source');
}
if (ids.includes('char_2023_ling')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-ling-runtime-review.json', import.meta.url)));
  const foundation = await readFile(new URL('../../data/arkpedia-ling-prefabs.json', import.meta.url));
  const artwork = await readFile(new URL('../../data/arkpedia-ling-dragon-art.json', import.meta.url));
  const evidence = JSON.parse(foundation), art = JSON.parse(artwork);
  if (!review.enabledOperators.includes('char_2023_ling') || review.frameParity !== false
    || review.sourceFoundationSha256 !== createHash('sha256').update(foundation).digest('hex')
    || review.dragonArtworkSha256 !== createHash('sha256').update(artwork).digest('hex')
    || art.foundation.sha256 !== review.sourceFoundationSha256
    || evidence.source.commit !== pins[paths.character_table[0]])
    throw Error('Ling public runtime review differs from its pinned native source/artwork');
}
if (ids.includes('char_248_mgllan')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-magallan-runtime-review.json', import.meta.url)));
  const foundation = await readFile(new URL('../../data/arkpedia-magallan-prefabs.json', import.meta.url));
  const artwork = await readFile(new URL('../../data/arkpedia-magallan-drone-art.json', import.meta.url));
  const evidence = JSON.parse(foundation);
  if (!review.enabledOperators.includes('char_248_mgllan') || review.frameParity !== false
    || review.sourceFoundationSha256 !== createHash('sha256').update(foundation).digest('hex')
    || review.droneArtworkSha256 !== createHash('sha256').update(artwork).digest('hex')
    || evidence.source.commit !== pins[paths.character_table[0]])
    throw Error('Magallan public runtime review differs from its pinned native source/artwork');
}
if (ids.includes('char_1039_thorn2')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-thorns-runtime-review.json', import.meta.url)));
  const foundation = await readFile(new URL('../../data/arkpedia-thorns-lodestar-prefabs.json', import.meta.url));
  const evidence = JSON.parse(foundation);
  if (!review.enabledOperators.includes('char_1039_thorn2') || review.frameParity !== false
    || review.sourceFoundationSha256 !== createHash('sha256').update(foundation).digest('hex')
    || evidence.source.commit !== pins[paths.character_table[0]])
    throw Error('Thorns public runtime review differs from the pinned native source');
}
const usesCN = ids.some(id => operatorChannel(id, REGULAR_OPERATORS[id]) === 'cn');
if (ids.includes('char_1041_angel2')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-exusiai-covenant-runtime-review.json', import.meta.url)));
  const foundation = await readFile(new URL('../../data/arkpedia-exusiai-covenant-prefabs.json', import.meta.url));
  const artwork = await readFile(new URL('../../data/arkpedia-exusiai-covenant-coordinates-art.json', import.meta.url));
  const evidence = JSON.parse(foundation);
  if (!review.enabledOperators.includes('char_1041_angel2') || review.frameParity !== false
    || review.sourceFoundationSha256 !== createHash('sha256').update(foundation).digest('hex')
    || review.coordinateArtworkSha256 !== createHash('sha256').update(artwork).digest('hex')
    || evidence.source.commit !== pins[paths.character_table[0]])
    throw Error('Exusiai Covenant public runtime review differs from its pinned native source/artwork');
}
if(ids.includes('char_1040_blaze2')){
  const review=JSON.parse(await readFile(new URL('../../data/arkpedia-blaze-igniting-runtime-review.json',import.meta.url)));
  const foundation=await readFile(new URL('../../data/arkpedia-blaze-igniting-prefabs.json',import.meta.url));
  const evidence=JSON.parse(foundation);
  if(!review.enabledOperators.includes('char_1040_blaze2')||review.frameParity!==false
    ||review.sourceFoundationSha256!==createHash('sha256').update(foundation).digest('hex')
    ||evidence.source.commit!==pins[paths.character_table[0]])
    throw Error('Blaze Igniting public runtime review differs from the pinned native source');
}
if(ids.includes('char_1042_phatm2')){
  const review=JSON.parse(await readFile(new URL('../../data/arkpedia-tragodia-runtime-review.json',import.meta.url)));
  for(const [name,key]of [['prefabs','sourceFoundationSha256'],['device-art','deviceArtworkSha256']]){
    const bytes=await readFile(new URL(`../../data/arkpedia-tragodia-${name}.json`,import.meta.url));
    if(createHash('sha256').update(bytes).digest('hex')!==review[key])throw Error('Tragodia source/artwork receipt changed');
  }
  const evidence=JSON.parse(await readFile(new URL('../../data/arkpedia-tragodia-prefabs.json',import.meta.url)));
  if(JSON.stringify(review.enabledOperators)!==JSON.stringify(['char_1042_phatm2'])||review.frameParity!==false
    ||review.moduleSupport!==false||review.nativePixelParity!==false
    ||evidence.source.commit!==pins[paths.character_table[0]])throw Error('Tragodia lacks pinned public review');
}
if (ids.includes('char_450_necras')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-necrass-runtime-review.json', import.meta.url)));
  for (const [name, key] of [['prefabs', 'sourceFoundationSha256'], ['device-art', 'deviceArtworkSha256']]) {
    const bytes = await readFile(new URL(`../../data/arkpedia-necrass-${name}.json`, import.meta.url));
    if (createHash('sha256').update(bytes).digest('hex') !== review[key]) throw Error('Necrass reviewed source differs from its receipt');
  }
  const evidence = JSON.parse(await readFile(new URL('../../data/arkpedia-necrass-prefabs.json', import.meta.url)));
  if (JSON.stringify(review.enabledOperators) !== JSON.stringify(['char_450_necras']) || review.frameParity !== false
    || review.moduleSupport !== false || review.nativeParticleSupport !== false
    || review.servantPolicy !== 'source-forms-zero-slots-v1' || review.s3Policy !== 'selected-six-upgrades-three-stack-range-v1'
    || evidence.source.commit !== pins[paths.character_table[0]]) throw Error('Necrass lacks pinned public runtime review');
}
if (ids.includes('char_249_mlyss')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-muelsyse-runtime-review.json', import.meta.url)));
  for (const [name, key] of [['prefabs', 'sourceFoundationSha256'], ['device-art', 'deviceArtworkSha256'], ['copy-source', 'donorSourceSha256']]) {
    const bytes = await readFile(new URL(`../../data/arkpedia-muelsyse-${name}.json`, import.meta.url));
    if (createHash('sha256').update(bytes).digest('hex') !== review[key]) throw Error('Muelsyse reviewed source differs from its receipt');
  }
  const evidence = JSON.parse(await readFile(new URL('../../data/arkpedia-muelsyse-prefabs.json', import.meta.url)));
  if (JSON.stringify(review.enabledOperators) !== JSON.stringify(['char_249_mlyss']) || review.frameParity !== false
    || review.moduleSupport !== false || review.nativeParticleSupport !== false
    || review.s1PulsePolicy !== 'source-interval-duration-clipping-v1' || review.cloneProtectionPolicy !== 'warming-only-v1'
    || evidence.source.commit !== pins[paths.character_table[0]]) throw Error('Muelsyse lacks pinned public runtime review');
}
if (ids.includes('char_4141_marcil')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-marcil-runtime-review.json', import.meta.url)));
  const foundation = await readFile(new URL('../../data/arkpedia-marcil-prefabs.json', import.meta.url));
  const evidence = JSON.parse(foundation);
  if (JSON.stringify(review.enabledOperators) !== JSON.stringify(['char_4141_marcil']) || review.frameParity !== false
    || review.moduleSupport !== false || review.nativeParticleSupport !== false
    || review.chantPolicy !== 'request-then-active-v1' || review.projectilePolicy !== 'retain-born-unmanaged-shots-v1'
    || review.sourceFoundationSha256 !== createHash('sha256').update(foundation).digest('hex')
    || evidence.source.commit !== pins[paths.character_table[0]])
    throw Error('Marcille public runtime review differs from the pinned native source');
}
if (ids.includes('char_4194_rmixer')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-rmixer-runtime-review.json', import.meta.url)));
  const foundation = await readFile(new URL('../../data/arkpedia-rmixer-prefabs.json', import.meta.url));
  const evidence = JSON.parse(foundation);
  if (JSON.stringify(review.enabledOperators) !== JSON.stringify(['char_4194_rmixer']) || review.frameParity !== false
    || review.moduleSupport !== false || review.nativeParticleSupport !== false
    || review.recipientPolicy !== 'missing-ammo-then-latest-deployment-v1'
    || review.sourceFoundationSha256 !== createHash('sha256').update(foundation).digest('hex')
    || evidence.source.commit !== pins[paths.character_table[0]])
    throw Error('Sankta public runtime review differs from the pinned native source');
}
const cnEvidence = usesCN ? JSON.parse(await readFile(new URL('../../data/arkpedia-cn-source.json', import.meta.url), 'utf8')) : null;
if (ids.includes('char_4208_wintim')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-wintim-runtime-review.json', import.meta.url)));
  const foundation = await readFile(new URL('../../data/arkpedia-native-operators/char_4208_wintim.json', import.meta.url));
  const evidence = JSON.parse(foundation), id = 'char_4208_wintim';
  if (JSON.stringify(review.enabledOperators) !== JSON.stringify([id]) || review.frameParity !== false
    || review.nativeParticleSupport !== false || review.moduleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-cast-dp-and-output-damage-v1'
    || review.verification.browser.status !== 'passed'
    || review.sourceFoundationSha256 !== createHash('sha256').update(foundation).digest('hex')
    || evidence.source.commit !== cnEvidence?.source.commit
    || JSON.stringify(evidence.tables.character) !== JSON.stringify(cnEvidence.tables.characters[id])
    || Object.entries(evidence.tables.skills).some(([key, value]) => JSON.stringify(value) !== JSON.stringify(cnEvidence.tables.skills[key])))
    throw Error('Snegurochka lacks matching pinned CN source review');
  const expected = ['four-star-icons/Snegurochka - Base.webp', 'four-star-skins/Snegurochka - Base.webp',
    'skill-icons/Snegurochka - Data Analysis.webp', 'skill-icons/Snegurochka - Rational Attribution.webp'].sort();
  if (JSON.stringify(review.interfaceAssets.map(a => a.path).sort()) !== JSON.stringify(expected)
    || review.interfaceAssets.some(a => pins[a.repository] !== a.commit || !/^[a-f0-9]{64}$/.test(a.sha256)
      || !Number.isSafeInteger(a.bytes) || a.bytes < 1) || REGULAR_OPERATORS[id].assetName !== 'Snegurochka')
    throw Error('Snegurochka display spelling lacks its pinned interface assets');
}
if (ids.includes('char_4237_jcinta')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-jcinta-runtime-review.json', import.meta.url)));
  const foundation = await readFile(new URL('../../data/arkpedia-native-operators/char_4237_jcinta.json', import.meta.url));
  const evidence = JSON.parse(foundation), id = 'char_4237_jcinta';
  if (JSON.stringify(review.enabledOperators) !== JSON.stringify([id]) || review.frameParity !== false
    || review.nativeParticleSupport !== false || review.moduleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-override-channel-and-flying-sanctuary-v1'
    || review.verification.browser.status !== 'passed'
    || review.sourceFoundationSha256 !== createHash('sha256').update(foundation).digest('hex')
    || evidence.source.commit !== cnEvidence?.source.commit
    || JSON.stringify(evidence.tables.character) !== JSON.stringify(cnEvidence.tables.characters[id])
    || Object.entries(evidence.tables.skills).some(([key, value]) => JSON.stringify(value) !== JSON.stringify(cnEvidence.tables.skills[key])))
    throw Error('Jacinta lacks matching pinned CN source review');
  const expected = ['five-star-icons/Jacinta - Base.webp', 'five-star-skins/Jacinta - Base.webp',
    'skill-icons/Jacinta - Support γ.webp', "skill-icons/Jacinta - Parasol's Shade.webp"].sort();
  if (JSON.stringify(review.interfaceAssets.map(a => a.path).sort()) !== JSON.stringify(expected)
    || review.interfaceAssets.some(a => pins[a.repository] !== a.commit || !/^[a-f0-9]{64}$/.test(a.sha256)
      || !Number.isSafeInteger(a.bytes) || a.bytes < 1)) throw Error('Jacinta lacks pinned interface assets');
}
if (ids.includes('char_4166_varkis')) {
  const id = 'char_4166_varkis';
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-varkis-runtime-review.json', import.meta.url)));
  const foundation = await readFile(new URL('../../data/arkpedia-native-operators/char_4166_varkis.json', import.meta.url));
  const art = await readFile(new URL('../../data/arkpedia-varkis-art.json', import.meta.url));
  const e = JSON.parse(foundation);
  const approved = JSON.stringify(review.enabledOperators) === JSON.stringify([id]) && review.verification.browser.status === 'passed';
  const pending = candidateVarkis && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !pending) || review.frameParity !== false || review.nativeParticleSupport !== false
    || review.moduleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-three-event-burst-minos-hp-predicate-overheal-barrier-v1'
    || review.sourceFoundationSha256 !== createHash('sha256').update(foundation).digest('hex')
    || review.ownerArtworkSha256 !== createHash('sha256').update(art).digest('hex')
    || e.source.commit !== cnEvidence?.source.commit
    || JSON.stringify(e.tables.character) !== JSON.stringify(cnEvidence.tables.characters[id])
    || Object.entries(e.tables.skills).some(([key,value]) => JSON.stringify(value) !== JSON.stringify(cnEvidence.tables.skills[key])))
    throw Error('Varkáris lacks matching source/artwork and completed public browser review');
  const expected = ['five-star-icons/Varkáris - Base.webp', 'five-star-skins/Varkáris - Base.webp',
    'skill-icons/Varkáris - Raging River.webp', 'skill-icons/Varkáris - The Will of His People.webp'].sort();
  if (JSON.stringify(review.interfaceAssets.map(a => a.path).sort()) !== JSON.stringify(expected)
    || review.interfaceAssets.some(a => pins[a.repository] !== a.commit || !/^[a-f0-9]{64}$/.test(a.sha256)
      || !Number.isSafeInteger(a.bytes) || a.bytes < 1)) throw Error('Varkáris lacks pinned interface assets');
}
if (ids.includes('char_4211_snhunt')) {
  const id = 'char_4211_snhunt';
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-snhunt-runtime-review.json', import.meta.url)));
  const foundation = await readFile(new URL('../../data/arkpedia-native-operators/char_4211_snhunt.json', import.meta.url));
  const art = await readFile(new URL('../../data/arkpedia-snhunt-art.json', import.meta.url));
  const clocks = await readFile(new URL('../../data/arkpedia-snhunt-clocks.json', import.meta.url));
  const e = JSON.parse(foundation);
  const approved = JSON.stringify(review.enabledOperators) === JSON.stringify([id]) && review.verification.browser.status === 'passed';
  const pending = candidateSnhunt && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !pending) || review.frameParity !== false || review.nativeParticleSupport !== false
    || review.moduleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-hunter-magazine-double-shot-and-beast-cold-v1'
    || review.sourceFoundationSha256 !== createHash('sha256').update(foundation).digest('hex')
    || review.ownerArtworkSha256 !== createHash('sha256').update(art).digest('hex')
    || review.sourceClocksSha256 !== createHash('sha256').update(clocks).digest('hex')
    || e.source.commit !== cnEvidence?.source.commit
    || JSON.stringify(e.tables.character) !== JSON.stringify(cnEvidence.tables.characters[id])
    || Object.entries(e.tables.skills).some(([key,value]) => JSON.stringify(value) !== JSON.stringify(cnEvidence.tables.skills[key])))
    throw Error('Snow Hunter lacks matching source/artwork and completed public browser review');
  const expected = ['five-star-icons/Snow Hunter - Base.webp', 'five-star-skins/Snow Hunter - Base.webp',
    'skill-icons/Snow Hunter - Power Strike β.webp', 'skill-icons/Snow Hunter - Twin Blizzard Bolts.webp'].sort();
  if (JSON.stringify(review.interfaceAssets.map(a => a.path).sort()) !== JSON.stringify(expected)
    || review.interfaceAssets.some(a => pins[a.repository] !== a.commit || !/^[a-f0-9]{64}$/.test(a.sha256)
      || !Number.isSafeInteger(a.bytes) || a.bytes < 1)) throw Error('Snow Hunter lacks pinned interface assets');
}
if (ids.includes('char_4203_kichi')) {
  const id = 'char_4203_kichi';
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-kichi-runtime-review.json', import.meta.url)));
  const foundation = await readFile(new URL('../../data/arkpedia-native-operators/char_4203_kichi.json', import.meta.url));
  const art = await readFile(new URL('../../data/arkpedia-kichi-art.json', import.meta.url));
  const recipe = await readFile(new URL('../../data/arkpedia-kichi-art-recipe.json', import.meta.url));
  const clocks = await readFile(new URL('../../data/arkpedia-kichi-clocks.json', import.meta.url));
  const e = JSON.parse(foundation);
  const approved = JSON.stringify(review.enabledOperators) === JSON.stringify([id]) && review.verification.browser.status === 'passed';
  const pending = candidateKichi && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !pending) || review.frameParity !== false || review.nativeParticleSupport !== false
    || review.moduleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-spread-wave-stacks-status-cycle-and-unique-kills-v1'
    || review.sourceFoundationSha256 !== createHash('sha256').update(foundation).digest('hex')
    || review.ownerArtworkSha256 !== createHash('sha256').update(art).digest('hex')
    || JSON.parse(art).recipeSha256 !== createHash('sha256').update(recipe).digest('hex')
    || review.sourceClocksSha256 !== createHash('sha256').update(clocks).digest('hex')
    || e.source.commit !== cnEvidence?.source.commit
    || JSON.stringify(e.tables.character) !== JSON.stringify(cnEvidence.tables.characters[id])
    || Object.entries(e.tables.skills).some(([key,value]) => JSON.stringify(value) !== JSON.stringify(cnEvidence.tables.skills[key])))
    throw Error('Kichisei lacks matching source/artwork and completed public browser review');
  const expected = ['five-star-icons/Kichisei - Base.webp', 'five-star-skins/Kichisei - Base.webp',
    'skill-icons/Kichisei - Irasshaimase!.webp', 'skill-icons/Kichisei - Lucky Star, Shining Bright!.webp'].sort();
  if (JSON.stringify(review.interfaceAssets.map(a => a.path).sort()) !== JSON.stringify(expected)
    || review.interfaceAssets.some(a => pins[a.repository] !== a.commit || !/^[a-f0-9]{64}$/.test(a.sha256)
      || !Number.isSafeInteger(a.bytes) || a.bytes < 1)) throw Error('Kichisei lacks pinned interface assets');
}
if (ids.includes('char_4214_cairn')) {
  const id = 'char_4214_cairn';
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-cairn-runtime-review.json', import.meta.url)));
  const foundation = await readFile(new URL('../../data/arkpedia-native-operators/char_4214_cairn.json', import.meta.url));
  const art = await readFile(new URL('../../data/arkpedia-cairn-art.json', import.meta.url));
  const recipe = await readFile(new URL('../../data/arkpedia-cairn-art-recipe.json', import.meta.url));
  const clocks = await readFile(new URL('../../data/arkpedia-cairn-clocks.json', import.meta.url));
  const e = JSON.parse(foundation);
  const approved = JSON.stringify(review.enabledOperators) === JSON.stringify([id]) && review.verification.browser.status === 'passed';
  const pending = candidateCairn && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !pending) || review.frameParity !== false || review.nativeParticleSupport !== false
    || review.moduleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-hp-mode-shield-snapshot-dot-and-blocked-injury-v1'
    || review.sourceFoundationSha256 !== createHash('sha256').update(foundation).digest('hex')
    || review.ownerArtworkSha256 !== createHash('sha256').update(art).digest('hex')
    || JSON.parse(art).recipeSha256 !== createHash('sha256').update(recipe).digest('hex')
    || review.sourceClocksSha256 !== createHash('sha256').update(clocks).digest('hex')
    || e.source.commit !== cnEvidence?.source.commit
    || JSON.stringify(e.tables.character) !== JSON.stringify(cnEvidence.tables.characters[id])
    || Object.entries(e.tables.skills).some(([key,value]) => JSON.stringify(value) !== JSON.stringify(cnEvidence.tables.skills[key])))
    throw Error('Cairn lacks matching source/artwork and completed public browser review');
  const expected = ['five-star-icons/Cairn - Base.webp', 'five-star-skins/Cairn - Base.webp',
    'skill-icons/Cairn - Covered Consolidation.webp', 'skill-icons/Cairn - Stunning Directives.webp'].sort();
  if (JSON.stringify(review.interfaceAssets.map(a => a.path).sort()) !== JSON.stringify(expected)
    || review.interfaceAssets.some(a => pins[a.repository] !== a.commit || !/^[a-f0-9]{64}$/.test(a.sha256)
      || !Number.isSafeInteger(a.bytes) || a.bytes < 1)) throw Error('Cairn lacks pinned interface assets');
}
if (ids.includes('char_4225_tanya')) {
  const id = 'char_4225_tanya';
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-tanya-runtime-review.json', import.meta.url)));
  const foundation = await readFile(new URL('../../data/arkpedia-native-operators/char_4225_tanya.json', import.meta.url));
  const art = await readFile(new URL('../../data/arkpedia-tanya-art.json', import.meta.url));
  const recipe = await readFile(new URL('../../data/arkpedia-tanya-art-recipe.json', import.meta.url));
  const clocks = await readFile(new URL('../../data/arkpedia-tanya-clocks.json', import.meta.url));
  const e = JSON.parse(foundation);
  const approved = JSON.stringify(review.enabledOperators) === JSON.stringify([id]) && review.verification.browser.status === 'passed';
  const pending = candidateTanya && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !pending) || review.frameParity !== false || review.nativeParticleSupport !== false
    || review.moduleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-immediate-hp-recovery-permanent-def-hp-loss-erosion-v1'
    || review.sourceFoundationSha256 !== createHash('sha256').update(foundation).digest('hex')
    || review.ownerArtworkSha256 !== createHash('sha256').update(art).digest('hex')
    || JSON.parse(art).recipeSha256 !== createHash('sha256').update(recipe).digest('hex')
    || review.sourceClocksSha256 !== createHash('sha256').update(clocks).digest('hex')
    || e.source.commit !== cnEvidence?.source.commit
    || JSON.stringify(e.tables.character) !== JSON.stringify(cnEvidence.tables.characters[id])
    || Object.entries(e.tables.skills).some(([key,value]) => JSON.stringify(value) !== JSON.stringify(cnEvidence.tables.skills[key])))
    throw Error('Crackborne lacks matching source/artwork and completed public browser review');
  const expected = ['five-star-icons/Crackborne - Base.webp', 'five-star-skins/Crackborne - Base.webp',
    'skill-icons/Crackborne - Cleanse.webp', 'skill-icons/Crackborne - Wash Away.webp'].sort();
  if (JSON.stringify(review.interfaceAssets.map(a => a.path).sort()) !== JSON.stringify(expected)
    || review.interfaceAssets.some(a => pins[a.repository] !== a.commit || !/^[a-f0-9]{64}$/.test(a.sha256)
      || !Number.isSafeInteger(a.bytes) || a.bytes < 1)) throw Error('Crackborne lacks pinned interface assets');
}
if (ids.includes('char_4235_thumpy')) {
  const id = 'char_4235_thumpy';
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-thumpy-runtime-review.json', import.meta.url)));
  const foundation = await readFile(new URL('../../data/arkpedia-native-operators/char_4235_thumpy.json', import.meta.url));
  const art = await readFile(new URL('../../data/arkpedia-thumpy-art.json', import.meta.url));
  const recipe = await readFile(new URL('../../data/arkpedia-thumpy-art-recipe.json', import.meta.url));
  const clocks = await readFile(new URL('../../data/arkpedia-thumpy-clocks.json', import.meta.url));
  const e = JSON.parse(foundation);
  const approved = JSON.stringify(review.enabledOperators) === JSON.stringify([id]) && review.verification.browser.status === 'passed';
  const pending = candidateThumpy && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !pending) || review.frameParity !== false || review.nativeParticleSupport !== false
    || review.moduleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-three-modes-erosion-glue-conveyor-v1'
    || review.sourceFoundationSha256 !== createHash('sha256').update(foundation).digest('hex')
    || review.ownerArtworkSha256 !== createHash('sha256').update(art).digest('hex')
    || JSON.parse(art).recipeSha256 !== createHash('sha256').update(recipe).digest('hex')
    || review.sourceClocksSha256 !== createHash('sha256').update(clocks).digest('hex')
    || e.source.commit !== cnEvidence?.source.commit
    || JSON.stringify(e.tables.character) !== JSON.stringify(cnEvidence.tables.characters[id])
    || Object.entries(e.tables.skills).some(([key,value]) => JSON.stringify(value) !== JSON.stringify(cnEvidence.tables.skills[key])))
    throw Error('Thumpy lacks matching source/artwork and completed public browser review');
  const expected = ["six-star-icons/Thumpy - Base.webp", "six-star-skins/Thumpy - Base.webp", "skill-icons/Thumpy - Aren't You Going.webp", "skill-icons/Thumpy - Take It Slow~.webp", "skill-icons/Thumpy - You Can't Leave!.webp"].sort();
  if (JSON.stringify(review.interfaceAssets.map(a => a.path).sort()) !== JSON.stringify(expected)
    || review.interfaceAssets.some(a => pins[a.repository] !== a.commit || !/^[a-f0-9]{64}$/.test(a.sha256)
      || !Number.isSafeInteger(a.bytes) || a.bytes < 1)) throw Error('Thumpy lacks pinned interface assets');
}
if (ids.includes('char_4236_tmslot')) {
  const id = 'char_4236_tmslot';
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-tmslot-runtime-review.json', import.meta.url)));
  const foundation = await readFile(new URL('../../data/arkpedia-native-operators/char_4236_tmslot.json', import.meta.url));
  const art = await readFile(new URL('../../data/arkpedia-tmslot-art.json', import.meta.url));
  const recipe = await readFile(new URL('../../data/arkpedia-tmslot-art-recipe.json', import.meta.url));
  const overdrive = await readFile(new URL('../../data/arkpedia-tmslot-overdrive-source.json', import.meta.url));
  const clocks = await readFile(new URL('../../data/arkpedia-tmslot-clocks.json', import.meta.url));
  const e = JSON.parse(foundation);
  const approved = JSON.stringify(review.enabledOperators) === JSON.stringify([id]) && review.verification.browser.status === 'passed';
  const pending = candidateTmslot && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !pending) || review.frameParity !== false || review.nativeParticleSupport !== false
    || review.moduleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-owner-and-independent-drones-range-forced-overload-v1'
    || review.sourceFoundationSha256 !== createHash('sha256').update(foundation).digest('hex')
    || review.ownerArtworkSha256 !== createHash('sha256').update(art).digest('hex')
    || JSON.parse(art).recipeSha256 !== createHash('sha256').update(recipe).digest('hex')
    || review.sourceOverdriveSha256 !== createHash('sha256').update(overdrive).digest('hex')
    || review.sourceClocksSha256 !== createHash('sha256').update(clocks).digest('hex')
    || e.source.commit !== cnEvidence?.source.commit
    || JSON.stringify(e.tables.character) !== JSON.stringify(cnEvidence.tables.characters[id])
    || Object.entries(e.tables.skills).some(([key,value]) => JSON.stringify(value) !== JSON.stringify(cnEvidence.tables.skills[key])))
    throw Error('Tmslot lacks matching source/artwork and completed public browser review');
  const expected = ["five-star-icons/Timeslot - Base.webp", "five-star-skins/Timeslot - Base.webp", "skill-icons/Timeslot - ATK Up γ.webp", "skill-icons/Timeslot - Technology and Traditional Rituals.webp"].sort();
  if (JSON.stringify(review.interfaceAssets.map(a => a.path).sort()) !== JSON.stringify(expected)
    || review.interfaceAssets.some(a => pins[a.repository] !== a.commit || !/^[a-f0-9]{64}$/.test(a.sha256)
      || !Number.isSafeInteger(a.bytes) || a.bytes < 1)) throw Error('Tmslot lacks pinned interface assets');
}
if(ids.includes('char_4224_turdus')){
  const id='char_4224_turdus',review=JSON.parse(await readFile(new URL('../../data/arkpedia-turdus-runtime-review.json',import.meta.url)));
  const approved=JSON.stringify(review.enabledOperators)===JSON.stringify([id])&&review.verification.browser.status==='passed';
  const pending=candidateTurdus&&review.enabledOperators.length===0&&review.verification.browser.status==='pending';
  const artifacts=Object.fromEntries(await Promise.all([['foundation','native-operators/char_4224_turdus'],['owner','turdus-art'],['recipe','turdus-art-recipe'],['clocks','turdus-clocks']].map(async([key,path])=>[key,await readFile(new URL(`../../data/arkpedia-${path}.json`,import.meta.url))])));
  const sha=key=>createHash('sha256').update(artifacts[key]).digest('hex'),e=JSON.parse(artifacts.foundation);
  if((!approved&&!pending)||review.frameParity!==false||review.moduleSupport!==false||review.nativeParticleSupport!==false||review.nativePixelParity!==false
    ||review.mechanicsPolicy!=='source-cn-chain-free-bounce-carried-scale-and-independent-heal-camouflage-v1'
    ||review.sourceFoundationSha256!==sha('foundation')||review.ownerArtworkSha256!==sha('owner')||review.sourceClocksSha256!==sha('clocks')||JSON.parse(artifacts.owner).recipeSha256!==sha('recipe')
    ||e.source.commit!==cnEvidence?.source.commit||JSON.stringify(e.tables.character)!==JSON.stringify(cnEvidence.tables.characters[id])
    ||Object.entries(e.tables.skills).some(([key,value])=>JSON.stringify(value)!==JSON.stringify(cnEvidence.tables.skills[key])))throw Error('Ukusik lacks matching original source, art, clocks and public browser review');
  if(approved){for(const[path,key]of[['tools/arkpedia/review-turdus-public.mjs','scriptSha256'],['tools/arkpedia/public-review-driver.mjs','driverSha256'],['tools/arkpedia/public-review-server.mjs','fixtureServerSha256']]){
    if(createHash('sha256').update(await readFile(new URL('../../'+path,import.meta.url))).digest('hex')!==review.verification.browser[key])throw Error('Changed Ukusik browser review tooling');
  }}
  const expected=['five-star-icons/Ukusik - Base.webp','five-star-skins/Ukusik - Base.webp','skill-icons/Ukusik - Secret Spell of Tongs.webp',"skill-icons/Ukusik - 'Peekaboo!'.webp"].sort();
  if(JSON.stringify(review.interfaceAssets.map(a=>a.path).sort())!==JSON.stringify(expected)||review.interfaceAssets.some(a=>pins[a.repository]!==a.commit||!/^[a-f0-9]{64}$/.test(a.sha256)||!Number.isSafeInteger(a.bytes)||a.bytes<1))throw Error('Ukusik lacks four pinned interface assets');
}
if(ids.includes('char_4222_taraxa')){
  const id='char_4222_taraxa',review=JSON.parse(await readFile(new URL('../../data/arkpedia-taraxa-runtime-review.json',import.meta.url)));
  const approved=JSON.stringify(review.enabledOperators)===JSON.stringify([id])&&review.verification.browser.status==='passed';
  const pending=candidateTaraxa&&review.enabledOperators.length===0&&review.verification.browser.status==='pending';
  const artifacts=Object.fromEntries(await Promise.all([['foundation','native-operators/char_4222_taraxa'],['owner','taraxa-art'],['recipe','taraxa-art-recipe'],['clocks','taraxa-clocks']].map(async([key,path])=>[key,await readFile(new URL(`../../data/arkpedia-${path}.json`,import.meta.url))])));
  const sha=key=>createHash('sha256').update(artifacts[key]).digest('hex'),e=JSON.parse(artifacts.foundation);
  if((!approved&&!pending)||review.frameParity!==false||review.moduleSupport!==false||review.nativeParticleSupport!==false||review.nativePixelParity!==false
    ||review.mechanicsPolicy!=='source-cn-taraxa-air-block-aura-and-two-flight-heal-modes-v1'
    ||review.sourceFoundationSha256!==sha('foundation')||review.ownerArtworkSha256!==sha('owner')||review.sourceClocksSha256!==sha('clocks')||JSON.parse(artifacts.owner).recipeSha256!==sha('recipe')
    ||e.source.commit!==cnEvidence?.source.commit||JSON.stringify(e.tables.character)!==JSON.stringify(cnEvidence.tables.characters[id])
    ||Object.entries(e.tables.skills).some(([key,value])=>JSON.stringify(value)!==JSON.stringify(cnEvidence.tables.skills[key])))throw Error('Taraxacum lacks matching original source, art, clocks and public browser review');
  if(approved){for(const[path,key]of[['tools/arkpedia/review-taraxa-public.mjs','scriptSha256'],['tools/arkpedia/public-review-driver.mjs','driverSha256'],['tools/arkpedia/public-review-server.mjs','fixtureServerSha256']]){
    if(createHash('sha256').update(await readFile(new URL('../../'+path,import.meta.url))).digest('hex')!==review.verification.browser[key])throw Error('Changed Taraxacum browser review tooling');
  }}
  const expected=['five-star-icons/Taraxacum - Base.webp','five-star-skins/Taraxacum - Base.webp','skill-icons/Taraxacum - Where To.webp','skill-icons/Taraxacum - Upon the Wind.webp'].sort();
  if(JSON.stringify(review.interfaceAssets.map(a=>a.path).sort())!==JSON.stringify(expected)||review.interfaceAssets.some(a=>pins[a.repository]!==a.commit||!/^[a-f0-9]{64}$/.test(a.sha256)||!Number.isSafeInteger(a.bytes)||a.bytes<1))throw Error('Taraxacum lacks four pinned interface assets');
}
if(ids.includes('char_4221_ju')){
  const id='char_4221_ju',review=JSON.parse(await readFile(new URL('../../data/arkpedia-ju-runtime-review.json',import.meta.url)));
  const approved=JSON.stringify(review.enabledOperators)===JSON.stringify([id])&&review.verification.browser.status==='passed';
  const pending=candidateJu&&review.enabledOperators.length===0&&review.verification.browser.status==='pending';
  const artifacts=Object.fromEntries(await Promise.all([['foundation','native-operators/char_4221_ju'],['owner','ju-art'],['recipe','ju-art-recipe'],['clocks','ju-clocks']].map(async([key,path])=>[key,await readFile(new URL(`../../data/arkpedia-${path}.json`,import.meta.url))])));
  const sha=key=>createHash('sha256').update(artifacts[key]).digest('hex'),e=JSON.parse(artifacts.foundation);
  if((!approved&&!pending)||review.frameParity!==false||review.moduleSupport!==false||review.nativeParticleSupport!==false||review.nativePixelParity!==false
    ||review.mechanicsPolicy!=='source-cn-ju-wounds-conditional-charges-and-serialized-extra-v1'
    ||review.sourceFoundationSha256!==sha('foundation')||review.ownerArtworkSha256!==sha('owner')||review.sourceClocksSha256!==sha('clocks')||JSON.parse(artifacts.owner).recipeSha256!==sha('recipe')
    ||e.source.commit!==cnEvidence?.source.commit||JSON.stringify(e.tables.character)!==JSON.stringify(cnEvidence.tables.characters[id])
    ||Object.entries(e.tables.skills).some(([key,value])=>JSON.stringify(value)!==JSON.stringify(cnEvidence.tables.skills[key])))throw Error('Ju lacks matching original source, art, clocks and public browser review');
  if(approved){for(const[path,key]of[['tools/arkpedia/review-ju-public.mjs','scriptSha256'],['tools/arkpedia/public-review-driver.mjs','driverSha256'],['tools/arkpedia/public-review-server.mjs','fixtureServerSha256']]){
    if(createHash('sha256').update(await readFile(new URL('../../'+path,import.meta.url))).digest('hex')!==review.verification.browser[key])throw Error('Changed Ju browser review tooling');
  }}
  const expected=['five-star-icons/Ju - Base.webp','five-star-skins/Ju - Base.webp','skill-icons/Ju - Fine Bow, Difficult Draw.webp','skill-icons/Ju - Fine Wings, Difficult Flight.webp'].sort();
  if(JSON.stringify(review.interfaceAssets.map(a=>a.path).sort())!==JSON.stringify(expected)||review.interfaceAssets.some(a=>pins[a.repository]!==a.commit||!/^[a-f0-9]{64}$/.test(a.sha256)||!Number.isSafeInteger(a.bytes)||a.bytes<1))throw Error('Ju lacks four pinned interface assets');
}
// Shared receipt gate for CN-sourced owners: source tables, art receipt and
// clocks (when present) match, the browser tooling is unchanged once approved,
// and interface files resolve at the snapshot's own image/skin pins.
async function checkCnOwnerReview(id, {slug, policy}) {
  const review=JSON.parse(await readFile(new URL(`../../data/arkpedia-${slug}-runtime-review.json`,import.meta.url)));
  const approved=JSON.stringify(review.enabledOperators)===JSON.stringify([id])&&review.verification.browser.status==='passed';
  const pending=candidateGeneric===id&&review.enabledOperators.length===0&&review.verification.browser.status==='pending';
  const read=path=>readFile(new URL(`../../data/arkpedia-${path}.json`,import.meta.url));
  const foundation=await read(`native-operators/${id}`),owner=await read(`${slug}-art`),recipe=await read(`${slug}-art-recipe`);
  const sha=b=>createHash('sha256').update(b).digest('hex'),e=JSON.parse(foundation);
  if((!approved&&!pending)||review.frameParity!==false||review.moduleSupport!==false||review.nativeParticleSupport!==false||review.nativePixelParity!==false
    ||review.mechanicsPolicy!==policy||review.sourceFoundationSha256!==sha(foundation)||review.ownerArtworkSha256!==sha(owner)
    ||JSON.parse(owner).recipeSha256!==sha(recipe)||JSON.parse(recipe).foundationSha256!==sha(foundation)
    ||Object.entries(review.extraSources??{}).some(([path,hash])=>!/^[a-z0-9-]+$/.test(path)||hash!==null&&typeof hash!=='string')
    ||e.source.commit!==cnEvidence?.source.commit||!isDeepStrictEqual(e.tables.character,cnEvidence.tables.characters[id])
    ||Object.entries(e.tables.skills).some(([key,value])=>!isDeepStrictEqual(value,cnEvidence.tables.skills[key])))
    throw Error(`${id} lacks matching original source, art and public browser review`);
  for(const[path,hash]of Object.entries(review.extraSources??{}))if(sha(await read(path))!==hash)throw Error(`${id} changed reviewed source ${path}`);
  if(approved){for(const[path,key]of[[`tools/arkpedia/review-${slug}-public.mjs`,'scriptSha256'],['tools/arkpedia/public-review-driver.mjs','driverSha256'],['tools/arkpedia/public-review-server.mjs','fixtureServerSha256']]){
    if(sha(await readFile(new URL('../../'+path,import.meta.url)))!==review.verification.browser[key])throw Error(`Changed ${id} browser review tooling`);
  }}
  if(!review.interfaceAssets?.length||review.interfaceAssets.some(a=>pins[a.repository]!==a.commit||!/^[a-f0-9]{64}$/.test(a.sha256)||!Number.isSafeInteger(a.bytes)||a.bytes<1))
    throw Error(`${id} lacks pinned interface assets`);
  return review;
}
const cnOwnerReviews={};
for(const[id,spec]of Object.entries(CN_OWNER_REVIEWS))if(ids.includes(id))cnOwnerReviews[id]=await checkCnOwnerReview(id,spec);
if(ids.includes('char_394_hadiya')){
  const id='char_394_hadiya',review=JSON.parse(await readFile(new URL('../../data/arkpedia-hadiya-runtime-review.json',import.meta.url)));
  const approved=JSON.stringify(review.enabledOperators)===JSON.stringify([id])&&review.verification.browser.status==='passed';
  const pending=candidateHadiya&&review.enabledOperators.length===0&&review.verification.browser.status==='pending';
  const artifacts=Object.fromEntries(await Promise.all([['foundation','native-operators/char_394_hadiya'],['owner','hadiya-art'],['recipe','hadiya-art-recipe'],['clocks','hadiya-clocks']].map(async([key,path])=>[key,await readFile(new URL(`../../data/arkpedia-${path}.json`,import.meta.url))])));
  const sha=key=>createHash('sha256').update(artifacts[key]).digest('hex'),e=JSON.parse(artifacts.foundation);
  if((!approved&&!pending)||review.frameParity!==false||review.moduleSupport!==false||review.nativeParticleSupport!==false||review.nativePixelParity!==false
    ||review.mechanicsPolicy!=='source-cn-hadiya-dp-casts-adaptation-and-stacked-talent-v1'
    ||review.sourceFoundationSha256!==sha('foundation')||review.ownerArtworkSha256!==sha('owner')||review.sourceClocksSha256!==sha('clocks')||JSON.parse(artifacts.owner).recipeSha256!==sha('recipe')
    ||e.source.commit!==cnEvidence?.source.commit||!isDeepStrictEqual(e.tables.character,cnEvidence.tables.characters[id])
    ||Object.entries(e.tables.skills).some(([key,value])=>!isDeepStrictEqual(value,cnEvidence.tables.skills[key])))throw Error('Hadiya lacks matching original source, art, clocks and public browser review');
  if(approved){for(const[path,key]of[['tools/arkpedia/review-hadiya-public.mjs','scriptSha256'],['tools/arkpedia/public-review-driver.mjs','driverSha256'],['tools/arkpedia/public-review-server.mjs','fixtureServerSha256']]){
    if(createHash('sha256').update(await readFile(new URL('../../'+path,import.meta.url))).digest('hex')!==review.verification.browser[key])throw Error('Changed Hadiya browser review tooling');
  }}
  const expected=['five-star-icons/Hadiya - Base.webp','five-star-skins/Hadiya - Base.webp','skill-icons/Hadiya - Enhanced Desert Tactics.webp','skill-icons/Hadiya - Blade of the Qarnsayf.webp'].sort();
  if(JSON.stringify(review.interfaceAssets.map(a=>a.path).sort())!==JSON.stringify(expected)||review.interfaceAssets.some(a=>pins[a.repository]!==a.commit||!/^[a-f0-9]{64}$/.test(a.sha256)||!Number.isSafeInteger(a.bytes)||a.bytes<1))throw Error('Hadiya lacks four pinned interface assets');
}
if(ids.includes('char_4223_botany')){
  const id='char_4223_botany',review=JSON.parse(await readFile(new URL('../../data/arkpedia-botany-runtime-review.json',import.meta.url)));
  const approved=JSON.stringify(review.enabledOperators)===JSON.stringify([id])&&review.verification.browser.status==='passed';
  const pending=candidateBotany&&review.enabledOperators.length===0&&review.verification.browser.status==='pending';
  const artifacts=Object.fromEntries(await Promise.all([['foundation','native-operators/char_4223_botany'],['owner','botany-art'],['recipe','botany-art-recipe'],['clocks','botany-clocks']].map(async([key,path])=>[key,await readFile(new URL(`../../data/arkpedia-${path}.json`,import.meta.url))])));
  const sha=key=>createHash('sha256').update(artifacts[key]).digest('hex'),e=JSON.parse(artifacts.foundation);
  if((!approved&&!pending)||review.frameParity!==false||review.moduleSupport!==false||review.nativeParticleSupport!==false||review.nativePixelParity!==false
    ||review.mechanicsPolicy!=='source-cn-botany-erosion-burst-talent-and-two-retained-inputs-v1'
    ||review.sourceFoundationSha256!==sha('foundation')||review.ownerArtworkSha256!==sha('owner')||review.sourceClocksSha256!==sha('clocks')||JSON.parse(artifacts.owner).recipeSha256!==sha('recipe')
    ||e.source.commit!==cnEvidence?.source.commit||JSON.stringify(e.tables.character)!==JSON.stringify(cnEvidence.tables.characters[id])
    ||Object.entries(e.tables.skills).some(([key,value])=>JSON.stringify(value)!==JSON.stringify(cnEvidence.tables.skills[key])))throw Error('Botany lacks matching original source, art, clocks and public browser review');
  if(approved){for(const[path,key]of[['tools/arkpedia/review-botany-public.mjs','scriptSha256'],['tools/arkpedia/public-review-driver.mjs','driverSha256'],['tools/arkpedia/public-review-server.mjs','fixtureServerSha256']]){
    if(createHash('sha256').update(await readFile(new URL('../../'+path,import.meta.url))).digest('hex')!==review.verification.browser[key])throw Error('Changed Botany browser review tooling');
  }}
  const expected=['five-star-icons/Botani - Base.webp','five-star-skins/Botani - Base.webp','skill-icons/Botani - Disharmonization.webp','skill-icons/Botani - Echoes Through Quietude.webp'].sort();
  if(JSON.stringify(review.interfaceAssets.map(a=>a.path).sort())!==JSON.stringify(expected)||review.interfaceAssets.some(a=>pins[a.repository]!==a.commit||!/^[a-f0-9]{64}$/.test(a.sha256)||!Number.isSafeInteger(a.bytes)||a.bytes<1))throw Error('Botany lacks four pinned interface assets');
}
if(ids.includes('char_4213_skybx')){
  const id='char_4213_skybx',review=JSON.parse(await readFile(new URL('../../data/arkpedia-skybox-runtime-review.json',import.meta.url)));
  const approved=JSON.stringify(review.enabledOperators)===JSON.stringify([id])&&review.verification.browser.status==='passed';
  const pending=candidateSkybox&&review.enabledOperators.length===0&&review.verification.browser.status==='pending';
  const artifacts=Object.fromEntries(await Promise.all([['foundation','native-operators/char_4213_skybx'],['owner','skybox-art'],['recipe','skybox-art-recipe'],['clocks','skybox-clocks']].map(async([key,path])=>[key,await readFile(new URL(`../../data/arkpedia-${path}.json`,import.meta.url))])));
  const sha=key=>createHash('sha256').update(artifacts[key]).digest('hex'),e=JSON.parse(artifacts.foundation);
  if((!approved&&!pending)||review.frameParity!==false||review.moduleSupport!==false||review.nativeParticleSupport!==false||review.nativePixelParity!==false
    ||review.mechanicsPolicy!=='source-cn-skybox-flight-independent-silence-and-remaining-ammo-burst-v1'
    ||review.sourceFoundationSha256!==sha('foundation')||review.ownerArtworkSha256!==sha('owner')||review.sourceClocksSha256!==sha('clocks')||JSON.parse(artifacts.owner).recipeSha256!==sha('recipe')
    ||e.source.commit!==cnEvidence?.source.commit||JSON.stringify(e.tables.character)!==JSON.stringify(cnEvidence.tables.characters[id])
    ||Object.entries(e.tables.skills).some(([key,value])=>JSON.stringify(value)!==JSON.stringify(cnEvidence.tables.skills[key])))throw Error('Skybox lacks matching original source, art, clocks and public browser review');
  if(approved){for(const[path,key]of[['tools/arkpedia/review-skybox-public.mjs','scriptSha256'],['tools/arkpedia/public-review-driver.mjs','driverSha256'],['tools/arkpedia/public-review-server.mjs','fixtureServerSha256']]){
    if(createHash('sha256').update(await readFile(new URL('../../'+path,import.meta.url))).digest('hex')!==review.verification.browser[key])throw Error('Changed Skybox browser review tooling');
  }}
  const expected=['five-star-icons/Skybox - Base.webp','five-star-skins/Skybox - Base.webp','skill-icons/Skybox - Gunpowder Soiree.webp','skill-icons/Skybox - EMP Benefaction.webp'].sort();
  if(JSON.stringify(review.interfaceAssets.map(a=>a.path).sort())!==JSON.stringify(expected)||review.interfaceAssets.some(a=>pins[a.repository]!==a.commit||!/^[a-f0-9]{64}$/.test(a.sha256)||!Number.isSafeInteger(a.bytes)||a.bytes<1))throw Error('Skybox lacks four pinned interface assets');
}
const aegisReview=ids.includes('char_4218_aigis')?JSON.parse(await readFile(new URL('../../data/arkpedia-aegis-runtime-review.json',import.meta.url))):null;
if(aegisReview){
  const id='char_4218_aigis',review=aegisReview;
  const approved=JSON.stringify(review.enabledOperators)===JSON.stringify([id])&&review.verification.browser.status==='passed';
  const pending=candidateAegis&&review.enabledOperators.length===0&&review.verification.browser.status==='pending';
  const artifacts=Object.fromEntries(await Promise.all([['foundation','native-operators/char_4218_aigis'],['owner','aegis-art'],['recipe','aegis-art-recipe'],['clocks','aegis-clocks']].map(async([key,path])=>[key,await readFile(new URL(`../../data/arkpedia-${path}.json`,import.meta.url))])));
  const sha=key=>createHash('sha256').update(artifacts[key]).digest('hex'),e=JSON.parse(artifacts.foundation);
  if((!approved&&!pending)||review.frameParity!==false||review.moduleSupport!==false||review.nativeParticleSupport!==false||review.nativePixelParity!==false
    ||review.mechanicsPolicy!=='source-cn-aegis-independent-flight-six-marker-missiles-and-kick-v1'
    ||review.sourceFoundationSha256!==sha('foundation')||review.ownerArtworkSha256!==sha('owner')||review.sourceClocksSha256!==sha('clocks')||JSON.parse(artifacts.owner).recipeSha256!==sha('recipe')
    ||e.source.commit!==cnEvidence?.source.commit||JSON.stringify(e.tables.character)!==JSON.stringify(cnEvidence.tables.characters[id])
    ||Object.entries(e.tables.skills).some(([key,value])=>JSON.stringify(value)!==JSON.stringify(cnEvidence.tables.skills[key])))throw Error('Aegis lacks matching original source, art, clocks and public browser review');
  if(approved){for(const[path,key]of[['tools/arkpedia/review-aegis-public.mjs','scriptSha256'],['tools/arkpedia/public-review-driver.mjs','driverSha256'],['tools/arkpedia/public-review-server.mjs','fixtureServerSha256']]){
    if(createHash('sha256').update(await readFile(new URL('../../'+path,import.meta.url))).digest('hex')!==review.verification.browser[key])throw Error('Changed Aegis browser review tooling');
  }}
  const expected=['five-star-icons/Aegis - Base.webp','five-star-skins/Aegis - Base.webp','skill-icons/Aegis - Orgia Mode.webp','skill-icons/Aegis - Maximum Firepower.webp'].sort();
  if(JSON.stringify(review.interfaceAssets.map(a=>a.path).sort())!==JSON.stringify(expected)||review.interfaceAssets.some(a=>a.repository!==(a.path.startsWith('five-star-skins/')?'arkpedia/arkpedia-skin-assets':'arkpedia/arkpedia-image-assets')||!/^[a-f0-9]{40}$/.test(a.commit)||!/^[a-f0-9]{64}$/.test(a.sha256)||!Number.isSafeInteger(a.bytes)||a.bytes<1))throw Error('Aegis lacks four pinned interface assets');
  const sourcePaths={'five-star-icons/Aegis - Base.webp':'avatar/char_4218_aigis.png','five-star-skins/Aegis - Base.webp':'skin/char_4218_aigis_1b.png','skill-icons/Aegis - Orgia Mode.webp':'skill/skill_icon_skchr_aigis_1.png','skill-icons/Aegis - Maximum Firepower.webp':'skill/skill_icon_skchr_aigis_2.png'};
  if(review.interfaceProvenance?.length!==4||review.interfaceAssets.some(a=>{
    const p=review.interfaceProvenance.filter(p=>p.path===a.path);return p.length!==1||p[0].repository!==a.repository||p[0].commit!==a.commit||p[0].sourceMap!=='asset-source-map.json'
      ||!/^[a-f0-9]{64}$/.test(p[0].sourceMapSha256)||(typeof p[0].binding==='string'?p[0].binding:p[0].binding?.sourcePath)!==sourcePaths[a.path];
  }))throw Error('Aegis lacks exact original interface source IDs');
}
const yukariReview=ids.includes('char_4219_yukari')?JSON.parse(await readFile(new URL('../../data/arkpedia-yukari-runtime-review.json',import.meta.url))):null;
if(yukariReview){
  const id='char_4219_yukari',review=yukariReview;
  const approved=JSON.stringify(review.enabledOperators)===JSON.stringify([id])&&review.verification.browser.status==='passed';
  const pending=candidateYukari&&review.enabledOperators.length===0&&review.verification.browser.status==='pending';
  const artifacts=Object.fromEntries(await Promise.all([['foundation','native-operators/char_4219_yukari'],['owner','yukari-art'],['recipe','yukari-art-recipe'],['clocks','yukari-clocks'],['selection','yukari-selection']].map(async([key,path])=>[key,await readFile(new URL(`../../data/arkpedia-${path}.json`,import.meta.url))])));
  const sha=key=>createHash('sha256').update(artifacts[key]).digest('hex'),e=JSON.parse(artifacts.foundation);
  if((!approved&&!pending)||review.frameParity!==false||review.moduleSupport!==false||review.nativeParticleSupport!==false||review.nativePixelParity!==false
    ||review.mechanicsPolicy!=='source-cn-yukari-four-arrow-final-levitation-and-delayed-next-skill-arts-v1'
    ||review.sourceSelectionSha256!==sha('selection')||review.sourceFoundationSha256!==sha('foundation')||review.ownerArtworkSha256!==sha('owner')||review.sourceClocksSha256!==sha('clocks')||JSON.parse(artifacts.owner).recipeSha256!==sha('recipe')
    ||e.source.commit!==cnEvidence?.source.commit||JSON.stringify(e.tables.character)!==JSON.stringify(cnEvidence.tables.characters[id])
    ||Object.entries(e.tables.skills).some(([key,value])=>JSON.stringify(value)!==JSON.stringify(cnEvidence.tables.skills[key])))throw Error('Yukari lacks matching original source, art, clocks and public browser review');
  if(approved){for(const[path,key]of[['tools/arkpedia/review-yukari-public.mjs','scriptSha256'],['tools/arkpedia/public-review-driver.mjs','driverSha256'],['tools/arkpedia/public-review-server.mjs','fixtureServerSha256']]){
    if(createHash('sha256').update(await readFile(new URL('../../'+path,import.meta.url))).digest('hex')!==review.verification.browser[key])throw Error('Changed Yukari browser review tooling');
  }}
  const expected=['five-star-icons/Yukari Takeba - Base.webp','five-star-skins/Yukari Takeba - Base.webp','skill-icons/Yukari Takeba - Cyclone Arrow.webp','skill-icons/Yukari Takeba - Tranquility.webp'].sort();
  if(JSON.stringify(review.interfaceAssets.map(a=>a.path).sort())!==JSON.stringify(expected)||review.interfaceAssets.some(a=>a.repository!==(a.path.startsWith('five-star-skins/')?'arkpedia/arkpedia-skin-assets':'arkpedia/arkpedia-image-assets')||!/^[a-f0-9]{40}$/.test(a.commit)||!/^[a-f0-9]{64}$/.test(a.sha256)||!Number.isSafeInteger(a.bytes)||a.bytes<1))throw Error('Yukari lacks four pinned interface assets');
  const sourcePaths={'five-star-icons/Yukari Takeba - Base.webp':'avatar/char_4219_yukari.png','five-star-skins/Yukari Takeba - Base.webp':'skin/char_4219_yukari_1b.png','skill-icons/Yukari Takeba - Cyclone Arrow.webp':'skill/skill_icon_skchr_yukari_1.png','skill-icons/Yukari Takeba - Tranquility.webp':'skill/skill_icon_skchr_yukari_2.png'};
  if(review.interfaceProvenance?.length!==4||review.interfaceAssets.some(a=>{
    const p=review.interfaceProvenance.filter(p=>p.path===a.path);return p.length!==1||p[0].repository!==a.repository||p[0].commit!==a.commit||p[0].sourceMap!=='asset-source-map.json'
      ||!/^[a-f0-9]{64}$/.test(p[0].sourceMapSha256)||(typeof p[0].binding==='string'?p[0].binding:p[0].binding?.sourcePath)!==sourcePaths[a.path];
  }))throw Error('Yukari lacks exact original interface source IDs');
}
const makotoReview=ids.includes('char_4217_makoto')?JSON.parse(await readFile(new URL('../../data/arkpedia-makoto-runtime-review.json',import.meta.url))):null;
if(makotoReview){
  const id='char_4217_makoto',review=makotoReview;
  const approved=JSON.stringify(review.enabledOperators)===JSON.stringify([id])&&review.verification.browser.status==='passed';
  const pending=candidateMakoto&&review.enabledOperators.length===0&&review.verification.browser.status==='pending';
  const artifacts=Object.fromEntries(await Promise.all([['foundation','native-operators/char_4217_makoto'],['owner','makoto-art'],['recipe','makoto-art-recipe'],['clocks','makoto-clocks'],['status','makoto-status-source'],['visibility','makoto-visibility']].map(async([key,path])=>[key,await readFile(new URL(`../../data/arkpedia-${path}.json`,import.meta.url))])));
  const sha=key=>createHash('sha256').update(artifacts[key]).digest('hex'),e=JSON.parse(artifacts.foundation);
  if((!approved&&!pending)||review.frameParity!==false||review.moduleSupport!==false||review.nativeParticleSupport!==false||review.nativePixelParity!==false
    ||review.mechanicsPolicy!=='source-cn-makoto-persona-owned-forms-fatal-free-recast-and-allout-v1'
    ||review.sourceStatusSha256!==sha('status')||review.sourceVisibilitySha256!==sha('visibility')||JSON.parse(artifacts.recipe).visibilityProof.sha256!==sha('visibility')||review.sourceFoundationSha256!==sha('foundation')||review.ownerArtworkSha256!==sha('owner')||review.sourceClocksSha256!==sha('clocks')||JSON.parse(artifacts.owner).recipeSha256!==sha('recipe')
    ||e.source.commit!==cnEvidence?.source.commit||JSON.stringify(e.tables.character)!==JSON.stringify(cnEvidence.tables.characters[id])
    ||Object.entries(e.tables.skills).some(([key,value])=>JSON.stringify(value)!==JSON.stringify(cnEvidence.tables.skills[key])))throw Error('Makoto lacks matching original source, art, clocks and public browser review');
  if(approved){for(const[path,key]of[['tools/arkpedia/review-makoto-public.mjs','scriptSha256'],['tools/arkpedia/public-review-driver.mjs','driverSha256'],['tools/arkpedia/public-review-server.mjs','fixtureServerSha256']]){
    if(createHash('sha256').update(await readFile(new URL('../../'+path,import.meta.url))).digest('hex')!==review.verification.browser[key])throw Error('Changed Makoto browser review tooling');
  }}
  const expected=['six-star-icons/Makoto Yuki - Base.webp','six-star-skins/Makoto Yuki - Base.webp','skill-icons/Makoto Yuki - Harp of Orpheus.webp','skill-icons/Makoto Yuki - Chains of Thanatos.webp','skill-icons/Makoto Yuki - Dawn-Piercing Blade.webp'].sort();
  if(JSON.stringify(review.interfaceAssets.map(a=>a.path).sort())!==JSON.stringify(expected)||review.interfaceAssets.some(a=>a.repository!==(a.path.startsWith('six-star-skins/')?'arkpedia/arkpedia-skin-assets':'arkpedia/arkpedia-image-assets')||!/^[a-f0-9]{40}$/.test(a.commit)||!/^[a-f0-9]{64}$/.test(a.sha256)||!Number.isSafeInteger(a.bytes)||a.bytes<1))throw Error('Makoto lacks five pinned interface assets');
  const sourcePaths={'six-star-icons/Makoto Yuki - Base.webp':'avatar/char_4217_makoto.png','six-star-skins/Makoto Yuki - Base.webp':'skin/char_4217_makoto_1b.png','skill-icons/Makoto Yuki - Harp of Orpheus.webp':'skill/skill_icon_skchr_makoto_1.png','skill-icons/Makoto Yuki - Chains of Thanatos.webp':'skill/skill_icon_skchr_makoto_2.png','skill-icons/Makoto Yuki - Dawn-Piercing Blade.webp':'skill/skill_icon_skchr_makoto_3.png'};
  if(review.interfaceProvenance?.length!==5||review.interfaceAssets.some(a=>{
    const p=review.interfaceProvenance.filter(p=>p.path===a.path);return p.length!==1||p[0].repository!==a.repository||p[0].commit!==a.commit||p[0].sourceMap!=='asset-source-map.json'
      ||!/^[a-f0-9]{64}$/.test(p[0].sourceMapSha256)||(typeof p[0].binding==='string'?p[0].binding:p[0].binding?.sourcePath)!==sourcePaths[a.path];
  }))throw Error('Makoto lacks exact original interface source IDs');
}
const aphrissaSource=ids.includes('char_4229_aphris')?JSON.parse(await readFile(new URL('../../data/arkpedia-native-operators/char_4229_aphris.json',import.meta.url))):null;
const aphrissaReview=aphrissaSource?JSON.parse(await readFile(new URL('../../data/arkpedia-aphrissa-runtime-review.json',import.meta.url))):null;
if(aphrissaSource){
  const id='char_4229_aphris',review=aphrissaReview;
  const approved=JSON.stringify(review.enabledOperators)===JSON.stringify([id])&&review.verification.browser.status==='passed';
  const pending=candidateAphrissa&&review.enabledOperators.length===0&&review.verification.browser.status==='pending';
  const artifacts=Object.fromEntries(await Promise.all([['foundation','native-operators/char_4229_aphris'],['owner','aphrissa-art'],['ownerRecipe','aphrissa-art-recipe'],
    ['token','aphrissa-token-art'],['tokenRecipe','aphrissa-token-art-recipe'],['avatar','aphrissa-token-avatar'],['avatarRecipe','aphrissa-token-avatar-recipe'],
    ['interface','aphrissa-interface-art'],['clocks','aphrissa-clocks']].map(async([key,path])=>[key,await readFile(new URL(`../../data/arkpedia-${path}.json`,import.meta.url))])));
  const sha=key=>createHash('sha256').update(artifacts[key]).digest('hex'),json=key=>JSON.parse(artifacts[key]);
  // The CN evidence pack serializes the same rows with a different key order.
  if((!approved&&!pending)||review.frameParity!==false||review.moduleSupport!==false||review.nativeParticleSupport!==false||review.nativePixelParity!==false
    ||review.mechanicsPolicy!=='source-cn-aphrissa-relay-rays-owned-skills-v1'
    ||review.sourceFoundationSha256!==sha('foundation')||review.ownerArtworkSha256!==sha('owner')||review.tokenArtworkSha256!==sha('token')
    ||review.tokenAvatarSha256!==sha('avatar')||review.interfaceArtworkSha256!==sha('interface')||review.sourceClocksSha256!==sha('clocks')
    ||json('owner').recipeSha256!==sha('ownerRecipe')||json('token').recipeSha256!==sha('tokenRecipe')||json('avatar').recipeSha256!==sha('avatarRecipe')
    ||[json('ownerRecipe'),json('tokenRecipe'),json('avatarRecipe')].some(r=>r.foundationSha256!==sha('foundation'))||json('clocks').receiptSha256!==sha('foundation')
    ||aphrissaSource.source.commit!==cnEvidence?.source.commit||!isDeepStrictEqual(aphrissaSource.tables.character,cnEvidence.tables.characters[id])
    ||Object.entries(aphrissaSource.tables.skills).some(([key,value])=>!isDeepStrictEqual(value,cnEvidence.tables.skills[key])))
    throw Error('Aphrissa lacks matching original owner/relay source, artwork, clocks and public browser review');
  if(approved){for(const[path,key]of[['tools/arkpedia/review-aphrissa-public.mjs','scriptSha256'],['tools/arkpedia/public-review-driver.mjs','driverSha256'],['tools/arkpedia/public-review-server.mjs','fixtureServerSha256']]){
    if(createHash('sha256').update(await readFile(new URL('../../'+path,import.meta.url))).digest('hex')!==review.verification.browser[key])throw Error('Changed Aphrissa browser review tooling');
  }}
}
const reconSource = ids.includes('char_4215_buddy') ? JSON.parse(await readFile(new URL('../../data/arkpedia-native-operators/char_4215_buddy.json', import.meta.url))) : null;
if(reconSource){
  const id='char_4215_buddy',review=JSON.parse(await readFile(new URL('../../data/arkpedia-recon-runtime-review.json',import.meta.url)));
  const approved=JSON.stringify(review.enabledOperators)===JSON.stringify([id])&&review.verification.browser.status==='passed';
  const pending=candidateRecon&&review.enabledOperators.length===0&&review.verification.browser.status==='pending';
  const artifacts=Object.fromEntries(await Promise.all([
    ['foundation','native-operators/char_4215_buddy'],['owner','recon-art'],['ownerRecipe','recon-art-recipe'],
    ['token','palamute-art'],['tokenRecipe','palamute-art-recipe'],['clocks','recon-clocks'],
    ['avatar','palamute-avatar'],['avatarRecipe','palamute-avatar-recipe']
  ].map(async([key,path])=>[key,await readFile(new URL(`../../data/arkpedia-${path}.json`,import.meta.url))])));
  const sha=key=>createHash('sha256').update(artifacts[key]).digest('hex');
  if((!approved&&!pending)||review.frameParity!==false||review.moduleSupport!==false||review.nativeParticleSupport!==false||review.nativePixelParity!==false
    ||review.mechanicsPolicy!=='source-cn-passive-bombs-owner-modes-and-palamute-point-v1'
    ||review.sourceFoundationSha256!==sha('foundation')||review.ownerArtworkSha256!==sha('owner')||review.tokenArtworkSha256!==sha('token')||review.sourceClocksSha256!==sha('clocks')
    ||review.tokenAvatarSha256!==sha('avatar')||JSON.parse(artifacts.avatar).recipeSha256!==sha('avatarRecipe')
    ||JSON.parse(artifacts.avatar).foundation.sha256!==sha('foundation')
    ||JSON.parse(artifacts.owner).recipeSha256!==sha('ownerRecipe')||JSON.parse(artifacts.token).recipeSha256!==sha('tokenRecipe')
    ||reconSource.source.commit!==cnEvidence?.source.commit||JSON.stringify(reconSource.tables.character)!==JSON.stringify(cnEvidence.tables.characters[id])
    ||Object.keys(reconSource.tables.skills).length!==0||reconSource.tables.character.skills.length!==0)
    throw Error('Recon lacks matching original owner/token source, artwork, clocks and public browser review');
  if(approved){for(const [path,key]of[['tools/arkpedia/review-recon-public.mjs','scriptSha256'],['tools/arkpedia/public-review-driver.mjs','driverSha256'],['tools/arkpedia/public-review-server.mjs','fixtureServerSha256']]){
    const bytes=await readFile(new URL('../../'+path,import.meta.url));if(createHash('sha256').update(bytes).digest('hex')!==review.verification.browser[key])throw Error('Changed Recon browser review tooling');
  }}
  const expected=['one-star-icons/Rhodes Island Recon - Base.webp','one-star-skins/Rhodes Island Recon - Base.webp'].sort();
  if(JSON.stringify(review.interfaceAssets.map(a=>a.path).sort())!==JSON.stringify(expected)||review.interfaceAssets.some(a=>pins[a.repository]!==a.commit||!/^[a-f0-9]{64}$/.test(a.sha256)||!Number.isSafeInteger(a.bytes)||a.bytes<1))throw Error('Recon lacks two pinned interface assets');
}
const mcnistSource = ids.includes('char_4230_mcnist') ? JSON.parse(await readFile(new URL('../../data/arkpedia-native-operators/char_4230_mcnist.json', import.meta.url))) : null;
if (mcnistSource) {
  const id='char_4230_mcnist',review=JSON.parse(await readFile(new URL('../../data/arkpedia-mcnist-runtime-review.json',import.meta.url)));
  const approved=JSON.stringify(review.enabledOperators)===JSON.stringify([id])&&review.verification.browser.status==='passed';
  const pending=candidateMcnist&&review.enabledOperators.length===0&&review.verification.browser.status==='pending';
  const artifacts=Object.fromEntries(await Promise.all([
    ['foundation','native-operators/char_4230_mcnist'],['owner','mcnist-art'],['ownerRecipe','mcnist-art-recipe'],
    ['token','mcnist-token-art'],['tokenRecipe','mcnist-token-art-recipe'],['clocks','mcnist-clocks'],
    ['avatar','mcnist-token-avatar'],['avatarRecipe','mcnist-token-avatar-recipe']
  ].map(async([key,path])=>[key,await readFile(new URL(`../../data/arkpedia-${path}.json`,import.meta.url))])));
  const sha=key=>createHash('sha256').update(artifacts[key]).digest('hex');
  if((!approved&&!pending)||review.frameParity!==false||review.moduleSupport!==false||review.nativeParticleSupport!==false||review.nativePixelParity!==false
    ||review.mechanicsPolicy!=='source-cn-owner-mcgraf-barriers-ammo-cross-and-fresh-charge-v1'
    ||review.sourceFoundationSha256!==sha('foundation')||review.ownerArtworkSha256!==sha('owner')||review.tokenArtworkSha256!==sha('token')||review.sourceClocksSha256!==sha('clocks')
    ||review.tokenAvatarSha256!==sha('avatar')||JSON.parse(artifacts.avatar).recipeSha256!==sha('avatarRecipe')
    ||JSON.parse(artifacts.avatar).foundation.sha256!==sha('foundation')
    ||JSON.parse(artifacts.owner).recipeSha256!==sha('ownerRecipe')||JSON.parse(artifacts.token).recipeSha256!==sha('tokenRecipe')
    ||mcnistSource.source.commit!==cnEvidence?.source.commit||JSON.stringify(mcnistSource.tables.character)!==JSON.stringify(cnEvidence.tables.characters[id])
    ||Object.entries(mcnistSource.tables.skills).some(([key,value])=>JSON.stringify(value)!==JSON.stringify(cnEvidence.tables.skills[key])))
    throw Error('Mechanist lacks matching original owner/token source, artwork, clocks and public browser review');
  const expected=['six-star-icons/Mechanist - Base.webp','six-star-skins/Mechanist - Base.webp','skill-icons/Mechanist - Cluster Analysis.webp','skill-icons/Mechanist - Co-operative Defense Techniques.webp','skill-icons/Mechanist - Star of Engineering.webp'].sort();
  if(JSON.stringify(review.interfaceAssets.map(a=>a.path).sort())!==JSON.stringify(expected)||review.interfaceAssets.some(a=>pins[a.repository]!==a.commit||!/^[a-f0-9]{64}$/.test(a.sha256)||!Number.isSafeInteger(a.bytes)||a.bytes<1))throw Error('Mechanist lacks five pinned interface assets');
}
if (ids.includes('char_4220_kormr')) {
  const id = 'char_4220_kormr';
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-koromaru-runtime-review.json', import.meta.url)));
  const foundation = await readFile(new URL('../../data/arkpedia-native-operators/char_4220_kormr.json', import.meta.url));
  const art = await readFile(new URL('../../data/arkpedia-koromaru-art.json', import.meta.url));
  const recipe = await readFile(new URL('../../data/arkpedia-koromaru-art-recipe.json', import.meta.url));
  const clocks = await readFile(new URL('../../data/arkpedia-koromaru-clocks.json', import.meta.url));
  const statuses = await readFile(new URL('../../data/arkpedia-koromaru-status-source.json', import.meta.url));
  const visibility = await readFile(new URL('../../data/arkpedia-koromaru-visibility.json', import.meta.url));
  const e = JSON.parse(foundation);
  const approved = JSON.stringify(review.enabledOperators) === JSON.stringify([id]) && review.verification.browser.status === 'passed';
  const pending = candidateKoromaru && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if(approved){for(const [path,key]of[['tools/arkpedia/review-koromaru-public.mjs','scriptSha256'],['tools/arkpedia/public-review-driver.mjs','driverSha256'],['tools/arkpedia/public-review-server.mjs','fixtureServerSha256']]){
    const bytes=await readFile(new URL('../../'+path,import.meta.url));if(createHash('sha256').update(bytes).digest('hex')!==review.verification.browser[key])throw Error('Changed Koromaru browser review tooling');
  }}
  if ((!approved && !pending) || review.frameParity !== false || review.nativeParticleSupport !== false
    || review.moduleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-passive-six-slash-and-startup-protection-v1'
    || review.sourceFoundationSha256 !== createHash('sha256').update(foundation).digest('hex')
    || review.ownerArtworkSha256 !== createHash('sha256').update(art).digest('hex')
    || JSON.parse(art).recipeSha256 !== createHash('sha256').update(recipe).digest('hex')
    || review.sourceClocksSha256 !== createHash('sha256').update(clocks).digest('hex')
    || review.statusSourceSha256 !== createHash('sha256').update(statuses).digest('hex')
    || review.visibilitySourceSha256 !== createHash('sha256').update(visibility).digest('hex')
    || JSON.parse(recipe).visibilityProof.sha256 !== review.visibilitySourceSha256
    || e.source.commit !== cnEvidence?.source.commit
    || JSON.stringify(e.tables.character) !== JSON.stringify(cnEvidence.tables.characters[id])
    || Object.entries(e.tables.skills).some(([key,value]) => JSON.stringify(value) !== JSON.stringify(cnEvidence.tables.skills[key])))
    throw Error('Koromaru lacks matching source/artwork and completed public browser review');
  const expected = ["one-star-icons/Koromaru - Base.webp", "one-star-skins/Koromaru - Base.webp"].sort();
  if (JSON.stringify(review.interfaceAssets.map(a => a.path).sort()) !== JSON.stringify(expected)
    || review.interfaceAssets.some(a => pins[a.repository] !== a.commit || !/^[a-f0-9]{64}$/.test(a.sha256)
      || !Number.isSafeInteger(a.bytes) || a.bytes < 1)) throw Error('Koromaru lacks pinned interface assets');
}
if (ids.includes('char_4227_gallus')) {
  const id = 'char_4227_gallus';
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-gallus-runtime-review.json', import.meta.url)));
  const foundation = await readFile(new URL('../../data/arkpedia-native-operators/char_4227_gallus.json', import.meta.url));
  const art = await readFile(new URL('../../data/arkpedia-gallus-art.json', import.meta.url));
  const recipe = await readFile(new URL('../../data/arkpedia-gallus-art-recipe.json', import.meta.url));
  const clocks = await readFile(new URL('../../data/arkpedia-gallus-clocks.json', import.meta.url));
  const e = JSON.parse(foundation);
  const approved = JSON.stringify(review.enabledOperators) === JSON.stringify([id]) && review.verification.browser.status === 'passed';
  const pending = candidateGallus && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !pending) || review.frameParity !== false || review.nativeParticleSupport !== false
    || review.moduleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-passive-window-and-source-res-reduction-v1'
    || review.sourceFoundationSha256 !== createHash('sha256').update(foundation).digest('hex')
    || review.ownerArtworkSha256 !== createHash('sha256').update(art).digest('hex')
    || JSON.parse(art).recipeSha256 !== createHash('sha256').update(recipe).digest('hex')
    || review.sourceClocksSha256 !== createHash('sha256').update(clocks).digest('hex')
    || e.source.commit !== cnEvidence?.source.commit
    || JSON.stringify(e.tables.character) !== JSON.stringify(cnEvidence.tables.characters[id])
    || Object.entries(e.tables.skills).some(([key,value]) => JSON.stringify(value) !== JSON.stringify(cnEvidence.tables.skills[key])))
    throw Error('GALLUS² lacks matching source/artwork and completed public browser review');
  const expected = ["one-star-icons/Gallus² - Base.webp", "one-star-skins/Gallus² - Base.webp"].sort();
  if (JSON.stringify(review.interfaceAssets.map(a => a.path).sort()) !== JSON.stringify(expected)
    || review.interfaceAssets.some(a => pins[a.repository] !== a.commit || !/^[a-f0-9]{64}$/.test(a.sha256)
      || !Number.isSafeInteger(a.bytes) || a.bytes < 1)) throw Error('GALLUS² lacks pinned interface assets');
}
if (ids.includes('char_4234_pedro')) {
  const id = 'char_4234_pedro';
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-pedro-runtime-review.json', import.meta.url)));
  const foundation = await readFile(new URL('../../data/arkpedia-native-operators/char_4234_pedro.json', import.meta.url));
  const art = await readFile(new URL('../../data/arkpedia-pedro-art.json', import.meta.url));
  const recipe = await readFile(new URL('../../data/arkpedia-pedro-art-recipe.json', import.meta.url));
  const clocks = await readFile(new URL('../../data/arkpedia-pedro-clocks.json', import.meta.url));
  const e = JSON.parse(foundation);
  const approved = JSON.stringify(review.enabledOperators) === JSON.stringify([id]) && review.verification.browser.status === 'passed';
  const pending = candidatePedro && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !pending) || review.frameParity !== false || review.nativeParticleSupport !== false
    || review.moduleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-cached-arts-trigger-and-snapshot-ally-protection-v1'
    || review.sourceFoundationSha256 !== createHash('sha256').update(foundation).digest('hex')
    || review.ownerArtworkSha256 !== createHash('sha256').update(art).digest('hex')
    || JSON.parse(art).recipeSha256 !== createHash('sha256').update(recipe).digest('hex')
    || review.sourceClocksSha256 !== createHash('sha256').update(clocks).digest('hex')
    || e.source.commit !== cnEvidence?.source.commit
    || JSON.stringify(e.tables.character) !== JSON.stringify(cnEvidence.tables.characters[id])
    || Object.entries(e.tables.skills).some(([key,value]) => JSON.stringify(value) !== JSON.stringify(cnEvidence.tables.skills[key])))
    throw Error('Pedro lacks matching source/artwork and completed public browser review');
  const expected = ["five-star-icons/Pedro - Base.webp", "five-star-skins/Pedro - Base.webp", "skill-icons/Pedro - Marking Shot.webp", "skill-icons/Pedro - Alternate Evacuation.webp"].sort();
  if (JSON.stringify(review.interfaceAssets.map(a => a.path).sort()) !== JSON.stringify(expected)
    || review.interfaceAssets.some(a => pins[a.repository] !== a.commit || !/^[a-f0-9]{64}$/.test(a.sha256)
      || !Number.isSafeInteger(a.bytes) || a.bytes < 1)) throw Error('Pedro lacks pinned interface assets');
}
if (ids.includes('char_4207_branch')) {
  const id = 'char_4207_branch';
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-branch-runtime-review.json', import.meta.url)));
  const foundation = await readFile(new URL('../../data/arkpedia-native-operators/char_4207_branch.json', import.meta.url));
  const art = await readFile(new URL('../../data/arkpedia-branch-art.json', import.meta.url));
  const e = JSON.parse(foundation);
  const approved = JSON.stringify(review.enabledOperators) === JSON.stringify([id]) && review.verification.browser.status === 'passed';
  const pending = candidateBranch && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !pending) || review.frameParity !== false || review.nativeParticleSupport !== false
    || review.moduleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-upstream-unyield-activation-pulse-and-parented-resistance-v1'
    || review.sourceFoundationSha256 !== createHash('sha256').update(foundation).digest('hex')
    || review.ownerArtworkSha256 !== createHash('sha256').update(art).digest('hex')
    || e.source.commit !== cnEvidence?.source.commit
    || JSON.stringify(e.tables.character) !== JSON.stringify(cnEvidence.tables.characters[id])
    || Object.entries(e.tables.skills).some(([key,value]) => JSON.stringify(value) !== JSON.stringify(cnEvidence.tables.skills[key])))
    throw Error('Vetochki lacks matching source/artwork and completed public browser review');
  const expected = ['five-star-icons/Vetochki - Base.webp', 'five-star-skins/Vetochki - Base.webp',
    'skill-icons/Vetochki - Desperate Resistance.webp', 'skill-icons/Vetochki - Set on Survival.webp'].sort();
  if (JSON.stringify(review.interfaceAssets.map(a => a.path).sort()) !== JSON.stringify(expected)
    || review.interfaceAssets.some(a => pins[a.repository] !== a.commit || !/^[a-f0-9]{64}$/.test(a.sha256)
      || !Number.isSafeInteger(a.bytes) || a.bytes < 1)) throw Error('Vetochki lacks pinned interface assets');
}
if (ids.includes('char_4196_reckpr')) {
  const id = 'char_4196_reckpr';
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-reckpr-runtime-review.json', import.meta.url)));
  const foundation = await readFile(new URL('../../data/arkpedia-native-operators/char_4196_reckpr.json', import.meta.url));
  const art = await readFile(new URL('../../data/arkpedia-reckpr-art.json', import.meta.url));
  const e = JSON.parse(foundation);
  const approved = JSON.stringify(review.enabledOperators) === JSON.stringify([id]) && review.verification.browser.status === 'passed';
  const pending = candidateReckpr && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !pending) || review.frameParity !== false || review.nativeParticleSupport !== false
    || review.moduleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-charged-healing-and-recipient-reactive-listeners-v1'
    || review.sourceFoundationSha256 !== createHash('sha256').update(foundation).digest('hex')
    || review.ownerArtworkSha256 !== createHash('sha256').update(art).digest('hex')
    || e.source.commit !== cnEvidence?.source.commit
    || JSON.stringify(e.tables.character) !== JSON.stringify(cnEvidence.tables.characters[id])
    || Object.entries(e.tables.skills).some(([key,value]) => JSON.stringify(value) !== JSON.stringify(cnEvidence.tables.skills[key])))
    throw Error('Record Keeper lacks matching source/artwork and completed public browser review');
  const expected = ['five-star-icons/Record Keeper - Base.webp', 'five-star-skins/Record Keeper - Base.webp',
    'skill-icons/Record Keeper - Learning by Analogy.webp', 'skill-icons/Record Keeper - Sage Advice.webp'].sort();
  if (JSON.stringify(review.interfaceAssets.map(a => a.path).sort()) !== JSON.stringify(expected)
    || review.interfaceAssets.some(a => pins[a.repository] !== a.commit || !/^[a-f0-9]{64}$/.test(a.sha256)
      || !Number.isSafeInteger(a.bytes) || a.bytes < 1)) throw Error('Record Keeper lacks pinned interface assets');
}
if (ids.includes('char_4228_closur')) {
  const id = 'char_4228_closur';
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-closur-runtime-review.json', import.meta.url)));
  const foundation = await readFile(new URL('../../data/arkpedia-native-operators/char_4228_closur.json', import.meta.url));
  const art = await readFile(new URL('../../data/arkpedia-closur-device-art.json', import.meta.url));
  const e = JSON.parse(foundation);
  const approved = JSON.stringify(review.enabledOperators) === JSON.stringify([id]) && review.verification.browser.status === 'passed';
  const pending = candidateClosur && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !pending) || review.frameParity !== false || review.nativeParticleSupport !== false
    || review.moduleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-command-center-continuous-fire-and-debt-v1'
    || review.sourceFoundationSha256 !== createHash('sha256').update(foundation).digest('hex')
    || review.deviceArtworkSha256 !== createHash('sha256').update(art).digest('hex')
    || e.source.commit !== cnEvidence?.source.commit
    || JSON.stringify(e.tables.character) !== JSON.stringify(cnEvidence.tables.characters[id])
    || Object.entries(e.tables.skills).some(([key, value]) => JSON.stringify(value) !== JSON.stringify(cnEvidence.tables.skills[key])))
    throw Error('Closure lacks matching source/artwork and completed public browser review');
  const expected = ['six-star-icons/Closure - Base.webp', 'six-star-skins/Closure - Base.webp',
    'skill-icons/Closure - Recursion Tactic.webp', 'skill-icons/Closure - Algorithm Expansion.webp', 'skill-icons/Closure - Q.E.D..webp'].sort();
  if (JSON.stringify(review.interfaceAssets.map(a => a.path).sort()) !== JSON.stringify(expected)
    || review.interfaceAssets.some(a => pins[a.repository] !== a.commit || !/^[a-f0-9]{64}$/.test(a.sha256)
      || !Number.isSafeInteger(a.bytes) || a.bytes < 1)) throw Error('Closure lacks pinned interface assets');
}
if (ids.includes('char_4031_liesel')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-liesel-runtime-review.json', import.meta.url)));
  const foundation = await readFile(new URL('../../data/arkpedia-native-operators/char_4031_liesel.json', import.meta.url));
  const evidence = JSON.parse(foundation), id = 'char_4031_liesel';
  if (JSON.stringify(review.enabledOperators) !== JSON.stringify([id]) || review.frameParity !== false
    || review.nativeParticleSupport !== false || review.moduleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-charged-splash-and-delayed-homing-v1'
    || review.verification.browser.status !== 'passed'
    || review.sourceFoundationSha256 !== createHash('sha256').update(foundation).digest('hex')
    || evidence.source.commit !== cnEvidence?.source.commit
    || JSON.stringify(evidence.tables.character) !== JSON.stringify(cnEvidence.tables.characters[id])
    || Object.entries(evidence.tables.skills).some(([key, value]) => JSON.stringify(value) !== JSON.stringify(cnEvidence.tables.skills[key])))
    throw Error('Ripresa lacks matching pinned CN source review');
  const expected = ['five-star-icons/Ripresa - Base.webp', 'five-star-skins/Ripresa - Base.webp',
    "skill-icons/Ripresa - Conductor's Cue.webp", 'skill-icons/Ripresa - Al Fine.webp'].sort();
  if (JSON.stringify(review.interfaceAssets.map(a => a.path).sort()) !== JSON.stringify(expected)
    || review.interfaceAssets.some(a => pins[a.repository] !== a.commit || !/^[a-f0-9]{64}$/.test(a.sha256)
      || !Number.isSafeInteger(a.bytes) || a.bytes < 1)) throw Error('Ripresa lacks pinned interface assets');
}
if (ids.includes('char_4051_akkord')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-akkord-runtime-review.json', import.meta.url)));
  const foundation = await readFile(new URL('../../data/arkpedia-akkord-prefabs.json', import.meta.url));
  const evidence = JSON.parse(foundation), id = 'char_4051_akkord';
  if (JSON.stringify(review.enabledOperators) !== JSON.stringify([id]) || review.frameParity !== false
    || review.nativeParticleSupport !== false || review.moduleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-line-and-ally-bursts-v1'
    || review.verification.browser.status !== 'passed'
    || review.sourceFoundationSha256 !== createHash('sha256').update(foundation).digest('hex')
    || evidence.source.commit !== cnEvidence?.source.commit
    || JSON.stringify(evidence.tables.character) !== JSON.stringify(cnEvidence.tables.characters[id])
    || Object.entries(evidence.tables.skills).some(([key, value]) => JSON.stringify(value) !== JSON.stringify(cnEvidence.tables.skills[key])))
    throw Error('Akkord lacks matching pinned CN source review');
}
if (cnEvidence) {
  const roster = JSON.parse(await readFile(new URL('../../data/arkpedia-roster-target.json', import.meta.url), 'utf8'));
  if (cnEvidence.source.repository !== roster.source.repository || cnEvidence.source.commit !== roster.source.commit
    || cnEvidence.globalSource.commit !== pins[paths.character_table[0]]
    || cnEvidence.globalSource.characterTableSha256 !== createHash('sha256').update(await readFile(new URL('character_table.json', cache))).digest('hex'))
    throw Error('CN candidate tables do not match the reviewed roster/Global snapshot');
  for (const id of ids) if (operatorChannel(id, REGULAR_OPERATORS[id]) === 'cn' && REGULAR_OPERATORS[id].templateKey)
    throw Error(`CN shared skill-prefab binding requires a separate native review: ${id}`);
}
const usesForms = ids.some(id => REGULAR_OPERATORS[id].sourceForm);
let formSource;
if (usesForms) {
  const audits = await Promise.all(ids.filter(id => REGULAR_OPERATORS[id].sourceForm).map(async id => {
    const name = id === 'char_1001_amiya2' ? 'amiya-guard' : id === 'char_1037_amiya3' ? 'amiya-medic' : null;
    if (!name) throw Error(`Unreviewed Global alternate form: ${id}`);
    const evidence = JSON.parse(await readFile(new URL(`../../data/arkpedia-${name}-prefabs.json`, import.meta.url)));
    if (!evidence.enabledOperators.includes(id) || evidence.heldOperators.includes(id))
      throw Error(`Global alternate form lacks complete combat review: ${id}`);
    return evidence;
  }));
  const evidence = audits[0];
  const hash = createHash('sha256').update(await readFile(new URL('char_patch_table.json', cache))).digest('hex');
  if (audits.some(e => e.source.commit !== pins[paths.character_table[0]] || hash !== e.source.tableHashes.char_patch_table))
    throw Error('Global alternate-form cache differs from the reviewed source');
  formSource = { commit: evidence.source.commit, sha256: hash,
    patchTable: evidence.source.patchTable, formIds: Object.keys(forms.patchChars) };
}
const operators = compileReviewedOperators({ registry: REGULAR_OPERATORS,
  global: { characters, skills, ranges, forms }, cn: cnEvidence?.tables });
for (const op of Object.values(operators)) assertRegularOperator(op);
const tokenIds = ['token_10056_angel2_target', 'token_10035_wisdel_wward', 'token_10012_rosmon_shield', 'token_10031_swire2_gdtrap', 'token_10033_ela_grzmot', 'token_10034_ray_sndbst', 'token_10028_vigil_wolf', 'token_10026_bgsnow_subbow', 'token_10017_skadi2_dedant', 'token_10025_doroth_recttp', 'token_10036_lasher_mcbird', 'token_10032_jesca2_jckshd', 'token_10040_siege2_vlion', 'token_10009_weedy_cannon', 'token_10024_ebnhlz_rcube', 'token_10044_wulfen_mine', 'token_10042_tecno_puppet', 'token_10041_cathy_catsld', 'token_10022_kazema_shadow', 'token_10001_deepcl_tentac', 'token_10018_robrta_mach', 'token_10014_bstalk_crab', 'token_10011_beewax_oblisk', 'token_10006_vodfox_doll', 'token_10003_cgbird_bird', 'token_10000_silent_healrb', 'token_10015_dusk_drgn', 'token_10007_phatom_twin', 'token_10008_cqbw_box', 'token_10029_slent2_protrb', 'token_10019_nearl2_sword', 'token_10002_kalts_mon3tr', 'token_10010_folivo_car', 'token_10021_blkngt_hypnos', 'token_10023_windft_wrench', 'token_10045_alanna_crane', 'token_10013_robin_mine', 'token_10016_rfrost_mine', 'token_10004_otter_motter'];
tokenIds.unshift('token_10005_mgllan_drone1', 'token_10005_mgllan_drone2', 'token_10005_mgllan_drone3');
tokenIds.unshift('token_10020_ling_soul1', 'token_10020_ling_soul2', 'token_10020_ling_soul3');
tokenIds.unshift(...[1, 2, 3].map(n => `token_10027_ironmn_pile${n}`));
tokenIds.unshift('token_10037_mitm_trshrb');
if (ids.includes('char_249_mlyss')) tokenIds.unshift('token_10030_mlyss_wtrman');
if(ids.includes('char_1042_phatm2'))tokenIds.unshift('token_10054_phatm2_encdool','token_10055_phatm2_mndclv');
if (ids.includes('char_4179_monstr')) tokenIds.unshift('token_10050_monstr_prosts');
if (ids.includes('char_450_necras')) tokenIds.unshift('token_10043_necras_skeltn');
if (ids.includes('char_4228_closur')) tokenIds.unshift('token_10066_closur_ourbase');
if (mcnistSource) tokenIds.unshift('token_10069_mcnist_mcgraf');
if (reconSource) tokenIds.unshift('token_10063_buddy_bddg');
if (aphrissaSource) tokenIds.unshift(APHRISSA_TOKEN);
const closurSource = ids.includes('char_4228_closur')
  ? JSON.parse(await readFile(new URL('../../data/arkpedia-native-operators/char_4228_closur.json', import.meta.url))) : null;
const tokens = Object.fromEntries(tokenIds.map(id => {
  const closurToken = id === 'token_10066_closur_ourbase';
  const sourceToken=closurToken?closurSource:id==='token_10069_mcnist_mcgraf'?mcnistSource:id==='token_10063_buddy_bddg'?reconSource:id===APHRISSA_TOKEN?aphrissaSource:null;
  const c = sourceToken ? sourceToken.tables.tokens[id] : characters[id];
  const tokenRanges = sourceToken ? sourceToken.tables.ranges : ranges;
  const tokenSkills = sourceToken ? sourceToken.tables.tokenSkills : skills;
  if (!c) throw Error(`Missing original token: ${id}`);
  const candidate = v => v.rangeId
    ? { ...v, rangeGrid: tokenRanges[v.rangeId].grids.map(p => [p.row, p.col]) } : v;
  return [id, { id, name: sourceToken ? c.appellation.trim() : c.name, profession: c.profession,
    subProfessionId: c.subProfessionId, position: c.position,
    phases: c.phases.map(p => ({ maxLevel: p.maxLevel,
      attributesKeyFrames: p.attributesKeyFrames,
      rangeGrid: tokenRanges[p.rangeId].grids.map(p => [p.row, p.col]),
    })),
    trait: c.trait ? { ...c.trait, candidates: c.trait.candidates.map(candidate) } : null,
    talents: (c.talents ?? []).map(t => ({ ...t, candidates: (t.candidates ?? []).map(candidate) })),
    skills: (c.skills ?? []).map(s => ({ id: s.skillId, unlockCondition: s.unlockCond,
      levels: (s.skillId === null ? [] : tokenSkills[s.skillId].levels).map(level => level.rangeId
        ? { ...level, rangeGrid: tokenRanges[level.rangeId].grids.map(p => [p.row, p.col]) } : level) })),
  }];
}));
const bindingEvidence = JSON.parse(await readFile(new URL("../../data/arkpedia-skill-prefabs.json", import.meta.url), "utf8"));
const tableHash = createHash("sha256").update(await readFile(new URL("buff_template_data.json", cache))).digest("hex");
if (bindingEvidence.templateTableSha256 !== tableHash)
  throw Error("Skill-prefab evidence does not match source templates; re-extract and review before rebuilding");
const templates = {};
for (const [id, support] of Object.entries(REGULAR_OPERATORS)) {
  if (!support.templateKey) continue;
  if (JSON.stringify(bindingEvidence.prefabs[support.prefabId]?.buffTemplates) !== JSON.stringify([support.templateKey]))
    throw Error(`Missing verified skill binding: ${id}`);
  const program = compileBuffTemplate(buffTemplates[support.templateKey]);
  for (const level of operators[id].skills[0].levels) {
    if (level.prefabId !== support.prefabId) throw Error(`Unexpected skill prefab: ${id}`);
    program.validateBlackboard(Object.fromEntries(level.blackboard.map(({ key, value }) => [key, value])));
  }
  templates[support.templateKey] = buffTemplates[support.templateKey];
}
const enemyRecords = Object.fromEntries(
  geometry.enemyConfigurations.map((config) => {
    const rows = enemies.enemies.find((e) => e.Key === config.enemy_id)?.Value;
    if (!rows) throw new Error(`Missing enemy: ${config.enemy_id}`);
    // Undeclared overrides inherit the serialized base enum (normally NORMAL).
    const values = { levelType: rows[0]?.enemyData.levelType?.m_value },
      stats = {};
    for (const row of rows.filter((r) => r.level <= config.database_level)) {
      for (const [k, v] of Object.entries(row.enemyData))
        if (v?.m_defined) values[k] = v.m_value;
      for (const [k, v] of Object.entries(row.enemyData.attributes))
        if (v.m_defined) stats[k] = v.m_value;
    }
    if (!['NORMAL', 'ELITE', 'BOSS'].includes(values.levelType))
      throw new Error(`Unsupported source enemy rank: ${config.enemy_id}:${values.levelType}`);
    return [
      config.enemy_id,
      {
        name: values.name,
        rank: values.levelType,
        motion: values.motion,
        applyWay: values.applyWay,
        lifePointReduce: values.lifePointReduce,
        tags: values.enemyTags ?? [],
        stats: { ...stats, ...config.overrides },
      },
    ];
  }),
);
if (
  geometry.hasConditionalSpawns ||
  geometry.suppliedUnits.length ||
  geometry.waves.length !== 1
)
  throw new Error("Stage now needs unsupported mechanics");
const sdArg = process.argv.indexOf('--sd-commit');
const sdRequested = sdArg < 0 ? null : process.argv[sdArg + 1];
if (sdArg >= 0 && !/^[a-f0-9]{40}$/.test(sdRequested ?? ''))
  throw Error('--sd-commit requires an immutable forty-character Git commit');
const sdCommit = execFileSync("git", ["rev-parse", ...(sdRequested ? ["--verify", `${sdRequested}^{commit}`] : ["HEAD"])], {
  cwd: new URL("../../../arkpedia-sd-assets/", import.meta.url),
  encoding: "utf8",
}).trim();
const sd = JSON.parse(
  execFileSync("git", ["show", `${sdCommit}:manifest.json`], {
    cwd: new URL("../../../arkpedia-sd-assets/", import.meta.url),
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  }),
);
const modelKeys = [
  ...ids.flatMap((id) =>
    ["front", "back"].map((f) => `operator/${id}/default/${f}`),
  ),
  ...tokenIds.filter(id=>id!=='token_10055_phatm2_mndclv').flatMap(id => ['front', 'back'].map(f => `operator/${id}/default/${f}`)),
  'operator/token_10027_ironmn_pile3/default/down',
  ...Object.keys(enemyRecords).map((id) => `enemy/${id}/default/default`),
];
const models = Object.fromEntries(
  modelKeys.map((k) => {
    if (!sd.models[k]) throw new Error(`Missing SD model: ${k}`);
    const model = sd.models[k];
    if (
      !/^3\.8\./.test(model.spineVersion) ||
      !model.animationRoles?.idle ||
      !model.animations ||
      typeof model.premultipliedAlpha !== "boolean"
    )
      throw new Error(`Unverified SD runtime metadata: ${k}`);
    const op = operators[model.id];
    // Closure's source controller selects literal continuous-fire clips. S1
    // retains ordinary fire; do not invent a generic skill animation family.
    if (model.id === 'char_4228_closur') {
      const source = closurSource.models.char_4228_closur[model.facing === 'front' ? 'Front' : 'Back'];
      for (const [clip, duration] of Object.entries(source.durations))
        if (Math.abs((model.animations[clip] ?? NaN) - duration) > .001 || model.animations[clip] == null)
          throw Error('Changed Closure literal animation: ' + clip);
    }
    // Makoto's owner selects literal Persona/transition clips, including tracks
    // absent on Back. Its complete model record is checked against the original
    // artwork receipt below; generic per-skill aliases would invent those clips.
    // Aphrissa's skill owners likewise pick literal Begin/Loop/Down clips.
    // Hadiya's owner likewise selects her literal skill and S2 mode clips.
    if (op?.skills.length > 1 && !['char_4228_closur','char_4217_makoto','char_4229_aphris','char_394_hadiya',...Object.keys(CN_OWNER_REVIEWS)].includes(model.id) && op.skills.some((_, index) => !model.animationRoles.skills?.[index]))
      throw new Error(`Missing per-skill SD animation roles: ${k}`);
    return [k, sd.models[k]];
  }),
);
if (ids.includes('char_4179_monstr')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-mon3tr-runtime-review.json', import.meta.url)));
  const keys = ['char_4179_monstr', 'token_10050_monstr_prosts']
    .flatMap(id => ['front', 'back'].map(face => `operator/${id}/default/${face}`)).sort();
  if (JSON.stringify(Object.keys(review.originalArtwork).sort()) !== JSON.stringify(keys)) throw Error('Incomplete Mon3tr artwork review');
  for (const key of keys) if (JSON.stringify(models[key]) !== JSON.stringify(review.originalArtwork[key]))
    throw Error('Changed Mon3tr original artwork: ' + key);
}
if (ids.includes('char_4051_akkord')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-akkord-runtime-review.json', import.meta.url)));
  const keys = ['front', 'back'].map(face => `operator/char_4051_akkord/default/${face}`).sort();
  if (JSON.stringify(Object.keys(review.originalArtwork).sort()) !== JSON.stringify(keys)) throw Error('Incomplete Akkord artwork review');
  for (const key of keys) if (JSON.stringify(models[key]) !== JSON.stringify(review.originalArtwork[key]))
    throw Error('Changed original Akkord artwork: ' + key);
}
if (ids.includes('char_4208_wintim')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-wintim-runtime-review.json', import.meta.url)));
  const keys = ['front', 'back'].map(face => `operator/char_4208_wintim/default/${face}`).sort();
  if (JSON.stringify(Object.keys(review.originalArtwork).sort()) !== JSON.stringify(keys)) throw Error('Incomplete Snegurochka artwork review');
  for (const key of keys) if (JSON.stringify(models[key]) !== JSON.stringify(review.originalArtwork[key]))
    throw Error('Changed original Snegurochka artwork: ' + key);
}
if (ids.includes('char_4228_closur')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-closur-runtime-review.json', import.meta.url)));
  const keys = ['char_4228_closur', 'token_10066_closur_ourbase']
    .flatMap(id => ['front', 'back'].map(face => `operator/${id}/default/${face}`)).sort();
  if (JSON.stringify(Object.keys(review.originalArtwork).sort()) !== JSON.stringify(keys)) throw Error('Incomplete Closure artwork review');
  for (const key of keys) if (JSON.stringify(models[key]) !== JSON.stringify(review.originalArtwork[key]))
    throw Error('Changed original Closure artwork: ' + key);
}
if (ids.includes('char_4166_varkis')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-varkis-runtime-review.json', import.meta.url)));
  const keys = ['front', 'back'].map(face => `operator/char_4166_varkis/default/${face}`).sort();
  if (JSON.stringify(Object.keys(review.originalArtwork).sort()) !== JSON.stringify(keys)) throw Error('Incomplete Varkáris artwork review');
  for (const key of keys) if (JSON.stringify(models[key]) !== JSON.stringify(review.originalArtwork[key]))
    throw Error('Changed Varkáris original artwork: ' + key);
}
if (ids.includes('char_4211_snhunt')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-snhunt-runtime-review.json', import.meta.url)));
  const keys = ['front', 'back'].map(face => `operator/char_4211_snhunt/default/${face}`).sort();
  if (JSON.stringify(Object.keys(review.originalArtwork).sort()) !== JSON.stringify(keys)) throw Error('Incomplete Snow Hunter artwork review');
  for (const key of keys) if (JSON.stringify(models[key]) !== JSON.stringify(review.originalArtwork[key]))
    throw Error('Changed Snow Hunter original artwork: ' + key);
}
if (ids.includes('char_4203_kichi')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-kichi-runtime-review.json', import.meta.url)));
  const keys = ['front', 'back'].map(face => `operator/char_4203_kichi/default/${face}`).sort();
  if (JSON.stringify(Object.keys(review.originalArtwork).sort()) !== JSON.stringify(keys)) throw Error('Incomplete Kichisei artwork review');
  for (const key of keys) if (JSON.stringify(models[key]) !== JSON.stringify(review.originalArtwork[key]))
    throw Error('Changed Kichisei original artwork: ' + key);
}
if (ids.includes('char_4214_cairn')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-cairn-runtime-review.json', import.meta.url)));
  const keys = ['front', 'back'].map(face => `operator/char_4214_cairn/default/${face}`).sort();
  if (JSON.stringify(Object.keys(review.originalArtwork).sort()) !== JSON.stringify(keys)) throw Error('Incomplete Cairn artwork review');
  for (const key of keys) if (JSON.stringify(models[key]) !== JSON.stringify(review.originalArtwork[key]))
    throw Error('Changed Cairn original artwork: ' + key);
}
if (ids.includes('char_4225_tanya')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-tanya-runtime-review.json', import.meta.url)));
  const keys = ['front', 'back'].map(face => `operator/char_4225_tanya/default/${face}`).sort();
  if (JSON.stringify(Object.keys(review.originalArtwork).sort()) !== JSON.stringify(keys)) throw Error('Incomplete Crackborne artwork review');
  for (const key of keys) if (JSON.stringify(models[key]) !== JSON.stringify(review.originalArtwork[key]))
    throw Error('Changed Crackborne original artwork: ' + key);
}
if (ids.includes('char_4235_thumpy')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-thumpy-runtime-review.json', import.meta.url)));
  const keys = ['front', 'back'].map(face => `operator/char_4235_thumpy/default/${face}`).sort();
  if (JSON.stringify(Object.keys(review.originalArtwork).sort()) !== JSON.stringify(keys)) throw Error('Incomplete Thumpy artwork review');
  for (const key of keys) if (JSON.stringify(models[key]) !== JSON.stringify(review.originalArtwork[key]))
    throw Error('Changed Thumpy original artwork: ' + key);
}
if (ids.includes('char_4236_tmslot')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-tmslot-runtime-review.json', import.meta.url)));
  const keys = ['front', 'back'].map(face => `operator/char_4236_tmslot/default/${face}`).sort();
  if (JSON.stringify(Object.keys(review.originalArtwork).sort()) !== JSON.stringify(keys)) throw Error('Incomplete Timeslot artwork review');
  for (const key of keys) if (JSON.stringify(models[key]) !== JSON.stringify(review.originalArtwork[key]))
    throw Error('Changed Timeslot original artwork: ' + key);
}
if (ids.includes('char_4220_kormr')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-koromaru-runtime-review.json', import.meta.url)));
  const keys = ['front', 'back'].map(face => `operator/char_4220_kormr/default/${face}`).sort();
  if (JSON.stringify(Object.keys(review.originalArtwork).sort()) !== JSON.stringify(keys)) throw Error('Incomplete Koromaru artwork review');
  for (const key of keys) if (JSON.stringify(models[key]) !== JSON.stringify(review.originalArtwork[key]))
    throw Error('Changed Koromaru original artwork: ' + key);
}
if (ids.includes('char_4227_gallus')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-gallus-runtime-review.json', import.meta.url)));
  const keys = ['front', 'back'].map(face => `operator/char_4227_gallus/default/${face}`).sort();
  if (JSON.stringify(Object.keys(review.originalArtwork).sort()) !== JSON.stringify(keys)) throw Error('Incomplete GALLUS² artwork review');
  for (const key of keys) if (JSON.stringify(models[key]) !== JSON.stringify(review.originalArtwork[key]))
    throw Error('Changed GALLUS² original artwork: ' + key);
}
if (ids.includes('char_4234_pedro')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-pedro-runtime-review.json', import.meta.url)));
  const keys = ['front', 'back'].map(face => `operator/char_4234_pedro/default/${face}`).sort();
  if (JSON.stringify(Object.keys(review.originalArtwork).sort()) !== JSON.stringify(keys)) throw Error('Incomplete Pedro artwork review');
  for (const key of keys) if (JSON.stringify(models[key]) !== JSON.stringify(review.originalArtwork[key]))
    throw Error('Changed Pedro original artwork: ' + key);
}
if(ids.includes('char_4224_turdus')){
  const review=JSON.parse(await readFile(new URL('../../data/arkpedia-turdus-runtime-review.json',import.meta.url))),keys=['front','back'].map(face=>`operator/char_4224_turdus/default/${face}`).sort();
  if(JSON.stringify(Object.keys(review.originalArtwork).sort())!==JSON.stringify(keys))throw Error('Incomplete original Ukusik artwork review');
  for(const key of keys)if(JSON.stringify(models[key])!==JSON.stringify(review.originalArtwork[key]))throw Error('Changed original Ukusik artwork: '+key);
}
if(ids.includes('char_4222_taraxa')){
  const review=JSON.parse(await readFile(new URL('../../data/arkpedia-taraxa-runtime-review.json',import.meta.url))),keys=['front','back'].map(face=>`operator/char_4222_taraxa/default/${face}`).sort();
  if(JSON.stringify(Object.keys(review.originalArtwork).sort())!==JSON.stringify(keys))throw Error('Incomplete original Taraxacum artwork review');
  for(const key of keys)if(JSON.stringify(models[key])!==JSON.stringify(review.originalArtwork[key]))throw Error('Changed original Taraxacum artwork: '+key);
}
if(ids.includes('char_4221_ju')){
  const review=JSON.parse(await readFile(new URL('../../data/arkpedia-ju-runtime-review.json',import.meta.url))),keys=['front','back'].map(face=>`operator/char_4221_ju/default/${face}`).sort();
  if(JSON.stringify(Object.keys(review.originalArtwork).sort())!==JSON.stringify(keys))throw Error('Incomplete original Ju artwork review');
  for(const key of keys)if(JSON.stringify(models[key])!==JSON.stringify(review.originalArtwork[key]))throw Error('Changed original Ju artwork: '+key);
}
for(const[id,review]of Object.entries(cnOwnerReviews)){
  const keys=Object.keys(models).filter(k=>k.startsWith(`operator/${id}/default/`)).sort();
  if(JSON.stringify(Object.keys(review.originalArtwork).sort())!==JSON.stringify(keys))throw Error(`Incomplete original ${id} artwork review`);
  for(const key of keys)if(JSON.stringify(models[key])!==JSON.stringify(review.originalArtwork[key]))throw Error(`Changed original ${id} artwork: ${key}`);
}
if(ids.includes('char_394_hadiya')){
  const review=JSON.parse(await readFile(new URL('../../data/arkpedia-hadiya-runtime-review.json',import.meta.url))),keys=['front','back'].map(face=>`operator/char_394_hadiya/default/${face}`).sort();
  if(JSON.stringify(Object.keys(review.originalArtwork).sort())!==JSON.stringify(keys))throw Error('Incomplete original Hadiya artwork review');
  for(const key of keys)if(JSON.stringify(models[key])!==JSON.stringify(review.originalArtwork[key]))throw Error('Changed original Hadiya artwork: '+key);
}
if(ids.includes('char_4223_botany')){
  const review=JSON.parse(await readFile(new URL('../../data/arkpedia-botany-runtime-review.json',import.meta.url))),keys=['front','back'].map(face=>`operator/char_4223_botany/default/${face}`).sort();
  if(JSON.stringify(Object.keys(review.originalArtwork).sort())!==JSON.stringify(keys))throw Error('Incomplete original Botany artwork review');
  for(const key of keys)if(JSON.stringify(models[key])!==JSON.stringify(review.originalArtwork[key]))throw Error('Changed original Botany artwork: '+key);
}
if(ids.includes('char_4213_skybx')){
  const review=JSON.parse(await readFile(new URL('../../data/arkpedia-skybox-runtime-review.json',import.meta.url))),keys=['front','back'].map(face=>`operator/char_4213_skybx/default/${face}`).sort();
  if(JSON.stringify(Object.keys(review.originalArtwork).sort())!==JSON.stringify(keys))throw Error('Incomplete original Skybox artwork review');
  for(const key of keys)if(JSON.stringify(models[key])!==JSON.stringify(review.originalArtwork[key]))throw Error('Changed original Skybox artwork: '+key);
}
if(ids.includes('char_4218_aigis')){
  const review=JSON.parse(await readFile(new URL('../../data/arkpedia-aegis-runtime-review.json',import.meta.url))),keys=['front','back'].map(face=>`operator/char_4218_aigis/default/${face}`).sort();
  if(JSON.stringify(Object.keys(review.originalArtwork).sort())!==JSON.stringify(keys))throw Error('Incomplete original Aegis artwork review');
  for(const key of keys)if(JSON.stringify(models[key])!==JSON.stringify(review.originalArtwork[key]))throw Error('Changed original Aegis artwork: '+key);
}
if(ids.includes('char_4219_yukari')){
  const review=JSON.parse(await readFile(new URL('../../data/arkpedia-yukari-runtime-review.json',import.meta.url))),keys=['front','back'].map(face=>`operator/char_4219_yukari/default/${face}`).sort();
  if(JSON.stringify(Object.keys(review.originalArtwork).sort())!==JSON.stringify(keys))throw Error('Incomplete original Yukari artwork review');
  for(const key of keys)if(JSON.stringify(models[key])!==JSON.stringify(review.originalArtwork[key]))throw Error('Changed original Yukari artwork: '+key);
}
if(ids.includes('char_4217_makoto')){
  const review=JSON.parse(await readFile(new URL('../../data/arkpedia-makoto-runtime-review.json',import.meta.url))),keys=['front','back'].map(face=>`operator/char_4217_makoto/default/${face}`).sort();
  if(JSON.stringify(Object.keys(review.originalArtwork).sort())!==JSON.stringify(keys))throw Error('Incomplete original Makoto artwork review');
  for(const key of keys)if(JSON.stringify(models[key])!==JSON.stringify(review.originalArtwork[key]))throw Error('Changed original Makoto artwork: '+key);
}
let aphrissaInterface=null;
if(aphrissaSource){
  const keys=['char_4229_aphris',APHRISSA_TOKEN].flatMap(id=>['front','back'].map(face=>`operator/${id}/default/${face}`)).sort();
  if(JSON.stringify(Object.keys(aphrissaReview.originalArtwork).sort())!==JSON.stringify(keys))throw Error('Incomplete original Aphrissa/relay artwork review');
  for(const key of keys)if(JSON.stringify(models[key])!==JSON.stringify(aphrissaReview.originalArtwork[key]))throw Error('Changed original Aphrissa/relay artwork: '+key);
  aphrissaInterface=await verifyAphrissaArtwork(models);
  const reviewed=Object.fromEntries(aphrissaReview.interfaceAssets.map(a=>[a.path,{commit:a.commit,bytes:a.bytes,sha256:a.sha256}]));
  if(aphrissaReview.interfaceAssets.some(a=>a.repository!==aphrissaInterface.repository)||JSON.stringify(reviewed)!==JSON.stringify(aphrissaInterface.interfaceAssets))throw Error('Changed Aphrissa interface pixels');
}
if(reconSource){
  const review=JSON.parse(await readFile(new URL('../../data/arkpedia-recon-runtime-review.json',import.meta.url)));
  const keys=['char_4215_buddy','token_10063_buddy_bddg'].flatMap(id=>['front','back'].map(face=>`operator/${id}/default/${face}`)).sort();
  if(JSON.stringify(Object.keys(review.originalArtwork).sort())!==JSON.stringify(keys))throw Error('Incomplete original Recon/Palamute artwork review');
  for(const key of keys)if(JSON.stringify(models[key])!==JSON.stringify(review.originalArtwork[key]))throw Error('Changed original Recon/Palamute artwork: '+key);
  const portrait=JSON.parse(await readFile(new URL('../../data/arkpedia-palamute-avatar.json',import.meta.url)));
  for(const face of ['front','back']){
    const model=models[`operator/token_10063_buddy_bddg/default/${face}`],avatar=model.avatar;
    if(model.source.facingAlias!=='single-original-model'||avatar?.sha256!==portrait.avatar.sha256||avatar.bytes!==portrait.avatar.bytes
      ||avatar.source?.kind!=='cn-native-sprite'||avatar.source.proofSha256!==review.tokenAvatarSha256
      ||avatar.source.resourceVersion!==portrait.source.resourceVersion||avatar.source.proof!==portrait.sdReview
      ||avatar.source.bundleSha256!==portrait.sprite.bundle.sha256
      ||avatar.source.spritePathId!==portrait.sprite.spritePathId||avatar.source.texturePathId!==portrait.sprite.texturePathId)
      throw Error('Palamute portrait/Single model lacks its exact native source proof');
  }
}
if(mcnistSource){
  const review=JSON.parse(await readFile(new URL('../../data/arkpedia-mcnist-runtime-review.json',import.meta.url)));
  const keys=['char_4230_mcnist','token_10069_mcnist_mcgraf'].flatMap(id=>['front','back'].map(face=>`operator/${id}/default/${face}`)).sort();
  if(JSON.stringify(Object.keys(review.originalArtwork).sort())!==JSON.stringify(keys))throw Error('Incomplete original Mechanist/McGraf artwork review');
  for(const key of keys)if(JSON.stringify(models[key])!==JSON.stringify(review.originalArtwork[key]))throw Error('Changed original Mechanist/McGraf artwork: '+key);
  const portrait=JSON.parse(await readFile(new URL('../../data/arkpedia-mcnist-token-avatar.json',import.meta.url)));
  for(const face of ['front','back']){
    const avatar=models[`operator/token_10069_mcnist_mcgraf/default/${face}`].avatar;
    if(avatar?.sha256!==portrait.avatar.sha256||avatar.bytes!==portrait.avatar.bytes
      ||avatar.source?.kind!=='cn-native-sprite'||avatar.source.proofSha256!==review.tokenAvatarSha256
      ||avatar.source.resourceVersion!==portrait.source.resourceVersion||avatar.source.proof!==portrait.sdReview
      ||avatar.source.bundleSha256!==portrait.sprite.bundle.sha256
      ||avatar.source.spritePathId!==portrait.sprite.spritePathId||avatar.source.texturePathId!==portrait.sprite.texturePathId)
      throw Error('Mechanist token portrait lacks its exact native Sprite/hub proof');
  }
}
if (ids.includes('char_4207_branch')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-branch-runtime-review.json', import.meta.url)));
  const keys = ['front', 'back'].map(face => `operator/char_4207_branch/default/${face}`).sort();
  if (JSON.stringify(Object.keys(review.originalArtwork).sort()) !== JSON.stringify(keys)) throw Error('Incomplete Vetochki artwork review');
  for (const key of keys) if (JSON.stringify(models[key]) !== JSON.stringify(review.originalArtwork[key]))
    throw Error('Changed Vetochki original artwork: ' + key);
}
if (ids.includes('char_4196_reckpr')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-reckpr-runtime-review.json', import.meta.url)));
  const keys = ['front', 'back'].map(face => `operator/char_4196_reckpr/default/${face}`).sort();
  if (JSON.stringify(Object.keys(review.originalArtwork).sort()) !== JSON.stringify(keys)) throw Error('Incomplete Record Keeper artwork review');
  for (const key of keys) if (JSON.stringify(models[key]) !== JSON.stringify(review.originalArtwork[key]))
    throw Error('Changed Record Keeper original artwork: ' + key);
}
if (ids.includes('char_4237_jcinta')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-jcinta-runtime-review.json', import.meta.url)));
  const keys = ['front', 'back'].map(face => `operator/char_4237_jcinta/default/${face}`).sort();
  if (JSON.stringify(Object.keys(review.originalArtwork).sort()) !== JSON.stringify(keys)) throw Error('Incomplete Jacinta artwork review');
  for (const key of keys) if (JSON.stringify(models[key]) !== JSON.stringify(review.originalArtwork[key]))
    throw Error('Changed original Jacinta artwork: ' + key);
}
if (ids.includes('char_4031_liesel')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-liesel-runtime-review.json', import.meta.url)));
  const keys = ['front', 'back'].map(face => `operator/char_4031_liesel/default/${face}`).sort();
  if (JSON.stringify(Object.keys(review.originalArtwork).sort()) !== JSON.stringify(keys)) throw Error('Incomplete Ripresa artwork review');
  for (const key of keys) if (JSON.stringify(models[key]) !== JSON.stringify(review.originalArtwork[key]))
    throw Error('Changed original Ripresa artwork: ' + key);
}
let nativeEffects;
if(ids.includes('char_1042_phatm2')){
  const review=JSON.parse(await readFile(new URL('../../data/arkpedia-tragodia-runtime-review.json',import.meta.url)));
  const keys=['char_1042_phatm2','token_10054_phatm2_encdool'].flatMap(id=>['front','back'].map(face=>`operator/${id}/default/${face}`)).sort();
  if(JSON.stringify(Object.keys(review.originalArtwork).sort())!==JSON.stringify(keys))throw Error('Incomplete Tragodia artwork review');
  for(const key of keys)if(JSON.stringify(models[key])!==JSON.stringify(review.originalArtwork[key]))throw Error('Changed Tragodia original model: '+key);
  const registry=JSON.parse(execFileSync('git',['show',`${sdCommit}:native-effect-manifest.json`],{cwd:new URL('../../../arkpedia-sd-assets/',import.meta.url),encoding:'utf8'}));
  if(JSON.stringify(registry.effects.tragodia)!==JSON.stringify(review.nativeEffectManifest))throw Error('Changed Tragodia native effect delivery');
  const bytes=execFileSync('git',['show',`${sdCommit}:${review.nativeEffectManifest.path}`],{cwd:new URL('../../../arkpedia-sd-assets/',import.meta.url),maxBuffer:16*1024*1024});
  if(bytes.length!==review.nativeEffectManifest.bytes||createHash('sha256').update(bytes).digest('hex')!==review.nativeEffectManifest.sha256)throw Error('Changed native package manifest');
  nativeEffects={tragodia:{repository:'arkpedia/arkpedia-sd-assets',commit:sdCommit,manifest:review.nativeEffectManifest}};
}
if(aphrissaSource){
  const entry=aphrissaReview.nativeEffectManifest,sd=new URL('../../../arkpedia-sd-assets/',import.meta.url);
  const registry=JSON.parse(execFileSync('git',['show',`${sdCommit}:native-effect-manifest.json`],{cwd:sd,encoding:'utf8'}));
  const bytes=execFileSync('git',['show',`${sdCommit}:${entry?.path}`],{cwd:sd,maxBuffer:16*1024*1024}),meta=JSON.parse(bytes);
  const effects=JSON.parse(await readFile(new URL('../../data/arkpedia-aphrissa-effects.json',import.meta.url)));
  if(JSON.stringify(registry.effects.aphrissa)!==JSON.stringify(entry)||bytes.length!==entry.bytes||createHash('sha256').update(bytes).digest('hex')!==entry.sha256
    ||JSON.stringify(meta.pack)!==JSON.stringify(effects.pack)||JSON.stringify(meta.scope.preparedRoots)!==JSON.stringify(APHRISSA_PREPARED_ROOTS))
    throw Error('Changed Aphrissa native effect delivery');
  nativeEffects={...(nativeEffects??{}),aphrissa:{repository:'arkpedia/arkpedia-sd-assets',commit:sdCommit,manifest:entry}};
}
if (ids.includes('char_450_necras')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-necrass-runtime-review.json', import.meta.url)));
  const keys = ['char_450_necras', 'token_10043_necras_skeltn'].flatMap(id =>
    ['front', 'back'].map(face => `operator/${id}/default/${face}`)).sort();
  if (JSON.stringify(Object.keys(review.originalArtwork).sort()) !== JSON.stringify(keys))
    throw Error('Necrass review must bind both original owner and servant facings');
  for (const [key, expected] of Object.entries(review.originalArtwork)) {
    if (!models[key] || JSON.stringify(models[key]) !== JSON.stringify(expected))
      throw Error(`Necrass published model differs from reviewed original artwork: ${key}`);
  }
}
if (ids.includes('char_249_mlyss')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-muelsyse-runtime-review.json', import.meta.url)));
  const keys = ['char_249_mlyss', 'token_10030_mlyss_wtrman'].flatMap(id =>
    ['front', 'back'].map(face => `operator/${id}/default/${face}`)).sort();
  if (JSON.stringify(Object.keys(review.originalArtwork).sort()) !== JSON.stringify(keys))
    throw Error('Muelsyse review must bind both original owner and Flowing Shape facings');
  for (const [key, expected] of Object.entries(review.originalArtwork)) {
    if (!models[key] || JSON.stringify(models[key]) !== JSON.stringify(expected))
      throw Error(`Muelsyse published model differs from reviewed native artwork: ${key}`);
  }
}
if (ids.includes('char_4141_marcil')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-marcil-runtime-review.json', import.meta.url)));
  const evidence = JSON.parse(await readFile(new URL('../../data/arkpedia-marcil-prefabs.json', import.meta.url)));
  for (const face of ['front', 'back']) {
    const expected = evidence.models.char_4141_marcil[face === 'front' ? 'Front' : 'Back'].sha256;
    if (review.originalSkeletonSha256[face] !== expected
      || models[`operator/char_4141_marcil/default/${face}`].skeleton.sha256 !== expected)
      throw Error('Marcille published skeleton differs from the original native artwork');
  }
}
// Bind the published default dragon files to the independently audited artwork,
// rather than approving whichever model happens to be at the latest asset HEAD.
if (ids.includes('char_4147_mitm')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-mitm-runtime-review.json', import.meta.url)));
  for (const [key, expected] of Object.entries(review.originalArtwork)) {
    if (!models[key] || JSON.stringify(models[key]) !== JSON.stringify(expected))
      throw Error(`Mitm published model differs from reviewed native artwork: ${key}`);
  }
}
if (ids.includes('char_4072_ironmn')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-stainless-runtime-review.json', import.meta.url)));
  for (const [key, expected] of Object.entries(review.originalArtwork)) {
    const model = models[key];
    if (!model || JSON.stringify(model) !== JSON.stringify(expected))
      throw Error(`Stainless published model differs from reviewed native artwork: ${key}`);
  }
}
if (ids.includes('char_2026_yu')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-yu-runtime-review.json', import.meta.url)));
  const evidence = JSON.parse(await readFile(new URL('../../data/arkpedia-yu-prefabs.json', import.meta.url)));
  for (const facing of ['front', 'back']) {
    const model = models[`operator/char_2026_yu/default/${facing}`], art = review.originalArtwork[facing];
    if (!model || JSON.stringify([model.skeleton, model.atlas, ...model.textures]) !== JSON.stringify(art.files)
      || JSON.stringify(model.source) !== JSON.stringify(art.source)
      || JSON.stringify(model.animations) !== JSON.stringify(art.animations)
      || model.source.commit !== evidence.source.modelCommit
      || model.skeleton.sha256 !== evidence.officialSkeletonBindings.char_2026_yu[facing === 'front' ? 'Front' : 'Back'].sha256
      || !model.premultipliedAlpha || !art.premultipliedAlpha)
      throw Error(`Yu published owner differs from reviewed native artwork: ${facing}`);
  }
}
if (ids.includes('char_2025_shu')) {
  const review = JSON.parse(await readFile(new URL('../../data/arkpedia-shu-runtime-review.json', import.meta.url)));
  const evidence = JSON.parse(await readFile(new URL('../../data/arkpedia-shu-prefabs.json', import.meta.url)));
  for (const facing of ['front', 'back']) {
    const model = models[`operator/char_2025_shu/default/${facing}`], art = review.originalArtwork[facing];
    const files = [model.skeleton, model.atlas, ...model.textures];
    if (JSON.stringify(files) !== JSON.stringify(art.files)
      || JSON.stringify(model.source) !== JSON.stringify(art.source)
      || JSON.stringify(model.animations) !== JSON.stringify(art.animations)
      || model.source.commit !== evidence.source.modelCommit
      || model.skeleton.sha256 !== evidence.officialSkeletonBindings.char_2025_shu[facing === 'front' ? 'Front' : 'Back'].sha256
      || !model.premultipliedAlpha || !art.premultipliedAlpha)
      throw Error(`Shu published owner differs from reviewed native artwork: ${facing}`);
  }
}
if (ids.includes('char_2023_ling')) {
  const art = JSON.parse(await readFile(new URL('../../data/arkpedia-ling-dragon-art.json', import.meta.url)));
  for (const [id, record] of Object.entries(art.models)) for (const facing of ['front', 'back']) {
    const model = models[`operator/${id}/default/${facing}`];
    const files = [model.skeleton, model.atlas, ...model.textures, model.avatar];
    if (files.length !== Object.keys(record.files).length || files.some(file => {
      const expected = record.files[file?.path?.split('/').at(-1)];
      return !expected || file.sha256 !== expected.sha256 || file.bytes !== expected.bytes;
    }) || JSON.stringify(model.source.originalPathIds) !== JSON.stringify(record.originalPathIds)
      || JSON.stringify(model.animations) !== JSON.stringify(record.durations) || !model.premultipliedAlpha)
      throw Error(`Ling published dragon differs from reviewed native artwork: ${id}/${facing}`);
  }
}
for (const token of Object.values(tokens)) {
  if(token.id==='token_10055_phatm2_mndclv'){token.automaticOnly=true;token.renderingKind='effect-only';token.avatar=null;continue;}
  if (token.id === 'token_10031_swire2_gdtrap') token.automaticOnly = true;
  const model = models[`operator/${token.id}/default/front`];
  // Golden Vows, Tactical Equipment and Revenant's Shadow spawn automatically.
  // Their default models have no portrait; retain the original absence.
  if (['token_10040_siege2_vlion','token_10012_rosmon_shield','token_10035_wisdel_wward'].includes(token.id) && !model.avatar) {
    token.automaticOnly = true; token.avatar = null; continue;
  }
  if (!model?.avatar?.path) throw Error(`Missing original token portrait: ${token.id}`);
  token.avatar = `https://raw.githubusercontent.com/arkpedia/arkpedia-sd-assets/${sdCommit}/${model.avatar.path}`;
}
const output = {
  schemaVersion: 1,
  ...(candidateGeneric ? {reviewCandidates:[candidateGeneric]} : candidateHadiya ? {reviewCandidates:['char_394_hadiya']} : candidateAphrissa ? {reviewCandidates:['char_4229_aphris']} : candidateMakoto ? {reviewCandidates:['char_4217_makoto']} : candidateYukari ? {reviewCandidates:['char_4219_yukari']} : candidateAegis ? {reviewCandidates:['char_4218_aigis']} : candidateSkybox ? {reviewCandidates:['char_4213_skybx']} : candidateBotany ? {reviewCandidates:['char_4223_botany']} : candidateTaraxa ? {reviewCandidates:['char_4222_taraxa']} : candidateJu ? { reviewCandidates: ['char_4221_ju'] } : candidateTurdus ? { reviewCandidates: ['char_4224_turdus'] } : candidateRecon ? { reviewCandidates: ['char_4215_buddy'] } : candidateKoromaru ? { reviewCandidates: ['char_4220_kormr'] } : candidateGallus ? { reviewCandidates: ['char_4227_gallus'] } : candidateMcnist ? { reviewCandidates: ['char_4230_mcnist'] } : candidatePedro ? { reviewCandidates: ['char_4234_pedro'] } : candidateTmslot ? { reviewCandidates: ['char_4236_tmslot'] } : candidateThumpy ? { reviewCandidates: ['char_4235_thumpy'] } : candidateTanya ? { reviewCandidates: ['char_4225_tanya'] } : candidateCairn ? { reviewCandidates: ['char_4214_cairn'] } : candidateKichi ? { reviewCandidates: ['char_4203_kichi'] } : candidateSnhunt ? { reviewCandidates: ['char_4211_snhunt'] } : candidateVarkis ? { reviewCandidates: ['char_4166_varkis'] } : candidateReckpr ? { reviewCandidates: ['char_4196_reckpr'] } : candidateBranch ? { reviewCandidates: ['char_4207_branch'] } : {}),
  ...(formSource ? { globalAlternateFormSource: formSource } : {}),
  ...((aegisReview||yukariReview||makotoReview||aphrissaReview)?{interfaceAssets:Object.fromEntries(['arkpedia/arkpedia-image-assets','arkpedia/arkpedia-skin-assets'].map(repo=>[repo,Object.fromEntries([...(aegisReview?.interfaceAssets??[]),...(yukariReview?.interfaceAssets??[]),...(makotoReview?.interfaceAssets??[]),...(aphrissaReview?.interfaceAssets??[])].filter(a=>a.repository===repo).map(a=>[a.path,{commit:a.commit,bytes:a.bytes,sha256:a.sha256}]))]))}:{}),
  sources: cnEvidence ? { ...pins, [cnEvidence.source.repository]: cnEvidence.source.commit } : pins,
  ...(cnEvidence ? { operatorSourceChannels: Object.fromEntries(ids.map(id => [id, operatorChannel(id, REGULAR_OPERATORS[id])])) } : {}),
  behaviors: {
    source: { repository: paths.buff_template_data[0], commit: pins[paths.buff_template_data[0]],
      path: paths.buff_template_data[1], sha256: tableHash },
    templates,
  },
  ...(nativeEffects?{nativeEffects}:{}),
  sd: { repository: "arkpedia/arkpedia-sd-assets", commit: sdCommit, models },
  stage: {
    code: stage.code,
    name: stage.name,
    description: stage.description,
    battle: stage.battle,
    mapTags: originalLevel.mapData.tags ?? [],
    mapTagSource: { repository: paths.original_level[0], commit: pins[paths.original_level[0]],
      path: paths.original_level[1], sha256: createHash('sha256').update(await readFile(new URL('original_level.json', cache))).digest('hex') },
    geometry,
  },
  operators,
  tokens,
  enemies: enemyRecords,
};
assertRegularEnemies(output);
// Consume the existing stage browser's public route output without publishing its private application source.
const routeArg = process.argv.indexOf("--routes");
const prior = JSON.parse(
  await readFile(
    new URL("../../data/arkpedia-mvp.json", import.meta.url),
    "utf8",
  ),
);
const pathing =
  routeArg >= 0
    ? JSON.parse(await readFile(process.argv[routeArg + 1], "utf8"))
    : prior.stage.pathing;
if (
  !pathing ||
  pathing.stage !== stage.code ||
  pathing.schemaVersion !== 1 ||
  pathing.geometryHash !==
    createHash("sha256").update(JSON.stringify(geometry)).digest("hex")
)
  throw new Error(
    "Export matching routes from Arkpedia's stage browser and pass --routes <routes.json>",
  );
output.stage.pathing = pathing;
const stageAssets = JSON.parse(execFileSync("git", ["show", `${sdCommit}:stage-manifest.json`], {
  cwd: new URL("../../../arkpedia-sd-assets/", import.meta.url), encoding: "utf8",
}));
if (!stageAssets.stages[stage.code]) throw Error("Missing original stage artwork");
output.stage.art = { repository: "arkpedia/arkpedia-sd-assets", commit: sdCommit, scene: stageAssets.stages[stage.code] };
if (!stageAssets.effects?.standardGates) throw Error("Missing original entry/defence box artwork");
output.stage.gates = { repository: "arkpedia/arkpedia-sd-assets", commit: sdCommit, pack: stageAssets.effects.standardGates };
if (!stageAssets.effects?.chargeCost) throw Error("Missing original charge-cost activation burst");
const bindings = {};
for (const [id,support] of Object.entries(REGULAR_OPERATORS)) {
  if (support.templateKey !== "charge_cost") continue;
  const key="common_charge_cost_start_01";
  if (!bindingEvidence.prefabs[support.prefabId]?.effectKeys.includes(key))
    throw Error(`Missing verified skill effect binding: ${id}`);
  bindings[id]={skillId:support.skillId,prefabId:support.prefabId,key};
}
output.skillEffects = {repository:"arkpedia/arkpedia-sd-assets",commit:sdCommit,
  pack:stageAssets.effects.chargeCost,bindings};
await writeJSONAtomic(
  candidateGeneric ? new URL(`arkpedia-${CN_OWNER_REVIEWS[candidateGeneric]?.slug ?? 'unknown'}-candidate.json`, cache) : candidateHadiya ? new URL("arkpedia-hadiya-candidate.json", cache) : candidateAphrissa ? new URL("arkpedia-aphrissa-candidate.json", cache) : candidateMakoto ? new URL("arkpedia-makoto-candidate.json", cache) : candidateYukari ? new URL("arkpedia-yukari-candidate.json", cache) : candidateAegis ? new URL("arkpedia-aegis-candidate.json", cache) : candidateSkybox ? new URL("arkpedia-skybox-candidate.json", cache) : candidateBotany ? new URL("arkpedia-botany-candidate.json", cache) : candidateTaraxa ? new URL("arkpedia-taraxa-candidate.json", cache) : candidateJu ? new URL("arkpedia-ju-candidate.json", cache) : candidateTurdus ? new URL("arkpedia-turdus-candidate.json", cache) : candidateRecon ? new URL("arkpedia-recon-candidate.json", cache) : candidateKoromaru ? new URL("arkpedia-koromaru-candidate.json", cache) : candidateGallus ? new URL("arkpedia-gallus-candidate.json", cache) : candidateMcnist ? new URL("arkpedia-mcnist-candidate.json", cache) : candidatePedro ? new URL("arkpedia-pedro-candidate.json", cache) : candidateTmslot ? new URL("arkpedia-tmslot-candidate.json", cache) : candidateThumpy ? new URL("arkpedia-thumpy-candidate.json", cache) : candidateTanya ? new URL("arkpedia-tanya-candidate.json", cache) : candidateCairn ? new URL("arkpedia-cairn-candidate.json", cache) : candidateKichi ? new URL("arkpedia-kichi-candidate.json", cache) : candidateSnhunt ? new URL("arkpedia-snhunt-candidate.json", cache) : candidateVarkis ? new URL("arkpedia-varkis-candidate.json", cache) : candidateBranch ? new URL("arkpedia-branch-candidate.json", cache) : candidateReckpr ? new URL("arkpedia-reckpr-candidate.json", cache) : candidateClosur ? new URL("arkpedia-closur-candidate.json", cache) : new URL("../../data/arkpedia-mvp.json", import.meta.url),
  output,
);
console.log(
  `Built ${stage.code}: ${ids.length} operators, ${Object.keys(enemyRecords).length} enemies; SD ${sdCommit}`,
);
