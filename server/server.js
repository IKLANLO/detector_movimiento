import express from 'express';
import { spawn } from 'child_process';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import fs from 'fs';

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });


const app = express();
const port = 3000;
const LOCK_FILE = '/tmp/camera_busy.lock';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID_PRUEBA;

let currentNgrokUrl = "";

if (fs.existsSync(LOCK_FILE)) {
    fs.unlinkSync(LOCK_FILE);
}

function getNgrokURL() {
    return new Promise((resolve, reject) => {
        console.log('Iniciando ngrok...');
        const ngrok = spawn('ngrok', ['http', port.toString(), '--log=stdout']);

        const timeout = setTimeout(() => {
            reject(new Error('Timeout esperando a ngrok'));
        }, 15000);

        ngrok.stdout.on('data', (data) => {
            const output = data.toString();
            const match = output.match(/url=(https:\/\/[a-z0-9-]+\.ngrok-free\.app)/);
            if (match) {
                clearTimeout(timeout);
                currentNgrokUrl = match[1];
                resolve(match[1]);
            }
        });

        ngrok.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });

        process.on('SIGINT', () => {
            ngrok.kill();
            if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE);
            process.exit();
        });
    });
}

app.get('/info', (req, res) => {
    if (currentNgrokUrl) {
        res.json({ url: currentNgrokUrl });
    } else {
        res.status(503).json({ error: "Ngrok no está listo" });
    }
});

app.get('/', (req, res) => {
    console.log('Cliente conectado al stream');
    fs.writeFileSync(LOCK_FILE, 'busy');
    res.setHeader('Content-Type', 'video/mp2t');

    const libcamera = spawn('libcamera-vid', [
        '--codec', 'h264',
        '--width', '1280',
        '--height', '720',
        '--framerate', '25',
        '--inline',
        '--tuning-file', '/usr/share/libcamera/ipa/rpi/vc4/imx708_noir.json',
        '-t', '0',
        '--nopreview',
        '--output', '-'
    ]);

    const ffmpeg = spawn('ffmpeg', [
        '-i', 'pipe:0',
        '-c', 'copy',
        '-f', 'mpegts',
        'pipe:1'
    ]);

    libcamera.stdout.pipe(ffmpeg.stdin);
    ffmpeg.stdout.pipe(res);

    req.on('close', () => {
        console.log('Cliente desconectado. Liberando cámara...');
        libcamera.kill();
        ffmpeg.kill();
        if (fs.existsSync(LOCK_FILE)) {
            fs.unlinkSync(LOCK_FILE);
        }
    });
});

app.listen(port, '0.0.0.0', async () => {
    console.log("Servidor de streaming escuchando en puerto " + port);
    try {
        await getNgrokURL();
        console.log("Ngrok listo en: " + currentNgrokUrl);
    } catch (error) {
        console.error('Error al iniciar ngrok:', error);
    }
});