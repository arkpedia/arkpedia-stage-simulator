// SPDX-License-Identifier: GPL-3.0-or-later
import { StandardBattle } from "/sim/arkpedia.js";
import {
  catalogueFor,
  defaultBuild,
  recordFor,
} from "/shared/arkpedia/loadout.js";
import { StageRenderer } from "./renderer.js";
import { absoluteRangeKeys } from "/sim/targeting.js";
import { facingAt } from "/shared/arkpedia/placement.js";
import { skillHud } from "/shared/arkpedia/skill-hud.js";
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const app = document.querySelector("#app");
let renderer,
  battle,
  workspace,
  selected,
  pending,
  paused = true,
  speed = 1,
  accumulator = 0,
  last = performance.now(),
  lastHud = 0;
let loading = false,
  viewport = "preview",
  battleError = "",
  selection,
  dragging = null,
  aimPointer = null,
  showRoutes = false;
const response = await fetch("/data/arkpedia-mvp.json");
if (!response.ok) throw Error("Stage data unavailable");
const data = await response.json();
const catalogue = catalogueFor(data);
const ops = Object.values(data.operators);
const icon = (op) =>
  `https://raw.githubusercontent.com/arkpedia/arkpedia-image-assets/${data.sources["arkpedia/arkpedia-image-assets"]}/three-star-icons/${encodeURIComponent(op.name + " - Base.webp")}`;
const builds = Object.fromEntries(ops.map((o) => [o.id, defaultBuild(o)]));
const chosen = new Set(ops.slice(0, 5).map((o) => o.id));
let editing = ops[0].id,
  supportId = "";
const requested = new URLSearchParams(location.search).get("stage");
if (requested && requested !== "0-1") {
  app.innerHTML =
    '<div class="frame"><h1>Stage not supported yet</h1><p class="notice">This MVP supports 0-1 Collapse. Additional stages need validated combat mechanics before they can be simulated.</p><a href="/arkpedia/">Open 0-1</a></div>';
  throw Error("Unsupported stage selection");
}
function prep() {
  app.innerHTML = `<div class="frame"><header class="topline"><div><p class="eyebrow">Arkpedia · prototype</p><h1>Stage simulator</h1></div><span class="muted">0-1 Collapse</span></header>
 <div class="prep"><section class="preview"><div class="stage-title"><span class="stage-code">0-1</span><h2>Collapse</h2></div><p class="help">${escape(data.stage.description)}</p><div class="board" id="board"></div><div class="legend"><span class="spawn">Enemy entry</span><span class="goal">Defence objective</span><span>Raised tiles: ranged operators</span></div>
 <div class="panel help"><h3>How to play</h3><p>Choose your squad, then open the battle workspace. Drag an operator onto a tile, then choose its facing on the map. You can also select the operator and click a tile. Select a deployed operator to activate a ready skill or retreat.</p></div>
 <p class="notice">This first slice supports 0-1 and the six operators shown. Squad capacity is 12 + one distinct maxed support; the MVP roster is limited to these six. Modules, other stages and the rest of the roster are still being built.</p></section>
 <section class="panel"><h2>Prepare your squad</h2><p class="help">Select an operator to adjust their build.</p><div class="roster" id="roster"></div><div id="build"></div><label class="support">Support · optional, fully maxed<select id="support"><option value="">No support</option></select></label><div class="prepare-actions"><button class="primary" id="start">Open battle workspace</button></div><p class="error" id="prep-error" role="status" aria-live="polite"></p></section></div>
 <footer>Built on Stronghold Protocol · GPL-3.0-or-later. Unofficial fan simulator; timings are not yet verified frame-for-frame against the game.<div class="links"><a href="https://github.com/arkpedia/arkpedia-stage-simulator" target="_blank" rel="noreferrer">Simulator source</a><a href="https://github.com/arkpedia/arkpedia-sd-assets" target="_blank" rel="noreferrer">Chibi assets & credits</a></div></footer></div>`;
  renderer = new StageRenderer(
    document.querySelector("#board"),
    data,
    () => {},
  );
  document
    .querySelector("#support")
    .addEventListener("change", (e) => (supportId = e.target.value));
  document.querySelector("#start").addEventListener("click", start);
  renderPrep();
}
function renderPrep() {
  const op = data.operators[editing],
    b = builds[editing];
  document.querySelector("#roster").innerHTML = ops
    .map(
      (o) =>
        `<button class="roster-item ${chosen.has(o.id) ? "chosen" : ""} ${editing === o.id ? "editing" : ""}" data-id="${o.id}" aria-label="Edit ${o.name}, ${chosen.has(o.id) ? "in squad" : "not in squad"}" aria-pressed="${editing === o.id}"><img src="${icon(o)}" alt=""><span>${o.name}<br><small>${chosen.has(o.id) ? "In squad" : "Not selected"}</small></span></button>`,
    )
    .join("");
  document.querySelectorAll(".roster-item").forEach(
    (el) =>
      (el.onclick = () => {
        editing = el.dataset.id;
        renderPrep();
      }),
  );
  document.querySelector("#build").innerHTML =
    `<div class="build-heading"><h3>${op.name}</h3><button id="toggle">${chosen.has(editing) ? "Remove from squad" : "Add to squad"}</button></div><div class="build-form">
 <label>Elite<select id="elite"><option value="0" ${b.elite === 0 ? "selected" : ""}>E0</option><option value="1" ${b.elite === 1 ? "selected" : ""}>E1</option></select></label>
 <label>Level<input id="level" type="number" min="1" max="${op.phases[b.elite].maxLevel}" value="${b.level}"></label>
 <label>Skill rank<input id="skillRank" type="number" min="1" max="${b.elite ? 7 : 4}" value="${b.skillRank}"></label>
 <label>Potential<input id="potential" type="number" min="1" max="6" value="${b.potential}"></label>
 <label>Trust %<input id="trust" type="number" min="0" max="200" value="${b.trust}"></label></div><p class="help" style="margin-top:12px">${escape(op.skills[0].levels[b.skillRank - 1].name)} · ${op.skills[0].levels[b.skillRank - 1].skillType === "MANUAL" ? "Manual activation" : "Auto activation"}</p>`;
  document.querySelector("#toggle").onclick = () => {
    chosen.has(editing) ? chosen.delete(editing) : chosen.add(editing);
    if (chosen.has(supportId)) supportId = "";
    renderPrep();
  };
  for (const field of ["elite", "level", "skillRank", "potential", "trust"])
    document.querySelector("#" + field).onchange = (e) => {
      const previous = b[field],
        value = Number(e.target.value);
      b[field] = value;
      if (field === "elite") {
        b.level = Math.min(b.level, op.phases[value]?.maxLevel ?? 1);
        b.skillRank = Math.min(b.skillRank, value ? 7 : 4);
      }
      try {
        recordFor(b, data);
        document.querySelector("#prep-error").textContent = "";
      } catch (err) {
        b[field] = previous;
        document.querySelector("#prep-error").textContent = err.message;
      }
      renderPrep();
    };
  const support = document.querySelector("#support");
  support.innerHTML =
    '<option value="">No support</option>' +
    ops
      .filter((o) => !chosen.has(o.id))
      .map(
        (o) =>
          `<option value="${o.id}" ${supportId === o.id ? "selected" : ""}>${o.name} · E1 Lv55 / S1 rank 7 / Pot6 / trust 200%</option>`,
      )
      .join("");
  document.querySelector("#start").disabled = chosen.size === 0 || loading;
}
async function start() {
  if (loading) return;
  loading = true;
  renderPrep();
  const status = document.querySelector("#prep-error");
  status.textContent = "Loading selected chibi animations…";
  try {
    selection = {
      operators: [...chosen].map((id) => builds[id]),
      support: supportId
        ? { id: supportId, skillId: builds[supportId].skillId }
        : null,
    };
    await renderer.preload(
      [...chosen, ...(supportId ? [supportId] : [])],
      (n, total) => {
        status.textContent = `Loading chibi animations ${n}/${total}…`;
      },
    );
    battle = new StandardBattle(data, selection, { seed: Date.now() });
    workspace = document.createElement("section");
    workspace.className = "workspace";
    workspace.setAttribute("aria-label", "Battle workspace");
    workspace.innerHTML = `<header class="battle-header"><div class="stage-title"><span class="stage-code">0-1</span><h2>Collapse</h2></div><div class="hud" id="hud"></div><div class="battle-controls"><button id="routes" aria-pressed="false">Paths</button><button id="pause">Pause</button><button id="speed">1×</button><button id="restart">Restart</button><button id="exit">Exit</button></div></header><div class="board battle-board" id="battle-board"><span class="pause-label" id="paused-label" hidden>Paused</span></div><div class="command" id="command"></div><div class="deployment-wrap"><button id="shelf-left" aria-label="Scroll operators left">‹</button><div class="deployment" id="deployment"></div><button id="shelf-right" aria-label="Scroll operators right">›</button></div><p class="status-note" id="battle-message" role="status" aria-live="polite"></p>`;
    document.body.append(workspace);
    const board = workspace.querySelector("#battle-board");
    // Move canvases to a full-viewport battle container; preview has no deployment handler.
    renderer.observer.unobserve(renderer.host);
    renderer.host = board;
    board.prepend(
      renderer.three.domElement,
      renderer.pixi.view,
      renderer.controls,
    );
    renderer.observer.observe(board);
    renderer.onPick = pick;
    renderer.controls.inert = false;
    const picker = document.createElement("div");
    picker.className = "facing-picker";
    picker.hidden = true;
    picker.innerHTML = `<svg aria-hidden="true" viewBox="-100 -100 200 200"><path class="facing-frame" d="M0 -92L92 0L0 92L-92 0Z"/>${[
      ["UP", "M0 -88L42 -42L0 -22L-42 -42Z"],
      ["RIGHT", "M88 0L42 42L22 0L42 -42Z"],
      ["DOWN", "M0 88L-42 42L0 22L42 42Z"],
      ["LEFT", "M-88 0L-42 -42L-22 0L-42 42Z"],
    ]
      .map(([dir, path]) => `<path data-cone="${dir}" d="${path}"/>`)
      .join("")}</svg>
    ${[
      ["UP", "↑"],
      ["RIGHT", "→"],
      ["DOWN", "↓"],
      ["LEFT", "←"],
    ]
      .map(
        ([dir, glyph]) =>
          `<button data-facing="${dir}" aria-label="Deploy facing ${dir.toLowerCase()}">${glyph}</button>`,
      )
      .join("")}
    <button class="facing-cancel" aria-label="Cancel placement">×</button>`;
    board.append(picker);
    for (const button of picker.querySelectorAll("[data-facing]")) {
      button.onpointerenter = button.onfocus = () => {
        if (pending) {
          pending.dir = button.dataset.facing;
          drawHud();
        }
      };
      button.onclick = () => confirmFacing(button.dataset.facing);
    }
    picker.querySelector(".facing-cancel").onclick = () => {
      pending = null;
      drawHud();
    };
    // Pointer capture lets touch users drag out of the centre to aim. A cancelled gesture never deploys.
    board.onpointerdown = (e) => {
      if (!pending || e.target.closest("button:not(.facing-cancel)")) return;
      e.preventDefault();
      aimPointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
      board.setPointerCapture(e.pointerId);
    };
    board.onpointermove = (e) => {
      if (!pending || e.target.closest("[data-facing]")) return;
      const dir = facingAt(
        renderer.worldAt(e.clientX, e.clientY, pending),
        pending,
      );
      if (pending.dir !== dir) {
        pending.dir = dir;
        drawHud();
      }
    };
    board.onpointerup = (e) => {
      if (aimPointer?.id === e.pointerId) {
        const moved =
          Math.hypot(e.clientX - aimPointer.x, e.clientY - aimPointer.y) > 6;
        aimPointer = null;
        if (!pending) return;
        const dir = facingAt(
          renderer.worldAt(e.clientX, e.clientY, pending),
          pending,
        );
        if (dir) confirmFacing(dir);
        else if (!moved) {
          pending = null;
          drawHud();
        }
        return;
      }
      if (pending || e.target.closest("button")) return;
      const tile = renderer.pickAt(e.clientX, e.clientY);
      if (tile) pick(tile.row, tile.col);
    };
    board.onpointercancel = () => {
      aimPointer = null;
      pending = null;
      drawHud();
    };
    renderer.onLayout = layoutFacing;
    workspace.querySelector("#routes").onclick = (e) => {
      showRoutes = !showRoutes;
      e.currentTarget.setAttribute("aria-pressed", String(showRoutes));
      e.currentTarget.classList.toggle("active", showRoutes);
      drawHud();
    };
    workspace.querySelector("#pause").onclick = () => {
      paused = !paused;
      drawHud();
    };
    workspace.querySelector("#speed").onclick = () => {
      speed = speed === 1 ? 2 : 1;
      workspace.querySelector("#speed").textContent = speed + "×";
    };
    workspace.querySelector("#restart").onclick = restart;
    workspace.querySelector("#exit").onclick = exit;
    workspace.querySelector("#shelf-left").onclick = () =>
      workspace
        .querySelector("#deployment")
        .scrollBy({ left: -180, behavior: "smooth" });
    workspace.querySelector("#shelf-right").onclick = () =>
      workspace
        .querySelector("#deployment")
        .scrollBy({ left: 180, behavior: "smooth" });
    viewport = "fullscreen-workspace";
    battle.setViewport(viewport);
    paused = true;
    accumulator = 0;
    app.inert = true;
    app.hidden = true;
    // Native fullscreen is optional; the viewport workspace remains the supported fallback (e.g. iOS).
    try {
      if (
        window.matchMedia("(min-width: 761px)").matches &&
        window.self === window.top
      )
        await workspace.requestFullscreen?.();
      if (document.fullscreenElement === workspace)
        viewport = "native-fullscreen";
    } catch {}
    battle.setViewport(viewport);
    renderer.resize();
    drawHud();
    workspace.querySelector("#pause").focus();
  } catch (error) {
    status.textContent = "Could not start: " + error.message;
    console.error(error);
  } finally {
    loading = false;
    if (!workspace) renderPrep();
  }
}
function restart() {
  workspace.querySelector("#deployment").innerHTML = "";
  battle = new StandardBattle(data, selection, { seed: Date.now() });
  battle.setViewport(viewport);
  paused = true;
  accumulator = 0;
  cancelPlacement();
  battleError = "";
  renderer.clear();
  workspace.querySelector(".result")?.remove();
  drawHud();
}
async function exit() {
  paused = true;
  battle?.setViewport("preview");
  viewport = "preview";
  if (document.fullscreenElement)
    await document.exitFullscreen().catch(() => {});
  cancelPlacement();
  renderer.destroy();
  workspace.remove();
  app.inert = false;
  app.hidden = false;
  workspace = null;
  battle = null;
  selected = null;
  pending = null;
  prep();
  document.querySelector("#start").focus();
}
function pick(row, col) {
  if (!battle || battle.finished) return;
  battleError = "";
  if (selected && !battle.bench[selected].unit?.alive) {
    const error = battle.placementError(selected, row, col);
    if (error) battleError = error;
    else pending = { row, col, dir: null };
  } else {
    const unit = battle.allyUnits.find(
      (u) => u.alive && u.tileR === row && u.tileC === col,
    );
    selected = unit?.defId ?? null;
    pending = null;
  }
  drawHud();
}
function drawHud() {
  if (!workspace || !battle) return;
  workspace.querySelector("#hud").innerHTML =
    `<span>DP<strong>${Math.floor(battle.dp)}</strong></span><span>Life<strong>${battle.life}</strong></span><span>Enemies<strong>${battle.killed + battle.leakedCount}/${battle.total}</strong></span><span class="muted">${Math.floor(battle.time / 60)}:${String(Math.floor(battle.time % 60)).padStart(2, "0")}</span>`;
  workspace.querySelector("#pause").textContent = paused
    ? battle.time === 0
      ? "Start"
      : "Resume"
    : "Pause";
  workspace.querySelector("#paused-label").hidden = !paused || battle.finished;
  const shelf = workspace.querySelector("#deployment");
  if (!shelf.children.length) {
    shelf.innerHTML = Object.keys(battle.bench)
      .map(
        (id) =>
          `<button data-id="${id}" aria-pressed="false"><img src="${icon(data.operators[id])}" alt="" draggable="false"><span>${data.operators[id].name}</span><span class="cost"></span></button>`,
      )
      .join("");
    shelf.querySelectorAll("button").forEach((button) => {
      button.onclick = () => {
        if (button.suppressClick) {
          button.suppressClick = false;
          return;
        }
        selected = button.dataset.id;
        pending = null;
        battleError = "";
        drawHud();
      };
      button.onpointerdown = (e) => {
        if (
          e.button !== 0 ||
          battle.finished ||
          battle.bench[button.dataset.id].unit?.alive
        )
          return;
        e.preventDefault();
        selected = button.dataset.id;
        pending = null;
        battleError = "";
        dragging = {
          button,
          id: e.pointerId,
          x: e.clientX,
          y: e.clientY,
          moved: false,
          over: null,
        };
        button.setPointerCapture(e.pointerId);
        drawHud();
      };
      button.onpointermove = (e) => {
        if (dragging?.id !== e.pointerId) return;
        dragging.moved ||=
          Math.hypot(e.clientX - dragging.x, e.clientY - dragging.y) > 6;
        if (!dragging.moved) return;
        const tile = renderer.pickAt(e.clientX, e.clientY);
        dragging.over =
          tile && !battle.placementError(selected, tile.row, tile.col)
            ? tile
            : null;
        showDragGhost(e.clientX, e.clientY);
        drawHud();
      };
      button.onpointerup = (e) => {
        if (dragging?.id !== e.pointerId) return;
        const moved = dragging.moved,
          tile = renderer.pickAt(e.clientX, e.clientY);
        dragging = null;
        workspace.querySelector(".drag-ghost")?.remove();
        button.suppressClick = moved;
        if (moved && tile) pick(tile.row, tile.col);
        else drawHud();
      };
      button.onlostpointercapture = (e) => {
        if (dragging?.id === e.pointerId) {
          cancelPlacement();
          drawHud();
        }
      };
      button.onpointercancel = () => {
        cancelPlacement();
        drawHud();
      };
    });
  }
  for (const button of shelf.querySelectorAll("button")) {
    const id = button.dataset.id,
      b = battle.bench[id],
      alive = b.unit?.alive,
      cool = Math.max(0, Math.ceil(b.readyAt - battle.time));
    const cost = alive
      ? "Deployed"
      : cool
        ? cool + "s"
        : battle.cost(id) + " DP";
    button.classList.toggle("active", selected === id);
    button.setAttribute("aria-pressed", String(selected === id));
    button.setAttribute("aria-label", `${data.operators[id].name}, ${cost}`);
    button.querySelector(".cost").textContent =
      cost + (id === supportId ? " · Support" : "");
  }
  // Preserve keyboard focus when refreshing the counters; command markup changes only on selection/state transitions.
  const b = battle.bench[selected],
    unit = b?.unit?.alive ? b.unit : null;
  let html =
    '<div class="command-copy"><h3>Deploy an operator</h3>Drag an operator onto the map, then choose its facing. Click an operator and tile to place without dragging.</div>';
  let highlights = [];
  let canActivate = false;
  if (unit) {
    highlights = [...unit.rangeKeys];
    const sk = unit.skill,
      hud = skillHud(sk);
    canActivate = !!(hud?.ready && unit.canAct && !unit.s.flags.silence);
    html = `<div class="command-copy"><h3>${unit.name}</h3>HP ${Math.ceil(unit.hp)} / ${Math.round(unit.s.maxHp)} · ${escape(sk.name)}<br>${hud?.text || "Passive skill"}${hud ? `<div class="meter ${hud.state}"><span style="width:${hud.fraction * 100}%"></span></div>` : ""}</div><div class="command-actions"><button id="skill" class="primary" ${canActivate ? "" : "disabled"}>${hud?.ready ? "Skill ready · Activate" : "Activate skill"}</button><button id="retreat">Retreat</button></div>`;
  } else if (b) {
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 9; c++)
        if (!battle.placementError(selected, r, c)) highlights.push(r * 21 + c);
    html = `<div class="command-copy"><h3>${data.operators[selected].name} · ${battle.cost(selected)} DP</h3>${pending ? "Choose a direction on the map. Arrow keys preview; Enter deploys." : "Drag onto a " + (data.operators[selected].position === "RANGED" ? "raised" : "ground") + " tile, or click a tile."}<br>${battleError ? `<span class="error">${escape(battleError)}</span>` : ""}</div><div class="command-actions"><button id="cancel">Cancel</button></div>`;
  }
  const command = workspace.querySelector("#command");
  // Do not replace focused interactive controls during the battle clock.
  if (
    command.dataset.selection !== String(selected) ||
    command.dataset.pending !== JSON.stringify(pending) ||
    command.dataset.alive !== String(!!unit) ||
    command.dataset.ready !== String(canActivate) ||
    command.dataset.error !== battleError
  ) {
    command.innerHTML = html;
    command.dataset.selection = String(selected);
    command.dataset.pending = JSON.stringify(pending);
    command.dataset.alive = String(!!unit);
    command.dataset.ready = String(canActivate);
    command.dataset.error = battleError;
    command.querySelector("#cancel")?.addEventListener("click", () => {
      cancelPlacement();
      drawHud();
    });
    command.querySelector("#retreat")?.addEventListener("click", () => {
      battle.retreatOperator(selected);
      selected = null;
      drawHud();
    });
    command.querySelector("#skill")?.addEventListener("click", () => {
      battle.activateOperator(selected);
      command.dataset.ready = "";
      drawHud();
    });
  } else if (unit) {
    command.querySelector(".command-copy").innerHTML = html.match(
      /<div class="command-copy">([\s\S]*?)<\/div><div class="command-actions">/,
    )[1];
  }
  const hover = dragging?.over ? { ...dragging.over, dir: "RIGHT" } : null;
  const preview = pending || hover;
  const range = unit
    ? highlights
    : preview?.dir
      ? absoluteRangeKeys(
          recordFor(b.build, data).rangeGrid,
          preview.row,
          preview.col,
          preview.dir,
        )
      : [];
  renderer.highlight({
    available: b && !unit && !pending ? highlights : [],
    range,
    chosen: preview,
    operator: preview ? selected : null,
    routes: showRoutes,
  });
  layoutFacing();
  workspace.querySelector("#battle-message").textContent =
    battleError ||
    "Drag to deploy · Click an operator to inspect · Space: pause · Escape: cancel";
  if (battle.finished && !workspace.querySelector(".result")) {
    paused = true;
    const result = document.createElement("div");
    result.className = "result";
    result.innerHTML = `<div class="panel"><p class="eyebrow">Operation ${battle.reason === "cleared" ? "complete" : "ended"}</p><h2>${battle.reason === "cleared" ? "Stage cleared" : battle.reason === "defeated" ? "Defence breached" : "Simulation stopped"}</h2><p class="help">${battle.killed} enemies defeated · ${battle.leakedCount} escaped</p><button class="primary" id="again">Try again</button><button id="back">Back to squad</button></div>`;
    workspace.querySelector("#battle-board").append(result);
    result.querySelector("#again").onclick = restart;
    result.querySelector("#back").onclick = exit;
  }
}
function cancelPlacement() {
  const gesture = dragging;
  dragging = null;
  if (gesture?.button) {
    gesture.button.suppressClick = true;
    if (gesture.button.hasPointerCapture(gesture.id))
      gesture.button.releasePointerCapture(gesture.id);
  }
  battleError = "";
  aimPointer = null;
  selected = null;
  pending = null;
  workspace?.querySelector(".drag-ghost")?.remove();
}
function showDragGhost(x, y) {
  let ghost = workspace.querySelector(".drag-ghost");
  if (!ghost) {
    ghost = document.createElement("div");
    ghost.className = "drag-ghost";
    ghost.innerHTML = `<img src="${icon(data.operators[selected])}" alt=""><span>${data.operators[selected].name}</span>`;
    workspace.append(ghost);
  }
  ghost.classList.toggle("valid", !!dragging.over);
  ghost.style.left = `${x}px`;
  ghost.style.top = `${y}px`;
}
function confirmFacing(dir) {
  if (!pending) return;
  try {
    battle.deployOperator(selected, pending.row, pending.col, dir);
    pending = null;
    battleError = "";
  } catch (e) {
    battleError = e.message;
  }
  drawHud();
}
function layoutFacing() {
  const picker = workspace?.querySelector(".facing-picker");
  if (!picker) return;
  picker.hidden = !pending || battle.finished;
  if (!pending) return;
  const p = renderer.projection.project(
    pending.col,
    pending.row,
    renderer.heightAt(pending.row, pending.col),
  );
  const radius = Math.max(70, Math.min(100, p.s * 1.05));
  // Keep all four hit targets within the map even at its edge.
  const x = Math.max(radius, Math.min(renderer.host.clientWidth - radius, p.x));
  const y = Math.max(
    radius,
    Math.min(renderer.host.clientHeight - radius, p.y),
  );
  picker.style.left = `${x}px`;
  picker.style.top = `${y}px`;
  picker.style.width = picker.style.height = `${radius * 2}px`;
  for (const el of picker.querySelectorAll("[data-facing], [data-cone]")) {
    const active = (el.dataset.facing || el.dataset.cone) === pending.dir;
    el.classList.toggle("active", active);
    if (el.tagName === "BUTTON")
      el.setAttribute("aria-pressed", String(active));
  }
}
document.addEventListener("fullscreenchange", () => {
  if (
    workspace &&
    viewport === "native-fullscreen" &&
    document.fullscreenElement !== workspace
  ) {
    viewport = "fullscreen-workspace";
    battle.setViewport(viewport);
    paused = true;
    cancelPlacement();
    drawHud();
    renderer.resize();
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && battle) {
    paused = true;
    accumulator = 0;
    cancelPlacement();
    drawHud();
  }
});
document.addEventListener("keydown", (e) => {
  if (!workspace || ["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName))
    return;
  if (e.code === "Space") {
    e.preventDefault();
    paused = !paused;
    drawHud();
  }
  if (
    pending &&
    ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"].includes(e.key)
  ) {
    e.preventDefault();
    if (e.key === "Enter") {
      if (pending.dir) confirmFacing(pending.dir);
    } else {
      pending.dir = {
        ArrowUp: "UP",
        ArrowDown: "DOWN",
        ArrowLeft: "LEFT",
        ArrowRight: "RIGHT",
      }[e.key];
      drawHud();
    }
    return;
  }
  if (e.key === "Escape") {
    cancelPlacement();
    drawHud();
  }
});
function tick(now) {
  const real = Math.min(0.1, (now - last) / 1000);
  last = now;
  let dt = 0,
    events = [];
  if (battle && !paused && !battle.finished) {
    accumulator += real * speed;
    while (accumulator >= battle.dt && !battle.finished) {
      battle.step();
      accumulator -= battle.dt;
      dt += battle.dt;
    }
    events = battle.drainEvents();
  }
  renderer?.render(battle, dt, events, real);
  if (now - lastHud > 180) {
    drawHud();
    lastHud = now;
  }
  requestAnimationFrame(tick);
}
try {
  prep();
  requestAnimationFrame(tick);
} catch (e) {
  app.innerHTML = `<div class="frame"><h1>Cannot open the stage viewer</h1><p class="notice">${escape(e.message)}. This preview requires WebGL.</p></div>`;
  console.error(e);
}
