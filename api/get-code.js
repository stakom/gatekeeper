export default async function handler(req, res) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');

    const { sponsor, hwid, script } = req.query;
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const OWNER = "stakom";
    const PRIVATE_REPO = "sky-scripts";

    const SCRIPT_FILES = { "farm": "main.js", "obsidian": "obsidian.js" };

    try {
        if (!sponsor || !hwid) return res.status(200).send('ERROR_EMPTY_QUERY');
        const targetScript = (script || "farm").toLowerCase();
        const codeFile = SCRIPT_FILES[targetScript];

        // Заголовки для GitHub
        const headers = { 
            'Authorization': `Bearer ${GITHUB_TOKEN}`, 
            'User-Agent': 'Vercel-Gatekeeper'
        };

        // 1. Загружаем users.json (используем сырой текст, чтобы не было ошибок парсинга метаданных)
        const authRes = await fetch(`https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/contents/users.json`, { 
            headers: { ...headers, 'Accept': 'application/vnd.github.v3.raw' } 
        });
        
        if (!authRes.ok) return res.status(200).send('ERROR_DB_NOT_FOUND_ON_GITHUB');

        const authData = await authRes.json();
        const groups = authData.access_groups || [];

        let user = null;

        // 2. Поиск пользователя (максимально безопасный)
        for (const group of groups) {
            const names = (group.names || []).map(n => String(n).toLowerCase().trim());
            const hwids = (group.hwids || []).map(h => String(h).toUpperCase().trim());
            
            if (names.includes(sponsor.toLowerCase().trim()) && hwids.includes(hwid.toUpperCase().trim())) {
                user = group;
                break;
            }
        }

        if (!user) return res.status(200).send('ERROR_AUTH_NOT_FOUND');

        // 3. Проверка лицензии (с защитой от неверного формата даты)
        if (user.expires && String(user.expires).toLowerCase() !== "бессрочно") {
            try {
                const mskNow = new Date(new Date().getTime() + (3 * 60 * 60 * 1000));
                let expiryStr = String(user.expires).trim();
                if (expiryStr.length <= 10) expiryStr += " 23:59:59";
                
                const expiryDate = new Date(expiryStr.replace(" ", "T"));
                if (!isNaN(expiryDate.getTime()) && mskNow > expiryDate) {
                    return res.status(200).send(`ERROR_LICENSE_EXPIRED|${user.expires}`);
                }
            } catch (e) {
                console.error("Date parse error:", e);
            }
        }

        // 4. Проверка доступа к скрипту
        const allowed = (user.scripts || []).map(s => String(s).toLowerCase().trim());
        if (!allowed.includes(targetScript)) {
            return res.status(200).send(`ERROR_NO_SCRIPT_ACCESS|${targetScript}`);
        }

        // 5. Получение даты обновления (через Commits API)
        let lastUpdate = "N/A";
        try {
            const commitRes = await fetch(`https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/commits?path=${codeFile}&per_page=1`, { 
                headers: { ...headers, 'Accept': 'application/vnd.github.v3+json' } 
            });
            if (commitRes.ok) {
                const commits = await commitRes.json();
                if (commits && commits[0]) {
                    lastUpdate = new Date(commits[0].commit.committer.date).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
                }
            }
        } catch (e) { lastUpdate = "Update check failed"; }

        // 6. Загрузка кода скрипта
        const codeRes = await fetch(`https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/contents/${codeFile}`, { 
            headers: { ...headers, 'Accept': 'application/vnd.github.v3.raw' } 
        });
        if (!codeRes.ok) return res.status(200).send('ERROR_CODE_FILE_NOT_FOUND');
        const codeContent = await codeRes.text();

        // 7. Формирование инъекции
        const injection = 
            `var TG_USER_ID = "${user.tg_id || "нет"}";\n` +
            `var SCRIPT_LAST_UPDATE = "${lastUpdate}";\n` +
            `var LICENSE_EXPIRES = "${user.expires || "Бессрочно"}";\n` +
            `var CURRENT_SCRIPT_TYPE = "${targetScript}";\n\n`;

        res.setHeader('Content-Type', 'text/javascript');
        return res.status(200).send(injection + codeContent);

    } catch (err) {
        // Если что-то упало, мы не отдаем 500, а возвращаем текст ошибки в игру
        return res.status(200).send(`SERVER_CRITICAL_ERROR: ${err.message}`);
    }
}
