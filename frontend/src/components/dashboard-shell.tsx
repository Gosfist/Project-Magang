'use client';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Calculator, ChevronDown, Clock3, GitBranch, LayoutDashboard, LogOut, Menu, Network, Users, X } from 'lucide-react';
import { useAuth } from './auth-provider';

const coreLinks = [['Trace Jalur','/dashboard/main-core/trace'],['Server','/dashboard/main-core/server'],['Rasio','/dashboard/main-core/rasio'],['ODC','/dashboard/main-core/odc'],['ODP','/dashboard/main-core/odp']];
const pppoeLinks = [['Daftar Paket','/dashboard/pppoe/packages'],['Akun PPPoE','/dashboard/pppoe/accounts']];

function DateTimeWidget() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const date = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);
  const time = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now).replaceAll('.', ':');
  const label = `${date.charAt(0).toUpperCase()}${date.slice(1)} ${time}`;

  return <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 sm:text-sm"><Clock3 size={15} className="shrink-0 text-blue-600"/><span suppressHydrationWarning className="whitespace-nowrap">{label}</span></div>;
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth(); const pathname=usePathname(); const [mobile,setMobile]=useState(false);
  const [coreOpen,setCoreOpen]=useState(pathname.includes('/main-core')); const [pppoeOpen,setPppoeOpen]=useState(pathname.includes('/pppoe')); const [toolOpen,setToolOpen]=useState(pathname.includes('/tools'));
  if (loading || !user) return <div className="flex min-h-screen items-center justify-center text-slate-500">Memuat dashboard...</div>;
  const active=(href:string)=>pathname===href;
  const navClass=(href:string)=>`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${active(href)?'bg-white/15 text-white':'text-slate-300 hover:bg-white/10 hover:text-white'}`;
  const submenu=(links:string[][])=> <div className="mt-1 space-y-1 pl-11 pr-2">{links.map(([label,href])=><Link key={href} href={href} onClick={()=>setMobile(false)} className={`block rounded-md px-3 py-2 text-sm ${active(href)?'bg-white/15 text-white':'text-slate-300 hover:bg-white/10 hover:text-white'}`}>{label}</Link>)}</div>;
  const sidebar=<aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-950 text-white transition-transform lg:translate-x-0 ${mobile?'translate-x-0':'-translate-x-full'}`}><div className="flex h-16 items-center justify-between border-b border-slate-800 px-4"><Link href="/" className="flex items-center gap-3"><Image src="/logo.png" width={86} height={36} alt="Unzanet"/><span className="text-sm font-bold">PT UNZANET</span></Link><button className="lg:hidden" onClick={()=>setMobile(false)}><X/></button></div><nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4"><Link href="/dashboard" className={navClass('/dashboard')}><LayoutDashboard size={20}/>Dashboard</Link>{user.role==='admin'&&<Link href="/dashboard/users" className={navClass('/dashboard/users')}><Users size={20}/>Data Petugas</Link>}<p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Data Jaringan</p><button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-white/10" onClick={()=>setCoreOpen(!coreOpen)}><GitBranch size={20}/><span className="flex-1 text-left">Main Core</span><ChevronDown size={16} className={!coreOpen?'-rotate-90':''}/></button>{coreOpen&&submenu(coreLinks)}<button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-white/10" onClick={()=>setPppoeOpen(!pppoeOpen)}><Network size={20}/><span className="flex-1 text-left">PPPoE</span><ChevronDown size={16} className={!pppoeOpen?'-rotate-90':''}/></button>{pppoeOpen&&submenu(pppoeLinks)}<button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-white/10" onClick={()=>setToolOpen(!toolOpen)}><Calculator size={20}/><span className="flex-1 text-left">Tool</span><ChevronDown size={16} className={!toolOpen?'-rotate-90':''}/></button>{toolOpen&&submenu([['Kalkulator Redaman','/dashboard/tools/attenuation-calculator']])}</nav><div className="border-t border-slate-800 p-3"><div className="flex items-center gap-3 px-3 py-2"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-white font-bold text-slate-950">{user.name[0].toUpperCase()}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{user.name}</p><p className="text-xs capitalize text-slate-400">{user.role}</p></div><button onClick={logout} title="Logout" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"><LogOut size={20}/></button></div></div></aside>;
  const titles:Record<string,string>={ '/dashboard':'Dashboard','/dashboard/users':'Data Petugas','/dashboard/main-core/trace':'Trace Jalur','/dashboard/pppoe/packages':'Daftar Paket PPPoE','/dashboard/pppoe/accounts':'Akun PPPoE','/dashboard/tools/attenuation-calculator':'Kalkulator Redaman' };
  const title=titles[pathname]??(pathname.split('/').at(-1)?.toUpperCase()??'Dashboard');
  return <div className="min-h-screen">{sidebar}{mobile&&<button aria-label="Tutup sidebar" className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={()=>setMobile(false)}/>}<div className="lg:ml-64"><header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white px-4 shadow-sm sm:px-6"><div className="flex items-center gap-3"><button className="rounded-lg p-2 hover:bg-slate-100 lg:hidden" onClick={()=>setMobile(true)}><Menu/></button><h1 className="text-lg font-semibold">{title}</h1></div><DateTimeWidget/></header><main className="p-4 sm:p-6">{children}</main></div></div>;
}
