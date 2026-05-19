-- TerraGroup — Inicialización de BD
-- El esquema completo lo gestiona Prisma (ver prisma/schema.prisma).
-- Este archivo solo asegura que la BD existe con el charset correcto.

CREATE DATABASE IF NOT EXISTS terragroup
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
