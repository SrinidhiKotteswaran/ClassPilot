(() => {
  function readSupabaseSession() {
    const prefix = 'sb-ixolapnghbfpmspdpesn-auth-token';
    const raw = window.localStorage.getItem(prefix);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      const session = parsed?.currentSession || parsed;
      if (session?.access_token && session?.user?.id) return session;
    } catch (_) {}
    return null;
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'REQUEST_AUTH') return;
    const session = readSupabaseSession();
    if (!session) {
      sendResponse({ ok: false, message: 'No active ClassPilot session found.' });
      return true;
    }
    chrome.runtime.sendMessage({ type: 'SET_AUTH', accessToken: session.access_token, userId: session.user.id })
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false, message: 'Could not save the ClassPilot connection.' }));
    return true;
  });
})();
