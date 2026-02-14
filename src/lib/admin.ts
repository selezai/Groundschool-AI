// Hardcoded admin UUID — server-side only, never exposed to client
// Also checks ADMIN_USER_ID env var as a fallback
const ADMIN_UUID = "c0023a5b-e4e9-4955-9ec7-2f9eed20db5a";

export function isAdminUser(userId: string | null | undefined): boolean {
  if (!userId) return false;
  const envAdminId = process.env.ADMIN_USER_ID;
  return userId === ADMIN_UUID || userId === envAdminId;
}
