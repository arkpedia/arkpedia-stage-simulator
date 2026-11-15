# Introspection and Scantwords targeting

`enemy_1199_sfjin` (Introspection) and `enemy_1199_sfjin_2` (Scantwords) already
carry original base `tauntLevel: 1` in every catalogue level. The shared enemy
record compiler preserves that attribute, and ordinary targeting already sorts
by it after blockers and explicit skill priorities. Their remaining admission
gap was the handbook statement “More likely to be attacked by allied units.”

The new declarative feature accepts that exact statement only with the reviewed
base value 1. It adds no second taunt buff. Consequently silence does not remove
the base priority, and it cannot override a blocker or a skill's explicit
priority. Records making the claim with a zero/missing value remain blocked.

The existing `DeadSpawn` feature creates one Bronze Mirror or Brass Mirror on
death. Admission checks that child dependency too. Tests exercise actual unit
stats and the shared selector, the fragment's unblockable behavior, ordinary
blocker precedence and the death spawn. Blood-Debt and Excrescent-Carapace
enemies sharing the targeting sentence still fail admission on their own
unimplemented mechanics.

Source records and native component coverage remain pinned by the generated
enemy-support report. This is a targeting/admission completion, not a claim of
visual or client-frame parity for the whole enemy lifecycle.
