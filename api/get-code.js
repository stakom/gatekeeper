export default async function handler(req, res) {
    const { sponsor } = req.query;
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const OWNER = "stakom";
    const PRIVATE_REPO = "sky-scripts";

    if (!sponsor) return res.status(400).send('Missing sponsor parameter');

    try {
        // 1. Получаем список пользователей
        const authUrl = `https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/contents/users.json`;
        const authResponse = await fetch(authUrl, {
            headers: { 
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3.raw'
            }
        });

        if (!authResponse.ok) return res.status(500).send('Auth DB Error');
        
        const authData = await authResponse.json();
        const allowedUsers = authData.allowed_users.map(u => u.toLowerCase());

        // 2. Проверка ника
        const userNick = sponsor.toLowerCase();
        if (!allowedUsers.includes(userNick)) {
            return res.status(403).send('Access Denied');
        }

        // 3. Получаем основной код
        const codeUrl = `https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/contents/main.js`;
        const codeResponse = await fetch(codeUrl, {
            headers: { 
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3.raw'
            }
        });

        if (!codeResponse.ok) return res.status(500).send('Script Fetch Error');

        let mainCode = await codeResponse.text();

        // =========================================================
        // 4. ПРИВЯЗКА КОДА К НИКУ (Server-Side Injection)
        // =========================================================
        
        // Создаем проверочный префикс. 
        // Мы используем String.fromCharCode, чтобы ИИ или хакер не нашли ник простым поиском текста.
        const encodedNick = sponsor.split('').map(char => char.charCodeAt(0)).join(',');
        
        const securityPrefix = `
(function(){
    var _0xTarget = [${encodedNick}].map(function(c){return String.fromCharCode(c)}).join('');
    if (typeof SponsorNickname === 'undefined' || SponsorNickname.toLowerCase() !== _0xTarget.toLowerCase()) {
        var msg = "§c§l[Auth] §fЭтот скрипт был куплен игроком §b" + _0xTarget + "§f и не работает у вас!";
        if (typeof Chat !== 'undefined') { Chat.log(msg); }
        throw "License Auth Failed";
    }
})();
`;

        // Соединяем проверку и основной код
        const protectedCode = securityPrefix + "\n" + mainCode;

        res.setHeader('Content-Type', 'text/javascript');
        return res.status(200).send(protectedCode);

    } catch (error) {
        return res.status(500).send('Error: ' + error.message);
    }
}
