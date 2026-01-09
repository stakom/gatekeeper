export default async function handler(req, res) {
    // Устанавливаем заголовки, чтобы Minecraft понимал текст
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
        if (!sponsor || !hwid) return res.status(200).send('ОШИБКА: Нет данных (sponsor/hwid)');
        if (!GITHUB_TOKEN) return res.status(200).send('ОШИБКА: GITHUB_TOKEN не настроен в Vercel');

        const target = SCRIPT_CONFIG[script] || SCRIPT_CONFIG["farm"];

        // 1. Пробуем получить файл лицензий
        const authUrl = `https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/contents/${target.auth}`;
        const authRes = await fetch(authUrl, {
            headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3.raw' }
        });

        if (authRes.status === 404) {
            return res.status(200).send(`ОШИБКА: Файл ${target.auth} не найден в репозитории ${PRIVATE_REPO}`);
        }

        if (!authRes.ok) {
            return res.status(200).send(`ОШИБКА ГИТХАБА: Статус ${authRes.status}`);
        }

        const authData = await authRes.json();
        
        // 2. Проверка ника
        const userKey = Object.keys(authData.allowed_users || {}).find(k => k.toLowerCase() === sponsor.toLowerCase());
        if (!userKey) return res.status(200).send('SERVER_ERROR_AUTH_FAILED');

        // 3. Проверка HWID
        const allowed = authData.allowed_users[userKey];
        const isAuth = Array.isArray(allowed) ? allowed.includes(hwid) : (allowed === hwid);

        if (!isAuth) return res.status(200).send('SERVER_ERROR_HWID_MISMATCH');

        // 4. Получаем код скрипта
        const codeUrl = `https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/contents/${target.code}`;
        const codeRes = await fetch(codeUrl, {
            headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3.raw' }
        });

        if (!codeRes.ok) return res.status(200).send(`ОШИБКА: Код ${target.code} не найден`);

        const finalCode = await codeRes.text();
        return res.status(200).send(finalCode);

    } catch (err) {
        return res.status(200).send(`КРИТИЧЕСКАЯ ОШИБКА СЕРВЕРА: ${err.message}`);
    }
}
