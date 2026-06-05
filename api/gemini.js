export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 허용해요' });

  const { key, prompt, videoUrl, mode } = req.body || {};
  if (!key) return res.status(400).json({ error: 'Gemini API 키가 필요해요' });
  if (!prompt && !videoUrl) return res.status(400).json({ error: 'prompt 또는 videoUrl이 필요해요' });

  try {
    let parts = [];

    // 영상 URL이 있으면 Gemini에 직접 분석 요청
    if (videoUrl) {
      parts.push({
        fileData: {
          mimeType: 'video/mp4',
          fileUri: videoUrl
        }
      });
    }

    // 텍스트 프롬프트
    const textPrompt = prompt || (mode === 'transcript'
      ? '이 유튜브 영상의 나레이션/대본을 한국어로 추출해줘. 실제로 말하는 내용만, 설명 없이 대본 텍스트만 출력해줘.'
      : '이 영상을 분석해줘.');

    parts.push({ text: textPrompt });

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 4096 }
        })
      }
    );

    const data = await geminiRes.json();

    if (data.error) {
      return res.status(400).json({ error: data.error.message || 'Gemini 오류' });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) return res.status(500).json({ error: '응답이 비어있어요' });

    return res.status(200).json({ result: text });

  } catch (e) {
    console.error('Gemini proxy error:', e);
    return res.status(500).json({ error: '서버 오류: ' + e.message });
  }
}
