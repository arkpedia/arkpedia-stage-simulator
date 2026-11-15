# Healing objectives

Dying Fowlbeast (`trap_759_skzwyx`) uses the shared placed reward-device
controller and source-alias activation. Its pinned prefab starts an allied body
at one HP, with 6,000 maximum HP at level 1 and 12,000 at level 30. The passive
sets stun immunity, an ordinary-damage HP floor and taunt −1. Attribute 20 is
taunt, not regeneration: the device does not continuously lose HP.

The new opt-in `targetFree` flag excludes opposing selectors while allowing
friendly healing. Ordinary medic and chain-heal selection can include a device
explicitly marked `characterLikeDevice`. Existing neutral scenery is unaffected.
This distinction follows the pinned prefab and the
[public targeting research](https://github.com/wfrfred/ArkBattle/blob/097db62efa5d4d5a86bdc5268f5f426d6610dd8e/docs/research/cases/33-targeting-and-targetable-pipeline.md).
That secondary binary investigation was not independently rerun here.

The full-HP condition runs after ordinary healing settles and on the source's
0.1-second polling interval, including regeneration. Completion records one
rescue counter and removes the body. Ordinary damage cannot kill it; direct
removal or an unrelated instant kill does not award a rescue. Initial state is
installed before deployment observers. The run caller owns ingot rewards.

Tests cover source drift, both level endpoints, opposing selection, stun,
ordinary medic healing, regeneration, partial healing, damage floors,
idempotent completion and deployment observation. Desktop and short touch
result panels show the rescue counter and reset it on restart. Specialized
operator selectors with their own native category masks still need individual
review; this is not universal skill-interaction, artwork or native frame-order
certification. Other unsupported members and branches of device pools still
prevent those stages from loading.
