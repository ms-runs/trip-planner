// Everything specific to this trip. Copy this folder to start a new one (see README.md).
// Plain data, no code: the planner (planner.js) reads it when the page loads.
window.TRIP = {
  id: 'tetons-yellowstone',            // matches the folder name
  title: 'Tetons & Yellowstone',
  subtitle: 'Oct 4–11, 2026 road trip from Salt Lake City',
  placeName: 'the parks',              // used in "Anywhere in …" and the map's description
  units: 'mi',                         // distances shown in miles ('km' for kilometres)
  nearKm: 60,                          // a pasted place further than this from every stop is flagged
  farKm: 150,                          // Checks warn when a saved place is this far from its stop
  stopZoomKm: 90,                      // how much map to show when a stop is opened
  tintClasses: ['park'],
  tintOpen: 30, tintRest: 14,          // how strongly (%) an open / unopened stop colours its park               // colour only the parks by stop (states are too big to tint)

  // Look: any CSS colour token from index.html, plus fonts.
  fontsUrl: 'https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@500;600;700&family=Public+Sans:wght@400;500;600&display=swap',
  theme: {
    display: "'Zilla Slab', Rockwell, Georgia, serif",
    body: "'Public Sans', system-ui, sans-serif",
    ink: '#1f2b25', paper: '#f1f2ea', paper2: '#e4e7da', muted: '#5f6a61',
    line: 'rgba(31,43,37,.12)', line2: 'rgba(31,43,37,.24)',
    land: '#e8e4d2', coast: '#b9b196', 'map-bg': '#e8e4d2',
    park: '#d3dfbf', 'park-edge': '#7d9463', sea: '#a9cadb', river: '#8cb4c9', road: '#c3955a',
    accent: '#2f5d50', 'leg-bg': '#f7f8f2', 'open-bg': '#e8ecdf', 'where-bg': '#dfe9df',
  },
  palette: ['#2f5d50', '#7a4b2a', '#3f6f8f', '#9c5a1b', '#5b4a86', '#6b7f2a', '#a23b3b'],

  // How you get between stops. The first key is the default for new legs.
  defaultMode: 'drive',
  modes: {
    drive: {icon: '🚙', label: 'Drive', color: '#7a4b2a'},
    flight: {icon: '✈', label: 'Flight', color: '#a23b3b'},
    shuttle: {icon: '🚐', label: 'Shuttle', color: '#5b4a86'},
    boat: {icon: '🛶', label: 'Boat', color: '#3f6f8f'},
    hike: {icon: '🥾', label: 'On foot', color: '#6b7f2a'},
  },
  curvedModes: ['flight'],
  dottedModes: ['boat', 'hike'],
  legFields: {
    carrier: 'Airline or company', carrierHint: 'United, Enterprise…',
    number: 'Flight or booking number', numberHint: 'UA 1234',
    notesHint: 'Route, fuel stops, park entrance…',
  },

  // Saved-place categories. Words are matched against a place's name, then its note;
  // lower p is tried first ("Lodge dining room" is a place to stay, "Coffee bar" a café).
  categories: [
    {id: 'stay', p: 1, label: 'Places to stay', icon: '🏕', words: ['hotel', 'inn', 'lodge', 'motel', 'cabin', 'campground', 'camping', 'ranch', 'resort', 'airbnb', 'hostel']},
    {id: 'hike', p: 2, label: 'Hikes', icon: '🥾', words: ['hike', 'trail', 'trailhead', 'canyon trail', 'loop', 'summit', 'pass trail']},
    {id: 'wildlife', p: 3, label: 'Wildlife', icon: '🦬', words: ['valley', 'refuge', 'wildlife', 'bison', 'elk', 'moose', 'wolves', 'bear']},
    {id: 'see', p: 4, label: 'Sights', icon: '🌋', words: ['geyser', 'basin', 'spring', 'springs', 'falls', 'overlook', 'point', 'landing', 'bend', 'row', 'arch', 'viewpoint', 'lookout', 'terraces', 'museum', 'visitor center']},
    {id: 'drink', p: 5, label: 'Bars', icon: '🍺', words: ['bar', 'saloon', 'brewery', 'brewing', 'taproom', 'distillery', 'pub']},
    {id: 'cafe', p: 6, label: 'Cafés', icon: '☕', words: ['cafe', 'café', 'coffee', 'espresso', 'bakery']},
    {id: 'eat', p: 7, label: 'Food', icon: '🍔', words: ['restaurant', 'grill', 'diner', 'kitchen', 'steak', 'bbq', 'pizza', 'burger', 'sushi', 'tacos', 'dinner', 'lunch', 'breakfast', 'deli', 'market']},
    {id: 'do', p: 8, label: 'Activities', icon: '🎯', words: ['tram', 'rodeo', 'horseback', 'rafting', 'float', 'kayak', 'boat', 'shuttle', 'tour', 'hot springs', 'rental', 'rentals']},
    {id: 'shop', p: 9, label: 'Shopping', icon: '🛍', words: ['shop', 'store', 'outfitters', 'mercantile', 'gallery', 'books', 'western wear']},
    {id: 'nature', p: 10, label: 'Nature', icon: '🌲', words: ['lake', 'river', 'mountain', 'peak', 'forest', 'park', 'creek']},
    {id: 'other', label: 'Other', icon: '📍'},
  ],
  categorySamples: [['Old Faithful Inn', 'stay'], ['Cascade Canyon Trail', 'hike'], ['Lamar Valley', 'wildlife'], ['Grand Prismatic Spring', 'see'],
    ['Million Dollar Cowboy Bar', 'drink'], ['Persephone Bakery', 'cafe'], ['Snake River Grill', 'eat'], ['Jackson Hole Aerial Tram', 'do'], ['Jenny Lake', 'nature']],
  tagColors: {hike: '#e2ead0/#4b5e1f', wildlife: '#f3e3cf/#7a4b2a', geyser: '#dcebf2/#2d5d78', view: '#e6e0f0/#4d3f76', photo: '#f5e1e1/#8a2f2f',
    drive: '#efe6d6/#6e4a1f', lake: '#d9ebf1/#2b6178', water: '#d9ebf1/#2b6178', town: '#ece9e1/#4a4640', book: '#fde7c8/#8a4b00'},

  // The plan "Reset" goes back to. Booked: Delta flights via Salt Lake City, a Hertz car from
  // SLC airport, and the three stays below. Confirmation numbers and exact addresses are kept
  // out of this file (the repo is public); they live in the shared plan, behind the share code.
  // regionIds are the basemap shapes each stop should sit in (Checks confirms it):
  // UT, ID, WY, MT (states), grte (Grand Teton), yell (Yellowstone).
  plan: {
    startDate: '2026-10-04',
    // Where the trip starts (drawn as a line to the first stop): fly into SLC, pick up the car, drive north.
    arrival: {name: 'Salt Lake City airport (Delta DL 2876, 9:21am)', lat: 40.7899, lng: -111.9791, mode: 'drive', est: '4h 30m', booked: true},
    stops: [
      {id: 'alta', name: 'Alta', region: 'Wyoming, Teton Valley', lat: 43.7546, lng: -111.0383, nights: 3, regionIds: ['WY', 'ID'],
        tip: 'Alta sits on the quiet west side of the Tetons, about an hour from Jackson over Teton Pass. In October the Jenny Lake boat shuttle has usually stopped for the season, so plan to walk around the lake.',
        sections: [
          {label: 'Arrival day, Sun Oct 4', items: [{text: 'Delta DL 2876, Cincinnati 7:35am to Salt Lake City 9:21am', tags: ['book'], hl: true},
            {text: 'Pick up the Hertz car at SLC airport (Volvo XC60 Hybrid or similar)', tags: ['drive', 'book'], hl: true},
            {text: 'Drive about 4½ hours north via Idaho Falls to Alta', tags: ['drive']},
            {text: 'Stay: Sunset Views & Ranch Life, Targhee Barndominium (Airbnb). Check in after 4pm with the keypad', tags: ['book']}]},
          {label: 'Grand Teton day trips', items: [{text: 'Hike around Jenny Lake to Hidden Falls and Inspiration Point', tags: ['hike', 'lake'], hl: true},
            {text: 'Sunrise at Schwabacher Landing', tags: ['photo'], hl: true}, {text: 'Mormon Row barns', tags: ['photo']},
            {text: 'Sunset at Oxbow Bend, with moose and elk at dusk', tags: ['photo', 'wildlife'], hl: true}, {text: 'Taggart Lake loop', tags: ['hike']}]},
          {label: 'Jackson and Teton Valley', items: [{text: 'Drive Teton Pass into Jackson', tags: ['drive', 'view']}, {text: 'Town Square and the antler arches', tags: ['town']},
            {text: 'National Elk Refuge', tags: ['wildlife']}, {text: 'Driggs for groceries, coffee and bear spray', tags: ['town', 'book']}]},
          {label: 'Check-out', items: [{text: 'Leave by 10am on Wed Oct 7', tags: ['book']}]},
        ]},
      {id: 'mammoth', name: 'Mammoth Hot Springs', region: 'Yellowstone, north', lat: 44.9766, lng: -110.7006, nights: 2, regionIds: ['yell'],
        leg: {mode: 'drive', est: '5h + stops', carrier: 'Hertz rental car', depDate: '2026-10-07',
          notes: 'Teton Pass, Grand Teton, in by the South Entrance, then Old Faithful and Norris. Full day: leave Alta by 10am.'},
        tip: 'Park roads start closing for winter in October, so check the road status on the Yellowstone park website before each drive.',
        sections: [
          {label: 'On the way in, Wed Oct 7', items: [{text: 'West Thumb Geyser Basin', tags: ['geyser', 'lake']}, {text: 'Old Faithful eruption (check the predicted times)', tags: ['geyser'], hl: true},
            {text: 'Grand Prismatic Spring from the Fairy Falls overlook', tags: ['geyser', 'hike'], hl: true}]},
          {label: 'Stay', items: [{text: 'Mammoth Hot Springs Hotel & Cabins, Frontier Cabin with 2 queens. Check in from 4pm', tags: ['book'], hl: true},
            {text: 'Check out by 11am on Fri Oct 9', tags: ['book']}]},
          {label: 'Around Mammoth', items: [{text: 'Mammoth terraces boardwalks (elk often graze on the hotel lawns in October)', tags: ['geyser', 'wildlife'], hl: true},
            {text: 'Lamar Valley at dawn for bison and wolves, about an hour east', tags: ['wildlife'], hl: true},
            {text: 'Artist Point and the Lower Falls at Canyon, about 1¼ hours south', tags: ['view']}, {text: 'Roosevelt Arch at the North Entrance', tags: ['photo']}]},
        ]},
      {id: 'emigrant', name: 'Emigrant', region: 'Montana, Paradise Valley', lat: 45.3713, lng: -110.7213, nights: 1, regionIds: ['MT'],
        leg: {mode: 'drive', est: '45m', carrier: 'Hertz rental car', depDate: '2026-10-09', notes: 'Out through Gardiner and north on US-89 up Paradise Valley.'},
        sections: [
          {label: 'Stay', items: [{text: 'Juniper House, a tranquil getaway (Airbnb). Self check-in with smart lock after 4pm', tags: ['book'], hl: true},
            {text: 'Check out by 11am on Sat Oct 10', tags: ['book']}]},
          {label: 'Paradise Valley', items: [{text: 'Soak at Chico Hot Springs in Pray, a few minutes away', tags: ['water'], hl: true},
            {text: 'Paradise Valley views along US-89', tags: ['drive', 'view']}, {text: 'Livingston’s main street', tags: ['town']}]},
        ]},
      {id: 'slc', name: 'Salt Lake City', region: 'Utah, departure', lat: 40.7899, lng: -111.9791, nights: 1, regionIds: ['UT'],
        leg: {mode: 'drive', est: '6h', carrier: 'Hertz rental car', depDate: '2026-10-10', arrDate: '2026-10-10', arrTime: '20:00',
          notes: 'Long drive south. Return the Hertz car at SLC airport by 8pm (counter open 6am to midnight).'},
        tip: 'No stay booked for Saturday night yet. With a 6am flight, a hotel by the airport makes the morning easiest.',
        sections: [
          {label: 'Sat Oct 10', items: [{text: 'Return the Hertz car at SLC airport by 8pm', tags: ['drive', 'book'], hl: true}, {text: 'Book a hotel near the airport', tags: ['book'], hl: true}]},
          {label: 'Flying home, Sun Oct 11', items: [{text: 'Delta DL 2289, Salt Lake City 6:00am to Detroit 11:32am', tags: ['book'], hl: true},
            {text: 'Delta DL 5257, Detroit 12:15pm to Cincinnati 1:28pm', tags: ['book'], hl: true}]},
        ]},
    ],
  },

  // Places to add once to the shared plan (for example from a Google Maps list export).
  seeds: {id: 'none', places: []},

  // Ideas from saved Instagram posts (every saved post was checked; these two are about this
  // area). "where" picks the stop an idea is filed under. Positions are approximate.
  ideaStops: {'Jackson Hole': 'alta', 'Grand Teton': 'alta', 'Yellowstone': 'mammoth', 'Canyon': 'mammoth', 'Mammoth': 'mammoth', 'Anywhere': 'alta'},
  ideas: [
    {id: 'DVcQplKkTy8', url: 'https://www.instagram.com/reel/DVcQplKkTy8/', user: 'magicalwandering', date: 'Apr 2026', where: 'Grand Teton',
      what: ['Itinerary', 'Food', 'Hotels', 'Photo spots', 'Wildlife'], title: 'Seven-day Wyoming and Montana road trip',
      summary: 'Jackson, a day in Grand Teton, two in Yellowstone, then north to Whitefish and Glacier. The Glacier half is off this map; everything else fits your route.',
      items: [
        {name: 'Jackson Town Square antler arches', cat: 'see', where: 'Jackson Hole', lat: 43.4799, lng: -110.7624, approx: true},
        {name: 'Jackson Hole Aerial Tram', cat: 'do', where: 'Jackson Hole', lat: 43.5875, lng: -110.8279, approx: true},
        {name: 'National Elk Refuge', cat: 'wildlife', where: 'Jackson Hole', lat: 43.5, lng: -110.74, approx: true},
        {name: 'Local (restaurant), Jackson', cat: 'eat', where: 'Jackson Hole', lat: 43.4797, lng: -110.7618, approx: true},
        {name: 'King Sushi, Jackson', cat: 'eat', where: 'Jackson Hole'},
        {name: 'Rustic Inn Creekside', cat: 'stay', where: 'Jackson Hole', lat: 43.4887, lng: -110.7607, approx: true},
        {name: 'Cloudveil hotel', cat: 'stay', where: 'Jackson Hole', lat: 43.4793, lng: -110.7625, approx: true},
        {name: 'Four Seasons Resort Jackson Hole', cat: 'stay', where: 'Jackson Hole', lat: 43.5858, lng: -110.8301, approx: true},
        {name: 'Schwabacher Landing at sunrise', cat: 'see', lat: 43.7127, lng: -110.67, approx: true},
        {name: 'Mormon Row', cat: 'see', lat: 43.6663, lng: -110.6627, approx: true},
        {name: 'Jenny Lake', cat: 'nature', lat: 43.7532, lng: -110.7239, approx: true},
        {name: 'Dornan’s, for lunch', cat: 'eat', lat: 43.6594, lng: -110.7189, approx: true},
        {name: 'Snake River Overlook', cat: 'see', lat: 43.7578, lng: -110.6258, approx: true},
        {name: 'Oxbow Bend at sunset', cat: 'see', lat: 43.8656, lng: -110.548, approx: true},
        {name: 'West Thumb Geyser Basin', cat: 'see', where: 'Yellowstone', lat: 44.4172, lng: -110.572, approx: true},
        {name: 'Old Faithful', cat: 'see', where: 'Yellowstone', lat: 44.4605, lng: -110.8281, approx: true},
        {name: 'Grand Prismatic Spring', cat: 'see', where: 'Yellowstone', lat: 44.5251, lng: -110.8382, approx: true},
        {name: 'Artist Point and the Lower Falls', cat: 'see', where: 'Canyon', lat: 44.72, lng: -110.4795, approx: true},
        {name: 'Hayden Valley', cat: 'wildlife', where: 'Canyon', lat: 44.66, lng: -110.47, approx: true},
        {name: 'Mammoth Hot Springs terraces', cat: 'see', where: 'Mammoth', lat: 44.969, lng: -110.7041, approx: true},
        {name: 'Roosevelt Arch', cat: 'see', where: 'Mammoth', lat: 45.0294, lng: -110.7091, approx: true},
      ]},
    {id: 'Ddyurypx_0i', url: 'https://www.instagram.com/reel/Ddyurypx_0i/', user: 'yourdestinationinspiration', date: 'Sep 2026', where: 'Grand Teton',
      what: ['Itinerary', 'Hikes', 'Wildlife', 'Costs'], title: 'A long weekend in Grand Teton',
      summary: 'Hike Cascade Canyon and jump into an alpine lake, ride horses, look for moose and bears, catch a rodeo, then sunrise over the Tetons. The creator puts it at roughly $715–865 each.',
      items: [
        {name: 'Cascade Canyon Trail', cat: 'hike', lat: 43.7667, lng: -110.77, approx: true},
        {name: 'Swim in an alpine lake', cat: 'nature', note: 'The post suggests cliff jumping into the lakes; in October the water will be very cold.'},
        {name: 'Horseback riding', cat: 'do', where: 'Jackson Hole'},
        {name: 'Look for moose and bears', cat: 'wildlife'},
        {name: 'Jackson Hole Rodeo', cat: 'do', where: 'Jackson Hole', lat: 43.4755, lng: -110.7555, approx: true, note: 'The rodeo season usually ends before October, so check dates.'},
        {name: 'Sunrise over the Tetons', cat: 'see'},
      ]},
  ],
};
