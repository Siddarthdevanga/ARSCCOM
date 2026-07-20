"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import PublicUnavailable from "../../components/PublicUnavailable";
import styles from "./style.module.css";

const API               = process.env.NEXT_PUBLIC_API_BASE_URL || "";
const FETCH_TIMEOUT_MS  = 15_000;
const UPLOAD_TIMEOUT_MS = 30_000;

/* ── Shared validators ── */
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com","guerrillamail.com","tempmail.com","throwam.com",
  "yopmail.com","sharklasers.com","guerrillamail.info","guerrillamail.biz",
  "guerrillamail.de","guerrillamail.net","guerrillamail.org","spam4.me",
  "trashmail.com","trashmail.me","trashmail.net","dispostable.com",
  "mailnull.com","spamgourmet.com","maildrop.cc","discard.email",
  "fakeinbox.com","mailnesia.com","spamfree24.org","mytrashmail.com",
  "tempr.email","10minutemail.com","10minutemail.net","minuteinbox.com",
  "throwaway.email","getnada.com","mailtemp.net","tempinbox.com",
]);

function nameError(v) {
  const s = v.trim();
  if (!s) return "Name is required";
  if (s.length < 2) return "Minimum 2 characters";
  if (/^\d+$/.test(s)) return "Cannot be numbers only";
  if (!/^[a-zA-Z\s\-'.]+$/.test(s)) return "Only letters, spaces and - . ' allowed";
  return "";
}

function emailError(v) {
  const s = v.trim().toLowerCase();
  if (!s) return "Email is required";
  if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(s)) return "Enter a valid email address";
  const domain = s.split("@")[1];
  if (DISPOSABLE_DOMAINS.has(domain)) return "Disposable email addresses are not allowed";
  return "";
}

function postalCodeError(v) {
  if (!v || !v.trim()) return "";
  if (!/^\d{6}$/.test(v.trim())) return "Enter a valid 6-digit PIN code";
  return "";
}

function idNumberError(idType, idNumber) {
  if (!idType || !idNumber.trim()) return "";
  const n = idNumber.trim().toUpperCase();
  if (idType === "aadhaar"         && !/^\d{12}$/.test(n))                    return "Aadhaar must be exactly 12 digits";
  if (idType === "pan"             && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(n)) return "PAN format: ABCDE1234F";
  if (idType === "passport"        && !/^[A-Z][0-9]{7}$/.test(n))             return "Passport format: A1234567";
  if (idType === "driving_license" && n.length < 8)                            return "Enter a valid driving license number";
  if (idType === "voter_id"        && !/^[A-Z]{3}[0-9]{7}$/.test(n))         return "Voter ID format: ABC1234567";
  return "";
}

const JUNK_WORDS = new Set([
  "test","testing","demo","sample","temp","dummy","abc","abcd","abcde",
  "xyz","xyzz","asd","asdf","asdfg","qwerty","qwer","zzz","xxx","yyy",
  "qqq","aaa","bbb","ccc","hello","hai","hi","ok","no","na","none",
  "null","undefined","random","blah","nope","nada","lol","foobar","foo","bar",
]);

function isJunk(v) {
  const s = v.trim().toLowerCase();
  if (JUNK_WORDS.has(s)) return true;
  if (/^(.)\1+$/.test(s)) return true;
  return false;
}

function fromCompanyError(v) {
  const s = v.trim();
  if (!s) return "";
  if (s.length < 2) return "Minimum 2 characters";
  if (/^\d+$/.test(s)) return "Cannot be numbers only";
  if (isJunk(s)) return "Enter a valid company name";
  if (!/^[a-zA-Z0-9\s\-'.&,]+$/.test(s)) return "Only letters, numbers, spaces and - ' . & , allowed";
  return "";
}

function deptDesigError(v, label) {
  const s = v.trim();
  if (!s) return "";
  if (s.length < 2) return "Minimum 2 characters";
  if (/^\d+$/.test(s)) return "Cannot be numbers only";
  if (isJunk(s)) return `Enter a valid ${label}`;
  if (!/^[a-zA-Z0-9\s\-'.&,/]+$/.test(s)) return `Only letters, numbers, spaces and - ' . & , / allowed`;
  return "";
}

function addressError(v) {
  const s = v.trim();
  if (!s) return "";
  if (s.length < 5) return "Minimum 5 characters";
  if (/^(.)\1+$/.test(s)) return "Enter a valid address";
  if (isJunk(s)) return "Enter a valid address";
  return "";
}

function cityStateCountryError(v, label) {
  const s = v.trim();
  if (!s) return "";
  if (s.length < 2) return "Minimum 2 characters";
  if (/^\d+$/.test(s)) return "Cannot be numbers only";
  if (isJunk(s)) return `Enter a valid ${label}`;
  if (!/^[a-zA-Z\s\-]+$/.test(s)) return "Only letters, spaces and - allowed";
  return "";
}

function purposeError(v) {
  const s = v.trim();
  if (!s) return "";
  if (s.length < 3) return "Minimum 3 characters";
  if (/^(.)\1+$/.test(s)) return "Enter a meaningful purpose of visit";
  if (isJunk(s)) return "Enter a meaningful purpose of visit";
  return "";
}

function InlineErr({ msg, show }) {
  if (!show || !msg) return null;
  return <p style={{ color:"#dc2626", fontSize:"0.72rem", fontWeight:700, marginTop:4, marginBottom:0, lineHeight:1.3 }}>{msg}</p>;
}

const publicFetch = async (url, options = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${API}${url}`, {
      ...options,
      signal: controller.signal,
      credentials: "omit",
    });
    clearTimeout(timer);
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok || (data && !data.success)) {
      throw new Error(data?.message || `Request failed (${res.status})`);
    }
    return data;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") throw new Error("Request timed out — please check your connection");
    throw err;
  }
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "GOOD MORNING";
  if (h < 17) return "GOOD AFTERNOON";
  return "GOOD EVENING";
};

/* ─────────────────────────────────────────────────────────────────
   EMPLOYEE AUTOCOMPLETE

   KEY FIX: This component must always be rendered OUTSIDE a CSS
   Grid container (gridRow). When position:relative is on a grid
   item, position:absolute children measure their offset from the
   grid container's coordinate origin — NOT from the item itself —
   causing the dropdown to appear ~1–2 rows above the input on
   mobile. Wrapping in a plain formGroup div solves this entirely.
───────────────────────────────────────────────────────────────── */
const EmployeeAutocomplete = ({ slug, value, employeeId, onChange, onSelect, disabled }) => {
  const [results,  setResults]  = useState([]);
  const [open,     setOpen]     = useState(false);
  const [fetching, setFetching] = useState(false);

  const debounceRef  = useRef(null);
  const containerRef = useRef(null);

  /* Close on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    setFetching(true);
    try {
      const res = await fetch(
        `${API}/api/public/visitor/${slug}/employees?q=${encodeURIComponent(q)}`,
        { credentials: "omit" }
      );
      if (!res.ok) { setResults([]); setOpen(true); return; }
      const data = await res.json();
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.employees) ? data.employees
        : Array.isArray(data?.data)      ? data.data
        : [];
      setResults(list);
      setOpen(true);
    } catch {
      setResults([]);
      setOpen(true);
    } finally {
      setFetching(false);
    }
  }, [slug]);

  const handleChange = (e) => {
    const val = e.target.value;
    onChange(val);
    if (employeeId) onSelect({ name: val, id: null });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 280);
  };

  const handleSelect = (emp) => {
    onSelect({ name: emp.name, id: emp.id });
    setOpen(false);
    setResults([]);
  };

  const handleFocus = () => {
    if (value.trim() && results.length > 0) setOpen(true);
  };

  const initials = (name) => {
    if (!name) return "?";
    const p = name.trim().split(" ");
    return (p.length >= 2 ? p[0][0] + p[1][0] : p[0][0]).toUpperCase();
  };

  const showDropdown = open && (results.length > 0 || (!fetching && value.trim()));

  return (
    /* acWrapper is position:relative — dropdown is position:absolute top:100%
       This ONLY works correctly when acWrapper is a plain block element,
       NOT a grid item. Always place this inside a formGroup, never inside gridRow. */
    <div ref={containerRef} className={styles.acWrapper}>
      <input
        className={`${styles.input} ${employeeId ? styles.acInputLinked : ""}`}
        type="text"
        name="personToMeet"
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        placeholder="Person to Meet *"
        disabled={disabled}
        autoComplete="off"
      />

      {fetching && <span className={styles.acSpinner} aria-hidden="true" />}

      {employeeId && !fetching && (
        <span className={styles.acLinkedTick} aria-label="Employee linked">✓</span>
      )}

      {showDropdown && (
        <div className={styles.acDropdown} role="listbox" aria-label="Employee suggestions">
          {results.length > 0 ? (
            results.map((emp) => (
              <div
                key={emp.id}
                className={styles.acItem}
                onMouseDown={() => handleSelect(emp)}
                role="option"
                aria-selected={employeeId === emp.id}
                tabIndex={-1}
              >
                <div className={styles.acAvatar} aria-hidden="true">{initials(emp.name)}</div>
                <div className={styles.acInfo}>
                  <div className={styles.acName}>{emp.name}</div>
                  {emp.department && <div className={styles.acDeptBadge}>{emp.department}</div>}
                </div>
                {employeeId === emp.id && (
                  <span className={styles.acTick} aria-label="Selected">✓</span>
                )}
              </div>
            ))
          ) : (
            <div className={styles.acEmpty} role="status">
              No employees matched — your entry will still be saved
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ─── Step Progress ─── */
const StepProgress = ({ currentStep }) => {
  if (currentStep === 0 || currentStep === 4) return null;
  const labels = ["Details", "Info", "Photo"];
  return (
    <div className={styles.stepProgress}>
      {labels.map((label, i) => {
        const stepNum = i + 1;
        const isActive = currentStep === stepNum;
        const isDone   = currentStep > stepNum;
        return (
          <div key={label} className={styles.stepItem}>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"3px" }}>
              <div className={`${styles.stepCircle} ${isDone ? styles.stepCircleDone : isActive ? styles.stepCircleActive : styles.stepCircleIdle}`}>
                {isDone ? "✓" : stepNum}
              </div>
              <span className={`${styles.stepLabel} ${isDone ? styles.stepLabelDone : isActive ? styles.stepLabelActive : styles.stepLabelIdle}`}>{label}</span>
            </div>
            {i < labels.length - 1 && (
              <div className={`${styles.stepConnector} ${isDone ? styles.stepConnectorDone : styles.stepConnectorIdle}`} />
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ─── Navbar ─── */
const Navbar = ({ company }) => (
  <header className={styles.header}>
    <div className={styles.headerLeft}>
      {company?.id && <img src={`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/logo/${company.id}`} alt={`${company.name} logo`} className={styles.logo} onError={e => { e.currentTarget.style.display = "none"; }} />}
      <span className={styles.logoText}>{company?.name}</span>
    </div>
    <span className={styles.headerBadge}>Visitor Registration</span>
  </header>
);

/* ─── Hero Banner ─── */
const HeroBanner = ({ company }) => (
  <div className={styles.heroBanner}>
    <div className={styles.heroBannerContent}>
      <div className={styles.heroBannerGreeting}>
        <span className={styles.heroBannerDot} />
        {getGreeting()}
      </div>
      <h2 className={styles.heroBannerTitle}>Welcome to <span>{company?.name}</span></h2>
      <p className={styles.heroBannerSub}>Verify your WhatsApp number to complete visitor registration</p>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════ */
export default function PublicVisitorRegistration() {
  const params = useParams();
  const router = useRouter();
  const slug   = params?.slug;

  const [step,        setStep]        = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [submitting,  setSubmitting]  = useState(false);
  const [company,     setCompany]     = useState(null);
  const [error,       setError]       = useState("");
  const [visitorCode, setVisitorCode] = useState("");

  const [phone,       setPhone]       = useState("");
  const [otp,         setOtp]         = useState("");
  const [otpSent,     setOtpSent]     = useState(false);
  const [otpToken,    setOtpToken]    = useState("");
  const [resendTimer, setResendTimer] = useState(0);

  const [formData, setFormData] = useState({
    name: "", email: "", fromCompany: "", department: "", designation: "",
    address: "", city: "", state: "", postalCode: "", country: "",
    personToMeet: "", purpose: "", belongings: [], idType: "", idNumber: "",
  });

  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [photo,        setPhoto]        = useState(null);
  const [photoBlob,    setPhotoBlob]    = useState(null);
  const [cameraActive, setCameraActive] = useState(false);

  const [touched,      setTouched]      = useState({});
  const [idTouched,    setIdTouched]    = useState(false);
  const [secTouched,   setSecTouched]   = useState({});

  const [returningData,       setReturningData]       = useState(null);
  const [showReturnPreview,   setShowReturnPreview]   = useState(false);
  const [returningPhotoKey,   setReturningPhotoKey]   = useState(null);
  const [showReturnMiniForm,  setShowReturnMiniForm]  = useState(false);
  const [returnPersonToMeet,  setReturnPersonToMeet]  = useState("");
  const [returnEmployeeId,    setReturnEmployeeId]    = useState(null);
  const [returnPurpose,       setReturnPurpose]       = useState("");
  const [returnBelongings,    setReturnBelongings]    = useState([]);
  const [returnMiniError,     setReturnMiniError]     = useState("");
  const [stream,       setStream]       = useState(null);

  const videoRef  = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      try {
        setLoading(true);
        const data = await publicFetch(`/api/public/visitor/${slug}/info`);
        setCompany(data.company);
      } catch (err) {
        setError(err.message || "Failed to load page");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const id = setTimeout(() => setResendTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [resendTimer]);

  useEffect(() => {
    if (cameraActive && stream && videoRef.current) {
      videoRef.current.srcObject   = stream;
      videoRef.current.muted       = true;
      videoRef.current.playsInline = true;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraActive, stream]);

  useEffect(() => {
    return () => { if (stream) stream.getTracks().forEach((t) => t.stop()); };
  }, [stream]);

  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [step]);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const toggleBelonging = useCallback((item) => {
    setFormData((prev) => ({
      ...prev,
      belongings: prev.belongings.includes(item)
        ? prev.belongings.filter((b) => b !== item)
        : [...prev.belongings, item],
    }));
  }, []);

  const goBack = useCallback(() => { setError(""); setStep((p) => Math.max(p - 1, 1)); }, []);

  const handleSendOTP = async () => {
    const trimmed = phone.trim().replace(/\D/g, "");
    if (!trimmed || trimmed.length !== 10) { setError("Valid 10-digit WhatsApp number required"); return; }
    if (!/^[6-9]/.test(trimmed)) { setError("Number must start with 6, 7, 8 or 9"); return; }
    try {
      setError(""); setSubmitting(true);
      const data = await publicFetch(`/api/public/visitor/${slug}/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: `91${trimmed}` }),
      });
      setPhone(trimmed); setOtpSent(true); setResendTimer(data.resendAfter || 30);
    } catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  const handleVerifyOTP = async () => {
    if (!otp.trim() || otp.length !== 6) { setError("Please enter the 6-digit code"); return; }
    try {
      setError(""); setSubmitting(true);
      const data = await publicFetch(`/api/public/visitor/${slug}/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: `91${phone}`, otp }),
      });
      setOtpToken(data.otpToken);

      // Check for returning visitor profile (same company, same phone)
      try {
        const returning = await publicFetch(`/api/public/visitor/${slug}/returning?phone=${phone}`);
        if (returning.found && returning.profile) {
          setReturningData(returning.profile);
          setShowReturnPreview(true);
        }
      } catch { /* first-time visitor — proceed normally */ }

      setStep(1);
    } catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  const startCamera = async () => {
    setError("");
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      setStream(mediaStream); setCameraActive(true);
    } catch { setError("Camera access denied. Please allow camera permissions."); }
  };

  const stopCamera = useCallback(() => {
    if (stream) { stream.getTracks().forEach((t) => t.stop()); setStream(null); }
    setCameraActive(false);
  }, [stream]);

  const capturePhoto = useCallback(() => {
    if (!canvasRef.current || !videoRef.current) return;
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    canvas.width = 400; canvas.height = 300;
    canvas.getContext("2d").drawImage(video, 0, 0, 400, 300);
    setPhoto(canvas.toDataURL("image/jpeg", 0.9));
    canvas.toBlob((blob) => setPhotoBlob(blob), "image/jpeg", 0.9);
    stopCamera();
  }, [stopCamera]);

  const retakePhoto = useCallback(() => {
    setPhoto(null); setPhotoBlob(null);
    canvasRef.current?.getContext("2d").clearRect(0, 0, 400, 300);
  }, []);

  const validateStep = useCallback(() => {
    setError("");
    if (step === 1) {
      setTouched({ name: true, email: true });
      const nErr = nameError(formData.name);
      const eErr = emailError(formData.email);
      if (nErr) { setError(nErr); return false; }
      if (eErr) { setError(eErr); return false; }
    }
    if (step === 2) {
      if (!formData.personToMeet.trim()) { setError("Person to meet is required"); return false; }
      const secFields = ["fromCompany","department","designation","address","city","state","postalCode","country","purpose"];
      const allTouched = {};
      secFields.forEach(f => { allTouched[f] = true; });
      setSecTouched(allTouched);
      const secErrors = {
        fromCompany: fromCompanyError(formData.fromCompany),
        department:  deptDesigError(formData.department, "department"),
        designation: deptDesigError(formData.designation, "designation"),
        address:     addressError(formData.address),
        city:        cityStateCountryError(formData.city, "city"),
        state:       cityStateCountryError(formData.state, "state"),
        postalCode:  postalCodeError(formData.postalCode),
        country:     cityStateCountryError(formData.country, "country"),
        purpose:     purposeError(formData.purpose),
      };
      const firstErr = secFields.map(f => secErrors[f]).find(Boolean);
      if (firstErr) { setError(firstErr); return false; }
    }
    if (step === 3) {
      if (!photo && !returningPhotoKey) { setError("Visitor photo is required"); return false; }
      const idErr = idNumberError(formData.idType, formData.idNumber);
      if (idErr) { setIdTouched(true); setError(idErr); return false; }
    }
    return true;
  }, [step, formData, photo, returningPhotoKey]);

  const handleNext   = useCallback(() => { if (validateStep()) { setError(""); setStep((p) => p + 1); } }, [validateStep]);

  const handleSubmit = async () => {
    if (!validateStep()) return;
    try {
      setSubmitting(true); setError("");
      const fd = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        fd.append(key, key === "belongings" ? (Array.isArray(value) ? value.join(", ") : "") : value || "");
      });
      fd.append("phone", `91${phone}`);  // Add phone from OTP verification (with 91 prefix)
      if (photoBlob) {
        fd.append("photo", new File([photoBlob], "visitor.jpg", { type: "image/jpeg" }));
      } else if (returningPhotoKey) {
        fd.append("existingPhotoKey", returningPhotoKey);
      }
      if (selectedEmployeeId) fd.append("employeeId", String(selectedEmployeeId));

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
      let data;
      try {
        const res = await fetch(`${API}/api/public/visitor/${slug}/register`, {
          method: "POST", headers: { "otp-token": otpToken },
          body: fd, credentials: "omit", signal: controller.signal,
        });
        clearTimeout(timer);
        data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || "Registration failed.");
      } catch (err) {
        clearTimeout(timer);
        if (err.name === "AbortError") throw new Error("Upload timed out — please retry");
        throw err;
      }
      setVisitorCode(data.visitorCode); setStep(4);
    } catch (err) { setError(err.message || "Failed to register. Please try again."); }
    finally { setSubmitting(false); }
  };

  const handleReturningSubmit = async () => {
    if (!returnPersonToMeet.trim()) { setReturnMiniError("Person to Meet is required"); return; }
    setReturnMiniError(""); setSubmitting(true);
    try {
      const fd = new FormData();
      const r  = returningData;
      fd.append("name",        r.name        || "");
      fd.append("phone",       `91${phone}`);
      fd.append("email",       r.email       || "");
      fd.append("fromCompany", r.fromCompany || "");
      fd.append("department",  r.department  || "");
      fd.append("designation", r.designation || "");
      fd.append("address",     r.address     || "");
      fd.append("city",        r.city        || "");
      fd.append("state",       r.state       || "");
      fd.append("postalCode",  r.postalCode  || "");
      fd.append("country",     r.country     || "");
      fd.append("idType",      r.idType      || "");
      fd.append("idNumber",    r.idNumber    || "");
      fd.append("personToMeet", returnPersonToMeet.trim());
      if (returnPurpose.trim()) fd.append("purpose", returnPurpose.trim());
      if (returnBelongings.length) fd.append("belongings", returnBelongings.join(", "));
      if (returnEmployeeId) fd.append("employeeId", String(returnEmployeeId));
      if (r.photoKey) fd.append("existingPhotoKey", r.photoKey);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
      let data;
      try {
        const res = await fetch(`${API}/api/public/visitor/${slug}/register`, {
          method: "POST", headers: { "otp-token": otpToken },
          body: fd, credentials: "omit", signal: controller.signal,
        });
        clearTimeout(timer);
        data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || "Registration failed.");
      } catch (err) {
        clearTimeout(timer);
        if (err.name === "AbortError") throw new Error("Request timed out — please retry");
        throw err;
      }
      setVisitorCode(data.visitorCode); setStep(4);
    } catch (err) { setReturnMiniError(err.message || "Failed to register. Please try again."); }
    finally { setSubmitting(false); }
  };

  const handleReset = useCallback(() => {
    if (stream) { stream.getTracks().forEach((t) => t.stop()); setStream(null); setCameraActive(false); }
    canvasRef.current?.getContext("2d").clearRect(0, 0, 400, 300);
    setStep(0); setPhone(""); setOtp(""); setOtpSent(false); setOtpToken(""); setResendTimer(0);
    setFormData({ name:"", email:"", fromCompany:"", department:"", designation:"",
      address:"", city:"", state:"", postalCode:"", country:"",
      personToMeet:"", purpose:"", belongings:[], idType:"", idNumber:"" });
    setSelectedEmployeeId(null); setPhoto(null); setPhotoBlob(null); setVisitorCode(""); setError("");
    setReturningData(null); setShowReturnPreview(false); setReturningPhotoKey(null);
    setShowReturnMiniForm(false); setReturnPersonToMeet(""); setReturnEmployeeId(null);
    setReturnPurpose(""); setReturnBelongings([]); setReturnMiniError("");
  }, [stream]);

  if (loading) return <div className={styles.loadingContainer}><div className={styles.spinner} /></div>;

  if (!company) return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.authCard}>
          <div className={styles.authHeader}>
            <h2>⚠️ {error ? "Error" : "Not Found"}</h2>
            <p>{error || "This registration link is invalid or has expired."}</p>
          </div>
          <button className={styles.primaryBtn} onClick={() => router.push("/")}>Go Home</button>
        </div>
      </div>
    </div>
  );

  if (company.serviceUnavailable) return (
    <div className={styles.page}>
      <Navbar company={company} />
      <PublicUnavailable
        title="Registration Temporarily Unavailable"
        subtitle="This organization's visitor registration system is currently inactive. Please contact the admin directly to arrange your visit."
      />
    </div>
  );

  return (
    <div className={styles.page}>

      {/* ── STEP 0: WHATSAPP OTP ── */}
      {step === 0 && (
        <>
          <Navbar company={company} />
          <HeroBanner company={company} />
          <div className={styles.container}>
            <div className={styles.authCard}>
              <p style={{ textAlign:"center", color:"#6b7280", fontSize:"0.9rem", marginBottom:"1.25rem", lineHeight:1.6 }}>
                Enter your WhatsApp number to receive a verification code
              </p>
              {error && <div className={styles.errorMsg}>{error}</div>}
              {!otpSent ? (
                <>
                  <div className={styles.formGroup}>
                    <label htmlFor="phone">WhatsApp Number *</label>
                    <div style={{ display:"flex", gap:"0.5rem", alignItems:"center" }}>
                      <div style={{ padding:"0.75rem 1rem", background:"#f3f4f6", border:"1px solid #d1d5db", borderRadius:"0.5rem", fontWeight:"600", color:"#374151", fontSize:"0.95rem" }}>
                        +91
                      </div>
                      <input id="phone" className={styles.input} type="tel" inputMode="tel" value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g,"").slice(0,10))}
                        onKeyDown={(e) => e.key === "Enter" && !submitting && handleSendOTP()}
                        placeholder="WhatsApp Number" maxLength={10} disabled={submitting}
                        autoComplete="tel" style={{ flex:1 }} />
                    </div>
                    <p style={{ fontSize:"0.8rem", color:"#6b7280", marginTop:"0.25rem" }}>
                      Enter 10-digit mobile number
                    </p>
                  </div>
                  <button className={styles.primaryBtn} onClick={handleSendOTP} disabled={submitting || phone.replace(/\D/g,"").length !== 10}>
                    {submitting ? "Sending…" : "Send Verification Code"}
                  </button>
                </>
              ) : (
                <>
                  <div className={styles.formGroup}>
                    <label htmlFor="otp">6-Digit Verification Code</label>
                    <input id="otp" className={styles.input} type="text" inputMode="numeric"
                      value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g,"").slice(0,6))}
                      onKeyDown={(e) => e.key === "Enter" && otp.length === 6 && !submitting && handleVerifyOTP()}
                      placeholder="123456" maxLength={6} disabled={submitting} autoComplete="one-time-code"
                      style={{ letterSpacing:"8px", fontSize:"1.25rem", textAlign:"center", fontWeight:"700" }} />
                  </div>
                  <button className={styles.primaryBtn} onClick={handleVerifyOTP} disabled={submitting || otp.length !== 6}>
                    {submitting ? "Verifying…" : "Verify Code"}
                  </button>
                  <button className={styles.secondaryBtn} onClick={handleSendOTP} disabled={resendTimer > 0 || submitting}>
                    {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend Code"}
                  </button>
                  <p style={{ textAlign:"center", marginTop:"1rem", fontSize:"0.875rem", color:"#6b7280" }}>
                    Code sent to WhatsApp: <strong style={{ color:"#1e1b4b" }}>+91 {phone}</strong><br />
                    <button onClick={() => { setOtpSent(false); setOtp(""); setError(""); }}
                      style={{ color:"#7c3aed", cursor:"pointer", textDecoration:"underline",
                        fontSize:"0.825rem", background:"none", border:"none", padding:0, marginTop:"0.5rem" }}>
                      Change number
                    </button>
                  </p>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── STEP 1: RETURNING VISITOR PREVIEW ── */}
      {step === 1 && showReturnPreview && returningData && (
        <>
          <Navbar company={company} />
          <div className={styles.container}>
            <main className={styles.card} style={{ border:"1px solid #e5e7eb" }}>
              <h2 className={styles.title}>Welcome back</h2>
              <p style={{ color:"#6b7280", fontSize:"0.9rem", marginBottom:"1.25rem", textAlign:"center", lineHeight:1.6 }}>
                We found your details from a previous visit to {company?.name}.
              </p>

              {/* Photo */}
              <div style={{ display:"flex", justifyContent:"center", marginBottom:"1.25rem" }}>
                {returningData.photoUrl
                  ? <img src={returningData.photoUrl} alt="Your photo"
                      style={{ width:80, height:80, borderRadius:"50%", objectFit:"cover",
                        border:"3px solid #7c3aed", boxShadow:"0 2px 8px rgba(124,58,237,0.2)" }} />
                  : <div style={{ width:80, height:80, borderRadius:"50%", background:"#f3f4f6",
                      border:"3px solid #e5e7eb", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                      </svg>
                    </div>
                }
              </div>

              {/* All fields grid — nulls shown greyed */}
              {(() => {
                const r = returningData;
                const sections = [
                  { label:"Primary", fields:[
                    { k:"Name",        v: r.name },
                    { k:"Email",       v: r.email },
                    { k:"Phone",       v: phone ? `+91 ${phone}` : null },
                  ]},
                  { label:"Organisation", fields:[
                    { k:"Company",     v: r.fromCompany },
                    { k:"Department",  v: r.department },
                    { k:"Designation", v: r.designation },
                    { k:"Address",     v: r.address },
                    { k:"City",        v: r.city },
                    { k:"State",       v: r.state },
                    { k:"Postal Code", v: r.postalCode },
                    { k:"Country",     v: r.country },
                  ]},
                  { label:"Identity", fields:[
                    { k:"ID Type",     v: r.idType },
                    { k:"ID Number",   v: r.idNumber },
                  ]},
                ];
                return sections.map(sec => (
                  <div key={sec.label} style={{ marginBottom:"1rem" }}>
                    <div style={{ fontSize:"0.7rem", fontWeight:700, textTransform:"uppercase",
                      letterSpacing:"0.8px", color:"#7c3aed", marginBottom:"0.5rem" }}>{sec.label}</div>
                    <div style={{ border:"1px solid #e5e7eb", borderRadius:"0.6rem", overflow:"hidden" }}>
                      {sec.fields.map(({ k, v }, i) => (
                        <div key={k} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                          padding:"0.5rem 0.75rem", fontSize:"0.82rem",
                          borderTop: i > 0 ? "1px solid #f3f4f6" : "none",
                          background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                          <span style={{ color:"#6b7280", fontWeight:500, minWidth:90 }}>{k}</span>
                          <span style={{ color: v ? "#1f2937" : "#d1d5db", fontStyle: v ? "normal" : "italic",
                            textAlign:"right", maxWidth:"60%", wordBreak:"break-word" }}>
                            {v || "Not provided"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}

              {/* Action buttons — shown only before mini form is revealed */}
              {!showReturnMiniForm && (
                <div style={{ display:"flex", gap:"0.75rem", marginTop:"0.5rem" }}>
                  <button className={styles.secondaryBtn} style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:"0.4rem" }}
                    onClick={() => {
                      setFormData(prev => ({ ...prev,
                        name: returningData.name, email: returningData.email,
                        fromCompany: returningData.fromCompany, department: returningData.department,
                        designation: returningData.designation, address: returningData.address,
                        city: returningData.city, state: returningData.state,
                        postalCode: returningData.postalCode, country: returningData.country,
                        idType: returningData.idType, idNumber: returningData.idNumber,
                      }));
                      if (returningData.photoKey) setReturningPhotoKey(returningData.photoKey);
                      setShowReturnPreview(false);
                    }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Edit Details
                  </button>
                  <button className={styles.primaryBtn} style={{ flex:2, display:"flex", alignItems:"center", justifyContent:"center", gap:"0.4rem" }}
                    onClick={() => setShowReturnMiniForm(true)}>
                    Confirm & Continue
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </button>
                </div>
              )}

              {/* Inline mini form — visit-specific fields */}
              {showReturnMiniForm && (
                <div style={{ marginTop:"1rem", borderTop:"1px solid #e5e7eb", paddingTop:"1rem" }}>
                  <div style={{ fontSize:"0.68rem", fontWeight:700, textTransform:"uppercase",
                    letterSpacing:"0.8px", color:"#374151", marginBottom:"0.75rem" }}>Visit Details</div>

                  {returnMiniError && (
                    <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:"0.5rem",
                      padding:"0.5rem 0.75rem", fontSize:"0.82rem", color:"#b91c1c", marginBottom:"0.75rem" }}>
                      {returnMiniError}
                    </div>
                  )}

                  <div className={styles.formGroup}>
                    <label>Person to Meet *</label>
                    <EmployeeAutocomplete
                      slug={slug}
                      value={returnPersonToMeet}
                      employeeId={returnEmployeeId}
                      onChange={(val) => { setReturnPersonToMeet(val); setReturnMiniError(""); }}
                      onSelect={({ name, id }) => { setReturnPersonToMeet(name); setReturnEmployeeId(id); setReturnMiniError(""); }}
                      disabled={submitting}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Purpose of Visit</label>
                    <input className={styles.input} value={returnPurpose}
                      onChange={(e) => setReturnPurpose(e.target.value)}
                      placeholder="Meeting / Interview / Delivery…" disabled={submitting} />
                  </div>

                  <div className={styles.formGroup}>
                    <label>Belongings</label>
                    <div className={styles.checkboxGroup}>
                      {["Laptop", "Bag", "Documents", "Mobile", "Camera", "Other"].map(item => (
                        <label key={item} className={styles.checkboxLabel}>
                          <input type="checkbox"
                            checked={returnBelongings.includes(item)}
                            onChange={() => setReturnBelongings(prev =>
                              prev.includes(item) ? prev.filter(b => b !== item) : [...prev, item]
                            )} />
                          {item}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div style={{ display:"flex", gap:"0.75rem" }}>
                    <button className={styles.secondaryBtn} style={{ flex:1 }}
                      onClick={() => { setShowReturnMiniForm(false); setReturnMiniError(""); }}
                      disabled={submitting}>
                      Back
                    </button>
                    <button className={styles.primaryBtn} style={{ flex:2, display:"flex", alignItems:"center", justifyContent:"center", gap:"0.4rem" }}
                      onClick={handleReturningSubmit} disabled={submitting}>
                      {submitting ? "Please wait…" : (
                        <>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          Get Visitor Pass
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </main>
          </div>
        </>
      )}

      {/* ── STEP 1: PRIMARY (new visitor or after editing) ── */}
      {step === 1 && !showReturnPreview && (
        <>
          <Navbar company={company} />
          <div className={styles.container}>
            <StepProgress currentStep={step} />
            <main className={styles.card}>
              <h2 className={styles.title}>Primary Details</h2>
              {error && <div className={styles.errorMsg}>{error}</div>}
              <div className={styles.formGroup}>
                <label htmlFor="name">Full Name *</label>
                <input id="name" className={styles.input} type="text" name="name"
                  value={formData.name} onChange={handleInputChange}
                  onBlur={() => setTouched(p => ({ ...p, name: true }))}
                  style={{ borderColor: touched.name && nameError(formData.name) ? "#dc2626" : undefined }}
                  placeholder="Enter your full name" autoComplete="name" />
                <InlineErr msg={nameError(formData.name)} show={touched.name} />
              </div>
              <div className={styles.formGroup}>
                <label>WhatsApp Number (Verified ✓)</label>
                <div style={{ display:"flex", gap:"0.5rem", alignItems:"center" }}>
                  <div style={{ padding:"0.75rem 1rem", background:"#f3f4f6", border:"1px solid #d1d5db", borderRadius:"0.5rem", fontWeight:"600", color:"#374151", fontSize:"0.95rem" }}>
                    +91
                  </div>
                  <input className={styles.input} type="tel" value={phone} disabled readOnly style={{ flex:1, background:"#f9fafb" }} />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="email">Email Address *</label>
                <input id="email" className={styles.input} type="email" name="email"
                  value={formData.email} onChange={handleInputChange}
                  onBlur={() => setTouched(p => ({ ...p, email: true }))}
                  style={{ borderColor: touched.email && emailError(formData.email) ? "#dc2626" : undefined }}
                  placeholder="your.email@example.com" autoComplete="email" autoCapitalize="none" />
                <InlineErr msg={emailError(formData.email)} show={touched.email} />
              </div>
              <button className={styles.primaryBtn} onClick={handleNext}>Next →</button>
            </main>
          </div>
        </>
      )}

      {/* ── STEP 2: SECONDARY ── */}
      {step === 2 && (
        <>
          <Navbar company={company} />
          <div className={styles.container}>
            <StepProgress currentStep={step} />
            <main className={styles.card}>
              <h2 className={styles.title}>Secondary Details</h2>
              {error && <div className={styles.errorMsg}>{error}</div>}

              {/* Org fields — 3-col grid */}
              <div className={styles.gridRow}>
                <div>
                  <input className={styles.input} name="fromCompany"
                    value={formData.fromCompany} onChange={handleInputChange}
                    onBlur={() => setSecTouched(p => ({ ...p, fromCompany: true }))}
                    style={{ borderColor: secTouched.fromCompany && fromCompanyError(formData.fromCompany) ? "#dc2626" : undefined }}
                    placeholder="From Company" autoComplete="organization" />
                  <InlineErr msg={fromCompanyError(formData.fromCompany)} show={secTouched.fromCompany} />
                </div>
                <div>
                  <input className={styles.input} name="department"
                    value={formData.department} onChange={handleInputChange}
                    onBlur={() => setSecTouched(p => ({ ...p, department: true }))}
                    style={{ borderColor: secTouched.department && deptDesigError(formData.department, "department") ? "#dc2626" : undefined }}
                    placeholder="Department" />
                  <InlineErr msg={deptDesigError(formData.department, "department")} show={secTouched.department} />
                </div>
                <div>
                  <input className={styles.input} name="designation"
                    value={formData.designation} onChange={handleInputChange}
                    onBlur={() => setSecTouched(p => ({ ...p, designation: true }))}
                    style={{ borderColor: secTouched.designation && deptDesigError(formData.designation, "designation") ? "#dc2626" : undefined }}
                    placeholder="Designation" />
                  <InlineErr msg={deptDesigError(formData.designation, "designation")} show={secTouched.designation} />
                </div>
              </div>

              {/* Address */}
              <div className={styles.formGroup}>
                <input className={styles.input} name="address"
                  value={formData.address} onChange={handleInputChange}
                  onBlur={() => setSecTouched(p => ({ ...p, address: true }))}
                  style={{ borderColor: secTouched.address && addressError(formData.address) ? "#dc2626" : undefined }}
                  placeholder="Organization Address" autoComplete="street-address" />
                <InlineErr msg={addressError(formData.address)} show={secTouched.address} />
              </div>

              {/* Address details — city/state inline, postal code standalone for inline error */}
              <div className={styles.gridRow}>
                <div>
                  <input className={styles.input} name="city"
                    value={formData.city} onChange={handleInputChange}
                    onBlur={() => setSecTouched(p => ({ ...p, city: true }))}
                    style={{ borderColor: secTouched.city && cityStateCountryError(formData.city, "city") ? "#dc2626" : undefined }}
                    placeholder="City" autoComplete="address-level2" />
                  <InlineErr msg={cityStateCountryError(formData.city, "city")} show={secTouched.city} />
                </div>
                <div>
                  <input className={styles.input} name="state"
                    value={formData.state} onChange={handleInputChange}
                    onBlur={() => setSecTouched(p => ({ ...p, state: true }))}
                    style={{ borderColor: secTouched.state && cityStateCountryError(formData.state, "state") ? "#dc2626" : undefined }}
                    placeholder="State" autoComplete="address-level1" />
                  <InlineErr msg={cityStateCountryError(formData.state, "state")} show={secTouched.state} />
                </div>
              </div>
              <div className={styles.formGroup}>
                <input className={styles.input} name="postalCode"
                  value={formData.postalCode}
                  onChange={(e) => setFormData(p => ({ ...p, postalCode: e.target.value.replace(/\D/g,"").slice(0,6) }))}
                  onBlur={() => setSecTouched(p => ({ ...p, postalCode: true }))}
                  style={{ borderColor: secTouched.postalCode && postalCodeError(formData.postalCode) ? "#dc2626" : undefined }}
                  placeholder="6-digit PIN code" inputMode="numeric" maxLength={6} />
                <InlineErr msg={postalCodeError(formData.postalCode)} show={secTouched.postalCode} />
              </div>

              {/* Country — standalone */}
              <div className={styles.formGroup}>
                <input className={styles.input} name="country"
                  value={formData.country} onChange={handleInputChange}
                  onBlur={() => setSecTouched(p => ({ ...p, country: true }))}
                  style={{ borderColor: secTouched.country && cityStateCountryError(formData.country, "country") ? "#dc2626" : undefined }}
                  placeholder="Country" autoComplete="country-name" />
                <InlineErr msg={cityStateCountryError(formData.country, "country")} show={secTouched.country} />
              </div>

              {/*
                CRITICAL: EmployeeAutocomplete is in its OWN formGroup,
                NOT inside a gridRow. The position:absolute dropdown
                only positions correctly relative to a plain block element.
                Placing it inside a CSS Grid item causes the dropdown to
                appear in the wrong position (above the input on mobile).
              */}
              <div className={styles.formGroup}>
                <label>Person to Meet *</label>
                <EmployeeAutocomplete
                  slug={slug}
                  value={formData.personToMeet}
                  employeeId={selectedEmployeeId}
                  onChange={(val) => setFormData((p) => ({ ...p, personToMeet: val }))}
                  onSelect={({ name, id }) => {
                    setFormData((p) => ({ ...p, personToMeet: name }));
                    setSelectedEmployeeId(id);
                  }}
                  disabled={submitting}
                />
              </div>

              {/* Purpose — standalone */}
              <div className={styles.formGroup}>
                <input className={styles.input} name="purpose"
                  value={formData.purpose} onChange={handleInputChange}
                  onBlur={() => setSecTouched(p => ({ ...p, purpose: true }))}
                  style={{ borderColor: secTouched.purpose && purposeError(formData.purpose) ? "#dc2626" : undefined }}
                  placeholder="Purpose of Visit" />
                <InlineErr msg={purposeError(formData.purpose)} show={secTouched.purpose} />
              </div>

              {/* Belongings */}
              <div className={styles.checkboxGroup}>
                {["Laptop", "Bag", "Documents", "Mobile", "Camera", "Other"].map((item) => (
                  <label key={item} className={styles.checkboxLabel}>
                    <input type="checkbox" checked={formData.belongings.includes(item)} onChange={() => toggleBelonging(item)} />
                    {item}
                  </label>
                ))}
              </div>

              <div style={{ display:"flex", gap:"0.75rem", marginTop:"1rem" }}>
                <button className={styles.secondaryBtn} onClick={goBack} style={{ flex:1 }}>← Back</button>
                <button className={styles.primaryBtn} onClick={handleNext} style={{ flex:2 }}>Next →</button>
              </div>
            </main>
          </div>
        </>
      )}

      {/* ── STEP 3: PHOTO + ID ── */}
      {step === 3 && (
        <>
          <Navbar company={company} />
          <div className={styles.container}>
            <StepProgress currentStep={step} />
            <main className={styles.card}>
              <h2 className={styles.title}>Identity Verification</h2>
              {error && <div className={styles.errorMsg}>{error}</div>}
              <div className={styles.cameraContainer}>
                {/* Returning visitor: show saved photo as default option */}
                {!cameraActive && !photo && returningPhotoKey && returningData?.photoUrl && (
                  <div style={{ textAlign:"center" }}>
                    <p style={{ color:"#6b7280", fontSize:"0.85rem", marginBottom:"0.75rem" }}>Photo from your last visit:</p>
                    <img src={returningData.photoUrl} alt="Previous photo"
                      style={{ width:"100%", maxWidth:"280px", borderRadius:"0.75rem", boxShadow:"0 4px 12px rgba(0,0,0,0.1)", marginBottom:"0.75rem" }} />
                    <div style={{ display:"flex", gap:"0.75rem", justifyContent:"center" }}>
                      <button type="button" className={styles.primaryBtn} style={{ flex:1, maxWidth:160, display:"flex", alignItems:"center", justifyContent:"center", gap:"0.35rem" }}
                        onClick={() => setPhoto(returningData.photoUrl)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        Use This Photo
                      </button>
                      <button type="button" className={styles.secondaryBtn} style={{ flex:1, maxWidth:160, display:"flex", alignItems:"center", justifyContent:"center", gap:"0.35rem" }}
                        onClick={() => { setReturningPhotoKey(null); startCamera(); }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        Take New
                      </button>
                    </div>
                  </div>
                )}
                {!cameraActive && !photo && !returningPhotoKey && (
                  <button type="button" className={styles.primaryBtn} onClick={startCamera} style={{ maxWidth:"300px", display:"flex", alignItems:"center", gap:"0.4rem" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    Start Camera
                  </button>
                )}
                {cameraActive && (
                  <>
                    <video ref={videoRef} autoPlay playsInline muted
                      style={{ width:"100%", maxWidth:"400px", borderRadius:"0.75rem", boxShadow:"0 4px 12px rgba(0,0,0,0.1)" }} />
                    <button type="button" className={styles.primaryBtn} onClick={capturePhoto} style={{ maxWidth:"300px", display:"flex", alignItems:"center", gap:"0.4rem" }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                      Capture Photo
                    </button>
                  </>
                )}
                {photo && (
                  <>
                    <img src={photo} alt="Captured"
                      style={{ width:"100%", maxWidth:"400px", borderRadius:"0.75rem", boxShadow:"0 4px 12px rgba(0,0,0,0.1)" }} />
                    <button type="button" className={styles.secondaryBtn} onClick={retakePhoto} style={{ maxWidth:"300px", marginTop:0, display:"flex", alignItems:"center", gap:"0.4rem" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
                      Retake
                    </button>
                  </>
                )}
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="idType">ID Proof Type</label>
                <select id="idType" className={styles.select} name="idType" value={formData.idType} onChange={handleInputChange}>
                  <option value="">Select ID Proof (Optional)</option>
                  <option value="aadhaar">Aadhaar</option>
                  <option value="pan">PAN Card</option>
                  <option value="passport">Passport</option>
                  <option value="driving_license">Driving License</option>
                  <option value="voter_id">Voter ID</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="idNumber">ID Number</label>
                <input id="idNumber" className={styles.input} name="idNumber"
                  value={formData.idNumber}
                  onChange={(e) => { handleInputChange(e); setIdTouched(false); }}
                  onBlur={() => setIdTouched(true)}
                  style={{ borderColor: idTouched && idNumberError(formData.idType, formData.idNumber) ? "#dc2626" : undefined }}
                  placeholder="ID Number (Optional)" />
                <InlineErr msg={idNumberError(formData.idType, formData.idNumber)} show={idTouched} />
              </div>
              <canvas ref={canvasRef} style={{ display:"none" }} aria-hidden="true" />
              <div style={{ display:"flex", gap:"0.75rem", marginTop:"1rem" }}>
                <button className={styles.secondaryBtn} onClick={goBack} style={{ flex:1 }} disabled={submitting}>← Back</button>
                <button className={styles.primaryBtn} onClick={handleSubmit} disabled={(!photo && !returningPhotoKey) || submitting} style={{ flex:2 }}>
                  {submitting ? "Submitting…" : "✓ Submit"}
                </button>
              </div>
            </main>
          </div>
        </>
      )}

      {/* ── STEP 4: SUCCESS ── */}
      {step === 4 && (
        <>
          <Navbar company={company} />
          <div className={styles.container}>
            <div className={styles.authCard}>
              <div className={styles.textCenter}>
                <div style={{ fontSize:"4rem", marginBottom:"1rem", color:"#16a34a" }}>✓</div>
                <h2 style={{ color:"#16a34a", marginBottom:"1rem", fontSize:"clamp(1.5rem,3.5vw,2rem)", fontWeight:800 }}>
                  Registration Successful!
                </h2>
                <p style={{ fontSize:"clamp(0.875rem,2vw,1rem)", color:"#6b7280", marginBottom:"2rem", lineHeight:1.6 }}>
                  Your visitor pass has been sent to your WhatsApp.
                </p>
                <div className={styles.successMsg}>
                  <p style={{ margin:0, fontSize:"0.875rem", fontWeight:600, color:"#166534" }}>Visitor ID</p>
                  <p style={{ margin:"0.5rem 0 0 0", fontSize:"clamp(1.5rem,3.5vw,2rem)", fontWeight:800, color:"#7c3aed", letterSpacing:"2px" }}>
                    {visitorCode}
                  </p>
                </div>
                <p style={{ fontSize:"clamp(0.825rem,1.8vw,0.925rem)", color:"#9ca3af", lineHeight:1.6, marginBottom:"2rem" }}>
                  Please show this ID at the reception.<br />
                  Check your WhatsApp <strong style={{ color:"#4b5563" }}>(+91 {phone})</strong> for the digital pass.
                </p>
                {company?.whatsapp_url?.trim() && (
                  <div className={styles.whatsappSection}>
                    <div className={styles.whatsappHeader}>
                      <div className={styles.whatsappIcon}>📱</div>
                      <div>
                        <h3 className={styles.whatsappTitle}>Stay Connected</h3>
                        <p className={styles.whatsappSubtitle}>Contact on WhatsApp</p>
                      </div>
                    </div>
                    <button onClick={() => window.open(company.whatsapp_url, "_blank", "noopener,noreferrer")}
                      className={styles.whatsappBtn} type="button">
                      <span style={{ fontSize:"1.25rem" }}>💬</span> Contact on WhatsApp
                    </button>
                  </div>
                )}
                <button className={styles.primaryBtn} onClick={handleReset} type="button">✓ Done</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
