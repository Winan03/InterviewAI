# VozInterview - AI Interview Assistant 🎤🤖

Sistema de asistencia en tiempo real para entrevistas técnicas en inglés con IA. Captura audio, transcribe localmente y genera respuestas sugeridas basadas en tu perfil profesional.

## 🌟 Características

- **Captura de Audio en Tiempo Real**: Soporta navegador (Meet, Zoom web) y captura de sistema
- **Transcripción Local**: Usa SpeechRecognition de Python para transcribir sin enviar audio a la nube
- **IA Gratuita**: Integración con AI/ML API usando Gemma 3 12B (modelo gratuito)
- **Overlay Cyberpunk**: Interfaz minimalista estilo neon que se mantiene encima de otras ventanas
- **WebSocket**: Latencia mínima para respuestas en tiempo real
- **Dual Mode**: Funciona con n8n o directamente con AI/ML API

## 🏗️ Arquitectura

```
┌─────────────────┐      WebSocket      ┌──────────────────┐
│   Frontend      │ ←─────────────────→ │   Backend        │
│  (React +       │                     │   (FastAPI)      │
│   Electron)     │                     │                  │
└─────────────────┘                     └──────────────────┘
        ↓                                        ↓
   Audio Capture                        ┌──────────────────┐
   (Microphone)                         │ SpeechRecognition│
                                        └──────────────────┘
                                                 ↓
                                        ┌──────────────────┐
                                        │   AI/ML API      │
                                        │  (Gemma 3 12B)   │
                                        └──────────────────┘
```

## 📋 Requisitos Previos

- **Python 3.9+**
- **Node.js 18+**
- **npm o yarn**
- **Micrófono** (para captura de audio)

## 🚀 Instalación

### 1. Backend (FastAPI)

```bash
cd backend

# Crear entorno virtual
python -m venv venv

# Activar entorno virtual
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
copy .env.example .env
# Editar .env con tu API key
```

### 2. Frontend (React + Electron)

```bash
cd frontend

# Instalar dependencias
npm install
```

### 3. n8n Workflow (Opcional)

Si prefieres usar n8n en lugar de la integración directa:

1. Importa el workflow: `n8n/interview_assistant_workflow.json`
2. Configura tu API key de AI/ML API en el nodo AI Agent
3. Activa el webhook y copia la URL
4. Actualiza `N8N_WEBHOOK_URL` en el `.env` del backend

## ⚙️ Configuración

### Backend (.env)

```env
# AI/ML API Configuration
AIML_API_KEY=078a31555bf64282bd38a1eee652aacf
AIML_MODEL=gemma-3-12b
AIML_BASE_URL=https://api.aimlapi.com/v1

# Backend Configuration
BACKEND_HOST=localhost
BACKEND_PORT=8000

# Optional: n8n Webhook (si usas n8n)
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/interview-assistant
```

### Perfil del Ingeniero

Edita `backend/config.py` para personalizar tu perfil:

```python
ENGINEER_PROFILE: str = """
Ingeniero experto en:
- TU ESPECIALIDAD AQUÍ
- TUS TECNOLOGÍAS
- TU EXPERIENCIA
"""
```

## 🎯 Uso

### Modo 1: Desarrollo (Recomendado para pruebas)

**Terminal 1 - Backend:**
```bash
cd backend
venv\Scripts\activate  # Windows
python main.py
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run electron:dev
```

### Modo 2: Producción

**Backend:**
```bash
cd backend
venv\Scripts\activate
uvicorn main:app --host 0.0.0.0 --port 8000
```

**Frontend:**
```bash
cd frontend
npm run build
npm run electron:build
```

## 🎮 Cómo Funciona

1. **Inicia el backend y frontend**
2. **Presiona el botón de grabación** (círculo cyan)
3. **Habla tu pregunta** o deja que el entrevistador hable
4. **Presiona stop** (cuadrado magenta)
5. **Espera la transcripción y respuesta de IA**
6. **Lee la respuesta sugerida** en el overlay

### Características del Overlay

- **Draggable**: Arrastra desde cualquier parte (excepto áreas de texto)
- **Always-on-top**: Se mantiene encima de otras ventanas
- **Transparente**: Fondo semitransparente con glassmorphism
- **Animaciones**: Efectos neon y transiciones suaves

## 🔧 Estructura del Proyecto

```
VozInterview/
├── backend/
│   ├── main.py              # FastAPI app principal
│   ├── config.py            # Configuración
│   ├── ai_client.py         # Cliente AI/ML API
│   ├── transcription.py     # Servicio de transcripción
│   └── requirements.txt     # Dependencias Python
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Componente principal
│   │   ├── components/
│   │   │   ├── Overlay.jsx  # Overlay cyberpunk
│   │   │   └── AudioCapture.jsx  # Captura de audio
│   │   └── hooks/
│   │       └── useWebSocket.js   # WebSocket hook
│   ├── electron/
│   │   └── main.cjs         # Electron main process
│   └── package.json
├── n8n/
│   └── interview_assistant_workflow.json  # Workflow n8n
└── README.md
```

## 🎨 Personalización del UI

### Colores Cyberpunk

Edita `frontend/tailwind.config.js`:

```javascript
colors: {
  'cyber-cyan': '#00f0ff',      // Cyan neón
  'cyber-magenta': '#ff00ff',   // Magenta neón
  'cyber-purple': '#9d00ff',    // Púrpura neón
  'cyber-blue': '#0066ff',      // Azul eléctrico
}
```

## 🐛 Troubleshooting

### Error: "Could not access microphone"

- Verifica permisos del navegador/sistema
- En Windows: Settings → Privacy → Microphone

### Error: "WebSocket connection failed"

- Verifica que el backend esté corriendo en `localhost:8000`
- Revisa el firewall

### Error: "AI/ML API error"

- Verifica tu API key en `.env`
- Revisa límites de rate en AI/ML API

### PyAudio installation error (Windows)

```bash
pip install pipwin
pipwin install pyaudio
```

## 📊 Formato de Respuesta de IA

```json
{
  "original_text": "What is your experience with NLP?",
  "translation": "¿Cuál es tu experiencia con NLP?",
  "suggested_answer": "Tengo experiencia trabajando con modelos como Wav2Vec para reconocimiento de voz y RoBERTa-Biomedical para análisis de texto médico...",
  "key_technical_terms": ["Wav2Vec", "RoBERTa", "NLP", "FastAPI"]
}
```

## 🔐 Seguridad

- **API Keys**: Nunca commitees el archivo `.env`
- **CORS**: Configurado solo para localhost en desarrollo
- **Audio**: Procesado localmente, solo texto se envía a IA

## 📝 Licencia

MIT License - Úsalo libremente para tus entrevistas técnicas

## 🤝 Contribuciones

¡Pull requests son bienvenidos! Para cambios mayores, abre un issue primero.

## 📧 Soporte

Si encuentras problemas, abre un issue en GitHub.

---

**Hecho con ❤️ para ayudarte a conseguir ese trabajo soñado** 🚀
