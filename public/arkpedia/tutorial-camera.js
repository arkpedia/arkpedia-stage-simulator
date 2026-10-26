// SPDX-License-Identifier: GPL-3.0-or-later
// Internal presentation mapping: MID retains the fitted board scale, focuses
// the source tile coordinates and interpolates linearly in presentation time.
// The closed client's zoom, easing and frame timing remain unproved.
export class TutorialCamera {
 constructor(base){this.base=base.clone();this.projection=base.clone();this.focus=null;this.pending=null;}
 rebase(base){this.base.copy(base);this.apply();}
 apply(){
  const p=this.pending,from=p?.from??this.focus,to=p?.to??this.focus,t=p?Math.min(1,p.elapsed/p.duration):1;
  const point=f=>f??{x:this.base.tx,y:this.base.ty},a=point(from),z=point(to);
  this.projection.copy(this.base);this.projection.tx=a.x+(z.x-a.x)*t;this.projection.ty=a.y+(z.y-a.y)*t;this.projection.update();
 }
 present(instruction,{signal}={}){
  if(this.pending)throw Error('A tutorial camera transition is already pending');
  let to,duration;
  if(instruction?.kind==='cameraReset'){to=null;duration=0;}
  else if(instruction?.kind==='cameraFocus'&&instruction.scale==='MID'&&[instruction.duration,instruction.offsetX,instruction.offsetY].every(Number.isFinite)&&instruction.duration>=0){to={x:instruction.offsetX,y:instruction.offsetY};duration=instruction.duration;}
  else throw Error('Unsupported source tutorial camera instruction');
  if(signal?.aborted)return Promise.reject(new DOMException('Tutorial camera cancelled','AbortError'));
  if(!duration){this.focus=to;this.apply();return Promise.resolve();}
  return new Promise((resolve,reject)=>{
   const pending={from:this.focus,to,duration,elapsed:0,resolve,reject,signal};
   pending.abort=()=>{if(this.pending!==pending)return;this.pending=null;signal?.removeEventListener('abort',pending.abort);this.focus=null;this.apply();reject(new DOMException('Tutorial camera cancelled','AbortError'));};
   this.pending=pending;signal?.addEventListener('abort',pending.abort,{once:true});this.apply();
  });
 }
 advance(seconds){
  const p=this.pending;if(!p||!Number.isFinite(seconds)||seconds<=0)return false;
  p.elapsed=Math.min(p.duration,p.elapsed+seconds);this.apply();
  if(p.elapsed>=p.duration-1e-9){this.focus=p.to;this.pending=null;p.signal?.removeEventListener('abort',p.abort);this.apply();p.resolve();}
  return true;
 }
 cancel(){if(this.pending)this.pending.abort();else{this.focus=null;this.apply();}}
}
