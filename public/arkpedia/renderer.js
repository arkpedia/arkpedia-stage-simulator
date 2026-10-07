// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from "/vendor/three.module.js";
import { fitCamera, syncThreeCamera, pickTile } from "/js/render/projection.js";
import { BattleActor } from "./battle-actor.js";
import { createAssets } from "/js/assets.js";
import { regionEdges } from "/shared/arkpedia/placement.js";
import { spriteFacing } from "/shared/arkpedia/facing.js";
import { skillHud } from "/shared/arkpedia/skill-hud.js";
import { loadStageArt } from "./stage-art.js";
import { loadGates } from "./gates.js";
import { loadSkillParticles, SkillParticleLayer } from "./particles.js";
const P = globalThis.PIXI;
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
  constructor(host, data, onPick) {
    this.host = host;
    this.data = data;
    this.views = new Map();
    this.preloaded = new Map();
    this.effects = [];
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
    this.heightAt = (r, c) => (g.tileGrid[r]?.[c] === 1 ? 0.38 : 0);
    for (let row = 0; row < g.rows; row++)
      for (let col = 0; col < g.cols; col++) {
        const type = g.tileGrid[row][col];
        const height = this.heightAt(row, col);
        const color = ["#172329", "#59666b", "#35464b", "#aa4b40", "#377787"][
          type
        ];
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.97, 0.97, 0.18 + height),
          new THREE.MeshStandardMaterial({ color, roughness: 0.92 }),
        );
        mesh.position.set(col, row, (height - 0.18) / 2);
        this.scene.add(mesh);
        this.tiles.push({ mesh, row, col, type, color });
        if (type === 1 || type === 2) {
          const button = document.createElement("button");
          button.className = "tile-hit";
          button.type = "button";
          button.setAttribute(
            "aria-label",
            `${type === 1 ? "Raised" : "Ground"} tile, row ${row + 1}, column ${col + 1}`,
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
    const m = this.data.sd.models[key];
    if (!m) throw Error("Missing animation model " + key);
    const base = `https://raw.githubusercontent.com/${this.data.sd.repository}/${this.data.sd.commit}/`;
    return {
      skel: base + m.skeleton.path,
      atlas: base + m.atlas.path,
      textures: m.textures.map((t) => base + t.path),
      pma: m.premultipliedAlpha,
      anims: m.animationRoles,
      animations: m.animations,
      hits: m.hits,
      bounds: m.bounds,
    };
  }
  async preload(ids, onProgress) {
    const keys = [
      ...ids.flatMap((id) =>
        ["front", "back"].map((f) => `operator/${id}/default/${f}`),
      ),
      ...Object.keys(this.data.enemies).map(
        (id) => `enemy/${id}/default/default`,
      ),
    ];
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
      { width, height, padding: { top: 12, bottom: 12, left: 8, right: 8 } },
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
    this.render(null, 0, []);
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
      polygon(Math.floor(key / 21), key % 21, 0xb5ded3, 0.1, 1, 0.055);
    const range = state.range || [];
    for (const key of range) {
      const row = Math.floor(key / 21),
        col = key % 21;
      if (row < geometry.rows && col < geometry.cols)
        polygon(row, col, 0xf0bf63, 0.16);
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
  }
  render(battle, dt, events, realDt = 0) {
    this.drawSurface();
    this.drawPreview();
    this.onLayout?.();
    const operatorLabels = new Map();
    if (battle) {
      const live = new Set();
      for (const u of battle.units) {
        if (!u.alive) continue;
        live.add(u.id);
        const back = u.side === "ally" && u.dir === "UP";
        const key =
          u.side === "ally"
            ? `operator/${u.defId}/default/${back ? "back" : "front"}`
            : `enemy/${u.defId}/default/default`;
        let view = this.views.get(u.id);
        if (!view) {
          const loaded = this.preloaded.get(key);
          if (!loaded) continue;
          const skillIndex = this.data.operators[u.defId]?.skills.findIndex(skill => skill.id === u.skill?.id);
          const actor = new BattleActor(loaded.skeleton, loaded.entry,
            skillIndex >= 0 ? skillIndex : null,
            { attackDrivenSkill: u.profile?.attackDrivenSkill === true });
          const hp = new P.Graphics();
          this.pixi.stage.addChild(actor.spine, hp);
          actor.deploy();
          view = { actor, hp, key };
          this.views.set(u.id, view);
        }
        const point = this.projection.project(
          u.x,
          u.y,
          this.heightAt(Math.round(u.y), Math.round(u.x)),
        );
        const bound = view.actor.entry.bounds;
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
        // A deployment's entrance may finish while the combat clock is paused. Attacks and skills never advance then.
        view.actor.update(dt || (view.actor.mode === "deploy" ? realDt : 0));
        view.x = u.x;
        view.y = u.y;
        view.hp.clear();
        const w = Math.max(24, Math.min(96, point.s * 0.5)),
          y = point.y - (bound?.height || 380) * scale,
          x = point.x - w / 2;
        view.hp
          .beginFill(0x10191d, 0.9)
          .drawRect(x - 1, y - 1, w + 2, 6)
          .endFill();
        view.hp
          .beginFill(u.side === "ally" ? 0x64d5ae : 0xe27c66)
          .drawRect(x, y, w * Math.max(0, Math.min(1, u.hp / u.s.maxHp)), 4)
          .endFill();
        const skill = u.side === "ally" ? skillHud(u.skill) : null;
        if (skill) {
          // The green SP gauge sits immediately below HP; orange counts down an active skill.
          view.hp
            .beginFill(0x10191d, 0.95)
            .drawRect(x - 1, y + 6, w + 2, 5)
            .endFill();
          view.hp
            .beginFill(skill.state === "active" ? 0xffa235 : 0x9bd538)
            .drawRect(x, y + 7, w * skill.fraction, 3)
            .endFill();
          if (skill.ready) {
            // Compact game-style ready diamond and lightning bolt. No pulsing while paused.
            const cy = y - 15,
              radius = Math.max(9, Math.min(13, point.s * 0.12));
            view.hp
              .lineStyle(1.5, 0x242820)
              .beginFill(0xffd953)
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
        view.hp.zIndex = 3000;
        if (u.side === "ally")
          operatorLabels.set(
            `${u.tileR},${u.tileC}`,
            `${u.name}, row ${u.tileR + 1}, column ${u.tileC + 1}. ${skill?.text || (u.skill?.noSkill ? "No skills" : "Passive skill")}`,
          );
      }
      for (const [id, v] of this.views)
        if (!live.has(id)) {
          if (v.dying === undefined) {
            v.dying = 0.6;
            v.actor.die();
            v.hp.clear();
          }
          v.dying -= dt || realDt;
          v.actor.update(dt || realDt);
          v.actor.spine.alpha = Math.max(0, v.dying / 0.6);
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
      const label = operatorLabels.get(`${t.row},${t.col}`) ||
        `${t.type === 1 ? "Raised" : "Ground"} tile, row ${t.row + 1}, column ${t.col + 1}`;
      if (t.button.getAttribute("aria-label") !== label)
        t.button.setAttribute("aria-label", label);
    }
    if (!this.fx) {
      this.fx = new P.Graphics();
      this.fx.zIndex = 4000;
      this.pixi.stage.addChild(this.fx);
    }
    this.fx.clear();
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
    for (const projectile of [
      ...(battle?.projectiles.list ?? []).filter(p => p.data?.arkpediaTrackedVisual),
      ...(battle?.regularVisualProjectiles ?? []),
    ]) {
      const point = this.projection.project(projectile.x, projectile.y,
        this.heightAt(Math.round(projectile.y), Math.round(projectile.x)) + 0.5);
      this.fx.beginFill(0xfbd29a, 0.85).drawCircle(point.x, point.y, 3).endFill();
    }
    this.gates?.update(battle?.time ?? 0);
    this.skillParticles?.render(battle?.time ?? 0, this.projection, this.heightAt);
    this.three.render(this.scene, this.camera);
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
