"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ConferenceBookingsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/conference/book"); }, [router]);
  return null;
}
