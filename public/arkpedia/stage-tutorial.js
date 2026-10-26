// SPDX-License-Identifier: GPL-3.0-or-later
// DOM input/presentation for the owned internal instruction receiver. Camera
// completion comes from its presentation port, never from combat ticks.
export function bindStageTutorial(workspace,battle,{camera,onError=()=>{},onChange=()=>{}}={}){
 const controller=battle.internalStageMechanics?.dialogs;if(!controller)return null;
 if(typeof camera!=='function')throw Error('Source tutorial presentation requires a camera port');
 const doc=workspace.ownerDocument,root=doc.createElement('dialog');root.className='stage-tutorial';root.hidden=true;root.setAttribute('aria-label','Stage dialogue');
 const speaker=doc.createElement('h2'),line=doc.createElement('p'),status=doc.createElement('p'),next=doc.createElement('button');next.type='button';next.textContent='Continue';status.setAttribute('role','status');root.append(speaker,line,status,next);workspace.append(root);
 let stopped=false,receipt=null,abort=null,previousFocus=null,open=false,failed=false;
 const close=()=>{if(!open)return;open=false;root.close();root.hidden=true;const focus=previousFocus;previousFocus=null;if(focus?.isConnected&&!focus.closest('[inert]'))focus.focus({preventScroll:true});};
 const sync=()=>{
  if(stopped)return;
  const state=controller.state();
  if(!state){abort?.abort();abort=null;receipt=null;failed=false;close();return;}
  if(failed)return;
  if(state.receipt===receipt)return;
  abort?.abort();abort=null;receipt=state.receipt;
  if(!open){previousFocus=doc.activeElement;open=true;root.hidden=false;root.showModal();}
  const current=receipt,instruction=state.instruction;next.disabled=true;next.hidden=instruction.kind!=='dialogue';next.onclick=null;next.textContent='Continue';
  speaker.textContent='';line.textContent='';status.textContent='';root.dataset.instruction=instruction.kind;root.dataset.script=state.scriptKey;root.dataset.index=String(state.index);
  if(instruction.kind==='dialogue'){
   speaker.textContent=instruction.name;line.textContent=instruction.text;root.dataset.avatar=instruction.avatarId;next.disabled=false;
   next.onclick=()=>{if(stopped||receipt!==current)return;if(controller.complete(current)){next.disabled=true;onChange();sync();}};next.focus({preventScroll:true});return;
  }
  delete root.dataset.avatar;status.textContent='Scene transition';root.tabIndex=-1;root.focus({preventScroll:true});const operation=new AbortController();abort=operation;
  Promise.resolve().then(()=>{if(stopped||receipt!==current||operation.signal.aborted)return;return camera(instruction,{signal:operation.signal});}).then(()=>{
   if(stopped||receipt!==current||controller.state()?.receipt!==current)return;
   if(controller.complete(current)){onChange();sync();}
  }).catch(error=>{
   if(stopped||receipt!==current||operation.signal.aborted)return;
   failed=true;status.textContent='Scene transition could not finish.';next.hidden=false;next.disabled=false;next.textContent='End simulation';next.onclick=()=>{battle.internalStageMechanics.schedule.stop();failed=false;onChange();sync();};next.focus();onError(error);
  });
 };
 const keydown=event=>{if(event.repeat&&['Enter',' '].includes(event.key))event.preventDefault();if(event.key==='Tab'){event.preventDefault();(next.hidden?root:next).focus();}};
 const cancel=event=>event.preventDefault();root.addEventListener('cancel',cancel);
 root.addEventListener('keydown',keydown);
 return Object.freeze({root,sync,stop(){if(stopped)return;stopped=true;receipt=null;abort?.abort();abort=null;if(!battle.finished)battle.internalStageMechanics.schedule.stop();root.removeEventListener('keydown',keydown);root.removeEventListener('cancel',cancel);close();root.remove();}});
}
