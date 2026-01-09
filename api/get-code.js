export default async function handler(req, res) {
    const { sponsor } = req.query;
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const OWNER = "stakom";
    const PRIVATE_REPO = "sky-scripts";

    // Всегда 200, чтобы Java не «палила» URL в чате при ошибках
    if (!sponsor) return res.status(200).send('SERVER_ERROR_NO_SPONSOR');

    try {
        // 1. Получаем список лицензированных спонсоров (владельцев)
        const authUrl = `https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/contents/users.json`;
        const authResponse = await fetch(authUrl, {
            headers: { 
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3.raw'
            }
        });

        if (!authResponse.ok) return res.status(200).send('SERVER_ERROR_AUTH_DB');
        
        const authData = await authResponse.json();
        const allowedUsers = authData.allowed_users.map(u => u.toLowerCase());

        // 2. Проверяем, разрешен ли доступ этому спонсору
        if (!allowedUsers.includes(sponsor.toLowerCase())) {
            return res.status(200).send('SERVER_ERROR_AUTH_FAILED');
        }

        // 3. Если спонсор в списке — получаем чистый код скрипта
        const codeUrl = `https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/contents/main.js`;
        const codeResponse = await fetch(codeUrl, {
            headers: { 
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3.raw'
            }
        });

        if (!codeResponse.ok) return res.status(200).send('SERVER_ERROR_NO_CODE');

        const mainCode = await codeResponse.text();

        // 4. Отправляем код без лишних проверок внутри
        res.setHeader('Content-Type', 'text/javascript');
        return res.status(200).send(mainCode);

    } catch (error) {
        return res.status(200).send('SERVER_ERROR_FATAL');
    }
}
