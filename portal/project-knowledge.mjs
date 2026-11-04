// Public website facts only. Checked against the source on 4 November 2026.
// A website status is not a live inventory, building certificate or commitment.
export const KNOWLEDGE_DATE = '2026-11-04';
export const PROJECT_KNOWLEDGE = [
  { key: 'nentershausen', name: 'Mehrfamilienhaus Nentershausen', place: 'Nentershausen',
    source: '/projekt-nentershausen.html', model: '/3d/nentershausen/',
    facts: ['6 Wohneinheiten', 'Erdgeschoss, Obergeschoss und Dachgeschoss', '12 Stellplätze', 'Website-Status: Im Bau'],
    note: 'Das Außenmodell basiert auf Planunterlagen und enthält dokumentierte Annahmen. Freie Einheiten, Preise und Fertigstellung sind damit nicht bestätigt.',
    units: 6 },
  { key: 'niedererbach', name: 'Soziales Wohnprojekt Niedererbach', place: 'Niedererbach',
    source: '/projekt-niedererbach.html', model: '/3d/niedererbach/',
    facts: ['15 Einheiten und Gastronomie', 'Ambulant betreutes Wohnen', 'Website-Status: In Betrieb', 'Umbauvisualisierung: Planstand Juli/September 2026'],
    note: 'Das 3D-Modell zeigt den geplanten Umbau. Der heutige Bestand und aktuelle freie Plätze lassen sich daraus nicht ableiten.' },
  { key: 'flacht', name: 'Projekt Flacht', place: 'Flacht', source: '/#projekte',
    facts: ['Revitalisierung einer Bestandsimmobilie', 'Geplanter Mix: Mietwohnungen, Eigentum und ambulant betreutes Wohnen', 'Website-Status: Entkernung und Planung'],
    note: 'Die Website nennt keine bestätigten freien Einheiten, Verkaufspreise oder Fertigstellungstermine.' }
];
export const PROJECT_OPTIONS = { '': 'Ohne Projektbezug',
  ...Object.fromEntries(PROJECT_KNOWLEDGE.map(p => [p.key, p.place])), bestand: 'Bestandsentwicklung allgemein' };
export const projectByKey = key => PROJECT_KNOWLEDGE.find(project => project.key === key) || null;
