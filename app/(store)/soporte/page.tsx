import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Clock3, LifeBuoy, Wrench } from "lucide-react";
import { SupportForm } from "@/components/storefront/support-form";

export const metadata: Metadata = { title: "Soporte técnico", description: "Abre una consulta de demostración con el equipo de soporte NODRIA." };

export default function SupportPage() {
  return <main className="page-wrap"><p className="eyebrow">PERSONAS EXPERTAS, AL OTRO LADO</p><h1 className="page-title">Estamos contigo<span className="title-period">.</span></h1><p className="page-intro">Una duda de compatibilidad, un pedido que quieres seguir o una configuración que necesita un segundo par de ojos. Te escuchamos.</p><section className="support-contact"><aside className="support-aside"><span className="support-icon"><LifeBuoy size={20} /></span><h2>Cuéntanos qué necesitas.</h2><p>Registra una consulta, añade el número de pedido si lo tienes y el equipo la revisará. En esta demo, los tickets se guardan en un archivo local.</p><div className="support-aside-detail"><span><Clock3 size={14} /> Respuesta orientativa: 1 día laborable</span><span><Wrench size={14} /> Diagnóstico y configuración</span></div><Link href="/servicios">Descubre nuestros servicios <ArrowUpRight size={13} /></Link></aside><div className="support-form-wrap"><p className="eyebrow">ABRIR UNA SOLICITUD</p><h2>¿En qué podemos ayudarte?</h2><SupportForm /></div></section></main>;
}
