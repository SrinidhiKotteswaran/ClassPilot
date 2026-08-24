const statusEl = document.getElementById('status');
const countsEl = document.getElementById('counts');
const connectButton = document.getElementById('connect');
const syncButton = document.getElementById('sync');
const messageEl = document.getElementById('message');

async function refresh() {
  const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
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
  messageEl.className = 'message';
  messageEl.textContent = 'Switch to an open Schoology tab to sync.';
  const result = await chrome.runtime.sendMessage({ type: 'SYNC_ACTIVE_SCHOOLOGY' });
  if (!result?.ok) { messageEl.className = 'message error'; messageEl.textContent = result?.message || 'Could not sync Schoology.'; }
  else { messageEl.className = 'message success'; messageEl.textContent = result.message || 'Sync started.'; }
  await refresh();
});

refresh();
