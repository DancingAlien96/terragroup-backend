-- Portada del proyecto: imagen usada como hero en el card del listado y en
-- el editor de croquis. Nullable — los proyectos existentes muestran un
-- placeholder gradient hasta que el dueño suba una imagen.

ALTER TABLE `proyectos`
  ADD COLUMN `portada_url` VARCHAR(512) NULL;
