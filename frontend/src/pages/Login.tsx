import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  ShieldCheck,
  Lock,
  User,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";

type ResetMode = "login" | "username" | "code" | "newpass" | "done";

function Heading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-surface-800 dark:text-navy-200">
        {title}
      </h2>
      <p className="text-sm text-surface-800/55 dark:text-navy-300/55">
        {subtitle}
      </p>
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-xl bg-red-600 dark:bg-red-500 py-3 px-4 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-red-600/30 dark:shadow-red-500/30 transition-all hover:-translate-y-0.5 hover:bg-red-700 dark:hover:bg-red-600 hover:shadow-xl disabled:translate-y-0 disabled:opacity-60">
      {children}
    </button>
  );
}

function BackButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 py-2 text-sm font-medium text-surface-800/55 dark:text-navy-300/55 transition-colors hover:text-surface-800 dark:hover:text-navy-200">
      <ArrowLeft size={16} />
      {children}
    </button>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-red-600/25 dark:border-red-400/25 bg-red-600/5 dark:bg-red-400/5 px-4 py-2.5 text-sm text-red-700 dark:text-red-300">
      {children}
    </div>
  );
}

function NameBanner({
  name,
  role,
  compact = false,
}: {
  name: string;
  role: string;
  compact?: boolean;
}) {
  return (
        <div className="-mt-16 w-full text-center font-bold uppercase tracking-wide text-white drop-shadow-lg">
      <div
        className={`bg-red-600 dark:bg-red-500 ${
          compact
            ? "px-1.5 py-0.5 text-[0.4rem] sm:px-2 sm:py-1 sm:text-[0.6rem] rounded"
            : "px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm lg:text-base rounded-t-lg"
        }`}>
        {name}
      </div>
      <div
        className={`-mt-px bg-surface-800 dark:bg-navy-800 font-semibold ${
          compact
            ? "px-1.5 py-0.5 text-[0.35rem] sm:px-2 sm:py-0.5 sm:text-[0.55rem] rounded"
            : "px-3 py-1 text-xs sm:px-4 sm:py-1.5 sm:text-sm lg:text-sm rounded-b-lg"
        }`}>
        {role}
      </div>
    </div>
  );
}

const fieldClass =
  "w-full rounded-xl border border-surface-800/15 dark:border-navy-300/15 bg-white/80 dark:bg-navy-800/80 px-4 py-2.5 text-surface-800 dark:text-navy-200 placeholder:text-surface-800/40 dark:placeholder:text-navy-300/40 outline-none transition-all focus:border-red-600/40 dark:focus:border-red-400/40 focus:bg-white dark:focus:bg-navy-800 focus:ring-4 focus:ring-red-600/10 dark:focus:ring-red-400/10";

export default function Login() {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [requires2FA, setRequires2FA] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);

  const [otpCode, setOtpCode] = useState("");
  const [userId, setUserId] = useState<number | null>(null);
  const [tempToken, setTempToken] = useState("");

  const [qrCode, setQrCode] = useState("");
  const [notificationMessage] = useState(() => {
    const msg = localStorage.getItem("session_invalidated_message");
    if (msg) localStorage.removeItem("session_invalidated_message");
    return msg ?? "";
  });

  // =========================
  // PASSWORD RESET
  // =========================
  const [resetMode, setResetMode] = useState<ResetMode>("login");
  const [resetUsername, setResetUsername] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  const resetToLogin = () => {
    setResetMode("login");
    setResetUsername("");
    setResetCode("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setUsername("");
    setPassword("");
  };

  const handleRequestReset = async () => {
    if (!resetUsername.trim()) {
      setError("Ingresa tu nombre de usuario.");
      return;
    }
    setError("");
    setResetMode("code");
  };

  const handleVerifyResetCode = async () => {
    if (!resetCode.trim()) {
      setError("Ingresa el código de restablecimiento.");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      const response = await fetch("/graphql/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            mutation Verify($username: String!, $code: String!) {
              verifyResetCode(username: $username, code: $code) {
                success
                error
              }
            }
          `,
          variables: { username: resetUsername, code: resetCode },
        }),
      });
      const data = await response.json();
      if (data.errors) {
        setError(data.errors[0].message);
        return;
      }
      const result = data.data.verifyResetCode;
      if (!result.success) {
        setError(result.error || "Código inválido.");
        return;
      }
      setResetMode("newpass");
    } catch {
      setError("Error conectando con el servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetNewPassword = async () => {
    if (newPassword.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      const response = await fetch("/graphql/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            mutation SetNew($username: String!, $code: String!, $newPassword: String!) {
              setNewPassword(username: $username, code: $code, newPassword: $newPassword) {
                success
                error
              }
            }
          `,
          variables: { username: resetUsername, code: resetCode, newPassword },
        }),
      });
      const data = await response.json();
      if (data.errors) {
        setError(data.errors[0].message);
        return;
      }
      const result = data.data.setNewPassword;
      if (!result.success) {
        setError(result.error || "Error al restablecer la contraseña.");
        return;
      }
      setResetMode("done");
    } catch {
      setError("Error conectando con el servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  // =========================
  // LOGIN
  // =========================
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username.trim()) {
      setError("Ingresa tu usuario o correo.");
      return;
    }
    if (!password.trim()) {
      setError("Ingresa tu contraseña.");
      return;
    }
    setIsLoading(true);

    try {
      const response = await fetch("/graphql/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
          mutation Login($username: String!, $password: String!) {
            login2fa(username: $username, password: $password) {
              success
              requires2fa
              setupRequired
              qrCode
              userId
              tempToken
              token
              error
            }
          }
        `,
          variables: { username, password },
        }),
      });

      const data = await response.json();

      if (data.errors) {
        setError(data.errors[0].message);
        return;
      }

      const result = data.data.login2fa;

      if (!result.success) {
        setError(result.error || "Credenciales incorrectas");
        return;
      }

      if (!result.requires2fa && result.token) {
        localStorage.setItem("jwt_token", result.token);
        window.location.reload();
        return;
      }

      setRequires2FA(result.requires2fa);
      setSetupRequired(result.setupRequired);
      setUserId(result.userId);
      setTempToken(result.tempToken);

      if (result.qrCode) {
        setQrCode(result.qrCode);
      }
    } catch {
      setError("Error conectando con el servidor");
    } finally {
      setIsLoading(false);
    }
  };

  // =========================
  // VERIFY 2FA
  // =========================
  const handleVerify2FA = async () => {
    setError("");
    if (!otpCode.trim()) {
      setError("Ingresa el código de verificación.");
      return;
    }

    try {
      const response = await fetch("/graphql/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            mutation Verify($userId: Int!, $code: String!, $tempToken: String!) {
              verify2fa(userId: $userId, code: $code, tempToken: $tempToken) {
                success
                token
                error
              }
            }
          `,
          variables: { userId, code: otpCode, tempToken },
        }),
      });

      const data = await response.json();

      if (data.errors) {
        setError(data.errors[0].message);
        return;
      }

      const result = data.data.verify2fa;

      if (!result.success) {
        setError(result.error || "Código inválido");
        return;
      }

      localStorage.setItem("jwt_token", result.token);

      await refreshSession();

      navigate("/");
    } catch {
      setError("Error verificando código");
    }
  };

  return (
    <main className="relative h-screen bg-gradient-to-br from-white via-[#eef2fb] to-[#fbe9ea] dark:from-navy-950 dark:via-navy-900 dark:to-navy-950">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute bottom-40 h-[28rem] w-[28rem] rounded-full bg-surface-800/15 dark:bg-navy-700/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-0 -right-24 h-[26rem] w-[26rem] rounded-full bg-red-600/15 dark:bg-red-500/15 blur-[120px]" />

      {/* Diagonal brand ribbons */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-1/4 top-1/3 h-24 w-[150%] -rotate-6 bg-surface-800/[0.04] dark:bg-navy-700/[0.08]" />
        <div className="absolute -left-1/4 top-1/2 h-12 w-[150%] -rotate-6 bg-red-600/[0.05] dark:bg-red-500/[0.08]" />
      </div>

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="fixed top-7 right-7 z-50 w-10 h-10 rounded-xl bg-white/50 dark:bg-navy-800/50 border border-white/40 dark:border-navy-700/40 flex items-center justify-center text-surface-600 dark:text-navy-400 hover:text-brand-600 dark:hover:text-brand-dark-400 hover:bg-white dark:hover:bg-navy-800 transition-colors"
        title={theme === "light" ? "Modo oscuro" : "Modo claro"}>
        {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
      </button>

      {/* Giant rotating seal watermark */}
      <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/3">
        <div className="animate-spin-slow overflow-hidden rounded-full opacity-[0.07]">
          <img
            src="/sello.png"
            alt=""
            width={680}
            height={680}
            className="h-[42rem] w-[42rem] scale-110 object-cover"
          />
        </div>
      </div>

      {/* People images - desktop */}
      <div className="pointer-events-none fixed left-0 bottom-0 hidden w-[25vw] max-w-[280px] flex-col items-center lg:flex xl:w-[30vw] xl:max-w-[380px] 2xl:w-[35vw] 2xl:max-w-[480px]">
        <img
          src="/rector.png"
          alt="Dr. Reinerio Vargas Banegas, Rector UAGRM"
          className="h-auto w-full drop-shadow-2xl dark:opacity-80"
        />
        <NameBanner
          name="Dr. Reinerio Vargas"
          role="Rector UAGRM"
        />
      </div>
      <div className="pointer-events-none fixed right-0 bottom-0 hidden w-[25vw] max-w-[280px] flex-col items-center lg:flex xl:w-[30vw] xl:max-w-[380px] 2xl:w-[35vw] 2xl:max-w-[480px]">
        <img
          src="/vicerrectora.png"
          alt="Ing. Juana Borja Saavedra, Vicerrectora"
          className="h-auto w-full drop-shadow-2xl dark:opacity-80"
        />
        <NameBanner
          name="Ing. Juana Borja"
          role="Vicerrectora"
        />
      </div>

      {/* Header UAGRM */}
      <header className="absolute left-1/2 top-7 z-20 flex -translate-x-1/2 flex-col items-center gap-1 text-center">
        <p className="text-xl font-bold uppercase tracking-[0.35em] text-surface-800/70 dark:text-navy-300/70">
          <span className="hidden sm:inline">Universidad Autónoma Gabriel René Moreno</span>
          <span className="sm:hidden">UAGRM</span>
        </p>
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-red-600 dark:text-red-400">
          Vicerrectorado · Registro y Trámites
        </p>
      </header>

      <div className="absolute inset-0 overflow-y-auto">
        <div className="min-h-screen flex items-start sm:items-center justify-center px-4 py-10">
          {/* Login card */}
          <div className="relative z-10 w-full max-w-md">
            <div className="relative rounded-[2rem] border border-white/70 dark:border-navy-700/40 bg-white/80 dark:bg-navy-900/80 p-7 pt-14 shadow-2xl shadow-surface-800/20 dark:shadow-black/40 backdrop-blur-xl sm:p-9 sm:pt-16">
              {/* Seal */}
              <img
                src="/sello.png"
                alt=""
                className="pointer-events-none select-none absolute top-0 sm:-top-2 lg:top-6 xl:top-8 -left-8 sm:-left-20 lg:-left-28 xl:-left-36 2xl:-left-40 z-30 h-16 w-16 sm:h-20 sm:w-20 md:h-28 md:w-28 lg:h-36 lg:w-36 xl:h-44 xl:w-44 2xl:h-52 2xl:w-52 object-cover -rotate-12"
              />

              {/* Title */}
              <div className="mb-6 text-center">
                <h1 className="text-2xl font-extrabold tracking-tight text-surface-800 dark:text-navy-200">
                  Bienvenido al{" "}
                  <span className="text-red-600 dark:text-red-400">Sistema</span>
                </h1>
                <p className="mt-1 text-sm text-surface-800/70 dark:text-navy-300/55">
                  Rumbo a la Digitalización · UAGRM
                </p>
              </div>

              {/* Notification message */}
              {notificationMessage && (
                <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-sm">
                  <AlertTriangle
                    size={20}
                    className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
                  />
                  <div>
                    <p className="font-semibold text-amber-800 dark:text-amber-200">
                      Sesión cerrada
                    </p>
                    <p className="text-amber-700 dark:text-amber-300 mt-0.5">
                      {notificationMessage}
                    </p>
                  </div>
                </div>
              )}

              {/* ========== 2FA FLOW ========== */}
              {requires2FA && (
                <div className="flex flex-col items-center">
                  <div className="w-full max-w-xs space-y-4">
                    {setupRequired && qrCode && (
                      <div className="space-y-3">
                        <p className="text-sm text-surface-600 dark:text-navy-400">
                          Abre Google Authenticator y escanea el QR
                        </p>
                        <div className="flex items-center justify-center">
                          <div className="bg-white rounded-xl p-2 shadow-inner">
                            <img
                              src={qrCode}
                              className="w-48 h-48"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="rounded-xl bg-white/30 dark:bg-navy-800/30 border border-white/20 dark:border-navy-700/30 p-4 space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-navy-300 mb-1.5">
                          Código de verificación
                        </label>
                        <input
                          type="text"
                          placeholder="123456"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                          className={`${fieldClass} text-center text-lg tracking-widest`}
                          maxLength={6}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          handleVerify2FA();
                        }}
                        className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-red-600 dark:bg-red-500 text-white font-bold uppercase tracking-wide text-sm shadow-lg shadow-red-600/30 dark:shadow-red-500/30 hover:-translate-y-0.5 hover:bg-red-700 dark:hover:bg-red-600 hover:shadow-xl transition-all">
                        Verificar código
                        <ArrowRight size={18} />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setRequires2FA(false);
                          setSetupRequired(false);
                          setQrCode("");
                          setOtpCode("");
                          setError("");
                        }}
                        className="w-full text-sm font-medium text-surface-800/55 dark:text-navy-300/55 hover:text-surface-800 dark:hover:text-navy-200 transition-colors py-1.5">
                        Volver al inicio de sesión
                      </button>
                    </div>

                    {error && <ErrorBox>{error}</ErrorBox>}
                  </div>
                </div>
              )}

              {/* ========== PASSWORD RESET FLOW ========== */}
              {!requires2FA && resetMode === "username" && (
                <div className="space-y-5">
                  <Heading
                    title="Recuperar acceso"
                    subtitle="Ingresa tu usuario para enviarte un código"
                  />
                  <div>
                    <label className="block text-sm font-semibold text-surface-800 dark:text-navy-200 mb-1.5">
                      Nombre de usuario
                    </label>
                    <input
                      type="text"
                      placeholder="admin"
                      value={resetUsername}
                      onChange={(e) => setResetUsername(e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                  <PrimaryButton onClick={handleRequestReset}>
                    Solicitar restablecimiento
                  </PrimaryButton>
                  <BackButton onClick={resetToLogin}>
                    Volver al inicio de sesión
                  </BackButton>
                  {error && <ErrorBox>{error}</ErrorBox>}
                </div>
              )}

              {!requires2FA && resetMode === "code" && (
                <div className="space-y-5">
                  <Heading
                    title="Verifica tu código"
                    subtitle="Revisa tu correo institucional"
                  />
                  <div>
                    <label className="block text-sm font-semibold text-surface-800 dark:text-navy-200 mb-1.5">
                      Código de restablecimiento
                    </label>
                    <input
                      type="text"
                      placeholder="Ingresa el código"
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                      className={`${fieldClass} text-center text-lg tracking-[0.3em]`}
                    />
                  </div>
                  <PrimaryButton
                    onClick={handleVerifyResetCode}
                    disabled={isLoading}>
                    {isLoading ? "Verificando..." : "Verificar código"}
                  </PrimaryButton>
                  <BackButton
                    onClick={() => {
                      setResetMode("username");
                      setResetCode("");
                      setError("");
                    }}>
                    Volver
                  </BackButton>
                  {error && <ErrorBox>{error}</ErrorBox>}
                </div>
              )}

              {!requires2FA && resetMode === "newpass" && (
                <div className="space-y-5">
                  <Heading
                    title="Nueva contraseña"
                    subtitle="Crea una contraseña segura"
                  />
                  <div>
                    <label className="block text-sm font-semibold text-surface-800 dark:text-navy-200 mb-1.5">
                      Nueva contraseña
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        placeholder="Mínimo 8 caracteres"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className={`${fieldClass} pr-11`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-800/50 dark:text-navy-300/50 hover:text-surface-800 dark:hover:text-navy-200">
                        {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-surface-800 dark:text-navy-200 mb-1.5">
                      Confirmar contraseña
                    </label>
                    <input
                      type="password"
                      placeholder="Repite la contraseña"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={fieldClass}
                    />
                  </div>
                  <PrimaryButton
                    onClick={handleSetNewPassword}
                    disabled={isLoading}>
                    {isLoading ? "Restableciendo..." : "Restablecer contraseña"}
                  </PrimaryButton>
                  <BackButton onClick={resetToLogin}>
                    Volver al inicio de sesión
                  </BackButton>
                  {error && <ErrorBox>{error}</ErrorBox>}
                </div>
              )}

              {!requires2FA && resetMode === "done" && (
                <div className="space-y-6 text-center">
                  <div className="flex justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                      <CheckCircle
                        size={32}
                        className="text-emerald-600 dark:text-emerald-400"
                      />
                    </div>
                  </div>
                  <p className="text-sm text-surface-600 dark:text-navy-400">
                    Tu contraseña ha sido restablecida exitosamente. Ahora puedes
                    iniciar sesión con tu nueva contraseña.
                  </p>
                  <PrimaryButton onClick={resetToLogin}>
                    Iniciar Sesión
                  </PrimaryButton>
                </div>
              )}

              {/* ========== LOGIN FORM ========== */}
              {!requires2FA && resetMode === "login" && (
                <form
                  onSubmit={handleSubmit}
                  className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-surface-800 dark:text-navy-200 mb-1.5">
                      Usuario o correo
                    </label>
                    <div className="relative">
                      <User
                        size={18}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-800/40 dark:text-navy-300/40"
                      />
                      <input
                        type="text"
                        placeholder="admin"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className={`${fieldClass} pl-11`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-surface-800 dark:text-navy-200 mb-1.5">
                      Contraseña
                    </label>
                    <div className="relative">
                      <Lock
                        size={18}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-800/40 dark:text-navy-300/40"
                      />
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`${fieldClass} pl-11 pr-11`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-800/50 dark:text-navy-300/50 hover:text-surface-800 dark:hover:text-navy-200">
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setResetMode("username");
                      setError("");
                    }}
                    className="-mt-1 block text-left text-xs font-medium text-surface-800 dark:text-navy-300/60 transition-colors hover:text-red-600 dark:hover:text-red-400">
                    ¿Olvidaste tu contraseña?
                  </button>

                  {error && <ErrorBox>{error}</ErrorBox>}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 dark:bg-red-500 py-3 px-4 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-red-600/30 dark:shadow-red-500/30 transition-all hover:-translate-y-0.5 hover:bg-red-700 dark:hover:bg-red-600 hover:shadow-xl disabled:translate-y-0 disabled:opacity-60">
                    {isLoading ? "Ingresando..." : "Iniciar Sesión"}
                    {!isLoading && <ArrowRight size={18} />}
                  </button>

                  <div className="flex items-center justify-center gap-2 pt-1 text-xs text-surface-800 dark:text-navy-300/50">
                    <ShieldCheck
                      size={14}
                      className="text-red-600 dark:text-red-400"
                    />
                    Acceso protegido con verificación en dos pasos
                  </div>
                </form>
              )}
            </div>

            {/* Color accent bar */}
            <div className="mx-auto mt-4 flex h-1.5 w-32 overflow-hidden rounded-full">
              <span className="flex-1 bg-red-600 dark:bg-red-500" />
              <span className="flex-1 bg-white dark:bg-navy-800" />
              <span className="flex-1 bg-surface-800 dark:bg-navy-200" />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile people strip */}
      <div className="fixed bottom-0 left-0 right-0 flex items-center justify-between lg:hidden">
        <div className="flex w-36 flex-col items-end sm:w-44">
          <img
            src="/rector.png"
            alt="Dr. Reinerio Vargas Banegas, Rector UAGRM"
            className="h-auto w-full opacity-95 dark:opacity-70"
          />
          <NameBanner
            name="Dr. Reinerio Vargas"
            role="Rector UAGRM"
            compact
          />
        </div>
        <div className="flex w-36 flex-col items-center sm:w-44">
          <img
            src="/vicerrectora.png"
            alt="Ing. Juana Borja Saavedra, Vicerrectora"
            className="h-auto w-full opacity-95 dark:opacity-70"
          />
          <NameBanner
            name="Ing. Juana Borja"
            role="Vicerrectora"
            compact
          />
        </div>
      </div>
    </main>
  );
}
