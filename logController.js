import fs from 'fs'

// Función para guardar en el log los movimientos detectados
export function writeLog(movementLogPath, movementDate) {
    fs.appendFile(movementLogPath, `[${movementDate}] movimiento detectado\n`, (err) => {
        if(err) {
            console.error('Error escribiendo en el log', err)
        }
    })
}