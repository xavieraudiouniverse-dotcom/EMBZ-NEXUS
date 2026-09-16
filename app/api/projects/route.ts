import {account,body,rpc,route,ApiError} from '@/lib/server';
import {validateFiles} from '@/lib/plans';
export const POST=route(async req=>{const a=await account(req),b=await body(req);if(typeof b.name!=='string'||!b.name.trim()||b.name.length>80)throw new ApiError('Enter a project name, up to 80 characters.');let files;try{files=validateFiles(b.files||{})}catch(e){throw new ApiError((e as Error).message)}return rpc('create_project',{p_user:a.id,p_name:b.name.trim(),p_description:String(b.description||'').slice(0,1000),p_files:files});});
