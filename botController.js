import 'dotenv/config'
import fetch from 'node-fetch'
import fs from 'fs'
import FormData from 'form-data'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID_PRUEBA

// Estado del sistema (exportado para que pirController pueda leerlo)
export let sistemaActivo = false;

// ─────────────────────────────────────────────
//  Enviar vídeo grabado por Telegram
// ─────────────────────────────────────────────
export async function sendMessage(message, imagePath) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`
    
        if (!fs.existsSync(imagePath)) {
            console.error('El archivo no se encuentra en la ruta especificada');
            return;
        }
        
        const imageStream = fs.createReadStream(imagePath)
        const form = new FormData();
        form.append('chat_id', TELEGRAM_CHAT_ID)
        form.append('caption', message)
        form.append('video', imageStream)

        const response = await fetch(url, {
            method: 'POST',
            body: form,
            headers: form.headers
        })

        const data = await response.json()
        
        if (!data.ok){
            console.error('Error al enviar el mensaje a Telegram', data.description)
        }
        
    } catch (err) {
        console.error('Error al enviar el mensaje', err)
    }
}

// ─────────────────────────────────────────────
//  Enviar mensaje de texto por Telegram
// ─────────────────────────────────────────────
export async function sendTextMessage(text) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
        const form = new FormData();
        form.append('chat_id', TELEGRAM_CHAT_ID)
        form.append('text', text)
        form.append('parse_mode', 'Markdown')

        const response = await fetch(url, {
            method: 'POST',
            body: form,
            headers: form.getHeaders()
        })

        const data = await response.json()
        
        if (!data.ok){
            console.error('Error al enviar el mensaje a Telegram', data.description)
        }
    } catch (err) {
        console.error('Error al enviar el mensaje', err)
    }
}

// Alias para compatibilidad con código anterior
export const startLiveVideoMessage = sendTextMessage;

// ─────────────────────────────────────────────
//  Bucle principal: escucha comandos de Telegram
// ─────────────────────────────────────────────
export async function startBotListener(offset = 0, onActivar, onDesactivar) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${offset}&timeout=30`

        const response = await fetch(url)
        const data = await response.json()

        const updates = data.result

        if (updates && updates.length > 0) {
            for (const update of updates) {
                if (update.message) {
                    const chatId = update.message.chat.id
                    const text = (update.message.text || '').trim()

                    // Seguridad: sólo el chat autorizado puede ejecutar comandos
                    if (String(chatId) !== String(TELEGRAM_CHAT_ID)) continue;

                    console.log(`[Bot] Comando recibido: ${text}`)

                    if (text === '/activar') {
                        if (sistemaActivo) {
                            await sendTextMessage('ℹ️ El sistema de detección ya estaba *activado*.')
                        } else {
                            sistemaActivo = true;
                            if (onActivar) await onActivar();
                            await sendTextMessage('✅ Sistema de detección *activado*. Vigilando movimiento...')
                        }

                    } else if (text === '/desactivar') {
                        if (!sistemaActivo) {
                            await sendTextMessage('ℹ️ El sistema de detección ya estaba *desactivado*.')
                        } else {
                            sistemaActivo = false;
                            if (onDesactivar) await onDesactivar();
                            await sendTextMessage('🔴 Sistema de detección *desactivado*.')
                        }

                    } else if (text === '/estado') {
                        const estado = sistemaActivo ? '🟢 *Activo*' : '🔴 *Inactivo*'
                        await sendTextMessage(`Estado del sistema: ${estado}`)

                    } else if (text === '/vervideo') {
                        console.log('SOLICITUD DE VIDEO RECIBIDA');
                        try {
                            const res = await fetch('http://localhost:3000/info');
                            if (res.ok) {
                                const info = await res.json();
                                await sendTextMessage(`🎥 *Stream en vivo activo*\n\nPara ver en VLC usa el siguiente enlace:\n${info.url}`)
                            } else {
                                await sendTextMessage('⚠️ El servidor de streaming no está respondiendo.')
                            }
                        } catch (error) {
                            console.error('Error al obtener info del stream:', error);
                            await sendTextMessage('❌ Error: El servidor de streaming parece estar apagado.')
                        }

                    } else if (text === '/ayuda') {
                        await sendTextMessage(
                            '📋 *Comandos disponibles:*\n\n' +
                            '`/activar` — Activa la detección de movimiento y el servidor\n' +
                            '`/desactivar` — Desactiva la detección de movimiento y el servidor\n' +
                            '`/estado` — Muestra el estado actual del sistema\n' +
                            '`/vervideo` — Obtiene el enlace del stream en vivo\n' +
                            '`/ayuda` — Muestra esta ayuda'
                        )
                    }
                }
            }

            const newOffset = updates[updates.length - 1].update_id + 1
            return startBotListener(newOffset, onActivar, onDesactivar)

        } else {
            return startBotListener(offset, onActivar, onDesactivar)
        }

    } catch (error) {
        console.error('Error obteniendo actualizaciones de Telegram:', error);
        // Esperar 5 segundos antes de reintentar si hay error de red
        await new Promise(res => setTimeout(res, 5000));
        return startBotListener(offset, onActivar, onDesactivar)
    }
}
