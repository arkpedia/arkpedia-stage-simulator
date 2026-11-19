# Capability-driven stage library

The primary browser catalogue now comes from the shared source compiler. Stage
availability no longer depends on creating a standalone stage file, registering
it in the legacy index, or promoting it after an individual browser review.
Stage IDs identify data. Enemy features, devices, terrain, conditional waves and
stage-rule contracts determine whether that data can execute.

## Delivery and additions

`npm run content:library` discovers source combat stages and publishes a static
manifest plus immutable JSON components. Geometry, pathing, enemy definitions,
enemy stats and fixed-squad records have separate references. Equal components
are stored once, including across normal/challenge variants. Existing artwork
continues to use explicit model aliases and its own immutable asset pins.

The browser fetches only a selected stage's component closure, verifies SHA-256
checksums, shares concurrent requests and bounds its payload cache to 16 MiB.
The complete graph is resolved before replacing the active stage. Switching
restores base enemy/operator records before applying the next stage's overrides.
Component files are published before an atomic manifest replacement. Existing
components remain available for clients holding older manifests.

To add support, implement and test a shared mechanic and its source contract,
regenerate derived enemy support where applicable, then rebuild the library.
All source stages satisfying those contracts are included automatically.
Original level receipts remain provenance inputs, and unsupported mechanics
remain explicit. The generated report groups missing capabilities by their
shared reason and lists affected stages; these counts overlap.

## Initial loader verification on 2026-11-14

These counts record the initial loader build. The subsequent original-wave
implementation and current verification are documented in `STAGE-WAVES-REVIEW.md`
and `data/arkpedia-wave-review.json`; `arkpedia-library-report.json` is the current
capability inventory. New source checks can expose omissions in previously
registered stages rather than silently keeping incomplete simulations available.

- Discovered 3,892 combat stages: 789 available and 3,103 with missing contracts.
  The legacy catalogue had 938 entries, of which 149 fail current source checks.
  Those failures are now visible instead of being hidden by prior registration.
- All 789 available graphs passed checksum loading and a ten-second battle
  constructor/runtime smoke check, reading all 4,798 published components.
- 31 focused tests cover source discovery without registration, source-compiler
  round trips, component sharing, corrupt/missing downloads, retry, bounded
  concurrency/cache, atomic installation/publication and switching isolation.
  The focused HTTP test also verifies immutable component caching and mutable
  manifest caching.
- Desktop and touch Chromium started real battles for 0-1, 0-4 Challenge,
  3-6 Challenge and BW-8 Challenge, with no page/runtime errors. The checks verify
  the class deployment restriction and predefined detector removal, and confirm
  that requests use the library rather than legacy stage JSON files.
- On both layouts, 0-6 Challenge explains its missing stage modifier and fetches
  no stage components. The unchanged operator-review fixture server retains its
  controlled home scene (99 initial DP and empty waves).

Shared components total 9,605,133 bytes, compared with 13,379,534 bytes for inline
stage payloads. The complete catalogue is 1,361,815 bytes (233,233 bytes gzipped).
An explicit 0-1 selection needs eight component objects totalling 7,447 bytes
(3,342 bytes when each is gzipped). These are JSON transfer measurements; artwork,
JavaScript and the separate roster bootstrap are additional.

## Reproduce

```sh
node --test test/arkpedia-stage-library.test.js test/arkpedia-stages.test.js test/arkpedia-content-addition.test.js
node --test --test-name-pattern='ETag / Last-Modified' test/lobby.test.js
npm run content:library:check
# Start the local preview first; set the browser executable for this machine.
ARKPEDIA_REVIEW_CHROME=/path/to/chromium npm run content:library:review
```

`ARKPEDIA_REVIEW_ORIGIN` selects another local preview. Browser screenshots and
results are written under `.cache/arkpedia/stage-library-review/`.
`data/arkpedia-library-review.json` records verification results and file hashes.

## Publication with each enemy batch (owner's decision, 2026-11-17)

From 2026-11-17 the library is rebuilt and reviewed with every enemy batch, so stages whose enemies become supported are published at once. The first rebuild made 8 stages available (CG-S-1, CV-1, CV-6, CV-EX-6, DC-S-1, both FM-2 variants and ISW-SP); none became unavailable. `npm run content:library:check` smoked all 978 graphs without failures, and the browser review passed on desktop and touch. The review ran with `ARKPEDIA_REVIEW_ORIGIN=http://127.0.0.1:3185` (ports 3182–3184 are reserved) and Playwright's `chrome-headless-shell` as `ARKPEDIA_REVIEW_CHROME`. The review script now treats a stage without a device runtime as having no manual devices, because device runtimes load only for stages that use them. `data/arkpedia-library-review.json` stays the 2026-11-14 receipt; later reviews are recorded here and in the batch documents.

The Emperor's Blade batch (2026-11-17) published DC-8, DC-8 Challenge, WD-8, WD-EX-8 and WD-EX-8 Challenge (983 available, none withdrawn). The smoke check passed all 983 graphs, and the browser review passed.

The Andoain batch (2026-11-17) published FD-8, FD-8 Challenge, GA-8, GA-EX-8 and GA-EX-8 Challenge (988 available, none withdrawn). The smoke check passed all 988 graphs, and the browser review passed.

The Leader batch (2026-11-18) published FC-8, FC-EX-8, FC-EX-8 Challenge and `camp_r_17` (992 available, none withdrawn). The smoke check passed all 992 graphs, and the browser review passed.

The Mandragora batch (2026-11-18) published 9-19, 9-19 Challenge, H9-6 and `camp_r_09` (996 available, none withdrawn). The smoke check passed all 996 graphs, and the browser review passed.

The 'Awaken' batch (2026-11-18) published DV-8, DV-EX-8 and DV-EX-8 Challenge (999 available, none withdrawn). The smoke check passed all 999 graphs, and the browser review passed.

The Mephisto batch (2026-11-18) published M8-8, M8-8 Challenge and H8-3 (1,002 available, none withdrawn). The smoke check passed all 1,002 graphs, and the browser review passed.
The Big Ugly Thing batch (2026-11-18) published RI-8, RI-EX-8 and RI-EX-8 Challenge (1,005 available, none withdrawn). The smoke check passed all 1,005 graphs, and the browser review passed.
The Manfred batch (2026-11-18) published 10-17, 10-17 Adverse, H10-1 and H10-2 (1,009 available, none withdrawn, no other bundle changed). H10-3 stays blocked on its `aura_on` override. The smoke check passed all 1,009 graphs, and the browser review passed.
The Theresa batch (2026-11-18) published 14-21 and 14-21 Adverse (1,011 available, none withdrawn, no other bundle changed). H14-4 stays blocked on Patriot and its environment. The smoke check passed all 1,011 graphs, and the browser review passed.
The Patriot batch (2026-11-18) published 7-18 and 7-18 Challenge (1,013 available, none withdrawn, no other bundle changed). The smoke check passed all 1,013 graphs, and the browser review passed.
The Talulah batch (2026-11-18) published H8-2, JT8-2 and JT8-2 Challenge (1,016 available, none withdrawn, no other bundle changed). The smoke check passed all 1,016 graphs, and the browser review passed.
The FrostNova batch (2026-11-18) published 4-10 (1,017 available, none withdrawn, no other bundle changed). 4-10 Challenge stays blocked on its `ebuff_skill_radius` rune. The smoke check passed all 1,017 graphs, and the browser review passed.

The Phantom mid-boss batch (2026-11-19: Lost Colossus, Jetman, Wandering Puppet) published ISW-DF b-1 "Mind the Doors", b-2 "Theft from Above" and b-4 "Fatal Melodies" (1,020 available, none withdrawn, no other bundle changed). b-1 also needed the stage enemy check to accept its empty random-group SPAWN choice, which the original wave program already paired with an `emptyChoice`. The smoke check passed all 1,020 graphs, and the browser review passed.

## Remaining work

This is a loading and composition architecture, not complete native fidelity.
The all-stage smoke check does not prove stage clears, interactions throughout
a battle, or exact game timing. Remaining work includes reusable enemy families
and boss phases, original wave/action scheduling, environment rules, visibility,
stage modifiers and configurable individual-stage special-mode rules.

Startup still parses the combined operator/model/token bootstrap (27.8 MB
uncompressed) and eagerly imports behavior modules. Splitting the roster and
model metadata by dependency is the next delivery improvement; full operator
skill/module fidelity is a separate remaining implementation task. The home
page temporarily reuses the embedded default scene, preserving existing
controlled reviews. Explicit stage selections always load the component graph.
Whole mode runs and carried progression remain outside the agreed scope.
