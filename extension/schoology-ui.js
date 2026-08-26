(() => {
  if (window.top !== window) return;
  const ROOT_ID = 'classpilot-schoology-sync';
  const FAB_ID = 'classpilot-schoology-fab';
  const MINIMIZED_KEY = 'classpilot-schoology-minimized';

  const style = document.createElement('style');
  style.textContent = `
    #${ROOT_ID} .cp-header { cursor: default; }
    #${ROOT_ID} .cp-minimize { margin-left:auto;width:28px;height:28px;border:0;border-radius:8px;background:#f1f5f9;color:#475569;font-size:18px;line-height:1;cursor:pointer; }
    #${ROOT_ID} .cp-minimize:hover { background:#e2e8f0; }
    #${FAB_ID} { position:fixed;right:18px;bottom:18px;z-index:2147483647;width:44px;height:44px;border:1px solid #dbe3ee;border-radius:14px;background:#fff;color:#111827;box-shadow:0 8px 24px rgba(15,23,42,.14);font:800 16px/1 system-ui,-apple-system,sans-serif;cursor:pointer;display:grid;place-items:center; }
    #${FAB_ID}:hover { transform:translateY(-1px);box-shadow:0 10px 28px rgba(15,23,42,.18); }
  `;
  document.documentElement.appendChild(style);

  function getRoot() { return document.getElementById(ROOT_ID); }

  function makeFab() {
    let fab = document.getElementById(FAB_ID);
    if (fab) return fab;
    fab = document.createElement('button');
    fab.id = FAB_ID;
    fab.type = 'button';
    fab.title = 'Open ClassPilot';
    fab.setAttribute('aria-label', 'Open ClassPilot');
    fab.textContent = 'C';
    fab.addEventListener('click', () => {
      localStorage.setItem(MINIMIZED_KEY, 'false');
      applyState();
    });
    document.body.appendChild(fab);
    return fab;
  }

  function addControls(root) {
    if (root.querySelector('.cp-minimize')) return;
    const header = root.firstElementChild;
    if (!header) return;
    header.classList.add('cp-header');
    const button = document.createElement('button');
    button.className = 'cp-minimize';
    button.type = 'button';
    button.title = 'Minimize ClassPilot';
    button.setAttribute('aria-label', 'Minimize ClassPilot');
    button.textContent = '−';
    button.addEventListener('click', () => {
      localStorage.setItem(MINIMIZED_KEY, 'true');
      applyState();
    });
    header.appendChild(button);
  }

  function applyState() {
    const root = getRoot();
    const minimized = localStorage.getItem(MINIMIZED_KEY) === 'true';
    if (minimized) {
      makeFab();
      if (root) root.style.display = 'none';
      const fab = document.getElementById(FAB_ID);
      if (fab) fab.style.display = 'grid';
      return;
    }
    if (!root) return;
    addControls(root);
    root.style.display = 'block';
    const fab = document.getElementById(FAB_ID);
    if (fab) fab.style.display = 'none';
  }

  const observer = new MutationObserver(() => {
    const root = getRoot();
    if (root) { addControls(root); applyState(); }
  });

  function start() {
    if (!document.body) return;
    const root = getRoot();
    if (root) addControls(root);
    applyState();
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
