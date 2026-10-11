// Content files name their icons with plain words ("calendar", "leaf"), so a
// non-developer can pick one. This maps those words to the icon set.
import {
  Calendar, Cigarette, Flame, FlaskConical, Footprints, House, Leaf, Mail, Salad, Scale, Stethoscope, Sun,
  Syringe, Users, Wallet, Wine, CircleQuestionMark, type LucideIcon,
} from 'lucide-react';

const MAP: Record<string, LucideIcon> = {
  calendar: Calendar,
  stethoscope: Stethoscope,
  leaf: Leaf,
  users: Users,
  flask: FlaskConical,
  wallet: Wallet,
  mail: Mail,
  cigarette: Cigarette,
  wine: Wine,
  scale: Scale,
  footprints: Footprints,
  salad: Salad,
  syringe: Syringe,
  sun: Sun,
  house: House,
  flame: Flame,
};

export function Icon({ name, size = 22, strokeWidth = 1.8, className }: { name: string; size?: number; strokeWidth?: number; className?: string }) {
  const I = MAP[name] || CircleQuestionMark;
  return <I size={size} strokeWidth={strokeWidth} className={className} aria-hidden />;
}
