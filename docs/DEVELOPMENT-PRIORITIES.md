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
The prior611-stage local file-backed load/fight sweep passes. Hosted validation found a
stale one-tunnel browser expectation for two-tunnel 16-15 and a generic runner
deadline shorter than the catalogue test's own deadline; both are corrected,
without removing scenarios or changing the simulation's gameplay time cap.

Hosted checkpoint `835d7b26`:409/409 focused tests pass independently on Ubuntu
and Windows; both16-14 and16-15 desktop/touch/restart browser scenarios pass.
The full eight-shard Linux/Windows Node22/24 regression at `4eb108d0` remains in
progress and must not be reported as green before its terminal results.

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

The remaining16-9 Guardian and fear-projectile graphs, all indexed components,
templates and the explosion projectile are retained against the pinned native
inventories. Source-only checks preserve the Guardian delayed self-HP-loss and
miner fog marker, and the fear projectile's derived miner fear/disarm ending at
full HP. No support is granted until their controllers and interactions exist.

The expanded locally available focused suite ran431 tests:430 passed and one
temporary-cache atomic rename was denied by the Windows sandbox. The affected
canonical-stage file then passed5/5 with normal host filesystem access. The four
quarantined test files remain excluded only from that local invocation; hosted
CI runs the complete declared suite with those tracked files intact.
