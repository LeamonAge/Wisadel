import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAccountStore } from './src/stores/accountStore';
import { useChatStore } from './src/stores/chatStore';
import LoginScreen from './src/screens/LoginScreen';
import MainScreen from './src/screens/MainScreen';
import { dsColors } from './src/utils/theme';

const Stack = createNativeStackNavigator();

const navTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: dsColors.accent,
    background: dsColors.bg,
    card: dsColors.sidebarBg,
    text: dsColors.textPrimary,
    border: dsColors.border,
    notification: dsColors.accent,
  },
};

export default function App() {
  const account = useAccountStore((s) => s.account);
  const loading = useAccountStore((s) => s.loading);
  const loadAccount = useAccountStore((s) => s.load);
  const loadChats = useChatStore((s) => s.load);

  useEffect(() => { loadAccount(); loadChats(); }, []);

  if (loading) return null;

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="light" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {account ? (
          <Stack.Screen name="Main" component={MainScreen} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
