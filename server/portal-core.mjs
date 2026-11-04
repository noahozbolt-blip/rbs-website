import { randomUUID, createHash } from 'node:crypto';
import { prepareInquiry, analyzeInquiry } from '../portal/jarvis.mjs';
import { PROJECT_OPTIONS } from '../portal/project-knowledge.mjs';
import { normalizeGuide, advanceGuide, guideNode } from '../portal/guide.mjs';

export class PortalError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const KINDS = new Set(['project', 'partner', 'cooperation', 'contact']);
export const STATUSES = new Set(['new', 'in_progress', 'waiting', 'done']);
const PROJECTS = new Set(Object.keys(PROJECT_OPTIONS));
const FIELDS = ['name', 'email', 'phone', 'company', 'message', 'request_kind', 'request_id',
  'form-name', 'project_id', 'source', 'object_type', 'postal_code', 'city', 'representative_role',
  'area', 'planning_status', 'trade', 'service_region', 'availability', 'reference_summary',
  'cooperation_interest', 'subject', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
const trim = (value, max = 250) => typeof value === 'string' ? value.replace(/\0/g, '').trim().slice(0, max) : '';

export function normalizeInput(data) {
  if (!data || Array.isArray(data) || typeof data !== 'object') throw new PortalError(400, 'Ungültige Anfrage.');
  const raw = Object.fromEntries(FIELDS.filter(k => data[k] !== undefined)
    .map(k => [k, trim(data[k], k === 'message' ? 3000 : k === 'email' ? 254 : 250)]));
  raw.request_kind = KINDS.has(raw.request_kind) ? raw.request_kind : 'contact';
  if (!raw.name) throw new PortalError(400, 'Bitte einen Ansprechpartner angeben.');
  if (raw.email && !/^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(raw.email)) {
    throw new PortalError(400, 'Bitte eine gültige E-Mail-Adresse angeben.');
  }
  if (!raw.message && !raw.city && !raw.company) throw new PortalError(400, 'Bitte das Anliegen kurz beschreiben.');
  raw.project_id = PROJECTS.has(raw.project_id) ? raw.project_id : '';
  return raw;
}

export const prepareWithRules = raw => prepareInquiry(raw);

export async function transaction(db, work) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export async function resolveMember(db, user) {
  if (!user?.id) throw new PortalError(401, 'Bitte anmelden.');
  // Only Netlify-managed app metadata can grant this role. Email is never an
  // authorization key and does not need to be published or passed to builds.
  if (!user.roles?.includes('rbs-pilot')) throw new PortalError(403, 'Für dieses Konto ist kein RBS-Zugang freigegeben.');
  return transaction(db, async client => {
    // A single lock makes the pilot bootstrap exclusive even across devices.
    await client.query("SELECT pg_advisory_xact_lock(hashtext('rbs-portal-pilot'))");
    let member = (await client.query('SELECT * FROM rbs_portal_members WHERE identity_id = $1', [user.id])).rows[0];
    const email = trim(user.email, 254).toLowerCase();
    if (!member) {
      const count = (await client.query('SELECT count(*)::int AS n FROM rbs_portal_members')).rows[0].n;
      if (count >= 2 || !user.confirmedAt || !email) {
        throw new PortalError(403, 'Für dieses Konto ist kein RBS-Zugang freigegeben.');
      }
      member = (await client.query('INSERT INTO rbs_portal_members (id, identity_id, email, display_name) VALUES ($1,$2,$3,$4) RETURNING *',
        [randomUUID(), user.id, email, trim(user.name, 100) || 'RBS Geschäftsführung'])).rows[0];
    }
    if (!member.active) throw new PortalError(403, 'Dieser RBS-Zugang ist deaktiviert.');
    if (email && member.email !== email) {
      member = (await client.query('UPDATE rbs_portal_members SET email=$1 WHERE id=$2 RETURNING *', [email, member.id])).rows[0];
    }
    return member;
  });
}

export async function createCase(db, input, { source = 'manual', actorId = null, requestKey = '' } = {}) {
  const raw = normalizeInput(input);
  const prepared = prepareWithRules(raw);
  const stable = JSON.stringify(Object.fromEntries(Object.entries(raw).sort(([a], [b]) => a.localeCompare(b))));
  const hash = createHash('sha256').update(stable).digest('hex');
  const sourceKey = source === 'website' ? 'website:' + (raw.request_id || '') + ':' + hash :
    'manual:' + actorId + ':' + (trim(requestKey, 80) || randomUUID());
  return transaction(db, async client => {
    const result = await client.query(
      'INSERT INTO rbs_portal_cases (id,source_key,kind,title,contact_name,email,phone,company,location,project_key,original_data,summary,missing,next_step,draft) ' +
      'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT (source_key) DO NOTHING RETURNING *',
      [randomUUID(), sourceKey, raw.request_kind, prepared.title, raw.name, raw.email || '', raw.phone || '', raw.company || '',
        [raw.postal_code, raw.city || raw.service_region].filter(Boolean).join(' '), raw.project_id || '',
        JSON.stringify(raw), prepared.summary, JSON.stringify(prepared.missing), prepared.next_step, prepared.draft]);
    if (result.rows[0]) {
      await addEvent(client, result.rows[0].id, actorId, 'created', { source });
      return { item: result.rows[0], created: true };
    }
    return { item: (await client.query('SELECT * FROM rbs_portal_cases WHERE source_key=$1', [sourceKey])).rows[0], created: false };
  });
}

export async function addEvent(client, caseId, actorId, action, detail = {}) {
  await client.query('INSERT INTO rbs_portal_events (id,case_id,actor_id,action,detail) VALUES ($1,$2,$3,$4,$5)',
    [randomUUID(), caseId, actorId, action, JSON.stringify(detail)]);
}

export async function prepareUnclaimedCase(db, id, prepared) {
  return transaction(db, async client => {
    const result = await client.query(
      'UPDATE rbs_portal_cases SET summary=$1,missing=$2,next_step=$3,draft=$4,preparation_kind=$5,version=version+1,updated_at=now() ' +
      "WHERE id=$6 AND owner_id IS NULL AND version=1 AND draft_state='suggested' RETURNING id",
      [prepared.summary, JSON.stringify(prepared.missing), prepared.next_step, prepared.draft, prepared.preparation_kind, id]);
    if (result.rows.length) await addEvent(client, id, null, 'prepared', { engine: prepared.preparation_kind });
    return result.rows.length === 1;
  });
}

export async function listCases(db, cursor) {
  let values = [], where = '';
  if (cursor) {
    try {
      const [date, id] = JSON.parse(Buffer.from(cursor, 'base64url').toString());
      if (!date || !/^[a-f0-9-]{36}$/.test(id) || Number.isNaN(Date.parse(date))) throw new Error();
      where = 'WHERE (c.created_at,c.id)<($1::timestamptz,$2::uuid)';
      values = [date, id];
    } catch { throw new PortalError(400, 'Ungültige Seitenmarkierung.'); }
  }
  const result = await db.pool.query('SELECT c.*, m.display_name AS owner_name FROM rbs_portal_cases c ' +
    'LEFT JOIN rbs_portal_members m ON m.id=c.owner_id ' + where + ' ORDER BY c.created_at DESC,c.id DESC LIMIT 101', values);
  const items = result.rows.slice(0, 100).map(presentCase);
  const last = items.at(-1);
  const next = result.rows.length > 100 ? Buffer.from(JSON.stringify([last.created_at, last.id])).toString('base64url') : null;
  return { items, next };
}

export async function getCase(db, id) {
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new PortalError(404, 'Vorgang nicht gefunden.');
  const item = (await db.pool.query('SELECT c.*, m.display_name AS owner_name FROM rbs_portal_cases c ' +
    'LEFT JOIN rbs_portal_members m ON m.id=c.owner_id WHERE c.id=$1', [id])).rows[0];
  if (!item) throw new PortalError(404, 'Vorgang nicht gefunden.');
  const events = (await db.pool.query('SELECT e.id,e.action,e.detail,e.created_at,m.display_name AS actor_name ' +
    'FROM rbs_portal_events e LEFT JOIN rbs_portal_members m ON m.id=e.actor_id WHERE e.case_id=$1 ORDER BY e.created_at ASC LIMIT 500', [id])).rows;
  return { item: presentCase(item), events, guide: await readGuide(db.pool, item) };
}

async function readGuide(client, item) {
  const result = await client.query("SELECT detail FROM rbs_portal_events WHERE case_id=$1 AND action='guide' " +
    "ORDER BY (detail->>'case_version')::int DESC NULLS LAST,created_at DESC,id DESC LIMIT 1", [item.id]);
  return normalizeGuide(item.kind, result.rows[0]?.detail);
}

function presentCase(item) {
  const raw = { ...item.original_data, project_id: item.project_key || item.original_data.project_id };
  const assistance = analyzeInquiry(raw);
  if (item.preparation_kind !== 'rules') return { ...item, assistance };
  const prepared = prepareWithRules(raw);
  const pristine = item.version === 1 && !item.owner_id && item.draft_state === 'suggested';
  // Existing human work is never regenerated merely by reading a case.
  return { ...item, title: prepared.title, summary: prepared.summary, missing: prepared.missing, assistance,
    ...(pristine ? { next_step: prepared.next_step, draft: prepared.draft } : {}) };
}

export async function mutateCase(db, id, member, input, prepared) {
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new PortalError(404, 'Vorgang nicht gefunden.');
  return transaction(db, async client => {
    const item = (await client.query('SELECT * FROM rbs_portal_cases WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!item) throw new PortalError(404, 'Vorgang nicht gefunden.');
    if (input.version !== item.version) throw new PortalError(409, 'Der Vorgang wurde inzwischen geändert. Bitte neu laden; Ihre Eingaben bleiben erhalten.');
    if (input.action === 'claim') {
      if (item.owner_id && item.owner_id !== member.id) throw new PortalError(409, 'Dieser Vorgang wurde bereits übernommen.');
      if (item.owner_id === member.id) return item;
      await client.query("UPDATE rbs_portal_cases SET owner_id=$1,status=CASE WHEN status='new' THEN 'in_progress' ELSE status END,version=version+1,updated_at=now() WHERE id=$2",
        [member.id, id]);
      await addEvent(client, id, member.id, 'claimed');
    } else {
      if (item.owner_id !== member.id) throw new PortalError(403, 'Bitte den Vorgang zuerst übernehmen.');
      if (input.action === 'save') {
        const draft = trim(input.draft, 6000);
        const next = trim(input.next_step, 500);
        if (!next) throw new PortalError(400, 'Bitte einen nächsten Schritt angeben.');
        const due = trim(input.due_on, 10);
        if (due && (!/^\d{4}-\d{2}-\d{2}$/.test(due) || Number.isNaN(Date.parse(due)) ||
          new Date(due).toISOString().slice(0, 10) !== due)) throw new PortalError(400, 'Bitte ein gültiges Datum angeben.');
        const project = trim(input.project_key);
        if (!PROJECTS.has(project)) throw new PortalError(400, 'Unbekannter Projektbezug.');
        await client.query('UPDATE rbs_portal_cases SET draft=$1,draft_state=$2,next_step=$3,due_on=$4,project_key=$5,version=version+1,updated_at=now() WHERE id=$6',
          [draft, draft === item.draft ? item.draft_state : 'edited', next, due || null, project, id]);
        await addEvent(client, id, member.id, 'saved');
      } else if (input.action === 'guide') {
        const previous = await readGuide(client, item);
        let guide;
        try { guide = advanceGuide(item.kind, previous, input.operation, input.target); }
        catch (error) { throw new PortalError(400, error.message); }
        if (JSON.stringify(guide.path) === JSON.stringify(previous.path)) return item;
        await addEvent(client, id, member.id, 'guide', { ...guide,
          label: guideNode(item.kind, guide.path.at(-1)).label, case_version: item.version + 1 });
        await client.query('UPDATE rbs_portal_cases SET version=version+1,updated_at=now() WHERE id=$1', [id]);
      } else if (input.action === 'status') {
        if (!STATUSES.has(input.status) || input.status === 'new') throw new PortalError(400, 'Ungültiger Bearbeitungsstatus.');
        await client.query('UPDATE rbs_portal_cases SET status=$1,version=version+1,updated_at=now() WHERE id=$2', [input.status, id]);
        await addEvent(client, id, member.id, 'status', { status: input.status });
      } else if (input.action === 'note') {
        const note = trim(input.note, 3000);
        if (!note) throw new PortalError(400, 'Bitte eine Notiz eingeben.');
        await addEvent(client, id, member.id, 'note', { note });
        await client.query('UPDATE rbs_portal_cases SET version=version+1,updated_at=now() WHERE id=$1', [id]);
      } else if (input.action === 'review') {
        if (!item.draft.trim()) throw new PortalError(400, 'Der Antwortentwurf ist leer.');
        await client.query("UPDATE rbs_portal_cases SET draft_state='reviewed',version=version+1,updated_at=now() WHERE id=$1", [id]);
        await addEvent(client, id, member.id, 'reviewed');
      } else if (input.action === 'prepare' && prepared) {
        if (item.draft_state !== 'suggested') throw new PortalError(409, 'Ein bearbeiteter oder geprüfter Entwurf wird nicht automatisch überschrieben.');
        await client.query('UPDATE rbs_portal_cases SET summary=$1,missing=$2,next_step=$3,draft=$4,preparation_kind=$5,version=version+1,updated_at=now() WHERE id=$6',
          [prepared.summary, JSON.stringify(prepared.missing), prepared.next_step, prepared.draft, prepared.preparation_kind, id]);
        await addEvent(client, id, member.id, 'prepared', { engine: prepared.preparation_kind });
      } else throw new PortalError(400, 'Unbekannte Aktion.');
    }
    return (await client.query('SELECT * FROM rbs_portal_cases WHERE id=$1', [id])).rows[0];
  });
}
