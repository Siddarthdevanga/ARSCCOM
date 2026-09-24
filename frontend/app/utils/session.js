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

   The three outcomes are kept distinct on purpose. "Offline" is not
   "signed out", and collapsing them logs people out of a valid session
   the moment their train goes into a tunnel.
   ========================================================================== */
const API = process.env.NEXT_PUBLIC_API_BASE_URL;

export const SESSION = {
  OK: "ok",
  UNAUTHENTICATED: "unauthenticated",
  OFFLINE: "offline",
};

export async function restoreSession() {
  // Read the local copy first — no point asking the server when we already
  // know who we are.
  try {
    const cached = localStorage.getItem("company");
    if (cached) return { status: SESSION.OK, company: JSON.parse(cached) };
  } catch {
    // Unparseable; fall through and re-fetch from the server.
  }

  try {
    const res = await fetch(`${API}/api/auth/session`, {
      credentials: "include",
      // Never let a cached 200 or 401 decide whether someone is signed in.
      cache: "no-store",
    });

    // A real answer from the server: the cookie is gone or no longer valid.
    if (res.status === 401 || res.status === 403) {
      return { status: SESSION.UNAUTHENTICATED };
    }
    if (!res.ok) return { status: SESSION.OFFLINE };

    const data = await res.json();
    if (!data?.success || !data?.company) return { status: SESSION.UNAUTHENTICATED };

    localStorage.setItem("company", JSON.stringify(data.company));
    return { status: SESSION.OK, company: data.company };
  } catch {
    // fetch threw: no network, DNS failure, server unreachable. We have no
    // idea whether they are signed in, so we must not claim they are not.
    return { status: SESSION.OFFLINE };
  }
}
