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
  const calendarPath = value => String(value || '').match(/\/calendar\/(\d+)\/(\d{4})-(\d{2})(?:[/?#]|$)/i);
  const parseDate = value => { const parsed = Date.parse(value); return Number.isNaN(parsed) ? null : new Date(parsed).toISOString(); };
  const monthKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

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

  function calendarUserAndMonth(url) {
    const match = calendarPath(url);
    return match ? { userId: match[1], month: `${match[2]}-${match[3]}` } : null;
  }

  function eventDate(anchor, pageMonth) {
    let node = anchor;
    for (let depth = 0; node && depth < 12; depth += 1, node = node.parentElement) {
      for (const attr of ['data-date', 'data-start', 'data-datetime', 'datetime', 'title']) {
        const value = node.getAttribute?.(attr);
        if (!value) continue;
        const parsed = parseDate(value);
        if (parsed) return parsed;
      }

      const numericDay = node.getAttribute?.('data-day');
      if (numericDay && /^\d{1,2}$/.test(numericDay)) {
        const day = Number(numericDay);
        if (day >= 1 && day <= 31) {
          const [year, month] = pageMonth.split('-').map(Number);
          const candidate = new Date(year, month - 1, day, 23, 59, 59);
          if (!Number.isNaN(candidate.getTime())) return candidate.toISOString();
        }
      }
    }

    const cell = anchor.closest('td, [role="gridcell"], .fc-day, .calendar-day');
    if (cell) {
      for (const attr of ['data-date', 'data-start', 'datetime']) {
        const value = cell.getAttribute?.(attr);
        if (!value) continue;
        const parsed = parseDate(value);
        if (parsed) return parsed;
      }

      const numericDay = cell.getAttribute?.('data-day');
      if (numericDay && /^\d{1,2}$/.test(numericDay)) {
        const day = Number(numericDay);
        if (day >= 1 && day <= 31) {
          const [year, month] = pageMonth.split('-').map(Number);
          const candidate = new Date(year, month - 1, day, 23, 59, 59);
          if (!Number.isNaN(candidate.getTime())) return candidate.toISOString();
        }
      }

      const dayMatch = text(cell).match(/(?:^|\s)([1-9]|[12]\d|3[01])(?:\s|$)/);
      if (dayMatch) {
        const [year, month] = pageMonth.split('-').map(Number);
        const candidate = new Date(year, month - 1, Number(dayMatch[1]), 23, 59, 59);
        if (!Number.isNaN(candidate.getTime())) return candidate.toISOString();
      }
    }
    return null;
  }

  function parseCalendarAssignments(doc, coursesById, pageMonth) {
    const out = new Map();
    const links = [...doc.querySelectorAll('a[href*="/assignment/"]')];
    const now = Date.now();

    links.forEach(a => {
      const href = absolute(a.getAttribute('href'));
      const id = assignmentId(href);
      if (!id) return;

      const title = text(a) || `Assignment ${id}`;
      const parent = a.closest('li, td, tr, article, [role="gridcell"], .item, .s-ext-list-item') || a.parentElement;
      const nearby = text(parent);
      const dueAt = eventDate(a, pageMonth);
      const dueMs = dueAt ? Date.parse(dueAt) : NaN;

      if (!dueAt || Number.isNaN(dueMs) || dueMs < now - 60 * 60 * 1000) return;
      if (/\b(?:submitted|completed|turned in|already submitted)\b/i.test(nearby)) return;

      const courseLink = parent?.querySelector('a[href*="/course/"], a[href*="/section/"]');
      let courseSchoologyId = courseId(absolute(courseLink?.getAttribute('href')) || '') || '';
      if (!courseSchoologyId) {
        const normalized = nearby.toLowerCase();
        const match = [...coursesById.values()].find(course => normalized.includes(course.title.toLowerCase()));
        courseSchoologyId = match?.schoologyId || '';
      }
      if (!courseSchoologyId) return;

      const course = coursesById.get(courseSchoologyId);
      if (!course) return;

      out.set(id, {
        schoologyId: id,
        courseSchoologyId,
        title: title.slice(0, 500),
        description: nearby.slice(0, 1000),
        dueAt,
        category: 'preparatory',
        pointsValue: 0,
        isMissing: /missing|overdue/i.test(nearby),
        url: href,
        source: 'calendar'
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

  async function isAssignmentSubmitted(item) {
    try {
      const { doc } = await fetchDoc(item.url);
      const body = text(doc.body);
      const controls = [...doc.querySelectorAll('a, button, input, [role="button"]')]
        .map(el => text(el) || el.getAttribute?.('value') || el.getAttribute?.('aria-label') || '')
        .join(' ');
      const combined = `${body} ${controls}`;

      if (/\b(?:re-submit assignment|resubmit assignment|assignment submitted|submission details|view submission)\b/i.test(combined)) return true;
      if (/\bsubmitted!\b/i.test(combined)) return true;
      if (/\bsubmit assignment\b/i.test(combined) && !/\b(?:re-submit|resubmit) assignment\b/i.test(combined)) return false;
      return false;
    } catch (_) {
      return false;
    }
  }

  async function filterSubmitted(assignments) {
    const results = await Promise.all(assignments.map(async item => ({ item, submitted: await isAssignmentSubmitted(item) })));
    return results.filter(result => !result.submitted).map(result => result.item);
  }

  async function collect() {
    const sources = [{ doc: document, url: location.href }];
    const candidatePaths = ['/home/course-dashboard', '/home', '/courses'];
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

    let calendarSeed;
    try {
      calendarSeed = calendarUserAndMonth(location.href);
      if (!calendarSeed) {
        const calendarResult = await fetchDoc('/calendar');
        calendarSeed = calendarUserAndMonth(calendarResult.url) || calendarUserAndMonth([...calendarResult.doc.querySelectorAll('a[href*="/calendar/"]')].map(a => a.href).find(Boolean));
        if (!calendarSeed) throw new Error('Could not determine Schoology calendar.');
      }
    } catch (_) {
      throw new Error('Could not open the Schoology calendar. Open Calendar in Schoology and try again.');
    }

    const [year, month] = calendarSeed.month.split('-').map(Number);
    const assignmentsById = new Map();
    let calendarWindowEnd = null;
    let calendarMonthsFetched = 0;
    for (let offset = 0; offset < 3; offset += 1) {
      const monthDate = new Date(year, month - 1 + offset, 1);
      const key = monthKey(monthDate);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);
      calendarWindowEnd = monthEnd.toISOString();
      const path = `/calendar/${calendarSeed.userId}/${key}`;
      try {
        const result = offset === 0 && calendarUserAndMonth(location.href)?.month === key
          ? { doc: document, url: location.href }
          : await fetchDoc(path);
        parseCalendarAssignments(result.doc, coursesById, key).forEach(item => assignmentsById.set(item.schoologyId, item));
        calendarMonthsFetched += 1;
      } catch (_) {}
    }

    if (calendarMonthsFetched < 1) throw new Error('Could not read your Schoology calendar.');

    const upcoming = await filterSubmitted([...assignmentsById.values()]);
    return {
      courses,
      assignments: upcoming,
      schoolName: location.hostname,
      calendarSync: true,
      calendarMonthsFetched,
      calendarWindowEnd
    };
  }

  let syncInFlight = null;
  async function sync() {
    if (syncInFlight) return syncInFlight;
    syncInFlight = (async () => {
      button.disabled = true; button.textContent = 'Syncing…'; status.textContent = 'Reading your Schoology calendar…'; sub.textContent = 'Secure connection';
      try {
        const payload = await collect();
        status.textContent = `Found ${payload.courses.length} classes and ${payload.assignments.length} upcoming items. Connecting…`;
        let result;
        try {
          result = await chrome.runtime.sendMessage({ type:'CONNECT_AND_SYNC', payload });
        } catch (error) {
          const message = String(error?.message || error || 'Extension connection was interrupted.');
          if (/Extension context invalidated/i.test(message)) throw new Error('Extension was updated. Reload this Schoology tab and try again.');
          throw error;
        }
        if (!result?.ok) throw new Error(result?.message || 'Could not connect to ClassPilot.');
        status.textContent = `Synced ${result.classesImported ?? payload.courses.length} classes · ${(result.assignmentsImported ?? 0) + (result.assignmentsUpdated ?? 0)} upcoming items${result.assignmentsRemoved ? ` · removed ${result.assignmentsRemoved} completed` : ''}.`;
        sub.textContent = 'Connected · automatic sync on'; button.textContent = 'Sync now';
        return result;
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : 'Sync could not be completed.';
        sub.textContent = 'Needs attention'; button.textContent = 'Connect & sync';
        return { ok: false, message: status.textContent };
      } finally {
        button.disabled = false;
        syncInFlight = null;
      }
    })();
    return syncInFlight;
  }

  button.addEventListener('click', sync);

  // The extension popup/background asks the already-open Schoology tab to sync.
  // This listener MUST return the async result; without sendResponse(),
  // chrome.tabs.sendMessage() resolves with undefined and the popup reports
  // "Could not sync Schoology" even though the sync is running.
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'SYNC_NOW') return false;
    sync().then(result => sendResponse(result)).catch(error => {
      sendResponse({ ok: false, message: error?.message || 'Schoology sync failed.' });
    });
    return true;
  });

  sync();
  setInterval(sync, 10 * 60 * 1000);
})();
