import { UnlockForm } from "@/components/auth/unlock-form";
import { TaxonomyAdmin } from "@/components/taxonomy/taxonomy-admin";
import { readEditorSessionFromCookies } from "@/lib/auth/human-auth";
import { listKnowledgePoints, listTags } from "@/lib/domain/taxonomy-repository";

export const dynamic = "force-dynamic";

export default async function TaxonomyPage() {
  const session = await readEditorSessionFromCookies();

  if (!session) {
    return <UnlockForm />;
  }

  const [knowledgePoints, tags] = await Promise.all([
    listKnowledgePoints(),
    listTags(),
  ]);

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <TaxonomyAdmin knowledgePoints={knowledgePoints} tags={tags} />
    </main>
  );
}
