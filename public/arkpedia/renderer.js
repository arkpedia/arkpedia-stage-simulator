// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from "/vendor/three.module.js";
import { fitCamera, syncThreeCamera, pickTile } from "/js/render/projection.js";
import { BattleActor } from "./battle-actor.js";
import { HeartCandleActor } from "./heart-candle.js";
import { EffectOnlyActor } from "./effect-only-actor.js";
import { regularVisualHeight } from "./regular-form-visual.js";
import { createAssets } from "/js/assets.js";
import { regionEdges } from "/shared/arkpedia/placement.js";
import { rangeStripes } from "/shared/arkpedia/battle-ui.js";
import { spriteFacing, regularModelKey, enemyModelKey, stageDeviceModelKeys } from "/shared/arkpedia/facing.js";
import { skillHud, skillSourceFor, ammunitionHud } from "/shared/arkpedia/skill-hud.js";
import { regularTokenIdsFor } from "/shared/arkpedia/summons.js";
import { modelEntry } from '/shared/arkpedia/model-entry.js';
import { FLUX_REFLECTOR_PORTS } from '/shared/arkpedia/flux-reflector-ports.js';
import { dirVec } from '/shared/direction.js';
import { loadStageArt } from "./stage-art.js";
import { loadGates } from "./gates.js";
import { loadSkillParticles, SkillParticleLayer } from "./particles.js";
import { FallbackActor } from "./fallback-actor.js";
import { stageTileView } from '/shared/arkpedia/stage-tile-view.js';
const P = globalThis.PIXI;
const tileRangeStripes = rangeStripes();
const models = createAssets({
  loadSpine: async (entry) => {
    const asset = await P.Assets.load({
      src: entry.skel,
      data: {
        spineAtlasFile: entry.atlas,
        imageMetadata: {
          alphaMode: entry.pma ? P.ALPHA_MODES.PMA : P.ALPHA_MODES.UNPACK,
        },
      },
    });
    return asset.spineData;
  },
});
export class StageRenderer {
  constructor(host, data, onPick, {nativeEffects = null} = {}) {
    this.host = host;
    this.data = data;
    this.views = new Map();
    this.currentBattle = null;
    this.preloaded = new Map();
    this.effects = [];
    this.nativeEffects = nativeEffects;
    this.externalNativeEffects = nativeEffects !== null;
    // Further owner-loaded passes beside the legacy Tragodia slot above; an
    // external pass (previews/reviews) replaces them all.
    this.ownedNativeEffects = new Map();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#10191d");
    this.camera = new THREE.PerspectiveCamera();
    this.three = new THREE.WebGLRenderer({ antialias: true });
    this.three.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.three.domElement.setAttribute("aria-hidden", "true");
    host.append(this.three.domElement);
    this.pixi = new P.Application({
      backgroundAlpha: 0,
      antialias: true,
      autoStart: false,
      resolution: Math.min(devicePixelRatio, 2),
      autoDensity: true,
    });
    this.pixi.stage.sortableChildren = true;
    this.pixi.view.setAttribute("aria-hidden", "true");
    host.append(this.pixi.view);
    this.controls = document.createElement("div");
    this.controls.className = "tile-controls";
    this.controls.inert = true;
    host.append(this.controls);
    this.candleStatus = document.createElement('div');
    this.candleStatus.className = 'stage-art-status heart-candle-status';
    host.append(this.candleStatus);
    const sky = new THREE.HemisphereLight(0xcce2e4, 0x33454a, 2.2);
    // The gameplay plane is X/Y and height is Z, unlike Three's default Y-up.
    sky.position.set(0, 0, 1);
    this.scene.add(sky);
    const sun = new THREE.DirectionalLight(0xffebcc, 2);
    sun.position.set(-5, -3, 12);
    this.scene.add(sun);
    const g = data.stage.geometry;
    this.rect = { r0: 0, r1: g.rows - 1, c0: 0, c1: g.cols - 1 };
    this.tiles = [];
    this.heightAt = (r, c) => stageTileView(g.tileLegend[g.tileGrid[r]?.[c]]).height;
    for (let row = 0; row < g.rows; row++)
      for (let col = 0; col < g.cols; col++) {
        const type = g.tileGrid[row][col];
        const height = this.heightAt(row, col);
        const view = stageTileView(g.tileLegend[type]), color = view.color;
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.97, 0.97, 0.18 + height),
          new THREE.MeshStandardMaterial({ color, roughness: 0.92 }),
        );
        mesh.position.set(col, row, (height - 0.18) / 2);
        this.scene.add(mesh);
        this.tiles.push({ mesh, row, col, type, color, label: view.label });
        if (view.focusable) {
          const button = document.createElement("button");
          button.className = "tile-hit";
          button.type = "button";
          button.setAttribute(
            "aria-label",
            `${view.label}, row ${row + 1}, column ${col + 1}`,
          );
          button.onclick = () => this.onPick(row, col);
          button.onfocus = () => {
            this.focusTile = { row, col };
          };
          button.onblur = () => {
            this.focusTile = null;
          };
          this.controls.append(button);
          this.tiles.at(-1).button = button;
        }
      }
    this.onPick = onPick;
    this.surface = new P.Graphics();
    this.surface.zIndex = 0;
    this.pixi.stage.addChild(this.surface);
    this.overlay = {};
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
    this.artStatus = document.createElement("span");
    this.artStatus.className = "stage-art-status";
    this.artStatus.setAttribute("role", "status");
    host.append(this.artStatus);
    this.artStatus.textContent = "Loading stage artwork…";
    this.artReady = this.loadArt();
    this.gatesReady = this.loadGateArt();
    this.particlesReady = this.loadParticleArt();
  }
  async loadParticleArt() {
    await this.artReady;
    if (this.destroyed) return;
    try {
      const assets = await loadSkillParticles(this.data.skillEffects);
      if (this.destroyed) { assets.dispose(); return; }
      this.skillParticles = new SkillParticleLayer(this.pixi.stage, assets);
    } catch (error) {
      if (!this.destroyed) this.artStatus.textContent += " · Skill effect artwork unavailable";
      console.warn("Could not load original skill particles", error);
    }
  }
  async loadGateArt() {
    await this.artReady;
    if (this.destroyed) return;
    try {
      const gates = await loadGates(this.data.stage, this.heightAt);
      if (this.destroyed) { gates.dispose(); return; }
      this.gates = gates;
      this.scene.add(gates.group);
      this.render(null, 0, []);
    } catch (error) {
      if (!this.destroyed) this.artStatus.textContent += " · Entry/defence artwork unavailable";
      console.warn("Could not load original entry/defence boxes", error);
    }
  }
  async loadArt() {
    try {
      const art = await loadStageArt(this.data.stage);
      if (this.destroyed) { art.dispose(); return; }
      this.art = art;
      this.scene.add(art.group);
      this.heightAt = (r, c) => art.heights[r]?.[c] ?? 0;
      for (const tile of this.tiles) tile.mesh.visible = false;
      this.resize();
      this.artStatus.textContent = "";
    } catch (error) {
      if (!this.destroyed) this.artStatus.textContent = "Stage artwork unavailable · simplified map";
      console.warn("Could not load original stage artwork", error);
    }
  }
  entry(key) {
    return modelEntry(this.data.sd,key);
  }
  nativeEffectPasses() {
    return [this.nativeEffects, ...(this.externalNativeEffects ? [] : this.ownedNativeEffects.values())].filter(Boolean);
  }
  async ownNativeEffects(key, wanted, load) {
    const current = this.ownedNativeEffects.get(key);
    if (wanted && !current) {
      const pass = await load();
      if (this.destroyed) { pass.dispose(); throw Error(`Stage renderer was closed while loading ${key} effects`); }
      this.ownedNativeEffects.set(key, pass);
    } else if (!wanted && current) {
      current.dispose(); this.ownedNativeEffects.delete(key);
    }
  }
  async preload(ids, onProgress) {
    if (!this.externalNativeEffects) {
      if (ids.includes('char_1042_phatm2') && !this.nativeEffects) {
        const { loadTragodiaStageEffects } = await import('./tragodia-assets.js');
        const pass = await loadTragodiaStageEffects({three: THREE, renderer: this.three,
          descriptor: this.data.nativeEffects?.tragodia, heightAt: (row,col) => this.heightAt(row,col)});
        if (this.destroyed) { pass.dispose(); throw Error('Stage renderer was closed while loading cage assets'); }
        this.nativeEffects = pass;
      } else if (!ids.includes('char_1042_phatm2') && this.nativeEffects) {
        this.nativeEffects.dispose(); this.nativeEffects = null;
      }
      await this.ownNativeEffects('aphrissa', ids.includes('char_4229_aphris'), async () => {
        const { loadAphrissaStageEffects } = await import('./aphrissa-assets.js');
        return loadAphrissaStageEffects({three: THREE, stage: this, descriptor: this.data.nativeEffects?.aphrissa});
      });
    }
    const tokenIds = regularTokenIdsFor(ids);
    // Only preload skeletons that exist in this SD snapshot. Records without a model get a labelled
    // fallback marker in render(), instead of rejecting the whole preload and hiding every unit.
    const keys = [...new Set([
      ...[...ids, ...tokenIds].flatMap((id) =>
        ["front", "back"].map((f) => `operator/${id}/default/${f}`),
      ),
      ...tokenIds.map(id => `operator/${id}/default/down`),
      ...Object.keys(this.data.enemies).map(
        (id) => enemyModelKey(id, this.data.enemies[id]),
      ),
      ...stageDeviceModelKeys(this.data.stage),
    ])].filter((key) => this.data.sd.models[key]);
    let done = 0;
    // Small concurrency cap; renderer waits for the complete selected squad rather than drawing missing operators.
    const pending = keys.filter((k) => !this.preloaded.has(k));
    const workers = Array.from(
      { length: Math.min(3, pending.length) },
      async () => {
        while (pending.length) {
          const key = pending.shift(),
            entry = this.entry(key);
          const skeleton = await models.spine.acquire(entry);
          this.preloaded.set(key, { entry, skeleton });
          onProgress?.(++done, keys.length);
        }
      },
    );
    await Promise.all(workers);
    await this.particlesReady;
    // Release unselected squad models. The inherited refcount cache disposes idle CPU/GPU assets.
    for (const [key, value] of this.preloaded)
      if (!keys.includes(key)) {
        models.spine.release(value.entry);
        this.preloaded.delete(key);
      }
  }
  resize() {
    const width = Math.max(1, this.host.clientWidth),
      height = Math.max(1, this.host.clientHeight);
    this.three.setSize(width, height, false);
    this.pixi.renderer.resize(width, height);
    this.projection = fitCamera(
      this.rect,
      { width, height, padding: { top: this.host.classList.contains('battle-board') ? 60 : 12,
        bottom: this.host.classList.contains('battle-board') ? Math.min(145, height * .23) : 12, left: 8, right: 8 } },
      { tilt: 28, dist: 20, headroom: 1, margin: 0.2 },
    );
    syncThreeCamera(this.projection, this.camera, width, height);
    for (const tile of this.tiles)
      if (tile.button) {
        const points = this.corners(tile.row, tile.col);
        const x = Math.min(...points.map((p) => p.x)),
          y = Math.min(...points.map((p) => p.y));
        const width = Math.max(...points.map((p) => p.x)) - x,
          height = Math.max(...points.map((p) => p.y)) - y;
        Object.assign(tile.button.style, {
          left: `${x}px`,
          top: `${y}px`,
          width: `${width}px`,
          height: `${height}px`,
          clipPath: `polygon(${points.map((p) => `${((p.x - x) / width) * 100}% ${((p.y - y) / height) * 100}%`).join(",")})`,
        });
      }
    this.render(this.currentBattle, 0, []);
  }
  pickAt(clientX, clientY) {
    const rect = this.host.getBoundingClientRect(),
      g = this.data.stage.geometry;
    return pickTile(
      this.projection,
      clientX - rect.left,
      clientY - rect.top,
      this.heightAt,
      [...new Set(this.tiles.map(t => this.heightAt(t.row, t.col)))].sort((a, b) => b - a),
      g.rows,
      g.cols,
    );
  }
  worldAt(clientX, clientY, tile) {
    const rect = this.host.getBoundingClientRect();
    return this.projection.unproject(
      clientX - rect.left,
      clientY - rect.top,
      this.heightAt(tile.row, tile.col),
    );
  }
  corners(row, col, inset = 0) {
    const h = this.heightAt(row, col) + 0.012,
      d = 0.485 - inset;
    return [
      [-d, -d],
      [d, -d],
      [d, d],
      [-d, d],
    ].map(([x, y]) => this.projection.project(col + x, row + y, h));
  }
  highlight(overlay = {}) {
    this.overlay = overlay;
  }
  drawSurface() {
    const g = this.surface,
      state = this.overlay,
      geometry = this.data.stage.geometry;
    g.clear();
    const polygon = (row, col, color, alpha, stroke = 0, inset = 0) => {
      const points = this.corners(row, col, inset);
      g.lineStyle(stroke, color, 0.85)
        .beginFill(color, alpha)
        .drawPolygon(points.flatMap((p) => [p.x, p.y]))
        .endFill();
    };
    for (const tile of this.currentBattle?.stageReeds?.tiles.values() ?? []) {
      polygon(tile.row, tile.col, tile.mode === 1 ? 0xef6d38 : tile.mode === 2 ? 0x69b1c1 : 0x7b9a53,
        tile.mode === 1 ? .34 : .15, tile.mode === 1 ? 2 : 1, .06);
    }
    // 14-18: the Kindling Revenant's beams (red from the left, gold from the guns) and a firing gun's row.
    const revenant = this.currentBattle?.stageRevenant;
    if (revenant?.rows) {
      const reach = revenant.beamReach;
      for (const row of revenant.rows) {
        for (let col = reach.red?.[0]; col <= reach.red?.[1]; col++) polygon(row, col, 0xe5433a, .3, 0, .08);
        for (let col = reach.gold?.[0]; col <= reach.gold?.[1]; col++) polygon(row, col, 0xf2c24e, .3, 0, .08);
      }
      for (const gun of revenant.guns) if (gun.firing && this.currentBattle.time >= gun.firing.at)
        for (let col = 0; col < gun.col; col++) if (this.currentBattle.grid.inRect(gun.row, col)) polygon(gun.row, col, 0xe5433a, .2, 0, .2);
    }
    // Chapter 16: tiles under Toxic Pollution (enemies there are hidden; nothing can be deployed).
    for (const [row, col] of this.currentBattle?.stageMainline16?.pollutedTiles?.() ?? []) polygon(row, col, 0x8a4fb5, .3, 1, .04);
    // Chapter 15: the tile the Intrusive Call is carrying an enemy to (occupying it stops the deploy).
    const prtsMarker = this.currentBattle?.stagePrts?.marker;
    if (prtsMarker) polygon(prtsMarker[0], prtsMarker[1], 0xffffff, .28, 3, .12);
    for (const tile of this.currentBattle?.stageEpoch?.tiles.values() ?? [])
      polygon(tile.row, tile.col, 0x9877d5, .22, 1, .04);
    for (const e of this.currentBattle?.stageMagicCircuit?.entries.values() ?? []) {
      if(e.spec.resonator)polygon(e.row,e.col,e.activated?0x40c9ff:0x6b7f99,e.activated?0.25:0.12,2,0.15);
      if(e.spec.reflector&&e.unit.alive&&e.unit.deployed){
        const height=this.heightAt(e.row,e.col)+0.05;
        const ends=FLUX_REFLECTOR_PORTS[e.unit.dir].map(dir=>{const [dr,dc]=dirVec(dir);
          return this.projection.project(e.col+dc*.42,e.row+dr*.42,height);});
        const center=this.projection.project(e.col,e.row,height);
        g.lineStyle(7,0xe7cb80,.9).moveTo(ends[0].x,ends[0].y).lineTo(center.x,center.y).lineTo(ends[1].x,ends[1].y);
      }
    }
    for (const route of this.currentBattle?.stageMagicCircuit?.field?.routes.values() ?? []) {
      g.lineStyle(5, 0x40c9ff, 0.75);
      for (const [i, cell] of route.path.entries()) {
        const p = this.projection.project(cell.col, cell.row, this.heightAt(cell.row, cell.col) + 0.04);
        if (i) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y);
      }
    }
    for (const {row, col} of this.data.stage.rules?.forbiddenLocations ?? []) {
      polygon(row, col, 0xd74b4b, 0.18, 1, 0.05);
      const points = this.corners(row, col, 0.22);
      g.lineStyle(3, 0xef7777, 0.9);
      for (const [a, b] of [[0, 2], [1, 3]]) g.moveTo(points[a].x, points[a].y).lineTo(points[b].x, points[b].y);
    }
    if (state.routes) {
      const seen = new Set();
      for (const path of Object.values(this.data.stage.pathing.paths)) {
        if (!path.points.length || seen.has(JSON.stringify(path.points)))
          continue;
        seen.add(JSON.stringify(path.points));
        g.lineStyle(2, 0xecad80, 0.8);
        path.points.forEach(([col, row], i) => {
          const p = this.projection.project(
            col,
            row,
            this.heightAt(row, col) + 0.025,
          );
          i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y);
        });
        for (const node of path.nodes) {
          const [col, row] = node,
            p = this.projection.project(
              col,
              row,
              this.heightAt(row, col) + 0.025,
            );
          g.lineStyle(1, 0xecad80, 0.9)
            .beginFill(0x10191d, 0.9)
            .drawCircle(p.x, p.y, 3)
            .endFill();
        }
      }
      for (const path of Object.values(this.data.stage.pathing.paths))
        for (const hold of path.holds) {
          const [col, row] = hold.point,
            p = this.projection.project(
              col,
              row,
              this.heightAt(row, col) + 0.025,
            );
          g.lineStyle(2, 0xedb857, 1).drawCircle(p.x, p.y, 7);
        }
    }
    for (const key of state.available || [])
      polygon(Math.floor(key / 21), key % 21, 0x72bd50, 0.38, 1, 0.025);
    const range = state.range || [];
    for (const key of range) {
      const row = Math.floor(key / 21),
        col = key % 21;
      if (row >= 0 && col >= 0 && row < geometry.rows && col < geometry.cols) {
        polygon(row, col, 0xffaf26, 0.12);
        for (const stripe of tileRangeStripes) {
          const points = stripe.map(([x, y]) => this.projection.project(col + x, row + y, this.heightAt(row, col) + .014));
          g.lineStyle(0).beginFill(0xffa51e, .55).drawPolygon(points.flatMap(p => [p.x, p.y])).endFill();
        }
      }
    }
    g.lineStyle(2, 0xf0bf63, 0.95);
    const corners = new Map();
    for (const edge of regionEdges(range, geometry.rows, geometry.cols)) {
      const h = this.heightAt(edge.row, edge.col) + 0.015;
      const a = this.projection.project(...edge.a, h),
        b = this.projection.project(...edge.b, h);
      g.moveTo(a.x, a.y).lineTo(b.x, b.y);
      for (const [world, screen] of [
        [edge.a, a],
        [edge.b, b],
      ]) {
        const key = world.join(",");
        if (!corners.has(key)) corners.set(key, []);
        corners.get(key).push(screen);
      }
    }
    // At a raised/ground boundary the same world corner projects to two heights.
    // Join the outside contour over the vertical step, without adding internal tile borders.
    for (const points of corners.values())
      if (points.length === 2) {
        const [a, b] = points;
        if (Math.hypot(a.x - b.x, a.y - b.y) > 0.1)
          g.moveTo(a.x, a.y).lineTo(b.x, b.y);
      }
    for (const tile of [state.chosen, this.focusTile])
      if (tile) polygon(tile.row, tile.col, 0xe3f2ee, 0.12, 2, 0.02);
  }
  drawPreview() {
    const chosen = this.overlay.chosen,
      id = this.overlay.operator;
    if (!chosen || !id) {
      this.preview?.actor.destroy();
      this.preview = null;
      return;
    }
    const key = `operator/${id}/default/${chosen.dir === "UP" ? "back" : "front"}`;
    if (this.preview?.key !== key) {
      this.preview?.actor.destroy();
      const loaded = this.preloaded.get(key);
      if (!loaded) return;
      const actor = new BattleActor(loaded.skeleton, loaded.entry);
      this.pixi.stage.addChild(actor.spine);
      actor.update(0.001);
      this.preview = { key, actor };
    }
    const p = this.projection.project(
      chosen.col,
      chosen.row,
      this.heightAt(chosen.row, chosen.col),
    );
    const spine = this.preview.actor.spine;
    spine.scale.set(((chosen.dir === "LEFT" ? -1 : 1) * p.s) / 400, p.s / 400);
    spine.position.set(p.x, p.y);
    spine.alpha = 0.7;
    spine.zIndex = 2000;
  }
  clear() {
    this.currentBattle = null;
    this.highlight();
    this.preview?.actor.destroy();
    this.preview = null;
    for (const v of this.views.values()) {
      v.actor.destroy();
      v.hp.destroy();
    }
    this.views.clear();
    this.effects = [];
    this.skillParticles?.clear();
    for (const pass of this.nativeEffectPasses()) pass.clear();
  }
  render(battle, dt, events, realDt = 0) {
    this.currentBattle = battle;
    // A non-actor effect pass may need the current visible Spine pose. Legacy
    // passes keep their existing update order unless they explicitly opt in.
    const nativePasses=this.nativeEffectPasses();
    for(const pass of nativePasses)if(pass.updateAfterActors!==true)pass.update(battle);
    this.drawSurface();
    this.drawPreview();
    this.onLayout?.();
    const operatorLabels = new Map();
    this.candleStatus.textContent = [
      battle?.enemies.some(e => e.alive && e.mem?.entelechiaHost) ? 'Heart Candle artwork: temporary marker' : '',
      battle?.inesState?.sentry ? 'Shadow Sentry artwork: temporary marker' : '',
      battle?.projectiles.list.some(p => p.data?.enemyTileTrigger) ? 'Enemy trap artwork: temporary markers' : '',
      battle?.stageEpoch?.tiles.size ? 'Mark of Epoch artwork: temporary tile overlay' : '',
      battle?.stageRevenant?.rows ? 'Beam artwork: temporary tile overlay' : '',
    ].filter(Boolean).join(' · ');
    if (battle) {
      const live = new Set();
      for (const u of battle.units) {
        if (!u.alive || u.mem.effectOnly) continue;
        live.add(u.id);
        // Reviewed original abilities can explicitly face the Front skeleton
        // while healing, even when the operator is deployed facing up.
        const back = u.side === "ally" && (u.mem?.regularVisualDirection ?? u.dir) === "UP"
          && u.mem?.regularAttackFacing !== "Front" && !u.mem?.regularFormVisual?.forceFront;
        let key = regularModelKey(u);
        const formVisual = u.mem?.regularFormVisual;
        // Some original back skeletons omit the outgoing substitute clips. The
        // source front skeleton contains them; use it only for that transition.
        if (back && formVisual?.clip && !this.preloaded.get(key)?.entry.animations?.[formVisual.clip]) {
          const front = `operator/${u.defId}/default/front`;
          if (this.preloaded.get(front)?.entry.animations?.[formVisual.clip]) key = front;
        }
        let view = this.views.get(u.id);
        const sameLife=!!view&&view.unit===u&&view.life===u.deploySeq;
        // Streamed models can arrive after a unit's fallback was created. The
        // model key and deployment are unchanged, but the actor must upgrade.
        const replacing = !!view && (view.key !== key || !sameLife
          || view.actor instanceof FallbackActor && this.preloaded.has(key));
        if (replacing) {
          view.actor.destroy(); view.hp.destroy(); this.views.delete(u.id); view = null;
        }
        if (!view) {
          const loaded = this.preloaded.get(key);
          const heartCandle = u.defId === 'enemy_5601_entlec' && u.mem?.entelechiaHost;
          const effectOnly = !!u.mem?.stageSurfaceOnly || nativePasses.some(pass => pass.isActor?.(u) === true);
          const skillIndex = this.data.operators[u.defId]?.skills.findIndex(skill => skill.id === u.skill?.id);
          const actor = effectOnly ? new EffectOnlyActor(P, { gaugeHeight: 280 })
            : heartCandle ? new HeartCandleActor(P)
            : loaded ? new BattleActor(loaded.skeleton, loaded.entry,
              skillIndex >= 0 ? skillIndex : null,
              { attackDrivenSkill: u.profile?.attackDrivenSkill === true })
            : new FallbackActor(u);
          const hp = new P.Graphics();
          this.pixi.stage.addChild(actor.spine, hp);
          if (!sameLife) actor.deploy();
          view = { actor, hp, key, unit:u, life:u.deploySeq };
          this.views.set(u.id, view);
        }
        view.unit = u;
        const gramophone = battle.stageGramophones?.entries.get(u.mem?.stageDeviceId);
        view.actor.setSide?.(gramophone?.control ?? u.side);
        const capture = battle.capturableStageDevices?.entries.get(u.mem?.stageDeviceId);
        if (capture) view.actor.spine.alpha = capture.state === 'rebooting' ? .45 : 1;
        // An owner may take its unit off the field visually without ending its life (Ch'en the Dawnstreak S2).
        view.actor.spine.visible = view.hp.visible = !u.mem?.regularHidden;
        if(u.mem?.stageSurfaceOnly)view.hp.visible=false;
        const point = this.projection.project(
          u.x,
          u.y,
          this.heightAt(Math.round(u.y), Math.round(u.x)) + regularVisualHeight(formVisual, battle.time),
        );
        // Common skeleton scale preserves the slug's smaller size relative to an operator.
        const scale = point.s / 400;
        view.facing = spriteFacing(u, view);
        view.actor.spine.scale.set(view.facing * scale, scale);
        view.actor.spine.position.set(point.x, point.y);
        view.actor.spine.zIndex = 1000 - point.y * -1;
        if (dt > 0)
          view.moving =
            view.x !== undefined &&
            Math.hypot(u.x - view.x, u.y - view.y) > 0.0001;
        if (u.side === "enemy")
          view.actor.setBase(view.moving ? "move" : "idle");
        view.actor.setSkill(
          !!u.skill?.active || battle.time < u.skillAnimUntil,
        );
        view.actor.setRegularSkin(u.mem?.regularSpineSkin);
        view.actor.setRegularVisual(formVisual);
        // A deployment's entrance may finish while the combat clock is paused. Attacks and skills never advance then.
        view.actor.update(dt || (view.actor.mode === "deploy" ? realDt : 0));
        view.x = u.x;
        view.y = u.y;
        view.hp.clear();
        const w = Math.max(24, Math.min(96, point.s * 0.5)),
          y = point.y - view.actor.gaugeHeight * scale,
          x = point.x - w / 2;
        if (!u.mem?.regularHideHp) {
          view.hp
            .beginFill(0x10191d, 0.9)
            .drawRect(x - 1, y - 1, w + 2, 6)
            .endFill();
          view.hp
            .beginFill(u.side === "ally" || u.mem?.regularModelFacing ? 0x64d5ae : 0xe27c66)
            .drawRect(x, y, w * Math.max(0, Math.min(1, u.hp / u.s.maxHp)), 4)
            .endFill();
        }
        const skill = u.side === "ally" || u.mem?.regularModelFacing ? skillHud(skillSourceFor(u)?.skill) : null;
        const ammo = u.side === 'enemy' ? u.mem?.enemyAmmo : null;
        if (capture?.state === 'rebooting') {
          const fraction = Math.max(0, Math.min(1, (battle.time - capture.activeAt) / capture.spec.duration));
          view.hp.beginFill(0x263238, .95).drawRect(x, y + 7, w, 4).endFill();
          view.hp.beginFill(0xffa235).drawRect(x, y + 7, w * fraction, 4).endFill();
        }
        if (ammo) {
          const gap = 2, width = Math.min(10, (w - (ammo.max - 1) * gap) / ammo.max);
          for (let i = 0; i < ammo.max; i++) view.hp
            .beginFill(i < ammo.current ? 0xffb454 : 0x263238, .95)
            .drawRect(x + i * (width + gap), y + 7, width, 4).endFill();
        }
        if (skill) {
          // The green SP gauge sits immediately below HP; orange counts down an active skill.
          view.hp
            .beginFill(0x10191d, 0.95)
            .drawRect(x - 1, y + 6, w + 2, 5)
            .endFill();
          view.hp
            .beginFill(skill.state === "overloaded" ? 0xf04c39 : skill.state === "active" ? 0xffa235 : 0x9bd538)
            .drawRect(x, y + 7, w * skill.fraction, 3)
            .endFill();
          if (skill.ready) {
            // Compact game-style ready diamond and lightning bolt. No pulsing while paused.
            const cy = y - 15,
              radius = Math.max(9, Math.min(13, point.s * 0.12));
            view.hp
              .lineStyle(1.5, 0x242820)
              .beginFill(skill.charged ? 0xf04c39 : 0xffd953)
              .drawPolygon([
                point.x, cy - radius,
                point.x + radius, cy,
                point.x, cy + radius,
                point.x - radius, cy,
              ])
              .endFill()
              .lineStyle(0);
            view.hp
              .beginFill(0x242820)
              .drawPolygon([
                point.x + radius * 0.15, cy - radius * 0.65,
                point.x - radius * 0.4, cy + radius * 0.05,
                point.x - radius * 0.02, cy + radius * 0.05,
                point.x - radius * 0.15, cy + radius * 0.65,
                point.x + radius * 0.4, cy - radius * 0.12,
                point.x + radius * 0.04, cy - radius * 0.12,
              ])
              .endFill();
          }
        }
        const ammunition = u.side === 'ally' ? ammunitionHud(u) : null;
        if (ammunition) {
          const top = y + (skill ? 13 : 6), segment = w / ammunition.maximum;
          for (let i = 0; i < ammunition.maximum; i++) view.hp
            .beginFill(i < ammunition.current ? 0x63c7ef : 0x243a43, .95)
            .drawRect(x + i * segment, top, Math.max(1, segment - 1), 3)
            .endFill();
        }
        view.hp.zIndex = 3000;
        if (u.side === "ally")
          operatorLabels.set(
            `${u.tileR},${u.tileC}`,
            `${u.name}, row ${u.tileR + 1}, column ${u.tileC + 1}. ${skill?.text || (u.skill?.noSkill ? "No skills" : "Passive skill")}${ammunition ? `. ${ammunition.text}` : ''}`,
          );
      }
      for (const [id, v] of this.views)
        if (!live.has(id)) {
          if (v.dying === undefined) {
            const death = v.unit?.mem?.regularDeathVisual;
            if (death?.hide) v.actor.spine.visible = false;
            if (death?.die) v.actor.setRegularVisual(death);
            v.deathDuration = Number.isFinite(death?.duration) && death.duration > 0 ? death.duration : 0.6;
            v.dying = v.deathDuration;
            v.actor.die();
            v.hp.clear();
          }
          v.dying -= dt || realDt;
          v.actor.update(dt || realDt);
          v.actor.spine.alpha = Math.max(0, v.dying / v.deathDuration);
          if (v.dying > 0) continue;
          v.actor.destroy();
          v.hp.destroy();
          this.views.delete(id);
        }
      for (const ev of events) {
        if (ev[0] === "skill" && ev[2] === 1) {
          const unit = battle.units.find(u => u.id === ev[1]);
          if (unit) this.skillParticles?.trigger(unit);
        }
        if (ev[0] !== "atk") continue;
        const v = this.views.get(ev[1]);
        const u = battle.units.find((u) => u.id === ev[1]),
          target = battle.units.find((u) => u.id === ev[2]);
        v?.actor.attack(u?.s.interval || 1, false, ev[4]);
        if (u && target && u.def.position === "RANGED" && !ev[4]?.projectile)
          this.effects.push({
            source: u,
            target,
            age: 0,
            heal: u.def.dmgType === "heal",
          });
      }
    }
    for (const t of this.tiles) {
      if (!t.button) continue;
      const label = (battle?.stageScenery?.brokenStumps.has(`${t.row},${t.col}`) ? "Destroyed stump. Deployment prohibited. " :
        battle?.stageForbiddenTiles?.has(`${t.row},${t.col}`) ? "Deployment prohibited. " : "") + (operatorLabels.get(`${t.row},${t.col}`) ||
        `${t.label}, row ${t.row + 1}, column ${t.col + 1}`);
      if (t.button.getAttribute("aria-label") !== label)
        t.button.setAttribute("aria-label", label);
    }
    if (!this.fx) {
      this.fx = new P.Graphics();
      this.fx.zIndex = 4000;
      this.pixi.stage.addChild(this.fx);
    }
    this.fx.clear();
    for (const { row, col } of battle?.stageScenery?.brokenStumps.values() ?? []) {
      const points = [[-.38, -.38], [.38, -.38], [.38, .38], [-.38, .38]]
        .map(([x, y]) => this.projection.project(col + x, row + y, this.heightAt(row, col) + .025));
      this.fx.lineStyle(2, 0x94745c, .9).beginFill(0x302622, .92)
        .drawPolygon(points.flatMap(p => [p.x, p.y])).endFill();
      this.fx.lineStyle(2, 0xd8a079, .9).moveTo(points[0].x, points[0].y).lineTo(points[2].x, points[2].y)
        .moveTo(points[1].x, points[1].y).lineTo(points[3].x, points[3].y).lineStyle(0);
    }
    // Shared controller geometry supplies a lightweight fallback visual; no
    // per-stage copies of the native coil artwork or simulation clocks.
    for (const beam of battle?.electricCoils?.beams ?? []) {
      if (beam.remaining <= 0 || !beam.target.alive) continue;
      const a = this.projection.project(beam.source.x, beam.source.y, this.heightAt(beam.source.tileR, beam.source.tileC) + .45);
      const z = this.projection.project(beam.target.x, beam.target.y, this.heightAt(beam.target.tileR, beam.target.tileC) + .45);
      this.fx.lineStyle(7, 0x65dce8, .25).moveTo(a.x, a.y).lineTo(z.x, z.y)
        .lineStyle(2, 0xc2faff, .95).moveTo(a.x, a.y).lineTo(z.x, z.y).lineStyle(0);
    }
    const sentry = battle?.inesState?.sentry;
    if (sentry) {
      const p = this.projection.project(sentry.x, sentry.y,
        this.heightAt(Math.round(sentry.y), Math.round(sentry.x)) + .12);
      const r = Math.max(5, Math.min(11, p.s * .13));
      // Keep the persistent managed projectile visible without fabricating a
      // summon, HP/SP bar, deployment card or original Unity particle artwork.
      this.fx.lineStyle(1.5, 0xe9caa2, .95).beginFill(0x20212d, .9)
        .drawPolygon([p.x, p.y-r*1.7, p.x+r*.6, p.y, p.x, p.y+r*.5, p.x-r*.6, p.y])
        .endFill().lineStyle(0);
    }
    this.effects = this.effects.filter((e) => (e.age += dt) < 0.22);
    for (const e of this.effects) {
      const a = this.projection.project(
          e.source.x,
          e.source.y,
          this.heightAt(e.source.tileR, e.source.tileC) + 0.6,
        ),
        b = this.projection.project(e.target.x, e.target.y, 0.5);
      const t = Math.min(1, e.age / 0.22);
      this.fx
        .beginFill(e.heal ? 0x80e4b2 : 0xfbd29a, 0.85)
        .drawCircle(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 3)
        .endFill();
    }
    // Source-timed projectile markers use the authoritative combat position and
    // remain visible through the actual dwell window, including after retreat.
    for (const projectile of (battle?.projectiles.list ?? []).filter(p => p.data?.enemyTileTrigger)) {
      const {row,col,armed}=projectile.data.enemyTileTrigger;
      const point=this.projection.project(col,row,this.heightAt(row,col)+.03),radius=point.s*.22;
      this.fx.lineStyle(2,armed?0xff735e:0xdfbd77,.9).beginFill(0x4b201d,.35)
        .drawEllipse(point.x,point.y,radius,radius*.5).endFill().lineStyle(0);
    }
    for (const projectile of [
      ...(battle?.projectiles.list ?? []).filter(p => p.data?.arkpediaTrackedVisual),
      ...(battle?.regularVisualProjectiles ?? []),
      ...(battle?.civilightParticles ?? []),
      ...(battle?.reedFireballs ?? []),
    ]) {
      const point = this.projection.project(projectile.x, projectile.y,
        this.heightAt(Math.round(projectile.y), Math.round(projectile.x)) + 0.5);
      this.fx.beginFill(projectile.color ?? 0xfbd29a, 0.85).drawCircle(point.x, point.y, 3).endFill();
    }
    for(const pass of nativePasses)if(pass.updateAfterActors===true)pass.update(battle);
    this.gates?.update(battle?.time ?? 0);
    this.skillParticles?.render(battle?.time ?? 0, this.projection, this.heightAt);
    this.three.render(this.scene, this.camera);
    for(const pass of nativePasses)pass.render(this.three, this.camera);
    this.pixi.renderer.render(this.pixi.stage);
  }
  destroy() {
    this.destroyed = true;
    this.gates?.group.removeFromParent();
    this.gates?.dispose();
    this.art?.dispose();
    this.art?.group.removeFromParent();
    this.artStatus.remove();
    this.observer.disconnect();
    this.clear();
    for (const pass of this.nativeEffectPasses()) pass.dispose();
    this.skillParticles?.dispose();
    for (const v of this.preloaded.values()) models.spine.release(v.entry);
    this.preloaded.clear();
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    this.three.dispose();
    this.pixi.destroy(true, {
      children: true,
      texture: false,
      baseTexture: false,
    });
  }
}
