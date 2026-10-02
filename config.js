// Settings shared by every trip in this repo. See README.md, step 2.
window.PLANNER_CONFIG = {
  // Shared saving (Supabase). This is the same project as the Japan planner: every plan is
  // stored under its own share code, so use a code you haven't used for Japan.
  // Leave both blank and each person's edits stay in their own browser.
  supabaseUrl: 'https://yvbrlncjbstpwzilhvqx.supabase.co',
  supabaseKey: 'sb_publishable_M-QB_POtH1-dK3UwGPaFnQ_-qJMJ0Gj',   // the anon / publishable key (designed to be public)

  resolverUrl: '',   // optional: link-expander worker URL, e.g. 'https://maps-links.you.workers.dev'

  // Trips in this repo: each id is a folder in trips/. The first opens by default;
  // the others open with ?trip=<id>, and a switcher appears in the header.
  trips: [
    {id: 'tetons-yellowstone', title: 'Grand Teton & Yellowstone'},
  ],
};
