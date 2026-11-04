import test from 'node:test';
import assert from 'node:assert/strict';
import { initialGuide, guideNode, advanceGuide, normalizeGuide, guidePlan, guideRecommendation } from '../portal/guide.mjs';
import { renderGuide, renderGuidePreview } from '../portal/guide-view.mjs';

const raw = { request_kind: 'project', name: 'Synthetischer Test', city: 'Limburg', area: '1.100 m²',
  message: 'Ein Grundstück mit Lageplan. Das Baurecht ist noch unbekannt.' };
const choose = (state, target) => advanceGuide(state.kind, state, 'choose', target);

test('each request type starts with three relevant options', () => {
  for (const kind of ['project', 'partner', 'cooperation', 'contact']) {
    assert.equal(guideNode(kind, 'start').options.length, 3);
  }
  assert.equal(guideNode('partner', 'start').options[0].label, 'Leistungen klären');
});
test('a contextual recommendation leaves all three routes available', () => {
  assert.equal(guideRecommendation(raw).id, 'documents');
  assert.equal(guideRecommendation({ request_kind: 'contact', message: 'Können wir einen Gesprächstermin am Donnerstag vereinbaren?' }).id, 'conversation');
  assert.equal(guideRecommendation({ request_kind: 'contact', message: 'Ist im Projekt Nentershausen noch eine Wohnung frei?' }).id, 'assess');
  assert.equal(guideNode('project', 'start').options.length, 3);
});
test('only the selected path is continued and changing it preserves prior state', () => {
  const start = initialGuide('project');
  const documents = choose(start, 'documents');
  const assess = choose(documents, 'assess');
  assert.deepEqual(start.path, ['start']);
  assert.deepEqual(assess.path, ['start', 'documents', 'assess']);
  assert.deepEqual(advanceGuide('project', assess, 'back').path, documents.path);
  assert.deepEqual(advanceGuide('project', assess, 'reset').path, ['start']);
});
test('invalid jumps, arbitrary operations and forged saved paths are refused', () => {
  assert.throws(() => choose(initialGuide('project'), 'finish_decline'), /aktuellen Weg/);
  assert.throws(() => advanceGuide('project', null, 'send', 'documents'), /Unbekannte/);
  assert.deepEqual(normalizeGuide('project', { schema: 1, kind: 'project', path: ['start', 'finish_decline'] }).path, ['start']);
  assert.deepEqual(normalizeGuide('project', { schema: 1, kind: 'contact', path: ['start', 'documents'] }).path, ['start']);
});
test('bounded route history can always be reset', () => {
  let state = initialGuide('project');
  while (state.path.length < 24) {
    state = choose(state, state.path.at(-1) === 'documents' ? 'assess' : 'documents');
  }
  assert.throws(() => choose(state, state.path.at(-1) === 'documents' ? 'assess' : 'documents'), /zurückgehen/);
  assert.deepEqual(advanceGuide('project', state, 'reset').path, ['start']);
});
test('document preparation uses actual missing information and keeps known area', () => {
  const plan = guidePlan(raw, choose(initialGuide('project'), 'documents'));
  assert.match(plan.draft, /Baurecht/);
  assert.doesNotMatch(plan.draft, /Welche Grundstücks- oder Gebäudefläche/);
  assert.ok(plan.outcomes.length > 1);
  assert.equal(raw.area, '1.100 m²');
});
test('partial information and internal review do not generate an unnecessary external reply', () => {
  const docs = choose(initialGuide('project'), 'documents');
  assert.equal(guidePlan(raw, choose(docs, 'documents_partial')).draft, null);
  assert.equal(guidePlan(raw, choose(docs, 'assess')).draft, null);
});
test('conversation preparation respects existing time proposals', () => {
  const input = { request_kind: 'contact', message: 'Ein Gesprächstermin am Donnerstag um 14.00 Uhr?' };
  const plan = guidePlan(input, choose(initialGuide('contact'), 'conversation'));
  assert.match(plan.draft, /Zeitvorschläge liegen vor/);
  assert.doesNotMatch(plan.draft, /Bitte nennen Sie/);
});
test('closure needs a separate explicit branch and never implies an automatic refusal', () => {
  const finish = choose(initialGuide('project'), 'finish');
  assert.equal(guidePlan(raw, finish).draft, null);
  const archive = guidePlan(raw, choose(finish, 'finish_archive'));
  assert.equal(archive.complete, true); assert.equal(archive.draft, null);
  const decline = guidePlan(raw, choose(finish, 'finish_decline'));
  assert.match(decline.draft, /nicht weiterverfolgen/);
  assert.ok(decline.checks.some(text => text.includes('tatsächlich beschlossen')));
});
test('free editing and the preview keep draft replacement an explicit choice', () => {
  const item = { id: 'synthetic', kind: 'project', original_data: raw, project_key: '', status: 'new' };
  assert.match(renderGuide(item, null, { owned: true }), /Frei bearbeiten/);
  assert.doesNotMatch(renderGuide(item, null, { owned: true, hidden: true }), /data-guide-op/);
  const plan = guidePlan(raw, choose(initialGuide('project'), 'documents'));
  const preview = renderGuidePreview(plan, { edited: true });
  assert.match(preview, /Nur nächsten Schritt übernehmen/);
  assert.match(preview, /Entwurf ersetzen und Schritt übernehmen/);
});
