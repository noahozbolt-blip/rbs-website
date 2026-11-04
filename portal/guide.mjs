import { analyzeInquiry } from './jarvis.mjs';

const roots = {
  project: [['documents', 'Angaben ergänzen'], ['conversation', 'Erstgespräch planen'], ['assess', 'Intern prüfen']],
  partner: [['documents', 'Leistungen klären'], ['conversation', 'Kennenlernen planen'], ['assess', 'Einsatz prüfen']],
  cooperation: [['documents', 'Vorhaben konkretisieren'], ['conversation', 'Austausch planen'], ['assess', 'Intern abstimmen']],
  contact: [['documents', 'Anliegen klären'], ['conversation', 'Gespräch planen'], ['assess', 'Antwort abstimmen']]
};
const nodes = {
  start: { label: 'Eingang', question: 'Welcher Weg hilft bei dieser Anfrage?', options: [] },
  documents: { label: 'Angaben klären', question: 'Wenn die Rückmeldung vorliegt: Wie geht es weiter?',
    options: [['assess', 'Angaben vollständig'], ['documents_partial', 'Noch etwas offen'], ['followup', 'Rückmeldung fehlt']] },
  documents_partial: { label: 'Offenen Punkt klären', question: 'Wie ist der nächste Stand?',
    options: [['assess', 'Jetzt vollständig'], ['conversation', 'Lieber persönlich klären'], ['wait', 'Später aufgreifen']] },
  followup: { label: 'Nachfassen', question: 'Wie entwickelt sich die Anfrage?',
    options: [['assess', 'Rückmeldung liegt vor'], ['wait', 'Weiter warten'], ['finish', 'Abschluss prüfen']] },
  conversation: { label: 'Gespräch planen', question: 'Wenn der Gesprächsschritt erledigt ist: Was folgt?',
    options: [['assess', 'Gespräch geführt'], ['documents', 'Vorher Angaben klären'], ['wait', 'Termin noch offen']] },
  assess: { label: 'Intern prüfen', question: 'Was ergibt die persönliche Prüfung?',
    options: [['proposal', 'Weiterverfolgen'], ['documents', 'Rückfrage nötig'], ['finish', 'Abschluss prüfen']] },
  proposal: { label: 'Nächsten Schritt abstimmen', question: 'Wie soll es konkret weitergehen?',
    options: [['conversation', 'Gespräch abstimmen'], ['documents', 'Prüfung ergänzen'], ['wait', 'Auf Abstimmung warten']] },
  wait: { label: 'Wiedervorlage', question: 'Wenn der Vorgang wieder ansteht: Was ist sinnvoll?',
    options: [['assess', 'Neu prüfen'], ['followup', 'Kontakt aufnehmen'], ['finish', 'Abschluss prüfen']] },
  finish: { label: 'Abschluss prüfen', question: 'Wie soll der Vorgang abgeschlossen werden?',
    options: [['finish_archive', 'Intern abgeschlossen'], ['finish_decline', 'Absage vorbereiten'], ['assess', 'Doch weiter prüfen']] },
  finish_archive: { label: 'Intern abgeschlossen', question: 'Der Vorgang kann nach Ihrer Prüfung abgeschlossen werden.', options: [] },
  finish_decline: { label: 'Absage vorbereiten', question: 'Die Entscheidung bleibt bei RBS; prüfen Sie den Entwurf vor dem Versand.',
    options: [['finish_archive', 'Bearbeitung abgeschlossen'], ['assess', 'Erneut intern prüfen']] }
};
export const guideKind = kind => Object.hasOwn(roots, kind) ? kind : 'contact';
export const guideNode = (kind, id) => {
  if (!Object.hasOwn(nodes, id)) return null;
  const node = nodes[id];
  return { ...node, id, options: (id === 'start' ? roots[guideKind(kind)] : node.options).map(([id, label]) => ({ id, label })) };
};
export const initialGuide = kind => ({ schema: 1, kind: guideKind(kind), path: ['start'] });

export function guideRecommendation(raw, projectKey = '') {
  const a = analyzeInquiry(raw, projectKey);
  if (a.availability_request) return { id: 'assess', reason: 'Aktuelle Verfügbarkeit zunächst intern prüfen.' };
  if (a.questions.length) return { id: 'documents', reason: 'In der Anfrage sind noch Angaben offen.' };
  if (a.appointment) return { id: 'conversation', reason: 'Die Anfrage enthält einen Gesprächs- oder Terminwunsch.' };
  return { id: 'assess', reason: 'Die vorliegenden Angaben zunächst intern sichten.' };
}

export function normalizeGuide(kind, saved) {
  const k = guideKind(kind);
  if (saved?.schema !== 1 || saved.kind !== k || !Array.isArray(saved.path) || saved.path[0] !== 'start' || saved.path.length > 24) return initialGuide(k);
  for (let i = 1; i < saved.path.length; i++) {
    const previous = guideNode(k, saved.path[i - 1]);
    const extras = saved.path[i - 1] === 'start' ? ['wait', 'finish'] : [];
    if (!previous || ![...previous.options.map(option => option.id), ...extras].includes(saved.path[i])) return initialGuide(k);
  }
  return { schema: 1, kind: k, path: [...saved.path] };
}

export function advanceGuide(kind, saved, operation, target) {
  const current = normalizeGuide(kind, saved);
  if (operation === 'reset') return initialGuide(kind);
  if (operation === 'back') return { ...current, path: current.path.length > 1 ? current.path.slice(0, -1) : ['start'] };
  if (operation !== 'choose') throw new Error('Unbekannte Leitfadenaktion.');
  const node = guideNode(kind, current.path.at(-1));
  const valid = [...node.options.map(option => option.id), ...(node.id === 'start' ? ['wait', 'finish'] : [])];
  if (!valid.includes(target)) throw new Error('Dieser Schritt gehört nicht zum aktuellen Weg.');
  if (current.path.length >= 24) throw new Error('Bitte im Leitfaden zurückgehen oder einen neuen Weg beginnen.');
  return { ...current, path: [...current.path, target] };
}

export function guidePlan(raw, saved, projectKey = '') {
  const state = normalizeGuide(raw.request_kind, saved);
  const id = state.path.at(-1);
  if (id === 'start') return null;
  const a = analyzeInquiry(raw, projectKey);
  const signature = '\n\nFreundliche Grüße\nRBS Projektentwicklung';
  const reply = text => 'Guten Tag,\n\n' + text + signature;
  const inquiryContext = a.project ? ' zum Projekt „' + a.project.name + '“' : '';
  const questions = a.questions.length ? a.questions : [raw.request_kind === 'partner' ?
    'Welche vorhandenen Informationen oder Referenzen möchten Sie für eine mögliche Zusammenarbeit ergänzen?' :
    'Welche vorhandenen Unterlagen oder konkreten Angaben können Sie zu Ihrem Anliegen ergänzen?'];
  const plans = {
    documents: { title: 'Gezielte Rückfrage vorbereiten', next_step: 'Vorhandene Angaben prüfen und fehlende Informationen gezielt klären',
      draft: reply('vielen Dank für Ihre Anfrage' + inquiryContext + '. Für den nächsten Schritt helfen uns noch folgende Angaben, soweit sie bereits vorliegen:\n\n' + questions.map(q => '• ' + q).join('\n')),
      checks: a.questions.length ? ['Bereits vorhandene Angaben nicht erneut verlangen.', 'Nur die tatsächlich offenen Punkte in den Entwurf übernehmen.'] :
        ['Es wurden keine klar fehlenden Pflichtangaben erkannt. Prüfen Sie, ob eine weitere Rückfrage überhaupt nötig ist.'],
      outcomes: [['Wenn die Angaben reichen', 'Die interne Erstprüfung kann beginnen.'], ['Wenn etwas fehlt', 'Den einzelnen offenen Punkt klären oder ein Gespräch wählen.']] },
    documents_partial: { title: 'Den offenen Punkt persönlich festlegen', next_step: 'Fehlenden Einzelpunkt prüfen und gezielt nachfragen',
      draft: null, checks: ['Die bisherige Antwort mit dem Original vergleichen.', 'Den noch offenen Punkt selbst im Antwortentwurf ergänzen.'],
      outcomes: [['Wenn der Punkt geklärt ist', 'Zur internen Prüfung wechseln.'], ['Wenn schriftlich nichts vorangeht', 'Ein kurzes Gespräch vorbereiten.']] },
    followup: { title: 'Freundlich nachfassen', next_step: 'Prüfen, ob das Anliegen noch aktuell ist; dann gegebenenfalls Kontakt aufnehmen',
      draft: reply('wir möchten kurz nachfragen, ob Ihr Anliegen' + inquiryContext + ' noch aktuell ist. Gibt es dazu neue Informationen oder möchten Sie den nächsten Schritt mit uns abstimmen?'),
      checks: ['Bisherigen Kontakt und Zeitpunkt prüfen.', 'Entwurf erst nach persönlicher Prüfung verwenden.'],
      outcomes: [['Wenn eine Rückmeldung kommt', 'Neue Angaben prüfen und den Weg fortsetzen.'], ['Wenn noch keine Rückmeldung vorliegt', 'Eine Wiedervorlage setzen oder den Abschluss persönlich prüfen.']] },
    conversation: { title: 'Gespräch vorbereiten', next_step: 'Ziel und offene Fragen festhalten; mögliche Zeitfenster abstimmen',
      draft: reply('vielen Dank für Ihre Anfrage' + inquiryContext + '. Gerne würden wir Ihr Anliegen in einem Gespräch näher besprechen. ' +
        (a.appointment_times ? 'Ihre Zeitvorschläge liegen vor. Wir prüfen die Möglichkeiten und melden uns zur Abstimmung.' : 'Bitte nennen Sie uns ein oder zwei mögliche Zeitfenster.')),
      checks: ['Gesprächsziel und wichtige Rückfragen notieren.', a.appointment_times ? 'Vorhandene Zeitvorschläge vor einer Bestätigung prüfen.' : 'Termin erst nach tatsächlicher Abstimmung bestätigen.'],
      outcomes: [['Nach dem Gespräch', 'Ergebnisse intern prüfen und den nächsten Schritt festlegen.'], ['Wenn vorher Unterlagen fehlen', 'Zur gezielten Rückfrage wechseln.']] },
    assess: { title: 'Interne Erstprüfung vorbereiten', next_step: raw.request_kind === 'partner' ?
      'Leistungen, Einsatzmöglichkeiten und offene Punkte intern prüfen' : 'Anfrageumfang, vorhandene Unterlagen und offene Punkte intern prüfen',
      draft: null, checks: ['Originalangaben und gegebenenfalls Projektquellen vergleichen.', 'Offene fachliche Punkte mit dem zuständigen Entscheider klären.'],
      outcomes: [['Wenn RBS weiterverfolgen möchte', 'Einen unverbindlichen nächsten Schritt abstimmen.'], ['Wenn Informationen fehlen', 'Gezielt nachfragen.'], ['Wenn RBS abschließen möchte', 'Den Abschlussweg persönlich auswählen.']] },
    proposal: { title: 'Unverbindlich konkretisieren', next_step: 'Mit RBS einen konkreten nächsten Schritt abstimmen',
      draft: reply('vielen Dank für Ihre Angaben' + inquiryContext + '. Wir möchten das Anliegen gerne näher besprechen und gemeinsam einen möglichen nächsten Schritt klären. Welche Zeitfenster passen Ihnen für ein erstes Gespräch?'),
      checks: ['Interesse ist noch keine Projekt-, Auftrags- oder Finanzierungszusage.', 'Die konkrete Abstimmung vor dem Versand prüfen.'],
      outcomes: [['Wenn beide Seiten weitergehen möchten', 'Gespräch, Besichtigung oder ergänzende Prüfung abstimmen.'], ['Wenn zunächst etwas offenbleibt', 'Eine Rückfrage oder Wiedervorlage wählen.']] },
    wait: { title: 'Wiedervorlage festlegen', next_step: 'Anliegen zum selbst gewählten Wiedervorlagedatum erneut prüfen',
      draft: null, date: true, checks: ['Ein sinnvolles Datum selbst auswählen.', 'Falls passend, den Status anschließend auf „Wartet“ setzen.'],
      outcomes: [['Zum gewählten Datum', 'Der Vorgang erscheint unter „Heute / überfällig“.'], ['Wenn vorher etwas eintrifft', 'Direkt weiterbearbeiten.']] },
    finish: { title: 'Abschluss bewusst auswählen', next_step: 'Prüfen, ob der Vorgang intern abgeschlossen ist oder eine persönliche Rückmeldung benötigt',
      draft: null, checks: ['Ein Abschluss ist keine automatische Absage.', 'Wählen Sie unten den tatsächlich passenden Abschlussweg.'],
      outcomes: [['Wenn intern alles erledigt ist', 'Den Vorgang ausdrücklich als erledigt markieren.'], ['Wenn RBS absagen möchte', 'Einen Absageentwurf gesondert vorbereiten und prüfen.']] },
    finish_archive: { title: 'Vorgang abschließen', next_step: 'Ergebnis und Verlauf prüfen; dann bei Bedarf als erledigt markieren',
      draft: null, complete: true, checks: ['Sind Ergebnis und wichtige Notizen festgehalten?', '„Erledigt“ markiert nur den internen Vorgang.'],
      outcomes: [['Nach dem Abschluss', 'Der Vorgang bleibt mit seinem Verlauf unter „Erledigt“ verfügbar.'], ['Bei neuen Informationen', 'Der Vorgang kann wieder geöffnet werden.']] },
    finish_decline: { title: 'Absageentwurf persönlich prüfen', next_step: 'Entscheidung und Formulierung der Absage persönlich prüfen',
      draft: reply('vielen Dank für Ihre Anfrage' + inquiryContext + ' und Ihr Interesse an RBS. Wir möchten das vorgestellte Anliegen derzeit nicht weiterverfolgen. Vielen Dank für Ihr Verständnis.'),
      checks: ['Nur verwenden, wenn RBS die Absage tatsächlich beschlossen hat.', 'Individuelle Gründe und Ton bei Bedarf selbst ergänzen.'],
      outcomes: [['Nach einer persönlich geprüften Rückmeldung', 'Den internen Abschluss dokumentieren.'], ['Wenn die Entscheidung offen ist', 'Zur internen Prüfung zurückkehren.']] }
  };
  return { ...plans[id], id };
}
