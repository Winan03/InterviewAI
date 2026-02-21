import { useState } from 'react';

/**
 * AuthScreen — Login/Register screen with cyberpunk styling.
 * Uses the same glass + neon aesthetic as the rest of the app.
 */
export function AuthScreen({ onAuth, authHook }) {
    const [activeTab, setActiveTab] = useState('login');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [localError, setLocalError] = useState('');

    // Form fields
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const { login, register } = authHook;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLocalError('');

        // Validation
        if (activeTab === 'register') {
            if (!name.trim()) {
                setLocalError('Ingresa tu nombre');
                return;
            }
            if (password.length < 6) {
                setLocalError('La contraseña debe tener al menos 6 caracteres');
                return;
            }
            if (password !== confirmPassword) {
                setLocalError('Las contraseñas no coinciden');
                return;
            }
        }

        if (!email.trim()) {
            setLocalError('Ingresa tu email');
            return;
        }

        setIsSubmitting(true);

        try {
            if (activeTab === 'register') {
                await register(email, password, name);
            } else {
                await login(email, password);
            }
        } catch (err) {
            setLocalError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const switchTab = (tab) => {
        setActiveTab(tab);
        setLocalError('');
    };

    return (
        <div className="w-screen h-screen flex items-center justify-center p-4"
            style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #0d1117 50%, #0a0a0f 100%)' }}>
            <div className="auth-container" style={{
                width: '100%',
                maxWidth: '400px',
                background: 'rgba(13, 17, 23, 0.9)',
                border: '1px solid rgba(0, 243, 255, 0.15)',
                borderRadius: '16px',
                padding: '32px',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 0 40px rgba(0, 243, 255, 0.05)',
            }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎙️</div>
                    <h1 style={{
                        fontSize: '20px',
                        fontWeight: 700,
                        fontFamily: "'JetBrains Mono', monospace",
                        background: 'linear-gradient(135deg, #00f3ff, #ff00e5)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        letterSpacing: '0.05em',
                    }}>VozInterview</h1>
                    <p style={{
                        fontSize: '11px',
                        color: 'rgba(255,255,255,0.4)',
                        fontFamily: "'JetBrains Mono', monospace",
                        marginTop: '4px',
                    }}>AI Interview Assistant</p>
                </div>

                {/* Tabs */}
                <div style={{
                    display: 'flex',
                    gap: '4px',
                    marginBottom: '20px',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '10px',
                    padding: '3px',
                }}>
                    {['login', 'register'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => switchTab(tab)}
                            style={{
                                flex: 1,
                                padding: '8px',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '12px',
                                fontFamily: "'JetBrains Mono', monospace",
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                background: activeTab === tab
                                    ? 'linear-gradient(135deg, rgba(0,243,255,0.15), rgba(255,0,229,0.1))'
                                    : 'transparent',
                                color: activeTab === tab ? '#00f3ff' : 'rgba(255,255,255,0.4)',
                                border: activeTab === tab
                                    ? '1px solid rgba(0,243,255,0.3)'
                                    : '1px solid transparent',
                            }}
                        >
                            {tab === 'login' ? 'Iniciar Sesión' : 'Registrarse'}
                        </button>
                    ))}
                </div>

                {/* Error */}
                {localError && (
                    <div style={{
                        background: 'rgba(255, 50, 50, 0.1)',
                        border: '1px solid rgba(255, 50, 50, 0.3)',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        marginBottom: '16px',
                        fontSize: '11px',
                        color: '#ff6b6b',
                        fontFamily: "'JetBrains Mono', monospace",
                    }}>
                        ⚠️ {localError}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit}>
                    {activeTab === 'register' && (
                        <InputField
                            label="Nombre"
                            type="text"
                            value={name}
                            onChange={setName}
                            placeholder="Tu nombre"
                            icon="👤"
                        />
                    )}

                    <InputField
                        label="Email"
                        type="email"
                        value={email}
                        onChange={setEmail}
                        placeholder="tu@email.com"
                        icon="📧"
                    />

                    <InputField
                        label="Contraseña"
                        type="password"
                        value={password}
                        onChange={setPassword}
                        placeholder="••••••"
                        icon="🔒"
                    />

                    {activeTab === 'register' && (
                        <InputField
                            label="Confirmar contraseña"
                            type="password"
                            value={confirmPassword}
                            onChange={setConfirmPassword}
                            placeholder="••••••"
                            icon="🔒"
                        />
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        style={{
                            width: '100%',
                            padding: '12px',
                            marginTop: '8px',
                            border: 'none',
                            borderRadius: '10px',
                            fontSize: '13px',
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 700,
                            cursor: isSubmitting ? 'not-allowed' : 'pointer',
                            background: isSubmitting
                                ? 'rgba(255,255,255,0.05)'
                                : 'linear-gradient(135deg, #00f3ff, #ff00e5)',
                            color: isSubmitting ? 'rgba(255,255,255,0.3)' : '#000',
                            transition: 'all 0.3s ease',
                            letterSpacing: '0.05em',
                        }}
                    >
                        {isSubmitting
                            ? '⏳ Procesando...'
                            : activeTab === 'login'
                                ? '→ Entrar'
                                : '→ Crear Cuenta'}
                    </button>
                </form>

                {/* Footer */}
                <p style={{
                    textAlign: 'center',
                    marginTop: '16px',
                    fontSize: '10px',
                    color: 'rgba(255,255,255,0.3)',
                    fontFamily: "'JetBrains Mono', monospace",
                }}>
                    {activeTab === 'login' ? (
                        <>¿No tienes cuenta? <span onClick={() => switchTab('register')} style={{ color: '#00f3ff', cursor: 'pointer' }}>Regístrate</span></>
                    ) : (
                        <>¿Ya tienes cuenta? <span onClick={() => switchTab('login')} style={{ color: '#00f3ff', cursor: 'pointer' }}>Inicia sesión</span></>
                    )}
                </p>
            </div>
        </div>
    );
}

// ─── Reusable Input ───
function InputField({ label, type, value, onChange, placeholder, icon }) {
    return (
        <div style={{ marginBottom: '14px' }}>
            <label style={{
                display: 'block',
                fontSize: '10px',
                color: 'rgba(255,255,255,0.5)',
                fontFamily: "'JetBrains Mono', monospace",
                marginBottom: '6px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
            }}>
                {icon} {label}
            </label>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                required
                style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontFamily: "'JetBrains Mono', monospace",
                    color: '#e6e6e6',
                    outline: 'none',
                    transition: 'border-color 0.2s ease',
                    boxSizing: 'border-box',
                }}
                onFocus={(e) => e.target.style.borderColor = 'rgba(0,243,255,0.4)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
        </div>
    );
}
