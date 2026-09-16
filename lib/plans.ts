export type Tier = 'basic' | 'pro' | 'executive';
export type Term = 'trial' | 'month' | 'six' | 'year' | 'three' | 'ten' | 'lifetime';
export const TERMS: {id:Term;label:string;months:number;discount:number}[] = [
 {id:'trial',label:'7 days free',months:0,discount:0},{id:'month',label:'Monthly',months:1,discount:0},
 {id:'six',label:'6 months',months:6,discount:5},{id:'year',label:'1 year',months:12,discount:10},
 {id:'three',label:'3 years',months:36,discount:15},{id:'ten',label:'10 years',months:120,discount:20},
 {id:'lifetime',label:'Lifetime',months:0,discount:0}];
export const PLANS = {
 basic:{name:'Basic',monthly:0,credits:10,apps:1,seats:1,concurrency:1,history:7,tagline:'A place to start.',features:['10 credits every week','1 active app','Claude & GPT access','Code editor & live preview','Source export','7-day activity history']},
 pro:{name:'Pro',monthly:4300,credits:550,apps:10,seats:1,concurrency:2,history:90,tagline:'For independent builders.',features:['550 credits every month','10 active apps','Claude & GPT agents','Project versions & restore','Vercel deployments','10 scheduled workflows','90-day activity history']},
 executive:{name:'Executive',monthly:9999,credits:1050,apps:50,seats:5,concurrency:5,history:365,tagline:'More room for ambitious work.',features:['1,050 credits every month','50 active apps','5 workspace members','5 concurrent agent tasks','Shared project access','50 scheduled workflows','365-day activity history']}
} as const;
export const PRICES: Record<Exclude<Tier,'basic'>,Record<Term,number>> = {
 pro:{trial:0,month:4300,six:24510,year:46440,three:131580,ten:412800,lifetime:1299900},
 executive:{trial:0,month:9999,six:56994,year:107989,three:305969,ten:959904,lifetime:2999900}
};
export const TOPUPS = [{credits:100,cents:800},{credits:300,cents:2100},{credits:1000,cents:6500}];
export const money=(cents:number)=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:cents%100?2:0}).format(cents/100);
export const price=(tier:Tier,term:Term)=>tier==='basic'?0:PRICES[tier][term];
export function chargeUnits(costAud:number){if(!Number.isFinite(costAud)||costAud<0)throw new Error('Invalid usage cost');return Math.max(1,Math.ceil(costAud*500-1e-9));}
export function validPath(path:string){return path.length>0&&path.length<160&&!path.startsWith('/')&&!path.split('/').some(p=>p==='..'||p===''||p.startsWith('.env'))&&!/[\\\x00-\x1f]/.test(path);}
export function validateFiles(files:Record<string,string>){const entries=Object.entries(files);if(entries.length>80||entries.some(([p,c])=>!validPath(p)||typeof c!=='string')||new TextEncoder().encode(JSON.stringify(files)).length>500000)throw new Error('Use up to 80 text files, safe relative paths, and 500 KB total.');return files;}
export function previewHTML(files:Record<string,string>){const html=files['index.html']||'<html><body style="font:16px system-ui;padding:32px">Add an index.html file to preview this project.</body></html>';const policy=`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'">`;return policy+html.replace(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/gi,(all,p)=>files[p]?`<style>${files[p].replace(/<\/style/gi,'<\\/style')}</style>`:all).replace(/<script\b[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi,(all,p)=>files[p]?`<script>${files[p].replace(/<\/script/gi,'<\\/script')}</script>`:all);}
