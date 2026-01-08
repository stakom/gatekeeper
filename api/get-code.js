export default async function handler(req, res) {
    // Разрешаем запросы только GET
    if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');

    const { sponsor } = req.query; // Получаем ник спонсора из запроса
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Секретный ключ из настроек Vercel
    const OWNER = "stakom"; // Твой ник на GitHub
    const PRIVATE_REPO = "sky-scripts"; // Название твоего ПРИВАТНОГО репозитория

    if (!sponsor) return res.status(400).send('Missing sponsor parameter');

    try {
        // 1. Сначала идем в приватный репозиторий за списком юзеров (users.json)
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

        // 2. Проверяем, есть ли спонсор в списке
        if (!allowedUsers.includes(sponsor.toLowerCase())) {
            return res.status(403).send('Access Denied: License not found');
        }

        // 3. Если спонсор найден, скачиваем основной код (main.js)
        const codeUrl = `https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/contents/main.js`;
        const codeResponse = await fetch(codeUrl, {
            headers: { 
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3.raw'
            }
        });

        if (!codeResponse.ok) return res.status(500).send('Error fetching script logic');

        const mainCode = await codeResponse.text();

        // 4. Отдаем код боту
        res.setHeader('Content-Type', 'text/javascript');
        return res.status(200).send(mainCode);

    } catch (error) {
        return res.status(500).send('Server Error: ' + error.message);
    }
}
