// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from "/vendor/three.module.js";
import { fitCamera, syncThreeCamera, pickTile } from "/js/render/projection.js";
import { SpineActor } from "/js/render/spine.js";
import { createAssets } from "/js/assets.js";
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
    this.scene.add(new THREE.HemisphereLight(0xcce2e4, 0x33454a, 2.2));
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
        if (type === 3 || type === 4) {
          const ring = new THREE.Mesh(
            new THREE.BoxGeometry(0.72, 0.72, 0.025),
            new THREE.MeshBasicMaterial({
              color: type === 3 ? 0xf37862 : 0x63cde3,
              wireframe: true,
            }),
          );
          ring.position.set(col, row, 0.035);
          this.scene.add(ring);
        }
        if (type === 1 || type === 2) {
          const button = document.createElement("button");
          button.className = "tile-hit";
          button.type = "button";
          button.setAttribute(
            "aria-label",
            `${type === 1 ? "Raised" : "Ground"} tile, row ${row + 1}, column ${col + 1}`,
          );
          button.onclick = () => this.onPick(row, col);
          this.controls.append(button);
          this.tiles.at(-1).button = button;
        }
      }
    this.onPick = onPick;
    host.addEventListener("pointerup", (e) => {
      if (e.target.closest("button")) return;
      const rect = host.getBoundingClientRect();
      const tile = pickTile(
        this.projection,
        e.clientX - rect.left,
        e.clientY - rect.top,
        this.heightAt,
        [0.38, 0],
        g.rows,
        g.cols,
      );
      if (tile) onPick(tile.row, tile.col);
    });
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.resize();
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
        const p = this.projection.project(
          tile.col,
          tile.row,
          this.heightAt(tile.row, tile.col),
        );
        Object.assign(tile.button.style, {
          left: `${p.x - p.s * 0.36}px`,
          top: `${p.y - p.s * 0.25}px`,
          width: `${p.s * 0.72}px`,
          height: `${p.s * 0.5}px`,
        });
      }
    this.render(null, 0, []);
  }
  highlight(keys = [], chosen = null) {
    const set = new Set(keys);
    for (const t of this.tiles) {
      t.mesh.material.color.set(
        chosen?.row === t.row && chosen?.col === t.col
          ? "#bba574"
          : set.has(t.row * 21 + t.col)
            ? "#528681"
            : t.color,
      );
    }
  }
  clear() {
    for (const v of this.views.values()) {
      v.actor.destroy();
      v.hp.destroy();
    }
    this.views.clear();
    this.effects = [];
  }
  render(battle, dt, events, realDt = 0) {
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
          const actor = new SpineActor(loaded.skeleton, loaded.entry);
          actor.clipPerAttack = u.side === "enemy";
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
        view.actor.spine.scale.set((u.dir === "LEFT" ? -1 : 1) * scale, scale);
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
        const w = point.s * 0.5,
          y = point.y - (bound?.height || 380) * scale;
        view.hp
          .beginFill(0x10191d, 0.9)
          .drawRect(point.x - w / 2, y, w, 4)
          .endFill();
        view.hp
          .beginFill(u.side === "ally" ? 0x64d5ae : 0xe27c66)
          .drawRect(point.x - w / 2, y, w * Math.max(0, u.hp / u.s.maxHp), 4)
          .endFill();
        view.hp.zIndex = 3000;
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
        if (ev[0] !== "atk") continue;
        const v = this.views.get(ev[1]);
        const u = battle.units.find((u) => u.id === ev[1]),
          target = battle.units.find((u) => u.id === ev[2]);
        v?.actor.attack(u?.s.interval || 1, u?.side === "enemy");
        if (u && target && u.def.position === "RANGED")
          this.effects.push({
            source: u,
            target,
            age: 0,
            heal: u.def.dmgType === "heal",
          });
      }
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
    this.three.render(this.scene, this.camera);
    this.pixi.renderer.render(this.pixi.stage);
  }
  destroy() {
    this.observer.disconnect();
    this.clear();
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
