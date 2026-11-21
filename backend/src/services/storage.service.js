// Almacenamiento del fichero fisico. La base de datos solo guarda la clave (ruta) y los metadatos.
// - supabase: bucket privado de Supabase Storage (produccion). Requiere SUPABASE_URL y SUPABASE_SECRET_KEY.
// - local: carpeta backend/uploads (desarrollo sin cuenta de Supabase).
const fs = require('fs/promises');
const path = require('path');

const LOCAL_ROOT = path.resolve(__dirname, '..', '..', 'uploads');
const SIGNED_URL_SECONDS = 60;

function chooseDriver() {
  const wanted = (process.env.STORAGE_DRIVER || '').toLowerCase();
  const hasSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
  if (wanted === 'supabase' && !hasSupabase) {
    throw new Error('STORAGE_DRIVER=supabase requiere SUPABASE_URL y SUPABASE_SECRET_KEY en el .env.');
  }
  if (wanted === 'local' || wanted === 'supabase') return wanted;
  return hasSupabase ? 'supabase' : 'local';
}

const driver = chooseDriver();
const bucket = process.env.SUPABASE_BUCKET || 'nova-archivos';
let supabase = null;
if (driver === 'supabase') {
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage.from(bucket);
}

// Evita que una clave escape de la carpeta de uploads (../../).
function localPath(key) {
  const full = path.resolve(LOCAL_ROOT, key);
  if (!full.startsWith(LOCAL_ROOT + path.sep)) throw new Error('Ruta de almacenamiento invalida.');
  return full;
}

async function save(key, buffer, contentType) {
  if (driver === 'supabase') {
    const { error } = await supabase.upload(key, buffer, { contentType, upsert: false });
    if (error) throw new Error(`Supabase Storage: ${error.message}`);
    return;
  }
  const full = localPath(key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buffer, { flag: 'wx' });
}

async function remove(key) {
  if (driver === 'supabase') {
    const { error } = await supabase.remove([key]);
    if (error) throw new Error(`Supabase Storage: ${error.message}`);
    return;
  }
  await fs.rm(localPath(key), { force: true });
}

// Supabase: URL firmada que expira en 60 s (el bucket es privado).
async function signedUrl(key, downloadName) {
  const { data, error } = await supabase.createSignedUrl(key, SIGNED_URL_SECONDS, downloadName ? { download: downloadName } : undefined);
  if (error) throw new Error(`Supabase Storage: ${error.message}`);
  return data.signedUrl;
}

module.exports = {
  driver,
  bucket,
  save,
  remove,
  signedUrl,
  localPath,
};
