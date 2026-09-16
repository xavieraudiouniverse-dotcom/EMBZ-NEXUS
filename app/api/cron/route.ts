import {db,check,rpc,env,route,ApiError} from '@/lib/server';
import {executeRun} from '@/lib/agents';
export const maxDuration=300;
export const GET=route(async req=>{if(req.headers.get('authorization')!==`Bearer ${env('CRON_SECRET')}`)throw new ApiError('Not authorised',401);
 const stale=check(await db().from('runs').select('id').eq('status','running').lt('started_at',new Date(Date.now()-600000).toISOString()));for(const r of stale)await rpc('finish_run',{p_id:r.id,p_status:'failed',p_units:0,p_output:'The worker was interrupted. Reservation returned; start a new task to continue.',p_proposals:{},p_trace:[]});
 const due=check(await db().from('automations').select('*').eq('enabled',true).lte('next_run',new Date().toISOString()).limit(25));
 for(const task of due){
  const next=new Date(Date.now()+(task.cadence==='daily'?86400000:604800000)).toISOString();
  const claimed=check(await db().from('automations').update({next_run:next}).eq('id',task.id).eq('next_run',task.next_run).select('id'));
  if(!claimed.length)continue;
  try{const a=await rpc('ensure_account',{p_user:task.owner_id});if(a.tier==='basic')throw new Error('Paused: paid membership required.');await rpc('reserve_run',{p_user:task.owner_id,p_id:crypto.randomUUID(),p_project:task.project_id,p_agent:task.agent,p_prompt:task.prompt,p_units:task.cap_units});check(await db().from('automations').update({last_result:'Task queued'}).eq('id',task.id));}catch(e){check(await db().from('automations').update({last_result:(e as Error).message.slice(0,300)}).eq('id',task.id));}
 }
 const queue=check(await db().from('runs').select('id').eq('status','queued').order('created_at').limit(1));for(const r of queue)await executeRun(r.id);
 return {processed:queue.length,recovered:stale.length};
});
