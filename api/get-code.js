export default async function handler(req, res) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');

    // Параметры запроса: ?sponsor=...&hwid=...&script=...
    const { sponsor, hwid, script } = req.query;
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const OWNER = "stakom";
    const PRIVATE_REPO = "sky-scripts";

    // Маппинг ключей на файлы
    const SCRIPT_FILES = {
        "farm": "main.js",
        "obsidian": "obsidian.js"
    };

    try {
        if (!sponsor || !hwid) return res.status(200).send('ERROR_EMPTY_QUERY');
        
        const targetScript = script || "farm";
        const codeFile = SCRIPT_FILES[targetScript];

        if (!codeFile) return res.status(200).send('ERROR_INVALID_SCRIPT_TYPE');

        const headers = { 
            'Authorization': `Bearer ${GITHUB_TOKEN}`, 
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Vercel-Gatekeeper'
        };

        // 1. Загрузка единого файла пользователей
        const authRes = await fetch(`https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/contents/users.json`, { headers });
        if (!authRes.ok) return res.status(200).send('ERROR_DATABASE_NOT_FOUND');
        
        const authData = await authRes.json();
        const groups = authData.access_groups || [];

        // Поиск пользователя
        let user = null;
        for (const group of groups) {
            const nameMatch = group.names.some(n => n.toLowerCase() === sponsor.toLowerCase());
            const hwidMatch = group.hwids.includes(hwid);
            if (nameMatch && hwidMatch) {
                user = group;
                break;
            }
        }

        // ПРОВЕРКА 1: Существование в базе
        if (!user) return res.status(200).send('ERROR_AUTH_NOT_FOUND');

        // ПРОВЕРКА 2: Время истечения (МСК)
        if (user.expires) {
            const now = new Date();
            // Смещение UTC -> МСК (+3 часа)
            const mskNow = new Date(now.getTime() + (3 * 60 * 60 * 1000));
            
            // Обработка формата даты (ГГГГ-ММ-ДД или ГГГГ-ММ-ДД ЧЧ:ММ)
            let expiryStr = user.expires.trim();
            if (expiryStr.length <= 10) {
                expiryStr += " 23:59:59"; // Если время не указано, лицензия до конца дня
            }
            
            // Превращаем в формат, который поймет JS (YYYY-MM-DDTHH:mm:ss)
            const isoExpiry = expiryStr.replace(" ", "T");
            const expiryDate = new Date(isoExpiry);

            if (mskNow > expiryDate) {
                return res.status(200).send(`ERROR_LICENSE_EXPIRED|${user.expires}`);
            }
        }

        // ПРОВЕРКА 3: Доступ к конкретному скрипту
        const allowedScripts = user.scripts || [];
        if (!allowedScripts.includes(targetScript)) {
            return res.status(200).send(`ERROR_NO_SCRIPT_ACCESS|${targetScript}`);
        }

        // 2. Получение даты последнего изменения кода (через Commits API)
        const commitRes = await fetch(`https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/commits?path=${codeFile}&per_page=1`, { headers });
        let lastUpdateStr = "Неизвестно";
        if (commitRes.ok) {
            const commitData = await commitRes.json();
            if (commitData.length > 0) {
                const dateObj = new Date(commitData[0].commit.committer.date);
                lastUpdateStr = dateObj.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
            }
        }

        // 3. Загрузка основного кода скрипта
        const rawHeaders = { ...headers, 'Accept': 'application/vnd.github.v3.raw' };
        const codeRes = await fetch(`https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/contents/${codeFile}`, { headers: rawHeaders });
        if (!codeRes.ok) return res.status(200).send(`ERROR_CODE_NOT_FOUND|${codeFile}`);
        
        const codeContent = await codeRes.text();

        // 4. Формирование системной инъекции
        // Эти переменные будут доступны в коде main.js и obsidian.js автоматически
        const injection = 
            `// --- SYSTEM INJECTION START ---\n` +
            `var TG_USER_ID = "${user.tg_id || "нет"}";\n` +
            `var SCRIPT_LAST_UPDATE = "${lastUpdateStr}";\n` +
            `var LICENSE_EXPIRES = "${user.expires || "Бессрочно"}";\n` +
            `var CURRENT_SCRIPT_TYPE = "${targetScript}";\n` +
            `// --- SYSTEM INJECTION END ---\n\n`;

        // Отправка клиенту
        res.setHeader('Content-Type', 'text/javascript');
        return res.status(200).send(injection + codeContent);

    } catch (err) {
        console.error(err);
        return res.status(200).send(`SERVER_CRITICAL_ERROR: ${err.message}`);
    }
}
