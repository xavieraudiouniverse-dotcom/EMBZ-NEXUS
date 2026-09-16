import {stripe,processStripeEvent} from '@/lib/billing';
import {db,env} from '@/lib/server';
export async function POST(req:Request){let event;try{event=stripe().webhooks.constructEvent(await req.text(),req.headers.get('stripe-signature')||'',env('STRIPE_WEBHOOK_SECRET'));}catch{return Response.json({error:'Invalid signature'},{status:400});}
 const existing=await db().from('webhook_events').select('status').eq('id',event.id).maybeSingle();if(existing.data?.status==='processed')return Response.json({received:true});
 const inserted=await db().from('webhook_events').upsert({id:event.id,provider:'stripe',event_type:event.type,payload:event,status:'received'},{onConflict:'id',ignoreDuplicates:true});if(inserted.error)return Response.json({error:'Event storage unavailable'},{status:500});
 try{await processStripeEvent(event);const done=await db().from('webhook_events').update({status:'processed',processed_at:new Date().toISOString(),error:null}).eq('id',event.id);if(done.error)throw done.error;return Response.json({received:true});}catch(e){console.error('Stripe processing failed',e);await db().from('webhook_events').update({status:'failed',error:(e as Error).message.slice(0,500)}).eq('id',event.id);return Response.json({error:'Processing failed; retry this event.'},{status:500});}
}
