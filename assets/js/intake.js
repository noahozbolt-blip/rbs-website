/* RBS: structured first contact. Native Netlify Forms stores submissions.
 * Browser checks improve UX; they are not server-side business qualification.
 * No private documents, marketing opt-in, applicant scores or message sender.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.RbsIntake = api; api.init(); }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  const kinds = ['contact', 'project', 'partner', 'cooperation'];
  const allowedProjects = ['', 'nentershausen', 'niedererbach', 'flacht', 'bestand'];
  const defaults = {
    contact: ['name', 'email', 'message'],
    project: ['name', 'email', 'object_type', 'postal_code', 'city', 'representative_role'],
    partner: ['name', 'email', 'company', 'trade', 'service_region'],
    cooperation: ['name', 'email', 'cooperation_interest']
  };
  const enums = {
    object_type: ['land', 'existing_building', 'development_project'],
    representative_role: ['owner', 'broker', 'authorized', 'other'],
    trade: ['architecture', 'structural', 'tga', 'energy', 'shell', 'civil', 'electrical', 'shk', 'finishing', 'broker', 'other'],
    availability: ['', 'now', 'one_to_three_months', 'later', 'unknown'],
    cooperation_interest: ['project_discussion', 'joint_venture_discussion', 'financing_contact', 'general_network']
  };
  const labels = { name: 'Name', email: 'E-Mail', company: 'Unternehmen', message: 'Nachricht',
    object_type: 'Objektart', postal_code: 'Postleitzahl', city: 'Ort', representative_role: 'Ihre Rolle',
    trade: 'Fachgebiet', service_region: 'Einsatzregion', cooperation_interest: 'Gesprächsthema' };

  function validate(kind, data) {
    if (!kinds.includes(kind)) return [{ field: 'request_kind', message: 'Unbekannte Anfrageart.' }];
    const errors = [];
    for (const field of defaults[kind]) {
      if (!String(data[field] || '').trim()) errors.push({ field, message: (labels[field] || field) + ' bitte ausfüllen.' });
    }
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) errors.push({ field: 'email', message: 'Bitte eine gültige E-Mail-Adresse angeben.' });
    if (data.postal_code && !/^\d{5}$/.test(data.postal_code)) errors.push({ field: 'postal_code', message: 'Bitte eine fünfstellige Postleitzahl angeben.' });
    for (const [field, values] of Object.entries(enums)) {
      if (data[field] && !values.includes(data[field])) errors.push({ field, message: 'Bitte eine der vorgesehenen Optionen wählen.' });
    }
    for (const [field, value] of Object.entries(data)) {
      const cap = field === 'message' ? 3000 : field === 'email' ? 254 : field === 'reference_summary' ? 1500 : 250;
      if (String(value).length > cap) errors.push({ field, message: 'Bitte die Angabe kürzen.' });
    }
    return errors;
  }

  function context(search) {
    const params = new URLSearchParams(search);
    const result = { project_id: '', source: '', utm_source: '', utm_medium: '', utm_campaign: '', utm_content: '' };
    const project = params.get('projekt') || params.get('project_id') || '';
    result.project_id = allowedProjects.includes(project) ? project : '';
    for (const key of ['source', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content']) {
      const value = params.get(key) || '';
      result[key] = /^[a-zA-Z0-9_.-]{0,100}$/.test(value) ? value : '';
    }
    return result;
  }

  function requestId() {
    return 'RBS-' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12));
  }

  function init() {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('form[data-rbs-intake]').forEach(form => {
      const kind = form.dataset.profile || 'contact';
      const status = form.querySelector('[data-form-status]');
      const button = form.querySelector('[type="submit"]');
      const label = button.querySelector('.btn-label') || button;
      const initialLabel = label.textContent;
      const values = context(location.search);
      for (const [key, value] of Object.entries(values)) if (form.elements[key]) form.elements[key].value = value;
      if (form.elements.project_id && !values.project_id) form.elements.project_id.value = form.dataset.defaultProject || '';
      if (form.elements.request_id) form.elements.request_id.value = requestId();
      const selectedProject = form.elements.project_id?.value;
      const projectNote = form.querySelector('[data-project-note]');
      if (selectedProject && projectNote) { projectNote.hidden = false; projectNote.textContent = 'Projektbezug: ' + ({ nentershausen: 'Nentershausen', niedererbach: 'Niedererbach', flacht: 'Flacht', bestand: 'Bestand' }[selectedProject]); }
      let busy = false;
      let completed = false;
      form.addEventListener('submit', async event => {
        event.preventDefault();
        if (busy || completed) return;
        const data = Object.fromEntries(new FormData(form));
        const errors = validate(kind, data);
        if (errors.length || !form.checkValidity()) {
          if (status) { status.hidden = false; status.className = 'rbs-form-status is-error'; status.textContent = errors.map(x => x.message).join(' ') || 'Bitte die markierten Pflichtfelder prüfen.'; }
          const first = errors[0] && form.elements[errors[0].field];
          if (first) first.focus();
          form.reportValidity();
          return;
        }
        // Do not send nonempty honeypots; no fake success screen for rejected input.
        if (data['bot-field']) return;
        busy = true; button.disabled = true; label.textContent = 'Wird übermittelt …';
        if (status) status.hidden = true;
        try {
          const response = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(new FormData(form)).toString() });
          if (!response.ok) throw new Error('Submission not accepted');
          completed = true;
          label.textContent = 'Anfrage übermittelt';
          if (status) {
            status.hidden = false; status.className = 'rbs-form-status is-success';
            status.textContent = 'Vielen Dank. Ihre Anfrage wurde übermittelt. Ihre Referenz: ' + data.request_id + '. Die weitere Abstimmung erfolgt persönlich.';
          }
        } catch (_) {
          if (status) {
            status.hidden = false; status.className = 'rbs-form-status is-error';
            status.textContent = 'Die Übermittlung konnte nicht bestätigt werden. Ihre Eingaben bleiben erhalten. Bitte nennen Sie bei einer Rückfrage per E-Mail die Referenz ' + data.request_id + '.';
          }
          label.textContent = initialLabel;
        } finally { busy = false; button.disabled = completed; }
      });
    });
  }
  return { validate, context, requestId, init };
});
