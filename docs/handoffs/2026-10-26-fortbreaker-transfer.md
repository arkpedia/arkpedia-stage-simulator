# Arkpedia development transfer — Fortbreaker checkpoint, 26 October 2026

The user requested finishing the current step, writing a handoff, and stopping
this session so development can continue on another computer. Resume only in
the receiving session. Do not restart the previous MacBook worker in parallel.
The overall mechanics goal is unfinished.

## Get the code

- Repository: https://github.com/arkpedia/arkpedia-stage-simulator
- Branch: `dev/windows-stage-continuation`
- Windows source checkout: `E:\Projects\arkpedia-stage-simulator`
- This handoff accompanies the Fortbreaker clock implementation commit. Use
  the branch's latest remote HEAD, not an old handoff commit or patch archive.
- Previous checkpoint: `af35360ea3e52d2a6884f9506d4d00d2b82818ee`.
- Ongoing evidence/history: `docs/DEVELOPMENT-PRIORITIES.md`,
  `docs/CH16-NATIVE-EVIDENCE.md`, `docs/CH16-BEHAVIORS.md`.
- `docs/handoffs/2026-10-26-computer-transfer.md` is an older preparation
  checkpoint. `docs/handoffs/windows-21a6434c.md` is the original Mac transfer;
  **do not reapply its old patch/archive**.

For a clean existing checkout (preserve receiving-machine uncommitted work first):

```sh
git fetch origin
git switch dev/windows-stage-continuation
git pull --ff-only
npm ci --no-audit --no-fund
node tools/arkpedia/fortbreaker-clock-contract.mjs --check
node --test test/arkpedia-ch16-fortbreaker.test.js test/arkpedia-stage-16-6.test.js
```

Or clone the branch with `git clone --branch dev/windows-stage-continuation
https://github.com/arkpedia/arkpedia-stage-simulator.git`.
Node 24 is used locally; hosted CI also checks Node 22 on Linux and Windows.
No cache or local asset copy is required for the source contract or unit tests.
Read repository instructions present in the receiving checkout before editing.

## User goal and boundaries

Finish **all enemy, stage and operator mechanics, including modules**, then
stage art/models/enemy chibis, then operator/enemy/environment special effects.
Operator registrations are largely present (431 forms/949 skill registrations),
but registration does not establish complete mechanics or module parity.

Continue the Chapter 16/17 normal-stage/controller backlog using checksum-bound
canonical data and retained native evidence. Keep source, support and receipt
gates exact; do not invent missing behavior from names. New stages remain
explicitly test-only. Do not merge, deploy, promote the public catalogue or
claim captured/compiled/frame parity without evidence. No art/effects campaign
has begun. No subagents are authorized in this session.

## Step completed here

Fortbreaker ordinary attacks previously damaged/launched immediately despite
both retained original skeletons placing F_Attack/F_Combat OnAttack at
0.7333333492279053 seconds and clip end at 2 seconds. The controller now owns
accepted ordinary casts through `profile.sourceAttack`, holds movement, samples
BAT/interval playback capped at one, advances eligible live slow_down, and emits
one attack at the native marker. Attack reselects live ground targets at release;
Combat retains its input target/deployment. Their cooldowns remain independent.

The F_Skill volley now advances unborn rounds and clip end on its eligible live
slow_down clock, using fixed TimeMode1 playback independent of ASPD. Its original
0.8333333134651184 first marker, 0.20000000298023224 burst interval,
2.2333333492279053 clip end, order-count snapshot and ten-second world cooldown
from cast end are preserved. Born homing shots and 0.6000000238418579 delayed
static blasts keep separate world clocks. Source death does not erase born
output; source reuse cannot transfer new ATK/buffs/damage ledger into it. Selected
victim lives cannot transfer during reentrant damage. Control/removal/end discard
unborn work; end also stops born output.

Files:

- `server/sim/content/chapter16-fortbreaker.js`
- `tools/arkpedia/fortbreaker-clock-contract.mjs`
- `data/candidates/arkpedia-ch16-fortbreaker-clock-contract.json`
- `test/arkpedia-ch16-fortbreaker.test.js`
- `test/arkpedia-stage-16-7.test.js` (route fixture uses a legal late S3 finisher)
- `.github/workflows/stage-continuation.yml` (producer `--check`)

The producer verifies retained graph/index/skeleton hashes, follows Attack and
Combat references, and binds the skill wrapper to the sequence on the same
GameObject. The wrapper's `_trigger` is a selector, not the cast ability. Do not
repeat the earlier mistaken traversal from `_trigger` to F_Skill.

Base Fortbreaker remains admitted only in existing test-only stage support.
Mk-II `enemy_10123_uareap_2` is still blocked by `talent:AttackParam` and
`talent:KillBonusAura`; tests cover only its shared source-bound subset.
The regular-engine time/rate mapping is explicit; native initial FSM and
compiled/frame dispatch are not proven.

16-7's high-LP route fixture previously finished without a deployed operator.
Correct ordinary attack holds now keep the Fortbreaker on the road past that
fixture's 300-second limit. The fixture preserves its original cap, 75-second
Commander wait, scheduled/branch miners and both ordered/unordered miner volley
checks. After those observations, it deploys Surtr S3M3 at 260 seconds using
normal DP and activates with natural SP. All three seeds clear. This remains
a high-LP controller/route check, not a claim of an unmodified three-LP win.

## Previous work already saved

- Internal 17-14 now composes its exact 52-spawn schedule, selected squad/support
  and separate source-supplied E2/90 S3M3 Closure (potential 1/trust 100/module 3).
  Player/support Closure is excluded independently by UI and construction.
  Desktop/phone real touch deployment, legal negative DP borrowing, natural S3,
  tunnel commands and restart are covered. Source legend tile heights/input and
  phone facing picker overlap/touch-release were corrected.
- 17-16 uses exact fixed preparation (Viy E2/90 S3M1, potential 6/trust 200),
  source-owned hidden reinforcement cards, natural clears and actual app checks.
- Both 17-14 and 17-16 remain absent from the production stage index even with
  experimental mode. Review tools provide loopback-only private catalogues.
- Twin-room finish receivers require authenticated one-use source/life/battle
  receipts. Public forged flags or live-body death callbacks cannot advance rooms.
- Summon-selection VM harness now injects the actual `regularSummonOwnerEntry`
  dependency; do not remove production coverage to fix extracted harnesses.

## What remains / recommended next work

There are 25 admitted test-only normal stages: 16-2 through 16-8, 16-10/11/14/15;
17-2 through 17-13, 17-15/17. Nine are still unadmitted:
**16-9/12/13/16/17/18 and 17-14/16/18**. Internal scenario construction is not
admission, and even admitted stages still need parity/audit work.

1. Check the exact CI handles below before starting new work. Keep a running
   handle; observation timeout alone is not grounds to restart its workflow.
2. Continue held mechanics using source evidence. Preset manual withdrawal and
   card regeneration still need native lifecycle evidence; generic withdrawRatio
   0.5 or functionDisableMask NONE does not prove those scenario rules.
3. Fortbreaker Mk-II has canonical AttackParam `attack@max_target=3` and
   KillBonusAura `attack_speed=20, hp_ratio=.05, max_stack_cnt=10`. The retained
   prefab graph has no corresponding behavior component or outbound behavior
   dependency. Do not infer that the groups are inert or implement from names.
4. 17-18 main waves, room camera/withdraw 2.5-second ordering and initial native
   FSM remain held despite authenticated room receipts. Muama/twins selected
   combat/line/blink/firewalls have guards; initial FSM/geometry/native cross-buff
   stacking remain held. Snake boss branch includes 3/6/9 snakes and two
   uncounted Brutes; this is not the completed stage.
5. LeakSource still has two `b.kill(e,null)` calls with unresolved native
   action-source/kill credit. Retained BUFF_SOURCE evidence alone does not admit
   its full native clock or authorize guessing credit.
6. Continue the rest of Mangler/beast/boss controller and stage backlog, then
   audit operator/module mechanics before the visual work requested by the user.

Do not download an entire APK speculatively to resolve these. The local
`.cache/arkpedia/cn-native-source/status-enums-dump.cs` is field-only APK metadata,
not executable method bodies. The compiled Win client cited by earlier research
was in the old Mac CrossOver bottle and is not present in this Windows checkout.

## Validation and CI

Final local validation:

- Clock contract producer `--check`: pass.
- Fortbreaker plus 16-6/16-7 source/stage tests: **46 passed**, zero failures/skips,
  including three seeds per stage and 17 new timing/lifetime regressions.
- Available focused mechanics cohort: **1,786 passed**, zero failures/skips/
  cancellations. Only the four known quarantined files below were excluded.
- Existing 16-6 actual-app desktop/phone browser case: **pass**, covering normal
  public refusal, natural SP, tunnel queue release, keyboard, phone bounds and
  restart. It ran serially before the focused cohort.
- `git diff --check`: pass. Local logs/screenshots are optional QA output under
  `.cache/fortbreaker-clock-*` and are not needed to resume from Git.

The branch push automatically starts fresh continuation checks, including the
complete focused cohort and native contract reproduction. That run is pending
at handoff creation, not claimed green. Locate the run for this handoff's commit
using `gh run list --branch dev/windows-stage-continuation --workflow
stage-continuation.yml --limit 5`, then keep its handle until terminal. The
previous full run below is still in progress, so this session does not dispatch
a replacement that would cancel it. After it finishes, dispatch full validation
for the new Fortbreaker HEAD and record its exact commit/run ID in the next session.

Authoritative earlier handles:

- Continuation **40353076508**, af35360e: **success**, including 17-14 actual UI.
- Full **40353077124**, af35360e: running at the start of this transfer; query
  its final status. This predates the Fortbreaker implementation.
- Last previously confirmed full success: **40342411234**, 88698e13, all eight
  Linux/Windows Node 22/24 shards. It predates room/17-14/Fortbreaker changes.
- 40346817450 and 40342413124 continuation failures were Chrome startup timeout
  before a simulator assertion. CI-only launch stderr was enabled at af35360e;
  no gameplay timing/assertion was relaxed.

Use `gh run view RUN_ID --json status,conclusion,url,jobs`. Full verification is
`gh workflow run ci.yml --ref dev/windows-stage-continuation -f scope=full`;
continuation runs automatically on branch pushes. Avoid cancelling a nearly
finished older full run by starting its replacement unnecessarily.

## Windows antivirus state

Four tracked test files remain locally missing because of the previously
observed Bitdefender quarantine. They are retained unchanged in Git and hosted
CI; their deletions must **never be staged**:

- `test/arkpedia-ch16-engagement-ground.test.js`
- `test/arkpedia-ch16-family-registration.test.js`
- `test/arkpedia-ch16-phantom.test.js`
- `test/arkpedia-unharmful-spawn.test.js`

The user cannot access the PC and will report back later. Do not ask again,
disable antivirus, add exclusions, or repeatedly restore/rewrite these files.
Use explicit `git add` paths, never `git add -A`. A receiving checkout should
get the intact tests from Git. On this checkout only, the ignored helper
`.cache/run-flyer-focused.mjs` runs `test:arkpedia-ch16` excluding exactly those
four paths and fails on any unexpected missing file. Read the final Node test
summary and exit code; PowerShell redirection followed by Get-Content can mask
an earlier nonzero exit unless captured. Hosted CI is required for complete
coverage of the four locally missing files.

Run heavy browser checks serially before a CPU-heavy focused suite. Windows
browser QA can use `CHROME_PATH` pointing to installed Edge, `RENDER_E2E=1`,
`CH16_QA_STAGE=16-6` and `CH16_QA_OUT` for the existing Chapter 16 UI test.
Unset those opt-ins for ordinary unit tests. No server or browser from these
tests is intentionally left running after handoff.
