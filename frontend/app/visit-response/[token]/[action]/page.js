"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function VisitResponsePage() {
  const { token, action } = useParams();
  const [state, setState] = useState("loading"); // loading | success | error
  const [message, setMessage] = useState("");
  const [heading, setHeading] = useState("");

  useEffect(() => {
    if (!token || !action) {
      setState("error");
      setHeading("Invalid Link");
      setMessage("This link is invalid or incomplete.");
      return;
    }

    const call = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/visit-response/${token}/${action}`
        );
        const text = await res.text();

        // Backend returns HTML — extract title + message from it
        // We just use the status code to determine outcome
        if (res.ok || res.status === 200) {
          const isAccept = action === "accept";
          setState("success");
          setHeading(isAccept ? "Visit Approved ✅" : "Visit Declined ❌");
          setMessage(
            isAccept
              ? "You have approved the visit. Reception has been notified."
              : "You have declined the visit. Reception has been notified."
          );
        } else if (res.status === 410) {
          setState("error");
          setHeading("Link Expired");
          setMessage("This response link has expired (48 hours). The admin can still update the status from the dashboard.");
        } else if (res.status === 404) {
          setState("error");
          setHeading("Link Not Found");
          setMessage("This response link is invalid or has already been used.");
        } else {
          // Parse message from JSON if possible
          let msg = "Something went wrong. Please contact your administrator.";
          try { msg = JSON.parse(text)?.message || msg; } catch {}
          setState("error");
          setHeading("Error");
          setMessage(msg);
        }
      } catch {
        setState("error");
        setHeading("Network Error");
        setMessage("Could not connect. Please check your internet and try again.");
      }
    };

    call();
  }, [token, action]);

  const color =
    state === "loading" ? "#6c2bd9"
    : state === "success" && action === "accept" ? "#00c853"
    : state === "success" ? "#f44336"
    : "#f44336";

  const icon =
    state === "loading" ? "⏳"
    : state === "success" && action === "accept" ? "✅"
    : state === "success" ? "❌"
    : "⚠️";

  return (
    <div style={{
      fontFamily: "Arial, Helvetica, sans-serif",
      background: "#f5f3ff",
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
    }}>
      <div style={{
        background: "#fff",
        borderRadius: "16px",
        padding: "48px 40px",
        maxWidth: "480px",
        width: "100%",
        textAlign: "center",
        boxShadow: "0 4px 32px rgba(108,43,217,0.10)",
      }}>
        <div style={{ fontSize: "56px", marginBottom: "20px" }}>{icon}</div>

        {state === "loading" ? (
          <>
            <h1 style={{ fontSize: "22px", color: "#6c2bd9", marginBottom: "12px" }}>
              Processing…
            </h1>
            <p style={{ color: "#888", fontSize: "15px" }}>
              Please wait a moment.
            </p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: "22px", color, marginBottom: "16px" }}>
              {heading}
            </h1>
            <p style={{ color: "#555", fontSize: "15px", lineHeight: "1.6" }}>
              {message}
            </p>
          </>
        )}

        <div style={{
          display: "inline-block",
          marginTop: "28px",
          padding: "6px 18px",
          background: `${color}18`,
          color,
          borderRadius: "20px",
          fontSize: "13px",
          fontWeight: "600",
        }}>
          Promeet Visitor Management
        </div>

        <div style={{ marginTop: "28px", fontSize: "12px", color: "#bbb" }}>
          You can close this window.
        </div>
      </div>
    </div>
  );
}
