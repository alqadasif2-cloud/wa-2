/**
 * Core Domain Types for Trust Wallet Pro
 */

export interface CryptoAsset {
  symbol: string;
  name: string;
  nameAr?: string;
  balance: number;
  usdPrice: number;
  usdValue: number;
  value?: number;
  change24h: number;
  bidPrice?: number;
  askPrice?: number;
  spread?: number;
  high24h?: number;
  low24h?: number;
  volume24h?: number;
  isLive?: boolean;
  network: string;
  icon?: string;
}

// Alias for convenience
export type Asset = CryptoAsset;

export interface User {
  userId: string;
  username: string;
  displayName?: string;
  role: 'owner' | 'user' | string;
  accountStatus: 'active' | 'suspended' | string;
  createdAt: string;
  lastActivityAt?: string;
  walletId: string;
  demoAddress: string;
  email?: string;
  password?: string;
  passwordHash?: string;
  avatarUrl?: string;
  isRegistered?: boolean;
}

export interface Wallet {
  walletId: string;
  ownerUserId: string;
  networkType: 'BEP20' | 'ERC20' | 'TRC20' | string;
  demoAddress: string;
  totalDemoBalance: number;
  availableDemoBalance: number;
  lockedDemoBalance: number;
  updatedAt?: string;
  assets?: CryptoAsset[];
}

export interface Transaction {
  transactionId: string;
  senderUserId: string;
  senderUsername: string;
  senderAddress: string;
  receiverUserId: string;
  receiverUsername: string;
  receiverAddress: string;
  destinationAddress?: string;
  amount: number;
  currency: string;
  network: string;
  transactionType: 'receive' | 'send' | 'refund' | 'admin_adjustment' | 'lock_release' | string;
  status: 'completed' | 'locked' | 'refunded' | 'cancelled' | 'rejected' | 'pending' | string;
  statusTextAr?: string;
  createdAt: string;
  lockUntil?: string;
  lockDurationMinutes?: number;
  notes?: string;
  originalTransactionId?: string;
  formattedTimeAr?: string;
  refundReason?: string;
  isSimulated?: boolean;
  isHistorical?: boolean;
  networkTxHash?: string;
  blockNumber?: number;
}

export interface AdminAuditLog {
  logId: string;
  adminUserId: string;
  adminUsername: string;
  actionType: string;
  targetUserId: string;
  targetUsername: string;
  timestamp: string;
  reason: string;
  previousValue?: string;
  newValue?: string;
}

export interface AppNotification {
  notificationId: string;
  recipientUserId: string;
  transactionId?: string;
  title: string;
  titleAr: string;
  body: string;
  bodyAr: string;
  createdAt: string;
  read: boolean;
  type: string;
}

export interface LiveMarketData {
  symbol: string;
  tickerSymbol?: string;
  name: string;
  nameAr?: string;
  price: number;
  bidPrice?: number;
  askPrice?: number;
  spread?: number;
  change24h: number;
  change24hAmount?: number;
  high24h?: number;
  low24h?: number;
  volume24h?: number;
  lastUpdated: string;
  isLive: boolean;
  source?: string;
}

export interface Conversation {
  conversationId: string;
  participantIds: string[];
  participantNames: Record<string, string>;
  lastMessageText: string;
  lastMessageAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  messageId: string;
  conversationId: string;
  senderUserId: string;
  senderUsername: string;
  receiverUserId: string;
  text: string;
  createdAt: string;
  read: boolean;
}
