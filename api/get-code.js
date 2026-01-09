export default async function handler(req, res) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');

    const { sponsor, hwid, script } = req.query;
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const OWNER = "stakom";
    const PRIVATE_REPO = "sky-scripts";

    const SCRIPT_CONFIG = {
        "farm": { auth: "users.json", code: "main.js" },
        "obsidian": { auth: "users_obsidian.json", code: "obsidian.js" }
    };

    try {
        if (!sponsor || !hwid) return res.status(200).send('ОШИБКА: Нет данных запроса');
        if (!GITHUB_TOKEN) return res.status(200).send('ОШИБКА: Токен Vercel не настроен');

        const target = SCRIPT_CONFIG[script] || SCRIPT_CONFIG["farm"];
        const headers = {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3.raw',
            'User-Agent': 'Vercel-Script-Gatekeeper'
        };

        // 1. Загрузка JSON лицензий
        const authRes = await fetch(`https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/contents/${target.auth}`, { headers });
        if (!authRes.ok) return res.status(200).send(`ОШИБКА: Файл ${target.auth} не найден`);

        const authData = await authRes.json();
        const groups = authData.access_groups || [];

        // 2. Логика проверки: ищем группу, где есть и этот ник, и этот HWID
        let authorized = false;
        
        for (const group of groups) {
            const nameMatch = group.names.some(n => n.toLowerCase() === sponsor.toLowerCase());
            const hwidMatch = group.hwids.includes(hwid);
            
            if (nameMatch && hwidMatch) {
                authorized = true;
                break;
            }
        }

        if (!authorized) {
            return res.status(200).send('SERVER_ERROR_AUTH_FAILED_OR_HWID_MISMATCH');
        }

        // 3. Загрузка и отдача кода
        const codeRes = await fetch(`https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/contents/${target.code}`, { headers });
        if (!codeRes.ok) return res.status(200).send('ОШИБКА: Файл кода не найден');

        const codeContent = await codeRes.text();
        res.setHeader('Content-Type', 'text/javascript');
        return res.status(200).send(codeContent);

    } catch (err) {
        return res.status(200).send(`КРИТИЧЕСКИЙ СБОЙ: ${err.message}`);
    }
}
