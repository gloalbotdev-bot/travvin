/**
 * Account deletion request (Base44 requestAccountDeletion port).
 * Does not delete the user — notifies admins + logs confirmation (email when SMTP wired).
 */
import { pushInAppNotification } from './push-in-app-notification.js';
import { SERVICE_ACTOR } from './service-role.js';

/**
 * @param {ReturnType<import('./entity-store.js').createEntityStore>} store
 * @param {{ id: string, email?: string, full_name?: string }} user
 */
export async function requestAccountDeletion(store, user) {
  if (!user?.id) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }

  const email = String(user.email || '').trim();
  const name = String(user.full_name || '').trim();

  let adminIds = [];
  try {
    const allUsers = await store.list('User', '-created_date', 200, SERVICE_ACTOR);
    adminIds = (allUsers || []).filter((u) => u.role === 'admin' && u.id).map((u) => u.id);
  } catch (err) {
    console.error('[account-deletion] list admins failed', err);
  }

  if (adminIds.length) {
    // SystemMessage audience enum is only customer|owner — target admins via owner + ids.
    await pushInAppNotification(store, {
      audience: 'owner',
      target_user_ids: adminIds,
      category: 'עדכון',
      title: 'בקשת מחיקת חשבון',
      body: `${name || email || user.id} ביקש/ה מחיקת חשבון${email ? ` (${email})` : ''}. יש לטפל תוך עד 7 ימים.`,
      action_type: 'none',
      action_entity_id: user.id,
    });
  }

  console.log(
    `[account-deletion] request from ${email || user.id}` +
      (process.env.SMTP_HOST ? ' (SMTP_HOST set — wire nodemailer when ready)' : ' (logged; SMTP not configured)'),
  );

  return { ok: true };
}
