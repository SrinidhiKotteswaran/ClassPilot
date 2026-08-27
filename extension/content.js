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

  function parseDate(value) {
    if (value === null || value === undefined || value === '') return null;
    const stringValue = String(value).trim();
    if (/^\d{10}$/.test(stringValue)) return new Date(Number(stringValue) * 1000).toISOString();
    if (/^\d{13}$/.test(stringValue)) return new Date(Number(stringValue)).toISOString();
    const parsed = Date.parse(stringValue);
    return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }

  const monthKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

  function looksLikeRealCourseTitle(title) {
    if (!title || title.length < 2) return false;
    return !/^(home|materials|grades|calendar|members|more|view course|course dashboard|recent activity|to do)$/i.test(title);
  }

  function cleanCourseTitle(title) {
    return String(title || '')
      .replace(/\s+/g, ' ')
      .replace(/^\s*[•·|:-]+\s*/, '')
      .replace(/\s+(materials|grades|calendar|members|more)\s*$/i, '')
      .trim().slice(0, 300);
  }

  function addCourse(out, id, title, url) {
    if (!id) return;
    const cleaned = cleanCourseTitle(title);
    if (!looksLikeRealCourseTitle(cleaned)) return;
    const existing = out.get(id);
    if (!existing || (existing.title.startsWith('Schoology class ') && cleaned.length > 0)) {
      out.set(id, { schoologyId: id, title: cleaned, url: url || `${location.origin}/course/${id}` });
    }
  }

  function parseCourses(doc, baseUrl) {
    const out = new Map();
    doc.querySelectorAll('a[href*="/course/"], a[href*="/section/"], [data-course-id], [data-section-id]').forEach(el => {
      const href = el.getAttribute?.('href');
      const dataId = el.getAttribute?.('data-course-id') || el.getAttribute?.('data-section-id');
      const id = courseId(absolute(href)) || (dataId && /^\d+$/.test(dataId) ? dataId : null);
      if (!id) return;
      addCourse(out, id, text(el), absolute(href) || `${location.origin}/course/${id}`);
    });

    const currentId = courseId(baseUrl);
    if (currentId && !out.has(currentId)) {
      const heading = cleanCourseTitle(text(doc.querySelector('h1, [role="heading"]')) || text(doc.querySelector('title')).replace(/\s*[|–-].*$/, ''));
      addCourse(out, currentId, heading, baseUrl);
    }
    return [...out.values()];
  }

  function findCourseInEvent(event, coursesById) {
    if (!event) return '';
    const courseLink = event.querySelector('a[href*="/course/"], a[href*="/section/"]');
    const linkedId = courseId(absolute(courseLink?.getAttribute('href')) || '');
    if (linkedId) return linkedId;

    const courseText = text(event.querySelector('.realm-title-course, .realm-title-course-csl, [class*="course-title"], [class*="course-name"]'));
    if (courseText) {
      const match = courseText.match(/:\s*(\d+)\s*\d*\s+(.+?)(?:\s{2,}|$)/);
      if (match) {
        const candidateId = match[1];
        if (coursesById.has(candidateId)) return candidateId;
        const candidateTitle = cleanCourseTitle(match[2]);
        addCourse(coursesById, candidateId, candidateTitle, `${location.origin}/course/${candidateId}`);
        return candidateId;
      }
      const normalized = courseText.toLowerCase();
      const found = [...coursesById.values()].find(c => normalized.includes(c.title.toLowerCase()));
      if (found) return found.schoologyId;
    }

    const nearby = text(event);
    const normalized = nearby.toLowerCase();
    const found = [...coursesById.values()]
      .sort((a, b) => b.title.length - a.title.length)
      .find(c => normalized.includes(c.title.toLowerCase()));
    return found?.schoologyId || '';
  }

  function extractDueFromText(value) {
    const s = String(value || '').replace(/\s+/g, ' ').trim();
    const match = s.match(/Due\s+(?:on\s+)?((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+[A-Za-z]+\s+\d{1,2},\s+\d{4})(?:\s+at\s+([0-9]{1,2}:[0-9]{2}\s*(?:AM|PM)))?/i);
    if (!match) return null;
    const parsed = parseDate(`${match[1]} ${match[2] || '11:59 PM'}`);
    return parsed;
  }

  function parseAssignmentLinks(doc, coursesById) {
    const out = new Map();
    const now = Date.now();
    doc.querySelectorAll('a[href*="/assignment/"]').forEach(a => {
      const href = absolute(a.getAttribute('href'));
      const id = assignmentId(href);
      if (!id) return;
      const event = a.closest('.upcoming-event, .upcoming-item, .sExtlink, li, td, tr, article, [role="gridcell"], .item, .s-ext-list-item, .s-todo-item') || a.parentElement;
      const nearby = text(event || a.parentElement);
      let dueAt = null;

      let node = a;
      for (let depth = 0; node && depth < 14; depth += 1, node = node.parentElement) {
        for (const attr of ['data-date', 'data-start', 'data-datetime', 'datetime', 'title']) {
          const value = node.getAttribute?.(attr);
          const parsed = parseDate(value);
          if (parsed) { dueAt = parsed; break; }
        }
        if (dueAt) break;
      }
      if (!dueAt) dueAt = extractDueFromText(nearby);
      if (!dueAt) return;
      const dueMs = Date.parse(dueAt);
      if (Number.isNaN(dueMs) || dueMs < now - 60 * 60 * 1000) return;

      const courseSchoologyId = findCourseInEvent(event, coursesById);
      if (!courseSchoologyId || !coursesById.has(courseSchoologyId)) return;

      out.set(id, {
        schoologyId: id,
        courseSchoologyId,
        title: text(a).slice(0, 500) || `Assignment ${id}`,
        description: nearby.slice(0, 1000),
        dueAt,
        category: 'preparatory',
        pointsValue: 0,
        isMissing: /\bmissing\b/i.test(nearby),
        url: href,
        source: 'schoology'
      });
    });
    return [...out.values()];
  }

  async function fetchDoc(path) {
    const url = absolute(path);
    if (!url) throw new Error('Invalid Schoology URL.');
    const response = await fetch(url, { credentials: 'include', headers: { Accept: 'text/html' } });
    if (!response.ok) throw new Error(`Schoology returned ${response.status}`);
    return { doc: new DOMParser().parseFromString(await response.text(), 'text/html'), url: response.url || url };
  }

  async function collect() {
    const coursesById = new Map();
    const assignmentsById = new Map();

    // Pull course identities from multiple Schoology surfaces. Course Dashboard
    // can be incomplete for a student's active sections, so never treat its list
    // as authoritative by itself.
    const coursePaths = ['/home/course-dashboard', '/courses', '/home'];
    for (const path of coursePaths) {
      try {
        const result = path === '/home' && location.pathname === '/home'
          ? { doc: document, url: location.href }
          : await fetchDoc(path);
        parseCourses(result.doc, result.url).forEach(course => coursesById.set(course.schoologyId, course));
        parseAssignmentLinks(result.doc, coursesById).forEach(item => assignmentsById.set(item.schoologyId, item));
      } catch (_) {}
    }

    // Always parse the currently visible Schoology document too; this catches
    // To Do cards and assignment widgets that are not present in fetched pages.
    parseCourses(document, location.href).forEach(course => coursesById.set(course.schoologyId, course));
    parseAssignmentLinks(document, coursesById).forEach(item => assignmentsById.set(item.schoologyId, item));

    // Calendar is used as a second assignment source. Keep the next three months
    // so a sync from any Schoology page does not lose upcoming work.
    try {
      const calendar = await fetchDoc('/calendar');
      const href = [...calendar.doc.querySelectorAll('a[href*="/calendar/"]')].map(a => absolute(a.getAttribute('href'))).find(Boolean) || calendar.url;
      const match = href.match(/\/calendar\/(\d+)\/(\d{4})-(\d{2})/i);
      if (match) {
        const userId = match[1];
        const start = new Date(Number(match[2]), Number(match[3]) - 1, 1);
        for (let offset = 0; offset < 3; offset += 1) {
          const d = new Date(start.getFullYear(), start.getMonth() + offset, 1);
          const key = monthKey(d);
          try {
            const result = offset === 0 && /\/calendar\/\d+\/\d{4}-\d{2}/i.test(location.pathname)
              ? { doc: document }
              : await fetchDoc(`/calendar/${userId}/${key}`);
            parseAssignmentLinks(result.doc, coursesById).forEach(item => assignmentsById.set(item.schoologyId, item));
          } catch (_) {}
        }
      }
    } catch (_) {}

    return {
      courses: [...coursesById.values()],
      assignments: [...assignmentsById.values()],
      schoolName: location.hostname,
      calendarSync: true
    };
  }

  let syncInFlight = null;
  async function sync() {
    if (syncInFlight) return syncInFlight;
    syncInFlight = (async () => {
      button.disabled = true;
      button.textContent = 'Syncing…';
      status.textContent = 'Reading your Schoology courses and assignments…';
      sub.textContent = 'Secure connection';
      try {
        const payload = await collect();
        status.textContent = `Found ${payload.courses.length} classes and ${payload.assignments.length} upcoming items. Connecting…`;
        const result = await chrome.runtime.sendMessage({ type: 'CONNECT_AND_SYNC', payload });
        if (!result?.ok) throw new Error(result?.message || 'Could not connect to ClassPilot.');
        status.textContent = `Synced ${result.classesImported ?? payload.courses.length} classes · ${(result.assignmentsImported ?? 0) + (result.assignmentsUpdated ?? 0)} upcoming items.`;
        sub.textContent = 'Connected · automatic sync on';
        button.textContent = 'Sync now';
        return result;
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : 'Sync could not be completed.';
        sub.textContent = 'Needs attention';
        button.textContent = 'Connect & sync';
        return { ok: false, message: status.textContent };
      } finally {
        button.disabled = false;
        syncInFlight = null;
      }
    })();
    return syncInFlight;
  }

  button.addEventListener('click', sync);
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'SYNC_NOW') return false;
    sync().then(sendResponse).catch(error => sendResponse({ ok: false, message: error?.message || 'Schoology sync failed.' }));
    return true;
  });

  sync();
  setInterval(sync, 10 * 60 * 1000);
})();