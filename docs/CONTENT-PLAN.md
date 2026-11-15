# Complete simulator content

The goal is complete, behavior-tested operators, enemies and combat stages, with
small additions that can be reviewed and reverted independently. Imported data,
selectable entries, visual assets and client-verified behavior are separate states.

Integrated Strategies, Reclamation Algorithm and multi-floor modes target
individual stages with configurable mode rules. Complete runs, progression and
carried state are outside this implementation scope (owner decision, 2026-11-14).

## Architecture update

Native buff templates now compile into bounded data programs, with shared
predicates, child effects and explicit owner/source/target bindings. Gnawbeast
bleed and Zealous Extra release use that path. Programs share component-store
objects and load with selected stages; the source compiler stays outside the
browser. `NATIVE-BUFF-PROGRAMS.md` describes atomic additions and the retained
source-template audit. Admission remains a separate complete-mechanic check.

Security Service danger scaling is now a shared source-driven component; its
card/deployment mode remains gated. See `STAGE-DANGER-REVIEW.md`. Assault Power
Armor reuses the projectile and targeting systems; see
`ENEMY-POWER-ARMOR-REVIEW.md`.

The replacement simulator now targets capability-driven stage loading. The
primary browser catalogue is generated from all source combat stages, not from
individually installed stage files. Geometry, pathing, enemy definitions and
stats are shared JSON components, fetched only when a selected stage needs them.
Implementing a reusable mechanic unlocks all compatible stages on the next
`npm run content:library` build. Individual stage tests remain regression cases.
See `STAGE-LOADER-PLAN.md`; the earlier stage-addition workflow below describes
legacy fixtures and the work completed before this change in direction.

The generated library now retains original wave/fragment programs, including
clear waits and enemy-counting flags. Conditional original route identities are
resolved before path compilation. Route clock waits and source-owned predefined
operator/card activation now share that scheduler; see `STAGE-WAVES-REVIEW.md`
and `STAGE-CAPABILITIES-REVIEW.md`. Integrated Strategies uses configurable
individual-stage numerical rules (`STAGE-MODE-RULES-REVIEW.md`). Branch triggers,
scheduled devices and additional mode controllers remain shared follow-up work.
Plain weighted main-wave groups now resolve once before count expansion, with
seeded choices and selected-action timing; see `STAGE-RANDOM-GROUPS-REVIEW.md`.
Pack-linked groups and mode-specific continuation remain separate capabilities.
Predefined builds now use the shared discrete favor-point threshold lookup,
unlocking eight stages without stage-specific branches; see
`STAGE-PREDEFINED-TRUST-REVIEW.md`.
Vector Breakthrough side stages share a source-fed kill-all deadline, including
countdown, expiry and restart; see `STAGE-STRIFE-DEADLINE-REVIEW.md`. Main-mode
multi-wave transitions remain a separate capability.

Firelight terrain and enemy families share Reeds ignition, hit-count revival,
charged attacks and skill suppression. Exhausted Flame is implemented; Eblana's
independent death-conversion aura now shares immediate form entry and managed
summon ownership. Her remaining phase and skill contracts still block the boss
stages. See `ENEMY-EXHAUSTED-FLAME-REVIEW.md` and `ENEMY-EBLANA-REVIEW.md`.

Permanent deep water now compiles original controller values into a shared
contact effect; see `STAGE-WATER-REVIEW.md`. Six-star and independent IS variant
identities are checked by the common rule compiler, and stale adverse-level
bindings have been refreshed; see `STAGE-VARIANT-IDENTITY-REVIEW.md`.

Operator records, summon dependencies and model metadata now use that same
component store; the searchable roster loads first. Native runtime imports are
deferred until battle startup. Selected operator adapters and their evidence
now load through an ordered runtime dependency index. Specialized summon
factories and squad-wide services load with their source owners; each battle
binds services to its own selected roster. Shared core, enemy and device imports
remain optimization work. See `OPERATOR-LOADER-REVIEW.md` and
`OPERATOR-RUNTIME-LOADING-REVIEW.md`.

Regular-stage pushes and pulls now share a continuous force controller, including
unbalanced state and travel/collision callbacks. Arc Frontliner variants use that
state for their original periodic-damage talent. See `DISPLACEMENT-REVIEW.md` for
the research, tests and remaining physics limitations.
Waker-Uppers also share a one-shot HP-threshold buff; its source contract and
limits are in `ENEMY-WAKER-REVIEW.md`.

Preplaced Interference Mines now reuse the supplied-mine runtime and verified
original instance compiler. See `STAGE-MINES-REVIEW.md`. Temporary Employees
reuse the common attack pipeline to clear Mushroom cover and free original
ranged tiles; see `STAGE-WORKERS-REVIEW.md`.
Tiacauh Shredders reuse the scenery controller to destroy those stumps and
their occupants permanently; see `ENEMY-SHREDDER-REVIEW.md`.
Ordinary trial actors now accompany the player's squad; actor-only tutorials
retain an explicitly fixed empty card roster. The shared squad-mode contract
also drives demand loading and the preparation screen.

Original level enemy attributes now replace incomplete viewer projections;
Lancer delay and trigger budgets are reusable stage parameters. See
`STAGE-ENEMY-ATTRIBUTES-REVIEW.md`. Original operator enable rules resolve both
cards and actors; actors keep no deployment card after removal. Duplicate
operator builds still require instance-identity work, as documented in
`STAGE-PREDEFINED-IDENTITY-REVIEW.md`.

Individual-stage results now expose native counters and operator-removal events.
Lost Contraption, Window and Portal reuse that account; Portal's card removal
lasts for the battle. Run progression remains with the caller. See
`STAGE-OUTCOMES-REVIEW.md` for the source contracts and current limits. Lost
Hovercraft reuses the same account and the corrected hovering state. Its grounded
speed talent is verified against native mode ancestry; see `ENEMY-HOVER-REVIEW.md`.
Bounded automatic intake now supplies original passive-helper evidence to the
existing strict classifier; see `ENEMY-AUXILIARY-INTAKE-REVIEW.md`. Native enemy
research data is no longer loaded by the browser runtime just to read Flux ranges.
Treasure Chests now share the result account and source-alias activation path;
their mixed random device pools remain follow-up work. See
`STAGE-REWARD-DEVICES-REVIEW.md` for the implemented scope and source checks.

## Execution order

1. Generate a complete inventory from explicitly identified Global, CN and
   Arkpedia source revisions. Include every combat stage type and every blocker,
   count embedded stages correctly, and audit skills against the roster target.
2. Share compilation and dependency validation between reporting and installation.
   Plan additions before writing, retain source hashes, refuse unsupported
   mechanics, and publish each validated addition as one reviewable change.
3. Move operator customization and installation dispatch out of the battle
   command implementation. Keep ordered, explicit content registration and
   reusable enemy/device behaviors; don't add per-content UI branches.
4. Implement families in dependency order, prioritizing mechanisms that unblock
   multiple stages. Include original source evidence and behavior tests in each
   addition; regenerate support only after the behavior is implemented.
5. Complete bosses, conditional waves, mode rules, geometry and asset gaps. Do
   not treat a generic fallback or a validation bypass as an implementation.
6. Validate content and interactions, review staged additions in the browser,
   and regenerate the inventory. New source revisions must expose additions and
   changed dependencies instead of silently extending the completion claim.

## Starting state

- Pinned CN target: 431 operator forms; all are in the playable snapshot.
- Enemy registry: 440 supported of 1,552 records.
- Public stage catalogue: 597 entries, including embedded 0-1.
- Current Arkpedia source checkout: 3,892 combat stages across all stage types.
- Full skill fidelity, modules, client frame parity and special-mode fidelity
  require separate verification; these counts do not certify them.

Progress and concrete blockers belong in the generated content inventory, not
manually maintained totals in this plan. The prior damage-panel work remains a
separate feature in the workspace.

## Execution status

Mutant Giant Rock Spiders share timed casting, projectile transport and delayed
route-owned summons with existing families. Multi-skeleton extraction reads a
verified bundle once; variants add data instead of copied controllers or assets.
See `MUTANT-SPIDERS-REVIEW.md`.

Anti-Armor Infantry variants share one grenade-to-melee controller, the existing
area projectile engine and source form aliases on one skeleton. See
`ANTI-ARMOR-INFANTRY-REVIEW.md`.

Inventory, shared preflight and append-only stage publication are implemented.
Operator deployment dispatch now has one ordered registry, exercised by a sweep
of every admitted skill. Initial dependency work covers Bombtail/Bombtail-G,
Oneiros, level-parameterized Active Originium, life/enemy-stat challenge runes and
difficulty-specific hidden groups.
New stage files remain developer-only.

Flow Generators share range-owned facing and movement auras; Gramophones share
control SP, capture, targeting, percentage damage and healing. Original device
levels/ranks survive compilation. Leithanian capture, death seizure, charging
priority and Mudrock Zealot barriers compose these device and enemy controllers.
See `STAGE-FLOW-GENERATOR-REVIEW.md`, `STAGE-GRAMOPHONE-REVIEW.md` and
`LEITHANIAN-ENEMIES-REVIEW.md` for source contracts and validation limits.

Jammers and Portable Supply Stations share the supply-card lifecycle and a
range-owned aura controller. Directional cards reuse the existing facing picker;
original levels and scoped stage modifiers remain instance data. See
`STAGE-RANGE-SUPPLIES-REVIEW.md`.

Interference Mines reuse the ordinary SP account and damage pipeline. Supply
identity, inspection and retreat accounting now have one shared helper. See
`STAGE-MINES-REVIEW.md`.

Withered Altars declare their spawned enemy dependency through the supply
registry. Beacon bodies and Storm pursuit now retain native restrictions and
share route movement and explicit victory participation. See
`STAGE-WITHERED-ALTAR-REVIEW.md`.

Pillars, Demolition Devices and Battlefield Ruins now share damage lifecycle,
delayed collapse, chain reactions and real obstacle bodies. Device evidence
retains referenced buff templates once through recursive extraction. See
`STAGE-DEMOLITION-REVIEW.md` for reviewed behavior and remaining enemy integrations.

Roadblocks reuse the same obstacle bodies and inspector, with stock/cooldown and
route-sealing validation. Mushrooms and Jammers share non-stacking aura ownership
and cleanup; multiple supplied copies remain independent. See
`STAGE-SCENERY-REVIEW.md`.

Invitation to Wine's broken-blade, lamp-bearer and vase-caster families share delayed fragment
spawns, native cast clocks and independently owned aura cleanup. Falls retain
their provenance for death-spawn rules. Vase casters reuse homing projectiles
and an independently stacking cached-ATK ramping-damage helper. See `WINE-ENEMIES-REVIEW.md`.

Blade Helmet Knightclub enemies now reuse a timed stat-debuff controller and
the common rebirth lifecycle, with native 20% HP restoration. Tytus uses the same controller with his own
ten-second cooldown, and all three retain shared-bundle attack clocks. The same placement
normalization maps the viewer's `any` tiles to native `ALL` for validation and
runtime deployment. Enemy skill cooldown runes require per-feature opt-in;
Crownslayer's 1-8 Challenge clock is the first reviewed use. See `BLADE-HELMET-REVIEW.md` for the source contract and limits.

Rat King shares the three-layer barrier and prioritized cast helpers. His
HP-targeted cross and fixed sand fields retain source geometry and clocks;
CB-10's replacement skill list is an explicit subset/order override. See
`RAT-KING-REVIEW.md`.

Fatty's variants share native facing, backward-mode timing and conditional
Sanctuary. Directional protection and flying-source protection now use the
strongest common Sanctuary channel. See `DIRECTIONAL-ENEMIES-REVIEW.md`; mode
dependencies still prevent unsupported campaign stages from being admitted.

Turrets retain original level/direction and fire through the common projectile
system with swept first-contact collision. Numeric and named original directions
share one parser. Static placements are admitted separately from still-blocked
scheduled activations. See `STAGE-TURRET-REVIEW.md`.

The Code of Brawl families now share building-tag target selection, homing
three-shot attacks, silenceable building damage and typed barrier layers.
Greytail's final barrier break changes DEF and speed through the common shield
pipeline. The stage-rule compiler also handles class-scoped Block additions and
the original NONE/NONE character masks on enemy attribute runes. See
`CODE-OF-BRAWL-ENEMIES-REVIEW.md` for native evidence and timing limits.

The inventory exposed a source limitation: challenge/adverse variants can share
normal-stage geometry while their executable rule changes are absent. New builds
require a verified rule receipt. 5-4, PS-3, SE-5, SV-1, SV-3 and BW-1 Challenge now have these;
normal PS-3 and SE-5 also retain receipts to exclude challenge-only enemies.
The other newly added normal stages retain their inactive or empty original rules.
Existing catalogue entries keep their status and expose fresh-source
blockers. Importing other original variant rules and implementing their effects
is still required. Bosses, special modes, missing enemy records,
conditional wave controllers, modules and asset fidelity remain open work.

The second batch adds the Defense Crusher and Rockbreaker families plus source
targeting priority for Introspection/Scantwords. A per-stage rule importer now
resolves filename aliases through the pinned stage table and verifies Git blob
hashes before retaining evidence. This reduces manual source preparation while
preserving the compiler's refusal of unsupported rules.
Original explicit time limits now reach the battle runtime. This fixes H5-3,
whose final scheduled spawn occurs after the previous five-minute default.
Challenge attack-range multipliers now unlock OF-EX1 and SV-7 variants, with
runtime boundary tests and unchanged blocker-only targeting for melee enemies.

The next families are Agents, Duck Lord, Mortar Gunners, Sarkaz Lancers and
Snipers. Runtime factories share status, movement, projectile and targeting
systems. Scoped enemy modifiers and normal-stage roster exclusions are retained
from original rules. Deployment-limit and initial-DP additions use existing
battle budgets; legacy DP recovery rules scale the interval, not direct grants.

Original rule evidence has now been imported for every combat stage in the
current source checkout, including mode-only levels absent from `stage_table`.
An atomic batch importer verifies pinned Git blobs and resumes after individual
failures. Normal/challenge stage bindings share one immutable level record;
unknown active rules remain explicit blockers. Every future stage addition
requires this evidence, including normal difficulty.

The enemy catalogue now merges 611 CN-only records into the 1,552 Global records,
with immutable source manifests and verified cache/download tooling. Existing
Global records are unchanged. Stage-local definitions are separately compiled
from original level bytes and reuse approved basic prefabs and model assets.
TR-4 exercises this path; unsupported special variants remain blocked.

Bully/Bulldozer now consume three free blocking slots. Verified kill-log-only
native components are accounted for without treating unknown native code as
implemented. Crying Thief uses resistance-aware attack stun and restores its
invisibility when stunning its blocker frees it. Empty supplied fixed squads no
longer prevent player squad selection on maps that supply only roadblocks.

The following passes implemented Pompeii, Sarkaz Sentinel alarms and standby
enemies, Yeti Caster projectile charging, Profane Chimera transformation and
shared Originium pollution/Storm growth. Original per-level talent, skill and
SP overrides are retained and checked against feature declarations. Adverse
variants now resolve their own original level; evidence and compiled rule
refreshes use the same guarded atomic publication path as additions.

Stage restrictions now share handlers for forbidden tiles, class exclusions,
squad caps, device SP costs, wave enemy replacement, dynamic enemy immunity and
invisibility, deployment HP penalties and character HP/DEF modifiers. Witherer
corruption was checked against its native projectile and now shares one
exposure clock across overlapping corruption pools. Remaining work continues
from the inventory's actual dependency blockers; stage counts and registration
alone do not establish full behavior, asset or client fidelity.

Manual-device implementation now shares instance metadata, activation UI and
SP/DP accounting for Stun Generators, Detectors and Command Terminals. Terminal
building targeting and permanent deployment-slot upgrades reuse ordinary
damage, regeneration and selector paths. Sixteen further stage variants were
added as developer-only entries; the Siesta campaign's scheduled hidden devices
remain explicitly blocked. Browser, runtime and complete-wave evidence stays
on each addition receipt, including PL-2's legacy-time-limit result.

Pathfinder ammunition families now share bounded accounts, projectile payloads,
mode switching, tagged device damage and ammunition HUD pips. Gelato Stops
connect those accounts to faction-dependent supply auras and reuse a common
capture-side transition. Original instance skill indices select allied/enemy
starts without duplicate units or assets. New admissions continue through the
same source gates, atomic stage publisher and browser/wave evidence receipts.

Dessert Vendors and Snack Carts now reuse shared ammunition, scheduler-owned
summons and fixed-damage pipelines. Their original attack markers drive summon
release and detonation; interruption and slow-down have focused regression
coverage. Initial predefined-device alias selection and declared additive enemy
parameters unlock further variants without per-stage scripts. Browser and full
wave sweeps include dynamically summoned children in their accounting.

Sponsor Drone deliveries now use declared typed stage parameters and a shared
supply-card account. Mr. Boom and Mieszko Coils reuse deployment, stock,
cooldowns, status handling and the device inspector. Coils also reuse one
controller for supplied cards and preplaced map instances, plus the existing
finite-strip/body geometry helper. The source gates reject hidden cards and
unimplemented per-instance overrides; additions retain original source hashes.
See STAGE-SUPPLY-REVIEW.md for the current selector and frame-parity limits.

Feature-backed stage aliases now share bounded prefab contracts, source gates
and runtime shape checks. Sponsor and Cheering Sponsor variants reuse existing
controllers and assets while retaining original local parameters. The Corrupted
and Withered Knights share a separate controller with exact partner identity,
charged splash, projectile travel and recipient-owned delayed arrows. Native
animation receipts drive their reviewed local cast clocks; limitations are
recorded in KNIGHT-PAIR-REVIEW.md. Full catalogue regression checks preserve
previously admitted families when they share talent-group names.

The level-global environment audit now participates in the same atomic stage
preflight as enemies, devices and variant rules. Poison and kill-generated DP
share runtime handlers; sixteen existing stages received validated rule
refreshes. Realigned Flux work uses one persistent beam field for Tuba devices,
SP recovery and enemy target conditions. Intersection ownership survives
redirection without duplicating per-stage rules or graphical assets.

Flux casters now share homing projectiles, beam-ordered propagation, conditional
splash and source-owned formation fields. Resonators extend the same beam
controller with charging, tile release and new emitters. The enemy catalogue
sweep includes zero-ATK summon attacks, uncounted summons and child lifecycles;
stage additions retain browser and complete-wave evidence. See
`REALIGNED-FLUX-REVIEW.md` for source contracts and remaining fidelity limits.

Enemy artwork now has an additive, persistent registry separate from the build
snapshot. Verified native prefab bindings identify ambiguous bodies; immutable
shared asset releases retain per-model source receipts. Byte-identical variants
use explicit aliases and the same browser URL, so they share both storage and
downloads while keeping their own stats and animation roles. See
`ENEMY-ARTWORK-REVIEW.md` for coverage and non-Spine gaps.

Saxophonists reuse timed casting, shared projectiles and the Flux field, with
native animation events and delayed beam interception. Their three stage
variants use the ordinary atomic publisher. The full supported-enemy runtime
sweep passes after updating older fixtures for stage-local features, native
Blade Knight rebirth HP and Storm victory behavior.

L-7 Whisperer adds incoming-direction maps to the existing shared beam tracer.
Its two open ends are reviewed against the native mesh and original stage
preview, with a shared source receipt retained by atomic preflight. Six more
stage entries retain browser and complete-wave checks; unsupported variant
runes and scheduled hidden devices remain explicit blockers.

Gertrude and Virtual Images reuse timed casting, homing projectiles, route-owned
summons and the Flux field. Their native bodies use the same immutable shared
asset registry. Non-primary summons do not hold victory open; this designation
does not lower target priority. Virtual Images retain their native +1 taunt.
The shared Weak talent spelling dispatches to independently checked Image and
Colossus contracts, with regression coverage for both families. Four further
stage additions retain the ordinary atomic publication and validation receipts.

Additive attack-speed runes reuse shared global/scoped stat compilation while
preserving literal fractional ASPD points. The reviewed LE-EX-5 challenge rule
adds 1.3 points; battle interval checks distinguish this from a multiplier.

Icefield Warriors, Hounds and Frigid drones now use bounded native contracts.
A permanent resistance behavior is shared by both hounds and drones; ordinary
Warriors claim only the reviewed no-combat helper. Original bodies remain in
the shared store. BI-1 passes the atomic admission path; Blizzard and the more
complex Kjerag enemy families remain explicit blockers for later stages.

Icefield Casters share the existing charged-Cold projectile controller with
explicit target-count and motion filters. The family source gate retains the
literal native projectile identities. Regression checks preserve Yeti and Flux
Caster support when handbook lines share the same text. Device evidence hashing
now uses the consumer's canonical JSON serializer, avoiding Python/JavaScript
exponent spelling differences without changing native numeric values or int64
pointer strings. Blizzard source intake is retained in BLIZZARD-REVIEW.md while
scheduled activation and the two independent timing paths remain blocked.

Enemy-support publication now checks every previously admitted identity before
writing either derived file, so an accidental registry collision cannot hide
behind a net increase in coverage. New registrations preserve prior coverage;
intentional withdrawals require the explicit `--allow-removals` maintenance
flag. Both derived files use atomic replacement, with the compact runtime
registry published last. Tests cover lost identities, removed records and valid
policy upgrades/additions.

Legacy challenge runes share character modifiers, natural-DP recovery and enemy
weight primitives. Class deployment bans preserve squad membership and reuse
one runtime/UI check. Six previously listed public challenge entries now receive
their missing source rules; new stages remain developer-only. See
`STAGE-LEGACY-RULES-REVIEW.md` for source selectors, checks and remaining gaps.

The CN Duck Lord and Crying Thief variants now reuse their existing native
controllers and prefab models with explicit source parameter validation. No
additional asset files are needed. See `REACTIVE-VARIANTS-REVIEW.md`.

Arc Screenguards now share a bounded damage-response counter, including the
source two-count activation threshold. See `ENEMY-SCREEN-GUARD-REVIEW.md`.

2026-11-15 continuation: six Dor experimental drivers, two Rhine Lab Engineers,
and dormant R-11/R-11a conversion now share feature/device/branch components.
Coverage is 656/2,163 enemies and 888/3,892 loadable combat stages. All 888 pass
the short runtime smoke; 387 enemy/wave/branch regressions pass. Heavy armour's
punch sequence and dormant artwork remain next family work. Harmless main-wave
actors now retain their lifetime instead of being treated as finished on spawn;
see STAGE-WAVES-REVIEW.md for the explicit accounting limits.

2026-11-15 continuation: R-31/R-31a punch behavior and all four dormant armour
variants now share controllers, including challenge toggles, branch HP transfer
and native outcome counters. Coverage is 658/2,163 enemies and 902/3,892 loadable
combat stages. All 902 pass the short runtime smoke; 418 broader regressions pass.
Generated route paths preserve waits/tunnels, and rebuilds discard stale generated
paths while retaining viewer evidence. Four original dormant bodies now use a
shared single-body device asset pipeline with on-demand stage loading. All four
variants pass desktop/touch conversion and restart checks. Dorothy's trap ability
and Awaken's boss mechanics are the remaining active family work; these counts do
not claim native frame parity or completion of the full catalogue.

2026-11-15 continuation: enemy Dorothy now composes source-timed casting, ordinary
projectiles and persistent tile triggers. DV-5 and both DV-EX-7 variants load from
their existing source graphs. Coverage is 659/2,163 enemies and 905/3,892 combat
stages; all 905 pass the short runtime smoke. Eight focused tests and 404 broader
regressions pass. Original-wave deployment, original body artwork and trap
activation pass desktop/touch browser checks. Native trap effects remain temporary
markers; Awaken and unbound source branches still block the remaining DV stages.
See `ENEMY-DOROTHY-REVIEW.md` for explicit timing and fidelity boundaries.

2026-11-15 continuation: Awaken's independent DamageSplit talent now shares
post-mitigation damage through the common HP-loss pipeline. The shared wave
scheduler can release current members and carry a living source to the next
wave, without changing scheduled spawns or final kill accounting. Five component
tests, 28 scheduler tests and 160 combined regressions pass. Exact boss animation
clocks and four projectile prefabs are retained. Full Awaken support remains
blocked on controller composition; coverage remains 659 enemies / 905 stages.
See `ENEMY-AWAKEN-REVIEW.md` and `arkpedia-awaken-components-review.json`.

2026-11-15 continuation: device source validation now compiles eleven runtime
factories into 272 shared definitions, removing the raw device extraction from
the browser import graph. The Fang/Kroos source closure is about 2.31 MB instead
of 3.68 MB. All 905 available stages pass runtime smoke. The 1,357 broader tests
pass after correcting the fixture collector to exclude review receipts; 27
additional integration tests pass. See `DEVICE-RUNTIME-REVIEW.md`.

The shared inclusive HP checker and verified stateless helpers bring enemy
coverage to 676/2,163. Source-verified self-fear handles HP loss, resistance and
independent speed expiration; other Sankta skills remain blocked. The 189
combined feature tests and all 905 stage smokes pass. Twenty-seven enemy bodies
and three reward-device bodies have been added with fifteen shared-model aliases;
desktop/touch galleries and controlled battle checks pass. Stage admission remains
905/3,892. See `ENEMY-SELF-FEAR-REVIEW.md` and `SUPPORTED-BODY-ART-REVIEW.md`.

### Prayer checkpoint (2026-11-15)

- Added a reusable global stat-debuff cast using source beginning-selection,
  original release/end clocks, empty casts and nonstacking duration extension.
- Admitted both Prayer variants: 678/2,163 enemies. The 905/3,892 stage count
  remains unchanged because other requirements still block the affected maps.
- Six focused/192 combined tests, two bodies/ten clips on desktop and touch,
  and all 905 ten-second stage smokes pass. See `ENEMY-PRAYER-REVIEW.md`.
- Continuing with native ammo theft through a shared external-consumption API.

### Ammo-theft checkpoint (2026-11-15)

- Added shared external ammo consumption with independent event control and
  controller synchronization, then reused projectile transport for native theft.
- Both Eyes variants are admitted; all eight Sankta variants now pass their
  separate source gates. Coverage is 680/2,163 enemies and 905/3,892 stages.
- Six focused and 148 regression tests pass. Both bodies/ten clips pass desktop
  and touch review; see `ENEMY-AMMO-THEFT-REVIEW.md`.
- The Sarkaz mode’s parasitic environment requires native parasite spawning and temporary Mark of Epoch tiles; neither is treated as an inert effect.

### Icefield Berserker checkpoint (2026-11-15)

- Reused resistance and Frozen-target attack scaling for both Berserker variants,
  including the native neutral Cold-only branch and namespaced parameter binding.
- BI-EX-6 and Challenge Mode now load from source: 907/3,892 stages and
  682/2,163 enemies. Both complete original wave schedules pass a no-deployment
  execution check with elevated test life; all 907 ten-second smokes pass.
- 182 regression checks, the additional full-wave test, and both original body
  galleries pass. See `ICEFIELD-REVIEW.md` and `arkpedia-berserker-review.json`.

## Epoch host and tile-field checkpoint

Added the shared parasite environment, Dreadkaz birth action, neutral Mark actor,
and overlapping tile-buff field. Stage compilation retains level-owned host
markers and follows their spawn dependencies instead of adding stage-specific
scripts. Neutral actors stay out of enemy selectors and completion counters.
Coverage is 684/2,163 enemies and 907/3,892 loadable stages; the related Sarkaz
maps still require other devices and branch bindings. See
`ENEMY-EPOCH-REVIEW.md`. Next, reuse the Mark actor for the Spines of Epoch device
and continue the missing shared mode/device capabilities.

## Spines of Epoch checkpoint

The placed device now reuses the neutral Mark actor and shared tile field. Its
source-owned activation, lifetime, immunities, taunt and defeat result run in the
existing device controller. Generic device spawn dependencies make its enemy
records load atomically. All 344 original placements across 163 levels validate;
coverage remains 684 enemies and 907 stages because those levels have additional
missing components. See `STAGE-EPOCH-SPINES-REVIEW.md`.

2026-11-15 — Wither Caster checkpoint: two native-gated variants share a travelling
healing channel with Gramophone Whisperers. Original Begin/Loop event clocks,
recipient identity, eight contact pulses, interruption and prior-lock restoration
are covered. Six focused and 197 combined tests pass. All 909 compiled stages
pass the ten-second smoke; 686/2,163 enemies are admitted. Two original models pass
16 desktop/mobile clip checks. See ENEMY-WITHER-CASTER-REVIEW.md and the immutable
checkpoint receipt. Twigs That Crave device admission remains separate work.

2026-11-15 — Twigs preparation: retained original device/skill source, prepared
native and instance contracts, and generalized the existing pollution field for
removable persistent producers. Forty-five combined checks pass. Across 148
cached placements, 147 validate and one conflicts on a repeated damage key.
Public device registration remains gated on mode/progress/death-route runtime
and visual integration. See STAGE-TWIGS-PREPARATION.md.

2026-11-15 — Twigs runtime checkpoint: shared device loading, original circular
footprint and animation event, permanent low-HP mode, scheduled activation,
managed death branch and progress-triggered release are implemented. Rot Eater
birth scaling now uses the resolved counted-enemy fraction and a removable
pollution field. Controlled 11-7/11-8 runs verify children hold victory without
counter credit. Compilation reaches 911 stages. The conflicting duplicate-key
placement remains refused. See STAGE-TWIGS-REVIEW.md.

2026-11-15 — Wither Tank checkpoint: two native-gated variants share charged
ranged attacks, blocked double-damage rams and independently owned moving
pollution fields. Six focused tests and the initial 216-test combined suite pass;
all 912 compiled stages pass smoke checks. Controlled 11-9 completion passes.
Enemy admission reaches 688/2,163. Original bodies pass twelve desktop/mobile
clip checks. See ENEMY-WITHER-TANK-REVIEW.md.

2026-11-15 — Steam Tank checkpoint: two native-gated variants compose the shared
timed cast with a bounded sampling projectile. Highest-max-HP input, fixed x-4
footprint, highest-current-HP-ratio samples and delayed Arts receipts are covered.
Seven focused and the initial 208 combined tests pass; all 918 available stages
pass smoke checks and controlled 11-18 completion passes. Admission reaches
690/2,163 enemies. Twelve original body clips pass desktop/mobile checks.
See ENEMY-STEAM-TANK-REVIEW.md.

2026-11-15 — Theresis checkpoint: the narrative actor uses its original
Kaltsit-only selector and Attack event, shared timed cast and reusable swept
piercing wave. Existing rebirth handlers remain active. Original 11-17 resolves
its literal full-strength Rot Eater floor, keeps starting Life Points and emits
one lethal slash at pre-placed Kaltsit. Initial 210 combined and final eleven
focused checks pass; all 919 compiled stages pass smoke checks. Four original
body clips pass desktop/mobile review. Admission reaches 691/2,163 enemies.
See ENEMY-THERESIS-REVIEW.md.
