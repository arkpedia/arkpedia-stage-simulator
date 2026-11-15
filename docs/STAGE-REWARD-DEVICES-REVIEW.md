# Reward devices and scheduled activation

Treasure Chest (`trap_757_skzbox`) now has a shared device controller. The source
record, prefab and referenced template come from checksum-pinned tables and
bundles. Its level curve supplies 5,000 HP at level 1 through 295,000 at level 30,
200 DEF, zero RES/block and low targeting priority. Native side/category and
passive immunity fields identify an attackable enemy-side trap with stun,
freeze and silence immunity. It does not rewrite terrain or block routes.

The placed-body API can now create a device on its original side before deploy
observers run. Chests stay outside the friendly roster, deployment limit,
wave totals and clearance waits. Ordinary attacks can destroy them. A killed
chest records one `trap_757_skzbox` result event; expiration and repeated death
delivery do not award another event. The result panel describes the counter;
the stage simulator does not change a run wallet.

Source aliases retain initial hidden state and can be activated by the shared
wave scheduler. Activation is idempotent. Unknown targets, duplicate aliases,
unimplemented instance overrides and legacy builds without an original wave
program fail before publication. Other device controllers retain their existing
static-instance rules. Occupied-tile activation uses the existing placed-body
failure path and does not retry; native collision/frame ordering is not certified.

This implements static and scheduled chest activation. Plain weighted pools
share the enemy-spawn selector, including explicit empty activation choices.
Most source chest pools also contain Stagnant Contraptions and other devices.
Those pools remain blocked until every candidate is supported, so this
checkpoint does not add full loadable stages. No arbitrary hidden device is discarded.

Tests cover original source drift, HP interpolation, side/targeting, immunities,
movement, kill counters, hidden activation and exact scheduler timing. Existing
device and wave regressions also pass. Desktop/touch result checks use a
controlled chest fixture and verify the counter and restart reset. Artwork,
native frame order and normal-play stage clears are not certified here.
