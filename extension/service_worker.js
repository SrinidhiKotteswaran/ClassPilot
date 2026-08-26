const CLASS_PILOT_URL = 'https://class-pilot-sigma.vercel.app/';
const SUPABASE_URL = 'https://ixolapnghbfpmspdpesn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4b2xhcG5naGJmcG1zcGRwZXNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1OTMwNTIsImV4cCI6MjEwMzE2OTA1Mn0.yXfAIjKeSgKFY32thJ8wt7D_4EnI5BlrCnfuErwfbis';
const SYNC_URL = `${SUPABASE_URL}/functions/v1/schoology-sync`;
const SYNC_ALARM = 'classpilot-schoology-sync';
const SCHOOLOGY_URLS = ['https://*.schoology.com/*', 'https://schoology.com/*'];

async function ensureAlarm() { await chrome.alarms.create(SYNC_ALARM, { periodInMinutes: 10 }); }
chrome.runtime.onInstalled.addListener(ensureAlarm);
chrome.runtime.onStartup.addListener(ensureAlarm);

async function getAuth() {
  return chrome.storage.local.get(['classPilotAccessToken', 'classPilotRefreshToken', 'classPilotUserId', 'classPilotLastSync', 'classPilotSyncError']);
}

async function extractClassPilotSession(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const AUTH_PREFIX = 'sb-ixolapnghbfpmspdpesn-auth-token';
      const values = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || (key !== AUTH_PREFIX && !key.startsWith(`${AUTH_PREFIX}.`))) continue;
        const raw = localStorage.getItem(key);
        if (raw) values.push({ key, raw });
      }
      values.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
      const whole = values.find(v => v.key === AUTH_PREFIX);
      const raws = whole ? [whole.raw] : [];
      const chunks = values.filter(v => v.key !== AUTH_PREFIX && /^.+\.\d+$/.test(v.key));
      if (chunks.length) raws.push(chunks.map(v => v.raw).join(''));
      for (const raw of raws) {
        try {
          const root = JSON.parse(raw);
          const queue = [root];
          const seen = new Set();
          while (queue.length) {
            const value = queue.shift();
            if (!value || typeof value !== 'object' || seen.has(value)) continue;
            seen.add(value);
            if (typeof value.access_token === 'string' && value.user?.id) return { ok: true, accessToken: value.access_token, refreshToken: value.refresh_token || null, userId: value.user.id };
            if (Array.isArray(value)) queue.push(...value);
            else Object.values(value).forEach(child => { if (child && typeof child === 'object') queue.push(child); });
          }
        } catch (_) {}
      }
      return { ok: false, reason: 'No active ClassPilot Supabase session was found.' };
    }
  });
  return results?.[0]?.result || { ok: false, reason: 'Could not inspect the ClassPilot session.' };
}

async function verifyAndStoreSession(session) {
  if (!session?.accessToken || !session?.userId) return { ok: false, message: 'ClassPilot is open, but you are not signed in there. Sign in to ClassPilot in this browser, then connect again.' };
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${session.accessToken}`, apikey: SUPABASE_ANON_KEY } });
    if (!response.ok) return { ok: false, message: 'Your ClassPilot sign-in has expired. Sign in to ClassPilot again, then connect again.' };
    const user = await response.json();
    if (!user?.id || user.id !== session.userId) return { ok: false, message: 'ClassPilot returned an invalid sign-in session. Please sign in again.' };
    await chrome.storage.local.set({ classPilotAccessToken: session.accessToken, classPilotRefreshToken: session.refreshToken || null, classPilotUserId: user.id, classPilotSyncError: null });
    return { ok: true };
  } catch (error) { return { ok: false, message: `Could not verify ClassPilot: ${error?.message || 'network error'}` }; }
}

async function connectToClassPilot() {
  const tabs = await chrome.tabs.query({ url: [`${CLASS_PILOT_URL}*`] });
  let tab = tabs[0];
  if (!tab?.id) tab = await chrome.tabs.create({ url: CLASS_PILOT_URL, active: true });
  else await chrome.tabs.update(tab.id, { active: true });
  if (!tab?.id) return { ok: false, message: 'Could not open ClassPilot.' };
  let lastReason = 'No active ClassPilot Supabase session was found.';
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 500));
    try {
      const session = await extractClassPilotSession(tab.id);
      if (session.ok) return await verifyAndStoreSession(session);
      lastReason = session.reason || lastReason;
    } catch (error) { lastReason = error?.message || lastReason; }
  }
  return { ok: false, message: `${lastReason} Open ClassPilot at ${CLASS_PILOT_URL}, make sure the dashboard loads while you are signed in, then click Connect to ClassPilot again.` };
}

async function refreshAccessToken() {
  const auth = await getAuth();
  if (!auth.classPilotRefreshToken) return false;
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: auth.classPilotRefreshToken }) });
    if (!response.ok) return false;
    const session = await response.json();
    if (!session.access_token || !session.user?.id) return false;
    await chrome.storage.local.set({ classPilotAccessToken: session.access_token, classPilotRefreshToken: session.refresh_token || auth.classPilotRefreshToken, classPilotUserId: session.user.id, classPilotSyncError: null });
    return true;
  } catch (_) { return false; }
}

async function syncPayload(payload) {
  let { classPilotAccessToken } = await getAuth();
  if (!classPilotAccessToken) return { ok: false, needsConnection: true, message: 'Connect to ClassPilot once.' };
  try {
    const request = () => fetch(SYNC_URL, { method: 'POST', headers: { Authorization: `Bearer ${classPilotAccessToken}`, apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ source: 'extension', payload }) });
    let response = await request();
    if (response.status === 401 && await refreshAccessToken()) {
      ({ classPilotAccessToken } = await getAuth());
      response = await request();
    }
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
  if (!tabId) return { ok: false, message: 'No Schoology tab is available. Open Schoology first.' };
  let auth = await getAuth();
  if (!auth.classPilotAccessToken) {
    const connected = await connectToClassPilot();
    if (!connected.ok) return connected;
    auth = await getAuth();
  }
  await chrome.storage.local.set({ classPilotSyncError: null });

  // The Schoology content script owns scraping. Retry once after reloading the
  // tab when Chrome reports that the old MV3 content-script context vanished.
  // This is the important recovery path for tabs that survived an extension update.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await chrome.tabs.sendMessage(tabId, { type: 'SYNC_NOW' });
      if (result?.ok) return result;
      const message = result?.message || 'Schoology sync did not complete.';
      await chrome.storage.local.set({ classPilotSyncError: message });
      return { ok: false, message };
    } catch (error) {
      const message = String(error?.message || error || 'Could not reach the Schoology page.');
      const staleContext = /Receiving end does not exist|Could not establish connection|Extension context invalidated/i.test(message);
      if (!staleContext || attempt === 1) {
        const friendly = staleContext ? 'The Schoology page is using an old ClassPilot extension context. Reload the Schoology tab once, then try Sync again.' : message;
        await chrome.storage.local.set({ classPilotSyncError: friendly });
        return { ok: false, message: friendly };
      }
      try {
        await chrome.tabs.reload(tabId);
        await new Promise(resolve => setTimeout(resolve, 1800));
      } catch (_) {}
    }
  }
  return { ok: false, message: 'Schoology sync could not be started.' };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message?.type === 'SET_AUTH') { sendResponse(await verifyAndStoreSession({ accessToken: message.accessToken, refreshToken: message.refreshToken, userId: message.userId })); return; }
    if (message?.type === 'GET_STATE') { const auth = await getAuth(); sendResponse({ connected: Boolean(auth.classPilotAccessToken), lastSync: auth.classPilotLastSync || null, syncError: auth.classPilotSyncError || null }); return; }
    if (message?.type === 'CONNECT_CLASS_PILOT') { sendResponse(await connectToClassPilot()); return; }
    if (message?.type === 'SCHOOLYOGY_DATA') { sendResponse(await syncPayload(message.payload)); return; }
    if (message?.type === 'CONNECT_AND_SYNC') {
      let auth = await getAuth();
      if (!auth.classPilotAccessToken) { const connected = await connectToClassPilot(); if (!connected.ok) { sendResponse(connected); return; } auth = await getAuth(); }
      sendResponse(await syncPayload(message.payload)); return;
    }
    if (message?.type === 'SYNC_ACTIVE_SCHOOLOGY') {
      const tabs = await chrome.tabs.query({ url: SCHOOLOGY_URLS });
      if (!tabs.length) { sendResponse({ ok: false, message: 'No Schoology tab is open. Open motcharter.schoology.com first.' }); return; }
      const tab = tabs.find(item => /schoology\.com/i.test(item.url || '')) || tabs[0];
      sendResponse(await startSchoologySync(tab.id)); return;
    }
    sendResponse({ ok: false, message: 'Unknown request.' });
  })().catch(error => sendResponse({ ok: false, message: error?.message || 'Unexpected extension error.' }));
  return true;
});

chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name !== SYNC_ALARM) return;
  const tabs = await chrome.tabs.query({ url: SCHOOLOGY_URLS });
  if (tabs[0]?.id) await startSchoologySync(tabs[0].id);
});
