const CLASS_PILOT_URL = 'https://class-pilot-sigma.vercel.app/';
const SUPABASE_URL = 'https://ixolapnghbfpmspdpesn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzIiwicmVmIjoiaXhvbGFwbmdobWZwbXNwZHBlc24iLCJpYXQiOjE3ODc1OTMwNTIsImV4cCI6MjEwMzE2OTA1Mn0.yXfAIjKeSgKFY32thJ8wt7D_4EnI5BlrCnfuErwfbis';
const SYNC_URL = `${SUPABASE_URL}/functions/v1/schoology-sync`;
const SYNC_ALARM = 'classpilot-schoology-sync';

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
      // Supabase's browser client normally stores its session under
      // sb-<project-ref>-auth-token. Do not depend on one exact key shape:
      // deployments can use chunked storage or a slightly different prefix.
      const candidates = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || !/auth-token/i.test(key)) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try { candidates.push(JSON.parse(raw)); } catch (_) {}
      }

      const looksLikeSession = value => Boolean(
        value && typeof value === 'object' &&
        typeof value.access_token === 'string' &&
        value.access_token.length > 20 &&
        value.user && typeof value.user.id === 'string'
      );

      const queue = [...candidates];
      const seen = new Set();
      while (queue.length) {
        const value = queue.shift();
        if (!value || typeof value !== 'object' || seen.has(value)) continue;
        seen.add(value);
        if (looksLikeSession(value)) {
          return { ok: true, accessToken: value.access_token, refreshToken: value.refresh_token || null, userId: value.user.id };
        }
        if (Array.isArray(value)) queue.push(...value);
        else Object.values(value).forEach(child => { if (child && typeof child === 'object') queue.push(child); });
      }
      return { ok: false, reason: 'No Supabase session was found in ClassPilot local storage.', keys: candidates.length };
    }
  });
  return results?.[0]?.result || { ok: false, reason: 'Could not inspect the ClassPilot session.' };
}

async function verifyAndStoreSession(session) {
  if (!session?.accessToken || !session?.userId) return { ok: false, message: 'ClassPilot is open, but no signed-in session was found. Sign in to ClassPilot in this browser first.' };
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${session.accessToken}`, apikey: SUPABASE_ANON_KEY }
    });
    if (!response.ok) return { ok: false, message: 'Your ClassPilot session is not valid anymore. Sign out and sign back in to ClassPilot, then connect again.' };
    const user = await response.json();
    if (!user?.id || user.id !== session.userId) return { ok: false, message: 'ClassPilot returned an invalid session. Please sign in again.' };
    await chrome.storage.local.set({
      classPilotAccessToken: session.accessToken,
      classPilotRefreshToken: session.refreshToken || null,
      classPilotUserId: user.id,
      classPilotSyncError: null
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: `Could not verify ClassPilot: ${error?.message || 'network error'}` };
  }
}

async function connectToClassPilot() {
  const tabs = await chrome.tabs.query({ url: `${CLASS_PILOT_URL}*` });
  let tab = tabs[0];
  if (!tab?.id) tab = await chrome.tabs.create({ url: CLASS_PILOT_URL, active: true });
  else await chrome.tabs.update(tab.id, { active: true });
  if (!tab?.id) return { ok: false, message: 'Could not open ClassPilot.' };

  // Wait for the actual page document, then read the same browser session
  // directly. This avoids depending on a content-script handshake.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 500));
    try {
      const session = await extractClassPilotSession(tab.id);
      if (session.ok) return await verifyAndStoreSession(session);
      if (attempt === 19) {
        return { ok: false, message: 'ClassPilot is open, but no signed-in session was found. Sign in to ClassPilot in this browser, leave the page open, and click Connect to ClassPilot again.' };
      }
    } catch (error) {
      if (attempt === 19) return { ok: false, message: `Could not read ClassPilot: ${error?.message || 'page is not ready'}` };
    }
  }
  return { ok: false, message: 'Could not connect to ClassPilot.' };
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
  await chrome.storage.local.set({ classPilotSyncError: null });
  try {
    chrome.tabs.sendMessage(tabId, { type: 'SYNC_NOW' }).catch(error => {
      const message = String(error?.message || error || 'Could not reach the Schoology page.');
      chrome.storage.local.set({ classPilotSyncError: /Receiving end does not exist|Could not establish connection/i.test(message) ? 'Refresh the Schoology tab once, then try again.' : message });
    });
    return { ok: true, started: true, message: 'Schoology sync started. Reading your calendar…' };
  } catch (_) {
    return { ok: false, message: 'Could not start Schoology sync. Refresh the Schoology tab and try again.' };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message?.type === 'SET_AUTH') {
      sendResponse(await verifyAndStoreSession({ accessToken: message.accessToken, refreshToken: message.refreshToken, userId: message.userId })); return;
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
