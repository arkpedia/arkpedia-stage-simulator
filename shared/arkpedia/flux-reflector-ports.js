// SPDX-License-Identifier: GPL-3.0-or-later
// Shared device geometry; source evidence is loaded by the compiler/runtime.
export const FLUX_REFLECTOR_PORTS = Object.freeze({
  UP: Object.freeze(['UP','RIGHT']), RIGHT: Object.freeze(['RIGHT','DOWN']),
  DOWN: Object.freeze(['DOWN','LEFT']), LEFT: Object.freeze(['LEFT','UP']),
});
