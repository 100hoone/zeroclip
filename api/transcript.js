const { YoutubeTranscript } = require('youtube-transcript');

export default async function handler(req, res) {
  // CORS 허용
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.body || req.query;
  if (!url) return res.status(400).json({ error: 'URL이 필요해요' });

  // 비디오 ID 추출
  const videoId = url.match(/(?:v=|shorts\/|youtu\.be\/)([A-Za-z0-9_-]{11})/)?.[1];
  if (!videoId) return res.status(400).json({ error: '유효한 YouTube URL이 아니에요' });

  try {
    // 한국어 자막 먼저 시도, 없으면 영어, 없으면 자동
    let transcript = null;
    const langs = ['ko', 'en', 'ja'];

    for (const lang of langs) {
      try {
        transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang });
        if (transcript?.length > 0) break;
      } catch(e) {
        continue;
      }
    }

    // 언어 지정 없이 재시도
    if (!transcript || transcript.length === 0) {
      transcript = await YoutubeTranscript.fetchTranscript(videoId);
    }

    if (!transcript || transcript.length === 0) {
      return res.status(404).json({ error: '자막을 찾을 수 없어요. 자동자막이 없는 영상이에요.' });
    }

    // 텍스트로 합치기
    const text = transcript.map(t => t.text).join(' ').replace(/\s+/g, ' ').trim();
    return res.status(200).json({ transcript: text, count: transcript.length });

  } catch (error) {
    console.error('Transcript error:', error);
    return res.status(500).json({ error: '자막을 가져올 수 없어요: ' + error.message });
  }
}
