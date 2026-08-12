export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST만 허용" });

  const { key, title, mode } = req.body || {};
  if (!key) return res.status(400).json({ error: "OpenAI API 키가 필요해요" });
  if (!title) return res.status(400).json({ error: "작품명이 필요해요" });

  const SYSTEM_PROMPT = `당신은 대한민국 유튜브 쇼츠 전문 콘텐츠 전략가입니다.
드라마/영화/예능 클립을 기반으로 한 쇼츠 제작을 돕습니다.
초보 크리에이터도 바로 따라 만들 수 있도록 구체적이고 실용적으로 답변하세요.
모든 답변은 한국어로 작성하세요.`;

  const USER_PROMPT = `"${title}" 작품을 유튜브 쇼츠로 만들려고 합니다.

다음 형식으로 정확하게 답변해주세요:

🎬 **인기 구간 TOP3**
(어느 장면이 시청자 반응이 좋은지, 이유 포함)

✂️ **추천 클립 3가지**
(구체적인 장면 설명 + 왜 쇼츠로 잘 될지)

📝 **제목(헤드라인) 예시 5개**
(클릭하고 싶게 만드는 실제 쓸 수 있는 제목)

🎙️ **나레이션 첫 문장 3가지**
(시청자를 3초 안에 잡는 훅 문장)

💬 **하이라이트 대사/명장면**
(실제 대사나 장면 묘사, 쇼츠에 쓰기 좋은 것들)`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: USER_PROMPT }
        ],
        max_tokens: 2000,
        temperature: 0.7
      })
    });

    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error.message });

    const result = data.choices?.[0]?.message?.content || "";
    return res.status(200).json({ result });
  } catch(e) {
    return res.status(500).json({ error: "OpenAI 연결 오류: " + e.message });
  }
}
