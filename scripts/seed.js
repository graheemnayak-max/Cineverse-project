require('dotenv').config();
const mongoose = require('mongoose');
const Media = require('../models/Media');

const seedData = [
  {
    id: "1", title: "Crimson Static", category: "TV Shows",
    genre: "Sci-Fi, Mystery", year: 2024, rating: "TV-MA", match: 98, size: "large",
    image: "https://picsum.photos/seed/crimson-static/900/700",
    description: "A small town's power grid starts picking up voices from people who haven't been born yet — and one of them already knows the sheriff's name."
  },
  {
    id: "2", title: "The Glass Orchard", category: "TV Shows",
    genre: "Fantasy, Drama", year: 2023, rating: "TV-14", match: 97, size: "large",
    image: "https://picsum.photos/seed/glass-orchard/900/700",
    description: "Fruit grown in one family's orchard shows whoever eats it a year of a life they haven't lived yet — and someone has started selling it by the crate."
  },
  {
    id: "3", title: "The Velvet Circuit", category: "TV Shows",
    genre: "Fantasy, Adventure", year: 2023, rating: "TV-14", match: 95, size: "medium",
    image: "https://picsum.photos/seed/velvet-circuit/700/500",
    description: "A retired locksmith is pulled back into a hidden city built beneath the one she knows, where every door owes her a favor."
  },
  {
    id: "4", title: "Hollow Frequencies", category: "Movies",
    genre: "Thriller, Drama", year: 2025, rating: "R", match: 96, size: "medium",
    image: "https://picsum.photos/seed/hollow-frequencies/700/500",
    description: "A late-night radio host realizes her callers are all describing the same disappearance, exactly one hour apart."
  },
  {
    id: "5", title: "Neon Requiem", category: "Movies",
    genre: "Sci-Fi, Action", year: 2024, rating: "R", match: 93, size: "medium",
    image: "https://picsum.photos/seed/neon-requiem/700/500",
    description: "A bounty hunter has twelve hours to deliver a stolen memory before it deletes itself — and the memory is starting to fight back."
  },
  {
    id: "6", title: "The Last Cartographer", category: "TV Shows",
    genre: "Adventure, Fantasy", year: 2022, rating: "TV-PG", match: 96, size: "medium",
    image: "https://picsum.photos/seed/last-cartographer/700/500",
    description: "The world's final mapmaker is hired to chart a continent that quietly rearranges itself every time someone looks away."
  },
  {
    id: "7", title: "The Architect's Daughter", category: "TV Shows",
    genre: "Mystery, Drama", year: 2025, rating: "TV-MA", match: 92, size: "medium",
    image: "https://picsum.photos/seed/architects-daughter/700/500",
    description: "She inherits her father's unfinished city, the debts that came with building it, and the tenants who refuse to leave."
  },
  {
    id: "8", title: "Salt and Static", category: "TV Shows",
    genre: "Crime, Drama", year: 2024, rating: "TV-MA", match: 94, size: "medium",
    image: "https://picsum.photos/seed/salt-and-static/700/500",
    description: "A coastal detective investigates crimes that wash ashore years after they happened, evidence and all."
  },
  {
    id: "9", title: "Static Kingdoms", category: "Movies",
    genre: "Animation, Adventure", year: 2024, rating: "PG", match: 95, size: "medium",
    image: "https://picsum.photos/seed/static-kingdoms/700/500",
    description: "A kingdom built entirely of folded paper animals tries to survive its very first rainy season."
  },
  {
    id: "10", title: "Iron Tide", category: "Movies",
    genre: "Action, War", year: 2022, rating: "PG-13", match: 90, size: "small",
    image: "https://picsum.photos/seed/iron-tide/600/450",
    description: "A salvage crew hauls up a sunken warship that's still mid-argument with itself, sixty years after it sank."
  },
  {
    id: "11", title: "Paper Moons", category: "TV Shows",
    genre: "Romance, Drama", year: 2023, rating: "TV-MA", match: 88, size: "small",
    image: "https://picsum.photos/seed/paper-moons/600/450",
    description: "Two rival anonymous letter-writers fall for each other's words without ever learning the other's name."
  },
  {
    id: "12", title: "Echoes of Tomorrow", category: "TV Shows",
    genre: "Drama, Sci-Fi", year: 2021, rating: "TV-14", match: 91, size: "small",
    image: "https://picsum.photos/seed/echoes-tomorrow/600/450",
    description: "A scientist keeps receiving messages from her own future self — each one a year further from the truth."
  },
  {
    id: "13", title: "Whispering Static", category: "Movies",
    genre: "Horror", year: 2024, rating: "R", match: 86, size: "small",
    image: "https://picsum.photos/seed/whispering-static/600/450",
    description: "A graveyard-shift radio operator keeps picking up calls from phone numbers that don't officially exist."
  },
  {
    id: "14", title: "Borrowed Light", category: "Movies",
    genre: "Drama, Romance", year: 2023, rating: "PG-13", match: 84, size: "small",
    image: "https://picsum.photos/seed/borrowed-light/600/450",
    description: "A lighthouse keeper inherits a stack of letters addressed to a man who vanished thirty years earlier."
  },
  {
    id: "15", title: "Midnight Atlas", category: "Movies",
    genre: "Action, Thriller", year: 2023, rating: "R", match: 89, size: "small",
    image: "https://picsum.photos/seed/midnight-atlas/600/450",
    description: "A courier who only delivers after dark finally gets a package addressed to herself."
  },
  {
    id: "16", title: "Quiet Machines", category: "Movies",
    genre: "Sci-Fi, Drama", year: 2022, rating: "PG-13", match: 90, size: "small",
    image: "https://picsum.photos/seed/quiet-machines/600/450",
    description: "A repair technician falls for a household AI that's already scheduled for decommissioning."
  },
  {
    id: "17", title: "Faultlines", category: "TV Shows",
    genre: "Crime, Thriller", year: 2025, rating: "TV-MA", match: 87, size: "small",
    image: "https://picsum.photos/seed/faultlines/600/450",
    description: "Three estranged siblings reunite when a decades-old case is reopened directly beneath their childhood home."
  },
  {
    id: "18", title: "The Hourglass Office", category: "Movies",
    genre: "Comedy, Drama", year: 2023, rating: "PG-13", match: 85, size: "small",
    image: "https://picsum.photos/seed/hourglass-office/600/450",
    description: "A mid-level bureaucrat discovers his desk drawer rewinds exactly ten minutes, once a day, no exceptions."
  }
];

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cineverse');

    // Clear existing data
    await Media.deleteMany({});
    console.log('Cleared existing data');

    // Insert seed data
    await Media.insertMany(seedData);
    console.log('Data seeded successfully');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();