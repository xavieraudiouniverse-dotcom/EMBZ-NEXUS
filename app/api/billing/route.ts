import {account,body,route,db,check,ApiError,env,rpc} from '@/lib/server';
import {stripe,priceId} from '@/lib/billing';
import {TOPUPS} from '@/lib/plans';
export const POST=route(async req=>{const a=await account(req),b=await body(req);if(process.env.BILLING_ENABLED!=='true')throw new ApiError('Billing is not connected yet. No payment has been taken.',503);if(a.workspace_id)throw new ApiError('Your workspace owner manages the membership.',403);const s=stripe(),app=env('NEXT_PUBLIC_APP_URL');const stored=check(await db().from('accounts').select('*').eq('id',a.id).single());let customer=stored.customer_id;
 if(!customer){const c=await s.customers.create({email:a.email,metadata:{account_id:a.id}},{idempotencyKey:'customer-'+a.id});customer=c.id;check(await db().from('accounts').update({customer_id:customer}).eq('id',a.id));}
 if(b.action==='portal'){const portal=await s.billingPortal.sessions.create({customer,return_url:app+'/#billing'});return {url:portal.url};}
 if(b.action==='topup'){const top=TOPUPS.find(x=>x.credits===b.credits);if(!top)throw new ApiError('Choose a credit pack.');const session=await s.checkout.sessions.create({mode:'payment',customer,client_reference_id:a.id,line_items:[{price:env('STRIPE_TOPUP_'+top.credits),quantity:1}],success_url:app+'/?checkout=success#billing',cancel_url:app+'/#billing'});return {url:session.url};}
 if(!['pro','executive'].includes(b.tier)||!['trial','month','six','year','three','ten'].includes(b.term))throw new ApiError('Choose an available membership. Lifetime is not on sale.');
 if(stored.subscription_id){const existing=await s.subscriptions.retrieve(stored.subscription_id);if(!['canceled','incomplete_expired'].includes(existing.status))throw new ApiError('Manage your existing subscription before starting another.');}
 if(a.tier!=='basic'&&a.role!=='owner')throw new ApiError('Your paid access is still active. Manage it in Billing.');
 if(b.term==='trial'&&(b.tier!=='pro'||a.trial_used))throw new ApiError('The Pro trial is available once per account.');
 const lease=crypto.randomUUID();await rpc('claim_checkout',{p_user:a.id,p_lease:lease});
 try {
 const existingSubs=await s.subscriptions.list({customer,status:'all',limit:100});
 if(existingSubs.data.some(x=>!['canceled','incomplete_expired'].includes(x.status)))throw new ApiError('A subscription already exists. Use Manage subscription.');
 // Reuse any open membership checkout; changing terms explicitly expires the old checkout.
 const sessions=await s.checkout.sessions.list({customer,status:'open',limit:100});for(const pending of sessions.data)if(pending.metadata?.kind==='membership')await s.checkout.sessions.expire(pending.id);
 const session=await s.checkout.sessions.create({mode:b.term==='ten'?'payment':'subscription',customer,client_reference_id:a.id,metadata:{kind:'membership'},line_items:[{price:priceId(b.tier,b.term),quantity:1}],payment_method_collection:'always',success_url:app+'/?checkout=success#billing',cancel_url:app+'/#billing',...(b.term==='trial'?{subscription_data:{trial_period_days:7,metadata:{account_id:a.id}}}:b.term!=='ten'?{subscription_data:{metadata:{account_id:a.id}}}:{})});return {url:session.url};
 } finally {await rpc('release_checkout',{p_user:a.id,p_lease:lease});}
});
