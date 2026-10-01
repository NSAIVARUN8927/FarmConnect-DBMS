import { useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ChangeEvent, type FormEvent, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, BarChart3, Check,
  CircleHelp, ClipboardList, Compass, CreditCard, Filter, Globe2,
  Handshake, ImagePlus, Leaf, LoaderCircle, LogOut, MapPin, Menu, MessageSquare,
  Package, Pencil, Plus, Search, ShieldCheck, Sprout, Store, Trash2, Truck, UserRound,
  X,
} from 'lucide-react';
import {
  useCompleteMyProfile, useCreateDemoPayment, useCreateFarm, useCreateNegotiation,
  useCreateOrder, useCreateProduct, useDeleteFarm, useDeleteProduct, useGetDashboard,
  useGetMarketplaceOverview, useGetMyProfile, useGetProduct, useListConversations,
  useListFarms, useListMessages, useListNegotiations, useListOrders, useListProducts,
  useRequestUploadUrl, useRespondToNegotiation, useSendMessage, useStartConversation,
  useUpdateFarm, useUpdateOrderStatus, useUpdateProduct,
  getGetDashboardQueryKey, getGetMarketplaceOverviewQueryKey,
  getGetMyProfileQueryKey, getGetProductQueryKey, getListConversationsQueryKey,
  getListFarmsQueryKey, getListMessagesQueryKey, getListNegotiationsQueryKey,
  getListOrdersQueryKey, getListProductsQueryKey,
} from '@workspace/api-client-react';
import type {
  Farm, FarmInput, FarmUpdate, Negotiation, Order, Product, ProductInput, ProductUpdate, UserProfile,
} from '@workspace/api-client-react';
import { Route, Switch, Link, Router as WouterRouter, useLocation, useParams } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import BusinessBillingPage from '@/components/business-billing-page';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 20_000, retry: 1, refetchOnWindowFocus: false } },
});
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const categories = ['Grains & pulses', 'Vegetables', 'Fruits', 'Spices', 'Dairy', 'Other'];

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}
function money(amount: number | null | undefined) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount ?? 0);
}
function dateLabel(value?: string | null) {
  if (!value) return 'Not specified';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}
function prettyStatus(status: string) {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function Button({ children, variant = 'primary', className = '', ...props }: {
  children: ReactNode; variant?: 'primary' | 'secondary' | 'quiet' | 'danger'; className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    quiet: 'bg-transparent text-foreground hover:bg-muted',
    danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  };
  return <button className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`} {...props}>{children}</button>;
}
function IconButton({ label, children, className = '', ...props }: { label: string; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button aria-label={label} title={label} className={`inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-45 ${className}`} {...props}>{children}</button>;
}
function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="grid gap-1.5 text-sm font-semibold text-foreground">{label}{children}{hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}</label>;
}
const fieldClass = 'h-11 w-full rounded-lg border border-input bg-card px-3 text-sm font-normal outline-none placeholder:text-muted-foreground/75 focus:border-primary focus:ring-2 focus:ring-primary/15';
function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldClass} ${props.className ?? ''}`} />;
}
function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${fieldClass} ${props.className ?? ''}`} />;
}
function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`min-h-24 w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm font-normal outline-none placeholder:text-muted-foreground/75 focus:border-primary focus:ring-2 focus:ring-primary/15 ${props.className ?? ''}`} />;
}
function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-wrap items-end justify-between gap-4 animate-rise"><div><p className="mono-type mb-2 text-[10px] font-semibold uppercase tracking-[.22em] text-accent">{eyebrow}</p><h1 className="display-type text-4xl leading-[1.05] text-foreground sm:text-5xl">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p></div>{action}</div>;
}
function LoadingBlock({ label = 'Loading your workspace' }: { label?: string }) {
  return <div className="animate-pulse space-y-4" role="status" aria-label={label}><div className="h-8 w-52 rounded bg-muted" /><div className="h-4 w-80 max-w-full rounded bg-muted" /><div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><div className="h-40 rounded-2xl bg-muted" /><div className="h-40 rounded-2xl bg-muted" /><div className="h-40 rounded-2xl bg-muted" /></div><span className="sr-only">{label}</span></div>;
}
function QueryError({ retry, title = 'We couldn’t load this view' }: { retry: () => void; title?: string }) {
  return <div className="rounded-2xl border border-accent/30 bg-accent/5 p-6" role="alert"><p className="font-semibold">{title}</p><p className="mt-1 text-sm text-muted-foreground">Check your connection, then try again.</p><Button variant="secondary" className="mt-4" onClick={retry}>Try again</Button></div>;
}
function EmptyState({ icon: Icon = Package, title, body, action }: { icon?: typeof Package; title: string; body: string; action?: ReactNode }) {
  return <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center"><span className="mb-4 grid size-12 place-items-center rounded-2xl bg-secondary text-primary"><Icon size={21} /></span><h3 className="display-type text-2xl">{title}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{body}</p>{action && <div className="mt-5">{action}</div>}</div>;
}
function Modal({ title, description, onClose, children, wide = false }: { title: string; description?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);
  return <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[hsl(160_20%_10%/.55)] p-0 backdrop-blur-[3px] sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className={`max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border border-border bg-background p-5 shadow-2xl sm:rounded-2xl sm:p-7 ${wide ? 'max-w-2xl' : 'max-w-xl'}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title"><header className="mb-6 flex justify-between gap-4"><div><h2 id="dialog-title" className="display-type text-3xl">{title}</h2>{description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}</div><IconButton label="Close dialog" onClick={onClose}><X size={19} /></IconButton></header>{children}</section></div>;
}
function StatusPill({ status }: { status: string }) {
  const good = ['available', 'completed', 'successful', 'accepted', 'ready'].includes(status);
  const warm = ['pending', 'payment pending', 'payment_pending', 'countered', 'processing', 'confirmed'].includes(status);
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${good ? 'bg-primary/10 text-primary' : warm ? 'bg-accent/12 text-accent' : 'bg-muted text-muted-foreground'}`} data-testid={`status-${status}`}>{prettyStatus(status)}</span>;
}
function ProductArtwork({ product, className = '' }: { product: Pick<Product, 'name' | 'category' | 'imageUrl'>; className?: string }) {
  return <div className={`relative overflow-hidden bg-[#d8d3b5] ${className}`}>{product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" /> : <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(ellipse_at_75%_20%,#e9d391_0,transparent_42%),linear-gradient(155deg,#d4d6b4_0%,#a9b398_53%,#7c967f_100%)]"><div className="absolute -bottom-8 left-[-5%] h-[44%] w-[110%] rounded-[50%] bg-[#466858]/45" /><div className="absolute -bottom-10 left-[18%] h-[52%] w-[95%] rounded-[50%] bg-[#526f5c]/55" /><div className="relative z-10 grid size-16 place-items-center rounded-full border border-white/40 bg-white/30 text-[#234638] backdrop-blur-sm"><Leaf size={27} strokeWidth={1.4} /></div></div>}<span className="absolute left-3 top-3 rounded-full bg-background/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-foreground backdrop-blur">{product.category}</span></div>;
}
function Brand({ inverse = false }: { inverse?: boolean }) {
  return <Link href="/" className="group inline-flex items-center gap-2.5" aria-label="Farm Connect home" data-testid="link-brand-home"><span className={`grid size-9 place-items-center rounded-xl ${inverse ? 'bg-accent text-white' : 'bg-primary text-primary-foreground'}`}><Sprout size={19} /></span><span className={`display-type text-[22px] leading-none ${inverse ? 'text-background' : 'text-foreground'}`}>farm<span className="text-accent">connect</span></span></Link>;
}
function PublicHeader() {
  const { isSignedIn } = useAuth();
  return <header className="relative z-10 mx-auto flex w-full max-w-[1440px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12"><Brand /><nav className="hidden items-center gap-8 text-sm font-semibold text-foreground/75 md:flex"><Link href="/marketplace" className="transition hover:text-accent">Marketplace</Link><a href="#how-it-works" className="transition hover:text-accent">How it works</a><a href="#for-everyone" className="transition hover:text-accent">For farmers & buyers</a></nav><div className="flex items-center gap-2">{isSignedIn ? <Link href="/dashboard" className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground">Go to workspace <ArrowRight size={15} /></Link> : <><Link href="/sign-in" className="hidden rounded-lg px-3 py-2 text-sm font-bold hover:bg-muted sm:inline-flex">Sign in</Link><Link href="/sign-up" className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground">Join Farm Connect <ArrowRight size={15} /></Link></>}</div></header>;
}
function PublicFooter() {
  return <footer className="border-t border-border/70 bg-background px-5 py-8 sm:px-8"><div className="mx-auto flex max-w-[1280px] flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"><Brand /><p className="text-xs text-muted-foreground">A clearer way to bring good produce to market.</p><span className="mono-type text-[10px] uppercase tracking-[.18em] text-muted-foreground">Built for the people who grow food</span></div></footer>;
}

function LandingPage() {
  const { isLoaded, isSignedIn } = useAuth();
  if (isLoaded && isSignedIn) return <SignedInHome />;
  return <main className="min-h-[100dvh] overflow-hidden bg-background">
    <div className="relative bg-[#193a31] text-[#f6f0df]">
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(ellipse at 18% 80%, #c9945a 0, transparent 32%), repeating-linear-gradient(115deg, transparent 0 36px, rgba(229,215,176,.08) 37px 38px)' }} />
      <PublicHeader />
      <section className="relative mx-auto grid max-w-[1440px] items-center gap-8 px-5 pb-16 pt-10 sm:px-8 md:min-h-[590px] md:grid-cols-[1.05fr_.95fr] md:pb-24 md:pt-14 lg:px-12">
        <div className="animate-rise max-w-2xl"><p className="mono-type mb-6 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.25em] text-[#dca876]"><span className="size-1.5 rounded-full bg-[#dca876]" /> India's produce, moving with purpose</p><h1 className="display-type text-[clamp(3.45rem,8vw,7.2rem)] leading-[.9] tracking-[-.055em]">Good food.<br /><em className="font-medium text-[#dcaa77]">Fair terms.</em><br />Direct from<br className="hidden sm:block" /> the source.</h1><p className="mt-7 max-w-lg text-base leading-7 text-[#e0e2d6]/80 sm:text-lg">A dependable place for farmers and produce buyers to find each other, agree clearly, and get the next order moving.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/marketplace" className="inline-flex h-12 items-center gap-2 rounded-lg bg-[#dba873] px-5 text-sm font-bold text-[#193a31] transition hover:bg-[#ebbc8a]">Explore the marketplace <ArrowRight size={16} /></Link><Link href="/sign-up" className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/25 px-5 text-sm font-bold text-white transition hover:bg-white/10">Join as a farmer or buyer</Link></div><div className="mt-10 flex items-center gap-3 text-xs text-[#e0e2d6]/70"><ShieldCheck size={16} className="text-[#dba873]" /> Profiles, conversations and orders in one clear place</div></div>
        <div className="relative mx-auto mt-2 aspect-[.93] w-full max-w-[510px] animate-rise delay-2 md:mt-0"><div className="absolute inset-[5%] rounded-[48%_52%_44%_56%/48%_42%_58%_52%] border border-[#dba873]/45 bg-[radial-gradient(ellipse_at_50%_35%,#acbd8c_0,#6c8b70_38%,#315c4a_76%)] shadow-[0_35px_90px_rgba(0,0,0,.24)]" /><div className="absolute inset-[13%_14%_15%_16%] overflow-hidden rounded-[49%_51%_40%_60%/44%_51%_49%_56%] border border-[#f5e6c9]/25"><div className="absolute inset-0 bg-[linear-gradient(160deg,transparent_28%,rgba(221,175,115,.45)_28.3%,transparent_28.8%),linear-gradient(170deg,transparent_42%,rgba(221,175,115,.45)_42.3%,transparent_42.8%),linear-gradient(180deg,transparent_56%,rgba(221,175,115,.45)_56.3%,transparent_56.8%),linear-gradient(190deg,transparent_70%,rgba(221,175,115,.45)_70.3%,transparent_70.8%),linear-gradient(200deg,transparent_84%,rgba(221,175,115,.45)_84.3%,transparent_84.8%)] opacity-80" /><div className="absolute left-[48%] top-[18%] h-[27%] w-[27%] rounded-full bg-[#edce8e]/90 blur-[1px]" /><div className="absolute bottom-0 left-0 right-0 h-[38%] bg-[linear-gradient(180deg,transparent,#1f493a/70)]" /><div className="absolute bottom-7 left-7 flex items-center gap-3 rounded-xl border border-white/20 bg-[#15392f]/80 px-4 py-3 backdrop-blur-md"><span className="grid size-9 place-items-center rounded-full bg-[#dba873] text-[#193a31]"><Leaf size={18} /></span><span><span className="block text-[10px] uppercase tracking-widest text-white/60">Rooted in the land</span><span className="mt-0.5 block text-sm font-semibold">Trade that starts at the farm</span></span></div></div><div className="absolute right-0 top-[14%] rounded-xl border border-[#e1d0aa]/20 bg-[#f4edda] p-4 text-[#193a31] shadow-xl sm:right-[-1%]"><p className="mono-type text-[9px] uppercase tracking-widest text-[#65816f]">A better way to sell</p><div className="mt-2 flex items-center gap-2"><span className="grid size-8 place-items-center rounded-full bg-[#dde5d5] text-[#365f4d]"><Handshake size={16} /></span><span className="text-sm font-bold">Direct & dependable</span></div></div><div className="absolute bottom-[16%] left-0 rounded-xl border border-[#e1d0aa]/20 bg-[#f4edda] p-4 text-[#193a31] shadow-xl"><p className="mono-type text-[9px] uppercase tracking-widest text-[#65816f]">From harvest to handoff</p><p className="mt-1 text-xl font-bold">One clear journey <ArrowDownRight className="ml-1 inline" size={17} /></p></div></div>
      </section>
      <div className="relative border-t border-white/15"><div className="mx-auto grid max-w-[1440px] grid-cols-2 divide-x divide-white/15 px-5 sm:px-8 md:grid-cols-4 lg:px-12">{[['farmers', 'Farmers'], ['businesses', 'Buying businesses'], ['products', 'Available listings'], ['transactions', 'Transactions']].map(([key, label]) => <OverviewCount key={key} overviewKey={key as 'farmers' | 'businesses' | 'products' | 'transactions'} label={label} />)}</div></div>
    </div>
    <section className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 md:py-28 lg:px-12"><div className="mb-10 flex flex-wrap items-end justify-between gap-6"><div><p className="mono-type mb-3 text-[10px] uppercase tracking-[.24em] text-accent">Fresh from the network</p><h2 className="display-type text-4xl sm:text-5xl">See what's moving.</h2><p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">Real listings from farmers and farms on Farm Connect. Open a listing to view the details and start a conversation.</p></div><Link href="/marketplace" className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-accent">Browse all produce <ArrowRight size={16} /></Link></div><FeaturedProducts /></section>
    <section id="how-it-works" className="border-y border-border bg-[#eee9d9] px-5 py-20 sm:px-8 md:py-24"><div className="mx-auto max-w-[1280px]"><p className="mono-type text-[10px] uppercase tracking-[.24em] text-accent">A practical way to work together</p><div className="mt-4 grid gap-10 md:grid-cols-[.78fr_1.22fr]"><h2 className="display-type max-w-md text-4xl leading-tight sm:text-5xl">From first hello to fulfilled order.</h2><div className="grid gap-0 sm:grid-cols-3">{[['01', 'Find the right produce', 'Search by category, location and growing practices. See quantity, quality and harvest details up front.'], ['02', 'Agree directly', 'Start a conversation or propose a price and quantity. Keep the terms visible to both sides.'], ['03', 'Track what comes next', 'Orders, payment status and fulfillment updates live together in one dependable record.']].map(([n, title, body]) => <article key={n} className="border-t border-border py-5 sm:mr-6"><span className="mono-type text-xs text-accent">{n}</span><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p></article>)}</div></div></div></section>
    <section id="for-everyone" className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 md:py-28 lg:px-12"><div className="grid gap-4 md:grid-cols-[1fr_1fr]"><article className="relative overflow-hidden rounded-2xl bg-primary p-7 text-primary-foreground sm:p-10"><p className="mono-type text-[10px] uppercase tracking-[.22em] text-[#dbb37f]">For farmers</p><h2 className="display-type mt-5 max-w-sm text-4xl leading-tight">The value of your harvest, clearly seen.</h2><p className="mt-4 max-w-md text-sm leading-6 text-primary-foreground/75">Show what is ready, set clear terms and speak directly with the people looking to buy.</p><Link href="/sign-up" className="mt-7 inline-flex items-center gap-2 rounded-lg bg-background px-4 py-3 text-sm font-bold text-primary">Set up your farm <ArrowRight size={15} /></Link><Sprout className="absolute -bottom-8 -right-4 size-48 rotate-[-28deg] text-white/10" strokeWidth={1} /></article><article className="relative overflow-hidden rounded-2xl border border-border bg-[#e4dfca] p-7 sm:p-10"><p className="mono-type text-[10px] uppercase tracking-[.22em] text-accent">For produce buyers</p><h2 className="display-type mt-5 max-w-sm text-4xl leading-tight">A more direct line to good produce.</h2><p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">Compare available supply, talk through quantities, and keep every order on record.</p><Link href="/marketplace" className="mt-7 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground">Find your next supplier <ArrowRight size={15} /></Link><Globe2 className="absolute -bottom-8 -right-4 size-48 rotate-[-18deg] text-primary/10" strokeWidth={1} /></article></div></section>
    <section className="bg-[#193a31] px-5 py-16 text-center text-[#f6f0df] sm:px-8 md:py-20"><p className="mono-type text-[10px] uppercase tracking-[.24em] text-[#dba873]">A steadier market starts here</p><h2 className="display-type mx-auto mt-4 max-w-3xl text-4xl leading-tight sm:text-6xl">Make the next good connection.</h2><Link href="/marketplace" className="mt-7 inline-flex h-12 items-center gap-2 rounded-lg bg-[#dba873] px-5 text-sm font-bold text-[#193a31]">Explore Farm Connect <ArrowRight size={16} /></Link></section>
    <PublicFooter />
  </main>;
}
function OverviewCount({ overviewKey, label }: { overviewKey: 'farmers' | 'businesses' | 'products' | 'transactions'; label: string }) {
  const query = useGetMarketplaceOverview();
  const value = query.data?.[overviewKey];
  return <div className="py-5 pl-3 sm:pl-6 md:py-6"><p className="mono-type text-[9px] uppercase tracking-[.2em] text-white/55 sm:text-[10px]">{label}</p><p className="mt-1.5 display-type text-3xl sm:text-4xl">{query.isLoading ? '—' : value?.toLocaleString('en-IN') ?? '—'}</p></div>;
}
function FeaturedProducts() {
  const { data, isLoading, isError, refetch } = useGetMarketplaceOverview();
  if (isLoading) return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((index) => <div key={index} className="h-64 animate-pulse rounded-2xl bg-muted" />)}</div>;
  if (isError) return <QueryError retry={() => { void refetch(); }} title="Featured produce is not available right now" />;
  const products = data?.featuredProducts ?? [];
  if (!products.length) return <EmptyState title="The next harvest starts here" body="There are no featured listings just yet. Browse the marketplace to see what is available." action={<Link href="/marketplace" className="text-sm font-bold text-primary">Open marketplace</Link>} />;
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{products.slice(0, 4).map((product) => <ProductCard key={product.id} product={product} />)}</div>;
}
function ProductCard({ product }: { product: Product }) {
  return <Link href={`/products/${product.id}`} className="group overflow-hidden rounded-2xl border border-border bg-card transition duration-300 hover:-translate-y-1 hover:shadow-md" data-testid={`card-product-${product.id}`}><ProductArtwork product={product} className="h-44" /><div className="p-4"><div className="flex items-start justify-between gap-2"><h3 className="display-type text-2xl leading-tight group-hover:text-primary">{product.name}</h3>{product.organic && <span className="mt-1 shrink-0 text-[9px] font-bold uppercase tracking-widest text-primary">Organic</span>}</div><p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={12} />{product.location}</p><div className="mt-4 flex items-end justify-between border-t border-border pt-3"><p className="text-lg font-bold">{money(product.pricePerUnit)}<span className="ml-1 text-xs font-normal text-muted-foreground">/ {product.unit}</span></p><span className="text-xs text-muted-foreground">{product.quantity.toLocaleString('en-IN')} {product.unit} available</span></div></div></Link>;
}

function SignedInHome() {
  const [, setLocation] = useLocation();
  const profile = useGetMyProfile({ query: { queryKey: getGetMyProfileQueryKey() } });
  useEffect(() => {
    if (profile.data) setLocation(profile.data.role ? '/dashboard' : '/onboarding', { replace: true });
  }, [profile.data, setLocation]);
  if (profile.isError) return <main className="mx-auto max-w-xl px-5 py-20"><QueryError retry={() => { void profile.refetch(); }} title="Your workspace could not be opened" /></main>;
  return <main className="grid min-h-[100dvh] place-items-center bg-background p-6"><LoadingBlock label="Opening your Farm Connect workspace" /></main>;
}

function MarketplacePage() {
  const [search, setSearch] = useState('');
  const [draftSearch, setDraftSearch] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocationFilter] = useState('');
  const [organic, setOrganic] = useState(false);
  const params = useMemo(() => ({ search: search || undefined, category: category || undefined, location: location || undefined, organic: organic || undefined, limit: 50 }), [search, category, location, organic]);
  const query = useListProducts(params);
  const submitSearch = (event: FormEvent) => { event.preventDefault(); setSearch(draftSearch.trim()); };
  const reset = () => { setDraftSearch(''); setSearch(''); setCategory(''); setLocationFilter(''); setOrganic(false); };
  return <main className="min-h-[100dvh] bg-background"><PublicHeader /><div className="mx-auto max-w-[1440px] px-5 pb-20 pt-8 sm:px-8 lg:px-12"><PageTitle eyebrow="The Farm Connect marketplace" title="Find what's in season." description="Search available produce from farmers across India. Clear quantities, quality notes and prices help you decide what to discuss next." /><form onSubmit={submitSearch} className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"><div className="grid gap-3 md:grid-cols-[minmax(220px,1.45fr)_1fr_1fr_auto]"><label className="relative block"><span className="sr-only">Search produce or farm</span><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} /><TextInput placeholder="Search produce, farm or farmer" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} className="pl-10" data-testid="input-marketplace-search" /></label><label><span className="sr-only">Filter by category</span><SelectInput aria-label="Filter by category" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Every category</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</SelectInput></label><label><span className="sr-only">Filter by location</span><TextInput placeholder="Location or state" value={location} onChange={(event) => setLocationFilter(event.target.value)} aria-label="Filter by location" /></label><Button type="submit"><Search size={16} />Search</Button></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3"><label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={organic} onChange={(event) => setOrganic(event.target.checked)} className="size-4 accent-[hsl(var(--primary))]" /> Organic listings</label><div className="flex items-center gap-3"><span className="mono-type inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground"><Filter size={12} /> Filters update results</span><button type="button" onClick={reset} className="text-xs font-semibold text-primary underline-offset-4 hover:underline">Clear filters</button></div></div></form><div className="mb-4 mt-8 flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground" aria-live="polite">{query.isLoading ? 'Finding available produce…' : `${query.data?.length ?? 0} available ${query.data?.length === 1 ? 'listing' : 'listings'}`}</p><span className="mono-type text-[10px] uppercase tracking-widest text-muted-foreground">Direct from farms</span></div>{query.isLoading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="h-72 animate-pulse rounded-2xl bg-muted" />)}</div> : query.isError ? <QueryError retry={() => { void query.refetch(); }} /> : query.data?.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{query.data.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <EmptyState icon={Compass} title="No listings match those filters" body="Try a wider search, choose another category or clear your filters to see all available produce." action={<Button variant="secondary" onClick={reset}>Clear all filters</Button>} />}</div><PublicFooter /></main>;
}

function ProductPage() {
  const params = useParams<{ productId: string }>();
  const productId = Number(params.productId);
  const auth = useAuth();
  const query = useGetProduct(productId, { query: { queryKey: getGetProductQueryKey(productId), enabled: Number.isFinite(productId) && productId > 0 } });
  const profile = useGetMyProfile({ query: { queryKey: getGetMyProfileQueryKey(), enabled: !!auth.isSignedIn } });
  const [, setLocation] = useLocation();
  const client = useQueryClient();
  const [orderOpen, setOrderOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [quantity, setQuantity] = useState('25');
  const [notes, setNotes] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const order = useCreateOrder();
  const negotiation = useCreateNegotiation();
  const startConversation = useStartConversation();
  const { toast, message, clear } = useToastSafe();
  const signedInProfile = auth.isSignedIn ? profile : null;
  const signInRequired = () => setLocation('/sign-in');
  function openOrder() { if (!auth.isSignedIn) return signInRequired(); setOrderOpen(true); }
  function openOffer() { if (!auth.isSignedIn) return signInRequired(); setOfferOpen(true); }
  function submitOrder(event: FormEvent) {
    event.preventDefault();
    order.mutate({ data: { productId, quantity: Number(quantity), notes: notes || null } }, { onSuccess: (created) => {
      void client.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      void client.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      void client.invalidateQueries({ queryKey: getGetProductQueryKey(productId) });
      setOrderOpen(false); toast({ title: 'Order placed', description: `Order #${created.id} is ready to track.` });
    }, onError: () => toast({ title: 'Order could not be placed', description: 'Check the available quantity and try again.', variant: 'destructive' }) });
  }
  function submitOffer(event: FormEvent) {
    event.preventDefault();
    negotiation.mutate({ data: { productId, quantity: Number(quantity), proposedPrice: Number(offerPrice) } }, { onSuccess: () => {
      void client.invalidateQueries({ queryKey: getListNegotiationsQueryKey() });
      void client.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      setOfferOpen(false); toast({ title: 'Offer sent', description: 'Your proposed terms are now in negotiations.' });
    }, onError: () => toast({ title: 'Offer could not be sent', description: 'Please check the quantity and price and try again.', variant: 'destructive' }) });
  }
  function messageFarmer() {
    if (!auth.isSignedIn) return signInRequired();
    startConversation.mutate({ data: { productId } }, { onSuccess: () => {
      void client.invalidateQueries({ queryKey: getListConversationsQueryKey() }); setLocation('/messages');
    }, onError: () => toast({ title: 'Conversation could not be started', description: 'Please try again in a moment.', variant: 'destructive' }) });
  }
  if (query.isLoading) return <main className="min-h-[100dvh] bg-background"><PublicHeader /><div className="mx-auto max-w-6xl p-6 pt-14"><LoadingBlock label="Loading produce details" /></div></main>;
  if (query.isError || !query.data) return <main className="min-h-[100dvh] bg-background"><PublicHeader /><div className="mx-auto max-w-4xl px-5 py-12"><QueryError retry={() => { void query.refetch(); }} title="We couldn’t find this produce listing" /></div><PublicFooter /></main>;
  const product = query.data;
  const ownListing = signedInProfile?.data?.id === product.farmerId;
  return <main className="min-h-[100dvh] bg-background"><PublicHeader /><div className="mx-auto max-w-[1280px] px-5 pb-20 pt-8 sm:px-8"><Link href="/marketplace" className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary"><ArrowLeft size={15} /> Marketplace</Link><div className="grid gap-8 lg:grid-cols-[1.15fr_.85fr]"><ProductArtwork product={product} className="min-h-[320px] rounded-2xl sm:min-h-[500px]" /><section className="flex flex-col"><div className="flex items-start justify-between gap-4"><div><p className="mono-type text-[10px] uppercase tracking-[.2em] text-accent">{product.category}</p><h1 className="display-type mt-3 text-5xl leading-none sm:text-6xl">{product.name}</h1></div><StatusPill status={product.available ? 'available' : 'unavailable'} /></div><p className="mt-5 text-base leading-7 text-muted-foreground">{product.description || 'The farmer has not added a description yet.'}</p><div className="mt-7 grid grid-cols-2 gap-y-5 border-y border-border py-5"><div><span className="mono-type text-[9px] uppercase tracking-widest text-muted-foreground">Price per {product.unit}</span><p className="mt-1 text-2xl font-bold">{money(product.pricePerUnit)}</p></div><div><span className="mono-type text-[9px] uppercase tracking-widest text-muted-foreground">Available quantity</span><p className="mt-1 text-2xl font-bold">{product.quantity.toLocaleString('en-IN')} <span className="text-sm font-normal text-muted-foreground">{product.unit}</span></p></div><div><span className="mono-type text-[9px] uppercase tracking-widest text-muted-foreground">Growing practice</span><p className="mt-1 flex items-center gap-1.5 text-sm font-semibold">{product.organic && <Leaf size={14} className="text-primary" />}{product.organic ? 'Organic' : 'Conventional'}</p></div><div><span className="mono-type text-[9px] uppercase tracking-widest text-muted-foreground">Harvest date</span><p className="mt-1 text-sm font-semibold">{dateLabel(product.harvestDate)}</p></div><div className="col-span-2"><span className="mono-type text-[9px] uppercase tracking-widest text-muted-foreground">Delivery origin</span><p className="mt-1 flex items-center gap-1.5 text-sm font-semibold"><MapPin size={14} />{product.location}</p></div></div>{(product.cropVariety || product.plantingDate || product.cultivationMethod || product.growthStage || product.storageNotes) && <section className="crop-detail-panel mt-5 rounded-2xl border border-primary/15 bg-secondary/45 p-5"><p className="mono-type text-[9px] uppercase tracking-[.18em] text-primary">From the farmer</p><h2 className="display-type mt-1 text-2xl">Crop details</h2><div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">{product.cropVariety && <div><span className="mono-type text-[9px] uppercase tracking-widest text-muted-foreground">Variety</span><p className="mt-1 text-sm font-semibold">{product.cropVariety}</p></div>}{product.plantingDate && <div><span className="mono-type text-[9px] uppercase tracking-widest text-muted-foreground">Planted</span><p className="mt-1 text-sm font-semibold">{dateLabel(product.plantingDate)}</p></div>}{product.cultivationMethod && <div><span className="mono-type text-[9px] uppercase tracking-widest text-muted-foreground">Cultivation</span><p className="mt-1 text-sm font-semibold">{product.cultivationMethod}</p></div>}{product.growthStage && <div><span className="mono-type text-[9px] uppercase tracking-widest text-muted-foreground">Growth stage</span><p className="mt-1 text-sm font-semibold">{product.growthStage}</p></div>}</div>{product.storageNotes && <p className="mt-4 border-t border-primary/10 pt-3 text-sm leading-6 text-muted-foreground"><strong className="text-foreground">Storage & handling:</strong> {product.storageNotes}</p>}</section>}<div className="mt-6 rounded-2xl border border-border bg-card p-5"><p className="mono-type text-[9px] uppercase tracking-[.18em] text-muted-foreground">Grown by</p><div className="mt-3 flex items-center gap-3"><span className="grid size-11 place-items-center rounded-full bg-secondary text-primary"><UserRound size={19} /></span><div><p className="font-bold">{product.farmerName}</p><p className="mt-0.5 text-xs text-muted-foreground">{product.farmName || 'Independent farmer'} · {product.location}</p></div><BadgeCheck className="ml-auto text-primary" size={19} /></div>{product.quality && <p className="mt-4 border-t border-border pt-3 text-sm text-muted-foreground">Quality note: <span className="font-medium text-foreground">{product.quality}</span></p>}</div><div className="mt-auto grid gap-2 pt-6 sm:grid-cols-3">{ownListing ? <Button variant="secondary" onClick={() => setLocation('/farms')} className="sm:col-span-3"><Pencil size={16} />Manage your listing</Button> : <><Button onClick={openOrder} disabled={!product.available || order.isPending} className="sm:col-span-2">{order.isPending ? <LoaderCircle className="animate-spin" size={16} /> : <ClipboardList size={16} />}Place an order</Button><Button variant="secondary" onClick={openOffer} disabled={!product.available}><Handshake size={16} />Make an offer</Button><Button variant="quiet" onClick={messageFarmer} disabled={startConversation.isPending} className="sm:col-span-3"><MessageSquare size={16} />{startConversation.isPending ? 'Opening conversation…' : `Message ${product.farmerName}`}</Button></>}</div></section></div></div><PublicFooter />
    {orderOpen && <Modal title="Place an order" description={`Request ${product.name} from ${product.farmerName}.`} onClose={() => setOrderOpen(false)}><form className="grid gap-4" onSubmit={submitOrder}><Field label={`Quantity (${product.unit})`}><TextInput type="number" min="0.01" max={product.quantity} step="any" required value={quantity} onChange={(event) => setQuantity(event.target.value)} /></Field><Field label="Note for the farmer"><TextArea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Delivery timing, packing or other details" maxLength={500} /></Field><div className="rounded-lg bg-muted p-3 text-sm">Estimated total <strong className="float-right">{money(Number(quantity) * product.pricePerUnit)}</strong></div><Button type="submit" disabled={order.isPending}>{order.isPending ? 'Placing order…' : 'Confirm order request'}</Button></form></Modal>}
     {offerOpen && <Modal title="Propose your terms" description="A clear counter-price starts a direct negotiation." onClose={() => setOfferOpen(false)}><form className="grid gap-4" onSubmit={submitOffer}><Field label={`Quantity (${product.unit})`}><TextInput type="number" min="0.01" max={product.quantity} step="any" required value={quantity} onChange={(event) => setQuantity(event.target.value)} /></Field><Field label={`Your price per ${product.unit}`}><TextInput type="number" min="0.01" step="any" required value={offerPrice} onChange={(event) => setOfferPrice(event.target.value)} placeholder={String(product.pricePerUnit)} /></Field><p className="text-xs text-muted-foreground">Current asking price: {money(product.pricePerUnit)} per {product.unit}.</p><Button type="submit" disabled={negotiation.isPending}>{negotiation.isPending ? 'Sending offer…' : 'Send offer'}</Button></form></Modal>}
    <Notice notice={message} clear={clear} />
  </main>;
}

function useToastSafe() {
  // Toaster ships with the scaffold; a local feedback fallback keeps API errors visible.
  const [message, setMessage] = useState<{ title: string; description?: string; variant?: string } | null>(null);
  const toast = ({ title, description, variant }: { title: string; description?: string; variant?: 'destructive' }) => {
    if (!title) { setMessage(null); return; }
    setMessage({ title, description, variant });
    window.setTimeout(() => setMessage(null), 4800);
  };
  return { toast, message, clear: () => setMessage(null) };
}
function Notice({ notice, clear }: { notice: ReturnType<typeof useToastSafe>['message']; clear: () => void }) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => setDismissed(false), [notice?.title, notice?.description]);
  if (!notice || dismissed) return null;
  return <div role="status" className={`fixed bottom-5 right-5 z-[70] max-w-sm rounded-xl border p-4 shadow-xl ${notice.variant === 'destructive' ? 'border-destructive/30 bg-card' : 'border-primary/25 bg-card'}`}><div className="flex items-start gap-3"><span className={`mt-0.5 ${notice.variant === 'destructive' ? 'text-destructive' : 'text-primary'}`}>{notice.variant === 'destructive' ? <CircleHelp size={18} /> : <Check size={18} />}</span><div><p className="text-sm font-bold">{notice.title}</p>{notice.description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{notice.description}</p>}</div><IconButton label="Dismiss notification" onClick={() => { setDismissed(true); clear(); }}><X size={15} /></IconButton></div></div>;
}

function AppOnboarding() {
  const [, setLocation] = useLocation();
  const auth = useAuth();
  const profile = useGetMyProfile({ query: { queryKey: getGetMyProfileQueryKey(), enabled: !!auth.isSignedIn && auth.isLoaded } });
  const complete = useCompleteMyProfile();
  const client = useQueryClient();
  const [role, setRole] = useState<'farmer' | 'business'>('farmer');
  const [displayName, setDisplayName] = useState('');
  const [location, setLocationValue] = useState('');
  const [businessName, setBusinessName] = useState('');
  const toastState = useToastSafe();
  useEffect(() => {
    if (auth.isLoaded && !auth.isSignedIn) setLocation('/sign-in', { replace: true });
    if (profile.data?.role) setLocation('/dashboard', { replace: true });
    if (profile.data) { setDisplayName(profile.data.displayName ?? ''); setLocationValue(profile.data.location ?? ''); setBusinessName(profile.data.businessName ?? ''); }
  }, [auth.isLoaded, auth.isSignedIn, profile.data, setLocation]);
  function submit(event: FormEvent) {
    event.preventDefault();
    complete.mutate({ data: { role, displayName: displayName.trim(), location: location.trim(), businessName: role === 'business' ? businessName.trim() || null : null } }, { onSuccess: () => {
      void client.invalidateQueries({ queryKey: getGetMyProfileQueryKey() }); void client.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); setLocation('/dashboard');
    }, onError: () => toastState.toast({ title: 'We could not save your profile', description: 'Review the details and try again.', variant: 'destructive' }) });
  }
  if (!auth.isLoaded || !auth.isSignedIn || profile.isLoading) return <main className="grid min-h-[100dvh] place-items-center p-6"><LoadingBlock label="Preparing your profile" /></main>;
  if (profile.isError) return <main className="mx-auto max-w-xl px-5 py-20"><QueryError retry={() => { void profile.refetch(); }} title="We couldn’t prepare your profile" /></main>;
  return <main className="grid min-h-[100dvh] bg-background lg:grid-cols-[.75fr_1.25fr]"><aside className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between"><Brand inverse /><div className="relative z-10"><p className="mono-type text-[10px] uppercase tracking-[.24em] text-[#dcaa77]">A good place to begin</p><h1 className="display-type mt-4 max-w-xl text-6xl leading-[.98]">First, tell us how you work.</h1><p className="mt-5 max-w-md text-sm leading-6 text-primary-foreground/70">We'll set up the right tools around the way you grow or buy produce.</p></div><p className="mono-type text-[10px] uppercase tracking-widest text-primary-foreground/50">Farm Connect · Profile setup</p><Sprout className="absolute -bottom-16 right-[-12%] size-[360px] rotate-[-28deg] text-white/5" strokeWidth={.7} /></aside><section className="flex flex-col justify-center px-5 py-12 sm:px-10 lg:px-[10%]"><div className="mb-10 lg:hidden"><Brand /></div><div className="mx-auto w-full max-w-xl"><p className="mono-type text-[10px] uppercase tracking-[.22em] text-accent">Your account, your terms</p><h2 className="display-type mt-3 text-4xl sm:text-5xl">Set up your profile.</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Choose the role that fits your work. You can start with either a farm or a buying business.</p><form onSubmit={submit} className="mt-8 grid gap-5"><div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => setRole('farmer')} aria-pressed={role === 'farmer'} className={`rounded-xl border p-4 text-left transition ${role === 'farmer' ? 'border-primary bg-primary/5 ring-2 ring-primary/15' : 'border-border bg-card hover:border-primary/40'}`}><span className="grid size-9 place-items-center rounded-lg bg-secondary text-primary"><Sprout size={18} /></span><span className="mt-3 block font-bold">I grow produce</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">Manage farms and list your harvest.</span></button><button type="button" onClick={() => setRole('business')} aria-pressed={role === 'business'} className={`rounded-xl border p-4 text-left transition ${role === 'business' ? 'border-primary bg-primary/5 ring-2 ring-primary/15' : 'border-border bg-card hover:border-primary/40'}`}><span className="grid size-9 place-items-center rounded-lg bg-secondary text-primary"><Store size={18} /></span><span className="mt-3 block font-bold">I buy produce</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">Find suppliers and manage orders.</span></button></div><Field label="Your name"><TextInput required minLength={2} maxLength={100} value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" /></Field>{role === 'business' && <Field label="Business name"><TextInput required maxLength={140} value={businessName} onChange={(event) => setBusinessName(event.target.value)} /></Field>}<Field label="Location" hint="City, district or state"><TextInput required maxLength={160} value={location} onChange={(event) => setLocationValue(event.target.value)} placeholder="For example, Nashik, Maharashtra" /></Field><Button type="submit" disabled={complete.isPending} className="mt-1 w-full">{complete.isPending ? 'Saving your profile…' : 'Continue to your workspace'}<ArrowRight size={16} /></Button></form><div className="mt-7 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck size={15} className="text-primary" />You can update these details later.</div></div></section><Notice notice={toastState.message} clear={() => toastState.toast({ title: '' })} /></main>;
}

type WorkspacePageName = 'dashboard' | 'farms' | 'orders' | 'negotiations' | 'messages' | 'billing';
function WorkspacePage({ page }: { page: WorkspacePageName }) {
  const auth = useAuth();
  const [, setLocation] = useLocation();
  const profile = useGetMyProfile({ query: { queryKey: getGetMyProfileQueryKey(), enabled: !!auth.isSignedIn && auth.isLoaded } });
  useEffect(() => {
    if (auth.isLoaded && !auth.isSignedIn) setLocation('/sign-in', { replace: true });
    if (auth.isSignedIn && profile.data && !profile.data.role) setLocation('/onboarding', { replace: true });
    if (auth.isSignedIn && page === 'billing' && profile.data?.role && profile.data.role !== 'business') setLocation('/dashboard', { replace: true });
  }, [auth.isLoaded, auth.isSignedIn, profile.data, setLocation]);
  if (profile.isError) return <main className="mx-auto max-w-xl px-5 py-20"><QueryError retry={() => { void profile.refetch(); }} title="Your profile could not be loaded" /></main>;
  if (!auth.isLoaded || !auth.isSignedIn || profile.isLoading || !profile.data?.role) return <main className="grid min-h-[100dvh] place-items-center p-6"><LoadingBlock label="Checking your Farm Connect access" /></main>;
  return <WorkspaceShell profile={profile.data} page={page} />;
}
const workspaceNav: { page: WorkspacePageName; label: string; icon: typeof BarChart3 }[] = [
  { page: 'dashboard', label: 'Overview', icon: BarChart3 },
  { page: 'farms', label: 'Farms & listings', icon: Sprout },
  { page: 'orders', label: 'Orders', icon: ClipboardList },
  { page: 'negotiations', label: 'Negotiations', icon: Handshake },
  { page: 'messages', label: 'Messages', icon: MessageSquare },
  { page: 'billing', label: 'Farmer billing', icon: CreditCard },
];
function WorkspaceShell({ profile, page }: { profile: UserProfile; page: WorkspacePageName }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const admin = profile.role === 'admin';
  return <div className="min-h-[100dvh] bg-background md:grid md:grid-cols-[250px_minmax(0,1fr)]"><aside className={`fixed inset-y-0 left-0 z-40 flex w-[275px] flex-col bg-[#193a31] px-5 py-6 text-[#f5efdf] transition-transform md:sticky md:top-0 md:h-[100dvh] md:w-auto md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}><div className="flex items-center justify-between"><Brand inverse /><IconButton label="Close navigation" className="md:hidden" onClick={() => setMobileOpen(false)}><X size={18} /></IconButton></div><div className="mt-10"><p className="mono-type mb-3 px-3 text-[9px] uppercase tracking-[.22em] text-white/40">Workspace</p><nav className="grid gap-1">{workspaceNav.filter(({ page: target }) => target !== 'billing' || profile.role === 'business').map(({ page: target, label, icon: Icon }) => <Link key={target} href={`/${target}`} onClick={() => setMobileOpen(false)} className={`flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition ${page === target ? 'bg-[#dba873] text-[#193a31]' : 'text-white/70 hover:bg-white/10 hover:text-white'}`} data-testid={`nav-${target}`}><Icon size={17} />{label}{page === target && <span className="ml-auto size-1.5 rounded-full bg-[#193a31]" />}</Link>)}</nav></div><div className="mt-auto rounded-xl border border-white/10 bg-white/5 p-4"><p className="mono-type text-[9px] uppercase tracking-[.18em] text-white/45">Your profile</p><p className="mt-2 truncate text-sm font-bold">{profile.displayName}</p><p className="mt-1 truncate text-xs capitalize text-white/60">{profile.role} · {profile.location || 'Location not set'}</p><button type="button" onClick={() => void signOut({ redirectUrl: basePath || '/' })} className="mt-4 flex items-center gap-2 text-xs font-semibold text-white/65 hover:text-white"><LogOut size={14} />Sign out</button></div></aside>{mobileOpen && <button className="fixed inset-0 z-30 bg-black/35 md:hidden" aria-label="Close navigation overlay" onClick={() => setMobileOpen(false)} />}<div className="min-w-0"><header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-border bg-background/92 px-4 backdrop-blur-md sm:px-7"><div className="flex items-center gap-3"><IconButton label="Open navigation menu" className="md:hidden" onClick={() => setMobileOpen(true)}><Menu size={20} /></IconButton><p className="display-type text-xl sm:text-2xl">{admin ? 'Market overview' : page === 'dashboard' ? 'Your workspace' : workspaceNav.find((item) => item.page === page)?.label}</p></div><div className="flex items-center gap-3"><Link href="/marketplace" className="hidden items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary sm:flex"><Compass size={14} />Browse marketplace</Link><span className="grid size-9 place-items-center rounded-full bg-secondary text-sm font-bold text-primary" aria-label={`${profile.displayName} profile`}>{profile.displayName.slice(0, 1).toUpperCase()}</span></div></header><main className="mx-auto max-w-[1480px] p-5 sm:p-7 lg:p-10">{page === 'dashboard' && <DashboardPage profile={profile} />}{page === 'farms' && <FarmsPage profile={profile} />}{page === 'orders' && <OrdersPage profile={profile} />}{page === 'negotiations' && <NegotiationsPage profile={profile} />}{page === 'messages' && <MessagesPage profile={profile} />}{page === 'billing' && profile.role === 'business' && <BusinessBillingPage />}</main></div></div>;
}

function DashboardPage({ profile }: { profile: UserProfile }) {
  const summary = useGetDashboard({ query: { queryKey: getGetDashboardQueryKey() } });
  const overview = useGetMarketplaceOverview();
  if (summary.isLoading) return <LoadingBlock label="Loading dashboard data" />;
  if (summary.isError || !summary.data) return <QueryError retry={() => { void summary.refetch(); }} title="Your dashboard is unavailable" />;
  const data = summary.data;
  const isAdmin = profile.role === 'admin';
  const metrics: [string, string, ReactNode][] = isAdmin ? [
    ['Farmers', overview.data?.farmers?.toLocaleString('en-IN') ?? '—', <Sprout key="farmers" size={17} />],
    ['Buying businesses', overview.data?.businesses?.toLocaleString('en-IN') ?? '—', <Store key="businesses" size={17} />],
    ['Available products', overview.data?.products?.toLocaleString('en-IN') ?? '—', <Package key="products" size={17} />],
    ['Recorded transactions', overview.data?.transactions?.toLocaleString('en-IN') ?? '—', <ClipboardList key="transactions" size={17} />],
  ] : [
    ['Active orders', String(data.activeOrders), <Truck key="orders" size={17} />],
    ['Completed orders', String(data.completedOrders), <Check key="completed" size={17} />],
    [profile.role === 'farmer' ? 'Live listings' : 'Pending offers', String(profile.role === 'farmer' ? data.listings : data.pendingNegotiations), profile.role === 'farmer' ? <Package key="listings" size={17} /> : <Handshake key="offers" size={17} />],
    [profile.role === 'farmer' ? 'Farm records' : 'Sales tracked', profile.role === 'farmer' ? String(data.farms) : money(data.salesValue), profile.role === 'farmer' ? <Sprout key="farms" size={17} /> : <BarChart3 key="sales" size={17} />],
  ];
  return <><PageTitle eyebrow={`${profile.role === 'admin' ? 'Marketplace analytics' : `Good to see you, ${profile.displayName.split(' ')[0]}`}`} title={profile.role === 'admin' ? 'The market, at a glance.' : 'A clear view of what’s next.'} description={profile.role === 'admin' ? 'Live marketplace counts and transaction activity from the Farm Connect network.' : profile.role === 'farmer' ? 'Your farms, conversations and orders in one place. Keep the next handoff moving.' : 'Your sourcing activity, offers and orders at a glance.'} action={<Link href="/marketplace" className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold hover:border-primary/40"><Search size={15} />Find produce</Link>} /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value, icon], index) => <article key={label} className={`animate-rise rounded-2xl border border-border bg-card p-5 ${index ? `delay-${Math.min(index, 3)}` : ''}`}><div className="flex items-start justify-between"><p className="text-xs font-semibold text-muted-foreground">{label}</p><span className="grid size-8 place-items-center rounded-lg bg-secondary text-primary">{icon}</span></div><p className="display-type mt-5 text-4xl">{summary.isLoading && overview.isLoading ? '—' : value}</p>{!isAdmin && index === 0 && <p className="mt-2 text-xs text-muted-foreground">Orders currently in progress</p>}</article>)}</div><div className="mt-8 grid gap-5 xl:grid-cols-[1.35fr_.65fr]"><section className="rounded-2xl border border-border bg-card p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="mono-type text-[9px] uppercase tracking-[.2em] text-accent">Recent activity</p><h2 className="display-type mt-1 text-2xl">Latest orders</h2></div><Link href="/orders" className="text-xs font-bold text-primary">View all <ArrowRight className="ml-1 inline" size={13} /></Link></div>{data.recentOrders.length ? <div className="mt-5 divide-y divide-border">{data.recentOrders.slice(0, 6).map((order) => <OrderRow key={order.id} order={order} role={profile.role} compact />)}</div> : <div className="mt-5"><EmptyState icon={ClipboardList} title="No orders to show" body={isAdmin ? 'Transaction activity will appear here when marketplace orders are placed.' : 'Orders and their status updates will appear here as you work with other members.'} action={!isAdmin && <Link href="/marketplace" className="text-sm font-bold text-primary">Browse available produce</Link>} /></div>}</section><aside className="rounded-2xl border border-border bg-[#e9e3d0] p-6"><p className="mono-type text-[9px] uppercase tracking-[.2em] text-accent">Good next steps</p><h2 className="display-type mt-2 text-3xl">Keep things moving.</h2><div className="mt-6 grid gap-2">{profile.role === 'farmer' && <QuickLink href="/farms" icon={<Sprout size={17} />} label="Manage your farms and listings" />}{profile.role === 'business' && <QuickLink href="/marketplace" icon={<Search size={17} />} label="Find produce for your business" />}<QuickLink href="/negotiations" icon={<Handshake size={17} />} label="Review open negotiations" /><QuickLink href="/messages" icon={<MessageSquare size={17} />} label="Continue a conversation" /><QuickLink href="/orders" icon={<Truck size={17} />} label="Track an order" /></div><div className="mt-6 border-t border-primary/15 pt-4"><p className="text-xs leading-5 text-muted-foreground">Good business grows from clear details. Keep your prices, quantities and next steps visible to everyone involved.</p></div></aside></div></>;
}
function QuickLink({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return <Link href={href} className="flex min-h-11 items-center gap-3 rounded-lg bg-background/70 px-3 text-sm font-semibold transition hover:bg-background"><span className="text-primary">{icon}</span>{label}<ArrowUpRight className="ml-auto text-muted-foreground" size={15} /></Link>;
}
function OrderRow({ order, role, compact = false }: { order: Order; role: string | null; compact?: boolean }) {
  return <div className={`flex flex-wrap items-center justify-between gap-3 py-4 ${compact ? '' : 'rounded-xl border border-border bg-card px-4'}`} data-testid={`row-order-${order.id}`}><div className="min-w-[180px] flex-1"><p className="font-semibold">{order.productName}</p><p className="mt-1 text-xs text-muted-foreground">{role === 'farmer' ? `Buyer · ${order.buyerName}` : `Farmer · ${order.farmerName}`} · {order.quantity} {order.unit}</p><p className="mt-1 text-[10px] text-muted-foreground">Order #{order.id} · {dateLabel(order.createdAt)}</p></div><div className="flex items-center gap-4"><div className="text-right"><p className="text-sm font-bold">{money(order.totalAmount)}</p><p className="mt-1 text-[10px] text-muted-foreground">Payment <span className="capitalize">{prettyStatus(order.paymentStatus)}</span></p></div><StatusPill status={order.status} /></div></div>;
}

function UploadField({ onUploaded, currentUrl }: { onUploaded: (url: string) => void; currentUrl?: string | null }) {
  const upload = useRequestUploadUrl();
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    const types = ['image/jpeg', 'image/png', 'image/webp'];
    if (!types.includes(file.type) || file.size > 10 * 1024 * 1024) {
      setError('Choose a JPEG, PNG or WebP image under 10 MB.');
      event.target.value = '';
      return;
    }
    setStatus('Getting a secure upload link…');
    try {
      const contentType = file.type as 'image/jpeg' | 'image/png' | 'image/webp';
      const { uploadURL, objectPath } = await upload.mutateAsync({ data: { name: file.name, size: file.size, contentType } });
      setStatus('Uploading image…');
      const response = await fetch(uploadURL, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file });
      if (!response.ok) throw new Error('Upload failed');
      onUploaded(new URL(`/api/storage${objectPath}`, window.location.origin).toString());
      setStatus('Image uploaded and ready.');
    } catch {
      setError('Image upload failed. Please try again.');
      setStatus('');
    }
  }
  return <div className="rounded-xl border border-dashed border-border bg-muted/40 p-4"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-lg bg-secondary text-primary"><ImagePlus size={18} /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold">Listing image</p><p className="truncate text-xs text-muted-foreground">{status || (currentUrl ? 'Image attached' : 'JPEG, PNG or WebP · up to 10 MB')}</p></div><label className="cursor-pointer rounded-lg border border-border bg-card px-3 py-2 text-xs font-bold hover:border-primary/40">{upload.isPending ? 'Preparing…' : 'Choose file'}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void chooseFile(event)} disabled={upload.isPending} aria-label="Choose listing image" /></label></div>{error && <p className="mt-2 text-xs text-destructive" role="alert">{error}</p>}</div>;
}

function FarmsPage({ profile }: { profile: UserProfile }) {
  const farmsQuery = useListFarms();
  const productsQuery = useListProducts({ limit: 50 });
  const createFarm = useCreateFarm();
  const updateFarm = useUpdateFarm();
  const deleteFarm = useDeleteFarm();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const client = useQueryClient();
  const [farmModal, setFarmModal] = useState<Farm | 'new' | null>(null);
  const [productModal, setProductModal] = useState<Product | 'new' | null>(null);
  const [farmImage, setFarmImage] = useState('');
  const [productImage, setProductImage] = useState('');
  const { toast, message } = useToastSafe();
  const canManageFarms = profile.role === 'farmer';
  const productRows = (productsQuery.data ?? []).filter((product) => product.farmerId === profile.id);
  function invalidateFarms() { void client.invalidateQueries({ queryKey: getListFarmsQueryKey() }); void client.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); }
  function invalidateProducts() { void client.invalidateQueries({ queryKey: getListProductsQueryKey() }); void client.invalidateQueries({ queryKey: getGetMarketplaceOverviewQueryKey() }); void client.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); }
  function saveFarm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = new FormData(event.currentTarget);
    const data: FarmInput = { name: String(values.get('name')).trim(), location: String(values.get('location')).trim(), acres: Number(values.get('acres')), soilType: String(values.get('soilType') || '') || null, irrigation: String(values.get('irrigation') || '') || null, crops: String(values.get('crops') || '').split(',').map((crop) => crop.trim()).filter(Boolean), imageUrl: farmImage || null };
    if (farmModal === 'new') createFarm.mutate({ data }, { onSuccess: () => { invalidateFarms(); setFarmModal(null); toast({ title: 'Farm added', description: 'Your farm record is ready.' }); }, onError: () => toast({ title: 'Farm could not be saved', description: 'Check the details and try again.', variant: 'destructive' }) });
    else if (farmModal) updateFarm.mutate({ farmId: farmModal.id, data: data as FarmUpdate }, { onSuccess: () => { invalidateFarms(); setFarmModal(null); toast({ title: 'Farm details updated' }); }, onError: () => toast({ title: 'Farm could not be updated', variant: 'destructive' }) });
  }
  function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = new FormData(event.currentTarget);
    const data: ProductInput = { farmId: values.get('farmId') ? Number(values.get('farmId')) : null, name: String(values.get('name')).trim(), category: String(values.get('category')), description: String(values.get('description') || ''), unit: String(values.get('unit') || 'kg'), quantity: Number(values.get('quantity')), pricePerUnit: Number(values.get('pricePerUnit')), location: String(values.get('location')).trim(), organic: values.get('organic') === 'on', quality: String(values.get('quality') || '') || null, harvestDate: String(values.get('harvestDate') || '') || null, cropVariety: String(values.get('cropVariety') || '').trim() || null, plantingDate: String(values.get('plantingDate') || '') || null, cultivationMethod: String(values.get('cultivationMethod') || '').trim() || null, growthStage: String(values.get('growthStage') || '').trim() || null, storageNotes: String(values.get('storageNotes') || '').trim() || null, imageUrl: productImage || null };
    if (productModal === 'new') createProduct.mutate({ data }, { onSuccess: () => { invalidateProducts(); setProductModal(null); toast({ title: 'Produce listing published', description: 'Buyers can now find it in the marketplace.' }); }, onError: () => toast({ title: 'Listing could not be created', description: 'Check all required details and try again.', variant: 'destructive' }) });
    else if (productModal) updateProduct.mutate({ productId: productModal.id, data: data as ProductUpdate }, { onSuccess: () => { invalidateProducts(); setProductModal(null); toast({ title: 'Listing updated' }); }, onError: () => toast({ title: 'Listing could not be updated', variant: 'destructive' }) });
  }
  if (!canManageFarms) return <><PageTitle eyebrow="Farmer workspace" title="Farm records are for growers." description="Your buyer profile can still search produce, place orders and speak directly with farmers." /><EmptyState icon={Sprout} title="Looking for a supplier?" body="Browse live listings and use messages, offers and orders to build your sourcing relationships." action={<Link href="/marketplace" className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground">Browse marketplace</Link>} /></>;
  if (farmsQuery.isLoading || productsQuery.isLoading) return <LoadingBlock label="Loading farms and listings" />;
  if (farmsQuery.isError || productsQuery.isError) return <QueryError retry={() => { void farmsQuery.refetch(); void productsQuery.refetch(); }} title="Your farm records could not be loaded" />;
  return <><PageTitle eyebrow="Grower tools" title="Your farms & listings." description="Keep farm details and live produce listings current. Buyers see the information you choose to publish." action={<Button onClick={() => { setFarmImage(''); setFarmModal('new'); }}><Plus size={16} />Add a farm</Button>} /><section className="mb-10"><div className="mb-4 flex items-center justify-between gap-4"><h2 className="display-type text-2xl">Farm records <span className="ml-2 text-base text-muted-foreground">{farmsQuery.data?.length ?? 0}</span></h2><Button variant="secondary" onClick={() => { setProductImage(''); setProductModal('new'); }}><Plus size={15} />New produce listing</Button></div>{farmsQuery.data?.length ? <div className="grid gap-4 lg:grid-cols-2">{farmsQuery.data.map((farm) => <FarmCard key={farm.id} farm={farm} onEdit={() => { setFarmImage(farm.imageUrl ?? ''); setFarmModal(farm); }} onDelete={() => { if (window.confirm(`Delete ${farm.name}?`)) deleteFarm.mutate({ farmId: farm.id }, { onSuccess: () => { invalidateFarms(); toast({ title: 'Farm deleted' }); }, onError: () => toast({ title: 'Farm could not be deleted', description: 'A farm connected to a listing may not be removable yet.', variant: 'destructive' }) }); }} deleting={deleteFarm.isPending} />)}</div> : <EmptyState icon={Sprout} title="Start with your farm" body="Add a farm record so buyers can understand where your produce is grown." action={<Button onClick={() => { setFarmImage(''); setFarmModal('new'); }}><Plus size={15} />Add your first farm</Button>} />}</section><section><div className="mb-4 flex items-end justify-between"><div><h2 className="display-type text-2xl">Produce listings <span className="ml-2 text-base text-muted-foreground">{productRows.length}</span></h2><p className="mt-1 text-sm text-muted-foreground">Manage the harvest buyers can currently find.</p></div></div>{productRows.length ? <div className="grid gap-3">{productRows.map((product) => <ProductManageRow key={product.id} product={product} onEdit={() => { setProductImage(product.imageUrl ?? ''); setProductModal(product); }} onToggle={() => updateProduct.mutate({ productId: product.id, data: { available: !product.available } }, { onSuccess: () => { invalidateProducts(); toast({ title: product.available ? 'Listing paused' : 'Listing is available' }); }, onError: () => toast({ title: 'Listing status could not be changed', variant: 'destructive' }) })} onDelete={() => { if (window.confirm(`Delete the ${product.name} listing?`)) deleteProduct.mutate({ productId: product.id }, { onSuccess: () => { invalidateProducts(); toast({ title: 'Listing deleted' }); }, onError: () => toast({ title: 'Listing could not be deleted', variant: 'destructive' }) }); }} />)}</div> : <EmptyState icon={Package} title="No produce listed yet" body="Create a listing with a clear price, quantity and harvest detail. Your available produce will show in the public marketplace." action={<Button onClick={() => { setProductImage(''); setProductModal('new'); }}><Plus size={15} />Create first listing</Button>} />}</section>
    {farmModal && <Modal title={farmModal === 'new' ? 'Add a farm' : 'Edit farm details'} description="Keep the place behind your produce easy to understand." onClose={() => setFarmModal(null)} wide><form className="grid gap-4 sm:grid-cols-2" onSubmit={saveFarm}><Field label="Farm name"><TextInput name="name" required minLength={2} maxLength={100} defaultValue={farmModal === 'new' ? '' : farmModal.name} /></Field><Field label="Farm location"><TextInput name="location" required minLength={2} maxLength={160} defaultValue={farmModal === 'new' ? profile.location ?? '' : farmModal.location} /></Field><Field label="Area (acres)"><TextInput name="acres" type="number" min="0.01" step="any" required defaultValue={farmModal === 'new' ? '' : farmModal.acres} /></Field><Field label="Soil type"><TextInput name="soilType" placeholder="For example, black cotton soil" defaultValue={farmModal === 'new' ? '' : farmModal.soilType ?? ''} /></Field><Field label="Irrigation"><TextInput name="irrigation" placeholder="For example, drip irrigation" defaultValue={farmModal === 'new' ? '' : farmModal.irrigation ?? ''} /></Field><Field label="Crops grown" hint="Separate crops with commas"><TextInput name="crops" defaultValue={farmModal === 'new' ? '' : farmModal.crops.join(', ')} /></Field><div className="sm:col-span-2"><UploadField currentUrl={farmImage} onUploaded={setFarmImage} /></div><div className="flex justify-end gap-2 pt-2 sm:col-span-2"><Button type="button" variant="secondary" onClick={() => setFarmModal(null)}>Cancel</Button><Button type="submit" disabled={createFarm.isPending || updateFarm.isPending}>{createFarm.isPending || updateFarm.isPending ? 'Saving…' : 'Save farm'}</Button></div></form></Modal>}
    {productModal && <Modal title={productModal === 'new' ? 'Create a produce listing' : 'Edit produce listing'} description="Set terms buyers can understand at a glance." onClose={() => setProductModal(null)} wide><form className="grid gap-4 sm:grid-cols-2" onSubmit={saveProduct}><Field label="Produce name"><TextInput name="name" required minLength={2} maxLength={100} defaultValue={productModal === 'new' ? '' : productModal.name} placeholder="What are you selling?" /></Field><Field label="Category"><SelectInput name="category" defaultValue={productModal === 'new' ? categories[0] : productModal.category}>{categories.map((category) => <option value={category} key={category}>{category}</option>)}</SelectInput></Field><Field label="Quantity available"><TextInput name="quantity" type="number" min="0.01" step="any" required defaultValue={productModal === 'new' ? '' : productModal.quantity} /></Field><div className="grid grid-cols-[1fr_110px] gap-2"><Field label="Price per unit"><TextInput name="pricePerUnit" type="number" min="0.01" step="any" required defaultValue={productModal === 'new' ? '' : productModal.pricePerUnit} /></Field><Field label="Unit"><SelectInput name="unit" defaultValue={productModal === 'new' ? 'kg' : productModal.unit}>{['kg', 'quintal', 'tonne', 'dozen', 'piece', 'litre'].map((unit) => <option value={unit} key={unit}>{unit}</option>)}</SelectInput></Field></div><Field label="Location"><TextInput name="location" required maxLength={160} defaultValue={productModal === 'new' ? profile.location ?? '' : productModal.location} /></Field><Field label="Harvest date"><TextInput name="harvestDate" type="date" defaultValue={productModal === 'new' ? '' : productModal.harvestDate?.slice(0, 10) ?? ''} /></Field><Field label="Crop variety"><TextInput name="cropVariety" maxLength={100} defaultValue={productModal === 'new' ? '' : productModal.cropVariety ?? ''} placeholder="For example, Alphonso" /></Field><Field label="Planting date"><TextInput name="plantingDate" type="date" defaultValue={productModal === 'new' ? '' : productModal.plantingDate?.slice(0, 10) ?? ''} /></Field><Field label="Cultivation method"><TextInput name="cultivationMethod" maxLength={120} defaultValue={productModal === 'new' ? '' : productModal.cultivationMethod ?? ''} placeholder="For example, drip irrigation" /></Field><Field label="Growth stage"><TextInput name="growthStage" maxLength={60} defaultValue={productModal === 'new' ? '' : productModal.growthStage ?? ''} placeholder="For example, flowering" /></Field><Field label="Quality note"><TextInput name="quality" maxLength={80} defaultValue={productModal === 'new' ? '' : productModal.quality ?? ''} placeholder="Grade, size or freshness detail" /></Field><Field label="Link to farm"><SelectInput name="farmId" defaultValue={productModal === 'new' ? '' : String(productModal.farmId ?? '')}><option value="">No farm selected</option>{farmsQuery.data?.map((farm) => <option value={farm.id} key={farm.id}>{farm.name}</option>)}</SelectInput></Field><Field label="Description"><TextArea name="description" maxLength={1000} defaultValue={productModal === 'new' ? '' : productModal.description} placeholder="Describe this harvest for buyers" /></Field><Field label="Storage and handling notes"><TextArea name="storageNotes" maxLength={500} defaultValue={productModal === 'new' ? '' : productModal.storageNotes ?? ''} placeholder="How should this crop be stored or handled?" /></Field><div className="flex items-center"><label className="inline-flex items-center gap-2 text-sm font-semibold"><input name="organic" type="checkbox" defaultChecked={productModal === 'new' ? false : productModal.organic} className="size-4 accent-[hsl(var(--primary))]" />Organically grown</label></div><div className="sm:col-span-2"><UploadField currentUrl={productImage} onUploaded={setProductImage} /></div><div className="flex justify-end gap-2 pt-2 sm:col-span-2"><Button type="button" variant="secondary" onClick={() => setProductModal(null)}>Cancel</Button><Button type="submit" disabled={createProduct.isPending || updateProduct.isPending}>{createProduct.isPending || updateProduct.isPending ? 'Saving…' : productModal === 'new' ? 'Publish listing' : 'Save changes'}</Button></div></form></Modal>}
    <Notice notice={message} clear={() => {}} />
  </>;
}
function FarmCard({ farm, onEdit, onDelete, deleting }: { farm: Farm; onEdit: () => void; onDelete: () => void; deleting: boolean }) {
  return <article className="overflow-hidden rounded-2xl border border-border bg-card"><div className="flex gap-4 p-4"><div className="hidden h-28 w-32 shrink-0 overflow-hidden rounded-xl bg-secondary sm:block">{farm.imageUrl ? <img src={farm.imageUrl} alt={`${farm.name} farm`} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-primary/55"><Sprout size={30} /></div>}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><h3 className="display-type text-2xl">{farm.name}</h3><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={12} />{farm.location}</p></div><div className="flex gap-1"><IconButton label={`Edit ${farm.name}`} onClick={onEdit}><Pencil size={15} /></IconButton><IconButton label={`Delete ${farm.name}`} onClick={onDelete} disabled={deleting}><Trash2 size={15} /></IconButton></div></div><div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground"><span>{farm.acres} acres</span>{farm.soilType && <span>Soil: {farm.soilType}</span>}{farm.irrigation && <span>{farm.irrigation}</span>}</div><div className="mt-3 flex flex-wrap gap-1.5">{farm.crops.map((crop) => <span key={crop} className="rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold text-primary">{crop}</span>)}</div></div></div></article>;
}
function ProductManageRow({ product, onEdit, onToggle, onDelete }: { product: Product; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  return <article className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 sm:gap-4 sm:p-4" data-testid={`row-listing-${product.id}`}><div className="size-14 shrink-0 overflow-hidden rounded-lg bg-muted"><ProductArtwork product={product} className="h-full" /></div><div className="min-w-[130px] flex-1"><h3 className="font-semibold">{product.name}</h3><p className="mt-1 text-xs text-muted-foreground">{product.quantity} {product.unit} · {money(product.pricePerUnit)}/{product.unit}</p></div><StatusPill status={product.available ? 'available' : 'paused'} /><div className="flex items-center gap-1"><Button variant="quiet" className="min-h-9 px-2.5 text-xs" onClick={onToggle}>{product.available ? 'Pause' : 'Publish'}</Button><IconButton label={`Edit ${product.name}`} onClick={onEdit}><Pencil size={15} /></IconButton><IconButton label={`Delete ${product.name}`} onClick={onDelete}><Trash2 size={15} /></IconButton></div></article>;
}

function OrdersPage({ profile }: { profile: UserProfile }) {
  const query = useListOrders();
  const updateStatus = useUpdateOrderStatus();
  const demoPayment = useCreateDemoPayment();
  const client = useQueryClient();
  const [filter, setFilter] = useState('all');
  const { toast, message } = useToastSafe();
  function refresh() { void client.invalidateQueries({ queryKey: getListOrdersQueryKey() }); void client.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); }
  function advance(order: Order, status: 'confirmed' | 'processing' | 'ready' | 'completed' | 'cancelled') {
    updateStatus.mutate({ orderId: order.id, data: { status } }, { onSuccess: () => { refresh(); toast({ title: `Order marked ${prettyStatus(status).toLowerCase()}` }); }, onError: () => toast({ title: 'Order status could not be changed', variant: 'destructive' }) });
  }
  if (query.isLoading) return <LoadingBlock label="Loading orders" />;
  if (query.isError) return <QueryError retry={() => { void query.refetch(); }} title="Orders could not be loaded" />;
  const orders = query.data ?? [];
  const visible = filter === 'all' ? orders : orders.filter((order) => filter === 'active' ? !['completed', 'cancelled'].includes(order.status) : order.status === filter);
  return <><PageTitle eyebrow="Order desk" title="Every order, clearly tracked." description={profile.role === 'farmer' ? 'Keep buyers informed as their order moves from confirmation to dispatch and completion.' : 'Stay close to order progress, payment status and the details you agreed with each farmer.'} action={<Link href="/marketplace" className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground"><Plus size={15} />Find produce</Link>} /><div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filter orders">{[['all', 'All orders'], ['active', 'In progress'], ['completed', 'Completed'], ['cancelled', 'Cancelled']].map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`rounded-full px-4 py-2 text-xs font-bold transition ${filter === value ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/70'}`}>{label}{value === 'all' && ` · ${orders.length}`}</button>)}</div>{visible.length ? <div className="grid gap-3">{visible.map((order) => <article key={order.id} className="rounded-2xl border border-border bg-card p-4 sm:p-5"><OrderRow order={order} role={profile.role} /><div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3"><div className="flex flex-wrap gap-2"><StatusPill status={order.paymentStatus} />{order.paymentReference && <span className="self-center text-[10px] text-muted-foreground">Ref. {order.paymentReference}</span>}</div><div className="flex flex-wrap gap-2">{order.status === 'payment_pending' && order.paymentStatus !== 'successful' && <Button variant="secondary" className="min-h-9 px-3 text-xs" onClick={() => demoPayment.mutate({ orderId: order.id }, { onSuccess: () => { refresh(); toast({ title: 'Sandbox payment completed', description: 'This test payment is not a real charge.' }); }, onError: () => toast({ title: 'Sandbox payment did not complete', variant: 'destructive' }) })} disabled={demoPayment.isPending}><CreditCard size={14} />Sandbox / test payment</Button>}{profile.role === 'farmer' && order.status === 'confirmed' && <Button variant="secondary" className="min-h-9 px-3 text-xs" onClick={() => advance(order, 'processing')}>Start preparing</Button>}{profile.role === 'farmer' && order.status === 'processing' && <Button variant="secondary" className="min-h-9 px-3 text-xs" onClick={() => advance(order, 'ready')}><Package size={14} />Mark ready</Button>}{profile.role === 'farmer' && order.status === 'ready' && <Button className="min-h-9 px-3 text-xs" onClick={() => advance(order, 'completed')}><Check size={14} />Complete order</Button>}{!['completed', 'cancelled'].includes(order.status) && <Button variant="quiet" className="min-h-9 px-3 text-xs text-destructive" onClick={() => { if (window.confirm(`Cancel order #${order.id}?`)) advance(order, 'cancelled'); }}>Cancel</Button>}</div></div>{order.notes && <p className="mt-3 rounded-lg bg-muted/60 p-3 text-xs leading-5 text-muted-foreground"><strong className="text-foreground">Order note:</strong> {order.notes}</p>}</article>)}</div> : <EmptyState icon={ClipboardList} title={filter === 'all' ? 'Your order book is empty' : 'No orders in this view'} body={filter === 'all' ? 'Orders you place or receive will appear here with quantity, price and fulfillment status.' : 'Try another filter to see orders in a different stage.'} action={filter === 'all' ? <Link href="/marketplace" className="text-sm font-bold text-primary">Browse available produce</Link> : <Button variant="secondary" onClick={() => setFilter('all')}>Show all orders</Button>} />}<Notice notice={message} clear={() => {}} /></>;
}

function NegotiationsPage({ profile }: { profile: UserProfile }) {
  const query = useListNegotiations();
  const respond = useRespondToNegotiation();
  const client = useQueryClient();
  const [counterFor, setCounterFor] = useState<Negotiation | null>(null);
  const [counterPrice, setCounterPrice] = useState('');
  const { toast, message } = useToastSafe();
  function reload() { void client.invalidateQueries({ queryKey: getListNegotiationsQueryKey() }); void client.invalidateQueries({ queryKey: getGetDashboardQueryKey() }); }
  function reply(negotiation: Negotiation, action: 'accept' | 'reject' | 'counter', price?: number) {
    respond.mutate({ negotiationId: negotiation.id, data: { action, proposedPrice: price ?? null } }, { onSuccess: () => { reload(); setCounterFor(null); toast({ title: action === 'accept' ? 'Offer accepted' : action === 'reject' ? 'Offer declined' : 'Counter-offer sent', description: action === 'accept' ? 'The other party can now see the accepted terms.' : undefined }); }, onError: () => toast({ title: 'Your response could not be saved', variant: 'destructive' }) });
  }
  if (query.isLoading) return <LoadingBlock label="Loading negotiations" />;
  if (query.isError) return <QueryError retry={() => { void query.refetch(); }} title="Negotiations could not be loaded" />;
  const negotiations = query.data ?? [];
  return <><PageTitle eyebrow="Direct negotiation" title="Agree on the details." description="Offers are tied to a product, quantity and price. Respond clearly, or continue the conversation before agreeing." action={<Link href="/marketplace" className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold"><Search size={15} />Find produce</Link>} />{negotiations.length ? <div className="grid gap-3">{negotiations.map((item) => { const incoming = profile.id === item.farmerId; const canRespond = incoming && ['pending', 'countered'].includes(item.status); return <article key={item.id} className="rounded-2xl border border-border bg-card p-5 sm:p-6" data-testid={`card-negotiation-${item.id}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="mono-type text-[9px] uppercase tracking-[.2em] text-accent">{incoming ? 'Incoming offer' : 'Your offer'} · {dateLabel(item.updatedAt)}</p><h2 className="display-type mt-2 text-3xl">{item.productName}</h2><p className="mt-1 text-xs text-muted-foreground">{incoming ? `From ${item.buyerName}` : `To ${item.farmerName}`}</p></div><StatusPill status={item.status} /></div><div className="mt-5 grid grid-cols-2 gap-4 rounded-xl bg-muted/55 p-4 sm:grid-cols-3"><div><p className="mono-type text-[9px] uppercase tracking-widest text-muted-foreground">Quantity</p><p className="mt-1 font-bold">{item.quantity} {item.unit}</p></div><div><p className="mono-type text-[9px] uppercase tracking-widest text-muted-foreground">Proposed price</p><p className="mt-1 font-bold">{money(item.proposedPrice)} <span className="text-xs font-normal text-muted-foreground">/ {item.unit}</span></p></div><div className="col-span-2 sm:col-span-1"><p className="mono-type text-[9px] uppercase tracking-widest text-muted-foreground">Approx. value</p><p className="mt-1 font-bold">{money(item.quantity * item.proposedPrice)}</p></div></div>{canRespond && <div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => reply(item, 'accept')} disabled={respond.isPending}><Check size={15} />Accept offer</Button><Button variant="secondary" onClick={() => { setCounterFor(item); setCounterPrice(String(item.proposedPrice)); }}><ArrowLeft size={15} />Counter price</Button><Button variant="quiet" className="text-destructive" onClick={() => { if (window.confirm('Decline this offer?')) reply(item, 'reject'); }}>Decline</Button></div>}<p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">Product discussions and updates are available in <Link href="/messages" className="font-semibold text-primary">Messages</Link>.</p></article>; })}</div> : <EmptyState icon={Handshake} title="No offers on the table" body="When you propose a price or receive an offer from a marketplace member, you'll be able to review it here." action={<Link href="/marketplace" className="text-sm font-bold text-primary">Explore listings</Link>} />}<Notice notice={message} clear={() => {}} />{counterFor && <Modal title="Counter with a price" description={`Your counter will apply to ${counterFor.quantity} ${counterFor.unit} of ${counterFor.productName}.`} onClose={() => setCounterFor(null)}><form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); reply(counterFor, 'counter', Number(counterPrice)); }}><Field label={`Counter-price per ${counterFor.unit}`}><TextInput type="number" min="0.01" step="any" required value={counterPrice} onChange={(event) => setCounterPrice(event.target.value)} /></Field><div className="flex justify-end gap-2"><Button variant="secondary" type="button" onClick={() => setCounterFor(null)}>Cancel</Button><Button type="submit" disabled={respond.isPending}>{respond.isPending ? 'Sending…' : 'Send counter-offer'}</Button></div></form></Modal>}</>;
}

function MessagesPage({ profile }: { profile: UserProfile }) {
  const conversations = useListConversations();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const activeConversation = conversations.data?.find((conversation) => conversation.id === activeId) ?? conversations.data?.[0];
  const messages = useListMessages(activeConversation?.id ?? 0, { query: { queryKey: getListMessagesQueryKey(activeConversation?.id ?? 0), enabled: !!activeConversation?.id } });
  const send = useSendMessage();
  const client = useQueryClient();
  const { toast, message } = useToastSafe();
  useEffect(() => { if (!activeId && conversations.data?.length) setActiveId(conversations.data[0].id); }, [activeId, conversations.data]);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!activeConversation || !draft.trim()) return;
    const body = draft.trim();
    send.mutate({ conversationId: activeConversation.id, data: { body } }, { onSuccess: () => { setDraft(''); void client.invalidateQueries({ queryKey: getListMessagesQueryKey(activeConversation.id) }); void client.invalidateQueries({ queryKey: getListConversationsQueryKey() }); }, onError: () => toast({ title: 'Message not sent', description: 'Please check your connection and try again.', variant: 'destructive' }) });
  }
  if (conversations.isLoading) return <LoadingBlock label="Loading conversations" />;
  if (conversations.isError) return <QueryError retry={() => { void conversations.refetch(); }} title="Conversations could not be loaded" />;
  const all = conversations.data ?? [];
  return <><PageTitle eyebrow="Direct conversations" title="Talk it through." description="Keep product discussions connected to their listing and your real conversations." /><div className="grid min-h-[560px] overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-[310px_minmax(0,1fr)]"><aside className={`border-b border-border md:border-b-0 md:border-r ${activeConversation ? 'hidden md:block' : ''}`}><div className="border-b border-border px-4 py-4"><p className="mono-type text-[9px] uppercase tracking-[.2em] text-muted-foreground">Your conversations</p></div>{all.length ? <div className="max-h-[560px] overflow-y-auto">{all.map((conversation) => <button type="button" key={conversation.id} onClick={() => setActiveId(conversation.id)} className={`flex w-full gap-3 border-b border-border px-4 py-4 text-left transition hover:bg-muted/65 ${activeConversation?.id === conversation.id ? 'bg-secondary/65' : ''}`} data-testid={`conversation-${conversation.id}`}><span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 font-bold text-primary">{conversation.otherUserName.slice(0, 1).toUpperCase()}</span><span className="min-w-0"><span className="block truncate text-sm font-bold">{conversation.otherUserName}</span><span className="mt-1 block truncate text-xs text-muted-foreground">About {conversation.productName}</span><span className="mt-1 block text-[10px] text-muted-foreground">{dateLabel(conversation.updatedAt)}</span></span></button>)}</div> : <div className="p-5"><p className="text-sm font-semibold">No conversations yet</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Open a produce listing to message the farmer and start a discussion.</p><Link href="/marketplace" className="mt-4 inline-flex text-xs font-bold text-primary">Browse the marketplace <ArrowRight className="ml-1" size={13} /></Link></div>}</aside><section className={`flex min-h-[560px] flex-col ${!activeConversation ? 'hidden md:flex' : ''}`}>{activeConversation ? <><header className="flex items-center gap-3 border-b border-border px-4 py-4 sm:px-6"><span className="grid size-10 place-items-center rounded-full bg-secondary text-primary"><UserRound size={18} /></span><div><p className="font-bold">{activeConversation.otherUserName}</p><p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Package size={12} />{activeConversation.productName}</p></div><Link href={`/products/${activeConversation.productId}`} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-primary">Listing <ArrowUpRight size={13} /></Link></header><div className="flex-1 space-y-4 overflow-y-auto bg-background/60 p-4 sm:p-6">{messages.isLoading ? <div className="space-y-3" role="status" aria-label="Loading messages"><div className="h-16 w-3/5 animate-pulse rounded-xl bg-muted" /><div className="ml-auto h-16 w-1/2 animate-pulse rounded-xl bg-secondary" /></div> : messages.isError ? <QueryError retry={() => { void messages.refetch(); }} title="Messages could not be loaded" /> : messages.data?.length ? messages.data.map((item) => { const mine = item.senderId === profile.id; return <div key={item.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`} data-testid={`message-${item.id}`}><div className={`max-w-[88%] rounded-2xl px-4 py-3 sm:max-w-[75%] ${mine ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-card text-foreground shadow-sm'}`}><p className={`mb-1 text-[10px] font-bold ${mine ? 'text-white/65' : 'text-muted-foreground'}`}>{mine ? 'You' : item.senderName}</p><p className="whitespace-pre-wrap text-sm leading-6">{item.body}</p><p className={`mt-2 text-right text-[9px] ${mine ? 'text-white/55' : 'text-muted-foreground'}`}>{new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' }).format(new Date(item.createdAt))}</p></div></div>; }) : <div className="grid h-full min-h-52 place-items-center text-center"><div><MessageSquare className="mx-auto text-muted-foreground" size={26} /><p className="mt-3 text-sm font-semibold">Start the conversation</p><p className="mt-1 text-xs text-muted-foreground">Share what you would like to know about this produce.</p></div></div>}</div><form onSubmit={submit} className="flex items-end gap-2 border-t border-border p-3 sm:p-4"><label className="flex-1"><span className="sr-only">Write a message</span><TextArea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} placeholder="Write a clear message…" className="min-h-12 max-h-32 resize-y" /></label><Button type="submit" className="h-12 px-4" disabled={send.isPending || !draft.trim()}>{send.isPending ? 'Sending…' : 'Send'}<ArrowRight size={15} /></Button></form></> : <div className="grid flex-1 place-items-center p-8 text-center"><div><MessageSquare className="mx-auto text-primary/50" size={30} /><h2 className="display-type mt-4 text-3xl">A conversation starts with a listing.</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Message farmers directly from their produce details, then return here to keep the discussion moving.</p><Link href="/marketplace" className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground">Browse produce <ArrowRight size={15} /></Link></div></div>}</section></div><Notice notice={message} clear={() => {}} /></>;
}

function SignInPage() {
  return <main className="grain flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-[#e9e3d3] px-4 py-8"><Brand /><div className="w-full"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div><p className="max-w-sm text-center text-xs leading-5 text-muted-foreground">A trusted marketplace for the people who grow and buy India's produce.</p></main>;
}
function SignUpPage() {
  return <main className="grain flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-[#e9e3d3] px-4 py-8"><Brand /><div className="w-full"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div><p className="max-w-sm text-center text-xs leading-5 text-muted-foreground">Create an account, then choose whether you grow or buy produce.</p></main>;
}
function ClerkCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const previous = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const id = user?.id ?? null;
      if (previous.current !== undefined && previous.current !== id) client.clear();
      previous.current = id;
    });
    return unsubscribe;
  }, [addListener, client]);
  return null;
}
function ClerkRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={{
    theme: shadcn, cssLayerName: 'clerk',
    options: { logoPlacement: 'inside', logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/logo.svg` },
    variables: { colorPrimary: '#315c4a', colorForeground: '#283c33', colorMutedForeground: '#68756c', colorDanger: '#a3443c', colorBackground: '#fbf9f1', colorInput: '#fffdf8', colorInputForeground: '#283c33', colorNeutral: '#d5d3c7', fontFamily: 'DM Sans, sans-serif', borderRadius: '0.75rem' },
    elements: {
      rootBox: 'w-full flex justify-center',
      cardBox: 'bg-[#fbf9f1] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl',
      card: '!shadow-none !border-0 !bg-transparent !rounded-none',
      footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
      headerTitle: 'font-semibold text-[#283c33]',
      headerSubtitle: 'text-[#68756c]',
      socialButtonsBlockButtonText: 'font-semibold text-[#283c33]',
      formFieldLabel: 'font-semibold text-[#384b40]',
      footerActionLink: 'font-semibold text-[#315c4a]',
      footerActionText: 'text-[#68756c]',
      dividerText: 'text-[#68756c]',
      identityPreviewEditButton: 'text-[#315c4a]',
      formFieldSuccessText: 'text-[#315c4a]',
      alertText: 'text-[#7f322d]',
      logoBox: 'mb-2',
      logoImage: 'max-h-10',
      socialButtonsBlockButton: 'border-[#d5d3c7] bg-[#fffdf8] hover:bg-[#f1efe5]',
      formButtonPrimary: 'bg-[#315c4a] hover:bg-[#254838] text-white',
      formFieldInput: 'border-[#d5d3c7] bg-[#fffdf8] text-[#283c33]',
      footerAction: 'text-[#68756c]',
      dividerLine: 'bg-[#d5d3c7]',
      alert: 'border-[#a3443c]/25 bg-[#a3443c]/5',
      otpCodeFieldInput: 'border-[#d5d3c7] bg-[#fffdf8] text-[#283c33]',
      formFieldRow: 'text-[#384b40]',
      main: 'text-[#283c33]',
    },
  }} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} localization={{
    signIn: { start: { title: 'Welcome back', subtitle: 'Pick up where your next good connection left off.' } },
    signUp: { start: { title: 'Join Farm Connect', subtitle: 'A clearer way to grow, source and trade produce.' } },
  }} routerPush={(to) => setLocation(stripBase(to))} routerReplace={(to) => setLocation(stripBase(to), { replace: true })}>
    <ClerkCacheInvalidator />
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/marketplace" component={MarketplacePage} />
      <Route path="/products/:productId" component={ProductPage} />
      <Route path="/onboarding" component={AppOnboarding} />
      <Route path="/dashboard">{() => <WorkspacePage page="dashboard" />}</Route>
      <Route path="/farms">{() => <WorkspacePage page="farms" />}</Route>
      <Route path="/orders">{() => <WorkspacePage page="orders" />}</Route>
      <Route path="/negotiations">{() => <WorkspacePage page="negotiations" />}</Route>
      <Route path="/messages">{() => <WorkspacePage page="messages" />}</Route>
      <Route path="/billing">{() => <WorkspacePage page="billing" />}</Route>
      <Route component={NotFound} />
    </Switch>
  </ClerkProvider>;
}
function AppRouter() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><ClerkRoutes /></ErrorBoundary>;
}
function App() {
  if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={basePath}><AppRouter /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;