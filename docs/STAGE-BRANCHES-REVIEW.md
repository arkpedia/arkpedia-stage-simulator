# Triggered stage branches

The shared compiler now supports explicitly bound, single-phase SPAWN branches.
It reconciles every original action with the conditional viewer export and
maps `extraRoutes` separately from main-wave route indices. It retains action
counts, phase/action delays and repeat intervals. Unknown bindings, multiple
phases, random packs, payloads, advanced route clocks and unsupported action
types remain blocked. This is a reusable scheduler contract, not a flattened
list of enemies added to each stage.

A triggered phase owns its queue independently of the triggering body's life.
The admitted managed, null-payload branch path creates uncounted enemies that
do not block the current wave, but do hold final victory. Explicit phase
completion blockers are separate from these enemy lifetimes. Delayed actions
without such a blocker do not independently hold an otherwise finished battle.
The mapping follows the
[pinned scheduler research](https://github.com/wfrfred/ArkBattle/blob/097db62efa5d4d5a86bdc5268f5f426d6610dd8e/docs/research/cases/30-scheduler-action-data-fields.md);
its binary extraction was not independently rerun. Exact native coroutine
ordering, recycling and random phase selection are not certified.

Stagnant Contraption (`trap_758_skzmbx`, called “Idle Exquisicart” in the viewer)
is the first producer. The pinned passive skill takes its `branch_id` from the
original instance, starts that branch on receiving damage, then removes the
device. It has the chest HP curve and no status immunities. Fatal/reentrant hits
still trigger only once. HP loss, unrelated removal and direct kill do not
trigger it. Its spawned Lost Contraption owns the eventual kill/theft counter;
the empty chest does not grant a second reward. No artwork was added.

Plain weighted empty SPAWN keys now use the same explicit no-appearance choice
as empty activation keys. Their delay, count and route are not executed.
Compilation also retains every possible enemy record, including candidates
not selected by the validation seed. Tests exercise different runtime seeds.

The first original-branch gate temporarily blocked H5-3 and FIN-TS. Subsequent
review found that both original levels have empty predefined instance/card
tables: their retained ballista/frost aliases cannot resolve. The compiler now
retains explicit empty programs for unconditional, zero-delay activation
branches when all four original predefined tables are empty. Real targets,
delays, conditions and other action types still require their actual controller.
This is a general source rule, without per-stage exceptions.

The pinned native `TryActivePredefined` method logs an error and returns false
when neither a hidden card nor an instance can activate. Its executor ignores
that result and completes the action callback. The narrow reference is in
`data/arkpedia-empty-activation-reference.json`; native yield/frame timing is
not certified. The two stages are restored by this explicit interpretation.
Mimic pools still contain other unsupported devices/environments, so their
complete stages are not claimed as working.

Verification covers original route identity, source mismatch refusal, delayed
queues, total/wave/final accounting, real IS4 branch source, damage lifecycle,
source-instance overrides and random-candidate closure. Desktop and short-touch
reviews exercise a controlled mimic fixture and the outcome/restart UI.
All-stage smoke remains a constructor/ten-second check, not a normal-play clear
or full native fidelity certificate.
