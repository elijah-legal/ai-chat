// Vercel Serverless Function 程式碼 (Node.js)
// 負責安全地隱藏 Gemini API Key 並處理串流轉發

// 在 Vercel 環境中，我們使用 node-fetch 來進行外部 HTTP 請求
import fetch from 'node-fetch'; 

// 關鍵：從 Vercel 的環境變數中安全地讀取 API Key
const apiKey = process.env.GEMINI_API_KEY;

export default async function handler(req, res) {
    // 1. 安全性檢查
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    if (!apiKey) {
        // 如果密鑰未配置，回傳錯誤訊息，但不會暴露密鑰本身
        res.status(500).send('Server Error: AI Key is not configured on the proxy.');
        return;
    }

    try {
        // 2. 解析前端發送的請求體 (包含用戶的 prompt 和系統指令)
        const requestBody = req.body; 
        
        // 3. 構造對 Gemini 官方 API 的請求
        // 使用 generateContentStream 實現串流效果
        const geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContentStream', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // 安全地將 API Key 加入到後端請求中
                'x-goog-api-key': apiKey,
            },
            // 將客戶端發送的 body 直接傳遞給 Gemini
            body: JSON.stringify(requestBody)
        });

        // 4. 錯誤處理
        if (!geminiResponse.ok) {
            // 嘗試讀取錯誤訊息並轉發狀態碼
            const errorText = await geminiResponse.text();
            res.status(geminiResponse.status).send(`Gemini API Error: ${errorText}`);
            return;
        }

        // 5. 設置標頭並管道轉發 (Streaming)
        // 告訴瀏覽器這是純文本串流
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');

        // 將 Gemini 的原始回應流直接轉發給客戶端，實現逐字元輸出
        // 使用 pipe 實現高效的資料轉發
        geminiResponse.body.pipe(res);
        
    } catch (error) {
        console.error('Proxy Execution Error:', error);
        res.status(500).send('Internal Server Error during API processing.');
    }
}
