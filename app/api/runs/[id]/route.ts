import {account,workspace,body,route,db,check,ApiError,rpc} from '@/lib/server';
import {executeRun} from '@/lib/agents';
export const maxDuration=300;
export const POST=route(async(req,ctx)=>{const a=await account(req),w=await workspace(a),{id}=await ctx.params,b=await body(req);const run=check(await db().from('runs').select('*').eq('id',id).eq('owner_id',w.id).single());if(!run)throw new ApiError('Task not found.',404);
 if(b.action==='cancel'){check(await db().from('runs').update({cancel_requested:true}).eq('id',id));if(run.status==='queued')await rpc('finish_run',{p_id:id,p_status:'cancelled',p_units:0,p_output:'Cancelled before execution.',p_proposals:{},p_trace:[]});return {ok:true};}
 await executeRun(id);return {ok:true};
});
