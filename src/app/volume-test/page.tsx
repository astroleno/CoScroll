import dynamic from 'next/dynamic';

const VolumeRenderer = dynamic(() => import('@/components/volume/VolumeRenderer'), {
  ssr: false,
});

export default function Page() {
  return (
    <main className="w-screen h-screen bg-black">
      <VolumeRenderer />
    </main>
  );
}


