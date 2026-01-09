export default async function handler(req, res) {
    const { sponsor, hwid, script } = req.query;
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const OWNER = "stakom";
    const PRIVATE_REPO = "sky-scripts";

    // 1. Конфигурация
    const SCRIPT_CONFIG = {
        "farm": { // Это наш основной Автофарм
            auth: "users.json",
            code: "main.js"
        },
        "obsidian": { // Это новый скрипт
            auth: "users_obsidian.json",
            code: "obsidian.js"
        }
    };

    // Проверка обязательных данных (sponsor и hwid приходят и от старого, и от нового лоадера)
    if (!sponsor || !hwid) return res.status(200).send('SERVER_ERROR_NO_DATA');

    // --- ЛОГИКА СОВМЕСТИМОСТИ ---
    // Если параметр script пустой (старый лоадер), принудительно ставим "farm"
    const targetKey = script ? script.toLowerCase() : "farm";
    const currentConfig = SCRIPT_CONFIG[targetKey] || SCRIPT_CONFIG["farm"];
    // ----------------------------

    try {
        // 2. Загружаем нужную базу лицензий
        const authUrl = `https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/contents/${currentConfig.auth}`;
        const authResponse = await fetch(authUrl, {
            headers: { 
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3.raw'
            }
        });

        if (!authResponse.ok) return res.status(200).send('SERVER_ERROR_AUTH_DB');
        
        const authData = await authResponse.json();
        const allowedUsers = authData.allowed_users;

        // 3. Проверка ника
        const userKey = Object.keys(allowedUsers).find(k => k.toLowerCase() === sponsor.toLowerCase());
        if (!userKey) return res.status(200).send('SERVER_ERROR_AUTH_FAILED');

        // 4. Проверка HWID (поддержка и строк, и массивов для гибкости)
        const allowedData = allowedUsers[userKey];
        let isAuthorized = false;
        if (Array.isArray(allowedData)) {
            isAuthorized = allowedData.includes(hwid);
        } else {
            isAuthorized = (allowedData === hwid);
        }

        if (!isAuthorized) return res.status(200).send('SERVER_ERROR_HWID_MISMATCH');

        // 5. Загрузка и отдача кода
        const codeUrl = `https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/contents/${currentConfig.code}`;
        const codeResponse = await fetch(codeUrl, {
            headers: { 
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3.raw'
            }
        });

        if (!codeResponse.ok) return res.status(200).send('SERVER_ERROR_CODE_NOT_FOUND');

        const scriptContent = await codeResponse.text();
        res.setHeader('Content-Type', 'text/javascript');
        return res.status(200).send(scriptContent);

    } catch (error) {
        return res.status(200).send('SERVER_ERROR_FATAL');
    }
}
