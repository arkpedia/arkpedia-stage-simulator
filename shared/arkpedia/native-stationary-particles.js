// SPDX-License-Identifier: GPL-3.0-or-later
import {createParticleLifecycle} from './native-particle-lifecycle.js';

// Stationary local particles keep their strict module boundary. Moving source
// modules use their own implementation instead of silently becoming still art.
export function createStationaryParticles(source,options={}){
  return createParticleLifecycle(source,{seed:options.seed??1});
}
