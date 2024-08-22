import 'dotenv/config'
import { Gpio } from 'onoff';
import { takeImage } from './camController.js';
import { sendMessage } from './botController.js'
import { createLog, writeLog } from './logController.js';

const PIRPIN = process.env.PIRPIN
const pir = new Gpio(PIRPIN, 'in', 'rising')
const movementLogPath = `./logs/log${new Date().valueOf()}.txt`
let delayTime = 10000
let lastActivationTime = 0

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
pir.watch(async (err, value) => {
    const currentTime = Date.now()
    
    if (err) {
        console.error('error detectando movimiento', err)
        return 
    }
    
    //las acciones se ejecutan cada 10 segundos
    if (value === 1 && (currentTime - lastActivationTime) > delayTime){
        const movementDate = getFormattedDate();
        const image = await takeImage(new Date().valueOf())
        setTimeout(()=>{
            sendMessage(`[${movementDate}] movimiento detectado`, image);
            writeLog(movementLogPath, movementDate);
        }, 10000)
        lastActivationTime = currentTime
    }
})

process.on('SIGINT', ()=> {
    //liberamos los recursos utilizados al terminar el programa
    pir.unexport()
    process.exit()
})


