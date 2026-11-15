# Shared route clocks and predefined operators

The 2026-11-14 continuation adds two reusable capabilities. Stage IDs select data;
none of the runtime changes branch on a particular stage ID.

## Route clocks

Original `WAIT_CURRENT_FRAGMENT_TIME` and `WAIT_CURRENT_WAVE_TIME` checkpoints
are resolved to ordered viewer path positions. Every scheduled spawn captures
its actual wave/fragment origins. Movement waits until that captured deadline,
not for another full duration after arrival. Later waves, blocking and control
cannot reset the deadline. Children retaining a parent's remaining route keep
absolute deadlines. Clock-relative and arrival-relative waits at one checkpoint
retain their original order without duplicating viewer holds.

This restores 829 clock checkpoints across 83 stages in the preceding 769-stage
library. A diagnostic 0-11 Challenge battle checks both original 30-second
fragment waits. The core tests also cover early/late arrival, control past the
deadline, route inheritance and scheduler transitions. Stationary stage devices
now explicitly use stationary routes instead of briefly borrowing route zero.
Battle time remains the simulator's 30 Hz model; this is not native coroutine or
animation-frame calibration. Legacy snapshots without an original wave program
retain their historical viewer-only timing.

## Predefined operators

The original level's cards and positioned actors compile into a shared program.
Hidden cards cannot deploy before their activation action. Initial and scheduled
actors use existing operator records, skills, talents, deployment and retreat
code. Activation is free and idempotent; actor coordinates/facing come from the
source. Source actors can occupy a tile unavailable to manual deployment, while
bounds and occupancy checks remain. Actions share the timed queue with enemies,
retain source action order at equal times, and never enter enemy kill/unspawned
totals. The existing shelf hides inactive cards and reveals activated cards.

Instance builds validate before publication. Duplicate operator identities,
unsupported modules/mastery/talent overrides, actors without a fixed squad and
unimplemented device targets remain explicit blockers. A source-disabled skill
is supported for the basic one-to-three-star kits and uses an empty skill runtime.
More complex skill-less forms require an additional lifecycle review.

`arkpedia-favor-source.json` retains the original favor table and verifies its Git
blob. Raw favor points are not displayed trust percentages. Exact frames and
constant battle-phase intervals are supported; intervals needing a native integer
interpolation contract are refused. This includes the original five-point cards
in 1-11, which have zero battle-phase stat bonus. No artwork is duplicated.

## Verification at this checkpoint

- 772 available stages; all pass the ten-second graph/runtime smoke.
- 56 combined compiler, library, wave, route-clock, predefined, fixed-squad and
  playthrough tests pass. Separate pathing regressions passed 41 overlapping tests.
- Desktop and touch checks pass for TR-4, TR-6 and 1-11, including hidden-card
  release, a preplaced Durin and scheduled Adnachiel.
- The existing full 5-4 legal-deployment playthrough still clears all 52 enemies.

Sixteen stages use the predefined program. The net stage count is not the number
of newly implemented behaviors: stricter source checks also expose previously
omitted actors/overrides. These checks do not certify every stage clear, tutorial
interaction, collectible, module or native-client frame. Results are recorded in
`data/arkpedia-capability-review.json`; screenshots are under
`.cache/arkpedia/stage-predefined-review/`.
