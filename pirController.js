import 'dotenv/config'
import { Gpio } from 'onoff';
import { exec } from 'child_process'
import { takeImage, convertImage, deleteImages } from './camController.js';
import { sendMessage, startLiveVideo } from './botController.js'
import { createLog, writeLog } from './logController.js';

const PIRPIN = process.env.PIRPIN
const pir = new Gpio(PIRPIN, 'in', 'rising')
const movementLogPath = `./logs/log${new Date().valueOf()}.txt`
let finishedImg = true

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
    if (err) {
        console.error('error detectando movimiento', err)
        return 
    }
    
    if (value === 1 && finishedImg){
        const movementDate = getFormattedDate();
        
        try {
            console.log('value 1')
            finishedImg = false
            const newDate = new Date().valueOf()
            const image = await takeImage(newDate)
            const convertedImage = await convertImage(newDate)
            console.log('Imagen guardada en:', convertedImage)
            sendMessage(`[${movementDate}] movimiento detectado`, convertedImage)
            writeLog(movementLogPath, movementDate)
            finishedImg = true
        } catch (error) {
            console.error('Error en el proceso de toma de imagen:', error)
            finishedImg = true
        }
    }
})

//función que permite parar el pir antes de iniciar el live stream
export const stopPir = async () => {
    await pir.unwatch()
    await pir.unexport()

    const killCommand = `sudo fuser /dev/video0`
    //const killCommand = `sudo kill 13065`

    exec(killCommand, (error, stdout, stderr) => {
        if (error) {
            console.log('Error al matar procesos libcamera', error);
        }
        
        if (stdout) {
            console.log('stdout kill:', stdout);
        }

        if (stderr) {
            console.error('stderr kill:', stderr);
        }
    })

    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('pir.watch parado')
}

//activamos sistema de detección de solicitudes de activación de video en tiempo real
//el parámetro 0 indica que no se incluyan en la revisión solicitudes anteriores
startLiveVideo(0)

process.on('SIGINT', async ()=> {
    try {
        //await deleteImages()
        //liberamos los recursos utilizados al terminar el programa
        pir.unexport()
        process.exit()
    } catch (error) {
        console.error('Error en la limpieza de recursos', error)
    }
})


