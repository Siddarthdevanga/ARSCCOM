"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import styles from "../../../../visitor/primary_details/style.module.css";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export default function SmartFormResponsesPage() {
  const router = useRouter();
  const { id } = useParams();
  const [company, setCompany] = useState(null);
  const [formName, setFormName] = useState("");
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("company");
    if (!stored) { router.replace("/login"); return; }
    try { setCompany(JSON.parse(stored)); } catch { router.replace("/login"); }
  }, [router]);

  const fetchResponses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`${API}/api/smart-forms/${id}/responses?${params.toString()}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load responses");
      setFormName(data.formName || "");
      setResponses(data.responses || []);
    } catch (err) {
      setError(err.message || "Failed to load responses");
    } finally {
      setLoading(false);
    }
  }, [id, search, from, to]);

  useEffect(() => { if (company && id) fetchResponses(); }, [company, id, fetchResponses]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`${API}/api/smart-forms/${id}/responses/export?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition");
      let filename = `${formName || "responses"}.xlsx`;
      if (cd) { const m = cd.match(/filename="(.+)"/); if (m) filename = m[1]; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to download report");
    } finally {
      setDownloading(false);
    }
  };

  const allColumns = [];
  const seen = new Set();
  for (const r of responses) {
    for (const key of Object.keys(r.values)) {
      if (!seen.has(key)) { seen.add(key); allColumns.push(key); }
    }
  }

  if (!company) return <div className={styles.container}><div className={styles.loading}>Loading…</div></div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}><div className={styles.logoText}>{company.name}</div></div>
        <div className={styles.rightHeader}>
          <button className={styles.backBtn} onClick={() => router.push("/smart-forms/dashboard")}>← Back</button>
        </div>
      </header>
      <div className={styles.scrollBody}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: "#08080c", margin: 0 }}>{formName || "Responses"}</h1>
              <p style={{ fontSize: 12.5, color: "#6b7280", margin: "4px 0 0" }}>{responses.length} response{responses.length !== 1 ? "s" : ""}</p>
            </div>
            <button onClick={handleDownload} disabled={downloading || !responses.length}
              style={{ background: "linear-gradient(135deg,#121216,#242428)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: responses.length ? "pointer" : "not-allowed", opacity: responses.length ? 1 : 0.5 }}>
              {downloading ? "Downloading…" : "⬇ Download Report"}
            </button>
          </div>

          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBottom: "1rem" }}>
            <input placeholder="🔍 Search responses…" value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1, minWidth: 200, padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13 }} />
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13 }} />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: "9px 12px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13 }} />
          </div>

          {error && <p style={{ color: "#b91c1c", fontSize: 13 }}>{error}</p>}

          {loading ? (
            <p style={{ textAlign: "center", color: "#9ca3af", padding: "2rem" }}>Loading…</p>
          ) : responses.length === 0 ? (
            <p style={{ textAlign: "center", color: "#9ca3af", padding: "2rem" }}>No responses yet.</p>
          ) : (
            <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#121216" }}>
                    <th style={thStyle}>Submitted On</th>
                    {allColumns.map((c) => <th key={c} style={thStyle}>{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {responses.map((r, i) => (
                    <tr key={r.id} style={{ background: i % 2 === 0 ? "#fff" : "#f9f9fc" }}>
                      <td style={tdStyle}>{new Date(r.submittedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                      {allColumns.map((c) => <td key={c} style={tdStyle}>{r.values[c] || "-"}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const thStyle = { padding: "10px 14px", textAlign: "left", color: "#fff", fontWeight: 700, fontSize: 11.5, textTransform: "uppercase", whiteSpace: "nowrap" };
const tdStyle = { padding: "9px 14px", borderBottom: "1px solid #f2f2f5", color: "#08080c", whiteSpace: "nowrap" };
