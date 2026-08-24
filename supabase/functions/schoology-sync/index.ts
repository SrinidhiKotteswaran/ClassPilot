import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}})}

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 const auth=req.headers.get("Authorization"); if(!auth?.startsWith("Bearer "))return json({error:"Missing authorization"},401);
 const supabaseUrl=Deno.env.get("SUPABASE_URL")!; const serviceRole=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const admin=createClient(supabaseUrl,serviceRole); const token=auth.replace("Bearer ","");
 const userClient=createClient(supabaseUrl,Deno.env.get("SUPABASE_ANON_KEY")??"",{global:{headers:{Authorization:auth}}});
 const {data:userData,error:userError}=await userClient.auth.getUser(token); if(userError||!userData.user)return json({error:"Invalid session"},401);
 const userId=userData.user.id;
 const {error:connError}=await admin.from("school_connections").select("*").eq("user_id",userId).maybeSingle(); if(connError)return json({error:connError.message},500);
 const consumerKey=Deno.env.get("SCHOOLOGY_CONSUMER_KEY"), consumerSecret=Deno.env.get("SCHOOLOGY_CONSUMER_SECRET"), accessToken=Deno.env.get("SCHOOLOGY_ACCESS_TOKEN"), accessTokenSecret=Deno.env.get("SCHOOLOGY_ACCESS_TOKEN_SECRET");
 if(!consumerKey||!consumerSecret||!accessToken||!accessTokenSecret){
   await admin.from("school_connections").upsert({user_id:userId,status:"error",status_message:"Schoology administrator credentials are not configured yet.",updated_at:new Date().toISOString()},{onConflict:"user_id"});
   return json({setupRequired:true,classesImported:0,assignmentsImported:0,assignmentsUpdated:0,errors:[],message:"Schoology administrator credentials are not configured yet."});
 }
 const baseUrl=(Deno.env.get("SCHOOLOGY_API_BASE_URL")??"https://api.schoology.com/v1").replace(/\/$/,"");
 await admin.from("school_connections").upsert({user_id:userId,status:"syncing",status_message:"Connecting to Schoology…",updated_at:new Date().toISOString()},{onConflict:"user_id"});
 const enc=(s:string)=>encodeURIComponent(s).replace(/[!'()*]/g,c=>`%${c.charCodeAt(0).toString(16).toUpperCase()}`);
 const nonce=crypto.randomUUID().replaceAll("-",""); const timestamp=Math.floor(Date.now()/1000).toString();
 const oauth:Record<string,string>={oauth_consumer_key:consumerKey,oauth_nonce:nonce,oauth_signature_method:"HMAC-SHA1",oauth_timestamp:timestamp,oauth_token:accessToken,oauth_version:"1.0"};
 const pairs=Object.entries(oauth).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${enc(k)}=${enc(v)}`).join("&");
 const url=`${baseUrl}/users/me`; const base=`GET&${enc(url)}&${enc(pairs)}`; const key=`${enc(consumerSecret)}&${enc(accessTokenSecret)}`;
 const cryptoKey=await crypto.subtle.importKey("raw",new TextEncoder().encode(key),{name:"HMAC",hash:"SHA-1"},false,["sign"]);
 const sigBytes=new Uint8Array(await crypto.subtle.sign("HMAC",cryptoKey,new TextEncoder().encode(base))); let binary=""; for(const b of sigBytes)binary+=String.fromCharCode(b);
 oauth.oauth_signature=btoa(binary); const authHeader="OAuth "+Object.entries(oauth).map(([k,v])=>`${enc(k)}=\"${enc(v)}\"`).join(", ");
 const profileRes=await fetch(url,{headers:{Authorization:authHeader,Accept:"application/json"}});
 if(!profileRes.ok){const detail=await profileRes.text(); await admin.from("school_connections").update({status:"error",status_message:`Schoology API error (${profileRes.status}).`,updated_at:new Date().toISOString()}).eq("user_id",userId); return json({error:`Schoology API error (${profileRes.status})`,detail:detail.slice(0,500)},502);}
 const schoolUser=await profileRes.json();
 await admin.from("school_connections").upsert({user_id:userId,status:"connected",status_message:"Connected to Schoology.",schoology_user_id:String(schoolUser.id??""),schoology_username:schoolUser.username??schoolUser.name_display??null,school_name:schoolUser.school_name??null,last_synced_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:"user_id"});
 return json({classesImported:0,assignmentsImported:0,assignmentsUpdated:0,errors:[],message:"Schoology account connected. Course and assignment endpoints can now be synced with the provisioned OAuth credentials."});
});
