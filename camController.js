import { exec } from 'child_process'

const width = 1920
const height = 1080
//const width = 960
//const height = 542

export const takeImage = (imageData) => {
    //retornamos la imagen si la promesa se resuelve
    return new Promise((resolve, reject) => {
        //const imagePath = `./images/img${imageData}.jpg`
        const imagePath = `./images/img${imageData}.h264`
        //comando para sacar la fotografía
        //const takeImageCommand = `libcamera-still -o ${imagePath} --width ${width} --height ${height} --nopreview --immediate`
        const takeImageCommand = `libcamera-vid -o ${imagePath} --width ${width} --height ${height} --timeout 15000 --nopreview`
        //ejecutamos el comando
        exec(takeImageCommand, (error, stdout, stderr) => {
            if (error) {
                console.log('Error al sacar la fotografía', error);
                return reject(error)
            }
            
            resolve(imagePath)
        })
    })
}

export const convertImage = (imageData) => {
    //convertimos las imágenes guardadas a MP4 para hacerlas compatibles con Telegram
    return new Promise((resolve, reject) => {
        const convertImageCommand = `MP4Box -add './images/img'${imageData}'.h264' './images/img'${imageData}'.mp4'`
        exec(convertImageCommand, (error, stdout, stderr) => {
            if (error) {
                console.log('Error al convertir la fotografía', error);
                return reject(error)
            }
            
            resolve(`./images/img${imageData}.mp4`)
        })
    })
}

export const deleteImages = () => {
    //eliminamos los archivos sin convertir a MP4 antes de finalizar
    return new Promise((resolve, reject) => {
        const deleteImagesCommand = 'rm ./images/*.h264'
        exec(deleteImagesCommand, (error, stdout, stderr) => {
            if (error) {
                console.log('Error al eliminar las fotografías', error);
                return reject(error)
            }
            
            resolve()
        })
    })
    
}
