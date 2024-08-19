import 'dotenv/config'
import { Gpio } from 'onoff';
import { sendMessage } from './botController.js'
import { writeLog } from './logController.js';

const PIRPIN = process.env.PIRPIN
const pir = new Gpio(PIRPIN, 'in', 'rising')
const movementLogPath = './logs/movementLog.txt'

// Función para obtener la fecha y hora actuales
function getFormattedDate() {
    const now = new Date()
    const date = now.toLocaleDateString()
    const time = now.toLocaleTimeString()
    return `${date} ${time}`
}

//cada vez que el PIR detecte movimiento se envía una notificación por Telegram y se guarda en el log
pir.watch((err, value) => {
    if (err) {
        console.error('error detectando movimiento', err)
        return 
    }
        
    if (value === 1){
        const movementDate = getFormattedDate();
        sendMessage(`[${movementDate}] movimiento detectado`);
        writeLog(movementLogPath, movementDate); 
    }
})

process.on('SIGINT', ()=> {
    //liberamos los recursos utilizados al terminar el programa
    pir.unexport()
    process.exit()
})


