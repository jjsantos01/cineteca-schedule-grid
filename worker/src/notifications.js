/**
 * Cloudflare Worker: cinetk
 * Módulo de Notificaciones y Alertas (Telegram Bot)
 */

/**
 * Enviar alerta por Telegram en caso de fallos del Cron Trigger o pruebas
 * @param {object} env Variables de entorno del worker
 * @param {string} text Mensaje con formato HTML
 */
export async function sendTelegramNotification(env, text) {
    if (!env?.TELEGRAM_BOT_TOKEN || !env?.TELEGRAM_CHAT_ID) {
        console.log('[Telegram Alert] Skipped (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured in env)');
        return { success: false, reason: 'secrets_missing' };
    }

    try {
        const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: env.TELEGRAM_CHAT_ID,
                text,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            })
        });

        const data = await res.json();
        if (!res.ok || !data.ok) {
            console.warn('[Telegram Alert] Telegram API error:', data);
            return { success: false, error: data };
        }

        console.log('[Telegram Alert] Message delivered successfully.');
        return { success: true, result: data };
    } catch (e) {
        console.warn('[Telegram Alert] Network error sending notification:', e.message);
        return { success: false, error: e.message };
    }
}
