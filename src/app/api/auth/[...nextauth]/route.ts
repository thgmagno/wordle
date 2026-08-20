import { handlers } from "@/lib/auth";

// Mark route as dynamic to prevent static analysis
export const dynamic = "force-dynamic";

export const { GET, POST } = handlers;
