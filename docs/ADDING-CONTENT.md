# Adding content to the stage simulator

Three registries decide what the simulator accepts. Each is data-driven; no
per-content branch belongs in the battle or the UI.

## Enemies

1. **Record** — `data/arkpedia-enemy-records.json` compiles every Global enemy
   at every database level from the pinned tables
   (`tools/arkpedia/enemy-records.mjs`). Do not hand-edit it.
2. **Feature** — add the behaviour to
   `shared/arkpedia/enemy-features.js`:
   - `covers(record, native)` must prove the compiled record models the
     feature, using the exact blackboard signature and, when the data alone is
     ambiguous, the retained original component shape.
   - `ability: { kind, params }` names a builder in `featureAbilities`
     (`server/sim/content/enemies.js`), and `explains` covers the handbook
     line(s) the talent replaces.
   - A feature that implements a reviewed native wrapper or active common
     ability declares `nativeClaim(prefab, components)`. Only the claimed
     counts are subtracted from the support refusal; an unclaimed wrapper still
     refuses the enemy.
3. **Native evidence** — if the feature reads original components, add the
   object name to `OBJECTS` in
   `tools/arkpedia/extract-enemy-native-abilities.py` and regenerate both that
   file and the support registry. The extractor refuses a component whose
   digest no longer matches the timing index.
4. **Support** — `node tools/arkpedia/enemy-support.mjs` derives
   `data/arkpedia-enemy-support.json` and the compact
   `data/arkpedia-regular-enemies.json`. An enemy is supported only when every
   handbook line, talent group and skill is covered, every native ability
   wrapper is cleared by a reviewed feature, and every enemy it spawns is
   supported too.
5. **Test** — add a real-enemy assertion in
   `test/arkpedia-enemy-features.test.js` (`spawnAny` or `makeBattle`). The test
   must observe the effect, not merely the support flag.

If the data does not settle a number, leave the enemy unsupported and name the
missing fact in its `reasons`; do not guess.

## Stages

1. Build the stage file:
   ```sh
   node tools/arkpedia/build-stage.mjs \
     --stage ../arkpedia-data/source/data/stages/<slug>.json \
     --geometry ../arkpedia-data/source/data/stage-geometry/<slug>.json \
     --playback ../arkpedia-stage-overhaul/public/stage-detail/<slug>.json \
     --out data/arkpedia-stage-<slug>.json
   ```
   The builder validates the route/geometry hash, the sequential wave
   schedule, the supported enemies, and each level file's enemy database level
   and attribute overrides. A viewer break plus its matching tunnel hold becomes
   DISAPPEAR/WAIT/APPEAR legs; an unmatched break is refused. A stage's
   `fixed_squad` is used instead of the caller's selection (the prep page shows
   a notice); deployable tokens, conditional spawns and oversized grids are
   refused rather than approximated.
2. Regenerate the catalogue:
   ```sh
   node tools/arkpedia/stage-index.mjs
   ```
   Every new file becomes a `testOnly` entry. Curated entries (the embedded
   0-1, and any reviewed file with no `testOnly`) are preserved.
3. Test: `node --test test/arkpedia-stage-files.test.js` discovers every
   `data/arkpedia-stage-*.json`, loads it through the catalogue and fights a
   real ten-second battle.
4. Review it locally at
   `http://localhost:3182/arkpedia/?experimental=1&stage=<slug>`. The public
   picker still shows only entries without `testOnly`.
5. Promote after review by removing `testOnly` from that entry (or replacing it
   with a curated entry); the generator will keep it. Re-run the catalogue
   check and the full suite.

Adding a stage to the runtime therefore never edits the battle, the renderer or
the UI: the catalogue and the stage file are the whole interface.

## Operators

Operators use the same pattern at a larger scale:

- `shared/arkpedia/operators.js` is the regular-stage roster and each
  operator's reviewed skill/talent policy.
- `tools/arkpedia/build-mvp.mjs` compiles the selected builds and assets into
  `data/arkpedia-mvp.json`; the runtime rejects unknown operators, skills,
  blackboard keys and builds.
- Source evidence and review notes live in `docs/<NAME>-REVIEW.md`, with the
  prefab/digest receipts under `data/arkpedia-<name>-*.json`.
- A new operator needs every source skill, E0/E1/E2 caps, rank unlocks, the
  public test, and the review document before it joins the roster.

## Checks

- `node --test` runs the full suite; the focused subsets are
  `test/arkpedia-enemy-*.test.js`, `test/arkpedia-stage-*.test.js` and
  `test/arkpedia-battle.test.js`.
- `.github/workflows/ci.yml` runs on GitHub-hosted `ubuntu-latest` and
  `windows-latest` for Node 22 and 24. `test/arkpedia-ci-runners.test.js` fails
  if a job names a self-hosted runner or selects one through a repository
  variable.
- Feature-branch pushes do not start CI; the pull request does.
