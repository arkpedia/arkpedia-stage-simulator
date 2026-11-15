# Eblana: component work in progress

Eblana is still blocked. Her independent conversion aura is implemented and
source-checked at both database levels. Her phases, ordinary attacks, Sovereign,
Give and Take and Arson are not yet admitted. FC-8 and FC-EX-8 therefore remain
unavailable; this work does not count the boss as supported.

## Implemented conversion aura

The original global aura excludes its owner, `machine` tags and the Soldier,
Guard and Exhausted Flame markers. It ignores ordinary target-free flags and
is not silenceable. A qualifying killed body, excluding a fall, schedules one
Soldier after 0.5 seconds. Level zero selects the ordinary Soldier; level one
selects its elite variant. The new body follows the defeated body's remaining
route and enters its existing hit-count form immediately. It receives its own
record stats, not the victim's HP/ATK multipliers. No synthetic kill or rebirth
cleanse is used to select the form.

`deathConversionAura` owns the native buff key, removes only its bindings and
leaves already-triggered summons alive after the emitter dies. Overlapping
emitters cannot duplicate one conversion; the simulator retains the first
binding owner until it detaches. Native precedence between multiple simultaneous
copies of this boss is not established. The three target stages have one boss.

`StageWaveScheduler.scheduleSummon` captures the source's wave membership for
both the pending timer and emitted children. A source death does not cancel the
timer, and an old wave's timer or child does not block later waves after a
timeout. Planned kill credit and final victory are separate from wave ownership.
`enterEnemyHusk` reuses the original shared hit-count lifecycle, with immediate
Start presentation and a ten-second revival timer. Ordinary knockout still
retains its separate one-second rebirth interval.

The native selector's `SelfOption.EXCLUDE = 2` is corroborated by
[the public enum declaration](https://github.com/AdoreJc/ArknightsDB/blob/95ce0f0823f233389fa97e0d7fc9d1759e58464e/source/dump/SelfOption.md).
The runtime maps the three excluded native markers to their reviewed prefab
families. Fall exclusion uses the displacement engine's `deathByFall` receipt.
Original attached aura particles are not rendered.

## Remaining source work

The pinned `enm_pfb_18` hierarchy and all three projectile prefabs are retained
in `arkpedia-enemy-native-abilities.json`. Exact `enm_art_17` event clocks are in
`arkpedia-eblana-animations.json`; the body is extracted locally but has not been
published to the shared model store.

- The first defeat uses the five-second Revive ability and the
  `FinishCurrentWave` action with next-wave source tracking. The shared scheduler now models that explicit release and next-wave source
  transfer; Eblana still needs to invoke it from her reviewed rebirth composition.
- Reborn combat has two source attack events. Its `Combat_scale.atk_scale`
  damage modifier needs a resolved composition rule. The handbook's broad
  doubled-ATK description does not establish the modifier's native arithmetic.
- Level one's talent list replaces the list with only an elite summon key in
  the current record compiler. Resolving retained numeric defaults needs an
  explicit source-backed rule; the shared database merge policy has not been
  changed to guess at that behavior.
- Sovereign has separate one- and two-target selectors and an on-tile-impact
  Exhausted Flame summon. Its selector excludes the existing bound-flame buff.
  Exhausted Flame itself is implemented and reviewed separately.
- Sacrifice's helper runs its trigger buff on event 4, independently of the
  cast's hit buff. The selector accepts up to five ordinary-mode Soldiers.
  Its return projectile has a 0.5-second lifetime and a distinct movement mode.
  Source/owner attribution and shield grant timing need to follow those actions.
- Arson uses the `Skill_b_3` attack event at approximately 9.2 seconds and an
  11.6667-second clip. The existing Reeds controller can supply ignition once
  the phase transition and cast ordering are resolved.

Source declarations, serialized values and extracted clips are not executable
native method bodies. Partial components stay testable without declaring the
whole fight complete.
