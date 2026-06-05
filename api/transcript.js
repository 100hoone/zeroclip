const https = require('https');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'Accept': '*/*',
      }
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    }).on('error', reject);
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.body || req.query;
  if (!url) return res.status(400).json({ error: 'URL이 필요해요' });

  const videoId = url.match(/(?:v=|shorts\/|youtu\.be\/)([A-Za-z0-9_-]{11})/)?.[1];
  if (!videoId) return res.status(400).json({ error: '유효한 YouTube URL이 아니에요' });

  try {
    // 방법 1: YouTube timedtext API 직접 호출
    const langs = ['ko', 'en', 'ja', 'zh-Hans'];
    for (const lang of langs) {
      try {
        const xmlUrl = `https://www.youtube.com/api/timedtext?lang=${lang}&v=${videoId}&fmt=json3`;
        const data = await get(xmlUrl);
        if (!data || data.trim() === '' || data.startsWith('<')) continue;

        const parsed = JSON.parse(data);
        const events = parsed.events || [];
        const text = events
          .filter(e => e.segs)
          .map(e => e.segs.map(s => s.utf8 || '').join(''))
          .filter(t => t.trim())
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (text.length > 50) {
          return res.status(200).json({ transcript: text, lang });
        }
      } catch(e) { continue; }
    }

    // 방법 2: YouTube 페이지 파싱
    const html = await get(`https://www.youtube.com/watch?v=${videoId}&hl=ko`);

    // ytInitialPlayerResponse 추출
    const prMatch = html.match(/"captions":\s*(\{.+?"captionTracks":.+?\])/);
    if (!prMatch) {
      return res.status(404).json({ error: '이 영상에는 자동자막이 없어요. 자막이 있는 지식/나레이션 영상에서 사용해보세요.' });
    }

    // captionTracks baseUrl 추출
    const baseUrlMatch = prMatch[1].match(/"baseUrl":"([^"]+)"/);
    if (!baseUrlMatch) {
      return res.status(404).json({ error: '자막 URL을 찾을 수 없어요' });
    }

    const captionUrl = baseUrlMatch[1].replace(/\\u0026/g, '&') + '&fmt=json3';
    const captionData = await get(captionUrl);
    const parsed = JSON.parse(captionData);
    const events = parsed.events || [];
    const text = events
      .filter(e => e.segs)
      .map(e => e.segs.map(s => s.utf8 || '').join(''))
      .filter(t => t.trim())
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!text || text.length < 20) {
      return res.status(404).json({ error: '자막 내용이 없어요' });
    }

    return res.status(200).json({ transcript: text });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: '자막 추출 실패: ' + e.message });
  }
}
