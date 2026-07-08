// Vercel Serverless Function
// 這個檔案在「伺服器端」執行,使用者的瀏覽器完全看不到這段程式碼,
// 也看不到 GEMINI_API_KEY(金鑰是從 Vercel 後台的環境變數讀取的,不是寫在這裡)。

const PROMPT =
  "請將這張照片轉換成一張精緻、大氣、高質感的中國風新年拜年賀卡。" +
  "務必保留照片中人物的臉部特徵與五官,不要更換成別的臉。" +
  "將背景與服裝改造成富貴喜慶的中國新年風格:金色祥雲、大紅燈籠、剪紙窗花、梅花、如意等吉祥元素," +
  "整體色調以喜慶紅與富貴金為主,畫面構圖典雅大氣,呈現高級精緻的賀年卡質感,直式構圖,適合手機螢幕觀看。";

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED" });
  }

  const { imageBase64, mimeType } = req.body || {};
  if (!imageBase64) {
    return res.status(400).json({ error: "NO_IMAGE_PROVIDED" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "SERVER_NOT_CONFIGURED" });
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
      return res.status(502).json({
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
      return res.status(502).json({ error: "NO_IMAGE_RETURNED" });
    }

    return res.status(200).json({
      mimeType: inline.mimeType || inline.mime_type || "image/png",
      data: inline.data
    });
  } catch (err) {
    return res.status(500).json({ error: "SERVER_ERROR", detail: String(err && err.message ? err.message : err) });
  }
};
