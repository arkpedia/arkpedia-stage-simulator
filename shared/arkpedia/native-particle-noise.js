// SPDX-License-Identifier: GPL-3.0-or-later
// Deterministic high-quality curl-of-Perlin inspection field. Unity documents
// this algorithm family, but its native permutation tables/coordinate mapping
// are unavailable: this field is a local replay, not compiled Unity parity.
import {particleRandom} from './native-particle-lifecycle.js';

export function createParticleNoise(seed=1){
  if(!Number.isSafeInteger(seed))throw Error('Invalid particle noise seed');
  const tables=Array.from({length:3},(_,channel)=>{
    const table=Array.from({length:256},(_,i)=>i);
    for(let i=255;i>0;i--){const j=Math.floor(particleRandom(255-i,channel*256+i,seed)*(i+1));[table[i],table[j]]=[table[j],table[i]];}
    return table;
  });
  function perlin(point,channel=0){
    if(point.length!==3||!point.every(Number.isFinite)||!Number.isInteger(channel)||channel<0||channel>2)throw Error('Invalid particle noise probe');
    const cell=point.map(Math.floor),local=point.map((v,i)=>v-cell[i]);
    const fade=local.map(t=>t*t*t*(t*(t*6-15)+10)),derivative=local.map(t=>30*t*t*(t-1)*(t-1));
    const table=tables[channel],gradient=[0,0,0];let value=0;
    for(let x=0;x<=1;x++)for(let y=0;y<=1;y++)for(let z=0;z<=1;z++){
      const corner=[x,y,z],offset=local.map((v,i)=>v-corner[i]);
      const hash=table[(table[(table[(cell[0]+x)&255]+cell[1]+y)&255]+cell[2]+z)&255]&15;
      const g=[0,0,0],u=hash<8?0:1,v=hash<4?1:(hash===12||hash===14?0:2);
      g[u]+=hash&1?-1:1;g[v]+=hash&2?-1:1;
      const dot=g.reduce((sum,v,i)=>sum+v*offset[i],0),w=corner.map((v,i)=>v?fade[i]:1-fade[i]),weight=w[0]*w[1]*w[2];
      value+=dot*weight;
      for(let axis=0;axis<3;axis++)gradient[axis]+=g[axis]*weight+dot*(corner[axis]?1:-1)*derivative[axis]*w[(axis+1)%3]*w[(axis+2)%3];
    }
    return {value,gradient};
  }
  function curl(point){
    const [x,y,z]=[0,1,2].map(i=>perlin(point,i).gradient);
    return [z[1]-y[2],x[2]-z[0],y[0]-x[1]];
  }
  return {perlin,curl};
}
