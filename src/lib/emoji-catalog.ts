/**
 * Emoji for categories, grouped the way a household spends, each with English
 * and Indonesian search words. Desktop keyboards have no emoji key, so the
 * category form searches this list instead.
 */
export interface EmojiGroup {
  id: string;
  label: string;
  items: [emoji: string, keywords: string][];
}

export const EMOJI_GROUPS: EmojiGroup[] = [
  {
    id: "food",
    label: "Food",
    items: [
      ["🍜", "noodle mie bakso ramen soup meals makan"],
      ["🍚", "rice nasi meals makan"],
      ["🍛", "curry rendang padang nasi meals makan"],
      ["🍱", "bento lunch box makan siang meals"],
      ["🍔", "burger fast food makan"],
      ["🍕", "pizza"],
      ["🍗", "chicken ayam goreng"],
      ["🍣", "sushi japanese"],
      ["🥗", "salad healthy sayur"],
      ["🍞", "bread roti bakery sourdough"],
      ["🥐", "croissant pastry bakery"],
      ["🍰", "cake kue dessert"],
      ["🍦", "ice cream es krim dessert"],
      ["🍿", "snack popcorn cemilan jajan"],
      ["☕", "coffee kopi cafe"],
      ["🧋", "boba bubble tea es teh"],
      ["🥤", "drink minuman soda"],
      ["🍺", "beer drink"],
      ["🍳", "cooking masak breakfast sarapan"],
      ["🛒", "groceries belanja dapur supermarket"],
      ["🥬", "vegetables sayur pasar market"],
      ["🍎", "fruit buah"],
      ["🥚", "egg telur"],
      ["🐟", "fish ikan"],
    ],
  },
  {
    id: "transport",
    label: "Transport",
    items: [
      ["🚗", "car mobil transport"],
      ["🛵", "motorbike motor ojek gojek grab"],
      ["🚕", "taxi taksi grab gocar"],
      ["🚌", "bus transjakarta transport"],
      ["🚆", "train kereta krl mrt kai"],
      ["⛽", "fuel bensin pertamax gas bbm"],
      ["🅿️", "parking parkir"],
      ["🛣️", "toll tol highway"],
      ["🔧", "service bengkel repair tambal"],
      ["🛞", "tire ban tambal"],
      ["🚲", "bike sepeda"],
      ["✈️", "flight pesawat travel tiket"],
    ],
  },
  {
    id: "home",
    label: "Home & bills",
    items: [
      ["🏠", "home rumah house rent sewa"],
      ["🧾", "bill tagihan billing receipt"],
      ["💡", "electricity listrik pln"],
      ["💧", "water air pdam"],
      ["📶", "internet wifi indihome"],
      ["📱", "phone pulsa kuota data hp"],
      ["📺", "tv streaming netflix subscription langganan"],
      ["🔥", "gas lpg elpiji"],
      ["🧹", "cleaning bersih art pembantu"],
      ["🧺", "laundry cuci"],
      ["🛋️", "furniture perabot"],
      ["🔑", "key kunci deposit"],
      ["🏢", "apartment ipl maintenance kantor"],
      ["🛠️", "repair renovasi tools"],
    ],
  },
  {
    id: "shopping",
    label: "Shopping",
    items: [
      ["🛍️", "shopping belanja mall"],
      ["👕", "clothes baju fashion"],
      ["👟", "shoes sepatu"],
      ["💄", "makeup kosmetik beauty"],
      ["🧴", "skincare toiletries sabun"],
      ["💻", "laptop gadget electronics"],
      ["🎧", "headphones gadget audio"],
      ["📦", "package online shopee tokopedia paket"],
      ["🎁", "gift hadiah kado"],
      ["💍", "jewelry perhiasan emas"],
    ],
  },
  {
    id: "health",
    label: "Health",
    items: [
      ["💊", "medicine obat apotek pharmacy"],
      ["🏥", "hospital rumah sakit doctor dokter"],
      ["🩺", "doctor dokter checkup"],
      ["🦷", "dentist gigi"],
      ["👓", "glasses kacamata"],
      ["🏋️", "gym fitness olahraga"],
      ["🧘", "yoga wellness"],
      ["💆", "massage pijat spa"],
      ["💇", "haircut potong rambut salon"],
      ["🛡️", "insurance asuransi bpjs"],
    ],
  },
  {
    id: "family",
    label: "Family",
    items: [
      ["👶", "baby bayi anak child"],
      ["🍼", "milk susu baby formula"],
      ["🧒", "child anak kids"],
      ["🎒", "school sekolah"],
      ["📚", "books buku education pendidikan les"],
      ["🎓", "education kuliah tuition spp"],
      ["🐶", "pet dog anjing"],
      ["🐱", "pet cat kucing louie"],
      ["👨‍👩‍👧", "family keluarga orang tua"],
      ["💕", "date pacar couple love"],
      ["💒", "wedding nikah kondangan"],
    ],
  },
  {
    id: "fun",
    label: "Fun",
    items: [
      ["🎉", "party pesta celebration"],
      ["🎬", "movie film bioskop cinema"],
      ["🎮", "games gaming"],
      ["🎵", "music spotify musik"],
      ["⚽", "sport football futsal olahraga"],
      ["🏸", "badminton sport"],
      ["🎨", "hobby art"],
      ["📷", "camera photo"],
      ["🏖️", "holiday liburan beach pantai"],
      ["🏕️", "camping"],
      ["🎟️", "ticket tiket event konser"],
    ],
  },
  {
    id: "money",
    label: "Money",
    items: [
      ["💼", "salary gaji work kerja income"],
      ["💰", "money uang bonus thr"],
      ["💵", "cash tunai"],
      ["💸", "spend petty cash jajan"],
      ["🏦", "bank tabungan"],
      ["🐷", "savings tabungan piggy celengan"],
      ["📈", "investment investasi saham reksadana bibit"],
      ["🪙", "gold emas coin"],
      ["💳", "credit card kartu kredit cicilan"],
      ["🚨", "emergency darurat dana darurat"],
      ["🤲", "charity infaq zakat sedekah donasi"],
      ["🕌", "mosque masjid zakat"],
      ["🧮", "tax pajak"],
      ["📄", "admin fee biaya"],
      ["↩️", "refund cashback"],
    ],
  },
  {
    id: "travel",
    label: "Travel",
    items: [
      ["🧳", "travel trip luggage koper"],
      ["🏨", "hotel penginapan"],
      ["🗺️", "travel map wisata"],
      ["🌏", "abroad luar negeri world"],
      ["🏔️", "mountain gunung"],
      ["🚢", "ship kapal ferry"],
    ],
  },
];

const ALL = EMOJI_GROUPS.flatMap((g) => g.items);

/** Emoji whose words match every term of the query (any language), best matches first. */
export function searchEmoji(query: string, limit = 32): string[] {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return ALL.map(([emoji, words]) => {
    const list = words.split(" ");
    let score = 0;
    for (const t of terms) {
      if (list.includes(t)) score += 3;
      else if (list.some((w) => w.startsWith(t))) score += 2;
      else if (words.includes(t)) score += 1;
      else return null;
    }
    return { emoji, score };
  })
    .filter((x): x is { emoji: string; score: number } => x !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.emoji);
}

/** A few emoji that fit a category's name, for one-tap picking. */
export function suggestEmoji(name: string, limit = 8): string[] {
  const words = name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  const seen = new Set<string>();
  for (const w of words) for (const e of searchEmoji(w, limit)) seen.add(e);
  return [...seen].slice(0, limit);
}
