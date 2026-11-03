// Identity emails arrive at the primary website URL. Keep their token in the
// fragment and move directly to the portal callback without sending it to a server.
if (/^#(?:invite_token|recovery_token|confirmation_token|email_change_token|access_token)=/.test(location.hash)) {
  location.replace('/portal/' + location.hash);
}
