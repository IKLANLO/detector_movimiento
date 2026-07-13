import 'dotenv/config'
import { Gpio } from 'onoff';
import fs from 'fs'
import { takeImage, convertImage } from './camController.js';
import { sendMessage, sendTextMessage, startBotListener, sistemaActivo } from './botController.js'
import { createLog, writeLog, cleanOldLogs } from './logController.js';

const PIRPIN = process.env.PIRPIN
const LOCK_FILE = '/tmp/camera_busy.lock'

// Tiempo de espera (ms) antes de confirmar la detección releyendo el pin.
// El movimiento real mantiene el PIR en HIGH varios segundos.
// El ruido ambiental (sol, viento, insectos) genera pulsos muy breves que
// ya habrán bajado a 0 cuando hagamos la segunda lectura.
// Ajusta este valor si sigues teniendo falsos positivos (sube) o
// si se pierden detecciones rápidas (baja).
const CONFIRMATION_DELAY_MS = 600;

const logsDirectory = "/home/iklanlo/proyectos/detector_movimiento/logs";
const movementLogPath = logsDirectory + "/log" + new Date().valueOf() + ".txt";
let isCooldown = false;   // Evita re-disparos del PIR por el mismo evento (duración corta)
let isRecording = false;  // Evita grabar dos vídeos a la vez (dura lo que tarde la grabación)
let pir = null;
let pirActivo = false;

function getFormattedDate() {
    const now = new Date()
    return now.toLocaleDateString() + " " + now.toLocaleTimeString();
}

// Limpiar logs de días anteriores al arrancar
cleanOldLogs(logsDirectory);

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
    isCooldown = false;
    isRecording = false;

    pir = new Gpio(PIRPIN, 'in', 'rising', { debounceTimeout: 800 });
    console.log('[PIR] Sistema de detección PIR iniciado (Modo Vídeo)...');

    pir.watch(async (err, value) => {
        if (err) {
            console.error('error detectando movimiento', err)
            return 
        }

        // Si el sistema fue desactivado mientras esperaba, ignorar
        if (!pirActivo) return;

        if (fs.existsSync(LOCK_FILE)) return;

        if (value === 1 && !isCooldown && !isRecording) {
            // ── Confirmación anti-falsos-positivos ──────────────────────────
            // Esperamos CONFIRMATION_DELAY_MS y reeleemos el pin.
            // Ruido ambiental (sol, viento, insectos): pulso muy corto → pin = 0 → descartado.
            // Movimiento real: el PIR permanece en HIGH varios segundos → pin = 1 → grabamos.
            await new Promise(resolve => setTimeout(resolve, CONFIRMATION_DELAY_MS));

            // Re-comprobar que el sistema sigue activo y el pin sigue en HIGH
            if (!pirActivo) return;
            const confirmValue = await pir.read().catch(() => 0);
            if (confirmValue !== 1) {
                console.log('[PIR] Pulso descartado (falso positivo): el pin bajó durante la confirmación.');
                return;
            }
            // ────────────────────────────────────────────────────────────────

            const movementDate = getFormattedDate();
            console.log("[" + movementDate + "] Movimiento confirmado, grabando vídeo...");

            // ── Cooldown corto: evita re-disparos del mismo evento PIR ──
            // Se activa inmediatamente y es independiente de la grabación.
            isCooldown = true;
            setTimeout(() => {
                isCooldown = false;
                console.log('[PIR] Sensor rearmado para nueva detección.');
            }, 10000); // 10 segundos es suficiente para que el PIR baje a LOW

            // ── Grabación: bloquea la cámara mientras dure el proceso ──
            isRecording = true;
            try { fs.writeFileSync(LOCK_FILE, '1'); } catch (_) {}

            // Lanzamos la grabación de forma no bloqueante para el watcher
            (async () => {
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

                    console.log("Vídeo enviado. Limpiando archivos locales...");

                    // 4. Limpieza de archivos de vídeo locales
                    try {
                        if (fs.existsSync(h264File)) fs.unlinkSync(h264File);
                        if (fs.existsSync(mp4File)) fs.unlinkSync(mp4File);
                        console.log("Archivos temporales de vídeo eliminados correctamente.");
                    } catch (cleanError) {
                        console.error("Error al eliminar archivos temporales:", cleanError);
                    }

                } catch (error) {
                    console.error('Error en el proceso de vídeo:', error);
                } finally {
                    // Liberar la cámara siempre, tanto en éxito como en error
                    try { if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE); } catch (_) {}
                    isRecording = false;
                    console.log('[CAM] Cámara liberada.');
                }
            })();
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
