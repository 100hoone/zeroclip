const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
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
    parts.push({ fileData: { mimeType: 'video/mp4', fileUri: videoUrl } });
  }
  parts.push({ text: textPrompt });

  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 4096 }
  });

  // 모델 순서대로 시도
  for (const model of MODELS) {
    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
      );
      const data = await geminiRes.json();

      // 사용 불가 모델이면 다음으로
      if (data.error?.code === 404 || data.error?.status === 'NOT_FOUND') continue;
      // 과부하면 다음으로
      if (data.error?.code === 503 || data.error?.status === 'UNAVAILABLE') continue;
      // 다른 에러면 반환
      if (data.error) return res.status(400).json({ error: data.error.message });

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!text) return res.status(500).json({ error: '응답이 비어있어요' });

      return res.status(200).json({ result: text, model });
    } catch(e) {
      continue;
    }
  }

  return res.status(503).json({ error: '모든 Gemini 모델이 현재 과부하 상태예요. 잠시 후 다시 시도해주세요.' });
}
