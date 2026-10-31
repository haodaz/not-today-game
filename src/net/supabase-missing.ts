// Stands in for @supabase/supabase-js while it is not installed (vite.config.ts aliases it only
// then). The game catches this and plays offline. Run `npm install` to get the real package.
export function createClient(): never {
  throw new Error("@supabase/supabase-js is not installed: run npm install");
}
