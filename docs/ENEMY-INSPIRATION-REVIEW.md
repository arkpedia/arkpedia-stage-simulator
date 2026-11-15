# Native Inspiration producer and receivers

The native Herald aura carries two distinct buffs: independently stacking ATK/DEF grants, and one named `enemy_9D0_talent_strength` marker. The prior adapter refreshed stat grants but never emitted the marker expected by inspired enemies; those consumers only responded to an artificial private test marker.

The reviewed Heralds now use a shared `statMarkerAura`. `OwnedStageAura` gains an opt-in independent-stack mode; its existing strongest-owner mode still handles the shared marker and other stage auras. Losing one source removes only its stat grant and immediately transfers marker ownership to a surviving source. Losing the last source removes the marker. Source disappearance retains the global aura as specified by the original flag; recipient selection still respects isolation, hidden/sleeping bodies and untargetability.

A shared `markerStatBonus` uses the native quarter-second buff clock for the five reviewed stat receivers, including while controlled or silenced. Movement uses the native additive percentage channel, ATK uses its percentage channel and ASPD uses flat addition. Each receiver has one persistent bonus independent of the number of Heralds. Its finish check removes the bonus after marker loss. Source and binding gates check the exact marker, native selector, stacking flags, listener interval and child actions. Global templates come from the pinned Global evidence; newer CN-only serialized fields are not inferred into that contract.

Both Inspiration adapters and the legacy marker/target-count adapters now load from the selected Inspiration module. New stage plans do not fetch the legacy enemy catalogue for these effects. Historical pinned strength plans retain their private marker spelling and remain executable. The shared target-count consumer also recognizes the real native marker.

Tests cover real producer-to-receiver activation, overlapping sources, immediate source cleanup, one receiver bonus, new recipients, control, failed marker application, source disappearance, recipient filtering, native mutations and raw/compiled plan parity. Existing prisoner aura tests continue to verify strongest-owner fallback. Browser desktop/touch fixtures use isolated actors on compiled 0-1 geometry with no main waves; these are mechanic checks, not stage clears or exact Unity-order certification.

This repairs existing admitted content. It does not admit the elite Siegebreaker or claim its birth and attack timing are complete; those remain a separate source review.
