# Shared original wave programs

Stage execution now retains original waves, fragments, action delays and spawn
flags. The library compiles this program automatically from the checksum-verified
original level behind each rule receipt. One shared scheduler executes it; no
stage-specific timing branches are used. Identical programs are stored once as
components, independently of geometry, enemy stats and challenge modifiers.

## Source contract

The retained level contains `preDelay`, `postDelay`,
`maxTimeWaitingForNextWave`, fragment/action delays, counts, intervals,
`blockFragment`, `dontBlockWave` and `isUnharmfulAndAlwaysCountAsKilled`.
Named and numeric action enums follow the stage importer's retained decoding.
The compiler verifies every spawn against the viewer export and resolves its
original route geometry. Unknown action kinds, random choices, unmanaged actions,
extra routes and unresolved hidden groups remain explicit blockers.

The source exporter's `runFragments` includes a wave's opening delay in spawn
times, and `buildWaves` includes opening and closing delays in its duration.
The old adapter added these delays again. Its compatibility path now uses the
already-inclusive times. Generated library stages instead use the original
fragment program, preserving clear waits that a flat timeline cannot represent.

Presentation actions retain their scheduling span; their UI/cutscene completion
is immediate in the simulator. This does not implement interactive tutorials or
scripted story effects. Scheduled predefined activation is still refused until
its operator/device lifecycle is implemented.

## Execution

- Future fragment spawns remain in the existing precounted battle queue. Arming
  a fragment assigns its actual spawn times; timeout records unreleased spawns
  as unspawned rather than kills or leaks.
- Fragments emit all their actions, then advance after their queue completes.
  `blockFragment` concerns completion of an action; synchronous spawning completes
  after creating the unit, without waiting for its death. Empty action queues
  do not consume fragment pre-delay. Presentation completion remains headless.
- Waves wait for their managed enemies, then apply their closing delay. The
  maximum wait starts when the action queue completes; it releases only that
  wave's gate and never despawns enemies. The final wave cannot time out.
  The model treats -1 as unlimited and zero as immediate timeout. Managed enemies
  from a timed-out earlier wave do not block subsequent waves. Untagged summons
  and unowned pending battle timers conservatively retain their battle lifetime;
  exact native summon membership remains a separate fidelity limitation.
  Zero-delay transitions use a bound derived from the finite program.
- `dontBlockWave` affects the wave gate without changing kill totals. The native
  `isUnharmfulAndAlwaysCountAsKilled` flag excludes planned kills and LP loss,
  while retaining the actor’s combat and wave/battle lifetime. It does not mean
  “already finished at spawn.” Explicit actor features such as temporary Flux
  fields may independently opt out of victory waits. No death is fabricated on exit.
  This is the simulator’s explicit accounting policy; the retained native options
  distinguish `alwaysCountAsKilled` from `dontCountAsFinished`, and the public
  Chapter 6 exit-accounting review independently documents that distinction.
  Native method-body parity and scoreboard kill credit on harmless exit remain
  separate fidelity work.

## Conditional routes

Hidden-group exports keep original route indices, while ordinary viewer routes
are deduplicated. The same number can therefore identify different routes.
The compiler now resolves a hidden spawn's original route, reuses equal geometry
or adds the missing route, updates entry/exit metadata and compiles its path.
This repairs AW-8 Challenge, GA-EX-7 Challenge, IW-EX-7 Challenge, LE-EX-4 Challenge
and PS-3 Challenge through the same resolver. Source geometry is not mutated.

## Validation and limits

`test/arkpedia-stage-waves.test.js` covers delay composition, managed-wave waits,
finite wait deadlines, action completion, nonblocking enemies, empty waves,
same-tick transitions, timeout totals, harmless spawns, pending enemy timers,
route remapping and unsupported action refusal. Final-wave waits, empty fragments,
post-clear delays and previous-wave isolation have explicit regressions.
Library tests verify independent
sharing and loading of wave components. The original 5-4 playthrough also runs
the compiled program with legal placements and natural DP/SP through all 52
enemies to a clear.

`npm run content:library:check` checks every generated graph and runs a short
runtime smoke. The browser review checks original-program execution on desktop
and touch, and holds then clears the first combat wave of 3-6 Challenge to verify
that its 19 later enemies stay pending until release. These are behavioral
regressions, not a frame-for-frame native-client certification.

The 2026-11-14 build contains 769 available stages out of 3,892 combat stages;
all 769 passed the ten-second graph/runtime smoke. Twenty entries admitted by
the earlier flat-timeline build are now blocked by scheduled predefined
activation that it silently omitted. Five hidden-route mismatches discovered
during migration were repaired by the shared route resolver. All 25 enabled
hidden-spawn actions in those five stages were checked against their original
route origins using real battle spawns (diagnostic high life, no operators
deployed; not stage clears).

The browser review passed ten original-program battles across desktop and
touch, two unavailable-stage checks and the existing controlled home fixture.
The broad stage regression run passed 1,211 of 1,212 cases initially; the remaining
case exposed a pre-existing placement-error ordering issue for forbidden cells.
Checking that restriction before generic token tile eligibility fixes the
message, and all 23 targeted wave/placement/supply/scenery reruns passed.
The focused compiler/library suites passed 43 cases, and the battle/fixed-squad/
enemy-support suites passed 26. These suites overlap; their counts should not be
added together. Recorded results are in `data/arkpedia-wave-review.json`.
After the scheduler research corrections, the combined wave/compiler/library/
playthrough rerun passed all 39 tests; the separate placement/scenery/supply
rerun passed all nine tests.

The scheduling review also compared public research. ArkBattle's
[scheduler summary](https://github.com/wfrfred/ArkBattle/blob/196426f20a6ec53b168e6dae1b308136e8fa426c/docs/research/01-scope-and-battle-flow.md#6-官方-scheduler-已确认的语义)
identifies action-completion callbacks, separate wave/final membership, post-clear
delay ordering and the final-wave timeout exception. This corroborates the shared
model and corrected an initial fragment-death interpretation before delivery.
No reference implementation code was imported. Native spawn-animation lead time,
coroutine wake order and floating-point timing remain uncalibrated. Public
research is not a substitute for a native-client playback comparison.

To repeat source-backed route diagnostics, restore the pinned original level
cache through the existing rule importer, then run
`node tools/arkpedia/review-stage-wave-routes.mjs`. Its results and browser
screenshots are under `.cache/arkpedia/stage-library-review/`.

Remaining scheduling work includes predefined operator/device activation,
random/branch actions, interactive tutorial actions and mode-specific clocks.
Absolute/current-fragment/current-wave route-wait fidelity also needs a separate
movement-clock review; retaining correct action clocks does not establish that
all movement waits already match the native client.

## Explicit native wave release

`StageWaveScheduler.releaseCurrentWave(source, {trackSourceAtNextWave})` releases
currently present members from the current wave gate. It leaves pending actions,
fragment deadlines, post-delay, live bodies, route clocks and planned kill totals
intact. The optional source transfer holds the following wave until that source
finishes. A last-wave release cannot create an extra wave or bypass final victory.
A newly spawned member after release still belongs to its scheduled wave.

This is the zero-delta, single-source form used by the retained
`track_at_next_wave_when_buff_finish` template. It is corroborated by the
[public release-wave description](https://prts.wiki/w/游戏数据基础) and the
[pinned native action declaration](https://github.com/AdoreJc/ArknightsDB/blob/95ce0f0823f233389fa97e0d7fc9d1759e58464e/source/dump/FinishCurrentWave.md).
The public scheduler separately declares release, next-wave tracking and a deep
finish operation; this adapter does not cancel pending spawns. Nonzero wave
deltas and transferring all managed enemies are not exposed. Unowned delayed
summon timers retain their conservative clearance behavior. Three regressions
cover live transfer, action preservation, and the last-wave boundary.
