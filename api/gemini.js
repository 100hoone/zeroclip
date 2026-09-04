const MODELS = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 허용해요' });

  const { key, prompt, videoUrl, mode } = req.body || {};
  if (!key) return res.status(400).json({ error: 'Gemini API 키가 필요해요' });
  if (!prompt && !videoUrl) return res.status(400).json({ error: 'prompt 또는 videoUrl이 필요해요' });

  const textPrompt = prompt || (mode === 'transcript'
    ? '이 유튜브 영상의 나레이션/대본을 한국어로 추출해줘. 실제로 말하는 내용만, 설명 없이 대본 텍스트만 출력해줘.'
    : '이 영상을 분석해줘.');

  const parts = [];
  if (videoUrl) {
    // YouTube URL은 mimeType 없이 fileUri만 전달
    parts.push({ fileData: { fileUri: videoUrl } });
  }
  parts.push({ text: textPrompt });

  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 8192 }
  });

  for (const model of MODELS) {
    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body }
      );
      const data = await geminiRes.json();

      if (data.error?.code === 404 || data.error?.status === 'NOT_FOUND') { console.log(`${model} not found, trying next...`); continue; }
      if (data.error?.code === 503 || data.error?.status === 'UNAVAILABLE') { console.log(`${model} overloaded, trying next...`); continue; }
      if (data.error?.code === 429 || data.error?.status === 'RESOURCE_EXHAUSTED') { console.log(`${model} quota exceeded, trying next...`); continue; }
      // 영상 URL을 지원하지 않는 모델일 수 있으니 다음 모델로 재시도
      if (videoUrl && (data.error?.code === 400 || data.error?.status === 'INVALID_ARGUMENT')) { console.log(`${model} rejected video input, trying next...`); continue; }
      if (data.error?.code === 401 || data.error?.code === 403 || data.error?.status === 'UNAUTHENTICATED' || data.error?.status === 'PERMISSION_DENIED') {
        return res.status(401).json({ error: `Gemini API 키가 유효하지 않아요: ${data.error.message}` });
      }
      if (data.error) return res.status(400).json({ error: `${data.error.message} (${model})` });

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!text) { console.log(`${model} empty response, trying next...`); continue; }

      return res.status(200).json({ result: text, model });
    } catch(e) {
      console.log(`${model} error:`, e.message);
      continue;
    }
  }

  return res.status(503).json({ error: 'Gemini가 현재 바빠요. 1~2분 후 다시 시도해주세요.' });
}
