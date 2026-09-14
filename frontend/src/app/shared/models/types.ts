export type User = { id: string; name: string; email: string; phone?: string | null; role: 'admin' | 'petugas'; status: 'active' | 'inactive' };
export type PageMeta = { currentPage: number; lastPage: number; perPage: number; total: number };
export type MainCoreNode = {
  id: string; parentId: string | null; parentPortOut: number | null; namaTitik: string;
  tipeTitik: 'server' | 'rasio' | 'odc' | 'odp'; redamanIn: number | null; jarakKabel: number | null;
  alamat: string | null; spesifikasi: Record<string, unknown> | null; tanggal: string | null;
  jenisSplitter: string | null; jumlahOutput: number | null; rasioRedaman: string | null;
  rasioRedamanPorts: Record<string, string>; parent?: MainCoreNode | null;
};
export type IpPool = { id: string; name: string; networkStart: string; networkEnd: string };
export type NasOption = { id: string; nasname: string; shortname: string | null; description: string };
export type OdpOption = { id: string; namaTitik: string; alamat: string | null };
export type Invoice = { id: string; pppoeAccountId: string; invoiceNumber: string; amount: number; baseAmount: number; discount: number; invoiceType: 'PRORATE' | 'MONTHLY'; status: 'PENDING' | 'PAID' | 'CANCELLED'; dueDate: string; paidAt: string | null; notes: string | null };

export type PppoePackage = { id: string; name: string; downloadMbps: number; uploadMbps: number; price: number; costPrice: number; addressPool: string | null; ipPool: IpPool | null; validityDays: number; isActive: boolean; accountsCount?: number; rateLimit?: string };
export type PppoeAccount = { id: string; pppoePackageId: string; customerName: string; username: string; phone: string | null; address: string | null; expiresAt: string | null; isActive: boolean; notes: string | null; idCardNumber: string | null; idCardPhoto: string | null; latitude: number | null; longitude: number | null; subscriptionType: string; billingDay: number; discount: number; odp: string | null; routerNasId: number | null; routerNas: NasOption | null; package: PppoePackage };

export type RouterItem = {
  id: string;
  name: string | null;
  nasname: string;
  shortname: string | null;
  type: string;
  authMode: string;
  ipAddress: string | null;
  username?: string | null;
  password?: string | null;
  port: number | null;
  ports: number | null;
  secret: string;
  description?: string | null;
  vpnClientId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isActive: boolean;
  accountsCount?: number;
  vpnClient?: { id: string; name: string; vpnIp: string } | null;
};

export type VpnServer = {
  id: string;
  name: string;
  host: string;
  subnet: string;
  wgPort: number;
  wgPublicKey: string;
  wgPrivateKey?: string | null;
  poolStart: number;
  poolEnd: number;
  gateway?: string | null;
  isActive: boolean;
  clientsCount?: number;
};

export type VpnClient = {
  id: string;
  name: string;
  vpnServerId: string;
  vpnIp: string;
  clientPublicKey: string;
  clientPrivateKey?: string | null;
  allowedIps: string;
  description?: string | null;
  isRadiusServer: boolean;
  isActive: boolean;
  vpnServer?: { id: string; name: string; host: string; wgPort: number; wgPublicKey: string };
};

export type RouterScriptData = {
  routerName: string;
  radiusServerIp: string;
  nasSrcAddress: string;
  secret: string;
  authPort: number;
  scriptRos7: string;
  scriptRos6: string;
};

export type WireguardScriptData = {
  clientName: string;
  vpnIp: string;
  serverHost: string;
  serverPort: number;
  serverPublicKey: string;
  clientPublicKey: string;
  script: string;
};
