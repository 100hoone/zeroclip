const https = require('https');

function fetchUrl(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ...headers
      }
    };
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
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
    // YouTube 페이지 직접 가져오기
    const pageHtml = await fetchUrl(`https://www.youtube.com/watch?v=${videoId}`);

    // ytInitialPlayerResponse에서 자막 트랙 URL 추출
    const match = pageHtml.match(/ytInitialPlayerResponse\s*=\s*({.+?})\s*;/s);
    if (!match) return res.status(404).json({ error: '영상 정보를 찾을 수 없어요' });

    let playerResponse;
    try { playerResponse = JSON.parse(match[1]); }
    catch(e) { return res.status(500).json({ error: '영상 데이터 파싱 실패' }); }

    const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!captions || captions.length === 0) {
      return res.status(404).json({ error: '이 영상에는 자막이 없어요' });
    }

    // 한국어 > 영어 > 첫번째 자막 순으로 선택
    const track = captions.find(t => t.languageCode === 'ko')
      || captions.find(t => t.languageCode === 'en')
      || captions[0];

    const captionUrl = track.baseUrl + '&fmt=json3';
    const captionData = await fetchUrl(captionUrl);

    let parsed;
    try { parsed = JSON.parse(captionData); }
    catch(e) { return res.status(500).json({ error: '자막 데이터 파싱 실패' }); }

    const events = parsed.events || [];
    const text = events
      .filter(e => e.segs)
      .map(e => e.segs.map(s => s.utf8).join(''))
      .join(' ')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!text) return res.status(404).json({ error: '자막 내용이 비어있어요' });

    return res.status(200).json({ transcript: text, lang: track.languageCode });

  } catch (error) {
    console.error('Transcript error:', error);
    return res.status(500).json({ error: '자막을 가져오는 중 오류가 났어요: ' + error.message });
  }
}
