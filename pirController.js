import 'dotenv/config'
import { Gpio } from 'onoff';
import { exec } from 'child_process'
import fs from 'fs'
import { takeImage, convertImage } from './camController.js';
import { sendMessage, startLiveVideo } from './botController.js'
import { createLog, writeLog } from './logController.js';

const PIRPIN = process.env.PIRPIN
const LOCK_FILE = '/tmp/camera_busy.lock'

const pir = new Gpio(PIRPIN, 'in', 'rising', { debounceTimeout: 100 });
const movementLogPath = "/home/iklanlo/proyectos/detector_movimiento/logs/log" + new Date().valueOf() + ".txt";
let isProcessing = false;

function getFormattedDate() {
    const now = new Date()
    return now.toLocaleDateString() + " " + now.toLocaleTimeString();
}

createLog(movementLogPath)
console.log('Sistema de detección PIR iniciado (Modo Vídeo)...');

pir.watch(async (err, value) => {
    if (err) {
        console.error('error detectando movimiento', err)
        return 
    }

    if (fs.existsSync(LOCK_FILE)) return;
    
    if (value === 1 && !isProcessing) {
        isProcessing = true;
        const movementDate = getFormattedDate();
        console.log("[" + movementDate + "] Movimiento detectado, grabando vídeo...");
        
        try {
            const newDate = new Date().valueOf()
            // 1. Grabamos el vídeo (h264)
            const h264File = await takeImage(newDate)
            
            // 2. Convertimos a MP4
            console.log("Convirtiendo a MP4...");
            const mp4File = await convertImage(newDate)
            
            // 3. Enviamos por Telegram
            await sendMessage("[" + movementDate + "] movimiento detectado", mp4File)
            writeLog(movementLogPath, movementDate)
            
            console.log("Vídeo enviado. Esperando estabilización...");
            
            // 4. Cooldown: Esperamos 5 segundos antes de volver a vigilar
            // Esto es CRUCIAL para evitar el bucle de falsos positivos
            setTimeout(() => {
                isProcessing = false;
                console.log('Sensor rearmado y listo');
            }, 5000); 

        } catch (error) {
            console.error('Error en el proceso de vídeo:', error)
            isProcessing = false;
        }
    }
});

export const stopPir = async () => {
    await pir.unwatch()
    await pir.unexport()
    console.log('pir.watch parado')
}

startLiveVideo(0)

process.on('SIGINT', async ()=> {
    try {
        pir.unexport()
        process.exit()
    } catch (error) {
        console.error('Error en la limpieza de recursos', error)
    }
})
