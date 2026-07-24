-- ============================================================================
-- Croquis (mapa interactivo del proyecto) + coordenadas de pin en Lote
-- ----------------------------------------------------------------------------
-- Un croquis por proyecto: una imagen del plano de la lotificación que el
-- dueño sube. Cada Lote adquiere puntoX/puntoY (normalizados 0-1) que marcan
-- dónde va su pin sobre la imagen. Coordenadas normalizadas para que el pin
-- siga bien la imagen aun si se re-escala en el frontend.
--
-- publico_activo + publico_token: link compartible tipo /publico/croquis/:token
-- sin necesidad de login (para que dueños de lotificaciones lo pasen por
-- WhatsApp a posibles clientes).
--
-- Backfill: nada que backfillear (tabla nueva). Lote gana columnas nullable,
-- así los lotes existentes simplemente aparecen "sin pin colocado" — el dueño
-- los va marcando en el editor. No hay NOT NULL en las nuevas columnas.
-- ============================================================================

CREATE TABLE `croquis` (
  `id`                INT           NOT NULL AUTO_INCREMENT,
  `empresa_id`        INT           NOT NULL,
  `proyecto_id`       INT           NOT NULL,
  `imagen_url`        VARCHAR(512)  NOT NULL,
  `imagen_ancho`      INT           NULL,
  `imagen_alto`       INT           NULL,
  `publico_activo`    BOOLEAN       NOT NULL DEFAULT FALSE,
  `publico_token`     VARCHAR(64)   NULL,
  `contacto_whatsapp` VARCHAR(20)   NULL,
  `contacto_email`    VARCHAR(150)  NULL,
  `created_at`        DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`        DATETIME(3)   NOT NULL,

  UNIQUE INDEX `croquis_proyecto_id_key` (`proyecto_id`),
  UNIQUE INDEX `croquis_publico_token_key` (`publico_token`),
  INDEX `croquis_empresa_id_idx` (`empresa_id`),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `croquis`
  ADD CONSTRAINT `croquis_empresa_id_fkey`
    FOREIGN KEY (`empresa_id`) REFERENCES `empresas`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `croquis`
  ADD CONSTRAINT `croquis_proyecto_id_fkey`
    FOREIGN KEY (`proyecto_id`) REFERENCES `proyectos`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Pin del lote en el croquis. NULL = todavía no está marcado en el mapa.
ALTER TABLE `lotes`
  ADD COLUMN `punto_x`                DOUBLE  NULL,
  ADD COLUMN `punto_y`                DOUBLE  NULL,
  ADD COLUMN `mostrar_precio_publico` BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN `notas_publicas`         TEXT    NULL;
