import { useState } from 'react';
import { StationSpec } from './types/simulator';
import StationSelectModal from './components/StationSelectModal';
import DispatcherLayout from './components/DispatcherLayout';

export default function App() {
  const [station, setStation] = useState<StationSpec | null>(null);
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {station ? <DispatcherLayout station={station} /> : <StationSelectModal onDispatch={setStation} />}
    </div>
  );
}
