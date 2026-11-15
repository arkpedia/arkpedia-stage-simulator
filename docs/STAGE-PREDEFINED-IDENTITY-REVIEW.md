# Predefined ally identity and deployment cards

Initial `level_predefines_enable` rules now resolve operator aliases as well as
device aliases. Operator rules are applied to the original actor/card records
before scheduled activation. Unknown or duplicate aliases and malformed enable
values fail compilation. Viewer card validation still compares the unmodified
source state. The compiler requires an original actor/card program, so a legacy
compilation path cannot silently discard an enable rule.

Preplaced actors no longer create deployment-shelf cards. They keep their
source build and remain selectable on the field, but cannot be manually
redeployed after removal. An internal bench entry continues to hold their
build and live-unit reference; it is marked `noCard` and is not a deck card.
Scheduled activation remains idempotent. Genuine predefined cards retain their
existing reveal, deployment and redeployment behavior.

This follows the distinction between `characterInsts` and `characterCards` in
the level data. Additional public native-code research reports separate card
injection and direct predefined Character creation:
[ArkBattle's pinned native analysis](https://github.com/wfrfred/ArkBattle/blob/097db62efa5d4d5a86bdc5268f5f426d6610dd8e/docs/research/evidence/predefined-source-20261112/native/README.md).
That secondary source documents one ordinary native path and explicitly excludes
some mode/hot-update paths. Its binary extraction was not independently rerun
here, and no implementation was copied from it.

Multiple builds with the same operator identity still require a separate
instance-identity design across records, controller state, squad talents and
UI selection. TW-S-1/TW-S-2 challenge actor-enable rules now compile, but these
stages remain blocked because the source does not exclude the trial identities
from the player's squad. No artificial squad exclusion is introduced to hide
that limitation. Existing stages with explicit source exclusions retain their
current behavior.
