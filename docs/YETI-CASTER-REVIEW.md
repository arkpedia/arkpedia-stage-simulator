# Yeti Caster and original stage overrides

The normal and elite Caster share `arkpedia-enemy-yeti.js` and the existing
projectile transport. Original `Attack` / `ColdAttack` components and
`projectile_enemy_snow_magic_ball` are retained from the checksum-pinned native
bundles in `arkpedia-enemy-native-abilities.json`.

Ordinary attacks recover one SP up to two. The next eligible attack consumes
two SP and carries Cold with its projectile. Silence prevents that release but
does not prevent ordinary attacks from charging. The original projectile has
speed 10, lifetime 10, one target and no source-death cancellation. Its Cold
payload is independently unmissable and uses the original automatic status
resistance setting. Damage and status arrive at impact.

TR-16's original level gives the normal Caster 12 seconds of Cold and the elite
Caster one initial SP. The original level's skill and SP data now pass through
the same atomic stage compiler as literal talent overrides. Feature declarations
allow reviewed numeric changes; changed skill identities, costs, cooldowns,
undeclared blackboard fields and incompatible SP structures are rejected.
Global enemy records remain unchanged.

`arkpedia-yeti-caster.test.js` checks travel, charge, silence, source death,
damage evasion, both TR-16 overrides and rejected native mutations. TR-16 also
passed browser startup and a complete raised-life wave sweep. These establish
behavioral coverage, not native animation-event/frame parity.
