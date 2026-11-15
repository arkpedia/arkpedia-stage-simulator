# Shared reactive enemy variants

`enemy_2001_duckmi_2` and `enemy_2034_sythef_2` keep separate source records and
stats while using the existing Duck Lord and Crying Thief native prefabs. Their
CN handbook descriptions are recognized only inside these reviewed families;
matching translated text cannot admit an unrelated prefab.

The Duck Lord variant has 6,000 HP and a single permanent +300% movement modifier
on first damage (4x base speed), compared with the ordinary record's +400%.
The same native non-attacking mode transition, unblockability, slow composition
and one-time activation are reused. The variant's native prefab hierarchy hash
is `6d553bf890810300148f94ee04d7b80715c0ae5dc1ab8a424c842fb5439a5a11`.

The Crying Thief variant has 4,500 HP and a 3.5-second stun. It uses the existing
resistance-aware ordinary-attack status hook: damage dodge does not cancel the
stun, Silence does not disable it, and invisibility returns immediately after
unblocking. Its native prefab hierarchy hash is
`d773d0aa6a6d08f221b96d3bf11692992c9f326b3732c1cef8b4c5a91866cc95`.
The original prefab components/templates remain in the shared native evidence.

Each variant's `prefabKey` resolves the exact existing shared model. There is no
new skeleton, texture, controller, copied manifest entry or asset release. This
is distinct from explicit shared-model aliases for different native prefabs with
byte-identical bodies; those remain in the shared asset manifest as agreed.

The existing family tests now cover both parameter sets, including slow and stun
resistance, dodged damage, unblockability and stealth restoration. Admission
rejects changed parameters or prefabs. Full support/runtime tests include both
new records and preserve all previously admitted enemy identities. Browser
validation uses four records and two actual shared BattleActor models on desktop
and touch; compiled native frame parity, VFX/audio and complete mode-run behavior
are not claimed.
