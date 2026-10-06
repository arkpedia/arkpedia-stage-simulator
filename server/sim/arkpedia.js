// SPDX-License-Identifier: GPL-3.0-or-later
// Standard-stage commands around Stronghold's combat primitives. Nothing in this module enters the private host.
import { Battle } from "./Battle.js";
import { DataSource } from "./simdata.js";
import { genericKit } from "./content/generic.js";
import { catalogueFor, recordFor } from "../../shared/arkpedia/loadout.js";
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
    const squad = prepareSquad(selection, catalogueFor(data));
    const builds = [
      ...squad.operators,
      ...(squad.support ? [squad.support] : []),
    ];
    const chess = Object.fromEntries(
      builds.map((b) => [b.id, recordFor(b, data)]),
    );
    const config = data.stage.battle;
    super({
      ...stageAdapter(data.stage),
      seed,
      data: new DataSource({ chess, enemies: data.enemies }),
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
    this.unitLimit = config.unit_limit;
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
  cost(id) {
    const entry = this.bench[id];
    return entry
      ? Math.floor(
          this.data.getChess(id).stats.cost *
            Math.min(2, 1 + entry.deployments * 0.5),
        )
      : Infinity;
  }
  placementError(id, row, col) {
    const entry = this.bench[id];
    if (!canDeployInViewport(this.viewport))
      return "Open the fullscreen workspace to deploy.";
    if (this.finished) return "Battle has ended.";
    if (!entry || entry.unit?.alive) return "Operator is unavailable.";
    if (entry.readyAt > this.time) return "Operator is still redeploying.";
    if (this.allyUnits.filter((u) => u.alive).length >= this.unitLimit)
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
    if (tile.build !== "ALL" && tile.build !== position)
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
    const kit = genericKit(def.skill.bb, def.raw, def);
    if (/charge_cost/.test(def.skill.id))
      kit.skill.onStart = ({ battle, unit }) =>
        battle.addDp(unit.ownerId, def.skill.bb.cost);
    this._setupUnit(unit, kit);
    if (def.raw.arkpedia.highDef) unit.profile.priority = "highDef";
    if (def.raw.arkpedia.critical) {
      const { prob, atk_scale } = def.raw.arkpedia.critical;
      this.on(
        "beforeAttack",
        (ctx) => {
          if (ctx.attacker === unit) unit.mem.critical = this.rng.chance(prob);
        },
        { owner: unit },
      );
      unit.profile.dmgMul = () => (unit.mem.critical ? atk_scale : 1);
    }
    this.addBuff(unit, {
      key: "arkpedia:talent",
      mods: def.raw.arkpedia.modifiers,
      persist: true,
      allowDead: true,
    });
    entry.lastCost = this.cost(id);
    ps.dp -= entry.lastCost;
    this._deploy(unit, { tile: [row, col] });
    entry.deployments++;
    entry.unit = unit;
    return unit;
  }
  retreatOperator(id) {
    if (!canDeployInViewport(this.viewport) || this.finished)
      throw new Error("Battle workspace is inactive.");
    const entry = this.bench[id];
    if (!entry?.unit?.alive) throw new Error("Operator is not deployed.");
    this.addDp("arkpedia", Math.floor(entry.lastCost / 2));
    this.retreat(entry.unit, { permanent: true });
  }
  activateOperator(id) {
    if (!canDeployInViewport(this.viewport) || this.finished) return false;
    const unit = this.bench[id]?.unit;
    return !!(
      unit?.alive &&
      unit.skill.manual &&
      unit.skill.activate("manual")
    );
  }
  _remove(unit, reason, killer, permanent) {
    if (unit.side === "ally" && unit.kind === "op") {
      const entry = this.bench[unit.defId];
      if (entry) entry.readyAt = this.time + unit.base.respawnTime;
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
