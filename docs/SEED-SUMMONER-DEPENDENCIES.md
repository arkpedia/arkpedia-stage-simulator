# Complete seed-summoner dependency graphs

The existing base Withering Apostle adapter now declares its
`enemy_1269_nhfly` child. The common spawn contract also validates seedSummoner
identities/counts and requires the child record before importing behavior
modules or constructing a battle. Future stage graphs inherit the dependency
from the enemy definition rather than relying on an unrelated explicit wave.

The factory's timing, count and placement are unchanged. Its controlled test
emits three children after the first ten seconds and six after twenty.
Malformed plans and missing children fail before module loading. All 195
focused checks and all 969 available-stage smoke checks pass. A browser check
loads Victoria, emits three controlled children from its prepared graph and
restarts without errors. This is not a stage-clear or native-fidelity claim.

Coverage remains 717 enemies and 969 combat stages. The available Victoria
graph already contained the child explicitly. The separate elite Decay
handbook mapping is unchanged by this dependency repair.
Evidence: `data/arkpedia-seed-dependency-review.json`.
