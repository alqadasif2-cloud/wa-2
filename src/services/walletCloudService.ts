import { User, Wallet, Transaction, AppNotification } from '../types/wallet';
import { db, handleFirestoreError, OperationType } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  onSnapshot 
} from 'firebase/firestore';

export function cleanForFirestore<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        result[key] = cleanForFirestore(value);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

export class WalletCloudService {
  /**
   * Extract username, address, or query from input text, URL, or URI scheme
   */
  public static extractRecipientQuery(queryText: string): string {
    if (!queryText) return '';
    const trimmed = queryText.trim();
    try {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const url = new URL(trimmed);
        const param = url.searchParams.get('payto') || 
                      url.searchParams.get('recipient') || 
                      url.searchParams.get('address') ||
                      url.searchParams.get('to');
        if (param) return param.trim();
      }
    } catch {}

    if (trimmed.startsWith('ethereum:') || trimmed.startsWith('binance:') || trimmed.startsWith('tron:')) {
      return trimmed.split(':')[1]?.split('?')[0]?.trim() || trimmed;
    }

    if (trimmed.startsWith('@')) {
      return trimmed.slice(1).trim();
    }

    return trimmed;
  }

  /**
   * Generates a shareable URL / payment link for receiving transfers
   */
  public static getShareableWalletLink(address: string): string {
    if (typeof window === 'undefined') return `https://trustwalletpro.app/?payto=${address}`;
    const origin = window.location.origin;
    return `${origin}/?payto=${encodeURIComponent(address)}`;
  }

  /**
   * Lookup recipient in local storage first, then search cloud Firestore
   */
  public static async lookupRecipientCloud(
    queryText: string,
    localUsers: User[] = []
  ): Promise<{ found: boolean; user?: User; isCloudVerified?: boolean }> {
    const cleaned = this.extractRecipientQuery(queryText).toLowerCase();
    if (!cleaned) {
      return { found: false };
    }

    // 1. Search locally first
    const localMatch = localUsers.find(u => 
      u.userId.toLowerCase() === cleaned ||
      u.username.toLowerCase() === cleaned ||
      u.demoAddress.toLowerCase() === cleaned
    );

    if (localMatch) {
      return { found: true, user: localMatch, isCloudVerified: true };
    }

    // 2. Query cloud Firestore
    try {
      // By username
      const qUsername = query(collection(db, 'users'), where('username', '==', cleaned));
      const snapUsername = await getDocs(qUsername);
      if (!snapUsername.empty) {
        const cloudUser = snapUsername.docs[0].data() as User;
        return { found: true, user: cloudUser, isCloudVerified: true };
      }

      // By address
      const qAddress = query(collection(db, 'users'), where('demoAddress', '==', cleaned));
      const snapAddress = await getDocs(qAddress);
      if (!snapAddress.empty) {
        const cloudUser = snapAddress.docs[0].data() as User;
        return { found: true, user: cloudUser, isCloudVerified: true };
      }

      // By userId
      const qUserId = query(collection(db, 'users'), where('userId', '==', cleaned));
      const snapUserId = await getDocs(qUserId);
      if (!snapUserId.empty) {
        const cloudUser = snapUserId.docs[0].data() as User;
        return { found: true, user: cloudUser, isCloudVerified: true };
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'users');
    }

    return { found: false };
  }

  /**
   * Save or sync a user and wallet to Firestore Cloud
   */
  public static async saveUserToCloud(user: User, wallet?: Wallet): Promise<void> {
    try {
      if (user?.userId) {
        await setDoc(doc(db, 'users', user.userId), cleanForFirestore(user), { merge: true });
      }
      if (wallet?.walletId) {
        await setDoc(doc(db, 'wallets', wallet.walletId), cleanForFirestore(wallet), { merge: true });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'users/wallets');
    }
  }

  /**
   * Execute cloud transfer with Firestore transaction persistence
   */
  public static async executeCloudSendTransfer(params: {
    sender: User;
    senderWallet: Wallet;
    recipient: User;
    recipientWallet: Wallet;
    amount: number;
    currency?: string;
    lockDurationMinutes?: number;
    notes?: string;
    idempotencyKey?: string;
  }): Promise<{ success: boolean; message: string; transaction?: Transaction }> {
    const {
      sender,
      senderWallet,
      recipient,
      recipientWallet,
      amount,
      currency = 'USD',
      lockDurationMinutes = 0,
      notes
    } = params;

    const isLocked = (lockDurationMinutes || 0) > 0;
    const nowIso = new Date().toISOString();
    const lockUntilIso = isLocked ? new Date(Date.now() + (lockDurationMinutes || 0) * 60000).toISOString() : undefined;
    const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const tx: Transaction = {
      transactionId: txId,
      senderUserId: sender.userId,
      senderUsername: sender.username,
      senderAddress: sender.demoAddress,
      receiverUserId: recipient.userId,
      receiverUsername: recipient.username,
      receiverAddress: recipient.demoAddress,
      destinationAddress: recipient.demoAddress,
      amount,
      currency,
      network: recipientWallet.networkType || 'BEP20',
      transactionType: 'send',
      status: isLocked ? 'locked' : 'completed',
      statusTextAr: isLocked ? `مقيد لمدة ${lockDurationMinutes} دقيقة` : 'مكتمل بنجاح',
      createdAt: nowIso,
      lockUntil: lockUntilIso,
      lockDurationMinutes: lockDurationMinutes || 0,
      notes: notes || '',
      formattedTimeAr: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      networkTxHash: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
      blockNumber: Math.floor(40000000 + Math.random() * 1000000)
    };

    try {
      // 1. Write transaction to cloud
      await setDoc(doc(db, 'transactions', txId), cleanForFirestore(tx), { merge: true });

      // 2. Update cloud sender wallet
      const updatedSenderWallet: Partial<Wallet> = {
        totalDemoBalance: Math.round((senderWallet.totalDemoBalance - amount) * 100) / 100,
        availableDemoBalance: Math.round((senderWallet.availableDemoBalance - amount) * 100) / 100,
        updatedAt: nowIso
      };
      await setDoc(doc(db, 'wallets', senderWallet.walletId), cleanForFirestore(updatedSenderWallet), { merge: true });

      // 3. Update cloud recipient wallet
      const updatedRecipientWallet: Partial<Wallet> = {
        totalDemoBalance: Math.round((recipientWallet.totalDemoBalance + amount) * 100) / 100,
        lockedDemoBalance: isLocked 
          ? Math.round(((recipientWallet.lockedDemoBalance || 0) + amount) * 100) / 100 
          : recipientWallet.lockedDemoBalance || 0,
        availableDemoBalance: !isLocked 
          ? Math.round(((recipientWallet.availableDemoBalance || 0) + amount) * 100) / 100 
          : recipientWallet.availableDemoBalance || 0,
        updatedAt: nowIso
      };
      await setDoc(doc(db, 'wallets', recipientWallet.walletId), cleanForFirestore(updatedRecipientWallet), { merge: true });

      // 4. Send notification to recipient
      const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const senderName = sender.displayName || sender.username;
      const notif: AppNotification = {
        notificationId: notifId,
        recipientUserId: recipient.userId,
        transactionId: txId,
        title: 'تم استلام أموال جديدة',
        titleAr: 'تم استلام أموال جديدة',
        body: `تم استلام مبلغ قدره $${amount.toFixed(2)} من [${senderName}]`,
        bodyAr: `تم استلام مبلغ قدره $${amount.toFixed(2)} من [${senderName}]`,
        createdAt: nowIso,
        read: false,
        type: isLocked ? 'locked_transfer' : 'incoming_transfer'
      };
      await setDoc(doc(db, 'notifications', notifId), cleanForFirestore(notif), { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'transfer');
    }

    return {
      success: true,
      message: isLocked 
        ? `تم إرسال التحويل بنجاح! المبلغ مقيد لمدة ${lockDurationMinutes} دقيقة.` 
        : 'تم إرسال التحويل السحابي بنجاح.',
      transaction: tx
    };
  }

  /**
   * Real-time subscription to user transactions (sent or received)
   */
  public static subscribeUserTransactions(
    userId: string,
    callback: (txs: Transaction[]) => void
  ): () => void {
    try {
      const colRef = collection(db, 'transactions');
      const unsubscribe = onSnapshot(colRef, (snapshot) => {
        const txs: Transaction[] = [];
        snapshot.forEach((d) => {
          const data = d.data() as Transaction;
          if (data.senderUserId === userId || data.receiverUserId === userId) {
            txs.push(data);
          }
        });
        txs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(txs);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'transactions');
      });

      return unsubscribe;
    } catch {
      return () => {};
    }
  }

  /**
   * Real-time subscription to user notifications
   */
  public static subscribeUserNotifications(
    userId: string,
    callback: (notifs: AppNotification[]) => void
  ): () => void {
    try {
      const colRef = collection(db, 'notifications');
      const unsubscribe = onSnapshot(colRef, (snapshot) => {
        const notifs: AppNotification[] = [];
        snapshot.forEach((d) => {
          const data = d.data() as AppNotification;
          if (data.recipientUserId === userId) {
            notifs.push(data);
          }
        });
        notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(notifs);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'notifications');
      });

      return unsubscribe;
    } catch {
      return () => {};
    }
  }
}
