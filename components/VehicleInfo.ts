export const VEHICLE_INFO = {
  cab_2w: {
    name: "2 Wheeler",
    description: "Quick and affordable rides through city traffic. Perfect for solo trips.",
    features: [
      { icon: "⚡", label: "Quick" },
      { icon: "💰", label: "Affordable" },
      { icon: "🌿", label: "Eco Friendly" },
    ],
    fleet: "🛵🛵🛵  Honda Activa, TVS Jupiter, Bajaj Chetak",
  },
  cab_3w: {
    name: "Auto",
    description: "Quickest auto ride in town. Beat traffic with ease.",
    features: [
      { icon: "🛺", label: "Comfy" },
      { icon: "💳", label: "Pocket Friendly" },
      { icon: "🌿", label: "Green" },
    ],
    fleet: "🛺🛺🛺  Bajaj RE, TVS King, Piaggio Ape",
  },
  cab_4w: {
    name: "Mini",
    description: "A regular comfortable hatchback that becomes your everyday ride.",
    features: [
      { icon: "🚗", label: "Comfy Hatch" },
      { icon: "💳", label: "Pocket Friendly" },
      { icon: "🚫", label: "Cashless Rides" },
    ],
    fleet: "🚗🚗🚗  Maruti WagonR, Maruti S-Presso, Maruti Celerio, Tata Indica",
  },
  cab_4w_suv: {
    name: "Prime SUV",
    description: "Spacious and premium SUVs for a superior ride experience.",
    features: [
      { icon: "🚙", label: "Spacious" },
      { icon: "🌟", label: "Premium" },
      { icon: "💺", label: "6 Seats" },
    ],
    fleet: "🚙🚙🚙  Toyota Innova, Mahindra XUV700, Ertiga",
  },
} as const;
