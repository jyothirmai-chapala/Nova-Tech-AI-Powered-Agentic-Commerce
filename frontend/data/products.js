export const products = [
  {
    id: "mouse-001",
    name: "NovaFlow Wireless Mouse",
    category: "Workspace",
    price: 799,
    description:
      "Precision wireless mouse designed for focused work.",
    tags: [
      "mouse",
      "wireless",
      "productivity",
      "office",
      "coding",
      "work",
    ],
    emoji: "🖱️",
    relatedProducts: ["mat-001", "keyboard-001"],
  },

  {
    id: "keyboard-001",
    name: "NovaType Mechanical Keyboard",
    category: "Workspace",
    price: 1499,
    description:
      "Tactile mechanical keyboard built for long sessions.",
    tags: [
      "keyboard",
      "mechanical",
      "productivity",
      "coding",
      "work",
    ],
    emoji: "⌨️",
    relatedProducts: ["mouse-001", "mat-001"],
  },

  {
    id: "stand-001",
    name: "NovaDesk Laptop Stand",
    category: "Workspace",
    price: 1299,
    description:
      "Minimal aluminum stand for a cleaner workspace.",
    tags: [
      "laptop",
      "stand",
      "desk",
      "workspace",
      "study",
    ],
    emoji: "💻",
    relatedProducts: ["mouse-001", "hub-001"],
  },

  {
    id: "hub-001",
    name: "NovaHub USB-C Hub",
    category: "Power",
    price: 999,
    description:
      "Compact USB-C hub for a connected workspace.",
    tags: [
      "usb",
      "hub",
      "laptop",
      "connectivity",
      "work",
    ],
    emoji: "🔌",
    relatedProducts: ["stand-001", "charge-001"],
  },

  {
    id: "pods-001",
    name: "NovaPods Lite",
    category: "Audio",
    price: 1999,
    description:
      "Lightweight wireless earbuds for everyday listening.",
    tags: [
      "earbuds",
      "wireless",
      "audio",
      "music",
      "travel",
    ],
    emoji: "🎧",
    relatedProducts: ["charge-001"],
  },

  {
    id: "headphones-001",
    name: "NovaSound Headphones",
    category: "Audio",
    price: 2499,
    description:
      "Immersive over-ear audio for deep focus.",
    tags: [
      "headphones",
      "audio",
      "focus",
      "music",
      "study",
      "work",
    ],
    emoji: "🎵",
    relatedProducts: ["pods-001", "mat-001"],
  },

  {
    id: "mat-001",
    name: "NovaMat Desk Mat",
    category: "Workspace",
    price: 499,
    description:
      "Soft premium desk mat for a cleaner setup.",
    tags: [
      "desk",
      "mat",
      "workspace",
      "mouse",
      "setup",
    ],
    emoji: "⬛",
    relatedProducts: ["mouse-001", "keyboard-001"],
  },

  {
    id: "charge-001",
    name: "NovaCharge 65W",
    category: "Power",
    price: 1299,
    description:
      "Compact 65W charger for your everyday devices.",
    tags: [
      "charger",
      "power",
      "usb-c",
      "laptop",
      "phone",
    ],
    emoji: "⚡",
    relatedProducts: ["hub-001", "pods-001"],
  },
];