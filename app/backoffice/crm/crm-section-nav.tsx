import Link from "next/link";
import styles from "./crm-section-nav.module.css";

type CrmSection = "overview" | "customers" | "orders";

export function CrmSectionNav({ active }: { active: CrmSection }) {
  const links: Array<{ id: CrmSection; href: string; label: string }> = [
    { id: "overview", href: "/backoffice/crm", label: "Resumen y propuestas" },
    { id: "customers", href: "/backoffice/crm/clientes", label: "Clientes" },
    { id: "orders", href: "/backoffice/crm/pedidos", label: "Pedidos" },
  ];

  return (
    <nav className={styles.nav} aria-label="Secciones de CRM">
      {links.map((link) => <Link aria-current={link.id === active ? "page" : undefined} className={link.id === active ? styles.active : ""} href={link.href} key={link.id}>{link.label}</Link>)}
    </nav>
  );
}
