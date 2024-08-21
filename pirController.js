import 'dotenv/config'
import { Gpio } from 'onoff';
import { takeImage } from './camController.js';
import { sendMessage } from './botController.js'
import { createLog, writeLog } from './logController.js';

const PIRPIN = process.env.PIRPIN
const pir = new Gpio(PIRPIN, 'in', 'rising')
const movementLogPath = `./logs/log${new Date().valueOf()}.txt`

// Función para obtener la fecha y hora actuales
function getFormattedDate() {
    const now = new Date()
    const date = now.toLocaleDateString()
    const time = now.toLocaleTimeString()
    return `${date} ${time}`
}
//creamos el archivo del log de respaldo de movimientos
createLog(movementLogPath)

//cada vez que el PIR detecte movimiento se saca una fotografía, se envía por Telegram
//junto a una notificación, y se guarda en el log
pir.watch((err, value) => {
    if (err) {
        console.error('error detectando movimiento', err)
        return 
    }
        
    if (value === 1){
        const movementDate = getFormattedDate();
        takeImage(new Date().valueOf())
        sendMessage(`[${movementDate}] movimiento detectado`);
        writeLog(movementLogPath, movementDate); 
    }
})

process.on('SIGINT', ()=> {
    //liberamos los recursos utilizados al terminar el programa
    pir.unexport()
    process.exit()
})


