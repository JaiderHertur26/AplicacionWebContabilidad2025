// src/dataService.js

// 🔹 Leer los movimientos guardados en GitHub
export async function obtenerMovimientos() {
  const res = await fetch("/api/get-data?path=data.json");
  const data = await res.json();

  try {
    const contenido = JSON.parse(data.content || '{"movimientos": []}');
    return contenido.movimientos || [];
  } catch {
    return [];
  }
}

// 🔹 Guardar un nuevo movimiento en GitHub
export async function guardarMovimiento(nuevoMovimiento) {
  // 1️⃣ Obtener los movimientos actuales
  const movimientos = await obtenerMovimientos();

  // 2️⃣ Agregar el nuevo
  movimientos.push(nuevoMovimiento);

  // 3️⃣ Guardar el archivo actualizado
  await fetch("/api/update-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filePath: "data.json",
      content: JSON.stringify({ movimientos }),
    }),
  });

  return movimientos;
}
