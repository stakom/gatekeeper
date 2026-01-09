const crypto = require('crypto');

export default async function handler(req, res) {
    const { sponsor, hwid, sig, t } = req.query;
    
    const SIARO = "MIEFKR";
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const OWNER = "stakom";
    const PRIVATE_REPO = "sky-scripts";

    if (!sponsor || !hwid || !sig || !t) {
        return res.status(200).send('SERVER_ERROR_INVALID_REQUEST');
    }

    // 1. ПРОВЕРКА ПОДПИСИ (Защита от подбора параметров)
    const serverData = `${sponsor}:${hwid}:${SECRET_KEY}:${t}`;
    const serverSig = crypto.createHash('md5').update(serverData).digest("hex");

    if (serverSig !== sig) {
        return res.status(200).send('SERVER_ERROR_SIGNATURE_FAIL');
    }

    // 2. ПРОВЕРКА ВРЕМЕНИ (Ссылка живет 5 минут)
    const requestTime = parseInt(t);
    if (Date.now() - requestTime > 300000) {
        return res.status(200).send('SERVER_ERROR_LINK_EXPIRED');
    }

    try {
        // Получаем список разрешенных юзеров
        const authUrl = `https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/contents/users.json`;
        const authResponse = await fetch(authUrl, {
            headers: { 
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3.raw'
            }
        });

        const authData = await authResponse.json();
        const allowedUsers = authData.allowed_users;

        // Проверка HWID
        if (!allowedUsers[sponsor] || allowedUsers[sponsor] !== hwid) {
            return res.status(200).send('SERVER_ERROR_AUTH_FAILED');
        }

        // Получаем основной код (main.js)
        const codeUrl = `https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/contents/main.js`;
        const codeResponse = await fetch(codeUrl, {
            headers: { 
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3.raw'
            }
        });

        const mainCode = await codeResponse.text();
        res.setHeader('Content-Type', 'text/javascript');
        return res.status(200).send(mainCode);

    } catch (error) {
        return res.status(200).send('SERVER_ERROR_FATAL');
    }
}
