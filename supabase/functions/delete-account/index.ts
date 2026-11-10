/**
 * delete-account — permanently deletes the caller's account and personal data.
 * Deleting the auth user cascades to profiles, stats, sessions, daily results,
 * cloud saves and analytics events linked to the user (see the migration).
 */
import { adminClient, error, handleOptions, json, requireUser } from '../_shared/http.ts';

Deno.serve(async (req) => {
  const early = handleOptions(req);
  if (early) return early;

  const admin = adminClient();
  const user = await requireUser(req, admin);
  if (user instanceof Response) return user;

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error('delete-account failed', deleteError);
    return error('Could not delete the account. Please contact support.', 500);
  }
  return json({ status: 'deleted' });
});
