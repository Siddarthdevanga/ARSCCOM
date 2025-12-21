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
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/register`,
        {
          method: "POST",
          body: formData
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Registration failed");
        return;
      }

      router.push("/subscription");
    } catch {
      setError("Unable to connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* ================= HEADER ================= */}
      <header className={styles.header}>
        <div className={styles.brand}>ARSCCOM</div>

        <div
          className={styles.backHeader}
          onClick={() => router.push("/login")}
        >
          ← Back to Login
        </div>
      </header>

      {/* ================= CARD ================= */}
      <div className={styles.card}>
        <h2 className={styles.title}>Create Company Account</h2>
        <p className={styles.subtitle}>
          Register your company to start managing visitors
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

        {error && <div className={styles.error}>{error}</div>}

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
