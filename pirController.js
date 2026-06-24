import 'dotenv/config'
import { Gpio } from 'onoff';
import fs from 'fs'
import { takeImage, convertImage } from './camController.js';
import { sendMessage, sendTextMessage, startBotListener, sistemaActivo } from './botController.js'
import { createLog, writeLog } from './logController.js';

const PIRPIN = process.env.PIRPIN
const LOCK_FILE = '/tmp/camera_busy.lock'

const movementLogPath = "/home/iklanlo/proyectos/detector_movimiento/logs/log" + new Date().valueOf() + ".txt";
let isProcessing = false;
let pir = null;
let pirActivo = false;

function getFormattedDate() {
    const now = new Date()
    return now.toLocaleDateString() + " " + now.toLocaleTimeString();
}

createLog(movementLogPath)

// ─────────────────────────────────────────────
//  Activa el sensor PIR y empieza a vigilar
// ─────────────────────────────────────────────
export function activarPir() {
    if (pirActivo) {
        console.log('[PIR] El sensor ya estaba activo.');
        return;
    }
    pirActivo = true;
    isProcessing = false;

    pir = new Gpio(PIRPIN, 'in', 'rising', { debounceTimeout: 100 });
    console.log('[PIR] Sistema de detección PIR iniciado (Modo Vídeo)...');

    pir.watch(async (err, value) => {
        if (err) {
            console.error('error detectando movimiento', err)
            return 
        }

        // Si el sistema fue desactivado mientras esperaba, ignorar
        if (!pirActivo) return;

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
}

// ─────────────────────────────────────────────
//  Desactiva el sensor PIR
// ─────────────────────────────────────────────
export async function desactivarPir() {
    if (!pirActivo || !pir) {
        console.log('[PIR] El sensor ya estaba inactivo.');
        return;
    }
    pirActivo = false;
    try {
        pir.unwatch();
        pir.unexport();
        pir = null;
        console.log('[PIR] Sensor desactivado.');
    } catch (err) {
        console.error('[PIR] Error al desactivar el sensor:', err);
    }
}

// ─────────────────────────────────────────────
//  Punto de entrada: arrancar bot y esperar comandos
// ─────────────────────────────────────────────
async function main() {
    console.log('🤖 Bot de Telegram iniciado. Esperando comandos /activar y /desactivar...');
    await sendTextMessage('🤖 Sistema iniciado. Usa /activar para comenzar la detección o /ayuda para ver los comandos.');

    startBotListener(0,
        // onActivar
        () => {
            activarPir();
        },
        // onDesactivar
        async () => {
            await desactivarPir();
        }
    );
}

main().catch(err => console.error('Error al iniciar pirController:', err));

process.on('SIGINT', async () => {
    try {
        await desactivarPir();
        process.exit()
    } catch (error) {
        console.error('Error en la limpieza de recursos', error)
    }
})
