import Link from "next/link";
import styles from "./crm-workspace.module.css";

export function CrmRouteState({ state, title = "CRM" }: {
  state: "unconfigured" | "unauthenticated" | "forbidden" | "error";
  title?: string;
}) {
  const copy = {
    unconfigured: ["Conexión pendiente", "Esta vista necesita Supabase. No se sustituye la información por registros locales."],
    unauthenticated: ["Inicia sesión", "Necesitas una sesión de personal para consultar esta información."],
    forbidden: ["Acceso restringido", "Esta vista requiere el rol de ventas o superadministración."],
    error: ["No se pudo cargar", "No se ha cambiado ningún pedido. Vuelve a cargar cuando el servicio esté disponible."],
  } as const;
  const [heading, message] = copy[state];
  return <main className={styles.statePage}><section className={styles.stateCard} role={state === "error" ? "alert" : "status"}><p className={styles.eyebrow}>NODRIA · {title.toLocaleUpperCase("es-ES")}</p><h1>{heading}</h1><p>{message}</p><Link href="/backoffice/crm">Volver al CRM</Link></section></main>;
}
