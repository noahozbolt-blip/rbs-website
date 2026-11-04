import test from 'node:test';
import assert from 'node:assert/strict';
import { completePortalIdentity } from '../server/portal-auth.mjs';
import { setPasswordAndLogin, resumePortalSession, requestWithSession } from '../portal/auth-flow.mjs';

const claims = { id: 'verified-identity', email: 'pilot@example.invalid', roles: ['rbs-pilot'] };
const profile = { ...claims, confirmedAt: '2026-11-03T10:00:00Z' };
const unexpectedLookup = () => { throw new Error('Unexpected privileged lookup'); };

test('a resumed session finishes renewal before opening the workspace', async () => {
  let renewed = false;
  assert.equal(await resumePortalSession({ refreshSession: async () => { renewed = true; },
    getUser: async () => { assert.ok(renewed); return profile; } }), profile);
});
test('an expired API session is renewed and retried exactly once', async () => {
  let calls = 0, renewals = 0;
  const response = await requestWithSession(async () => ({ status: ++calls === 1 ? 401 : 200 }), async () => { renewals++; return 'synthetic-new-session'; });
  assert.equal(response.status, 200); assert.equal(calls, 2); assert.equal(renewals, 1);
});
test('failed renewal, authorization denials and server errors do not repeat writes', async () => {
  for (const status of [401, 403, 409, 503]) {
    let calls = 0;
    const response = await requestWithSession(async () => { calls++; return { status }; }, async () => null);
    assert.equal(response.status, status); assert.equal(calls, 1);
  }
});

test('unauthenticated or unapproved identities cannot trigger a privileged lookup', async () => {
  assert.equal(await completePortalIdentity(null, unexpectedLookup), null);
  await assert.rejects(completePortalIdentity({ ...claims, roles: [] }, unexpectedLookup), { status: 403 });
});
test('a verified claims-only session loads confirmation from its own authoritative profile', async () => {
  let requestedId;
  assert.deepEqual(await completePortalIdentity(claims, async id => {
    requestedId = id; return profile;
  }), profile);
  assert.equal(requestedId, claims.id);
  assert.equal(await completePortalIdentity(profile, unexpectedLookup), profile);
});
test('missing confirmation or revoked profile role never grants access', async () => {
  for (const invalid of [{ ...profile, confirmedAt: undefined }, { ...profile, roles: [] }]) {
    await assert.rejects(completePortalIdentity(claims, async () => invalid), { status: 403 });
  }
});
test('an identity mismatch or failed authoritative lookup fails closed', async () => {
  await assert.rejects(completePortalIdentity(claims, async () => ({ ...profile, id: 'other-user' })), { status: 503 });
  await assert.rejects(completePortalIdentity(claims, async () => null), { status: 503 });
  await assert.rejects(completePortalIdentity(claims, async () => { throw new Error('Service unavailable'); }), /Service unavailable/);
});
for (const mode of ['invite', 'recovery']) {
  test(mode + ' establishes the protected API session after saving the password', async () => {
    let saved = false, apiSession = false, redeemed = 0;
    const save = async (token, password) => {
      assert.equal(token, 'synthetic-token'); assert.equal(password, 'synthetic-password');
      saved = true; redeemed++; return profile;
    };
    const auth = { acceptInvite: save, recoverPassword: save, login: async (email, password) => {
      assert.ok(saved); assert.equal(email, profile.email); assert.equal(password, 'synthetic-password');
      apiSession = true; return profile;
    } };
    assert.equal(await setPasswordAndLogin(auth, mode, 'synthetic-token', 'synthetic-password'), profile);
    assert.ok(apiSession); assert.equal(redeemed, 1);
  });
}
test('a failed invitation does not log in or consume the token a second time', async () => {
  let calls = 0;
  await assert.rejects(setPasswordAndLogin({ acceptInvite: async () => {
    calls++; throw new Error('Expired invitation');
  }, login: unexpectedLookup }, 'invite', 'expired', 'synthetic-password'), /Expired invitation/);
  assert.equal(calls, 1);
});
test('a saved password is distinguished from a failed subsequent login', async () => {
  await assert.rejects(setPasswordAndLogin({ acceptInvite: async () => profile,
    login: async () => { throw new Error('Temporary login failure'); }
  }, 'invite', 'synthetic-token', 'synthetic-password'), error => {
    assert.equal(error.passwordSaved, true); assert.equal(error.loginEmail, profile.email);
    return true;
  });
});
