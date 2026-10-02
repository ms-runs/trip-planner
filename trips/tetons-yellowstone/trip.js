// Everything specific to this trip. Copy this folder to start a new one (see README.md).
// Plain data, no code: the planner (planner.js) reads it when the page loads.
window.TRIP = {
  id: 'tetons-yellowstone',            // matches the folder name
  title: 'Tetons & Yellowstone',
  subtitle: 'Wyoming and Montana road trip',
  placeName: 'the parks',              // used in "Anywhere in …" and the map's description
  units: 'mi',                         // distances shown in miles ('km' for kilometres)
  nearKm: 60,                          // a pasted place further than this from every stop is flagged
  farKm: 120,                          // Checks warn when a saved place is this far from its stop
  stopZoomKm: 45,                      // how much map to show when a stop is opened
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

  // The plan "Reset" goes back to. A starting draft: edit freely in the page.
  // regionIds are the basemap shapes each stop should sit in (Checks confirms it):
  // WY, MT, ID (states), grte (Grand Teton), yell (Yellowstone).
  plan: {
    startDate: '',
    stops: [
      {id: 'jackson', name: 'Jackson', region: 'Wyoming, arrival', lat: 43.4799, lng: -110.7624, nights: 2, regionIds: ['WY'],
        tip: 'Jackson Hole Airport (JAC) sits inside Grand Teton, 15 minutes from town. You’ll want a rental car for the whole trip.',
        sections: [
          {label: 'Town', items: [{text: 'Town Square and the antler arches', tags: ['town'], hl: true}, {text: 'National Elk Refuge', tags: ['wildlife']},
            {text: 'Dinner on the square', tags: ['eat']}, {text: 'Stock up on groceries and bear spray', tags: ['book']}]},
          {label: 'Teton Village', items: [{text: 'Jackson Hole Aerial Tram to the top of Rendezvous Mountain', tags: ['view'], hl: true}]},
        ]},
      {id: 'grte', name: 'Grand Teton', region: 'Jenny Lake and Moose', lat: 43.7532, lng: -110.7239, nights: 2, regionIds: ['grte'],
        leg: {mode: 'drive', est: '30m', notes: 'US-191 north, into the park at Moose. One America the Beautiful pass covers both parks.'},
        tip: 'Start Cascade Canyon early: take the first Jenny Lake boat across and the trail is quiet for an hour or two.',
        sections: [
          {label: 'Hikes', items: [{text: 'Cascade Canyon via the Jenny Lake boat', tags: ['hike', 'lake'], hl: true}, {text: 'Hidden Falls and Inspiration Point', tags: ['hike', 'view']},
            {text: 'Taggart Lake loop', tags: ['hike']}]},
          {label: 'Sunrise and sunset', items: [{text: 'Sunrise at Schwabacher Landing', tags: ['photo'], hl: true}, {text: 'Mormon Row barns', tags: ['photo']},
            {text: 'Snake River Overlook', tags: ['view']}, {text: 'Sunset at Oxbow Bend', tags: ['photo', 'wildlife'], hl: true}]},
        ]},
      {id: 'oldfaithful', name: 'Old Faithful', region: 'Yellowstone, geyser country', lat: 44.4605, lng: -110.8281, nights: 2, regionIds: ['yell'],
        leg: {mode: 'drive', est: '2h', notes: 'North on the Rockefeller Parkway, in by the South Entrance. Stop at West Thumb on the way.'},
        tip: 'Rooms inside Yellowstone often sell out a year ahead, and most park roads close to cars from November to April.',
        sections: [
          {label: 'Geysers', items: [{text: 'Old Faithful eruption (check the predicted times)', tags: ['geyser'], hl: true}, {text: 'Upper Geyser Basin boardwalks', tags: ['geyser']},
            {text: 'Grand Prismatic Spring from the Fairy Falls overlook', tags: ['geyser', 'hike'], hl: true}, {text: 'West Thumb Geyser Basin', tags: ['geyser', 'lake']}]},
        ]},
      {id: 'canyon', name: 'Canyon Village', region: 'Yellowstone, canyon and Hayden Valley', lat: 44.7355, lng: -110.4885, nights: 1, regionIds: ['yell'],
        leg: {mode: 'drive', est: '1h 15m', notes: 'Via Norris, or the long way round past Yellowstone Lake and through Hayden Valley.'},
        sections: [
          {label: 'Sights', items: [{text: 'Artist Point and the Lower Falls', tags: ['view'], hl: true}, {text: 'Brink of the Lower Falls', tags: ['hike']},
            {text: 'Hayden Valley at dusk for bison', tags: ['wildlife'], hl: true}]},
        ]},
      {id: 'gardiner', name: 'Gardiner', region: 'Montana, north entrance', lat: 45.0322, lng: -110.7057, nights: 2, regionIds: ['MT'],
        leg: {mode: 'drive', est: '1h 30m', notes: 'Over Dunraven Pass to Tower-Roosevelt, then west to Mammoth.'},
        tip: 'Lamar Valley is at its best at first light, when wolves are most active. It’s about an hour from Gardiner, so leave in the dark.',
        sections: [
          {label: 'Sights', items: [{text: 'Lamar Valley at dawn', tags: ['wildlife'], hl: true}, {text: 'Mammoth Hot Springs terraces', tags: ['geyser'], hl: true},
            {text: 'Roosevelt Arch', tags: ['photo']}]},
        ]},
      {id: 'bozeman', name: 'Bozeman', region: 'Montana, departure', lat: 45.677, lng: -111.0429, nights: 1, regionIds: ['MT'],
        leg: {mode: 'drive', est: '1h 30m', notes: 'US-89 through Paradise Valley, then I-90 west. Fly home from Bozeman (BZN).'},
        sections: [
          {label: 'Last night', items: [{text: 'Soak at Chico Hot Springs on the drive', tags: ['water'], hl: true}, {text: 'Main Street dinner and drinks', tags: ['eat', 'town']},
            {text: 'Return the rental car at BZN', tags: ['book']}]},
        ]},
    ],
  },

  // Places to add once to the shared plan (for example from a Google Maps list export).
  seeds: {id: 'none', places: []},

  // Ideas from saved Instagram posts. "where" picks the stop an idea is filed under.
  // Item positions are approximate (marked approx), so check them on the map.
  ideaStops: {'Jackson Hole': 'jackson', 'Grand Teton': 'grte', 'Yellowstone': 'oldfaithful', 'Canyon': 'canyon', 'Mammoth': 'gardiner', 'Anywhere': 'jackson'},
  ideas: [
    {id: 'DVcQplKkTy8', url: 'https://www.instagram.com/reel/DVcQplKkTy8/', user: 'magicalwandering', date: 'Apr 2026', where: 'Grand Teton',
      what: ['Itinerary', 'Photo spots', 'Wildlife'], title: 'Seven-day Wyoming and Montana road trip',
      summary: 'Jackson, two days across Grand Teton and Yellowstone, then north to Whitefish and Glacier, flying home from Kalispell. The Glacier half is off this map.',
      items: [
        {name: 'Jackson Hole Aerial Tram', cat: 'do', where: 'Jackson Hole', lat: 43.5875, lng: -110.8279, approx: true},
        {name: 'National Elk Refuge', cat: 'wildlife', where: 'Jackson Hole', lat: 43.5, lng: -110.74, approx: true},
        {name: 'Rustic Inn Creekside', cat: 'stay', where: 'Jackson Hole', lat: 43.4887, lng: -110.7607, approx: true},
        {name: 'Schwabacher Landing', cat: 'see', lat: 43.7127, lng: -110.67, approx: true},
        {name: 'Mormon Row', cat: 'see', lat: 43.6663, lng: -110.6627, approx: true},
        {name: 'Dornan’s', cat: 'eat', lat: 43.6594, lng: -110.7189, approx: true},
        {name: 'Oxbow Bend', cat: 'see', lat: 43.8656, lng: -110.548, approx: true},
        {name: 'West Thumb Geyser Basin', cat: 'see', where: 'Yellowstone', lat: 44.4172, lng: -110.572, approx: true},
        {name: 'Grand Prismatic Spring', cat: 'see', where: 'Yellowstone', lat: 44.5251, lng: -110.8382, approx: true},
        {name: 'Artist Point', cat: 'see', where: 'Canyon', lat: 44.72, lng: -110.4795, approx: true},
        {name: 'Hayden Valley', cat: 'wildlife', where: 'Canyon', lat: 44.66, lng: -110.47, approx: true},
        {name: 'Mammoth Hot Springs', cat: 'see', where: 'Mammoth', lat: 44.977, lng: -110.703, approx: true},
        {name: 'Roosevelt Arch', cat: 'see', where: 'Mammoth', lat: 45.0294, lng: -110.7091, approx: true},
      ]},
    {id: 'Ddyurypx_0i', url: 'https://www.instagram.com/reel/Ddyurypx_0i/', user: 'yourdestinationinspiration', date: 'Sep 2026', where: 'Grand Teton',
      what: ['Itinerary', 'Hikes', 'Costs'], title: 'A long weekend in Grand Teton',
      summary: 'Fly in Thursday night, hike Cascade Canyon, ride horses, look for moose and bears, catch a rodeo, then sunrise over the Tetons before flying home. The creator puts it at roughly $715–865 each.',
      items: [
        {name: 'Cascade Canyon Trail', cat: 'hike', lat: 43.7667, lng: -110.77, approx: true},
        {name: 'Horseback riding', cat: 'do', where: 'Jackson Hole'},
        {name: 'Jackson Hole Rodeo', cat: 'do', where: 'Jackson Hole', lat: 43.4755, lng: -110.7555, approx: true},
      ]},
  ],
};
