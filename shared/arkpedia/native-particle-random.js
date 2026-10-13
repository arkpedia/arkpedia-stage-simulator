// SPDX-License-Identifier: GPL-3.0-or-later
// Stable per-particle factors; modules use separate salts and retain factors
// across lifetime samples. This deliberately does not claim Unity RNG parity.
export function particleRandom(id,salt,seed=1){
  let x=Math.imul((id+1)^seed,0x45d9f3b)^Math.imul(salt+1,0x27d4eb2d);
  x=Math.imul(x^(x>>>16),0x45d9f3b);return ((x^(x>>>16))>>>0)/0x100000000;
}
