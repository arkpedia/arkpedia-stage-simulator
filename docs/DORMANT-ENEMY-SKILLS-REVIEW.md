# Dormant Companion Guard skill rows

Both Companion Guard database records contain a `Flame` skill blackboard. Their
pinned native prefabs contain no Flame object or attached skill wrapper, and the
Default mode has null attack and attack-trigger references. Their Combat and
passive abilities are separate. Both actual Flamerazer prefabs contain Flame
objects and two native wrappers.

The old registration attached the Flamerazer kit based only on the database
skill name. On Companion Guards its missing `interval` parameter made the next
activation time NaN, repeatedly scheduling burning damage and adding an unrelated
death blast. The exact reviewed dormant rows now produce no Flame ability.
Their database records, ordinary attacks, taunt, Refraction and companion aura
registrations remain intact. Changed dormant parameters and unrelated Flame
prefabs fail the record gate; actual Flamerazers keep their existing adapter.

Twenty-second regressions for both guards, through raw and serialized-plan
execution, assert no burning damage, no scheduled Flame callbacks and no death
blast. All 174 existing feature tests pass. Plan comparisons cover all 771
admitted database levels, including an additional check that configurable mode
statistics do not change their compiled behavior parameters.

Original component inspection is reproducible with:

```
python tools/arkpedia/inspect-native-enemies.py --enemies \
  enemy_1173_duspfr enemy_1173_duspfr_2 enemy_1174_duholy enemy_1174_duholy_2 \
  --out .cache/arkpedia/flamerazer-native-inspection.json
```

`data/arkpedia-dormant-enemy-skills-review.json` retains bundle receipts and mode
references. This correction does not certify the older Flamerazer adapter's
native targeting, timing or death-chain fidelity.
