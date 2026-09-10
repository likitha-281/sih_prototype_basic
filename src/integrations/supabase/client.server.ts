/* eslint-disable @typescript-eslint/no-explicit-any */
// Server-side Supabase client with local SQLite backend
import { createLocalSupabaseClient } from "@/lib/db.server";

export function createSupabaseAdminClient() {
  return createLocalSupabaseClient("10000000-0000-4000-8000-000000000001");
}

let _supabaseAdmin: any | undefined;

export const supabaseAdmin = new Proxy({} as any, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
