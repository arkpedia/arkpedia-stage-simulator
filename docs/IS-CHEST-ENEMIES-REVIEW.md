# Chest Seaborn and Testaceous Vinecreeps

The two enemy families share `loggedEnemyBody`, which composes a reusable passive
body with the existing killed-only result counter. It adds the native stun,
Freeze and silence immunities, plays each original Start clip, and applies the
original attack duration and hit event. The three database levels keep their
independent HP/ATK and other statistics.

The source birth delay maps to a brief movement/attack/targeting hold, following
the existing virtual-image birth convention. That simulation mapping is explicit;
this review does not establish compiled native frame ordering. Birth visuals are
cleared only if the component still owns the current visual marker.

Native admission validates the ordinary melee Combat, passive attributes,
blackboard values, exact result action, root/mode links, born delay and graphic
bindings. Skeleton-data references match the separately verified event clocks.
Unknown flags, immunities, log amounts, keys or changed born bindings stay
blocked. The source result keys are `trap_068_badbox` and `trap_110_smbbox`.
Duplicate death notifications cannot repeat a reward event. Leakage and expiry
produce no killed result. The UI gives these counters readable labels; the run
caller receives the result and decides progression or rewards.

Original bodies are stored once at arkpedia-sd-assets commit
`93916fa84799f597bc451781e34d55009d9e50af`. Both bodies and all twelve clips decode
with finite poses on desktop and mobile Chromium. Original clocks can be checked
with `ARKPEDIA_PYTHON=<python-with-UnityPy> node tools/arkpedia/is-chest-animations.mjs`.

Validation: 207 combined feature, loading, plan and result-controller tests;
follow-up chest tests cover all six source records and readable result labels.
All 778 admitted database records pass serialized-plan combat comparisons and
mode-statistic invariants. All 960 available stage graphs pass their ten-second
smoke. A controlled browser fixture loads one shared adapter for both precompiled
records, completes both birth phases and records their separate counters without
requesting the source registry or compiler. It is not a real-stage playthrough.
These additions admit two enemies; their original stages retain other blockers.
