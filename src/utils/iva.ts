export const IVA = 0.19;

export function calcularIVA(totalConIva: number) {
  const neto = Math.round(totalConIva / (1 + IVA));
  const iva = totalConIva - neto;
  return { neto, iva };
}

export function agregarIVA(neto: number) {
  const iva = Math.round(neto * IVA);
  return { total: neto + iva, iva };
}