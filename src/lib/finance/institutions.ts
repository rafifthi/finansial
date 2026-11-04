import type { Account } from "@/lib/sheets/schema";

/**
 * Indonesian banks and fintech an account can belong to. Logos live in
 * public/logos/<id>.png, fetched by `pnpm logos:fetch` (scripts/fetch-logos.ts).
 * `match` lists the words that identify one in an account's name; a leading
 * "=" means the whole name only, for everyday words ("Dana Darurat" is a fund, not DANA).
 */
export interface Institution {
  id: string;
  name: string;
  /** App Store id: its app icon is the logo (square, sharp, the mark people know). */
  app: number;
  /** Website, the fallback source for the logo. */
  domain: string;
  match: string[];
  kind: "bank" | "digital_bank" | "ewallet" | "investment" | "paylater";
}

export const INSTITUTIONS: Institution[] = [
  // Banks
  { id: "bca", name: "BCA", app: 551587254, domain: "bca.co.id", match: ["bca", "klikbca", "mybca"], kind: "bank" },
  { id: "mandiri", name: "Bank Mandiri", app: 1555414743, domain: "bankmandiri.co.id", match: ["mandiri", "livin"], kind: "bank" },
  { id: "bri", name: "BRI", app: 1439730817, domain: "bri.co.id", match: ["bri", "brimo"], kind: "bank" },
  { id: "bni", name: "BNI", app: 6499518320, domain: "bni.co.id", match: ["bni", "wondr"], kind: "bank" },
  { id: "btn", name: "BTN", app: 6443466424, domain: "btn.co.id", match: ["btn"], kind: "bank" },
  { id: "bsi", name: "BSI", app: 6444697752, domain: "bankbsi.co.id", match: ["bsi", "syariah indonesia"], kind: "bank" },
  { id: "cimb", name: "CIMB Niaga", app: 505917174, domain: "cimbniaga.co.id", match: ["cimb", "niaga", "octo"], kind: "bank" },
  { id: "permata", name: "PermataBank", app: 1323973644, domain: "permatabank.com", match: ["permata"], kind: "bank" },
  { id: "danamon", name: "Danamon", app: 1532879177, domain: "danamon.co.id", match: ["danamon"], kind: "bank" },
  { id: "ocbc", name: "OCBC", app: 1194942386, domain: "ocbc.id", match: ["ocbc", "nyala"], kind: "bank" },
  { id: "panin", name: "Panin Bank", app: 1074164682, domain: "panin.co.id", match: ["panin"], kind: "bank" },
  { id: "maybank", name: "Maybank", app: 1457339382, domain: "maybank.co.id", match: ["maybank"], kind: "bank" },
  { id: "uob", name: "UOB", app: 1472320289, domain: "uob.co.id", match: ["uob", "tmrw"], kind: "bank" },
  { id: "hsbc", name: "HSBC", app: 1544734144, domain: "hsbc.co.id", match: ["hsbc"], kind: "bank" },
  { id: "dbs", name: "DBS digibank", app: 1170988769, domain: "dbs.id", match: ["dbs", "digibank"], kind: "bank" },
  { id: "mega", name: "Bank Mega", app: 6746247532, domain: "bankmega.com", match: ["bank mega", "=mega"], kind: "bank" },
  { id: "bjb", name: "bank bjb", app: 6482852990, domain: "bankbjb.co.id", match: ["bjb"], kind: "bank" },
  { id: "sinarmas", name: "Bank Sinarmas", app: 938705552, domain: "banksinarmas.com", match: ["sinarmas"], kind: "bank" },
  // Digital banks
  { id: "jago", name: "Bank Jago", app: 1539402234, domain: "jago.com", match: ["jago"], kind: "digital_bank" },
  { id: "jenius", name: "Jenius", app: 1079340119, domain: "jenius.com", match: ["jenius"], kind: "digital_bank" },
  { id: "blu", name: "blu by BCA Digital", app: 1550237185, domain: "blubybcadigital.id", match: ["blu by bca", "bca digital", "=blu"], kind: "digital_bank" },
  { id: "seabank", name: "SeaBank", app: 1525477806, domain: "seabank.co.id", match: ["seabank", "sea bank"], kind: "digital_bank" },
  { id: "allo", name: "Allo Bank", app: 1591223632, domain: "allobank.com", match: ["allo bank", "=allo"], kind: "digital_bank" },
  { id: "neo", name: "neobank", app: 1519178181, domain: "bankneocommerce.co.id", match: ["neobank", "neo commerce"], kind: "digital_bank" },
  { id: "superbank", name: "Superbank", app: 6444720285, domain: "superbank.id", match: ["superbank"], kind: "digital_bank" },
  { id: "krom", name: "Krom Bank", app: 1673245868, domain: "krom.id", match: ["krom"], kind: "digital_bank" },
  { id: "raya", name: "Bank Raya", app: 1627393834, domain: "bankraya.co.id", match: ["bank raya", "=raya"], kind: "digital_bank" },
  { id: "linebank", name: "LINE Bank", app: 1527382439, domain: "linebank.co.id", match: ["line bank", "linebank"], kind: "digital_bank" },
  // E-wallets and payments
  { id: "gopay", name: "GoPay", app: 6446321594, domain: "gopay.co.id", match: ["gopay", "go-pay"], kind: "ewallet" },
  { id: "ovo", name: "OVO", app: 1142114207, domain: "ovo.id", match: ["ovo"], kind: "ewallet" },
  { id: "dana", name: "DANA", app: 1437123008, domain: "dana.id", match: ["=dana", "dana wallet", "dana e-wallet"], kind: "ewallet" },
  { id: "shopeepay", name: "ShopeePay", app: 6455990519, domain: "shopeepay.co.id", match: ["shopeepay", "shopee"], kind: "ewallet" },
  { id: "linkaja", name: "LinkAja", app: 984436451, domain: "linkaja.id", match: ["linkaja", "link aja"], kind: "ewallet" },
  { id: "flip", name: "Flip", app: 1439301290, domain: "flip.id", match: ["=flip", "flip.id"], kind: "ewallet" },
  { id: "isaku", name: "i.saku", app: 1289150756, domain: "isaku.co.id", match: ["isaku", "i.saku"], kind: "ewallet" },
  // Investment
  { id: "bibit", name: "Bibit", app: 1445856964, domain: "bibit.id", match: ["bibit"], kind: "investment" },
  { id: "stockbit", name: "Stockbit", app: 1184800207, domain: "stockbit.com", match: ["stockbit"], kind: "investment" },
  { id: "ajaib", name: "Ajaib", app: 1473916571, domain: "ajaib.co.id", match: ["ajaib"], kind: "investment" },
  { id: "bareksa", name: "Bareksa", app: 1316876694, domain: "bareksa.com", match: ["bareksa"], kind: "investment" },
  { id: "pluang", name: "Pluang", app: 1341588054, domain: "pluang.com", match: ["pluang"], kind: "investment" },
  { id: "pintu", name: "Pintu", app: 1494119678, domain: "pintu.co.id", match: ["=pintu", "pintu crypto"], kind: "investment" },
  { id: "indodax", name: "Indodax", app: 1349104693, domain: "indodax.com", match: ["indodax"], kind: "investment" },
  { id: "tokocrypto", name: "Tokocrypto", app: 1538556690, domain: "tokocrypto.com", match: ["tokocrypto"], kind: "investment" },
  // Pay later
  { id: "kredivo", name: "Kredivo", app: 1255413338, domain: "kredivo.com", match: ["kredivo"], kind: "paylater" },
  { id: "akulaku", name: "Akulaku", app: 1125683586, domain: "akulaku.com", match: ["akulaku"], kind: "paylater" },
];

const byId = new Map(INSTITUTIONS.map((i) => [i.id, i]));

// Longest phrase first, so "bank mega" wins over a stray "mega" and "seabank" over "sea".
const matchers = INSTITUTIONS.flatMap((i) => i.match.map((m) => ({ id: i.id, m })))
  .sort((a, b) => b.m.length - a.m.length)
  .map(({ id, m }) => {
    const exact = m.startsWith("=");
    const word = (exact ? m.slice(1) : m).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return { id, re: new RegExp(exact ? `^${word}$` : `(^|[^a-z0-9])${word}($|[^a-z0-9])`) };
  });

/** Institution named in an account's name ("Jago Tabungan" → jago), if any. */
export function detectInstitution(name: string): Institution | undefined {
  const s = name.trim().toLowerCase();
  const hit = matchers.find((x) => x.re.test(s));
  return hit ? byId.get(hit.id) : undefined;
}

/**
 * The account's institution: the one picked on the account, else one found in
 * its name. `institution: "none"` opts out of detection.
 */
export function institutionOf(a: Pick<Account, "name" | "institution">): Institution | undefined {
  if (a.institution === "none") return undefined;
  return (a.institution && byId.get(a.institution)) || detectInstitution(a.name);
}

export const institutionLogo = (i: Institution) => `/logos/${i.id}.png`;
