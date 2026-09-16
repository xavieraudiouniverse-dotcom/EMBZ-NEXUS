import {account,workspace,db,check,route} from '@/lib/server';
import {PLANS} from '@/lib/plans';
export const GET=route(async req=>{
 const a=await account(req),w=await workspace(a),since=new Date(Date.now()-PLANS[w.tier].history*86400000).toISOString();
 const results=await Promise.all([
 db().from('projects').select('*').eq('owner_id',w.id).order('updated_at',{ascending:false}),
 db().from('runs').select('id,owner_id,project_id,agent,prompt,status,output,proposals,trace,reserved_units,charged_units,created_at,base_version,cancel_requested').eq('owner_id',w.id).gte('created_at',since).order('created_at',{ascending:false}).limit(100),
 db().from('credit_ledger').select('*').eq('owner_id',w.id).gte('created_at',since).order('created_at',{ascending:false}).limit(100),
 db().from('integrations').select('owner_id').eq('owner_id',w.id).maybeSingle(),
 db().from('accounts').select('id,email,display_name').eq('workspace_id',w.id),
 a.role==='owner'?db().from('webhook_events').select('id,provider,event_type,status,created_at').order('created_at',{ascending:false}).limit(100):Promise.resolve({data:[],error:null})
 ]);
 const [projects,runs,ledger,integration,members,events]=results.map(r=>check(r as any));
 return {account:{...w,id:a.id,email:a.email,role:a.role,display_name:a.display_name,workspace_id:a.workspace_id,settings:a.settings,subscription_id:w.subscription_id?'connected':null,customer_id:undefined},projects,runs,ledger,members,events,connections:{database:true,claude:!!(process.env.ANTHROPIC_API_KEY&&process.env.ANTHROPIC_MODEL&&process.env.ANTHROPIC_INPUT_USD_PER_M&&process.env.ANTHROPIC_OUTPUT_USD_PER_M&&process.env.USD_TO_AUD&&process.env.EXECUTION_AUD_PER_SECOND),gpt:!!(process.env.OPENAI_API_KEY&&process.env.OPENAI_MODEL&&process.env.OPENAI_INPUT_USD_PER_M&&process.env.OPENAI_OUTPUT_USD_PER_M&&process.env.USD_TO_AUD&&process.env.EXECUTION_AUD_PER_SECOND),vercel:!!integration,billing:process.env.BILLING_ENABLED==='true'}};
});
