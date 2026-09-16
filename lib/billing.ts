import Stripe from 'stripe';
import {env,db,check,rpc,ApiError} from './server';
import {PRICES,TOPUPS,type Tier,type Term} from './plans';
export const stripe=()=>new Stripe(env('STRIPE_SECRET_KEY'));
export function priceId(tier:Exclude<Tier,'basic'>,term:Term){return env(`STRIPE_PRICE_${tier.toUpperCase()}_${(term==='trial'?'month':term).toUpperCase()}`);}
export function identifyPrice(id:string){for(const tier of ['pro','executive'] as const)for(const term of ['month','six','year','three','ten'] as const)if(process.env[`STRIPE_PRICE_${tier.toUpperCase()}_${term.toUpperCase()}`]===id)return {tier,term,cents:PRICES[tier][term]};return null;}
export function addMonths(date:Date,months:number){const d=new Date(date),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+months);const end=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,end));return d;}
export async function processStripeEvent(event:any){
 const s=stripe(),object=event.data.object;
 if(event.type==='checkout.session.completed'||event.type==='checkout.session.async_payment_succeeded'){
  const session:any=await s.checkout.sessions.retrieve(object.id,{expand:['line_items']});const user=session.client_reference_id;if(!user)throw new Error('Missing account reference');
  const a=check(await db().from('accounts').select('*').eq('id',user).single());if(a.customer_id!==session.customer)throw new Error('Customer mismatch');
  if(session.mode==='payment'&&session.payment_status==='paid'){
   const lines=session.line_items?.data||[];if(lines.length!==1||lines[0].quantity!==1)throw new Error('Invalid checkout line items');const line=lines[0];
   const top=TOPUPS.find(x=>process.env[`STRIPE_TOPUP_${x.credits}`]===line.price.id);
   if(top){if(session.currency!=='aud'||session.amount_total!==top.cents)throw new Error('Unexpected top-up amount');await rpc('apply_payment',{p_receipt:session.id,p_user:user,p_kind:'topup',p_tier:'basic',p_start:null,p_end:null,p_units:top.credits*10,p_subscription:null});}
   else {const plan=identifyPrice(line.price.id);if(!plan||plan.term!=='ten'||session.amount_total!==plan.cents||session.currency!=='aud')throw new Error('Unexpected prepaid plan');const start=new Date(session.created*1000);await rpc('apply_payment',{p_receipt:session.id,p_user:user,p_kind:'prepaid',p_tier:plan.tier,p_start:start.toISOString(),p_end:addMonths(start,120).toISOString(),p_units:plan.tier==='pro'?5500:10500,p_subscription:null});}
  }
  if(session.mode==='subscription'&&session.subscription){const sub:any=await s.subscriptions.retrieve(String(session.subscription));if(sub.status==='trialing'){const plan=identifyPrice(sub.items.data[0].price.id);if(!plan||plan.tier!=='pro')throw new Error('Invalid trial plan');await rpc('apply_payment',{p_receipt:'trial:'+sub.id,p_user:user,p_kind:'trial',p_tier:'pro',p_start:new Date(sub.trial_start*1000).toISOString(),p_end:new Date(sub.trial_end*1000).toISOString(),p_units:1000,p_subscription:sub.id});}}
 }
 if(event.type==='invoice.paid'){
  const invoice:any=await s.invoices.retrieve(object.id);if(invoice.amount_paid===0)return;const sid=invoice.parent?.subscription_details?.subscription||invoice.subscription;if(!sid)return;
  const sub:any=await s.subscriptions.retrieve(typeof sid==='string'?sid:sid.id);if(sub.status==='trialing')return;
  const a=check(await db().from('accounts').select('*').eq('customer_id',String(sub.customer)).single());const item=sub.items.data[0],plan=identifyPrice(item.price.id);if(!plan||plan.term==='ten')throw new Error('Unknown subscription price');
  // Use the paid invoice's period, not a newer unpaid subscription period.
  const line=invoice.lines.data.find((l:any)=>l.pricing?.price_details?.price===item.price.id||l.price?.id===item.price.id);if(!line)throw new Error('Invoice plan line missing');
  if(invoice.currency!=='aud'||invoice.status!=='paid'||invoice.amount_paid!==plan.cents)throw new Error('Unexpected paid invoice amount');
  await rpc('apply_payment',{p_receipt:invoice.id,p_user:a.id,p_kind:'subscription',p_tier:plan.tier,p_start:new Date(line.period.start*1000).toISOString(),p_end:new Date(line.period.end*1000).toISOString(),p_units:plan.tier==='pro'?5500:10500,p_subscription:sub.id});
 }
 if(event.type==='customer.subscription.updated'||event.type==='customer.subscription.deleted'){
  const sub:any=await s.subscriptions.retrieve(object.id);const a=check(await db().from('accounts').select('*').eq('subscription_id',sub.id).maybeSingle());if(!a)return;
  check(await db().from('accounts').update({billing_status:sub.status,cancel_at_period_end:sub.cancel_at_period_end}).eq('id',a.id));
  // Paid access expires using the last verified invoice; cancellation never erases prepaid time.
 }
 if(event.type==='invoice.payment_failed'){
  const a=check(await db().from('accounts').select('id').eq('customer_id',String(object.customer)).maybeSingle());if(a)check(await db().from('accounts').update({billing_status:'past_due'}).eq('id',a.id));
 }
}
