import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default function Page() {
  const cookieStore = cookies();
  const token = cookieStore.get("token");

  if (token) {
    redirect("/home");
  }

  redirect("/auth/login");
}

