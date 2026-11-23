import { Canvas } from '@react-three/fiber';
import { WorkbenchScene } from './scene/WorkbenchScene';
import { ComponentSidebar } from './ui/ComponentSidebar';
import { SchematicPanel } from './ui/SchematicPanel';
import { Toolbar } from './ui/Toolbar';

export function App() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950">
      <Toolbar />
      <ComponentSidebar />
      <SchematicPanel />

      <Canvas
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 6.2, 6.8], fov: 42, near: 0.1, far: 100 }}
        className="w-full h-full touch-none"
      >
        <WorkbenchScene />
      </Canvas>
    </div>
  );
}

export default App;
