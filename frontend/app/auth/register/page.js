"use client";

import { useState } from "react";
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
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    "https://www.wheelbrand.in";

  /* ======================================================
        REGISTER HANDLER
  ====================================================== */
  const handleRegister = async () => {
    setError("");
    setSuccess("");

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

      // 🎯 NEW BEHAVIOR
      setSuccess("Registration complete. Login to subscribe and continue...");

      setTimeout(() => {
        router.push("/auth/login");
      }, 4000);

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

        <div className={styles.row3}>
          <div>
            <label className={styles.label}>Company Name *</label>
            <input
              className={styles.input}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </div>

          <div>
            <label className={styles.label}>Admin Email *</label>
            <input
              className={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className={styles.label}>Admin Phone *</label>
            <input
              className={styles.input}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.row2}>
          <div>
            <label className={styles.label}>Company Logo *</label>
            <input
              className={styles.fileInput}
              type="file"
              accept="image/*"
              onChange={(e) => setLogo(e.target.files[0])}
            />
          </div>

          <div>
            <label className={styles.label}>Conference Rooms *</label>
            <input
              className={styles.input}
              type="number"
              min="1"
              value={rooms}
              onChange={(e) => setRooms(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.row2}>
          <div>
            <label className={styles.label}>Password *</label>
            <input
              className={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div>
            <label className={styles.label}>Confirm Password *</label>
            <input
              className={styles.input}
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        <button
          className={styles.submitBtn}
          onClick={handleRegister}
          disabled={loading}
        >
          {loading ? "Registering..." : "Register & Continue"}
        </button>
      </div>
    </div>
  );
}
