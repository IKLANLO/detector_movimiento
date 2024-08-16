import 'dotenv/config'
import { Gpio } from 'onoff';
import { sendMessage } from './botController.js'

const PIRPIN = process.env.PIRPIN
const pir = new Gpio(PIRPIN, 'in', 'rising')

// Función para obtener la fecha y hora actuales
function getFormattedDate() {
    const now = new Date()
    const date = now.toLocaleDateString()
    const time = now.toLocaleTimeString()
    return `${date} ${time}`
}

//cada vez que el PIR detecte movimiento se envía una notificación por Telegram
pir.watch((err, value) => {
    if (err) {
        console.error('error detectando movimiento', err)
        return 
    }
        
    if (value === 1){
        sendMessage(`[${getFormattedDate()}] movimiento detectado`)
    }
})

process.on('SIGINT', ()=> {
    //liberamos los recursos utilizados al terminar el programa
    pir.unexport()
    process.exit()
})


