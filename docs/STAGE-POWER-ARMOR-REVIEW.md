# Shared dormant Power Armor and experimental drivers

The original stage compiler now binds all four dormant R-11/R-31 device variants to their branch
IDs and action indices. A single controller consumes marked Dor experimental
enemies until the device reaches 100 SP, runs the original activation clock,
spawns its branch enemy with the device's current HP ratio, and withdraws the
device. No stage-specific combat script is used. DV-4, DV-6, DV-7, DV-EX-2 and
DV-EX-3, including challenge device toggles, pass integration tests through the
normal compiler. Disabled devices keep validated branch bindings without becoming
live bodies. Instance blackboard ordering does not change its meaning.

The six Dor-1/2/3 records share the driver-death behavior. Dor-1 and Dor-2 grant
50 SP; Dor-3 grants 100. Only a real kill by an actor retaining `lypa[car_mark]`
grants SP. Leaks, unrelated kills, expiration and duplicate removal do not.
Replicas use the shared projectile transport. Bionics use the existing strongest
Physical/Arts Sanctuary channel while unblocked; true damage remains unaffected.

The two Rhine Lab Engineers select the nearest damaged dormant armour. Their
repair link travels at the original speed, applies ten 5%-of-target-maximum-HP
heals over its contact lifetime, and stops on interruption, target activation or
full HP. A common travelling pulse-link helper owns motion and pulse timing.
The repair respects healing modifiers and prohibition. Normal attacks use the
existing Arts projectile transport. Cooldown, first-pulse and full-HP polling
behavior have executable regressions; these are not native frame parity claims.

## Evidence and boundaries

Admission checks the retained original enemy, device and skill components,
projectiles, action templates, source record parameters and bound skeleton clocks.
The pinned CN bundle remains the source of those records. Public corroboration:

- [Engineer description and repair](https://prts.wiki/w/莱茵生命工程科成员).
- [BenaProtractor's heal-node interpretation](https://github.com/TeamTorappu/BenaProtractor/blob/c722a595923e8b12bccecde1d15264e6aa933511/anne/node_translator/heal.py):
  the misleading `_getMaxHpFromTarget=false` field uses recipient maximum HP.
- [Native node declarations](https://github.com/AdoreJc/ArknightsDB/blob/95ce0f0823f233389fa97e0d7fc9d1759e58464e/source/dump/HealViaMaxHpRatio.md)
  establish the interface, not the executable method body.

Branch admission currently accepts one immediate action, one enemy, and a route
starting at the source device. Unknown phase selection, delayed/multiple actions,
overrides and mismatched route origins stay blocked. Branch enemies do not add
planned kill totals, but hold final victory. Activation itself also holds victory,
including when consuming the last driver. Destroying an activating device cancels
its pending conversion and logs its kill instead of an activation.

R-31/R-31a heavy armour now uses one parameterized punch sequence: release its
blocker, retain that target's deployment identity, perform the opening strike and
complete two-hit loops while the ten-second mark survives, then recover for one
second. Native animation events control hit timing. Slow Down changes the attack
clips but not the mark's wall clock or final recovery. Interruption cancels the
sequence, and target death/retreat ends it without retargeting. The native lasso's
validity role is represented by the held target identity; its visual projectile
and exact native frame transitions are not reproduced. Armour deaths share the
original `killed` outcome counter; device withdrawal only records activation.

Generated route paths now preserve waits and teleport breaks. Original source
marks distinguish waiting visibly at an entrance from waiting hidden inside it.
DV-7 tests the five-second initial hold, three-second tunnel and original exit.
Library rebuilds retain real viewer paths, while regenerating older fallback
paths so stale generated data cannot discard that behavior.

All four dormant devices have original bodies in the shared SD store. Device
models use `device/<id>/default/default`, without duplicated operator facings.
The browser fetches metadata and files for the selected stage only. Enemy and
device additions use one pinned-byte verifier and component publisher. The four
new bodies are distinct; exact future duplicates can use explicit manifest
aliases. Full native effects, controller/frame parity and complete native score
accounting remain outside this review's claims.

## Verification

The initial driver/Engineer checkpoint remains in
`data/arkpedia-stage-power-armor-review.json`. The extension is recorded separately
in `data/arkpedia-heavy-power-armor-review.json`.

- 418 enemy, battle, wave, branch and route regressions passed.
- Seven device integration tests cover all four variants, HP transfer, challenge
  selection, source receipts, cancellation, kill counters and the DV-7 tunnel.
- All 902 loadable stage graphs passed the ten-second runtime smoke.
- Two heavy enemy bodies decoded 24 clips, and four dormant device bodies decoded
  12 clips, on both desktop and touch.
- Eight browser cases cover DV-4, DV-6, DV-EX-2 and DV-EX-3 on desktop and touch:
  original dormant model, Default/Start clips, conversion and restart. They use
  injected original drivers and diagnostic HP, not a stage-clear claim.
- Shared asset validation passed 3,721 models and all 94 tests. The lightweight
  library still starts with a roster and loads full operator/device data on demand.
