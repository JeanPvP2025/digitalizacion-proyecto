import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowRight, Box, Heart, LifeBuoy, LogOut, Settings2, UserRound } from "lucide-react";
import { getDemoOrderRecords } from "@/lib/server/demo-orders";
import {
  getOrganizationMembershipsForUser,
  getProfileForUser,
  getServerAuthState,
} from "@/lib/supabase/auth";

export const metadata: Metadata = { title: "Mi espacio", robots: { index: false, follow: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type OrderView = { id: string; number: string; status: string; createdAt: string; total: number };

const money = (value: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value);
const date = (value: string) => new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(value));
const roleNames: Record<string, string> = { owner: "Propietario/a", admin: "Administrador/a", buyer: "Comprador/a", viewer: "Consulta" };

export default function AccountPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<main className="page-wrap"><p role="status">Cargando tu espacio…</p></main>}><AccountContent searchParams={searchParams} /></Suspense>;
}

async function AccountContent({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const view = params.vista === "pedidos" ? "pedidos" : "overview";
  const auth = await getServerAuthState();

  if (auth.kind === "signed-out") {
    const destination = view === "pedidos" ? "/mi-cuenta?vista=pedidos" : "/mi-cuenta";
    redirect(`/acceso?next=${encodeURIComponent(destination)}`);
  }

  let name = "Alex García";
  let email = "alex.garcia@demo.nodria.test";
  let orders: OrderView[] = [];
  let isDemo = auth.kind === "demo";
  let profileNotice: string | null = null;
  let ordersError: string | null = null;
  let memberships: { organizationId: string; organizationName: string; role: string }[] = [];
  let membershipsError: string | null = null;

  if (auth.kind === "signed-in") {
    const [profileResult, orderResult, membershipResult] = await Promise.all([
      getProfileForUser(auth.supabase, auth.user.id),
      auth.supabase.from("orders")
        .select("id, order_number, status, placed_at, grand_total")
        .eq("customer_id", auth.user.id)
        .order("placed_at", { ascending: false })
        .limit(20),
      getOrganizationMembershipsForUser(auth.supabase, auth.user.id),
    ]);

    if (profileResult.error) {
      profileNotice = "No se pudo leer tu perfil con la policy activa de Supabase. La cuenta no usará datos demo como sustituto.";
      email = auth.user.email ?? "";
      name = email || "Cliente NODRIA";
    } else if (!profileResult.data) {
      profileNotice = "La sesión es válida, pero falta la fila de profiles que crea el trigger de Auth. Revisa que la migración esté aplicada; la aplicación no inserta perfiles desde el cliente.";
      email = auth.user.email ?? "";
      name = email || "Cliente NODRIA";
    } else {
      name = profileResult.data.display_name.trim() || profileResult.data.email;
      email = profileResult.data.email;
    }

    if (orderResult.error) {
      ordersError = "No se pudieron cargar los pedidos de tu cuenta. La sesión sigue activa; inténtalo de nuevo más tarde.";
    } else {
      orders = (orderResult.data ?? []).map((order) => ({
        id: String(order.id),
        number: String(order.order_number),
        status: String(order.status),
        createdAt: String(order.placed_at),
        total: Number(order.grand_total),
      }));
    }

    if (membershipResult.error) membershipsError = "No se pudieron validar tus membresías de empresa con las policies activas.";
    else memberships = membershipResult.data ?? [];

    isDemo = false;
  } else {
    const allOrders = await getDemoOrderRecords();
    orders = allOrders
      .filter((order) => order.customer.email.toLowerCase() === email.toLowerCase())
      .map((order) => ({ id: order.id, number: order.orderNumber, status: order.status, createdAt: order.createdAt, total: order.total }));
  }

  const delivered = orders.filter((order) => order.status === "delivered").length;
  const active = orders.filter((order) => !["delivered", "cancelled", "refunded"].includes(order.status)).length;

  return (
    <main className="page-wrap account-page">
      <p className="eyebrow">TU TECNOLOGÍA, SIEMPRE A MANO</p>
      <h1 className="page-title">Hola, {name.split(" ")[0]}<span className="title-period">.</span></h1>
      <p className="page-intro">Aquí tienes tus pedidos, configuraciones y conversaciones con el equipo NODRIA.</p>

      {isDemo && <div className="account-demo-notice"><span>CUENTA DEMO LOCAL</span><p>Sin inicio de sesión real. Los pedidos de la demo se asocian al correo <strong>{email}</strong>; la actividad se conserva solo en este servidor local.</p><Link href="/acceso">Configurar acceso Supabase <ArrowRight size={13} /></Link></div>}
      {profileNotice && <p className="account-auth-notice" role="alert">{profileNotice}</p>}
      {ordersError && <p className="account-auth-notice" role="alert">{ordersError}</p>}

      <div className="account-layout">
        <nav className="account-nav" aria-label="Secciones de mi espacio">
          <Link className={view === "overview" ? "active" : ""} href="/mi-cuenta"><UserRound size={14} /> Resumen</Link>
          <Link className={view === "pedidos" ? "active" : ""} href="/mi-cuenta?vista=pedidos"><Box size={14} /> Pedidos</Link>
          <Link href="/favoritos"><Heart size={14} /> Favoritos</Link>
          <Link href="/configurador"><Settings2 size={14} /> PC Builder</Link>
          <Link href="/soporte"><LifeBuoy size={14} /> Soporte</Link>
          {!isDemo && <form action="/auth/signout" method="post"><button type="submit"><LogOut size={14} /> Cerrar sesión</button></form>}
        </nav>
        <div className="account-main">
          {ordersError ? <section className="account-panel"><p className="eyebrow">PEDIDOS</p><h2>Historial no disponible.</h2><p>{ordersError}</p></section> : <>
            <div className="account-overview"><article className="account-stat"><span>PEDIDOS</span><strong>{orders.length}</strong></article><article className="account-stat"><span>EN CURSO</span><strong>{active}</strong></article><article className="account-stat"><span>ENTREGADOS</span><strong>{delivered}</strong></article></div>
            <section className="account-panel">
              <div className="account-panel-heading"><div><p className="eyebrow">HISTORIAL</p><h2>{view === "pedidos" ? "Todos tus pedidos." : "Tus últimos pedidos."}</h2></div><span className="mono-label">{orders.length} REGISTROS</span></div>
              {orders.length ? orders.slice(0, view === "pedidos" ? 20 : 5).map((order) => <article className="account-order" key={order.id}><div><span>REFERENCIA</span><strong>{order.number}</strong></div><div><span>FECHA</span><strong>{date(order.createdAt)}</strong></div><div><span>TOTAL</span><strong>{money(order.total)}</strong></div><div><span>ESTADO</span><small className={`order-state state-${order.status}`}>{order.status.replaceAll("_", " ")}</small></div></article>) : <div className="account-empty"><span className="mono-label">AÚN SIN ACTIVIDAD</span><h3>Tu próximo pedido empieza por una buena elección.</h3><p>Cuando confirmes un pedido, aparecerá aquí con su referencia y estado. Los pagos de este entorno son ficticios.</p><Link className="section-link" href="/catalogo">Explorar catálogo <ArrowRight size={13} /></Link></div>}
            </section>
          </>}

          {!isDemo && <section className="account-panel account-memberships">
            <div className="account-panel-heading"><div><p className="eyebrow">NODRIA EMPRESAS</p><h2>Tus organizaciones.</h2></div></div>
            {membershipsError ? <p className="account-auth-notice" role="alert">{membershipsError}</p> : memberships.length ? memberships.map((membership) => <article className="account-membership" key={membership.organizationId}><strong>{membership.organizationName}</strong><span>{roleNames[membership.role] ?? membership.role}</span></article>) : <p>No hay membresías de empresa asociadas a esta cuenta. El acceso a los datos de cada organización depende de su membresía registrada.</p>}
          </section>}

          <div className="account-help-line"><span>¿Necesitas ayuda con una compra?</span><Link href="/soporte">Habla con el equipo <ArrowRight size={13} /></Link></div>
        </div>
      </div>
    </main>
  );
}
