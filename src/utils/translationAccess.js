/**
 * Who may open the Translation Studio and write to hr_ugc_translations.
 *
 * Admins only, for now. A translation is published text that other users read
 * *in place of* the original, and a wrong one is invisible to everyone who
 * cannot read both languages — so it is an editorial privilege, not an
 * ownership one.
 *
 * This is the client-side half of the rule. The authoritative half is the
 * hr_can_translate() function behind the RLS policies in migration
 * 018_hr_ugc_translations.sql; hiding the nav item only removes the temptation,
 * it is the database that actually refuses the write. Both must be widened
 * together.
 */

/** Roles allowed to author translations. Mirrors hr_can_translate() in SQL. */
const TRANSLATION_EDITOR_ROLES = new Set(['admin']);

export const isTranslationEditor = (user) => {
  const role = user?.role;
  if (!role) return false;
  // The codebase stores 'admin' but tolerates 'Admin' in places (see
  // userManagement.jsx), so normalize rather than miss a legitimate admin.
  return TRANSLATION_EDITOR_ROLES.has(String(role).toLowerCase());
};

export default isTranslationEditor;
