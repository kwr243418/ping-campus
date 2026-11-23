import { EventDetail } from "@/components/EventDetail";

// S05 이벤트 상세
export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EventDetail id={decodeURIComponent(id)} />;
}
