export default async function handler(req, res) {
    // 1. Проверяем, что это POST запрос от Telegram
    if (req.method === 'POST') {
        const { message } = req.body;

        // 2. Если пользователь написал /start
        if (message && message.text === '/start') {
            const BOT_TOKEN = "8590267082:AAFt5aMBQfXiZyjt9peNh6wWYMc2dOUw54I";
            const chatId = message.chat.id;
            const firstName = message.from.first_name || "Пользователь";

            const text = `Привет, ${firstName}!\n\n✅ <b>Вы успешно разрешили боту присылать вам уведомления от скриптов.</b>\n\nВаш Chat ID: <code>${chatId}</code>\n\n<i>Передайте этот ID администратору, чтобы привязать уведомления к вашему аккаунту.</i>`;

            // 3. Отправляем ответ через API Telegram
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: text,
                    parse_mode: 'HTML'
                })
            });
        }
        // Отвечаем Telegram, что всё ок
        return res.status(200).send('OK');
    } else {
        // Если зайти на страницу просто через браузер
        return res.status(200).send('Бот запущен и ожидает сообщений!');
    }
}
