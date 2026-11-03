import { getUser, admin, verifyRequestOrigin } from '@netlify/identity';
import { getDatabase } from '@netlify/database';
import { PortalError, resolveMember, listCases, getCase, createCase, mutateCase } from '../../server/portal-core.mjs';
import { prepareWithAI, AI_RELEASE_APPROVED } from '../../server/portal-ai.mjs';
import { completePortalIdentity } from '../../server/portal-auth.mjs';

const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow' };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers });

export default async (request: Request, context) => {
  try {
    if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Methode nicht erlaubt.' }, 405);
    if (request.method === 'POST') verifyRequestOrigin(request);
    const session = await getUser();
    const user = await completePortalIdentity(session, id => admin.getUser(id));
    if (!user) return json({ error: 'Bitte anmelden.' }, 401);
    const db = getDatabase();
    const member = await resolveMember(db, user);
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api\/portal\/?/, '').replace(/\/$/, '');
    if (request.method === 'GET') {
      if (path === 'me') return json({ member, pending_email: user.pendingEmail || null,
        mail_connected: false, ai_available: AI_RELEASE_APPROVED && Boolean(Netlify.env.get('OPENAI_BASE_URL')) });
      if (path === 'cases') return json(await listCases(db, url.searchParams.get('cursor')));
      const match = path.match(/^cases\/([a-f0-9-]{36})$/i);
      if (match) return json(await getCase(db, match[1]));
    } else {
      const length = Number(request.headers.get('content-length') || 0);
      if (length > 20000) throw new PortalError(413, 'Die Eingabe ist zu groß.');
      const text = await request.text();
      if (text.length > 20000) throw new PortalError(413, 'Die Eingabe ist zu groß.');
      let body;
      try { body = JSON.parse(text); } catch { throw new PortalError(400, 'Ungültige Eingabe.'); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new PortalError(400, 'Ungültige Eingabe.');
      if (path === 'cases') {
        return json(await createCase(db, body, { actorId: member.id, requestKey: request.headers.get('Idempotency-Key') }), 201);
      }
      if (path === 'profile') {
        const name = typeof body.display_name === 'string' ? body.display_name.trim().slice(0, 100) : '';
        if (!name) throw new PortalError(400, 'Bitte einen Namen angeben.');
        const result = await db.pool.query('UPDATE rbs_portal_members SET display_name=$1 WHERE id=$2 RETURNING *', [name, member.id]);
        return json({ member: result.rows[0] });
      }
      const match = path.match(/^cases\/([a-f0-9-]{36})\/actions$/i);
      if (match) {
        let prepared;
        if (body.action === 'prepare') {
          const { item } = await getCase(db, match[1]);
          if (item.owner_id !== member.id) throw new PortalError(403, 'Bitte den Vorgang zuerst übernehmen.');
          if (item.version !== body.version || item.draft_state !== 'suggested') {
            throw new PortalError(409, 'Der Entwurf wurde bereits bearbeitet. Ihre Änderungen bleiben erhalten.');
          }
          prepared = await prepareWithAI(item.original_data);
        }
        return json({ item: await mutateCase(db, match[1], member, body, prepared) });
      }
    }
    return json({ error: 'Nicht gefunden.' }, 404);
  } catch (error) {
    const status = error instanceof PortalError ? error.status :
      (error?.status === 403 ? 403 : 503);
    if (!(error instanceof PortalError) && status !== 403) {
      console.error(JSON.stringify({ event: 'portal_error', request_id: context.requestId, type: error?.name || 'Error' }));
    }
    return json({ error: error instanceof PortalError ? error.message :
      status === 403 ? 'Diese Aktion ist von dieser Seite nicht erlaubt.' :
      'Der Arbeitsbereich ist gerade nicht erreichbar. Bitte später erneut versuchen.' }, status);
  }
};
export const config = { path: ['/api/portal', '/api/portal/*'], rateLimit: {
  action: 'rate_limit', aggregateBy: 'ip', windowSize: 60, windowLimit: 120
} };
