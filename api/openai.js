export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST만 허용" });

  const { key, prompt } = req.body || {};
  if (!key) return res.status(400).json({ error: "OpenAI API 키가 필요해요" });
  if (!prompt) return res.status(400).json({ error: "분석할 내용이 필요해요" });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "당신은 대한민국 유튜브 쇼츠 전문 콘텐츠 전략가입니다. 절대 인사말, 서론, 마무리 말 없이 바로 분석 내용만 출력하세요." },
          { role: "user", content: prompt }
        ],
        max_tokens: 4000,
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
