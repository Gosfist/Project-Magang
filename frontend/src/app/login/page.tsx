'use client';
import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';

export default function LoginPage() {
  const { login, user } = useAuth(); const router = useRouter();
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  useEffect(()=>{ if(user) router.replace('/dashboard'); },[user,router]);
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(''); try { await login(email,password); } catch (e) { setError(e instanceof Error?e.message:'Login gagal.'); } finally { setBusy(false); } }
  return <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl sm:p-9"><Link href="/" className="mb-7 flex justify-center"><Image src="/logo.png" alt="PT UNZANET" width={130} height={64}/></Link><h1 className="text-center text-2xl font-bold">Masuk Dashboard</h1><p className="mt-2 text-center text-sm text-slate-500">Gunakan akun admin atau petugas Anda.</p>{error&&<p className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}<form onSubmit={submit} className="mt-6 space-y-4"><div><label className="label">Email</label><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoFocus/></div><div><label className="label">Password</label><input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></div><button className="btn-primary w-full" disabled={busy}>{busy?'Memproses...':'Masuk'}</button></form><Link href="/" className="mt-5 block text-center text-sm text-slate-500 hover:text-blue-700">← Kembali ke web profile</Link></div></main>;
}
