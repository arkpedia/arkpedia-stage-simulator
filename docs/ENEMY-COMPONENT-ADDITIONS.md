# Adding enemy components

Enemy behavior is compiled from source-checked feature data. A stage loads enemy definition components and only the runtime kinds those definitions reference. New enemies do not need a stage-specific implementation.

## Reuse a component first

- `passiveEnemyBody`: birth presentation/action gates and passive body flags.
- `animatedMeleeAttack`: one ordinary melee cast driven by native animation markers.
- `markedRangedMeleeAttack`: blocker melee plus a marked ground target using another direct-hit clip.
- `markedMeleeProjectileAttack`: blocker melee plus marked local/global projectile casts.
- `programmedProjectileModes`: one source-owned buff program selects among validated projectile modes; each cast captures its packet.
- `environmentStatBonus`: an enemy-owned modifier enabled by a stage-provided condition bit.
- `contactBuffProgram`: source-owned contact bindings that execute a portable native buff program.
- `stageOutcomeCounter`: native killed/exit result receipts, independent of progression or rewards.
- `stagePresenceGauge`: a live native passive owns its signed presence count and optional body flags/modifiers together.

The marked attack components share their selector setup, captured-target cast clock and ordinary damage/projectile paths. Global range is a runtime selector flag; no nonfinite number enters portable enemy statistics or component JSON.

## An atomic enemy addition

1. Add a build-only family feature file under `shared/arkpedia`. Keep its IDs, exact record/native admission predicate and parameter mapper together. Register its handbook/talent/native feature once in `enemy-features.js`.
2. Retain the native components the predicate reads. Use the explicit object, sibling and geometry scopes in `extract-enemy-native-abilities.py`. References and source digests remain separate from runtime payloads. Reuse `ordinaryMeleePacketNative` and `markedGroundSelectorNative` for matching source contracts.
3. Supply original animation clocks when behavior depends on markers. Use `enemy-animation.mjs`; keep native aliases such as `C_Attack` rather than inventing missing clips.
4. Add focused behavior and refusal cases. Verify ordinary damage, control interruption and source/target lifetime handling where relevant. A compiler accepting a template is not permission to admit an unrelated enemy.
5. Regenerate support, runtime-plan and native-program reports. Pin source hashes for new shared contracts in the report tools. Check that older registrations remain supported.
6. Publish original artwork through the existing asset importer. Use `--native-bindings` when native animator aliases select the clips. Alias a whole model only when its artwork is actually identical; keep different textures/forms independent.
7. Commit the source contract, component parameters, reports and review evidence together. Refresh the stage library when entering the stages phase; stages then pick up the component definitions without hand-written per-stage enemy behavior.

A new runtime kind is appropriate when existing components cannot represent the mechanic. Register that reusable kind once in `arkpedia-enemy-runtime-index.js`; do not add enemy-ID switches or import the source catalog into the browser. Behavior programs use the existing shared component store, including deduplication and on-demand hydration.

## Environment ownership

The stage determines lighting, weather, terrain and device markers. The enemy consumes those values and owns its response. `environmentStatBonus` and the native NIGHT program predicate read `battle.environmentConditions.maskAt(actor)`; missing providers mean no active conditions. Marked attack selectors read native target buff keys. An isolated enemy fixture may inject a provider or marker, but the original stage remains gated until its controller produces that state correctly.
