// src/hooks/useRemoteData.js

export function useRemoteData(filePath = "data.json") {
  // Obtener datos del archivo remoto
  const getData = async () => {
    try {
      const res = await fetch(`/api/get-data?path=${filePath}`);
      const json = await res.json();
      return JSON.parse(json.content || "{}");
    } catch (err) {
      console.error("❌ Error obteniendo datos remotos:", err);
      return {};
    }
  };

  // Guardar datos en el archivo remoto
  const saveData = async (contentObj) => {
    try {
      await fetch("/api/update-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath,
          content: JSON.stringify(contentObj),
        }),
      });
    } catch (err) {
      console.error("❌ Error guardando datos remotos:", err);
    }
  };

  return { getData, saveData };
}
