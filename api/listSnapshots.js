// api/listSnapshots.js
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  // Listamos desde la tabla manifest (más fiable para realtime + metadatos)
  const { data, error } = await supabase
    .from("snapshots_manifest")
    .select("id, filename, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("List manifest error:", error);
    return res.status(500).json({ error: error.message || error });
  }

  return res.status(200).json(data);
}
