import type { FormSubmittedEvent } from '@netlify/functions';
import { getDatabase } from '@netlify/database';
import { createCase, prepareUnclaimedCase } from '../../server/portal-core.mjs';
import { prepareWithAI } from '../../server/portal-ai.mjs';

export default {
  async formSubmitted(event: FormSubmittedEvent) {
    const data = event.data;
    if (!['project', 'partner', 'cooperation', 'contact'].includes(data.request_kind)) return;
    if (data['bot-field']) return;
    // Platform-signed form events are verified by Netlify, not a public ingest endpoint.
    const db = getDatabase();
    const { item, created } = await createCase(db, data, { source: 'website' });
    if (created && Netlify.env.get('OPENAI_BASE_URL')) {
      try {
        const prepared = await prepareWithAI(item.original_data);
        await prepareUnclaimedCase(db, item.id, prepared);
      } catch (error) {
        // Receipt already succeeded. Keep the useful rule-based preparation;
        // never log incoming business content or fail delivery over an AI error.
        console.info(JSON.stringify({ event: 'portal_preparation_fallback', type: error?.name || 'Error' }));
      }
    }
  }
};
