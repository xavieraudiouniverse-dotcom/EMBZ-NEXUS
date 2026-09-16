import Stripe from 'stripe';
if(!process.env.STRIPE_SECRET_KEY)throw new Error('Set STRIPE_SECRET_KEY in the shell. Start with a Stripe test-mode key.');
const s=new Stripe(process.env.STRIPE_SECRET_KEY);
const tiers={pro:{month:4300,six:24510,year:46440,three:131580,ten:412800},executive:{month:9999,six:56994,year:107989,three:305969,ten:959904}};
for(const [tier,prices]of Object.entries(tiers)){
 const product=await s.products.create({name:`EMBZ NEXUS ${tier}`,metadata:{nexus_tier:tier}},{idempotencyKey:`nexus-product-${tier}-v1`});
 for(const [term,cents]of Object.entries(prices)){
 const lookup=`nexus_${tier}_${term}_v1`;const found=await s.prices.list({lookup_keys:[lookup],limit:1});let p=found.data[0];
 if(!p)p=await s.prices.create({product:product.id,unit_amount:cents,currency:'aud',tax_behavior:'inclusive',lookup_key:lookup,...(term==='ten'?{}:{recurring:{interval:'month',interval_count:{month:1,six:6,year:12,three:36}[term]}})},{idempotencyKey:lookup});
 console.log(`STRIPE_PRICE_${tier.toUpperCase()}_${term.toUpperCase()}=${p.id}`);
 }
}
for(const [credits,cents]of [[100,800],[300,2100],[1000,6500]]){
 const lookup=`nexus_topup_${credits}_v1`;let p=(await s.prices.list({lookup_keys:[lookup],limit:1})).data[0];if(!p){const product=await s.products.create({name:`NEXUS ${credits} credits`},{idempotencyKey:lookup+'-product'});p=await s.prices.create({product:product.id,unit_amount:cents,currency:'aud',tax_behavior:'inclusive',lookup_key:lookup},{idempotencyKey:lookup});}console.log(`STRIPE_TOPUP_${credits}=${p.id}`);
}
console.log('Configure the Stripe customer portal: payment methods, invoices and cancellation only. Disable plan switching until proration is implemented. Enable trial reminder emails.');
