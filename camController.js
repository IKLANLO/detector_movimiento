import { exec } from 'child_process'
//import { error } from 'console'
//import { stderr, stdout } from 'process'

const width = 1920
const height = 1080

export const takeImage = (imageData) => {
    const imagePath = `./images/img${imageData}.jpg`

    //comando para sacar la fotografía
    const takeImageCommand = `libcamera-still -o ${imagePath} --width ${width} --height ${height} --nopreview`

    //ejecutamos el comando
    exec(takeImageCommand, (error, stdout, stderr) => {
        if (error) {
            console.log('Error al sacar la fotografía', error);
            return
        }

        if (stderr) {
            console.log(`stderr: ${stderr}`);
            return
        }

        console.log(`Fotografía guardada en ${imagePath}`);
    })
}