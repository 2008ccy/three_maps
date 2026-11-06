import fs from 'node:fs/promises';
import { createWorkBuddyCloud } from '../website/node_modules/@tencent-ai/workbuddy-cloud-sdk/lib/index.js';
const env={};for(const line of (await fs.readFile(new URL('../website/.env.local',import.meta.url),'utf8')).split('\n')){const m=/^([A-Z0-9_]+)=(.*)$/.exec(line.trim());if(m)env[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
const requests=[];
const cloud=createWorkBuddyCloud({endpoint:env.NEXT_PUBLIC_WORKBUDDY_CLOUD_ENDPOINT,publishableKey:env.NEXT_PUBLIC_WORKBUDDY_CLOUD_KEY,fetch:async(input,init)=>{const method=init?.method??'GET';if(method!=='GET'&&method!=='HEAD')throw Error('Read-only audit refused non-GET method');const t=Date.now();const r=await fetch(input,{...init,signal:AbortSignal.timeout(15000)});requests.push({method,status:r.status,milliseconds:Date.now()-t});return r;}});
const list=await cloud.database.rpc('list_feedback',{p_limit:1},{get:true});
const result={configured:true,transport:'WorkBuddy SDK read-only GET RPC',requests,list:{errorCode:list.error?.code??null,validShape:Array.isArray(list.data?.items),count:Array.isArray(list.data?.items)?list.data.items.length:null,hasNextCursor:!!list.data?.nextCursor}};
if(!list.error&&list.data?.items?.length){const id=list.data.items[0].id;const single=await cloud.database.rpc('get_feedback',{p_id:id},{get:true});result.detail={errorCode:single.error?.code??null,sameId:single.data?.id===id,publicFields:single.data?Object.keys(single.data):[]};}
const direct=await cloud.database.from('feedback').select('id').limit(1);result.directTableRead={errorCode:direct.error?.code??null,denied:!!direct.error};
await fs.writeFile(new URL('./feedback-read-only.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
