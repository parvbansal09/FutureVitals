// Find a clinic: filtering and ordering. A filter only matches a site when the
// directory says yes. An unknown (null) never counts as a yes, so a filter
// cannot send someone to a place that was never confirmed to offer it.
import { clinics, type Clinic, type ClinicType } from './content';
import { roadMiles, type LatLng } from './geo';
import type { ClinicTest } from './types';

export interface ClinicFilters {
  tests: ClinicTest[];
  uninsured: boolean;
  sliding: boolean;
  ewl: boolean;
  medicaid: boolean;
  spanish: boolean;
  bus: boolean;
  hours: boolean;
}

export const noFilters = (): ClinicFilters => ({
  tests: [], uninsured: false, sliding: false, ewl: false, medicaid: false, spanish: false, bus: false, hours: false,
});

export const filterCount = (f: ClinicFilters) =>
  f.tests.length + [f.uninsured, f.sliding, f.ewl, f.medicaid, f.spanish, f.bus, f.hours].filter(Boolean).length;

export interface ClinicHit {
  site: Clinic;
  miles: number | null;
}

// Where someone can actually be screened comes before treatment centers when
// no location is known. Labs and offices are not in the directory at all.
const TYPE_ORDER: ClinicType[] = ['massey', 'fqhc', 'free', 'healthdept', 'resource', 'hospital', 'cancer', 'specialist'];
const SCREENING_TYPES: ClinicType[] = ['massey', 'fqhc', 'free', 'healthdept'];

export function matchesFilters(s: Clinic, f: ClinicFilters): boolean {
  if (f.tests.length && !f.tests.some((t) => s.tests.includes(t))) return false;
  if (f.uninsured && s.cost.uninsured !== true) return false;
  if (f.sliding && s.cost.slidingScale !== true) return false;
  if (f.ewl && s.cost.ewl !== true) return false;
  if (f.medicaid && s.cost.medicaid !== true) return false;
  if (f.spanish && !(s.language.spanish === true || s.language.interpreter === true)) return false;
  if (f.bus && s.bus !== true) return false;
  if (f.hours && !(s.evening === true || s.weekend === true)) return false;
  return true;
}

export function findClinics(origin: LatLng | null, f: ClinicFilters, only?: string[]): ClinicHit[] {
  const list = clinics.sites
    .filter((s) => (only ? only.includes(s.id) : true))
    .filter((s) => matchesFilters(s, f))
    .map((site) => ({ site, miles: origin ? roadMiles(origin, [site.lat, site.lng]) : null }));
  list.sort((a, b) =>
    (a.miles !== null && b.miles !== null ? Math.round(a.miles) - Math.round(b.miles) : 0)
    || TYPE_ORDER.indexOf(a.site.type) - TYPE_ORDER.indexOf(b.site.type)
    || (a.miles ?? 0) - (b.miles ?? 0)
    || a.site.name.localeCompare(b.site.name));
  return list;
}

/** The two closest Massey or partner screening sites, for the home screen. */
export function nearestScreening(origin: LatLng, n = 2): ClinicHit[] {
  return clinics.sites
    .filter((s) => SCREENING_TYPES.includes(s.type) && (s.tests.length > 0 || s.type !== 'massey'))
    .map((site) => ({ site, miles: roadMiles(origin, [site.lat, site.lng]) }))
    .sort((a, b) => (a.miles as number) - (b.miles as number))
    .slice(0, n);
}

export const daysSince = (iso: string, now = new Date()) =>
  Math.floor((now.getTime() - new Date(iso + 'T12:00:00').getTime()) / 86400000);

export const isStale = (s: Clinic, now = new Date()) => daysSince(s.verified, now) > clinics.staleAfterDays;
export const anyStale = (now = new Date()) => clinics.sites.some((s) => isStale(s, now));

export const clinicById = (id: string) => clinics.sites.find((s) => s.id === id);

export const telHref = (phone: string) => {
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length <= 3) return `tel:${digits}`;
  return `tel:+1${digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits}`;
};

export const mapsHref = (s: Clinic) =>
  'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${s.name}, ${s.address}, ${s.city}, VA ${s.zip}`);
