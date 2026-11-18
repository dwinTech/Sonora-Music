import type { User } from '@supabase/supabase-js';

export const ADMIN_EMAIL = 'angoringedwin12@gmail.com';

export function hasAdminAccess(user: Pick<User, 'email' | 'app_metadata'> | null | undefined) {
  return user?.app_metadata?.role === 'admin' && user.email?.trim().toLowerCase() === ADMIN_EMAIL;
}
