export type User = { id: string; name: string; email: string; phone?: string | null; photo?: string | null; role: 'admin' | 'teknisi' | 'finance' | 'sales' | 'kolektor'; status: 'active' | 'inactive' };
export type PageMeta = { currentPage: number; lastPage: number; perPage: number; total: number };
export type MainCoreNode = {
  id: string; parentId: string | null; parentPortOut: number | null; namaTitik: string;
  tipeTitik: 'server' | 'rasio' | 'odc' | 'odp'; redamanIn: number | null; jarakKabel: number | null;
  alamat: string | null; spesifikasi: Record<string, unknown> | null; tanggal: string | null;
  jenisSplitter: string | null; jumlahOutput: number | null; rasioRedaman: string | null;
  rasioRedamanPorts: Record<string, string>; parent?: MainCoreNode | null;
};
export type IpPool = { totalIps: number | null; usedIps: number | null; freeIps: number | null; routerNasId: number; routerName: string; ranges: string; id: string; name: string; networkStart: string; networkEnd: string };
export type NasOption = { id: string; nasname: string; shortname: string | null; description: string };
export type OdpOption = { id: string; namaTitik: string; alamat: string | null; tipeTitik: 'odc' | 'odp' };
export type Invoice = { id: string; pppoeAccountId: string; invoiceNumber: string; amount: number; baseAmount: number; discount: number; invoiceType: 'PRORATE' | 'MONTHLY'; status: 'PENDING' | 'PAID' | 'CANCELLED'; dueDate: string; paidAt: string | null; notes: string | null };

export type PppoePackage = { id: string; name: string; downloadMbps: number; uploadMbps: number; price: number; costPrice: number; addressPool: string | null; ipPool: IpPool | null; validityDays: number; isActive: boolean; accountsCount?: number; rateLimit?: string };
export type PppoeAccount = { id: string; pppoePackageId: string; customerName: string; username: string; phone: string | null; address: string | null; expiresAt: string | null; isActive: boolean; notes: string | null; idCardNumber: string | null; idCardPhoto: string | null; latitude: number | null; longitude: number | null; subscriptionType: string; billingDay: number; discount: number; odp: string | null; routerNasId: number | null; routerNas: NasOption | null; uptime?: string | null; package: PppoePackage; areaId?: string | null; area?: { id: string; name: string } | null };

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

// === Finance & Area Types ===

export type Area = {
  id: string;
  name: string;
  description?: string | null;
  accountsCount?: number;
  collectors?: AreaCollector[];
};

export type AreaCollector = {
  id: string;
  areaId: string;
  userId: string;
  isDefault: boolean;
  user?: { id: string; name: string; email: string; phone?: string | null; role: string };
};

export type AreaCustomer = {
  id: string;
  customerNumber: string;
  customerName: string;
  username: string;
  phone?: string | null;
  address?: string | null;
  isActive: boolean;
  package?: { id: string; name: string; price: number } | null;
  isPaid: boolean;
  billingStatus: 'PAID' | 'UNPAID' | 'OVERDUE' | 'PENDING_VERIFICATION';
  unpaidAmount: number;
  unpaidCount: number;
  activeInvoice?: {
    id: string;
    invoiceNumber: string;
    amount: number;
    dueDate: string;
    hasPendingDeposit: boolean;
    depositId?: string | null;
  } | null;
};

export type AreaBillingSummary = {
  totalCustomers: number;
  unpaidCustomers: number;
  paidCustomers: number;
  totalUnpaidAmount: number;
};

export type CollectorDeposit = {
  id: string;
  pppoeAccountId: string;
  invoiceId: string;
  collectorUserId: string;
  amount: number;
  depositDate: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  acceptedAt?: string | null;
  notes?: string | null;
  receiptPhoto?: string | null;
  createdAt: string;
  account?: {
    id: string;
    customerNumber: string;
    customerName: string;
    phone?: string | null;
    username: string;
    area?: { id: string; name: string } | null;
  };
  invoice?: { id: string; invoiceNumber: string; amount: number; dueDate: string; status: string };
  collector?: { id: string; name: string; phone?: string | null };
  acceptedBy?: { id: string; name: string } | null;
};

export type FinanceTransaction = {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  amount: number;
  description: string;
  referenceType?: string | null;
  referenceId?: string | null;
  transactionDate: string;
  createdAt: string;
  createdBy?: { id: string; name: string; role: string };
};

export type FinanceSummary = {
  month: number;
  year: number;
  monthlyIncome: number;
  monthlyExpense: number;
  monthlyBalance: number;
  monthlyIncomeCount: number;
  monthlyExpenseCount: number;
  totalIncome: number;
  totalExpense: number;
  totalBalance: number;
  pendingDeposits: number;
};

export type PsbOrder = {
  id: string; customerNumber: string; customerId: string; customerName: string; phone: string; address: string;
  pppoePackageId: string; areaId?: string | null; status: 'PROCESS' | 'ACTIVATED' | 'COMPLETED'; username?: string | null;
  installationPhoto?: string | null; createdAt: string; completedAt?: string | null;
  package: { id: string; name: string; price: number }; area?: { id: string; name: string } | null; sales?: { id: string; name: string };
};
