import Database from "@tauri-apps/plugin-sql";

export async function crearTablas(db: Database) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      color TEXT DEFAULT '#6366f1'
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS proveedores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      contacto TEXT DEFAULT '',
      telefono TEXT DEFAULT '',
      email TEXT DEFAULT ''
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'cajero',
      activo INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      codigo_barra TEXT UNIQUE,
      precio_venta REAL NOT NULL DEFAULT 0,
      precio_costo REAL DEFAULT 0,
      stock INTEGER DEFAULT 0,
      stock_minimo INTEGER DEFAULT 5,
      categoria_id INTEGER DEFAULT 1,
      proveedor_id INTEGER,
      fecha_vencimiento TEXT,
      activo INTEGER DEFAULT 1,
      unidad TEXT DEFAULT 'unidad',
      FOREIGN KEY (categoria_id) REFERENCES categorias(id),
      FOREIGN KEY (proveedor_id) REFERENCES proveedores(id)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      telefono TEXT DEFAULT '',
      rut TEXT DEFAULT '',
      saldo_fiado REAL DEFAULT 0,
      puntos INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS turnos_caja (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      monto_inicial REAL DEFAULT 0,
      monto_final_esperado REAL,
      monto_final_real REAL,
      diferencia REAL,
      apertura DATETIME DEFAULT CURRENT_TIMESTAMP,
      cierre DATETIME,
      estado TEXT DEFAULT 'abierto',
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      turno_id INTEGER NOT NULL,
      cliente_id INTEGER,
      subtotal REAL NOT NULL,
      iva REAL NOT NULL,
      total REAL NOT NULL,
      monto_pagado REAL DEFAULT 0,
      vuelto REAL DEFAULT 0,
      metodo_pago TEXT DEFAULT 'efectivo',
      estado TEXT DEFAULT 'completada',
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
      sincronizada INTEGER DEFAULT 0,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
      FOREIGN KEY (turno_id) REFERENCES turnos_caja(id),
      FOREIGN KEY (cliente_id) REFERENCES clientes(id)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS detalle_venta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER NOT NULL,
      producto_id INTEGER NOT NULL,
      nombre_producto TEXT NOT NULL,
      precio_unitario REAL NOT NULL,
      precio_costo REAL DEFAULT 0,
      cantidad INTEGER NOT NULL,
      descuento REAL DEFAULT 0,
      subtotal REAL NOT NULL,
      FOREIGN KEY (venta_id) REFERENCES ventas(id),
      FOREIGN KEY (producto_id) REFERENCES productos(id)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS movimientos_inventario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL,
      usuario_id INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      cantidad INTEGER NOT NULL,
      costo_unitario REAL DEFAULT 0,
      motivo TEXT DEFAULT '',
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (producto_id) REFERENCES productos(id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS auditoria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      accion TEXT NOT NULL,
      tabla TEXT NOT NULL,
      detalle TEXT DEFAULT '',
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );
  `);
}