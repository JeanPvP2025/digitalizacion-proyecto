-- Migration: 20261029143000_update_telecom_real_product_images.sql
-- Updates image_url and image_alt for all 52 telecom products with real commercial photographs.

begin;

update public.products
set image_url = '/images/products/tel-inf-001.jpg',
    image_alt = 'Fotografía comercial: Rack Mural 19" 9U Profundidad 600mm Puerta de Cristal (Legrand 446209)',
    updated_at = now()
where id = 'tel-inf-001';

update public.products
set image_url = '/images/products/tel-inf-002.jpg',
    image_alt = 'Fotografía comercial: Armario Rack de Suelo 19" 42U 800x1000mm con Guías de Gestión (Schneider Electric NSYVD24U84P)',
    updated_at = now()
where id = 'tel-inf-002';

update public.products
set image_url = '/images/products/tel-inf-003.png',
    image_alt = 'Fotografía comercial: Bobina Cable de Red U/FTP Cat.6A LSZH 500m 500MHz Libre de Halógenos (Televes 219901)',
    updated_at = now()
where id = 'tel-inf-003';

update public.products
set image_url = '/images/products/tel-inf-004.jpg',
    image_alt = 'Fotografía comercial: Bobina Cable de Red S/FTP Cat.7 PIMF 1000MHz 305m Apantallado (Televes 219910)',
    updated_at = now()
where id = 'tel-inf-004';

update public.products
set image_url = '/images/products/tel-inf-005.jpg',
    image_alt = 'Fotografía comercial: Manguera Fibra Óptica Preconectorizada Monomodo OS2 12 Fibras LC-LC 50m (Legrand 032585)',
    updated_at = now()
where id = 'tel-inf-005';

update public.products
set image_url = '/images/products/tel-inf-006.jpg',
    image_alt = 'Fotografía comercial: Bandeja Distribuidora de Fibra Óptica 19" 1U 24 Puertos SC/APC con Pigtails (Televes 233003)',
    updated_at = now()
where id = 'tel-inf-006';

update public.products
set image_url = '/images/products/tel-inf-007.jpg',
    image_alt = 'Fotografía comercial: Panel de Parcheo 19" 24 Puertos Cat.6A FTP 1U con Guía Trasera (Schneider Electric VDIB17726B12)',
    updated_at = now()
where id = 'tel-inf-007';

update public.products
set image_url = '/images/products/tel-inf-008.jpg',
    image_alt = 'Fotografía comercial: Organizador de Cables Horizontal 19" 1U con Tapa Frontal y 5 Anillas (Legrand 646520)',
    updated_at = now()
where id = 'tel-inf-008';

update public.products
set image_url = '/images/products/tel-inf-009.jpg',
    image_alt = 'Fotografía comercial: Certificador de Redes de Cobre Cat.6A Fluke DSX-602 INTL (Fluke Networks DSX-602-INTL)',
    updated_at = now()
where id = 'tel-inf-009';

update public.products
set image_url = '/images/products/tel-inf-010.jpg',
    image_alt = 'Fotografía comercial: Fusionadora de Fibra Óptica por Alineación de Núcleo 6 Motores (Televes 232103)',
    updated_at = now()
where id = 'tel-inf-010';

update public.products
set image_url = '/images/products/tel-eqt-011.jpg',
    image_alt = 'Fotografía comercial: Switch Gestionable L3 24 Puertos Gigabit PoE+/PoE++ y 2 SFP+ 10G UniFi Pro (Ubiquiti USW-Pro-24-POE)',
    updated_at = now()
where id = 'tel-eqt-011';

update public.products
set image_url = '/images/products/tel-eqt-012.jpg',
    image_alt = 'Fotografía comercial: Switch Gestionable 48 Puertos Gigabit PoE+ y 4 SFP+ Cisco Catalyst 1000 (Cisco C1000-48P-4X-L)',
    updated_at = now()
where id = 'tel-eqt-012';

update public.products
set image_url = '/images/products/tel-eqt-013.jpg',
    image_alt = 'Fotografía comercial: Router de Agregación de Borde y Firewall UniFi Dream Machine SE (Ubiquiti UDM-SE)',
    updated_at = now()
where id = 'tel-eqt-013';

update public.products
set image_url = '/images/products/tel-eqt-014.jpg',
    image_alt = 'Fotografía comercial: Router de Borde Multi-WAN Gigabit RouterBOARD RB5009UG+S+IN (MikroTik RB5009UG+S+IN)',
    updated_at = now()
where id = 'tel-eqt-014';

update public.products
set image_url = '/images/products/tel-eqt-015.png',
    image_alt = 'Fotografía comercial: Punto de Acceso Wi-Fi 7 Tri-Banda Empresarial UniFi U7 Pro (Ubiquiti U7-Pro)',
    updated_at = now()
where id = 'tel-eqt-015';

update public.products
set image_url = '/images/products/tel-eqt-016.webp',
    image_alt = 'Fotografía comercial: Punto de Acceso Wi-Fi 6 AX3000 de Techo para Alta Densidad cAP AX (MikroTik cAPGi-5HaxD2HaxD)',
    updated_at = now()
where id = 'tel-eqt-016';

update public.products
set image_url = '/images/products/tel-eqt-017.png',
    image_alt = 'Fotografía comercial: Transceptor Óptico SFP+ 10G LR Monomodo 1310nm 10km DDM (Ubiquiti UACC-OM-SM-10G-D-2)',
    updated_at = now()
where id = 'tel-eqt-017';

update public.products
set image_url = '/images/products/tel-eqt-018.webp',
    image_alt = 'Fotografía comercial: Módulo Transceptor SFP+ 10GBASE-T RJ45 Cobre hasta 30m (MikroTik S+RJ10)',
    updated_at = now()
where id = 'tel-eqt-018';

update public.products
set image_url = '/images/products/tel-eqt-019.png',
    image_alt = 'Fotografía comercial: Central Amplificadora Programable de Cabecera Avant X Pro UHF/VHF/FM (Televes 532121)',
    updated_at = now()
where id = 'tel-eqt-019';

update public.products
set image_url = '/images/products/tel-eqt-020.jpg',
    image_alt = 'Fotografía comercial: Transmodulador Óptico de Cabecera DVB-S2 a DVB-T/C con Ranura CI (Televes 565101)',
    updated_at = now()
where id = 'tel-eqt-020';

update public.products
set image_url = '/images/products/tel-dom-021.jpg',
    image_alt = 'Fotografía comercial: Hub Domótico Multiprotocolo Zigbee 3.0, Matter y Thread Aqara Hub M3 (Aqara HM-G01E)',
    updated_at = now()
where id = 'tel-dom-021';

update public.products
set image_url = '/images/products/tel-dom-022.jpg',
    image_alt = 'Fotografía comercial: Controlador Domótico Z-Wave Plus Home Center 3 Lite (Fibaro FGHC3L-001)',
    updated_at = now()
where id = 'tel-dom-022';

update public.products
set image_url = '/images/products/tel-dom-023.jpg',
    image_alt = 'Fotografía comercial: Relé Inteligente 4 Canales para Carril DIN con Medición de Potencia Shelly Pro 4PM (Shelly SHELLY-PRO-4PM)',
    updated_at = now()
where id = 'tel-dom-023';

update public.products
set image_url = '/images/products/tel-dom-024.jpg',
    image_alt = 'Fotografía comercial: Micromódulo Interruptor Empotrable Wi-Fi con Medición de Potencia Shelly 1PM Gen3 (Shelly SHELLY-1PM-G3)',
    updated_at = now()
where id = 'tel-dom-024';

update public.products
set image_url = '/images/products/tel-dom-025.png',
    image_alt = 'Fotografía comercial: Sensor de Presencia Humana por Radar Milimétrico mmWave FP2 Aqara (Aqara PS-S02D)',
    updated_at = now()
where id = 'tel-dom-025';

update public.products
set image_url = '/images/products/tel-dom-026.png',
    image_alt = 'Fotografía comercial: Sensor Ambiental de Calidad de Aire Temperatura y Humedad TVOC Zigbee (Aqara AAQS-S01)',
    updated_at = now()
where id = 'tel-dom-026';

update public.products
set image_url = '/images/products/tel-dom-027.png',
    image_alt = 'Fotografía comercial: Videoportero IP PoE con Cámara 2K y Lector NFC UniFi G4 Doorbell Pro PoE (Ubiquiti UVC-G4-Doorbell-Pro-PoE)',
    updated_at = now()
where id = 'tel-dom-027';

update public.products
set image_url = '/images/products/tel-dom-028.jpg',
    image_alt = 'Fotografía comercial: Cerradura Electrónica Inteligente Matter sobre Thread con Teclado Táctil y Biometría Aqara U200 (Aqara EL-D02D)',
    updated_at = now()
where id = 'tel-dom-028';

update public.products
set image_url = '/images/products/tel-dom-029.jpg',
    image_alt = 'Fotografía comercial: Termostato Inteligente Modulante OpenTherm y Relé para Caldera/Bomba de Calor (Schneider Electric CCTFR6700)',
    updated_at = now()
where id = 'tel-dom-029';

update public.products
set image_url = '/images/products/tel-dom-030.jpg',
    image_alt = 'Fotografía comercial: Cabezal Termostático Inteligente para Radiador Wi-Fi con Pantalla LED Shelly TRV (Shelly SHELLY-TRV)',
    updated_at = now()
where id = 'tel-dom-030';

update public.products
set image_url = '/images/products/tel-tel-031.jpg',
    image_alt = 'Fotografía comercial: Centralita Telefónica IP-PBX Grandstream UCM6302 hasta 1000 Usuarios y 150 Llamadas (Grandstream UCM6302)',
    updated_at = now()
where id = 'tel-tel-031';

update public.products
set image_url = '/images/products/tel-tel-032.jpg',
    image_alt = 'Fotografía comercial: Centralita Telefónica IP Compacta Grandstream UCM6204 con 4 Puertos FXO (Grandstream UCM6204)',
    updated_at = now()
where id = 'tel-tel-032';

update public.products
set image_url = '/images/products/tel-tel-033.jpg',
    image_alt = 'Fotografía comercial: Teléfono IP Ejecutivo Yealink SIP-T54W con Pantalla Color 4.3" y Wi-Fi/Bluetooth (Yealink SIP-T54W)',
    updated_at = now()
where id = 'tel-tel-033';

update public.products
set image_url = '/images/products/tel-tel-034.jpg',
    image_alt = 'Fotografía comercial: Sistema Telefónico Inalámbrico DECT IP Yealink W73P Base + Terminal (Yealink W73P)',
    updated_at = now()
where id = 'tel-tel-034';

update public.products
set image_url = '/images/products/tel-tel-035.jpg',
    image_alt = 'Fotografía comercial: Pasarela VoIP FXS 16 Puertos Grandstream GXW4216 para Extensiones Analógicas (Grandstream GXW4216)',
    updated_at = now()
where id = 'tel-tel-035';

update public.products
set image_url = '/images/products/tel-tel-036.jpg',
    image_alt = 'Fotografía comercial: Gateway VoIP Digital ISDN BRI 2 Puertos Patton SmartNode SN4120 (Patton SN4120/2BIS4V)',
    updated_at = now()
where id = 'tel-tel-036';

update public.products
set image_url = '/images/products/tel-tel-037.png',
    image_alt = 'Fotografía comercial: Router Celular Industrial 4G LTE Cat 4 Teltonika RUT241 (Teltonika RUT241)',
    updated_at = now()
where id = 'tel-tel-037';

update public.products
set image_url = '/images/products/tel-tel-038.png',
    image_alt = 'Fotografía comercial: Router Celular Industrial 5G y Wi-Fi 6 Dual SIM Teltonika RUTX50 (Teltonika RUTX50)',
    updated_at = now()
where id = 'tel-tel-038';

update public.products
set image_url = '/images/products/tel-tel-039.jpg',
    image_alt = 'Fotografía comercial: Antena Exterior Omnidireccional 4G/5G MIMO 698-3800 MHz 6 dBi Teltonika PR1KMO40 (Teltonika PR1KMO40)',
    updated_at = now()
where id = 'tel-tel-039';

update public.products
set image_url = '/images/products/tel-tel-040.jpg',
    image_alt = 'Fotografía comercial: Amplificador de Señal Móvil 4G/5G Multibanda para Interiores StellaHome (Televes 403001)',
    updated_at = now()
where id = 'tel-tel-040';

update public.products
set image_url = '/images/products/tel-dig-041.jpg',
    image_alt = 'Fotografía comercial: Gateway IoT Industrial Edge Advantech UNO-2271G-V2 con Modbus y MQTT (Advantech UNO-2271G-V2)',
    updated_at = now()
where id = 'tel-dig-041';

update public.products
set image_url = '/images/products/tel-dig-042.jpg',
    image_alt = 'Fotografía comercial: Módulo de E/S Remotas Modbus TCP Ethernet Phoenix Contact Axioline Smart Elements (Phoenix Contact AXL-SE-SC-A)',
    updated_at = now()
where id = 'tel-dig-042';

update public.products
set image_url = '/images/products/tel-dig-043.jpg',
    image_alt = 'Fotografía comercial: Servidor Edge Fanless Industrial Advantech ARK-1220L para Inferencia IA (Advantech ARK-1220L-S6A1E)',
    updated_at = now()
where id = 'tel-dig-043';

update public.products
set image_url = '/images/products/tel-dig-044.jpg',
    image_alt = 'Fotografía comercial: Micro Servidor Edge Fanless con Doble 2.5GbE y 4 Puertos Serie Moxa V2201 (Moxa V2201-E4-W-T)',
    updated_at = now()
where id = 'tel-dig-044';

update public.products
set image_url = '/images/products/tel-dig-045.jpg',
    image_alt = 'Fotografía comercial: Servidor de Almacenamiento en Red NAS 4 Bahías Synology DiskStation DS923+ (Synology DS923+)',
    updated_at = now()
where id = 'tel-dig-045';

update public.products
set image_url = '/images/products/tel-dig-046.jpg',
    image_alt = 'Fotografía comercial: Servidor de Almacenamiento NAS en Rack 19" 1U 4 Bahías Synology RackStation RS822+ (Synology RS822+)',
    updated_at = now()
where id = 'tel-dig-046';

update public.products
set image_url = '/images/products/ref-storage-snv3sm3-1t0.jpg',
    image_alt = 'Fotografía comercial: SSD Kingston NV3 1TB M.2 2230 PCIe 4.0 NVMe 6000MB/s 3D NAND Gaming (Kingston SNV3SM3/1T0)',
    updated_at = now()
where id = 'ref-storage-snv3sm3-1t0';

update public.products
set image_url = '/images/products/ref-storage-mz-v9p1t0bw.jpg',
    image_alt = 'Fotografía comercial: Samsung 990 Pro 1TB Disco SSD 7450MB/S NVMe PCIe 4.0 M.2 Gen4 (Samsung MZ-V9P1T0BW)',
    updated_at = now()
where id = 'ref-storage-mz-v9p1t0bw';

update public.products
set image_url = '/images/products/tel-dig-047.jpg',
    image_alt = 'Fotografía comercial: Sensor Industrial de Temperatura y Humedad Modbus RTU RS-485 IP65 (Schneider Electric METSETH01)',
    updated_at = now()
where id = 'tel-dig-047';

update public.products
set image_url = '/images/products/tel-dig-048.jpg',
    image_alt = 'Fotografía comercial: Transmisor de Presión Industrial 4-20mA y Modbus RTU 0-10 Bar Acero Inoxidable (Schneider Electric XMLP010BC71F)',
    updated_at = now()
where id = 'tel-dig-048';

update public.products
set image_url = '/images/products/tel-dig-049.jpg',
    image_alt = 'Fotografía comercial: Terminal Portátil PDA Móvil Industrial con Lector 2D Zebra TC22 (Zebra TC220K-01B112-A6)',
    updated_at = now()
where id = 'tel-dig-049';

update public.products
set image_url = '/images/products/tel-dig-050.jpg',
    image_alt = 'Fotografía comercial: Impresora Industrial de Etiquetas y Códigos de Barras Térmica Zebra ZT231 (Zebra ZT23142-T0E000FZ)',
    updated_at = now()
where id = 'tel-dig-050';

commit;
