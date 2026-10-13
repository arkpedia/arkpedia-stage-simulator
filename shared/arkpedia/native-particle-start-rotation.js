// SPDX-License-Identifier: GPL-3.0-or-later
import {sampleParticleCurve} from './native-particle-curves.js';

// Source start angles are radians. Euler application is Z, then X, then Y;
// native random ordering, flip direction and angular-velocity modules remain
// separate fidelity gates. This samples birth phase, not particle lifetime.
export function createParticleStartRotation(initial){
  if(initial.randomizeRotationDirection!==0)throw Error('Randomized rotation direction not playing');
  if(typeof initial.rotation3D!=='boolean')throw Error('Invalid native start rotation axes');
  const curves=initial.rotation3D?[initial.startRotationX,initial.startRotationY,initial.startRotation]:[initial.startRotation];
  for(const curve of curves)for(const phase of [0,1])for(const factor of [0,1])sampleParticleCurve(curve,phase,factor);
  return {sample(phase,factors){
    if(!Number.isFinite(phase)||!Array.isArray(factors)||factors.length!==3||factors.some(v=>!Number.isFinite(v)||v<0||v>1))
      throw Error('Invalid native start rotation sample');
    const rotation=sampleParticleCurve(initial.startRotation,phase,factors[2]);
    return {rotation,...(initial.rotation3D?{rotation3D:[sampleParticleCurve(curves[0],phase,factors[0]),
      sampleParticleCurve(curves[1],phase,factors[1]),rotation]}:{})};
  }};
}
