import { ProjectDetailPage } from "@/page-components/projects/project-detail-page";

interface PageProps {
  params: { id: string };
}

export default function Page({ params }: PageProps) {
  return <ProjectDetailPage projectId={params.id} />;
}
