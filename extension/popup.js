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
  try {
    const result = await chrome.runtime.sendMessage({ type: 'CONNECT_CLASS_PILOT' });
    messageEl.className = result?.ok ? 'message success' : 'message error';
    messageEl.textContent = result?.ok ? 'Connected. You can return to Schoology.' : (result?.message || 'Could not connect.');
    await refresh();
  } catch (error) {
    messageEl.className = 'message error';
    messageEl.textContent = error?.message || 'Could not connect.';
    connectButton.disabled = false;
  }
});

syncButton.addEventListener('click', async () => {
  syncButton.disabled = true;
  messageEl.className = 'message';
  messageEl.textContent = 'Reading Schoology calendar…';
  try {
    const result = await chrome.runtime.sendMessage({ type: 'SYNC_ACTIVE_SCHOOLOGY' });
    if (!result?.ok) {
      messageEl.className = 'message error';
      messageEl.textContent = result?.message || 'Could not sync Schoology.';
      return;
    }

    const imported = Number(result.assignmentsImported || 0);
    const updated = Number(result.assignmentsUpdated || 0);
    const removed = Number(result.assignmentsRemoved || 0);
    const classes = Number(result.classesImported || 0);
    messageEl.className = 'message success';
    messageEl.textContent = `Synced ${classes} classes · ${imported + updated} upcoming items${removed ? ` · removed ${removed} completed` : ''}.`;
    await refresh();
  } catch (error) {
    messageEl.className = 'message error';
    messageEl.textContent = error?.message || 'Could not sync Schoology.';
  } finally {
    syncButton.disabled = false;
  }
});

refresh();
