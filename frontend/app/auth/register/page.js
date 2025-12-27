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
  const [loading, setLoading] = useState(false);

  /* ======================================================
     HANDLE REGISTER
  ====================================================== */
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

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const formData = new FormData();
    formData.append("companyName", companyName.trim());
    formData.append("email", email.trim().toLowerCase());
    formData.append("phone", phone.trim());
    formData.append("conferenceRooms", rooms);
    formData.append("password", password);
    formData.append("logo", logo);

    try {
      setLoading(true);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/auth/register`,
        {
          method: "POST",
          body: formData,
          credentials: "include"
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data?.message || "Registration failed");
        return;
      }

      /** ================================================
       *  SAVE DETAILS FOR SUBSCRIPTION PAGE
       *  ================================================ */
      if (data?.companyId) localStorage.setItem("companyId", data.companyId);
      if (email) localStorage.setItem("regEmail", email);
      if (companyName)
        localStorage.setItem("regCompanyName", companyName);

      // 🔥 SUCCESS → GO TO SUBSCRIPTION PAGE
      router.push("/auth/subscription");

    } catch (err) {
      console.error(err);
      setError("Unable to connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* ================= HEADER ================= */}
      <header className={styles.header}>
        <div className={styles.brand}>PROMEET</div>

        <div
          className={styles.backHeader}
          onClick={() => router.push("/auth/login")}
        >
          ← Back to Login
        </div>
      </header>

      {/* ================= CARD ================= */}
      <div className={styles.card}>
        <h2 className={styles.title}>Create Company Account</h2>
        <p className={styles.subtitle}>
          Register your company to start managing visitors & conference rooms
        </p>

        {/* ROW 1 */}
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

        {/* ROW 2 */}
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

        {/* ROW 3 */}
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

        {/* ERROR */}
        {error && <div className={styles.error}>{error}</div>}

        {/* BUTTON */}
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
