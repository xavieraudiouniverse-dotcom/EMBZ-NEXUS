import {account,body,rpc,route,project,db,check,ApiError,audit} from '@/lib/server';
import {validateFiles} from '@/lib/plans';
export const GET=route(async(req,ctx)=>{const a=await account(req),{id}=await ctx.params;await project(a,id);return check(await db().from('revisions').select('*').eq('project_id',id).order('version',{ascending:false}).limit(30));});
export const PATCH=route(async(req,ctx)=>{const a=await account(req),{id}=await ctx.params,b=await body(req);const p=await project(a,id);
 if(b.action==='archive'){await rpc('archive_project',{p_user:a.id,p_id:id,p_archived:b.archived!==false});await audit(a.id,'project.archive',{id,archived:b.archived!==false});return {ok:true};}
 if(!Number.isInteger(b.version))throw new ApiError('Project version required.');let files;try{files=validateFiles(b.files)}catch(e){throw new ApiError((e as Error).message)}
 return rpc('save_project',{p_user:a.id,p_id:p.id,p_version:b.version,p_files:files});
});
