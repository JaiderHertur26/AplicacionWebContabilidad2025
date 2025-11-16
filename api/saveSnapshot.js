import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { filename, data } = req.body;

  if (!filename || !data) {
    return res.status(400).json({ error: "Faltan datos" });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const jsonString = JSON.stringify(data, null, 2);

  const { error } = await supabase
    .storage
    .from(process.env.SUPABASE_BUCKET)
    .upload(filename, jsonString, {
      upsert: true,
      contentType: "application/json",
    });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true });
}
