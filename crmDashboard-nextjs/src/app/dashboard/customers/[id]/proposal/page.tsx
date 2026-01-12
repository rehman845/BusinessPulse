import { ProposalPage } from "@/page-components/proposal";

interface PageProps {
  params: { id: string };
}

export default function Page({ params }: PageProps) {
  // ProposalPage reads selected customer via page context; we pass id via query string if needed later.
  return <ProposalPage />;
}


