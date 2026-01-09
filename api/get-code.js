export default async function handler(req, res) {
    const { sponsor, hwid, script } = req.query;
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const OWNER = "stakom";
    const PRIVATE_REPO = "sky-scripts";

    const SCRIPT_CONFIG = {
        "farm": { auth: "users.json", code: "main.js" },
        "obsidian": { auth: "users_obsidian.json", code: "obsidian.js" }
    };

    if (!sponsor || !hwid) return res.status(200).send('SERVER_ERROR_NO_DATA');
    const target = SCRIPT_CONFIG[script] || SCRIPT_CONFIG["farm"];

    try {
        const authUrl = `https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/contents/${target.auth}`;
        const authResponse = await fetch(authUrl, {
            headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3.raw' }
        });

        // Если файла нет или GitHub недоступен
        if (!authResponse.ok) return res.status(200).send('SERVER_ERROR_GITHUB_FILE_NOT_FOUND');
        
        const authData = await authResponse.json();
        
        // Защита: если файл на GitHub пустой или неверный формат
        if (!authData || !authData.allowed_users) return res.status(200).send('SERVER_ERROR_INVALID_JSON');

        const userKey = Object.keys(authData.allowed_users).find(k => k.toLowerCase() === sponsor.toLowerCase());
        if (!userKey) return res.status(200).send('SERVER_ERROR_AUTH_FAILED');

        const allowedData = authData.allowed_users[userKey];
        const isAuthorized = Array.isArray(allowedData) ? allowedData.includes(hwid) : (allowedData === hwid);

        if (!isAuthorized) return res.status(200).send('SERVER_ERROR_HWID_MISMATCH');

        const codeResponse = await fetch(`https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/contents/${target.code}`, {
            headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3.raw' }
        });

        const scriptContent = await codeResponse.text();
        res.setHeader('Content-Type', 'text/javascript');
        return res.status(200).send(scriptContent);

    } catch (error) {
        // Выводим ошибку в лог Vercel, но клиенту шлем статус 200 с текстом ошибки
        console.error(error);
        return res.status(200).send('SERVER_ERROR_FATAL');
    }
}
