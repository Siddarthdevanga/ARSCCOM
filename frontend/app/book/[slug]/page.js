"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import styles from "./style.module.css";

export default function PublicBookingPage() {
  const { slug } = useParams();

  const [company, setCompany] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;

    loadCompany();
    loadRooms();
  }, [slug]);

  const loadCompany = async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/public/company/${slug}`
      );

      if (!res.ok) throw new Error("Company not found");

      setCompany(await res.json());
    } catch {
      setError("Invalid booking link");
    }
  };

  const loadRooms = async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/public/company/${slug}/rooms`
      );

      setRooms(await res.json());
    } catch {
      setError("Unable to load rooms");
    }
  };

  if (error) return <p className={styles.error}>{error}</p>;
  if (!company) return null;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>{company.name}</h1>
        {company.logo_url && (
          <img src={company.logo_url} className={styles.logo} />
        )}
      </header>

      <h2 className={styles.title}>Book a Conference Room</h2>

      <div className={styles.rooms}>
        {rooms.map((r) => (
          <div key={r.id} className={styles.roomCard}>
            <h3>{r.name}</h3>
            <p>Capacity: {r.capacity || "—"}</p>
            <button>Book Slot</button>
          </div>
        ))}
      </div>
    </div>
  );
}
