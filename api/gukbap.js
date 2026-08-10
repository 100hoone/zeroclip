// This file is kept for CORS purposes but actual data is read from GitHub directly
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({ ok: true });
}
