import { fieldValueLabel } from './field-labels.mjs';
import { PROJECT_KNOWLEDGE, projectByKey } from './project-knowledge.mjs';

const content = value => typeof value === 'string' ? value.trim() : '';
const known = value => Boolean(content(value)) && !/^(?:unbekannt|offen|unklar|weiß ich nicht|weiss ich nicht|k\.?\s*a\.?|noch nicht bekannt)$/i.test(content(value));
const has = (text, expression) => expression.test(text);

export function analyzeInquiry(raw, projectKey = '') {
  const text = [raw.subject, raw.message].map(content).join(' ');
  const kind = raw.request_kind || 'contact';
  const explicit = projectByKey(projectKey || raw.project_id);
  const mentioned = PROJECT_KNOWLEDGE.filter(project => has(text, new RegExp('\\b' + project.place + '\\b', 'i')));
  const newOffer = kind === 'project' || /(?:grundstück|grundstueck|projekt)[^.!?\n]{0,60}(?:anbieten|vorstellen)|(?:biete|bieten)[^.!?\n]{0,60}(?:grundstück|grundstueck|projekt)/i.test(text);
  // A new site in the same town is not automatically an existing RBS project.
  const identifiable = !newOffer && mentioned.length === 1 &&
    /(?:ihre?\w*|rbs|mehrfamilienhaus|wohnprojekt|projekt|neubau)/i.test(text);
  const addressMatch = !newOffer && /mittelstra(?:ß|ss)e\s*9(?:\s*[–/\-]\s*11)?\b/i.test(text);
  const suggested = explicit || (identifiable ? mentioned[0] : addressMatch ? projectByKey('niedererbach') : null);
  const signals = [], questions = [], cautions = [], provided = [];
  const areaMatch = text.match(/\b\d[\d., ]{0,14}\s*(?:m²|m2|qm)(?=\s|[.,;!?)]|$)/i);
  const area = known(raw.area) ? content(raw.area) : areaMatch?.[0] || '';
  const units = text.match(/\b(\d{1,4})\s*(?:wohneinheiten|wohnungen|einheiten|we)\b/i);
  const planningMentioned = /bebauungsplan|b-?plan|baugenehmigung|vorbescheid|baurecht|§\s*(?:34|35)/i.test(text);
  const planningUnknown = /(?:baurecht|planungsstand|bebauungsplan)[^.!?\n]{0,30}(?:unbekannt|unklar|noch offen)|(?:kein|keine)\s+(?:angaben|informationen)\s+zum\s+baurecht/i.test(text);
  const planning = known(raw.planning_status) || (planningMentioned && !planningUnknown);
  const locationKnown = known(raw.city) || /\b\d{5}\s+[A-ZÄÖÜ]/.test(text) || /(?:grundstück|vorhaben|gebäude|objekt)[^.!?\n]{0,35}\bin\s+[A-ZÄÖÜ][a-zäöüß-]+/.test(text);
  const availabilityRequest = kind === 'contact' && /wohnung|einheit|platz|plätze|miete|mieten|kaufen/i.test(text) &&
    /frei|verfügbar|verfuegbar|miete|mieten|kaufen|kaufpreis|verkauf/i.test(text);
  const appointment = /besichtigung|gesprächstermin|gespraechstermin|rückruf|rueckruf|termin vereinbaren/i.test(text);
  const appointmentTimes = /\b\d{1,2}\.\d{1,2}\.|\b(?:montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|morgen|übermorgen|heute)\b|\b\d{1,2}[:.]\d{2}\s*uhr/i.test(text);
  const documentRequest = /(?:bitte|benötig|benoetig|senden sie|erhalte|hätte|haette)[^.!?\n]{0,70}(?:exposé|expose|grundriss|unterlagen|pläne|plaene)/i.test(text);
  if (area) provided.push('Flächenangabe: ' + area);
  if (units) provided.push('Genannte Einheiten: ' + units[1]);
  if (known(raw.city)) provided.push('Ort: ' + content(raw.city));
  if (planning) provided.push('Angaben zum Planungsstand sind enthalten');
  if (availabilityRequest) {
    signals.push('Verfügbarkeit / Vermarktung');
    cautions.push('Freie Einheiten, Preise und Termine intern prüfen; die Projektseite bestätigt keine Verfügbarkeit.');
    if (!suggested) questions.push('Auf welches Projekt oder welche Einheit bezieht sich Ihre Anfrage?');
  }
  if (appointment) signals.push('Termin / Rückruf');
  if (appointment && appointmentTimes) provided.push('Zeitvorschläge sind in der Nachricht enthalten');
  if (documentRequest) signals.push('Unterlagen angefragt');
  if (/\b(?:dringend|frist|eilt|mahnung)\b/i.test(text)) {
    signals.push('Fristhinweis im Text'); cautions.push('Genannte Dringlichkeit und Frist persönlich prüfen. Es wird kein Termin automatisch zugesagt.');
  }
  if (kind === 'project') {
    if (!locationKnown) questions.push('Wo befindet sich das Grundstück oder Objekt?');
    if (!area) questions.push('Welche Grundstücks- oder Gebäudefläche ist bekannt?');
    if (!planning) questions.push('Welche Angaben zum Baurecht oder Planungsstand liegen bereits vor?');
    if (!/flurstück|flurstueck|lageplan|straße|strasse|unterlagen.*(?:anbei|beigefügt)/i.test(text)) {
      questions.push('Können Sie die genaue Lage oder bereits vorhandene Objektunterlagen ergänzen?');
    }
    if (units && Number(units[1]) > 6) cautions.push('Die Anfrage nennt ' + units[1] +
      ' Einheiten. Zum Vergleich: Die veröffentlichte Mehrfamilienhaus-Referenz Nentershausen nennt 6. Das ist keine Annahmegrenze.');
    if (/hochhaus|hotel|industrie|gewerbehalle/i.test(text)) signals.push('Weiteres Projektfeld · offen prüfen');
  } else if (kind === 'partner') {
    const trade = known(raw.trade) || /rohbau|architekt|tragwerk|tiefbau|elektro|sanitär|heizung|ausbau|energieberatung/i.test(text);
    const region = known(raw.service_region) || /(?:einsatz|tätig|taetig|arbeiten|region)[^.!?\n]{0,40}(?:in|um|raum|gebiet)|westerwald|rhein-main|bundesweit/i.test(text);
    const capacity = known(raw.availability) || /kapazität|kapazitaet|verfügbar|verfuegbar|ab\s+(?:januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember|sofort)/i.test(text);
    if (!trade) questions.push('Welche Leistungen oder welches Gewerk bieten Sie an?');
    if (!region) questions.push('In welcher Region sind Sie tätig?');
    if (!capacity) questions.push('Ab wann und in welchem Umfang sind Kapazitäten verfügbar?');
    if (trade) provided.push('Fachgebiet ist angegeben');
    if (capacity) provided.push('Angaben zu Kapazitäten sind enthalten');
  } else if (kind === 'cooperation' && !content(raw.message)) {
    questions.push('Welches konkrete Vorhaben oder welche Form der Zusammenarbeit möchten Sie besprechen?');
  } else if (kind === 'contact' && !availabilityRequest && !appointment && !documentRequest && text.trim().length < 40) {
    questions.push('Worum geht es konkret und gibt es einen Projekt- oder Ortsbezug?');
  }
  if (!signals.length) signals.push({ project: 'Projektangebot', partner: 'Baupartner', cooperation: 'Kooperation', contact: 'Allgemeine Anfrage' }[kind] || 'Allgemeine Anfrage');
  if (!explicit && mentioned.length > 1) cautions.push('Mehrere Projektorte werden genannt. Den Projektbezug persönlich zuordnen.');
  const next = availabilityRequest ? 'Projektbezug und aktuelle Verfügbarkeit intern prüfen' :
    appointment ? 'Anliegen und mögliche Zeitfenster prüfen, anschließend Termin vorschlagen' :
    documentRequest ? 'Passende freigegebene Unterlagen zusammenstellen' :
    questions.length ? 'Vorhandene Angaben sichten und gezielte Rückfragen prüfen' : 'Anliegen prüfen und einen konkreten nächsten Schritt vorbereiten';
  return { signals, questions: questions.slice(0, 4), cautions: cautions.slice(0, 3), provided,
    project: suggested, project_origin: explicit ? 'Zugeordnetes Projekt' : suggested ? 'Projektbezug aus dem Text vorgeschlagen' : '',
    mentioned_places: mentioned.map(project => project.place), next_step: next,
    availability_request: availabilityRequest, appointment, appointment_times: appointmentTimes, document_request: documentRequest };
}

export function prepareInquiry(raw) {
  const a = analyzeInquiry(raw);
  const kind = raw.request_kind || 'contact';
  const title = kind === 'project' ? [fieldValueLabel('object_type', raw.object_type) || 'Projektangebot', raw.city].filter(Boolean).join(' · ') :
    kind === 'partner' ? [fieldValueLabel('trade', raw.trade) || 'Baupartner', raw.company].filter(Boolean).join(' · ') :
    kind === 'cooperation' ? fieldValueLabel('cooperation_interest', raw.cooperation_interest) || 'Kooperationsanfrage' : raw.subject || a.signals[0];
  const descriptions = { project: 'bietet ein Projekt an', partner: 'stellt sich als Baupartner vor', cooperation: 'möchte eine Zusammenarbeit besprechen', contact: 'hat eine Anfrage gesendet' };
  const summary = [content(raw.company) || content(raw.name) || 'Ein Kontakt', descriptions[kind] || descriptions.contact].join(' ') + '.' +
    (raw.city ? ' Ort: ' + raw.city + '.' : '') + (raw.trade ? ' Fachgebiet: ' + fieldValueLabel('trade', raw.trade) + '.' : '') +
    (raw.object_type ? ' Objekt: ' + fieldValueLabel('object_type', raw.object_type) + '.' : '') +
    (raw.message ? ' Nachricht: ' + content(raw.message).slice(0, 350) : '');
  let body = 'Vielen Dank für Ihre Anfrage' + (kind === 'project' && raw.city ? ' zu Ihrem Vorhaben in ' + raw.city : '') + '.';
  if (a.availability_request) {
    if (a.project) body += '\n\nWir prüfen die aktuellen Möglichkeiten für ' + a.project.name + ' und melden uns anschließend bei Ihnen.';
    else body += '\n\nDamit wir Ihre Anfrage zuordnen können, benötigen wir noch den Projekt- oder Ortsbezug.';
  } else if (a.appointment) body += a.appointment_times ? '\n\nIhre Zeitvorschläge haben wir aufgenommen. Wir prüfen die Möglichkeiten und melden uns zur Terminabstimmung bei Ihnen.' :
    '\n\nGerne stimmen wir einen passenden Gesprächs- oder Besichtigungstermin mit Ihnen ab. Bitte nennen Sie uns ein oder zwei mögliche Zeitfenster.';
  else if (a.document_request) body += '\n\nWir prüfen, welche Unterlagen zu Ihrem Anliegen vorliegen, und stellen die passenden Informationen für Sie zusammen.';
  else if (kind === 'partner') body += '\n\nWir haben Ihre Angaben für die Prüfung einer möglichen Zusammenarbeit aufgenommen.';
  else if (kind === 'cooperation') body += '\n\nWir sehen uns Ihren Gesprächsanlass an und prüfen den passenden nächsten Schritt.';
  if (a.questions.length && !(a.availability_request && !a.project)) body += '\n\nFür den nächsten Schritt helfen uns noch folgende Angaben, soweit sie bereits vorliegen:\n' + a.questions.map(q => '• ' + q).join('\n');
  else if (!a.availability_request && !a.appointment && !a.document_request && kind !== 'partner' && kind !== 'cooperation') body += '\n\nWir sehen uns Ihre Angaben an und melden uns mit einem passenden nächsten Schritt.';
  return { title, summary, missing: a.questions, next_step: a.next_step,
    draft: 'Guten Tag,\n\n' + body + '\n\nFreundliche Grüße\nRBS Projektentwicklung', preparation_kind: 'rules', assistance: a };
}

export const isDue = (item, today) => item.status !== 'done' && Boolean(item.due_on) && item.due_on.slice(0, 10) <= today;
export function selectCases(items, { view = 'inbox', filter = 'all', memberId = '', query = '', today = '' } = {}) {
  const q = query.toLocaleLowerCase('de');
  return items.filter(item => {
    const inView = view === 'done' ? item.status === 'done' : item.status !== 'done' && (view !== 'mine' || item.owner_id === memberId);
    return inView && (filter !== 'unclaimed' || !item.owner_id) && (filter !== 'due' || isDue(item, today)) &&
      (!q || [item.title, item.contact_name, item.company, item.location, item.email, item.next_step].join(' ').toLocaleLowerCase('de').includes(q));
  }).sort((a, b) => {
    const aDue = isDue(a, today), bDue = isDue(b, today);
    if (aDue !== bDue) return aDue ? -1 : 1;
    if (aDue && a.due_on !== b.due_on) return a.due_on < b.due_on ? -1 : 1;
    return String(b.created_at).localeCompare(String(a.created_at));
  });
}
