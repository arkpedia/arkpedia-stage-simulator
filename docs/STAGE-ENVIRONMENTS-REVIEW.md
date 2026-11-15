# Original stage environments

Original `globalBuffs` are now part of stage preflight and compilation. Unknown
prefabs, selectors and blackboard parameters block additions and rule refreshes;
they are not omitted. Existing catalogue availability is not a fidelity claim.

The shared runtime implements:

- `periodic_damage`: allied characters, first tick after the original interval,
  True environment damage through normal modifiers and shields, no defensive SP.
- `kill_to_add_cost`: actual enemy deaths grant the original DP amount through
  the capped battle account; leaks and allied deaths do not.
- `character_in_magiccircuit_env`: natural SP recovery loses 0.5 outside the
  shared Realigned Flux field and regains that 0.5 when connected.

`env_gbuff_new` can replace a reviewed poison/kill-DP instance by identity. FA-1
challenge therefore takes 15 damage each 0.5 seconds, replacing normal FA-1's
10 damage. PRTS corroboration: https://prts.wiki/w/FA-1 .

`extract-stage-environments.py` verifies the original CN resource manifest,
`[uc]globalbuffs` bundle and buff-template Git blob. It retains exact object IDs,
component hashes and transitive templates in one shared artifact. The current
native gates cover executable selectors and damage/SP parameters. Compiled
native controller/frame parity is not established by serialized evidence.

Sixteen existing poison/kill-DP stages have atomic rule-refresh receipts and
passed browser startup/canvas checks and complete no-deployment wave sweeps with
raised life. Those sweeps are schedule/runtime checks, not playable clears.
Focused tests cover tick timing, poison classification, defensive SP, retreat,
redeployment, kill accounting, bounds and FA-1 replacement.

Remaining catalogue environments include chapter-12 sight management, Legion
stat escalation and Strife mode behavior. They remain explicit inventory
blockers until their controllers are reviewed. The shared SD snapshot also
still lacks many enemy bodies; browser startup does not certify original art.
