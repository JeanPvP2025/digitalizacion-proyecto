import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  ChevronDown,
  CircleAlert,
  ContactRound,
  Handshake,
  Inbox,
  RotateCw,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { updateOpportunityStatus } from "@/app/backoffice/crm/actions";
import { getCrmWorkspace, type CrmOpportunity, type ProspectStatus } from "@/lib/crm/data";
import styles from "./crm.module.css";

export const metadata: Metadata = {
  title: "CRM · Operaciones NODRIA",
  description: "Bandeja de contactos y solicitudes de presupuesto de NODRIA.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type StatusFilter = "all" | ProspectStatus;

const statuses: ProspectStatus[] = ["new", "qualified", "contacted", "converted", "closed"];
const statusLabels: Record<ProspectStatus, string> = {
  new: "Nuevo",
  qualified: "Cualificado",
  contacted: "Contactado",
  converted: "Convertido",
  closed: "Cerrado",
};

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function dateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(date);
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("es-ES") ?? "").join("");
}

function noticeMessage(notice: string): string | null {
  switch (notice) {
    case "updated": return "Etapa actualizada.";
    case "invalid": return "No se guardó el cambio: revisa la etapa seleccionada.";
    case "forbidden": return "Tu cuenta no tiene acceso al área de ventas.";
    case "unconfigured": return "No hay conexión Supabase configurada para guardar cambios.";
    case "not-found": return "La solicitud ya no está disponible o no tienes acceso a ella.";
    case "error": return "No se pudo completar la operación. Inténtalo de nuevo.";
    default: return null;
  }
}

function matchesSearch(opportunity: CrmOpportunity, query: string): boolean {
  if (!query) return true;
  const needle = query.toLocaleLowerCase("es-ES");
  return [opportunity.name, opportunity.email, opportunity.phone ?? "", opportunity.company ?? "", opportunity.message]
    .some((value) => value.toLocaleLowerCase("es-ES").includes(needle));
}

export default async function CrmPage({ searchParams }: { searchParams: SearchParams }) {
  const [params, workspace] = await Promise.all([searchParams, getCrmWorkspace()]);

  if (workspace.state === "unauthenticated") redirect("/acceso?next=%2Fbackoffice%2Fcrm");

  const query = firstValue(params.q).trim().slice(0, 100);
  const requestedStatus = firstValue(params.status);
  const status: StatusFilter = statuses.includes(requestedStatus as ProspectStatus)
    ? requestedStatus as ProspectStatus
    : "all";
  const notice = noticeMessage(firstValue(params.notice));

  if (workspace.state !== "ready") {
    const isForbidden = workspace.state === "forbidden";
    const isUnconfigured = workspace.state === "unconfigured";
    return (
      <main className={styles.statePage}>
        <section className={styles.stateCard} role={isForbidden ? "alert" : "status"}>
          <span className={styles.stateIcon}>{isForbidden ? <ShieldCheck size={22} /> : <CircleAlert size={22} />}</span>
          <p className={styles.eyebrow}>NODRIA · CRM</p>
          <h1>{isForbidden ? "Acceso restringido" : isUnconfigured ? "Conexión pendiente" : "No se pudo cargar el CRM"}</h1>
          <p>{isForbidden
            ? "El área de ventas requiere el rol sales_manager o super_admin. La autorización también se comprueba en la base de datos mediante RLS."
            : isUnconfigured
              ? "Este espacio lee datos de Supabase y no muestra registros de demostración cuando la conexión no está configurada."
              : "No se pudo verificar el acceso o leer los registros. Actualiza la página para volver a intentarlo."}</p>
          <div className={styles.stateActions}>
            {isUnconfigured ? <Link href="/backoffice">Volver a operaciones <ArrowRight size={15} /></Link> : <Link href="/backoffice/crm"><RotateCw size={15} /> Reintentar</Link>}
            {!isForbidden && <Link className={styles.subtleLink} href="/">Ir a la tienda</Link>}
          </div>
        </section>
      </main>
    );
  }

  const { opportunities, contacts, organizations, activities } = workspace;
  const filteredOpportunities = opportunities.filter((opportunity) => {
    return (status === "all" || opportunity.status === status) && matchesSearch(opportunity, query);
  });
  const activeOpportunities = opportunities.filter((opportunity) => ["new", "qualified", "contacted"].includes(opportunity.status)).length;
  const convertedOpportunities = opportunities.filter((opportunity) => opportunity.status === "converted").length;
  const noticeIsError = !["updated"].includes(firstValue(params.notice));

  return (
    <main className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/" aria-label="NODRIA, volver a la tienda">
          <span className={styles.brandMark}>N</span>
          <span>NODRIA<small>RELACIÓN COMERCIAL</small></span>
        </Link>
        <div className={styles.sideRule} />
        <nav className={styles.nav} aria-label="Navegación de operaciones">
          <p className={styles.navCaption}>ESPACIO DE TRABAJO</p>
          <Link className={styles.navItem} href="/backoffice"><Building2 size={17} /><span>Operaciones</span></Link>
          <Link className={`${styles.navItem} ${styles.navItemActive}`} href="/backoffice/crm" aria-current="page"><ContactRound size={17} /><span>CRM y contactos</span><span className={styles.navIndex}>01</span></Link>
        </nav>
        <div className={styles.sidebarBottom}>
          <span className={styles.sessionMark}><i /> SESIÓN DE VENTAS</span>
          <p>{workspace.userEmail || "Usuario autenticado"}</p>
          <Link href="/backoffice" className={styles.backLink}>Centro de operaciones <ArrowRight size={13} /></Link>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumb}><span>OPERACIONES</span><span>/</span><strong>CRM</strong></div>
          <span className={styles.connected}><i /> DATOS SUPABASE</span>
        </header>

        <div className={styles.content}>
          <section className={styles.intro}>
            <div>
              <p className={styles.eyebrow}>NODRIA <span>·</span> RELACIÓN COMERCIAL</p>
              <h1>Personas y <em>oportunidades.</em></h1>
              <p className={styles.introText}>Solicitudes y contactos recibidos, con las etapas disponibles en el flujo comercial actual.</p>
            </div>
            <div className={styles.introStamp}><Handshake size={19} /><span>Conectado a registros reales<small>Actualizado al cargar esta página</small></span></div>
          </section>

          {notice && <p className={`${styles.notice} ${noticeIsError ? styles.noticeError : ""}`} role={noticeIsError ? "alert" : "status"}>{notice}</p>}

          <section className={styles.metrics} aria-label="Resumen del CRM">
            <article className={styles.metricPrimary}><span>SOLICITUDES DE PRESUPUESTO</span><strong>{opportunities.length.toLocaleString("es-ES")}</strong><small>Etapas de oportunidad registradas</small></article>
            <article className={styles.metric}><span>EN SEGUIMIENTO</span><strong>{activeOpportunities.toLocaleString("es-ES")}</strong><small>Nuevas, cualificadas o contactadas</small></article>
            <article className={styles.metric}><span>CONVERTIDAS</span><strong>{convertedOpportunities.toLocaleString("es-ES")}</strong><small>Según el estado persistido</small></article>
            <article className={styles.metric}><span>CONTACTOS ÚNICOS</span><strong>{contacts.length.toLocaleString("es-ES")}</strong><small>{organizations.length.toLocaleString("es-ES")} organizaciones visibles</small></article>
          </section>

          <div className={styles.workspaceGrid}>
            <section className={styles.panel} aria-labelledby="pipeline-title">
              <div className={styles.panelHeading}>
                <div><p className={styles.panelEyebrow}>PIPELINE</p><h2 id="pipeline-title">Solicitudes de presupuesto <span>{filteredOpportunities.length}</span></h2></div>
                <span className={styles.panelMeta}>ESTADOS DE prospect_status</span>
              </div>
              <form className={styles.filters} action="/backoffice/crm" method="get" role="search">
                <label className={styles.searchBox}><Search size={15} aria-hidden="true" /><span className={styles.srOnly}>Buscar oportunidades</span><input type="search" name="q" maxLength={100} placeholder="Nombre, empresa, correo o mensaje" defaultValue={query} /></label>
                <label className={styles.selectBox}><span className={styles.srOnly}>Filtrar por etapa</span><select name="status" defaultValue={status}><option value="all">Todas las etapas</option>{statuses.map((stage) => <option value={stage} key={stage}>{statusLabels[stage]}</option>)}</select><ChevronDown size={14} aria-hidden="true" /></label>
                <button type="submit">Filtrar</button>
                {(query || status !== "all") && <Link href="/backoffice/crm">Limpiar</Link>}
              </form>

              {filteredOpportunities.length ? (
                <div className={styles.opportunityList}>
                  {filteredOpportunities.map((opportunity) => (
                    <article className={styles.opportunity} key={opportunity.id}>
                      <div className={styles.opportunityTop}>
                        <span className={styles.avatar}>{initials(opportunity.name)}</span>
                        <div className={styles.contactIdentity}><strong>{opportunity.name}</strong><a href={`mailto:${opportunity.email}`}>{opportunity.email}</a></div>
                        <span className={`${styles.stage} ${styles[`stage_${opportunity.status}`]}`}>{statusLabels[opportunity.status]}</span>
                      </div>
                      <div className={styles.opportunityMeta}><span>{opportunity.company || "Empresa no indicada"}</span><span>{opportunity.phone || "Sin teléfono"}</span><span>{dateLabel(opportunity.createdAt)}</span></div>
                      <p className={styles.message}>{opportunity.message}</p>
                      <div className={styles.opportunityBottom}>
                        <span className={styles.source}>ORIGEN · {opportunity.source}</span>
                        <form action={updateOpportunityStatus} className={styles.stageForm}>
                          <input type="hidden" name="id" value={opportunity.id} />
                          <label className={styles.srOnly} htmlFor={`stage-${opportunity.id}`}>Cambiar etapa de {opportunity.name}</label>
                          <select id={`stage-${opportunity.id}`} name="status" defaultValue={opportunity.status}>
                            {statuses.map((stage) => <option value={stage} key={stage}>{statusLabels[stage]}</option>)}
                          </select>
                          <button type="submit">Guardar etapa</button>
                        </form>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className={styles.empty}><span><Inbox size={20} /></span><strong>{opportunities.length ? "No hay solicitudes con estos filtros" : "Aún no hay solicitudes"}</strong><p>{opportunities.length ? "Prueba otra búsqueda o selecciona todas las etapas." : "Las solicitudes recibidas aparecerán aquí cuando exista un registro en Supabase."}</p>{(query || status !== "all") && <Link href="/backoffice/crm">Ver todas las solicitudes <ArrowRight size={14} /></Link>}</div>
              )}
              <div className={styles.panelFooter}><span>LECTURA Y CAMBIO DE ETAPA CON RLS</span><span>{filteredOpportunities.length} de {opportunities.length} solicitudes</span></div>
            </section>

            <aside className={styles.sidePanels}>
              <section className={styles.panel} aria-labelledby="contacts-title">
                <div className={styles.panelHeading}><div><p className={styles.panelEyebrow}>DIRECTORIO</p><h2 id="contacts-title">Contactos <span>{contacts.length}</span></h2></div><UserRound size={17} /></div>
                {contacts.length ? <ul className={styles.directoryList}>{contacts.slice(0, 6).map((contact) => <li key={contact.key}><span className={styles.smallAvatar}>{initials(contact.name)}</span><span className={styles.directoryIdentity}><strong>{contact.name}</strong><a href={`mailto:${contact.email}`}>{contact.email}</a><small>{contact.company || "Sin empresa indicada"}</small></span><span className={styles.sourceCount} title={`Procedencias: ${contact.sources.join(", ")}`}>{contact.sources.length}</span></li>)}</ul> : <p className={styles.compactEmpty}>Los contactos aparecerán al recibir formularios.</p>}
                {contacts.length > 6 && <p className={styles.listFoot}>Mostrando los 6 contactos más recientes de {contacts.length} únicos.</p>}
              </section>

              <section className={styles.panel} aria-labelledby="organizations-title">
                <div className={styles.panelHeading}><div><p className={styles.panelEyebrow}>B2B</p><h2 id="organizations-title">Organizaciones <span>{organizations.length}</span></h2></div><Building2 size={17} /></div>
                {organizations.length ? <ul className={styles.organizationList}>{organizations.slice(0, 5).map((organization) => <li key={organization.id}><span className={`${styles.orgDot} ${organization.active ? "" : styles.orgInactive}`} /><span><strong>{organization.name}</strong><small>{organization.legalName}{organization.email ? ` · ${organization.email}` : ""}</small></span></li>)}</ul> : <p className={styles.compactEmpty}>No hay organizaciones visibles para esta sesión.</p>}
                {organizations.length > 5 && <p className={styles.listFoot}>Mostrando 5 de {organizations.length} organizaciones.</p>}
              </section>
            </aside>
          </div>

          <section className={`${styles.panel} ${styles.activityPanel}`} aria-labelledby="activity-title">
            <div className={styles.panelHeading}><div><p className={styles.panelEyebrow}>ENTRADAS RECIENTES</p><h2 id="activity-title">Actividad comercial</h2></div><CalendarClock size={17} /></div>
            {activities.length ? <ol className={styles.activityList}>{activities.map((activity) => <li key={activity.id}><span className={styles.activityIcon}>{activity.kind === "lead" ? <UserRound size={15} /> : <Handshake size={15} />}</span><span className={styles.activityCopy}><strong>{activity.title}</strong><small>{activity.name}{activity.company ? ` · ${activity.company}` : ""}</small></span><time dateTime={activity.createdAt}>{dateLabel(activity.createdAt)}</time></li>)}</ol> : <p className={styles.compactEmpty}>Todavía no hay actividad comercial registrada.</p>}
            <p className={styles.activityNote}>Actividad derivada de las fechas de recepción de leads y solicitudes; el esquema actual no guarda un historial de acciones del CRM.</p>
          </section>

          <footer className={styles.footer}><span>© NODRIA · CRM</span><span>Solicitudes, contactos y organizaciones leídos según las políticas disponibles.</span></footer>
        </div>
      </div>
    </main>
  );
}
