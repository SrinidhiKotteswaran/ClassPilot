import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors}); if(req.method!=="POST")return json({error:"Method not allowed"},405);
 const auth=req.headers.get("Authorization"); if(!auth?.startsWith("Bearer "))return json({error:"Missing authorization"},401);
 const supabaseUrl=Deno.env.get("SUPABASE_URL")!; const serviceRole=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!; const anonKey=Deno.env.get("SUPABASE_ANON_KEY")??"";
 const admin=createClient(supabaseUrl,serviceRole); const token=auth.replace("Bearer ",""); const userClient=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:auth}}});
 const {data:userData,error:userError}=await userClient.auth.getUser(token); if(userError||!userData.user)return json({error:"Invalid session"},401); const userId=userData.user.id;
 let body:any={}; try{body=await req.json()}catch{return json({error:"Invalid JSON body"},400)}
 if(body?.source!=="extension"||!body?.payload)return json({setupRequired:true,classesImported:0,assignmentsImported:0,assignmentsUpdated:0,errors:[],message:"Use the ClassPilot browser extension connection for student Schoology sync."});
 const payload=body.payload; const courses=Array.isArray(payload.courses)?payload.courses.slice(0,50):[]; const assignments=Array.isArray(payload.assignments)?payload.assignments.slice(0,1000):[]; if(!courses.length)return json({error:"No Schoology courses were provided."},400);
 try{
  const now=()=>new Date().toISOString();
  const {data:connection,error:connectionError}=await admin.from("schoology_connections").upsert({user_id:userId,schoology_domain:String(payload.schoolName??"").slice(0,255),status:"syncing",error_message:null,updated_at:now()},{onConflict:"user_id"}).select("id").single();
  if(connectionError||!connection)throw new Error(connectionError?.message??"Could not create Schoology connection.");
  const classMap=new Map<string,string>(); let classesImported=0;
  for(const course of courses){
    const externalId=String(course.schoologyId??"").trim(); if(!externalId)continue;
    const name=String(course.title??`Schoology class ${externalId}`).slice(0,300);
    const {data:courseRow,error:courseError}=await admin.from("schoology_courses").upsert({connection_id:connection.id,schoology_id:externalId,title:name,teacher_name:null,raw_data:course,updated_at:now()},{onConflict:"connection_id,schoology_id"}).select("id").single();
    if(courseError||!courseRow)throw new Error(`Could not save ${name}: ${courseError?.message??"unknown error"}`);
    const {data:appClass,error:classError}=await admin.from("classes").upsert({user_id:userId,name,teacher:"",color:"blue",schoology_course_id:externalId,schoology_section_id:externalId},{onConflict:"user_id,schoology_course_id"}).select("id").single();
    if(classError||!appClass)throw new Error(`Could not save class ${name}: ${classError?.message??"unknown error"}`);
    classMap.set(externalId,appClass.id); classesImported++;
  }
  let assignmentsImported=0,assignmentsUpdated=0;
  for(const item of assignments){
    const externalId=String(item.schoologyId??"").trim(); if(!externalId)continue;
    const courseId=String(item.courseSchoologyId??""); const classId=classMap.get(courseId)??null;
    const {data:courseRow}=await admin.from("schoology_courses").select("id").eq("connection_id",connection.id).eq("schoology_id",courseId).maybeSingle();
    const due=item.dueAt?new Date(item.dueAt):null; const dueAt=due&&!Number.isNaN(due.getTime())?due.toISOString():null;
    const title=String(item.title??`Schoology assignment ${externalId}`).slice(0,500); const description=String(item.description??"").slice(0,2000); const category=String(item.category??"preparatory"); const points=Number(item.pointsValue??0)||0; const missing=Boolean(item.isMissing);
    if(courseRow){
      await admin.from("schoology_assignments").upsert({connection_id:connection.id,course_id:courseRow.id,schoology_id:externalId,title,description,due_at:dueAt,category,grade:null,max_grade:points,status:missing?"missing":"assigned",raw_data:item,updated_at:now()},{onConflict:"connection_id,schoology_id"});
    }
    const {data:existing}=await admin.from("assignments").select("id,completed").eq("user_id",userId).eq("schoology_assignment_id",externalId).maybeSingle();
    if(existing?.id){
      const {error}=await admin.from("assignments").update({class_id:classId,title,description,category,due_date:dueAt,points_value:points,is_missing:missing,source:"schoology"}).eq("id",existing.id).eq("user_id",userId); if(error)throw error; assignmentsUpdated++;
    }else{
      const {error}=await admin.from("assignments").insert({user_id:userId,class_id:classId,title,description,category,due_date:dueAt,estimated_minutes:30,points_value:points,completed:false,completed_at:null,is_missing:missing,source:"schoology",schoology_assignment_id:externalId}); if(error)throw error; assignmentsImported++;
    }
  }
  const syncedAt=now(); await admin.from("schoology_connections").update({status:"connected",last_synced_at:syncedAt,error_message:null,updated_at:syncedAt}).eq("id",connection.id);
  return json({classesImported,assignmentsImported,assignmentsUpdated,errors:[],lastSyncedAt:syncedAt,message:"Schoology synced successfully."});
 }catch(error){
  const message=error instanceof Error?error.message:"Schoology sync failed."; await admin.from("schoology_connections").update({status:"error",error_message:message.slice(0,500),updated_at:new Date().toISOString()}).eq("user_id",userId); return json({error:message},500);
 }
});
