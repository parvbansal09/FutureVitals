// Location, entirely on the device. A typed ZIP is looked up in the Census
// ZIP-area table shipped with the app; a GPS reading is used once, in memory.
// Nothing here makes a network request.
import { vaZips } from './content';

export type LatLng = [number, number];

export type ZipResult =
  | { status: 'incomplete' }
  | { status: 'invalid' }
  | { status: 'outside'; state: string }
  | { status: 'ok'; coords: LatLng; precision: 'zip' | 'area' | 'state' };

const VA_CENTER: LatLng = [37.52, -78.85];
// Road distance is longer than a straight line. 1.25 is a common detour factor
// for U.S. roads; the screen says "about" and calls it an estimate.
export const ROAD_FACTOR = 1.25;

export function milesBetween(a: LatLng, b: LatLng): number {
  const R = 3958.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const roadMiles = (a: LatLng, b: LatLng) => milesBetween(a, b) * ROAD_FACTOR;

export const isVirginiaZip = (zip: string) => {
  const n = Number(zip);
  return (n >= 20101 && n <= 20199) || n === 20598 || (n >= 22001 && n <= 24699);
};

// U.S. ZIP ranges by state (from FutureVitals v1), used only to tell
// "outside Virginia" apart from "not a ZIP code at all".
const RANGES: [number, number, string][] = [
  [210, 215, 'New Hampshire'], [601, 999, 'Puerto Rico'], [1001, 2799, 'Massachusetts'], [2801, 2999, 'Rhode Island'],
  [3001, 3899, 'New Hampshire'], [3901, 4999, 'Maine'], [5001, 5999, 'Vermont'], [6001, 6999, 'Connecticut'],
  [7001, 8999, 'New Jersey'], [9001, 9899, 'Armed Forces'], [10001, 14999, 'New York'], [15001, 19699, 'Pennsylvania'],
  [19700, 19999, 'Delaware'], [20001, 20099, 'District of Columbia'], [20200, 20599, 'District of Columbia'],
  [20601, 21999, 'Maryland'], [24701, 26899, 'West Virginia'], [27001, 28999, 'North Carolina'],
  [29001, 29999, 'South Carolina'], [30001, 31999, 'Georgia'], [32001, 34999, 'Florida'], [35001, 36999, 'Alabama'],
  [37001, 38599, 'Tennessee'], [38601, 39799, 'Mississippi'], [39801, 39899, 'Georgia'], [40001, 42799, 'Kentucky'],
  [43001, 45999, 'Ohio'], [46001, 47999, 'Indiana'], [48001, 49999, 'Michigan'], [50001, 52899, 'Iowa'],
  [53001, 54999, 'Wisconsin'], [55001, 56799, 'Minnesota'], [57001, 57799, 'South Dakota'], [58000, 58899, 'North Dakota'],
  [59000, 59999, 'Montana'], [60001, 62999, 'Illinois'], [63001, 65899, 'Missouri'], [66001, 67999, 'Kansas'],
  [68001, 69399, 'Nebraska'], [70000, 71499, 'Louisiana'], [71601, 72999, 'Arkansas'], [73001, 74999, 'Oklahoma'],
  [75001, 79999, 'Texas'], [80000, 81699, 'Colorado'], [82001, 83199, 'Wyoming'], [83201, 83899, 'Idaho'],
  [84001, 84799, 'Utah'], [85001, 86599, 'Arizona'], [87001, 88499, 'New Mexico'], [88501, 88599, 'Texas'],
  [88901, 89999, 'Nevada'], [90001, 96199, 'California'], [96701, 96899, 'Hawaii'], [96901, 96999, 'Guam'],
  [97001, 97999, 'Oregon'], [98001, 99499, 'Washington'], [99501, 99999, 'Alaska'],
];

let prefixCenters: Record<string, LatLng> | null = null;
/** Average of the ZIP areas sharing a 3-digit prefix, for ZIPs with no area of their own (PO boxes). */
function prefixCenter(zip: string): LatLng | null {
  if (!prefixCenters) {
    const sums: Record<string, [number, number, number]> = {};
    for (const [z, [lat, lng]] of Object.entries(vaZips.zips)) {
      const p = z.slice(0, 3);
      const s = (sums[p] ||= [0, 0, 0]);
      s[0] += lat; s[1] += lng; s[2] += 1;
    }
    prefixCenters = Object.fromEntries(Object.entries(sums).map(([p, [a, b, n]]) => [p, [a / n, b / n] as LatLng]));
  }
  return prefixCenters[zip.slice(0, 3)] || null;
}

export function resolveZip(zip: string): ZipResult {
  const z = zip.trim();
  if (!/^\d{5}$/.test(z)) return { status: 'incomplete' };
  if (isVirginiaZip(z)) {
    const exact = vaZips.zips[z];
    if (exact) return { status: 'ok', coords: exact, precision: 'zip' };
    const area = prefixCenter(z);
    return area ? { status: 'ok', coords: area, precision: 'area' } : { status: 'ok', coords: VA_CENTER, precision: 'state' };
  }
  const n = Number(z);
  const hit = RANGES.find(([lo, hi]) => n >= lo && n <= hi);
  return hit ? { status: 'outside', state: hit[2] } : { status: 'invalid' };
}

/** A GPS reading more than 30 miles from every Virginia ZIP area is outside coverage. */
export function coverageOf(coords: LatLng): 'inside' | 'outside' {
  let best = Infinity;
  for (const c of Object.values(vaZips.zips)) {
    const d = milesBetween(coords, c);
    if (d < best) best = d;
    if (best < 5) break;
  }
  return best <= 30 ? 'inside' : 'outside';
}
