export default function Loading() {
  return (
    <div className="fixed top-0 left-0 w-full h-1 bg-neutral-200 overflow-hidden">
      <div className="h-full bg-blue-600 animate-[pulse_1s_infinite] w-1/3 rounded" />
    </div>
  );
}
