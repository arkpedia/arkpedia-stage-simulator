# Arkpedia stage simulator

Public GPL-3.0-or-later fork of [Stronghold Protocol](https://github.com/sganggs/Stronghold-Protocol), initially based on `19a89085a4c9a773a7b88437d7cd79c3e7131cfd`. Preserve LICENSE, NOTICE.md, THIRD-PARTY-NOTICES.md, the Spine linking permission and upstream contributor credit. The private Arkpedia app embeds this separately served application; it contains no copied private application code or account data.

## Run the playable MVP

```sh
npm ci
npm run start:arkpedia
# http://localhost:3182/arkpedia/
npm run test:arkpedia
```

This entry needs no upstream release archive or full game-art download. `npm ci` copies the bundled Three.js, Pixi and Spine browser dependencies. The browser downloads 0-1's original stage art, the chosen squad's Front/Back models and this stage's enemies from a pinned `arkpedia-sd-assets` commit. The inherited `npm start` still opens the original Stronghold application.

To embed it in Arkpedia's overhaul branch, run the private application with `NEXT_PUBLIC_STAGE_SIMULATOR_URL=http://localhost:3182/arkpedia/`, then visit `/stages/simulator`. The iframe is loaded only after opening its fullscreen workspace. Its prototype link appears only on 0-1 when that URL is configured. No production simulator host has been configured.

## Original stage assets

0-1 uses the actual scene from the official Global Android resource version `26-09-23-17-49-43_b9cc4a`, published in `arkpedia-sd-assets`. Its 177 static submeshes, original colour/emission textures, baked lightmap and source tile heights are about 1.7 MB combined. The scene's gameplay-geometry hash and every file's SHA-256 must match before it replaces the simplified map. Missing or mismatched art leaves an explicitly labelled fallback. Rendering approximates the Unity shader; lighting is not yet a frame-for-frame match.

The pinned 0-1 lightmap is ETC2 RGBA with Unity RGBM encoding. The browser linearizes its RGB through sRGB texture sampling, then decodes the alpha multiplier using the [Unity RGBM range and exponent](https://docs.unity3d.com/2021.3/Documentation/Manual/Lightmaps-TechnicalInformation.html). Three's Lambert normalization is compensated for baked diffuse lighting. Ambient fill points along the stage's Z-up axis. This preserves the source light/shadow gradients instead of treating the encoded bake as an ordinary colour image; no asset brightness filter is applied.

The exporter preserves world-space static batches once, reverses Z/triangle winding for the renderer, removes the centered map anchor, and keeps the already-baked lightmap UVs. It does not apply the prefab transforms a second time or reuse an unrelated Stronghold map theme.

Entry and defence markers use the original five standard box meshes and shared atlas from `arts/effects/[pack]map.ab` in that same Global version. The red and blue frames include the original warning/arrow symbols. They sit at source tile heights, are independent of the path overlay, and render above static buildings so entry points remain visible. Actor sprites render in front. Their additive/alpha materials and gentle intensity pulse approximate the game effect; they are not a verified reproduction of Unity's animation curve. The manifest pins and checksums the marker pack separately; a failed load is labelled in the map status.

To reproduce the pack (Python 3.13+, Node 22+):

```sh
python3 -m venv .cache/map-env
.cache/map-env/bin/pip install -r tools/arkpedia/stages/requirements.txt
node tools/arkpedia/stages/fetch-bundles.mjs --version 26-09-23-17-49-43_b9cc4a
.cache/map-env/bin/python tools/arkpedia/stages/export-scene.py --bundles .cache/arkpedia/map-source/ab --manifest .cache/arkpedia/map-source/hot_update_list.json --out .cache/arkpedia/stage-pack --version 26-09-23-17-49-43_b9cc4a --base-url https://ark-us-static-online.yo-star.com/assetbundle/official/Android/assets/26-09-23-17-49-43_b9cc4a
# Standard entry/defence effects are a separate small bundle.
node tools/arkpedia/stages/fetch-bundles.mjs --version 26-09-23-17-49-43_b9cc4a --gates-only
.cache/map-env/bin/python tools/arkpedia/stages/export-gates.py --bundles .cache/arkpedia/map-source/ab --manifest .cache/arkpedia/map-source/hot_update_list.json --out .cache/arkpedia/gate-pack --version 26-09-23-17-49-43_b9cc4a
```

The fetcher verifies unzipped bundle size/MD5 against the game manifest. Publication to the asset repository and updating its immutable simulator pin remain explicit steps; this does not automatically refresh the full stage catalogue. Game assets retain their original ownership (see `arkpedia-sd-assets/NOTICE.md`). The extractor stays in this GPL repository.

## Supported slice

- 0-1 **Collapse**: source terrain, spawn times, both routes (including the soldier's wait), stage-specific soldier DEF, DP regeneration/cap, deployment limit and life points.
- Fang, Melantha, Beagle, Kroos, Hibiscus, Steward, Vanilla, Cardigan, Orchid, Plume and Popukar: selectable E0/E1, level, potential, trust and skill rank; their actual ranges, stats, basic traits, promotion talents and S1s.
- Vanilla grants DP when her manual ATK skill starts; Cardigan immediately heals herself by a percentage of talent-adjusted max HP; Orchid deals Arts damage, slows on hit and gains the source ASPD talent/skill bonuses.
- Plume gains one DP for each enemy she defeats, refunds her original potential-adjusted DP cost on manual retreat (including later deployments), and uses her source ATK/ASPD S1 buff. Death grants no refund.
- Popukar attacks up to her block count of enemies in range, prioritizing those she blocks, and has her source HP/ATK talents and S1 ATK buff. This does not enable splash attacks for single-target guards.
- Up to 12 unique squad members plus one distinct maxed support. The current selectable roster has eleven operators; support is limited to that same supported roster.
- Drag an operator onto a valid tile and choose its facing on the map; click/keyboard placement, Escape cancellation, surface-only deployment feedback and a continuous attack-range outline; blocking, physical/Arts attacks, healing, time/attack SP, manual/automatic skills, manual retreat/refund, increasing deployment costs, redeployment cooldown, clear/defeat.
- Original 0-1 Chernobog meshes, textures, scenery and baked lighting, original red entry/blue defence boxes, rendered with Three.js and animated Spine chibis; optional existing-viewer path overlay; pause, 1×/2×, restart, fullscreen/mobile viewport workspace, pause on native-fullscreen exit or hidden tab.

The battle HUD follows the current stage planner layout: game enemy/life glyphs in a centered plate over the map, DP and remaining deployment slots at the lower right, and controls above the battlefield. Counter widths are reserved. DP recovery progress follows the actual combat resource and freezes with the battle; spending, refunds and the DP cap update the same readout. The overlay passes pointer input through to the map. This layout is independently implemented here, without importing private application code.

Squad setup stays available in portrait. Battles on phones and touch tablets require landscape: a rotation prompt blocks battle controls in portrait. Rotating back pauses combat and cancels unfinished deployment without spending DP; the squad and battle progress remain intact. Returning to landscape requires an explicit Start/Resume. Tall desktop windows with mouse controls remain supported.

Attack animations play once for each combat attack, then return to idle. Skills that reuse the normal attack animation (such as Melantha’s ATK buff) do not start attack loops without a combat event. Melantha’s normal attacks and active skill damage one enemy per attack, even when enemies overlap.

Combat runs at a fixed 30Hz with seeded randomness. Rendering cannot change the number of combat ticks. A hidden page pauses instead of trying to catch up. Deployment entrance/death clips can finish cosmetically while paused; combat, skill durations and attack animations remain paused.

## Data and coverage

`data/arkpedia-mvp.json` records full source commits for public `arkpedia-data`, Global game tables, icon and operator-art assets, and SD models. `tools/arkpedia/build-mvp.mjs --refresh` updates that compact snapshot; it requires the sibling `arkpedia-sd-assets` checkout and `gh` access. Import/publish complete SD models first, then regenerate. The generator rejects conditional stages, fixed squads, unfamiliar geometry/route shapes and missing models. The runtime validates all loadouts and never accepts caller-provided stats.

The regular-stage roster is opt-in through `shared/arkpedia/operators.js` and `enemies.js`. The build tool and runtime reject unknown operators, skill IDs, talent blackboard keys and enemies; spawns must have supported enemy records. Inherited kits remain disabled: Stronghold's `chess_` units have mode-specific builds, automatic-operation rules and modifiers. A hand-authored kit there is a migration candidate, not proof of ordinary-stage compatibility.

`data/arkpedia-coverage.json` audits the pinned Global catalogue: 374 obtainable operators, 817 skills and 1,552 enemy database IDs. Eleven operators and two basic enemies are currently playable. It identifies 265 skills and 210 enemy IDs with inherited implementation candidates, including stats-only entries whose notes may describe missing mechanics. It separately records imported animation pairs, placeholder effects and unverified game fidelity. It is an offline report; the battle does not load the full catalogue.

To import another reviewed batch and reproduce coverage:

```sh
# Register and implement/test regular-stage mechanics before enabling an operator.
# Front/Back models retain their original pinned files; this parses attachment,
# clip and hit metadata with the same Spine runtime as the browser.
node tools/arkpedia/import-operators.mjs --ids char_240_wyvern,char_209_ardign,char_278_orchid --commit d0b5af0b004b044d322397ce5ae79632b6d9fcdd --pma false
# Validate and publish the sibling asset repo, then pin its committed manifest.
node tools/arkpedia/build-mvp.mjs
npm run coverage:arkpedia
```

Blending is an explicit import setting, followed by browser QA. The importer does not claim that parsed clips have been compared frame-for-frame with the game. Coverage regeneration uses the existing pinned source cache and rejects a source-pin mismatch; a fresh checkout first needs `build:arkpedia-data` to fetch its source tables.

### Source behaviour templates and effects

The pinned Global `gamedata/battle/buff_template_data.json` contains 5,468 templates and 916 action types. `shared/arkpedia/behavior.js` independently implements the reviewed `ModifyCost` and self-cast `HealViaMaxHpRatio` variants for `ON_BUFF_START`. It compiles the entire template before execution, rejects unknown actions/events/fields and resolves all operands before changing combat. Cross-unit source/owner rules, nested conditions, other events, priorities, buff lifetime/stacking and particle effects are not supported by this interpreter.

Fang and Vanilla now execute the original `charge_cost` template once at skill activation. Their prefab-to-template bindings are verified against the official Global skill bundle, rather than inferred from their skill names. Cardigan uses a native HP-ratio heal ability in the client and retains its explicit adapter; the unrelated `instant_heal[hp_ratio]` buff is tested in isolation, not assigned to Cardigan. No additional operators are enabled by this change.

`data/arkpedia-behavior-audit.json` records action/event counts, first rejection reasons, accepted isolated templates and the two live operator bindings. Fifteen templates compile in the restricted self-cast context, including ten empty/no-action records; only five contain actions. Acceptance of a buff alone is not support for its containing skill or operator.

```sh
# Fetch only the snapshot's immutable template table, verify SHA-256 and audit.
# This does not refresh the playable snapshot or source commits.
npm run audit:arkpedia-behaviors -- --fetch
# With the pinned cache present, this command is offline:
npm run audit:arkpedia-behaviors
```

`data/arkpedia-skill-prefabs.json` records checksum-verified original prefab bindings and an inventory of the skill/projectile/common/buff bundles. The `common_charge_cost_start_01`, `common_ignite_attack` and `common_heal_hit_01` roots exist in `battle/prefabs/effects/common.ab`. Their assets include Unity particles, materials, animation clips and trails; an inventory alone does not establish runtime support.

```sh
node tools/arkpedia/stages/fetch-bundles.mjs --version 26-09-23-17-49-43_b9cc4a --skills-only
.cache/map-env/bin/python tools/arkpedia/stages/export-skill-bindings.py --bundles .cache/arkpedia/map-source/ab --manifest .cache/arkpedia/map-source/hot_update_list.json --templates .cache/arkpedia/buff_template_data.json --out data/arkpedia-skill-prefabs.json --version 26-09-23-17-49-43_b9cc4a
```

The extractor compares both reviewed template action lists with the original Unity template holder and records exact source bundle hashes. Rebuilding requires the template-table hash to match that evidence. A source refresh which changes it fails until the bindings are re-extracted and reviewed. No code from the newly researched battle engine, DPS calculator or Myrtle is included; their unresolved reuse terms do not affect this independent implementation.

### Original charge-cost activation particles

Fang and Vanilla's skill-start events now render the five original billboard emitters in `common_charge_cost_start_01`. The immutable asset pack includes two lossless game textures, separate RGB/alpha gradients, unweighted Hermite size curves, burst counts, radial cone/sphere emission, angular velocity and the birth sub-emitter. Texture and pack hashes are verified before use. A failed load is labelled; the renderer does not invent replacement particles. Cosmetic randomness is separate from combat RNG. Effects follow the battle clock, freeze during pause, speed up with combat and are disposed on reset/expiry.

Only the activation burst is implemented. The follow-up `common_charge_cost_01` flight to the DP counter uses custom motion/noise/trail scripts and remains deferred. The current body anchor at 0.6 tile height, 60 Hz velocity-limit damping and Pixi shader rendering are approximations; recorded game comparison is still required. ATK/heal effects and projectiles remain placeholders. No additional operators are enabled.

```sh
node tools/arkpedia/stages/fetch-bundles.mjs --version 26-09-23-17-49-43_b9cc4a --dp-effect-only
.cache/map-env/bin/python tools/arkpedia/stages/export-dp-effect.py --bundles .cache/arkpedia/map-source/ab --manifest .cache/arkpedia/map-source/hot_update_list.json --out .cache/arkpedia/dp-pack --version 26-09-23-17-49-43_b9cc4a
```

The exporter verifies four original bundles and rejects new enabled modules, weighted curves and unknown material variants. Publish the pack in the sibling asset repository before rebuilding the simulator's pin. A source-effect preview at `/arkpedia/effect-preview.html` uses the same renderer and actual Fang/Vanilla skill activation events, with replay and timeline scrubbing for visual review. It is separate from gameplay.

Routes come from the existing Arkpedia stage browser's `buildPlaybackPaths` output: public points, cumulative distances, waits and movement scale, not private app source. The simulator generator retains that export only while its geometry hash matches. After a geometry refresh it requires a new export, rather than silently using different routes:

```sh
# From the private Arkpedia app worktree, after refreshing the simulator source cache:
npx tsx scripts/build/export-stage-simulator-routes.ts ../arkpedia-stage-simulator/.cache/arkpedia/geometry.json /tmp/arkpedia-stage-routes.json 0-1
# From this public simulator checkout:
node tools/arkpedia/build-mvp.mjs --routes /tmp/arkpedia-stage-routes.json
```

Dropping a portrait onto a tile opens the direction picker without deploying or spending DP. Start a separate drag from the picker centre, swipe toward the intended direction, and release to deploy. Releasing within the centre's dead zone keeps placement pending; Escape, Cancel and pointer cancellation never spend DP. Arrow keys preview facing and Enter confirms; clicking a facing arrow also confirms. Terrain, occupancy, DP and cooldown are checked again at confirmation. Paths can be toggled independently of operator range; the wait point is marked with a ring.

Enemy sprites face their horizontal movement, retain that facing through waits and vertical route segments, and turn toward a blocker when attacking. Their initial facing comes from the route rather than the engine's fixed deployment direction.

Deployed operators show a green SP gauge below HP. Ready manual skills show a yellow lightning diamond above the bars; select that operator, then activate the skill. Automatic skills trigger through the combat engine and do not show a manual-ready marker. The gauge turns orange and drains during a timed skill (or tracks remaining ammo); passive skills have no SP gauge. All indicators follow the paused simulation clock and disappear on retreat or death.

Selecting an operator opens a left-side inspector with pinned base artwork, build level, live ATK/DEF/RES/block, HP, SP, skill description and activation/retreat controls. It overlays the battlefield without changing its dimensions and disappears while dragging or choosing deployment direction. Portrait phones use a compact panel above the deployment shelf; short landscape views keep art and independently scrolling details side by side, with retreat/skill buttons anchored below. Close or Escape dismisses the inspector without retreating the operator. Automatic skills have no manual activation button.

This is a playable prototype, **not full game compatibility**. Timings, movement scale, projectile flight and animation wind-up need recorded in-game comparison. Modules, summons, enemy abilities, devices, other stages and operators, special modes, replay persistence and a worker are not implemented. A model existing does not mean its mechanics are supported. The old Arkpedia range-preview/playback tool is retained.

Tests compare every unblocked movement tick with the exported viewer paths/waits, and cover projected facing/range perimeter geometry, source routing, stats/caps, support, fullscreen/terrain/DP checks, retreat/redeployment, Fang's clear, healing, manual skills and life loss. Upstream tests continue to verify the inherited combat primitives separately.

Next mechanic batches: the remaining three-star archetypes (DP-on-kill/refund, splash, healing mode and ranged-guard attacks), then multi-skill/E2 builds, mastery and modules. Enemy adapters need ordinary-stage ability data and stage overrides before mode kits can be enabled. Summons, bosses and unusual targeting require dedicated adapters and regression scenarios. Original projectiles/skill effects and frame-level calibration remain separate work. Further stages, worker/replay support, embedding messages and hosting/content releases follow that coverage.
