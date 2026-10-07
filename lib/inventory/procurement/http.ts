import "server-only";

import { NextResponse } from "next/server";
import type { SupabaseServerClient } from "@/lib/supabase/auth";
import { getProcurementAccess } from "./access";

export const privateHeaders = { "Cache-Control": "no-store" };

export function errorResponse(message: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...extra }, { status, headers: privateHeaders });
}

export function isSameOriginMutation(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function authorizeProcurementApi(): Promise<
  | { status: "ready"; supabase: SupabaseServerClient }
  | { status: "denied"; response: ReturnType<typeof errorResponse> }
> {
  const access = await getProcurementAccess();
  if (access.status === "ready") return { status: "ready", supabase: access.supabase };
  if (access.status === "unauthenticated") {
    return { status: "denied", response: errorResponse("Inicia sesión con una cuenta de almacén.", 401) };
  }
  if (access.status === "forbidden") {
    return { status: "denied", response: errorResponse("Esta acción requiere el rol fulfillment_manager o super_admin.", 403) };
  }
  if (access.status === "not_configured") {
    return { status: "denied", response: errorResponse("Procurement requiere una sesión Supabase conectada.", 503) };
  }
  return { status: "denied", response: errorResponse("No se han podido comprobar los permisos de almacén.", 503) };
}

export function mapRpcError(code: string | undefined): { message: string; status: number } {
  if (code === "42501") return { message: "La base de datos ha rechazado esta acción por permisos.", status: 403 };
  if (code === "P0002") return { message: "No encontramos el proveedor, almacén, producto o pedido solicitado.", status: 404 };
  if (code === "23505") return { message: "Ese dato ya está registrado. Revisa los nombres y variantes repetidas.", status: 409 };
  if (code === "23514") return { message: "El estado actual del pedido no permite esta acción.", status: 409 };
  if (code === "23503") return { message: "La variante ya no está disponible en ese almacén.", status: 409 };
  if (code === "22023" || code === "22P02") return { message: "Revisa los datos introducidos y vuelve a intentarlo.", status: 400 };
  return { message: "No se ha podido guardar el cambio. Comprueba la conexión y vuelve a intentarlo.", status: 503 };
}

export async function callProcurementRpc(
  supabase: SupabaseServerClient,
  functionName: string,
  args: Record<string, unknown>,
): Promise<{ data: unknown; error: { code?: string } | null }> {
  try {
    const result = await supabase.rpc(functionName, args);
    return { data: result.data, error: result.error };
  } catch {
    return { data: null, error: { code: "NETWORK_ERROR" } };
  }
}
