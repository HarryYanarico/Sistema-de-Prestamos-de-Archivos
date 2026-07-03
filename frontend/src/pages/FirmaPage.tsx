import { useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Camera, Upload, CheckCircle2, AlertTriangle, Loader2, Send, X } from "lucide-react";

export default function FirmaPage() {
  const { token } = useParams<{ token: string }>();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Solo se permiten imágenes");
      return;
    }
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
    setError("");
  };

  const handleClear = () => {
    if (preview) URL.revokeObjectURL(preview);
    setSelectedFile(null);
    setPreview(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = useCallback(async () => {
    if (!selectedFile || !token) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("foto", selectedFile);
      const res = await fetch(`/api/upload-firma/${token}/`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setSuccess(true);
      setUploadedUrl(json.url || preview);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al subir la foto");
    } finally {
      setUploading(false);
    }
  }, [selectedFile, token, preview]);

  if (success && uploadedUrl) {
    return (
    <div className="min-h-screen bg-gradient-to-br from-white via-red-50 to-blue-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-surface-800 mb-2">¡Foto subida exitosamente!</h2>
          <p className="text-sm text-surface-500 mb-4">La foto del comprobante firmado ha sido registrada.</p>
          {uploadedUrl && (
            <img src={uploadedUrl} alt="Foto de firma" className="w-full rounded-xl border border-surface-300 shadow-sm" />
          )}
        </div>
      </div>
    );
  }

  const showPreview = preview && !success;

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-red-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
        <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center mx-auto mb-4">
          <Camera size={32} className="text-brand-600" />
        </div>
        <h2 className="text-xl font-bold text-surface-800 text-center mb-2">
          {showPreview ? "Previsualización" : "Subir foto de comprobante"}
        </h2>
        <p className="text-sm text-surface-500 text-center mb-6">
          {showPreview
            ? "Revisa la foto y presiona Enviar para confirmar."
            : "Toma una foto del comprobante firmado por la persona o selecciona una de la galería."}
        </p>

        {showPreview ? (
          <div className="mb-4">
            <div className="relative">
              <img src={preview!} alt="Previsualización" className="w-full rounded-xl border border-surface-300 shadow-sm" />
              <button onClick={handleClear}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              ><X size={16} /></button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-brand-300 rounded-xl p-10 text-center cursor-pointer hover:bg-brand-50 transition-colors mb-4"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Upload size={32} className="text-brand-400 mx-auto mb-2" />
            <p className="text-sm text-surface-600">Toca para tomar foto o seleccionar</p>
            <p className="text-xs text-surface-400 mt-1">También puedes arrastrar una imagen aquí</p>
          </div>
        )}

        {uploading && (
          <div className="flex items-center justify-center gap-2 text-brand-600 mb-4">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm font-medium">Subiendo foto...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-xl px-4 py-2.5 text-sm mb-4">
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        {showPreview && !uploading && (
          <button onClick={handleUpload}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 text-white font-medium shadow-md hover:shadow-lg transition-all text-sm"
          ><Send size={16} /> Enviar foto</button>
        )}

        <div className="mt-4 text-center">
          <p className="text-xs text-surface-400">
            La foto se usará como constancia de la recepción del comprobante firmado.
          </p>
        </div>
      </div>
    </div>
  );
}
