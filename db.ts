// Injectable client so engines are testable offline (mockable).
import { createClient } from "jsr:@supabase/supabase-js@2";
export function makeDb() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}
