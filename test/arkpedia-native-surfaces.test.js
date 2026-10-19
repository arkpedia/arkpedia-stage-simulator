// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {createParticleSurface} from '../shared/arkpedia/native-particle-surface.js';
import {createMovingParticles} from '../shared/arkpedia/native-moving-particles.js';
import rows from './fixtures/arkpedia-aphrissa-surfaces.json' with {type:'json'};
const near=(a,b)=>{assert.equal(a.length,b.length);a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-10,`${v} != ${b[i]}`));};
const original=type=>structuredClone(Object.values(rows).find(r=>r.data.ShapeModule.type===type).data);
const shape=type=>original(type).ShapeModule,constant=scalar=>({minMaxState:0,scalar});

test('box-shell area sampling selects all six faces in proportion to their areas without changing forward direction',()=>{
  const s=shape(15);s.m_Scale={x:2,y:3,z:4};const before=structuredClone(s),e=createParticleSurface(s),counts=[0,0,0];
  for(let n=0;n<5200;n++){
    const p=e.sample(.31,.63,(n+.5)/5200),axis=p.origin.findIndex((v,i)=>Math.abs(v)===s.m_Scale[['x','y','z'][i]]/2);
    assert.ok(axis>=0);counts[axis]++;near(p.direction,[0,0,1]);
    p.origin.forEach((v,i)=>assert.ok(Math.abs(v)<=s.m_Scale[['x','y','z'][i]]/2));
  }
  assert.deepEqual(counts,[2400,1600,1200]);assert.deepEqual(s,before);
  near(e.sample(0,1,1).origin,[-1,1.5,2]);
});

test('collapsed source box shells remain surfaces and preserve signed shape scale without consuming dormant radius controls',()=>{
  for(const zero of [0,1,2]){
    const s=shape(15);s.m_Scale={x:-2,y:3,z:-4};s.m_Scale[['x','y','z'][zero]]=0;
    s.radius={mode:7,value:NaN,spread:3};const e=createParticleSurface(s),free=[0,1,2].filter(i=>i!==zero);
    for(const face of [0,.1,.5,.9,1]){
      const p=e.sample(.25,.75,face),expected=[0,0,0];
      expected[free[0]]=-.25*s.m_Scale[['x','y','z'][free[0]]];expected[free[1]]=.25*s.m_Scale[['x','y','z'][free[1]]];
      near(p.origin,expected);near(p.direction,[0,0,1]);
    }
  }
  for(const magnitude of [1e-200,1e200]){
    const s=shape(15);s.m_Scale={x:magnitude,y:2*magnitude,z:3*magnitude};
    assert.ok(createParticleSurface(s).sample(.2,.8,.37).origin.every(Number.isFinite));
  }
});

test('circle emission retains source disc/annulus/edge bounds and radial speed independently of ellipse scale',()=>{
  for(const thickness of [0,.11,.5,1]){
    const s=shape(10);s.radius.value=2;s.radiusThickness=thickness;s.m_Scale={x:-3,y:4,z:0};
    const e=createParticleSurface(s);
    for(const a of [0,.25,.5,.75,1])for(const b of [0,.125,.25,.5,1]){
      const p=e.sample(a,b),r=Math.hypot(p.origin[0]/-3,p.origin[1]/4),lo=2*(1-thickness);
      assert.ok(r>=lo-1e-10&&r<=2+1e-10);near([r*r],[lo*lo+a*(4-lo*lo)]);
      near(p.direction,[Math.cos(b*2*Math.PI),Math.sin(b*2*Math.PI),0]);
      near([Math.hypot(...p.direction)],[1]);assert.equal(p.origin[2],0);
    }
  }
  const s=shape(10);s.radius.value=0;near(createParticleSurface(s).sample(.4,.25).origin,[0,0,0]);
});

test('surface origins and initial velocities use the original shape TRS and preserve the separate World birth frame',()=>{
  for(const type of [10,15])for(const space of [0,1]){
    const s=original(type);Object.assign(s,{lengthInSec:2,looping:false,prewarm:false,moveWithTransform:space,simulationSpeed:1,startDelay:constant(0)});
    Object.assign(s.InitialModule,{startSpeed:constant(2),startLifetime:constant(2)});
    for(const key of ['VelocityModule','NoiseModule','ClampVelocityModule','ForceModule','InheritVelocityModule'])s[key].enabled=false;
    Object.assign(s.EmissionModule,{enabled:true,rateOverTime:constant(0),rateOverDistance:constant(0),m_BurstCount:1,
      m_Bursts:[{time:0,cycleCount:1,repeatInterval:1,probability:1,countCurve:constant(1)}]});
    Object.assign(s.ShapeModule,{m_Position:{x:10,y:20,z:30},m_Rotation:{x:0,y:0,z:90},m_Scale:{x:2,y:3,z:0}});
    const frame=[0,2,0,0,-3,0,0,0,0,0,-4,0,100,200,300,1],still={frameAt:()=>({birth:frame,movement:frame})},
      p=createMovingParticles(s).sample(.25,still)[0],bare=structuredClone(s);
    bare.ShapeModule.m_Position={x:0,y:0,z:0};bare.ShapeModule.m_Rotation={x:0,y:0,z:0};bare.moveWithTransform=0;
    const q=createMovingParticles(bare).sample(.25)[0];near(p.origin,[10-q.origin[1],20+q.origin[0],30]);
    near(p.initialVelocity,[-q.initialVelocity[1],q.initialVelocity[0],q.initialVelocity[2]]);
    const v=p.initialVelocity.map(x=>x*.25);
    if(space===0)near(p.displacement,v);
    else{near(p.displacement,[-3*v[1],2*v[0],-4*v[2]]);near(p.worldPosition,[100-3*p.origin[1]+p.displacement[0],200+2*p.origin[0]+p.displacement[1],300-4*p.origin[2]+p.displacement[2]]);}
  }
});

test('unsupported resources, direction/arc modes, degenerate shells and invalid samples remain explicit errors',()=>{
  for(const change of [s=>s.alignToDirection=true,s=>s.randomDirectionAmount=.1,s=>s.sphericalDirectionAmount=.1,
    s=>s.randomPositionAmount=.1,s=>s.m_Texture.m_PathID='1',s=>s.type=16,s=>s.m_Scale.x=Infinity]){
    const s=shape(15);change(s);assert.throws(()=>createParticleSurface(s));
  }
  for(const change of [s=>s.arc.value=180,s=>s.arc.mode=1,s=>s.arc.spread=.1,s=>s.radius.mode=1,
    s=>s.radius.value=-1,s=>s.radiusThickness=-.1,s=>s.radiusThickness=1.1]){
    const s=shape(10);change(s);assert.throws(()=>createParticleSurface(s));
  }
  for(const scale of [{x:0,y:0,z:0},{x:1,y:0,z:0}]){const s=shape(15);s.m_Scale=scale;assert.throws(()=>createParticleSurface(s),/zero-area/);}
  const e=createParticleSurface(shape(15));
  for(const factors of [[NaN,0,0],[0,Infinity,0],[0,0,-.1],[0,0,1.1]])assert.throws(()=>e.sample(...factors));
  const s=shape(10);s.radius.value=Number.MAX_VALUE;s.m_Scale.x=2;assert.throws(()=>createParticleSurface(s).sample(1,0),/precision/);
});
