// Settings shared by every trip in this repo. See README.md, step 2.
window.PLANNER_CONFIG = {
  // Shared saving (Supabase). Leave blank and each person's edits stay in their own browser.
  supabaseUrl: '',   // e.g. 'https://abcdefgh.supabase.co'
  supabaseKey: '',   // the project's anon / publishable key (designed to be public)

  resolverUrl: '',   // optional: link-expander worker URL, e.g. 'https://maps-links.you.workers.dev'

  // Trips in this repo: each id is a folder in trips/. The first opens by default;
  // the others open with ?trip=<id>, and a switcher appears in the header.
  trips: [
    {id: 'tetons-yellowstone', title: 'Grand Teton & Yellowstone'},
  ],
};
