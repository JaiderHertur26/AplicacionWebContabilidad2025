// api/saveSnapshot.js
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { filename, data } = req.body;
  if (!filename || typeof data === "undefined") {
    return res.status(400).json({ error: "Faltan datos" });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  try {
    const jsonString = JSON.stringify(data, null, 2);
    const fileBuffer = Buffer.from(jsonString, "utf-8");

    // Subir/actualizar el archivo en Storage
    const { error: uploadError } = await supabase
      .storage
      .from(process.env.SUPABASE_BUCKET)
      .upload(filename, fileBuffer, {
        upsert: true,
        contentType: "application/json",
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return res.status(500).json({ error: uploadError.message || uploadError });
    }

    // Upsert en tabla manifest para generar evento Realtime
    const manifestRow = {
      id: filename,            // PK: filename (p. ej. "JSON_GLOBAL.json" o "empresa_1.json")
      filename,
      updated_at: new Date().toISOString()
    };

    const { error: upsertError } = await supabase
      .from("snapshots_manifest")
      .upsert(manifestRow);

    if (upsertError) {
      console.error("Manifest upsert error:", upsertError);
      // No abortamos la operación; devolver 200 pero informar del error en manifest
      return res.status(200).json({ success: true, manifestError: upsertError.message });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Unexpected error:", err);
    return res.status(500).json({ error: err.message || err });
  }
}
