import fs from 'fs'
import path from 'path'

// Función para crear el archivo al iniciar el programa
export function createLog(movementLogPath) {
    fs.writeFile(movementLogPath,'',(err) => {
        if(err) {
            console.error('Error creando el log', err);
        }
    })
}

// Función para guardar en el log los movimientos detectados
export function writeLog(movementLogPath, movementDate) {
    fs.appendFile(movementLogPath, `[${movementDate}] movimiento detectado\n`, (err) => {
        if(err) {
            console.error('Error escribiendo en el log', err)
        }
    })
}

// Función para eliminar logs de días anteriores
export function cleanOldLogs(logsDir) {
    try {
        if (!fs.existsSync(logsDir)) return;

        const files = fs.readdirSync(logsDir);
        const hoy = new Date();
        // Ponemos las horas de "hoy" a 00:00:00 para comparar sólo por fecha (día)
        hoy.setHours(0, 0, 0, 0);

        files.forEach((file) => {
            const filePath = path.join(logsDir, file);
            
            // Verificamos que sea un archivo de log válido (ej: log1718360000000.txt)
            if (file.startsWith('log') && file.endsWith('.txt')) {
                try {
                    const stats = fs.statSync(filePath);
                    const fechaModificacion = new Date(stats.mtime);
                    fechaModificacion.setHours(0, 0, 0, 0);

                    // Si la fecha de modificación es anterior a hoy, se borra
                    if (fechaModificacion < hoy) {
                        fs.unlinkSync(filePath);
                        console.log(`[Logs] Archivo de log antiguo eliminado: ${file}`);
                    }
                } catch (err) {
                    console.error(`Error al procesar el archivo de log ${file}:`, err);
                }
            }
        });
    } catch (error) {
        console.error('Error al limpiar logs antiguos:', error);
    }
}