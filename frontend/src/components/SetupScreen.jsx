import { useState, useRef } from 'react';
import { WindowControls } from './WindowControls';

const API_URL = 'http://localhost:8000';

/**
 * Setup screen shown before starting an interview.
 * Upload CV PDFs + paste job description for personalized AI responses.
 */
export function SetupScreen({ onComplete, sessionId }) {
    const [files, setFiles] = useState([]);
    const [jobDescription, setJobDescription] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef(null);

    // Handle file selection
    const handleFileSelect = (e) => {
        const selected = Array.from(e.target.files).filter(f => f.type === 'application/pdf');
        if (selected.length !== e.target.files.length) {
            alert('Solo se permiten archivos PDF');
        }
        setFiles(prev => [...prev, ...selected]);
    };

    // Handle drag & drop
    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const dropped = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
        if (dropped.length === 0) {
            alert('Solo se permiten archivos PDF');
            return;
        }
        setFiles(prev => [...prev, ...dropped]);
    };

    // Remove a file
    const removeFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    // Upload and start interview
    const handleStart = async () => {
        setIsUploading(true);
        setUploadResult(null);

        try {
            const formData = new FormData();
            files.forEach(file => formData.append('files', file));
            formData.append('job_description', jobDescription);
            formData.append('session_id', sessionId);

            const response = await fetch(`${API_URL}/api/upload-context`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const result = await response.json();
            setUploadResult(result);

            // Wait a moment for visual feedback, then proceed
            setTimeout(() => {
                onComplete({
                    cvUploaded: result.cv_extracted,
                    jobDescriptionSet: result.job_description_set,
                    filesProcessed: result.files_processed,
                    sessionId: result.session_id
                });
            }, 800);

        } catch (error) {
            console.error('Upload error:', error);
            setUploadResult({ error: error.message });
            setIsUploading(false);
        }
    };

    // Skip setup (use without CV)
    const handleSkip = () => {
        onComplete({ cvUploaded: false, jobDescriptionSet: false, filesProcessed: 0, sessionId });
    };

    return (
        <div className="w-screen h-screen flex items-center justify-center p-6">
            <div className="glass rounded-2xl border-2 border-cyber-cyan/30 p-6 w-full max-w-lg space-y-5">

                {/* Header with window controls */}
                <div className="flex items-center justify-between">
                    <div className="text-center flex-1">
                        <h1 className="text-2xl font-bold text-cyber-cyan neon-text tracking-wider mb-1">
                            VOZ<span className="text-cyber-magenta">INTERVIEW</span>
                        </h1>
                        <p className="text-xs text-gray-400 font-mono">
                            Configura tu perfil para respuestas personalizadas
                        </p>
                    </div>
                    <WindowControls />
                </div>

                {/* PDF Upload Zone */}
                <div>
                    <label className="flex items-center gap-1.5 mb-2">
                        <div className="w-1 h-3 bg-cyber-cyan rounded-full" />
                        <span className="text-xs font-bold text-cyber-cyan uppercase tracking-wider">
                            📄 Tu CV y Documentos
                        </span>
                    </label>

                    <div
                        className={`
                            border-2 border-dashed rounded-xl p-4 text-center cursor-pointer 
                            transition-all duration-200
                            ${dragOver
                                ? 'border-cyber-cyan bg-cyber-cyan/10'
                                : 'border-gray-600 hover:border-cyber-cyan/50'
                            }
                        `}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf"
                            multiple
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        <p className="text-gray-400 text-xs font-mono">
                            {dragOver ? '📥 Suelta aquí' : '📎 Arrastra PDFs aquí o haz clic'}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-1">
                            CV, portafolio, proyectos (solo PDF)
                        </p>
                    </div>

                    {/* File List */}
                    {files.length > 0 && (
                        <div className="mt-2 space-y-1">
                            {files.map((file, i) => (
                                <div key={i} className="flex items-center justify-between glass rounded-lg px-3 py-1.5">
                                    <span className="text-xs text-gray-300 font-mono truncate flex-1">
                                        📄 {file.name}
                                    </span>
                                    <span className="text-[10px] text-gray-500 mx-2">
                                        {(file.size / 1024).toFixed(0)}KB
                                    </span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                                        className="text-red-400 hover:text-red-300 text-xs"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Job Description */}
                <div>
                    <label className="flex items-center gap-1.5 mb-2">
                        <div className="w-1 h-3 bg-cyber-magenta rounded-full" />
                        <span className="text-xs font-bold text-cyber-magenta uppercase tracking-wider">
                            💼 Descripción del Puesto
                        </span>
                    </label>
                    <textarea
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        placeholder="Pega aquí la descripción del trabajo al que postulas..."
                        rows={4}
                        className="w-full px-3 py-2 glass rounded-lg border border-cyber-magenta/20 
                            text-white text-xs font-mono bg-transparent resize-none
                            focus:outline-none focus:border-cyber-magenta/50
                            placeholder:text-gray-500"
                    />
                </div>

                {/* Upload Result */}
                {uploadResult && !uploadResult.error && (
                    <div className="p-2 glass rounded-lg border border-green-500/30 animate-slide-up">
                        <p className="text-[10px] text-green-400 font-mono">
                            ✅ {uploadResult.files_processed} archivo(s) procesados •
                            {uploadResult.cv_length} caracteres extraídos
                        </p>
                    </div>
                )}
                {uploadResult?.error && (
                    <div className="p-2 glass rounded-lg border border-red-500/30">
                        <p className="text-[10px] text-red-400 font-mono">❌ {uploadResult.error}</p>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={handleStart}
                        disabled={isUploading}
                        className={`
                            flex-1 py-2.5 rounded-xl text-sm font-bold tracking-wider
                            transition-all duration-300
                            ${isUploading
                                ? 'bg-gray-700 text-gray-400 cursor-wait'
                                : 'bg-gradient-to-r from-cyber-cyan to-cyber-blue text-black hover:opacity-90 shadow-neon-cyan'
                            }
                        `}
                    >
                        {isUploading ? '⏳ Procesando...' : '🚀 Iniciar Entrevista'}
                    </button>

                    <button
                        onClick={handleSkip}
                        className="px-4 py-2.5 rounded-xl text-xs font-mono
                            glass border border-gray-600 text-gray-400
                            hover:text-white hover:border-gray-400 transition-all"
                    >
                        Saltar
                    </button>
                </div>

                <p className="text-[9px] text-gray-500 text-center font-mono">
                    🔒 Tus archivos son procesados y eliminados inmediatamente. No se almacenan.
                </p>
            </div>
        </div>
    );
}
