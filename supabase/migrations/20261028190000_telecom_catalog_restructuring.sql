-- NODRIA — Telecom & Industrial Restructuring Migration
-- Upserts the 5 specialized telecom categories and 25 subcategories.
-- Upserts the 52 commercial telecommunications products, variants, specifications, and initial demo inventory.
-- Retires legacy gaming fixtures by setting is_published = false without deleting historical orders.
-- Completely idempotent and safe for repeated execution.

begin;

-- 1. Upsert Root Categories and Subcategories
insert into public.categories (id, slug, name, description, sort_order, parent_id, is_active)
values ('infraestructuras-telecomunicaciones', 'infraestructuras-telecomunicaciones', 'Infraestructuras de Telecomunicaciones', 'Armarios rack de 19", cableado estructurado Cat.6A/Cat.7, fibra óptica preconectorizada, paneles de parcheo y certificación de redes.', 10, null, true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  parent_id = null,
  is_active = true,
  updated_at = now();

insert into public.categories (id, slug, name, description, sort_order, parent_id, is_active)
values ('racks-armarios', 'racks-armarios', 'Racks y armarios de comunicaciones', 'Armarios murales y de suelo para salas de servidores y telecomunicaciones.', 11, 'infraestructuras-telecomunicaciones', true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  parent_id = excluded.parent_id,
  is_active = true,
  updated_at = now();

insert into public.categories (id, slug, name, description, sort_order, parent_id, is_active)
values ('cableado-estructurado', 'cableado-estructurado', 'Cableado estructurado Cat.6A/Cat.7', 'Bobinas de cable de red de cobre apantallado y libre de halógenos LSZH.', 12, 'infraestructuras-telecomunicaciones', true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  parent_id = excluded.parent_id,
  is_active = true,
  updated_at = now();

insert into public.categories (id, slug, name, description, sort_order, parent_id, is_active)
values ('fibra-optica', 'fibra-optica', 'Fibra óptica y distribución troncal', 'Mangueras preconectorizadas, bandejas de distribución y pigtails ópticos.', 13, 'infraestructuras-telecomunicaciones', true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  parent_id = excluded.parent_id,
  is_active = true,
  updated_at = now();

insert into public.categories (id, slug, name, description, sort_order, parent_id, is_active)
values ('paneles-parcheo', 'paneles-parcheo', 'Paneles de parcheo y gestión de cable', 'Paneles modulares RJ45, guías de cables y pasahilos horizontales.', 14, 'infraestructuras-telecomunicaciones', true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  parent_id = excluded.parent_id,
  is_active = true,
  updated_at = now();

insert into public.categories (id, slug, name, description, sort_order, parent_id, is_active)
values ('herramientas-certificacion', 'herramientas-certificacion', 'Herramientas profesionales y certificación', 'Certificadores de redes Cat.6A/Cat.8 y fusionadoras de fibra por alineación de núcleo.', 15, 'infraestructuras-telecomunicaciones', true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  parent_id = excluded.parent_id,
  is_active = true,
  updated_at = now();

insert into public.categories (id, slug, name, description, sort_order, parent_id, is_active)
values ('equipos-sistemas-telecomunicaciones', 'equipos-sistemas-telecomunicaciones', 'Equipos y Sistemas de Telecomunicaciones', 'Switches gestionables L2+/L3, routers de borde, puntos de acceso Wi-Fi 6E/7, transceptores ópticos SFP+ y cabeceras de distribución.', 20, null, true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  parent_id = null,
  is_active = true,
  updated_at = now();

insert into public.categories (id, slug, name, description, sort_order, parent_id, is_active)
values ('switches-gestionables', 'switches-gestionables', 'Switches gestionables capa 2/3 y PoE+', 'Conmutadores de alta capacidad con PoE+ y puertos de enlace 10G SFP+.', 21, 'equipos-sistemas-telecomunicaciones', true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  parent_id = excluded.parent_id,
  is_active = true,
  updated_at = now();

insert into public.categories (id, slug, name, description, sort_order, parent_id, is_active)
values ('routers-borde', 'routers-borde', 'Routers de borde y balanceo de carga', 'Pasarelas de seguridad multi-WAN y cortafuegos con inspección profunda de paquetes.', 22, 'equipos-sistemas-telecomunicaciones', true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  parent_id = excluded.parent_id,
  is_active = true,
  updated_at = now();

insert into public.categories (id, slug, name, description, sort_order, parent_id, is_active)
values ('puntos-acceso-wifi', 'puntos-acceso-wifi', 'Puntos de acceso inalámbrico Wi-Fi 6E/7', 'Puntos de acceso corporativos de alta densidad y tecnología multi-banda.', 23, 'equipos-sistemas-telecomunicaciones', true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  parent_id = excluded.parent_id,
  is_active = true,
  updated_at = now();

insert into public.categories (id, slug, name, description, sort_order, parent_id, is_active)
values ('transceptores-opticos', 'transceptores-opticos', 'Módulos transceptores ópticos SFP/SFP+', 'Transceptores 10G monomodo, multimodo y 10GBASE-T en cobre.', 24, 'equipos-sistemas-telecomunicaciones', true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  parent_id = excluded.parent_id,
  is_active = true,
  updated_at = now();

insert into public.categories (id, slug, name, description, sort_order, parent_id, is_active)
values ('cabeceras-rf-tv', 'cabeceras-rf-tv', 'Cabeceras de radiofrecuencia y distribución TV/SAT', 'Centrales amplificadoras programables y transmoduladores ópticos DVB.', 25, 'equipos-sistemas-telecomunicaciones', true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  parent_id = excluded.parent_id,
  is_active = true,
  updated_at = now();

insert into public.categories (id, slug, name, description, sort_order, parent_id, is_active)
values ('domotica-hogar-digital', 'domotica-hogar-digital', 'Domótica y Hogar Digital', 'Pasarelas multiprotocolo Zigbee 3.0/Matter, relés para carril DIN, sensores ambientales, videoporteros IP y climatización inteligente.', 30, null, true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  parent_id = null,
  is_active = true,
  updated_at = now();

insert into public.categories (id, slug, name, description, sort_order, parent_id, is_active)
values ('pasarelas-controladores', 'pasarelas-controladores', 'Pasarelas y controladores domóticos', 'Centros de control compatibles con Matter, Zigbee 3.0, Thread y Apple Home.', 31, 'domotica-hogar-digital', true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  parent_id = excluded.parent_id,
  is_active = true,
  updated_at = now();

insert into public.categories (id, slug, name, description, sort_order, parent_id, is_active)
values ('reles-actuadores', 'reles-actuadores', 'Micromódulos y relés inteligentes para carril DIN', 'Actuadores de control de iluminación y cargas de potencia con telemetría de energía.', 32, 'domotica-hogar-digital', true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  parent_id = excluded.parent_id,
  is_active = true,
  updated_at = now();

insert into public.categories (id, slug, name, description, sort_order, parent_id, is_active)
values ('sensores-ambientales', 'sensores-ambientales', 'Sensores ambientales, presencia y consumo', 'Sensores de presencia por radar milimétrico mmWave y monitores de calidad de aire.', 33, 'domotica-hogar-digital', true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  parent_id = excluded.parent_id,
  is_active = true,
  updated_at = now();

insert into public.categories (id, slug, name, description, sort_order, parent_id, is_active)
values ('videoporteros-control-acceso', 'videoporteros-control-acceso', 'Videoporteros IP y control de accesos', 'Intercomunicadores PoE con cámara 2K, lectores NFC y cerraduras inteligentes.', 34, 'domotica-hogar-digital', true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  parent_id = excluded.parent_id,
  is_active = true,
  updated_at = now();

insert into public.categories (id, slug, name, description, sort_order, parent_id, is_active)
values ('climatizacion-inteligente', 'climatizacion-inteligente', 'Termostatos y gestión climática inteligente', 'Termostatos modulantes OpenTherm y cabezales termostáticos electrónicos para radiadores.', 35, 'domotica-hogar-digital', true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  parent_id = excluded.parent_id,
  is_active = true,
  updated_at = now();

insert into public.categories (id, slug, name, description, sort_order, parent_id, is_active)
values ('telefonia-comunicaciones', 'telefonia-comunicaciones', 'Telefonía y Comunicaciones', 'Centralitas telefónicas IP-PBX, terminales SIP ejecutivos, teléfonos DECT, pasarelas VoIP FXS/FXO y routers celulares industriales 4G/5G.', 40, null, true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  parent_id = null,
  is_active = true,
  updated_at = now();

insert into public.categories (id, slug, name, description, sort_order, parent_id, is_active)
values ('centralitas-ip-pbx', 'centralitas-ip-pbx', 'Centralitas IP-PBX y servidores SIP', 'Servidores de comunicaciones unificadas con operadora automática y salas de conferencia.', 41, 'telefonia-comunicaciones', true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  parent_id = excluded.parent_id,
  is_active = true,
  updated_at = now();

insert into public.categories (id, slug, name, description, sort_order, parent_id, is_active)
values ('telefonos-ip-dect', 'telefonos-ip-dect', 'Teléfonos IP sobremesa y terminales DECT', 'Teléfonos ejecutivos con pantalla en color, audio HD y sistemas inalámbricos multisede.', 42, 'telefonia-comunicaciones', true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  parent_id = excluded.parent_id,
  is_active = true,
  updated_at = now();

insert into public.categories (id, slug, name, description, sort_order, parent_id, is_active)
values ('gateways-voip', 'gateways-voip', 'Pasarelas VoIP analógicas y digitales FXS/FXO/PRI', 'Adaptadores de líneas telefónicas tradicionales e interfaces RDSI/ISDN a SIP.', 43, 'telefonia-comunicaciones', true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  parent_id = excluded.parent_id,
  is_active = true,
  updated_at = now();

insert into public.categories (id, slug, name, description, sort_order, parent_id, is_active)
values ('routers-celulares-4g-5g', 'routers-celulares-4g-5g', 'Routers y módems celulares industriales 4G/5G', 'Equipos de conectividad móvil crítica con doble SIM y soporte VPN avanzado.', 44, 'telefonia-comunicaciones', true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  parent_id = excluded.parent_id,
  is_active = true,
  updated_at = now();

insert into public.categories (id, slug, name, description, sort_order, parent_id, is_active)
values ('antenas-comunicaciones', 'antenas-comunicaciones', 'Antenas móviles M2M/IoT y amplificadores', 'Antenas de alta ganancia para exterior y sistemas de amplificación celular homologados.', 45, 'telefonia-comunicaciones', true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  parent_id = excluded.parent_id,
  is_active = true,
  updated_at = now();

insert into public.categories (id, slug, name, description, sort_order, parent_id, is_active)
values ('digitalizacion-industria-conectada', 'digitalizacion-industria-conectada', 'Digitalización e Industria Conectada', 'Gateways IoT industriales, servidores de computación Edge, almacenamiento en red NAS, sensores Modbus/RS-485 y trazabilidad con terminales de lectura.', 50, null, true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  parent_id = null,
  is_active = true,
  updated_at = now();

insert into public.categories (id, slug, name, description, sort_order, parent_id, is_active)
values ('gateways-iot-industriales', 'gateways-iot-industriales', 'Gateways IoT y adquisición de datos en planta', 'Pasarelas industriales con soporte Node-RED, Modbus TCP/RTU y brokers MQTT.', 51, 'digitalizacion-industria-conectada', true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  parent_id = excluded.parent_id,
  is_active = true,
  updated_at = now();

insert into public.categories (id, slug, name, description, sort_order, parent_id, is_active)
values ('servidores-edge-computacion', 'servidores-edge-computacion', 'Servidores Edge y computación industrial', 'Equipos embebidos fanless para analítica en borde e inferencia de inteligencia artificial.', 52, 'digitalizacion-industria-conectada', true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  parent_id = excluded.parent_id,
  is_active = true,
  updated_at = now();

insert into public.categories (id, slug, name, description, sort_order, parent_id, is_active)
values ('almacenamiento-nas-servidores', 'almacenamiento-nas-servidores', 'Almacenamiento en red NAS y servidores', 'Sistemas de almacenamiento centralizado con copias automatizadas y unidades NVMe ultrarrápidas.', 53, 'digitalizacion-industria-conectada', true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  parent_id = excluded.parent_id,
  is_active = true,
  updated_at = now();

insert into public.categories (id, slug, name, description, sort_order, parent_id, is_active)
values ('sensores-industriales-modbus', 'sensores-industriales-modbus', 'Sensores industriales e interfaces Modbus / IO-Link', 'Transmisores de presión, temperatura e instrumentación de procesos en acero inoxidable.', 54, 'digitalizacion-industria-conectada', true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  parent_id = excluded.parent_id,
  is_active = true,
  updated_at = now();

insert into public.categories (id, slug, name, description, sort_order, parent_id, is_active)
values ('captura-datos-trazabilidad', 'captura-datos-trazabilidad', 'Terminales de captura de datos y trazabilidad logística', 'PDA industriales con escáner 2D, sellado IP68 e impresoras térmicas de etiquetas.', 55, 'digitalizacion-industria-conectada', true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  parent_id = excluded.parent_id,
  is_active = true,
  updated_at = now();


-- 2. Retire legacy gaming PC components from public store without deleting records
update public.products
   set is_published = false,
       is_featured = false,
       updated_at = now()
 where id not in (
   'tel-inf-001',
   'tel-inf-002',
   'tel-inf-003',
   'tel-inf-004',
   'tel-inf-005',
   'tel-inf-006',
   'tel-inf-007',
   'tel-inf-008',
   'tel-inf-009',
   'tel-inf-010',
   'tel-eqt-011',
   'tel-eqt-012',
   'tel-eqt-013',
   'tel-eqt-014',
   'tel-eqt-015',
   'tel-eqt-016',
   'tel-eqt-017',
   'tel-eqt-018',
   'tel-eqt-019',
   'tel-eqt-020',
   'tel-dom-021',
   'tel-dom-022',
   'tel-dom-023',
   'tel-dom-024',
   'tel-dom-025',
   'tel-dom-026',
   'tel-dom-027',
   'tel-dom-028',
   'tel-dom-029',
   'tel-dom-030',
   'tel-tel-031',
   'tel-tel-032',
   'tel-tel-033',
   'tel-tel-034',
   'tel-tel-035',
   'tel-tel-036',
   'tel-tel-037',
   'tel-tel-038',
   'tel-tel-039',
   'tel-tel-040',
   'tel-dig-041',
   'tel-dig-042',
   'tel-dig-043',
   'tel-dig-044',
   'tel-dig-045',
   'tel-dig-046',
   'ref-storage-snv3sm3-1t0',
   'ref-storage-mz-v9p1t0bw',
   'tel-dig-047',
   'tel-dig-048',
   'tel-dig-049',
   'tel-dig-050'
 );

-- 3. Upsert Warehouse for Demo Stock
insert into public.warehouses (code, name, city, country_code, is_active)
values ('NODRIA-DEMO', 'NODRIA · Tienda Principal y Logística', 'Madrid', 'ES', true)
on conflict (code) do update set
  name = excluded.name,
  city = excluded.city,
  country_code = excluded.country_code,
  is_active = true;

-- 4. Upsert Telecommunications Products, Variants, Specifications, and Stock
do $telecom_migration$
declare
  v_warehouse_id uuid;
  v_available integer;
begin
  select id into v_warehouse_id from public.warehouses where code = 'NODRIA-DEMO';

  -- Product: NDR-TEL-INF-001 (Rack Mural 19" 9U Profundidad 600mm Puerta de Cristal)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-inf-001', 'rack-mural-19-9u-profundidad-600mm-puerta-cristal-legrand', 'NDR-TEL-INF-001', 'Rack Mural 19" 9U Profundidad 600mm Puerta de Cristal', 'Legrand',
    'Legrand · modelo 446209. Armario mural de 19 pulgadas para salas técnicas e instalaciones de cableado estructurado secundario.', 'Legrand · modelo 446209. Armario mural de 19 pulgadas para salas técnicas e instalaciones de cableado estructurado secundario.',
    'https://img.pccomponentes.com/articles/32/324884/184-rack-mural-19-9u-600mm.jpg', 'Rack mural de 19 pulgadas 9U Legrand con puerta de cristal templado', null,
    4.8, 16, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-inf-001', 'infraestructuras-telecomunicaciones')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-inf-001', 'racks-armarios')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    'e438de5f-f761-4631-8a66-701973245f5a', 'tel-inf-001', 'NDR-TEL-INF-001', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', '446209',
        'brand', 'Legrand',
        'inventory_seeded', true
      )
    ),
    189.50, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, 'e438de5f-f761-4631-8a66-701973245f5a', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = 'e438de5f-f761-4631-8a66-701973245f5a';

  if v_available < 14 then
    perform private.adjust_inventory(
      v_warehouse_id,
      'e438de5f-f761-4631-8a66-701973245f5a',
      14 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-001', 'Factor de forma', 'Rack 19" 9U mural', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-001', 'Dimensiones exteriores', '500 x 600 x 600 mm (Al x An x Pr)', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-001', 'Capacidad de carga', '60 kg de carga estática', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-001', 'Puerta frontal', 'Cristal de seguridad templado reversible con cerradura', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-001', 'Grado de protección', 'IP20 según norma IEC 60529', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-001', 'Entrada de cables', 'Aperturas precortadas en techo y base con cepillo pasacables', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-INF-002 (Armario Rack de Suelo 19" 42U 800x1000mm con Guías de Gestión)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-inf-002', 'armario-rack-suelo-19-42u-800x1000mm-schneider-electric', 'NDR-TEL-INF-002', 'Armario Rack de Suelo 19" 42U 800x1000mm con Guías de Gestión', 'Schneider Electric',
    'Schneider Electric · modelo NSYVD24U84P. Bastidor de alta capacidad para distribución troncal y centros de procesamiento de datos.', 'Schneider Electric · modelo NSYVD24U84P. Bastidor de alta capacidad para distribución troncal y centros de procesamiento de datos.',
    'https://img.pccomponentes.com/articles/28/289124/142-rack-suelo-42u-800x1000.jpg', 'Armario rack de suelo 42U 800x1000mm Schneider Electric para centro de datos', null,
    4.9, 9, true, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-inf-002', 'infraestructuras-telecomunicaciones')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-inf-002', 'racks-armarios')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    '0d53ea09-49a8-434c-8a9d-528b24ed4b7d', 'tel-inf-002', 'NDR-TEL-INF-002', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'NSYVD24U84P',
        'brand', 'Schneider Electric',
        'inventory_seeded', true
      )
    ),
    849.00, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, '0d53ea09-49a8-434c-8a9d-528b24ed4b7d', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = '0d53ea09-49a8-434c-8a9d-528b24ed4b7d';

  if v_available < 8 then
    perform private.adjust_inventory(
      v_warehouse_id,
      '0d53ea09-49a8-434c-8a9d-528b24ed4b7d',
      8 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-002', 'Capacidad', '42U estándar 19 pulgadas', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-002', 'Dimensiones', '2055 x 800 x 1000 mm', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-002', 'Carga admisible', '1000 kg estática / 750 kg dinámica', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-002', 'Ventilación', 'Puertas delantera y trasera microperforadas al 78%', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-002', 'Estructura', 'Acero laminado en frío SPCC de 2,0 mm reforzado', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-002', 'Accesorios incluidos', '2 organizadores verticales laterales y kit de toma de tierra', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-INF-003 (Bobina Cable de Red U/FTP Cat.6A LSZH 500m 500MHz Libre de Halógenos)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-inf-003', 'bobina-cable-red-u-ftp-cat6a-lszh-500m-televes', 'NDR-TEL-INF-003', 'Bobina Cable de Red U/FTP Cat.6A LSZH 500m 500MHz Libre de Halógenos', 'Televes',
    'Televes · modelo 219901. Conductor de cobre puro de 23 AWG para enlaces 10 Gigabit Ethernet con clasificación europea CPR Dca.', 'Televes · modelo 219901. Conductor de cobre puro de 23 AWG para enlaces 10 Gigabit Ethernet con clasificación europea CPR Dca.',
    'https://img.pccomponentes.com/articles/17/178492/123-televes-cable-cat6a-500m.jpg', 'Bobina de cable de red U/FTP Cat.6A LSZH de 500 metros Televes', null,
    4.9, 31, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-inf-003', 'infraestructuras-telecomunicaciones')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-inf-003', 'cableado-estructurado')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    '82187709-26a9-4d05-832a-6a14b4a42b6d', 'tel-inf-003', 'NDR-TEL-INF-003', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', '219901',
        'brand', 'Televes',
        'inventory_seeded', true
      )
    ),
    265.00, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, '82187709-26a9-4d05-832a-6a14b4a42b6d', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = '82187709-26a9-4d05-832a-6a14b4a42b6d';

  if v_available < 22 then
    perform private.adjust_inventory(
      v_warehouse_id,
      '82187709-26a9-4d05-832a-6a14b4a42b6d',
      22 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-003', 'Categoría', 'Cat.6A (Clase EA)', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-003', 'Apantallamiento', 'U/FTP (par a par con lámina de aluminio)', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-003', 'Longitud', '500 metros en bobina de madera', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-003', 'Frecuencia de trabajo', 'Hasta 500 MHz', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-003', 'Cubierta', 'LSZH (Baja emisión de humos, libre de halógenos)', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-003', 'Clase CPR', 'Dca-s2,d2,a1 según EN 50575', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-INF-004 (Bobina Cable de Red S/FTP Cat.7 PIMF 1000MHz 305m Apantallado)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-inf-004', 'bobina-cable-red-s-ftp-cat7-pimf-1000mhz-305m-televes', 'NDR-TEL-INF-004', 'Bobina Cable de Red S/FTP Cat.7 PIMF 1000MHz 305m Apantallado', 'Televes',
    'Televes · modelo 219910. Doble blindaje para instalaciones con alta inmunidad a perturbaciones electromagnéticas y entornos industriales.', 'Televes · modelo 219910. Doble blindaje para instalaciones con alta inmunidad a perturbaciones electromagnéticas y entornos industriales.',
    'https://img.pccomponentes.com/articles/21/214589/115-televes-cat7-sftp-305m.jpg', 'Bobina de cable de par trenzado Cat.7 S/FTP Televes 305m', null,
    4.7, 19, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-inf-004', 'infraestructuras-telecomunicaciones')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-inf-004', 'cableado-estructurado')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    '0836336a-0e7b-4d9c-85ae-fa3acce9fde4', 'tel-inf-004', 'NDR-TEL-INF-004', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', '219910',
        'brand', 'Televes',
        'inventory_seeded', true
      )
    ),
    215.00, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, '0836336a-0e7b-4d9c-85ae-fa3acce9fde4', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = '0836336a-0e7b-4d9c-85ae-fa3acce9fde4';

  if v_available < 18 then
    perform private.adjust_inventory(
      v_warehouse_id,
      '0836336a-0e7b-4d9c-85ae-fa3acce9fde4',
      18 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-004', 'Categoría de transmisión', 'Cat.7 (Clase F)', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-004', 'Estructura de blindaje', 'S/FTP (Malla global de cobre estañado + pares PIMF)', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-004', 'Frecuencia de corte', '1000 MHz garantizados', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-004', 'Calibre del conductor', 'Cobre sólido 23 AWG (0,57 mm)', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-004', 'Presentación', 'Carrete dispensador de 305 metros', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-004', 'Velocidad nominal', '10 Gbps a 100 metros / 40 Gbps a distancias cortas', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-INF-005 (Manguera Fibra Óptica Preconectorizada Monomodo OS2 12 Fibras LC-LC 50m)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-inf-005', 'manguera-fibra-optica-preconectorizada-monomodo-os2-12-fibras-lc-50m-legrand', 'NDR-TEL-INF-005', 'Manguera Fibra Óptica Preconectorizada Monomodo OS2 12 Fibras LC-LC 50m', 'Legrand',
    'Legrand · modelo 032585. Enlace troncal preconectorizado con funda de tracción de protección para despliegue rápido entre repartidores.', 'Legrand · modelo 032585. Enlace troncal preconectorizado con funda de tracción de protección para despliegue rápido entre repartidores.',
    'https://img.pccomponentes.com/articles/24/249102/165-fibra-os2-12-fibras-50m.jpg', 'Manguera troncal de fibra óptica monomodo OS2 12 fibras preconectorizada Legrand', null,
    4.8, 12, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-inf-005', 'infraestructuras-telecomunicaciones')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-inf-005', 'fibra-optica')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    '186020a9-76e7-47db-82dd-3f63b8b28b7d', 'tel-inf-005', 'NDR-TEL-INF-005', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', '032585',
        'brand', 'Legrand',
        'inventory_seeded', true
      )
    ),
    142.90, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, '186020a9-76e7-47db-82dd-3f63b8b28b7d', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = '186020a9-76e7-47db-82dd-3f63b8b28b7d';

  if v_available < 16 then
    perform private.adjust_inventory(
      v_warehouse_id,
      '186020a9-76e7-47db-82dd-3f63b8b28b7d',
      16 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-005', 'Tipo de fibra', 'Monomodo OS2 9/125 µm (G.657.A2 inmune a curvaturas)', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-005', 'Número de fibras', '12 fibras ópticas en tubo central con gel antihumedad', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-005', 'Conectores terminales', '12x LC/UPC dúplex con férula cerámica de circonio', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-005', 'Pérdida de inserción', 'Menor a 0,20 dB por conector verificado individualmente', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-005', 'Resistencia mecánica', 'Cubierta armada dieléctrica antiroedores con tracción máx. 800 N', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-005', 'Longitud de tendido', '50 metros útiles', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-INF-006 (Bandeja Distribuidora de Fibra Óptica 19" 1U 24 Puertos SC/APC con Pigtails)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-inf-006', 'bandeja-distribuidora-fibra-optica-19-1u-24-puertos-sc-apc-televes', 'NDR-TEL-INF-006', 'Bandeja Distribuidora de Fibra Óptica 19" 1U 24 Puertos SC/APC con Pigtails', 'Televes',
    'Televes · modelo 233003. Panel repartidor óptico telescópico con organizador de fusiones y pigtails monomodo montados de fábrica.', 'Televes · modelo 233003. Panel repartidor óptico telescópico con organizador de fusiones y pigtails monomodo montados de fábrica.',
    'https://img.pccomponentes.com/articles/26/264190/134-bandeja-fibra-24-sc-apc.jpg', 'Bandeja telescópica de fibra óptica 19 pulgadas 24 puertos SC/APC Televes', null,
    4.9, 23, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-inf-006', 'infraestructuras-telecomunicaciones')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-inf-006', 'fibra-optica')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    '86d6bf44-8867-4ac2-8a2d-ddbeebdd98e5', 'tel-inf-006', 'NDR-TEL-INF-006', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', '233003',
        'brand', 'Televes',
        'inventory_seeded', true
      )
    ),
    118.00, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, '86d6bf44-8867-4ac2-8a2d-ddbeebdd98e5', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = '86d6bf44-8867-4ac2-8a2d-ddbeebdd98e5';

  if v_available < 19 then
    perform private.adjust_inventory(
      v_warehouse_id,
      '86d6bf44-8867-4ac2-8a2d-ddbeebdd98e5',
      19 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-006', 'Formato de montaje', 'Rack 19 pulgadas 1U telescópica con guías deslizantes', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-006', 'Capacidad de conexión', '24 adaptadores ópticos simples SC/APC con obturador', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-006', 'Accesorios incluidos', '24 pigtails monomodo G.657.A2 y 2 casetes de empalme para 24 fusiones', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-006', 'Entrada posterior', '4 prensaestopas PG13.5 / PG16 para amarre de mangueras', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-006', 'Material de fabricación', 'Chapa de acero galvanizado con recubrimiento epoxi negro', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-006', 'Dimensiones', '483 x 240 x 44 mm', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-INF-007 (Panel de Parcheo 19" 24 Puertos Cat.6A FTP 1U con Guía Trasera)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-inf-007', 'panel-parcheo-19-24-puertos-cat6a-ftp-1u-schneider-electric', 'NDR-TEL-INF-007', 'Panel de Parcheo 19" 24 Puertos Cat.6A FTP 1U con Guía Trasera', 'Schneider Electric',
    'Schneider Electric · modelo VDIB17726B12. Panel de terminación metálico con tomas Keystone blindadas y barra de alivio de tensión mecánica.', 'Schneider Electric · modelo VDIB17726B12. Panel de terminación metálico con tomas Keystone blindadas y barra de alivio de tensión mecánica.',
    'https://img.pccomponentes.com/articles/19/194301/178-patch-panel-24-cat6a.jpg', 'Panel de parcheo 24 puertos Cat.6A FTP 1U Schneider Electric con barra trasera', null,
    4.8, 35, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-inf-007', 'infraestructuras-telecomunicaciones')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-inf-007', 'paneles-parcheo')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    'ab24113e-a593-4489-8ae3-e65823b163d2', 'tel-inf-007', 'NDR-TEL-INF-007', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'VDIB17726B12',
        'brand', 'Schneider Electric',
        'inventory_seeded', true
      )
    ),
    82.50, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, 'ab24113e-a593-4489-8ae3-e65823b163d2', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = 'ab24113e-a593-4489-8ae3-e65823b163d2';

  if v_available < 25 then
    perform private.adjust_inventory(
      v_warehouse_id,
      'ab24113e-a593-4489-8ae3-e65823b163d2',
      25 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-007', 'Puertos RJ45', '24 puertos con contactos bañados en oro de 50 µm', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-007', 'Rendimiento', 'Componente certificado Cat.6A hasta 10 Gbit/s', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-007', 'Blindaje', 'Carcasa de zamak con puesta a tierra automática centralizada', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-007', 'Sistema de crimpado', 'Conexión rápida sin herramientas tipo Keystone Toolless', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-007', 'Gestión de cables', 'Bandeja trasera integrada con abrazaderas de fijación', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-007', 'Etiquetado', 'Campos identificadores transparentes numerados de 1 a 24', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-INF-008 (Organizador de Cables Horizontal 19" 1U con Tapa Frontal y 5 Anillas)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-inf-008', 'organizador-cables-horizontal-19-1u-legrand', 'NDR-TEL-INF-008', 'Organizador de Cables Horizontal 19" 1U con Tapa Frontal y 5 Anillas', 'Legrand',
    'Legrand · modelo 646520. Accesorio de ordenación de latiguillos en armarios rack de comunicaciones con paso ranurado trasero.', 'Legrand · modelo 646520. Accesorio de ordenación de latiguillos en armarios rack de comunicaciones con paso ranurado trasero.',
    'https://img.pccomponentes.com/articles/22/227189/109-organizador-cables-1u.jpg', 'Guía horizontal pasahilos de 19 pulgadas 1U Legrand con tapa', null,
    4.6, 42, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-inf-008', 'infraestructuras-telecomunicaciones')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-inf-008', 'paneles-parcheo')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    '9a147de6-e769-4667-8a2b-95c53f5159f8', 'tel-inf-008', 'NDR-TEL-INF-008', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', '646520',
        'brand', 'Legrand',
        'inventory_seeded', true
      )
    ),
    24.90, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, '9a147de6-e769-4667-8a2b-95c53f5159f8', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = '9a147de6-e769-4667-8a2b-95c53f5159f8';

  if v_available < 35 then
    perform private.adjust_inventory(
      v_warehouse_id,
      '9a147de6-e769-4667-8a2b-95c53f5159f8',
      35 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-008', 'Factor de forma', 'Estándar 19 pulgadas 1U de altura', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-008', 'Anillas pasacables', '5 anillas de polímero técnico redondeadas para proteger el radio de curvatura', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-008', 'Tapa delantera', 'Tapa desmontable a presión abatible arriba y abajo', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-008', 'Orificios posteriores', 'Ranuras protegidas con rebordes no cortantes para paso de mazo', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-008', 'Material', 'Chasis metálico pintado en negro grafito RAL 9005', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-008', 'Fijación', 'Incluye 4 tuercas enjauladas y tornillos M6', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-INF-009 (Certificador de Redes de Cobre Cat.6A/Cat.8 Fluke DSX-602 INTL)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-inf-009', 'certificador-redes-cobre-cat6a-cat8-fluke-dsx-602-intl', 'NDR-TEL-INF-009', 'Certificador de Redes de Cobre Cat.6A/Cat.8 Fluke DSX-602 INTL', 'Fluke Networks',
    'Fluke Networks · modelo DSX-602-INTL. Equipo de certificación profesional para la comprobación y homologación de enlaces Clase EA / Cat.6A.', 'Fluke Networks · modelo DSX-602-INTL. Equipo de certificación profesional para la comprobación y homologación de enlaces Clase EA / Cat.6A.',
    'https://img.pccomponentes.com/articles/31/319456/156-fluke-dsx-602-certificador.jpg', 'Certificador de cableado estructurado Fluke Networks DSX-602 INTL', null,
    5, 7, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-inf-009', 'infraestructuras-telecomunicaciones')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-inf-009', 'herramientas-certificacion')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    '4e7a9fbb-7620-4a03-8f43-36046fb4e5ae', 'tel-inf-009', 'NDR-TEL-INF-009', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'DSX-602-INTL',
        'brand', 'Fluke Networks',
        'inventory_seeded', true
      )
    ),
    1450.00, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, '4e7a9fbb-7620-4a03-8f43-36046fb4e5ae', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = '4e7a9fbb-7620-4a03-8f43-36046fb4e5ae';

  if v_available < 8 then
    perform private.adjust_inventory(
      v_warehouse_id,
      '4e7a9fbb-7620-4a03-8f43-36046fb4e5ae',
      8 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-009', 'Rango de frecuencia', 'Hasta 500 MHz con adaptadores de canal y enlace permanente', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-009', 'Velocidad de test', 'Autotest Cat.6A en 10 segundos con diagnóstico completo', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-009', 'Mediciones clave', 'Mapa de hilos, longitud, retardo, NEXT, PS-NEXT, Return Loss y ACR-F', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-009', 'Interfaz de usuario', 'Pantalla táctil LCD capacitiva con interfaz de gestión ProjX', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-009', 'Plataforma de informes', 'Compatible con software de gestión LinkWare para generación de actas', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-009', 'Alimentación', 'Batería de iones de litio recargable con autonomía de 8 horas de trabajo', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-INF-010 (Fusionadora de Fibra Óptica por Alineación de Núcleo 6 Motores)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-inf-010', 'fusionadora-fibra-optica-alineacion-nucleo-6-motores-televes', 'NDR-TEL-INF-010', 'Fusionadora de Fibra Óptica por Alineación de Núcleo 6 Motores', 'Televes',
    'Televes · modelo 232103. Equipo de empalme por arco voltaico con detección automática de tipo de fibra y horno de retracción ultrarrápido.', 'Televes · modelo 232103. Equipo de empalme por arco voltaico con detección automática de tipo de fibra y horno de retracción ultrarrápido.',
    'https://img.pccomponentes.com/articles/33/338910/188-televes-fusionadora-fibra.jpg', 'Empalmadora por fusión de fibra óptica Televes alineación por núcleo 6 motores', null,
    4.9, 11, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-inf-010', 'infraestructuras-telecomunicaciones')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-inf-010', 'herramientas-certificacion')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    'c8be0b5b-237f-4d11-8aa3-57938dd12046', 'tel-inf-010', 'NDR-TEL-INF-010', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', '232103',
        'brand', 'Televes',
        'inventory_seeded', true
      )
    ),
    1290.00, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, 'c8be0b5b-237f-4d11-8aa3-57938dd12046', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = 'c8be0b5b-237f-4d11-8aa3-57938dd12046';

  if v_available < 9 then
    perform private.adjust_inventory(
      v_warehouse_id,
      'c8be0b5b-237f-4d11-8aa3-57938dd12046',
      9 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-010', 'Sistema de alineación', 'Alineación precisa por núcleo con 6 micromotores independientes', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-010', 'Tipos de fibra', 'SM (G.652/G.657), MM (G.651), DS (G.653) y NZDS (G.655)', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-010', 'Pérdida típica de empalme', '0,02 dB en fibra monomodo (SM) y 0,01 dB en multimodo (MM)', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-010', 'Tiempo de ciclo', 'Fusión en 6 segundos y horneado de canutillo termorretráctil en 15 segundos', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-010', 'Pantalla integrada', 'Monitor táctil LCD de 5" con aumento de 380X en ejes X/Y', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-inf-010', 'Capacidad de batería', 'Batería de 5200 mAh para más de 300 ciclos completos de fusión', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-EQT-011 (Switch Gestionable L3 24 Puertos Gigabit PoE+ y 2 SFP+ 10G UniFi Pro)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-eqt-011', 'switch-gestionable-l3-24-puertos-gigabit-poe-2-sfp-10g-unifi-pro-ubiquiti', 'NDR-TEL-EQT-011', 'Switch Gestionable L3 24 Puertos Gigabit PoE+ y 2 SFP+ 10G UniFi Pro', 'Ubiquiti',
    'Ubiquiti · modelo USW-Pro-24-POE. Conmutador empresarial de capa 3 con 400W de entrega PoE y conectividad óptica 10 Gigabit.', 'Ubiquiti · modelo USW-Pro-24-POE. Conmutador empresarial de capa 3 con 400W de entrega PoE y conectividad óptica 10 Gigabit.',
    'https://img.pccomponentes.com/articles/29/296541/143-ubiquiti-unifi-pro-24-poe.jpg', 'Switch gestionable capa 3 Ubiquiti UniFi Pro 24 PoE con enlaces 10G SFP+', null,
    4.9, 38, true, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-eqt-011', 'equipos-sistemas-telecomunicaciones')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-eqt-011', 'switches-gestionables')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    '92397db0-8f52-45ec-8f2e-6bcd44806678', 'tel-eqt-011', 'NDR-TEL-EQT-011', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'USW-Pro-24-POE',
        'brand', 'Ubiquiti',
        'inventory_seeded', true
      )
    ),
    689.00, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, '92397db0-8f52-45ec-8f2e-6bcd44806678', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = '92397db0-8f52-45ec-8f2e-6bcd44806678';

  if v_available < 15 then
    perform private.adjust_inventory(
      v_warehouse_id,
      '92397db0-8f52-45ec-8f2e-6bcd44806678',
      15 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-011', 'Configuración de puertos', '16x GbE PoE+ (30W), 8x GbE PoE++ (60W) y 2x SFP+ 10 Gbps', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-011', 'Presupuesto PoE total', '400 W con monitorización y reinicio individual por puerto', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-011', 'Capacidad de conmutación', '88 Gbps / Tasa de reenvío de 65,472 Mpps', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-011', 'Funcionalidades L3', 'Enrutamiento inter-VLAN, rutas estáticas y servidor DHCP relay', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-011', 'Pantalla táctil LCM', 'Display a color de 1,3" con visualización de estado y realidad aumentada', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-011', 'Alimentación redundante', 'Entrada continua SmartPower USP-RPS de respaldo', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-EQT-012 (Switch Gestionable 48 Puertos Gigabit PoE+ y 4 SFP+ Cisco Catalyst 1000)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-eqt-012', 'switch-gestionable-48-puertos-gigabit-poe-4-sfp-cisco-catalyst-1000', 'NDR-TEL-EQT-012', 'Switch Gestionable 48 Puertos Gigabit PoE+ y 4 SFP+ Cisco Catalyst 1000', 'Cisco',
    'Cisco · modelo C1000-48P-4X-L. Rendimiento fiable y seguro bajo Cisco IOS para infraestructura corporativa de alta densidad.', 'Cisco · modelo C1000-48P-4X-L. Rendimiento fiable y seguro bajo Cisco IOS para infraestructura corporativa de alta densidad.',
    'https://img.pccomponentes.com/articles/30/301245/167-cisco-catalyst-1000-48p.jpg', 'Switch empresarial Cisco Catalyst 1000 48 puertos PoE+ y 4 SFP+', null,
    4.9, 14, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-eqt-012', 'equipos-sistemas-telecomunicaciones')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-eqt-012', 'switches-gestionables')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    '955ada8a-eff6-4c20-85ff-ff4f14e29421', 'tel-eqt-012', 'NDR-TEL-EQT-012', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'C1000-48P-4X-L',
        'brand', 'Cisco',
        'inventory_seeded', true
      )
    ),
    1150.00, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, '955ada8a-eff6-4c20-85ff-ff4f14e29421', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = '955ada8a-eff6-4c20-85ff-ff4f14e29421';

  if v_available < 9 then
    perform private.adjust_inventory(
      v_warehouse_id,
      '955ada8a-eff6-4c20-85ff-ff4f14e29421',
      9 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-012', 'Puertos de red', '48x 10/100/1000BASE-T RJ45 PoE+ 802.3at', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-012', 'Puertos de subida uplink', '4x 10G SFP+ ópticos fijos de alta velocidad', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-012', 'Capacidad PoE disponible', '370 W', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-012', 'Seguridad de acceso', 'Autenticación 802.1X, Private VLAN, Port Security y protección BPDU', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-012', 'Gestión y control', 'Línea de comandos CLI Cisco IOS, interfaz Web intuitiva y gestión por Bluetooth', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-012', 'Rendimiento de conmutación', '176 Gbps sin bloqueos', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-EQT-013 (Router de Agregación de Borde y Firewall UniFi Dream Machine SE)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-eqt-013', 'router-agregacion-borde-firewall-unifi-dream-machine-se-ubiquiti', 'NDR-TEL-EQT-013', 'Router de Agregación de Borde y Firewall UniFi Dream Machine SE', 'Ubiquiti',
    'Ubiquiti · modelo UDM-SE. Pasarela de seguridad integral para empresas con puerto WAN 2.5 GbE, conmutador PoE de 8 puertos y motor IDS/IPS.', 'Ubiquiti · modelo UDM-SE. Pasarela de seguridad integral para empresas con puerto WAN 2.5 GbE, conmutador PoE de 8 puertos y motor IDS/IPS.',
    'https://img.pccomponentes.com/articles/32/321876/155-ubiquiti-udm-se-pro.jpg', 'Router de borde y servidor de aplicaciones UniFi Dream Machine Special Edition', null,
    4.9, 47, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-eqt-013', 'equipos-sistemas-telecomunicaciones')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-eqt-013', 'routers-borde')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    'ce055f5b-9c21-45bb-82dc-abe66c462711', 'tel-eqt-013', 'NDR-TEL-EQT-013', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'UDM-SE',
        'brand', 'Ubiquiti',
        'inventory_seeded', true
      )
    ),
    519.00, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, 'ce055f5b-9c21-45bb-82dc-abe66c462711', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = 'ce055f5b-9c21-45bb-82dc-abe66c462711';

  if v_available < 12 then
    perform private.adjust_inventory(
      v_warehouse_id,
      'ce055f5b-9c21-45bb-82dc-abe66c462711',
      12 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-013', 'Conectividad WAN', '1x 2.5GbE RJ45 + 1x 10G SFP+ con balanceo de carga y failover', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-013', 'Conectividad LAN', '8x GbE RJ45 (6x PoE 802.3af, 2x PoE+ 802.3at) + 1x 10G SFP+', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-013', 'Rendimiento IPS/IDS', '3,5 Gbps de inspección profunda de amenazas sin estrangulamiento', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-013', 'Almacenamiento interno', 'SSD de 128 GB integrado + bahía SATA para disco duro de 3,5"', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-013', 'Ecosistema software', 'Controlador UniFi Network, Protect (CCTV), Access y Talk preinstalados', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-013', 'Formato de montaje', 'Chasis metálico para rack 19" de 1U con pantalla táctil integrada', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-EQT-014 (Router de Borde Multi-WAN Gigabit RouterBOARD RB5009UG+S+IN)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-eqt-014', 'router-borde-multi-wan-gigabit-routerboard-rb5009ug-s-in-mikrotik', 'NDR-TEL-EQT-014', 'Router de Borde Multi-WAN Gigabit RouterBOARD RB5009UG+S+IN', 'MikroTik',
    'MikroTik · modelo RB5009UG+S+IN. Router ultra compacto para proveedores y empresas con puerto 2.5G, puerto 10G SFP+ y potente procesador ARM.', 'MikroTik · modelo RB5009UG+S+IN. Router ultra compacto para proveedores y empresas con puerto 2.5G, puerto 10G SFP+ y potente procesador ARM.',
    'https://img.pccomponentes.com/articles/31/312098/129-mikrotik-rb5009ug-sin.jpg', 'Router de alta densidad MikroTik RB5009UG+S+IN con RouterOS', null,
    4.8, 29, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-eqt-014', 'equipos-sistemas-telecomunicaciones')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-eqt-014', 'routers-borde')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    '3efeb581-e2cb-47b9-8cf9-98f159c0d493', 'tel-eqt-014', 'NDR-TEL-EQT-014', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'RB5009UG+S+IN',
        'brand', 'MikroTik',
        'inventory_seeded', true
      )
    ),
    219.00, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, '3efeb581-e2cb-47b9-8cf9-98f159c0d493', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = '3efeb581-e2cb-47b9-8cf9-98f159c0d493';

  if v_available < 20 then
    perform private.adjust_inventory(
      v_warehouse_id,
      '3efeb581-e2cb-47b9-8cf9-98f159c0d493',
      20 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-014', 'Arquitectura CPU', 'Marvell Armada 88F7040 Quad-Core a 1,4 GHz', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-014', 'Puertos físicos', '7x 1 GbE RJ45, 1x 2.5 GbE RJ45 y 1x 10G SFP+', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-014', 'Memoria de sistema', '1 GB RAM DDR4 + 1 GB memoria Flash NAND', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-014', 'Sistema operativo', 'RouterOS v7 con licencia nivel 5 completa (BGP, OSPF, WireGuard)', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-014', 'Opciones de energía', 'Triple redundancia: PoE-In (802.3af/at), conector Jack DC y regleta de bornas', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-014', 'Refrigeración', 'Disipación pasiva silenciosa mediante chasis de fundición de aluminio', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-EQT-015 (Punto de Acceso Wi-Fi 7 Tri-Banda Empresarial UniFi U7 Pro)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-eqt-015', 'punto-acceso-wifi-7-tri-banda-empresarial-unifi-u7-pro-ubiquiti', 'NDR-TEL-EQT-015', 'Punto de Acceso Wi-Fi 7 Tri-Banda Empresarial UniFi U7 Pro', 'Ubiquiti',
    'Ubiquiti · modelo U7-Pro. Conectividad inalámbrica de próxima generación en la banda de 6 GHz con ancho de canal de 320 MHz y uplink 2.5G.', 'Ubiquiti · modelo U7-Pro. Conectividad inalámbrica de próxima generación en la banda de 6 GHz con ancho de canal de 320 MHz y uplink 2.5G.',
    'https://img.pccomponentes.com/articles/35/354129/189-ubiquiti-u7-pro-wifi7.jpg', 'Punto de acceso inalámbrico Wi-Fi 7 UniFi U7 Pro Ubiquiti', null,
    4.9, 33, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-eqt-015', 'equipos-sistemas-telecomunicaciones')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-eqt-015', 'puntos-acceso-wifi')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    '0ae6f135-40fc-4fc7-8838-01d416da0fa4', 'tel-eqt-015', 'NDR-TEL-EQT-015', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'U7-Pro',
        'brand', 'Ubiquiti',
        'inventory_seeded', true
      )
    ),
    198.00, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, '0ae6f135-40fc-4fc7-8838-01d416da0fa4', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = '0ae6f135-40fc-4fc7-8838-01d416da0fa4';

  if v_available < 24 then
    perform private.adjust_inventory(
      v_warehouse_id,
      '0ae6f135-40fc-4fc7-8838-01d416da0fa4',
      24 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-015', 'Estándar inalámbrico', 'Wi-Fi 7 (802.11be) tri-banda simultánea', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-015', 'Bandas de operación', '6 GHz (2x2 MIMO), 5 GHz (2x2 MIMO) y 2,4 GHz (2x2 MIMO)', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-015', 'Tasa máxima teórica', 'Hasta 5765 Mbps (6 GHz) + 2882 Mbps (5 GHz) + 688 Mbps (2,4 GHz)', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-015', 'Puerto de conexión', '1x 2.5 Gigabit Ethernet con alimentación PoE+ 802.3at', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-015', 'Capacidad de usuarios', 'Más de 300 clientes concurrentes en entornos de alta densidad', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-015', 'Gestión de red', 'Soporte multi-SSID, aislamiento de clientes y portal cautivo de invitados', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-EQT-016 (Punto de Acceso Wi-Fi 6 AX3000 de Techo para Alta Densidad cAP AX)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-eqt-016', 'punto-acceso-wifi-6-ax3000-techo-alta-densidad-cap-ax-mikrotik', 'NDR-TEL-EQT-016', 'Punto de Acceso Wi-Fi 6 AX3000 de Techo para Alta Densidad cAP AX', 'MikroTik',
    'MikroTik · modelo cAPGi-5HaxD2HaxD. Solución de techo para oficinas con soporte CAPsMAN centralizado y puerto PoE-Out secundario.', 'MikroTik · modelo cAPGi-5HaxD2HaxD. Solución de techo para oficinas con soporte CAPsMAN centralizado y puerto PoE-Out secundario.',
    'https://img.pccomponentes.com/articles/33/331287/112-mikrotik-cap-ax-wifi6.jpg', 'Punto de acceso de techo MikroTik cAP ax Wi-Fi 6', null,
    4.7, 17, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-eqt-016', 'equipos-sistemas-telecomunicaciones')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-eqt-016', 'puntos-acceso-wifi')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    'd961830e-c978-4e75-8dbd-3bc34608a861', 'tel-eqt-016', 'NDR-TEL-EQT-016', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'cAPGi-5HaxD2HaxD',
        'brand', 'MikroTik',
        'inventory_seeded', true
      )
    ),
    139.00, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, 'd961830e-c978-4e75-8dbd-3bc34608a861', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = 'd961830e-c978-4e75-8dbd-3bc34608a861';

  if v_available < 18 then
    perform private.adjust_inventory(
      v_warehouse_id,
      'd961830e-c978-4e75-8dbd-3bc34608a861',
      18 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-016', 'Protocolo Wi-Fi', 'Wi-Fi 6 (802.11ax) doble banda con modulación OFDMA', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-016', 'Velocidades de enlace', '574 Mbps en 2,4 GHz y 2402 Mbps en 5 GHz', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-016', 'Puertos cableados', '2x Gigabit Ethernet con PoE-In (PoE 802.3af/at) y PoE-Out pasivo', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-016', 'Potencia de cómputo', 'Procesador Quad-Core IPQ-6010 a 1,8 GHz y 1 GB de memoria RAM', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-016', 'Control centralizado', 'Compatible con CAPsMAN v2 para itinerancia rápida 802.11k/v/r', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-016', 'Diseño', 'Factor de forma circular estético de montaje en techo con antenas omnidireccionales', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-EQT-017 (Transceptor Óptico SFP+ 10G LR Monomodo 1310nm 10km DDM)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-eqt-017', 'transceptor-optico-sfp-10g-lr-monomodo-1310nm-10km-ubiquiti', 'NDR-TEL-EQT-017', 'Transceptor Óptico SFP+ 10G LR Monomodo 1310nm 10km DDM', 'Ubiquiti',
    'Ubiquiti · modelo UACC-OM-SM-10G-D-2. Transceptor óptico de largo alcance para interconexión de conmutadores mediante fibra monomodo.', 'Ubiquiti · modelo UACC-OM-SM-10G-D-2. Transceptor óptico de largo alcance para interconexión de conmutadores mediante fibra monomodo.',
    'https://img.pccomponentes.com/articles/27/276510/144-ubiquiti-sfp-10g-lr.jpg', 'Módulo transceptor óptico SFP+ 10G LR monomodo Ubiquiti', null,
    4.8, 21, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-eqt-017', 'equipos-sistemas-telecomunicaciones')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-eqt-017', 'transceptores-opticos')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    'c46ca2d5-40f5-4dec-8751-16152fb9f326', 'tel-eqt-017', 'NDR-TEL-EQT-017', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'UACC-OM-SM-10G-D-2',
        'brand', 'Ubiquiti',
        'inventory_seeded', true
      )
    ),
    68.00, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, 'c46ca2d5-40f5-4dec-8751-16152fb9f326', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = 'c46ca2d5-40f5-4dec-8751-16152fb9f326';

  if v_available < 25 then
    perform private.adjust_inventory(
      v_warehouse_id,
      'c46ca2d5-40f5-4dec-8751-16152fb9f326',
      25 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-017', 'Formato de interfaz', 'SFP+ (Small Form-factor Pluggable Plus) a 10 Gbps', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-017', 'Medio físico', 'Fibra óptica monomodo (SMF) 9/125 µm', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-017', 'Longitud de onda', '1310 nm con transmisor láser DFB', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-017', 'Distancia máxima', '10 kilómetros sobre fibra OS1/OS2', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-017', 'Conector', 'Dúplex LC con acoplamiento seguro', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-017', 'Telemetría óptica', 'Monitorización de diagnóstico digital (DDM) de potencia y temperatura', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-EQT-018 (Módulo Transceptor SFP+ 10GBASE-T RJ45 Cobre hasta 30m)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-eqt-018', 'modulo-transceptor-sfp-10gbase-t-rj45-cobre-mikrotik', 'NDR-TEL-EQT-018', 'Módulo Transceptor SFP+ 10GBASE-T RJ45 Cobre hasta 30m', 'MikroTik',
    'MikroTik · modelo S+RJ10. Permite conectar latiguillos de cobre RJ45 Cat.6A en ranuras ópticas SFP+ a velocidades multi-gigabit.', 'MikroTik · modelo S+RJ10. Permite conectar latiguillos de cobre RJ45 Cat.6A en ranuras ópticas SFP+ a velocidades multi-gigabit.',
    'https://img.pccomponentes.com/articles/23/238914/177-mikrotik-s-rj10-sfp-cobre.jpg', 'Módulo transceptor RJ45 de cobre 10G SFP+ MikroTik S+RJ10', null,
    4.7, 27, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-eqt-018', 'equipos-sistemas-telecomunicaciones')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-eqt-018', 'transceptores-opticos')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    '8676683e-0f5c-4038-89ca-1dedaaaa1de7', 'tel-eqt-018', 'NDR-TEL-EQT-018', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'S+RJ10',
        'brand', 'MikroTik',
        'inventory_seeded', true
      )
    ),
    59.90, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, '8676683e-0f5c-4038-89ca-1dedaaaa1de7', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = '8676683e-0f5c-4038-89ca-1dedaaaa1de7';

  if v_available < 22 then
    perform private.adjust_inventory(
      v_warehouse_id,
      '8676683e-0f5c-4038-89ca-1dedaaaa1de7',
      22 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-018', 'Velocidades soportadas', 'Autonegociación 10M, 100M, 1G, 2.5G, 5G y 10G', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-018', 'Conector', 'RJ45 hembra estándar blindado', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-018', 'Alcance máximo', 'Hasta 30 metros a 10 Gbps sobre cable Cat.6A/Cat.7', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-018', 'Consumo de energía', '2,7 W máx. con gestión térmica activa', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-018', 'Compatibilidad', 'Compatible con estándar MSA SFF-8431 en cualquier puerto SFP+', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-018', 'Rango de temperatura', '0°C a +70°C con sensor DDM reportado por software', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-EQT-019 (Central Amplificadora Programable de Cabecera Avant X Pro UHF/VHF/FM)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-eqt-019', 'central-amplificadora-programable-cabecera-avant-x-pro-televes', 'NDR-TEL-EQT-019', 'Central Amplificadora Programable de Cabecera Avant X Pro UHF/VHF/FM', 'Televes',
    'Televes · modelo 532121. Cabecera digital de amplificación para edificios de viviendas y comunidades con filtrado automático 5G LTE700.', 'Televes · modelo 532121. Cabecera digital de amplificación para edificios de viviendas y comunidades con filtrado automático 5G LTE700.',
    'https://img.pccomponentes.com/articles/25/258901/192-televes-avant-x-pro.jpg', 'Central programable de amplificación de cabecera Avant X Pro Televes', null,
    4.9, 18, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-eqt-019', 'equipos-sistemas-telecomunicaciones')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-eqt-019', 'cabeceras-rf-tv')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    '226a690d-b19e-4197-86fc-cfb05e980d1e', 'tel-eqt-019', 'NDR-TEL-EQT-019', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', '532121',
        'brand', 'Televes',
        'inventory_seeded', true
      )
    ),
    295.00, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, '226a690d-b19e-4197-86fc-cfb05e980d1e', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = '226a690d-b19e-4197-86fc-cfb05e980d1e';

  if v_available < 14 then
    perform private.adjust_inventory(
      v_warehouse_id,
      '226a690d-b19e-4197-86fc-cfb05e980d1e',
      14 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-019', 'Entradas de señal', '4x UHF/VHF configurables, 1x FM y 1x entrada auxiliar de banda', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-019', 'Filtrado digital', '32 filtros digitales programables de alta selectividad (>35 dB a 1 MHz)', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-019', 'Ajuste de ganancia', 'Ecualización automática en tiempo real con control automático de ganancia (CAG)', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-019', 'Nivel de salida máximo', '122 dBµV en UHF con distorsión reducida', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-019', 'Rechazo de interferencias', 'Filtro automático de rechazo LTE700 (segundo dividendo digital)', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-019', 'Programación', 'Autoprogramación con botón único o app móvil ASuite mediante USB-OTG', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-EQT-020 (Transmodulador Óptico de Cabecera DVB-S2 a DVB-T/C con Ranura CI)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-eqt-020', 'transmodulador-optico-cabecera-dvb-s2-a-dvb-t-televes', 'NDR-TEL-EQT-020', 'Transmodulador Óptico de Cabecera DVB-S2 a DVB-T/C con Ranura CI', 'Televes',
    'Televes · modelo 565101. Módulo de cabecera profesional para convertir canales de satélite a multiplex TDT distribuidos sobre cable coaxial.', 'Televes · modelo 565101. Módulo de cabecera profesional para convertir canales de satélite a multiplex TDT distribuidos sobre cable coaxial.',
    'https://img.pccomponentes.com/articles/29/291034/163-televes-transmodulador-sat-tdt.jpg', 'Transmodulador satélite a TDT Televes T.0X con ranura Common Interface', null,
    4.8, 8, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-eqt-020', 'equipos-sistemas-telecomunicaciones')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-eqt-020', 'cabeceras-rf-tv')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    '91857bc3-05a0-40fc-81f7-66212bacbbb4', 'tel-eqt-020', 'NDR-TEL-EQT-020', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', '565101',
        'brand', 'Televes',
        'inventory_seeded', true
      )
    ),
    479.00, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, '91857bc3-05a0-40fc-81f7-66212bacbbb4', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = '91857bc3-05a0-40fc-81f7-66212bacbbb4';

  if v_available < 10 then
    perform private.adjust_inventory(
      v_warehouse_id,
      '91857bc3-05a0-40fc-81f7-66212bacbbb4',
      10 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-020', 'Señal de entrada', 'Satélite DVB-S / DVB-S2 (QPSK / 8PSK) con alimentación LNB', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-020', 'Señal de modulación', 'Salida COFDM (DVB-T) o QAM (DVB-C) seleccionable', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-020', 'Desencriptación', 'Ranura Common Interface (CI) para módulos CAM condicionales', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-020', 'Edición de transporte', 'Remultiplexación de servicios, regeneración de tablas PSI/SI y filtrado PID', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-020', 'Gestión remota', 'Servidor web integrado para monitorización IP y control por Ethernet', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-eqt-020', 'Formato mecánico', 'Módulo para bastidor T.0X con blindaje metálico de alta densidad', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-DOM-021 (Hub Domótico Multiprotocolo Zigbee 3.0, Matter y Thread Aqara Hub M3)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-dom-021', 'hub-domotico-multiprotocolo-zigbee-matter-thread-aqara-m3', 'NDR-TEL-DOM-021', 'Hub Domótico Multiprotocolo Zigbee 3.0, Matter y Thread Aqara Hub M3', 'Aqara',
    'Aqara · modelo HM-G01E. Pasarela central de automatización con compatibilidad total con Apple Home, Google Home y ejecución de escenas en local.', 'Aqara · modelo HM-G01E. Pasarela central de automatización con compatibilidad total con Apple Home, Google Home y ejecución de escenas en local.',
    'https://img.pccomponentes.com/articles/36/364501/145-aqara-hub-m3-matter.jpg', 'Controlador domótico central Aqara Hub M3 con Matter y Thread', null,
    4.9, 41, true, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-dom-021', 'domotica-hogar-digital')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-dom-021', 'pasarelas-controladores')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    '8e3d3800-7e48-43bb-82f1-f72f7fdf9111', 'tel-dom-021', 'NDR-TEL-DOM-021', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'HM-G01E',
        'brand', 'Aqara',
        'inventory_seeded', true
      )
    ),
    129.99, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, '8e3d3800-7e48-43bb-82f1-f72f7fdf9111', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = '8e3d3800-7e48-43bb-82f1-f72f7fdf9111';

  if v_available < 20 then
    perform private.adjust_inventory(
      v_warehouse_id,
      '8e3d3800-7e48-43bb-82f1-f72f7fdf9111',
      20 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-021', 'Protocolos de comunicación', 'Matter Controller, Thread Border Router, Zigbee 3.0, Bluetooth 5.1 e IR', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-021', 'Alimentación eléctrica', 'PoE (802.3af) por cable de red o puerto USB-C (5V 2A)', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-021', 'Conectividad de red', 'Puerto Ethernet RJ45 10/100 Mbps y Wi-Fi doble banda 2,4/5 GHz', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-021', 'Emisor infrarrojos', 'Transmisor IR omnidireccional 360° para climatizadores y equipos AV', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-021', 'Sirena incorporada', 'Altavoz acústico de 95 dB para alarmas de intrusión o avisos acústicos', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-021', 'Seguridad y privacidad', 'Almacenamiento y procesamiento de automatizaciones de forma local y cifrada', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-DOM-022 (Controlador Domótico Z-Wave Plus y Zigbee Home Center 3 Lite)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-dom-022', 'controlador-domotico-z-wave-plus-zigbee-home-center-3-lite-fibaro', 'NDR-TEL-DOM-022', 'Controlador Domótico Z-Wave Plus y Zigbee Home Center 3 Lite', 'Fibaro',
    'Fibaro · modelo FGHC3L-001. Sistema de control para instalaciones residenciales con potente motor de escenas programables en bloques y lenguaje LUA.', 'Fibaro · modelo FGHC3L-001. Sistema de control para instalaciones residenciales con potente motor de escenas programables en bloques y lenguaje LUA.',
    'https://img.pccomponentes.com/articles/28/284102/168-fibaro-home-center-3-lite.jpg', 'Pasarela domótica Fibaro Home Center 3 Lite Z-Wave Plus', null,
    4.7, 15, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-dom-022', 'domotica-hogar-digital')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-dom-022', 'pasarelas-controladores')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    '8b176bee-d03e-40f5-85fa-73a54713bf70', 'tel-dom-022', 'NDR-TEL-DOM-022', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'FGHC3L-001',
        'brand', 'Fibaro',
        'inventory_seeded', true
      )
    ),
    139.00, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, '8b176bee-d03e-40f5-85fa-73a54713bf70', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = '8b176bee-d03e-40f5-85fa-73a54713bf70';

  if v_available < 15 then
    perform private.adjust_inventory(
      v_warehouse_id,
      '8b176bee-d03e-40f5-85fa-73a54713bf70',
      15 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-022', 'Tecnología de radio', 'Z-Wave Plus Serie 700 de largo alcance y bajo consumo', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-022', 'Capacidad del sistema', 'Soporta hasta 40 dispositivos domóticos Z-Wave y 20 escenas simultáneas', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-022', 'Hardware interno', 'Procesador Cortex A7 monocore a 900 MHz con 512 MB de memoria RAM', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-022', 'Almacenamiento de sistema', '4 GB de memoria eMMC Flash', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-022', 'Nivel de seguridad', 'Cifrado Z-Wave S2 Security autenticado con curva elíptica', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-022', 'Conexión a red', 'Wi-Fi integrado 802.11 b/g/n a 2,4 GHz', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-DOM-023 (Relé Inteligente 4 Canales para Carril DIN con Medición de Potencia Shelly Pro 4PM)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-dom-023', 'rele-inteligente-4-canales-carril-din-medicion-shelly-pro-4pm', 'NDR-TEL-DOM-023', 'Relé Inteligente 4 Canales para Carril DIN con Medición de Potencia Shelly Pro 4PM', 'Shelly',
    'Shelly · modelo SHELLY-PRO-4PM. Actuador profesional de 4 circuitos independientes de 16 A con pantalla a color y telemetría de energía.', 'Shelly · modelo SHELLY-PRO-4PM. Actuador profesional de 4 circuitos independientes de 16 A con pantalla a color y telemetría de energía.',
    'https://img.pccomponentes.com/articles/30/305612/121-shelly-pro-4pm-carril-din.jpg', 'Relé inteligente para cuadro eléctrico carril DIN Shelly Pro 4PM con pantalla', null,
    4.9, 39, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-dom-023', 'domotica-hogar-digital')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-dom-023', 'reles-actuadores')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    '76433e26-f2bd-4a45-87a5-e642ffda66e2', 'tel-dom-023', 'NDR-TEL-DOM-023', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'SHELLY-PRO-4PM',
        'brand', 'Shelly',
        'inventory_seeded', true
      )
    ),
    89.90, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, '76433e26-f2bd-4a45-87a5-e642ffda66e2', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = '76433e26-f2bd-4a45-87a5-e642ffda66e2';

  if v_available < 25 then
    perform private.adjust_inventory(
      v_warehouse_id,
      '76433e26-f2bd-4a45-87a5-e642ffda66e2',
      25 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-023', 'Canales de salida', '4 salidas independientes de relé de 16 A cada una (total equipo 40 A)', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-023', 'Medición de energía', 'Vatímetro digital integrado en cada uno de los 4 canales con historial', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-023', 'Conectividad triple', 'Puerto Ethernet LAN RJ45, Wi-Fi 2,4 GHz y Bluetooth BLE', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-023', 'Pantalla frontal', 'Display a color de 1,8" con botones de control manual para cuadro', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-023', 'Montaje industrial', 'Formato para carril DIN estándar de 3 módulos (EN 50022)', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-023', 'Protocolos abiertos', 'Compatible nativamente con MQTT, WebSocket, REST API y Home Assistant', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-DOM-024 (Micromódulo Interruptor Empotrable Zigbee 3.0 con Medición Shelly 1PM Gen3)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-dom-024', 'micromodulo-interruptor-empotrable-zigbee-medicion-shelly-1pm-gen3', 'NDR-TEL-DOM-024', 'Micromódulo Interruptor Empotrable Zigbee 3.0 con Medición Shelly 1PM Gen3', 'Shelly',
    'Shelly · modelo SHELLY-1PM-G3. Relé compacto para instalar tras interruptores y enchufes convencionales sin modificar la estética.', 'Shelly · modelo SHELLY-1PM-G3. Relé compacto para instalar tras interruptores y enchufes convencionales sin modificar la estética.',
    'https://img.pccomponentes.com/articles/34/348910/109-shelly-1pm-gen3.jpg', 'Micromódulo empotrable para caja de mecanismo Shelly 1PM Gen3', null,
    4.8, 54, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-dom-024', 'domotica-hogar-digital')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-dom-024', 'reles-actuadores')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    '66f8cc84-ec8f-4353-815a-d3d89befe143', 'tel-dom-024', 'NDR-TEL-DOM-024', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'SHELLY-1PM-G3',
        'brand', 'Shelly',
        'inventory_seeded', true
      )
    ),
    22.90, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, '66f8cc84-ec8f-4353-815a-d3d89befe143', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = '66f8cc84-ec8f-4353-815a-d3d89befe143';

  if v_available < 30 then
    perform private.adjust_inventory(
      v_warehouse_id,
      '66f8cc84-ec8f-4353-815a-d3d89befe143',
      30 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-024', 'Carga eléctrica máxima', '16 A a 230 V CA / 30 V CC', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-024', 'Medición de consumo', 'Telemetría de potencia instantánea (W) y acumulada (kWh)', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-024', 'Dimensiones físicas', '37 x 42 x 16 mm (apto para cajas de mecanismo universales)', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-024', 'Procesador', 'ESP-Shelly-C38F con 8 MB de memoria Flash', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-024', 'Protecciones de seguridad', 'Sensor interno de sobretemperatura, sobrecarga y sobretensión', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-024', 'Soporte de protocolos', 'Wi-Fi, Bluetooth y soporte para actualización de firmware a Matter', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-DOM-025 (Sensor de Presencia Humana por Radar Milimétrico mmWave FP2 Aqara)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-dom-025', 'sensor-presencia-humana-radar-milimetrico-mmwave-fp2-aqara', 'NDR-TEL-DOM-025', 'Sensor de Presencia Humana por Radar Milimétrico mmWave FP2 Aqara', 'Aqara',
    'Aqara · modelo PS-S02D. Detección continua de personas incluso en reposo absoluto mediante radar de ondas milimétricas de 60 GHz.', 'Aqara · modelo PS-S02D. Detección continua de personas incluso en reposo absoluto mediante radar de ondas milimétricas de 60 GHz.',
    'https://img.pccomponentes.com/articles/33/339412/134-aqara-fp2-presencia-radar.jpg', 'Sensor de presencia por radar milimétrico Aqara Presence Sensor FP2', null,
    4.9, 26, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-dom-025', 'domotica-hogar-digital')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-dom-025', 'sensores-ambientales')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    '9e8b9f3d-0322-4a8b-88f0-0fce83ab86bc', 'tel-dom-025', 'NDR-TEL-DOM-025', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'PS-S02D',
        'brand', 'Aqara',
        'inventory_seeded', true
      )
    ),
    82.99, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, '9e8b9f3d-0322-4a8b-88f0-0fce83ab86bc', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = '9e8b9f3d-0322-4a8b-88f0-0fce83ab86bc';

  if v_available < 18 then
    perform private.adjust_inventory(
      v_warehouse_id,
      '9e8b9f3d-0322-4a8b-88f0-0fce83ab86bc',
      18 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-025', 'Tecnología de radar', 'Ondas milimétricas mmWave a 60 GHz de ultra alta precisión', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-025', 'Capacidad multi-persona', 'Seguimiento simultáneo de la posición de hasta 5 personas', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-025', 'Zonificación espacial', 'Mapeo de la habitación subdividido en hasta 30 zonas de automatización independientes', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-025', 'Sensor lumínico', 'Fotómetro de lux integrado para condicionar el encendido de luces', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-025', 'Detección de caídas', 'Modo de supervisión de personas mayores configurable en techo', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-025', 'Conexión', 'Wi-Fi 2,4 GHz sin necesidad de concentrador Zigbee', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-DOM-026 (Sensor Ambiental de Calidad de Aire Temperatura y Humedad TVOC Zigbee)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-dom-026', 'sensor-ambiental-calidad-aire-temperatura-humedad-tvoc-aqara', 'NDR-TEL-DOM-026', 'Sensor Ambiental de Calidad de Aire Temperatura y Humedad TVOC Zigbee', 'Aqara',
    'Aqara · modelo AAQS-S01. Pantalla de tinta electrónica para monitorizar contaminantes volátiles, confort térmico y humedad ambiental.', 'Aqara · modelo AAQS-S01. Pantalla de tinta electrónica para monitorizar contaminantes volátiles, confort térmico y humedad ambiental.',
    'https://img.pccomponentes.com/articles/27/279154/156-aqara-sensor-tvoc-zigbee.jpg', 'Monitor de calidad de aire y temperatura Aqara TVOC con pantalla E-Ink', null,
    4.7, 18, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-dom-026', 'domotica-hogar-digital')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-dom-026', 'sensores-ambientales')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    'bcc7a39b-76fa-4317-89e1-3aa30aa94ef8', 'tel-dom-026', 'NDR-TEL-DOM-026', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'AAQS-S01',
        'brand', 'Aqara',
        'inventory_seeded', true
      )
    ),
    44.90, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, 'bcc7a39b-76fa-4317-89e1-3aa30aa94ef8', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = 'bcc7a39b-76fa-4317-89e1-3aa30aa94ef8';

  if v_available < 22 then
    perform private.adjust_inventory(
      v_warehouse_id,
      'bcc7a39b-76fa-4317-89e1-3aa30aa94ef8',
      22 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-026', 'Parámetros registrados', 'Compuestos Orgánicos Volátiles (TVOC), temperatura (°C) y humedad relativa (%)', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-026', 'Tecnología de pantalla', 'Tinta electrónica E-Ink de 2,13" con visualización permanente sin fatiga', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-026', 'Protocolo de red', 'Zigbee 3.0 con vinculación a controladores domóticos', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-026', 'Autonomía de baterías', 'Más de 12 meses de funcionamiento con 2 pilas de botón CR2450', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-026', 'Algoritmo de compensación', 'Calibración térmica automática contra desvíos estacionales', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-026', 'Fijación', 'Soporte magnético autoadhesivo para pared o sobremesa', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-DOM-027 (Videoportero IP PoE con Cámara 2K y Lector NFC UniFi G4 Doorbell Pro PoE)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-dom-027', 'videoportero-ip-poe-camara-2k-lector-nfc-unifi-g4-doorbell-pro-ubiquiti', 'NDR-TEL-DOM-027', 'Videoportero IP PoE con Cámara 2K y Lector NFC UniFi G4 Doorbell Pro PoE', 'Ubiquiti',
    'Ubiquiti · modelo UVC-G4-Doorbell-Pro-PoE. Intercomunicador IP de seguridad con doble cámara, lector de tarjetas y pantalla programable.', 'Ubiquiti · modelo UVC-G4-Doorbell-Pro-PoE. Intercomunicador IP de seguridad con doble cámara, lector de tarjetas y pantalla programable.',
    'https://img.pccomponentes.com/articles/32/328901/179-ubiquiti-g4-doorbell-pro-poe.jpg', 'Videoportero IP PoE UniFi G4 Doorbell Pro Ubiquiti con doble cámara', null,
    4.9, 22, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-dom-027', 'domotica-hogar-digital')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-dom-027', 'videoporteros-control-acceso')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    '6d1c1455-a917-473a-83f9-284d5c7713c3', 'tel-dom-027', 'NDR-TEL-DOM-027', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'UVC-G4-Doorbell-Pro-PoE',
        'brand', 'Ubiquiti',
        'inventory_seeded', true
      )
    ),
    379.00, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, '6d1c1455-a917-473a-83f9-284d5c7713c3', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = '6d1c1455-a917-473a-83f9-284d5c7713c3';

  if v_available < 11 then
    perform private.adjust_inventory(
      v_warehouse_id,
      '6d1c1455-a917-473a-83f9-284d5c7713c3',
      11 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-027', 'Cámara principal', 'Sensor de 5 MP con resolución 2K (2688 x 1520) a 30 fps con visión nocturna IR', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-027', 'Cámara de paquetes', 'Segunda cámara orientada hacia abajo a 1080p para recepción de paquetería', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-027', 'Alimentación y datos', 'PoE estándar (802.3af) por cable de red RJ45 sin transformadores externos', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-027', 'Control de accesos', 'Lector NFC integrado para llaveros y tarjetas de entrada autorizada', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-027', 'Audio bidireccional', 'Micrófono con cancelación de eco ambiental y altavoz de alta fidelidad', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-027', 'Resistencia a la intemperie', 'Grado IPX4 para funcionamiento exterior en rango de -30°C a +40°C', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-DOM-028 (Cerradura Electrónica Inteligente Zigbee con Teclado Táctil y Biometría Aqara U200)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-dom-028', 'cerradura-electronica-inteligente-zigbee-teclado-tactil-aqara-u200', 'NDR-TEL-DOM-028', 'Cerradura Electrónica Inteligente Zigbee con Teclado Táctil y Biometría Aqara U200', 'Aqara',
    'Aqara · modelo EL-D02D. Cerradura motorizada sobre bombín europeo compatible con Matter sobre Thread y apertura por Apple Home Key.', 'Aqara · modelo EL-D02D. Cerradura motorizada sobre bombín europeo compatible con Matter sobre Thread y apertura por Apple Home Key.',
    'https://img.pccomponentes.com/articles/35/359124/188-aqara-u200-smart-lock.jpg', 'Cerradura inteligente motorizada Aqara U200 con teclado exterior y huella', null,
    4.8, 16, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-dom-028', 'domotica-hogar-digital')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-dom-028', 'videoporteros-control-acceso')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    '59251f70-0c94-44cf-8bc0-dd8e24b74fe0', 'tel-dom-028', 'NDR-TEL-DOM-028', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'EL-D02D',
        'brand', 'Aqara',
        'inventory_seeded', true
      )
    ),
    269.99, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, '59251f70-0c94-44cf-8bc0-dd8e24b74fe0', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = '59251f70-0c94-44cf-8bc0-dd8e24b74fe0';

  if v_available < 13 then
    perform private.adjust_inventory(
      v_warehouse_id,
      '59251f70-0c94-44cf-8bc0-dd8e24b74fe0',
      13 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-028', 'Métodos de desbloqueo', 'Huella dactilar, código PIN, tarjeta NFC, Apple Home Key y llave mecánica', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-028', 'Estándar de enlace', 'Matter sobre Thread y Bluetooth 5.1 Low Energy', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-028', 'Instalación', 'Montaje interior sin perforar la puerta sobre cilindros europeos existentes', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-028', 'Teclado exterior', 'Teclado retroiluminado con protección IPX5 y batería recargable', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-028', 'Seguridad criptográfica', 'Cifrado bancario AES-128 con almacenamiento local de datos biométricos', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-028', 'Autonomía', 'Hasta 6 meses por carga completa con aviso de batería baja', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-DOM-029 (Termostato Inteligente Modulante OpenTherm y Relé para Caldera/Bomba de Calor)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-dom-029', 'termostato-inteligente-modulante-opentherm-wiser-schneider-electric', 'NDR-TEL-DOM-029', 'Termostato Inteligente Modulante OpenTherm y Relé para Caldera/Bomba de Calor', 'Schneider Electric',
    'Schneider Electric · modelo CCTFR6700. Control eficiente de calefacción y aerotermia mediante regulación continua y algoritmos predictivos.', 'Schneider Electric · modelo CCTFR6700. Control eficiente de calefacción y aerotermia mediante regulación continua y algoritmos predictivos.',
    'https://img.pccomponentes.com/articles/29/298412/165-schneider-termostato-wiser.jpg', 'Termostato de pared modulante OpenTherm Schneider Electric Wiser', null,
    4.8, 20, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-dom-029', 'domotica-hogar-digital')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-dom-029', 'climatizacion-inteligente')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    'e2c66a6a-fb68-4261-864c-a30881b5b7f0', 'tel-dom-029', 'NDR-TEL-DOM-029', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'CCTFR6700',
        'brand', 'Schneider Electric',
        'inventory_seeded', true
      )
    ),
    179.00, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, 'e2c66a6a-fb68-4261-864c-a30881b5b7f0', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = 'e2c66a6a-fb68-4261-864c-a30881b5b7f0';

  if v_available < 16 then
    perform private.adjust_inventory(
      v_warehouse_id,
      'e2c66a6a-fb68-4261-864c-a30881b5b7f0',
      16 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-029', 'Protocolo de caldera', 'Comunicación digital modulante OpenTherm y contacto seco libre de potencial', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-029', 'Compatibilidad térmica', 'Calderas de condensación a gas, bombas de calor y suelo radiante', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-029', 'Conectividad de radio', 'Zigbee 3.0 / Wiser con alcance de hasta 30 metros en vivienda', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-029', 'Pantalla de control', 'Display capacitivo retroiluminado con activación por proximidad', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-029', 'Eficiencia energética', 'Algoritmo de compensación climática según inercia térmica del edificio', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-029', 'Programación', 'Gestión semanal por tramos horarios y modo ausencia con geovalla', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-DOM-030 (Cabezal Termostático Inteligente para Radiador Zigbee con Pantalla LED Shelly TRV)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-dom-030', 'cabezal-termostatico-inteligente-radiador-wifi-shelly-trv', 'NDR-TEL-DOM-030', 'Cabezal Termostático Inteligente para Radiador Zigbee con Pantalla LED Shelly TRV', 'Shelly',
    'Shelly · modelo SHELLY-TRV. Regulación individual de temperatura estancia por estancia con batería recargable y conexión Wi-Fi directa.', 'Shelly · modelo SHELLY-TRV. Regulación individual de temperatura estancia por estancia con batería recargable y conexión Wi-Fi directa.',
    'https://img.pccomponentes.com/articles/31/314562/119-shelly-trv-valvula-termostatica.jpg', 'Válvula termostática electrónica para radiador Shelly TRV con batería recargable', null,
    4.7, 37, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-dom-030', 'domotica-hogar-digital')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-dom-030', 'climatizacion-inteligente')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    '2a16dd33-f09d-42a1-8a5f-0f2a0b40fc7e', 'tel-dom-030', 'NDR-TEL-DOM-030', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'SHELLY-TRV',
        'brand', 'Shelly',
        'inventory_seeded', true
      )
    ),
    69.90, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, '2a16dd33-f09d-42a1-8a5f-0f2a0b40fc7e', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = '2a16dd33-f09d-42a1-8a5f-0f2a0b40fc7e';

  if v_available < 26 then
    perform private.adjust_inventory(
      v_warehouse_id,
      '2a16dd33-f09d-42a1-8a5f-0f2a0b40fc7e',
      26 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-030', 'Conectividad', 'Wi-Fi 802.11 b/g/n directo sin necesidad de pasarela intermedia', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-030', 'Batería integrada', 'Acumulador de litio Panasonic de 6500 mAh con hasta 2 años de autonomía', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-030', 'Control de caudal', 'Motor paso a paso ultrasilencioso con algoritmo de modulación PID', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-030', 'Funciones inteligentes', 'Detección automática de ventana abierta y protección anticalcárea periódica', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-030', 'Pantalla', 'Segmentos LED de brillo regulable para visualización de consigna', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dom-030', 'Compatibilidad de válvulas', 'Incluye adaptadores para M30x1.5, Danfoss RA, RAV y RAVL', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-TEL-031 (Centralita Telefónica IP-PBX Grandstream UCM6302 hasta 1000 Usuarios y 150 Llamadas)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-tel-031', 'centralita-telefonica-ip-pbx-grandstream-ucm6302-1000-usuarios', 'NDR-TEL-TEL-031', 'Centralita Telefónica IP-PBX Grandstream UCM6302 hasta 1000 Usuarios y 150 Llamadas', 'Grandstream',
    'Grandstream · modelo UCM6302. Plataforma de comunicaciones unificadas con aprovisionamiento automático y servidor de conferencias.', 'Grandstream · modelo UCM6302. Plataforma de comunicaciones unificadas con aprovisionamiento automático y servidor de conferencias.',
    'https://img.pccomponentes.com/articles/28/281904/162-grandstream-ucm6302.jpg', 'Centralita telefónica IP PBX Grandstream UCM6302 para empresas', null,
    4.9, 19, true, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-tel-031', 'telefonia-comunicaciones')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-tel-031', 'centralitas-ip-pbx')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    '29fb5b48-c6a9-4b98-8f56-51861cc4a188', 'tel-tel-031', 'NDR-TEL-TEL-031', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'UCM6302',
        'brand', 'Grandstream',
        'inventory_seeded', true
      )
    ),
    429.00, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, '29fb5b48-c6a9-4b98-8f56-51861cc4a188', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = '29fb5b48-c6a9-4b98-8f56-51861cc4a188';

  if v_available < 11 then
    perform private.adjust_inventory(
      v_warehouse_id,
      '29fb5b48-c6a9-4b98-8f56-51861cc4a188',
      11 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-031', 'Capacidad de extensiones', 'Hasta 1000 usuarios SIP registrados', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-031', 'Llamadas simultáneas', 'Hasta 150 llamadas de voz concurrentes (100 con códec SRTP cifrado)', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-031', 'Puertos telefónicos físicos', '2x puertos FXO para líneas analógicas PSTN y 2x puertos FXS para extensiones', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-031', 'Conectividad de red', '3x Gigabit Ethernet RJ45 con soporte PoE+ y función router NAT', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-031', 'Salas de conferencia', 'Hasta 3 salas de videoconferencia y 150 participantes en audio', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-031', 'Seguridad de llamada', 'Arranque seguro, cifrado SRTP, TLS y HTTPS con gestión en nube GDMS', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-TEL-032 (Centralita Telefónica IP Compacta Grandstream UCM6204 con 4 Puertos FXO)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-tel-032', 'centralita-telefonica-ip-compacta-grandstream-ucm6204-4-fxo', 'NDR-TEL-TEL-032', 'Centralita Telefónica IP Compacta Grandstream UCM6204 con 4 Puertos FXO', 'Grandstream',
    'Grandstream · modelo UCM6204. Servidor IP PBX para pequeñas y medianas empresas con operadora automática multinivel y buzón de voz a email.', 'Grandstream · modelo UCM6204. Servidor IP PBX para pequeñas y medianas empresas con operadora automática multinivel y buzón de voz a email.',
    'https://img.pccomponentes.com/articles/26/261890/138-grandstream-ucm6204.jpg', 'Centralita telefónica VoIP Grandstream UCM6204 con 4 puertos analógicos FXO', null,
    4.8, 24, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-tel-032', 'telefonia-comunicaciones')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-tel-032', 'centralitas-ip-pbx')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    '6570cc93-fdb9-4e53-82cc-04b00657fe7d', 'tel-tel-032', 'NDR-TEL-TEL-032', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'UCM6204',
        'brand', 'Grandstream',
        'inventory_seeded', true
      )
    ),
    349.00, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, '6570cc93-fdb9-4e53-82cc-04b00657fe7d', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = '6570cc93-fdb9-4e53-82cc-04b00657fe7d';

  if v_available < 13 then
    perform private.adjust_inventory(
      v_warehouse_id,
      '6570cc93-fdb9-4e53-82cc-04b00657fe7d',
      13 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-032', 'Usuarios de telefonía', 'Hasta 500 extensiones SIP configurables', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-032', 'Capacidad de llamadas', 'Hasta 45 llamadas simultáneas', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-032', 'Líneas de enlace', '4 puertos analógicos FXO para conexión de líneas de la compañía telefónica', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-032', 'Puertos de red', 'Doble puerto Gigabit Ethernet con PoE integrado', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-032', 'Grabación de llamadas', 'Servidor de grabación integrado con volcado a memoria USB o SD', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-032', 'Códecs soportados', 'Opus, G.711 (a-law/u-law), G.722, G.726, G.729A/B e iLBC', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-TEL-033 (Teléfono IP Ejecutivo Yealink SIP-T54W con Pantalla Color 4.3" y Wi-Fi/Bluetooth)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-tel-033', 'telefono-ip-ejecutivo-yealink-sip-t54w-pantalla-color-wifi-bluetooth', 'NDR-TEL-TEL-033', 'Teléfono IP Ejecutivo Yealink SIP-T54W con Pantalla Color 4.3" y Wi-Fi/Bluetooth', 'Yealink',
    'Yealink · modelo SIP-T54W. Terminal corporativo con pantalla a color ajustable, sonido de alta definición y conectividad Wi-Fi integrada.', 'Yealink · modelo SIP-T54W. Terminal corporativo con pantalla a color ajustable, sonido de alta definición y conectividad Wi-Fi integrada.',
    'https://img.pccomponentes.com/articles/25/259102/145-yealink-sip-t54w.jpg', 'Teléfono de sobremesa IP ejecutivo Yealink SIP-T54W con pantalla a color regulable', null,
    4.9, 45, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-tel-033', 'telefonia-comunicaciones')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-tel-033', 'telefonos-ip-dect')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    '2c76abd1-ee4a-409b-877e-c0ce0d36f597', 'tel-tel-033', 'NDR-TEL-TEL-033', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'SIP-T54W',
        'brand', 'Yealink',
        'inventory_seeded', true
      )
    ),
    169.50, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, '2c76abd1-ee4a-409b-877e-c0ce0d36f597', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = '2c76abd1-ee4a-409b-877e-c0ce0d36f597';

  if v_available < 22 then
    perform private.adjust_inventory(
      v_warehouse_id,
      '2c76abd1-ee4a-409b-877e-c0ce0d36f597',
      22 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-033', 'Pantalla', 'Panel LCD a color de 4,3" con resolución 480x272 y ángulo de inclinación ajustable', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-033', 'Cuentas VoIP', 'Hasta 16 cuentas SIP configurables simultáneamente', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-033', 'Conexión inalámbrica', 'Wi-Fi doble banda 2,4/5 GHz (802.11ac) y Bluetooth 4.2 integrado', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-033', 'Puertos de red', '2x Gigabit Ethernet 10/100/1000 con soporte de alimentación PoE 802.3af', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-033', 'Calidad acústica', 'Audio Optima HD con tecnología Yealink Noise Proof de cancelación de ruido', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-033', 'Ampliaciones', 'Puerto USB 2.0 para grabación en memoria o dongle DECT secundario', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-TEL-034 (Sistema Telefónico Inalámbrico DECT IP Yealink W73P Base + Terminal)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-tel-034', 'sistema-telefonico-inalambrico-dect-ip-yealink-w73p-base-terminal', 'NDR-TEL-TEL-034', 'Sistema Telefónico Inalámbrico DECT IP Yealink W73P Base + Terminal', 'Yealink',
    'Yealink · modelo W73P. Movilidad profesional en almacenes y oficinas con hasta 35 horas de conversación y cobertura ampliada.', 'Yealink · modelo W73P. Movilidad profesional en almacenes y oficinas con hasta 35 horas de conversación y cobertura ampliada.',
    'https://img.pccomponentes.com/articles/27/274198/123-yealink-w73p-dect-ip.jpg', 'Teléfono inalámbrico DECT IP Yealink W73P con estación base', null,
    4.8, 31, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-tel-034', 'telefonia-comunicaciones')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-tel-034', 'telefonos-ip-dect')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    'b49c51c5-e151-4fe7-8f19-6793e7e05b3e', 'tel-tel-034', 'NDR-TEL-TEL-034', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'W73P',
        'brand', 'Yealink',
        'inventory_seeded', true
      )
    ),
    119.00, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, 'b49c51c5-e151-4fe7-8f19-6793e7e05b3e', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = 'b49c51c5-e151-4fe7-8f19-6793e7e05b3e';

  if v_available < 24 then
    perform private.adjust_inventory(
      v_warehouse_id,
      'b49c51c5-e151-4fe7-8f19-6793e7e05b3e',
      24 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-034', 'Capacidad del sistema', 'Base compatible con hasta 10 terminales DECT y 10 cuentas SIP', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-034', 'Llamadas simultáneas', 'Hasta 20 llamadas de voz concurrentes en la misma estación base', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-034', 'Alcance de cobertura', 'Hasta 50 metros en interiores y hasta 300 metros en espacios abiertos', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-034', 'Batería del terminal', 'Autonomía de 35 horas de conversación y hasta 400 horas en reposo', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-034', 'Pantalla del terminal', 'Display a color TFT de 1,8" con interfaz gráfica intuitiva', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-034', 'Alimentación de la base', 'Alimentación por Ethernet PoE (802.3af) o fuente de alimentación incluida', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-TEL-035 (Pasarela VoIP FXS 16 Puertos Grandstream GXW4216 para Extensiones Analógicas)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-tel-035', 'pasarela-voip-fxs-16-puertos-grandstream-gxw4216', 'NDR-TEL-TEL-035', 'Pasarela VoIP FXS 16 Puertos Grandstream GXW4216 para Extensiones Analógicas', 'Grandstream',
    'Grandstream · modelo GXW4216. Integración de teléfonos analógicos, timbres de planta y faxes convencionales en redes telefónicas IP corporativas.', 'Grandstream · modelo GXW4216. Integración de teléfonos analógicos, timbres de planta y faxes convencionales en redes telefónicas IP corporativas.',
    'https://img.pccomponentes.com/articles/23/231908/176-grandstream-gxw4216.jpg', 'Gateway pasarela VoIP Grandstream GXW4216 de 16 puertos analógicos FXS', null,
    4.8, 13, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-tel-035', 'telefonia-comunicaciones')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-tel-035', 'gateways-voip')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    '0202a70b-b7a7-4c1c-814d-820350fe1c60', 'tel-tel-035', 'NDR-TEL-TEL-035', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'GXW4216',
        'brand', 'Grandstream',
        'inventory_seeded', true
      )
    ),
    269.00, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, '0202a70b-b7a7-4c1c-814d-820350fe1c60', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = '0202a70b-b7a7-4c1c-814d-820350fe1c60';

  if v_available < 14 then
    perform private.adjust_inventory(
      v_warehouse_id,
      '0202a70b-b7a7-4c1c-814d-820350fe1c60',
      14 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-035', 'Interfaces analógicas', '16x puertos FXS RJ11 estándar y conector Telco de 50 pines', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-035', 'Conexión a red', 'Puerto Gigabit Ethernet 10/100/1000 Mbps con soporte QoS', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-035', 'Soporte de Fax', 'Paso de fax sobre IP mediante protocolo T.38 con detección automática', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-035', 'Pantalla gráfica', 'Display LCD frontal de 128x32 píxeles para configuración rápida de red', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-035', 'Seguridad de señalización', 'Protocolos seguros TLS y SRTP para prevención de escuchas no autorizadas', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-035', 'Montaje en bastidor', 'Chasis metálico para montaje en armario rack 19" de 1U', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-TEL-036 (Gateway VoIP Digital ISDN BRI 2 Puertos Patton SmartNode SN4120)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-tel-036', 'gateway-voip-digital-isdn-bri-2-puertos-patton-smartnode-4120', 'NDR-TEL-TEL-036', 'Gateway VoIP Digital ISDN BRI 2 Puertos Patton SmartNode SN4120', 'Patton',
    'Patton · modelo SN4120/2BIS4V. Conversión fiable de líneas digitales RDSI/ISDN a enlaces SIP troncales con cancelación de eco de nivel operador.', 'Patton · modelo SN4120/2BIS4V. Conversión fiable de líneas digitales RDSI/ISDN a enlaces SIP troncales con cancelación de eco de nivel operador.',
    'https://img.pccomponentes.com/articles/24/248102/155-patton-smartnode-4120.jpg', 'Pasarela VoIP RDSI ISDN BRI Patton SmartNode 4120', null,
    4.9, 8, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-tel-036', 'telefonia-comunicaciones')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-tel-036', 'gateways-voip')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    '9cc795ce-81bc-42f8-8672-b1c0b2ab0ce7', 'tel-tel-036', 'NDR-TEL-TEL-036', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'SN4120/2BIS4V',
        'brand', 'Patton',
        'inventory_seeded', true
      )
    ),
    389.00, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, '9cc795ce-81bc-42f8-8672-b1c0b2ab0ce7', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = '9cc795ce-81bc-42f8-8672-b1c0b2ab0ce7';

  if v_available < 9 then
    perform private.adjust_inventory(
      v_warehouse_id,
      '9cc795ce-81bc-42f8-8672-b1c0b2ab0ce7',
      9 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-036', 'Puertos digitales', '2x puertos ISDN BRI (RDSI) conmutables por software en modo TE o NT', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-036', 'Canales de voz', '4 llamadas de voz simultáneas sobre protocolo SIP', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-036', 'Cancelación de eco', 'G.168 de 128 ms con generación de ruido de confort (CNG) y detección de voz (VAD)', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-036', 'Compatibilidad de centralitas', 'Interoperabilidad certificada con Asterisk, 3CX, FreePBX y Microsoft Teams', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-036', 'Enrutamiento flexible', 'Tablas de enrutamiento basadas en origen, destino, prefijo y hora del día', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-036', 'Fabricación industrial', 'Chasis robusto metálico suizo con fuente de alimentación interna 230V', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-TEL-037 (Router Celular Industrial 4G LTE Cat 4 Dual SIM Teltonika RUT241)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-tel-037', 'router-celular-industrial-4g-lte-dual-sim-teltonika-rut241', 'NDR-TEL-TEL-037', 'Router Celular Industrial 4G LTE Cat 4 Dual SIM Teltonika RUT241', 'Teltonika',
    'Teltonika · modelo RUT241. Conectividad celular robusta para cuadros eléctricos, máquinas de vending y enlaces de respaldo en comercios.', 'Teltonika · modelo RUT241. Conectividad celular robusta para cuadros eléctricos, máquinas de vending y enlaces de respaldo en comercios.',
    'https://img.pccomponentes.com/articles/31/318902/112-teltonika-rut241-4g.jpg', 'Router industrial 4G LTE Teltonika RUT241 para aplicaciones M2M y telemetría', null,
    4.8, 51, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-tel-037', 'telefonia-comunicaciones')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-tel-037', 'routers-celulares-4g-5g')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    'd1040088-67e2-469f-8acd-9a9134702645', 'tel-tel-037', 'NDR-TEL-TEL-037', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'RUT241',
        'brand', 'Teltonika',
        'inventory_seeded', true
      )
    ),
    139.00, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, 'd1040088-67e2-469f-8acd-9a9134702645', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = 'd1040088-67e2-469f-8acd-9a9134702645';

  if v_available < 28 then
    perform private.adjust_inventory(
      v_warehouse_id,
      'd1040088-67e2-469f-8acd-9a9134702645',
      28 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-037', 'Módem celular', '4G LTE Cat 4 (hasta 150 Mbps bajada / 50 Mbps subida) con fallback a 3G/2G', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-037', 'Puertos Ethernet', '2x 10/100 Mbps RJ45 (1x LAN, 1x WAN conmutables)', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-037', 'Red inalámbrica', 'Punto de acceso Wi-Fi 802.11b/g/n a 2,4 GHz para configuración y clientes locales', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-037', 'Túneles VPN seguros', 'OpenVPN, WireGuard, IPsec, GRE, ZeroTier y soporte Teltonika RMS', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-037', 'Rango de temperatura', 'Temperatura de trabajo extrema de -40°C a +75°C', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-037', 'Tensión de alimentación', 'Entrada continua de 9 a 30 V CC con bloque de bornes industrial', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-TEL-038 (Router Celular Industrial 5G y Wi-Fi 6 Dual SIM Teltonika RUTX50)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-tel-038', 'router-celular-industrial-5g-wifi6-dual-sim-teltonika-rutx50', 'NDR-TEL-TEL-038', 'Router Celular Industrial 5G y Wi-Fi 6 Dual SIM Teltonika RUTX50', 'Teltonika',
    'Teltonika · modelo RUTX50. Pasarela celular 5G de ultra baja latencia con velocidades multi-gigabit y conmutación automática por doble SIM.', 'Teltonika · modelo RUTX50. Pasarela celular 5G de ultra baja latencia con velocidades multi-gigabit y conmutación automática por doble SIM.',
    'https://img.pccomponentes.com/articles/34/341209/166-teltonika-rutx50-5g.jpg', 'Router 5G industrial Teltonika RUTX50 con Wi-Fi 6 y doble SIM', null,
    4.9, 16, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-tel-038', 'telefonia-comunicaciones')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-tel-038', 'routers-celulares-4g-5g')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    '15bca67c-9a9c-41c9-8b1b-f4fa70cfa4b2', 'tel-tel-038', 'NDR-TEL-TEL-038', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'RUTX50',
        'brand', 'Teltonika',
        'inventory_seeded', true
      )
    ),
    529.00, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, '15bca67c-9a9c-41c9-8b1b-f4fa70cfa4b2', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = '15bca67c-9a9c-41c9-8b1b-f4fa70cfa4b2';

  if v_available < 12 then
    perform private.adjust_inventory(
      v_warehouse_id,
      '15bca67c-9a9c-41c9-8b1b-f4fa70cfa4b2',
      12 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-038', 'Velocidades 5G', '5G Sub-6 GHz SA/NSA con rendimiento móvil de hasta 3,3 Gbps', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-038', 'Interfaces cableadas', '5x puertos Gigabit Ethernet 10/100/1000 Mbps', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-038', 'Wi-Fi corporativo', 'Wi-Fi 6 (802.11ax) doble banda Wave-2 con MU-MIMO hasta 1775 Mbps', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-038', 'Doble SIM', '2 ranuras SIM con conmutación automática por cobertura, itinerancia o límite de datos', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-038', 'Conectores de antena', '4x SMA para 5G/4G, 2x RP-SMA para Wi-Fi y 1x SMA para posicionamiento GNSS', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-038', 'Carcasa', 'Chasis integral de aluminio anodizado con anclaje para carril DIN', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-TEL-039 (Antena Exterior Omnidireccional 4G/5G MIMO 698-3800 MHz 6 dBi)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-tel-039', 'antena-exterior-omnidireccional-4g-5g-mimo-6dbi-teltonika', 'NDR-TEL-TEL-039', 'Antena Exterior Omnidireccional 4G/5G MIMO 698-3800 MHz 6 dBi', 'Teltonika',
    'Teltonika · modelo PR1US440. Antena estanca de polarización cruzada para maximizar la recepción de señal móvil en routers industriales.', 'Teltonika · modelo PR1US440. Antena estanca de polarización cruzada para maximizar la recepción de señal móvil en routers industriales.',
    'https://img.pccomponentes.com/articles/29/293410/144-teltonika-antena-5g-mimo.jpg', 'Antena exterior omnidireccional 5G MIMO Teltonika con cable de 3m', null,
    4.7, 23, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-tel-039', 'telefonia-comunicaciones')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-tel-039', 'antenas-comunicaciones')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    'f4c4c0ce-a5da-4187-8f43-d6b7cfea80ab', 'tel-tel-039', 'NDR-TEL-TEL-039', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'PR1US440',
        'brand', 'Teltonika',
        'inventory_seeded', true
      )
    ),
    75.00, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, 'f4c4c0ce-a5da-4187-8f43-d6b7cfea80ab', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = 'f4c4c0ce-a5da-4187-8f43-d6b7cfea80ab';

  if v_available < 20 then
    perform private.adjust_inventory(
      v_warehouse_id,
      'f4c4c0ce-a5da-4187-8f43-d6b7cfea80ab',
      20 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-039', 'Bandas de frecuencia', '698-960 MHz, 1710-2700 MHz y 3400-3800 MHz (todas las bandas 4G/5G)', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-039', 'Ganancia de señal', 'Hasta 6 dBi de ganancia con patrón omnidireccional 360°', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-039', 'Configuración de radio', '2x2 MIMO integrada en un único radomo compacto', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-039', 'Cables coaxiales', '2 tiradas de 3 metros de cable de baja pérdida RG58 con conectores SMA macho', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-039', 'Sellado y resistencia', 'Grado IP66 estanco resistente a la intemperie y radiación UV continuada', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-039', 'Montaje mecánico', 'Soporte de acero inoxidable para fijación en mástil o fachada incluido', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-TEL-040 (Amplificador de Señal Móvil 4G/5G Multibanda para Interiores StellaHome)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-tel-040', 'amplificador-senal-movil-4g-5g-multibanda-televes', 'NDR-TEL-TEL-040', 'Amplificador de Señal Móvil 4G/5G Multibanda para Interiores StellaHome', 'Televes',
    'Televes · modelo 403001. Sistema repetidor homologado para eliminar zonas sin cobertura celular en sótanos, naves y oficinas aisladas.', 'Televes · modelo 403001. Sistema repetidor homologado para eliminar zonas sin cobertura celular en sótanos, naves y oficinas aisladas.',
    'https://img.pccomponentes.com/articles/26/269103/182-televes-amplificador-4g-5g.jpg', 'Kit amplificador repetidor de telefonía móvil 4G y 5G Televes StellaHome', null,
    4.9, 10, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-tel-040', 'telefonia-comunicaciones')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-tel-040', 'antenas-comunicaciones')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    '7e211afe-2b66-4f02-8156-4bc7f489a0c8', 'tel-tel-040', 'NDR-TEL-TEL-040', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', '403001',
        'brand', 'Televes',
        'inventory_seeded', true
      )
    ),
    499.00, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, '7e211afe-2b66-4f02-8156-4bc7f489a0c8', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = '7e211afe-2b66-4f02-8156-4bc7f489a0c8';

  if v_available < 8 then
    perform private.adjust_inventory(
      v_warehouse_id,
      '7e211afe-2b66-4f02-8156-4bc7f489a0c8',
      8 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-040', 'Bandas amplificadas', '800 MHz (B20), 900 MHz (B8), 1800 MHz (B3), 2100 MHz (B1) y 2600 MHz (B7)', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-040', 'Superficie de cobertura', 'Hasta 1000 m² en interiores sin obstáculos', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-040', 'Ganancia y control', '60 dB de ganancia con control automático de ganancia (AGC) inteligente', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-040', 'Certificación legal', 'Homologado conforme a la Directiva Europea RED 2014/53/UE para no interferir antenas base', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-040', 'Componentes del kit', 'Antena exterior directiva, antena interior panel y cable coaxial LMR240', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-tel-040', 'Indicadores de estado', 'Barras LED indicadoras de nivel de señal y advertencia de retroalimentación', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-DIG-041 (Gateway IoT Industrial Edge Advantech UNO-2271G-V2 con Modbus y MQTT)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-dig-041', 'gateway-iot-industrial-edge-advantech-uno-2271g-v2-modbus-mqtt', 'NDR-TEL-DIG-041', 'Gateway IoT Industrial Edge Advantech UNO-2271G-V2 con Modbus y MQTT', 'Advantech',
    'Advantech · modelo UNO-2271G-V2. Pasarela compacta sin ventilador para digitalización de líneas productivas, captura OPC UA y telemetría MQTT.', 'Advantech · modelo UNO-2271G-V2. Pasarela compacta sin ventilador para digitalización de líneas productivas, captura OPC UA y telemetría MQTT.',
    'https://img.pccomponentes.com/articles/32/329012/177-advantech-uno-2271g-gateway.jpg', 'Pasarela IoT industrial Advantech UNO-2271G-V2 fanless para carril DIN', null,
    4.9, 15, true, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-dig-041', 'digitalizacion-industria-conectada')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-dig-041', 'gateways-iot-industriales')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    '402b7512-82e9-441a-8a97-72ebdbd82dbf', 'tel-dig-041', 'NDR-TEL-DIG-041', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'UNO-2271G-V2',
        'brand', 'Advantech',
        'inventory_seeded', true
      )
    ),
    489.00, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, '402b7512-82e9-441a-8a97-72ebdbd82dbf', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = '402b7512-82e9-441a-8a97-72ebdbd82dbf';

  if v_available < 10 then
    perform private.adjust_inventory(
      v_warehouse_id,
      '402b7512-82e9-441a-8a97-72ebdbd82dbf',
      10 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-041', 'Unidad de proceso', 'Intel Celeron N5105 Quad-Core hasta 2,9 GHz', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-041', 'Memoria y disco', '8 GB DDR4 integrada y 64 GB de almacenamiento eMMC industrial', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-041', 'Puertos de red', '2x Gigabit Ethernet RJ45 independientes Intel i210', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-041', 'Puertos serie de campo', '1x puerto RS-232/422/485 con aislamiento galvánico de 2,5 kV', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-041', 'Plataforma IoT', 'Software EdgeLink preinstalado con más de 200 controladores de autómatas PLC', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-041', 'Rango térmico de operación', '-20°C a +60°C en régimen continuo industrial 24/7', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-DIG-042 (Módulo de E/S Remotas Modbus TCP Ethernet Phoenix Contact Axioline Smart Elements)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-dig-042', 'modulo-entradas-salidas-remotas-modbus-tcp-phoenix-contact', 'NDR-TEL-DIG-042', 'Módulo de E/S Remotas Modbus TCP Ethernet Phoenix Contact Axioline Smart Elements', 'Phoenix Contact',
    'Phoenix Contact · modelo AXL-SE-SC-A. Estación de adquisición distribuida para lectura de sensores de fábrica mediante bus industrial Ethernet.', 'Phoenix Contact · modelo AXL-SE-SC-A. Estación de adquisición distribuida para lectura de sensores de fábrica mediante bus industrial Ethernet.',
    'https://img.pccomponentes.com/articles/27/271890/132-phoenix-contact-modbus-tcp.jpg', 'Cabecera de periferia descentralizada Phoenix Contact Axioline Smart Elements Modbus TCP', null,
    4.8, 12, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-dig-042', 'digitalizacion-industria-conectada')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-dig-042', 'gateways-iot-industriales')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    'dd6941d9-a90a-4c4a-81e5-dd6006335398', 'tel-dig-042', 'NDR-TEL-DIG-042', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'AXL-SE-SC-A',
        'brand', 'Phoenix Contact',
        'inventory_seeded', true
      )
    ),
    215.00, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, 'dd6941d9-a90a-4c4a-81e5-dd6006335398', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = 'dd6941d9-a90a-4c4a-81e5-dd6006335398';

  if v_available < 18 then
    perform private.adjust_inventory(
      v_warehouse_id,
      'dd6941d9-a90a-4c4a-81e5-dd6006335398',
      18 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-042', 'Protocolo de red', 'Modbus/TCP y PROFINET seleccionable con conmutador integrado de 2 puertos', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-042', 'Entradas/Salidas', '16 entradas digitales a 24 V CC y 8 salidas digitales a transistor (0,5 A)', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-042', 'Tecnología de conexión', 'Conexión por resorte Push-in directa sin herramientas', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-042', 'Aislamiento eléctrico', 'Aislamiento galvánico de 500 V entre electrónica de control y bus de campo', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-042', 'Tiempo de respuesta', 'Actualización de bus ultrarrápida menor a 1 milisegundo', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-042', 'Montaje', 'Instalación en carril DIN simétrico de 35 mm (EN 60715)', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-DIG-043 (Servidor Edge Fanless Industrial Advantech ARK-1220L para Inferencia IA)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-dig-043', 'servidor-edge-fanless-industrial-advantech-ark-1220l', 'NDR-TEL-DIG-043', 'Servidor Edge Fanless Industrial Advantech ARK-1220L para Inferencia IA', 'Advantech',
    'Advantech · modelo ARK-1220L-S6A1E. Nodo de computación en borde para visión artificial, gemelos digitales y procesamiento local de datos.', 'Advantech · modelo ARK-1220L-S6A1E. Nodo de computación en borde para visión artificial, gemelos digitales y procesamiento local de datos.',
    'https://img.pccomponentes.com/articles/31/314092/188-advantech-ark-1220l-edge.jpg', 'Computador embebido para Edge Computing Advantech ARK-1220L', null,
    4.9, 11, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-dig-043', 'digitalizacion-industria-conectada')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-dig-043', 'servidores-edge-computacion')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    '02ace199-26e4-42e7-8a92-80c784428c87', 'tel-dig-043', 'NDR-TEL-DIG-043', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'ARK-1220L-S6A1E',
        'brand', 'Advantech',
        'inventory_seeded', true
      )
    ),
    699.00, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, '02ace199-26e4-42e7-8a92-80c784428c87', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = '02ace199-26e4-42e7-8a92-80c784428c87';

  if v_available < 8 then
    perform private.adjust_inventory(
      v_warehouse_id,
      '02ace199-26e4-42e7-8a92-80c784428c87',
      8 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-043', 'Procesador industrial', 'Intel Atom x6413E Quad-Core a 1,5 GHz (Turbo 3,0 GHz)', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-043', 'Capacidad de memoria', '16 GB DDR4-3200 SODIMM (ampliable hasta 32 GB)', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-043', 'Almacenamiento masivo', 'SSD M.2 2280 NVMe de 256 GB precargado con Linux embebido', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-043', 'Conexiones de red', '2x puertos 2.5 Gigabit Ethernet RJ45 Intel i225-IT', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-043', 'Ampliación de aceleración', 'Ranura Mini PCIe para módulos NPU de aceleración neuronal (Hailo-8 / Google Coral)', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-043', 'Robustez mecánica', 'Resistencia a vibraciones de 3 Grms y choques de 30G según IEC 60068', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-DIG-044 (Micro Servidor Edge Fanless con Doble 2.5GbE y 4 Puertos Serie Moxa V2201)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-dig-044', 'micro-servidor-edge-fanless-2-5gbe-puertos-serie-moxa-v2201', 'NDR-TEL-DIG-044', 'Micro Servidor Edge Fanless con Doble 2.5GbE y 4 Puertos Serie Moxa V2201', 'Moxa',
    'Moxa · modelo V2201-E4-W-T. Controlador de comunicaciones críticas con certificación para transporte e infraestructura energética.', 'Moxa · modelo V2201-E4-W-T. Controlador de comunicaciones críticas con certificación para transporte e infraestructura energética.',
    'https://img.pccomponentes.com/articles/29/290124/156-moxa-v2201-edge-server.jpg', 'Servidor industrial para subestaciones y borde Moxa V2201', null,
    4.8, 14, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-dig-044', 'digitalizacion-industria-conectada')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-dig-044', 'servidores-edge-computacion')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    '92654f2d-ec6d-409f-8222-263b804da89b', 'tel-dig-044', 'NDR-TEL-DIG-044', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'V2201-E4-W-T',
        'brand', 'Moxa',
        'inventory_seeded', true
      )
    ),
    579.00, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, '92654f2d-ec6d-409f-8222-263b804da89b', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = '92654f2d-ec6d-409f-8222-263b804da89b';

  if v_available < 11 then
    perform private.adjust_inventory(
      v_warehouse_id,
      '92654f2d-ec6d-409f-8222-263b804da89b',
      11 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-044', 'CPU', 'Intel Atom E3845 Quad-Core a 1,91 GHz', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-044', 'Memoria RAM', '8 GB DDR3L con zócalo mSATA para almacenamiento en estado sólido', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-044', 'Puertos serie industriales', '4x RS-232/422/485 por DB9 macho con aislamiento óptico de 2 kV', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-044', 'Puertos LAN', '2x 2.5GbE Ethernet con conectores apantallados magnéticos', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-044', 'Certificación normativa', 'Homologado para entornos ferroviarios EN 50121-4 e inmunidad industrial severa', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-044', 'Rango de trabajo', 'Rango térmico extendido de -40°C a +70°C sin ventilador', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-DIG-045 (Servidor de Almacenamiento en Red NAS 4 Bahías Synology DiskStation DS923+)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-dig-045', 'servidor-almacenamiento-nas-4-bahias-synology-ds923-plus', 'NDR-TEL-DIG-045', 'Servidor de Almacenamiento en Red NAS 4 Bahías Synology DiskStation DS923+', 'Synology',
    'Synology · modelo DS923+. Centro de almacenamiento seguro para copias empresariales, contenedores Docker y centralización de datos de fábrica.', 'Synology · modelo DS923+. Centro de almacenamiento seguro para copias empresariales, contenedores Docker y centralización de datos de fábrica.',
    'https://img.pccomponentes.com/articles/33/332190/165-synology-ds923-plus-nas.jpg', 'Servidor NAS Synology DiskStation DS923+ de 4 bahías con soporte 10GbE', null,
    4.9, 62, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-dig-045', 'digitalizacion-industria-conectada')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-dig-045', 'almacenamiento-nas-servidores')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    '2a8334d4-ebde-448b-8f69-345ee2e5f3c2', 'tel-dig-045', 'NDR-TEL-DIG-045', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'DS923+',
        'brand', 'Synology',
        'inventory_seeded', true
      )
    ),
    629.00, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, '2a8334d4-ebde-448b-8f69-345ee2e5f3c2', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = '2a8334d4-ebde-448b-8f69-345ee2e5f3c2';

  if v_available < 14 then
    perform private.adjust_inventory(
      v_warehouse_id,
      '2a8334d4-ebde-448b-8f69-345ee2e5f3c2',
      14 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-045', 'Procesador', 'AMD Ryzen R1600 Dual-Core (4 hilos) con frecuencia turbo hasta 3,1 GHz', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-045', 'Memoria de sistema', '4 GB DDR4 ECC protegida contra corrupción (ampliable hasta 32 GB ECC)', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-045', 'Bahías de disco', '4 bahías intercambiables en caliente para SATA 3.5"/2.5" (hasta 9 con unidad DX517)', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-045', 'Aceleración NVMe', '2 ranuras M.2 2280 NVMe integradas para caché o volumen SSD rápido', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-045', 'Interfaces de red', '2 puertos 1GbE RJ45 con agregación LACP + ranura de expansión para módulo 10GbE', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-045', 'Sistema de archivos', 'Btrfs con instantáneas periódicas programadas y reparación automática de ficheros', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-DIG-046 (Servidor de Almacenamiento NAS en Rack 19" 1U 4 Bahías Synology RackStation RS822+)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-dig-046', 'servidor-almacenamiento-nas-rack-19-1u-synology-rs822-plus', 'NDR-TEL-DIG-046', 'Servidor de Almacenamiento NAS en Rack 19" 1U 4 Bahías Synology RackStation RS822+', 'Synology',
    'Synology · modelo RS822+. Servidor NAS para montaje en armario rack de profundidad reducida con 4 interfaces de red integradas.', 'Synology · modelo RS822+. Servidor NAS para montaje en armario rack de profundidad reducida con 4 interfaces de red integradas.',
    'https://img.pccomponentes.com/articles/31/319024/189-synology-rs822-plus-rack.jpg', 'Almacenamiento en rack 1U Synology RackStation RS822+ para empresas', null,
    4.9, 15, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-dig-046', 'digitalizacion-industria-conectada')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-dig-046', 'almacenamiento-nas-servidores')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    'af0f219a-7cc1-4f58-8e11-4ce469057f71', 'tel-dig-046', 'NDR-TEL-DIG-046', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'RS822+',
        'brand', 'Synology',
        'inventory_seeded', true
      )
    ),
    989.00, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, 'af0f219a-7cc1-4f58-8e11-4ce469057f71', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = 'af0f219a-7cc1-4f58-8e11-4ce469057f71';

  if v_available < 9 then
    perform private.adjust_inventory(
      v_warehouse_id,
      'af0f219a-7cc1-4f58-8e11-4ce469057f71',
      9 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-046', 'Factor de forma', 'Montaje en bastidor rack 19" de 1U y profundidad compacta de 30 cm', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-046', 'Procesador', 'AMD Ryzen V1500B Quad-Core a 2,2 GHz con motor de cifrado AES-NI', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-046', 'Memoria RAM', '8 GB DDR4 ECC preinstalados (ampliable hasta 32 GB)', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-046', 'Capacidad de unidades', '4 bahías SATA frontales con llave de seguridad', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-046', 'Puertos de comunicaciones', '4x Gigabit Ethernet RJ45 compatibles con failover y balanceo de tráfico', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-046', 'Ampliación PCIe', 'Ranura PCIe Gen3 x8 para tarjetas de red 10GbE/25GbE o tarjetas M.2 dobles', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: REF-SNV3SM31T0-0ETE5 (SSD Kingston NV3 1TB M.2 2230 PCIe 4.0 NVMe 6000MB/s 3D NAND Gaming)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'ref-storage-snv3sm3-1t0', 'ssd-kingston-nv3-1tb-m-2-2230-pcie-4-0-nvme-6000mb-s-3d-nand-gaming-0ete5', 'REF-SNV3SM31T0-0ETE5', 'SSD Kingston NV3 1TB M.2 2230 PCIe 4.0 NVMe 6000MB/s 3D NAND Gaming', 'Kingston',
    'Kingston · modelo SNV3SM3/1T0. Unidad de estado sólido M.2 PCIe 4.0 para aceleración de lectura de bases de datos y servidores NAS.', 'Kingston · modelo SNV3SM3/1T0. Unidad de estado sólido M.2 PCIe 4.0 para aceleración de lectura de bases de datos y servidores NAS.',
    'https://img.pccomponentes.com/articles/1093/10932024/1572-ssd-kingston-nv3-1tb-m2-2230-pcie-40-nvme-6000mb-s-3d-nand-gaming.jpg', 'SSD Kingston NV3 1TB M.2 2230 PCIe 4.0 NVMe 6000MB/s 3D NAND Gaming', null,
    4.8, 48, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('ref-storage-snv3sm3-1t0', 'digitalizacion-industria-conectada')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('ref-storage-snv3sm3-1t0', 'almacenamiento-nas-servidores')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    '00000000-0000-4000-8000-000000000008', 'ref-storage-snv3sm3-1t0', 'REF-SNV3SM31T0-0ETE5', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'SNV3SM3/1T0',
        'brand', 'Kingston',
        'inventory_seeded', true
      )
    ),
    269.73, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, '00000000-0000-4000-8000-000000000008', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = '00000000-0000-4000-8000-000000000008';

  if v_available < 25 then
    perform private.adjust_inventory(
      v_warehouse_id,
      '00000000-0000-4000-8000-000000000008',
      25 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('ref-storage-snv3sm3-1t0', 'Capacidad', '1 TB de almacenamiento 3D NAND', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('ref-storage-snv3sm3-1t0', 'Interfaz', 'PCI Express 4.0 x4 (NVMe 2.0)', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('ref-storage-snv3sm3-1t0', 'Formato', 'M.2 2230 compatible con servidores compactos y bastidores', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('ref-storage-snv3sm3-1t0', 'Lectura secuencial', 'Hasta 6000 MB/s', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('ref-storage-snv3sm3-1t0', 'Escritura secuencial', 'Hasta 4000 MB/s', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('ref-storage-snv3sm3-1t0', 'Resistencia TBW', '320 TBW de durabilidad garantizada', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: REF-MZV9P1T0BW-1VOPO (Samsung 990 Pro 1TB Disco SSD 7450MB/S NVMe PCIe 4.0 M.2 Gen4)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'ref-storage-mz-v9p1t0bw', 'samsung-990-pro-1tb-disco-ssd-7450mb-s-nvme-pcie-4-0-m-2-gen4-1vopo', 'REF-MZV9P1T0BW-1VOPO', 'Samsung 990 Pro 1TB Disco SSD 7450MB/S NVMe PCIe 4.0 M.2 Gen4', 'Samsung',
    'Samsung · modelo MZ-V9P1T0BW. Rendimiento máximo en lectura y escritura para caché de almacenamiento en red corporativo y servidores Edge.', 'Samsung · modelo MZ-V9P1T0BW. Rendimiento máximo en lectura y escritura para caché de almacenamiento en red corporativo y servidores Edge.',
    'https://img.pccomponentes.com/articles/1064/10648533/1721-samsung-990-pro-1tb-ssd-pcie-40-nvme-m2.jpg', 'Samsung 990 Pro 1TB Disco SSD 7450MB/S NVMe PCIe 4.0 M.2 Gen4', null,
    4.9, 65, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('ref-storage-mz-v9p1t0bw', 'digitalizacion-industria-conectada')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('ref-storage-mz-v9p1t0bw', 'almacenamiento-nas-servidores')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    '00000000-0000-4000-8000-000000000009', 'ref-storage-mz-v9p1t0bw', 'REF-MZV9P1T0BW-1VOPO', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'MZ-V9P1T0BW',
        'brand', 'Samsung',
        'inventory_seeded', true
      )
    ),
    218.99, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, '00000000-0000-4000-8000-000000000009', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = '00000000-0000-4000-8000-000000000009';

  if v_available < 20 then
    perform private.adjust_inventory(
      v_warehouse_id,
      '00000000-0000-4000-8000-000000000009',
      20 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('ref-storage-mz-v9p1t0bw', 'Capacidad', '1000 GB (1 TB)', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('ref-storage-mz-v9p1t0bw', 'Interfaz', 'PCIe Gen 4.0 x4, NVMe 2.0', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('ref-storage-mz-v9p1t0bw', 'Formato', 'M.2 2280 estándar', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('ref-storage-mz-v9p1t0bw', 'Lectura secuencial', 'Hasta 7450 MB/s', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('ref-storage-mz-v9p1t0bw', 'Escritura secuencial', 'Hasta 6900 MB/s', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('ref-storage-mz-v9p1t0bw', 'Controlador térmico', 'Controlador con revestimiento de níquel para estabilidad térmica continua', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-DIG-047 (Sensor Industrial de Temperatura y Humedad Modbus RTU RS-485 IP65)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-dig-047', 'sensor-industrial-temperatura-humedad-modbus-rtu-rs485-schneider-electric', 'NDR-TEL-DIG-047', 'Sensor Industrial de Temperatura y Humedad Modbus RTU RS-485 IP65', 'Schneider Electric',
    'Schneider Electric · modelo METSETH01. Transmisor con bus serie RS-485 para supervisión ambiental de CPD, salas eléctricas y silos de producción.', 'Schneider Electric · modelo METSETH01. Transmisor con bus serie RS-485 para supervisión ambiental de CPD, salas eléctricas y silos de producción.',
    'https://img.pccomponentes.com/articles/25/254190/122-schneider-sensor-modbus-rs485.jpg', 'Sonda de temperatura y humedad ambiental industrial Schneider Electric Modbus RS-485', null,
    4.8, 18, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-dig-047', 'digitalizacion-industria-conectada')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-dig-047', 'sensores-industriales-modbus')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    'd38af876-f15d-41ec-855a-4de412206249', 'tel-dig-047', 'NDR-TEL-DIG-047', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'METSETH01',
        'brand', 'Schneider Electric',
        'inventory_seeded', true
      )
    ),
    79.50, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, 'd38af876-f15d-41ec-855a-4de412206249', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = 'd38af876-f15d-41ec-855a-4de412206249';

  if v_available < 25 then
    perform private.adjust_inventory(
      v_warehouse_id,
      'd38af876-f15d-41ec-855a-4de412206249',
      25 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-047', 'Protocolo de bus', 'Modbus RTU sobre par trenzado RS-485 half-duplex', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-047', 'Rango de temperatura', '-40°C a +85°C con precisión calibrada de ±0,3°C', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-047', 'Rango de humedad', '0% a 100% de humedad relativa (HR) con precisión de ±2%', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-047', 'Protección ambiental', 'Carcasa estanca IP65 con filtro sinterizado de acero inoxidable', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-047', 'Alimentación eléctrica', '9 a 30 V CC con protección contra inversión de polaridad', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-047', 'Direccionamiento', 'Dirección de esclavo 1-247 configurable por microinterruptores o software', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-DIG-048 (Transmisor de Presión Industrial 4-20mA y Modbus RTU 0-10 Bar Acero Inoxidable)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-dig-048', 'transmisor-presion-industrial-4-20ma-modbus-0-10-bar-schneider-electric', 'NDR-TEL-DIG-048', 'Transmisor de Presión Industrial 4-20mA y Modbus RTU 0-10 Bar Acero Inoxidable', 'Schneider Electric',
    'Schneider Electric · modelo XMLP010BC71F. Sensor de presión relativa para circuitos de refrigeración, aire comprimido y fluidos industriales.', 'Schneider Electric · modelo XMLP010BC71F. Sensor de presión relativa para circuitos de refrigeración, aire comprimido y fluidos industriales.',
    'https://img.pccomponentes.com/articles/26/268102/145-schneider-transmisor-presion.jpg', 'Transmisor de presión hidráulica y neumática en acero inoxidable Schneider Electric', null,
    4.9, 14, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-dig-048', 'digitalizacion-industria-conectada')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-dig-048', 'sensores-industriales-modbus')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    'b0ddcbc3-fd05-43e1-8d63-69f95214f73d', 'tel-dig-048', 'NDR-TEL-DIG-048', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'XMLP010BC71F',
        'brand', 'Schneider Electric',
        'inventory_seeded', true
      )
    ),
    115.00, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, 'b0ddcbc3-fd05-43e1-8d63-69f95214f73d', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = 'b0ddcbc3-fd05-43e1-8d63-69f95214f73d';

  if v_available < 20 then
    perform private.adjust_inventory(
      v_warehouse_id,
      'b0ddcbc3-fd05-43e1-8d63-69f95214f73d',
      20 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-048', 'Rango de medida', '0 a 10 bar de presión relativa (sobrepresión admisible 30 bar)', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-048', 'Salida de señal', 'Bucle de corriente analógico 4-20 mA a 2 hilos + lectura digital', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-048', 'Conexión a tubería', 'Rosca macho G 1/4A según norma DIN 3852-E', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-048', 'Materiales en contacto', 'Cuerpo y diafragma en acero inoxidable AISI 316L libre de elastómeros', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-048', 'Conector eléctrico', 'Conector industrial métrico M12 de 4 polos con estanqueidad IP67', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-048', 'Precisión global', 'Error máximo inferior a ±0,5% del fondo de escala (incluyendo linealidad e histéresis)', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-DIG-049 (Terminal Portátil PDA Móvil Industrial con Lector 2D Zebra TC22)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-dig-049', 'terminal-portatil-pda-movil-industrial-lector-2d-zebra-tc22', 'NDR-TEL-DIG-049', 'Terminal Portátil PDA Móvil Industrial con Lector 2D Zebra TC22', 'Zebra',
    'Zebra · modelo TC220K-01B112-A6. Terminal móvil ergonómico para gestión de almacenes, control de inventario y trazabilidad logística en planta.', 'Zebra · modelo TC220K-01B112-A6. Terminal móvil ergonómico para gestión de almacenes, control de inventario y trazabilidad logística en planta.',
    'https://img.pccomponentes.com/articles/35/351890/177-zebra-tc22-terminal-lectura.jpg', 'Terminal de captura de datos y lector de códigos 2D Zebra TC22', null,
    4.9, 27, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-dig-049', 'digitalizacion-industria-conectada')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-dig-049', 'captura-datos-trazabilidad')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    '34554a39-8dee-4e84-8384-209ebf997257', 'tel-dig-049', 'NDR-TEL-DIG-049', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'TC220K-01B112-A6',
        'brand', 'Zebra',
        'inventory_seeded', true
      )
    ),
    549.00, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, '34554a39-8dee-4e84-8384-209ebf997257', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = '34554a39-8dee-4e84-8384-209ebf997257';

  if v_available < 15 then
    perform private.adjust_inventory(
      v_warehouse_id,
      '34554a39-8dee-4e84-8384-209ebf997257',
      15 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-049', 'Motor de escaneo', 'Lector imager SE4710 para códigos 1D y 2D (QR, DataMatrix) de lectura instantánea', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-049', 'Pantalla táctil', 'Panel FHD+ de 6,0" ultrabrillante operable con guantes o bajo lluvia', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-049', 'Conectividad avanzada', 'Wi-Fi 6E (802.11ax), Bluetooth 5.2 y NFC integrado para emparejamiento rápido', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-049', 'Procesador y memoria', 'Qualcomm Snapdragon 5430 Octa-Core a 2,1 GHz con 6 GB de RAM y 64 GB Flash', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-049', 'Sistema operativo', 'Android 13 actualizable con suite de seguridad Zebra Mobility DNA', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-049', 'Resistencia a caídas', 'Soporta caídas desde 1,5 metros sobre hormigón y sellado estanco IP68 / IP65', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

  -- Product: NDR-TEL-DIG-050 (Impresora Industrial de Etiquetas y Códigos de Barras Térmica Zebra ZT231)
  insert into public.products (
    id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
    rating_average, rating_count, is_featured, is_published, published_at
  ) values (
    'tel-dig-050', 'impresora-industrial-etiquetas-codigos-barras-termica-zebra-zt231', 'NDR-TEL-DIG-050', 'Impresora Industrial de Etiquetas y Códigos de Barras Térmica Zebra ZT231', 'Zebra',
    'Zebra · modelo ZT23142-T0E000FZ. Impresora robusta con chasis metálico para etiquetado de palés, embalajes logísticos y trazabilidad.', 'Zebra · modelo ZT23142-T0E000FZ. Impresora robusta con chasis metálico para etiquetado de palés, embalajes logísticos y trazabilidad.',
    'https://img.pccomponentes.com/articles/32/324190/168-zebra-zt231-impresora-etiquetas.jpg', 'Impresora de etiquetas térmica industrial Zebra ZT231', null,
    4.8, 21, false, true, now()
  )
  on conflict (id) do update set
    slug = excluded.slug,
    sku = excluded.sku,
    name = excluded.name,
    brand = excluded.brand,
    summary = excluded.summary,
    description = excluded.description,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    rating_average = excluded.rating_average,
    rating_count = excluded.rating_count,
    is_featured = excluded.is_featured,
    is_published = true,
    updated_at = now();

  -- Category Links
  insert into public.product_categories (product_id, category_id)
  values ('tel-dig-050', 'digitalizacion-industria-conectada')
  on conflict (product_id, category_id) do nothing;
  insert into public.product_categories (product_id, category_id)
  values ('tel-dig-050', 'captura-datos-trazabilidad')
  on conflict (product_id, category_id) do nothing;

  -- Variant
  insert into public.product_variants (
    id, product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
  ) values (
    'ab8a60f4-913d-4a7d-8812-f245921e0fe1', 'tel-dig-050', 'NDR-TEL-DIG-050', 'Estándar',
    jsonb_build_object(
      'nodria_store', jsonb_build_object(
        'mode', 'academic_demo',
        'model_number', 'ZT23142-T0E000FZ',
        'brand', 'Zebra',
        'inventory_seeded', true
      )
    ),
    729.00, null, 'EUR', 0.21, true
  )
  on conflict (sku) do update set
    product_id = excluded.product_id,
    title = excluded.title,
    attributes = excluded.attributes,
    current_price = excluded.current_price,
    currency = excluded.currency,
    tax_rate = excluded.tax_rate,
    is_active = true,
    updated_at = now();

  -- Initial Stock
  insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
  values (v_warehouse_id, 'ab8a60f4-913d-4a7d-8812-f245921e0fe1', 0, 0)
  on conflict (warehouse_id, variant_id) do nothing;

  select greatest(0, i.on_hand - i.reserved) into v_available
  from public.inventory i
  where i.warehouse_id = v_warehouse_id and i.variant_id = 'ab8a60f4-913d-4a7d-8812-f245921e0fe1';

  if v_available < 10 then
    perform private.adjust_inventory(
      v_warehouse_id,
      'ab8a60f4-913d-4a7d-8812-f245921e0fe1',
      10 - v_available,
      'Alta inicial de existencias catálogo telecomunicaciones NODRIA'
    );
  end if;

  -- Specifications
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-050', 'Método de impresión', 'Transferencia térmica por ribbon y térmica directa sobre papel continuo', 10)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-050', 'Resolución de cabezal', '203 dpi (8 puntos/mm) para textos nítidos y códigos legibles', 20)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-050', 'Velocidad de avance', 'Hasta 305 mm por segundo (12 pulgadas por segundo)', 30)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-050', 'Anchura máxima de etiqueta', '104 mm con ajuste milimétrico de sensor de marca negra y hueco', 40)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-050', 'Pantalla de operador', 'Pantalla táctil a color de 4,3" con asistentes interactivos de calibración', 50)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;
  insert into public.product_specifications (product_id, label, value, sort_order)
  values ('tel-dig-050', 'Comunicaciones integradas', 'Ethernet 10/100, USB 2.0, USB Host para escáner y puerto serie RS-232', 60)
  on conflict (product_id, label) do update set
    value = excluded.value,
    sort_order = excluded.sort_order;

end
$telecom_migration$;

commit;
