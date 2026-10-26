import { Conversation, ChatMessage, User } from '../types/wallet';
import { db, handleFirestoreError, OperationType } from './firebase';
import { cleanForFirestore } from './walletCloudService';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot 
} from 'firebase/firestore';

const STORAGE_KEYS = {
  CONVERSATIONS: 'twp_conversations_v4',
  MESSAGES: 'twp_messages_v4'
};

export class ChatService {
  private static getLocalConversations(): Conversation[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private static saveLocalConversations(convs: Conversation[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(convs));
    } catch {}
  }

  private static getLocalMessages(): Record<string, ChatMessage[]> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MESSAGES);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  private static saveLocalMessages(msgs: Record<string, ChatMessage[]>): void {
    try {
      localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(msgs));
    } catch {}
  }

  public static async getOrCreateConversation(currentUser: User, targetUser: User): Promise<Conversation> {
    const sortedIds = [currentUser.userId, targetUser.userId].sort();
    const conversationId = `conv_${sortedIds.join('_')}`;

    const localConvs = this.getLocalConversations();
    const existing = localConvs.find(c => c.conversationId === conversationId);
    if (existing) return existing;

    const nowIso = new Date().toISOString();
    const newConv: Conversation = {
      conversationId,
      participantIds: sortedIds,
      participantNames: {
        [currentUser.userId]: currentUser.displayName || currentUser.username,
        [targetUser.userId]: targetUser.displayName || targetUser.username
      },
      lastMessageText: '',
      lastMessageAt: nowIso,
      updatedAt: nowIso
    };

    localConvs.unshift(newConv);
    this.saveLocalConversations(localConvs);

    try {
      const convRef = doc(db, 'conversations', conversationId);
      const snap = await getDoc(convRef);
      if (!snap.exists()) {
        await setDoc(convRef, cleanForFirestore(newConv), { merge: true });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'conversations');
    }

    return newConv;
  }

  public static subscribeToUserConversations(
    userId: string,
    callback: (convs: Conversation[]) => void
  ): () => void {
    // Immediate local response
    const local = this.getLocalConversations().filter(c => c.participantIds.includes(userId));
    callback(local);

    try {
      const colRef = collection(db, 'conversations');
      const unsubscribe = onSnapshot(colRef, (snapshot) => {
        const cloudConvs: Conversation[] = [];
        snapshot.forEach(d => {
          const conv = d.data() as Conversation;
          if (conv.participantIds && conv.participantIds.includes(userId)) {
            cloudConvs.push(conv);
          }
        });

        // Merge with local
        const map = new Map<string, Conversation>();
        local.forEach(c => map.set(c.conversationId, c));
        cloudConvs.forEach(c => map.set(c.conversationId, c));

        const merged = Array.from(map.values());
        merged.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        this.saveLocalConversations(merged);
        callback(merged);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'conversations');
      });

      return unsubscribe;
    } catch {
      return () => {};
    }
  }

  public static subscribeToMessages(
    conversationId: string,
    callback: (msgs: ChatMessage[]) => void
  ): () => void {
    const allLocal = this.getLocalMessages();
    const localMsgs = allLocal[conversationId] || [];
    callback(localMsgs);

    try {
      const colRef = collection(db, 'conversations', conversationId, 'messages');
      const unsubscribe = onSnapshot(colRef, (snapshot) => {
        const cloudMsgs: ChatMessage[] = [];
        snapshot.forEach(d => {
          cloudMsgs.push(d.data() as ChatMessage);
        });

        const map = new Map<string, ChatMessage>();
        localMsgs.forEach(m => map.set(m.messageId, m));
        cloudMsgs.forEach(m => map.set(m.messageId, m));

        const merged = Array.from(map.values());
        merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        const currentLocal = this.getLocalMessages();
        currentLocal[conversationId] = merged;
        this.saveLocalMessages(currentLocal);

        callback(merged);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, `conversations/${conversationId}/messages`);
      });

      return unsubscribe;
    } catch {
      return () => {};
    }
  }

  public static async sendMessage(params: {
    conversationId: string;
    sender: User;
    receiver: User;
    text: string;
  }): Promise<void> {
    const { conversationId, sender, receiver, text } = params;
    const nowIso = new Date().toISOString();
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const message: ChatMessage = {
      messageId,
      conversationId,
      senderUserId: sender.userId,
      senderUsername: sender.username,
      receiverUserId: receiver.userId,
      text,
      createdAt: nowIso,
      read: false
    };

    // Save locally
    const allLocal = this.getLocalMessages();
    const convMsgs = allLocal[conversationId] || [];
    convMsgs.push(message);
    allLocal[conversationId] = convMsgs;
    this.saveLocalMessages(allLocal);

    // Update conversation local
    const localConvs = this.getLocalConversations();
    const convIndex = localConvs.findIndex(c => c.conversationId === conversationId);
    if (convIndex >= 0) {
      localConvs[convIndex].lastMessageText = text;
      localConvs[convIndex].lastMessageAt = nowIso;
      localConvs[convIndex].updatedAt = nowIso;
      this.saveLocalConversations(localConvs);
    }

    // Push to Firestore
    try {
      const msgRef = doc(db, 'conversations', conversationId, 'messages', messageId);
      await setDoc(msgRef, cleanForFirestore(message), { merge: true });

      const convRef = doc(db, 'conversations', conversationId);
      await setDoc(convRef, {
        lastMessageText: text,
        lastMessageAt: nowIso,
        updatedAt: nowIso
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `conversations/${conversationId}/messages`);
    }
  }
}
