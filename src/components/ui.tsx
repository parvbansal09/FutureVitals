import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { motion, type HTMLMotionProps, type Variants } from 'motion/react';
import { LoaderCircle } from 'lucide-react';
import { rise, spring, stagger } from '../motion/presets';
import { haptic } from '../platform/native';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'quiet' | 'danger' | 'warn';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: BtnVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  iconRight?: ReactNode;
  full?: boolean;
  loading?: boolean;
  children?: ReactNode;
  shine?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon, iconRight, full, loading, className, children, shine, onClick, disabled, ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type="button"
      className={cx('btn', `btn-${variant}`, `btn-${size}`, full && 'btn-full', shine && 'btn-shine', className)}
      whileTap={disabled ? undefined : { scale: 0.965 }}
      whileHover={disabled ? undefined : { y: -1 }}
      transition={spring}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onClick={(e) => {
        haptic(8);
        onClick?.(e);
      }}
      {...rest}
    >
      {loading ? <LoaderCircle className="spin" size={20} aria-hidden /> : icon}
      {children !== undefined && <span className="btn-label">{children}</span>}
      {iconRight}
    </motion.button>
  );
});

export function IconButton({ label, children, className, ...rest }: { label: string; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      className={cx('icon-btn', className)}
      whileTap={{ scale: 0.88 }}
      transition={spring}
      {...(rest as HTMLMotionProps<'button'>)}
    >
      {children}
    </motion.button>
  );
}

type Tone = 'default' | 'accent' | 'warn' | 'danger' | 'quiet' | 'ok';

export function Card({ tone = 'default', interactive, className, children, ...rest }: { tone?: Tone; interactive?: boolean } & HTMLMotionProps<'div'>) {
  return (
    <motion.div
      className={cx('card', `card-${tone}`, interactive && 'card-interactive', className)}
      whileTap={interactive ? { scale: 0.985 } : undefined}
      transition={spring}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function Badge({ tone = 'default', icon, children, className }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cx('badge', `badge-${tone}`, className)}>
      {icon}
      <span>{children}</span>
    </span>
  );
}

export function Banner({ tone = 'accent', icon, title, children, action, className }: {
  tone?: Tone; icon?: ReactNode; title?: ReactNode; children?: ReactNode; action?: ReactNode; className?: string;
}) {
  return (
    <motion.div
      className={cx('banner', `banner-${tone}`, className)}
      role={tone === 'danger' || tone === 'warn' ? 'alert' : 'status'}
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring}
    >
      {icon && <div className="banner-icon" aria-hidden>{icon}</div>}
      <div className="banner-body">
        {title && <p className="banner-title">{title}</p>}
        {children && <div className="banner-text">{children}</div>}
        {action && <div className="banner-action">{action}</div>}
      </div>
    </motion.div>
  );
}

export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx('kicker', className)}>{children}</p>;
}

export function SectionTitle({ title, lead, icon, count, tone, id }: { title: ReactNode; lead?: ReactNode; icon?: ReactNode; count?: number; tone?: Tone; id?: string }) {
  return (
    <motion.div className={cx('section-title', tone && `section-${tone}`)} variants={rise}>
      <h2 id={id}>
        {icon && <span className="section-icon" aria-hidden>{icon}</span>}
        <span>{title}</span>
        {typeof count === 'number' && <span className="section-count">{count}</span>}
      </h2>
      <motion.span className="section-rule" aria-hidden initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ ...spring, delay: 0.1 }} />
      {lead && <p className="section-lead">{lead}</p>}
    </motion.div>
  );
}

export function Stagger({ children, className, step = 0.05, delay = 0.04, inView, as = 'div', ...rest }: {
  children: ReactNode; className?: string; step?: number; delay?: number; inView?: boolean; as?: 'div' | 'ul' | 'ol' | 'section';
} & Omit<HTMLMotionProps<'div'>, 'children'>) {
  const M = motion[as] as typeof motion.div;
  const props = inView
    ? { initial: 'hidden', whileInView: 'show', viewport: { once: true, amount: 0.15 } }
    : { initial: 'hidden', animate: 'show' };
  return (
    <M className={className} variants={stagger(step, delay)} {...props} {...rest}>
      {children}
    </M>
  );
}

export function Item({ children, className, variants = rise, as = 'div', ...rest }: {
  children: ReactNode; className?: string; variants?: Variants; as?: 'div' | 'li' | 'section' | 'article';
} & Omit<HTMLMotionProps<'div'>, 'children'>) {
  const M = motion[as] as typeof motion.div;
  return (
    <M className={className} variants={variants} {...rest}>
      {children}
    </M>
  );
}

export function VisuallyHidden({ children, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return <span className="sr-only" {...rest}>{children}</span>;
}

export function Divider() {
  return <hr className="divider" />;
}
