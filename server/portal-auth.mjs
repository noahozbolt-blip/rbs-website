import { PortalError } from './portal-core.mjs';

// Identity's verified JWT context can omit profile fields such as confirmedAt.
// Read only that authenticated user's authoritative profile; never infer email
// verification from the existence of a session or from client-supplied metadata.
export async function completePortalIdentity(session, readIdentity) {
  if (!session?.id) return null;
  if (!session.roles?.includes('rbs-pilot')) {
    throw new PortalError(403, 'Für dieses Konto ist kein RBS-Zugang freigegeben.');
  }
  if (session.confirmedAt) return session;
  const profile = await readIdentity(session.id);
  if (!profile || profile.id !== session.id) {
    throw new PortalError(503, 'Die Kontobestätigung konnte gerade nicht geprüft werden. Bitte erneut versuchen.');
  }
  if (!profile.confirmedAt || !profile.roles?.includes('rbs-pilot')) {
    throw new PortalError(403, 'Ihr RBS-Zugang ist noch nicht vollständig bestätigt oder freigegeben.');
  }
  return profile;
}
