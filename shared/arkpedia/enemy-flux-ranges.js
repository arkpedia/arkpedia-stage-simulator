// SPDX-License-Identifier: GPL-3.0-or-later
// Compact gameplay values, checked against the pinned native range records by
// both Flux-family admission predicates. Research evidence stays in build tools.
const freeze = rows => Object.freeze(rows.map(Object.freeze));
export const FLUX_SPLASH_RANGE = freeze([[1, -1], [1, 0], [1, 1], [0, -1], [0, 0], [0, 1], [-1, -1], [-1, 0], [-1, 1]]);
export const FLUX_CUTOFF_RANGE = freeze([[1, 0], [0, -1], [0, 0], [0, 1], [-1, 0]]);
