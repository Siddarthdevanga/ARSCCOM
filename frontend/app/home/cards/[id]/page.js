"use client";
import { use } from "react";
import CardEditor from "../CardEditor";

export default function EditCardPage({ params }) {
  const { id } = use(params);
  return <CardEditor key={id} cardId={id} />;
}
