import 'dotenv/config'
import fetch from 'node-fetch'
import fs from 'fs'
import FormData from 'form-data'
import { spawn } from 'child_process'
import { startStream } from './streamController.js'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID_PRUEBA

export async function sendMessage(message, imagePath) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`
    
        if (!fs.existsSync(imagePath)) {
            console.error('El archivo no se encuentra en la ruta especificada');
            return;
        }
        
        // Crear un stream de la imagen
        const imageStream = fs.createReadStream(imagePath)
        
         // Crear un objeto FormData
        const form = new FormData();
        form.append('chat_id', TELEGRAM_CHAT_ID)
        form.append('caption', message)
        form.append('video', imageStream)

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

export async function startLiveVideoMessage(message) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
        
         // Crear un objeto FormData
        const form = new FormData();
        form.append('chat_id', TELEGRAM_CHAT_ID)
        form.append('text', message)

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

//función que permitirá enviar la señal de video en vivo por medio de Telegram
export async function startLiveVideo(offset) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${offset}`

        const response = await fetch(url)
        const data = await response.json()

        const updates = data.result

        if (updates.length > 0) {
            for (const update of updates) {
                if (update.message){
                    const chatId = update.message.chat.id
                    const text = update.message.text
                    //aseguramos que sólo los usuarios con id válido puedan ejecutar el comando
                    if (chatId == TELEGRAM_CHAT_ID && text === '/vervideo') {
                        console.log('SOLICITUD DE VIDEO RECIBIDA');
                        try {
                            // Consultamos al servidor de streaming local para obtener la URL de ngrok
                            const response = await fetch('http://localhost:3000/info');
                            if (response.ok) {
                                const data = await response.json();
                                await startLiveVideoMessage(`🎥 *Stream en vivo activo*\n\nPara ver en VLC usa el siguiente enlace:\n${data.url}`);
                            } else {
                                await startLiveVideoMessage('⚠️ El servidor de streaming no está respondiendo. Asegúrate de que esté encendido.');
                            }
                        } catch (error) {
                            console.error('Error al obtener info del stream:', error);
                            await startLiveVideoMessage('❌ Error: El servidor de streaming parece estar apagado.');
                        }
                    }
                }
            }
            const newOffset = updates[updates.length - 1].update_id + 1
            await startLiveVideo(newOffset)

        } else if(updates.length === 0) {
            await startLiveVideo(offset)
        }
    } catch (error) {
        console.log('Error obteniendo actualizaciones de Telegram', error);
    }
}
