import { exec } from 'child_process'

const width = 1920
const height = 1080

export const takeImage = (imageData) => {
    //retornamos la imagen si la promesa se resuelve
    return new Promise((resolve, reject) => {
        const imagePath = `./images/img${imageData}.jpg`

        //comando para sacar la fotografía
        const takeImageCommand = `libcamera-still -o ${imagePath} --width ${width} --height ${height} --nopreview`

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
