export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { imageBase64 } = req.body;
    
    if (!imageBase64) {
        return res.status(400).json({ error: 'Image data is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not set on the server' });
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { text: "あなたはプロの音楽関係者です。アップロードされた資料（フライヤー画像またはPDF文書）から、出演するバンドやアーティストの名前を可能な限り正確に抽出してください。\n\n【ルール】\n1. アーティスト名・バンド名・演者名だけを抽出すること。\n2. 日付、時間、場所、チケット料金、主催者名、「出演」「Guest」「DJ」などの肩書き、その他関係ない情報は絶対に含めないこと。\n3. 抽出した名前は1行に1組ずつ出力すること。箇条書きの記号（1. や ・ など）は付けないこと。\n4. 独特なフォントやロゴデザインであっても丁寧に読み取ること。\n\n出力は抽出した名前のリスト（各行1組）のみにしてください。" },
                            {
                                inline_data: {
                                    mime_type: "image/jpeg",
                                    data: imageBase64
                                }
                            }
                        ]
                    }
                ],
                generationConfig: {
                    temperature: 0.0
                }
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || 'API request failed');
        }

        const result = await response.json();
        return res.status(200).json(result);

    } catch (error) {
        console.error("Gemini API Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
