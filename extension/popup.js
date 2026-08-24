const statusEl = document.getElementById('status');
const countsEl = document.getElementById('counts');
const button = document.getElementById('import');
const messageEl = document.getElementById('message');

async function loadPending() {
  const { classPilotPendingImport } = await chrome.storage.local.get('classPilotPendingImport');
  if (!classPilotPendingImport) return null;
  statusEl.textContent = 'Schoology data is ready.';
  countsEl.textContent = `${classPilotPendingImport.courses?.length || 0} classes · ${classPilotPendingImport.assignments?.length || 0} assignments`;
  countsEl.classList.remove('hidden');
  return classPilotPendingImport;
}

button.addEventListener('click', async () => {
  messageEl.textContent = '';
  button.disabled = true;
  try {
    const payload = await loadPending();
    if (!payload) throw new Error('Prepare an import from a Schoology tab first.');
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'classpilot-schoology-import.json';
    a.click();
    URL.revokeObjectURL(url);
    messageEl.className = 'message success';
    messageEl.textContent = 'Export ready. Upload this file in ClassPilot Settings to import it.';
  } catch (error) {
    messageEl.className = 'message error';
    messageEl.textContent = error instanceof Error ? error.message : 'Could not prepare the export.';
  } finally { button.disabled = false; }
});
loadPending();
