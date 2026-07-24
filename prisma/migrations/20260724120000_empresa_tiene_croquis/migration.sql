-- Gate del add-on Croquis por empresa. FALSE por default (feature bloqueada),
-- se activa manualmente desde el panel super-admin o cuando el webhook del
-- add-on confirme el pago. Sirve de fallback cuando el pago falla o cuando
-- el cliente tiene un acuerdo fuera de Recurrente.

ALTER TABLE `empresas`
  ADD COLUMN `tiene_croquis` BOOLEAN NOT NULL DEFAULT FALSE;
