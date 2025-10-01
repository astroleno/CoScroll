import dynamic from 'next/dynamic';

// 动态导入，禁用SSR
const VolumeTest = dynamic(
  () => import('@/components/volume/VolumeTest'),
  { ssr: false }
);

export default function VolumeRenderTestPage() {
  return (
    <main className="w-screen h-screen" style={{ background: 'transparent' }}>
      <VolumeTest />
    </main>
  );
}