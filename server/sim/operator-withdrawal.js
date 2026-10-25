// SPDX-License-Identifier: GPL-3.0-or-later
// One captured payment per ordinary-stage Unit; card deployments create new Units.
const payments=new WeakMap();
export function recordOperatorPayment(battle,unit,{paid,baseCost,refundRatio}){
 if(payments.has(unit)||![paid,baseCost,refundRatio].every(Number.isFinite)||paid<0||baseCost<0||![0,.5,1].includes(refundRatio))throw Error('Invalid ordinary operator withdrawal payment');
 payments.set(unit,{battle,paid,baseCost,refundRatio,claimed:false});
}
export function claimOperatorRefund(battle,unit){
 const payment=payments.get(unit);
 if(!payment||payment.battle!==battle||payment.claimed)return 0;
 payment.claimed=true;
 return Math.floor(Math.min(payment.paid*payment.refundRatio,payment.baseCost));
}
