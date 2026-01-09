export default async function handler(req, res) {
    const { sponsor, hwid } = req.query;
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const OWNER = "stakom";
    const PRIVATE_REPO = "sky-scripts";

    if (!sponsor || !hwid) return res.status(200).send('SERVER_ERROR_NO_DATA');

    try {
        const authUrl = `https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/contents/users.json`;
        const authResponse = await fetch(authUrl, {
            headers: { 
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3.raw'
            }
        });

        if (!authResponse.ok) return res.status(200).send('SERVER_ERROR_AUTH_DB');
        
        const authData = await authResponse.json();
        const allowedUsers = authData.allowed_users; // Теперь это объект { "ник": "ид" }

        // Проверка ника (без учета регистра)
        const userKey = Object.keys(allowedUsers).find(k => k.toLowerCase() === sponsor.toLowerCase());

        if (!userKey) {
            return res.status(200).send('SERVER_ERROR_AUTH_FAILED');
        }

        // Проверка HWID
        if (allowedUsers[userKey] !== hwid) {
            return res.status(200).send('SERVER_ERROR_HWID_MISMATCH');
        }

        // Если всё верно — тянем код
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
