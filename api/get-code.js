export default async function handler(req, res) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    const { sponsor, hwid, script } = req.query;
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const OWNER = "stakom";
    const PRIVATE_REPO = "sky-scripts";

    const SCRIPT_FILES = { "farm": "main.js", "obsidian": "obsidian.js" };

    try {
        if (!sponsor || !hwid) return res.status(200).send('ERROR_EMPTY_QUERY');
        const targetScript = (script || "farm").toLowerCase().trim();
        const codeFile = SCRIPT_FILES[targetScript];

        const headers = { 
            'Authorization': `Bearer ${GITHUB_TOKEN}`, 
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Vercel-Gatekeeper'
        };

        const authRes = await fetch(`https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/contents/users.json`, { headers });
        const authData = await authRes.json();
        const groups = authData.access_groups || [];

        let user = null;
        // ПОИСК С ИГНОРИРОВАНИЕМ РЕГИСТРА
        for (const group of groups) {
            const nameMatch = group.names.some(n => n.toLowerCase().trim() === sponsor.toLowerCase().trim());
            const hwidMatch = group.hwids.some(h => h.toUpperCase().trim() === hwid.toUpperCase().trim());
            
            if (nameMatch && hwidMatch) {
                user = group;
                break;
            }
        }

        if (!user) return res.status(200).send('ERROR_AUTH_NOT_FOUND');

        // Проверка времени
        if (user.expires) {
            const mskNow = new Date(new Date().getTime() + (3 * 60 * 60 * 1000));
            let expiryStr = user.expires.trim();
            if (expiryStr.length <= 10) expiryStr += " 23:59:59";
            if (mskNow > new Date(expiryStr.replace(" ", "T"))) {
                return res.status(200).send(`ERROR_LICENSE_EXPIRED|${user.expires}`);
            }
        }

        // Проверка доступа к скрипту (игнорируем регистр)
        const allowed = (user.scripts || []).map(s => s.toLowerCase().trim());
        if (!allowed.includes(targetScript)) {
            return res.status(200).send(`ERROR_NO_SCRIPT_ACCESS|${targetScript}`);
        }

        // Загрузка кода
        const commitRes = await fetch(`https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/commits?path=${codeFile}&per_page=1`, { headers });
        let lastUpdate = "N/A";
        if (commitRes.ok) {
            const c = await commitRes.json();
            lastUpdate = new Date(c[0].commit.committer.date).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
        }

        const codeRes = await fetch(`https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/contents/${codeFile}`, { 
            headers: { ...headers, 'Accept': 'application/vnd.github.v3.raw' } 
        });
        const codeContent = await codeRes.text();

        const injection = `var TG_USER_ID = "${user.tg_id || "нет"}";\nvar SCRIPT_LAST_UPDATE = "${lastUpdate}";\nvar LICENSE_EXPIRES = "${user.expires || "Бессрочно"}";\nvar CURRENT_SCRIPT_TYPE = "${targetScript}";\n\n`;

        res.setHeader('Content-Type', 'text/javascript');
        return res.status(200).send(injection + codeContent);

    } catch (err) {
        return res.status(200).send(`SERVER_ERROR: ${err.message}`);
    }
}
