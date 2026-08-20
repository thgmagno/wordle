import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();

  if (!session) {
    return Response.json(null, { status: 401 });
  }

  return Response.json(session);
}
