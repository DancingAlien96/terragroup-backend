-- Terragroup Database Initialization SQL
-- Uso: este archivo se puede ejecutar en el contenedor MySQL al iniciar.

CREATE DATABASE IF NOT EXISTS terragroup
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE terragroup;

-- Tabla de planes de suscripción
CREATE TABLE IF NOT EXISTS planes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL UNIQUE,
  precio DECIMAL(10,2) NOT NULL,
  max_lotes INT NOT NULL,
  max_usuarios INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Empresas cliente (tenants)
CREATE TABLE IF NOT EXISTS empresas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  email VARCHAR(150) NULL,
  telefono VARCHAR(20) NULL,
  rfc VARCHAR(20) NULL,
  plan_id INT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_inicio DATE NULL,
  fecha_vence DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_empresas_plan FOREIGN KEY (plan_id) REFERENCES planes(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Usuarios de cada empresa
CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  username VARCHAR(80) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  rol ENUM('superadmin','admin','vendedor','supervisor') NOT NULL DEFAULT 'admin',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_usuarios_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Lotes de terreno
CREATE TABLE IF NOT EXISTS lotes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  clave VARCHAR(50) NOT NULL,
  manzana VARCHAR(20) NULL,
  numero VARCHAR(20) NULL,
  superficie DECIMAL(10,2) NULL,
  precio_venta DECIMAL(12,2) NULL,
  estado ENUM('disponible','vendido','reservado') NOT NULL DEFAULT 'disponible',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_lotes_empresa_clave UNIQUE (empresa_id, clave),
  CONSTRAINT fk_lotes_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Propietarios / compradores de lotes
CREATE TABLE IF NOT EXISTS propietarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  telefono VARCHAR(20) NULL,
  email VARCHAR(150) NULL,
  direccion TEXT NULL,
  estado_cuenta ENUM('al_dia','moroso','vencido','liquidado') NOT NULL DEFAULT 'al_dia',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_propietarios_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Contratos de venta / financiamiento
CREATE TABLE IF NOT EXISTS contratos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  propietario_id INT NOT NULL,
  lote_id INT NOT NULL,
  vendedor_id INT NOT NULL,
  precio_total DECIMAL(12,2) NOT NULL,
  enganche DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  mensualidad DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  num_mensualidades INT NOT NULL DEFAULT 0,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NULL,
  estado ENUM('activo','liquidado','cancelado') NOT NULL DEFAULT 'activo',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_contratos_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_contratos_propietario FOREIGN KEY (propietario_id) REFERENCES propietarios(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_contratos_lote FOREIGN KEY (lote_id) REFERENCES lotes(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_contratos_vendedor FOREIGN KEY (vendedor_id) REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Clientes (compradores de lotes)
CREATE TABLE IF NOT EXISTS clientes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  nombre_comprador VARCHAR(150) NOT NULL,
  descripcion_lote TEXT NULL,
  precio_neto DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  enganche DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  num_cuotas INT NOT NULL DEFAULT 0,
  valor_cuota DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  fecha_deposito DATE NOT NULL,
  num_transferencia VARCHAR(100) NULL,
  entidad_bancaria ENUM('Banrural','Industrial','G&T','BAC') NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_clientes_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pagos registrados en el sistema
CREATE TABLE IF NOT EXISTS pagos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  contrato_id INT NULL,
  propietario_id INT NULL,
  cliente_id INT NULL,
  num_cuota INT NULL,
  monto DECIMAL(12,2) NOT NULL,
  fecha_pago DATE NULL,
  fecha_vencimiento DATE NOT NULL,
  estado ENUM('pendiente','pagado','vencido') NOT NULL DEFAULT 'pendiente',
  metodo_pago VARCHAR(50) NULL,
  referencia VARCHAR(100) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pagos_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_pagos_contrato FOREIGN KEY (contrato_id) REFERENCES contratos(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_pagos_propietario FOREIGN KEY (propietario_id) REFERENCES propietarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_pagos_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notificaciones internas
CREATE TABLE IF NOT EXISTS notificaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  usuario_id INT NOT NULL,
  titulo VARCHAR(200) NOT NULL,
  mensaje TEXT NOT NULL,
  leida BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_notificaciones_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_notificaciones_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vendedores (standalone, independiente de usuarios)
CREATE TABLE IF NOT EXISTS vendedores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  edad INT NULL,
  telefono VARCHAR(20) NULL,
  email VARCHAR(150) NULL,
  dpi VARCHAR(30) NULL,
  direccion VARCHAR(255) NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_vendedores_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Comisiones de vendedores por lote vendido
CREATE TABLE IF NOT EXISTS comisiones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  vendedor_id INT NOT NULL,
  descripcion_lote VARCHAR(255) NOT NULL,
  porcentaje DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  monto_comision DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  fecha_venta DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_comisiones2_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_comisiones2_vendedor FOREIGN KEY (vendedor_id) REFERENCES vendedores(id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Índices adicionales para búsquedas frecuentes
CREATE INDEX idx_clientes_empresa ON clientes(empresa_id);
CREATE INDEX idx_usuarios_empresa ON usuarios(empresa_id);
CREATE INDEX idx_lotes_empresa ON lotes(empresa_id);
CREATE INDEX idx_propietarios_empresa ON propietarios(empresa_id);
CREATE INDEX idx_contratos_empresa ON contratos(empresa_id);
CREATE INDEX idx_pagos_empresa ON pagos(empresa_id);
CREATE INDEX idx_notificaciones_empresa ON notificaciones(empresa_id);

-- Datos iniciales de planes
INSERT IGNORE INTO planes (nombre, precio, max_lotes, max_usuarios)
VALUES
  ('basico', 45.00, 150, 1),
  ('profesional', 90.00, 300, 3),
  ('empresarial', 150.00, 1000, 5);

-- Empresa sistema para el super-administrador (no es un tenant real)
INSERT IGNORE INTO empresas (id, nombre, email, plan_id, activo, fecha_inicio)
VALUES (1, 'TerraGroup Sistema', 'admin@terragroup.com', 3, TRUE, CURDATE());

-- Super-admin por defecto: user=superadmin / pass=Admin1234!
-- Hash bcrypt de 'Admin1234!' con saltRounds=10
INSERT IGNORE INTO usuarios (id, empresa_id, nombre, email, username, password, rol, activo)
VALUES (
  1, 1, 'Super Administrador', 'superadmin@terragroup.com', 'superadmin',
  '$2a$10$JiABjXqCPn/K44N/.zY4he..HkDbMpsYhrsa.FZA9CZssqR9k.yZq',
  'superadmin', TRUE
);
-- IMPORTANTE: cambia la contraseña del superadmin en producción usando:
-- UPDATE usuarios SET password = '$2a$10$<nuevo_hash>' WHERE username = 'superadmin';

-- Empresas demo (3 tenants de prueba)
INSERT IGNORE INTO empresas (id, nombre, plan_id, activo, fecha_inicio)
VALUES
  (2, 'Lotificaciones del Norte S.A.', 1, TRUE, CURDATE()),
  (3, 'Terrenos Pacífico',             2, TRUE, CURDATE()),
  (4, 'Desarrollos San Pablo',         3, TRUE, CURDATE());

-- Usuarios admin de cada empresa demo
-- Todos con contraseña: Admin123!
-- Hash bcrypt de 'Admin123!' con saltRounds=10
INSERT IGNORE INTO usuarios (id, empresa_id, nombre, email, username, password, rol, activo)
VALUES
  (2, 2, 'Carlos Norte',   'carlos@lotnorte.com',   'carlos_norte',   '$2a$10$YiC4xNvhIDACWfuuTRFxQuEWKjSOfj2My8YOikr39wX2yyH.ZWd9y', 'admin', TRUE),
  (3, 3, 'María Pacífico', 'maria@terrenosp.com',   'maria_pacifico', '$2a$10$YiC4xNvhIDACWfuuTRFxQuEWKjSOfj2My8YOikr39wX2yyH.ZWd9y', 'admin', TRUE),
  (4, 4, 'Roberto SP',     'roberto@dessanpablo.com','roberto_sp',     '$2a$10$YiC4xNvhIDACWfuuTRFxQuEWKjSOfj2My8YOikr39wX2yyH.ZWd9y', 'admin', TRUE);

