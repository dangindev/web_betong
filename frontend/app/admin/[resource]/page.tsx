import { ResourcePage } from "@/components/resources/resource-page";

type AdminResourcePageProps = {
  params: Promise<{ resource: string }>;
};

export default async function AdminResourcePage({ params }: AdminResourcePageProps) {
  const { resource } = await params;
  return <ResourcePage resource={resource} title={`Admin: ${resource}`} />;
}
