import {account,body,route,db,check,rpc,ApiError} from '@/lib/server';
export const PATCH=route(async req=>{const a=await account(req),b=await body(req);
 if(b.action==='invite'){await rpc('add_member',{p_user:a.id,p_email:String(b.email||'').slice(0,254)});return {ok:true};}
 if(b.action==='accept'){await rpc('accept_workspace',{p_user:a.id});return {ok:true};}
 if(b.action==='leave'){check(await db().from('accounts').update({workspace_id:null}).eq('id',a.id));return {ok:true};}
 if(b.action==='remove'){if(a.workspace_id)throw new ApiError('Workspace owner required.',403);check(await db().from('accounts').update({workspace_id:null}).eq('id',b.memberId).eq('workspace_id',a.id));return {ok:true};}
 check(await db().from('accounts').update({display_name:String(b.display_name||'').slice(0,80),settings:{...a.settings,reducedMotion:!!b.reducedMotion,defaultAgent:['gpt','claude','vercel'].includes(b.defaultAgent)?b.defaultAgent:'gpt'}}).eq('id',a.id));return {ok:true};
});
