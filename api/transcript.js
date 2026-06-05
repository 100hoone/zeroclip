const https = require('https');

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Cookie': 'CONSENT=YES+cb; YSC=1; VISITOR_INFO1_LIVE=1; GPS=1',
        ...headers
      }
    };
    https.get(url, options, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    }).on('error', reject);
  });
}

function parseTranscript(json) {
  try {
    const parsed = JSON.parse(json);
    const events = parsed.events || [];
    return events
      .filter(e => e.segs)
      .map(e => e.segs.map(s => s.utf8 || '').join(''))
      .filter(t => t.trim() && t.trim() !== '\n')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch { return ''; }
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
    // YouTube 내부 API (innertube) 사용
    const innertubeRes = await fetch('https://www.youtube.com/youtubei/v1/get_transcript', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'X-YouTube-Client-Name': '1',
        'X-YouTube-Client-Version': '2.20240101',
      },
      body: JSON.stringify({
        context: {
          client: { clientName: 'WEB', clientVersion: '2.20240101', hl: 'ko', gl: 'KR' }
        },
        params: Buffer.from(`\n\x0b${videoId}`).toString('base64')
      })
    });

    if (innertubeRes.ok) {
      const data = await innertubeRes.json();
      const segments = data?.actions?.[0]?.updateEngagementPanelAction?.content
        ?.transcriptRenderer?.content?.transcriptSearchPanelRenderer?.body
        ?.transcriptSegmentListRenderer?.initialSegments;

      if (segments?.length > 0) {
        const text = segments
          .map(s => s.transcriptSegmentRenderer?.snippet?.runs?.[0]?.text || '')
          .filter(t => t.trim())
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (text.length > 30) return res.status(200).json({ transcript: text, lang: 'ko' });
      }
    }

    // 폴백: 페이지 직접 파싱
    const html = await get(`https://www.youtube.com/watch?v=${videoId}&hl=ko&gl=KR`);

    // ytInitialPlayerResponse 찾기
    const playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});\s*(?:var |const |let )/s)
      || html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;/s);

    if (!playerMatch) {
      return res.status(404).json({ error: 'YouTube가 서버 접근을 차단했어요. 잠시 후 다시 시도해보세요.' });
    }

    let playerData;
    try { playerData = JSON.parse(playerMatch[1]); } catch { 
      return res.status(500).json({ error: '데이터 파싱 실패' }); 
    }

    const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!tracks?.length) {
      return res.status(404).json({ error: '이 영상에는 자막이 없어요. (자동자막이 비활성화된 영상)' });
    }

    // 한국어 우선 선택
    const track = tracks.find(t => t.languageCode === 'ko' && t.kind !== 'asr')
      || tracks.find(t => t.languageCode === 'ko')
      || tracks.find(t => t.languageCode === 'en')
      || tracks[0];

    const captionUrl = track.baseUrl + '&fmt=json3';
    const captionJson = await get(captionUrl);
    const text = parseTranscript(captionJson);

    if (!text || text.length < 20) {
      return res.status(404).json({ error: '자막 내용이 비어있어요' });
    }

    return res.status(200).json({ transcript: text, lang: track.languageCode });

  } catch (e) {
    console.error('Transcript error:', e);
    return res.status(500).json({ error: '오류: ' + e.message });
  }
}
