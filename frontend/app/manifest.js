/* ============================================================================
   WEB APP MANIFEST  ->  /manifest.webmanifest
   Next generates this from the route, so it stays beside the rest of the
   app config instead of drifting as a hand-edited JSON file in public/.

   This is what makes the site installable from Chrome on Android — and it
   is the prerequisite for a TWA (.apk) build later, since Bubblewrap reads
   its name, colours, icons and start_url straight from here.
   ========================================================================== */
export default function manifest() {
  return {
    name: "Hai Visitor — Visitor Management Portal",
    // Launchers truncate at roughly 12 characters.
    short_name: "Hai Visitor",
    description:
      "Visitor management and conference room booking. Digital passes, live dashboard and check-in.",

    // /home, not /login: it guards itself and bounces to /login when there
    // is no session, so a signed-in user lands on their dashboard instead
    // of being asked to log in again on every launch. In an installed app
    // start_url is the only entry point, so getting this wrong is felt
    // every single time.
    start_url: "/home",
    // Stable identity for the installed app, independent of start_url —
    // without it, changing start_url later registers as a different app.
    id: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",

    background_color: "#050505",   // the splash Android paints while loading
    theme_color: "#050505",        // status bar
    lang: "en-IN",
    dir: "ltr",
    categories: ["business", "productivity"],

    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android crops these to the launcher's own shape, so they carry a
      // full-bleed background with the mark inside the 80% safe zone.
      { src: "/icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],

    // Long-press the installed icon to jump straight to a task.
    shortcuts: [
      {
        name: "Visitor Dashboard",
        short_name: "Visitors",
        url: "/visitor/dashboard",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Conference Booking",
        short_name: "Rooms",
        url: "/conference/dashboard",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
