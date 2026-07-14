export const fmtCLP = (n: number) =>
  "$" + Math.round(n).toLocaleString("es-CL");

export const fmtFecha = (fecha: string) =>
  new Date(fecha).toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  });

export const fmtFechaSolo = (fecha: string) =>
  new Date(fecha).toLocaleDateString("es-CL");