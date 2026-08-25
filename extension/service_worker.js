const CLASS_PILOT_URL = 'https://class-pilot-sigma.vercel.app/';
const SUPABASE_URL = 'https://ixolapnghbfpmspdpesn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4b2xhcG5naGJmcG1zcGRwZXNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1OTMwNTIsImV4cCI6MjEwMzE2OTA1Mn0.yXfAIjKeSgKFY32thJ8wt7D_4EnI5BlrCnfuErwfbis';
const SYNC_URL = `${SUPABASE_URL}/functions/v1/schoology-sync`;

chrome.runtime.onInstalled.addListener(() => { chrome.alarms.create('classpilot-sync', { periodInMinutes: 10 }); });
async function getAuth(){ return chrome.storage.local.get(['classPilotAccessToken','classPilotUserId','classPilotLastSync']); }

async function connectToClassPilot(){
  const tabs=await chrome.tabs.query({url:`${CLASS_PILOT_URL}*`}); let tab=tabs[0];
  if(!tab?.id) tab=await chrome.tabs.create({url:CLASS_PILOT_URL,active:true}); else await chrome.tabs.update(tab.id,{active:true});
  if(!tab.id)return {ok:false,message:'Could not open ClassPilot.'};
  for(let attempt=0;attempt<6;attempt++){
    await new Promise(r=>setTimeout(r,700));
    try{const response=await chrome.tabs.sendMessage(tab.id,{type:'REQUEST_AUTH'});if(response?.ok)return {ok:true};}catch(_){ }
  }
  return {ok:false,message:'Open ClassPilot, make sure you are signed in, then click Connect again.'};
}

async function syncPayload(payload){
  const {classPilotAccessToken}=await getAuth(); if(!classPilotAccessToken)return {ok:false,message:'Connect to ClassPilot once from the extension menu first.'};
  const response=await fetch(SYNC_URL,{method:'POST',headers:{Authorization:`Bearer ${classPilotAccessToken}`,apikey:SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({source:'extension',payload})});
  const body=await response.json().catch(()=>({})); if(!response.ok)return {ok:false,message:body.message||body.error||`Sync failed (${response.status}).`};
  const now=new Date().toISOString(); await chrome.storage.local.set({classPilotLastSync:now}); return {ok:true,...body};
}

chrome.runtime.onMessage.addListener((message,_sender,sendResponse)=>{(async()=>{
  if(message?.type==='SET_AUTH'){await chrome.storage.local.set({classPilotAccessToken:message.accessToken,classPilotUserId:message.userId});sendResponse({ok:true});return;}
  if(message?.type==='GET_STATE'){const auth=await getAuth();sendResponse({connected:Boolean(auth.classPilotAccessToken),lastSync:auth.classPilotLastSync||null});return;}
  if(message?.type==='CONNECT_CLASS_PILOT'){sendResponse(await connectToClassPilot());return;}
  if(message?.type==='SCHOOLYOGY_DATA'){sendResponse(await syncPayload(message.payload));return;}
  if(message?.type==='SYNC_ACTIVE_SCHOOLOGY'){const tabs=await chrome.tabs.query({url:['https://*.schoology.com/*','https://schoology.com/*']});if(!tabs[0]?.id){sendResponse({ok:false,message:'Open Schoology in a tab first.'});return;}try{sendResponse(await chrome.tabs.sendMessage(tabs[0].id,{type:'SYNC_NOW'}));}catch(_){sendResponse({ok:false,message:'Refresh the Schoology tab once, then try again.'});}return;}
  sendResponse({ok:false,message:'Unknown request.'});
})();return true;});

chrome.alarms.onAlarm.addListener(async alarm=>{if(alarm.name!=='classpilot-sync')return;const tabs=await chrome.tabs.query({url:['https://*.schoology.com/*','https://schoology.com/*']});if(!tabs[0]?.id)return;try{await chrome.tabs.sendMessage(tabs[0].id,{type:'SYNC_NOW'});}catch(_){}});
