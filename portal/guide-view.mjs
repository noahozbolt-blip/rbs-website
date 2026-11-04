import { normalizeGuide, guideNode, guidePlan } from './guide.mjs';
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const hints = { documents: 'Gezielt fehlende Informationen ergänzen', conversation: 'Ziel und Terminabstimmung vorbereiten', assess: 'Eine persönliche Entscheidung vorbereiten' };

export function renderGuide(item, saved, { owned, hidden = false } = {}) {
  if (hidden) return '<section id="jarvis-guide" class="guide-collapsed"><span>Freie Bearbeitung</span><button type="button" class="text-button" data-action="guide-show">Jarvis-Leitfaden öffnen</button></section>';
  const state = normalizeGuide(item.kind, saved);
  const node = guideNode(item.kind, state.path.at(-1));
  const plan = guidePlan({ ...item.original_data, request_kind: item.kind }, state, item.project_key);
  const disabled = owned ? '' : ' disabled';
  const button = (id, label, root = false) => '<button class="guide-choice" type="button" data-guide-op="choose" data-guide-target="' + esc(id) + '"' + disabled + '><strong>' + esc(label) + '</strong>' +
    (root && hints[id] ? '<span>' + esc(hints[id]) + '</span>' : '') + '</button>';
  return '<section id="jarvis-guide" class="guide-box" aria-label="Jarvis-Leitfaden"><div class="row"><div class="eyebrow">Jarvis-Leitfaden · optional</div><button class="text-button" type="button" data-action="guide-hide">Frei bearbeiten</button></div>' +
    (state.path.length > 1 ? '<div class="guide-trail">' + state.path.slice(-3).map(id => esc(guideNode(item.kind, id).label)).join(' <span>→</span> ') + '</div>' : '') +
    (plan ? '<div class="guide-plan"><h3>' + esc(plan.title) + '</h3><p>' + esc(plan.next_step) + '</p><details><summary>Worauf es ankommt und was daraus folgen kann</summary><ul>' + plan.checks.map(check => '<li>' + esc(check) + '</li>').join('') + '</ul>' +
      '<dl>' + plan.outcomes.map(([when, then]) => '<dt>' + esc(when) + '</dt><dd>' + esc(then) + '</dd>').join('') + '</dl></details><div class="toolbar"><button class="btn primary" type="button" data-action="guide-preview"' + disabled + '>Vorbereitung ansehen</button>' +
      (plan.complete && item.status !== 'done' ? '<button class="btn" type="button" data-action="guide-complete"' + disabled + '>Als erledigt markieren</button>' : '') + '</div><p class="rule-label">Ein gemerkter Weg bestätigt keine ausgeführte Aktion. Vorschläge werden erst nach Ihrer Auswahl in die Bearbeitung übernommen.</p></div>' :
      '<h3>' + esc(node.question) + '</h3><p class="guide-intro">Wählen Sie einen Einstieg. Jarvis zeigt danach passende Schritte und mögliche nächste Wege.</p>') +
    (node.options.length ? (plan ? '<p class="guide-question">' + esc(node.question) + '</p>' : '') + '<div class="guide-choices">' + node.options.map(option => button(option.id, option.label, node.id === 'start')).join('') + '</div>' : '') +
    (node.id === 'start' ? '<details class="guide-alternatives"><summary>Weitere Wege</summary><div class="guide-choices">' + button('wait', 'Später aufgreifen') + button('finish', 'Abschluss prüfen') + '</div></details>' :
      '<div class="guide-navigation"><button type="button" class="text-button" data-guide-op="back"' + disabled + '>← Einen Schritt zurück</button><button type="button" class="text-button" data-guide-op="reset"' + disabled + '>Anderen Weg beginnen</button></div>') +
    (!owned ? '<p class="rule-label">Übernehmen Sie die Anfrage, um einen Weg zu merken. Die freie Bearbeitung bleibt jederzeit möglich.</p>' : '') + '</section>';
}

export function renderGuidePreview(plan, { edited = false, due = '' } = {}) {
  return '<p class="muted small">Prüfen Sie den Vorschlag. Sie können nur den nächsten Schritt oder zusätzlich den Antwortentwurf übernehmen. Anschließend wie gewohnt speichern.</p>' +
    '<div class="guide-preview-step"><strong>Nächster Schritt</strong><p>' + esc(plan.next_step) + '</p></div>' +
    (plan.date ? '<div class="field"><label for="guide-date">Wiedervorlage (optional)</label><input id="guide-date" type="date" value="' + esc(due) + '"></div>' : '') +
    (plan.draft ? '<div class="field"><label for="guide-draft">Vorgeschlagener Antwortentwurf</label><textarea id="guide-draft" class="draft-area" readonly>' + esc(plan.draft) + '</textarea></div>' +
      (edited ? '<p class="guide-existing">Ihr bestehender Entwurf wurde bereits bearbeitet oder es gibt ungespeicherte Änderungen. Er bleibt bei „Nur nächsten Schritt“ erhalten.</p>' : '') : '<p class="small muted">Dieser Schritt ist intern. Ihr Antwortentwurf bleibt erhalten.</p>') +
    '<div class="toolbar"><button class="btn primary" type="button" data-action="guide-apply-step">Nur nächsten Schritt übernehmen</button>' +
    (plan.draft ? '<button class="btn" type="button" data-action="guide-apply-draft">' + (edited ? 'Entwurf ersetzen und Schritt übernehmen' : 'Schritt und Entwurf übernehmen') + '</button>' : '') + '</div>';
}
