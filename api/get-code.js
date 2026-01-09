export default async function handler(req, res) {
    const { sponsor } = req.query;
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const OWNER = "stakom";
    const PRIVATE_REPO = "sky-scripts";

    // Базовая проверка наличия параметра
    if (!sponsor) {
        return res.status(200).send('SERVER_ERROR: Missing sponsor parameter');
    }

    try {
        // 1. Получаем список разрешенных пользователей из GitHub
        const authUrl = `https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/contents/users.json`;
        const authResponse = await fetch(authUrl, {
            headers: { 
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3.raw'
            }
        });

        if (!authResponse.ok) {
            // Возвращаем 200, чтобы не провоцировать Java на вывод URL ошибки
            return res.status(200).send('SERVER_ERROR: Auth Database unreachable');
        }
        
        const authData = await authResponse.json();
        const allowedUsers = authData.allowed_users.map(u => u.toLowerCase());

        // 2. Проверка ника (регистронезависимая)
        const userNick = sponsor.toLowerCase();
        if (!allowedUsers.includes(userNick)) {
            return res.status(200).send('SERVER_ERROR_AUTH_FAILED');
        }

        // 3. Получаем основной код скрипта (main.js) из GitHub
        const codeUrl = `https://api.github.com/repos/${OWNER}/${PRIVATE_REPO}/contents/main.js`;
        const codeResponse = await fetch(codeUrl, {
            headers: { 
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3.raw'
            }
        });

        if (!codeResponse.ok) {
            return res.status(200).send('SERVER_ERROR: Script file not found on GitHub');
        }

        let mainCode = await codeResponse.text();

        // 4. Генерируем защиту (License Binding)
        // Превращаем ник в массив ASCII-кодов, чтобы его нельзя было найти обычным поиском по тексту
        const nickBytes = sponsor.split('').map(char => char.charCodeAt(0)).join(',');

        const securityPrefix = `
/* --- СИСТЕМА ЗАЩИТЫ --- */
(function() {
    var _target = [${nickBytes}].map(function(c){ return String.fromCharCode(c); }).join('');
    if (typeof SponsorNickname === 'undefined' || SponsorNickname.toLowerCase() !== _target.toLowerCase()) {
        Chat.log("§c§l[Лицензия] §fОшибка авторизации! Скрипт привязан к нику: §b" + _target);
        throw "License mismatch";
    }
})();
/* ----------------------- */
`;

        // 5. Собираем финальный код
        // Можно также добавить замену меток внутри кода, если они там есть
        const finalCode = securityPrefix + "\n" + mainCode;

        // Отправляем результат
        res.setHeader('Content-Type', 'text/javascript');
        return res.status(200).send(finalCode);

    } catch (error) {
        // Даже при фатальной ошибке сервера возвращаем 200 с текстом ошибки
        return res.status(200).send('SERVER_ERROR: ' + error.message);
    }
}
