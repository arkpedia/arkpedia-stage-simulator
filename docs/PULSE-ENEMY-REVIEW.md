# Pulse-reactive Sarkaz

The retained original prefabs cover `enemy_1084_sotidm` and
`enemy_1085_sotiwz`, including both `_2` and `_3` variants. The warrior's two
combat modes explicitly select Physical then Arts damage. The previous runtime
incorrectly started in Arts mode. Both families carry the original `ore_immune`
marker. An altar now emits one shared `stagePulse` event after its original
13-tile selection and before resolving immunity and damage.

The caster does not perform ordinary attacks. Its two Immo wrappers use a
five-second, non-ASPD cooldown, initial cooldown zero, 100% ATK Arts splash,
ground-only selection, and circle colliders of radius 1.5 and 2.5 respectively.
The extractor retains those selectors' sibling colliders and transforms, with
source digests, rather than inferring area from the ordinary attack radius.
The zero-damage ordinary attack and empty combat component are suppressed;
the associated -4.9 ordinary attack interval adjustment has no damaging attack
to accelerate. The normal wrapper ignores silence; the charged wrapper does
not (the original enemies are naturally silence-immune).

The simulator maps the first pulse to permanent mode activation, with the new
wrapper initially ready; subsequent pulses do not reset the cooldown. Casts
require an eligible ground target and can act after crowd control ends.
Non-projectile splash ignores camouflage but retains stealth/untargetability
rules. These are reviewed gameplay mappings, not certification of native
mode-switch frame timing or the charged visual animation set.

Evidence is pinned in `data/arkpedia-enemy-native-abilities.json`; admission
checks are in `shared/arkpedia/enemy-pulse-features.js`. The public PRTS pages
[warrior](https://prts.wiki/w/游击队萨卡兹战士) and
[caster](https://prts.wiki/w/游击队萨卡兹术师) corroborate immunity, mode activation,
spell radii, initial cooldown and ordinary-attack suppression.

`test/arkpedia-pulse-enemies.test.js` exercises all six variants, cadence,
range, repeated pulses, silence/control, air/stealth/camouflage and refusal of
changed original selectors/damage/geometry. Stage-device tests exercise an
actual altar's immunity/transition path.

The additions 7-11, 7-11 Challenge, 7-12, 7-12 Challenge, 7-17, FD-S-2 and H7-1
retain original rules and remain developer-only. Their browser startup and
no-deployment wave-schedule checks are recorded per stage; raised-life route
sweeps are not playable clears or full fidelity approval.
