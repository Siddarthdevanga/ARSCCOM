"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./style.module.css";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /* ================= LOGIN ================= */
  const handleLogin = async () => {
    if (loading) return;

    if (!email.trim() || !password) {
      setError("Email and password are required");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            password
          })
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data?.message || "Invalid credentials");
        return;
      }

      /* ================= SAVE AUTH ================= */
      localStorage.setItem("token", data.token);

      if (data.company) {
        localStorage.setItem("company", JSON.stringify(data.company));
      }

      /* ================= REDIRECT ================= */
      router.replace("/home");

    } catch (err) {
      setError("Unable to connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>

      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.brandSection}>
          <div className={styles.logoText}>
            VISITOR MANAGEMENT PLATFORM
          </div>

          <Image
            src="/logo.png"
            alt="Logo"
            width={420}
            height={140}
            priority
            style={{ objectFit: "contain" }}
          />
        </div>

        <nav className={styles.nav}>
          <button>ABOUT</button>
          <button>PLANS</button>
          <button>CONTACT</button>
        </nav>
      </header>

      {/* MAIN */}
      <main className={styles.mainRow}>
        <div className={styles.leftSpacer} />

        <div className={styles.loginWrapper}>
          <div className={styles.loginCard}>

            <h4 className={styles.title}>LOGIN TO YOUR ACCOUNT</h4>

            <div className={styles.inputGroup}>
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <p className={styles.errorText}>{error}</p>}

            <button
              className={styles.loginBtn}
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? "Logging in..." : "LOGIN"}
            </button>

            <div className={styles.extraLinks}>
              <Link href="/auth/forgot-password">Forgot Password?</Link>
              <span>|</span>
              <Link href="/auth/register">New Registration</Link>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
