export default async function handler(req, res) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');

    // Извлекаем данные из запроса: ?sponsor=...&hwid=...&script=...
    const { sponsor, hwid, script } = req.query;
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const OWNER = "stakom";
    const PRIVATE_REPO = "sky-scripts";

    // Сопоставляем ключ скрипта с реальным файлом на GitHub
    const SCRIPT_FILES = {
        "farm": "main.js",
        "obsidian": "obsidian.js"
    };

    try {
        if (!sponsor || !hwid) return res.status(200).send('ERROR_EMPTY_QUERY');
        
        // По умолчанию отдаем farm, если параметр script не передан
        const targetScript = script || "farm";
        const codeFile = SCRIPT_FILES[targetScript];

        const headers = { 
            'Authorization': `Bearer ${GITHUB_TOKEN}`, 
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Vercel-Gatekeeper'
        };

        // 1. Загружаем ЕДИНЫЙ файл пользователей
        const authRes = await fetch(`https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/contents/users.json`, { headers });
        if (!authRes.ok) return res.status(200).send('ERROR_USERS_FILE_NOT_FOUND');
        
        const authData = await authRes.json();
        const groups = authData.access_groups || [];

        // Ищем пользователя по нику ИЛИ по HWID
        let user = null;
        for (const group of groups) {
            const nameMatch = group.names.some(n => n.toLowerCase() === sponsor.toLowerCase());
            const hwidMatch = group.hwids.includes(hwid);
            if (nameMatch && hwidMatch) {
                user = group;
                break;
            }
        }

        // --- ПРОВЕРКА 1: Авторизация ---
        if (!user) return res.status(200).send('ERROR_AUTH_NOT_FOUND');

        // --- ПРОВЕРКА 2: Срок действия ---
        const now = new Date();
        const mskNow = new Date(now.getTime() + (3 * 60 * 60 * 1000)); // Время по МСК
        if (user.expires) {
            const expiryDate = new Date(user.expires + "T23:59:59");
            if (mskNow > expiryDate) {
                return res.status(200).send(`ERROR_LICENSE_EXPIRED|${user.expires}`);
            }
        }

        // --- ПРОВЕРКА 3: Доступ к конкретному скрипту ---
        const allowedScripts = user.scripts || [];
        if (!allowedScripts.includes(targetScript)) {
            return res.status(200).send(`ERROR_NO_SCRIPT_ACCESS|${targetScript}`);
        }

        // 2. Получаем дату последнего изменения файла кода (через API коммитов)
        const commitRes = await fetch(`https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/commits?path=${codeFile}&per_page=1`, { headers });
        let lastUpdateStr = "Неизвестно";
        if (commitRes.ok) {
            const commitData = await commitRes.json();
            if (commitData.length > 0) {
                lastUpdateStr = new Date(commitData[0].commit.committer.date).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
            }
        }

        // 3. Загружаем сам код скрипта
        const rawHeaders = { ...headers, 'Accept': 'application/vnd.github.v3.raw' };
        const codeRes = await fetch(`https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/contents/${codeFile}`, { headers: rawHeaders });
        if (!codeRes.ok) return res.status(200).send(`ERROR_CODE_FILE_NOT_FOUND|${codeFile}`);
        
        const codeContent = await codeRes.text();

        // 4. Формируем "инъекцию" переменных в начало кода
        const injection = 
            `var TG_USER_ID = "${user.tg_id || "нет"}";\n` +
            `var SCRIPT_LAST_UPDATE = "${lastUpdateStr}";\n` +
            `var LICENSE_EXPIRES = "${user.expires || "Бессрочно"}";\n` +
            `var CURRENT_SCRIPT_TYPE = "${targetScript}";\n` +
            `// --- КОНЕЦ СИСТЕМНОЙ ИНЪЕКЦИИ ---\n\n`;

        // Отдаем финальный результат
        res.setHeader('Content-Type', 'text/javascript');
        return res.status(200).send(injection + codeContent);

    } catch (err) {
        return res.status(200).send(`SERVER_CRITICAL_ERROR: ${err.message}`);
    }
}
