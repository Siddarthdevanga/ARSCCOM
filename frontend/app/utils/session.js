/* ============================================================================
   SESSION RESTORE
   The app treats a missing localStorage "company" entry as "logged out".
   The actual credential is an httpOnly cookie, good for 30 days with
   Remember me — so the two can disagree, and when they do the user is shown
   a login form while holding a perfectly valid session.

   That is not hypothetical on iOS: an installed home-screen web app gets
   its own storage container, separate from Safari, so signing in through
   the browser and then opening the installed app finds nothing locally.
   ITP also clears script-writable storage on its own schedule.

   restoreSession asks the server who the cookie says we are, and rewrites
   localStorage from the answer.
   ========================================================================== */
const API = process.env.NEXT_PUBLIC_API_BASE_URL;

export async function restoreSession() {
  try {
    const res = await fetch(`${API}/api/auth/session`, {
      credentials: "include",
      // Never let a cached 200 or 401 decide whether someone is signed in.
      cache: "no-store",
    });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data?.success || !data?.company) return null;

    localStorage.setItem("company", JSON.stringify(data.company));
    return data.company;
  } catch {
    // Offline or the API is unreachable. Not the same as signed out, but
    // there is nothing to restore from either — the caller decides.
    return null;
  }
}
