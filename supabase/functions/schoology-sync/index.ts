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
 let body:any={}; try{body=await req.json()}catch(_){return json({error:"Invalid JSON body"},400)}

 // Browser-extension sync path. The extension supplies only data it has already
 // read from the student's authenticated Schoology session; no Schoology password
 // or API secret is sent to ClassPilot.
 if(body?.source==="extension" && body?.payload){
   const payload=body.payload;
   const courses=Array.isArray(payload.courses)?payload.courses.slice(0,50):[];
   const assignments=Array.isArray(payload.assignments)?payload.assignments.slice(0,1000):[];
   if(!courses.length)return json({error:"No Schoology courses were provided."},400);
   try{
     await admin.from("school_connections").upsert({user_id:userId,status:"syncing",status_message:"Syncing from ClassPilot browser extension…",school_name:String(payload.schoolName??"").slice(0,200),updated_at:new Date().toISOString()},{onConflict:"user_id"});
     const classMap=new Map<string,string>();
     for(const course of courses){
       const externalId=String(course.schoologyId??"").trim(); if(!externalId)continue;
       const {data:link}=await admin.from("external_class_links").select("id,class_id").eq("user_id",userId).eq("external_id",externalId).maybeSingle();
       let classId=link?.class_id as string|undefined;
       const className=String(course.title??`Schoology class ${externalId}`).slice(0,300);
       if(classId){
         await admin.from("classes").update({name:className}).eq("id",classId).eq("user_id",userId);
         await admin.from("external_class_links").update({external_name:className,last_synced_at:new Date().toISOString()}).eq("id",link.id);
       }else{
         const {data:newClass,error:classError}=await admin.from("classes").insert({user_id:userId,name:className,teacher:"",color:"blue"}).select("id").single();
         if(classError)throw classError;
         classId=newClass.id;
         const {error:linkError}=await admin.from("external_class_links").insert({user_id:userId,class_id:classId,external_id:externalId,external_name:className,last_synced_at:new Date().toISOString()});
         if(linkError)throw linkError;
       }
       classMap.set(externalId,classId!);
     }

     let assignmentsImported=0,assignmentsUpdated=0;
     for(const item of assignments){
       const externalId=String(item.schoologyId??"").trim(); if(!externalId)continue;
       const classId=classMap.get(String(item.courseSchoologyId??""))??null;
       const title=String(item.title??`Schoology assignment ${externalId}`).slice(0,500);
       const description=String(item.description??"").slice(0,2000);
       const dueDate=item.dueAt?new Date(item.dueAt):null;
       const due_date=dueDate&&!Number.isNaN(dueDate.getTime())?dueDate.toISOString():null;
       const {data:link}=await admin.from("external_assignment_links").select("id,assignment_id").eq("user_id",userId).eq("external_id",externalId).maybeSingle();
       if(link?.assignment_id){
         const {error:updateError}=await admin.from("assignments").update({class_id:classId,title,description,due_date,is_missing:Boolean(item.isMissing),source:"schoology"}).eq("id",link.assignment_id).eq("user_id",userId);
         if(updateError)throw updateError;
         await admin.from("external_assignment_links").update({external_course_id:String(item.courseSchoologyId??""),external_category:String(item.category??""),last_synced_at:new Date().toISOString()}).eq("id",link.id);
         assignmentsUpdated++;
       }else{
         const {data:newAssignment,error:assignmentError}=await admin.from("assignments").insert({user_id:userId,class_id:classId,title,description,category:String(item.category??"preparatory"),due_date,estimated_minutes:30,points_value:Number(item.pointsValue??0)||0,completed:false,is_missing:Boolean(item.isMissing),source:"schoology"}).select("id").single();
         if(assignmentError)throw assignmentError;
         const {error:linkError}=await admin.from("external_assignment_links").insert({user_id:userId,assignment_id:newAssignment.id,external_id:externalId,external_course_id:String(item.courseSchoologyId??""),external_category:String(item.category??""),last_synced_at:new Date().toISOString()});
         if(linkError)throw linkError;
         assignmentsImported++;
       }
     }
     const now=new Date().toISOString();
     await admin.from("school_connections").upsert({user_id:userId,status:"connected",status_message:"Connected · automatic browser sync is active.",schoology_username:String(payload.schoologyUsername??"").slice(0,200)||null,school_name:String(payload.schoolName??"").slice(0,200)||null,last_synced_at:now,updated_at:now},{onConflict:"user_id"});
     return json({classesImported:classMap.size,assignmentsImported,assignmentsUpdated,errors:[],lastSyncedAt:now,message:"Schoology synced successfully."});
   }catch(error){
     const message=error instanceof Error?error.message:"Schoology sync failed.";
     await admin.from("school_connections").upsert({user_id:userId,status:"error",status_message:message.slice(0,500),updated_at:new Date().toISOString()},{onConflict:"user_id"});
     return json({error:message},500);
   }
 }

 // Legacy administrator-API path retained for schools that provision official Schoology API credentials.
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
