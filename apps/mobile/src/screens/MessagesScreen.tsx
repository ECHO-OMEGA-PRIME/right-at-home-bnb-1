/**
 * Right at Home BnB - Messages Screen
 * Guest communication inbox
 * @author ECHO OMEGA PRIME
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, KeyboardAvoidingView, Platform,
  Image, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../theme/colors';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderType: 'guest' | 'manager' | 'system';
  content: string;
  timestamp: Date;
  isRead: boolean;
  attachments?: { type: 'image' | 'file'; url: string }[];
}

interface Conversation {
  id: string;
  participantId: string;
  participantName: string;
  participantType: 'guest' | 'manager';
  propertyName?: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  avatar?: string;
  isOnline?: boolean;
}

interface MessagesScreenProps {
  navigation: any;
  route?: {
    params?: {
      conversationId?: string;
    };
  };
}

export default function MessagesScreen({ navigation, route }: MessagesScreenProps) {
  const [activeView, setActiveView] = useState<'list' | 'chat'>('list');
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: 'conv_1',
      participantId: 'manager_1',
      participantName: 'Steven (Manager)',
      participantType: 'manager',
      lastMessage: 'Great job on the Castleford cleaning! The guest left a 5-star review.',
      lastMessageTime: new Date(Date.now() - 3600000),
      unreadCount: 1,
      isOnline: true,
    },
    {
      id: 'conv_2',
      participantId: 'guest_1',
      participantName: 'John D.',
      participantType: 'guest',
      propertyName: 'Basin View Cottage',
      lastMessage: 'Thank you! The place was spotless when we arrived.',
      lastMessageTime: new Date(Date.now() - 86400000),
      unreadCount: 0,
    },
    {
      id: 'conv_3',
      participantId: 'guest_2',
      participantName: 'Emily R.',
      participantType: 'guest',
      propertyName: 'Permian Palace',
      lastMessage: 'Is there a way to get extra towels?',
      lastMessageTime: new Date(Date.now() - 172800000),
      unreadCount: 2,
    },
  ]);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg_1',
      senderId: 'manager_1',
      senderName: 'Steven',
      senderType: 'manager',
      content: 'Great job on the Castleford cleaning! The guest left a 5-star review.',
      timestamp: new Date(Date.now() - 3600000),
      isRead: false,
    },
    {
      id: 'msg_2',
      senderId: 'cleaner_123',
      senderName: 'You',
      senderType: 'manager',
      content: 'Thank you! I paid extra attention to the kitchen this time.',
      timestamp: new Date(Date.now() - 3500000),
      isRead: true,
    },
    {
      id: 'msg_3',
      senderId: 'manager_1',
      senderName: 'Steven',
      senderType: 'manager',
      content: 'I noticed! Keep up the excellent work. The guest mentioned how clean the oven was.',
      timestamp: new Date(Date.now() - 3400000),
      isRead: false,
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = diff / (1000 * 60 * 60);

    if (hours < 1) {
      return `${Math.floor(diff / (1000 * 60))}m ago`;
    } else if (hours < 24) {
      return `${Math.floor(hours)}h ago`;
    } else if (hours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
  };

  const handleSendMessage = () => {
    if (!inputText.trim() || !selectedConversation) return;

    const newMessage: Message = {
      id: `msg_${Date.now()}`,
      senderId: 'cleaner_123',
      senderName: 'You',
      senderType: 'manager',
      content: inputText.trim(),
      timestamp: new Date(),
      isRead: true,
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputText('');

    // Update conversation
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === selectedConversation.id
          ? { ...conv, lastMessage: inputText.trim(), lastMessageTime: new Date() }
          : conv
      )
    );

    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const openConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setActiveView('chat');

    // Mark as read
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === conversation.id ? { ...conv, unreadCount: 0 } : conv
      )
    );
  };

  const renderConversationItem = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={[styles.conversationItem, item.unreadCount > 0 && styles.conversationUnread]}
      onPress={() => openConversation(item)}
    >
      <View style={styles.avatarContainer}>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, item.participantType === 'manager' && styles.managerAvatar]}>
            <Text style={styles.avatarText}>{item.participantName.charAt(0)}</Text>
          </View>
        )}
        {item.isOnline && <View style={styles.onlineDot} />}
      </View>

      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={[styles.participantName, item.unreadCount > 0 && styles.textBold]}>
            {item.participantName}
          </Text>
          <Text style={styles.timestamp}>{formatTime(item.lastMessageTime)}</Text>
        </View>
        {item.propertyName && (
          <Text style={styles.propertyTag}>🏠 {item.propertyName}</Text>
        )}
        <Text
          style={[styles.lastMessage, item.unreadCount > 0 && styles.textBold]}
          numberOfLines={2}
        >
          {item.lastMessage}
        </Text>
      </View>

      {item.unreadCount > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{item.unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.senderId === 'cleaner_123';
    const showDate = index === 0 ||
      messages[index - 1].timestamp.toDateString() !== item.timestamp.toDateString();

    return (
      <>
        {showDate && (
          <View style={styles.dateHeader}>
            <Text style={styles.dateText}>
              {item.timestamp.toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
              })}
            </Text>
          </View>
        )}
        <View style={[styles.messageContainer, isMe && styles.messageContainerMe]}>
          {!isMe && (
            <View style={styles.messageSenderAvatar}>
              <Text style={styles.messageSenderAvatarText}>
                {item.senderName.charAt(0)}
              </Text>
            </View>
          )}
          <View style={[styles.messageBubble, isMe && styles.messageBubbleMe]}>
            {!isMe && (
              <Text style={styles.messageSender}>{item.senderName}</Text>
            )}
            <Text style={[styles.messageText, isMe && styles.messageTextMe]}>
              {item.content}
            </Text>
            <Text style={[styles.messageTime, isMe && styles.messageTimeMe]}>
              {item.timestamp.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
      </>
    );
  };

  if (activeView === 'chat' && selectedConversation) {
    return (
      <SafeAreaView style={styles.container}>
        {/* Chat Header */}
        <View style={styles.chatHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setActiveView('list')}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.chatHeaderInfo}>
            <Text style={styles.chatHeaderName}>{selectedConversation.participantName}</Text>
            {selectedConversation.propertyName && (
              <Text style={styles.chatHeaderProperty}>🏠 {selectedConversation.propertyName}</Text>
            )}
          </View>
          {selectedConversation.isOnline && (
            <View style={styles.chatOnlineIndicator}>
              <View style={styles.chatOnlineDot} />
              <Text style={styles.chatOnlineText}>Online</Text>
            </View>
          )}
        </View>

        {/* Messages */}
        <KeyboardAvoidingView
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={90}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />

          {/* Input */}
          <View style={styles.inputContainer}>
            <TouchableOpacity style={styles.attachButton}>
              <Text style={styles.attachIcon}>📎</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.textInput}
              placeholder="Type a message..."
              placeholderTextColor={COLORS.grayLight}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
              onPress={handleSendMessage}
              disabled={!inputText.trim()}
            >
              <Text style={styles.sendIcon}>➤</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations..."
          placeholderTextColor={COLORS.grayLight}
        />
      </View>

      {/* Conversations List */}
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={renderConversationItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>
              Messages from property managers and guests will appear here
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.maroon,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: COLORS.white,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  headerRight: {
    width: 40,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.charcoal,
  },

  // Conversations List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  conversationUnread: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.maroon,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.grayLighter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  managerAvatar: {
    backgroundColor: `${COLORS.maroon}20`,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.gray,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.success,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  conversationContent: {
    flex: 1,
    marginLeft: 12,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  participantName: {
    fontSize: 15,
    color: COLORS.charcoal,
  },
  timestamp: {
    fontSize: 11,
    color: COLORS.grayLight,
  },
  propertyTag: {
    fontSize: 11,
    color: COLORS.gold,
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 13,
    color: COLORS.gray,
    lineHeight: 18,
  },
  textBold: {
    fontWeight: '600',
    color: COLORS.charcoal,
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.maroon,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  unreadText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.white,
    paddingHorizontal: 6,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.charcoal,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },

  // Chat View
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.maroon,
  },
  chatHeaderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  chatHeaderName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
  chatHeaderProperty: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  chatOnlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatOnlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
    marginRight: 6,
  },
  chatOnlineText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    padding: 16,
  },
  dateHeader: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateText: {
    fontSize: 12,
    color: COLORS.gray,
    backgroundColor: COLORS.grayLighter,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    maxWidth: '80%',
  },
  messageContainerMe: {
    alignSelf: 'flex-end',
  },
  messageSenderAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.grayLighter,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  messageSenderAvatarText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray,
  },
  messageBubble: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    padding: 12,
    maxWidth: '100%',
  },
  messageBubbleMe: {
    backgroundColor: COLORS.maroon,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 4,
  },
  messageSender: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.gold,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    color: COLORS.charcoal,
    lineHeight: 20,
  },
  messageTextMe: {
    color: COLORS.white,
  },
  messageTime: {
    fontSize: 10,
    color: COLORS.grayLight,
    marginTop: 4,
    textAlign: 'right',
  },
  messageTimeMe: {
    color: 'rgba(255,255,255,0.7)',
  },

  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.grayLighter,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.grayLighter,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  attachIcon: {
    fontSize: 20,
  },
  textInput: {
    flex: 1,
    backgroundColor: COLORS.cream,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.charcoal,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.maroon,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.grayLight,
  },
  sendIcon: {
    fontSize: 18,
    color: COLORS.white,
  },
});
