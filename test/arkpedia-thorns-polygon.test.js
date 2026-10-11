// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import evidence from '../data/arkpedia-thorns-lodestar-prefabs.json' with {type:'json'};
import {THORNS_POLYGON_CONTRACT,thornsPolygon,thornsPolygonContains as contains} from '../server/sim/content/arkpedia-thorns-polygon.js';
const p=(x,y)=>({x,y}),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const native=evidence.projectiles.projectile_chr_thorn2_s3_polygon.flatMap(r=>r.components).find(c=>c.pathId==='-6779247284765065877').data;
const options={offset:native._polygonColliderOffset,lineHalfWidth:native._polygonLineColliderWide};
test('S3 polygon uses the independently preserved native collider widths; public execution remains held',()=>{
  assert.equal(options.offset,.32499998807907104);assert.equal(options.lineHalfWidth,.32499998807907104);assert.equal(THORNS_POLYGON_CONTRACT.frameParity,false);
  const r=thornsPolygon([p(0,0),p(2,0),p(2,2),p(0,2)],options);near(r.bounds.x0,-options.offset);near(r.bounds.y1,2+options.offset);
  assert.deepEqual(evidence.enabledOperators,[]);
});
test('single/duplicate anchors stay one point instead of becoming an area attack',()=>{
  const r=thornsPolygon([p(4,5),p(4,5),p(4,5)]);assert.equal(r.kind,'point');assert.equal(r.anchors.length,1);
  assert.equal(contains(r,p(4,5)),true);assert.equal(contains(r,p(4.01,5)),false);
  assert.equal(contains(r,{x:5,y:5,hitArea:{w:2,h:1,dx:0,dy:0}}),true);
});
for(const [name,points,inside,outside]of [
  ['horizontal',[p(0,0),p(1,0),p(4,0)],p(2,.324),p(2,.326)],
  ['vertical',[p(0,0),p(0,3),p(0,4)],p(-.324,2),p(-.326,2)],
  ['diagonal',[p(0,0),p(2,2),p(4,4)],p(2.2,1.8),p(2.24,1.76)],
])test(`collinear ${name} anchors discard middle points and form the native-width strip`,()=>{
  const r=thornsPolygon(points,options);assert.equal(r.kind,'line');assert.equal(r.anchors.length,2);
  assert.equal(contains(r,inside),true);assert.equal(contains(r,outside),false);
  const [a,b]=r.anchors,dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
  assert.equal(contains(r,p(a.x-dx/len*.01,a.y-dy/len*.01)),false);assert.equal(contains(r,a),true);assert.equal(contains(r,b),true);
});
test('triangle expansion translates its slanted edge, rather than substituting a bounding box or circle',()=>{
  const r=thornsPolygon([p(0,0),p(4,0),p(0,4)],options);
  const edge=4+options.offset*Math.SQRT2;near(r.vertices[1].x,edge+options.offset);near(r.vertices[2].y,edge+options.offset);
  assert.equal(contains(r,p(2,2.45)),true);assert.equal(contains(r,p(2,2.47)),false);
  assert.equal(contains(r,p(3.5,3.5)),false);assert.equal(contains(r,p(-.32,-.32)),true);
});
test('concave four-anchor input drops the interior anchor and keeps the maximum-area triangle',()=>{
  const r=thornsPolygon([p(0,0),p(4,0),p(0,4),p(1,1)],options);
  assert.equal(r.anchors.length,3);assert.deepEqual(r.anchors,[p(0,0),p(4,0),p(0,4)]);
  assert.equal(contains(r,p(2,1)),true);assert.equal(contains(r,p(3,3)),false);
});
test('crossed input order becomes a convex quadrilateral without excluding its center',()=>{
  const r=thornsPolygon([p(0,0),p(4,4),p(0,4),p(4,0)],options);
  assert.equal(r.anchors.length,4);assert.equal(contains(r,p(2,2)),true);assert.equal(contains(r,p(4.32,4.32)),true);
  assert.equal(contains(r,p(4.34,2)),false);
});
test('offset corners use intersecting parallel edge lines, including acute corner miters',()=>{
  const r=thornsPolygon([p(0,0),p(8,0),p(1,1)],options);assert.ok(r.bounds.x1>8.325);
  for(let i=0;i<r.anchors.length;i++){
    const a=r.anchors[i],b=r.anchors[(i+1)%r.anchors.length],v=r.vertices[i];
    const distance=((b.x-a.x)*(v.y-a.y)-(b.y-a.y)*(v.x-a.x))/Math.hypot(b.x-a.x,b.y-a.y);near(distance,-options.offset);
  }
});
test('large bodies intersect the actual expanded polygon even when their root is outside',()=>{
  const r=thornsPolygon([p(0,0),p(4,0),p(0,4)],options);
  const u={x:3,y:3,hitArea:{w:2,h:2,dx:0,dy:0}};assert.equal(contains(r,p(3,3)),false);assert.equal(contains(r,u),true);
  assert.equal(contains(r,{...u,x:4,y:4}),false);
  assert.equal(contains(r,{x:6,y:1,hitArea:{w:1,h:1,dx:-3,dy:0}}),true);
});
test('rectangle/strip separation checks the strip normal as well as world-axis bounds',()=>{
  const r=thornsPolygon([p(0,0),p(4,4)],options);
  assert.equal(contains(r,{x:2,y:2.6,hitArea:{w:.1,h:.1,dx:0,dy:0}}),false);
  assert.equal(contains(r,{x:2,y:2.4,hitArea:{w:.1,h:.1,dx:0,dy:0}}),true);
});
for(let quarter=0;quarter<4;quarter++)test(`quarter rotation ${quarter} and translation preserve point and body results`,()=>{
  const rotate=v=>{let {x,y}=v;for(let i=0;i<quarter;i++)[x,y]=[-y,x];return p(x+8,y-2);};
  const points=[p(0,0),p(4,0),p(4,4),p(0,4)],r=thornsPolygon(points,options),z=thornsPolygon(points.map(rotate),options);
  for(const pt of [p(0,0),p(2,2),p(4.32,4.32),p(4.5,2),p(-.5,2)])assert.equal(contains(r,pt),contains(z,rotate(pt)));
  for(const pt of [p(4.8,2),p(4.4,4.4),p(5,5)]){
    const area={w:.8,h:.4,dx:.1,dy:-.1},o={...pt,hitArea:area},center=rotate(p(pt.x+area.dx,pt.y+area.dy));
    assert.equal(contains(r,o),contains(z,{...center,hitArea:{w:quarter%2?area.h:area.w,h:quarter%2?area.w:area.h,dx:0,dy:0}}));
  }
});
test('zero offset and width retain true polygon/line geometry without singular output',()=>{
  const r=thornsPolygon([p(0,0),p(2,0),p(0,2)],{offset:0,lineHalfWidth:0});assert.equal(contains(r,p(-.01,0)),false);
  const z=thornsPolygon([p(0,0),p(2,0)],{offset:0,lineHalfWidth:0});assert.equal(contains(z,p(1,0)),true);assert.equal(contains(z,p(1,.01)),false);
  assert.equal(contains(z,{x:1,y:.02,hitArea:{w:1,h:.01,dx:0,dy:0}}),false);
});
test('invalid anchors and widths fail before producing collider geometry',()=>{
  for(const pts of [[],[p(NaN,0)],[p(0,Infinity)],Array.from({length:5},(_,i)=>p(i,i)),null])assert.throws(()=>thornsPolygon(pts));
  for(const o of [{offset:-1},{lineHalfWidth:-1},{offset:Infinity},{lineHalfWidth:NaN}])assert.throws(()=>thornsPolygon([p(0,0)],o));
  assert.equal(contains(null,p(0,0)),false);assert.equal(contains(thornsPolygon([p(0,0)]),p(NaN,0)),false);
});
