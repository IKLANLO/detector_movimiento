import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🚀 Iniciando sistema de detección de movimiento...');

// --- Lanzar server.js ---
const serverProcess = spawn('node', [path.join(__dirname, 'server', 'server.js')], {
    stdio: 'inherit',
    cwd: __dirname
});

serverProcess.on('error', (err) => {
    console.error('❌ Error al iniciar server.js:', err);
});

serverProcess.on('exit', (code) => {
    console.log(`⚠️  server.js terminó con código ${code}`);
});

// --- Lanzar pirController.js ---
const pirProcess = spawn('node', [path.join(__dirname, 'pirController.js')], {
    stdio: 'inherit',
    cwd: __dirname
});

pirProcess.on('error', (err) => {
    console.error('❌ Error al iniciar pirController.js:', err);
});

pirProcess.on('exit', (code) => {
    console.log(`⚠️  pirController.js terminó con código ${code}`);
});

// --- Limpieza al salir ---
process.on('SIGINT', () => {
    console.log('\n🛑 Apagando sistema...');
    serverProcess.kill('SIGINT');
    pirProcess.kill('SIGINT');
    process.exit(0);
});

process.on('SIGTERM', () => {
    serverProcess.kill('SIGTERM');
    pirProcess.kill('SIGTERM');
    process.exit(0);
});
