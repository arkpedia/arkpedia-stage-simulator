# Matriarch shared components

The third Saint Statue (`enemy_10091_hlsttu_3`, 'Matriarch') now uses the existing recharging barrier aura and passive body. Its source data supplies a 3.5-tile radius, 6% Max HP recharge each second and a 150% Max HP cap. The same named recipient barrier remains shared across sources and excludes statue/dream markers.

A talent-fed target-count trait selects three distinct operators. Unlike the ordinary statues, the original attack waits for an animation marker. The new `animatedProjectileAttack` adapter composes the existing ordinary attack sequence with the existing single-target projectile transport. It captures target deployments, releases once per native marker, cancels unreleased casts on control/death, follows slowdown, and leaves released projectiles to their own lifecycle. Future enemies can supply an animation and transport parameters without copying this adapter.

The strict source gate checks the target-count modifier and binding, selector, native marker wait, exact Attack duration (48/30 seconds) and release (25/30 seconds), barrier templates, passive immunities and source marker. Its extra kill-log component passes the existing stateless auxiliary classifier; it is not counted twice. The Matriarch’s original body decodes and renders on desktop/touch with four clips. Original artwork is pinned to asset commit `bc97e8def5cde2f104704ec9ac6099fea871eab4`.

Source/native, timing, interruption, target-count, barrier and full raw/compiled record parity checks pass. Browser fixtures deploy three operators on compiled 0-1 geometry, with main waves removed: no early projectile, three releases at 0.8667 simulation seconds, three retained hits after source death, and recharge from 60 to 1500 on a 1000-HP recipient. These fixtures do not certify an original Matriarch-stage clear or exact Unity frame ordering. Native particles are outside this body review.

Enemy coverage rises from 721 to 722; loadable stages remain 970. The original Matriarch stages still require the `env_act42side_level_ctrl` controller (and MT-8 has further dependencies). The controller remains gated pending review.
