(() => {
  if (window.top !== window) return;
  const ROOT_ID = 'classpilot-schoology-sync';
  if (document.getElementById(ROOT_ID)) return;

  const root = document.createElement('div');
  root.id = ROOT_ID;
  Object.assign(root.style, {
    position: 'fixed', right: '20px', bottom: '20px', zIndex: '2147483647',
    width: '300px', padding: '14px 16px', borderRadius: '16px',
    background: '#ffffff', color: '#0f172a', font: '14px/1.4 system-ui,-apple-system,sans-serif',
    border: '1px solid #e2e8f0', boxShadow: '0 12px 40px rgba(15,23,42,.16)'
  });
  root.innerHTML = `<div style="display:flex;align-items:center;gap:9px"><div style="width:30px;height:30px;border-radius:9px;background:#0f172a;color:#fff;display:grid;place-items:center;font-weight:800">C</div><div><div style="font-weight:800">ClassPilot</div><div id="cp-sub" style="font-size:11px;color:#64748b">Schoology sync</div></div></div><div id="cp-status" style="margin-top:10px;color:#475569">Checking your Schoology data…</div><button id="cp-sync" style="width:100%;margin-top:10px;padding:9px 12px;border:0;border-radius:10px;background:#0f172a;color:#fff;font-weight:700;cursor:pointer">Sync now</button>`;
  document.body.appendChild(root);

  const status = root.querySelector('#cp-status');
  const button = root.querySelector('#cp-sync');
  const sub = root.querySelector('#cp-sub');
  const text = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const absolute = href => { try { return new URL(href, location.href).href; } catch { return null; } };
  const courseId = href => String(href || '').match(/\/(?:course|section)\/(\d+)/i)?.[1] || null;
  const assignmentId = href => String(href || '').match(/\/assignment\/(\d+)/i)?.[1] || null;
  const parseDate = value => { const parsed = Date.parse(value); return Number.isNaN(parsed) ? null : new Date(parsed).toISOString(); };

  function parseCourses(doc, baseUrl) {
    const out = new Map();
    doc.querySelectorAll('a[href]').forEach(a => {
      const href = absolute(a.getAttribute('href')); const id = courseId(href); if (!id) return;
      const title = text(a) || id;
      if (title.length < 2 || /home|materials|grades|calendar|members/i.test(title)) return;
      out.set(id, { schoologyId: id, title: title.slice(0, 300), url: href });
    });
    const currentId = courseId(baseUrl);
    if (currentId && !out.has(currentId)) {
      const heading = text(doc.querySelector('h1, [role="heading"]')) || text(doc.querySelector('title')).replace(/\s*[|–-].*$/, '');
      if (heading) out.set(currentId, { schoologyId: currentId, title: heading.slice(0, 300), url: baseUrl });
    }
    return [...out.values()];
  }

  function parseAssignments(doc, course) {
    const out = [];
    doc.querySelectorAll('a[href]').forEach(a => {
      const href = absolute(a.getAttribute('href')); const id = assignmentId(href); if (!id) return;
      const title = text(a) || `Assignment ${id}`;
      const parent = a.closest('li, tr, article, .item, .material, .s-ext-list-item') || a.parentElement;
      const nearby = text(parent);
      const dateMatch = nearby.match(/(?:due|due date)[:\s]+([^|·]{3,60})/i);
      out.push({ schoologyId: id, courseSchoologyId: course.schoologyId, title: title.slice(0, 500), description: nearby.slice(0, 1000), dueAt: dateMatch ? parseDate(dateMatch[1]) : null, category: 'preparatory', pointsValue: 0, isMissing: /missing|overdue/i.test(nearby), url: href });
    });
    return out;
  }

  async function fetchDoc(url) {
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) throw new Error(`Schoology returned ${response.status}`);
    return new DOMParser().parseFromString(await response.text(), 'text/html');
  }

  async function collect() {
    const courses = parseCourses(document, location.href);
    if (!courses.length) throw new Error('No Schoology courses found on this page.');
    const assignments = []; const seen = new Set();
    for (const course of courses.slice(0, 50)) {
      try {
        const doc = course.url === location.href ? document : await fetchDoc(course.url);
        parseAssignments(doc, course).forEach(a => { if (!seen.has(a.schoologyId)) { seen.add(a.schoologyId); assignments.push(a); } });
      } catch (_) {}
    }
    return { courses, assignments, schoolName: location.hostname };
  }

  async function sync() {
    button.disabled = true; button.textContent = 'Syncing…'; status.textContent = 'Reading your Schoology classes and assignments…';
    try {
      const payload = await collect();
      const result = await chrome.runtime.sendMessage({ type: 'SCHOOLYOGY_DATA', payload });
      if (!result?.ok) throw new Error(result?.message || 'Connect ClassPilot once from the extension menu.');
      status.textContent = `Synced ${payload.courses.length} classes · ${payload.assignments.length} assignments.`;
      sub.textContent = 'Connected · automatic sync on'; button.textContent = 'Sync now';
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Sync could not be completed.';
      sub.textContent = 'Needs connection'; button.textContent = 'Connect & sync';
    } finally { button.disabled = false; }
  }

  button.addEventListener('click', sync);
  chrome.runtime.onMessage.addListener(message => { if (message?.type === 'SYNC_NOW') sync(); });
  sync();
  setInterval(sync, 10 * 60 * 1000);
})();
