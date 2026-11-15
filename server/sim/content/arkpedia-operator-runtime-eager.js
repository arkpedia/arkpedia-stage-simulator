// SPDX-License-Identifier: GPL-3.0-or-later
// Ordered regular-stage content adapters. Add a content module here instead of
// editing the battle command. Order preserves existing hook registration/RNG semantics.
import { customizeMedicKit, installMedic } from './arkpedia-medics.js';
import { customizeCasterKit, installCaster } from './arkpedia-casters.js';
import { customizeGuardKit, installGuard } from './arkpedia-guards.js';
import { customizeSniperKit, installSniper } from './arkpedia-snipers.js';
import { customizeVanguardKit, installVanguard } from './arkpedia-vanguards.js';
import { customizeDefenderKit, installDefender } from './arkpedia-defenders.js';
import { customizeAdvancedSniperKit, installAdvancedSniper } from './arkpedia-advanced-snipers.js';
import { customizeSupportKit, installSupport } from './arkpedia-supporters.js';
import { customizeSpecialistKit, installSpecialist } from './arkpedia-specialists.js';
import { customizeUtilityKit, installUtility } from './arkpedia-utility.js';
import { customizeGuardExpansionKit, installGuardExpansion } from './arkpedia-guard-expansion.js';
import { customizeSupportExpansionKit, installSupportExpansion } from './arkpedia-support-expansion.js';
import { customizeCasterExpansionKit, installCasterExpansion } from './arkpedia-caster-expansion.js';
import { customizeSniperExpansionKit, installSniperExpansion } from './arkpedia-sniper-expansion.js';
import { customizeSummonerKit, installSummoner } from './arkpedia-summons.js';
import { customizeRobotExpansionKit, installRobotExpansion } from './arkpedia-robot-expansion.js';
import { customizeFiveStarGuardKit, installFiveStarGuard } from './arkpedia-five-star-guards.js';
import { customizeFiveStarCasterKit, installFiveStarCaster } from './arkpedia-five-star-casters.js';
import { customizeFiveStarVanguardKit, installFiveStarVanguard } from './arkpedia-five-star-vanguards.js';
import { customizeFiveStarVanguardSecondKit, installFiveStarVanguardSecond } from './arkpedia-five-star-vanguard-second.js';
import { customizeFiveStarSupportKit, installFiveStarSupport } from './arkpedia-five-star-support.js';
import { customizeFiveStarGuardExpansionKit, installFiveStarGuardExpansion } from './arkpedia-five-star-guard-expansion.js';
import { customizeFiveStarCasterExpansionKit, installFiveStarCasterExpansion } from './arkpedia-five-star-caster-expansion.js';
import { customizeFiveStarSupportExpansionKit, installFiveStarSupportExpansion } from './arkpedia-five-star-support-expansion.js';
import { customizeFiveStarGuardThirdKit, installFiveStarGuardThird } from './arkpedia-five-star-guard-third.js';
import { customizeFiveStarSniperKit, installFiveStarSniper } from './arkpedia-five-star-snipers.js';
import { customizeFiveStarCasterUtilityKit, installFiveStarCasterUtility } from './arkpedia-five-star-caster-utility.js';
import { customizeFiveStarGuardFifthKit, installFiveStarGuardFifth } from './arkpedia-five-star-guard-fifth.js';
import { customizeFiveStarMedicKit, installFiveStarMedic } from './arkpedia-five-star-medic.js';
import { customizeFiveStarMedicSecondKit, installFiveStarMedicSecond } from './arkpedia-five-star-medic-second.js';
import { customizeFiveStarMedicThirdKit, installFiveStarMedicThird } from './arkpedia-five-star-medic-third.js';
import { customizeFiveStarDefenderKit, installFiveStarDefender } from './arkpedia-five-star-defenders.js';
import { customizeFiveStarDefenderSecondKit, installFiveStarDefenderSecond } from './arkpedia-five-star-defender-second.js';
import { customizeFiveStarGuardSixthKit, installFiveStarGuardSixth } from './arkpedia-five-star-guard-sixth.js';
import { customizeFiveStarSniperSecondKit, installFiveStarSniperSecond } from './arkpedia-five-star-sniper-second.js';
import { customizeFiveStarSniperThirdKit, installFiveStarSniperThird } from './arkpedia-five-star-sniper-third.js';
import { customizeCastersNextKit, installCastersNext } from './arkpedia-caster-next.js';
import { customizeDefenderThirdKit, installDefenderThird } from './arkpedia-defender-third.js';
import { customizeSixStarMedicKit, installSixStarMedic } from './arkpedia-six-star-medic.js';
import { customizeDefenderFourthKit, installDefenderFourth } from './arkpedia-defender-fourth.js';
import { customizeFiveStarMedicFourthKit, installFiveStarMedicFourth } from './arkpedia-five-star-medic-fourth.js';
import { customizeCasterSecondKit, installCasterSecond } from './arkpedia-caster-second.js';
import { customizeFiveStarVanguardThirdKit, installFiveStarVanguardThird } from './arkpedia-five-star-vanguard-third.js';
import { customizeGuardSixStarKit, installGuardSixStar } from './arkpedia-guard-six-star.js';
import { customizeFiveStarSniperFourthKit, installFiveStarSniperFourth } from './arkpedia-five-star-sniper-fourth.js';
import { customizeSniperSixStarKit, installSniperSixStar } from './arkpedia-sniper-six-star.js';
import { customizeSniperSixStarSecondKit, installSniperSixStarSecond } from './arkpedia-sniper-six-star-second.js';
import { customizeSupportAuraKit, installSupportAura } from './arkpedia-support-auras.js';
import { customizeGuardSixStarSecondKit, installGuardSixStarSecond } from './arkpedia-guard-six-star-second.js';
import { customizeElementalCasterKit, installElementalCaster } from './arkpedia-elemental-casters.js';
import { customizeBlessingExpansionKit, installBlessingExpansion } from './arkpedia-blessing-expansion.js';
import { customizeGuardSixStarThirdKit, installGuardSixStarThird } from './arkpedia-guard-six-star-third.js';
import { customizeCasterThirdKit, installCasterThird } from './arkpedia-caster-third.js';
import { customizeRitualistKit } from './arkpedia-ritualists.js';
import { customizeSupportControlKit, installSupportControl } from './arkpedia-support-control.js';
import { customizeLucillaKit, installLucilla } from './arkpedia-lucilla.js';
import { customizeThornsKit, installThorns } from './arkpedia-thorns.js';
import { customizeArchettoKit, installArchetto } from './arkpedia-archetto.js';
import { customizeGuardSixStarFourthKit, installGuardSixStarFourth } from './arkpedia-guard-six-star-fourth.js';
import { customizeFartoothKit, installFartooth } from './arkpedia-fartooth.js';
import { customizeSariaKit, installSaria } from './arkpedia-saria.js';
import { customizeBagpipeKit, installBagpipe } from './arkpedia-bagpipe.js';
import { customizeRosaKit, installRosa } from './arkpedia-rosa.js';
import { customizePuzzleKit, installPuzzle } from './arkpedia-puzzle.js';
import { customizeHoedererKit, installHoederer } from './arkpedia-hoederer.js';
import { customizeWKit, installW } from './arkpedia-w.js';
import { customizeMlynarKit, installMlynar } from './arkpedia-mlynar.js';
import { customizeSilenceParadigmaticKit, installSilenceParadigmatic } from './arkpedia-silence-paradigmatic.js';
import { customizeEyjaAlterKit, installEyjaAlter } from './arkpedia-eyja-alter.js';
import { customizeJieyunKit, installJieyun } from './arkpedia-jieyun.js';
import { customizeRadiantKnightKit, installRadiantKnight } from './arkpedia-radiant-knight.js';
import { customizeNianKit, installNian } from './arkpedia-nian.js';
import { customizeKaltsitKit, installKaltsit } from './arkpedia-kaltsit.js';
import { customizeZuoleKit, installZuole } from './arkpedia-zuole.js';
import { customizeBobbingKit, installBobbing } from './arkpedia-bobbing.js';
import { customizeSceneKit, installScene } from './arkpedia-scene.js';
import { customizeSandReckonerKit, installSandReckoner } from './arkpedia-sand-reckoner.js';
import { customizeVirtuosaKit, installVirtuosa } from './arkpedia-virtuosa.js';
import { customizeDorothyKit, installDorothy } from './arkpedia-dorothy.js';
import { customizeSkadiAlterKit, installSkadiAlter } from './arkpedia-skadi-alter.js';
import { customizeInesKit, installInes } from './arkpedia-ines.js';
import { customizeCivilightKit, installCivilight } from './arkpedia-civilight.js';
import { customizeReedAlterKit, installReedAlter } from './arkpedia-reed-alter.js';
import { customizePozemkaKit, installPozemka } from './arkpedia-pozemka.js';
import { customizeAmiyaGuardKit, installAmiyaGuard } from './arkpedia-amiya-guard.js';
import { customizeAmiyaMedicKit, installAmiyaMedic } from './arkpedia-amiya-medic.js';
import { customizeChilchuckKit, installChilchuck } from './arkpedia-chilchuck.js';
import { customizeBlacknightKit, installBlacknight } from './arkpedia-blacknight.js';
import { customizeVigilKit, installVigil } from './arkpedia-vigil.js';
import { customizeRayKit, installRay } from './arkpedia-ray.js';
import { customizeColdshotKit, installColdshot } from './arkpedia-coldshot.js';
import { customizeNymphKit, installNymph } from './arkpedia-nymph.js';
import { customizeLemuenKit, installLemuen } from './arkpedia-lemuen.js';
import { customizeRmixerKit, installRmixer } from './arkpedia-rmixer.js';
import { customizeMarcilKit, installMarcil } from './arkpedia-marcil.js';
import { customizePublicMuelsyseKit, installPublicMuelsyse } from './arkpedia-muelsyse-public.js';
import { customizePublicNecrassKit, installPublicNecrass } from './arkpedia-necrass-public.js';
import { customizePublicTragodiaKit, installPublicTragodia } from './arkpedia-tragodia-public.js';
import { customizePublicMon3trKit, installPublicMon3tr } from './arkpedia-mon3tr-public.js';
import { customizePublicAkkordKit, installPublicAkkord } from './arkpedia-akkord-public.js';
import { customizePublicWintimKit, installPublicWintim } from './arkpedia-wintim-public.js';
import { customizePublicJcintaKit, installPublicJcinta } from './arkpedia-jcinta-public.js';
import { customizePublicLieselKit, installPublicLiesel } from './arkpedia-liesel-public.js';
import { customizePublicClosurKit, installPublicClosur } from './arkpedia-closur-public.js';
import { customizePublicReckprKit, installPublicReckpr } from './arkpedia-reckpr-public.js';
import { customizePublicVarkisKit, installPublicVarkis } from './arkpedia-varkis-public.js';
import { customizePublicSnhuntKit, installPublicSnhunt } from './arkpedia-snhunt-public.js';
import { customizePublicKichiKit, installPublicKichi } from './arkpedia-kichi-public.js';
import { customizePublicCairnKit, installPublicCairn } from './arkpedia-cairn-public.js';
import { customizePublicCrackborneKit, installPublicCrackborne } from './arkpedia-tanya-public.js';
import { customizePublicThumpyKit, installPublicThumpy } from './arkpedia-thumpy-public.js';
import { customizePublicTimeslotKit, installPublicTimeslot } from './arkpedia-tmslot-public.js';
import { customizePublicPedroKit, installPublicPedro } from './arkpedia-pedro-public.js';
import { customizePublicMechanistKit, installPublicMechanist } from './arkpedia-mcnist-public.js';
import { customizePublicGallusKit, installPublicGallus } from './arkpedia-gallus-public.js';
import { customizePublicKoromaruKit, installPublicKoromaru } from './arkpedia-koromaru-public.js';
import { customizePublicReconKit, installPublicRecon } from './arkpedia-recon-public.js';
import { customizePublicTurdusKit, installPublicTurdus } from './arkpedia-turdus-public.js';
import { customizePublicJuKit, installPublicJu } from './arkpedia-ju-public.js';
import { customizePublicTaraxaKit, installPublicTaraxa } from './arkpedia-taraxa-public.js';
import { customizePublicBotanyKit, installPublicBotany } from './arkpedia-botany-public.js';
import { customizePublicSkyboxKit, installPublicSkybox } from './arkpedia-skybox-public.js';
import { customizePublicAegisKit, installPublicAegis } from './arkpedia-aegis-public.js';
import { customizePublicYukariKit, installPublicYukari } from './arkpedia-yukari-public.js';
import { customizePublicMakotoKit, installPublicMakoto } from './arkpedia-makoto-public.js';
import { customizePublicAphrissaKit, installPublicAphrissa } from './arkpedia-aphrissa-public.js';
import { customizePublicHadiyaKit, installPublicHadiya } from './arkpedia-hadiya-public.js';
import { customizeAmorisKit, installAmoris } from './arkpedia-amoris.js';
import { customizeTmorisKit, installTmoris } from './arkpedia-tmoris.js';
import { customizeDolrisKit, installDolris } from './arkpedia-dolris.js';
import { customizeMortisKit, installMortis } from './arkpedia-mortis.js';
import { customizeOblvnsKit, installOblvns } from './arkpedia-oblvns.js';
import { customizeMakiriKit, installMakiri } from './arkpedia-makiri.js';
import { customizeFlwr2Kit, installFlwr2 } from './arkpedia-flwr2.js';
import { customizeHeadb2Kit, installHeadb2 } from './arkpedia-headb2.js';
import { customizeTitiKit, installTiti } from './arkpedia-titi.js';
import { customizeHalo2Kit, installHalo2 } from './arkpedia-halo2.js';
import { customizeCatap2Kit, installCatap2 } from './arkpedia-catap2.js';
import { customizeChen3Kit, installChen3 } from './arkpedia-chen3.js';
import { customizeHsgma2Kit, installHsgma2 } from './arkpedia-hsgma2.js';
import { customizeOrchd2Kit, installOrchd2 } from './arkpedia-orchd2.js';
import { customizeLeizi2Kit, installLeizi2 } from './arkpedia-leizi2.js';
import { customizeVeenKit, installVeen } from './arkpedia-veen.js';
import { customizeMantraKit, installMantra } from './arkpedia-mantra.js';
import { customizeHarukaKit, installHaruka } from './arkpedia-haruka.js';
import { customizeWangKit, installWang } from './arkpedia-wang.js';
import { customizeDemetrKit, installDemetr } from './arkpedia-demetr.js';
import { customizeSbell2Kit, installSbell2 } from './arkpedia-sbell2.js';
import { customizeAglna2Kit, installAglna2 } from './arkpedia-aglna2.js';
import { customizeRadianKit, installRadian } from './arkpedia-radian.js';
import { customizeKalts2Kit, installKalts2 } from './arkpedia-kalts2.js';
import { customizeSvash2Kit, installSvash2 } from './arkpedia-svash2.js';
import { customizeNastiKit, installNasti } from './arkpedia-nasti.js';
import { customizePublicBranchKit, installPublicBranch } from './arkpedia-branch-public.js';
import { customizeNarantKit, installNarant } from './arkpedia-narant.js';
import { customizeElaKit, installEla } from './arkpedia-ela.js';
import { customizeFuzeKit, installFuze } from './arkpedia-fuze.js';
import { customizeRosmontisKit, installRosmontis } from './arkpedia-rosmontis.js';
import { customizeWisadelKit, installWisadel } from './arkpedia-wisadel.js';
import { customizeSwireAlterKit, installSwireAlter } from './arkpedia-swire-alter.js';
import { customizeChristineKit, installChristine } from './arkpedia-christine.js';
import { customizeExecutorReaperKit, installExecutorReaper } from './arkpedia-executor-reaper.js';
import { customizePhilaeKit, installPhilae } from './arkpedia-philae.js';
import { customizeWindflitKit, installWindflit } from './arkpedia-windflit.js';
import { customizeBlemishineKit, installBlemishine } from './arkpedia-blemishine.js';
import { customizeFlametailKit, installFlametail } from './arkpedia-flametail.js';
import { customizeAlannaKit, installAlanna } from './arkpedia-alanna.js';
import { customizeCatherineKit, installCatherine } from './arkpedia-catherine.js';
import { customizeSenshiKit, installSenshi } from './arkpedia-senshi.js';
import { customizeTinmanKit, installTinman } from './arkpedia-tinman.js';
import { customizeTecnoKit, installTecno } from './arkpedia-tecno.js';
import { customizeSaileachKit, installSaileach } from './arkpedia-saileach.js';
import { customizeSurtrKit, installSurtr } from './arkpedia-surtr.js';
import { customizeSpuriaKit, installSpuria } from './arkpedia-spuria.js';
import { customizeRobinKit, installRobin } from './arkpedia-robin.js';
import { customizeWulfeniteKit, installWulfenite } from './arkpedia-wulfenite.js';
import { customizeTippiKit, installTippi } from './arkpedia-tippi.js';
import { customizeLessingKit, installLessing } from './arkpedia-lessing.js';
import { customizePenanceKit, installPenance } from './arkpedia-penance.js';
import { customizeMudrockKit, installMudrock } from './arkpedia-mudrock.js';
import { customizeBlazeKit, installBlaze } from './arkpedia-blaze.js';
import { customizeGavialInvincibleKit, installGavialInvincible } from './arkpedia-gavial-invincible.js';
import { customizeFiammettaKit, installFiammetta } from './arkpedia-fiammetta.js';
import { customizeHornKit, installHorn } from './arkpedia-horn.js';
import { customizeGnosisKit, installGnosis } from './arkpedia-gnosis.js';
import { customizeTexasAlterKit, installTexasAlter } from './arkpedia-texas-alter.js';
import { customizeTyphonKit, installTyphon } from './arkpedia-typhon.js';
import { customizeIreneKit, installIrene } from './arkpedia-irene.js';
import { customizeDegenbrecherKit, installDegenbrecher } from './arkpedia-degenbrecher.js';
import { customizeChongyueKit, installChongyue } from './arkpedia-chongyue.js';
import { customizePepeKit, installPepe } from './arkpedia-pepe.js';
import { customizeGladiiaKit, installGladiia } from './arkpedia-gladiia.js';
import { customizeCrownslayerKit, installCrownslayer } from './arkpedia-crownslayer.js';
import { customizeIanaKit, installIana } from './arkpedia-iana.js';
import { customizeBrigidKit, installBrigid } from './arkpedia-brigid.js';
import { customizeSpecterAlterKit, installSpecterAlter } from './arkpedia-specter-alter.js';
import { customizeYatoAlterKit, installYatoAlter } from './arkpedia-yato-alter.js';
import { customizeLeeKit, installLee } from './arkpedia-lee.js';
import { customizeGoldenglowKit, installGoldenglow } from './arkpedia-goldenglow.js';
import { customizeLapplandKit, installLappland } from './arkpedia-lappland-alter.js';
import { customizeThornsLodestarKit, installThornsLodestar } from './arkpedia-thorns-lodestar.js';
import { customizeBlazeIgnitingKit, installBlazeIgniting } from './arkpedia-blaze-igniting.js';
import { customizeExusiaiCovenantKit, installExusiaiCovenant } from './arkpedia-exusiai-covenant.js';
import { customizeMagallanKit, installMagallan } from './arkpedia-magallan-skills.js';
import { customizeLingKit, installLing } from './arkpedia-ling-skills.js';
import { customizeShuKit, installShu } from './arkpedia-shu-skills.js';
import { customizeYuKit, installYu } from './arkpedia-yu-skills.js';
import { customizeStainlessKit, installStainless } from './arkpedia-stainless-skills.js';
import { customizeMitmKit, installMitm } from './arkpedia-mitm-skills.js';
import { customizeHoolheyakKit, installHoolheyak } from './arkpedia-hoolheyak.js';
import { customizeEbenholzKit, installEbenholz } from './arkpedia-ebenholz.js';
import { customizeLinKit, installLin } from './arkpedia-lin.js';
import { customizeUlpianusKit, installUlpianus } from './arkpedia-ulpianus.js';
import { customizeWeedyKit, installWeedy } from './arkpedia-weedy.js';
import { customizeVinaKit, installVina } from './arkpedia-vina.js';
import { customizeJessicaKit, installJessica } from './arkpedia-jessica.js';
import { customizeEntelechiaKit, installEntelechia } from './arkpedia-entelechia.js';
import { customizeAscalonKit, installAscalon } from './arkpedia-ascalon.js';
import { customizeChenAlterKit, installChenAlter } from './arkpedia-chen-alter.js';
import { customizeEyjafjallaKit, installEyjafjalla } from './arkpedia-eyjafjalla.js';
import { customizeFrostKit, installFrost } from './arkpedia-frost.js';
import { customizeMayerKit, installMayer } from './arkpedia-mayer.js';
import { customizeFangFireSharpenedKit, installFangFireSharpened } from './arkpedia-fang-fire-sharpened.js';
import { customizeSiegeKit, installSiege } from './arkpedia-siege.js';
import { customizeFirewatchKit, installFirewatch } from './arkpedia-firewatch.js';
import { customizeSurferKit, installSurfer } from './arkpedia-surfer.js';
import { customizeMelaniteKit, installMelanite } from './arkpedia-melanite.js';
import { customizeAshKit, installAsh } from './arkpedia-ash.js';
import { customizeChenKit, installChen } from './arkpedia-chen.js';
import { customizeVulpisKit, installVulpis } from './arkpedia-vulpis.js';
import { customizeSagaKit, installSaga } from './arkpedia-saga.js';
import { customizeEunectesKit, installEunectes } from './arkpedia-eunectes.js';
import { customizeAakKit, installAak } from './arkpedia-aak.js';
import { customizeBenaKit, installBena } from './arkpedia-bena.js';
import { customizeKazemaruKit, installKazemaru } from './arkpedia-kazemaru.js';
import { customizePhantomKit, installPhantom } from './arkpedia-phantom.js';
import { customizeHookExpansionKit, installHookExpansion } from './arkpedia-hook-expansion.js';
import { customizeFiveStarSupportFourthKit, installFiveStarSupportFourth } from './arkpedia-five-star-support-fourth.js';
import { customizeFiveStarSpecialistExpansionKit, installFiveStarSpecialistExpansion } from './arkpedia-five-star-specialist-expansion.js';
import { customizeFiveStarCasterOverloadKit, installFiveStarCasterOverload } from './arkpedia-five-star-caster-overload.js';
import { customizeFiveStarSupportThirdKit, installFiveStarSupportThird } from './arkpedia-five-star-support-third.js';
import { customizeFiveStarGuardFourthKit, installFiveStarGuardFourth } from './arkpedia-five-star-guard-fourth.js';

export const REGULAR_OPERATOR_ADAPTERS = Object.freeze([
  Object.freeze({ key: 'arkpedia-medics', customize: customizeMedicKit, install: installMedic }),
  Object.freeze({ key: 'arkpedia-casters', customize: customizeCasterKit, install: installCaster }),
  Object.freeze({ key: 'arkpedia-guards', customize: customizeGuardKit, install: installGuard }),
  Object.freeze({ key: 'arkpedia-snipers', customize: customizeSniperKit, install: installSniper }),
  Object.freeze({ key: 'arkpedia-vanguards', customize: customizeVanguardKit, install: installVanguard }),
  Object.freeze({ key: 'arkpedia-defenders', customize: customizeDefenderKit, install: installDefender }),
  Object.freeze({ key: 'arkpedia-advanced-snipers', customize: customizeAdvancedSniperKit, install: installAdvancedSniper }),
  Object.freeze({ key: 'arkpedia-supporters', customize: customizeSupportKit, install: installSupport }),
  Object.freeze({ key: 'arkpedia-specialists', customize: customizeSpecialistKit, install: installSpecialist }),
  Object.freeze({ key: 'arkpedia-utility', customize: customizeUtilityKit, install: installUtility }),
  Object.freeze({ key: 'arkpedia-guard-expansion', customize: customizeGuardExpansionKit, install: installGuardExpansion }),
  Object.freeze({ key: 'arkpedia-support-expansion', customize: customizeSupportExpansionKit, install: installSupportExpansion }),
  Object.freeze({ key: 'arkpedia-caster-expansion', customize: customizeCasterExpansionKit, install: installCasterExpansion }),
  Object.freeze({ key: 'arkpedia-sniper-expansion', customize: customizeSniperExpansionKit, install: installSniperExpansion }),
  Object.freeze({ key: 'arkpedia-summons', customize: customizeSummonerKit, install: installSummoner }),
  Object.freeze({ key: 'arkpedia-robot-expansion', customize: customizeRobotExpansionKit, install: installRobotExpansion }),
  Object.freeze({ key: 'arkpedia-five-star-guards', customize: customizeFiveStarGuardKit, install: installFiveStarGuard }),
  Object.freeze({ key: 'arkpedia-five-star-casters', customize: customizeFiveStarCasterKit, install: installFiveStarCaster }),
  Object.freeze({ key: 'arkpedia-five-star-vanguards', customize: customizeFiveStarVanguardKit, install: installFiveStarVanguard }),
  Object.freeze({ key: 'arkpedia-five-star-vanguard-second', customize: customizeFiveStarVanguardSecondKit, install: installFiveStarVanguardSecond }),
  Object.freeze({ key: 'arkpedia-five-star-support', customize: customizeFiveStarSupportKit, install: installFiveStarSupport }),
  Object.freeze({ key: 'arkpedia-five-star-guard-expansion', customize: customizeFiveStarGuardExpansionKit, install: installFiveStarGuardExpansion }),
  Object.freeze({ key: 'arkpedia-five-star-caster-expansion', customize: customizeFiveStarCasterExpansionKit, install: installFiveStarCasterExpansion }),
  Object.freeze({ key: 'arkpedia-five-star-support-expansion', customize: customizeFiveStarSupportExpansionKit, install: installFiveStarSupportExpansion }),
  Object.freeze({ key: 'arkpedia-five-star-guard-third', customize: customizeFiveStarGuardThirdKit, install: installFiveStarGuardThird }),
  Object.freeze({ key: 'arkpedia-five-star-snipers', customize: customizeFiveStarSniperKit, install: installFiveStarSniper }),
  Object.freeze({ key: 'arkpedia-five-star-caster-utility', customize: customizeFiveStarCasterUtilityKit, install: installFiveStarCasterUtility }),
  Object.freeze({ key: 'arkpedia-five-star-guard-fifth', customize: customizeFiveStarGuardFifthKit, install: installFiveStarGuardFifth }),
  Object.freeze({ key: 'arkpedia-five-star-medic', customize: customizeFiveStarMedicKit, install: installFiveStarMedic }),
  Object.freeze({ key: 'arkpedia-five-star-medic-second', customize: customizeFiveStarMedicSecondKit, install: installFiveStarMedicSecond }),
  Object.freeze({ key: 'arkpedia-five-star-medic-third', customize: customizeFiveStarMedicThirdKit, install: installFiveStarMedicThird }),
  Object.freeze({ key: 'arkpedia-five-star-defenders', customize: customizeFiveStarDefenderKit, install: installFiveStarDefender }),
  Object.freeze({ key: 'arkpedia-five-star-defender-second', customize: customizeFiveStarDefenderSecondKit, install: installFiveStarDefenderSecond }),
  Object.freeze({ key: 'arkpedia-five-star-guard-sixth', customize: customizeFiveStarGuardSixthKit, install: installFiveStarGuardSixth }),
  Object.freeze({ key: 'arkpedia-five-star-sniper-second', customize: customizeFiveStarSniperSecondKit, install: installFiveStarSniperSecond }),
  Object.freeze({ key: 'arkpedia-five-star-sniper-third', customize: customizeFiveStarSniperThirdKit, install: installFiveStarSniperThird }),
  Object.freeze({ key: 'arkpedia-caster-next', customize: customizeCastersNextKit, install: installCastersNext }),
  Object.freeze({ key: 'arkpedia-defender-third', customize: customizeDefenderThirdKit, install: installDefenderThird }),
  Object.freeze({ key: 'arkpedia-six-star-medic', customize: customizeSixStarMedicKit, install: installSixStarMedic }),
  Object.freeze({ key: 'arkpedia-defender-fourth', customize: customizeDefenderFourthKit, install: installDefenderFourth }),
  Object.freeze({ key: 'arkpedia-five-star-medic-fourth', customize: customizeFiveStarMedicFourthKit, install: installFiveStarMedicFourth }),
  Object.freeze({ key: 'arkpedia-caster-second', customize: customizeCasterSecondKit, install: installCasterSecond }),
  Object.freeze({ key: 'arkpedia-five-star-vanguard-third', customize: customizeFiveStarVanguardThirdKit, install: installFiveStarVanguardThird }),
  Object.freeze({ key: 'arkpedia-guard-six-star', customize: customizeGuardSixStarKit, install: installGuardSixStar }),
  Object.freeze({ key: 'arkpedia-five-star-sniper-fourth', customize: customizeFiveStarSniperFourthKit, install: installFiveStarSniperFourth }),
  Object.freeze({ key: 'arkpedia-sniper-six-star', customize: customizeSniperSixStarKit, install: installSniperSixStar }),
  Object.freeze({ key: 'arkpedia-sniper-six-star-second', customize: customizeSniperSixStarSecondKit, install: installSniperSixStarSecond }),
  Object.freeze({ key: 'arkpedia-support-auras', customize: customizeSupportAuraKit, install: installSupportAura }),
  Object.freeze({ key: 'arkpedia-guard-six-star-second', customize: customizeGuardSixStarSecondKit, install: installGuardSixStarSecond }),
  Object.freeze({ key: 'arkpedia-elemental-casters', customize: customizeElementalCasterKit, install: installElementalCaster }),
  Object.freeze({ key: 'arkpedia-blessing-expansion', customize: customizeBlessingExpansionKit, install: installBlessingExpansion }),
  Object.freeze({ key: 'arkpedia-guard-six-star-third', customize: customizeGuardSixStarThirdKit, install: installGuardSixStarThird }),
  Object.freeze({ key: 'arkpedia-caster-third', customize: customizeCasterThirdKit, install: installCasterThird }),
  Object.freeze({ key: 'arkpedia-ritualists', customize: customizeRitualistKit }),
  Object.freeze({ key: 'arkpedia-support-control', customize: customizeSupportControlKit, install: installSupportControl }),
  Object.freeze({ key: 'arkpedia-lucilla', customize: customizeLucillaKit, install: installLucilla }),
  Object.freeze({ key: 'arkpedia-thorns', customize: customizeThornsKit, install: installThorns }),
  Object.freeze({ key: 'arkpedia-archetto', customize: customizeArchettoKit, install: installArchetto }),
  Object.freeze({ key: 'arkpedia-guard-six-star-fourth', customize: customizeGuardSixStarFourthKit, install: installGuardSixStarFourth }),
  Object.freeze({ key: 'arkpedia-fartooth', customize: customizeFartoothKit, install: installFartooth }),
  Object.freeze({ key: 'arkpedia-saria', customize: customizeSariaKit, install: installSaria }),
  Object.freeze({ key: 'arkpedia-bagpipe', customize: customizeBagpipeKit, install: installBagpipe }),
  Object.freeze({ key: 'arkpedia-rosa', customize: customizeRosaKit, install: installRosa }),
  Object.freeze({ key: 'arkpedia-puzzle', customize: customizePuzzleKit, install: installPuzzle }),
  Object.freeze({ key: 'arkpedia-hoederer', customize: customizeHoedererKit, install: installHoederer }),
  Object.freeze({ key: 'arkpedia-w', customize: customizeWKit, install: installW }),
  Object.freeze({ key: 'arkpedia-mlynar', customize: customizeMlynarKit, install: installMlynar }),
  Object.freeze({ key: 'arkpedia-silence-paradigmatic', customize: customizeSilenceParadigmaticKit, install: installSilenceParadigmatic }),
  Object.freeze({ key: 'arkpedia-eyja-alter', customize: customizeEyjaAlterKit, install: installEyjaAlter }),
  Object.freeze({ key: 'arkpedia-jieyun', customize: customizeJieyunKit, install: installJieyun }),
  Object.freeze({ key: 'arkpedia-radiant-knight', customize: customizeRadiantKnightKit, install: installRadiantKnight }),
  Object.freeze({ key: 'arkpedia-nian', customize: customizeNianKit, install: installNian }),
  Object.freeze({ key: 'arkpedia-kaltsit', customize: customizeKaltsitKit, install: installKaltsit }),
  Object.freeze({ key: 'arkpedia-zuole', customize: customizeZuoleKit, install: installZuole }),
  Object.freeze({ key: 'arkpedia-bobbing', customize: customizeBobbingKit, install: installBobbing }),
  Object.freeze({ key: 'arkpedia-scene', customize: customizeSceneKit, install: installScene }),
  Object.freeze({ key: 'arkpedia-sand-reckoner', customize: customizeSandReckonerKit, install: installSandReckoner }),
  Object.freeze({ key: 'arkpedia-virtuosa', customize: customizeVirtuosaKit, install: installVirtuosa }),
  Object.freeze({ key: 'arkpedia-dorothy', customize: customizeDorothyKit, install: installDorothy }),
  Object.freeze({ key: 'arkpedia-skadi-alter', customize: customizeSkadiAlterKit, install: installSkadiAlter }),
  Object.freeze({ key: 'arkpedia-ines', customize: customizeInesKit, install: installInes }),
  Object.freeze({ key: 'arkpedia-civilight', customize: customizeCivilightKit, install: installCivilight }),
  Object.freeze({ key: 'arkpedia-reed-alter', customize: customizeReedAlterKit, install: installReedAlter }),
  Object.freeze({ key: 'arkpedia-pozemka', customize: customizePozemkaKit, install: installPozemka }),
  Object.freeze({ key: 'arkpedia-amiya-guard', customize: customizeAmiyaGuardKit, install: installAmiyaGuard }),
  Object.freeze({ key: 'arkpedia-amiya-medic', customize: customizeAmiyaMedicKit, install: installAmiyaMedic }),
  Object.freeze({ key: 'arkpedia-chilchuck', customize: customizeChilchuckKit, install: installChilchuck }),
  Object.freeze({ key: 'arkpedia-blacknight', customize: customizeBlacknightKit, install: installBlacknight }),
  Object.freeze({ key: 'arkpedia-vigil', customize: customizeVigilKit, install: installVigil }),
  Object.freeze({ key: 'arkpedia-ray', customize: customizeRayKit, install: installRay }),
  Object.freeze({ key: 'arkpedia-coldshot', customize: customizeColdshotKit, install: installColdshot }),
  Object.freeze({ key: 'arkpedia-nymph', customize: customizeNymphKit, install: installNymph }),
  Object.freeze({ key: 'arkpedia-lemuen', customize: customizeLemuenKit, install: installLemuen }),
  Object.freeze({ key: 'arkpedia-rmixer', customize: customizeRmixerKit, install: installRmixer }),
  Object.freeze({ key: 'arkpedia-marcil', customize: customizeMarcilKit, install: installMarcil }),
  Object.freeze({ key: 'arkpedia-muelsyse-public', customize: customizePublicMuelsyseKit, install: installPublicMuelsyse }),
  Object.freeze({ key: 'arkpedia-necrass-public', customize: customizePublicNecrassKit, install: installPublicNecrass }),
  Object.freeze({ key: 'arkpedia-tragodia-public', customize: customizePublicTragodiaKit, install: installPublicTragodia }),
  Object.freeze({ key: 'arkpedia-mon3tr-public', customize: customizePublicMon3trKit, install: installPublicMon3tr }),
  Object.freeze({ key: 'arkpedia-akkord-public', customize: customizePublicAkkordKit, install: installPublicAkkord }),
  Object.freeze({ key: 'arkpedia-wintim-public', customize: customizePublicWintimKit, install: installPublicWintim }),
  Object.freeze({ key: 'arkpedia-jcinta-public', customize: customizePublicJcintaKit, install: installPublicJcinta }),
  Object.freeze({ key: 'arkpedia-liesel-public', customize: customizePublicLieselKit, install: installPublicLiesel }),
  Object.freeze({ key: 'arkpedia-closur-public', customize: customizePublicClosurKit, install: installPublicClosur }),
  Object.freeze({ key: 'arkpedia-reckpr-public', customize: customizePublicReckprKit, install: installPublicReckpr }),
  Object.freeze({ key: 'arkpedia-varkis-public', customize: customizePublicVarkisKit, install: installPublicVarkis }),
  Object.freeze({ key: 'arkpedia-snhunt-public', customize: customizePublicSnhuntKit, install: installPublicSnhunt }),
  Object.freeze({ key: 'arkpedia-kichi-public', customize: customizePublicKichiKit, install: installPublicKichi }),
  Object.freeze({ key: 'arkpedia-cairn-public', customize: customizePublicCairnKit, install: installPublicCairn }),
  Object.freeze({ key: 'arkpedia-tanya-public', customize: customizePublicCrackborneKit, install: installPublicCrackborne }),
  Object.freeze({ key: 'arkpedia-thumpy-public', customize: customizePublicThumpyKit, install: installPublicThumpy }),
  Object.freeze({ key: 'arkpedia-tmslot-public', customize: customizePublicTimeslotKit, install: installPublicTimeslot }),
  Object.freeze({ key: 'arkpedia-pedro-public', customize: customizePublicPedroKit, install: installPublicPedro }),
  Object.freeze({ key: 'arkpedia-mcnist-public', customize: customizePublicMechanistKit, install: installPublicMechanist }),
  Object.freeze({ key: 'arkpedia-gallus-public', customize: customizePublicGallusKit, install: installPublicGallus }),
  Object.freeze({ key: 'arkpedia-koromaru-public', customize: customizePublicKoromaruKit, install: installPublicKoromaru }),
  Object.freeze({ key: 'arkpedia-recon-public', customize: customizePublicReconKit, install: installPublicRecon }),
  Object.freeze({ key: 'arkpedia-turdus-public', customize: customizePublicTurdusKit, install: installPublicTurdus }),
  Object.freeze({ key: 'arkpedia-ju-public', customize: customizePublicJuKit, install: installPublicJu }),
  Object.freeze({ key: 'arkpedia-taraxa-public', customize: customizePublicTaraxaKit, install: installPublicTaraxa }),
  Object.freeze({ key: 'arkpedia-botany-public', customize: customizePublicBotanyKit, install: installPublicBotany }),
  Object.freeze({ key: 'arkpedia-skybox-public', customize: customizePublicSkyboxKit, install: installPublicSkybox }),
  Object.freeze({ key: 'arkpedia-aegis-public', customize: customizePublicAegisKit, install: installPublicAegis }),
  Object.freeze({ key: 'arkpedia-yukari-public', customize: customizePublicYukariKit, install: installPublicYukari }),
  Object.freeze({ key: 'arkpedia-makoto-public', customize: customizePublicMakotoKit, install: installPublicMakoto }),
  Object.freeze({ key: 'arkpedia-aphrissa-public', customize: customizePublicAphrissaKit, install: installPublicAphrissa }),
  Object.freeze({ key: 'arkpedia-hadiya-public', customize: customizePublicHadiyaKit, install: installPublicHadiya }),
  Object.freeze({ key: 'arkpedia-amoris', customize: customizeAmorisKit, install: installAmoris }),
  Object.freeze({ key: 'arkpedia-tmoris', customize: customizeTmorisKit, install: installTmoris }),
  Object.freeze({ key: 'arkpedia-dolris', customize: customizeDolrisKit, install: installDolris }),
  Object.freeze({ key: 'arkpedia-mortis', customize: customizeMortisKit, install: installMortis }),
  Object.freeze({ key: 'arkpedia-oblvns', customize: customizeOblvnsKit, install: installOblvns }),
  Object.freeze({ key: 'arkpedia-makiri', customize: customizeMakiriKit, install: installMakiri }),
  Object.freeze({ key: 'arkpedia-flwr2', customize: customizeFlwr2Kit, install: installFlwr2 }),
  Object.freeze({ key: 'arkpedia-headb2', customize: customizeHeadb2Kit, install: installHeadb2 }),
  Object.freeze({ key: 'arkpedia-titi', customize: customizeTitiKit, install: installTiti }),
  Object.freeze({ key: 'arkpedia-halo2', customize: customizeHalo2Kit, install: installHalo2 }),
  Object.freeze({ key: 'arkpedia-catap2', customize: customizeCatap2Kit, install: installCatap2 }),
  Object.freeze({ key: 'arkpedia-chen3', customize: customizeChen3Kit, install: installChen3 }),
  Object.freeze({ key: 'arkpedia-hsgma2', customize: customizeHsgma2Kit, install: installHsgma2 }),
  Object.freeze({ key: 'arkpedia-orchd2', customize: customizeOrchd2Kit, install: installOrchd2 }),
  Object.freeze({ key: 'arkpedia-leizi2', customize: customizeLeizi2Kit, install: installLeizi2 }),
  Object.freeze({ key: 'arkpedia-veen', customize: customizeVeenKit, install: installVeen }),
  Object.freeze({ key: 'arkpedia-mantra', customize: customizeMantraKit, install: installMantra }),
  Object.freeze({ key: 'arkpedia-haruka', customize: customizeHarukaKit, install: installHaruka }),
  Object.freeze({ key: 'arkpedia-wang', customize: customizeWangKit, install: installWang }),
  Object.freeze({ key: 'arkpedia-demetr', customize: customizeDemetrKit, install: installDemetr }),
  Object.freeze({ key: 'arkpedia-sbell2', customize: customizeSbell2Kit, install: installSbell2 }),
  Object.freeze({ key: 'arkpedia-aglna2', customize: customizeAglna2Kit, install: installAglna2 }),
  Object.freeze({ key: 'arkpedia-radian', customize: customizeRadianKit, install: installRadian }),
  Object.freeze({ key: 'arkpedia-kalts2', customize: customizeKalts2Kit, install: installKalts2 }),
  Object.freeze({ key: 'arkpedia-svash2', customize: customizeSvash2Kit, install: installSvash2 }),
  Object.freeze({ key: 'arkpedia-nasti', customize: customizeNastiKit, install: installNasti }),
  Object.freeze({ key: 'arkpedia-branch-public', customize: customizePublicBranchKit, install: installPublicBranch }),
  Object.freeze({ key: 'arkpedia-narant', customize: customizeNarantKit, install: installNarant }),
  Object.freeze({ key: 'arkpedia-ela', customize: customizeElaKit, install: installEla }),
  Object.freeze({ key: 'arkpedia-fuze', customize: customizeFuzeKit, install: installFuze }),
  Object.freeze({ key: 'arkpedia-rosmontis', customize: customizeRosmontisKit, install: installRosmontis }),
  Object.freeze({ key: 'arkpedia-wisadel', customize: customizeWisadelKit, install: installWisadel }),
  Object.freeze({ key: 'arkpedia-swire-alter', customize: customizeSwireAlterKit, install: installSwireAlter }),
  Object.freeze({ key: 'arkpedia-christine', customize: customizeChristineKit, install: installChristine }),
  Object.freeze({ key: 'arkpedia-executor-reaper', customize: customizeExecutorReaperKit, install: installExecutorReaper }),
  Object.freeze({ key: 'arkpedia-philae', customize: customizePhilaeKit, install: installPhilae }),
  Object.freeze({ key: 'arkpedia-windflit', customize: customizeWindflitKit, install: installWindflit }),
  Object.freeze({ key: 'arkpedia-blemishine', customize: customizeBlemishineKit, install: installBlemishine }),
  Object.freeze({ key: 'arkpedia-flametail', customize: customizeFlametailKit, install: installFlametail }),
  Object.freeze({ key: 'arkpedia-alanna', customize: customizeAlannaKit, install: installAlanna }),
  Object.freeze({ key: 'arkpedia-catherine', customize: customizeCatherineKit, install: installCatherine }),
  Object.freeze({ key: 'arkpedia-senshi', customize: customizeSenshiKit, install: installSenshi }),
  Object.freeze({ key: 'arkpedia-tinman', customize: customizeTinmanKit, install: installTinman }),
  Object.freeze({ key: 'arkpedia-tecno', customize: customizeTecnoKit, install: installTecno }),
  Object.freeze({ key: 'arkpedia-saileach', customize: customizeSaileachKit, install: installSaileach }),
  Object.freeze({ key: 'arkpedia-surtr', customize: customizeSurtrKit, install: installSurtr }),
  Object.freeze({ key: 'arkpedia-spuria', customize: customizeSpuriaKit, install: installSpuria }),
  Object.freeze({ key: 'arkpedia-robin', customize: customizeRobinKit, install: installRobin }),
  Object.freeze({ key: 'arkpedia-wulfenite', customize: customizeWulfeniteKit, install: installWulfenite }),
  Object.freeze({ key: 'arkpedia-tippi', customize: customizeTippiKit, install: installTippi }),
  Object.freeze({ key: 'arkpedia-lessing', customize: customizeLessingKit, install: installLessing }),
  Object.freeze({ key: 'arkpedia-penance', customize: customizePenanceKit, install: installPenance }),
  Object.freeze({ key: 'arkpedia-mudrock', customize: customizeMudrockKit, install: installMudrock }),
  Object.freeze({ key: 'arkpedia-blaze', customize: customizeBlazeKit, install: installBlaze }),
  Object.freeze({ key: 'arkpedia-gavial-invincible', customize: customizeGavialInvincibleKit, install: installGavialInvincible }),
  Object.freeze({ key: 'arkpedia-fiammetta', customize: customizeFiammettaKit, install: installFiammetta }),
  Object.freeze({ key: 'arkpedia-horn', customize: customizeHornKit, install: installHorn }),
  Object.freeze({ key: 'arkpedia-gnosis', customize: customizeGnosisKit, install: installGnosis }),
  Object.freeze({ key: 'arkpedia-texas-alter', customize: customizeTexasAlterKit, install: installTexasAlter }),
  Object.freeze({ key: 'arkpedia-typhon', customize: customizeTyphonKit, install: installTyphon }),
  Object.freeze({ key: 'arkpedia-irene', customize: customizeIreneKit, install: installIrene }),
  Object.freeze({ key: 'arkpedia-degenbrecher', customize: customizeDegenbrecherKit, install: installDegenbrecher }),
  Object.freeze({ key: 'arkpedia-chongyue', customize: customizeChongyueKit, install: installChongyue }),
  Object.freeze({ key: 'arkpedia-pepe', customize: customizePepeKit, install: installPepe }),
  Object.freeze({ key: 'arkpedia-gladiia', customize: customizeGladiiaKit, install: installGladiia }),
  Object.freeze({ key: 'arkpedia-crownslayer', customize: customizeCrownslayerKit, install: installCrownslayer }),
  Object.freeze({ key: 'arkpedia-iana', customize: customizeIanaKit, install: installIana }),
  Object.freeze({ key: 'arkpedia-brigid', customize: customizeBrigidKit, install: installBrigid }),
  Object.freeze({ key: 'arkpedia-specter-alter', customize: customizeSpecterAlterKit, install: installSpecterAlter }),
  Object.freeze({ key: 'arkpedia-yato-alter', customize: customizeYatoAlterKit, install: installYatoAlter }),
  Object.freeze({ key: 'arkpedia-lee', customize: customizeLeeKit, install: installLee }),
  Object.freeze({ key: 'arkpedia-goldenglow', customize: customizeGoldenglowKit, install: installGoldenglow }),
  Object.freeze({ key: 'arkpedia-lappland-alter', customize: customizeLapplandKit, install: installLappland }),
  Object.freeze({ key: 'arkpedia-thorns-lodestar', customize: customizeThornsLodestarKit, install: installThornsLodestar }),
  Object.freeze({ key: 'arkpedia-blaze-igniting', customize: customizeBlazeIgnitingKit, install: installBlazeIgniting }),
  Object.freeze({ key: 'arkpedia-exusiai-covenant', customize: customizeExusiaiCovenantKit, install: installExusiaiCovenant }),
  Object.freeze({ key: 'arkpedia-magallan-skills', customize: customizeMagallanKit, install: installMagallan }),
  Object.freeze({ key: 'arkpedia-ling-skills', customize: customizeLingKit, install: installLing }),
  Object.freeze({ key: 'arkpedia-shu-skills', customize: customizeShuKit, install: installShu }),
  Object.freeze({ key: 'arkpedia-yu-skills', customize: customizeYuKit, install: installYu }),
  Object.freeze({ key: 'arkpedia-stainless-skills', customize: customizeStainlessKit, install: installStainless }),
  Object.freeze({ key: 'arkpedia-mitm-skills', customize: customizeMitmKit, install: installMitm }),
  Object.freeze({ key: 'arkpedia-hoolheyak', customize: customizeHoolheyakKit, install: installHoolheyak }),
  Object.freeze({ key: 'arkpedia-ebenholz', customize: customizeEbenholzKit, install: installEbenholz }),
  Object.freeze({ key: 'arkpedia-lin', customize: customizeLinKit, install: installLin }),
  Object.freeze({ key: 'arkpedia-ulpianus', customize: customizeUlpianusKit, install: installUlpianus }),
  Object.freeze({ key: 'arkpedia-weedy', customize: customizeWeedyKit, install: installWeedy }),
  Object.freeze({ key: 'arkpedia-vina', customize: customizeVinaKit, install: installVina }),
  Object.freeze({ key: 'arkpedia-jessica', customize: customizeJessicaKit, install: installJessica }),
  Object.freeze({ key: 'arkpedia-entelechia', customize: customizeEntelechiaKit, install: installEntelechia }),
  Object.freeze({ key: 'arkpedia-ascalon', customize: customizeAscalonKit, install: installAscalon }),
  Object.freeze({ key: 'arkpedia-chen-alter', customize: customizeChenAlterKit, install: installChenAlter }),
  Object.freeze({ key: 'arkpedia-eyjafjalla', customize: customizeEyjafjallaKit, install: installEyjafjalla }),
  Object.freeze({ key: 'arkpedia-frost', customize: customizeFrostKit, install: installFrost }),
  Object.freeze({ key: 'arkpedia-mayer', customize: customizeMayerKit, install: installMayer }),
  Object.freeze({ key: 'arkpedia-fang-fire-sharpened', customize: customizeFangFireSharpenedKit, install: installFangFireSharpened }),
  Object.freeze({ key: 'arkpedia-siege', customize: customizeSiegeKit, install: installSiege }),
  Object.freeze({ key: 'arkpedia-firewatch', customize: customizeFirewatchKit, install: installFirewatch }),
  Object.freeze({ key: 'arkpedia-surfer', customize: customizeSurferKit, install: installSurfer }),
  Object.freeze({ key: 'arkpedia-melanite', customize: customizeMelaniteKit, install: installMelanite }),
  Object.freeze({ key: 'arkpedia-ash', customize: customizeAshKit, install: installAsh }),
  Object.freeze({ key: 'arkpedia-chen', customize: customizeChenKit, install: installChen }),
  Object.freeze({ key: 'arkpedia-vulpis', customize: customizeVulpisKit, install: installVulpis }),
  Object.freeze({ key: 'arkpedia-saga', customize: customizeSagaKit, install: installSaga }),
  Object.freeze({ key: 'arkpedia-eunectes', customize: customizeEunectesKit, install: installEunectes }),
  Object.freeze({ key: 'arkpedia-aak', customize: customizeAakKit, install: installAak }),
  Object.freeze({ key: 'arkpedia-bena', customize: customizeBenaKit, install: installBena }),
  Object.freeze({ key: 'arkpedia-kazemaru', customize: customizeKazemaruKit, install: installKazemaru }),
  Object.freeze({ key: 'arkpedia-phantom', customize: customizePhantomKit, install: installPhantom }),
  Object.freeze({ key: 'arkpedia-hook-expansion', customize: customizeHookExpansionKit, install: installHookExpansion }),
  Object.freeze({ key: 'arkpedia-five-star-support-fourth', customize: customizeFiveStarSupportFourthKit, install: installFiveStarSupportFourth }),
  Object.freeze({ key: 'arkpedia-five-star-specialist-expansion', customize: customizeFiveStarSpecialistExpansionKit, install: installFiveStarSpecialistExpansion }),
  Object.freeze({ key: 'arkpedia-five-star-caster-overload', customize: customizeFiveStarCasterOverloadKit, install: installFiveStarCasterOverload }),
  Object.freeze({ key: 'arkpedia-five-star-support-third', customize: customizeFiveStarSupportThirdKit, install: installFiveStarSupportThird }),
  Object.freeze({ key: 'arkpedia-five-star-guard-fourth', customize: customizeFiveStarGuardFourthKit, install: installFiveStarGuardFourth }),
]);

export function customizeRegularOperator(context) {
  for (const adapter of REGULAR_OPERATOR_ADAPTERS) adapter.customize?.(context);
}

export function installRegularOperator(context) {
  for (const adapter of REGULAR_OPERATOR_ADAPTERS) adapter.install?.(context);
}
