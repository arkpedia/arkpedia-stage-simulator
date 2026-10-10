// SPDX-License-Identifier: GPL-3.0-or-later
// Standard-stage commands around Stronghold's combat primitives. Nothing in this module enters the private host.
import { Battle } from "./Battle.js";
import { DataSource } from "./simdata.js";
import { genericKit } from "./content/generic.js";
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
import { customizeDorothyKit, installDorothy } from './content/arkpedia-dorothy.js';
import { customizeVirtuosaKit, installVirtuosa } from './content/arkpedia-virtuosa.js';
import { customizeSandReckonerKit, installSandReckoner } from './content/arkpedia-sand-reckoner.js';
import { customizeChilchuckKit, installChilchuck } from './content/arkpedia-chilchuck.js';
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
import { catalogueFor, recordFor } from "../../shared/arkpedia/loadout.js";
import { REGULAR_OPERATORS } from "../../shared/arkpedia/operators.js";
import { assertRegularEnemies } from "../../shared/arkpedia/enemies.js";
import { compileBuffTemplate } from "../../shared/arkpedia/behavior.js";
import {
  prepareSquad,
  canDeployInViewport,
} from "../../shared/arkpedia/squad.js";

export function stageAdapter(source) {
  const g = source.geometry;
  if (
    g.rows > 19 ||
    g.cols > 21 ||
    g.hasConditionalSpawns ||
    g.waves.length !== 1 ||
    g.suppliedUnits.length
  )
    throw new Error("Unsupported stage mechanics");
  const chars = ["#", "h", "r", "S", "E"];
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
  const routes = g.routes.map((route, index) => {
    if (route.placeholder)
      return { start: [0, 0], end: [0, 0], checkpoints: [] };
    const path = source.pathing?.paths?.[index];
    if (path) {
      if (path.breaks.length || path.holds.some((h) => h.tunnel))
        throw new Error("Unsupported route tunnel");
      const checkpoints = [];
      path.points.forEach(([col, row], at) => {
        if (at > 0) checkpoints.push({ type: "MOVE", pos: [row, col] });
        for (const hold of path.holds.filter(
          (h) => h.at === path.distances[at],
        ))
          checkpoints.push({
            type: "WAIT",
            pos: [row, col],
            time: hold.seconds,
          });
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
  const spawns = g.waves[0].spawns.flatMap((s) =>
    Array.from({ length: s.count }, (_, i) => ({
      enemyKey: s.enemy_id,
      time: s.time + i * (s.interval ?? 0),
      routeIndex: s.route,
      ownerPlayerId: "arkpedia",
    })),
  );
  return {
    stage: {
      id: source.code,
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
    assertRegularEnemies(data);
    const squad = prepareSquad(selection, catalogueFor(data));
    const builds = [
      ...squad.operators,
      ...(squad.support ? [squad.support] : []),
    ];
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
    this.life = config.max_life;
    this.regularSkillUses = new Map();
    this.addDp('arkpedia', startingVanguardDp);
    installMedicSquad({ battle: this, records: chess });
    installGuardSixStarSquad({ battle: this, records: chess });
    installBagpipeSquad({ battle: this, records: chess });
    installRadiantKnightSquad({ battle: this, records: chess });
    this.behaviors = behaviors;
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
    this.start();
  }
  setViewport(viewport) {
    this.viewport = viewport;
  }
  get dp() {
    return this.getPlayer("arkpedia").dp;
  }
  dpRecoveryRateFor(ownerId = 'arkpedia') {
    const scale = this.allyUnits.filter(u => u.ownerId === ownerId && u.alive && u.deployed && !u.hidden)
      .reduce((n, u) => n * (u.mem.regularDpRegenScale ?? 1), 1);
    return this.flags.dpPerSec * scale;
  }
  deployedSlots() {
    return this.allyUnits.filter(unit => unit.alive && unit.deployed)
      .reduce((slots, unit) => slots + (unit.deploymentSlotCost ?? 1), 0);
  }
  deploymentSlotCost(id) {
    const config = REGULAR_OPERATORS[id];
    if (config?.deploymentSlotExemptSkillIds?.includes(this.bench[id]?.build.skillId)) return 0;
    return (this.bench[id]?.build.elite ?? 0) >= (config?.deploymentSlotExemptMinElite ?? 0)
      && config?.deploymentSlotExemptTags?.some(tag => this.mapTags.includes(tag))
      ? 0 : config?.deploymentSlotCost ?? 1;
  }
  cost(id) {
    const entry = this.bench[id];
    if (!entry) return Infinity;
    const ordinary = Math.floor(this.data.getChess(id).stats.cost
      * Math.min(2, 1 + entry.deployments * 0.5));
    const vanguard = adjustFiveStarVanguardSecondCost(this, id, ordinary);
    return adjustAshCost(this, id, adjustFangFireSharpenedCost(this, id, adjustSaileachCost(this, id, adjustJieyunCost(this, id, vanguard))));
  }
  placementError(id, row, col) {
    const entry = this.bench[id];
    if (!canDeployInViewport(this.viewport))
      return "Open the fullscreen workspace to deploy.";
    if (this.finished) return "Battle has ended.";
    if (!entry || entry.unit?.alive) return "Operator is unavailable.";
    if (entry.readyAt > this.time) return "Operator is still redeploying.";
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
    const tile = this.grid.tile(row, col),
      position = this.data.getChess(id).position;
    const rangedTrait = REGULAR_OPERATORS[id]?.deployOnRanged && tile.build === 'RANGED';
    if (tile.build !== "ALL" && tile.build !== position && !rangedTrait)
      return position === "RANGED"
        ? "Choose a ranged tile."
        : "Choose a melee tile.";
    if (
      this.allyUnits.some((u) => u.alive && u.tileR === row && u.tileC === col)
    )
      return "Tile is occupied.";
    if (this.tileReservation(row, col)) return "Tile is reserved for an operator's return.";
    if (this.dp < this.cost(id)) return "Not enough DP.";
    return null;
  }
  deployOperator(id, row, col, dir) {
    const error = this.placementError(id, row, col);
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
    customizeChilchuckKit({ battle: this, id, def, unit, kit });
    customizeBlacknightKit({ battle: this, id, def, unit, kit });
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
    installChilchuck({ battle: this, unit, def });
    installBlacknight({ battle: this, unit, def });
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
    entry.lastCost = this.cost(id);
    ps.dp -= entry.lastCost;
    this._deploy(unit, { tile: [row, col] });
    if (mechanic === "starting-sp")
      unit.skill.gainSp(def.talents.reduce((sum, talent) => sum + (talent.bb.sp ?? 0), 0), "talent");
    entry.deployments++;
    entry.unit = unit;
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
      if (!unit.canAct || unit.s.flags.silence) return false;
      if (unit.skill.spec.canManualCancel?.() === false) return false;
      if (unit.skill.spec.onManualCancel) return !!unit.skill.spec.onManualCancel();
      unit.skill.end('manual');
      return true;
    }
    return !!(
      unit?.alive &&
      (unit.canAct || unit.skill.spec.allowAbnormalCast) && !unit.s.flags.silence &&
      !unit.skill.noSkill &&
      (unit.skill.manual || unit.skill.spec.manualActivation?.() === true) &&
      unit.skill.activate("manual")
    );
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
}
