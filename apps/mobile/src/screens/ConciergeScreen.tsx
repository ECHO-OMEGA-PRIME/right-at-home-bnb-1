import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform
} from 'react-native';

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
}

const QuickButton = ({ emoji, label, onPress }: any) => (
  <TouchableOpacity style={styles.quickButton} onPress={onPress}>
    <Text style={styles.quickEmoji}>{emoji}</Text>
    <Text style={styles.quickLabel}>{label}</Text>
  </TouchableOpacity>
);

export default function ConciergeScreen() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: 'assistant', content: "Hi! I'm your Right at Home concierge. How can I help you enjoy Midland today?" }
  ]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    
    const userMsg: Message = { id: Date.now(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    // Simulate AI response
    setTimeout(() => {
      let response = "I'd be happy to help! What would you like to know?";
      const q = text.toLowerCase();

      if (q.includes('restaurant') || q.includes('eat') || q.includes('food')) {
        response = "🍽️ Top picks in Midland:\n\n• Cork & Pig Tavern - Great wine bar\n• Venezia - Italian\n• The Garlic Press - Fine dining\n• Cancun - Authentic Mexican\n\nWant directions to any of these?";
      } else if (q.includes('bar') || q.includes('wine') || q.includes('drink')) {
        response = "🍷 Wine & cocktail spots:\n\n• The Blue Door - Elegant wine bar\n• Tall City Brewing - Local craft beer\n• Sip Patio Bar - Trendy cocktails\n\nThe Blue Door is my personal favorite!";
      } else if (q.includes('wifi') || q.includes('password')) {
        response = "📶 WiFi Info:\n\nNetwork: RightAtHome_Guest\nPassword: Welcome2024\n\nRouter is near the living room TV!";
      } else if (q.includes('checkout')) {
        response = "⏰ Checkout is at 11:00 AM\n\nBefore you go:\n✓ Keys on counter\n✓ Close windows\n✓ Take out trash\n\nWant a late checkout? Just ask!";
      } else if (q.includes('late checkout')) {
        response = "I'll request a late checkout for you! What time would you prefer? I'll check with Steven and text you confirmation.";
      }

      const assistantMsg: Message = { id: Date.now() + 1, role: 'assistant', content: response };
      setMessages(prev => [...prev, assistantMsg]);
    }, 800);
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
          style={styles.sendButton}
          onPress={() => sendMessage(input)}
        >
          <Text style={styles.sendText}>→</Text>
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
  sendText: { color: COLORS.white, fontSize: 20, fontWeight: 'bold' },
});
