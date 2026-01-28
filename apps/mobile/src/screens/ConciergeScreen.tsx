import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { chatWithSteven } from '../services/echo-prime';

const COLORS = {
  maroon: '#500000',
  cream: '#F5F5F0',
  gold: '#C4A777',
  charcoal: '#2D2D2D',
  white: '#FFFFFF',
};

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  emotion?: string;
}

const QuickButton = ({ emoji, label, onPress }: any) => (
  <TouchableOpacity style={styles.quickButton} onPress={onPress}>
    <Text style={styles.quickEmoji}>{emoji}</Text>
    <Text style={styles.quickLabel}>{label}</Text>
  </TouchableOpacity>
);

export default function ConciergeScreen() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: 'assistant', content: "Hi! I'm Steven, your Right at Home AI concierge. How can I help you enjoy Midland today? 🏠" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Real AI response from Echo Prime with Steven personality
      const response = await chatWithSteven(text);

      const assistantMsg: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response.response,
        emotion: response.emotion?.primary_emotion
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      // Fallback response if API fails
      console.error('Chat error:', error);
      const fallbackMsg: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: "I'm having trouble connecting right now. Please try again in a moment, or contact Steven directly for urgent needs. 📞"
      };
      setMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <QuickButton emoji="🍽️" label="Food" onPress={() => sendMessage("Where should I eat dinner?")} />
        <QuickButton emoji="🍷" label="Wine" onPress={() => sendMessage("Recommend a wine bar")} />
        <QuickButton emoji="📶" label="WiFi" onPress={() => sendMessage("What's the WiFi password?")} />
        <QuickButton emoji="⏰" label="Checkout" onPress={() => sendMessage("What time is checkout?")} />
      </View>

      {/* Messages */}
      <ScrollView 
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.map(msg => (
          <View
            key={msg.id}
            style={[
              styles.messageBubble,
              msg.role === 'user' ? styles.userBubble : styles.assistantBubble
            ]}
          >
            <Text style={[
              styles.messageText,
              msg.role === 'user' ? styles.userText : styles.assistantText
            ]}>
              {msg.content}
            </Text>
          </View>
        ))}
        {isLoading && (
          <View style={[styles.messageBubble, styles.assistantBubble]}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={COLORS.maroon} />
              <Text style={styles.loadingText}>Steven is typing...</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask me anything..."
          placeholderTextColor="#999"
          returnKeyType="send"
          onSubmitEditing={() => sendMessage(input)}
        />
        <TouchableOpacity
          style={[styles.sendButton, isLoading && styles.sendButtonDisabled]}
          onPress={() => sendMessage(input)}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.sendText}>→</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  quickActions: { flexDirection: 'row', padding: 12, gap: 8 },
  quickButton: { flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#EEE' },
  quickEmoji: { fontSize: 24, marginBottom: 4 },
  quickLabel: { fontSize: 12, color: COLORS.charcoal, fontWeight: '500' },
  messages: { flex: 1 },
  messagesContent: { padding: 16, gap: 12 },
  messageBubble: { maxWidth: '80%', padding: 14, borderRadius: 18 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: COLORS.maroon, borderBottomRightRadius: 4 },
  assistantBubble: { alignSelf: 'flex-start', backgroundColor: COLORS.white, borderBottomLeftRadius: 4 },
  messageText: { fontSize: 15, lineHeight: 22 },
  userText: { color: COLORS.white },
  assistantText: { color: COLORS.charcoal },
  inputContainer: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: '#EEE' },
  input: { flex: 1, backgroundColor: COLORS.cream, borderRadius: 24, paddingHorizontal: 20, paddingVertical: 12, fontSize: 16 },
  sendButton: { width: 48, height: 48, backgroundColor: COLORS.maroon, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  sendButtonDisabled: { opacity: 0.6 },
  sendText: { color: COLORS.white, fontSize: 20, fontWeight: 'bold' },
  loadingContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingText: { color: COLORS.charcoal, fontSize: 14, fontStyle: 'italic' },
});
