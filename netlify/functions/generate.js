javascriptconst PROMPT =
  "請將這張照片轉換成一張精緻、大氣、高質感的中國風新年拜年賀卡。" +
  "務必保留照片中人物的臉部特徵與五官,不要更換成別的臉。" +
  "將背景與服裝改造成富貴喜慶的中國新年風格:金色祥雲、大紅燈籠、剪紙窗花、梅花、如意等吉祥元素," +
  "整體色調以喜慶紅與富貴金為主,畫面構圖典雅大氣,呈現高級精緻的賀年卡質感,直式構圖,適合手機螢幕觀看。";

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return respond(405, { error: "METHOD_NOT_ALLOWED" });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return respond(400, { error: "BAD_JSON" });
  }

  const { imageBase64, mimeType } = payload;
  if (!imageBase64) {
    return respond(400, { error: "NO_IMAGE_PROVIDED" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return respond(500, { error: "SERVER_NOT_CONFIGURED" });
  }

  try {
    const upstream = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: PROMPT },
                { inline_data: { mime_type: mimeType || "image/jpeg", data: imageBase64 } }
              ]
            }
          ],
          generationConfig: { responseModalities: ["IMAGE", "TEXT"] }
        })
      }
    );

    if (!upstream.ok) {
      const detail = await upstream.text();
      return respond(502, {
        error: "UPSTREAM_ERROR",
        status: upstream.status,
        detail: detail.slice(0, 400)
      });
    }

    const data = await upstream.json();
    const parts = (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
    const imgPart = parts.find((p) => p.inlineData || p.inline_data);
    const inline = imgPart && (imgPart.inlineData || imgPart.inline_data);

    if (!inline || !inline.data) {
      return respond(502, { error: "NO_IMAGE_RETURNED" });
    }

    return respond(200, {
      mimeType: inline.mimeType || inline.mime_type || "image/png",
      data: inline.data
    });
  } catch (err) {
    return respond(500, { error: "SERVER_ERROR", detail: String(err && err.message ? err.message : err) });
  }
};

function respond(statusCode, obj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj)
  };
}
