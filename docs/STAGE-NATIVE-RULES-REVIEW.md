# Native stage modifiers

`data/arkpedia-native-stage-rules.json` retains four original CN prefabs and two
buff templates. `extract-stage-native-rules.py` verifies the pinned publisher
manifest, complete bundle checksums and Git blob before extracting selected
components. Shared source bundles and the complete template table remain in the
cache. `--check` verifies reproducibility without writing.

The stage compiler admits the reviewed IDs through narrow native predicates:

- `silenceimmue`: permanent Silence immunity on the selected enemy records.
  BW-7 Challenge changes only its Infused Originium Slugs.
- `invisible`: starts enabled, is suppressed by blocking, and returns three
  seconds after release. It reuses shared stealth targeting and rendering in
  10-3 and 14-14 Adverse. The source buff is not silenceable.
- `common_char_melee_built`: a deployment metric, not a placement override.
  Real melee/all-placement operator births on low ground increment
  `stageExtraBattleInfo.melee_built`; movement and tokens do not. Its candidate
  stage remains blocked by mixed-strength Active Originium semantics.
- `deploy_damage`: 10-16 Adverse deals 50% max HP as a normal True-damage packet
  after deployment effects. The original profession/buildable masks select
  recipients, including eligible tokens. Damage modifiers, shields, fatal
  handling and defensive SP use the common damage path. Movement does not
  retrigger the penalty; real redeployment does.

The native evidence hash joins the stage's atomic publication dependencies.
Tests alter native selectors, templates and fields to verify refusal, and
exercise the actual status/damage/deployment paths. Native Born versus simulator
deployment ordering, every selector edge case, particles and client frame parity
remain unverified; these are explicit local runtime mappings.

Additional original rune contracts use existing shared systems:

- 6-12 Challenge scales the Ice Crystal's SP requirement by 0.5.
- 7-17 Challenge excludes Caster and Defender cards, including support.
- SA-6 Challenge limits the full squad, including support, to ten.
- BW-3 Challenge replaces one original wave ID in the wave compiler. Shared
  geometry, timing, routes and assets are unchanged; replacement is one pass.
  Replaced enemies with local blackboard/stat overrides remain blocked.
- 14-15 Adverse adds 300 DEF to Soul Maelstrom after the stage stat scale.
- `char_attribute_mul` supports scoped HP/DEF multipliers through one selector
  helper. Operators and summons receive a single runtime modifier; supplied and
  predefined devices receive compiled/local values. Own class and placement
  determine selection. 11-3 Adverse uses DEF ×0.8; Ursus Camp R-03 roadblocks use
  HP ×5 and DEF ×1.2. Source records are unchanged.

Adverse stages resolve their own original level, including standalone H-stages.
FOUR_STAR rules apply to challenge and adverse variants; NORMAL rules do not.
All 55 existing adverse evidence bindings were reimported. Stages with remaining
rule/device blockers still require implementation; importing evidence alone does
not certify their existing compiled artifacts.
