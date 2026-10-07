import type { Metadata } from "next";
import { connection } from "next/server";
import { getDemoOrderRecords } from "@/lib/server/demo-orders";
import { demoProducts } from "@/lib/catalog";
import { OperationsCenter } from "@/components/backoffice/operations-center";
import { getServerDataMode } from "@/lib/server/data-mode";
import { getServerAuthState, getStaffRoleGrants } from "@/lib/supabase/auth";
import { hasStaffSurfaceRole } from "@/lib/supabase/policies";

export const metadata: Metadata = {
  title: "Centro de operaciones",
  description: "Vista interna de pedidos persistidos e inventario de catálogo demo de NODRIA.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type BackofficeStatus = "all" | "confirmed" | "pending" | "payment_processing";

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function BackofficePage({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const auth = await getServerAuthState();
  if (auth.kind !== "signed-in") {
    return <main className="page-wrap"><h1>Centro de operaciones no disponible</h1><p>Se requiere una sesión autenticada de personal.</p></main>;
  }
  const { roles, error } = await getStaffRoleGrants(auth.supabase, auth.user.id);
  if (error || !hasStaffSurfaceRole(roles, "operations")) {
    return <main className="page-wrap"><h1>Acceso restringido</h1><p>El centro de operaciones requiere fulfillment_manager o super_admin.</p></main>;
  }

  if (getServerDataMode() !== "local-demo") {
    return <main className="page-wrap"><h1>Centro de operaciones no disponible</h1><p>Esta vista aún no consulta pedidos de Supabase. Los pedidos demo solo se muestran en desarrollo local con DEMO_MODE=true.</p></main>;
  }

  const [params, orders] = await Promise.all([searchParams, getDemoOrderRecords()]);
  const query = firstValue(params.q).trim().slice(0, 120);
  const requestedStatus = firstValue(params.status);
  const validStatuses = ["confirmed", "pending", "payment_processing"] as const;
  const status: BackofficeStatus = validStatuses.includes(requestedStatus as (typeof validStatuses)[number])
    ? requestedStatus as BackofficeStatus
    : "all";
  const normalizedQuery = query.toLocaleLowerCase("es-ES");

  const sortedOrders = [...orders].sort((left, right) => {
    const rightTime = Date.parse(right.createdAt);
    const leftTime = Date.parse(left.createdAt);
    return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
  });

  const visibleOrders = sortedOrders.filter((order) => {
    if (status !== "all" && order.status !== status) return false;
    if (!normalizedQuery) return true;

    const searchableValues = [
      order.orderNumber,
      order.id,
      order.customer.name,
      order.customer.email,
      order.customer.city,
      order.customer.postalCode,
      ...order.items.flatMap((item) => [item.name, item.sku]),
    ];

    return searchableValues.some((value) => value.toLocaleLowerCase("es-ES").includes(normalizedQuery));
  });

  return (
    <OperationsCenter
      allOrders={sortedOrders}
      visibleOrders={visibleOrders}
      products={demoProducts}
      query={query}
      status={status}
    />
  );
}
