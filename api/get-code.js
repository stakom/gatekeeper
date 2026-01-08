export default async function handler(req, res) {
    const { sponsor } = req.query;
    
    // ПРОВЕРКА 1: Секретный ключ, который знает только Лоадер
    // Придумай тут любой сложный набор символов
    const LOADER_SECRET = "SkyBlock_Ultra_Secret_Key_998811"; 
    if (req.headers['x-access-key'] !== LOADER_SECRET) {
        return res.status(401).send("Unauthorized: Invalid API Key");
    }

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const OWNER = "stakom";
    const PRIVATE_REPO = "sky-scripts";

    if (!sponsor) return res.status(400).send('Error: Missing Sponsor');

    try {
        const authUrl = `https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/contents/users.json`;
        const authRes = await fetch(authUrl, {
            headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3.raw' }
        });

        const authData = await authRes.json();
        const allowed = authData.allowed_users.some(u => u.toLowerCase() === sponsor.toLowerCase());

        if (!allowed) return res.status(403).send('Forbidden');

        const codeUrl = `https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/contents/main.js`;
        const codeRes = await fetch(codeUrl, {
            headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3.raw' }
        });

        const mainCode = await codeRes.text();
        return res.status(200).send(mainCode);
    } catch (err) {
        return res.status(500).send('Server Error');
    }
}
