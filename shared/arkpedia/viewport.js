// SPDX-License-Identifier: GPL-3.0-or-later
// Touch devices and narrow phone-sized windows need the map's landscape layout.
// A tall desktop window with normal mouse controls can keep playing.
export function requiresLandscape({ width, height, coarsePointer }) {
  return height > width && (coarsePointer || width <= 650);
}
