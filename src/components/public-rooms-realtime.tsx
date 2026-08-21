"use client";

import { usePublicRoomsRealtime } from "@/lib/use-realtime";

/**
 * Renders nothing — its only job is subscribing the dashboard to the
 * global "public-rooms" Pusher channel so the "Salas Públicas" card
 * refreshes live. A separate component rather than a hook call inside
 * DashboardPage itself because that page is a Server Component and hooks
 * only work in Client Components.
 */
export function PublicRoomsRealtime() {
  usePublicRoomsRealtime();
  return null;
}
