import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { dailySeed, dateKey, practiceSeed } from './src/engine/daily';
import { createSession, type Session } from './src/engine/session';
import { GameScreen } from './src/screens/GameScreen';
import { HomeScreen, type DailyStatus } from './src/screens/HomeScreen';
import { HowToScreen } from './src/screens/HowToScreen';
import { ResultsScreen } from './src/screens/ResultsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import { AppProvider, useApp } from './src/state/AppContext';
import { storage } from './src/storage';

type Route =
  | { name: 'home' }
  | { name: 'howto'; back: Route }
  | { name: 'settings' }
  | { name: 'game'; session: Session }
  | { name: 'results'; session: Session };

function Router() {
  const { ready, user, settings, theme } = useApp();
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const [today, setToday] = useState(dateKey());
  const [daily, setDaily] = useState<Session | null>(null);

  const refreshDaily = useCallback(async () => {
    const key = dateKey();
    setToday(key);
    setDaily(await storage.loadDaily(key));
  }, []);

  useEffect(() => { refreshDaily(); }, [refreshDaily, route.name]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator color={theme.ink} />
      </View>
    );
  }

  const bar = <StatusBar style={settings.darkTheme ? 'light' : 'dark'} />;
  if (!user) return <>{bar}<SignInScreen /></>;

  const home = () => setRoute({ name: 'home' });
  const practice = () => setRoute({ name: 'game', session: createSession(practiceSeed(), 'practice', today) });
  const status: DailyStatus = !daily ? 'new' : daily.phase === 'done' ? 'done' : 'inProgress';
  const playDaily = () => {
    if (daily?.phase === 'done') setRoute({ name: 'results', session: daily });
    else setRoute({ name: 'game', session: daily ?? createSession(dailySeed(today), 'daily', today) });
  };

  let screen: React.ReactNode;
  switch (route.name) {
    case 'home':
      screen = (
        <HomeScreen
          today={today}
          dailyStatus={status}
          onDaily={playDaily}
          onPractice={practice}
          onHowTo={() => setRoute({ name: 'howto', back: route })}
          onSettings={() => setRoute({ name: 'settings' })}
        />
      );
      break;
    case 'howto':
      screen = <HowToScreen onBack={() => setRoute(route.back)} />;
      break;
    case 'settings':
      screen = <SettingsScreen onBack={home} onHowTo={() => setRoute({ name: 'howto', back: route })} />;
      break;
    case 'game':
      screen = (
        <GameScreen
          key={route.session.seed}
          initial={route.session}
          onExit={home}
          onFinish={(s) => setRoute({ name: 'results', session: s })}
        />
      );
      break;
    case 'results':
      screen = <ResultsScreen session={route.session} onHome={home} onPractice={practice} />;
      break;
  }
  return <>{bar}{screen}</>;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Router />
      </AppProvider>
    </SafeAreaProvider>
  );
}
