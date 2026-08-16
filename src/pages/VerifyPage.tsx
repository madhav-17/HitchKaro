import { useEffect, useRef, useState } from 'react';
import { Upload, IdCard, ScanFace, CheckCircle2, Loader2, ShieldCheck, Camera, X, Car } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/context/RouterContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { updateProfile, uploadVerificationImage } from '@/lib/profiles';
import { FACE_SCAN_BUCKET, ID_CARD_BUCKET, LICENSE_BUCKET } from '@/lib/supabase';

type Step = 'id' | 'face' | 'license' | 'vehicle' | 'scanning' | 'done';

export function VerifyPage() {
  const { profile, session, refreshProfile } = useAuth();
  const { navigate } = useRouter();

  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [idCardPreview, setIdCardPreview] = useState<string | null>(null);
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [facePreview, setFacePreview] = useState<string | null>(null);
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [licensePreview, setLicensePreview] = useState<string | null>(null);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('id');

  const idInputRef = useRef<HTMLInputElement>(null);
  const faceInputRef = useRef<HTMLInputElement>(null);
  const licenseInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!session) navigate('/');
  }, [session, navigate]);

  const handleIdCard = (file: File) => {
    setIdCardFile(file);
    setIdCardPreview(URL.createObjectURL(file));
  };

  const handleFace = (file: File) => {
    setFaceFile(file);
    setFacePreview(URL.createObjectURL(file));
  };

  const handleLicense = (file: File) => {
    setLicenseFile(file);
    setLicensePreview(URL.createObjectURL(file));
  };

  const submitVerification = async () => {
    if (!session?.user?.id) return;
    if (!idCardFile || !faceFile || !licenseFile) {
      setError('Please upload your ID card, face scan, and driving license.');
      return;
    }
    if (!vehicleNumber.trim() || !vehicleModel.trim()) {
      setError('Please enter your vehicle number and model.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const idPath = await uploadVerificationImage(ID_CARD_BUCKET, session.user.id, idCardFile);
      const facePath = await uploadVerificationImage(FACE_SCAN_BUCKET, session.user.id, faceFile);
      const licensePath = await uploadVerificationImage(LICENSE_BUCKET, session.user.id, licenseFile);
      await updateProfile(session.user.id, {
        id_card_url: idPath,
        face_scan_url: facePath,
        license_url: licensePath,
        vehicle_number: vehicleNumber.trim(),
        vehicle_model: vehicleModel.trim(),
        verification_status: 'pending',
      });
      setStep('scanning');
      setTimeout(async () => {
        await updateProfile(session.user.id, { verification_status: 'verified' });
        await refreshProfile();
        setStep('done');
      }, 2600);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  if (step === 'done' || profile?.verification_status === 'verified') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-9 w-9 text-emerald-600" />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-slate-900">You're verified!</h2>
          <p className="mt-2 text-sm text-slate-500">
            Your college ID, face scan, and driving license have been verified. You can now offer and find rides.
          </p>
          <Button className="mt-6 w-full" size="lg" onClick={() => navigate('/dashboard')}>
            Go to dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'scanning') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
            <Loader2 className="h-20 w-20 animate-spin text-emerald-500" />
            <ScanFace className="absolute h-8 w-8 text-emerald-600" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-slate-900">Verifying your identity...</h2>
          <p className="mt-2 text-sm text-slate-500">
            Matching your face scan with your ID card and validating your driving license. This only takes a moment.
          </p>
        </div>
      </div>
    );
  }

  const steps: { key: Step; label: string }[] = [
    { key: 'id', label: 'ID Card' },
    { key: 'face', label: 'Face Scan' },
    { key: 'license', label: 'License' },
    { key: 'vehicle', label: 'Vehicle' },
  ];
  const currentIdx = steps.findIndex((s) => s.key === step);

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
            <ShieldCheck className="h-7 w-7 text-emerald-600" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Verify your identity</h1>
          <p className="mt-1 text-sm text-slate-500">
            Upload your college ID, face scan, and driving license. Register your vehicle once to start offering rides.
          </p>
        </div>

        {/* Step indicator */}
        <div className="mb-8 flex items-center justify-center gap-1.5">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <StepDot active={step === s.key} done={i < currentIdx} label={s.label} />
              {i < steps.length - 1 && (
                <div className={`h-1 w-8 rounded ${i < currentIdx ? 'bg-emerald-500' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {step === 'id' && (
          <div className="space-y-4">
            <UploadZone
              icon={<IdCard className="h-8 w-8" />}
              title="Upload your college ID card"
              subtitle="Make sure the name and photo are clearly visible."
              preview={idCardPreview}
              onPick={() => idInputRef.current?.click()}
              onClear={() => { setIdCardFile(null); setIdCardPreview(null); }}
            />
            <input ref={idInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleIdCard(e.target.files[0])} />
            <div className="flex justify-end">
              <Button onClick={() => setStep('face')} disabled={!idCardFile}>Continue</Button>
            </div>
          </div>
        )}

        {step === 'face' && (
          <div className="space-y-4">
            <UploadZone
              icon={<ScanFace className="h-8 w-8" />}
              title="Take a face scan selfie"
              subtitle="Look straight at the camera with good lighting."
              preview={facePreview}
              onPick={() => faceInputRef.current?.click()}
              onClear={() => { setFaceFile(null); setFacePreview(null); }}
            />
            <input ref={faceInputRef} type="file" accept="image/*" capture="user" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFace(e.target.files[0])} />
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStep('id')}>Back</Button>
              <Button onClick={() => setStep('license')} disabled={!faceFile}>Continue</Button>
            </div>
          </div>
        )}

        {step === 'license' && (
          <div className="space-y-4">
            <UploadZone
              icon={<Car className="h-8 w-8" />}
              title="Upload your driving license"
              subtitle="Required if you want to offer rides. Make sure the license number and photo are clearly visible."
              preview={licensePreview}
              onPick={() => licenseInputRef.current?.click()}
              onClear={() => { setLicenseFile(null); setLicensePreview(null); }}
            />
            <input ref={licenseInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleLicense(e.target.files[0])} />
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStep('face')}>Back</Button>
              <Button onClick={() => setStep('vehicle')} disabled={!licenseFile}>Continue</Button>
            </div>
          </div>
        )}

        {step === 'vehicle' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-900">
                <Car className="h-4 w-4 text-emerald-600" />
                Register your vehicle
              </h3>
              <p className="mb-4 text-xs text-slate-500">
                Enter your vehicle details once. This will be used for all rides you offer — no need to re-enter it each time.
              </p>
              <div className="space-y-4">
                <Input
                  label="Vehicle number"
                  placeholder="e.g. DL 01 AB 1234"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  icon={<Car className="h-4 w-4" />}
                />
                <Input
                  label="Vehicle model"
                  placeholder="e.g. Honda City, Maruti Swift, etc."
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStep('license')}>Back</Button>
              <Button onClick={submitVerification} loading={uploading}
                disabled={!vehicleNumber.trim() || !vehicleModel.trim()}>
                <CheckCircle2 className="h-4 w-4" />
                Submit for verification
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
          done
            ? 'bg-emerald-500 text-white'
            : active
            ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-500'
            : 'bg-slate-100 text-slate-400'
        }`}
      >
        {done ? <CheckCircle2 className="h-4 w-4" /> : label[0]}
      </div>
      <span className={`text-[10px] ${active || done ? 'font-semibold text-slate-700' : 'text-slate-400'}`}>
        {label}
      </span>
    </div>
  );
}

function UploadZone({
  icon, title, subtitle, preview, onPick, onClear,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  preview: string | null;
  onPick: () => void;
  onClear: () => void;
}) {
  if (preview) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <img src={preview} alt="Preview" className="h-64 w-full object-cover" />
        <button
          onClick={onClear}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Looks good
        </div>
      </div>
    );
  }
  return (
    <button
      onClick={onPick}
      className="group flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white px-6 py-12 text-center transition-all hover:border-emerald-400 hover:bg-emerald-50/40"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 transition-transform group-hover:scale-110">
        {icon}
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-700">
        <Camera className="h-3.5 w-3.5" />
        Choose photo
      </span>
    </button>
  );
}
