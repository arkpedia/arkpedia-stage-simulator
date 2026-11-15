// SPDX-License-Identifier: GPL-3.0-or-later
/** First intersection along a segment with a circle, as a fraction in [0, 1].
 * The swept test prevents fast projectiles skipping recipients between ticks. */
export function segmentCircleEntry(from, to, center, radius) {
  const dx = to.x - from.x, dy = to.y - from.y, x = from.x - center.x, y = from.y - center.y;
  const c = x * x + y * y - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a <= 1e-18) return null;
  const b = x * dx + y * dy, disc = b * b - a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / a;
  return t >= -1e-9 && t <= 1 + 1e-9 ? Math.max(0, Math.min(1, t)) : null;
}

/** First entry into an axis-aligned rectangle; shared by tile interceptors. */
export function segmentRectangleEntry(from,to,{minX,maxX,minY,maxY}) {
  let first=0,last=1;
  for(const [axis,min,max] of [['x',minX,maxX],['y',minY,maxY]]) {
    const delta=to[axis]-from[axis];
    if(Math.abs(delta)<1e-12){if(from[axis]<min||from[axis]>max)return null;continue;}
    const a=(min-from[axis])/delta,b=(max-from[axis])/delta;
    first=Math.max(first,Math.min(a,b));last=Math.min(last,Math.max(a,b));
    if(first>last+1e-9)return null;
  }
  return first>=0&&first<=1?first:null;
}
