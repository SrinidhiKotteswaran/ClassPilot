(() => {
  if (window.top !== window) return;
  const ROOT_ID = 'classpilot-schoology-sync';
  if (document.getElementById(ROOT_ID)) return;

  const root = document.createElement('div');
  root.id = ROOT_ID;
  Object.assign(root.style, {
    position: 'fixed', right: '20px', bottom: '20px', zIndex: '2147483647',
    width: '310px', padding: '15px 16px', borderRadius: '16px',
    background: '#fff', color: '#0f172a', font: '14px/1.4 system-ui,-apple-system,sans-serif',
    border: '1px solid #dbe3ee', boxShadow: '0 12px 40px rgba(15,23,42,.14)'
  });
  root.innerHTML = `<div style="display:flex;align-items:center;gap:9px"><div style="width:30px;height:30px;border-radius:9px;background:#111827;color:#fff;display:grid;place-items:center;font-weight:800">C</div><div><div style="font-weight:800">ClassPilot</div><div id="cp-sub" style="font-size:11px;color:#64748b">Official Schoology sync</div></div></div><div id="cp-status" style="margin-top:10px;color:#475569">Preparing Schoology sync…</div><button id="cp-sync" style="width:100%;margin-top:10px;padding:9px 12px;border:0;border-radius:10px;background:#111827;color:#fff;font-weight:700;cursor:pointer">Connect & sync</button><div style="margin-top:8px;font-size:10px;color:#64748b">Your Schoology password is never read or stored by ClassPilot.</div>`;
  document.body.appendChild(root);

  const status = root.querySelector('#cp-status');
  const button = root.querySelector('#cp-sync');
  const sub = root.querySelector('#cp-sub');
  const text = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const absolute = href => { try { return new URL(href, location.href).href; } catch { return null; } };
  const courseId = href => String(href || '').match(/\/(?:course|section)\/(\d+)(?:[/?#]|$)/i)?.[1] || null;
  const assignmentId = href => String(href || '').match(/\/assignment\/(\d+)(?:[/?#]|$)/i)?.[1] || null;
  const parseDate = value => { const parsed = Date.parse(value); return Number.isNaN(parsed) ? null : new Date(parsed).toISOString(); };

  function parseCourses(doc, baseUrl) {
    const out = new Map();
    const selectors = [
      'a[href*="/course/"]', 'a[href*="/section/"]',
      '[data-course-id]', '[data-section-id]', '[data-id][data-course]'
    ].join(',');
    doc.querySelectorAll(selectors).forEach(el => {
      const href = el.getAttribute?.('href');
      const dataId = el.getAttribute?.('data-course-id') || el.getAttribute?.('data-section-id');
      const id = courseId(absolute(href)) || (dataId && /^\d+$/.test(dataId) ? dataId : null);
      if (!id) return;
      const title = text(el) || text(el.closest('[data-course-id], [data-section-id]')) || id;
      if (title.length < 2 || /^(home|materials|grades|calendar|members|more|view course)$/i.test(title)) return;
      out.set(id, { schoologyId: id, title: title.slice(0, 300), url: absolute(href) || `${location.origin}/course/${id}` });
    });

    const currentId = courseId(baseUrl);
    if (currentId && !out.has(currentId)) {
      const heading = text(doc.querySelector('h1, [role="heading"]')) || text(doc.querySelector('title')).replace(/\s*[|–-].*$/, '');
      if (heading) out.set(currentId, { schoologyId: currentId, title: heading.slice(0, 300), url: baseUrl });
    }
    return [...out.values()];
  }

  function parseUpcomingAssignments(doc, coursesById) {
    const out = new Map();
    const links = [...doc.querySelectorAll('a[href*="/assignment/"]')];
    links.forEach(a => {
      const href = absolute(a.getAttribute('href')); const id = assignmentId(href); if (!id) return;
      const title = text(a) || `Assignment ${id}`;
      const parent = a.closest('li, tr, article, .item, .s-ext-list-item') || a.parentElement;
      const nearby = text(parent);
      if (/\b(?:submitted|completed|turned in|already submitted|recently completed)\b/i.test(nearby)) return;

      // Only import assignments that appear in Schoology's active To Do / Upcoming
      // area. This prevents historical course assignments from entering ClassPilot.
      let node = a;
      let isUpcoming = false;
      for (let depth = 0; node && depth < 10; depth += 1, node = node.parentElement) {
        const blockText = text(node).slice(0, 8000);
        if (/\bRECENTLY COMPLETED\b/i.test(blockText)) continue;
        if (/\bUPCOMING\b/i.test(blockText)) { isUpcoming = true; break; }
      }
      if (!isUpcoming) return;

      const courseLink = parent?.querySelector('a[href*="/course/"], a[href*="/section/"]');
      let courseSchoologyId = courseId(absolute(courseLink?.getAttribute('href')) || '') || '';
      if (!courseSchoologyId) {
        // Some Schoology To Do rows put the course name beside the assignment
        // rather than linking it. Match that visible course name to our discovered courses.
        const normalized = nearby.toLowerCase();
        const match = [...coursesById.values()].find(course => normalized.includes(course.title.toLowerCase()));
        courseSchoologyId = match?.schoologyId || '';
      }
      if (!courseSchoologyId) return;

      const course = coursesById.get(courseSchoologyId);
      if (!course) return;
      const dateMatch = nearby.match(/(?:due|due date)[:\s]+([^|·]{3,100})/i);
      const dueAt = dateMatch ? parseDate(dateMatch[1]) : null;
      out.set(id, { schoologyId:id, courseSchoologyId, title:title.slice(0,500), description:nearby.slice(0,1000), dueAt, category:'preparatory', pointsValue:0, isMissing:/missing|overdue/i.test(nearby), url:href });
    });
    return [...out.values()];
  }

  async function fetchDoc(path) {
    const url = absolute(path);
    if (!url) throw new Error('Invalid Schoology URL.');
    const response = await fetch(url, { credentials: 'include', headers: { Accept: 'text/html' } });
    if (!response.ok) throw new Error(`Schoology returned ${response.status}`);
    return { doc: new DOMParser().parseFromString(await response.text(), 'text/html'), url };
  }

  async function collect() {
    const sources = [{ doc: document, url: location.href }];
    const candidatePaths = [
      '/home/course-dashboard', '/home', '/courses', '/home/course-dashboard?view=all'
    ];
    for (const path of candidatePaths) {
      if (new URL(path, location.origin).pathname === location.pathname) continue;
      sources.push({ path });
    }

    const coursesById = new Map();
    for (const source of sources) {
      try {
        const result = source.doc ? source : await fetchDoc(source.path);
        parseCourses(result.doc, result.url).forEach(course => coursesById.set(course.schoologyId, course));
      } catch (_) {}
    }

    const courses = [...coursesById.values()];
    if (!courses.length) throw new Error('No Schoology classes were found. Open your Schoology home page and try again.');

    // Schoology's home To Do list is the source of truth for active work. Do not
    // crawl course Materials pages because those contain completed historical work.
    let assignments = [];
    try {
      const homeResult = location.pathname === '/home' ? { doc: document, url: location.href } : await fetchDoc('/home');
      assignments = parseUpcomingAssignments(homeResult.doc, coursesById);
    } catch (_) {}

    return { courses, assignments, schoolName:location.hostname };
  }

  async function sync() {
    button.disabled = true; button.textContent = 'Syncing…'; status.textContent = 'Reading your Schoology classes and assignments…'; sub.textContent = 'Secure connection';
    try {
      const payload = await collect();
      status.textContent = `Found ${payload.courses.length} classes and ${payload.assignments.length} assignments. Connecting…`;
      const result = await chrome.runtime.sendMessage({ type:'CONNECT_AND_SYNC', payload });
      if (!result?.ok) throw new Error(result?.message || 'Could not connect to ClassPilot.');
      status.textContent = `Synced ${result.classesImported ?? payload.courses.length} classes · ${(result.assignmentsImported ?? 0) + (result.assignmentsUpdated ?? 0)} assignments.`;
      sub.textContent = 'Connected · automatic sync on'; button.textContent = 'Sync now';
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Sync could not be completed.';
      sub.textContent = 'Needs attention'; button.textContent = 'Connect & sync';
    } finally { button.disabled = false; }
  }

  button.addEventListener('click', sync);
  chrome.runtime.onMessage.addListener(message => { if (message?.type === 'SYNC_NOW') sync(); });
  sync();
  setInterval(sync, 10 * 60 * 1000);
})();
