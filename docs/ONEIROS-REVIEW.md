# Oneiros regular-stage admission

`enemy_1070_iced` uses the shared single-use drone-bomb cast with Arts damage and
Cold. It is admitted only when its reviewed skill, native wrapper, cast, status
and projectile shapes match. Other enemies with a skill named `bomb` remain
unapproved.

## Original evidence

- `data/arkpedia-enemy-records.json`: `bomb`, initial cooldown/cooldown 5 s,
  `freeze: 10`, flying, Arts damage and a 2.5-tile targeting radius.
- CN resource `26-09-22-07-47-20_6c71fa`, `battle/enm_pfb_5.ab`: one `Bomb`
  wrapper, max trigger 1, silence ignored, stun interruption allowed. The cast
  uses `Attack`, `Idle_2`, `projectile_iced`, physical/Arts selector value 2,
  ATK scale 1, and an `e2c_cold` active buff loaded from the database with
  status resistance enabled. Minimum post-release delay is 0.667 s.
- The retained `projectile_iced` components come from the same checksum-pinned
  shared projectile bundle as Bombtail. They specify speed 5, homing, a centered
  3×3 collision box, impact-only collision, camouflage ignored, no repeat hits,
  10 s lifetime and persistence after source death.
- `data/arkpedia-oneiros-source.json` retains exact skeleton event clocks and
  their source identities. Native animator object `3489530625381810286` maps
  Attack to Attack; skeleton component `5995316242066751598` points to skeleton
  data `6609065395343054399` in `refs/arts/enm_art_4.ab`. Its original skeleton
  has one OnAttack event at `0.2666666805744171` s, mapped to 8/30 simulation
  seconds. The Attack clip lasts exactly 1 s.

Reproduce the animation receipt from the verified bundle cache:

```sh
ARKPEDIA_PYTHON=<python-with-UnityPy> node tools/arkpedia/enemy-animation.mjs \
  --enemy enemy_1070_iced --bundle refs/arts/enm_art_4.ab \
  --skeleton-data 6609065395343054399 --out data/arkpedia-oneiros-source.json
```

The extractor checks the immutable CN manifest and bundle byte count/MD5 before
reading the exact skeleton-data object. The receipt also records SHA-256 for
both bundle and skeleton. `extract-enemy-native-abilities.py` retains the cast,
trigger, projectile controllers and collision box separately.

## Runtime and validation

After the five-second initial cooldown, an eligible target triggers the cast.
Damage waits for release and projectile arrival; the target and its eight
neighbouring tiles receive Arts damage and Cold. Existing Cold combines into
Frozen through the shared status implementation. The drone cannot make ordinary
attacks or throw a second bomb, and gains no movement bonus.

Tests check source event timing, initial cooldown, silence, one-shot behavior,
area exclusions, Cold duration, Cold-to-Frozen combination and refusal of changed
status/blast geometry. Shared Bombtail regression tests cover stun interruption,
withdrawn targets, source death before/after release and projectile timing.

The existing shared cast's explicit simulation mappings and rendering limits
still apply. Native visual parity and compiled controller/frame parity are not
claimed; challenge-mode rules remain separately gated.

## 6-15 Challenge skill radius

The original `enemy_skill_radius_mul` rune targets only `enemy_1070_iced` with
scale 0.9. Its separate HP/DEF rune doubles those attributes. The compiler now
carries the skill selector scale independently of ordinary attack radius, and
only features explicitly declaring a reviewed skill-radius mapping may accept
it. Oneiros therefore requires a target within 2.25 tiles instead of 2.5;
the projectile's 3x3 impact geometry and Cold duration remain source-defined.
`test/arkpedia-stage-skill-radius.test.js` exercises the boundary, unchanged
splash, original-rule parsing and refusal of unreviewed enemy skill selectors.
