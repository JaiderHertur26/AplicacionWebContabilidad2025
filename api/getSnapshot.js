// api/getSnapshot.js
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  const filename = req.query.filename;
  if (!filename) {
    return res.status(400).json({ error: "Archivo no especificado" });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  try {
    const { data, error } = await supabase
      .storage
      .from(process.env.SUPABASE_BUCKET)
      .download(filename);

    if (error) {
      console.error("Download error:", error);
      return res.status(404).json({ error: "Archivo no encontrado" });
    }

    const text = await data.text();
    const json = JSON.parse(text);
    return res.status(200).json(json);
  } catch (err) {
    console.error("Unexpected getSnapshot error:", err);
    return res.status(500).json({ error: err.message || err });
  }
}
