require('dotenv').config()
const gpio = require("onoff").Gpio

const pirPin = process.env.pirPin

const pir = new gpio(pirPin, 'in', 'rising')

// Función para obtener la fecha y hora actuales
function getFormattedDate() {
    const now = new Date()
    const date = now.toLocaleDateString()
    const time = now.toLocaleTimeString()
    return `${date} ${time}`
}

//cada vez que el PIR detecte movimiento se imprime un mensaje en terminal
pir.watch((err, value) => {
    if (err) {
        console.error('error detectando movimiento', err)
        return 
    }
        
    if (value === 1){
        console.log(`[${getFormattedDate()}] movimiento detectado`)
    }
})


process.on('SIGINT', ()=> {
    //liberamos los recursos utilizados al terminar el programa
    pir.unexport()
    process.exit()
})


