import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft, Camera, Check, ChevronRight, CircleAlert, CircleCheck, ClipboardList, Database, ExternalLink, Factory, Keyboard, Leaf,
  NotebookPen, Package, Plus, ScanBarcode, Search, ShieldCheck, TriangleAlert, WifiOff, X,
} from 'lucide-react';
import { Screen } from '../components/Screen';
import { Badge, Banner, Button, Card, Item, Stagger, cx } from '../components/ui';
import { Disclosure, ExtLink, SourceQuote, toast } from '../components/widgets';
import { useT } from '../app/i18n';
import { useApp } from '../state/store';
import { foods, ingredients, meta, type FoodDef, type IngredientRule } from '../engine/content';
import {
  evaluateProduct, gradeFood, gradeRule, searchLocal, validBarcode,
  type Evidence, type Grade, type LocalHit, type ProductGrade, type ProductInput, type ScanResult,
} from '../engine/scanner';
import { todayKey } from '../engine/diary';
import { bouncy, pop, rise, spring, stagger } from '../motion/presets';
import { areaBehind, decodeBarcodeImage, startBarcodeScan, takePicture } from '../platform/barcode';
import { lookupBarcode } from '../platform/off';
import { localProduct, productsMeta, searchProducts, warmProductSearch, type ProductHit } from '../platform/products';
import { formatNumber } from '../engine/format';
import { readBarcodeDigits, readIngredients } from '../platform/ocr';
import { haptic } from '../platform/native';
import { PreventTabs } from './Prevention';
import { IN_ARTIFACT } from '../platform/env';

type Mode =
  | { kind: 'home' }
  | { kind: 'camera' }
  | { kind: 'looking'; code: string }
  | { kind: 'notFound'; code: string; builtInOnly?: boolean }
  | { kind: 'offline' }
  /** A photo of an ingredient list: a barcode in it first, then the text, then the text turned. */
  | { kind: 'ocr'; progress: number; step: 'barcode' | 'text' | 'turned' }
  /** The photo read as noise: say so, never show it as ingredients. */
  | { kind: 'unreadable'; text: string }
  /** A photo of a barcode: first the bars, then the printed numbers under them. */
  | { kind: 'reading'; step: 'bars' | 'digits'; progress: number }
  | { kind: 'noBarcode' }
  | { kind: 'edit'; text: string }
  | { kind: 'search' }
  | { kind: 'result'; product: ProductInput; result: ScanResult };

/**
 * The camera shown inside the app, used on a computer (a phone hands the
 * picture to its own camera app instead). It reads a barcode by itself when
 * the picture is sharp, and Take picture sends the sharpest of a few frames
 * to the photo reader, which also tries the printed numbers.
 */
function CameraOverlay({ onCode, onClose, onPicture, onChoose }: {
  onCode: (c: string) => void; onClose: () => void; onPicture: (photos: Blob[]) => void; onChoose: () => void;
}) {
  const { t } = useT();
  const video = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'starting' | 'live' | 'denied' | 'nocamera'>('starting');
  const [hit, setHit] = useState(false);
  const [flash, setFlash] = useState(false);
  // Set once a picture is being taken or a code was read, so only one of them goes on.
  const busy = useRef(false);
  // The latest callback, so a parent re-render never restarts the camera.
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  useEffect(() => {
    let stop: (() => void) | null = null;
    let alive = true;
    (async () => {
      if (!video.current) return;
      const r = await startBarcodeScan(video.current, (code) => {
        if (busy.current) return;
        busy.current = true;
        setHit(true);
        haptic(40);
        setTimeout(() => onCodeRef.current(code), 380);
      });
      if (!alive) { if (r.ok) r.stop(); return; }
      if (r.ok) { stop = r.stop; setState('live'); } else setState(r.reason);
    })();
    return () => { alive = false; stop?.(); };
  }, []);

  const shoot = async () => {
    if (busy.current || !video.current) return;
    busy.current = true;
    setFlash(true);
    haptic(20);
    const area = box.current ? areaBehind(video.current, box.current) : undefined;
    const photos = await takePicture(video.current, area).catch(() => []);
    if (photos.length) onPicture(photos);
    else { busy.current = false; setFlash(false); }
  };

  return createPortal(
    <motion.div className="camera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label={t('scan.scanBarcode')}>
      <video ref={video} className="camera-video" playsInline muted />
      <div className="camera-shade" aria-hidden />
      <div ref={box} className={cx('viewfinder', hit && 'viewfinder-hit')} aria-hidden>
        {['tl', 'tr', 'bl', 'br'].map((c) => (
          <motion.span key={c} className={`vf vf-${c}`} animate={hit ? { scale: 0.9 } : { scale: [1, 1.06, 1] }} transition={hit ? bouncy : { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }} />
        ))}
        {!hit && state === 'live' && <span className="scanline" />}
        <AnimatePresence>{hit && <motion.span className="vf-check" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={bouncy}><Check size={48} /></motion.span>}</AnimatePresence>
      </div>
      <AnimatePresence>
        {flash && <motion.span className="camera-flash" aria-hidden initial={{ opacity: 0.85 }} animate={{ opacity: 0 }} transition={{ duration: 0.45 }} />}
      </AnimatePresence>
      <div className="camera-bottom">
        <p className="camera-hint" aria-live="polite">
          {state === 'starting' && t('scan.starting')}
          {state === 'live' && t('scan.pointCamera')}
          {state === 'denied' && t('scan.denied')}
          {state === 'nocamera' && t('scan.noCamera')}
        </p>
        {state === 'live' && (
          <>
            <motion.button type="button" className="camera-shutter" onClick={shoot} disabled={hit || flash} whileTap={{ scale: 0.94 }} transition={spring}>
              <span className="camera-shutter-ring" aria-hidden><span /></span>
              {t('scan.shutter')}
            </motion.button>
            <button type="button" className="camera-choose link-target" onClick={onChoose}>{t('scan.photoInstead')}</button>
          </>
        )}
        {(state === 'denied' || state === 'nocamera') && (
          <Button variant="primary" icon={<Camera size={20} aria-hidden />} onClick={onChoose}>{t('scan.photoInstead')}</Button>
        )}
        <p className="camera-privacy"><ShieldCheck size={14} aria-hidden /> {t('scan.privacyNote')}</p>
      </div>
      <button type="button" className="camera-close" onClick={onClose} aria-label={t('common.close')}><X size={24} /></button>
    </motion.div>,
    document.getElementById('sheet-root') || document.body,
  );
}

const GRADES: Grade[] = ['A', 'B', 'C', 'D', 'F'];
const EVIDENCE: Evidence[] = ['iarc1', 'iarc2A', 'wcrf', 'iarc2B', 'weight', 'limited'];

/** The grade letter in its color. Screen readers get the grade from the text beside it. */
function GradeDisc({ grade, size = 'md' }: { grade: Grade; size?: 'sm' | 'md' | 'lg' }) {
  return <span className={cx('grade-disc', `grade-disc-${size}`, `grade-${grade.toLowerCase()}`)} aria-hidden>{grade}</span>;
}

/**
 * The ingredient grade of a product: the letter, what it means, the scale,
 * each item that added points, and how the grade is worked out.
 */
function GradeCard({ grade }: { grade: ProductGrade | null }) {
  const { t, tx, list } = useT();
  const bands = ingredients.grade.bands;
  return (
    <Card variants={rise} className="grade-card">
      <p className="mini-label">{t('scan.grade.title')}</p>
      {!grade ? <p className="muted">{t('scan.grade.missing')}</p> : (
        <>
          <div className="grade-head">
            <motion.span initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...bouncy, delay: 0.2 }}>
              <GradeDisc grade={grade.grade} size="lg" />
            </motion.span>
            <div>
              <p className="grade-meaning"><span className="sr-only">{t('scan.grade.short', { grade: grade.grade })}. </span>{t(`scan.grade.meaning.${grade.grade}`)}</p>
              <p className="small muted">{t('scan.grade.points', { points: grade.points })}</p>
            </div>
          </div>
          <ol className="grade-scale" aria-hidden>
            {GRADES.map((g, i) => (
              <motion.li key={g} className={cx(`grade-${g.toLowerCase()}`, g === grade.grade && 'on')}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.25 + i * 0.05 }}>{g}</motion.li>
            ))}
          </ol>
          {grade.items.length > 0 ? (
            <ul className="grade-items">
              {grade.items.map((item, i) => (
                <li key={i}>
                  <span>
                    <strong>{item.rule ? tx(item.rule.label) : t('scan.grade.weightItem')}</strong>
                    <span className="small muted">{t(`scan.grade.evidence.${item.evidence}`)}</span>
                  </span>
                  <span className="grade-plus">+{item.points}</span>
                </li>
              ))}
            </ul>
          ) : <p className="small">{t('scan.grade.none')}</p>}
        </>
      )}
      <Disclosure summary={t('scan.grade.howTitle')}>
        <ul className="bullets">{list('scan.grade.how').map((line, i) => <li key={i}>{line}</li>)}</ul>
        <p className="mini-label">{t('scan.grade.pointsTitle')}</p>
        <ul className="grade-table">
          {EVIDENCE.map((e) => <li key={e}><span>{t(`scan.grade.evidence.${e}`)}</span><span className="grade-plus">+{ingredients.grade.points[e]}</span></li>)}
        </ul>
        <p className="mini-label">{t('scan.grade.gradesTitle')}</p>
        <ul className="grade-table">
          {bands.map(([g, from], i) => {
            const next = bands[i + 1];
            const range = !next ? t('scan.grade.rangeUp', { from }) : next[1] - 1 === from ? String(from) : t('scan.grade.range', { from, to: next[1] - 1 });
            return <li key={g}><span className="grade-band"><GradeDisc grade={g} size="sm" /> {t(`scan.grade.meaning.${g}`)}</span><span>{range}</span></li>;
          })}
        </ul>
      </Disclosure>
    </Card>
  );
}

function NovaMeter({ nova, estimated }: { nova: number | null; estimated: boolean }) {
  const { t } = useT();
  return (
    <div className="nova">
      <p className="mini-label"><Factory size={14} aria-hidden /> {t('scan.nova')}</p>
      <div className="nova-bar" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <motion.span key={i} className={cx('nova-seg', nova !== null && i <= nova && `on n${nova}`)} initial={{ scaleY: 0.2 }} animate={{ scaleY: 1 }} transition={{ ...bouncy, delay: 0.25 + i * 0.07 }} />
        ))}
      </div>
      <p>{nova ? t(`scan.novaNames.${nova}`) : t('scan.novaUnknown')}{estimated && <em className="muted"> · {t('scan.novaEstimated')}</em>}</p>
    </div>
  );
}

function RuleCard({ rule }: { rule: IngredientRule }) {
  const { t, tx } = useT();
  return (
    <Card className={cx('rule', rule.iarc === '1' || rule.iarc === '2A' ? 'rule-high' : rule.iarc === '2B' ? 'rule-mid' : rule.wcrf?.includes('decrease') || rule.wcrf === 'fiber' ? 'rule-good' : 'rule-mid')} variants={rise}>
      <h3>{tx(rule.label)}</h3>
      <p className="rule-class"><strong>{t('scan.classification')}:</strong> {tx(rule.classification)}</p>
      <SourceQuote quote={rule.quote} quoteEs={rule.quoteEs} source={rule.source.name} url={rule.source.url} />
      <p className="small"><strong>{t('scan.exposure')}:</strong> {tx(rule.exposure)}</p>
    </Card>
  );
}

/**
 * The Open Food Facts credit the ODbL asks for, with links to the project and
 * the license, wherever its product data is shown.
 */
function OffCredit({ className }: { className?: string }) {
  const { t } = useT();
  return (
    <motion.p variants={rise} className={cx('small muted off-credit', className)}>
      {t('scan.offCredit').split(/(\{off\}|\{license\})/).map((part, i) =>
        part === '{off}' ? <ExtLink key={i} href={meta.productData.url} className="link">{meta.productData.name}</ExtLink>
          : part === '{license}' ? <ExtLink key={i} href={meta.productData.licenseUrl} className="link">{meta.productData.license}</ExtLink>
            : part)}
    </motion.p>
  );
}

function ResultView({ product, result, onAgain }: { product: ProductInput; result: ScanResult; onAgain: () => void }) {
  const { t, tx } = useT();
  const bumpFood = useApp((s) => s.bumpFood);
  const [group, setGroup] = useState<string | null>(result.diary);
  const [added, setAdded] = useState(false);
  const foodOf = (id: string | null) => foods.foods.find((f) => f.id === id);
  const fromOff = product.source === 'off' || product.source === 'cache' || product.source === 'local';
  const add = () => {
    if (!group) return;
    bumpFood(todayKey(), group, 1);
    setAdded(true);
    haptic(20);
    toast(t('scan.added', { group: tx(foodOf(group)?.name) }));
  };
  return (
    <motion.div className="stack" variants={stagger(0.07)} initial="hidden" animate="show">
      <motion.div className={cx('verdict', `verdict-${result.label}`)} variants={pop}>
        <motion.span className="verdict-icon" initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...bouncy, delay: 0.15 }} aria-hidden>
          {result.label === 'limit' ? <TriangleAlert size={30} /> : result.label === 'moderation' ? <CircleAlert size={30} /> : <CircleCheck size={30} />}
        </motion.span>
        <div>
          <p className="verdict-product">{product.name || t('scan.unnamed')}{product.brand ? ` · ${product.brand}` : ''}</p>
          <p className="verdict-label">{t(`scan.labels.${result.label}`)}</p>
          {result.grade && (
            <p className="grade-chip"><GradeDisc grade={result.grade.grade} size="sm" /> {t('scan.grade.short', { grade: result.grade.grade })}</p>
          )}
          {product.code && <p className="barcode-read">{t('scan.barcodeIs', { code: product.code })}</p>}
          {product.source === 'cache' && <Badge tone="quiet">{t('scan.fromCache')}</Badge>}
          {product.source === 'local' && <Badge tone="quiet" icon={<Database size={12} aria-hidden />}>{t('scan.fromList')}</Badge>}
        </div>
      </motion.div>

      <GradeCard grade={result.grade} />

      <Card variants={rise}>
        <p className="mini-label">{t('scan.whyLabel')}</p>
        <ul className="bullets">{result.reasons.map((r) => <li key={r}>{t(`scan.reasons.${r}`)}</li>)}</ul>
        {result.sugarHigh && <p className="small warn-text"><TriangleAlert size={14} aria-hidden /> {t('scan.sugar')}</p>}
        {result.saltHigh && <p className="small warn-text"><TriangleAlert size={14} aria-hidden /> {t('scan.salt')}</p>}
        <NovaMeter nova={result.nova} estimated={result.novaEstimated} />
      </Card>

      {product.ingredientsText && (
        <Card variants={rise} className="ingredients-card">
          <Disclosure summary={t('scan.whatWeRead')} icon={<ClipboardList size={18} />}>
            <p className="ingredients-text">{product.ingredientsText}</p>
            {fromOff && <p className="small muted">{t('scan.offNote')}</p>}
          </Disclosure>
        </Card>
      )}

      {/* The ODbL credit, kept outside the disclosure so it is always in view. */}
      {fromOff && <OffCredit />}

      {result.hazards.length > 0 && (
        <motion.div className="stack-sm" variants={stagger(0.06)}>
          <p className="mini-label">{t('scan.flagged')}</p>
          {result.hazards.map((r) => <RuleCard key={r.id} rule={r} />)}
        </motion.div>
      )}
      {result.protective.length > 0 && (
        <motion.div className="stack-sm" variants={stagger(0.06)}>
          <p className="mini-label"><Leaf size={14} aria-hidden /> {t('scan.protective')}</p>
          {result.protective.map((r) => <RuleCard key={r.id} rule={r} />)}
        </motion.div>
      )}

      <Card variants={rise} className="add-diary">
        {!result.diary && (
          <>
            <p className="mini-label">{t('scan.pickGroup')}</p>
            <div className="chips-row">
              {foods.foods.map((f) => (
                <button key={f.id} type="button" className={cx('chip', group === f.id && 'chip-on')} aria-pressed={group === f.id} onClick={() => setGroup(f.id)}>{tx(f.name)}</button>
              ))}
            </div>
          </>
        )}
        <Button full disabled={!group || added} onClick={add} icon={added ? <Check size={20} aria-hidden /> : <NotebookPen size={20} aria-hidden />}>
          {added ? t('scan.added', { group: tx(foodOf(group)?.name) }) : t('scan.addDiary')}
        </Button>
      </Card>

      <motion.p variants={rise} className="fixed-note">{t('scan.note')}</motion.p>
      <motion.div variants={rise}><Button full variant="secondary" icon={<ScanBarcode size={20} aria-hidden />} onClick={onAgain}>{t('scan.again')}</Button></motion.div>
    </motion.div>
  );
}

function FoodHit({ food }: { food: FoodDef }) {
  const { t, tx, lang } = useT();
  const bumpFood = useApp((s) => s.bumpFood);
  return (
    <Card variants={rise} className={cx('food-hit', `food-${food.group}`)}>
      <h3 className="grade-band">
        <GradeDisc grade={gradeFood(food).grade} size="sm" />
        <span className="sr-only">{t('scan.grade.short', { grade: gradeFood(food).grade })}: </span>
        {tx(food.name)}
      </h3>
      <p className="small">{tx(food.level)} · {food.cancers[lang].join(', ')}</p>
      <div className="row-between">
        <ExtLink href={food.source.url} className="link small link-target">{food.source.org} <ExternalLink size={11} aria-hidden /></ExtLink>
        <Button size="sm" variant="secondary" icon={<Plus size={16} aria-hidden />} onClick={() => { bumpFood(todayKey(), food.id, 1); toast(t('scan.added', { group: tx(food.name) })); }}>{t('scan.addDiary')}</Button>
      </div>
    </Card>
  );
}

export function ScannerScreen() {
  const { t, tx, lang, list } = useT();
  const [mode, setMode] = useState<Mode>({ kind: 'home' });
  const [code, setCode] = useState('');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<LocalHit[]>([]);
  const [products, setProducts] = useState<ProductHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [draftText, setDraftText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const latest = useRef('');
  const edit = (text: string) => { setDraftText(text); setMode({ kind: 'edit', text }); };
  // Opens the phone's camera for one photo. Must run inside the tap itself.
  const takeBarcodePhoto = () => barcodeRef.current?.click();
  // Scan a barcode = take a picture of it. A phone (and the claude.ai preview,
  // which refuses a live camera) hands that to its own camera app, which
  // focuses up close. A computer has no camera app to hand off to, so the
  // camera is shown here with a Take picture button.
  const scanBarcode = () => {
    if (IN_ARTIFACT || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) takeBarcodePhoto();
    else setMode({ kind: 'camera' });
  };

  const lookup = async (raw: string) => {
    const c = raw.replace(/\D/g, '');
    if (!validBarcode(c)) return;
    setMode({ kind: 'looking', code: c });
    const r = await lookupBarcode(c);
    if (r.status === 'found') setMode({ kind: 'result', product: r.product, result: evaluateProduct(r.product) });
    else if (r.status === 'offline') setMode({ kind: 'offline' });
    else setMode({ kind: 'notFound', code: c, builtInOnly: r.status === 'notFound' && !!r.builtInOnly });
  };

  /** A product picked from the search results: always in the built-in list. */
  const openProduct = async (hit: ProductHit) => {
    setMode({ kind: 'looking', code: hit.code });
    const p = await localProduct(hit.code);
    if (p) setMode({ kind: 'result', product: p, result: evaluateProduct(p) });
    else setMode({ kind: 'notFound', code: hit.code });
  };

  // Products and the app's own ingredient list, searched as the person types.
  // Only the latest query's results are shown, however the loads finish.
  const search = (q: string) => {
    setQuery(q);
    setHits(searchLocal(q));
    latest.current = q;
    setSearching(true);
    searchProducts(q).then((found) => {
      if (latest.current !== q) return;
      setProducts(found);
      setSearching(false);
    }, () => setSearching(false));
  };
  useEffect(() => { if (mode.kind === 'search') warmProductSearch(); }, [mode.kind]);

  // A photo of an ingredient list. A barcode anywhere in it is the surest
  // answer: the product list has the full, clean ingredients. Otherwise the
  // label is read, and only a reading that looks like an ingredient list is
  // shown; noise gets a clear "could not read it" with tips instead.
  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setMode({ kind: 'ocr', progress: 0, step: 'barcode' });
    // A barcode seen by chance is used only if the product is on the phone:
    // the person asked to read a label, not to look a number up online.
    const inPhoto = await decodeBarcodeImage(file).catch(() => null);
    const known = inPhoto ? await localProduct(inPhoto) : null;
    if (known) {
      haptic(40);
      toast(t('scan.barcodeInPhoto'));
      setMode({ kind: 'result', product: known, result: evaluateProduct(known) });
      return;
    }
    let step: 'text' | 'turned' = 'text';
    setMode({ kind: 'ocr', progress: 0, step });
    try {
      const read = await readIngredients(file,
        (p) => setMode({ kind: 'ocr', progress: p, step }),
        (turn) => { step = turn === 0 ? 'text' : 'turned'; setMode({ kind: 'ocr', progress: 0, step }); });
      if (read.readable) edit(read.text);
      else setMode({ kind: 'unreadable', text: read.text });
    } catch {
      toast(t('scan.ocrFailed'), 'warn');
      setMode({ kind: 'unreadable', text: '' });
    }
  };

  // A photo of a barcode: the bars first; if they will not read, the numbers
  // printed under them. Either way the number then goes to the product list.
  // A picture from the computer's camera comes as two, the part in the box
  // and the whole frame, tried in that order.
  const onBarcodePhoto = async (photo: Blob | Blob[] | undefined) => {
    const photos = !photo ? [] : Array.isArray(photo) ? photo : [photo];
    if (!photos.length) return;
    setMode({ kind: 'reading', step: 'bars', progress: 0 });
    let found: string | null = null;
    for (const p of photos) {
      try { found = await decodeBarcodeImage(p); } catch { found = null; }
      if (found) break;
    }
    if (!found) {
      setMode({ kind: 'reading', step: 'digits', progress: 0 });
      for (const p of photos) {
        try {
          found = await readBarcodeDigits(p, (n) => setMode({ kind: 'reading', step: 'digits', progress: n }));
        } catch { found = null; }
        if (found) break;
      }
    }
    if (!found) { setMode({ kind: 'noBarcode' }); return; }
    haptic(40);
    setCode(found);
    lookup(found);
  };

  const check = (text: string) => {
    const product: ProductInput = { ingredientsText: text, source: 'ocr', name: '' };
    setMode({ kind: 'result', product, result: evaluateProduct(product) });
  };

  const fromRule = (rule: IngredientRule) => {
    const product: ProductInput = { ingredientsText: rule.words[0], name: tx(rule.label), source: 'typed' };
    setMode({ kind: 'result', product, result: evaluateProduct(product) });
  };

  const home = () => { setMode({ kind: 'home' }); setCode(''); };

  return (
    <Screen id="scan" title={t('scan.title')} lead={t('scan.lead')} top={<PreventTabs />}>
      <input ref={fileRef} id="photo-ingredients" type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden
        onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={barcodeRef} id="photo-barcode" type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden
        onChange={(e) => { onBarcodePhoto(e.target.files?.[0]); e.target.value = ''; }} />

      <AnimatePresence mode="wait">
        <motion.div key={mode.kind} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={spring}>
          {mode.kind === 'home' && (
            <Stagger className="stack">
              <Item>
                <motion.button type="button" className="scan-hero" whileTap={{ scale: 0.97 }} transition={spring} onClick={scanBarcode}>
                  <span className="scan-hero-art" aria-hidden>
                    <ScanBarcode size={54} />
                    <span className="scan-hero-line" />
                  </span>
                  <strong>{t('scan.scanBarcode')}</strong>
                  <span className="small">{IN_ARTIFACT ? t('scan.photoNote') : t('scan.privacyNote')}</span>
                </motion.button>
              </Item>
              <Item className="stack-sm">
                <Button full variant="secondary" icon={<Camera size={20} aria-hidden />} onClick={() => fileRef.current?.click()}>{t('scan.photo')}</Button>
                <Button full variant="secondary" icon={<Search size={20} aria-hidden />} onClick={() => setMode({ kind: 'search' })}>{t('scan.search')}</Button>
              </Item>
              <Item>
                <Card className="stack-sm">
                  <form className="zip-row barcode-row" onSubmit={(e) => { e.preventDefault(); lookup(code); }}>
                    <label className="sr-only" htmlFor="barcode">{t('scan.typeBarcode')}</label>
                    <span className="input-icon"><Keyboard size={18} aria-hidden /></span>
                    <input id="barcode" className="input input-with-icon" inputMode="numeric" placeholder={t('scan.barcodePlaceholder')} value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 14))} />
                    <Button type="submit" full disabled={!validBarcode(code)}>{t('scan.lookUp')}</Button>
                  </form>
                  <p className="small muted built-in"><Database size={15} aria-hidden /> {t('scan.builtIn', { n: formatNumber(productsMeta.count, lang) })}</p>
                  <OffCredit />
                  <button type="button" className="link small link-target" onClick={() => edit('')}>{t('scan.typeIngredients')}</button>
                </Card>
              </Item>
              <Item><p className="fixed-note">{t('scan.note')}</p></Item>
            </Stagger>
          )}

          {mode.kind === 'looking' && (
            <div className="stack" aria-busy="true" aria-live="polite">
              <p className="muted">{t('scan.looking')}</p>
              {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: i === 0 ? 96 : 64 }} />)}
            </div>
          )}

          {mode.kind === 'notFound' && (
            <Stagger className="stack">
              <Item><Banner tone="warn" icon={<CircleAlert size={20} />}>{mode.builtInOnly ? t('scan.notInList') : t('scan.notFound')}</Banner></Item>
              <Item><p className="small muted barcode-read">{t('scan.barcodeIs', { code: mode.code })}</p></Item>
              <Item><Button full icon={<Camera size={20} aria-hidden />} onClick={() => fileRef.current?.click()}>{t('scan.photo')}</Button></Item>
              <Item><Button full variant="secondary" icon={<Search size={20} aria-hidden />} onClick={() => setMode({ kind: 'search' })}>{t('scan.search')}</Button></Item>
              <Item><Button full variant="secondary" icon={<Keyboard size={20} aria-hidden />} onClick={() => edit('')}>{t('scan.typeIngredients')}</Button></Item>
              <Item><Button full variant="ghost" icon={<ArrowLeft size={20} aria-hidden />} onClick={home}>{t('common.back')}</Button></Item>
            </Stagger>
          )}

          {mode.kind === 'reading' && (
            <div className="stack reading" aria-busy="true" aria-live="polite">
              <motion.span className="reading-art" aria-hidden animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}>
                <ScanBarcode size={56} />
                <span className="scan-hero-line" />
              </motion.span>
              <p className="reading-text">{mode.step === 'bars' ? t('scan.readingBars') : t('scan.readingDigits')}</p>
              {mode.step === 'digits' && (
                <div className="progress-track"><motion.div className="progress-fill" animate={{ scaleX: Math.max(0.06, mode.progress) }} transition={spring} /></div>
              )}
            </div>
          )}

          {mode.kind === 'noBarcode' && (
            <Stagger className="stack">
              <Item><Banner tone="warn" icon={<CircleAlert size={20} />} title={t('scan.noBarcodeTitle')}>{t('scan.noBarcode')}</Banner></Item>
              <Item><Button full icon={<Camera size={20} aria-hidden />} onClick={scanBarcode}>{t('scan.photoAgain')}</Button></Item>
              <Item><Button full variant="secondary" icon={<Keyboard size={20} aria-hidden />} onClick={() => { home(); setTimeout(() => document.getElementById('barcode')?.focus(), 450); }}>{t('scan.typeNumbers')}</Button></Item>
              <Item><Button full variant="secondary" icon={<ClipboardList size={20} aria-hidden />} onClick={() => fileRef.current?.click()}>{t('scan.photo')}</Button></Item>
              <Item><Button full variant="ghost" icon={<ArrowLeft size={20} aria-hidden />} onClick={home}>{t('common.back')}</Button></Item>
            </Stagger>
          )}

          {mode.kind === 'offline' && (
            <Stagger className="stack">
              <Item><Banner tone="quiet" icon={<WifiOff size={20} />}>{t('scan.offline')}</Banner></Item>
              <Item><Button full icon={<Search size={20} aria-hidden />} onClick={() => setMode({ kind: 'search' })}>{t('scan.search')}</Button></Item>
              <Item><Button full variant="secondary" onClick={home}>{t('common.back')}</Button></Item>
            </Stagger>
          )}

          {mode.kind === 'ocr' && (
            <div className="stack" aria-live="polite">
              <p className="muted">
                {mode.step === 'barcode' ? t('scan.ocrBarcode')
                  : mode.step === 'turned' ? t('scan.ocrTurned')
                    : mode.progress > 0 ? t('scan.ocrReading') : t('scan.ocrLoading')}
              </p>
              <div className="progress-track"><motion.div className="progress-fill" animate={{ scaleX: Math.max(0.06, mode.progress) }} transition={spring} /></div>
            </div>
          )}

          {mode.kind === 'unreadable' && (
            <Stagger className="stack">
              <Item><Banner tone="warn" icon={<CircleAlert size={20} />} title={t('scan.unreadableTitle')}>{t('scan.unreadable')}</Banner></Item>
              <Item>
                <ul className="bullets tips">
                  {list('scan.photoTips').map((tip, i) => <li key={i}>{tip}</li>)}
                </ul>
              </Item>
              <Item><Button full icon={<Camera size={20} aria-hidden />} onClick={() => fileRef.current?.click()}>{t('scan.photoAgain')}</Button></Item>
              <Item><Button full variant="secondary" icon={<ScanBarcode size={20} aria-hidden />}
                onClick={scanBarcode}>{t('scan.tryBarcode')}</Button></Item>
              <Item><Button full variant="secondary" icon={<Keyboard size={20} aria-hidden />} onClick={() => edit('')}>{t('scan.typeIngredients')}</Button></Item>
              {mode.text && (
                <Item><button type="button" className="link small link-target" onClick={() => edit(mode.text)}>{t('scan.useAnyway')}</button></Item>
              )}
              <Item><Button full variant="ghost" icon={<ArrowLeft size={20} aria-hidden />} onClick={home}>{t('common.back')}</Button></Item>
            </Stagger>
          )}

          {mode.kind === 'edit' && (
            <Stagger className="stack">
              <Item><p>{mode.text ? t('scan.ocrCheck') : t('scan.typeIngredients')}</p></Item>
              <Item>
                <label className="sr-only" htmlFor="ingredients">{t('scan.typeIngredients')}</label>
                <textarea id="ingredients" className="input textarea" rows={7} value={draftText} onChange={(e) => setDraftText(e.target.value)} />
              </Item>
              <Item className="scan-alt">
                <Button variant="secondary" icon={<ArrowLeft size={20} aria-hidden />} onClick={home}>{t('common.back')}</Button>
                <Button icon={<Check size={20} aria-hidden />} disabled={!draftText.trim()} onClick={() => check(draftText)}>{t('scan.ocrButton')}</Button>
              </Item>
            </Stagger>
          )}

          {mode.kind === 'search' && (
            <Stagger className="stack">
              <Item>
                <form className="zip-row" onSubmit={(e) => { e.preventDefault(); search(query); }}>
                  <label className="sr-only" htmlFor="q">{t('scan.search')}</label>
                  <span className="input-icon"><Search size={18} aria-hidden /></span>
                  <input id="q" className="input input-with-icon" autoFocus placeholder={t('scan.searchPlaceholder')} value={query}
                    onChange={(e) => search(e.target.value)} />
                </form>
                <p className="small muted">{t('scan.localTitle')}</p>
              </Item>
              <div aria-live="polite" className="sr-only">{searching ? t('scan.searching') : ''}</div>
              {products.length > 0 && query.trim().length >= 2 && (
                <motion.section className="stack-sm" aria-labelledby="products-title" variants={stagger(0.04)} initial="hidden" animate="show" key={products.map((p) => p.code).join()}>
                  <motion.p id="products-title" className="mini-label" variants={rise}><Package size={14} aria-hidden /> {t('scan.productsTitle')}</motion.p>
                  {products.map((p) => (
                    <motion.button key={p.code} type="button" className="product-hit" variants={rise} whileTap={{ scale: 0.98 }} onClick={() => openProduct(p)}>
                      {p.grade && <GradeDisc grade={p.grade} size="sm" />}
                      <span className="product-hit-text">
                        {p.grade && <span className="sr-only">{t('scan.grade.short', { grade: p.grade })}: </span>}
                        <strong>{p.name}</strong>
                        {p.brand && <span className="small muted">{p.brand}</span>}
                      </span>
                      <ChevronRight size={20} aria-hidden />
                    </motion.button>
                  ))}
                  <OffCredit />
                </motion.section>
              )}
              <motion.div className="stack-sm" variants={stagger(0.05)} initial="hidden" animate="show" key={query}>
                {hits.length > 0 && products.length > 0 && <motion.p className="mini-label" variants={rise}><Leaf size={14} aria-hidden /> {t('scan.foodsTitle')}</motion.p>}
                {hits.map((h, i) => h.kind === 'food'
                  ? <FoodHit key={`f${i}`} food={h.food} />
                  : (
                    <Card key={`r${i}`} interactive variants={rise} onClick={() => fromRule(h.rule)} role="button" tabIndex={0} className="rule-hit">
                      <div className="row-between">
                        <span className="grade-band">
                          <GradeDisc grade={gradeRule(h.rule).grade} size="sm" />
                          <span className="sr-only">{t('scan.grade.short', { grade: gradeRule(h.rule).grade })}: </span>
                          <strong>{tx(h.rule.label)}</strong>
                        </span>
                        <Badge tone={h.label === 'limit' ? 'danger' : h.label === 'moderation' ? 'warn' : 'ok'}>{t(`scan.labels.${h.label}`)}</Badge>
                      </div>
                      <p className="small">{tx(h.rule.classification)}</p>
                    </Card>
                  ))}
                {query.trim().length >= 2 && hits.length === 0 && products.length === 0 && !searching && <p className="muted">{t('scan.noMatch')}</p>}
              </motion.div>
              <Item><Button full variant="ghost" icon={<ArrowLeft size={20} aria-hidden />} onClick={home}>{t('common.back')}</Button></Item>
            </Stagger>
          )}

          {mode.kind === 'result' && <ResultView product={mode.product} result={mode.result} onAgain={home} />}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {mode.kind === 'camera' && (
          <CameraOverlay onClose={home} onCode={(c) => lookup(c)} onPicture={(photos) => onBarcodePhoto(photos)} onChoose={() => { takeBarcodePhoto(); home(); }} />
        )}
      </AnimatePresence>
    </Screen>
  );
}
