import Database from "@tauri-apps/plugin-sql";
import { crearTablas } from "./schema";
import { insertarDatosIniciales } from "./seed";

let db: Database | null = null;

export async function getDB(): Promise<Database> {
  if (db) return db;
  db = await Database.load("sqlite:minipos.db");
  await crearTablas(db);
  await insertarDatosIniciales(db);
  return db;
}