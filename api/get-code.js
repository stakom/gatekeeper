export default async function handler(req, res) {
    // 1. Проверка метода
    if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');

    const { sponsor } = req.query;
    
    // 2. Проверка секретного ключа (чтобы никто другой не дергал твой API)
    const LOADER_SECRET = "SkyBlock_Ultra_Secret_Key_998811"; 
    if (req.headers['x-access-key'] !== LOADER_SECRET) {
        return res.status(401).send("Unauthorized: Invalid API Key");
    }

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Должен быть прописан в Environment Variables на Vercel
    const OWNER = "stakom";
    const PRIVATE_REPO = "sky-scripts";

    if (!sponsor) return res.status(400).send('Missing sponsor parameter');

    try {
        // 3. Загружаем список разрешенных пользователей
        const authUrl = `https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/contents/users.json`;
        const authResponse = await fetch(authUrl, {
            headers: { 
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3.raw'
            }
        });

        if (!authResponse.ok) return res.status(500).send('Error accessing Auth Database');
        
        const authData = await authResponse.json();
        const allowedUsers = authData.allowed_users.map(u => u.toLowerCase());

        // 4. Проверка лицензии
        if (!allowedUsers.includes(sponsor.toLowerCase())) {
            return res.status(403).send('Access Denied: License not found');
        }

        // 5. Загружаем основной код (main.js)
        const codeUrl = `https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/contents/main.js`;
        const codeResponse = await fetch(codeUrl, {
            headers: { 
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3.raw'
            }
        });

        if (!codeResponse.ok) return res.status(500).send('Error fetching script logic');

        const mainCode = await codeResponse.text();

        // 6. Отдаем код боту
        res.setHeader('Content-Type', 'text/javascript');
        return res.status(200).send(mainCode);

    } catch (error) {
        return res.status(500).send('Server Error: ' + error.message);
    }
}
