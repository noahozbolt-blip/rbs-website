import type { FormSubmittedEvent } from '@netlify/functions';
import { getDatabase } from '@netlify/database';
import { createCase } from '../../server/portal-core.mjs';

export default {
  async formSubmitted(event: FormSubmittedEvent) {
    const data = event.data;
    if (!['project', 'partner', 'cooperation', 'contact'].includes(data.request_kind)) return;
    if (data['bot-field']) return;
    // Platform-signed form events are verified by Netlify, not a public ingest endpoint.
    await createCase(getDatabase(), data, { source: 'website' });
  }
};
