# 🎥 Detector de Movimiento + Streaming en Vivo · Raspberry Pi

Sistema de vigilancia autónomo basado en **Raspberry Pi 3B** con dos modos de supervisión:
- **Detección de movimiento**: el sensor PIR dispara la cámara, captura una fotografía y la envía al bot de **Telegram** con fecha y hora.
- **Streaming en vivo**: servidor HTTP que retransmite vídeo H264 en tiempo real, accesible desde cualquier lugar del mundo mediante **ngrok** (sin abrir puertos del router).

---

## 📋 Índice

- [Descripción general](#-descripción-general)
- [Hardware necesario](#-hardware-necesario)
- [Arquitectura del proyecto](#-arquitectura-del-proyecto)
- [Flujo de funcionamiento](#-flujo-de-funcionamiento)
- [Instalación y configuración](#-instalación-y-configuración)
- [Variables de entorno](#-variables-de-entorno)
- [Cómo iniciar el sistema](#-cómo-iniciar-el-sistema)
  - [Detector de movimiento](#-detector-de-movimiento-pircontrollerjs)
  - [Servidor de streaming](#-servidor-de-streaming-serverjs)
  - [Ejecución automática al arrancar](#-ejecución-automática-al-arrancar-la-raspberry-pi)
- [Logs de actividad](#-logs-de-actividad)
- [Estructura de archivos](#-estructura-de-archivos)
- [Dependencias](#-dependencias)

---

## 📖 Descripción general

Este proyecto convierte una Raspberry Pi 3B en un sistema de seguridad autónomo con dos funcionalidades independientes que pueden ejecutarse simultáneamente:

### 🔴 Detección de movimiento (pirController.js)
1. El sensor PIR detecta movimiento y activa la cámara.
2. Captura una fotografía en alta resolución (1920×1080).
3. Envía la imagen al bot de Telegram con la fecha y hora exacta.
4. Registra el evento en un archivo de log local.

### 📡 Streaming en vivo (server.js)
1. Arranca un servidor Express en el puerto 3000.
2. Usa `libcamera-vid` para emitir vídeo H264 a 1280×720 @ 50 fps.
3. Lanza **ngrok** y expone la URL pública por consola, accesible desde cualquier red sin configurar el router.

---

## 🔧 Hardware necesario

| Componente | Descripción |
|---|---|
| **Raspberry Pi 3B** | Placa principal donde se ejecuta el sistema |
| **Sensor PIR** | Detector de movimiento por infrarrojos pasivos (ej. HC-SR501) |
| **Cámara Raspberry Pi** | Módulo de cámara oficial (Camera Module v2 o compatible) |
| **Cables dupont** | Para conectar el sensor PIR a los pines GPIO |
| **Fuente de alimentación** | 5V / 2.5A mínimo para la Raspberry Pi |

### Conexión del sensor PIR a los GPIO

```
Sensor PIR   →   Raspberry Pi 3B
-----------       ----------------
VCC (5V)    →   Pin 2  (5V)
GND         →   Pin 6  (GND)
OUT (señal) →   GPIO configurado en PIRPIN (.env)
```

> **Nota:** El pin GPIO de señal se define en la variable de entorno `PIRPIN`. Por defecto suele usarse el GPIO 17 (Pin físico 11).

---

## 🏗️ Arquitectura del proyecto

El proyecto se compone de **dos sistemas independientes** que comparten la cámara de la Raspberry Pi:

```
detector_movimiento/
│
├── 📸 SISTEMA DE DETECCIÓN DE MOVIMIENTO
│   ├── pirController.js    ← Punto de entrada. Escucha el sensor PIR y coordina el resto
│   ├── camController.js    ← Captura fotografías con libcamera-still (1920×1080)
│   ├── botController.js    ← Envía imagen + alerta a Telegram via API
│   └── logController.js    ← Crea y escribe el log de eventos con timestamp
│
├── 📡 SERVIDOR DE STREAMING EN VIVO
│   └── server.js           ← Servidor Express + libcamera-vid + ngrok (1280×720 @ 50fps)
│
├── package.json            ← Configuración del proyecto y dependencias
├── .env                    ← Variables de entorno (no incluido en el repositorio)
├── images/                 ← Fotografías capturadas por el detector
└── logs/                   ← Logs de actividad del detector
```

---

## 🔄 Flujo de funcionamiento

### Detector de movimiento

```
Sensor PIR detecta movimiento
          │
          ▼
  pirController.js recibe el evento (valor = 1)
          │
          ├──► camController.js
          │       └── Ejecuta `libcamera-still` → guarda imagen en ./images/
          │
          ├──► botController.js
          │       └── Envía imagen + mensaje con fecha/hora a Telegram via API
          │
          └──► logController.js
                  └── Añade entrada con timestamp al archivo de log activo
```

### Servidor de streaming

```
server.js arranca
          │
          ├── Obtiene IP pública (curl ifconfig.me)
          │
          ├── Levanta Express en puerto 3000
          │       └── GET / → libcamera-vid (H264) → stream HTTP
          │
          └── Lanza ngrok → obtiene URL pública → imprime en consola
                  └── Acceso remoto sin configurar router
```

---

## ⚙️ Instalación y configuración

### 1. Prerrequisitos en la Raspberry Pi

Asegúrate de tener instalado en la Raspberry Pi:

- **Node.js v18+**
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  sudo apt-get install -y nodejs
  ```

- **libcamera** (para la captura de imágenes, normalmente preinstalado en Raspberry Pi OS)
  ```bash
  sudo apt install -y libcamera-apps
  ```

- **Habilitar la cámara** (si no está ya habilitada):
  ```bash
  sudo raspi-config
  # Interfacing Options → Camera → Enable
  ```

- **ngrok** (para el streaming remoto sin abrir puertos)
  ```bash
  # Descarga e instala ngrok desde https://ngrok.com/download
  # O usando snap:
  sudo snap install ngrok
  # Autentica tu cuenta (necesitas registro gratuito en ngrok.com)
  ngrok config add-authtoken <TU_AUTHTOKEN>
  ```

### 2. Clonar el repositorio

```bash
git clone <url-del-repositorio>
cd detector_movimiento
```

### 3. Instalar dependencias

```bash
npm install
```

### 4. Crear directorios necesarios

```bash
mkdir -p images logs
```

### 5. Crear el bot de Telegram

1. Abre Telegram y busca **@BotFather**.
2. Ejecuta `/newbot` y sigue las instrucciones para crear un nuevo bot.
3. Copia el **token** que te proporciona BotFather.
4. Inicia una conversación con tu bot y obtén tu **Chat ID** usando:
   ```
   https://api.telegram.org/bot<TU_TOKEN>/getUpdates
   ```
   El `chat.id` del primer mensaje es tu Chat ID.

---

## 🔐 Variables de entorno

Crea un archivo `.env` en la raíz del proyecto con el siguiente contenido:

```env
# Pin GPIO donde está conectada la señal OUT del sensor PIR
PIRPIN=XXX

# Token del bot de Telegram (proporcionado por BotFather)
TELEGRAM_BOT_TOKEN=XXXXXX

# ID del chat de Telegram al que se enviarán las alertas
TELEGRAM_CHAT_ID=XXXXX
```

> ⚠️ **Importante:** El archivo `.env` contiene credenciales sensibles. Nunca lo subas al repositorio. Está incluido en `.gitignore`.

---

## 🚀 Cómo iniciar el sistema

Los dos sistemas se arrancan de forma independiente, cada uno en su propia terminal.

---

### 🔴 Detector de movimiento (pirController.js)

```bash
npm start
```

Esto ejecuta internamente:
```bash
sudo node pirController.js
```

> Se requiere `sudo` para acceder a los pines GPIO de la Raspberry Pi.

Para **parar**, pulsa `Ctrl + C`. El programa liberará automáticamente los recursos GPIO antes de cerrarse.

---

### 📡 Servidor de streaming (server.js)

En una **segunda terminal**, ejecuta:

```bash
node server.js
```

Cuando arranque correctamente verás en consola algo como:

```
streaming en vivo disponible en https://xxxx-xxxx.ngrok-free.app
```

Abre esa URL en cualquier navegador o reproductor compatible con H264 (como **VLC**) para ver el streaming en directo.

> ⚠️ La URL de ngrok cambia cada vez que reinicias el servidor (en el plan gratuito). Para una URL fija considera el plan de pago de ngrok.

Para **parar**, pulsa `Ctrl + C` en esa terminal.

---

### 🔁 Ejecución automática al arrancar la Raspberry Pi

Para que el sistema arranque solo cada vez que se enciende la Raspberry Pi, configura un servicio con **systemd**:

#### 1. Crea el archivo de servicio

```bash
sudo nano /etc/systemd/system/detector_movimiento.service
```

#### 2. Pega el siguiente contenido (ajusta las rutas si es necesario)

```ini
[Unit]
Description=Detector de Movimiento con Telegram
After=network.target

[Service]
ExecStart=/usr/bin/node /home/pi/detector_movimiento/pirController.js
WorkingDirectory=/home/pi/detector_movimiento
Restart=always
RestartSec=5
User=root
EnvironmentFile=/home/pi/detector_movimiento/.env

[Install]
WantedBy=multi-user.target
```

#### 3. Activa e inicia el servicio

```bash
sudo systemctl daemon-reload
sudo systemctl enable detector_movimiento
sudo systemctl start detector_movimiento
```

#### 4. Comprueba el estado del servicio

```bash
sudo systemctl status detector_movimiento
```

#### 5. Ver los logs del servicio en tiempo real

```bash
sudo journalctl -u detector_movimiento -f
```

---

## 📄 Logs de actividad

Cada vez que se inicia el programa, se crea automáticamente un nuevo archivo de log en el directorio `./logs/` con un nombre basado en el timestamp de inicio:

```
logs/log1718360000000.txt
```

Cada evento de movimiento queda registrado con su fecha y hora:

```
[14/6/2026 13:45:02] movimiento detectado
[14/6/2026 13:52:17] movimiento detectado
[14/6/2026 14:03:44] movimiento detectado
```

Las imágenes capturadas se guardan en `./images/` con un nombre basado en el timestamp del momento de captura:

```
images/img1718360102345.jpg
```

---

## 📁 Estructura de archivos

| Archivo | Descripción |
|---|---|
| [`pirController.js`](./pirController.js) | Módulo principal del detector. Inicializa el sensor PIR en el pin GPIO definido, escucha el flanco de subida (`rising`) y coordina la captura, envío y registro de cada detección. |
| [`camController.js`](./camController.js) | Controla la cámara mediante `libcamera-still`. Captura imágenes a resolución Full HD (1920×1080) y las guarda en `./images/`. |
| [`botController.js`](./botController.js) | Envía la fotografía capturada junto a un mensaje de alerta al chat de Telegram configurado, usando la API oficial (`sendPhoto`). |
| [`logController.js`](./logController.js) | Gestiona la creación del archivo de log al arrancar y la escritura de cada evento de movimiento con su timestamp. |
| [`server.js`](./server.js) | Servidor de streaming en vivo. Levanta Express en el puerto 3000, emite vídeo H264 a 1280×720 @ 50fps con `libcamera-vid` y expone la URL pública mediante ngrok. |

---

## 📦 Dependencias

| Paquete | Versión | Uso |
|---|---|---|
| [`dotenv`](https://www.npmjs.com/package/dotenv) | ^16.4.5 | Carga las variables de entorno desde el archivo `.env` |
| [`onoff`](https://www.npmjs.com/package/onoff) | ^6.0.3 | Interfaz con los pines GPIO de la Raspberry Pi para leer el sensor PIR |
| [`node-fetch`](https://www.npmjs.com/package/node-fetch) | ^3.3.2 | Realiza las peticiones HTTP a la API de Telegram |
| [`form-data`](https://www.npmjs.com/package/form-data) | ^4.0.0 | Construye el formulario multipart para enviar la imagen a Telegram |
| [`express`](https://www.npmjs.com/package/express) | ^4.x | Servidor HTTP para el streaming de vídeo en vivo |
| [`fs`](https://www.npmjs.com/package/fs) | built-in | Gestión de archivos (logs e imágenes) |
| `child_process` | built-in | Ejecución de procesos del sistema (`libcamera-vid`, `libcamera-still`, `ngrok`, `curl`) |

> **Herramienta externa:** [`ngrok`](https://ngrok.com/) debe instalarse por separado en el sistema (no es un paquete npm). Ver sección de instalación.

---

## 👤 Autor

**Iker Landaberea**  
Licencia ISC
