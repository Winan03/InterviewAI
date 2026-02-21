import speech_recognition as sr
import io
import logging
import os
import subprocess
import tempfile
from typing import Optional

logger = logging.getLogger(__name__)

# Get ffmpeg path from imageio-ffmpeg (bundled binary)
FFMPEG_PATH = None
try:
    import imageio_ffmpeg
    FFMPEG_PATH = imageio_ffmpeg.get_ffmpeg_exe()
    logger.info(f"✅ ffmpeg found: {FFMPEG_PATH}")
except ImportError:
    logger.warning("⚠️ imageio-ffmpeg not installed")

# Also add ffmpeg dir to PATH so pydub can find it
if FFMPEG_PATH and os.path.exists(FFMPEG_PATH):
    ffmpeg_dir = os.path.dirname(FFMPEG_PATH)
    os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")


class AudioTranscriber:
    """Handles audio transcription using SpeechRecognition"""
    
    def __init__(self):
        self.recognizer = sr.Recognizer()
        self.recognizer.energy_threshold = 300
        self.recognizer.dynamic_energy_threshold = True
        
    async def transcribe_audio(self, audio_data: bytes, audio_format: str = "webm") -> Optional[str]:
        """
        Transcribe audio data to text
        """
        try:
            # Skip tiny chunks that are likely empty/corrupted
            if len(audio_data) < 1000:
                logger.debug("Audio chunk too small, skipping")
                return None
            
            # Convert audio to WAV format if needed
            if audio_format != "wav":
                wav_data = self._convert_to_wav_ffmpeg(audio_data, audio_format)
                if wav_data is None:
                    logger.debug("Audio conversion failed, skipping chunk")
                    return None
            else:
                wav_data = audio_data
            
            # Create AudioData object from bytes
            audio_file = io.BytesIO(wav_data)
            
            with sr.AudioFile(audio_file) as source:
                self.recognizer.adjust_for_ambient_noise(source, duration=0.3)
                audio = self.recognizer.record(source)
            
            # Check if audio has enough content (not silence)
            if len(audio.get_raw_data()) < 1000:
                logger.debug("Audio too short, skipping")
                return None
            
            # Try Google Speech Recognition (free tier)
            try:
                text = self.recognizer.recognize_google(audio, language="en-US")
                logger.info(f"🎤 Transcribed: {text}")
                return text
            except sr.UnknownValueError:
                logger.debug("⏸️ No speech detected")
                return None
            except sr.RequestError as e:
                logger.error(f"❌ Google Speech Recognition error: {e}")
                return None
                    
        except Exception as e:
            logger.error(f"❌ Error transcribing audio: {e}")
            return None
    
    def _convert_to_wav_ffmpeg(self, audio_data: bytes, source_format: str) -> Optional[bytes]:
        """
        Convert audio to WAV using ffmpeg subprocess directly.
        This bypasses pydub entirely to avoid ffmpeg discovery issues.
        """
        if not FFMPEG_PATH or not os.path.exists(FFMPEG_PATH):
            logger.error("❌ ffmpeg not available for audio conversion")
            return None
            
        input_file = None
        output_file = None
        
        try:
            # Write input audio to temp file
            input_file = tempfile.NamedTemporaryFile(
                suffix=f".{source_format}", delete=False
            )
            input_file.write(audio_data)
            input_file.close()
            
            # Output temp file
            output_file = tempfile.NamedTemporaryFile(
                suffix=".wav", delete=False
            )
            output_file.close()
            
            # Run ffmpeg conversion: input -> 16kHz mono WAV
            cmd = [
                FFMPEG_PATH,
                "-y",           # Overwrite output
                "-i", input_file.name,
                "-ar", "16000", # 16kHz sample rate
                "-ac", "1",     # Mono
                "-f", "wav",    # WAV format
                output_file.name
            ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                timeout=10
            )
            
            if result.returncode != 0:
                logger.debug(f"ffmpeg conversion failed (likely incomplete chunk)")
                return None
            
            # Read converted WAV
            with open(output_file.name, "rb") as f:
                wav_data = f.read()
            
            logger.info(f"✅ Audio converted: {source_format} → WAV ({len(wav_data)} bytes)")
            return wav_data
            
        except subprocess.TimeoutExpired:
            logger.error("❌ ffmpeg conversion timed out")
            return None
        except Exception as e:
            logger.error(f"❌ Error converting audio: {e}")
            return None
        finally:
            # Clean up temp files
            try:
                if input_file and os.path.exists(input_file.name):
                    os.unlink(input_file.name)
                if output_file and os.path.exists(output_file.name):
                    os.unlink(output_file.name)
            except:
                pass


# Singleton instance
transcriber = AudioTranscriber()
