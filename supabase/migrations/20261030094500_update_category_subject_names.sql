-- NODRIA — Update Category Names to Exact STI Curricular Subjects
-- Updates the 5 root categories to use the verbatim subject titles and slugs from the
-- Ciclo Formativo de Grado Superior en Sistemas de Telecomunicaciones e Informáticos (STI).

begin;

update public.categories
   set name = 'Técnicas y procesos en infraestructuras de telecomunicaciones',
       slug = 'tecnicas-procesos-infraestructuras-telecomunicaciones',
       updated_at = now()
 where id = '15cbe619-16f5-4f12-80ef-e0169c9f2ab9';

update public.categories
   set name = 'Elementos de sistemas de telecomunicaciones',
       slug = 'elementos-sistemas-telecomunicaciones',
       updated_at = now()
 where id = '086ece91-23e4-4cfe-8b8d-269a61b2c3b4';

update public.categories
   set name = 'Sistemas integrados y hogar digital',
       slug = 'sistemas-integrados-hogar-digital',
       updated_at = now()
 where id = '677fd6b6-fb71-42ca-8469-ce47dd6541b1';

update public.categories
   set name = 'Sistemas de telefonía fija y móvil',
       slug = 'sistemas-telefonia-fija-movil',
       updated_at = now()
 where id = 'aa1c17c2-397a-4a16-8298-5a7b4e3862c9';

update public.categories
   set name = 'Digitalización aplicada a los sectores productivos',
       slug = 'digitalizacion-aplicada-sectores-productivos',
       updated_at = now()
 where id = '3e380976-47d1-4b9b-89c7-1145f4b9765b';

commit;
