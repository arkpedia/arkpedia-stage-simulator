// SPDX-License-Identifier: GPL-3.0-or-later
// MarkCurrentHpRatio/HpRatioTrigger: persistent stage count, one admission even
// across multiple crossed thresholds. Ratio epsilon regularizes float boundaries.
const EPS=1e-9;
export function hpLossStages(initialRatio,stepRatio){
 if(!Number.isFinite(initialRatio)||initialRatio<=0||initialRatio>1||!Number.isFinite(stepRatio)||stepRatio<=0||stepRatio>1)
  throw Error('Positive initial and step HP ratios required');
 let next=1;
 return Object.freeze({
  get nextStage(){return next;},initialRatio,stepRatio,
  consume(currentRatio){
   if(!Number.isFinite(currentRatio)||currentRatio<=0)return null;
   const loss=initialRatio-currentRatio;
   if(loss<=stepRatio*next+EPS)return null;
   const stage=next;next=Math.floor((loss+EPS)/stepRatio+1);
   return Object.freeze({stage,nextStage:next,lostRatio:loss});
  },
 });
}
