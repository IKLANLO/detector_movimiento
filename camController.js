import { exec } from 'child_process'

const width = 1280
const height = 720

export const takeImage = (imageData) => {
    return new Promise((resolve, reject) => {
        const imagePath = "/home/iklanlo/proyectos/detector_movimiento/images/vid" + imageData + ".h264";
        // --inline-headers y --flush para que el archivo se escriba rápido
        // --tuning-file para asegurar que no pierda tiempo calibrando cada vez
        // --framerate 25: 125 frames = 5 segundos exactos de vídeo
        // -t 0: desactiva el timeout por tiempo (por defecto es 60s en libcamera),
        //        así el proceso para exactamente al llegar a --frames y no antes ni después
        const takeVideoCommand = "libcamera-vid --frames 125 --framerate 25 -t 0 -o " + imagePath + " --width " + width + " --height " + height + " --nopreview --inline --flush --tuning-file /usr/share/libcamera/ipa/rpi/vc4/imx708_noir.json";
        exec(takeVideoCommand, (error, stdout, stderr) => {
            if (error) {
                console.log('Error al grabar el vídeo', error);
                return reject(error);
            }
            resolve(imagePath);
        });
    });
}

export const convertImage = (imageData) => {
    return new Promise((resolve, reject) => {
        const input = "/home/iklanlo/proyectos/detector_movimiento/images/vid" + imageData + ".h264";
        const output = "/home/iklanlo/proyectos/detector_movimiento/images/vid" + imageData + ".mp4";
        // Usamos ffmpeg para encapsular en mp4 de forma más directa y rápida que MP4Box en algunos casos
        const convertCommand = "ffmpeg -i " + input + " -c copy -y " + output;
        exec(convertCommand, (error, stdout, stderr) => {
            if (error) {
                console.log('Error al convertir el vídeo', error);
                return reject(error);
            }
            resolve(output);
        });
    });
}

export const deleteImages = () => {
    return new Promise((resolve, reject) => {
        const deleteCommand = 'rm /home/iklanlo/proyectos/detector_movimiento/images/vid*.h264 /home/iklanlo/proyectos/detector_movimiento/images/vid*.mp4'
        exec(deleteCommand, (error, stdout, stderr) => {
            if (error) {
                console.log('Error al limpiar archivos', error);
                return reject(error)
            }
            resolve()
        })
    });
}
