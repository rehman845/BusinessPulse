interface PageProps {
  params: Promise<{ employeeId: string }>;
}

export default async function Page({ params }: PageProps) {
  const { employeeId } = await params;
  const { EmployeeDetailPage } = await import("@/page-components/team");
  return <EmployeeDetailPage employeeId={employeeId} />;
}
