const CLASS_PILOT_URL = 'https://class-pilot-sigma.vercel.app/';
const SUPABASE_URL = 'https://ixolapnghbfpmspdpesn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzIiwicmVmIjoiaXhvbGFwbmdobWZwbXNwZHBlc24iLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc4NzU5MzA1MiwiZXhwIjoyMTAzMTY5MDUyLCJzZXJ2aWNlX3JvbGUiOiJub25lIn0.yXfAIjKeSgKFY32thJ8wt7D_4EnI5BlrCnfuErwfbis';
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
      const AUTH_PREFIX = 'sb-ixolapnghbfpmspdpesn-auth-token';
      const values = [];
      const keys = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || (key !== AUTH_PREFIX && !key.startsWith(`${AUTH_PREFIX}.`))) continue;
        keys.push(key);
        const raw = localStorage.getItem(key);
        if (raw) values.push({ key, raw });
      }

      // Normal supabase-js storage is one JSON object. Some storage adapters
      // split large values into AUTH_PREFIX.0, AUTH_PREFIX.1, ...; reconstruct
      // those chunks before parsing.
      values.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
      const rawCandidates = [];
      const whole = values.find(v => v.key === AUTH_PREFIX);
      if (whole) rawCandidates.push(whole.raw);
      const chunks = values.filter(v => v.key !== AUTH_PREFIX && /^.+\.\d+$/.test(v.key));
      if (chunks.length) rawCandidates.push(chunks.map(v => v.raw).join(''));

      const parsedCandidates = [];
      for (const raw of rawCandidates) {
        try { parsedCandidates.push(JSON.parse(raw)); } catch (_) {}
      }

      const looksLikeSession = value => Boolean(
        value && typeof value === 'object' &&
        typeof value.access_token === 'string' && value.access_token.length > 20 &&
        value.user && typeof value.user.id === 'string'
      );
      const queue = [...parsedCandidates];
      const seen = new Set();
      while (queue.length) {
        const value = queue.shift();
        if (!value || typeof value !== 'object' || seen.has(value)) continue;
        seen.add(value);
        if (looksLikeSession(value)) {
          return {
            ok: true,
            accessToken: value.access_token,
            refreshToken: value.refresh_token || null,
            userId: value.user.id,
            storageKeys: keys
          };
        }
        if (Array.isArray(value)) queue.push(...value);
        else Object.values(value).forEach(child => { if (child && typeof child === 'object') queue.push(child); });
      }
      return { ok: false, reason: 'No active ClassPilot Supabase session was found.', storageKeys: keys };
    }
  });
  return results?.[0]?.result || { ok: false, reason: 'Could not inspect the ClassPilot session.' };
}

async function verifyAndStoreSession(session) {
  if (!session?.accessToken || !session?.userId) return { ok: false, message: 'ClassPilot is open, but you are not signed in there. Sign in to ClassPilot in this browser, then connect again.' };
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${session.accessToken}`, apikey: SUPABASE_ANON_KEY }
    });
    if (!response.ok) return { ok: false, message: 'Your ClassPilot sign-in has expired. Sign in to ClassPilot again, then connect again.' };
    const user = await response.json();
    if (!user?.id || user.id !== session.userId) return { ok: false, message: 'ClassPilot returned an invalid sign-in session. Please sign in again.' };
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
  let tabs = await chrome.tabs.query({ url: [`${CLASS_PILOT_URL}*`] });
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
    } catch (error) {
      lastReason = error?.message || lastReason;
    }
  }
  return {
    ok: false,
    message: `${lastReason} Open ClassPilot at ${CLASS_PILOT_URL}, make sure the dashboard loads while you are signed in, then click Connect to ClassPilot again.`
  };
}

async function refreshAccessToken() {
  const auth = await getAuth();
  if (!auth.classPilotRefreshToken) return false;
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: auth.classPilotRefreshToken })
    });
    if (!response.ok) return false;
    const session = await response.json();
    if (!session.access_token || !session.user?.id) return false;
    await chrome.storage.local.set({
      classPilotAccessToken: session.access_token,
      classPilotRefreshToken: session.refresh_token || auth.classPilotRefreshToken,
      classPilotUserId: session.user.id,
      classPilotSyncError: null
    });
    return true;
  } catch (_) { return false; }
}

async function syncPayload(payload) {
  let { classPilotAccessToken } = await getAuth();
  if (!classPilotAccessToken) return { ok: false, needsConnection: true, message: 'Connect to ClassPilot once.' };
  try {
    let response = await fetch(SYNC_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${classPilotAccessToken}`, apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'extension', payload })
    });
    if (response.status === 401 && await refreshAccessToken()) {
      ({ classPilotAccessToken } = await getAuth());
      response = await fetch(SYNC_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${classPilotAccessToken}`, apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'extension', payload })
      });
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
  if (!tabId) return { ok: false, message: 'No Schoology tab is available.' };
  let auth = await getAuth();
  if (!auth.classPilotAccessToken) {
    const connected = await connectToClassPilot();
    if (!connected.ok) return connected;
    auth = await getAuth();
  }
  await chrome.storage.local.set({ classPilotSyncError: null });
  try {
    const result = await chrome.tabs.sendMessage(tabId, { type: 'SYNC_NOW' });
    return result?.ok ? result : { ok: false, message: result?.message || 'Schoology sync did not complete.' };
  } catch (error) {
    const message = String(error?.message || error || 'Could not reach the Schoology page.');
    const friendly = /Receiving end does not exist|Could not establish connection/i.test(message)
      ? 'Refresh the Schoology tab once so ClassPilot can attach to it, then try Sync Schoology now again.'
      : message;
    await chrome.storage.local.set({ classPilotSyncError: friendly });
    return { ok: false, message: friendly };
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
