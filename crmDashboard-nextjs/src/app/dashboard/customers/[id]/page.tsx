import { CustomerDetailPage } from "@/page-components/customers";

interface PageProps {
  params: { id: string };
}

export default function Page({ params }: PageProps) {
  return <CustomerDetailPage customerId={params.id} />;
}


