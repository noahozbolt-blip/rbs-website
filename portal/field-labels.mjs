const values = {
  object_type: { land: 'Grundstück', existing_building: 'Bestandsgebäude', development_project: 'Entwicklungsprojekt' },
  representative_role: { owner: 'Eigentümer/in', broker: 'Vermittler/in', authorized: 'Bevollmächtigte Person', other: 'Andere Rolle' },
  trade: { architecture: 'Architektur', structural: 'Tragwerksplanung', tga: 'Technische Gebäudeausrüstung',
    energy: 'Energieberatung', shell: 'Rohbau', civil: 'Tiefbau / Erschließung', electrical: 'Elektro',
    shk: 'Sanitär / Heizung / Klima', finishing: 'Ausbau', broker: 'Immobilienvermittlung', other: 'Anderes Fachgebiet' },
  availability: { now: 'Aktuell nach Abstimmung', one_to_three_months: 'In ein bis drei Monaten',
    later: 'Zu einem späteren Zeitpunkt', unknown: 'Projektabhängig / noch offen' },
  cooperation_interest: { project_discussion: 'Konkrete Projektidee', joint_venture_discussion: 'Mögliche Projektkooperation',
    financing_contact: 'Kontakt zum Thema Finanzierung', general_network: 'Fachlicher Austausch / Netzwerk' }
};
export const fieldValueLabel = (field, value) => Object.hasOwn(values[field] || {}, value)
  ? values[field][value] : value;
