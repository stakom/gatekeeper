export default async function handler(req, res) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    
    const { sponsor, hwid, script } = req.query;
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const OWNER = "stakom";
    const PRIVATE_REPO = "sky-scripts";

    // Настройка путей
    const SCRIPT_CONFIG = {
        "farm": { auth: "users.json", code: "main.js" },
        "obsidian": { auth: "users_obsidian.json", code: "obsidian.js" }
    };

    if (!sponsor || !hwid) return res.status(200).send('SERVER_ERROR_NO_DATA');

    // Если script не указан — это старый лоадер, выдаем farm
    const current = SCRIPT_CONFIG[script] || SCRIPT_CONFIG["farm"];

    try {
        // 1. Пробуем загрузить базу лицензий
        const authResponse = await fetch(`https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/contents/${current.auth}`, {
            headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3.raw' }
        });

        if (!authResponse.ok) {
            return res.status(200).send(`SERVER_ERROR: Файл лицензий ${current.auth} не найден в GitHub!`);
        }

        const authData = await authResponse.json();
        if (!authData.allowed_users) return res.status(200).send('SERVER_ERROR_INVALID_JSON_FORMAT');

        // 2. Ищем пользователя
        const userKey = Object.keys(authData.allowed_users).find(k => k.toLowerCase() === sponsor.toLowerCase());
        if (!userKey) return res.status(200).send('SERVER_ERROR_AUTH_FAILED');

        // 3. Проверяем HWID
        const allowed = authData.allowed_users[userKey];
        const isAuth = Array.isArray(allowed) ? allowed.includes(hwid) : (allowed === hwid);

        if (!isAuth) return res.status(200).send('SERVER_ERROR_HWID_MISMATCH');

        // 4. Тянем сам код
        const codeResponse = await fetch(`https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/contents/${current.code}`, {
            headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3.raw' }
        });

        if (!codeResponse.ok) {
            return res.status(200).send(`SERVER_ERROR: Файл скрипта ${current.code} не найден!`);
        }

        const mainCode = await codeResponse.text();
        return res.status(200).send(mainCode);

    } catch (e) {
        // Ошибка может быть, если JSON кривой. Выведем её текст вместо падения 500.
        return res.status(200).send('SERVER_ERROR_FATAL: ' + e.message);
    }
}
