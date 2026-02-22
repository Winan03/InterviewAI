import { useState, useRef, useEffect } from 'react';

// Detect Electron environment
const isElectron = !!(window && window.process && window.process.type);
const ipcRenderer = isElectron ? window.require('electron').ipcRenderer : null;

/**
 * ImageSolver — Upload or capture an image of an English exercise and get the solution.
 * In Electron: screen capture (snipping tool) + file upload.
 * In Browser: file upload only.
 */
export function ImageSolver({ token }) {
    const [image, setImage] = useState(null);          // { preview, base64 }
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [question, setQuestion] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef(null);

    const API_BASE = window.location.hostname === 'localhost'
        ? 'http://localhost:8000'
        : window.location.origin;

    // Listen for snip results from Electron main process
    useEffect(() => {
        if (!ipcRenderer) return;

        const handleSnipResult = (event, dataUrl) => {
            setError('');
            setResult(null);
            setImage({
                preview: dataUrl,
                base64: dataUrl,
            });
        };

        ipcRenderer.on('snip-result', handleSnipResult);
        return () => {
            ipcRenderer.removeListener('snip-result', handleSnipResult);
        };
    }, []);

    // Start screen capture (Electron only)
    const startCapture = () => {
        if (ipcRenderer) {
            ipcRenderer.send('start-snip');
        }
    };

    // Convert file to base64
    const fileToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    // Handle file selection (click or drop)
    const handleFile = async (file) => {
        if (!file || !file.type.startsWith('image/')) {
            setError('Por favor sube una imagen (PNG, JPG, WEBP)');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setError('La imagen es muy grande (máx. 10MB)');
            return;
        }
        setError('');
        setResult(null);
        const base64 = await fileToBase64(file);
        setImage({
            preview: URL.createObjectURL(file),
            base64,
        });
    };

    const onDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        handleFile(file);
    };

    const onFileChange = (e) => {
        const file = e.target.files[0];
        if (file) handleFile(file);
    };

    // Send image to backend for analysis
    const analyze = async () => {
        if (!image) return;
        setLoading(true);
        setError('');
        setResult(null);

        try {
            const res = await fetch(`${API_BASE}/api/solver/analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    image_base64: image.base64,
                    question: question || null,
                }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || `Error ${res.status}`);
            }

            const data = await res.json();
            setResult(data);
        } catch (err) {
            setError(err.message || 'Error al analizar la imagen');
        } finally {
            setLoading(false);
        }
    };

    const clearAll = () => {
        setImage(null);
        setResult(null);
        setError('');
        setQuestion('');
    };

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <span style={{ fontSize: '1.3rem' }}>📸</span>
                <h2 style={styles.title}>Exercise Solver</h2>
            </div>
            <p style={styles.subtitle}>
                {isElectron
                    ? 'Captura tu pantalla o sube una imagen de un ejercicio de inglés'
                    : 'Sube una imagen de un ejercicio de inglés y obtén la solución bilingüe'}
            </p>

            {/* Input Area — Capture + Upload */}
            {!image ? (
                <div style={styles.inputArea}>
                    {/* Screen Capture Button (Electron only) */}
                    {isElectron && (
                        <button onClick={startCapture} style={styles.captureBtn}>
                            <span style={{ fontSize: '1.4rem' }}>✂️</span>
                            <div>
                                <div style={styles.captureBtnTitle}>Capturar Pantalla</div>
                                <div style={styles.captureBtnSub}>Selecciona un área de tu pantalla</div>
                            </div>
                        </button>
                    )}

                    {/* Divider */}
                    {isElectron && (
                        <div style={styles.divider}>
                            <div style={styles.dividerLine}></div>
                            <span style={styles.dividerText}>o</span>
                            <div style={styles.dividerLine}></div>
                        </div>
                    )}

                    {/* File Upload Drop Zone */}
                    <div
                        style={{
                            ...styles.dropZone,
                            ...(dragOver ? styles.dropZoneActive : {}),
                        }}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={onDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <div style={styles.dropIcon}>📁</div>
                        <p style={styles.dropText}>Subir imagen</p>
                        <p style={styles.dropSubtext}>Arrastra o haz clic · PNG, JPG, WEBP</p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={onFileChange}
                            style={{ display: 'none' }}
                        />
                    </div>
                </div>
            ) : (
                <div style={styles.previewArea}>
                    <img
                        src={image.preview}
                        alt="Exercise"
                        style={styles.previewImage}
                    />
                    <button onClick={clearAll} style={styles.clearBtn}>✕ Cambiar imagen</button>
                </div>
            )}

            {/* Optional Question */}
            {image && !result && (
                <div style={styles.questionArea}>
                    <input
                        type="text"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="Pregunta adicional (opcional): ej. 'Explica la regla gramatical'"
                        style={styles.questionInput}
                    />
                    <button
                        onClick={analyze}
                        disabled={loading}
                        style={{
                            ...styles.analyzeBtn,
                            ...(loading ? styles.analyzeBtnDisabled : {}),
                        }}
                    >
                        {loading ? (
                            <span>⏳ Analizando...</span>
                        ) : (
                            <span>🔍 Analizar Ejercicio</span>
                        )}
                    </button>
                </div>
            )}

            {/* Error */}
            {error && <div style={styles.error}>{error}</div>}

            {/* Results */}
            {result && (
                <div style={styles.results}>
                    {/* Exercise Type Badge */}
                    <div style={styles.badge}>
                        {result.exercise_type.replace(/-/g, ' ')}
                    </div>

                    {/* Answer */}
                    <div style={styles.answerCard}>
                        <h3 style={styles.cardTitle}>✅ Respuesta</h3>
                        <div style={styles.answerText}>
                            {result.answer.split('\n').map((line, i) => (
                                <div key={i} style={line.trim() ? styles.answerLine : { height: 6 }}>
                                    {line}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Explanation EN */}
                    <div style={styles.explanationCard}>
                        <h3 style={styles.cardTitle}>🇬🇧 Explanation (English)</h3>
                        <div style={styles.explanationText}>
                            {result.explanation_en.split('\n').map((line, i) => (
                                <div key={i} style={line.trim() ? styles.explanationLine : { height: 6 }}>
                                    {line}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Explanation ES */}
                    <div style={styles.explanationCardEs}>
                        <h3 style={styles.cardTitle}>🇪🇸 Explicación (Español)</h3>
                        <div style={styles.explanationText}>
                            {result.explanation_es.split('\n').map((line, i) => (
                                <div key={i} style={line.trim() ? styles.explanationLine : { height: 6 }}>
                                    {line}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Retry */}
                    <button onClick={clearAll} style={styles.retryBtn}>
                        📸 Analizar otro ejercicio
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Styles ───
const styles = {
    container: {
        padding: '20px',
        maxWidth: '600px',
        margin: '0 auto',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '4px',
    },
    title: {
        color: '#00f3ff',
        fontSize: '1.3rem',
        fontWeight: 700,
        margin: 0,
    },
    subtitle: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: '0.85rem',
        marginBottom: '16px',
    },
    // Input area
    inputArea: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        marginBottom: '16px',
    },
    // Capture button (Electron)
    captureBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        padding: '14px 18px',
        background: 'linear-gradient(135deg, rgba(0,243,255,0.12), rgba(0,128,255,0.08))',
        border: '1px solid rgba(0,243,255,0.3)',
        borderRadius: '14px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        textAlign: 'left',
    },
    captureBtnTitle: {
        color: '#00f3ff',
        fontWeight: 700,
        fontSize: '0.95rem',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
    },
    captureBtnSub: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: '0.75rem',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
    },
    // Divider
    divider: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
    },
    dividerLine: {
        flex: 1,
        height: '1px',
        background: 'rgba(255,255,255,0.1)',
    },
    dividerText: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: '0.75rem',
    },
    // Drop zone
    dropZone: {
        border: '2px dashed rgba(0,243,255,0.3)',
        borderRadius: '16px',
        padding: '40px 20px',
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        background: 'rgba(0,243,255,0.03)',
    },
    dropZoneActive: {
        borderColor: '#00f3ff',
        background: 'rgba(0,243,255,0.08)',
        transform: 'scale(1.01)',
    },
    dropIcon: { fontSize: '2.5rem', marginBottom: '8px' },
    dropText: { color: '#fff', fontSize: '1rem', fontWeight: 600, margin: '4px 0' },
    dropSubtext: { color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', margin: 0 },
    dropFormats: { color: 'rgba(255,255,255,0.25)', fontSize: '0.75rem', marginTop: '8px' },
    // Preview
    previewArea: { textAlign: 'center', marginBottom: '16px' },
    previewImage: {
        maxWidth: '100%',
        maxHeight: '300px',
        borderRadius: '12px',
        border: '1px solid rgba(0,243,255,0.2)',
        objectFit: 'contain',
    },
    clearBtn: {
        marginTop: '8px',
        background: 'transparent',
        border: '1px solid rgba(255,100,100,0.4)',
        color: '#ff6464',
        padding: '6px 16px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '0.8rem',
    },
    // Question & Analyze
    questionArea: { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' },
    questionInput: {
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '10px',
        padding: '10px 14px',
        color: '#fff',
        fontSize: '0.85rem',
        outline: 'none',
    },
    analyzeBtn: {
        background: 'linear-gradient(135deg, #00f3ff, #0080ff)',
        border: 'none',
        borderRadius: '12px',
        padding: '14px',
        color: '#000',
        fontWeight: 700,
        fontSize: '1rem',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    analyzeBtnDisabled: {
        opacity: 0.6,
        cursor: 'not-allowed',
    },
    // Error
    error: {
        background: 'rgba(255,0,0,0.1)',
        border: '1px solid rgba(255,0,0,0.3)',
        borderRadius: '10px',
        padding: '10px 14px',
        color: '#ff6464',
        fontSize: '0.85rem',
        marginBottom: '12px',
    },
    // Results
    results: { display: 'flex', flexDirection: 'column', gap: '12px' },
    badge: {
        alignSelf: 'flex-start',
        background: 'rgba(0,243,255,0.12)',
        border: '1px solid rgba(0,243,255,0.3)',
        borderRadius: '20px',
        padding: '4px 14px',
        color: '#00f3ff',
        fontSize: '0.75rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '1px',
    },
    answerCard: {
        background: 'rgba(0,255,100,0.06)',
        border: '1px solid rgba(0,255,100,0.2)',
        borderRadius: '14px',
        padding: '16px',
    },
    cardTitle: {
        fontSize: '0.9rem',
        fontWeight: 700,
        color: '#fff',
        marginTop: 0,
        marginBottom: '8px',
    },
    answerText: {
        color: '#00ff64',
        fontSize: '1.05rem',
        fontWeight: 600,
        margin: 0,
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
    },
    explanationCard: {
        background: 'rgba(0,128,255,0.06)',
        border: '1px solid rgba(0,128,255,0.2)',
        borderRadius: '14px',
        padding: '16px',
    },
    explanationCardEs: {
        background: 'rgba(255,165,0,0.06)',
        border: '1px solid rgba(255,165,0,0.2)',
        borderRadius: '14px',
        padding: '16px',
    },
    explanationText: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: '0.88rem',
        margin: 0,
        lineHeight: 1.6,
    },
    answerLine: {
        padding: '3px 0',
    },
    explanationLine: {
        padding: '2px 0',
    },
    retryBtn: {
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '12px',
        padding: '12px',
        color: '#fff',
        fontWeight: 600,
        fontSize: '0.9rem',
        cursor: 'pointer',
        textAlign: 'center',
        transition: 'all 0.2s',
    },
};
