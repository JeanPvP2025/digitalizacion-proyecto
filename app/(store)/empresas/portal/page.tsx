import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Building2, CalendarClock, Check, CircleAlert, ContactRound, FileText, Plus, ShieldCheck, UserRound } from "lucide-react";
import { BusinessQuoteRequest, type BusinessProductOption } from "@/components/business/business-quote-request";
import { addOrganizationMember, createBusinessOrderFromAcceptedQuote, removeOrganizationMember, respondToBusinessQuote, setOrganizationMemberRole, createOrganization, resolveBusinessOrderAdvance } from "./actions";
import styles from "./business-portal.module.css";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Espacio de empresa · NODRIA",
  description: "Gestiona tu organización, miembros y propuestas de compra para empresas.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type OrganizationRole = "owner" | "admin" | "buyer" | "viewer";
type MembershipRow = { organization_id: string; role: OrganizationRole };
type OrganizationRow = { id: string; slug: string; legal_name: string; display_name: string; billing_email: string | null; tax_id: string | null };
type MemberRow = { user_id: string; email: string; display_name: string; role: OrganizationRole; joined_at: string };
type QuoteItemRow = {
  id: string; quote_id: string; product_name: string; product_sku: string; variant_title: string;
  quantity: number; requested_unit_price: string; offered_unit_price: string | null; currency: string; line_total: string;
};
type QuoteRow = {
  id: string; quote_number: string; status: "requested" | "in_review" | "sent" | "accepted" | "rejected" | "expired";
  currency: string; request_note: string; requester_name: string; grand_total: string; valid_until: string | null; created_at: string;
};
type QuoteConversionRow = { id: string; quote_id: string; conversion_number: string; created_at: string };
type BusinessQuoteOrderRow = {
  order_id: string; quote_id: string; payment_terms_code: string;
  payment_terms_snapshot: string; delivery_terms_snapshot: string; created_at: string;
};
type BusinessOrderRow = {
  id: string; order_number: string; status: "pending_payment" | "paid" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";
  grand_total: string; currency: string; created_at: string;
};
type ActivityRow = { id: number; title: string; subject_name: string; body: string; created_at: string; event_key: string };
type VariantRow = {
  id: string; sku: string; title: string; current_price: string; currency: string;
  products: { name: string; brand: string; slug: string };
};

const roleLabels: Record<OrganizationRole, string> = {
  owner: "Propietario",
  admin: "Administración",
  buyer: "Compras",
  viewer: "Consulta",
};

const quoteStatusLabels: Record<QuoteRow["status"], string> = {
  requested: "Recibida",
  in_review: "En revisión",
  sent: "Esperando decisión",
  accepted: "Aceptada",
  rejected: "Rechazada",
  expired: "Caducada",
};

const orderStatusLabels: Record<BusinessOrderRow["status"], string> = {
  pending_payment: "Pendiente de anticipo",
  paid: "Pagado",
  processing: "En preparación",
  shipped: "Expedido",
  delivered: "Entregado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function money(value: string | number, currency = "EUR") {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(Number(value));
}

function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }).format(date);
}

function noticeMessage(notice: string) {
  switch (notice) {
    case "organization-created": return "Empresa creada. Tu cuenta empieza como propietaria y puede gestionar el equipo.";
    case "unconfigured": return "El portal no tiene conexión de base de datos para guardar cambios.";
    case "member-added": return "La persona ya forma parte de la organización.";
    case "member-updated": return "El rol del miembro se ha actualizado.";
    case "member-removed": return "La persona se ha retirado de la organización.";
    case "quote-requested": return "Solicitud enviada. Ventas preparará una propuesta sobre estas líneas.";
    case "quote-accepted": return "Propuesta aceptada y guardada en el historial de la organización.";
    case "quote-converted": return "Conversión registrada con los snapshots de la propuesta y la empresa.";
    case "business-order-created": return "Pedido formal creado con el precio aceptado y la reserva de stock. El anticipo demo sigue pendiente; el transporte se cotizará por separado.";
    case "business-payment-approved": return "Anticipo demo aprobado y guardado en el historial del pedido y la organización.";
    case "business-payment-declined": return "Anticipo demo rechazado. El pedido se canceló y las unidades reservadas volvieron a estar disponibles.";
    case "business-payment-replayed": return "El anticipo ya estaba registrado; el reintento no duplicó el pago ni el historial.";
    case "payment-conflict": return "La clave de pago ya se usó para otra operación. No se cambió el pedido.";
    case "stock-unavailable": return "El stock disponible ya no cubre la propuesta aceptada. No se creó el pedido ni se reservó ninguna unidad.";
    case "order-conflict": return "Ya existe un pedido para esta propuesta con otra dirección. Revisa el pedido existente antes de reintentar.";
    case "quote-rejected": return "Decisión registrada en el historial de la organización.";
    case "expired": return "La propuesta ya no estaba vigente; su estado se ha actualizado a caducada.";
    case "forbidden": return "Tu rol no permite esta acción en la organización o la cotización.";
    case "invalid": return "No se guardó el cambio. Revisa los datos y el estado de la propuesta.";
    case "duplicate": return "La cuenta ya pertenece a esta organización o el identificador ya está en uso.";
    case "not-found": return "No se encontró la cuenta. Debe iniciar sesión una vez antes de añadirla al equipo.";
    case "error": return "No se pudo guardar el cambio. Inténtalo de nuevo.";
    default: return null;
  }
}

export default async function BusinessPortalPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const notice = noticeMessage(firstValue(params.notice));
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return <main className={styles.page}><section className={styles.stateCard} role="status"><span className={styles.stateIcon}><CircleAlert size={22} /></span><p className={styles.eyebrow}>NODRIA · EMPRESAS</p><h1>Espacio conectado pendiente</h1><p>El portal de organización y cotizaciones requiere una sesión de Supabase. La demo de archivos no guarda membresías ni propuestas estructuradas.</p><Link className={styles.backLink} href="/empresas">Volver a soluciones de empresa <ArrowRight size={14} /></Link></section></main>;
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) redirect("/acceso?next=%2Fempresas%2Fportal");

  const membershipResult = await supabase.from("organization_memberships").select("organization_id, role").eq("user_id", authData.user.id);
  if (membershipResult.error) {
    return <main className={styles.page}><section className={styles.stateCard} role="alert"><span className={styles.stateIcon}><CircleAlert size={22} /></span><p className={styles.eyebrow}>NODRIA · EMPRESAS</p><h1>No se pudieron consultar tus organizaciones</h1><p>La base de datos no confirmó tus membresías. Actualiza para reintentar; no se ha mostrado información de otra empresa.</p><Link className={styles.backLink} href="/empresas/portal">Reintentar <ArrowRight size={14} /></Link></section></main>;
  }

  const memberships = (membershipResult.data ?? []) as MembershipRow[];
  if (!memberships.length) {
    return (
      <main className={styles.page}>
        <header className={styles.header}><Link className={styles.brand} href="/empresas"><span className={styles.brandMark}>N</span><span>NODRIA<small>ESPACIO DE EMPRESA</small></span></Link><Link className={styles.backLink} href="/empresas">Soluciones para empresas <ArrowRight size={14} /></Link></header>
        {notice && <p className={styles.notice} role="alert"><CircleAlert size={15} />{notice}</p>}
        <section className={styles.onboarding}>
          <div className={styles.onboardingIntro}><span className={styles.onboardingIndex}>01 / 03</span><p className={styles.eyebrow}>ALTA DE ORGANIZACIÓN</p><h1>Empieza por reunir<br /><em>a tu equipo.</em></h1><p>Registra la entidad y confirma sus datos básicos. La sesión actual quedará como propietaria inicial; podrás añadir personas con roles acotados después.</p><div className={styles.onboardingSeal}><ShieldCheck size={17} /><span>El alta y el rol propietario se guardan juntos<small>Validación y control en PostgreSQL</small></span></div></div>
          <div className={styles.onboardingFormWrap}>
            <h2>Datos de la organización</h2>
            <form action={createOrganization} className={styles.fields}>
              <label><span>Nombre comercial</span><input autoComplete="organization" maxLength={120} minLength={2} name="displayName" required /></label>
              <label><span>Razón social</span><input maxLength={180} minLength={2} name="legalName" required /></label>
              <div className={styles.fieldPair}><label><span>NIF / CIF <small>opcional</small></span><input autoComplete="off" maxLength={32} name="taxId" /></label><label><span>Correo de facturación <small>opcional</small></span><input autoComplete="email" maxLength={254} name="billingEmail" type="email" /></label></div>
              <button className={styles.primaryButton} type="submit">Crear organización <ArrowRight size={15} /></button>
            </form>
            <p className={styles.formFootnote}>Los datos son ficticios en esta demo académica. No incluyas información real de pago.</p>
          </div>
        </section>
      </main>
    );
  }

  const organizationIds = memberships.map((membership) => membership.organization_id);
  const organizationsResult = await supabase.from("organizations").select("id, slug, legal_name, display_name, billing_email, tax_id").in("id", organizationIds).order("display_name");
  if (organizationsResult.error || !organizationsResult.data?.length) {
    return <main className={styles.page}><section className={styles.stateCard} role="alert"><span className={styles.stateIcon}><CircleAlert size={22} /></span><p className={styles.eyebrow}>NODRIA · EMPRESAS</p><h1>No se pudieron cargar los datos de empresa</h1><p>La consulta de organizaciones falló o las políticas no devolvieron filas asociadas a tu sesión.</p><Link className={styles.backLink} href="/empresas/portal">Reintentar <ArrowRight size={14} /></Link></section></main>;
  }

  const organizations = organizationsResult.data as OrganizationRow[];
  const requestedOrganization = firstValue(params.organization);
  const organization = organizations.find((row) => row.id === requestedOrganization) ?? organizations[0];
  const membership = memberships.find((row) => row.organization_id === organization.id)!;
  const canManage = membership.role === "owner" || membership.role === "admin";
  const memberResult = await supabase.rpc("list_organization_members", { p_organization_id: organization.id });
  const quoteResult = await supabase.from("quotes").select("id, quote_number, status, currency, request_note, requester_name, grand_total, valid_until, created_at").eq("organization_id", organization.id).order("created_at", { ascending: false });
  const variantResult = await supabase.from("product_variants").select("id, sku, title, current_price, currency, products!inner(name, brand, slug)").eq("is_active", true).eq("products.is_published", true).order("sku");
  const quoteRows = (quoteResult.data ?? []) as QuoteRow[];
  const quoteIds = quoteRows.map((quote) => quote.id);
  const [lineResult, activityResult, conversionResult] = await Promise.all([
    quoteIds.length ? supabase.from("quote_items").select("id, quote_id, product_name, product_sku, variant_title, quantity, requested_unit_price, offered_unit_price, currency, line_total").in("quote_id", quoteIds).order("created_at") : Promise.resolve({ data: [], error: null }),
    supabase.from("crm_activities").select("id, title, subject_name, body, created_at, event_key").eq("organization_id", organization.id).eq("visibility", "organization").order("created_at", { ascending: false }).limit(12),
    quoteIds.length ? supabase.from("business_quote_conversions").select("id, quote_id, conversion_number, created_at").in("quote_id", quoteIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const businessOrderResult = quoteIds.length
    ? await supabase.from("business_quote_orders").select("order_id, quote_id, payment_terms_code, payment_terms_snapshot, delivery_terms_snapshot, created_at").in("quote_id", quoteIds)
    : { data: [], error: null };
  const businessOrderRows = (businessOrderResult.data ?? []) as BusinessQuoteOrderRow[];
  const orderIds = businessOrderRows.map((row) => row.order_id);
  const orderResult = orderIds.length
    ? await supabase.from("orders").select("id, order_number, status, grand_total, currency, created_at").in("id", orderIds)
    : { data: [], error: null };
  if (memberResult.error || quoteResult.error || variantResult.error || lineResult.error || activityResult.error || conversionResult.error || businessOrderResult.error || orderResult.error) {
    return <main className={styles.page}><section className={styles.stateCard} role="alert"><span className={styles.stateIcon}><CircleAlert size={22} /></span><p className={styles.eyebrow}>NODRIA · EMPRESAS</p><h1>No se pudo cargar el espacio</h1><p>La base de datos no confirmó todos los miembros, cotizaciones o eventos. Actualiza para volver a intentarlo.</p><Link className={styles.backLink} href={`/empresas/portal?organization=${organization.id}`}>Reintentar <ArrowRight size={14} /></Link></section></main>;
  }

  const members = (memberResult.data ?? []) as MemberRow[];
  const quoteItems = (lineResult.data ?? []) as QuoteItemRow[];
  const quoteConversions = (conversionResult.data ?? []) as QuoteConversionRow[];
  const businessOrders = businessOrderRows;
  const orderRows = (orderResult.data ?? []) as BusinessOrderRow[];
  const activities = (activityResult.data ?? []) as ActivityRow[];
  const variantRows = (variantResult.data ?? []) as unknown as VariantRow[];
  const products: BusinessProductOption[] = variantRows.map((variant) => ({
    id: variant.id,
    productName: variant.products.name,
    brand: variant.products.brand,
    sku: variant.sku,
    variantTitle: variant.title,
    currentPrice: Number(variant.current_price),
    currency: variant.currency,
  }));

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/empresas"><span className={styles.brandMark}>N</span><span>NODRIA<small>ESPACIO DE EMPRESA</small></span></Link>
        <div className={styles.headerAccount}><span><i /> SESIÓN CONECTADA</span><strong>{authData.user.email ?? "Cuenta autenticada"}</strong></div>
      </header>

      <section className={styles.pageIntro}>
        <div><p className={styles.eyebrow}>NODRIA <span>·</span> COMPRAS EMPRESARIALES</p><h1>Tu equipo,<br /><em>en el mismo hilo.</em></h1><p>Organización, personas y propuestas con cada cambio guardado en el historial compartido.</p></div>
        <div className={styles.introCard}><Building2 size={19} /><span>ORGANIZACIÓN ACTIVA<small>{organization.display_name}</small></span><strong>{roleLabels[membership.role]}</strong></div>
      </section>

      {organizations.length > 1 && <nav aria-label="Organizaciones disponibles" className={styles.organizationTabs}>{organizations.map((row) => <Link aria-current={row.id === organization.id ? "page" : undefined} className={row.id === organization.id ? styles.organizationTabActive : styles.organizationTab} href={`/empresas/portal?organization=${row.id}`} key={row.id}>{row.display_name}<small>{roleLabels[memberships.find((item) => item.organization_id === row.id)?.role ?? "viewer"]}</small></Link>)}</nav>}
      {notice && <p className={styles.notice} role={["quote-requested", "member-added", "quote-accepted", "quote-converted", "business-order-created", "business-payment-approved", "business-payment-declined", "business-payment-replayed", "quote-rejected", "member-updated", "member-removed", "organization-created"].includes(firstValue(params.notice)) ? "status" : "alert"}><CircleAlert aria-hidden="true" size={15} />{notice}</p>}

      <div className={styles.workspace}>
        <div className={styles.primaryColumn}>
          <section className={styles.panel} aria-labelledby="request-heading">
            <div className={styles.panelHead}><div><p className={styles.panelEyebrow}>01 · SOLICITUD DE PROPUESTA</p><h2 id="request-heading">¿Qué necesita tu equipo?</h2></div><span className={styles.panelIcon}><FileText size={18} /></span></div>
            {membership.role === "viewer" ? <p className={styles.readOnlyNote}>Tu rol permite consultar propuestas e historial. Pide al responsable o a compras que cree una solicitud nueva.</p> : <BusinessQuoteRequest organizationId={organization.id} products={products} />}
          </section>

          <section className={styles.panel} aria-labelledby="quotes-heading">
            <div className={styles.panelHead}><div><p className={styles.panelEyebrow}>02 · PROPUESTAS</p><h2 id="quotes-heading">Cotizaciones <span>{quoteRows.length}</span></h2></div><span className={styles.panelIcon}><ContactRound size={18} /></span></div>
            {quoteRows.length ? <div className={styles.quoteList}>{quoteRows.map((quote) => {
              const lines = quoteItems.filter((item) => item.quote_id === quote.id);
              const conversion = quoteConversions.find((item) => item.quote_id === quote.id);
              const businessOrder = businessOrders.find((item) => item.quote_id === quote.id);
              const order = orderRows.find((item) => item.id === businessOrder?.order_id);
              const hasOffer = quote.status !== "requested" && quote.status !== "in_review";
              return <article className={styles.quoteCard} key={quote.id}>
                <div className={styles.quoteTop}><div><span className={styles.quoteNumber}>{quote.quote_number}</span><h3>{quote.status === "sent" ? "Propuesta para revisión" : "Solicitud de compra"}</h3></div><span className={`${styles.quoteStatus} ${styles[`quote_${quote.status}`]}`}>{quoteStatusLabels[quote.status]}</span></div>
                <p className={styles.quoteMeta}>{dateLabel(quote.created_at)} · {quote.requester_name}{quote.valid_until && quote.status === "sent" ? ` · Válida hasta ${new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "Europe/Madrid" }).format(new Date(quote.valid_until))}` : ""}</p>
                {quote.request_note && <p className={styles.quoteNote}>{quote.request_note}</p>}
                <ul className={styles.quoteLines}>{lines.map((line) => <li key={line.id}><span><strong>{line.quantity} × {line.product_name}</strong><small>{line.variant_title} · {line.product_sku}</small></span><span>{money(line.offered_unit_price ?? line.requested_unit_price, line.currency)}</span></li>)}</ul>
                <div className={styles.quoteTotal}><span>{hasOffer ? "TOTAL PROPUESTO · IVA INCLUIDO" : "REFERENCIA DE CATÁLOGO · IVA INCLUIDO"}</span><strong>{money(quote.grand_total, quote.currency)}</strong></div>
                {canManage && quote.status === "sent" && <div className={styles.decisionRow}><form action={respondToBusinessQuote}><input name="quoteId" type="hidden" value={quote.id} /><input name="organizationId" type="hidden" value={organization.id} /><input name="decision" type="hidden" value="accepted" /><button className={styles.acceptButton} type="submit"><Check size={14} /> Aceptar propuesta</button></form><form action={respondToBusinessQuote}><input name="quoteId" type="hidden" value={quote.id} /><input name="organizationId" type="hidden" value={organization.id} /><input name="decision" type="hidden" value="rejected" /><button className={styles.rejectButton} type="submit">Rechazar</button></form></div>}
                {quote.status === "accepted" && (businessOrder && order ? <div className={styles.businessOrderSummary}>
                  <p className={styles.quoteMeta}>Pedido formal <strong>{order.order_number}</strong> · {dateLabel(order.created_at)} · {orderStatusLabels[order.status]}</p>
                  {conversion && <p className={styles.quoteMeta}>Conversión auditada: {conversion.conversion_number} · {dateLabel(conversion.created_at)}</p>}
                  <p className={styles.orderTerms}>{businessOrder.payment_terms_snapshot} {businessOrder.delivery_terms_snapshot}</p>
                  {canManage && order.status === "pending_payment" && <div className={styles.businessOrderFormWrap}>
                    <p className={styles.orderTerms}>Simulación académica de anticipo: no se recogen datos de tarjeta ni se procesa dinero. Si la prueba se rechaza, el pedido se cancela y la reserva se libera.</p>
                    <form action={resolveBusinessOrderAdvance} className={styles.decisionRow}>
                      <input name="orderId" type="hidden" value={order.id} />
                      <input name="organizationId" type="hidden" value={organization.id} />
                      <input name="idempotencyKey" type="hidden" value={crypto.randomUUID()} />
                      <button className={styles.acceptButton} name="outcome" type="submit" value="approved"><Check size={14} /> Simular anticipo aprobado</button>
                      <button className={styles.rejectButton} name="outcome" type="submit" value="failed">Simular rechazo</button>
                    </form>
                  </div>}
                </div> : canManage ? <div className={styles.businessOrderFormWrap}>
                  {conversion && <p className={styles.quoteMeta}>Conversión auditada: <strong>{conversion.conversion_number}</strong> · {dateLabel(conversion.created_at)}.</p>}
                  <p className={styles.orderTerms}>Al emitir, el pedido conservará el precio aceptado y reservará el stock disponible. Pago anticipado antes de expedición; el transporte se cotizará por separado.</p>
                  <form action={createBusinessOrderFromAcceptedQuote} className={styles.fields}>
                    <input name="quoteId" type="hidden" value={quote.id} />
                    <input name="organizationId" type="hidden" value={organization.id} />
                    <fieldset className={styles.orderAddressGroup}>
                      <legend>Dirección de entrega · España</legend>
                      <label><span>Persona o empresa destinataria</span><input autoComplete="organization" maxLength={120} minLength={2} name="shippingName" required /></label>
                      <label><span>Dirección</span><input autoComplete="street-address" maxLength={200} minLength={5} name="shippingAddress" required /></label>
                      <div className={styles.fieldPair}><label><span>Código postal</span><input autoComplete="postal-code" inputMode="numeric" maxLength={5} minLength={5} name="shippingPostalCode" pattern="[0-9]{5}" required /></label><label><span>Localidad</span><input autoComplete="address-level2" maxLength={80} minLength={2} name="shippingCity" required /></label></div>
                    </fieldset>
                    <fieldset className={styles.orderAddressGroup}>
                      <legend>Dirección de facturación · España</legend>
                      <label><span>Razón social o destinatario</span><input autoComplete="organization" maxLength={120} minLength={2} name="billingName" required defaultValue={organization.legal_name} /></label>
                      <label><span>Dirección</span><input autoComplete="street-address" maxLength={200} minLength={5} name="billingAddress" required /></label>
                      <div className={styles.fieldPair}><label><span>Código postal</span><input autoComplete="postal-code" inputMode="numeric" maxLength={5} minLength={5} name="billingPostalCode" pattern="[0-9]{5}" required /></label><label><span>Localidad</span><input autoComplete="address-level2" maxLength={80} minLength={2} name="billingCity" required /></label></div>
                    </fieldset>
                    <label className={styles.orderAgreement}><input name="confirmTerms" type="checkbox" value="accepted" required /><span>Confirmo el pedido con pago anticipado y acepto que el transporte se cotice aparte.</span></label>
                    <button className={styles.acceptButton} type="submit"><Check size={14} /> Emitir pedido formal</button>
                  </form>
                </div> : <p className={styles.quoteMeta}>Propuesta aceptada. Un propietario o administrador puede emitir el pedido formal.</p>)}
              </article>;
            })}</div> : <div className={styles.emptyQuotes}><span><FileText size={19} /></span><strong>Todavía no hay cotizaciones</strong><p>Las solicitudes y propuestas aparecerán aquí con sus precios, estado e historial.</p></div>}
          </section>
        </div>

        <aside className={styles.sideColumn}>
          <section className={styles.panel} aria-labelledby="organization-heading">
            <div className={styles.panelHead}><div><p className={styles.panelEyebrow}>ORGANIZACIÓN</p><h2 id="organization-heading">Datos de empresa</h2></div><Building2 size={17} /></div>
            <dl className={styles.organizationData}><div><dt>Nombre comercial</dt><dd>{organization.display_name}</dd></div><div><dt>Razón social</dt><dd>{organization.legal_name}</dd></div><div><dt>NIF / CIF</dt><dd>{organization.tax_id || "Pendiente"}</dd></div><div><dt>Facturación</dt><dd>{organization.billing_email || "Correo no indicado"}</dd></div></dl>
            <p className={styles.orgSlug}>CUENTA · {organization.slug.toUpperCase()}</p>
          </section>

          <section className={styles.panel} aria-labelledby="members-heading">
            <div className={styles.panelHead}><div><p className={styles.panelEyebrow}>EQUIPO · {members.length}</p><h2 id="members-heading">Personas y roles</h2></div><UserRound size={17} /></div>
            <ul className={styles.memberList}>{members.map((member) => <li key={member.user_id}><span className={styles.memberMark}>{member.display_name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("es-ES")).join("") || <UserRound size={13} />}</span><span className={styles.memberInfo}><strong>{member.display_name || "Cuenta de empresa"}</strong><small>{member.email}</small></span><span className={styles.memberRole}>{roleLabels[member.role]}</span>{canManage && member.role !== "owner" && member.user_id !== authData.user.id && <div className={styles.memberActions}>{(membership.role === "owner" || ["buyer", "viewer"].includes(member.role)) && <form action={setOrganizationMemberRole}><input name="organizationId" type="hidden" value={organization.id} /><input name="userId" type="hidden" value={member.user_id} /><label className={styles.srOnly} htmlFor={`role-${member.user_id}`}>Cambiar rol de {member.display_name || member.email}</label><select aria-label={`Cambiar rol de ${member.display_name || member.email}`} defaultValue={member.role} id={`role-${member.user_id}`} name="role"><option value="admin" disabled={membership.role !== "owner"}>Administración</option><option value="buyer">Compras</option><option value="viewer">Consulta</option></select><button aria-label="Guardar rol" type="submit"><Check size={13} /></button></form>}<form action={removeOrganizationMember}><input name="organizationId" type="hidden" value={organization.id} /><input name="userId" type="hidden" value={member.user_id} /><button aria-label={`Retirar a ${member.display_name || member.email}`} className={styles.removeMember} type="submit">Retirar</button></form></div>}</li>)}</ul>
            {canManage ? <form action={addOrganizationMember} className={styles.addMemberForm}><input name="organizationId" type="hidden" value={organization.id} /><label><span>Correo de cuenta ya registrada</span><input autoComplete="email" maxLength={254} name="email" placeholder="persona@empresa.es" required type="email" /></label><div><label><span>Rol inicial</span><select defaultValue="buyer" name="role"><option value="buyer">Compras</option><option value="viewer">Consulta</option>{membership.role === "owner" && <option value="admin">Administración</option>}</select></label><button className={styles.addMemberButton} type="submit"><Plus size={14} /> Añadir</button></div><small>Solo se pueden añadir cuentas que ya hayan iniciado sesión en NODRIA. Compras puede solicitar; consulta solo lee.</small></form> : <p className={styles.readOnlyNote}>Solo la persona propietaria o administración puede gestionar miembros.</p>}
          </section>

          <section className={styles.panel} aria-labelledby="activity-heading">
            <div className={styles.panelHead}><div><p className={styles.panelEyebrow}>TRAZABILIDAD</p><h2 id="activity-heading">Historial compartido</h2></div><CalendarClock size={17} /></div>
            {activities.length ? <ol className={styles.activityList}>{activities.map((activity) => <li key={activity.id}><span className={styles.activityIcon}><Check size={13} /></span><span><strong>{activity.title}</strong><small>{activity.subject_name}{activity.body ? ` · ${activity.body}` : ""}</small></span><time dateTime={activity.created_at}>{dateLabel(activity.created_at)}</time></li>)}</ol> : <p className={styles.readOnlyNote}>Los cambios de membresía y de las cotizaciones aparecerán aquí.</p>}
          </section>
        </aside>
      </div>
      <footer className={styles.footer}><span>© NODRIA · ESPACIO DE EMPRESA</span><Link href="/empresas">Soluciones para tu organización <ArrowRight size={13} /></Link></footer>
    </main>
  );
}
