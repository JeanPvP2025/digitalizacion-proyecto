-- Demo-only NODRIA catalogue and prospect records. No Auth users or credentials are seeded.

insert into public.categories (slug, name, description, sort_order, is_active)
values
  ('ordenadores', 'Ordenadores', 'Portátiles, sobremesa y workstations', 10, true),
  ('componentes', 'Componentes', 'Piezas para crear tu propio equipo', 20, true),
  ('monitores', 'Monitores', 'Color, resolución y fluidez', 30, true),
  ('redes', 'Redes', 'Conectividad sin límites', 40, true),
  ('telefonia', 'Telefonía', 'Móvil, tablet y accesorios', 50, true),
  ('almacenamiento', 'Almacenamiento', 'Tus datos, siempre a mano', 60, true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

insert into public.products (
  id, slug, sku, name, brand, summary, description, image_url, image_alt, badge,
  rating_average, rating_count, is_featured, is_published, published_at
)
values
  (
    'pr_fluxbook14', 'fluxbook-14-pro', 'NOD-FB14-PRO', 'FluxBook 14 Pro', 'NODRIA',
    'Rendimiento de estación de trabajo en un chasis ligero, construido para crear sin límites.',
    'Portátil profesional NODRIA con pantalla OLED de alta resolución y almacenamiento rápido.',
    'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1200&q=85',
    'Portátil fino de aluminio abierto sobre una mesa de trabajo', '-200 €', 4.8, 126, true, true, now()
  ),
  (
    'pr_foundry_s', 'foundry-s-studio', 'NOD-FS-02', 'Foundry S Studio', 'NODRIA',
    'Una workstation silenciosa y equilibrada para proyectos exigentes y largas jornadas.',
    'Equipo de sobremesa ensamblado para creación profesional y cargas de trabajo exigentes.',
    'https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=1200&q=85',
    'Torre de ordenador de sobremesa en un escritorio de trabajo', 'Montaje gratuito', 4.9, 84, true, true, now()
  ),
  (
    'pr_loom27', 'loom-27-4k', 'NOD-LM27-4K', 'Loom 27 4K', 'NODRIA',
    'Color preciso, negros profundos y espacio de sobra para dar forma a cada detalle.',
    'Monitor profesional 4K con panel IPS Black y frecuencia de actualización de 144 Hz.',
    'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=1200&q=85',
    'Monitor de escritorio de alta resolución visto de frente', '-10 %', 4.7, 52, true, true, now()
  ),
  (
    'pr_linkmesh', 'linkmesh-x7-pro', 'NOD-LMX7-PRO', 'LinkMesh X7 Pro', 'NODRIA',
    'Wi-Fi 7 de nueva generación con una cobertura estable para hogares conectados.',
    'Sistema de red Wi-Fi 7 con conectividad multigigabit para hogares y espacios de trabajo.',
    'https://images.unsplash.com/photo-1606904825846-647eb07f5be2?auto=format&fit=crop&w=1200&q=85',
    'Router inalámbrico de diseño compacto en un entorno doméstico', null, 4.6, 41, false, true, now()
  ),
  (
    'pr_slateair', 'slate-air-11', 'NOD-SA11-256', 'Slate Air 11', 'NODRIA',
    'Una pantalla amplia y ligera para trabajar, estudiar y desconectar en cualquier lugar.',
    'Tablet ligera con 256 GB de almacenamiento y pantalla de 11 pulgadas.',
    'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=1200&q=85',
    'Tablet ligera de color claro junto a accesorios de trabajo', null, 4.5, 63, false, true, now()
  ),
  (
    'pr_arcssd', 'arc-ssd-2tb', 'NOD-ARC-2T', 'Arc SSD 2 TB', 'NODRIA',
    'Carga tus proyectos en segundos con almacenamiento NVMe rápido y fiable.',
    'Unidad NVMe PCIe 4.0 de 2 TB, con hasta 7.100 MB/s de lectura secuencial.',
    'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=1200&q=85',
    'Unidad de almacenamiento SSD compacta sobre fondo neutro', null, 4.8, 98, false, true, now()
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
  badge = excluded.badge,
  rating_average = excluded.rating_average,
  rating_count = excluded.rating_count,
  is_featured = excluded.is_featured,
  is_published = excluded.is_published,
  published_at = excluded.published_at;

insert into public.product_categories (product_id, category_id)
select mapping.product_id, categories.id
from (values
  ('pr_fluxbook14', 'ordenadores'),
  ('pr_foundry_s', 'ordenadores'),
  ('pr_loom27', 'monitores'),
  ('pr_linkmesh', 'redes'),
  ('pr_slateair', 'telefonia'),
  ('pr_arcssd', 'almacenamiento')
) as mapping(product_id, category_slug)
join public.categories on categories.slug = mapping.category_slug
on conflict (product_id, category_id) do nothing;

insert into public.product_variants (
  product_id, sku, title, attributes, current_price, compare_at_price, currency, tax_rate, is_active
)
values
  ('pr_fluxbook14', 'NOD-FB14-PRO', '32 GB · 1 TB', '{"memory":"32 GB LPDDR5X","storage":"1 TB NVMe Gen 4"}', 1499.00, 1699.00, 'EUR', 0.21, true),
  ('pr_foundry_s', 'NOD-FS-02', '64 GB · 2 TB', '{"memory":"64 GB DDR5 6000","storage":"2 TB NVMe Gen 4"}', 2499.00, null, 'EUR', 0.21, true),
  ('pr_loom27', 'NOD-LM27-4K', 'IPS Black · 144 Hz', '{"panel":"IPS Black","resolution":"3840 × 2160","refresh_rate":"144 Hz"}', 629.00, 699.00, 'EUR', 0.21, true),
  ('pr_linkmesh', 'NOD-LMX7-PRO', 'Wi-Fi 7', '{"standard":"Wi-Fi 7 · 802.11be","coverage":"230 m²"}', 289.00, null, 'EUR', 0.21, true),
  ('pr_slateair', 'NOD-SA11-256', '256 GB', '{"memory":"8 GB","storage":"256 GB","display":"11 pulgadas"}', 549.00, null, 'EUR', 0.21, true),
  ('pr_arcssd', 'NOD-ARC-2T', '2 TB', '{"capacity":"2 TB","interface":"NVMe PCIe 4.0 ×4"}', 179.00, null, 'EUR', 0.21, true)
on conflict (sku) do update set
  product_id = excluded.product_id,
  title = excluded.title,
  attributes = excluded.attributes,
  current_price = excluded.current_price,
  compare_at_price = excluded.compare_at_price,
  currency = excluded.currency,
  tax_rate = excluded.tax_rate,
  is_active = excluded.is_active;

insert into public.product_specifications (product_id, label, value, sort_order)
values
  ('pr_fluxbook14', 'Procesador', 'NODRIA Core 9 · 16 núcleos', 10),
  ('pr_fluxbook14', 'Memoria', '32 GB LPDDR5X', 20),
  ('pr_fluxbook14', 'Almacenamiento', '1 TB NVMe Gen 4', 30),
  ('pr_fluxbook14', 'Pantalla', '14″ OLED · 2.8K · 120 Hz', 40),
  ('pr_foundry_s', 'Procesador', 'AMD Ryzen 9 9900X', 10),
  ('pr_foundry_s', 'Gráfica', 'NVIDIA GeForce RTX 5070 Ti · 16 GB', 20),
  ('pr_foundry_s', 'Memoria', '64 GB DDR5 6000', 30),
  ('pr_foundry_s', 'Almacenamiento', '2 TB NVMe Gen 4', 40),
  ('pr_loom27', 'Panel', 'IPS Black · 27 pulgadas', 10),
  ('pr_loom27', 'Resolución', '3840 × 2160 · 4K UHD', 20),
  ('pr_loom27', 'Frecuencia', '144 Hz · Adaptive Sync', 30),
  ('pr_loom27', 'Conexiones', '2× HDMI 2.1 · USB-C 90 W', 40),
  ('pr_linkmesh', 'Estándar', 'Wi-Fi 7 · 802.11be', 10),
  ('pr_linkmesh', 'Velocidad', 'Hasta 11 Gbps', 20),
  ('pr_linkmesh', 'Puertos', '1× 10 GbE · 4× 2.5 GbE', 30),
  ('pr_linkmesh', 'Cobertura', 'Hasta 230 m² por unidad', 40),
  ('pr_slateair', 'Procesador', 'NODRIA A8 · 8 núcleos', 10),
  ('pr_slateair', 'Memoria', '8 GB', 20),
  ('pr_slateair', 'Almacenamiento', '256 GB', 30),
  ('pr_slateair', 'Pantalla', '11″ Liquid Retina · 120 Hz', 40),
  ('pr_arcssd', 'Capacidad', '2 TB', 10),
  ('pr_arcssd', 'Interfaz', 'NVMe PCIe 4.0 ×4', 20),
  ('pr_arcssd', 'Lectura secuencial', 'Hasta 7.100 MB/s', 30),
  ('pr_arcssd', 'Garantía', '5 años limitada', 40)
on conflict (product_id, label) do update set
  value = excluded.value,
  sort_order = excluded.sort_order;

insert into public.warehouses (code, name, city, country_code, is_active)
values ('MAD-CENTRAL', 'NODRIA Centro logístico Madrid', 'Madrid', 'ES', true)
on conflict (code) do update set
  name = excluded.name,
  city = excluded.city,
  country_code = excluded.country_code,
  is_active = excluded.is_active;

insert into public.inventory (warehouse_id, variant_id, on_hand, reserved)
select w.id, v.id, stock.on_hand, 0
from (values
  ('NOD-FB14-PRO', 14),
  ('NOD-FS-02', 6),
  ('NOD-LM27-4K', 21),
  ('NOD-LMX7-PRO', 18),
  ('NOD-SA11-256', 32),
  ('NOD-ARC-2T', 47)
) as stock(sku, on_hand)
join public.product_variants v on v.sku = stock.sku
join public.warehouses w on w.code = 'MAD-CENTRAL'
on conflict (warehouse_id, variant_id) do nothing;

insert into public.crm_leads (contact_name, email, phone, company, source, message, consent_to_contact)
select 'Cliente demo NODRIA', 'demo.cliente@nodria.example', '+34 910 000 321', 'Estudio Prisma', 'seed',
  'Solicitud de información para equipar un pequeño estudio creativo.', true
where not exists (
  select 1 from public.crm_leads where email = 'demo.cliente@nodria.example' and source = 'seed'
);

insert into public.quote_inquiries (contact_name, email, phone, company, message, consent_to_contact, source)
select 'Ana Martín', 'ana.martin@estudioprisma.example', '+34 910 000 322', 'Estudio Prisma',
  'Presupuesto para cuatro estaciones Foundry S Studio y cuatro monitores Loom 27 4K.', true, 'seed'
where not exists (
  select 1 from public.quote_inquiries where email = 'ana.martin@estudioprisma.example' and source = 'seed'
);
