import { login, logout, getUser, getSettings, handleAuthCallback, acceptInvite,
  recoverPassword, requestPasswordRecovery, updateUser, onAuthChange } from '@netlify/identity';

const app = document.getElementById('app');
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const kinds = { project: 'Projektangebot', partner: 'Baupartner', cooperation: 'Kooperation', contact: 'Kontakt' };
const statuses = { new: 'Neu', in_progress: 'In Bearbeitung', waiting: 'Wartet', done: 'Erledigt' };
const projects = { '': 'Ohne Projektbezug', nentershausen: 'Nentershausen', niedererbach: 'Niedererbach' };
const labels = { name: 'Ansprechpartner', email: 'E-Mail', phone: 'Telefon', company: 'Unternehmen', message: 'Nachricht',
  object_type: 'Objektart', postal_code: 'Postleitzahl', city: 'Ort', representative_role: 'Rolle', area: 'Fläche',
  planning_status: 'Planungsstand', trade: 'Fachgebiet', service_region: 'Einsatzregion', availability: 'Kapazitäten',
  reference_summary: 'Referenzen', cooperation_interest: 'Gesprächsanlass', subject: 'Betreff' };
const state = { demo: new URLSearchParams(location.search).get('demo') === '1', member: null, items: [], current: null,
  view: 'inbox', query: '', next: null, busy: false, dirty: false, ai: false };
let installPrompt = null;
const date = value => value ? new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value)) : '';
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());

function message(text, type = '') {
  const target = document.getElementById('notice') || document.getElementById('auth-notice');
  if (target) { target.textContent = text; target.className = 'notice ' + type; }
}
async function api(path, options = {}) {
  const response = await fetch('/api/portal/' + path, { credentials: 'same-origin', cache: 'no-store',
    ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Der Vorgang konnte nicht geladen werden.');
    error.status = response.status;
    throw error;
  }
  return data;
}
const post = (path, body, headers) => api(path, { method: 'POST', body: JSON.stringify(body), headers });
const options = (values, selected) => Object.entries(values).map(([key, label]) =>
  '<option value="' + esc(key) + '"' + (key === selected ? ' selected' : '') + '>' + esc(label) + '</option>').join('');

function renderAuth(mode = 'login', token = '') {
  state.current = null; state.items = []; state.member = null;
  const setup = mode !== 'login';
  app.innerHTML = '<div class="auth-shell"><section class="auth-brand">' +
    '<img src="/assets/images/logo-white.png" alt="RBS Projektentwicklung"><h1>Ein Eingang.<br>Ein klarer nächster Schritt.</h1>' +
    '<div class="gold-line"></div><p>Anfragen, Zuständigkeiten und vorbereitete Antworten. An einem Ort.</p></section>' +
    '<section class="auth-content"><div class="auth-card"><div class="eyebrow">RBS Arbeitsbereich</div>' +
    '<h2>' + (setup ? 'Zugang einrichten' : 'Willkommen zurück.') + '</h2><p class="muted">' +
    (setup ? 'Legen Sie Ihr persönliches Passwort fest.' : 'Melden Sie sich mit Ihrem freigegebenen Konto an.') + '</p>' +
    '<div id="auth-notice" class="notice" role="alert"></div><form id="auth-form">' +
    (!setup ? '<div class="field"><label for="login-email">E-Mail-Adresse</label><input id="login-email" name="email" type="email" autocomplete="username" required></div>' : '') +
    '<div class="field"><label for="login-password">Passwort</label><input id="login-password" name="password" type="password" autocomplete="' +
    (setup ? 'new-password' : 'current-password') + '" ' + (setup ? 'minlength="12"' : '') + ' required></div>' +
    (setup ? '<div class="field"><label for="login-repeat">Passwort wiederholen</label><input id="login-repeat" type="password" autocomplete="new-password" minlength="12" required></div><p class="small muted">Mindestens zwölf Zeichen. Das Passwort wählen und verwalten Sie selbst.</p>' : '') +
    '<button class="btn primary full" type="submit">' + (setup ? 'Passwort festlegen und öffnen' : 'Arbeitsbereich öffnen') + '</button></form>' +
    (!setup ? '<div class="auth-links"><button id="recover" class="text-button" type="button">Passwort vergessen?</button><a class="text-button" href="/portal/?demo=1">Beispieldaten ansehen</a></div>' : '') +
    '<div class="auth-footer"><a href="/">Zur Website</a><a href="/datenschutz">Datenschutz</a></div></div></section></div>';
  document.getElementById('auth-form').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.submitter;
    if (button.disabled) return;
    button.disabled = true;
    try {
      const password = document.getElementById('login-password').value;
      if (setup) {
        if (password !== document.getElementById('login-repeat').value) throw new Error('Die Passwörter stimmen nicht überein.');
        if (mode === 'invite') await acceptInvite(token, password);
        else await recoverPassword(token, password);
        history.replaceState(null, '', '/portal/');
      } else await login(document.getElementById('login-email').value.trim(), password);
      await beginApp();
    } catch (error) { message(error.message || 'Die Anmeldung war nicht erfolgreich.', 'error'); }
    finally { if (button.isConnected) button.disabled = false; }
  });
  document.getElementById('recover')?.addEventListener('click', async event => {
    const email = document.getElementById('login-email');
    if (!email.reportValidity()) return;
    event.target.disabled = true;
    try { await requestPasswordRecovery(email.value.trim()); message('Falls für diese Adresse ein Konto besteht, erhalten Sie eine E-Mail zum Zurücksetzen.', 'success'); }
    catch { message('Die Anfrage konnte gerade nicht übermittelt werden. Bitte später erneut versuchen.', 'error'); }
    finally { event.target.disabled = false; }
  });
}

function navCounts() {
  return { inbox: state.items.filter(c => c.status !== 'done').length,
    mine: state.items.filter(c => c.owner_id === state.member.id && c.status !== 'done').length,
    done: state.items.filter(c => c.status === 'done').length };
}
function renderShell() {
  const counts = navCounts();
  app.innerHTML = '<div class="app-shell' + (state.demo ? ' has-demo' : '') + '"><aside class="sidebar">' +
    '<img class="sidebar-logo" src="/assets/images/logo-white.png" alt="RBS Projektentwicklung"><h2>Arbeitsbereich</h2><nav class="nav" aria-label="Vorgänge">' +
    [['inbox', 'Eingang'], ['mine', 'Meine'], ['done', 'Erledigt']].map(([view, label]) =>
      '<button type="button" data-view="' + view + '" class="' + (state.view === view ? 'active' : '') + '">' + label +
      '<span class="count" id="count-' + view + '">' + counts[view] + '</span></button>').join('') + '</nav>' +
    '<div class="sidebar-bottom"><button type="button" data-action="install">Auf dem Handy speichern</button><button type="button" data-action="logout">Abmelden</button>' +
    '<div class="sidebar-user"><strong>' + esc(state.member.display_name) + '</strong><span>' + esc(state.member.email) + '</span></div></div></aside><main class="main">' +
    (state.demo ? '<div class="demo-banner"><span>Demo · erfundene Beispieldaten · Änderungen bleiben in dieser Ansicht</span><a href="/portal/">Zur Anmeldung</a></div>' : '') +
    '<header class="topbar"><div class="top-title"><img class="mobile-logo" src="/assets/icons/rbs-icon-192.png" alt=""><div><h1>Arbeitsbereich</h1><div class="topbar-sub" id="connection-status">' +
    (navigator.onLine ? 'RBS Projektentwicklung' : 'Offline · Speichern erfordert eine Verbindung') + '</div></div></div>' +
    '<div class="top-actions"><button type="button" class="btn quiet" data-action="settings">Konto</button><button type="button" class="btn primary" data-action="new">+ Neu</button></div></header>' +
    '<div id="notice" class="notice" role="alert"></div><div id="workspace" class="workspace"><section class="inbox" aria-label="Anfrageeingang">' +
    '<label for="search" class="small muted">Anfragen durchsuchen</label><input id="search" class="inbox-search" type="search" placeholder="Name, Ort oder Unternehmen …" value="' + esc(state.query) + '">' +
    '<div class="row small muted"><span id="inbox-caption">Gemeinsamer Eingang</span><button class="text-button" type="button" data-action="refresh">Aktualisieren</button></div>' +
    '<div id="case-list" class="case-list"></div><div id="pagination"></div></section><section id="case-detail" class="case-detail" aria-label="Vorgang">' +
    '<div class="empty"><img src="/assets/icons/rbs-icon-192.png" alt=""><h2>Alles für den nächsten Schritt.</h2><p>Öffnen Sie eine Anfrage. Originalangaben, Vorbereitung und Verlauf stehen zusammen bereit.</p></div></section></div></main></div>' +
    '<dialog id="new-dialog"><div class="close-row"><h2>Anfrage aufnehmen</h2><button class="btn quiet" type="button" data-close="new-dialog" aria-label="Schließen">×</button></div>' +
    '<form id="new-form"><div class="field"><label for="new-kind">Anfrageart</label><select id="new-kind" name="request_kind">' + options(kinds, 'contact') + '</select></div>' +
    '<div class="field"><label for="new-name">Ansprechpartner</label><input id="new-name" name="name" maxlength="250" required></div>' +
    '<div class="field"><label for="new-email">E-Mail-Adresse</label><input id="new-email" name="email" type="email" maxlength="254"></div>' +
    '<div class="field"><label for="new-company">Unternehmen / Ort</label><input id="new-company" name="company" maxlength="250"></div>' +
    '<div class="field"><label for="new-message">Anliegen</label><textarea id="new-message" name="message" maxlength="3000" required></textarea></div>' +
    '<div id="new-message-result" class="dialog-message" role="alert"></div><button class="btn primary full" type="submit">Anfrage speichern</button></form></dialog>' +
    '<dialog id="settings-dialog"><div class="close-row"><h2>Ihr Konto</h2><button class="btn quiet" type="button" data-close="settings-dialog" aria-label="Schließen">×</button></div>' +
    '<form id="profile-form"><div class="field"><label for="profile-name">Anzeigename</label><input id="profile-name" maxlength="100" value="' + esc(state.member.display_name) + '" required></div>' +
    '<button class="btn" type="submit">Namen speichern</button></form><hr><p class="small muted">Aktuelle Anmeldung: <span id="current-email">' + esc(state.member.email) + '</span></p>' +
    '<form id="email-form"><div class="field"><label for="new-login-email">Neue E-Mail-Adresse</label><input id="new-login-email" type="email" autocomplete="email" required></div>' +
    '<div class="field"><label for="confirm-password">Aktuelles Passwort zur Bestätigung</label><input id="confirm-password" type="password" autocomplete="current-password" required></div>' +
    '<p class="small muted">Die neue Adresse wird bestätigt. Ihre Vorgänge, Notizen und Zuständigkeiten bleiben erhalten.</p><button class="btn" type="submit">E-Mail-Änderung anfordern</button></form>' +
    '<div id="settings-result" class="dialog-message" role="status"></div><hr><button class="text-button" type="button" data-action="install">Auf dem Handy speichern</button> · ' +
    '<button class="text-button" type="button" data-action="logout">Abmelden</button></dialog>' +
    '<dialog id="install-dialog"><div class="close-row"><h2>RBS auf Ihrem Handy</h2><button class="btn quiet" type="button" data-close="install-dialog" aria-label="Schließen">×</button></div>' +
    '<p>Öffnen Sie den Arbeitsbereich direkt über das RBS-Symbol auf Ihrem Startbildschirm.</p><div class="install-help"><strong>iPhone / iPad</strong><br>In Safari „Teilen“ → „Zum Home-Bildschirm“ wählen.</div>' +
    '<div class="install-help"><strong>Android</strong><br>Im Browsermenü „App installieren“ oder „Zum Startbildschirm hinzufügen“ wählen.</div>' +
    '<p class="small muted">Der Zugriff auf Geschäftsdaten und das Speichern benötigen eine Internetverbindung.</p><button id="native-install" class="btn primary full" type="button"' +
    (installPrompt ? '' : ' hidden') + '>App installieren</button></dialog>';
  bindShell();
  renderList();
}

function filteredCases() {
  const q = state.query.toLocaleLowerCase('de');
  return state.items.filter(item => {
    const inView = state.view === 'done' ? item.status === 'done' : item.status !== 'done' &&
      (state.view !== 'mine' || item.owner_id === state.member.id);
    return inView && (!q || [item.title, item.contact_name, item.company, item.location, item.email].join(' ').toLocaleLowerCase('de').includes(q));
  });
}
function renderList() {
  const container = document.getElementById('case-list');
  if (!container) return;
  const items = filteredCases();
  container.innerHTML = items.map(item => '<button type="button" class="case-card' +
    (state.current?.item.id === item.id ? ' active' : '') + '" data-case="' + esc(item.id) + '">' +
    '<div class="row"><span class="case-kind">' + esc(kinds[item.kind]) + '</span><span class="tag ' + esc(item.status) + '">' +
    esc(statuses[item.status]) + '</span></div><h3>' + esc(item.title) + '</h3><p>' + esc(item.contact_name) +
    (item.location ? ' · ' + esc(item.location) : '') + '</p><div class="row"><span class="case-owner">' +
    esc(item.owner_id ? item.owner_name || state.member.display_name : 'Noch nicht übernommen') + '</span><span class="case-kind">' +
    (item.due_on && item.status !== 'done' ? (item.due_on.slice(0, 10) < today() ? 'Fällig · ' : 'Wiedervorlage · ') + date(item.due_on) : date(item.created_at)) + '</span></div></button>').join('') ||
    '<div class="empty"><h2>' + (state.query ? 'Keine Treffer' : 'Hier ist alles übersichtlich.') + '</h2><p>' +
    (state.query ? 'Versuchen Sie einen anderen Suchbegriff.' : 'Neue Websiteanfragen erscheinen automatisch. Anfragen aus E-Mails oder Gesprächen können Sie über „Neu“ aufnehmen.') + '</p></div>';
  const counts = navCounts();
  for (const key of Object.keys(counts)) document.getElementById('count-' + key).textContent = counts[key];
  app.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === state.view));
  document.getElementById('pagination').innerHTML = state.next ? '<button class="btn full" type="button" data-action="more">Weitere Anfragen laden</button><p class="pending-count">Suche und Zähler beziehen sich auf die geladenen Anfragen.</p>' : '';
}
function renderDetail() {
  if (!state.current) return;
  const { item, events } = state.current;
  const owned = item.owner_id === state.member.id;
  const disabled = owned ? '' : ' disabled';
  document.getElementById('workspace').classList.add('detail-open');
  const hasOverdue = item.due_on && item.status !== 'done' && item.due_on.slice(0, 10) < today();
  document.getElementById('case-detail').innerHTML = '<div class="detail-inner"><button type="button" class="btn quiet back" data-action="back">← Alle Anfragen</button>' +
    '<div class="detail-heading"><div class="row"><span class="eyebrow">' + esc(kinds[item.kind]) + '</span><span class="tag ' + esc(item.status) + '">' +
    esc(statuses[item.status]) + '</span></div><h2>' + esc(item.title) + '</h2><div class="contact-row"><span>' + esc(item.contact_name) + '</span>' +
    (item.email ? '<a href="mailto:' + esc(item.email) + '">' + esc(item.email) + '</a>' : '') +
    (item.phone ? '<span>' + esc(item.phone) + '</span>' : '') + '</div></div>' +
    '<div class="brief"><div class="eyebrow">' + (item.preparation_kind === 'ai' ? 'Jarvis · KI-Vorbereitung' : 'Aus den Anfrageangaben vorbereitet') +
    '</div><p>' + esc(item.summary) + '</p>' + (item.missing?.length ? '<ul class="missing-list">' + item.missing.map(m => '<li>' + esc(m) + '</li>').join('') + '</ul>' : '') +
    '</div><div class="owner-line"><p>Verantwortlich<br><strong>' + esc(item.owner_id ? item.owner_name || state.member.display_name : 'Noch offen') + '</strong></p>' +
    (!item.owner_id ? '<button class="btn primary" type="button" data-action="claim">Anfrage übernehmen</button>' :
      '<label class="small">Status <select class="status-select" id="status-select"' + disabled + '>' +
      options({ in_progress: 'In Bearbeitung', waiting: 'Wartet auf Rückmeldung', done: 'Erledigt' }, item.status) + '</select></label>') + '</div>' +
    '<form id="detail-form"><section class="section"><h3>Nächster Schritt</h3><div class="form-grid">' +
    '<div class="field"><label for="next-step">Was steht an?</label><input id="next-step" maxlength="500" value="' + esc(item.next_step) + '"' + disabled + ' required></div>' +
    '<div class="field"><label for="due-on">' + (hasOverdue ? 'Wiedervorlage · fällig' : 'Wiedervorlage') + '</label><input id="due-on" type="date" value="' + esc(item.due_on?.slice(0, 10) || '') + '"' + disabled + '></div>' +
    '<div class="field wide"><label for="project-key">Projektbezug</label><select id="project-key"' + disabled + '>' + options(projects, item.project_key) + '</select></div></div></section>' +
    '<section class="section"><div class="row"><h3>Antwortentwurf</h3><span class="tag">' + esc({ suggested: 'Zur Prüfung', edited: 'Bearbeitet', reviewed: 'Geprüft' }[item.draft_state]) +
    '</span></div><div class="field"><label for="draft-text" class="muted">Vor dem Versand prüfen</label><textarea id="draft-text" class="draft-area" maxlength="6000"' + disabled + '>' +
    esc(item.draft) + '</textarea></div><div class="toolbar"><button type="submit" class="btn primary"' + disabled + '>Änderungen speichern</button>' +
    '<button type="button" class="btn" data-action="review"' + disabled + '>Als geprüft markieren</button>' +
    '<button type="button" class="btn quiet" data-action="prepare"' + (!owned || !state.ai || item.draft_state !== 'suggested' ? ' disabled' : '') + '>Jarvis vertiefen</button></div>' +
    '<div class="toolbar"><button class="text-button" type="button" data-action="copy"' + disabled + '>Entwurf kopieren</button>' +
    '<button class="text-button" type="button" data-action="mail"' + (!owned || !item.email ? ' disabled' : '') + '>Im Mailprogramm öffnen</button></div>' +
    '<p class="rule-label">Der Versand erfolgt in Ihrem Mailprogramm. Das Portal verschickt keine Antworten selbstständig.' +
    (!state.ai ? ' Die Vorbereitung nutzt derzeit die übermittelten Formularangaben.' : '') + '</p></section></form>' +
    '<details class="section"><summary>Originalangaben ansehen</summary><dl class="source-grid">' +
    Object.entries(item.original_data).filter(([key, value]) => labels[key] && value).map(([key, value]) =>
      '<dt>' + esc(labels[key]) + '</dt><dd>' + esc(value) + '</dd>').join('') + '</dl></details>' +
    '<section class="section"><h3>Verlauf &amp; Notizen</h3><ul class="timeline">' + events.map(event =>
      '<li>' + esc(eventText(event)) + '<time>' + date(event.created_at) + (event.actor_name ? ' · ' + esc(event.actor_name) : '') + '</time></li>').join('') +
    '</ul><form class="note-form" id="note-form"><div class="field"><label for="note-text">Interne Notiz</label><textarea id="note-text" maxlength="3000" placeholder="Zum Beispiel: Besichtigung abgestimmt …"' + disabled + ' required></textarea></div>' +
    '<button class="btn" type="submit"' + disabled + '>Notiz hinzufügen</button></form></section></div>';
  document.getElementById('detail-form').addEventListener('input', () => { state.dirty = true; });
  document.getElementById('detail-form').addEventListener('submit', async event => {
    event.preventDefault();
    await act('save', editValues());
  });
  document.getElementById('status-select')?.addEventListener('change', async event => {
    if (state.dirty) { event.target.value = item.status; message('Bitte zuerst Ihre Änderungen speichern.', 'error'); return; }
    await act('status', { status: event.target.value });
  });
  document.getElementById('note-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (state.dirty) { message('Bitte zuerst Ihren Antwortentwurf speichern.', 'error'); return; }
    await act('note', { note: document.getElementById('note-text').value });
  });
  renderList();
}
function eventText(event) {
  const text = { created: event.detail?.source === 'website' ? 'Websiteanfrage eingegangen' : 'Anfrage aufgenommen',
    claimed: 'Anfrage übernommen', saved: 'Bearbeitung gespeichert', reviewed: 'Antwortentwurf geprüft · Versand erfolgt separat',
    prepared: 'Vorbereitung aktualisiert', note: event.detail?.note || 'Notiz hinzugefügt',
    status: 'Status: ' + (statuses[event.detail?.status] || '') };
  return text[event.action] || event.action;
}
function editValues() {
  return { draft: document.getElementById('draft-text').value, next_step: document.getElementById('next-step').value,
    due_on: document.getElementById('due-on').value, project_key: document.getElementById('project-key').value };
}
async function loadCases(more = false) {
  if (state.demo) return;
  const data = await api('cases' + (more && state.next ? '?cursor=' + encodeURIComponent(state.next) : ''));
  state.items = more ? [...state.items, ...data.items.filter(item => !state.items.some(c => c.id === item.id))] : data.items;
  state.next = data.next;
  renderList();
}
async function openCase(id, keepEdits = false) {
  if (state.dirty && !keepEdits && !confirm('Ihre Änderungen sind noch nicht gespeichert. Trotzdem den Vorgang wechseln?')) return;
  const edits = keepEdits && state.current ? editValues() : null;
  state.current = state.demo ? { item: state.items.find(item => item.id === id), events: demoEvents[id] || [] } : await api('cases/' + id);
  state.dirty = false;
  renderDetail();
  if (edits) {
    for (const [key, inputId] of Object.entries({ draft: 'draft-text', next_step: 'next-step', due_on: 'due-on', project_key: 'project-key' })) {
      document.getElementById(inputId).value = edits[key];
    }
    state.dirty = true;
  }
}
async function act(action, fields = {}) {
  if (state.busy) return;
  state.busy = true;
  const id = state.current.item.id;
  const keep = state.dirty;
  try {
    if (state.demo) demoMutation(action, fields);
    else await post('cases/' + id + '/actions', { ...fields, action, version: state.current.item.version });
    state.dirty = false;
    await loadCases();
    await openCase(id);
    message(action === 'review' ? 'Entwurf als geprüft markiert. Es wurde keine Nachricht versendet.' :
      action === 'claim' ? 'Übernommen. Der Vorgang ist jetzt Ihnen zugeordnet.' : 'Gespeichert.', 'success');
  } catch (error) {
    if (error.status === 409 && keep) {
      await openCase(id, true).catch(() => {});
      message('Eine neuere Version wurde geladen. Ihre Eingaben bleiben erhalten. Bitte vergleichen und erneut speichern.', 'error');
    } else message(error.message, 'error');
  } finally { state.busy = false; }
}

function bindShell() {
  app.onclick = async event => {
    const close = event.target.closest('[data-close]');
    if (close) { document.getElementById(close.dataset.close).close(); return; }
    const view = event.target.closest('[data-view]');
    if (view) {
      state.view = view.dataset.view;
      app.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === state.view));
      if (matchMedia('(max-width:760px)').matches) document.getElementById('workspace').classList.remove('detail-open');
      renderList(); return;
    }
    const card = event.target.closest('[data-case]');
    if (card) { await openCase(card.dataset.case).catch(error => message(error.message, 'error')); return; }
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    try {
      if (action === 'back') document.getElementById('workspace').classList.remove('detail-open');
      if (action === 'new') document.getElementById('new-dialog').showModal();
      if (action === 'settings') document.getElementById('settings-dialog').showModal();
      if (action === 'install') {
        document.getElementById('settings-dialog').close();
        document.getElementById('install-dialog').showModal();
      }
      if (action === 'logout') {
        if (state.dirty && !confirm('Ungespeicherte Änderungen verwerfen und abmelden?')) return;
        if (state.demo) location.href = '/portal/';
        else { await logout(); state.dirty = false; renderAuth(); }
      }
      if (action === 'refresh' || action === 'more') {
        button.disabled = true; await loadCases(action === 'more');
        message('Anfrageübersicht aktualisiert.', 'success'); button.disabled = false;
      }
      if (['claim', 'review', 'prepare'].includes(action)) {
        if (state.dirty) { message('Bitte zuerst Ihre Änderungen speichern.', 'error'); return; }
        button.disabled = true; await act(action); if (button.isConnected) button.disabled = false;
      }
      if (action === 'copy') {
        await navigator.clipboard.writeText(document.getElementById('draft-text').value);
        message('Entwurf kopiert. Es wurde keine Nachricht versendet.', 'success');
      }
      if (action === 'mail') {
        if (state.dirty) { message('Bitte zuerst Ihren Entwurf speichern und prüfen.', 'error'); return; }
        if (state.current.item.draft_state !== 'reviewed') { message('Bitte den Entwurf zuerst als geprüft markieren.', 'error'); return; }
        location.href = 'mailto:' + encodeURIComponent(state.current.item.email) + '?subject=' +
          encodeURIComponent('Ihre Anfrage · ' + state.current.item.title) + '&body=' + encodeURIComponent(state.current.item.draft);
      }
    } catch (error) { message(error.message || 'Die Aktion konnte nicht abgeschlossen werden.', 'error'); if (button.isConnected) button.disabled = false; }
  };
  document.getElementById('search').addEventListener('input', event => { state.query = event.target.value; renderList(); });
  document.getElementById('new-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (event.submitter.disabled) return;
    event.submitter.disabled = true;
    const data = Object.fromEntries(new FormData(event.target));
    try {
      let item;
      if (state.demo) { item = demoCase(data, 'demo-' + crypto.randomUUID()); state.items.unshift(item); }
      else item = (await post('cases', data, { 'Idempotency-Key': event.target.dataset.requestKey || (event.target.dataset.requestKey = crypto.randomUUID()) })).item;
      document.getElementById('new-dialog').close();
      event.target.reset(); delete event.target.dataset.requestKey;
      state.view = 'inbox'; await loadCases(); await openCase(item.id);
      message('Anfrage aufgenommen und vorbereitet.', 'success');
    } catch (error) {
      document.getElementById('new-message-result').textContent = error.message;
      document.getElementById('new-message-result').classList.add('error');
    } finally { event.submitter.disabled = false; }
  });
  document.getElementById('profile-form').addEventListener('submit', async event => {
    event.preventDefault();
    const name = document.getElementById('profile-name').value.trim();
    try {
      if (!state.demo) state.member = (await post('profile', { display_name: name })).member;
      else state.member.display_name = name;
      document.getElementById('settings-result').textContent = 'Anzeigename gespeichert.';
    } catch (error) { document.getElementById('settings-result').textContent = error.message; }
  });
  document.getElementById('email-form').addEventListener('submit', async event => {
    event.preventDefault();
    const result = document.getElementById('settings-result');
    if (state.demo) { result.textContent = 'Die Demo ändert keine E-Mail-Adresse. Im echten Konto erfolgt die Änderung nach Bestätigung.'; return; }
    event.submitter.disabled = true;
    try {
      await login(state.member.email, document.getElementById('confirm-password').value);
      await updateUser({ email: document.getElementById('new-login-email').value.trim() });
      document.getElementById('confirm-password').value = '';
      result.textContent = 'Bitte die Änderung über die Bestätigungs-E-Mail abschließen. Ihre Vorgänge bleiben demselben Konto zugeordnet.';
    } catch (error) { result.textContent = error.message || 'Die Änderung konnte nicht angefordert werden.'; result.classList.add('error'); }
    finally { event.submitter.disabled = false; }
  });
  document.getElementById('native-install').addEventListener('click', async () => {
    if (installPrompt) { await installPrompt.prompt(); installPrompt = null; }
  });
}

const demoEvents = {};
function demoCase(raw, id, overrides = {}) {
  const kind = raw.request_kind || 'contact';
  const item = { id, kind, contact_name: raw.name, email: raw.email || '', phone: '', company: raw.company || '', location: raw.city || '',
    title: kind === 'project' ? 'Grundstücksangebot · ' + (raw.city || 'Region') : kind === 'partner' ? 'Baupartner · ' + (raw.company || raw.name) : 'Kooperationsanfrage',
    original_data: raw, summary: raw.message || 'Neue Geschäftsanfrage.', missing: ['Passende Unterlagen und Details gemeinsam prüfen'],
    next_step: 'Anfrage sichten und Rückfragen vorbereiten', draft: 'Guten Tag,\n\nvielen Dank für Ihre Anfrage. Für eine erste Einschätzung senden Sie uns bitte die vorhandenen Unterlagen und eine kurze Konkretisierung Ihres Vorhabens.\n\nFreundliche Grüße\nRBS Projektentwicklung',
    draft_state: 'suggested', preparation_kind: 'rules', status: 'new', owner_id: null, project_key: '', due_on: null,
    version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...overrides };
  demoEvents[id] = [{ action: 'created', detail: { source: 'website' }, created_at: item.created_at }];
  return item;
}
function demoMutation(action, fields) {
  const item = state.current.item;
  if (action === 'claim') { item.owner_id = state.member.id; item.owner_name = state.member.display_name; item.status = 'in_progress'; }
  if (action === 'save') { Object.assign(item, fields); item.draft_state = 'edited'; }
  if (action === 'status') item.status = fields.status;
  if (action === 'review') item.draft_state = 'reviewed';
  demoEvents[item.id].push({ action: action === 'claim' ? 'claimed' : action === 'save' ? 'saved' : action === 'review' ? 'reviewed' : action,
    detail: fields, actor_name: state.member.display_name, created_at: new Date().toISOString() });
  item.version++;
}
function startDemo() {
  state.member = { id: 'demo-member', display_name: 'RBS Geschäftsführung', email: 'pilot@example.invalid' };
  state.items = [
    demoCase({ request_kind: 'project', name: 'Beispiel-Eigentümer', email: 'eigentuemer@example.invalid', city: 'Region Limburg',
      object_type: 'Grundstück', area: '1.100 m²', message: 'Wir möchten ein Grundstück zur Entwicklung anbieten. Die Fläche beträgt ungefähr 1.100 m². Informationen zum Baurecht können wir nachreichen.' }, 'demo-project'),
    demoCase({ request_kind: 'partner', name: 'Beispiel-Ansprechpartner', company: 'Musterbau GmbH', email: 'baupartner@example.invalid',
      trade: 'Rohbau', service_region: 'Westerwald und Umgebung', message: 'Wir sind ein Rohbauunternehmen und interessieren uns für eine Zusammenarbeit. Referenzen stellen wir auf Anfrage gerne bereit.' }, 'demo-partner'),
    demoCase({ request_kind: 'cooperation', name: 'Beispiel-Projektpartner', email: 'partner@example.invalid',
      message: 'Wir möchten eine mögliche gemeinsame Projektentwicklung besprechen und zunächst den Rahmen klären.' }, 'demo-cooperation',
      { owner_id: 'demo-member', owner_name: 'RBS Geschäftsführung', status: 'waiting', next_step: 'Auf Konkretisierung der Projektidee warten' })
  ];
  renderShell(); openCase('demo-project');
}
async function beginApp() {
  const me = await api('me');
  state.member = me.member; state.ai = me.ai_available;
  await loadCases();
  renderShell();
  if (me.pending_email) message('Eine E-Mail-Änderung wartet auf Bestätigung: ' + me.pending_email);
}
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; });
window.addEventListener('online', () => { const status = document.getElementById('connection-status'); if (status) { status.textContent = 'RBS Projektentwicklung'; status.classList.remove('offline'); } });
window.addEventListener('offline', () => { const status = document.getElementById('connection-status'); if (status) { status.textContent = 'Offline · Änderungen sind noch nicht gespeichert'; status.classList.add('offline'); } });
window.addEventListener('beforeunload', event => { if (state.dirty) { event.preventDefault(); event.returnValue = ''; } });
setInterval(async () => { if (state.member && !state.demo && !state.busy && !document.hidden) await loadCases().catch(() => {}); }, 45000);
onAuthChange(event => { if (event === 'logout' && !state.demo && state.member) { state.dirty = false; renderAuth(); } });

async function boot() {
  if (state.demo) { startDemo(); return; }
  const hash = new URLSearchParams(location.hash.slice(1));
  if (hash.has('invite_token')) { renderAuth('invite', hash.get('invite_token')); return; }
  if (hash.has('recovery_token')) { renderAuth('recovery', hash.get('recovery_token')); return; }
  try {
    await getSettings();
    await handleAuthCallback();
    const user = await getUser();
    if (user) await beginApp();
    else renderAuth();
  } catch (error) {
    renderAuth();
    message(error.message || 'Der Zugang konnte noch nicht geöffnet werden.', 'error');
  }
}
await boot();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/portal/sw.js', { scope: '/portal/' }).catch(() => {});
