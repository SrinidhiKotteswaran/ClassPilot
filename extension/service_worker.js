const CLASS_PILOT_URL = 'https://class-pilot-sigma.vercel.app/';
const SUPABASE_URL = 'https://ixolapnghbfpmspdpesn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXAiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc4NzU5MzA1MiwiZXhwIjoyMTAzMTY5MDUyLCJzdXBhYmFzZV9wcm9qZWN0X3JlZiI6Iml4b2xhcG5naGJmcG1zcGRwZXNuIn0.yXfAIjKeSgKFY32thJ8wt7D_4EnI5BlrCnfuErwfbis';
const SYNC_URL = `${SUPABASE_URL}/functions/v1/schoology-sync`;
const SYNC_ALARM = 'classpilot-schoology-sync';

async function ensureAlarm() { await chrome.alarms.create(SYNC_ALARM, { periodInMinutes: 10 }); }
chrome.runtime.onInstalled.addListener(ensureAlarm);
chrome.runtime.onStartup.addListener(ensureAlarm);

async function getAuth() {
  return chrome.storage.local.get(['classPilotAccessToken', 'classPilotUserId', 'classPilotLastSync', 'classPilotSyncError']);
}

async function connectToClassPilot() {
  const tabs = await chrome.tabs.query({ url: `${CLASS_PILOT_URL}*` });
  let tab = tabs[0];
  if (!tab?.id) tab = await chrome.tabs.create({ url: CLASS_PILOT_URL, active: true });
  else await chrome.tabs.update(tab.id, { active: true });
  if (!tab?.id) return { ok: false, message: 'Could not open ClassPilot.' };
  for (let attempt = 0; attempt < 12; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 500));
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'REQUEST_AUTH' });
      if (response?.ok) return { ok: true };
      if (response?.message && attempt === 11) return { ok: false, message: response.message };
    } catch (_) {}
  }
  return { ok: false, message: 'Open ClassPilot and make sure you are signed in, then try again.' };
}

async function syncPayload(payload) {
  const { classPilotAccessToken } = await getAuth();
  if (!classPilotAccessToken) return { ok: false, needsConnection: true, message: 'Connect to ClassPilot once.' };
  try {
    const response = await fetch(SYNC_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${classPilotAccessToken}`, apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'extension', payload })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = body.message || body.error || `Sync failed (${response.status}).`;
      await chrome.storage.local.set({ classPilotSyncError: message });
      return { ok: false, message };
    }
    const now = new Date().toISOString();
    await chrome.storage.local.set({ classPilotLastSync: now, classPilotSyncError: null });
    return { ok: true, ...body };
  } catch (error) {
    const message = error?.message || 'Could not reach ClassPilot.';
    await chrome.storage.local.set({ classPilotSyncError: message });
    return { ok: false, message };
  }
}

async function startSchoologySync(tabId) {
  if (!tabId) return { ok: false, message: 'No Schoology tab is available.' };
  const auth = await getAuth();
  if (!auth.classPilotAccessToken) return { ok: false, needsConnection: true, message: 'Connect to ClassPilot once.' };
  try {
    chrome.tabs.sendMessage(tabId, { type: 'SYNC_NOW' }).catch(() => {});
    return { ok: true, started: true, message: 'Schoology sync started. Reading your calendar…' };
  } catch (_) {
    return { ok: false, message: 'Could not start Schoology sync. Refresh Schoology and try again.' };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message?.type === 'SET_AUTH') {
      await chrome.storage.local.set({ classPilotAccessToken: message.accessToken, classPilotUserId: message.userId, classPilotSyncError: null });
      sendResponse({ ok: true }); return;
    }
    if (message?.type === 'GET_STATE') {
      const auth = await getAuth();
      sendResponse({ connected: Boolean(auth.classPilotAccessToken), lastSync: auth.classPilotLastSync || null, syncError: auth.classPilotSyncError || null }); return;
    }
    if (message?.type === 'CONNECT_CLASS_PILOT') { sendResponse(await connectToClassPilot()); return; }
    if (message?.type === 'SCHOOLYOGY_DATA') { sendResponse(await syncPayload(message.payload)); return; }
    if (message?.type === 'CONNECT_AND_SYNC') {
      let auth = await getAuth();
      if (!auth.classPilotAccessToken) {
        const connected = await connectToClassPilot();
        if (!connected.ok) { sendResponse(connected); return; }
        auth = await getAuth();
      }
      sendResponse(await syncPayload(message.payload)); return;
    }
    if (message?.type === 'SYNC_ACTIVE_SCHOOLOGY') {
      const tabs = await chrome.tabs.query({ url: ['https://*.schoology.com/*', 'https://schoology.com/*'] });
      sendResponse(await startSchoologySync(tabs[0]?.id)); return;
    }
    sendResponse({ ok: false, message: 'Unknown request.' });
  })().catch(error => sendResponse({ ok: false, message: error?.message || 'Unexpected extension error.' }));
  return true;
});

chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name !== SYNC_ALARM) return;
  const tabs = await chrome.tabs.query({ url: ['https://*.schoology.com/*', 'https://schoology.com/*'] });
  if (tabs[0]?.id) await startSchoologySync(tabs[0].id);
});
