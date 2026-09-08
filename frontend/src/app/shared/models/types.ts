export type User = { id: string; name: string; email: string; role: 'admin' | 'petugas'; status: 'active' | 'inactive' };
export type PageMeta = { currentPage: number; lastPage: number; perPage: number; total: number };
export type MainCoreNode = {
  id: string; parentId: string | null; parentPortOut: number | null; namaTitik: string;
  tipeTitik: 'server' | 'rasio' | 'odc' | 'odp'; redamanIn: number | null; jarakKabel: number | null;
  alamat: string | null; spesifikasi: Record<string, unknown> | null; tanggal: string | null;
  jenisSplitter: string | null; jumlahOutput: number | null; rasioRedaman: string | null;
  rasioRedamanPorts: Record<string, string>; parent?: MainCoreNode | null;
};
export type PppoePackage = { id: string; name: string; downloadMbps: number; uploadMbps: number; price: number; addressPool: string | null; isActive: boolean; accountsCount?: number; rateLimit?: string };
export type PppoeAccount = { id: string; pppoePackageId: string; customerName: string; username: string; phone: string | null; address: string | null; expiresAt: string | null; isActive: boolean; notes: string | null; package: PppoePackage };
