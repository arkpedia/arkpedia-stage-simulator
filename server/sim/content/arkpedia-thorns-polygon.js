// SPDX-License-Identifier: GPL-3.0-or-later
import {hitRect} from '../body.js';

// Original polygon collider records (-6779247284765065877); published behavior
// confirms convexification, line width and parallel edge offsets. Endpoint caps
// and floating-point tolerances are explicit local mappings, not Unity parity.
export const THORNS_POLYGON_CONTRACT=Object.freeze({
  scope:'Thorns S3 geometry foundation; does not enable the public operator',
  polygon:'Convex hull of up to four distinct anchors; interior/collinear anchors discarded; each polygon edge translated outward by the native collider offset',
  line:'Two extreme collinear anchors form a strip twice the native line half-width; flat endpoint caps are a local mapping',
  point:'A single distinct anchor stays a point, without invented splash radius',
  body:'Exact point or axis-aligned hit-area intersection; boundary contact included with 1e-9 tolerance',
  limits:'Native anchor sampling, cast/arrival clocks, original effects and compiled collider parity remain unverified',
  frameParity:false,
});
const EPS=1e-9;
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const same=(a,b)=>Math.abs(a.x-b.x)<=EPS&&Math.abs(a.y-b.y)<=EPS;
const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
function hull(points){
  const sorted=points.slice().sort((a,b)=>a.x-b.x||a.y-b.y),unique=[];
  for(const p of sorted)if(!unique.length||!same(unique.at(-1),p))unique.push({x:p.x,y:p.y});
  if(unique.length<=1)return unique;
  const lower=[],upper=[];
  for(const p of unique){while(lower.length>=2&&cross(lower.at(-2),lower.at(-1),p)<=EPS)lower.pop();lower.push(p);}
  for(const p of unique.slice().reverse()){while(upper.length>=2&&cross(upper.at(-2),upper.at(-1),p)<=EPS)upper.pop();upper.push(p);}
  return lower.slice(0,-1).concat(upper.slice(0,-1));
}
function expand(vertices,offset){
  const lines=vertices.map((a,i)=>{
    const b=vertices[(i+1)%vertices.length],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
    return {x:a.x+dy/length*offset,y:a.y-dx/length*offset,dx,dy};
  });
  return lines.map((b,i)=>{
    const a=lines[(i+lines.length-1)%lines.length],det=a.dx*b.dy-a.dy*b.dx;
    const t=((b.x-a.x)*b.dy-(b.y-a.y)*b.dx)/det;
    return {x:a.x+t*a.dx,y:a.y+t*a.dy};
  });
}
function bounds(vertices){return {x0:Math.min(...vertices.map(p=>p.x)),x1:Math.max(...vertices.map(p=>p.x)),
  y0:Math.min(...vertices.map(p=>p.y)),y1:Math.max(...vertices.map(p=>p.y))};}
export function thornsPolygon(points,{offset=.32499998807907104,lineHalfWidth=.32499998807907104}={}){
  if(!Array.isArray(points)||points.length<1||points.length>4||!points.every(finite)
    ||!Number.isFinite(offset)||offset<0||!Number.isFinite(lineHalfWidth)||lineHalfWidth<0)
    throw Error('Invalid Thorns polygon anchors or collider widths');
  const anchors=hull(points);let kind,vertices;
  if(anchors.length===1){kind='point';vertices=anchors;}
  else if(anchors.length===2){
    kind='line';const [a,b]=anchors,dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),nx=-dy/len*lineHalfWidth,ny=dx/len*lineHalfWidth;
    if(lineHalfWidth===0)vertices=anchors;
    else vertices=[{x:a.x-nx,y:a.y-ny},{x:b.x-nx,y:b.y-ny},{x:b.x+nx,y:b.y+ny},{x:a.x+nx,y:a.y+ny}];
  }else{kind='polygon';vertices=expand(anchors,offset);}
  return {kind,anchors,vertices,bounds:bounds(vertices),offset,lineHalfWidth};
}
function pointInside(vertices,p){
  if(vertices.length===1)return same(vertices[0],p);
  if(vertices.length===2){const [a,b]=vertices;return Math.abs(cross(a,b,p))<=EPS
    &&p.x>=Math.min(a.x,b.x)-EPS&&p.x<=Math.max(a.x,b.x)+EPS&&p.y>=Math.min(a.y,b.y)-EPS&&p.y<=Math.max(a.y,b.y)+EPS;}
  return vertices.every((a,i)=>cross(a,vertices[(i+1)%vertices.length],p)>=-EPS);
}
function overlapOn(axis,a,b){
  const pa=a.map(p=>p.x*axis.x+p.y*axis.y),pb=b.map(p=>p.x*axis.x+p.y*axis.y);
  return Math.min(...pa)<=Math.max(...pb)+EPS&&Math.min(...pb)<=Math.max(...pa)+EPS;
}
export function thornsPolygonContains(region,unit){
  if(!region||!finite(unit))return false;
  const rect=hitRect(unit),v=region.vertices;
  if(!rect)return pointInside(v,unit);
  if(v.length===1)return v[0].x>=rect.x0-EPS&&v[0].x<=rect.x1+EPS&&v[0].y>=rect.y0-EPS&&v[0].y<=rect.y1+EPS;
  const box=[{x:rect.x0,y:rect.y0},{x:rect.x1,y:rect.y0},{x:rect.x1,y:rect.y1},{x:rect.x0,y:rect.y1}];
  const axes=[{x:1,y:0},{x:0,y:1}];
  for(let i=0;i<v.length;i++){const a=v[i],b=v[(i+1)%v.length],len=Math.hypot(b.x-a.x,b.y-a.y);if(len>EPS)axes.push({x:-(b.y-a.y)/len,y:(b.x-a.x)/len});}
  return axes.every(axis=>overlapOn(axis,v,box));
}
