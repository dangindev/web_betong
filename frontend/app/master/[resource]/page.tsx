import { ResourcePage } from "@/components/resources/resource-page";

type MasterResourcePageProps = {
  params: Promise<{ resource: string }>;
};

export default async function MasterResourcePage({ params }: MasterResourcePageProps) {
  const { resource } = await params;
  return <ResourcePage resource={resource} />;
}
