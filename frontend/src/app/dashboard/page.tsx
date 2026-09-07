'use client';
import { useEffect, useState } from 'react';
import { GitBranch, Network, Server, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import type { LucideIcon } from 'lucide-react';

export default function DashboardPage(){
  const {user}=useAuth(); const [stats,setStats]=useState<Record<string,number>>({});
  useEffect(()=>{api<Record<string,number>>('/dashboard/stats').then(setStats).catch(()=>{});},[]);
  const cards: [string, number | undefined, LucideIcon][]=[['Server Core',stats.totalServerCores,Server],['Total ODC',stats.totalOdcs,Network],['Total ODP',stats.totalOdps,GitBranch],['Data Redaman',stats.totalWithRedaman,GitBranch],...(user?.role==='admin'?[['Total Petugas',stats.totalPetugas,Users] as [string,number|undefined,LucideIcon],['Total User',stats.totalUsers,Users] as [string,number|undefined,LucideIcon]]:[])];
  return <div className="space-y-5"><div className="card p-5"><h2 className="text-xl font-semibold">Selamat datang, {user?.name}</h2><p className="mt-1 text-sm text-slate-500">Ringkasan data jaringan PT UNZANET.</p></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([label,value,Icon])=><div key={label} className="card flex items-center gap-4 p-5"><span className="rounded-xl bg-blue-50 p-3 text-blue-700"><Icon/></span><div><p className="text-sm text-slate-500">{label}</p><p className="text-2xl font-bold">{value??'—'}</p></div></div>)}</div></div>;
}
