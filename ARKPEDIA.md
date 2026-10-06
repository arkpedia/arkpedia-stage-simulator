# Arkpedia stage simulator

Public GPL-3.0-or-later fork of [Stronghold Protocol](https://github.com/sganggs/Stronghold-Protocol), initially based on `19a89085a4c9a773a7b88437d7cd79c3e7131cfd`. Preserve LICENSE, NOTICE.md, THIRD-PARTY-NOTICES.md, the Spine linking permission and upstream contributor credit. The private Arkpedia app embeds this separately served application; it contains no copied private application code or account data.

## Run the playable MVP

```sh
npm ci
npm run start:arkpedia
# http://localhost:3182/arkpedia/
npm run test:arkpedia
```

This entry needs no upstream release archive or full game-art download. `npm ci` copies the bundled Three.js, Pixi and Spine browser dependencies. The browser downloads only the chosen squad's Front/Back models and this stage's enemies from a pinned `arkpedia-sd-assets` commit. The inherited `npm start` still opens the original Stronghold application.

To embed it in Arkpedia's overhaul branch, run the private application with `NEXT_PUBLIC_STAGE_SIMULATOR_URL=http://localhost:3182/arkpedia/`, then visit `/stages/simulator`. The iframe is loaded only after opening its fullscreen workspace. Its prototype link appears only on 0-1 when that URL is configured. No production simulator host has been configured.

## Supported slice

- 0-1 **Collapse**: source terrain, spawn times, both routes (including the soldier's wait), stage-specific soldier DEF, DP regeneration/cap, deployment limit and life points.
- Fang, Melantha, Beagle, Kroos, Hibiscus and Steward: selectable E0/E1, level, potential, trust and skill rank; their actual ranges, stats, basic traits, promotion talents and S1s.
- Up to 12 unique squad members plus one distinct maxed support. The current selectable roster has only six operators; support is limited to that same supported roster.
- Drag an operator onto a valid tile and choose its facing on the map; click/keyboard placement, Escape cancellation, surface-only deployment feedback and a continuous attack-range outline; blocking, physical/Arts attacks, healing, time/attack SP, manual/automatic skills, manual retreat/refund, increasing deployment costs, redeployment cooldown, clear/defeat.
- Three.js tiles with animated Spine chibis; optional existing-viewer path overlay; pause, 1×/2×, restart, fullscreen/mobile viewport workspace, pause on native-fullscreen exit or hidden tab.

Combat runs at a fixed 30Hz with seeded randomness. Rendering cannot change the number of combat ticks. A hidden page pauses instead of trying to catch up. Deployment entrance/death clips can finish cosmetically while paused; combat, skill durations and attack animations remain paused.

## Data and coverage

`data/arkpedia-mvp.json` records full source commits for public `arkpedia-data`, Global game tables, image assets and SD models. `tools/arkpedia/build-mvp.mjs --refresh` updates that compact snapshot; it requires the sibling `arkpedia-sd-assets` checkout and `gh` access. Import/publish complete SD models first, then regenerate. The generator rejects conditional stages, fixed squads, unfamiliar geometry/route shapes and missing models. The runtime validates all loadouts and never accepts caller-provided stats.

Routes come from the existing Arkpedia stage browser's `buildPlaybackPaths` output: public points, cumulative distances, waits and movement scale, not private app source. The simulator generator retains that export only while its geometry hash matches. After a geometry refresh it requires a new export, rather than silently using different routes:

```sh
# From the private Arkpedia app worktree, after refreshing the simulator source cache:
npx tsx scripts/build/export-stage-simulator-routes.ts ../arkpedia-stage-simulator/.cache/arkpedia/geometry.json /tmp/arkpedia-stage-routes.json 0-1
# From this public simulator checkout:
node tools/arkpedia/build-mvp.mjs --routes /tmp/arkpedia-stage-routes.json
```

Arrow keys preview facing and Enter confirms. Clicking a facing arrow confirms immediately; dragging from the picker centre also aims and confirms. Escape, pointer cancellation and the centre cancel button never spend DP. Terrain, occupancy, DP and cooldown are checked again at confirmation. Paths can be toggled independently of operator range; the wait point is marked with a ring.

Deployed operators show a green SP gauge below HP. Ready manual skills show a yellow lightning diamond above the bars; select that operator, then activate the skill. Automatic skills trigger through the combat engine and do not show a manual-ready marker. The gauge turns orange and drains during a timed skill (or tracks remaining ammo); passive skills have no SP gauge. All indicators follow the paused simulation clock and disappear on retreat or death.

This is a playable prototype, **not full game compatibility**. Timings, movement scale, projectile flight and animation wind-up need recorded in-game comparison. Modules, summons, enemy abilities, devices, other stages and operators, special modes, replay persistence and a worker are not implemented. A model existing does not mean its mechanics are supported. The old Arkpedia range-preview/playback tool is retained.

Tests compare every unblocked movement tick with the exported viewer paths/waits, and cover projected facing/range perimeter geometry, source routing, stats/caps, support, fullscreen/terrain/DP checks, retreat/redeployment, Fang's clear, healing, manual skills and life loss. Upstream tests continue to verify the inherited combat primitives separately.

Next work: frame-level calibration, more stages/roster with explicit mechanic coverage, worker/replay support, versioned embedding messages if account/squad transfer is later needed, and a reviewed hosting/content-release path.
