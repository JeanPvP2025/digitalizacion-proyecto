import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { QuoteInquiryInsert } from "./submit";

/**
 * Inserts through the public Data API using only the publishable key. This client
 * has no cookie/session adapter, so the request uses the anon database role.
 */
export async function persistSupabaseQuoteInquiry(inquiry: QuoteInquiryInsert): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) throw new Error("Supabase quote persistence is not configured.");

  const supabase = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  // Keep the default return=minimal response. Selecting the inserted row would
  // require SELECT privileges, which anonymous callers deliberately do not have.
  const { error } = await supabase.from("quote_inquiries").insert(inquiry);
  if (error) throw error;
}
