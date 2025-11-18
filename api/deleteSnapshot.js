// api/deleteSnapshot.js
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error: "Falta filename" });

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  try {
    const { error: delError } = await supabase.storage.from(process.env.SUPABASE_BUCKET).remove([filename]);
    if (delError) {
      console.error("Storage delete error:", delError);
      return res.status(500).json({ error: delError.message || delError });
    }

    // Borrar manifest
    const { error: dbError } = await supabase.from("snapshots_manifest").delete().eq("id", filename);
    if (dbError) {
      console.error("Manifest delete error:", dbError);
      return res.status(500).json({ error: dbError.message || dbError });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Unexpected deleteSnapshot error:", err);
    return res.status(500).json({ error: err.message || err });
  }
}
