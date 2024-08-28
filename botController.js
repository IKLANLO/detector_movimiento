import 'dotenv/config';
import fetch from 'node-fetch';
import fs from 'fs'
import FormData from 'form-data'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID

export async function sendMessage(message, imagePath) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`
    
        if (!fs.existsSync(imagePath)) {
            console.error('El archivo no se encuentra en la ruta especificada');
            return;
        }
        
        // Crear un stream de la imagen
        const imageStream = fs.createReadStream(imagePath);
        
         // Crear un objeto FormData
        const form = new FormData();
        form.append('chat_id', TELEGRAM_CHAT_ID);
        form.append('caption', message);
        form.append('photo', imageStream)

        const response = await fetch(url, {
            method: 'POST',
            body: form,
            headers: form.headers
        })

        const data = await response.json()
        
        if (!data.ok){
            console.error('Error al enviar el mensaje a Telegram', data.description);
        }
        
    } catch (err) {
        console.error('Error al enviar el mensaje', err);
    }
}

