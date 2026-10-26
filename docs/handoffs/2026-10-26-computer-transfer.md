# Development handoff — 26 October 2026

The user requested finishing the current preparation/entry step, saving this
handoff, and stopping for continuation on another computer. Resume development
only in the receiving session; do not restart the old MacBook session in parallel.

## Checkout and priority

- Repository: https://github.com/arkpedia/arkpedia-stage-simulator
- Branch: `dev/windows-stage-continuation`
- Windows checkout: `E:\Projects\arkpedia-stage-simulator`
- Implementation checkpoint: `49ef0ae767f113bb04da3660aa2b3d30e0354724`.
- The handoff commit immediately follows that implementation checkpoint.
- Earlier Windows continuation history: `docs/DEVELOPMENT-PRIORITIES.md`.
  The older `docs/handoffs/windows-21a6434c.md` describes the original Mac transfer,
  not the current checkout procedure. Do not reapply its old patch/archive.

User priority: finish **all enemy, stage and operator mechanics, including
modules**, then stage art/models/enemy chibis, then operator/enemy/environment
effects. Operator registrations are largely present but registration is not a
complete mechanics audit. The overall goal remains unfinished. Do not merge,
deploy, promote the public catalogue, or treat source evidence as parity proof.

In a clean existing checkout:

```sh
git fetch origin
git switch dev/windows-stage-continuation
git pull --ff-only
npm ci --no-audit --no-fund
```

Preserve any receiving computer's uncommitted work before switching. A fresh
clone can use `git clone --branch dev/windows-stage-continuation
https://github.com/arkpedia/arkpedia-stage-simulator.git`.

## Current step completed

17-16 now uses source-owned, nonselectable preparation in the actual app and
the same battle dispatcher for Start and Restart. Preparation displays only
the starting Viy (E2/90, S3M1, potential 6, trust 200%, deployed facing right).
Player squad/build/support editors are absent. Four hidden reinforcement cards
remain hidden until the retained level actions introduce them. Caller squad or
support input cannot add a player card to this scenario.

Key files:

- `server/sim/arkpedia-stage-entry.js`: dispatch after catalogue resolution;
  ordinary stages still use StandardBattle and its existing squad validation.
- `server/sim/content/arkpedia-stage-17-16-mechanics.js`: source digest and exact
  preparation checks; immutable presentation model exposes no hidden card IDs.
- `public/arkpedia/fixed-stage-preparation.js`, `public/arkpedia/app.js`: fixed
  preparation presentation, loading, Start and Restart.
- `tools/arkpedia/internal-17-16-review.mjs`: loopback-only private catalogue
  feeds the unmodified app resolver/preparation/dispatcher. Read-only QA hook.
- `tools/arkpedia/public-review-server.mjs`: optional validated local catalogue.
- `test/arkpedia-stage-17-16-mechanics.test.js` and
  `test/arkpedia-operator-controls.browser.test.js`: construction, mutation,
  ordinary-stage regression and desktop/phone interaction checks.

**17-16 remains absent from the production catalogue, even with experimental=1.**
The private review catalogue is a test fixture, not admission. The normal public
URL still refuses the stage. No art/effects or public stage/module promotion
was performed.

## Validation

- Available local focused cohort: **1,743 passed**, zero failures/skips. Only
  the four known quarantined files below were excluded, not a complete local run.
- Construction/preparation: **13 passed**, including natural clears on seeds
  1 and 71; battle/control/summon regression: **46 passed**.
- Final actual-app 17-16 desktop/phone case passed, including fixed preparation,
  preset skill controls, hidden module cards, deployment, retreat and restart.
- Regular 17-12 desktop/phone/public-refusal/restart case passed.
- The combined browser run had one Closure preparation-button timeout; the
  unchanged isolated Closure rerun passed desktop/phone, recovery and restart.
  This transient failure is retained in `.cache/stage-entry-final-browser.log`;
  successful rerun is `.cache/stage-entry-closure-final.log`.
- Final fixed-preparation screenshots on desktop and phone were visually
  inspected. `.cache` logs/screenshots are local and ignored; hosted workflow
  uploads its own internal workspace artifacts.
- `git diff --check` passed. No production catalogue change.

Prior hosted checkpoints, confirmed completed successfully during transfer:

- Continuation at `d948a507a24d78cabdfe01d61514d2003ef3c019`:
  https://github.com/arkpedia/arkpedia-stage-simulator/actions/runs/40257327913
- Full Linux/Windows Node 22/24, all eight shards, at
  `9cc3e1928eb7591b81d31313e00941e5060366e3`:
  https://github.com/arkpedia/arkpedia-stage-simulator/actions/runs/40253842795

These successful runs predate this preparation step. Fresh continuation checks
are triggered by the final push; a fresh full run is dispatched at the handoff
head. Inspect the exact head before claiming hosted validation:

```sh
gh run list --branch dev/windows-stage-continuation --limit 10
gh run view RUN_ID --json status,conclusion,headSha,url
```

## Local antivirus limitation

Bitdefender has repeatedly quarantined four benign simulator tests. They are
unchanged and retained in Git/hosted CI, but appear as local deletions here:

- `test/arkpedia-ch16-engagement-ground.test.js`
- `test/arkpedia-ch16-family-registration.test.js`
- `test/arkpedia-ch16-phantom.test.js`
- `test/arkpedia-unharmful-spawn.test.js`

Do not stage those deletions, disable antivirus, or repeatedly restore files.
The user cannot access this PC now and will inspect detections when back.
Hosted checks cover the affected files. A clean receiving checkout should have
all four. Use explicit paths when staging work in this Windows checkout.

## Reproduce checks and source evidence

Use Node 24 (Windows used 24.19), `npm ci`, and Python dependencies from
`tools/arkpedia/stages/requirements.txt` when extracting native source.

```sh
node --test test/arkpedia-stage-17-16-mechanics.test.js
npm run test:arkpedia-ch16
```

The full focused command requires all test files. Local transfer validation
excluded only the four quarantined files; `.cache/run-flyer-focused.mjs` is an
ignored local helper, not a portable repository command.

Browser tests use `RENDER_E2E=1`, `CHROME_PATH` pointing to Chrome/Edge,
`CH17_QA_STAGE=17-12` and `CH17_QA_OUT=logs/stage-entry-public-17-12`:

```sh
node --test --test-concurrency=1 test/arkpedia-ch17-ui.browser.test.js test/arkpedia-operator-controls.browser.test.js
```

Windows Edge path: `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`.
Linux CI uses `/usr/bin/google-chrome`. Run heavy browser tests serially before
the focused CPU-heavy suite. Closure recovery checks use the literal simulation
deadline plus native OnStart offset, with bounded wall time for software rendering;
do not alter gameplay timers to make CI pass.

Ignored `.cache` source bundles, raw gamedata, screenshots and local environments
are **not transferred by Git**. Use `.github/workflows/stage-continuation.yml`
as the exact ordered reproduction recipe. Its native-source job fetches frozen
family dependencies, extracts complete native graphs/clocks, independently
corroborates buff event aliases, and checks every retained contract. In particular:

```sh
node tools/arkpedia/fetch-enemy-family-source.mjs --fetch ch16-story-guardian ch16-fear-projectile ch17-brute ch17-flyer ch17-bag ch17-channel-carrier ch17-war-caster ch17-firewall-boss
node tools/arkpedia/predefined-module-source.mjs --fetch --check
node tools/arkpedia/predefined-tutorial-source.mjs --fetch --check
```

Follow the workflow's Python extraction steps before contracts needing extracted
inputs. Do not weaken digest checks or substitute current upstream content for
frozen evidence. Shared browser code uses `shared/arkpedia/source-digest.js`,
never `node:crypto`.

## Resume from here

First inspect final-head CI and this branch, then continue canonical stage
integration/source parity. The preparation step is finished; do not redo it or
admit 17-16 simply because its internal mechanics path clears naturally.

Current held normal stages: **16-9/12/13/16/17/18; 17-14/16/18**. Twenty-five
test-only stages are admitted: 16-2..8, 16-10/11/14/15; 17-2..13, 17-15/17.
Exact remaining gates and history are in `docs/DEVELOPMENT-PRIORITIES.md`.

17-16's dedicated constructor already installs exact hidden module cards,
preset Viy, dialogs and schedule before a single battleStart. Its source-bound
two-wave schedule has 14 enemies/21 actions; seeds 1 and 71 naturally clear at
214.6 seconds, with 12 kills and two zero-LP caster exits. No forced kills/SP or
boosted stats. Dialog acknowledgements hold simulation and input. The camera
mapping is an explicit regular-engine approximation, not native easing/zoom proof.

Recent preserved foundation:

- `d948a507`: Muama/twin firewall durability source contract, ON_TAKE_DAMAGE /
  BUFF_OWNER binding and verified physical/arts factor; hosted continuation green.
- `bd185965`: authenticated snake terminal wave-finish receipt and battle-owned
  reservation receiver. Cancels only owned unborn spawns; preserves live/foreign
  enemies. This is not complete canonical room/main-wave dispatcher parity.
- `14a55f4d`: source-owned summon owner panels and Closure recovery/retreat gates.
- `9cc3e192`: LeakSource terminal source contract and explicit BUFF_SOURCE
  InstantKill primitive. **Two LeakSource `b.kill(e,null)` calls remain unconverted**:
  action source/kill-credit provenance is unresolved. Do not guess.

Still held: native room withdrawal/camera ordering and 2.5-second delay scope,
full 17-18 main-wave integration, boss initial FSM/geometry parity, remaining
Chapter 16 fear/fortbreaker/Mirbst behavior, the nine stage admissions, and the
wider enemy/operator/module audit. Finish mechanics and evidence gates before
art/models/chibis/effects. Registration counts alone do not establish completeness.

The sending session is paused for transfer after this handoff. The overall goal
is not complete; the receiving session should resume that goal under the user's
existing mechanics-first authorization.
