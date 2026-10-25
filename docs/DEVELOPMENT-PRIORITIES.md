# Development priorities

Owner direction, 2026-10-25: take over development on the Windows workspace and
complete mechanics before expanding visual content. This direction supersedes
the narrower Chapter 16/17 handoff as the overall project scope; that backlog
remains the current mechanical integration work.

## 1. Mechanics

Finish and verify mechanics for all canonical enemies, stages, and operators.
This includes bosses, summoned units, stage devices, conditional/hidden waves,
environmental rules, navigation, targeting, status effects, damage/healing,
operator skills/talents/forms and their interactions. Audit the existing operator
implementations against source evidence; most are already implemented, but a
support count alone is not evidence of complete behavioral coverage.

Use checksum-verified canonical arkpedia-data, retained original native evidence,
and the existing exact-record support/receipt gates. Do not guess missing source
facts, flatten unsupported stage conditions, substitute data repositories, or
grant support merely because an asset or source graph was extracted. Add actual
behavior, lifecycle, interaction, source-mutation and stage integration checks.
Use GitHub-hosted Linux/Windows CI for quarantined local tests without disabling
antivirus or requiring the owner to access the PC. Browser checks may verify
mechanical controls/layout; they are not a reason to start new visual work.

The active Chapter 16/17 goal is the current mechanics milestone, not a limit on
this expanded project scope. Finish it, then proceed through the canonical enemy,
stage, and operator mechanical backlog, using coverage reports to select work
that clears shared blockers. Keep explicit evidence and remaining limitations.

## 2. Art and models

After the mechanics phase is complete, add stage art, stage/environment models,
and enemy chibis. Existing visual assets may remain in use during mechanics
validation; do not start a new art/model ingestion campaign before phase 1.

## 3. Effects

After art/model integration, add special effects for operators, enemies, stage
devices, and the environment. Preserve mechanical event ownership and timing;
effects must reflect verified behavior rather than stand in for implementation.

New stage admissions remain test-only. Public catalogue promotion, merging, and
production deployment require explicit owner approval. Keep development moving
autonomously within these priorities.

## Starting inventory

`node tools/arkpedia/mechanics-coverage.mjs` verifies the canonical stage release
manifest and every stage/geometry/conditional/device input it reads. It writes
`data/candidates/arkpedia-mechanics-coverage.json`. The inventory includes all
combat-stage metadata, rather than only the old main-story report: 3,891 records
across normal stages, variants, activities, Integrated Strategies, Contingency
Contract, tower and reclamation modes. This count is source records, not a claim
of unique maps or mode completion.

At the initial Windows mechanics checkpoint: 609 catalogue records (597 public,
12 test-only), 3,282 unbuilt combat-stage records, 463 source-bound supported
enemies out of 1,901 canonical enemies, and 431 registered target operator forms
with 949 skills. Operator registration checks skill identities/talent keys; it
does not certify complete operator mechanics. A separate source/behavior audit
remains required, including module effects and existing candidate limitations.
Generic stage gates overlap; existing reviewed stages can handle some observed
gates, so this report cannot grant or revoke runtime admission on its own.

All 34 normal 16-2..18 / 17-2..18 source levels are now retained with exact
manifest/route/producer/full-level receipts. Retention alone grants no stage or
enemy support. Remaining source-only levels continue to fail the stage-review
gate. Local `useDb=false` enemies in 16-9 and 17-18 require their own source-bound
records; never substitute a same-name catalogue enemy.

The first wider enemy continuation registers Duck Lord's permanent damage-triggered
Run mode against its original prefab/template closure. The normal and strategy
database identities intentionally share the original prefab, with separate exact
blackboard contracts (+400% and +300% movement speed). Nine source/behavior tests
cover all database levels, automatic single attachment, unblockability/no attacks,
accepted shielded/zero-HP-loss damage, control, cleanup and mutation refusal.
At that checkpoint candidate combat support was465/1,901; this does not admit any Integrated
Strategies stage or certify its mode-specific reward/economy rules.
Flyer and Bag native graphs are retained without controller admission.
Brute's original bound Skill events are0.833333313/1.266666651/1.666666627s,
with a2.200000048s clip. A direct candidate now owns normal/enhanced cast clocks,
retains the original target deployment across all hits, reads live ATK per hit,
and cancels pending hits on control, source death and battle end. Twenty-three focused
tests pass. Both original cast components mark `affectedBySlowDown=1`; the candidate
now consumes live slowed elapsed time between markers, rather than scheduling
fixed world-time callbacks. Reentrant death cannot release remaining markers.
The timeMode0/maxAnimScale1 rate mapping samples BAT/interval with a cap of1,
following existing native operator owners rather than the generic clip-fit
fallback. This is still an explicit mapping, not recovered compiled behavior.
The exact-record experimental review now registers both database variants.
Automatic dispatch, no-target charge retention under silence, exact full-graph
and record mutation refusal and wrapper-count checks pass. Callback3 maps to
cast finish consistently with the existing native operator owners; its original
switch-back action explicitly targets Combat with a fresh full cooldown. This
admits source-bound experimental mechanics, not compiled/native-frame parity.
Reading original event-clock bytes for mechanics is not a visual-model import.

The seven-stage continuation checks cover 16-10/11/14/15 and 17-7/8/9. The catalogue
contains614 entries (597 public and17 test-only), with613 file-backed stages.
The613-stage local file-backed load/fight sweep at `54f100ad` passes. Hosted validation found a
stale one-tunnel browser expectation for two-tunnel 16-15 and a generic runner
deadline shorter than the catalogue test's own deadline; both are corrected,
without removing scenarios or changing the simulation's gameplay time cap.

Hosted checkpoint `835d7b26`:409/409 focused tests pass independently on Ubuntu
and Windows; both16-14 and16-15 desktop/touch/restart browser scenarios pass.
The full eight-shard Linux/Windows Node22/24 regression at `4eb108d0` completed
successfully. That frozen checkpoint predates the Brute/Guardian integrations;
it is not a claim that the later head has completed the full matrix.

Stage-local definitions now have an isolated compiler path in
`shared/arkpedia/enemy-records.js`. It requires literal `useDb=false` data and a
separately reviewed native damage type; no catalogue row or handbook is borrowed.
Source tests cover16-9's local miner and17-18's four local infantry/Brute/
rockbreaker/caster records. In particular, the miner's fear-loss parameter is0,
the local rockbreaker's null skill list does not inherit SummonSelf, and the
17-18 children are uncounted while retaining a life cost of1. Compilation alone
grants no support or stage admission; dedicated source/native reviews and builder
integration remain required for these stages.

Brute integration adds normal17-8 (40 scheduled/counted hostiles) and17-9
(22 counted hostiles plus one harmless Leak Source). Their optional Six-Star
groups are excluded only after checking original default/optional enable runes.
All42 continuation integration checks pass, including three seeds per stage,
exact builder reproduction, mutated-source refusal and public/test-only gates.
Original17-8 Leak Source contact arms scheduled Brutes naturally. Separate
legally deployed guard fixtures exercise actual normal and three-packet enhanced
combat, then retreat the explicitly HP-buffed guard and clear the original waves.
The route-only17-9 fixture clears at300.7 seconds under an explicit330-second test
cap; its separate default300-second timeout test passes. The gameplay cap is
unchanged. Candidate support is467/1,901; the coverage report is regenerated.

The16-9 Guardian and fear-projectile graphs, all indexed components,
templates and the explosion projectile are retained against the pinned native
inventories. Source-only checks preserve the Guardian delayed self-HP-loss and
miner fog marker, and the fear projectile's derived miner fear/disarm ending at
full HP. The fear projectile remains source-only; the Guardian is now registered
under the exact experimental contract described below.

The expanded locally available focused suite ran431 tests:430 passed and one
temporary-cache atomic rename was denied by the Windows sandbox. The affected
canonical-stage file then passed5/5 with normal host filesystem access. The four
quarantined test files remain excluded only from that local invocation; hosted
CI runs the complete declared suite with those tracked files intact.

## Guardian and token-only preparation continuation

`25aaff91` fixes the17-8 browser failure: its five Roadblocks accompany an empty
fixed-squad array, which must preserve the player's squad choices. The adapter
now emits null for absent fixed operators, and preparation treats legacy empty
arrays the same way. Real fixed squads remain enforced. The actual local
desktop/touch clock, pause/restart and public rejection scenario passes; its
captures were inspected. Hosted run40186136583 passes both Linux/Windows focused
suites and all four16-14/15 and17-8/9 browser jobs.

The Guardian (`enemy_3011_dyegrd`) now has one automatically attached controller
for its DelayBloodDot talent and AOE skill. Twenty dedicated checks cover exact
native graph/index/record gates, original Attack02/Skill_01 clocks, marked-miner
input and area center, live ATK, selectability/ground filters, brief controls,
slow_down, input life retention, shared fog ownership and retirement. The actual
miner controller resumes shadow suppression after the final Guardian leaves.
An accepted75-second delay parent starts the immobilizing pure-damage child on
disable; early removal also starts it, while rejected parents create no callback.
One-second pulses read current max HP, pass through damage modifiers, survive
silence/stun and can kill the owner. Source retirement cancels future owned work.

The buff-event alias receipt independently matches unchanged action lists at the
same keys in both frozen native and named-template sources. Five aliases have
three retained witnesses each; event25 is ON_BUFF_DISABLE, corroborated by30
matching templates. Only $type assembly suffixes are normalized, and booleans
remain distinct from numbers. The retained named source and complete native
bundle checksums are verified. This recovers serialized aliases, not compiled
methods or frame parity.

Candidate support is468/1,901; the catalogue remains614 entries,597 public and17
test-only. Stage16-9 is still unadmitted: the fear projectile and local miner
contracts must be completed first. The projectile's original skeleton has no
OnAttack events, so no synthetic hit marker or borrowed clock is admitted.
The locally available focused suite passes459/459, excluding only the four
quarantined files retained in Git. Two additional source-plan tests pass.

`fetch-enemy-family-source.mjs` verifies only the seven exact dependency bundles
for Guardian/fear-projectile/Brute and the pinned named template file. Hosted
continuation CI now independently reruns all three graph/indexed/clock extractors
and the alias recovery script from those original bytes. This source job grants
no support on its own. Guardian native callback/FSM ordering and radius/rate
resolution retain explicit shared-engine mappings; compiled/frame parity is not
claimed. The operator-wide mechanics audit remains in phase1; visual integration
waits for that phase to finish.

## Flyer mechanics checkpoint

The two canonical Flyer variants now have an exact-record test-only controller.
Its complete graph includes the death projectile resolved through a blackboard
string, which the earlier source extractor missed. Both extraction and graph
verification now require that dependency. The retained native graph, indexed
components and prefab-bound Change clocks independently reproduce from the
original pinned bundles. The shared trace cursor selects Leak Sources, suspends
original route progress, and returns to that route after source selection ends.
Two distinct source contacts commit growth at the original OnAttack markers;
silence, stun protection, brief interruptions and slow_down have separate tests.
The born one-second projectile survives its owner's death, samples live same-life
ATK and selectable ground bodies at its retained death point, holds battle
completion, and uses a captured ATK fallback after source-object reuse.

Stages17-5/17-6 retain19/31 scheduled source bodies,18/30 counted hostiles and
their original optional-group exclusions. Natural Leak Sources drive scheduled
Flyers through both growth steps. Three seeded no-operator fixtures clear each
stage;17-6 uses an explicit400-second fixture cap, while a separate test retains
the unchanged300-second game timeout. Native compiled/FSM/frame fidelity remains
an explicit limitation of the local mappings. Candidate support is470/1,901;
616 catalogue entries comprise597 public and19 test-only. The canonical coverage
inventory has3,275 unbuilt combat-stage records and1,431 unsupported enemies.
Operator-wide mechanics and modules still require the separate audit before art,
models, chibis or effects begin.

The locally available continuation suite passes499/499; four tracked files remain
unavailable locally and are run by hosted CI. The two new browser scenarios pass
desktop/phone startup, pause, restart and public-access rejection. Both viewport
captures were inspected. The previous09f52106 checkpoint passed all seven hosted
continuation jobs; latest-head hosted results must be recorded separately.

## Further Chapter17 integration and Bag source audit

Flyer checkpoint a36af72b passed all nine hosted continuation jobs: source
reproduction, focused Linux/Windows checks, two Chapter16 browser scenarios and
four Chapter17 browser scenarios. This includes the four tracked test files
unavailable locally; antivirus remains enabled.

17-11 and17-13 use the existing reviewed Infantry, Rockbreaker, Brute and Flyer
controllers. The source levels retain52 scheduled/50 counted and72 scheduled/72
counted bodies respectively, two Leak Markers each, and no optional hidden spawn
groups.17-13 includes finite waits, hidden teleports and stronger Rockbreaker
splits; these remain live mechanics rather than flattened playback paths.
The catalogue is now618 entries,597 public and21 test-only. Enemy support stays
470/1,901; the canonical inventory retains3,273 unbuilt combat-stage records.

The Bag family remains unsupported. Its complete graph,40 indexed components and
two prefab-bound original clock receipts now have source constraints. Feeding
owns a10.5-second timed parent with1-second delayed pulses, while the AtkUp skill
uses its own11-second duration and ignores slow_down. The contact aura is an
infinite parent, despite the separate ReachedAura.duration10 blackboard field.
It creates a derived flag on the Bag with the Leak Source as the special buff
source. Natural feeding completion triggers that flag back to its own contact
parent, which checks the Bag skill is still affecting before killing its owner.
Permanent ATK stacks are not derived from that parent. The runtime must preserve
these identities, interruption and removal semantics; a generic ten-second
delay that kills the nearest source is insufficient. Skill cooldown/re-entry and
overlapping contact ownership still need explicit runtime/lifecycle tests before
admission. Hosted source reproduction includes Bag without granting support.

The17-13 live test exposed a shared path bug: geometry preserves finite wait
lengths but drops DISAPPEAR. Those waits previously remained visible before an
instant teleport. Source-bound generation now matches each deduplicated geometry
route against complete original routes, preserving the hidden interval and
rejecting mismatched or ambiguous visibility/timing. Native indices cannot be
used directly because geometry deduplicates routes. Regeneration corrects16-6,
16-11,16-14,16-15 and17-6 as well as the new17-13 build, without changing pinned
geometry. Three seeded17-13 runs verify each observed tunnel stays hidden for
ten seconds before reappearance. Source mutation/ambiguity checks reject altered
waits and unclosed disappearance. Browser checks for17-11/17-13 pass on desktop
and phone; original-source/runtime suites are rerun against the regenerated paths.

The regenerated-path checkpoint passes513 locally available continuation tests.
The four tracked locally unavailable files remain unchanged in Git and are
included in hosted Linux/Windows checks. The new stages pass independent builder
reproduction, canonical-byte mutation rejection, public-access rejection and
three seeded battle integrations each. No new enemy support is inferred from
the Bag source audit; its runtime controller and stage admissions remain open.

## Bag controller checkpoint

The two Bag variants now register one exact-record test-only controller. Passive
Arts pulses, source-owned contacts, the derived current flag, timed feeding and
permanent ATK stacks have separate owners. Feeding grants ten stacks per complete
cycle, consumes the current flag's source at10.5 seconds and holds the skill for
11 seconds. Multiple cycles clamp at the canonical40-stack limit. Earned stacks
survive interruption; source departure interrupts on the next pulse. Brief
controls, death, battle end and source reuse cannot leave late source kills.
Retiring an older contact cannot remove its replacement flag, and overlapping
Bags retain their own contact parents. A rejected flag grants no feeding state.
The pulse selects current all-motion bodies and reads live ATK; accepted feeding
is non-silenceable and ignores slow_down. New skill admission honors the native
silence wrapper. Cooldown start, callback ordering, collider and blackboard
substitution remain explicit shared-engine mappings rather than compiled/frame
parity claims.

Stages17-10/17-12 retain30/38 scheduled bodies and29/38 counted hostiles.17-10's
Six-Star hidden1 Bag remains excluded; normal hidden2 only displays enemy info,
so it adds no hostile. No-operator300-second fixtures time out while scheduled
Bags consume real recurring Leak Sources and reach40 stacks. Those timeouts are
retained as expected gameplay outcomes, without increasing the game limit.
Separate legal-sniper fixtures use explicit durability/output buffs to exercise
ordinary operator selection, hits, kills and Bag retirement through combat.

The catalogue is620 entries:597 public and23 test-only. Candidate support is
472/1,901, with1,429 unsupported canonical enemies and3,271 unbuilt combat-stage
records. Eleven of the34 retained Chapter16/17 normal candidates remain
unadmitted:16-9/12/13/16/17/18 and17-14/15/16/17/18. Existing operator forms and
skills still need their full mechanics audit before visual work begins.

The28f5ffb1 tunnel checkpoint passed all eleven hosted continuation jobs. The
older09f52106 full-repository checkpoint also completed all eight Linux/Windows,
Node22/24 shards successfully. New Bag results require their own hosted run;
neither older success proves the latest head.

The final Bag controller passes35 dedicated runtime tests and the full locally
available continuation suite passes559/559. The four locally unavailable tracked
files remain unchanged and required on hosted runners. Source admission rejects
missing family evidence, changed native strings, changed skills and added active
components. Reentrant checks cover source death during flag admission, owner
death during parent admission, and battle end during feeding-parent admission;
none may leave newly returned orphan buffs or later output. Both new desktop/
phone scenarios pass startup, pause, restart and test-only access checks; the
desktop17-10 and phone17-12 captures were inspected. Hosted checks for this exact
Bag checkpoint remain separate from the completed earlier runs.

## Stronger channel/carrying variants and normal-only waves

The stronger caster and carrier have exact-record registrations, complete graphs
for both base/strong pairs,40 indexed components, two projectiles, three templates
and four prefab-bound clock receipts. Source comparisons resolve local references
through original hierarchy/script identities; all eight non-visual caster and
four carrier component shapes agree between variants. Collider radii agree and
Spine playback remains1. This comparison grants no support without each record's
own reviewed native/count/record claims. The carrier retains its Leak Source
dependency gate.

The original named x-4 range is the existing3x3 square, including its center and
diagonals. Its complete source range table is retained with upstream commit,
Git-blob hash and SHA256 verification; placement behavior stays source-backed.
Carrier summon attempts now retire once per source life. The shared caster
clears channel/DEF/movement state on retirement, rejects silence at admission,
and interrupts its silenceable link even after a brief accepted forced silence.
Canonical silence immunity still rejects ordinary applications. SP callbacks
revalidate owner and marker state before another pulse. Born ordinary projectiles
preserve current same-life ATK/modifiers; after source-object reuse they use a
birth-deployment view. The same view fixes Flyer death blasts borrowing a new
deployment's modifiers or identity after reuse. Native compiled/frame parity
continues to be unclaimed.

17-15 includes the canonical ALL-enabled n group (one normal War Caster) and
excludes h/h2 Six-Star additions. Its38 counted bodies clear across three seeds.
17-17 includes four NORMAL-enabled group1 Flyers while excluding the group2
Six-Star Bag replacement. Its62 scheduled/60 counted bodies exercise natural
stronger channels, Brute/Flyer reactions and Bag feeding at the unchanged300s
no-operator timeout. The hidden-group compiler accepts explicitly reviewed
default ALL/NORMAL enables while rejecting missing/ambiguous masks, optional
normal enables and contradictory normal disables before mutation.

The catalogue is622 entries,597 public and25 test-only. Candidate support is
474/1,901; the inventory retains1,427 unsupported enemies and3,269 unbuilt combat
stage records. Nine Chapter16/17 normal candidates remain unadmitted:
16-9/12/13/16/17/18 and17-14/16/18. Remaining bosses, predefined Closure and the
stronger War Caster's additional Leave skill require their own mechanics work.
Operator-wide audit remains open; visual integration has not started.

Bag checkpoint8507929e passed all thirteen hosted continuation jobs. Its full
eight-shard Linux/Windows Node22/24 run40192086233 remains independently tracked;
older green results do not certify this newer checkpoint.

This checkpoint passes601 locally available continuation tests, including29
channel/carrier source/runtime cases and88 stage/conditional cases. Both new
desktop/phone scenarios pass startup, pause, restart and test-only rejection;
the phone17-17 capture was inspected. Original graph/index/clock extraction
independently reproduces all four prefabs. Hosted source reproduction includes
this family alongside the prior five families; range-table verification uses
the retained complete original bytes, SHA256 and upstream Git-blob identity.
The four tracked locally unavailable tests remain hosted-run requirements.

## Stronger War Caster and predefined-operator guard

The stronger War Caster now has an exact-record controller including its one-shot
Leave skill. Complete base/strong graphs retain 40 indexed components, two
projectiles, seven templates and two original clock receipts. Leave becomes ready
120 seconds after deployment, ignores silence and disarm, and commits once when
the caster is visible and free of intrinsic action control. The priority-one
retirement interrupts a lock, aliases Die to Leave and uses the native instant-
kill path without marking a route exit. Its zero LP value remains canonical.
Skill scheduling/preemption and refresh/frame timing remain explicit local
mappings rather than compiled/frame claims.

A separate callback receipt independently corroborates event 61 as
ON_BEFORE_TARGET_APPLY_MODIFIER (three unchanged source witnesses) and event 10
as ON_TAKE_DAMAGE (75 matches, three retained witnesses). Existing five-event
receipts remain byte-identical. The shared caster's active lock buff now uses
genuine accepted modifier receipts rather than net HP loss for theft. Full
shield absorption and zero HP damage still allow theft; protected, missed,
cancelled and fabricated receipts do not. A born ordinary splash arriving during
a lock can also trigger this owner buff on each accepted recipient. Two older
channel-only tests now suppress unrelated ordinary attacks in their fixtures.

Source/victim deployment identities, the 2050 gain cap and at-least-one target ATK
remain enforced. Retirement clears owned target reductions, source gains, lock,
shield and restoration callbacks; reentrant source death cannot continue a pulse
or leave a newly accepted hold behind. Born splash retains recipient/source life
guards and the original source view after object reuse. Thirty dedicated checks
cover these behaviors and exact support rejection cases.

17-16 remains unadmitted despite its enemy support: the source also owns
predeployed Viy (phase2 level90, raw potentialRank5/favorPoint100 and
skillIndex2/mainSkillLvl8), four initially hidden
operator cards with ACTIVATE_PREDEFINED tutorial actions, and DIALOG/STORY source
references. Those must be implemented and verified rather than made available
from time zero. 17-14's predefined Closure also carries a level 3 module requiring
its own mechanics audit. The candidate compiler now rejects unsupported
predefined operator instances and hidden/tutorial card activation before output.

Candidate support is 475/1,901; 1,426 canonical enemies remain unsupported. The
catalogue stays 622 entries, 597 public and 25 test-only, with nine normal Chapter
16/17 candidates still gated. The complete operator/module audit and all visual
phases remain open. Hosted results for the newer enemy checkpoint are separate
from earlier successes.

The 2e6ecc00 continuation checkpoint passed all fifteen hosted jobs. The older
8507929e full matrix run 40192086233 completed seven successful shards and failed
Windows Node 22 shard 1 solely when the aggregate stage-continuation file exceeded
its 180-second file deadline. That aggregate now uses the existing bounded 600s
class for long catalogue/match sweeps, retaining every stage, seed and assertion;
ordinary files keep 180s and game timeouts are unchanged. A new exact-head full
run is required rather than treating the timeout as a passing result.

Local verification passes all 631 available focused tests and the six existing
shard/CLI partition checks. Graph, indexed-component, original-clock and new
event-alias extraction independently reproduce the retained receipts. All
test-only generated paths retain their canonical wait/teleport contracts. The
four locally quarantined tracked test files remain required in hosted CI and
are preserved in Git; their local absence is not staged as deletion.

## Chapter 17 firewall boss source and interaction lifetime

The four remaining Chapter 17 firewall bosses (`enemy_1590_muama`,
`enemy_1591_mutwin`, `enemy_1591_mutwin_2`, `enemy_1593_musnake`) now retain complete
original prefab/projectile/template closures, all 99 indexed components, seven
projectiles, 17 templates and four original prefab-bound skeleton clock sources.
The source workflow independently reproduces these from the frozen publisher
bundles. This retains mechanical evidence without importing visual assets or
granting enemy/stage support. All four enemy support policies remain null.

The existing firewall integration port now owns its perimeter/button state by
the owner's deployment identity. Death, removal, reuse or battle end retires the
wall and its listeners. Exposure and ticks discard stale walls; expired buttons
lose partial click progress. An explicit refresh commits the perimeter at the
new owner position, restores its sides and clears the prior button; changing the
owner position alone does not preempt the later native environment action.
Break callbacks clear the completed button before reentrant calls. Tests cover
these interactions, simultaneous owners, all sides, rectangular dimensions and
source/closure mutation rejection. This port still does not implement boss
attacks, damage geometry, deployment restrictions or phase controllers.

The new source audit distinguishes three mechanics that cannot share one button
implementation: firewall vulnerabilities use the existing three-click/five-second
configuration; the snake's HP-step counter needs ten clicks in ten seconds with
different success/failure buffs; its final counter needs fifteen clicks and uses
the retained 999999-second duration with the same finish buff on success/failure.
Snake initialization explicitly requests all firewall sides. The terminal buff
also finishes/skips the current wave, while timeout separately modifies LP by
the canonical -50 value without marking a route exit. Twin recovery depends on
the reciprocal `ally_alive` buff and current modes. These paths, checkpoint
teleportation, line attacks and firewall/deployment geometry remain held for
their complete controllers. The generic firewall port must not substitute for
them or admit 17-18.

The preceding f5c7e5e2 checkpoint passed all fifteen hosted continuation jobs in
run 40197246345. Its full Linux/Windows Node 22/24 matrix (40197258983) is still
running; that handle must be observed to completion rather than restarted.

Verification for this firewall checkpoint: all 13 new source/lifecycle checks
pass; together with the existing parity tests, the targeted run passed 52 tests.
The local focused run exercised 644 tests: 643 passed and the canonical loader
hit a sandbox temporary-file rename denial (`EPERM`). That complete five-test
loader file then passed outside the sandbox. This records the invocation and
permission repair separately, rather than claiming one green aggregate run.
Graph, indexed-component and original-clock extraction also reproduce all four
bosses independently. Hosted continuation/source reproduction remains required
for the committed checkpoint, including the four quarantined local test files.

## Source-bound snake counter subsystem

The two snake button actions now have a reproducible source contract derived
from the complete boss graph and the independently corroborated ON_BUFF_TRIGGER
alias. It pins both original action nodes, their template/event positions and
the exact canonical record. Counter creation rejects unknown kinds, changed
records and missing result dispatchers before replacing an accepted counter.
This is a counter subsystem, not registration of the snake as supported.

Step counters require ten accepted clicks before ten world seconds and dispatch
`enemy_musnake_stun_buff` on success or `enemy_musnake_heal_buff` on expiry.
Terminal counters require fifteen clicks with the original 999999-second
deadline and dispatch `enemy_musnake_kill_self_buff` for either outcome.
Inputs name the owner, deployment life and counter instance, so an old input
cannot progress a replacement counter or another deployment. Expiry resolves
once on the battle clock; silence/action control does not pause the button.
Death, removal, life reuse, undeployment and battle end cancel without applying
a success/failure buff. Completion detaches first, allowing its result dispatcher
to replace the counter or remove its owner without stale cleanup deleting new
state. Snapshots contain plain input/progress data for later mechanical controls.

The caller must still implement the selected result buff, HP-step admission,
Injured scheduling, final/fatal admission, source timeout/LP changes, full wave
completion and all attack/firewall mechanics. No placeholder buff dispatcher,
automatic phase advance, visual work, enemy-support change or stage admission
is introduced. Input/deadline ordering is a declared local simulator mapping;
compiled dispatch and captured frame parity are not claimed.

The preceding 694d5fe5 firewall checkpoint passed all fifteen hosted continuation
jobs in run 40198285662, including source reproduction and both OS focused jobs.
The f5c7e5e2 full matrix run 40197258983 currently has four successful shards and
four still running; it must finish before dispatching a replacement full matrix.

Verification: all 24 new counter checks pass, and all 668 locally available
focused mechanics tests pass in one run with ordinary temporary-file
permissions (no failures, cancellations or skips). The source-contract generator
also reproduces the retained actions with `--check`; hosted source verification
now runs this check. The four quarantined tracked tests remain unmodified in Git
and required in hosted CI. Candidate enemy/stage counts remain unchanged.
