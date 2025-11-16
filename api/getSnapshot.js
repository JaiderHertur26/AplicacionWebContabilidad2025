import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const { filename } = req.query;

  if (!filename) {
    return res.status(400).json({ error: "Falta filename" });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const { data, error } = await supabase.storage
    .from(process.env.SUPABASE_BUCKET)
    .download(filename);

  if (error) {
    return res.status(404).json({ error: "Archivo no encontrado" });
  }

  const text = await data.text();
  return res.status(200).json(JSON.parse(text));
}
