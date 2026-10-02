import { useCallback, useState } from 'react';
import StationSelectModal from './components/StationSelectModal';
import DispatcherLayout from './components/DispatcherLayout';
import SplashScreen from './components/SplashScreen';
import ChangelogPage from './components/ChangelogPage';
import { useSfxUnlock } from './audio/sfx';

type View = 'station' | 'dispatch' | 'changelog';

export default function App() {
  const [splash, setSplash] = useState(true);
  const [stationId, setStationId] = useState<string | null>(null);
  const [view, setView] = useState<View>('station');
  const [backView, setBackView] = useState<View>('station');
  useSfxUnlock();

  const openChangelog = useCallback(() => {
    setBackView(view);
    setView('changelog');
  }, [view]);

  if (view === 'changelog') {
    return (
      <div className="relative h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
        {splash ? <SplashScreen onDone={() => setSplash(false)} /> : null}
        <ChangelogPage onBack={() => setView(backView)} />
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {splash ? <SplashScreen onDone={() => setSplash(false)} /> : null}
      {stationId && view === 'dispatch' ? (
        <DispatcherLayout stationId={stationId} onExit={() => setView('station')} onOpenChangelog={openChangelog} />
      ) : (
        <StationSelectModal onStart={(id) => { setStationId(id); setView('dispatch'); }} onOpenChangelog={openChangelog} />
      )}
    </div>
  );
}