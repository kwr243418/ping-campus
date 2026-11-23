import { BottomTabBar } from "@/components/BottomTabBar";
import { OnboardingGate } from "@/components/OnboardingGate";

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <OnboardingGate />
      <main className="pb-[calc(5rem+env(safe-area-inset-bottom))]">{children}</main>
      <BottomTabBar />
    </>
  );
}
