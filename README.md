# 🎥 Detector de Movimiento + Streaming en Vivo · Raspberry Pi

Sistema de vigilancia autónomo basado en **Raspberry Pi** con inicio unificado y dos modos integrados coordinados mediante **Telegram**:
- **Detección de movimiento**: el sensor PIR dispara la cámara, graba un clip de vídeo, lo convierte a MP4 y lo envía al bot de **Telegram** con la fecha y hora.
- **Streaming en vivo**: servidor HTTP que retransmite vídeo en tiempo real, accesible desde cualquier lugar del mundo mediante **ngrok** (sin abrir puertos del router) con control del stream.

---

## 📋 Índice

- [Descripción general](#-descripción-general)
- [Hardware necesario](#-hardware-necesario)
- [Arquitectura del proyecto](#-arquitectura-del-proyecto)
- [Comandos de Telegram](#-comandos-de-telegram)
- [Instalación y configuración](#-instalación-y-configuración)
- [Variables de entorno](#-variables-de-entorno)
- [Cómo iniciar el sistema](#-cómo-iniciar-el-sistema)
- [Ejecución automática al arrancar (Demonio)](#-ejecución-automática-al-arrancar-demonio)
- [Logs de actividad](#-logs-de-actividad)
- [Estructura de archivos](#-estructura-de-archivos)
- [Dependencias](#-dependencias)

---

## 📖 Descripción general

Este proyecto unifica la detección PIR y el streaming en vivo en un único punto de entrada:

### 🔴 Detección de movimiento
1. Por defecto, al arrancar, el sensor PIR está inactivo para evitar falsos positivos y liberar recursos de cámara.
2. Al activarlo mediante Telegram (`/activar`), el sensor vigila el entorno.
3. Si detecta movimiento, graba un clip de vídeo H264 de 5 segundos, lo encapsula en MP4, lo envía a Telegram y rearma el sensor tras un cooldown de seguridad de 5 segundos.

### 📡 Streaming en vivo
1. El servidor Express corre en segundo plano en el puerto 3000 de forma local.
2. Utiliza **ngrok** para tunelizar la conexión de forma segura hacia el exterior.
3. Al solicitar el vídeo en vivo desde Telegram (`/vervideo`), se responde con la URL pública para reproducir en cualquier software compatible (como VLC).

---

## 🔧 Hardware necesario

| Componente | Descripción |
|---|---|
| **Raspberry Pi** | Placa principal (ej. Raspberry Pi 3B o superior) |
| **Sensor PIR** | Detector de movimiento infrarrojo pasivo (ej. HC-SR501) |
| **Cámara Raspberry Pi** | Módulo de cámara compatible con comandos `libcamera` |
| **Cables Dupont** | Conectores hembra-hembra para el cableado GPIO |

### Conexión del sensor PIR a los GPIO

```
Sensor PIR   →   Raspberry Pi
-----------       ----------------
VCC (5V)    →   Pin 2  (5V)
GND         →   Pin 6  (GND)
OUT (señal) →   GPIO configurado en PIRPIN (.env)
```

---

## 🏗️ Arquitectura del proyecto

```
detector_movimiento/
│
├── index.js                ← Punto de entrada unificado. Lanza server.js y pirController.js
├── pirController.js        ← Controla el sensor PIR. Escucha callbacks del bot
├── botController.js        ← Listener de comandos del Bot de Telegram (Polling largo)
├── camController.js        ← Graba vídeo y limpia archivos temporales (libcamera + ffmpeg)
├── logController.js        ← Gestiona los registros locales de actividad
├── package.json            ← Configuración del proyecto, scripts y dependencias
├── .env                    ← Variables de entorno (Token, Chat ID, PIN)
├── server/
│   └── server.js           ← Servidor Express local + Tunelización ngrok
├── images/                 ← Vídeos grabados temporales
└── logs/                   ← Historial de detecciones
```

---

## 💬 Comandos de Telegram

El sistema se controla de forma remota enviando comandos al Bot de Telegram desde el chat autorizado:

* `/activar` — Enciende la vigilancia PIR. El sensor comenzará a enviar alertas y vídeos ante cualquier presencia.
* `/desactivar` — Apaga la vigilancia PIR. Ideal cuando estés en casa para evitar alertas innecesarias.
* `/estado` — Devuelve si la detección está actualmente `Activa` o `Inactiva`.
* `/vervideo` — Devuelve el enlace público de **ngrok** para abrir el streaming en tiempo real en reproductores como VLC.
* `/ayuda` — Muestra el listado de comandos disponibles.

---

## ⚙️ Instalación y configuración

### 1. Prerrequisitos en la Raspberry Pi

- **Node.js v18+** y **npm** instalados.
- **libcamera** y **ffmpeg** instalados en el sistema operativo:
  ```bash
  sudo apt update
  sudo apt install -y libcamera-apps ffmpeg
  ```
- **ngrok** instalado y autenticado con tu token personal (requiere registro gratuito en ngrok.com):
  ```bash
  ngrok config add-authtoken <TU_AUTHTOKEN>
  ```

### 2. Preparar el proyecto

1. Clona el repositorio e instala las dependencias:
   ```bash
   npm install
   ```
2. Crea las carpetas locales para almacenamiento:
   ```bash
   mkdir -p images logs
   ```

---

## 🔐 Variables de entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
# Pin GPIO físico donde está conectada la señal OUT del PIR (ej: GPIO 17)
PIRPIN=17

# Token privado de Telegram (@BotFather)
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ

# Tu ID de chat de Telegram (para autorizar sólo tus comandos)
TELEGRAM_CHAT_ID_PRUEBA=987654321
```

---

## 🚀 Cómo iniciar el sistema

Para iniciar manualmente todo el ecosistema (Servidor web + Bot de Telegram + PIR) ejecuta:

```bash
npm start
```

Este comando lanzará `index.js`, arrancando de forma coordinada el servidor local y el gestor del PIR con permisos de superusuario (`sudo`).

*Al iniciar, recibirás una notificación en Telegram indicando que el sistema está en línea y esperando instrucciones.*

---

## 🔁 Ejecución automática al arrancar (Demonio)

Para que el detector y el servidor arranquen solos al encender la Raspberry Pi sin necesidad de tener una terminal abierta, configuraremos un servicio con **systemd**.

### 1. Crear el archivo del servicio

Ejecuta el siguiente comando para abrir el editor:

```bash
sudo nano /etc/systemd/system/detector-movimiento.service
```

### 2. Añadir la configuración del servicio

Copia y pega las siguientes líneas (asegúrate de ajustar `/ruta_del_proyecto/detector_movimiento` si tu ruta es distinta):

```ini
[Unit]
Description=Servicio Detector de Movimiento y Streaming
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/ruta_del_proyecto/detector_movimiento
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=PATH=/usr/bin:/usr/local/bin:/usr/bin:/bin
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

*Guarda y cierra con `Ctrl+O`, `Enter` y luego `Ctrl+X`.*

### 3. Registrar y activar el demonio

Ejecuta las siguientes órdenes para registrar el demonio y habilitar su ejecución automática en cada arranque de la placa:

```bash
# Recargar systemd para que reconozca el nuevo servicio
sudo systemctl daemon-reload

# Habilitar para que inicie en el arranque del sistema
sudo systemctl enable detector-movimiento.service

# Arrancar el servicio inmediatamente
sudo systemctl start detector-movimiento.service
```

### 4. Comandos de utilidad para el demonio

* **Ver estado actual del servicio**:
  ```bash
  sudo systemctl status detector-movimiento.service
  ```
* **Ver los registros/logs de consola en vivo**:
  ```bash
  sudo journalctl -u detector-movimiento.service -f
  ```
* **Reiniciar el demonio**:
  ```bash
  sudo systemctl restart detector-movimiento.service
  ```
* **Parar el demonio**:
  ```bash
  sudo systemctl stop detector-movimiento.service
  ```

---

## 📄 Logs de actividad

Las alertas grabadas de vídeo se almacenan temporalmente en `./images/` en formato `.mp4`.

Cada inicio del bot genera un nuevo fichero de registros históricos dentro de `./logs/` con formato:
`logs/log<timestamp_inicio>.txt`

Donde se añade una nueva línea en cada detección:
```
[24/6/2026 19:15:30] movimiento detectado
```

---

## 📦 Dependencias

* `onoff` — Acceso a pines GPIO del procesador de la placa.
* `node-fetch` / `form-data` — Integración HTTP con la API de Telegram.
* `express` — Servidor web para servir el flujo de vídeo.
* `dotenv` — Gestión limpia de configuraciones sensibles.
