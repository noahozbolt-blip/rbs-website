import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { resolveMember, createCase, mutateCase, getCase, listCases, normalizeInput, prepareWithRules, prepareUnclaimedCase } from '../server/portal-core.mjs';

let pg, db, member, second, project;
const user = { id: 'verified-identity-one', email: 'pilot@example.invalid', confirmedAt: '2026-11-03T10:00:00Z', roles: ['rbs-pilot'] };
const input = { request_kind: 'project', request_id: 'technical-test-01', name: 'Technischer Test',
  email: 'test@example.invalid', city: 'Testort', message: 'Synthetisches Grundstücksangebot zur Prüfung der Verarbeitung.' };
before(async () => {
  pg = new PGlite();
  await pg.waitReady;
  await pg.exec(await readFile(new URL('../netlify/database/migrations/20261103121500_rbs_portal.sql', import.meta.url), 'utf8'));
  const client = { query: (sql, values) => pg.query(sql, values), release() {} };
  db = { pool: { connect: async () => client, query: client.query } };
});
after(async () => { await pg.close(); });

test('identity and administrator-managed role are both required', async () => {
  await assert.rejects(resolveMember(db, null), { status: 401 });
  await assert.rejects(resolveMember(db, { ...user, roles: [] }), { status: 403 });
  await assert.rejects(resolveMember(db, { ...user, confirmedAt: null }), { status: 403 });
  const result = await pg.query('SELECT count(*)::int AS n FROM rbs_portal_members');
  assert.equal(result.rows[0].n, 0);
});
test('first verified invited account receives a stable internal identity', async () => {
  member = await resolveMember(db, user);
  assert.ok(member.id);
  assert.notEqual(member.id, user.email);
  await assert.rejects(resolveMember(db, { ...user, id: 'second-unapproved-identity', roles: [] }), { status: 403 });
});
test('a second invited operator shares the workspace; further identities remain blocked', async () => {
  second = await resolveMember(db, { ...user, id: 'verified-identity-two', email: 'second@example.invalid', name: 'Zweiter Testbenutzer' });
  assert.notEqual(second.id, member.id);
  assert.equal(second.display_name, 'Zweiter Testbenutzer');
  await assert.rejects(resolveMember(db, { ...user, id: 'third-identity' }), { status: 403 });
});
test('website events are idempotent without losing the original source', async () => {
  const first = await createCase(db, input, { source: 'website' });
  const repeat = await createCase(db, input, { source: 'website' });
  project = first.item;
  assert.equal(first.created, true); assert.equal(repeat.created, false);
  assert.equal(first.item.id, repeat.item.id);
  const detail = await getCase(db, project.id);
  assert.equal(detail.events.length, 1);
  assert.equal(detail.item.original_data.message, input.message);
});
test('different content with a reused request id does not disappear as a duplicate', async () => {
  const other = await createCase(db, { ...input, message: 'Ein anderes, ebenfalls synthetisches Vorhaben.' }, { source: 'website' });
  assert.notEqual(other.item.id, project.id);
});
test('background preparation can enrich a new request but never an already claimed one', async () => {
  const first = await createCase(db, { ...input, request_id: 'background-test' }, { source: 'website' });
  const prepared = { summary: 'Synthetisch vorbereitet.', missing: [], next_step: 'Unterlagen prüfen', draft: 'Synthetischer Entwurf.', preparation_kind: 'ai' };
  assert.equal(await prepareUnclaimedCase(db, first.item.id, prepared), true);
  const secondCase = await createCase(db, { ...input, request_id: 'background-claimed-test' }, { source: 'website' });
  await mutateCase(db, secondCase.item.id, member, { action: 'claim', version: 1 });
  assert.equal(await prepareUnclaimedCase(db, secondCase.item.id, prepared), false);
});
test('claim establishes responsibility and stale edits cannot overwrite it', async () => {
  const claimed = await mutateCase(db, project.id, member, { action: 'claim', version: project.version });
  assert.equal(claimed.owner_id, member.id); assert.equal(claimed.status, 'in_progress');
  await assert.rejects(mutateCase(db, project.id, second, { action: 'claim', version: project.version }), { status: 409 });
  await assert.rejects(mutateCase(db, project.id, second, { action: 'claim', version: claimed.version }), { status: 409 });
  await assert.rejects(mutateCase(db, project.id, member, { action: 'status', version: project.version, status: 'done' }), { status: 409 });
  project = claimed;
});
test('another actor cannot edit an owned request', async () => {
  await assert.rejects(mutateCase(db, project.id, second, { action: 'status', version: project.version, status: 'done' }), { status: 403 });
});
test('verified email change keeps the same member, ownership, notes and requests', async () => {
  const changed = await resolveMember(db, { ...user, email: 'director@example.invalid' });
  assert.equal(changed.id, member.id); assert.equal(changed.email, 'director@example.invalid');
  assert.equal((await getCase(db, project.id)).item.owner_id, changed.id);
  member = changed;
});
test('save and review preserve original input and record distinct actions', async () => {
  project = await mutateCase(db, project.id, member, { action: 'save', version: project.version,
    draft: 'Manuell geprüfter, synthetischer Entwurf.', next_step: 'Unterlagen prüfen', due_on: '2026-11-10', project_key: 'nentershausen' });
  assert.equal(project.draft_state, 'edited');
  project = await mutateCase(db, project.id, member, { action: 'review', version: project.version });
  assert.equal(project.draft_state, 'reviewed');
  const detail = await getCase(db, project.id);
  assert.equal(detail.item.original_data.message, input.message);
  assert.deepEqual(detail.events.slice(-2).map(e => e.action), ['saved', 'reviewed']);
});
test('AI preparation cannot overwrite a human-edited or reviewed draft', async () => {
  const prepared = { summary: 'New', missing: [], next_step: 'New', draft: 'Overwrite', preparation_kind: 'ai' };
  await assert.rejects(mutateCase(db, project.id, member, { action: 'prepare', version: project.version }, prepared), { status: 409 });
  assert.equal((await getCase(db, project.id)).item.draft, project.draft);
});
test('invalid calendar dates roll back atomically', async () => {
  await assert.rejects(mutateCase(db, project.id, member, { action: 'save', version: project.version,
    draft: 'Should not persist', next_step: 'Test', due_on: '2026-02-30', project_key: '' }), { status: 400 });
  const unchanged = (await getCase(db, project.id)).item;
  assert.equal(unchanged.draft, project.draft); assert.equal(unchanged.version, project.version);
});
test('notes, closing and reopening are traceable and do not send email', async () => {
  project = await mutateCase(db, project.id, member, { action: 'note', version: project.version, note: 'Synthetische Besichtigung abgestimmt.' });
  project = await mutateCase(db, project.id, member, { action: 'status', version: project.version, status: 'done' });
  project = await mutateCase(db, project.id, member, { action: 'status', version: project.version, status: 'in_progress' });
  const { events } = await getCase(db, project.id);
  assert.ok(events.some(e => e.action === 'note')); assert.ok(!events.some(e => e.action === 'sent'));
});
test('unknown fields, header injection and arbitrary project ids are rejected or excluded', () => {
  const normalized = normalizeInput({ ...input, project_id: 'untrusted-project', admin: true });
  assert.equal(normalized.project_id, ''); assert.equal(normalized.admin, undefined);
  assert.throws(() => normalizeInput({ ...input, email: 'a@example.com\r\nBcc: bad@example.com' }), { status: 400 });
  const prepared = prepareWithRules(normalized);
  assert.ok(prepared.summary.includes('Testort')); assert.equal(prepared.preparation_kind, 'rules');
});
test('website option codes are readable without changing originals or edited drafts', async () => {
  assert.equal(prepareWithRules({ ...input, object_type: 'land' }).title, 'Grundstück · Testort');
  assert.equal(prepareWithRules({ ...input, request_kind: 'cooperation', cooperation_interest: 'project_discussion' }).title, 'Konkrete Projektidee');
  const created = await createCase(db, { ...input, request_kind: 'partner', trade: 'shell', company: 'Synthetischer Betrieb' });
  await pg.query("UPDATE rbs_portal_cases SET title='shell',summary='Fachgebiet: shell.',draft='Unveränderter manueller Entwurf',draft_state='edited' WHERE id=$1", [created.item.id]);
  const { item } = await getCase(db, created.item.id);
  assert.equal(item.title, 'Rohbau · Synthetischer Betrieb');
  assert.ok(item.summary.includes('Fachgebiet: Rohbau.'));
  assert.equal(item.original_data.trade, 'shell');
  assert.equal(item.draft, 'Unveränderter manueller Entwurf');
  const stored = (await pg.query('SELECT title FROM rbs_portal_cases WHERE id=$1', [item.id])).rows[0];
  assert.equal(stored.title, 'shell');
  assert.equal((await listCases(db)).items.find(row => row.id === item.id).title, item.title);
});
test('project suggestions remain separate from manual assignment and preserved work', async () => {
  const created = await createCase(db, { request_kind: 'contact', name: 'Synthetischer Interessent',
    message: 'Ist in Ihrem Mehrfamilienhaus in Nentershausen noch eine Wohnung frei?' });
  const firstRead = (await getCase(db, created.item.id)).item;
  assert.equal(firstRead.project_key, '');
  assert.equal(firstRead.assistance.project.key, 'nentershausen');
  let assigned = await mutateCase(db, firstRead.id, member, { action: 'claim', version: firstRead.version });
  assigned = await mutateCase(db, assigned.id, member, { action: 'save', version: assigned.version,
    draft: 'Persönlich bearbeitet. Keine Zusage.', next_step: 'Persönliche Rücksprache', due_on: '', project_key: 'flacht' });
  const reread = (await getCase(db, assigned.id)).item;
  assert.equal(reread.project_key, 'flacht');
  assert.equal(reread.assistance.project.key, 'flacht');
  assert.equal(reread.draft, 'Persönlich bearbeitet. Keine Zusage.');
  assert.equal(reread.next_step, 'Persönliche Rücksprache');
  assert.equal(reread.original_data.message, created.item.original_data.message);
});
test('pagination validates its cursor and disabled or role-revoked users lose access', async () => {
  await assert.rejects(listCases(db, 'not-a-cursor'), { status: 400 });
  assert.ok((await listCases(db)).items.length >= 2);
  await assert.rejects(resolveMember(db, { ...user, roles: [] }), { status: 403 });
  await pg.query('UPDATE rbs_portal_members SET active=false WHERE id=$1', [member.id]);
  await assert.rejects(resolveMember(db, user), { status: 403 });
});
