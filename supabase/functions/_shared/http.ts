// Shared helpers for Edge Functions (Deno).
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') ?? '*';

export const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

export function error(message: string, status = 400): Response {
  return json({ error: message }, status);
}

/** Service-role client. The key is a function secret and never reaches the app. */
export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Resolve the calling user from the Authorization header, or return an error response. */
export async function requireUser(req: Request, admin: SupabaseClient): Promise<{ id: string } | Response> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return error('Sign in required.', 401);
  const { data, error: authError } = await admin.auth.getUser(token);
  if (authError || !data.user) return error('Sign in required.', 401);
  return { id: data.user.id };
}

export function handleOptions(req: Request): Response | null {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return error('Method not allowed.', 405);
  return null;
}

/** Today's date (UTC) as YYYY-MM-DD. */
export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}
