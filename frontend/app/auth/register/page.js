"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./style.module.css";

export default function RegisterPage() {
  const router = useRouter();

  /* ======================================================
     FORM STATE
  ====================================================== */
  const [formData, setFormData] = useState({
    companyName: "",
    email: "",
    phone: "",
    conferenceRooms: "",
    whatsappUrl: "",
    password: "",
    confirmPassword: "",
  });

  const [logo, setLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    "https://www.wheelbrand.in";

  /* ======================================================
     DYNAMIC INPUT HANDLER
  ====================================================== */
  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    
    // Clear errors on input change
    if (error) setError("");
  };

  /* ======================================================
     LOGO HANDLER WITH PREVIEW
  ====================================================== */
  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    
    if (!file) {
      setLogo(null);
      setLogoPreview(null);
      return;
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setError("Logo must be JPG, PNG, or WEBP format");
      e.target.value = "";
      return;
    }

    // Validate file size (3MB)
    if (file.size > 3 * 1024 * 1024) {
      setError("Logo file must be less than 3MB");
      e.target.value = "";
      return;
    }

    setLogo(file);

    // Generate preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result);
    };
    reader.readAsDataURL(file);

    if (error) setError("");
  };

  /* ======================================================
     VALIDATION HELPER
  ====================================================== */
  const validateForm = () => {
    const {
      companyName,
      email,
      phone,
      conferenceRooms,
      whatsappUrl,
      password,
      confirmPassword,
    } = formData;

    // Required fields
    if (!companyName?.trim()) {
      setError("Company name is required");
      return false;
    }

    // Email validation
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError("Enter a valid email address");
      return false;
    }

    // Phone validation
    if (!phone?.trim() || phone.trim().length < 8) {
      setError("Enter a valid phone number (minimum 8 digits)");
      return false;
    }

    // Conference rooms validation
    const roomCount = Number(conferenceRooms);
    if (!roomCount || roomCount < 1 || roomCount > 100) {
      setError("Conference rooms must be between 1 and 100");
      return false;
    }

    // WhatsApp URL validation (optional)
    if (whatsappUrl?.trim()) {
      const whatsappPattern = /^https:\/\/(wa\.me|api\.whatsapp\.com)\/.+/i;
      if (!whatsappPattern.test(whatsappUrl.trim())) {
        setError(
          "Invalid WhatsApp URL. Must start with https://wa.me/ or https://api.whatsapp.com/"
        );
        return false;
      }
    }

    // Logo validation
    if (!logo) {
      setError("Company logo is required");
      return false;
    }

    // Password validation
    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters");
      return false;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return false;
    }

    return true;
  };

  /* ======================================================
     REGISTER HANDLER
  ====================================================== */
  const handleRegister = async () => {
    setError("");
    setSuccess("");

    // Validate form
    if (!validateForm()) {
      return;
    }

    const {
      companyName,
      email,
      phone,
      conferenceRooms,
      whatsappUrl,
      password,
    } = formData;

    const formPayload = new FormData();
    formPayload.append("companyName", companyName.trim());
    formPayload.append("email", email.trim().toLowerCase());
    formPayload.append("phone", phone.trim());
    formPayload.append("conferenceRooms", Number(conferenceRooms));
    formPayload.append("password", password);
    formPayload.append("logo", logo);

    // Add WhatsApp URL only if provided
    if (whatsappUrl?.trim()) {
      formPayload.append("whatsappUrl", whatsappUrl.trim());
    }

    try {
      setLoading(true);

      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        body: formPayload,
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.message || "Registration failed");
        return;
      }

      // Store email for login page pre-fill
      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail) {
        localStorage.setItem("regEmail", normalizedEmail);
      }

      setSuccess(
        "Registration successful! Redirecting to login page..."
      );

      setTimeout(() => {
        router.push("/auth/login");
      }, 2500);
    } catch (err) {
      console.error("REGISTRATION ERROR:", err);
      setError("Unable to connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ======================================================
     FORM FIELDS CONFIGURATION
  ====================================================== */
  const formFields = [
    {
      label: "Company Name",
      name: "companyName",
      type: "text",
      placeholder: "Enter your company name",
      required: true,
      fullWidth: true,
    },
    {
      label: "Admin Email",
      name: "email",
      type: "email",
      placeholder: "admin@company.com",
      required: true,
    },
    {
      label: "Admin Phone",
      name: "phone",
      type: "tel",
      placeholder: "+1234567890",
      required: true,
    },
    {
      label: "WhatsApp Contact URL",
      name: "whatsappUrl",
      type: "url",
      placeholder: "https://wa.me/1234567890 (Optional)",
      required: false,
      fullWidth: true,
      helpText: "Optional: Add your company's WhatsApp contact link for visitor support",
    },
    {
      label: "Conference Rooms",
      name: "conferenceRooms",
      type: "number",
      placeholder: "Number of rooms",
      required: true,
      min: 1,
      max: 100,
    },
    {
      label: "Password",
      name: "password",
      type: "password",
      placeholder: "Minimum 8 characters",
      required: true,
    },
    {
      label: "Confirm Password",
      name: "confirmPassword",
      type: "password",
      placeholder: "Re-enter your password",
      required: true,
    },
  ];

  /* ======================================================
     RENDER
  ====================================================== */
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}>📅</span>
          PROMEET
        </div>

        <button
          className={styles.backButton}
          onClick={() => router.push("/auth/login")}
          type="button"
        >
          <span className={styles.backIcon}>←</span>
          Back to Login
        </button>
      </header>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.title}>Create Company Account</h2>
          <p className={styles.subtitle}>
            Register your organization to start managing visitors & conference rooms
          </p>
        </div>

        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            handleRegister();
          }}
        >
          {/* DYNAMIC FORM FIELDS */}
          <div className={styles.formGrid}>
            {formFields.map((field) => (
              <div
                key={field.name}
                className={`${styles.formField} ${
                  field.fullWidth ? styles.fullWidth : ""
                }`}
              >
                <label className={styles.label} htmlFor={field.name}>
                  {field.label} {field.required && <span className={styles.required}>*</span>}
                </label>
                <input
                  id={field.name}
                  name={field.name}
                  type={field.type}
                  className={styles.input}
                  placeholder={field.placeholder}
                  value={formData[field.name]}
                  onChange={(e) => handleInputChange(field.name, e.target.value)}
                  min={field.min}
                  max={field.max}
                  disabled={loading}
                  autoComplete={field.type === "password" ? "new-password" : field.name}
                />
                {field.helpText && (
                  <small className={styles.helpText}>{field.helpText}</small>
                )}
              </div>
            ))}
          </div>

          {/* LOGO UPLOAD WITH PREVIEW */}
          <div className={styles.formField}>
            <label className={styles.label} htmlFor="logo">
              Company Logo <span className={styles.required}>*</span>
            </label>
            
            <div className={styles.logoUploadContainer}>
              {logoPreview ? (
                <div className={styles.logoPreview}>
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className={styles.logoPreviewImage}
                  />
                  <button
                    type="button"
                    className={styles.removeLogoButton}
                    onClick={() => {
                      setLogo(null);
                      setLogoPreview(null);
                      document.getElementById("logo").value = "";
                    }}
                    disabled={loading}
                  >
                    ✕ Remove
                  </button>
                </div>
              ) : (
                <div className={styles.logoUploadPlaceholder}>
                  <span className={styles.uploadIcon}>📁</span>
                  <p>Click to upload company logo</p>
                  <small>JPG, PNG or WEBP (Max 3MB)</small>
                </div>
              )}
              
              <input
                id="logo"
                name="logo"
                type="file"
                className={styles.fileInput}
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleLogoChange}
                disabled={loading}
              />
            </div>
          </div>

          {/* ERROR & SUCCESS MESSAGES */}
          {error && (
            <div className={styles.alert} role="alert">
              <span className={styles.alertIcon}>⚠️</span>
              <span className={styles.alertText}>{error}</span>
            </div>
          )}

          {success && (
            <div className={`${styles.alert} ${styles.alertSuccess}`} role="alert">
              <span className={styles.alertIcon}>✓</span>
              <span className={styles.alertText}>{success}</span>
            </div>
          )}

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className={styles.spinner}></span>
                Registering...
              </>
            ) : (
              <>
                <span className={styles.submitIcon}>→</span>
                Register & Continue
              </>
            )}
          </button>

          {/* FOOTER LINK */}
          <div className={styles.formFooter}>
            <p className={styles.footerText}>
              Already have an account?{" "}
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => router.push("/auth/login")}
                disabled={loading}
              >
                Login here
              </button>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
