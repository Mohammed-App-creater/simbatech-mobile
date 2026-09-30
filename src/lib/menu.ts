/*
 * The "All categories" menu: departments (each opens /shop?dept=<shop>), their groups and the promo tile.
 * Same content as simbatech-web/src/lib/menu.js.
 */
export type MenuGroup = { title: string; links: { label: string }[] };
export type MenuDept = {
  name: string;
  shop: string;
  kind: string;
  promoBg: string;
  promoFg: string;
  promoEyebrow: string;
  promoTitle: string;
  groups: MenuGroup[];
};

function g(title: string, links: string[]): MenuGroup {
  return { title, links: links.map((l) => ({ label: l })) };
}

export const DEPTS: MenuDept[] = [
  {
    name: "Electronics",
    shop: "Electronics",
    kind: "headphones",
    promoBg: "#EAF3FA",
    promoFg: "#1679BE",
    promoEyebrow: "Rent it",
    promoTitle: "Pro cameras from ETB 2,500 a day",
    groups: [
      g("Audio", ["Headphones", "Earbuds", "Speakers", "Soundbars"]),
      g("Cameras", ["Mirrorless", "Action cameras", "Lenses", "Drones"]),
      g("Computing", ["Laptops", "Monitors", "Keyboards", "Storage"]),
    ],
  },
  {
    name: "Phones & Tablets",
    shop: "Phones",
    kind: "phone",
    promoBg: "#EEE8FF",
    promoFg: "#5B3FD0",
    promoEyebrow: "New in",
    promoTitle: "Aero X Pro from ETB 89,500",
    groups: [
      g("Phones", ["Smartphones", "Feature phones", "Refurbished", "Dual SIM"]),
      g("Tablets", ["Tablets", "Kids' tablets", "E-readers", "Styluses"]),
      g("Accessories", ["Cases", "Chargers", "Power banks", "Screen protectors"]),
    ],
  },
  {
    name: "Home & Living",
    shop: "Home & Living",
    kind: "sofa",
    promoBg: "#F3EEE6",
    promoFg: "#7A4E2D",
    promoEyebrow: "Home refresh",
    promoTitle: "Linen sofa, ETB 84,900",
    groups: [
      g("Furniture", ["Sofas", "Beds", "Tables", "Storage"]),
      g("Decor", ["Lighting", "Rugs", "Mirrors", "Plants"]),
      g("Bedding", ["Sheets", "Duvets", "Pillows", "Towels"]),
    ],
  },
  {
    name: "Kitchen",
    shop: "Kitchen",
    kind: "espresso",
    promoBg: "#FFF4C7",
    promoFg: "#8A6300",
    promoEyebrow: "Up to 30% off",
    promoTitle: "Small kitchen appliances",
    groups: [
      g("Appliances", ["Coffee machines", "Blenders", "Microwaves", "Kettles"]),
      g("Cookware", ["Pots & pans", "Knives", "Bakeware", "Utensils"]),
      g("Dining", ["Plates", "Glassware", "Cutlery", "Serveware"]),
    ],
  },
  {
    name: "Fashion",
    shop: "Fashion",
    kind: "sneaker",
    promoBg: "#FFEADB",
    promoFg: "#B4431C",
    promoEyebrow: "20% off",
    promoTitle: "Sneakers and bags",
    groups: [
      g("Shoes", ["Sneakers", "Sandals", "Boots", "Formal"]),
      g("Bags", ["Totes", "Backpacks", "Wallets", "Travel"]),
      g("Clothing", ["Tops", "Dresses", "Jeans", "Jackets"]),
    ],
  },
  {
    name: "Beauty",
    shop: "Beauty",
    kind: "skincare",
    promoBg: "#FFE4EF",
    promoFg: "#B0245F",
    promoEyebrow: "New arrivals",
    promoTitle: "Glow Skincare Duo, ETB 4,600",
    groups: [
      g("Skincare", ["Cleansers", "Serums", "Moisturisers", "Sunscreen"]),
      g("Hair", ["Shampoo", "Oils", "Styling", "Hair tools"]),
      g("Fragrance & makeup", ["Perfume", "Lipstick", "Foundation", "Nails"]),
    ],
  },
  {
    name: "Tools & DIY",
    shop: "Tools & DIY",
    kind: "drill",
    promoBg: "#E4F2E6",
    promoFg: "#2F7A3C",
    promoEyebrow: "Rent it",
    promoTitle: "Drills from ETB 800 a day",
    groups: [
      g("Power tools", ["Drills", "Saws", "Sanders", "Grinders"]),
      g("Hand tools", ["Tool sets", "Ladders", "Measuring", "Safety gear"]),
      g("Garden", ["Mowers", "Hoses", "Pressure washers", "Planters"]),
    ],
  },
  {
    name: "Events & Party",
    shop: "Events & Party",
    kind: "tent",
    promoBg: "#E4F2E6",
    promoFg: "#2F7A3C",
    promoEyebrow: "Rental bundles",
    promoTitle: "Garden party from ETB 6,500 a day",
    groups: [
      g("Shelter", ["Tents", "Canopies", "Umbrellas", "Flooring"]),
      g("Furniture", ["Chairs", "Tables", "Linens", "Stages"]),
      g("Sound & light", ["Speakers", "PA systems", "String lights", "Projectors"]),
    ],
  },
];
