import express from 'express';
import { spawn } from 'child_process';
import { startLiveVideoMessage } from './botController.js'
import { stopPir } from './pirController.js'

const app = express()
const port = 3000
let publicIP = '', ngrokURL = ''

//función que busca la ip pública asignada
async function getPublicIp(){
	return new Promise((resolve, reject) => {
		const publicIpProcess = spawn('curl', ['-s', 'ifconfig.me'])
		
		publicIpProcess.stdout.on('data', (data) => {
			publicIP = data.toString()
		})
		
		publicIpProcess.stderr.on('error', (error) => {
				reject('Error en la salida de datos de ip', error)
		})
		
		publicIpProcess.on('close', (code) => {
			(code === 0) ? resolve(publicIP) : reject(`el proceso terminó con código ${code}`)
		})
	})
}

//utilizamos ngrok para el acceso remoto sin necesidad de abrir puertos
async function getNgrokURL(){
	return new Promise((resolve, reject) => {
		//'--log=stdout' permite que la info salga por stdout y pueda guardarse
		const ngrokURLProcess = spawn('ngrok', ['http', `${port}`, '--log=stdout'])
		
		ngrokURLProcess.stdout.on('data', (data) => {
			const output = data.toString()
			const urlMatch = output.match(/(https:\/\/[a-z0-9-]+\.ngrok-free\.app)/i)
			if (urlMatch){
				ngrokURL = urlMatch[1]
				resolve(ngrokURL)
			}
		})
		
		ngrokURLProcess.stderr.on('data', (data) => {
			reject(`error en ngrok ${data.toString()}`)
		})
		
		ngrokURLProcess.on('close', (code) => {
			if (code !== 0) reject(`proceso ngrok cerrado con código ${code}`)
		})
	})
}

//buscamos de forma asíncrona la ip antes de abrir el pipeline y montar el servidor
export async function startStream() {
	try{
		publicIP = await getPublicIp()
		
		app.get('/', (req, res) => {
			res.setHeader('Content-Type', 'video/h264')

			const libcamera = spawn('libcamera-vid', [
				'--codec', 'h264',
				'--width', '1280',
				'--height', '720',
				'--framerate', '50',
				'--inline',
				'--tuning-file', '/usr/share/libcamera/ipa/rpi/vc4/imx708_noir.json', // para que coja especificaciones del modelo de cámara, sin ello no filtra bien los colores
				'-t', '0', //para que sea un stream infinito
				'--nopreview',
				'--output', '-'
			]);
			
			libcamera.stdout.pipe(res)
			
			libcamera.stdout.on('data', async (data) => {
				await stopPir()
			})
			
			libcamera.stderr.on('data', (data) => {
				console.error(`ffmpeg stderr: ${data}`)
			})
			
			libcamera.on('close', (code) => {
				console.log(`proceso ffmpeg cerrado con código ${code}`)
			})
		})
		
		app.listen(port, '0.0.0.0', async () => {
			try{
				ngrokURL = await getNgrokURL()
				console.log(`streaming en vivo disponible en ${ngrokURL}`)
				await startLiveVideoMessage(ngrokURL)
			} catch (error) {
				console.log('error server', error)
			}
		})
		
	} catch(error) {
		console.log('Error al obtener la ip pública', error)
	}
}
