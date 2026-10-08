import { createHash } from 'node:crypto';

// This source describes fictional products. Numbers and ratings are demo fixtures,
// not benchmark results, purchase reviews, certifications or real warranties.
export const datasetVersion = 'nodria-depth-v1';
export const publishedAt = '2026-10-08T00:00:00Z';
export const uuid = (key) => {
  const h = createHash('sha256').update(`${datasetVersion}:${key}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

const roots = [
  ['ordenadores', 'Ordenadores', 'Portátiles, sobremesa y workstations'],
  ['componentes', 'Componentes', 'Piezas para crear tu propio equipo'],
  ['monitores', 'Monitores', 'Color, resolución y fluidez'],
  ['redes', 'Redes', 'Conectividad doméstica y de oficina'],
  ['telefonia', 'Telefonía', 'Móvil, tablet y accesorios'],
  ['almacenamiento', 'Almacenamiento', 'Tus datos, siempre a mano'],
];
const images = {
  ordenadores: ['1496181133206-80ce9b88a853', 'Portátil'],
  componentes: ['1518770660439-4636190af475', 'Circuitos de un componente'],
  monitores: ['1527443224154-c4a3942d3acf', 'Monitor'],
  redes: ['1606904825846-647eb07f5be2', 'Equipo de red'],
  telefonia: ['1544244015-0df4b3ffc6b0', 'Dispositivo móvil'],
  almacenamiento: ['1597872200969-2b65d56bd16b', 'Unidad de almacenamiento'],
};

// Each family has four deliberately specified editions, ordered by capability.
// spec values are also stored in technical as typed fields for future faceting.
const families = [
  ['ordenadores', 'portatiles', 'Portátiles', 'Veltrama', 'Trazo', 'VLT-TRZ', 'Estudio', [549, 749, 999, 1299], (i) => ({ memory_gb: [8,16,24,32][i], storage_gb: [256,512,1024,2048][i], screen_inches: [13,14,15,16][i], panel: 'IPS', cpu_cores: [4,6,8,12][i] })],
  ['ordenadores', 'sobremesas', 'Sobremesas', 'Veltrama', 'Mesa', 'VLT-MSA', 'Oficina', [499,699,949,1199], (i) => ({ memory_gb: [8,16,32,64][i], storage_gb: [256,512,1024,2048][i], cpu_cores: [4,6,8,12][i], form_factor: 'Torre compacta' })],
  ['ordenadores', 'estaciones-creativas', 'Estaciones creativas', 'Veltrama', 'Taller', 'VLT-TLR', 'Creación', [1399,1799,2299,2999], (i) => ({ memory_gb: [32,64,96,128][i], storage_gb: [1024,2048,2048,4096][i], cpu_cores: [8,12,16,24][i], gpu_memory_gb: [8,12,16,24][i] })],
  ['componentes', 'procesadores', 'Procesadores', 'Orvanta', 'Pulso', 'ORV-PLS', 'Configurador', [139,199,289,429], (i) => ({ cpu_cores: [4,6,8,12][i], socket: 'AM5', memory_generation: 'DDR5', power_w: [65,65,105,120][i], integrated_graphics: true })],
  ['componentes', 'placas-base', 'Placas base', 'Orvanta', 'Nexo', 'ORV-NXO', 'Configurador', [109,149,189,239], (i) => ({ socket: 'AM5', form_factor: ['microATX','microATX','ATX','ATX'][i], memory_generation: 'DDR5', max_memory_gb: [96,128,192,192][i], power_w: 50 })],
  ['componentes', 'memoria-ram', 'Memoria RAM', 'Orvanta', 'Trama', 'ORV-TRM', 'Configurador', [49,89,159,229], (i) => ({ memory_gb: [16,32,64,96][i], memory_generation: 'DDR5', kit_modules: 2, memory_speed_mt_s: [4800,5600,6000,6000][i], power_w: [6,8,10,12][i] })],
  ['componentes', 'cajas', 'Cajas', 'Orvanta', 'Bastidor', 'ORV-BST', 'Configurador', [59,79,109,139], (i) => ({ supported_form_factors: ['ATX','microATX'], max_gpu_length_mm: [300,320,360,400][i], power_w: 15, fan_count: i+1 })],
  ['componentes', 'fuentes-alimentacion', 'Fuentes de alimentación', 'Orvanta', 'Caudal', 'ORV-CDL', 'Configurador', [59,89,119,159], (i) => ({ power_supply_w: [450,650,850,1000][i], efficiency_label: ['80+ Bronze','80+ Gold','80+ Gold','80+ Platinum'][i], modular: i > 0 })],
  ['componentes', 'tarjetas-graficas', 'Tarjetas gráficas', 'Orvanta', 'Lienzo', 'ORV-LNZ', 'Configurador', [199,329,499,749], (i) => ({ gpu_memory_gb: [6,8,12,16][i], gpu_length_mm: [230,260,290,330][i], power_w: [100,160,230,300][i] })],
  ['componentes', 'refrigeracion', 'Refrigeración', 'Orvanta', 'Brisa', 'ORV-BRS', 'Configurador', [29,49,79,119], (i) => ({ supported_sockets: ['AM5','LGA1700'], cooler_height_mm: [120,145,155,160][i], fan_count: [1,1,2,2][i], power_w: [3,4,6,8][i] })],
  ['componentes', 'concentradores', 'Concentradores', 'Orvanta', 'Enlace', 'ORV-ENL', 'Oficina', [29,49,79,119], (i) => ({ connection: 'USB-C', usb_ports: [3,4,6,8][i], charging_w: [60,65,90,100][i], video_outputs: [0,1,1,2][i] })],
  ['monitores', 'monitores-oficina', 'Monitores de oficina', 'Lumivara', 'Plano', 'LMV-PLN', 'Oficina', [129,179,249,329], (i) => ({ screen_inches: [22,24,27,32][i], panel: 'IPS', resolution: ['1920 × 1080','1920 × 1080','2560 × 1440','3840 × 2160'][i], refresh_hz: [75,100,100,60][i], charging_w: [0,0,65,90][i] })],
  ['monitores', 'monitores-creacion', 'Monitores de creación', 'Lumivara', 'Matiz', 'LMV-MTZ', 'Creación', [299,429,599,799], (i) => ({ screen_inches: [24,27,27,32][i], panel: 'IPS', resolution: ['2560 × 1440','2560 × 1440','3840 × 2160','3840 × 2160'][i], refresh_hz: 60, charging_w: [65,65,90,100][i] })],
  ['monitores', 'monitores-juego', 'Monitores de juego', 'Lumivara', 'Ritmo', 'LMV-RTM', 'Juego', [179,259,399,549], (i) => ({ screen_inches: [24,27,27,32][i], panel: ['IPS','IPS','IPS','VA'][i], resolution: ['1920 × 1080','2560 × 1440','2560 × 1440','3840 × 2160'][i], refresh_hz: [144,165,240,144][i] })],
  ['redes', 'routers', 'Routers', 'Talveria', 'Paso', 'TLV-PSO', 'Hogar conectado', [59,99,169,249], (i) => ({ wifi_standard: ['Wi-Fi 6','Wi-Fi 6','Wi-Fi 6E','Wi-Fi 7'][i], ethernet_ports: [3,4,4,5][i], ethernet_gbps: [1,1,2.5,2.5][i], coverage_m2: [65,90,120,160][i] })],
  ['redes', 'sistemas-mesh', 'Sistemas mesh', 'Talveria', 'Ronda', 'TLV-RND', 'Hogar conectado', [129,199,299,449], (i) => ({ wifi_standard: ['Wi-Fi 6','Wi-Fi 6','Wi-Fi 6E','Wi-Fi 7'][i], node_count: [2,3,2,3][i], ethernet_gbps: [1,1,2.5,2.5][i], coverage_m2: [120,180,200,300][i] })],
  ['redes', 'switches', 'Switches', 'Talveria', 'Cruce', 'TLV-CRC', 'Oficina', [29,59,129,229], (i) => ({ ethernet_ports: [5,8,8,16][i], ethernet_gbps: [1,1,2.5,2.5][i], poe: i > 1, managed: i > 0 })],
  ['telefonia', 'moviles', 'Móviles', 'Seravela', 'Bolsillo', 'SRV-BOL', 'Movilidad', [179,279,399,549], (i) => ({ memory_gb: [4,6,8,12][i], storage_gb: [64,128,256,512][i], screen_inches: [6.1,6.3,6.5,6.7][i], battery_mah: [4000,4500,5000,5200][i], connectivity: ['4G','5G','5G','5G'][i] })],
  ['telefonia', 'tablets', 'Tablets', 'Seravela', 'Cuaderno', 'SRV-CDR', 'Estudio', [169,249,399,549], (i) => ({ memory_gb: [4,6,8,12][i], storage_gb: [64,128,256,512][i], screen_inches: [8,10,11,12][i], panel: 'IPS', battery_mah: [5000,6000,7000,8000][i] })],
  ['almacenamiento', 'ssd-internos', 'SSD internos', 'Ardelia', 'Surco', 'ARD-SRC', 'Configurador', [39,69,119,219], (i) => ({ storage_gb: [500,1000,2000,4000][i], storage_interface: 'NVMe PCIe 4.0', read_mb_s: [3500,5000,6500,7000][i], power_w: [4,5,6,8][i] })],
  ['almacenamiento', 'ssd-externos', 'SSD externos', 'Ardelia', 'Ruta', 'ARD-RTA', 'Movilidad', [59,89,149,279], (i) => ({ storage_gb: [500,1000,2000,4000][i], connection: ['USB-C 5 Gbps','USB-C 10 Gbps','USB-C 10 Gbps','USB-C 20 Gbps'][i], read_mb_s: [450,950,1050,1800][i], portable: true })],
];

const labels = {
  memory_gb: ['Memoria', 'GB'], storage_gb: ['Almacenamiento', 'GB'], screen_inches: ['Pantalla', 'pulgadas'],
  panel: ['Panel', ''], cpu_cores: ['Núcleos', ''], form_factor: ['Formato', ''], gpu_memory_gb: ['Memoria gráfica', 'GB'],
  socket: ['Socket', ''], memory_generation: ['Tipo de memoria', ''], power_w: ['Consumo orientativo', 'W'],
  integrated_graphics: ['Gráficos integrados', ''], max_memory_gb: ['Memoria máxima', 'GB'], kit_modules: ['Módulos', ''],
  memory_speed_mt_s: ['Velocidad de memoria', 'MT/s'], supported_form_factors: ['Formatos admitidos', ''],
  max_gpu_length_mm: ['Longitud gráfica máxima', 'mm'], fan_count: ['Ventiladores', ''], power_supply_w: ['Potencia', 'W'],
  efficiency_label: ['Eficiencia simulada', ''], modular: ['Cableado modular', ''], gpu_length_mm: ['Longitud gráfica', 'mm'],
  supported_sockets: ['Sockets admitidos', ''], cooler_height_mm: ['Altura', 'mm'], connection: ['Conexión', ''],
  usb_ports: ['Puertos USB', ''], charging_w: ['Carga USB-C', 'W'], video_outputs: ['Salidas de vídeo', ''],
  resolution: ['Resolución', ''], refresh_hz: ['Frecuencia', 'Hz'], wifi_standard: ['Estándar', ''],
  ethernet_ports: ['Puertos Ethernet', ''], ethernet_gbps: ['Velocidad Ethernet', 'Gbps'], coverage_m2: ['Cobertura orientativa', 'm²'],
  node_count: ['Unidades mesh', ''], poe: ['PoE', ''], managed: ['Gestionable', ''], battery_mah: ['Batería', 'mAh'],
  connectivity: ['Conectividad', ''], storage_interface: ['Interfaz', ''], read_mb_s: ['Lectura orientativa', 'MB/s'], portable: ['Portátil', ''],
};

function builderFor(leaf, t) {
  switch (leaf) {
    case 'procesadores': return { category: 'cpu', socket: t.socket, memory_generations: [t.memory_generation], estimated_power_w: t.power_w, integrated_graphics: t.integrated_graphics };
    case 'placas-base': return { category: 'motherboard', socket: t.socket, form_factor: t.form_factor, memory_generation: t.memory_generation, max_memory_gb: t.max_memory_gb, estimated_power_w: t.power_w };
    case 'memoria-ram': return { category: 'memory', generation: t.memory_generation, capacity_gb: t.memory_gb, kit_modules: t.kit_modules, speed_mt_per_s: t.memory_speed_mt_s, estimated_power_w: t.power_w };
    case 'cajas': return { category: 'case', supported_form_factors: t.supported_form_factors, max_gpu_length_mm: t.max_gpu_length_mm, estimated_power_w: t.power_w };
    case 'fuentes-alimentacion': return { category: 'psu', capacity_w: t.power_supply_w, efficiency_label: t.efficiency_label };
    case 'tarjetas-graficas': return { category: 'gpu', length_mm: t.gpu_length_mm, estimated_power_w: t.power_w };
    case 'refrigeracion': return { category: 'cooler', supported_sockets: t.supported_sockets, estimated_power_w: t.power_w };
    case 'ssd-internos': return { category: 'storage', capacity_tb: t.storage_gb / 1000, interface: t.storage_interface, estimated_power_w: t.power_w };
    default: return null;
  }
}

export function buildDataset() {
  const categories = roots.map(([slug, name, description], i) => ({ slug, name, description, parent_slug: null, id: uuid(`category:${slug}`), sort_order: (i+1)*10 }));
  const products = [];
  families.forEach(([root, leaf, leafName, brand, family, prefix, use, prices, profile], familyIndex) => {
    categories.push({ slug: leaf, name: leafName, description: `${leafName} ficticios para ${use.toLowerCase()}.`, parent_slug: root, id: uuid(`category:${leaf}`), sort_order: 100 + familyIndex });
    prices.forEach((price, edition) => {
      const serial = String(edition + 1).padStart(2, '0');
      const slug = `${brand.toLowerCase()}-${family.toLowerCase()}-${serial}`;
      const technical = profile(edition);
      const builder = builderFor(leaf, technical);
      const index = products.length;
      const specifications = Object.entries(technical).map(([key, value], i) => {
        const [label, unit] = labels[key];
        const display = Array.isArray(value) ? value.join(' · ') : typeof value === 'boolean' ? value ? 'Sí' : 'No' : String(value);
        return { label, value: `${display}${unit ? ` ${unit}` : ''}`, sort_order: (i+1)*10 };
      });
      specifications.push({ label: 'Familia', value: family, sort_order: 200 }, { label: 'Uso recomendado', value: use, sort_order: 210 }, { label: 'Datos de demostración', value: 'Producto, prestaciones y valoraciones ficticios; imagen ilustrativa.', sort_order: 220 });
      const highlights = specifications.slice(0, 3).map(s => `${s.label.toLowerCase()}: ${s.value}`).join('; ');
      const [photo, subject] = images[root];
      products.push({
        id: `pr_depth_${slug.replaceAll('-', '_')}`, slug, sku: `${prefix}-${serial}`, name: `${brand} ${family} ${serial}`, brand,
        summary: `${leafName} para ${use.toLowerCase()}: ${highlights}. Modelo ficticio NODRIA.`,
        description: `${brand} ${family} ${serial} forma parte de la familia ${family}, orientada a ${use.toLowerCase()}. Esta edición permite comparar ${highlights}. Todas las prestaciones y valoraciones son datos sintéticos de una demo académica; no representan pruebas, certificaciones ni experiencias de compradores. La fotografía es ilustrativa y no muestra este modelo.`,
        image_url: `https://images.unsplash.com/photo-${photo}?auto=format&fit=crop&w=1200&q=85`,
        image_alt: `${subject}: fotografía ilustrativa, no corresponde al modelo ficticio ${brand} ${family} ${serial}`,
        badge: index % 9 === 0 ? 'Selección demo' : null,
        rating_average: index % 7 === 0 ? 0 : [3.6,3.8,4,4.2,4.4,4.6,4.8][index % 7],
        rating_count: index % 7 === 0 ? 0 : 8 + (index*17)%173,
        is_featured: edition === 2 && familyIndex % 3 === 0,
        root_category: root, category_slug: leaf, family, use_case: use,
        variant: { id: uuid(`variant:${slug}`), sku: `${prefix}-${serial}`, title: `Edición ${serial}`, current_price: price.toFixed(2), compare_at_price: index % 5 === 0 ? (price+20+edition*10).toFixed(2) : null, currency: 'EUR', tax_rate: '0.2100', attributes: { dataset_version: datasetVersion, demo: true, family, use_case: use, technical, ...(builder ? { pc_builder: builder } : {}) } },
        specifications,
        stock: index % 11 === 0 ? 0 : index % 8 === 0 ? 1+(index%3) : 6+(index*7)%65,
      });
    });
  });
  return { version: datasetVersion, published_at: publishedAt, categories, products };
}
