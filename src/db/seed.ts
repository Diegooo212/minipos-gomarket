import Database from "@tauri-apps/plugin-sql";

export async function insertarDatosIniciales(db: Database) {
  const check = await db.select<{ count: number }[]>(
    "SELECT COUNT(*) as count FROM usuarios"
  );
  if (check[0].count > 0) return;

  await db.execute(`
    INSERT INTO categorias (nombre, color) VALUES
    ('Bebidas', '#3b82f6'),
    ('Abarrotes', '#f59e0b'),
    ('Lácteos', '#8b5cf6'),
    ('Panadería', '#f97316'),
    ('Aseo', '#10b981'),
    ('Snacks', '#ef4444'),
    ('Conservas', '#6366f1'),
    ('Cigarrillos', '#64748b'),
    ('Refrigerados', '#0ea5e9'),
    ('General', '#94a3b8');
  `);

  await db.execute(`
    INSERT INTO proveedores (nombre, contacto, telefono) VALUES
    ('Coca-Cola Andina', 'Juan Pérez', '+56912345678'),
    ('Distribuidora Central', 'María López', '+56987654321'),
    ('Proveedor General', '', '');
  `);

  await db.execute(`
    INSERT INTO usuarios (nombre, pin_hash, rol, activo) VALUES
    ('Administrador', '1234', 'admin', 1),
    ('Cajero 1', '1111', 'cajero', 1),
    ('Supervisor', '2222', 'supervisor', 1);
  `);

  await db.execute(`
    INSERT INTO productos (nombre, codigo_barra, precio_venta, precio_costo, stock, stock_minimo, categoria_id, unidad) VALUES
    ('Coca-Cola 1.5L',        '7802380',  1590, 950,  24, 6,  1, 'unidad'),
    ('Agua Vital 1.5L',       '7801000',  890,  500,  30, 6,  1, 'unidad'),
    ('Jugo Naranja 1L',       '7807890',  1290, 780,  18, 6,  1, 'unidad'),
    ('Cerveza Cristal 350cc', '7801234',  990,  600,  48, 12, 1, 'unidad'),
    ('Leche Entera 1L',       '7803456',  1190, 720,  32, 10, 3, 'unidad'),
    ('Yogur Natural 165g',    '7806789',  590,  350,  24, 6,  3, 'unidad'),
    ('Mantequilla 200g',      '7801620',  1890, 1100, 12, 4,  3, 'unidad'),
    ('Arroz 1kg',             '7804567',  1290, 750,  40, 10, 2, 'kg'),
    ('Fideos 500g',           '7808901',  890,  520,  36, 10, 2, 'unidad'),
    ('Aceite 1L',             '7809012',  2490, 1600, 20, 6,  2, 'unidad'),
    ('Azúcar 1kg',            '7800001',  990,  580,  30, 10, 2, 'kg'),
    ('Sal 1kg',               '7800002',  490,  280,  25, 8,  2, 'kg'),
    ('Atún 170g',             '7802800',  1190, 700,  24, 6,  7, 'unidad'),
    ('Pan Molde',             '7800003',  2290, 1400, 8,  4,  4, 'unidad'),
    ('Jabón Líquido',         '7805678',  2890, 1500, 3,  5,  5, 'unidad'),
    ('Papel Higiénico 4u',    '7802400',  2490, 1500, 15, 4,  5, 'unidad'),
    ('Lays 42g',              '7802230',  790,  480,  30, 10, 6, 'unidad'),
    ('Doritos 45g',           '7800222',  890,  540,  28, 10, 6, 'unidad'),
    ('Cigarro Marlboro',      '7500001',  3990, 3200, 20, 5,  8, 'cajetilla'),
    ('Cigarro Belmont',       '7500002',  2990, 2400, 20, 5,  8, 'cajetilla');
  `);
}