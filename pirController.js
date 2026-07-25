import 'dotenv/config'
import { Gpio } from 'onoff';
import fs from 'fs'
import path from 'path'
import os from 'os'
import { takeImage, convertImage } from './camController.js';
import { sendMessage, sendTextMessage, startBotListener, sistemaActivo } from './botController.js'
import { createLog, writeLog, cleanOldLogs } from './logController.js';

// Conversión numérica explícita del pin con fallback seguro
const PIRPIN = Number(process.env.PIRPIN) || 4;

// Ruta de lock-file multiplataforma en directorio temporal del sistema
const LOCK_FILE = path.join(os.tmpdir(), 'camera_busy.lock');

// ── Configuración Anti-Falsos-Positivos (Muestreo Sostenido) ──────────────
// El movimiento real mantiene el PIR en HIGH continuamente durante varios segundos.
// El ruido o interferencias generan picos aislados de corta duración.
// Realizamos 5 lecturas espaciadas por 200 ms (total 1000 ms).
// Se acepta la detección únicamente si el pin está HIGH en al menos el 80% (4/5) de las lecturas.
const CONFIRMATION_SAMPLES = 5;
const SAMPLE_INTERVAL_MS = 200;
const REQUIRED_HIGH_RATIO = 0.8;

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

function ensureLockDir() {
    try {
        const dir = path.dirname(LOCK_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    } catch (_) {}
}

// Limpiar logs de días anteriores al arrancar
cleanOldLogs(logsDirectory);

createLog(movementLogPath)

// ─────────────────────────────────────────────
//  Activa el sensor PIR y empieza a vigilar
// ─────────────────────────────────────────────
export async function activarPir() {
    if (pirActivo) {
        console.log('[PIR] El sensor ya estaba activo.');
        return;
    }

    // Asegurar limpieza de cualquier observador o recurso previo si existía
    if (pir) {
        await desactivarPir();
    }

    pirActivo = true;
    isCooldown = false;
    isRecording = false;

    try {
        pir = new Gpio(PIRPIN, 'in', 'rising', { debounceTimeout: 1000 });
        console.log(`[PIR] Sistema de detección PIR iniciado en GPIO ${PIRPIN} (Modo Muestreo Sostenido)...`);
    } catch (gpioError) {
        console.error('[PIR] Error al instanciar el pin GPIO:', gpioError);
        pirActivo = false;
        pir = null;
        return;
    }

    pir.watch(async (err, value) => {
        if (err) {
            console.error('[PIR] Error detectando movimiento:', err);
            return;
        }

        // Si el sistema fue desactivado mientras esperaba, ignorar
        if (!pirActivo) return;

        if (fs.existsSync(LOCK_FILE)) return;

        if (value === 1 && !isCooldown && !isRecording) {
            // ── Confirmación anti-falsos-positivos (Muestreo sostenido) ────────
            let highCount = 0;
            for (let i = 0; i < CONFIRMATION_SAMPLES; i++) {
                await new Promise(resolve => setTimeout(resolve, SAMPLE_INTERVAL_MS));
                if (!pirActivo) return;
                const sampleValue = await pir.read().catch(() => 0);
                if (sampleValue === 1) {
                    highCount++;
                }
            }

            const highRatio = highCount / CONFIRMATION_SAMPLES;
            if (highRatio < REQUIRED_HIGH_RATIO) {
                console.log(`[PIR] Pulso descartado (falso positivo): Pin en HIGH solo el ${(highRatio * 100).toFixed(0)}% del muestreo (${highCount}/${CONFIRMATION_SAMPLES}).`);
                return;
            }
            // ────────────────────────────────────────────────────────────────

            const movementDate = getFormattedDate();
            console.log("[" + movementDate + "] Movimiento confirmado por muestreo sostenido, grabando vídeo...");

            // ── Cooldown corto: evita re-disparos del mismo evento PIR ──
            isCooldown = true;
            setTimeout(() => {
                isCooldown = false;
                console.log('[PIR] Sensor rearmado para nueva detección.');
            }, 10000); // 10 segundos para estabilización del PIR

            // ── Grabación: bloquea la cámara mientras dure el proceso ──
            isRecording = true;
            ensureLockDir();
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
    if (!pirActivo && !pir) {
        console.log('[PIR] El sensor ya estaba inactivo.');
        return;
    }
    pirActivo = false;
    if (pir) {
        try {
            pir.unwatch();
            pir.unexport();
            console.log('[PIR] Sensor desactivado.');
        } catch (err) {
            console.error('[PIR] Error al desactivar el sensor:', err);
        } finally {
            pir = null;
        }
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

