import {createHmac,timingSafeEqual} from 'node:crypto';
import {db,env} from '@/lib/server';
export async function POST(req:Request){const raw=await req.text();if(raw.length>1000000)return new Response('Too large',{status:413});const sig=req.headers.get('x-vercel-signature')||'';const expected=createHmac('sha1',env('VERCEL_WEBHOOK_SECRET')).update(raw).digest('hex');if(!/^[a-f0-9]{40}$/i.test(sig)||!timingSafeEqual(Buffer.from(sig,'hex'),Buffer.from(expected,'hex')))return new Response('Invalid signature',{status:400});let event;try{event=JSON.parse(raw)}catch{return new Response('Invalid JSON',{status:400});}if(!event.id||!event.type)return new Response('Missing event data',{status:400});
 const key='vercel:'+event.id;const existing=await db().from('webhook_events').select('status').eq('id',key).maybeSingle();if(existing.data?.status==='processed')return Response.json({received:true});
 const saved=await db().from('webhook_events').upsert({id:key,provider:'vercel',event_type:event.type,payload:event,status:'received'},{onConflict:'id',ignoreDuplicates:true});if(saved.error)return new Response('Storage failed',{status:500});
 const did=event.payload?.deployment?.id;const status=event.type==='deployment.succeeded'?'READY':event.type==='deployment.error'?'ERROR':null;
 if(did&&status){const result=await db().from('deployments').update({status}).eq('id',did);if(result.error)return new Response('Retry required',{status:500});}
 await db().from('webhook_events').update({status:'processed',processed_at:new Date().toISOString()}).eq('id',key);return Response.json({received:true});
}
