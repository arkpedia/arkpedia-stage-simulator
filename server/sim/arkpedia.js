// SPDX-License-Identifier: GPL-3.0-or-later
// Standard-stage commands around Stronghold's combat primitives. Nothing in this module enters the private host.
import { Battle } from "./Battle.js";
import { DataSource } from "./simdata.js";
import { genericKit } from "./content/generic.js";
import { elem } from './content/enemies.js';
import { regularDpMinimum, canSpendDp, spendDp, regularDpRecoveryForStep } from './content/arkpedia-dp-budget.js';
import { regularModelKey } from '../../shared/arkpedia/facing.js';
import { customizeMedicKit, installMedic, installMedicSquad } from './content/arkpedia-medics.js';
import { customizeCasterKit, installCaster } from './content/arkpedia-casters.js';
import { customizeGuardKit, installGuard } from './content/arkpedia-guards.js';
import { customizeSniperKit, installSniper } from './content/arkpedia-snipers.js';
import { customizeVanguardKit, installVanguard } from './content/arkpedia-vanguards.js';
import { customizeDefenderKit, installDefender } from './content/arkpedia-defenders.js';
import { customizeAdvancedSniperKit, installAdvancedSniper } from './content/arkpedia-advanced-snipers.js';
import { customizeSupportKit, installSupport } from './content/arkpedia-supporters.js';
import { customizeSpecialistKit, installSpecialist } from './content/arkpedia-specialists.js';
import { customizeUtilityKit, installUtility } from './content/arkpedia-utility.js';
import { customizeGuardExpansionKit, installGuardExpansion } from './content/arkpedia-guard-expansion.js';
import { customizeSupportExpansionKit, installSupportExpansion } from './content/arkpedia-support-expansion.js';
import { customizeCasterExpansionKit, installCasterExpansion } from './content/arkpedia-caster-expansion.js';
import { customizeSniperExpansionKit, installSniperExpansion } from './content/arkpedia-sniper-expansion.js';
import { customizeSummonerKit, installSummoner, selectedRegularSummon } from './content/arkpedia-summons.js';
import { customizeRobotExpansionKit, installRobotExpansion } from './content/arkpedia-robot-expansion.js';
import { customizeFiveStarGuardKit, installFiveStarGuard } from './content/arkpedia-five-star-guards.js';
import { customizeFiveStarCasterKit, installFiveStarCaster } from './content/arkpedia-five-star-casters.js';
import { customizeFiveStarVanguardKit, installFiveStarVanguard, prepareFiveStarVanguardSquad } from './content/arkpedia-five-star-vanguards.js';
import { customizeFiveStarVanguardSecondKit, installFiveStarVanguardSecond, adjustFiveStarVanguardSecondCost, consumeFiveStarVanguardSecondCard } from './content/arkpedia-five-star-vanguard-second.js';
import { customizeFiveStarSupportKit, installFiveStarSupport } from './content/arkpedia-five-star-support.js';
import { customizeFiveStarGuardExpansionKit, installFiveStarGuardExpansion } from './content/arkpedia-five-star-guard-expansion.js';
import { customizeFiveStarCasterExpansionKit, installFiveStarCasterExpansion } from './content/arkpedia-five-star-caster-expansion.js';
import { customizeFiveStarSupportExpansionKit, installFiveStarSupportExpansion } from './content/arkpedia-five-star-support-expansion.js';
import { customizeFiveStarGuardThirdKit, installFiveStarGuardThird } from './content/arkpedia-five-star-guard-third.js';
import { customizeFiveStarCasterUtilityKit, installFiveStarCasterUtility } from './content/arkpedia-five-star-caster-utility.js';
import { customizeFiveStarGuardFifthKit, installFiveStarGuardFifth } from './content/arkpedia-five-star-guard-fifth.js';
import { customizeFiveStarMedicKit, installFiveStarMedic } from './content/arkpedia-five-star-medic.js';
import { customizeFiveStarMedicSecondKit, installFiveStarMedicSecond } from './content/arkpedia-five-star-medic-second.js';
import { customizeFiveStarMedicThirdKit, installFiveStarMedicThird } from './content/arkpedia-five-star-medic-third.js';
import { customizeFiveStarDefenderKit, installFiveStarDefender } from './content/arkpedia-five-star-defenders.js';
import { customizeFiveStarDefenderSecondKit, installFiveStarDefenderSecond } from './content/arkpedia-five-star-defender-second.js';
import { customizeFiveStarGuardSixthKit, installFiveStarGuardSixth } from './content/arkpedia-five-star-guard-sixth.js';
import { customizeFiveStarSniperSecondKit, installFiveStarSniperSecond } from './content/arkpedia-five-star-sniper-second.js';
import { customizeFiveStarSniperThirdKit, installFiveStarSniperThird } from './content/arkpedia-five-star-sniper-third.js';
import { customizeFiveStarSniperKit, installFiveStarSniper, prepareFiveStarSniperSquad } from './content/arkpedia-five-star-snipers.js';
import { customizeFiveStarCasterOverloadKit, installFiveStarCasterOverload } from './content/arkpedia-five-star-caster-overload.js';
import { customizeFiveStarSupportThirdKit, installFiveStarSupportThird } from './content/arkpedia-five-star-support-third.js';
import { customizeFiveStarGuardFourthKit, installFiveStarGuardFourth } from './content/arkpedia-five-star-guard-fourth.js';
import { customizeCastersNextKit, installCastersNext } from './content/arkpedia-caster-next.js';
import { customizeDefenderThirdKit, installDefenderThird } from './content/arkpedia-defender-third.js';
import { customizeSixStarMedicKit, installSixStarMedic } from './content/arkpedia-six-star-medic.js';
import { customizeDefenderFourthKit, installDefenderFourth } from './content/arkpedia-defender-fourth.js';
import { customizeFiveStarMedicFourthKit, installFiveStarMedicFourth } from './content/arkpedia-five-star-medic-fourth.js';
import { customizeCasterSecondKit, installCasterSecond } from './content/arkpedia-caster-second.js';
import { customizeFiveStarVanguardThirdKit, installFiveStarVanguardThird } from './content/arkpedia-five-star-vanguard-third.js';
import { customizeGuardSixStarKit, installGuardSixStar, installGuardSixStarSquad } from './content/arkpedia-guard-six-star.js';
import { customizeFiveStarSniperFourthKit, installFiveStarSniperFourth } from './content/arkpedia-five-star-sniper-fourth.js';
import { customizeSniperSixStarKit, installSniperSixStar } from './content/arkpedia-sniper-six-star.js';
import { customizeSniperSixStarSecondKit, installSniperSixStarSecond } from './content/arkpedia-sniper-six-star-second.js';
import { customizeSupportAuraKit, installSupportAura } from './content/arkpedia-support-auras.js';
import { customizeGuardSixStarSecondKit, installGuardSixStarSecond } from './content/arkpedia-guard-six-star-second.js';
import { customizeElementalCasterKit, installElementalCaster } from './content/arkpedia-elemental-casters.js';
import { customizeBlessingExpansionKit, installBlessingExpansion } from './content/arkpedia-blessing-expansion.js';
import { customizeGuardSixStarThirdKit, installGuardSixStarThird } from './content/arkpedia-guard-six-star-third.js';
import { customizeCasterThirdKit, installCasterThird } from './content/arkpedia-caster-third.js';
import { customizeRitualistKit } from './content/arkpedia-ritualists.js';
import { customizeSupportControlKit, installSupportControl } from './content/arkpedia-support-control.js';
import { customizeLucillaKit, installLucilla } from './content/arkpedia-lucilla.js';
import { customizeHookExpansionKit, installHookExpansion } from './content/arkpedia-hook-expansion.js';
import { customizePhantomKit } from './content/arkpedia-phantom.js';
import { customizeThornsKit, installThorns } from './content/arkpedia-thorns.js';
import { customizeArchettoKit, installArchetto } from './content/arkpedia-archetto.js';
import { customizeGuardSixStarFourthKit, installGuardSixStarFourth } from './content/arkpedia-guard-six-star-fourth.js';
import { customizeFartoothKit, installFartooth } from './content/arkpedia-fartooth.js';
import { customizeSariaKit, installSaria } from './content/arkpedia-saria.js';
import { customizeBagpipeKit, installBagpipe, installBagpipeSquad } from './content/arkpedia-bagpipe.js';
import { customizeRosaKit, installRosa, prepareRosaSquad } from './content/arkpedia-rosa.js';
import { customizePuzzleKit, installPuzzle } from './content/arkpedia-puzzle.js';
import { customizeHoedererKit, installHoederer } from './content/arkpedia-hoederer.js';
import { customizeWKit, installW } from './content/arkpedia-w.js';
import { customizeMlynarKit, installMlynar } from './content/arkpedia-mlynar.js';
import { customizeSilenceParadigmaticKit, installSilenceParadigmatic } from './content/arkpedia-silence-paradigmatic.js';
import { customizeEyjaAlterKit, installEyjaAlter } from './content/arkpedia-eyja-alter.js';
import { customizeJieyunKit, installJieyun, adjustJieyunCost } from './content/arkpedia-jieyun.js';
import { customizeRadiantKnightKit, installRadiantKnight, installRadiantKnightSquad } from './content/arkpedia-radiant-knight.js';
import { customizeNianKit, installNian, prepareNianSquad } from './content/arkpedia-nian.js';
import { customizeKaltsitKit, installKaltsit } from './content/arkpedia-kaltsit.js';
import { customizeZuoleKit, installZuole } from './content/arkpedia-zuole.js';
import { customizeBobbingKit, installBobbing } from './content/arkpedia-bobbing.js';
import { customizeSceneKit, installScene } from './content/arkpedia-scene.js';
import { customizeSkadiAlterKit, installSkadiAlter } from './content/arkpedia-skadi-alter.js';
import { customizeInesKit, installInes, adjustInesCost } from './content/arkpedia-ines.js';
import { customizeReedAlterKit, installReedAlter } from './content/arkpedia-reed-alter.js';
import { customizePozemkaKit, installPozemka } from './content/arkpedia-pozemka.js';
import { customizeAmiyaGuardKit, installAmiyaGuard } from './content/arkpedia-amiya-guard.js';
import { customizeAmiyaMedicKit, installAmiyaMedic } from './content/arkpedia-amiya-medic.js';
import { customizeCivilightKit, installCivilight } from './content/arkpedia-civilight.js';
import { customizeDorothyKit, installDorothy } from './content/arkpedia-dorothy.js';
import { customizeVirtuosaKit, installVirtuosa } from './content/arkpedia-virtuosa.js';
import { customizeSandReckonerKit, installSandReckoner } from './content/arkpedia-sand-reckoner.js';
import { customizeChilchuckKit, installChilchuck } from './content/arkpedia-chilchuck.js';
import { customizeVigilKit, installVigil } from './content/arkpedia-vigil.js';
import { customizeRayKit, installRay } from './content/arkpedia-ray.js';
import { customizeColdshotKit, installColdshot } from './content/arkpedia-coldshot.js';
import { customizeNymphKit, installNymph } from './content/arkpedia-nymph.js';
import { customizeLemuenKit, installLemuen } from './content/arkpedia-lemuen.js';
import { customizePublicTragodiaKit, installPublicTragodia } from './content/arkpedia-tragodia-public.js';
import { customizePublicMon3trKit, installPublicMon3tr } from './content/arkpedia-mon3tr-public.js';
import { customizePublicAkkordKit, installPublicAkkord } from './content/arkpedia-akkord-public.js';
import { customizePublicWintimKit, installPublicWintim } from './content/arkpedia-wintim-public.js';
import { customizePublicJcintaKit, installPublicJcinta } from './content/arkpedia-jcinta-public.js';
import { assertClosurEnemyCompatibility } from '../../shared/arkpedia/closur-enemy-compatibility.js';
import { customizePublicClosurKit, installPublicClosur } from './content/arkpedia-closur-public.js';
import { installClosurRoster, CLOSUR_ROSTER_CONTRACT } from './content/arkpedia-closur-roster.js';
import { customizePublicVarkisKit, installPublicVarkis } from './content/arkpedia-varkis-public.js';
import { customizePublicSnhuntKit, installPublicSnhunt } from './content/arkpedia-snhunt-public.js';
import { customizePublicKichiKit, installPublicKichi } from './content/arkpedia-kichi-public.js';
import { customizePublicCairnKit, installPublicCairn } from './content/arkpedia-cairn-public.js';
import { customizePublicCrackborneKit, installPublicCrackborne } from './content/arkpedia-tanya-public.js';
import { customizePublicThumpyKit, installPublicThumpy } from './content/arkpedia-thumpy-public.js';
import { customizePublicTimeslotKit, installPublicTimeslot } from './content/arkpedia-tmslot-public.js';
import { customizePublicPedroKit, installPublicPedro } from './content/arkpedia-pedro-public.js';
import { customizePublicMechanistKit, installPublicMechanist } from './content/arkpedia-mcnist-public.js';
import { customizePublicGallusKit, installPublicGallus } from './content/arkpedia-gallus-public.js';
import { customizePublicKoromaruKit, installPublicKoromaru } from './content/arkpedia-koromaru-public.js';
import { customizePublicReconKit, installPublicRecon } from './content/arkpedia-recon-public.js';
import { customizePublicJuKit, installPublicJu } from './content/arkpedia-ju-public.js';
import { customizePublicTaraxaKit, installPublicTaraxa } from './content/arkpedia-taraxa-public.js';
import { customizePublicBotanyKit, installPublicBotany } from './content/arkpedia-botany-public.js';
import { customizePublicSkyboxKit, installPublicSkybox } from './content/arkpedia-skybox-public.js';
import { customizePublicAegisKit, installPublicAegis } from './content/arkpedia-aegis-public.js';
import { customizePublicYukariKit, installPublicYukari } from './content/arkpedia-yukari-public.js';
import {customizePublicAphrissaKit, installPublicAphrissa} from './content/arkpedia-aphrissa-public.js';
import { customizePublicMakotoKit, installPublicMakoto } from './content/arkpedia-makoto-public.js';
import { customizePublicHadiyaKit, installPublicHadiya } from './content/arkpedia-hadiya-public.js';
import { customizeAmorisKit, installAmoris } from './content/arkpedia-amoris.js';
import { customizeTmorisKit, installTmoris } from './content/arkpedia-tmoris.js';
import { customizeDolrisKit, installDolris } from './content/arkpedia-dolris.js';
import { customizeMortisKit, installMortis } from './content/arkpedia-mortis.js';
import { customizeOblvnsKit, installOblvns } from './content/arkpedia-oblvns.js';
import { customizeMakiriKit, installMakiri } from './content/arkpedia-makiri.js';
import { customizeFlwr2Kit, installFlwr2 } from './content/arkpedia-flwr2.js';
import { customizePublicTurdusKit, installPublicTurdus } from './content/arkpedia-turdus-public.js';
import { customizeHeadb2Kit, installHeadb2 } from './content/arkpedia-headb2.js';
import { customizeTitiKit, installTiti } from './content/arkpedia-titi.js';
import { customizeHalo2Kit, installHalo2 } from './content/arkpedia-halo2.js';
import { customizeCatap2Kit, installCatap2 } from './content/arkpedia-catap2.js';
import { customizeChen3Kit, installChen3 } from './content/arkpedia-chen3.js';
import { customizeHsgma2Kit, installHsgma2 } from './content/arkpedia-hsgma2.js';
import { customizeOrchd2Kit, installOrchd2 } from './content/arkpedia-orchd2.js';
import { customizeLeizi2Kit, installLeizi2 } from './content/arkpedia-leizi2.js';
import { customizeVeenKit, installVeen } from './content/arkpedia-veen.js';
import { customizeMantraKit, installMantra } from './content/arkpedia-mantra.js';
import { customizeHarukaKit, installHaruka } from './content/arkpedia-haruka.js';
import { customizeWangKit, installWang } from './content/arkpedia-wang.js';
import { customizeDemetrKit, installDemetr } from './content/arkpedia-demetr.js';
import { customizeSbell2Kit, installSbell2 } from './content/arkpedia-sbell2.js';
import { customizeAglna2Kit, installAglna2 } from './content/arkpedia-aglna2.js';
import { customizeRadianKit, installRadian } from './content/arkpedia-radian.js';
import { customizeKalts2Kit, installKalts2 } from './content/arkpedia-kalts2.js';
import { customizeSvash2Kit, installSvash2 } from './content/arkpedia-svash2.js';
import { customizeNastiKit, installNasti } from './content/arkpedia-nasti.js';
import { customizePublicBranchKit, installPublicBranch } from './content/arkpedia-branch-public.js';
import { customizePublicReckprKit, installPublicReckpr } from './content/arkpedia-reckpr-public.js';
import { customizePublicLieselKit, installPublicLiesel } from './content/arkpedia-liesel-public.js';
import { customizePublicNecrassKit, installPublicNecrass } from './content/arkpedia-necrass-public.js';
import { installPublicMuelsyseSquad, customizePublicMuelsyseKit, installPublicMuelsyse } from './content/arkpedia-muelsyse-public.js';
import { customizeMarcilKit, installMarcil, installMarcilSquad } from './content/arkpedia-marcil.js';
import { customizeRmixerKit, installRmixer } from './content/arkpedia-rmixer.js';
import { customizeNarantKit, installNarant } from './content/arkpedia-narant.js';
import { customizeElaKit, installEla } from './content/arkpedia-ela.js';
import { customizeFuzeKit, installFuze } from './content/arkpedia-fuze.js';
import { customizeRosmontisKit, installRosmontis } from './content/arkpedia-rosmontis.js';
import { customizeWisadelKit, installWisadel } from './content/arkpedia-wisadel.js';
import { customizeSwireAlterKit, installSwireAlter } from './content/arkpedia-swire-alter.js';
import { customizeBlacknightKit, installBlacknight } from './content/arkpedia-blacknight.js';
import { customizeChristineKit, installChristine } from './content/arkpedia-christine.js';
import { customizeExecutorReaperKit, installExecutorReaper } from './content/arkpedia-executor-reaper.js';
import { customizePhilaeKit, installPhilae } from './content/arkpedia-philae.js';
import { customizeWindflitKit, installWindflit } from './content/arkpedia-windflit.js';
import { customizeBlemishineKit, installBlemishine } from './content/arkpedia-blemishine.js';
import { customizeFlametailKit, installFlametail } from './content/arkpedia-flametail.js';
import { customizeTecnoKit, installTecno } from './content/arkpedia-tecno.js';
import { customizeTinmanKit, installTinman } from './content/arkpedia-tinman.js';
import { customizeSenshiKit, installSenshi } from './content/arkpedia-senshi.js';
import { customizeCatherineKit, installCatherine } from './content/arkpedia-catherine.js';
import { customizeAlannaKit, installAlanna } from './content/arkpedia-alanna.js';
import { customizeSaileachKit, installSaileach, adjustSaileachCost, consumeSaileachCard } from './content/arkpedia-saileach.js';
import { customizeSurtrKit, installSurtr } from './content/arkpedia-surtr.js';
import { customizeSpuriaKit, installSpuria } from './content/arkpedia-spuria.js';
import { customizeMayerKit, installMayer } from './content/arkpedia-mayer.js';
import { customizeFangFireSharpenedKit, installFangFireSharpened, adjustFangFireSharpenedCost,
  consumeFangFireSharpenedCard, fangFireSharpenedRefund } from './content/arkpedia-fang-fire-sharpened.js';
import { customizeSiegeKit, installSiege } from './content/arkpedia-siege.js';
import { customizeFirewatchKit, installFirewatch } from './content/arkpedia-firewatch.js';
import { customizeSurferKit, installSurfer } from './content/arkpedia-surfer.js';
import { customizeMelaniteKit, installMelanite } from './content/arkpedia-melanite.js';
import { customizeAshKit, installAsh, adjustAshCost } from './content/arkpedia-ash.js';
import { adjustMuelsyseSquadCost } from './content/arkpedia-muelsyse-squad.js';
import { customizeChenKit, installChen } from './content/arkpedia-chen.js';
import { customizeVulpisKit, installVulpis } from './content/arkpedia-vulpis.js';
import { customizeSagaKit, installSaga } from './content/arkpedia-saga.js';
import { customizeEunectesKit, installEunectes } from './content/arkpedia-eunectes.js';
import { customizeBenaKit, installBena } from './content/arkpedia-bena.js';
import { customizeKazemaruKit, installKazemaru } from './content/arkpedia-kazemaru.js';
import { customizeAakKit, installAak } from './content/arkpedia-aak.js';
import { customizeFrostKit, installFrost } from './content/arkpedia-frost.js';
import { customizeRobinKit, installRobin } from './content/arkpedia-robin.js';
import { customizeWulfeniteKit, installWulfenite } from './content/arkpedia-wulfenite.js';
import { customizeTippiKit, installTippi } from './content/arkpedia-tippi.js';
import { customizeLessingKit, installLessing } from './content/arkpedia-lessing.js';
import { customizePenanceKit, installPenance } from './content/arkpedia-penance.js';
import { customizeMudrockKit, installMudrock } from './content/arkpedia-mudrock.js';
import { customizeBlazeKit, installBlaze } from './content/arkpedia-blaze.js';
import { customizeGavialInvincibleKit, installGavialInvincible } from './content/arkpedia-gavial-invincible.js';
import { customizeFiammettaKit, installFiammetta } from './content/arkpedia-fiammetta.js';
import { customizeHornKit, installHorn } from './content/arkpedia-horn.js';
import { customizeTyphonKit, installTyphon } from './content/arkpedia-typhon.js';
import { customizeDegenbrecherKit, installDegenbrecher } from './content/arkpedia-degenbrecher.js';
import { customizeChongyueKit, installChongyue } from './content/arkpedia-chongyue.js';
import { customizePepeKit, installPepe } from './content/arkpedia-pepe.js';
import { customizeCrownslayerKit, installCrownslayer } from './content/arkpedia-crownslayer.js';
import { customizeIanaKit, installIana } from './content/arkpedia-iana.js';
import { customizeBrigidKit, installBrigid } from './content/arkpedia-brigid.js';
import { customizeEbenholzKit, installEbenholz } from './content/arkpedia-ebenholz.js';
import { customizeLinKit, installLin } from './content/arkpedia-lin.js';
import { customizeUlpianusKit, installUlpianus } from './content/arkpedia-ulpianus.js';
import { customizeWeedyKit, installWeedy } from './content/arkpedia-weedy.js';
import { customizeVinaKit, installVina } from './content/arkpedia-vina.js';
import { customizeJessicaKit, installJessica } from './content/arkpedia-jessica.js';
import { customizeEntelechiaKit, installEntelechia } from './content/arkpedia-entelechia.js';
import { customizeHoolheyakKit, installHoolheyak } from './content/arkpedia-hoolheyak.js';
import { customizeGoldenglowKit, installGoldenglow } from './content/arkpedia-goldenglow.js';
import { customizeLapplandKit, installLappland, installLapplandSquad } from './content/arkpedia-lappland-alter.js';
import { captureThornsRoads, THORNS_LODESTAR_ID, customizeThornsLodestarKit, installThornsLodestar } from './content/arkpedia-thorns-lodestar.js';
import { customizeBlazeIgnitingKit, installBlazeIgniting } from './content/arkpedia-blaze-igniting.js';
import { customizeExusiaiCovenantKit, installExusiaiCovenant } from './content/arkpedia-exusiai-covenant.js';
import { customizeMagallanKit, installMagallan } from './content/arkpedia-magallan-skills.js';
import { customizeLingKit, installLing } from './content/arkpedia-ling-skills.js';
import { customizeShuKit, installShu } from './content/arkpedia-shu-skills.js';
import { customizeYuKit, installYu } from './content/arkpedia-yu-skills.js';
import { customizeStainlessKit, installStainless } from './content/arkpedia-stainless-skills.js';
import { customizeMitmKit, installMitm } from './content/arkpedia-mitm-skills.js';
import { installShuRoster } from './content/arkpedia-shu.js';
import { customizeLeeKit, installLee } from './content/arkpedia-lee.js';
import { customizeYatoAlterKit, installYatoAlter } from './content/arkpedia-yato-alter.js';
import { customizeSpecterAlterKit, installSpecterAlter, prepareSpecterAlterSquad } from './content/arkpedia-specter-alter.js';
import { customizeAscalonKit, installAscalon } from './content/arkpedia-ascalon.js';
import { customizeGladiiaKit, installGladiia } from './content/arkpedia-gladiia.js';
import { customizeChenAlterKit, installChenAlter } from './content/arkpedia-chen-alter.js';
import { customizeIreneKit, installIrene } from './content/arkpedia-irene.js';
import { customizeTexasAlterKit, installTexasAlter } from './content/arkpedia-texas-alter.js';
import { customizeGnosisKit, installGnosis } from './content/arkpedia-gnosis.js';
import { customizeEyjafjallaKit, installEyjafjalla } from './content/arkpedia-eyjafjalla.js';
import { customizeFiveStarSupportFourthKit, installFiveStarSupportFourth } from './content/arkpedia-five-star-support-fourth.js';
import { customizeFiveStarSpecialistExpansionKit, installFiveStarSpecialistExpansion } from './content/arkpedia-five-star-specialist-expansion.js';
import { catalogueFor, recordFor, fixedSquadBuilds } from "../../shared/arkpedia/loadout.js";
import { REGULAR_OPERATORS } from "../../shared/arkpedia/operators.js";
import { assertRegularEnemies } from "../../shared/arkpedia/enemies.js";
import { installEnemyFeatures } from "./content/arkpedia-enemy-features.js";
import { installChapter17Devices } from './content/chapter17.js';
import { STAGE_DEVICES, STAGE_TOKEN_UNITS, pulseTiles, artilleryTiles } from "../../shared/arkpedia/stage-devices.js";
import { compileBuffTemplate } from "../../shared/arkpedia/behavior.js";
import {
  prepareSquad,
  canDeployInViewport,
} from "../../shared/arkpedia/squad.js";

export function stageAdapter(source) {
  const devices = (source.devices ?? []).filter(d => d.kind === 'device' && !String(d.key).startsWith('char_'));
  const unsupported = devices.filter(d => !STAGE_DEVICES[d.name]);
  if (unsupported.length) throw new Error(`Unsupported stage devices: ${[...new Set(unsupported.map(d => d.name))].join(', ')}`);
  const g = source.geometry;
  const supplied = Array.isArray(g.suppliedUnits) ? g.suppliedUnits.length
    : (g.suppliedUnits?.fixed_squad?.length || 0) + (g.suppliedUnits?.deployable_tokens?.length || 0);
  const tokenCards = Array.isArray(g.suppliedUnits) ? [] : (g.suppliedUnits?.deployable_tokens ?? []).filter(t => t.count !== 0);
  const unsupportedTokens = tokenCards.filter(t => !STAGE_TOKEN_UNITS[t.unit_id]);
  if (unsupportedTokens.length) throw new Error(`Unsupported stage tokens: ${[...new Set(unsupportedTokens.map(t => t.unit_id))].join(', ')}`);
  if (g.rows > 19 || g.cols > 21 || (g.hasConditionalSpawns && !source.conditionalHandled))
    throw new Error("Unsupported stage mechanics");
  const baseChars = ["#", "h", "r", "S", "E"];
  const chars = g.tileLegend.map((_, i) => baseChars[i] ?? String.fromCharCode(65 + i - baseChars.length));
  const legend = Object.fromEntries(
    g.tileLegend.map((t, i) => [
      chars[i],
      {
        height: t.height.toUpperCase(),
        build: t.deployable.toUpperCase(),
        pass: t.walkable ? "ALL" : t.flyable ? "FLY" : "NONE",
        key: t.key,
      },
    ]),
  );
  const pair = (p) => [p.row, p.col];
  const pollution = [];
  g.tileGrid.forEach((row, r) => row.forEach((type, c) => {
    if (String(g.tileLegend[type]?.key ?? '').includes('toxic')) pollution.push([r, c]);
  }));
  // A route no wave spawns on never has to walk, so a viewer export may omit it. Only refuse a missing path
  // for a route the stage actually uses.
  const usedRoutes = new Set(g.waves.flatMap(wave => (wave.spawns || []).map(spawn => spawn.route)));
  const routes = g.routes.map((route, index) => {
    if (!route || route.placeholder)
      return { start: [0, 0], end: [0, 0], checkpoints: [] };
    const path = source.pathing?.paths?.[index];
    if (!path && !usedRoutes.has(index))
      return { motion: route.motion, start: pair(route.start), end: pair(route.end), checkpoints: [] };
    if (path) {
      // A viewer break is a tunnel: disappear at the entrance point, wait the reviewed tunnel hold, then
      // appear at the first point after the break. The engine's DISAPPEAR/APPEAR legs already hide and teleport.
      const tunnels = new Map(), appears = (route.checkpoints ?? []).filter((c) => c.type === "appear_at_pos");
      for (const at of path.breaks) {
        const hold = path.holds.find((h) => h.tunnel && h.at === path.distances[at - 1]);
        if (hold) { tunnels.set(at, hold); continue; }
        // A viewer break with no tunnel hold is a teleport (`appear_at_pos`): keep it only when the level
        // geometry names that exact appear point, then use a zero-second DISAPPEAR/WAIT/APPEAR pair.
        const [col, row] = path.points[at] ?? [];
        if (!appears.some((c) => c.position.row === row && c.position.col === col)) throw new Error("Unsupported route tunnel");
        tunnels.set(at, { seconds: 0, synthetic: true });
      }
      for (const hold of path.holds.filter((h) => h.tunnel)) {
        const at = path.distances.findIndex((distance) => distance === hold.at) + 1;
        if (!tunnels.has(at)) throw new Error("Unsupported route tunnel");
      }
      const checkpoints = [];
      path.points.forEach(([col, row], at) => {
        if (at > 0) checkpoints.push(tunnels.has(at) ? { type: "APPEAR", pos: [row, col] } : { type: "MOVE", pos: [row, col] });
        for (const hold of path.holds.filter(
          (h) => h.at === path.distances[at] && !h.tunnel,
        ))
          checkpoints.push({
            type: "WAIT",
            pos: [row, col],
            time: hold.seconds,
          });
        const nextTunnel = tunnels.get(at + 1);
        if (nextTunnel) {
          checkpoints.push({ type: "DISAPPEAR" });
          checkpoints.push({ type: "WAIT", pos: [row, col], time: nextTunnel.seconds });
        }
      });
      return {
        motion: route.motion,
        start: pair(route.start),
        end: pair(route.end),
        checkpoints,
      };
    }
    throw new Error("Missing stage viewer path for route " + index);
  });
  // Waves run in sequence: a wave's pre_delay is measured from the END of the previous wave, and
  // each spawn's time is measured from the start of its own wave (Arkpedia stage playback).
  let cursor = 0;
  const spawns = g.waves.flatMap((wave) => {
    const waveStart = cursor + (wave.pre_delay || 0);
    const out = (wave.spawns || []).flatMap((s) =>
      Array.from({ length: Math.max(1, s.count || 1) }, (_, i) => ({
        enemyKey: s.enemy_id,
        time: waveStart + (s.time || 0) + i * (s.interval || 0),
        routeIndex: s.route,
        ownerPlayerId: "arkpedia",
      })),
    );
    cursor = waveStart + (wave.duration || 0) + (wave.post_delay || 0);
    return out;
  }).sort((a, b) => a.time - b.time);
  return {
    fixedSquad: supplied ? g.suppliedUnits.fixed_squad : null,
    stage: {
      id: source.code,
      tokens: source.tokens ?? [],
      rows: g.tileGrid.map((row) => row.map((t) => chars[t]).join("")),
      legend,
    },
    rect: { r0: 0, r1: g.rows - 1, c0: 0, c1: g.cols - 1 },
    routes,
    spawns,
  };
}

export class StandardBattle extends Battle {
  constructor(data, selection, { seed = 1 } = {}) {
    if (data.stage?.operators) data = { ...data, operators: { ...data.operators, ...data.stage.operators } };
    assertRegularEnemies(data);
    const fixed = fixedSquadBuilds(data);
    const squad = fixed ? null : prepareSquad(selection, catalogueFor(data));
    const builds = fixed ?? [
      ...squad.operators,
      ...(squad.support ? [squad.support] : []),
    ];
    if (builds.some(b => b.id === 'char_4228_closur' && b.skillId === 'skchr_closur_3'))
      assertClosurEnemyCompatibility(data);
    const chess = Object.fromEntries(
      builds.map((b) => [b.id, recordFor(b, data)]),
    );
    // Compile and validate before the battle starts or any DP/SP is spent.
    const behaviors = new Map();
    for (const build of builds) {
      const support = REGULAR_OPERATORS[build.id];
      if (!support.templateKey) continue;
      const level = data.operators[build.id].skills.find(skill => skill.id === build.skillId)?.levels[build.skillRank - 1];
      if (level.prefabId !== support.prefabId)
        throw Error(`Unsupported regular-stage skill prefab: ${level.prefabId}`);
      const program = compileBuffTemplate(data.behaviors?.templates?.[support.templateKey]);
      if (program.key !== support.templateKey) throw Error('Behaviour template key mismatch');
      program.validateBlackboard(chess[build.id].skill.bb);
      behaviors.set(build.id, program);
    }
    const startingVanguardDp = prepareFiveStarVanguardSquad(chess);
    prepareFiveStarSniperSquad(chess);
    prepareRosaSquad(chess);
    prepareNianSquad(chess);
    prepareSpecterAlterSquad(chess);
    const config = data.stage.battle;
    super({
      ...stageAdapter(data.stage),
      seed,
      data: new DataSource({ chess, enemies: data.enemies, tokens: data.tokens }),
      content: "none",
      timeLimit: 300,
      flags: {
        layerGainsEnabled: false,
        dpInit: config.initial_dp,
        dpMax: config.max_dp,
        dpPerSec: config.dp_per_second,
        startOpCooldown: 0,
        moveScale: data.stage.pathing?.moveScale ?? 0.65,
      },
      players: [
        { playerId: "arkpedia", side: "L", coords: "field", units: [] },
      ],
    });
    this.regularReviewCandidates = Object.freeze([...(data.reviewCandidates ?? [])]);
    this.life = config.max_life;
    this.regularModels = data.sd?.models ?? {};
    // Source team membership (e.g. Ursus Student Self-Governing Group) for team-scoped effects.
    this.regularTeams = Object.freeze(Object.fromEntries(Object.values(data.operators ?? {}).map(o => [o.id, o.teamId ?? null])));
    this.regularNations = Object.freeze(Object.fromEntries(Object.values(data.operators ?? {}).map(o => [o.id, o.nationId ?? null])));
    this.regularSkillUses = new Map();
    // Approved enemy feature traits (shared/arkpedia/enemy-features.js) apply at spawn.
    installEnemyFeatures(this);
    this.addDp('arkpedia', startingVanguardDp);
    installMedicSquad({ battle: this, records: chess });
    installGuardSixStarSquad({ battle: this, records: chess });
    installBagpipeSquad({ battle: this, records: chess });
    installRadiantKnightSquad({ battle: this, records: chess });
    installLapplandSquad({ battle: this, records: chess });
    // The road talent scans initial terrain even when Thorns deploys much later.
    if (chess[THORNS_LODESTAR_ID]) captureThornsRoads(this);
    this.behaviors = behaviors;
    this.mvpStageDevices = (data.stage.devices ?? [])
      .filter(d => d.kind === 'device' && STAGE_DEVICES[d.name])
      .map(d => ({ ...d, sp: 0, acc: 0 }));
    const pollution = [];
    data.stage.geometry.tileGrid.forEach((row, r) => row.forEach((type, c) => {
      if (String(data.stage.geometry.tileLegend[type]?.key ?? '').includes('toxic')) pollution.push([r, c]);
    }));
    this.mvpStagePollution = new Set(pollution.map(([r, c]) => `${r},${c}`));
    this.mvpStageTokens = new Map((data.stage.tokens ?? []).map(t => [t.unitId, t.count]));
    if (this.mvpStageDevices.length) this.on('tick', ({ dt }) => this._tickMvpStageDevices(dt));
    this._installUnitStageDevices(data.stage.devices ?? []);
    installChapter17Devices(this, data.stage.devices ?? []);
    this._installPillarController();
    this._installHighTide(data.stage.tide);
    this._installDeepWater(data.stage.deepWater);
    this.unitLimit = config.unit_limit;
    this.regularMapSize = Object.freeze({ rows: data.stage.geometry.rows, cols: data.stage.geometry.cols });
    this.mapTags = Object.freeze([...(data.stage.mapTags ?? [])]);
    this.viewport = "preview";
    this.bench = Object.fromEntries(
      builds.map((b) => [
        b.id,
        { build: b, unit: null, deployments: 0, readyAt: 0, lastCost: 0 },
      ]),
    );
    const closurBuilds = builds.filter(build => build.id === 'char_4228_closur');
    if (closurBuilds.length) installClosurRoster(this, closurBuilds, { contract: CLOSUR_ROSTER_CONTRACT });
    installShuRoster({ battle: this, records: chess });
    installMarcilSquad(this);
    installPublicMuelsyseSquad(this);
    this.start();
  }
  setViewport(viewport) {
    this.viewport = viewport;
  }
  get dp() {
    return this.getPlayer("arkpedia").dp;
  }
  dpMinimumFor(ownerId = 'arkpedia') { return regularDpMinimum(this, ownerId); }
  dpRecoveryForStep(ownerId, dt) { return regularDpRecoveryForStep(this, ownerId, dt); }
  isUnitInBornState(unit) {
    if (!unit?.alive || !unit.deployed) return false;
    // Selected native controllers may advertise a more specific FSM endpoint.
    // Otherwise follow the same reviewed deployment clip shown by the viewer.
    // This source-backed visual observer does not claim compiled Unity BORN parity.
    const explicit = unit.mem.regularBornUntil;
    if (Number.isFinite(explicit)) return this.time + 1e-9 < explicit;
    const model = this.regularModels?.[regularModelKey(unit)], clip = model?.animationRoles?.deploy;
    const duration = model?.animations?.[clip];
    return Number.isFinite(duration) && duration > 0 && this.time + 1e-9 < unit.deployedAt + duration;
  }
  dpRecoveryRateFor(ownerId = 'arkpedia') {
    if ((this.flags.dpRegenHaltUntil ?? 0) > this.time) return 0;
    const scale = this.allyUnits.filter(u => u.ownerId === ownerId && u.alive && u.deployed && !u.hidden)
      .reduce((n, u) => n * (u.mem.regularDpRegenScale ?? 1), 1);
    return this.flags.dpPerSec * scale;
  }
  deployedSlots() {
    return this.allyUnits.filter(unit => unit.alive && unit.deployed)
      .reduce((slots, unit) => slots + (unit.deploymentSlotCost ?? 1), 0);
  }
  deploymentSlotCost(id) {
    if (id === 'char_4087_ines' && this.bench[id]?.build.skillId === 'skchr_ines_3'
      && !this.inesState?.firstUsed) return 0;
    const config = REGULAR_OPERATORS[id];
    if (config?.deploymentSlotExemptSkillIds?.includes(this.bench[id]?.build.skillId)) return 0;
    return (this.bench[id]?.build.elite ?? 0) >= (config?.deploymentSlotExemptMinElite ?? 0)
      && config?.deploymentSlotExemptTags?.some(tag => this.mapTags.includes(tag))
      ? 0 : config?.deploymentSlotCost ?? 1;
  }
  cost(id) {
    const entry = this.bench[id];
    if (!entry) return Infinity;
    // An owner may swap a card's base cost until its next deployment (SilverAsh the Reignfrost's S3).
    const ordinary = Math.floor((entry.baseCost ?? this.data.getChess(id).stats.cost)
      // An owner may keep its redeployment cost unchanged (Violet Mizutsune Orchid).
      * Math.min(2, 1 + (entry.noCostIncrease ? 0 : entry.deployments) * 0.5));
    const vanguard = adjustFiveStarVanguardSecondCost(this, id, ordinary);
    const discounted = adjustInesCost(this, id, adjustAshCost(this, id, adjustFangFireSharpenedCost(this, id, adjustSaileachCost(this, id, adjustJieyunCost(this, id, vanguard)))));
    // Content card discounts (e.g. Matsukiri): a per-card delta kept until that operator deploys.
    return Math.max(0, adjustMuelsyseSquadCost(this, id, discounted) + (entry.costDelta ?? 0));
  }
  placementError(id, row, col) {
    return this._placementError(id, row, col);
  }
  _placementError(id, row, col, { fromSkill = false } = {}) {
    const entry = this.bench[id];
    if (!fromSkill && !canDeployInViewport(this.viewport))
      return "Open the fullscreen workspace to deploy.";
    if (this.finished) return "Battle has ended.";
    if (!entry || entry.unit?.alive) return "Operator is unavailable.";
    if (!fromSkill && entry.readyAt > this.time) return "Operator is still redeploying.";
    if (this.deployedSlots() + this.deploymentSlotCost(id) > this.unitLimit)
      return "Deployment limit reached.";
    if (
      !Number.isInteger(row) ||
      !Number.isInteger(col) ||
      row < this.rect.r0 ||
      row > this.rect.r1 ||
      col < this.rect.c0 ||
      col > this.rect.c1
    )
      return "Select a tile on the map.";
    // An owner may give a tile another build type (Nasti's platform becomes a ranged tile).
    const tile = { ...this.grid.tile(row, col), ...(this.regularTileBuild?.(row, col) ? { build: this.regularTileBuild(row, col) } : {}), ...(this.platformTiles?.has(`${row},${col}`) ? { build: 'ALL' } : {}) },
      position = this.data.getChess(id).position;
    const rangedTrait = REGULAR_OPERATORS[id]?.deployOnRanged && tile.build === 'RANGED';
    // An owner may admit another build type on specific tiles (Violet Mizutsune Orchid's talent).
    const ownerTile = this.regularPlacementAllow?.[id]?.(row, col, tile) === true;
    if (tile.build !== "ALL" && tile.build !== position && !rangedTrait && !ownerTile)
      return position === "RANGED"
        ? "Choose a ranged tile."
        : "Choose a melee tile.";
    // An owner may restrict a card to specific tiles (Kal'tsit·Esperanta's S3 transported allies).
    const ownerDeny = this.regularPlacementDeny?.[id]?.(row, col, tile);
    if (ownerDeny) return ownerDeny;
    if (
      this.allyUnits.some((u) => u.alive && u.tileR === row && u.tileC === col
        && !(u.mem?.regularHost?.accepts?.({ defId: id, def: this.data.getChess(id), kind: 'op' }) === true))
    )
      return "Tile is occupied.";
    if (this.tileReservation(row, col)) return "Tile is reserved for an operator's return.";
    if (this.noDeployTiles?.has(`${row},${col}`)) return "Tile is unavailable for deployment.";
    if (!fromSkill && !canSpendDp(this, 'arkpedia', this.cost(id))) return "Not enough DP.";
    return null;
  }
  deployOperator(id, row, col, dir) {
    const unit = this._deployOperator(id, row, col, dir);
    if (unit && this.bench[id]) { this.bench[id].costDelta = 0; delete this.bench[id].baseCost; }
    return unit;
  }
  deployToken(unitId, row, col) {
    const found = (this.stage.tokens ?? this.stage.raw?.tokens ?? []).find(t => t.unitId === unitId);
    if (!found) throw new Error('This stage has no such token.');
    const token = { ...(STAGE_TOKEN_UNITS[unitId] ?? {}), ...found };
    if ((this.mvpStageTokens.get(unitId) ?? 0) <= 0) throw new Error('No tokens remaining.');
    if (!this.grid.inRect(row, col) || (!this.grid.groundPassable(row, col, true)
      && !(token.water && /water|deep/.test(String(this.grid.tile(row, col)?.key ?? ''))))) throw new Error('Token must be placed on the ground or water.');
    if (this._occ[row * this.grid.cols + col]?.alive) throw new Error('Tile is occupied.');
    if (!canSpendDp(this, 'arkpedia', token.cost)) throw new Error('Not enough DP.');
    const unit = this.spawnDevice(`token:${unitId}`, row, col, { hp: token.hp, def: 0, blockCnt: token.block,
      obstacle: true, obstacleKind: token.obstacle, name: token.name });
    if (!unit) throw new Error('Token cannot be placed here.');
    if (token.platform) { unit.mem.regularHost = { accepts: () => true }; this.platformTiles ??= new Set(); this.platformTiles.add(`${row},${col}`); }
    if (token.behavior === 'barrier') {
      for (const ally of [unit, ...this.units.filter(u => u.side === 'ally' && u.alive && u.deployed && u !== unit && Math.max(Math.abs(u.tileR - row), Math.abs(u.tileC - col)) <= 1)])
        this.addBuff(ally, { key: 'ab:allerdale-barrier', source: unit, visible: true, shield: 1000 });
    }
    spendDp(this, 'arkpedia', token.cost);
    this.mvpStageTokens.set(unitId, (this.mvpStageTokens.get(unitId) ?? 1) - 1);
    return unit;
  }
  // Engine-owned delivery: reuse selected builds, kits and deployment hooks;
  // bypass card cooldown/payment, but retain tile and unit-limit validation.
  redeployOperatorFromSkill(id, row, col, dir) {
    return this._deployOperator(id, row, col, dir, { fromSkill: true });
  }
  _deployOperator(id, row, col, dir, { fromSkill = false } = {}) {
    const error = this._placementError(id, row, col, { fromSkill });
    if (error) throw new Error(error);
    if (!["UP", "DOWN", "LEFT", "RIGHT"].includes(dir))
      throw new Error("Choose a facing direction.");
    const entry = this.bench[id],
      def = this.data.getChess(id),
      ps = this.getPlayer("arkpedia");
    const unit = this._makeAlly(ps, def, "op", row, col, { dir });
    unit.deploymentSlotCost = this.deploymentSlotCost(id);
    const kit = genericKit(def.skill?.bb ?? {}, def.raw, def);
    customizeMedicKit({ battle: this, id, def, unit, kit });
    customizeCasterKit({ id, def, unit, kit });
    customizeGuardKit({ id, def, unit, kit });
    customizeSniperKit({ id, def, unit, kit });
    customizeVanguardKit({ id, def, unit, kit });
    customizeDefenderKit({ id, def, unit, kit });
    customizeAdvancedSniperKit({ id, def, unit, kit });
    customizeSupportKit({ id, def, unit, kit });
    customizeSpecialistKit({ id, def, unit, kit });
    customizeUtilityKit({ battle: this, id, def, unit, kit });
    customizeGuardExpansionKit({ battle: this, id, def, unit, kit });
    customizeSupportExpansionKit({ battle: this, id, def, unit, kit });
    customizeCasterExpansionKit({ battle: this, id, def, unit, kit });
    customizeSniperExpansionKit({ battle: this, id, def, unit, kit });
    customizeSummonerKit({ battle: this, id, def, unit, kit });
    customizeRobotExpansionKit({ battle: this, id, def, unit, kit });
    customizeFiveStarGuardKit({ battle: this, id, def, unit, kit });
    customizeFiveStarCasterKit({ battle: this, id, def, unit, kit });
    customizeFiveStarVanguardKit({ battle: this, id, def, unit, kit });
    customizeFiveStarVanguardSecondKit({ battle: this, id, def, unit, kit });
    customizeFiveStarSupportKit({ battle: this, id, def, unit, kit });
    customizeFiveStarGuardExpansionKit({ battle: this, id, def, unit, kit });
    customizeFiveStarCasterExpansionKit({ battle: this, id, def, unit, kit });
    customizeFiveStarSupportExpansionKit({ battle: this, id, def, unit, kit });
    customizeFiveStarGuardThirdKit({ battle: this, id, def, unit, kit });
    customizeFiveStarSniperKit({ battle: this, id, def, unit, kit });
    customizeFiveStarCasterUtilityKit({ battle: this, id, def, unit, kit });
    customizeFiveStarGuardFifthKit({ battle: this, id, def, unit, kit });
    customizeFiveStarMedicKit({ battle: this, id, def, unit, kit });
    customizeFiveStarMedicSecondKit({ battle: this, id, def, unit, kit });
    customizeFiveStarMedicThirdKit({ battle: this, id, def, unit, kit });
    customizeFiveStarDefenderKit({ battle: this, id, def, unit, kit });
    customizeFiveStarDefenderSecondKit({ battle: this, id, def, unit, kit });
    customizeFiveStarGuardSixthKit({ battle: this, id, def, unit, kit });
    customizeFiveStarSniperSecondKit({ battle: this, id, def, unit, kit });
    customizeFiveStarSniperThirdKit({ battle: this, id, def, unit, kit });
    customizeCastersNextKit({ battle: this, id, def, unit, kit });
    customizeDefenderThirdKit({ battle: this, id, def, unit, kit });
    customizeSixStarMedicKit({ battle: this, id, def, unit, kit });
    customizeDefenderFourthKit({ battle: this, id, def, unit, kit });
    customizeFiveStarMedicFourthKit({ battle: this, id, def, unit, kit });
    customizeCasterSecondKit({ battle: this, id, def, unit, kit });
    customizeFiveStarVanguardThirdKit({ battle: this, id, def, unit, kit });
    customizeGuardSixStarKit({ battle: this, id, def, unit, kit });
    customizeFiveStarSniperFourthKit({ battle: this, id, def, unit, kit });
    customizeSniperSixStarKit({ battle: this, id, def, unit, kit });
    customizeSniperSixStarSecondKit({ battle: this, id, def, unit, kit });
    customizeSupportAuraKit({ battle: this, id, def, unit, kit });
    customizeGuardSixStarSecondKit({ battle: this, id, def, unit, kit });
    customizeElementalCasterKit({ battle: this, id, def, unit, kit });
    customizeBlessingExpansionKit({ battle: this, id, def, unit, kit });
    customizeGuardSixStarThirdKit({ battle: this, id, def, unit, kit });
    customizeCasterThirdKit({ battle: this, id, def, unit, kit });
    customizeRitualistKit({ battle: this, id, def, unit, kit });
    customizeSupportControlKit({ battle: this, id, def, unit, kit });
    customizeLucillaKit({ battle: this, id, def, unit, kit });
    customizeThornsKit({ battle: this, id, def, unit, kit });
    customizeArchettoKit({ battle: this, id, def, unit, kit });
    customizeGuardSixStarFourthKit({ battle: this, id, def, unit, kit });
    customizeFartoothKit({ battle: this, id, def, unit, kit });
    customizeSariaKit({ battle: this, id, def, unit, kit });
    customizeBagpipeKit({ battle: this, id, def, unit, kit });
    customizeRosaKit({ battle: this, id, def, unit, kit });
    customizePuzzleKit({ battle: this, id, def, unit, kit });
    customizeHoedererKit({ battle: this, id, def, unit, kit });
    customizeWKit({ battle: this, id, def, unit, kit });
    customizeMlynarKit({ battle: this, id, def, unit, kit });
    customizeSilenceParadigmaticKit({ battle: this, id, def, unit, kit });
    customizeEyjaAlterKit({ battle: this, id, def, unit, kit });
    customizeJieyunKit({ battle: this, id, def, unit, kit });
    customizeRadiantKnightKit({ battle: this, id, def, unit, kit });
    customizeNianKit({ battle: this, id, def, unit, kit });
    customizeKaltsitKit({ battle: this, id, def, unit, kit });
    customizeZuoleKit({ battle: this, id, def, unit, kit });
    customizeBobbingKit({ battle: this, id, def, unit, kit });
    customizeSceneKit({ battle: this, id, def, unit, kit });
    customizeSandReckonerKit({ battle: this, id, def, unit, kit });
    customizeVirtuosaKit({ battle: this, id, def, unit, kit });
    customizeDorothyKit({ battle: this, id, def, unit, kit });
    customizeSkadiAlterKit({ battle: this, id, def, unit, kit });
    customizeInesKit({ battle: this, id, def, unit, kit });
    customizeCivilightKit({ battle: this, id, def, unit, kit });
    customizeReedAlterKit({ battle: this, id, def, unit, kit });
    customizePozemkaKit({ battle: this, id, def, unit, kit });
    customizeAmiyaGuardKit({ battle: this, id, def, unit, kit });
    customizeAmiyaMedicKit({ battle: this, id, def, unit, kit });
    customizeChilchuckKit({ battle: this, id, def, unit, kit });
    customizeBlacknightKit({ battle: this, id, def, unit, kit });
    customizeVigilKit({ battle: this, id, def, unit, kit });
    customizeRayKit({ battle: this, id, def, unit, kit });
    customizeColdshotKit({ battle: this, id, def, unit, kit });
    customizeNymphKit({ battle: this, id, def, unit, kit });
    customizeLemuenKit({ battle: this, id, def, unit, kit });
    customizeRmixerKit({ battle: this, id, def, unit, kit });
    customizeMarcilKit({ battle: this, id, unit, kit });
    customizePublicMuelsyseKit({ battle: this, id, unit, kit });
    customizePublicNecrassKit({ battle: this, id, unit, kit });
    customizePublicTragodiaKit({ battle: this, id, unit, kit });
    customizePublicMon3trKit({ battle: this, id, unit, kit });
    customizePublicAkkordKit({ battle: this, id, unit, kit });
    customizePublicWintimKit({ battle: this, id, unit, kit });
    customizePublicJcintaKit({ battle: this, id, unit, kit });
    customizePublicLieselKit({ battle: this, id, unit, kit });
    customizePublicClosurKit({ battle: this, id, unit, kit });
    customizePublicReckprKit({ battle: this, id, unit, kit });
    customizePublicVarkisKit({ battle: this, id, unit, kit });
    customizePublicSnhuntKit({ battle: this, id, unit, kit });
    customizePublicKichiKit({ battle: this, id, unit, kit });
    customizePublicCairnKit({ battle: this, id, unit, kit });
    customizePublicCrackborneKit({ battle: this, id, unit, kit });
    customizePublicThumpyKit({ battle: this, id, unit, kit });
    customizePublicTimeslotKit({ battle: this, id, unit, kit });
    customizePublicPedroKit({ battle: this, id, unit, kit });
    customizePublicMechanistKit({ battle: this, id, unit, kit });
    customizePublicGallusKit({ battle: this, id, unit, kit });
    customizePublicKoromaruKit({ battle: this, id, unit, kit });
    customizePublicReconKit({ battle: this, id, unit, kit });
    customizePublicTurdusKit({ battle: this, id, unit, kit });
    customizePublicJuKit({ battle: this, id, unit, kit });
    customizePublicTaraxaKit({ battle: this, id, unit, kit });
    customizePublicBotanyKit({ battle: this, id, unit, kit });
    customizePublicSkyboxKit({ battle: this, id, unit, kit });
    customizePublicAegisKit({ battle: this, id, unit, kit });
    customizePublicYukariKit({ battle: this, id, unit, kit });
    customizePublicMakotoKit({ battle: this, id, unit, kit });
    customizePublicAphrissaKit({battle: this, id, unit, kit});
    customizePublicHadiyaKit({ battle: this, id, unit, kit });
    customizeAmorisKit({ battle: this, id, unit, kit });
    customizeTmorisKit({ battle: this, id, unit, kit });
    customizeDolrisKit({ battle: this, id, unit, kit });
    customizeMortisKit({ battle: this, id, unit, kit });
    customizeOblvnsKit({ battle: this, id, unit, kit });
    customizeMakiriKit({ battle: this, id, unit, kit });
    customizeFlwr2Kit({ battle: this, id, unit, kit });
    customizeHeadb2Kit({ battle: this, id, unit, kit });
    customizeTitiKit({ battle: this, id, unit, kit });
    customizeHalo2Kit({ battle: this, id, unit, kit });
    customizeCatap2Kit({ battle: this, id, unit, kit });
    customizeChen3Kit({ battle: this, id, unit, kit });
    customizeHsgma2Kit({ battle: this, id, unit, kit });
    customizeOrchd2Kit({ battle: this, id, unit, kit });
    customizeLeizi2Kit({ battle: this, id, unit, kit });
    customizeVeenKit({ battle: this, id, unit, kit });
    customizeMantraKit({ battle: this, id, unit, kit });
    customizeHarukaKit({ battle: this, id, unit, kit });
    customizeWangKit({ battle: this, id, unit, kit });
    customizeDemetrKit({ battle: this, id, unit, kit });
    customizeSbell2Kit({ battle: this, id, unit, kit });
    customizeAglna2Kit({ battle: this, id, unit, kit });
    customizeRadianKit({ battle: this, id, unit, kit });
    customizeKalts2Kit({ battle: this, id, unit, kit });
    customizeSvash2Kit({ battle: this, id, unit, kit });
    customizeNastiKit({ battle: this, id, unit, kit });
    customizePublicBranchKit({ battle: this, id, unit, kit });
    customizeNarantKit({ battle: this, id, def, unit, kit });
    customizeElaKit({ battle: this, id, def, unit, kit });
    customizeFuzeKit({ battle: this, id, def, unit, kit });
    customizeRosmontisKit({ battle: this, id, def, unit, kit });
    customizeWisadelKit({ battle: this, id, def, unit, kit });
    customizeSwireAlterKit({ battle: this, id, def, unit, kit });
    customizeChristineKit({ battle: this, id, def, unit, kit });
    customizeExecutorReaperKit({ battle: this, id, def, unit, kit });
    customizePhilaeKit({ battle: this, id, def, unit, kit });
    customizeWindflitKit({ battle: this, id, def, unit, kit });
    customizeBlemishineKit({ battle: this, id, def, unit, kit });
    customizeFlametailKit({ battle: this, id, def, unit, kit });
    customizeAlannaKit({ battle: this, id, def, unit, kit });
    customizeCatherineKit({ battle: this, id, def, unit, kit });
    customizeSenshiKit({ battle: this, id, def, unit, kit });
    customizeTinmanKit({ battle: this, id, def, unit, kit });
    customizeTecnoKit({ battle: this, id, def, unit, kit });
    customizeSaileachKit({ battle: this, id, def, unit, kit });
    customizeSurtrKit({ battle: this, id, def, unit, kit });
    customizeSpuriaKit({ battle: this, id, def, unit, kit });
    customizeRobinKit({ battle: this, id, def, unit, kit });
    customizeWulfeniteKit({ battle: this, id, def, unit, kit });
    customizeTippiKit({ battle: this, id, def, unit, kit });
    customizeLessingKit({ battle: this, id, def, unit, kit });
    customizePenanceKit({ battle: this, id, def, unit, kit });
    customizeMudrockKit({ battle: this, id, def, unit, kit });
    customizeBlazeKit({ battle: this, id, def, unit, kit });
    customizeGavialInvincibleKit({ battle: this, id, def, unit, kit });
    customizeFiammettaKit({ battle: this, id, def, unit, kit });
    customizeHornKit({ battle: this, id, def, unit, kit });
    customizeGnosisKit({ battle: this, id, def, unit, kit });
    customizeTexasAlterKit({ battle: this, id, def, unit, kit });
    customizeTyphonKit({ battle: this, id, def, unit, kit });
    customizeIreneKit({ battle: this, id, def, unit, kit });
    customizeDegenbrecherKit({ battle: this, id, def, unit, kit });
    customizeChongyueKit({ battle: this, id, def, unit, kit });
    customizePepeKit({ battle: this, id, def, unit, kit });
    customizeGladiiaKit({ battle: this, id, def, unit, kit });
    customizeCrownslayerKit({ battle: this, id, def, unit, kit });
    customizeIanaKit({ battle: this, id, def, unit, kit });
    customizeBrigidKit({ battle: this, id, def, unit, kit });
    customizeSpecterAlterKit({ battle: this, id, def, unit, kit });
    customizeYatoAlterKit({ battle: this, id, def, unit, kit });
    customizeLeeKit({ battle: this, id, def, unit, kit });
    customizeGoldenglowKit({ battle: this, id, def, unit, kit });
    customizeLapplandKit({ battle: this, id, def, unit, kit });
    customizeThornsLodestarKit({ battle: this, id, unit, kit });
    customizeBlazeIgnitingKit({ battle: this, id, unit, kit });
    customizeExusiaiCovenantKit({ battle: this, id, unit, kit });
    customizeMagallanKit({ battle: this, id, unit, kit });
    customizeLingKit({ battle: this, id, unit, kit });
    customizeShuKit({ battle: this, id, unit, kit });
    customizeYuKit({ battle: this, id, unit, kit });
    customizeStainlessKit({ battle: this, id, unit, kit });
    customizeMitmKit({ battle: this, id, unit, kit });
    customizeHoolheyakKit({ battle: this, id, def, unit, kit });
    customizeEbenholzKit({ battle: this, id, def, unit, kit });
    customizeLinKit({ battle: this, id, def, unit, kit });
    customizeUlpianusKit({ battle: this, id, def, unit, kit });
    customizeWeedyKit({ battle: this, id, def, unit, kit });
    customizeVinaKit({ battle: this, id, def, unit, kit });
    customizeJessicaKit({ battle: this, id, def, unit, kit });
    customizeEntelechiaKit({ battle: this, id, def, unit, kit });
    customizeAscalonKit({ battle: this, id, def, unit, kit });
    customizeChenAlterKit({ battle: this, id, def, unit, kit });
    customizeEyjafjallaKit({ battle: this, id, def, unit, kit });
    customizeFrostKit({ battle: this, id, def, unit, kit });
    customizeMayerKit({ battle: this, id, def, unit, kit });
    customizeFangFireSharpenedKit({ battle: this, id, def, unit, kit });
    customizeSiegeKit({ battle: this, id, def, unit, kit });
    customizeFirewatchKit({ battle: this, id, def, unit, kit });
    customizeSurferKit({ battle: this, id, def, unit, kit });
    customizeMelaniteKit({ battle: this, id, def, unit, kit });
    customizeAshKit({ battle: this, id, def, unit, kit });
    customizeChenKit({ battle: this, id, def, unit, kit });
    customizeVulpisKit({ battle: this, id, def, unit, kit });
    customizeSagaKit({ battle: this, id, def, unit, kit });
    customizeEunectesKit({ battle: this, id, def, unit, kit });
    customizeAakKit({ battle: this, id, def, unit, kit });
    customizeBenaKit({ id, def, unit, kit });
    customizeKazemaruKit({ battle: this, id, def, unit, kit });
    customizePhantomKit({ battle: this, id, def, unit, kit });
    customizeHookExpansionKit({ battle: this, id, def, unit, kit });
    customizeFiveStarSupportFourthKit({ battle: this, id, def, unit, kit });
    customizeFiveStarSpecialistExpansionKit({ battle: this, id, def, unit, kit });
    customizeFiveStarCasterOverloadKit({ battle: this, id, def, unit, kit });
    customizeFiveStarSupportThirdKit({ battle: this, id, def, unit, kit });
    customizeFiveStarGuardFourthKit({ battle: this, id, def, unit, kit });
    const mechanic = REGULAR_OPERATORS[id].mechanic;
    if (mechanic === "dp")
      kit.skill.onStart = ({ battle, unit }) =>
        this.behaviors.get(id).run("ON_BUFF_START", { battle, unit, blackboard: def.skill.bb });
    if (mechanic === "self-heal")
      kit.skill = {
        id: def.skill.id,
        name: def.skill.name,
        kind: "instant",
        onStart: ({ battle, unit }) =>
          battle.heal(unit, unit, unit.s.maxHp * def.skill.bb.heal_scale, { self: true }),
      };
    if (mechanic === "healing-stance") {
      // Client prefab: BASE_ATTACK_TIME uses ADDITION, not a percentage.
      kit.skill.mods.batPct = def.skill.bb.base_attack_time / unit.base.bat;
      kit.skill.attack = { dmgType: "heal", heal: { mode: "single", count: 1 } };
      const talent = def.talents[0]?.bb;
      if (talent) kit.skill.onHit = ({ battle, unit, target, heal }) => {
        if (heal > 0) battle.addBuff(target, { key: `spot:dodge:${unit.id}`, source: unit,
          duration: talent.duration, mods: { dodgePhys: talent.prob } });
      };
    }
    this._setupUnit(unit, kit);
    installMedic({ battle: this, unit, def });
    installCaster({ battle: this, unit, def });
    installGuard({ battle: this, unit, def });
    installSniper({ battle: this, unit, def });
    installVanguard({ battle: this, unit, def });
    installDefender({ battle: this, unit, def });
    installAdvancedSniper({ battle: this, unit, def });
    installSupport({ battle: this, unit, def });
    installSpecialist({ battle: this, unit, def });
    installUtility({ battle: this, unit, def });
    installGuardExpansion({ battle: this, unit, def });
    installSupportExpansion({ battle: this, unit, def });
    installCasterExpansion({ battle: this, unit, def });
    installSniperExpansion({ battle: this, unit, def });
    installSummoner({ battle: this, unit, def });
    installRobotExpansion({ battle: this, unit, def });
    installFiveStarGuard({ battle: this, unit, def });
    installFiveStarCaster({ battle: this, unit, def });
    installFiveStarVanguard({ battle: this, unit, def });
    installFiveStarVanguardSecond({ battle: this, unit, def });
    installFiveStarSupport({ battle: this, unit, def });
    installFiveStarGuardExpansion({ battle: this, unit, def });
    installFiveStarCasterExpansion({ battle: this, unit, def });
    installFiveStarSupportExpansion({ battle: this, unit, def });
    installFiveStarGuardThird({ battle: this, unit, def });
    installFiveStarSniper({ battle: this, unit, def });
    installFiveStarCasterUtility({ battle: this, unit, def });
    installFiveStarGuardFifth({ battle: this, unit, def });
    installFiveStarMedic({ battle: this, unit, def });
    installFiveStarMedicSecond({ battle: this, unit, def });
    installFiveStarMedicThird({ battle: this, unit, def });
    installFiveStarDefender({ battle: this, unit, def });
    installFiveStarDefenderSecond({ battle: this, unit, def });
    installFiveStarGuardSixth({ battle: this, unit, def });
    installFiveStarSniperSecond({ battle: this, unit, def });
    installFiveStarSniperThird({ battle: this, unit, def });
    installCastersNext({ battle: this, unit, def });
    installDefenderThird({ battle: this, unit, def });
    installSixStarMedic({ battle: this, unit, def });
    installDefenderFourth({ battle: this, unit, def });
    installFiveStarMedicFourth({ battle: this, unit, def });
    installCasterSecond({ battle: this, unit, def });
    installFiveStarVanguardThird({ battle: this, unit, def });
    installGuardSixStar({ battle: this, unit, def });
    installFiveStarSniperFourth({ battle: this, unit, def });
    installSniperSixStar({ battle: this, unit, def });
    installSniperSixStarSecond({ battle: this, unit, def });
    installSupportAura({ battle: this, unit, def });
    installGuardSixStarSecond({ battle: this, unit, def });
    installElementalCaster({ battle: this, unit, def });
    installBlessingExpansion({ battle: this, unit, def });
    installGuardSixStarThird({ battle: this, unit, def });
    installCasterThird({ battle: this, unit, def });
    installSupportControl({ battle: this, unit, def });
    installLucilla({ battle: this, unit, def });
    installThorns({ battle: this, unit, def });
    installArchetto({ battle: this, unit, def });
    installGuardSixStarFourth({ battle: this, unit, def });
    installFartooth({ battle: this, unit, def });
    installSaria({ battle: this, unit, def });
    installBagpipe({ battle: this, unit, def });
    installRosa({ battle: this, unit, def });
    installPuzzle({ battle: this, unit, def });
    installHoederer({ battle: this, unit, def });
    installW({ battle: this, unit, def });
    installMlynar({ battle: this, unit, def });
    installSilenceParadigmatic({ battle: this, unit, def });
    installEyjaAlter({ battle: this, unit, def });
    installJieyun({ battle: this, unit, def });
    installRadiantKnight({ battle: this, unit, def });
    installNian({ battle: this, unit, def });
    installKaltsit({ battle: this, unit, def });
    installZuole({ battle: this, unit, def });
    installBobbing({ battle: this, unit, def });
    installScene({ battle: this, unit, def });
    installSandReckoner({ battle: this, unit, def });
    installVirtuosa({ battle: this, unit, def });
    installDorothy({ battle: this, unit, def });
    installSkadiAlter({ battle: this, unit, def });
    installInes({ battle: this, unit, def });
    installCivilight({ battle: this, unit, def });
    installReedAlter({ battle: this, unit, def });
    installPozemka({ battle: this, unit, def });
    installAmiyaGuard({ battle: this, unit, def });
    installAmiyaMedic({ battle: this, unit, def });
    installChilchuck({ battle: this, unit, def });
    installBlacknight({ battle: this, unit, def });
    installVigil({ battle: this, unit, def });
    installRay({ battle: this, unit, def });
    installColdshot({ battle: this, unit, def });
    installNymph({ battle: this, unit, def });
    installLemuen({ battle: this, unit, def });
    installRmixer({ battle: this, unit, def });
    installMarcil({ unit, def });
    installPublicMuelsyse({ unit, def });
    installPublicNecrass({ unit, def });
    installPublicTragodia({ unit, def });
    installPublicMon3tr({ unit, def });
    installPublicAkkord({ unit, def });
    installPublicWintim({ unit, def });
    installPublicJcinta({ unit, def });
    installPublicLiesel({ unit, def });
    installPublicClosur({ unit, def });
    installPublicReckpr({ battle: this, unit, def });
    installPublicVarkis({ battle: this, unit, def });
    installPublicSnhunt({ battle: this, unit, def });
    installPublicKichi({ battle: this, unit, def });
    installPublicCairn({ battle: this, unit, def });
    installPublicCrackborne({ battle: this, unit, def });
    installPublicThumpy({ battle: this, unit, def });
    installPublicTimeslot({ battle: this, unit, def });
    installPublicPedro({ battle: this, unit, def });
    installPublicMechanist({ battle: this, unit, def });
    installPublicGallus({ battle: this, unit, def });
    installPublicKoromaru({ battle: this, unit, def });
    installPublicRecon({ battle: this, unit, def });
    installPublicTurdus({ battle: this, unit, def });
    installPublicJu({ battle: this, unit, def });
    installPublicTaraxa({ battle: this, unit, def });
    installPublicBotany({ battle: this, unit, def });
    installPublicSkybox({ battle: this, unit, def });
    installPublicAegis({ battle: this, unit, def });
    installPublicYukari({ battle: this, unit, def });
    installPublicMakoto({ battle: this, unit, def });
    installPublicAphrissa({battle: this, unit, def});
    installPublicHadiya({ battle: this, unit, def });
    installAmoris({ battle: this, unit, def });
    installTmoris({ battle: this, unit, def });
    installDolris({ battle: this, unit, def });
    installMortis({ battle: this, unit, def });
    installOblvns({ battle: this, unit, def });
    installMakiri({ battle: this, unit, def });
    installFlwr2({ battle: this, unit, def });
    installHeadb2({ battle: this, unit, def });
    installTiti({ battle: this, unit, def });
    installHalo2({ battle: this, unit, def });
    installCatap2({ battle: this, unit, def });
    installChen3({ battle: this, unit, def });
    installHsgma2({ battle: this, unit, def });
    installOrchd2({ battle: this, unit, def });
    installLeizi2({ battle: this, unit, def });
    installVeen({ battle: this, unit, def });
    installMantra({ battle: this, unit, def });
    installHaruka({ battle: this, unit, def });
    installWang({ battle: this, unit, def });
    installDemetr({ battle: this, unit, def });
    installSbell2({ battle: this, unit, def });
    installAglna2({ battle: this, unit, def });
    installRadian({ battle: this, unit, def });
    installKalts2({ battle: this, unit, def });
    installSvash2({ battle: this, unit, def });
    installNasti({ battle: this, unit, def });
    installPublicBranch({ battle: this, unit, def });
    installNarant({ battle: this, unit, def });
    installEla({ battle: this, unit, def });
    installFuze({ battle: this, unit, def });
    installRosmontis({ battle: this, unit, def });
    installWisadel({ battle: this, unit, def });
    installSwireAlter({ battle: this, unit, def });
    installChristine({ battle: this, unit, def });
    installExecutorReaper({ battle: this, unit, def });
    installPhilae({ battle: this, unit, def });
    installWindflit({ battle: this, unit, def });
    installBlemishine({ battle: this, unit, def });
    installFlametail({ battle: this, unit, def });
    installAlanna({ battle: this, unit, def });
    installCatherine({ battle: this, unit, def });
    installSenshi({ battle: this, unit, def });
    installTinman({ battle: this, unit, def });
    installTecno({ battle: this, unit, def });
    installSaileach({ battle: this, unit, def });
    installSurtr({ battle: this, unit, def });
    installSpuria({ battle: this, unit, def });
    installRobin({ battle: this, unit, def });
    installWulfenite({ battle: this, unit, def });
    installTippi({ battle: this, unit, def });
    installLessing({ battle: this, unit, def });
    installPenance({ battle: this, unit, def });
    installMudrock({ battle: this, unit, def });
    installBlaze({ battle: this, unit, def });
    installGavialInvincible({ battle: this, unit, def });
    installFiammetta({ battle: this, unit, def });
    installHorn({ battle: this, unit, def });
    installGnosis({ battle: this, unit, def });
    installTexasAlter({ battle: this, unit, def });
    installTyphon({ battle: this, unit, def });
    installIrene({ battle: this, unit, def });
    installDegenbrecher({ battle: this, unit, def });
    installChongyue({ battle: this, unit, def });
    installPepe({ battle: this, unit, def });
    installGladiia({ battle: this, unit, def });
    installCrownslayer({ battle: this, unit, def });
    installIana({ battle: this, unit, def });
    installBrigid({ battle: this, unit, def });
    installSpecterAlter({ battle: this, unit, def });
    installYatoAlter({ battle: this, unit, def });
    installLee({ battle: this, unit, def });
    installGoldenglow({ battle: this, unit, def });
    installLappland({ battle: this, unit, def });
    installThornsLodestar({ unit });
    installBlazeIgniting({ unit });
    installExusiaiCovenant({ unit });
    installMagallan({ unit });
    installLing({ unit });
    installShu({ unit });
    installYu({ unit });
    installStainless({ unit });
    installMitm({ unit });
    installHoolheyak({ battle: this, unit, def });
    installEbenholz({ battle: this, unit, def });
    installLin({ battle: this, unit, def });
    installUlpianus({ battle: this, unit, def });
    installWeedy({ battle: this, unit, def });
    installVina({ battle: this, unit, def });
    installJessica({ battle: this, unit, def });
    installEntelechia({ battle: this, unit, def });
    installAscalon({ battle: this, unit, def });
    installChenAlter({ battle: this, unit, def });
    installEyjafjalla({ battle: this, unit, def });
    installFrost({ battle: this, unit, def });
    installMayer({ battle: this, unit, def });
    installFangFireSharpened({ battle: this, unit, def });
    installSiege({ battle: this, unit, def });
    installFirewatch({ battle: this, unit, def });
    installSurfer({ battle: this, unit, def });
    installMelanite({ battle: this, unit, def });
    installAsh({ battle: this, unit, def });
    installChen({ battle: this, unit, def });
    installVulpis({ battle: this, unit, def });
    installSaga({ battle: this, unit, def });
    installEunectes({ battle: this, unit, def });
    installAak({ battle: this, unit, def });
    installBena({ battle: this, unit, def });
    installKazemaru({ battle: this, unit, def });
    installHookExpansion({ battle: this, unit, def });
    installFiveStarSupportFourth({ battle: this, unit, def });
    installFiveStarSpecialistExpansion({ battle: this, unit, def });
    installFiveStarCasterOverload({ battle: this, unit, def });
    installFiveStarSupportThird({ battle: this, unit, def });
    installFiveStarGuardFourth({ battle: this, unit, def });
    if (mechanic === "blast-area")
      unit.skill.spec.attack = { splashRadius: unit.profile.splashRadius * def.skill.bb["attack@range_scale"] };
    if (mechanic === "arts-lord") unit.skill.spec.attack = { dmgType: "arts" };
    if (def.raw.arkpedia.highDef) unit.profile.priority = "highDef";
    if (mechanic === "ranged-priority" && def.talents.length)
      unit.profile.priority = "ranged";
    if (mechanic === "extra-heal" && def.talents.length) {
      const probability = def.talents[0].bb["attack@prob"];
      this.on("beforeAttack", (ctx) => {
        if (ctx.attacker !== unit || !ctx.targets.length || ctx.profile.dmgType !== "heal" || !this.rng.chance(probability)) return;
        const extra = this.injuredAlliesInKeys(unit.rangeKeys, unit)
          .find(ally => !ctx.targets.includes(ally));
        if (extra) ctx.targets.push(extra);
      }, { owner: unit });
    }
    if (mechanic === "anti-air" && def.talents.length) {
      const normalMultiplier = unit.profile.dmgMul;
      const scale = def.talents[0].bb.atk_scale;
      unit.profile.dmgMul = (battle, attacker, target) =>
        (typeof normalMultiplier === "function" ? normalMultiplier(battle, attacker, target) : normalMultiplier ?? 1)
        * (target.isFlying ? scale : 1);
    }
    if (def.raw.arkpedia.critical) {
      const { prob, atk_scale } = def.raw.arkpedia.critical;
      this.on(
        "beforeAttack",
        (ctx) => {
          if (ctx.attacker === unit) unit.mem.critical = this.rng.chance(prob);
        },
        { owner: unit },
      );
      const normalMultiplier = unit.profile.dmgMul;
      unit.profile.dmgMul = (battle, attacker, target) =>
        (typeof normalMultiplier === "function" ? normalMultiplier(battle, attacker, target) : normalMultiplier ?? 1)
        * (unit.mem.critical ? atk_scale : 1);
    }
    this.addBuff(unit, {
      key: "arkpedia:talent",
      mods: def.raw.arkpedia.modifiers,
      persist: true,
      allowDead: true,
    });
    if (mechanic === "centurion") {
      // Centurions select up to their block count, including unblocked enemies
      // in range. Keep ordinary-stage rules separate from mode profiles.
      unit.profile.hitAllBlocked = false;
      Object.defineProperty(unit.profile, "maxTargets", {
        enumerable: true, get: () => Math.max(1, unit.s.blockCnt),
      });
    }
    const costAttribute = this.cost(id);
    entry.lastCost = fromSkill ? 0 : costAttribute;
    ps.dp -= entry.lastCost;
    // A free card delivery is a real deployment, not MOVE_LIKE_RESPAWN.
    this._deploy(unit, { tile: [row, col], costAttribute });
    if (mechanic === "starting-sp")
      unit.skill.gainSp(def.talents.reduce((sum, talent) => sum + (talent.bb.sp ?? 0), 0), "talent");
    entry.deployments++;
    entry.unit = unit;
    if (fromSkill) entry.readyAt = this.time;
    consumeFiveStarVanguardSecondCard(this, id);
    consumeSaileachCard(this, id);
    consumeFangFireSharpenedCard(this, id);
    return unit;
  }
  retreatOperator(id) {
    if (!canDeployInViewport(this.viewport) || this.finished)
      throw new Error("Battle workspace is inactive.");
    const entry = this.bench[id];
    if (!entry?.unit?.alive) throw new Error("Operator is not deployed.");
    const support = REGULAR_OPERATORS[id];
    const refund = support.noRetreatRefund ? 0 : support.mechanic === "fang-fire-sharpened"
      ? fangFireSharpenedRefund(entry) : support.mechanic === "charger"
      ? entry.unit.base.cost : Math.floor(entry.lastCost / 2);
    this.addDp("arkpedia", refund);
    this.retreat(entry.unit, { permanent: true });
  }
  activateOperator(id) {
    if (!canDeployInViewport(this.viewport) || this.finished) return false;
    const unit = typeof id === 'string' && id.startsWith('token:')
      ? selectedRegularSummon(this, id)?.unit : this.bench[id]?.unit;
    if (unit?.alive && unit.skill.active && unit.skill.spec.manualCancel) {
      // A skill that puts its own owner to sleep (Titi S2) stays stoppable while that sleep lasts.
      if ((!unit.canAct && !unit.skill.spec.cancelWhileOwnSleep?.()) || unit.skill.silenceBlocked) return false;
      if (unit.skill.spec.canManualCancel?.() === false) return false;
      if (unit.skill.spec.onManualCancel) return !!unit.skill.spec.onManualCancel();
      unit.skill.end('manual');
      return true;
    }
    return !!(
      unit?.alive &&
      (unit.canAct || unit.skill.spec.allowAbnormalCast) && !unit.skill.silenceBlocked &&
      !unit.skill.noSkill &&
      (unit.skill.manual || unit.skill.spec.manualActivation?.() === true) &&
      unit.skill.activate("manual")
    );
  }
  // An owner-declared second field action (e.g. Hadiya's Equipment Adaptation).
  secondaryActionOperator(id) {
    if (!canDeployInViewport(this.viewport) || this.finished) return false;
    const unit = this.bench[id]?.unit, action = unit?.mem.regularSecondaryAction;
    return !!(unit?.alive && action && unit.canAct && !unit.skill.silenceBlocked && action.available() && action.run());
  }
  _remove(unit, reason, killer, permanent) {
    if (unit.side === "ally" && unit.kind === "op") {
      const entry = this.bench[unit.defId];
      if (entry) entry.readyAt = this.time + unit.base.respawnTime * unit.s.redeployMul;
      permanent = true;
    }
    super._remove(unit, reason, killer, permanent);
  }
  _checkRedeploys() {} // Ordinary stages require a new manual placement after the cooldown.
  _recordLeak(enemy, timeout) {
    super._recordLeak(enemy, timeout);
    if (!timeout) this.life -= enemy.lpr;
  }
  _checkEnd() {
    if (this.life <= 0) return this._finish("defeated");
    super._checkEnd();
  }
  _installDeepWater(water) {
    if (!water) return;
    this.deepWater = { damage: water.damage ?? 40, aspd: water.aspd ?? 60, speed: water.speed ?? 0.6 };
    this._deepWaterLast = -Infinity;
    this.on('tick', () => {
      if (this.time - this._deepWaterLast < 1) return;
      this._deepWaterLast = this.time;
      for (const e of this.enemies) {
        if (!e.alive || !this._isDeepWater(e.tileR, e.tileC)) continue;
        this.dealDamage(null, e, { amount: this.deepWater.damage, type: 'true', sourceless: true });
        if (e.alive) this.addBuff(e, { key: 'deep-water:enemy', duration: 1.2, mods: { aspd: -this.deepWater.aspd, movePct: -this.deepWater.speed }, visible: true });
      }
    });
  }

  _isDeepWater(r, c) { return !!(this.grid.inRect(r, c) && /water|deep/.test(String(this.grid.tile(r, c)?.key ?? ''))); }

  _installHighTide(tide) {
    if (!tide) return;
    const list = Array.isArray(tide) ? tide : [tide];
    this.highTide = { start: list[0]?.start ?? 0, end: list[0]?.end ?? Infinity, damage: list[0]?.enemyDamage ?? 40,
      aspd: list[0]?.enemyAspd ?? 60, speed: list[0]?.enemySpeed ?? 0.6, allyAspd: list[0]?.allyAspd ?? 60,
      erosion: list[0]?.allyErosion ?? 40, ratio: list[0]?.erosionRatio ?? 0.25, windows: list, active: false };
    this._highTideLast = -Infinity;
    this.on('tick', () => this._highTideTick());
    this.on('damaged', ({ source, target }) => {
      if (!this.highTide?.active || target?.side !== 'ally' || !target.alive) return;
      if (target.mem?.erosionImmune || !this._isFlooded(target.tileR, target.tileC)) return;
      elem(this, source ?? null, target, 'erosion', (source?.s?.atk ?? 0) * this.highTide.ratio);
    });
  }

  _isFlooded(r, c) { return !!(this.highTide?.active && this.grid.inRect(r, c) && this.grid.isLow(r, c)); }

  _highTideTick() {
    const t = this.highTide;
    if (!t) return;
    const win = (t.windows ?? []).find(w => this.time >= (w.start ?? 0) && this.time < (w.end ?? Infinity));
    t.active = !!win;
    if (win) Object.assign(t, { damage: win.enemyDamage ?? t.damage, aspd: win.enemyAspd ?? t.aspd, speed: win.enemySpeed ?? t.speed, allyAspd: win.allyAspd ?? t.allyAspd, erosion: win.allyErosion ?? t.erosion, ratio: win.erosionRatio ?? t.ratio });
    if (!t.active || this.time - this._highTideLast < 1) return;
    this._highTideLast = this.time;
    for (const e of this.enemies) {
      if (!e.alive || !this._isFlooded(e.tileR, e.tileC)) continue;
      this.dealDamage(null, e, { amount: t.damage, type: 'true', sourceless: true });
      if (e.alive) this.addBuff(e, { key: 'high-tide:enemy', duration: 1.2, mods: { aspd: -t.aspd, movePct: -t.speed }, visible: true });
    }
    for (const u of this.units) {
      if (u.side !== 'ally' || !u.alive || u.deployed === false || !this._isFlooded(u.tileR, u.tileC)) continue;
      this.addBuff(u, { key: 'high-tide:ally', duration: 1.2, mods: { aspd: -t.allyAspd }, visible: true });
      if (!u.mem?.erosionImmune) elem(this, null, u, 'erosion', t.erosion);
    }
    this._ev(['highTide', { active: true }]);
  }

  _deploy(u, opts = {}) {
    const r = opts.tile ? opts.tile[0] : u.homeR, c = opts.tile ? opts.tile[1] : u.homeC;
    if (u.kind === 'op' && this._isFlooded(r, c) && !u.mem?.erosionImmune) { this.log(`high tide blocks deployment at ${r},${c}`); return false; }
    return super._deploy(u, opts);
  }

  _installPillarController() {
    this.on('damaged', ({ source, target, dmg }) => {
      const d = target?.mem?.stageUnitDevice;
      if (!d?.pillar || !target.alive) return;
      if (source?.side === 'ally' && Math.max(Math.abs(source.tileR - target.tileR), Math.abs(source.tileC - target.tileC)) > 1) {
        dmg.amount = 0; return;
      }
      if (source) d.lastSource = { r: source.tileR, c: source.tileC };
      if (d.state === 'damaged') return;
      if (target.hp - (dmg.amount ?? 0) <= 0) {
        target.hp = 1; dmg.amount = 0; d.state = 'damaged';
        this.addBuff(target, { key: 'pillar:damaged', duration: 2, visible: true, flags: { invulnerable: true }, persist: true });
      }
    });
    this.on('death', ({ unit }) => {
      const d = unit?.mem?.stageUnitDevice;
      if (d?.pillar) this._collapsePillar(unit, d);
    });
  }

  _collapsePillar(pillar, d) {
    if (d.collapsed) return;
    d.collapsed = true;
    this.grid.setObstacle(d.row, d.col, false, d.obstacle);
    const src = d.lastSource;
    let dr = src ? Math.sign(d.row - src.r) : 1, dc = src ? Math.sign(d.col - src.c) : 0;
    if (!dr && !dc) dr = 1;
    for (const [r, c] of [[d.row, d.col], [d.row + dr, d.col + dc]]) {
      if (!this.grid.inRect(r, c)) continue;
      for (const e of this.enemies) {
        if (!e.alive || Math.abs(e.tileR - r) > 0.51 || Math.abs(e.tileC - c) > 0.51) continue;
        this.dealDamage(null, e, { amount: 12000, type: 'true', sourceless: true });
        if (e.alive) this.applyStatus(e, 'stun', { duration: 10 });
      }
      for (const u of this.units) {
        if (u.side !== 'ally' || !u.alive || u.deployed === false) continue;
        if (Math.abs(u.tileR - r) <= 0.51 && Math.abs(u.tileC - c) <= 0.51) this.retreat(u, { reason: 'pillar', permanent: true });
      }
      if (!this._occ[r * this.grid.cols + c]?.alive && this.grid.groundPassable(r, c, true)) this.grid.setObstacle(r, c, true, 'block');
    }
  }

  _installUnitStageDevices(devices) {
    for (const d of devices) {
      const spec = STAGE_DEVICES[d.name]?.unit;
      if (!spec || !Number.isInteger(d.row) || !Number.isInteger(d.col) || spec.tide) continue;
      if (spec.platformDevice) { this.platformTiles ??= new Set(); this.platformTiles.add(`${d.row},${d.col}`); continue; }
      const e = this.spawnEnemy(`device:${d.key ?? d.name}`, { pos: [d.row, d.col], countInTotal: false,
        def: { key: d.key ?? d.name, name: d.name, applyWay: 'NONE', dmgType: 'none',
          stats: { maxHp: spec.hp, hp: spec.hp, atk: spec.atk ?? 0, def: spec.def, res: spec.res ?? 0, moveSpeed: 0, bat: 1, rangeRadius: 0, blockCnt: spec.block, lpr: 0 } } });
      if (!e) continue;
      e.mem.stageUnitDevice = { ...spec, name: d.name, row: d.row, col: d.col, dir: d.dir ?? 'RIGHT', state: spec.pillar ? 'intact' : null };
      e.profile.noAttack = true; e.counted = false; e.lpr = 0; e.blockWeight = 0;
      e.route = { legs: [{ t: 'wait', time: 1e9 }], legIdx: 0, pts: null, ptIdx: 0, suffix: null, version: -1, waitLeft: null };
      e.s.moveSpeed = 0;
      this.grid.setObstacle(d.row, d.col, true, spec.obstacle);
    }
    this.on('death', ({ unit }) => {
      const d = unit.mem?.stageUnitDevice;
      if (!d) return;
      this.grid.setObstacle(d.row, d.col, false, d.obstacle);
      this.flags.dpMax += d.dpMax;
      this.addDp('arkpedia', d.dp);
    });
  }
  _tickMvpStageDevices(dt) {
    for (const d of this.mvpStageDevices) {
      const def = STAGE_DEVICES[d.name];
      if (def.pulse) {
        const spec = def.pulse;
        d.sp += spec.spPerSecond * dt;
        while (d.sp >= spec.spCost) {
          d.sp -= spec.spCost;
          const tiles = pulseTiles(d.row, d.col);
          for (const u of this.units) {
            if (!u.alive || !u.deployed || u.mem?.pulseImmune || u.profile?.pulseImmune) continue;
            const r = Math.round(u.y), c = Math.round(u.x);
            if (!tiles.some(([tr, tc]) => tr === r && tc === c)) continue;
            this.dealDamage(null, u, { amount: spec.damage, type: 'true', sourceless: true, ignoreSelect: true, tags: ['device', 'pulse'] });
          }
          this.fx('explode', { x: d.col, y: d.row, r: 1.5, kind: 'pulse' });
        }
      } else if (def.environment) {
        const spec = def.environment;
        d.acc += dt;
        for (const u of this.units) {
          if (!u.alive || !u.deployed || !this.mvpStagePollution.has(`${Math.round(u.y)},${Math.round(u.x)}`)) continue;
          this.addBuff(u, { key: 'device:pollution', persist: true, refresh: 'replace', duration: spec.interval * 1.1, mods: { spRecoveryMul: spec.spMul } });
        }
        while (d.acc >= spec.interval) {
          d.acc -= spec.interval;
          for (const u of this.units) {
            if (!u.alive || !u.deployed || !this.mvpStagePollution.has(`${Math.round(u.y)},${Math.round(u.x)}`)) continue;
            this.dealDamage(null, u, { amount: spec.damage, type: 'true', sourceless: true, ignoreSelect: true, tags: ['device', 'pollution'] });
          }
        }
      } else if (def.kite) {
        const spec = def.kite; d.sp += dt;
        if (d.sp < spec.spCost) continue;
        const dir = d.dir ?? 'RIGHT', dx = dir === 'RIGHT' ? 1 : dir === 'LEFT' ? -1 : 0, dy = dir === 'DOWN' ? 1 : dir === 'UP' ? -1 : 0;
        const target = this.allyUnits.filter(a => a.alive && a.deployed && a.kind !== 'device' && !a.hidden)
          .filter(a => dx ? Math.abs(a.y - d.row) <= 0.5 && (a.x - d.col) * dx > 0 : Math.abs(a.x - d.col) <= 0.5 && (a.y - d.row) * dy > 0)
          .sort((a, b) => Math.hypot(a.y - d.row, a.x - d.col) - Math.hypot(b.y - d.row, b.x - d.col))[0];
        if (!target) continue; d.sp = 0;
        for (const u of this.allyUnits) if (u.alive && u.deployed && Math.hypot(u.y - target.y, u.x - target.x) <= spec.range)
          this.dealDamage(null, u, { amount: 3000, type: 'phys', sourceless: true, tags: ['device', 'kite'] });
      } else if (def.artillery) {
        const spec = def.artillery;
        d.sp = Math.min(spec.spCost, d.sp + spec.spPerSecond * dt);
        if (d.sp < spec.spCost) continue;
        const target = this.allyUnits
          .filter(a => a.alive && a.deployed && a.kind !== 'device' && !a.hidden
            && !a.s.flags.stealth && !a.s.flags.camu && !a.s.flags.liftoff)
          .sort((a, b) => (b.s.blockCnt ?? 0) - (a.s.blockCnt ?? 0) || b.deploySeq - a.deploySeq)[0];
        if (!target) continue;
        d.sp = 0;
        const tiles = artilleryTiles(Math.round(target.y), Math.round(target.x));
        const set = new Set(tiles.map(([r, c]) => `${r},${c}`));
        for (const u of this.units) {
          if (!u.alive || !u.deployed) continue;
          if (!set.has(`${Math.round(u.y)},${Math.round(u.x)}`)) continue;
          this.dealDamage(null, u, { amount: spec.damage, type: 'true', sourceless: true, ignoreSelect: true, tags: ['device', 'artillery'] });
        }
        this.fx('explode', { x: target.x, y: target.y, r: 2, kind: 'artillery' });
      }
    }
  }

}
