"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./style.module.css";

export default function RegisterPage() {
  const router = useRouter();

  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [rooms, setRooms] = useState("");
  const [logo, setLogo] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    "https://www.wheelbrand.in";

  /* ======================================
        AUTO REDIRECT AFTER SUCCESS
  ====================================== */
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        router.push("/auth/login");
      }, 4000); // 4 seconds

      return () => clearTimeout(timer);
    }
  }, [success, router]);

  const handleRegister = async () => {
    setError("");

    if (
      !companyName ||
      !email ||
      !phone ||
      !rooms ||
      !logo ||
      !password ||
      !confirmPassword
    ) {
      setError("All fields are required");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError("Enter a valid email address");
      return;
    }

    if (phone.trim().length < 8) {
      setError("Enter a valid phone number");
      return;
    }

    const roomCount = Number(rooms);
    if (!roomCount || roomCount < 1) {
      setError("Conference rooms must be at least 1");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (!logo) {
      setError("Company logo is required");
      return;
    }

    if (logo.size > 3 * 1024 * 1024) {
      setError("Logo file must be less than 3MB");
      return;
    }

    const formData = new FormData();
    formData.append("companyName", companyName.trim());
    formData.append("email", normalizedEmail);
    formData.append("phone", phone.trim());
    formData.append("conferenceRooms", roomCount);
    formData.append("password", password);
    formData.append("logo", logo);

    try {
      setLoading(true);

      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        body: formData,
        credentials: "include"
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.message || "Registration failed");
        return;
      }

      if (normalizedEmail)
        localStorage.setItem("regEmail", normalizedEmail);

      setSuccess(true);
    } catch (err) {
      console.error(err);
      setError("Unable to connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>PROMEET</div>

        <div
          className={styles.backHeader}
          onClick={() => router.push("/auth/login")}
        >
          ← Back to Login
        </div>
      </header>

      <div className={styles.card}>
        <h2 className={styles.title}>Create Company Account</h2>
        <p className={styles.subtitle}>
          Register your company to start managing visitors & conference rooms
        </p>

        {!success ? (
          <>
            {/* existing form fields here unchanged */}

            {error && <div className={styles.error}>{error}</div>}

            <button
              className={styles.submitBtn}
              onClick={handleRegister}
              disabled={loading}
            >
              {loading ? "Registering..." : "Register & Continue"}
            </button>
          </>
        ) : (
          <div className={styles.successBox}>
            <h3>Registration Successful 🎉</h3>
            <p>You will be redirected to login shortly...</p>
            <p>Please login and subscribe to continue.</p>

            <button
              className={styles.submitBtn}
              onClick={() => router.push("/auth/login")}
            >
              Go to Login Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
