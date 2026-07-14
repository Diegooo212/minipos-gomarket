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

  // PIN "1234" hasheado simple (en producción usar bcrypt via Tauri)
  await db.execute(`
    INSERT INTO usuarios (nombre, pin_hash, rol, activo) VALUES
    ('Administrador', '1234', 'admin', 1),
    ('Cajero 1', '1111', 'cajero', 1),
    ('Supervisor', '2222', 'supervisor', 1);
  `);

  await db.execute(`
    INSERT INTO productos (nombre, codigo_barra, precio_venta, precio_costo, stock, stock_minimo, categoria_id, unidad) VALUES
    ('Coca-Cola 1.5L', '7802380001084', 1590, 950, 24, 6, 1, 'unidad'),
    ('Agua Vital 1.5L', '7801000001234', 890, 500, 30, 6, 1, 'unidad'),
    ('Jugo Andina 1L', '7802380002001', 1290, 780, 18, 6, 1, 'unidad'),
    ('Cerveza Cristal 350cc', '7801234000011', 990, 600, 48, 12, 1, 'unidad'),
    ('Leche Entera Soprole 1L', '7802300001001', 1190, 720, 32, 10, 3, 'unidad'),
    ('Yogur Batido Soprole 165g', '7802300002001', 590, 350, 24, 6, 3, 'unidad'),
    ('Mantequilla Colun 200g', '7801620001001', 1890, 1100, 12, 4, 3, 'unidad'),
    ('Arroz Tucapel 1kg', '7800570001001', 1290, 750, 40, 10, 2, 'kg'),
    ('Fideos Carozzi 500g', '7802350001001', 890, 520, 36, 10, 2, 'unidad'),
    ('Aceite Chef 1L', '7801234001001', 2490, 1600, 20, 6, 2, 'unidad'),
    ('Azúcar 1kg', '7800001001001', 990, 580, 30, 10, 2, 'kg'),
    ('Sal 1kg', '7800001002001', 490, 280, 25, 8, 2, 'kg'),
    ('Atún Colo Colo 170g', '7802800001001', 1190, 700, 24, 6, 7, 'unidad'),
    ('Lentejas 500g', '7800002001001', 890, 520, 20, 6, 2, 'unidad'),
    ('Pan Molde Ideal', '7801000002001', 2290, 1400, 8, 4, 4, 'unidad'),
    ('Hallulla x6', '0000000000001', 1200, 700, 15, 5, 4, 'unidad'),
    ('Jabón Dove 90g', '7891150012001', 1290, 800, 20, 6, 5, 'unidad'),
    ('Papel Higiénico Elite 4u', '7802400001001', 2490, 1500, 15, 4, 5, 'unidad'),
    ('Shampoo Head&Shoulders 375ml', '7500435001001', 4990, 3200, 8, 3, 5, 'unidad'),
    ('Lays 42g', '7802230001001', 790, 480, 30, 10, 6, 'unidad'),
    ('Doritos 45g', '7800222001001', 890, 540, 28, 10, 6, 'unidad'),
    ('Chocolate Sahne-Nuss 100g', '7802350002001', 1490, 900, 18, 6, 6, 'unidad'),
    ('Cigarro Marlboro', '7500000001001', 3990, 3200, 20, 5, 8, 'cajetilla'),
    ('Cigarro Belmont', '7500000002001', 2990, 2400, 20, 5, 8, 'cajetilla');
  `);
}