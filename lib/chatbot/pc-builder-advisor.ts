import type { ChatbotQuickReply } from "./types";
import { normalizeText } from "./normalizer";
import { HEADROOM_MULTIPLIER, PSU_RECOMMENDATION_STEP_W } from "@/lib/pc-builder/compatibility";

export type PcBuilderAdvice = {
  title: string;
  explanation: string;
  quickReplies: ChatbotQuickReply[];
  actionLink?: {
    label: string;
    href: string;
  };
};

/**
 * Deterministic advisor for PC Builder PRO inquiries and hardware questions.
 */
export function getPcBuilderAdvice(query: string): PcBuilderAdvice {
  const normalized = normalizeText(query);

  // 1. Socket & CPU / Motherboard compatibility
  if (
    normalized.includes("socket") ||
    normalized.includes("am5") ||
    normalized.includes("lga1700") ||
    normalized.includes("placa para ryzen") ||
    normalized.includes("placa para intel") ||
    normalized.includes("compatible con la placa") ||
    (normalized.includes("procesador") && normalized.includes("placa"))
  ) {
    return {
      title: "Compatibilidad de Socket y Placa Base",
      explanation:
        "En **PC Builder PRO**, el socket físico del procesador debe coincidir exactamente con el de la placa base:\n\n" +
        "• **AMD Ryzen Serie 7000/8000/9000:** Requiere socket **AM5** y placas base con chipset B650, X670 o B850. Todas las placas AM5 utilizan exclusivamente memoria **DDR5**.\n" +
        "• **Intel Core 12ª, 13ª y 14ª generación:** Requiere socket **LGA1700** y placas base con chipset B760 o Z790. Existen modelos de placa compatibles con DDR4 o con DDR5 (deben coincidir).\n\n" +
        "Nuestro configurador filtra automáticamente las placas y procesadores para que nunca selecciones combinaciones incompatibles.",
      quickReplies: [
        { label: "Ir al configurador", payload: "Abrir PC Builder PRO" },
        { label: "¿DDR4 o DDR5?", payload: "¿Qué diferencia hay entre DDR4 y DDR5?" },
        { label: "Cálculo de fuente", payload: "¿Cuántos vatios de fuente necesito?" },
      ],
      actionLink: {
        label: "Configurar PC con AM5 / LGA1700",
        href: "/configurador",
      },
    };
  }

  // 2. RAM DDR4 vs DDR5
  if (
    normalized.includes("ddr4") ||
    normalized.includes("ddr5") ||
    normalized.includes("frecuencia ram") ||
    normalized.includes("mhz ram")
  ) {
    return {
      title: "Memoria RAM: DDR4 vs DDR5",
      explanation:
        "Diferencias clave entre generaciones de memoria RAM:\n\n" +
        "• **DDR4:** Estándar maduro y muy económico. Frecuencias típicas entre 3200 MHz y 3600 MHz CL16. Compatible con plataformas Intel LGA1700 específicas.\n" +
        "• **DDR5:** Nueva generación de alto ancho de banda. Frecuencias típicas de 5600 MHz a 6000 MHz CL30/CL36 con tecnología AMD EXPO o Intel XMP 3.0. " +
        "Obligatoria en todas las plataformas AMD AM5 actuales.\n\n" +
        "**Importante:** Las ranuras DDR4 y DDR5 son físicamente distintas; una placa base solo admite un tipo específico de ranura.",
      quickReplies: [
        { label: "Ir al configurador", payload: "Abrir PC Builder PRO" },
        { label: "¿Qué caja necesito?", payload: "¿Cómo saber si cabe en la caja?" },
      ],
      actionLink: {
        label: "Elegir RAM en PC Builder PRO",
        href: "/configurador",
      },
    };
  }

  // 3. GPU Length & Case clearance
  if (
    normalized.includes("caja") ||
    normalized.includes("chasis") ||
    normalized.includes("entra en la caja") ||
    normalized.includes("espacio grafica") ||
    normalized.includes("longitud grafica")
  ) {
    return {
      title: "Espacio en Caja y Dimensiones de Gráfica (GPU)",
      explanation:
        "Al elegir caja y tarjeta gráfica en PC Builder PRO, verificamos dos factores críticos:\n\n" +
        "1. **Longitud máxima de GPU:** Las tarjetas gráficas modernas de 3 ventiladores (como RTX 4070 Ti / 4080) pueden medir entre 300 mm y 340 mm. La caja debe contar con espacio libre suficiente.\n" +
        "2. **Factor de forma de placa base:** Las placas **ATX** requieren torres estándar; las placas **Micro-ATX** y **Mini-ITX** caben tanto en torres grandes como en cajas compactas.\n\n" +
        "PC Builder PRO avisa en tiempo real si la GPU excede el espacio interior del chasis seleccionado.",
      quickReplies: [
        { label: "Ir al configurador", payload: "Abrir PC Builder PRO" },
        { label: "¿Y la fuente?", payload: "¿Cuántos vatios de fuente necesito?" },
      ],
      actionLink: {
        label: "Ver cajas y chasis en el configurador",
        href: "/configurador",
      },
    };
  }

  // 4. PSU Wattage calculation
  if (
    normalized.includes("fuente") ||
    normalized.includes("vatios") ||
    normalized.includes("psu") ||
    normalized.includes("potencia")
  ) {
    return {
      title: "Cálculo de Potencia de Fuente de Alimentación",
      explanation:
        `En **PC Builder PRO**, calculamos la fuente de alimentación recomendada utilizando las reglas oficiales de compatibilidad:\n\n` +
        `• **Fórmula:** \`(Consumo total componentes) × ${HEADROOM_MULTIPLIER.toFixed(2)}\` (margen preventivo del ${Math.round((HEADROOM_MULTIPLIER - 1) * 100)}%), redondeado al escalón superior de ${PSU_RECOMMENDATION_STEP_W} W.\n` +
        "• **Cálculo de referencia:** `(TDP Procesador + TDP Gráfica + 50W base) × 1.20`\n" +
        "• Por ejemplo, para un procesador de 105W y una gráfica de 220W:\n" +
        "  `105 + 220 + 50 = 375 W × 1.20 = 450 W mínimos` → Se recomienda una fuente de al menos **550 W o 650 W 80 PLUS**.\n\n" +
        "Este margen garantiza que la fuente trabaje en su curva de máxima eficiencia energética (50-60% de carga) con menor temperatura y ruido.",
      quickReplies: [
        { label: "Ir al configurador", payload: "Abrir PC Builder PRO" },
        { label: "¿Qué procesador elegir?", payload: "¿Qué socket elegir?" },
      ],
      actionLink: {
        label: "Calcular en PC Builder PRO",
        href: "/configurador",
      },
    };
  }

  // 5. Default general overview of PC Builder PRO
  return {
    title: "Asesor Técnico PC Builder PRO",
    explanation:
      "**PC Builder PRO** es el configurador de hardware de NODRIA con validación de compatibilidad en tiempo real.\n\n" +
      "Te permite montar tu ordenador seleccionando los 8 componentes:\n" +
      "1. **Procesador (CPU):** AMD Ryzen o Intel Core.\n" +
      "2. **Placa Base:** Comprobación automática de socket (AM5 / LGA1700).\n" +
      "3. **Memoria RAM:** Tipo DDR4 o DDR5 según la placa.\n" +
      "4. **Tarjeta Gráfica (GPU):** Comprobación de longitud y consumo.\n" +
      "5. **Almacenamiento:** SSDs NVMe PCIe de alta velocidad.\n" +
      "6. **Fuente de Alimentación (PSU):** Cálculo automático de vatios necesarios.\n" +
      "7. **Caja / Chasis:** Verificación de factor de forma y espacio.\n" +
      "8. **Refrigeración:** Disipadores por aire o líquida AIO.\n\n" +
      "Una vez configurado y verificado, puedes añadir todo el equipo al carrito en un solo clic.",
    quickReplies: [
      { label: "Abrir PC Builder PRO", payload: "Ir al configurador" },
      { label: "Compatibilidad de socket", payload: "¿Cómo sé si el procesador es compatible con la placa?" },
      { label: "Calcular fuente", payload: "¿Cuántos vatios de fuente necesito?" },
    ],
    actionLink: {
      label: "Acceder a PC Builder PRO",
      href: "/configurador",
    },
  };
}
