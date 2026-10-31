// The client's view of @supabase/supabase-js (backend FR4). The game reaches the package only
// through a dynamic import in src/net/supabase.ts, and only when VITE_SUPABASE_URL and
// VITE_SUPABASE_ANON_KEY are set; this declares just what that file calls, so the game type-checks
// and runs offline whether or not the package is installed. Run `npm install` before a build
// that should talk to the backend.
declare module "@supabase/supabase-js" {
  export function createClient(url: string, anonKey: string, options?: Record<string, unknown>): unknown;
}
