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
import { customizeSummonerKit, installSummoner } from './content/arkpedia-summons.js';
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
    this.behaviors = behaviors;
    this.unitLimit = config.unit_limit;
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
  deployedSlots() {
    return this.allyUnits.filter(unit => unit.alive && unit.deployed)
      .reduce((slots, unit) => slots + (unit.deploymentSlotCost ?? 1), 0);
  }
  deploymentSlotCost(id) {
    const config = REGULAR_OPERATORS[id];
    return (this.bench[id]?.build.elite ?? 0) >= (config?.deploymentSlotExemptMinElite ?? 0)
      && config?.deploymentSlotExemptTags?.some(tag => this.mapTags.includes(tag))
      ? 0 : config?.deploymentSlotCost ?? 1;
  }
  cost(id) {
    const entry = this.bench[id];
    return entry
      ? adjustFiveStarVanguardSecondCost(this, id, Math.floor(
          this.data.getChess(id).stats.cost *
            Math.min(2, 1 + entry.deployments * 0.5),
        ))
      : Infinity;
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
    return unit;
  }
  retreatOperator(id) {
    if (!canDeployInViewport(this.viewport) || this.finished)
      throw new Error("Battle workspace is inactive.");
    const entry = this.bench[id];
    if (!entry?.unit?.alive) throw new Error("Operator is not deployed.");
    const support = REGULAR_OPERATORS[id];
    const refund = support.noRetreatRefund ? 0 : support.mechanic === "charger"
      ? entry.unit.base.cost : Math.floor(entry.lastCost / 2);
    this.addDp("arkpedia", refund);
    this.retreat(entry.unit, { permanent: true });
  }
  activateOperator(id) {
    if (!canDeployInViewport(this.viewport) || this.finished) return false;
    const unit = this.bench[id]?.unit;
    if (unit?.alive && unit.skill.active && unit.skill.spec.manualCancel) {
      if (!unit.canAct || unit.s.flags.silence) return false;
      unit.skill.end('manual');
      return true;
    }
    return !!(
      unit?.alive &&
      unit.canAct && !unit.s.flags.silence &&
      !unit.skill.noSkill &&
      unit.skill.manual &&
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
