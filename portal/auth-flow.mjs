// Explicit login synchronizes the server session after invite/recovery. The
// installed Identity SDK establishes a local session in these two flows but
// does not immediately write the cookie that protects the portal API.
export async function setPasswordAndLogin(auth, mode, token, password) {
  let user;
  if (mode === 'invite') user = await auth.acceptInvite(token, password);
  else if (mode === 'recovery') user = await auth.recoverPassword(token, password);
  else throw new Error('Ungültiger Anmeldevorgang.');
  try {
    if (!user?.email) throw new Error('Die E-Mail-Adresse konnte nicht übernommen werden.');
    return await auth.login(user.email, password);
  } catch (error) {
    // The token is already consumed even when the separate login fails.
    error.passwordSaved = true;
    error.loginEmail = user?.email;
    throw error;
  }
}
