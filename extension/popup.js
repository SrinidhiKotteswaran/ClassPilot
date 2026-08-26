const statusEl = document.getElementById('status');
const countsEl = document.getElementById('counts');
const connectButton = document.getElementById('connect');
const syncButton = document.getElementById('sync');
const messageEl = document.getElementById('message');

async function getState() { return chrome.runtime.sendMessage({ type: 'GET_STATE' }); }

async function refresh() {
  const state = await getState();
  if (state?.connected) {
    statusEl.textContent = 'Connected to ClassPilot. Schoology can now sync automatically.';
    connectButton.textContent = 'Connected ✓';
    connectButton.disabled = true;
  } else {
    statusEl.textContent = 'Connect your ClassPilot account once. Then your Schoology data can sync automatically.';
    connectButton.textContent = 'Connect to ClassPilot';
    connectButton.disabled = false;
  }
  if (state?.lastSync) {
    countsEl.textContent = `Last sync: ${new Date(state.lastSync).toLocaleString()}`;
    countsEl.classList.remove('hidden');
  }
}

connectButton.addEventListener('click', async () => {
  messageEl.className = 'message';
  messageEl.textContent = 'Opening ClassPilot securely…';
  connectButton.disabled = true;
  const result = await chrome.runtime.sendMessage({ type: 'CONNECT_CLASS_PILOT' });
  messageEl.className = result?.ok ? 'message success' : 'message error';
  messageEl.textContent = result?.ok ? 'Connected. You can return to Schoology.' : (result?.message || 'Could not connect.');
  await refresh();
});

syncButton.addEventListener('click', async () => {
  syncButton.disabled = true;
  messageEl.className = 'message';
  messageEl.textContent = 'Starting Schoology calendar sync…';
  const before = await getState();
  const result = await chrome.runtime.sendMessage({ type: 'SYNC_ACTIVE_SCHOOLOGY' });
  if (!result?.ok) {
    messageEl.className = 'message error';
    messageEl.textContent = result?.message || 'Could not start Schoology sync.';
    syncButton.disabled = false;
    return;
  }

  messageEl.className = 'message';
  messageEl.textContent = 'Reading Schoology calendar…';
  const previousSync = before?.lastSync || null;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 750));
    const state = await getState();
    if (state?.syncError) {
      messageEl.className = 'message error';
      messageEl.textContent = state.syncError;
      syncButton.disabled = false;
      await refresh();
      return;
    }
    if (state?.lastSync && state.lastSync !== previousSync) {
      messageEl.className = 'message success';
      messageEl.textContent = 'Schoology calendar synced successfully.';
      syncButton.disabled = false;
      await refresh();
      return;
    }
  }

  // The sync may still be finishing; don't report a false failure merely
  // because the popup's 30-second lifetime ended.
  messageEl.className = 'message';
  messageEl.textContent = 'Sync is still running. Keep Schoology open; it will update automatically when finished.';
  syncButton.disabled = false;
  await refresh();
});

refresh();
