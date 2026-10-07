import { Boxes } from "lucide-react";
import styles from "./catalog.module.css";

export default function CatalogAdminLoading() {
  return <main className={styles.page}><section className={styles.loading} role="status"><Boxes size={19} aria-hidden="true" /><span>Cargando productos conectados…</span></section></main>;
}

